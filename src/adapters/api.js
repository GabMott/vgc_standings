import { toPokepasteRawUrl, parseShowdownTeam } from '../core/pokepaste.js';
import { normalizePokemonSlug } from '../core/pokemon-names.js';

export class PokeApiClient {
  constructor({ fetchFn = globalThis.fetch, timeoutMs = 10000, pokeApiBase = 'https://pokeapi.co/api/v2' } = {}) {
    this.fetchFn = typeof fetchFn === 'function' ? fetchFn.bind(globalThis) : null;
    this.timeoutMs = timeoutMs;
    this.pokeApiBase = String(pokeApiBase).replace(/\/+$/, '');
    this.pasteCache = new Map();
    this.spriteCache = new Map();
    this.catalogPromise = null;
  }

  clearCache() {
    this.pasteCache.clear();
    this.spriteCache.clear();
    this.catalogPromise = null;
  }

  /** Fetches the full PokéAPI Pokémon slug list once and caches it. Never throws. */
  async fetchPokemonCatalog() {
    if (this.catalogPromise) return this.catalogPromise;
    this.catalogPromise = (async () => {
      try {
        const res = await this.fetchWithTimeout(`${this.pokeApiBase}/pokemon?limit=2000`);
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data?.results)
          ? data.results.map((r) => (typeof r?.name === 'string' ? r.name : '')).filter(Boolean)
          : [];
      } catch {
        return [];
      }
    })();
    const list = await this.catalogPromise;
    if (list.length === 0) this.catalogPromise = null;
    return list;
  }

  async fetchWithTimeout(url) {
    if (!this.fetchFn) throw new Error('fetch is not available.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchFn(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  /** Resolves to raw paste text. Throws on invalid URL or failed request. */
  async fetchPokepaste(url) {
    const rawUrl = toPokepasteRawUrl(url);
    if (!rawUrl) throw new Error('Invalid pokepast.es URL.');
    if (this.pasteCache.has(rawUrl)) return this.pasteCache.get(rawUrl);
    const promise = (async () => {
      const res = await this.fetchWithTimeout(rawUrl);
      if (!res.ok) throw new Error(`Pokepaste request failed (${res.status}).`);
      return res.text();
    })();
    this.pasteCache.set(rawUrl, promise);
    try {
      return await promise;
    } catch (err) {
      this.pasteCache.delete(rawUrl);
      throw err;
    }
  }

  /** Never throws. Returns { url, warning }. */
  async fetchPokemonSprite(slug, { shiny = false } = {}) {
    const clean = typeof slug === 'string' ? slug.trim().toLowerCase() : '';
    if (!clean) return { url: null, warning: 'Missing Pokémon name.' };
    const cacheKey = `${clean}|${shiny ? 's' : 'n'}`;
    if (this.spriteCache.has(cacheKey)) return this.spriteCache.get(cacheKey);
    const promise = this._loadSprite(clean, shiny);
    this.spriteCache.set(cacheKey, promise);
    return promise;
  }

  async _loadSprite(slug, shiny) {
    try {
      const res = await this.fetchWithTimeout(`${this.pokeApiBase}/pokemon/${encodeURIComponent(slug)}`);
      if (!res.ok) return { url: null, warning: `Sprite not found for "${slug}" (${res.status}).` };
      const data = await res.json();
      const s = data?.sprites ?? {};
      const key = shiny ? 'front_shiny' : 'front_default';
      const url = s.other?.['official-artwork']?.[key] || s.other?.home?.[key] || s[key] || s.front_default || null;
      return url ? { url, warning: null } : { url: null, warning: `No sprite available for "${slug}".` };
    } catch (err) {
      return { url: null, warning: `Could not load sprite for "${slug}": ${err?.message ?? 'network error'}.` };
    }
  }

  /** Accepts a pokepast.es URL or raw Showdown text. Never throws. */
  async resolveTeam(teamSource, { concurrency = 4 } = {}) {
    const warnings = [];
    const source = typeof teamSource === 'string' ? teamSource.trim() : '';
    if (!source) return { pokemon: [], warnings: ['No team provided.'] };

    let text = source;
    if (toPokepasteRawUrl(source)) {
      try {
        text = await this.fetchPokepaste(source);
      } catch (err) {
        return { pokemon: [], warnings: [`Could not fetch team: ${err?.message ?? 'unknown error'}`] };
      }
    }

    const parsed = parseShowdownTeam(text);
    warnings.push(...(parsed.warnings ?? []));
    const pokemon = (parsed.pokemon ?? []).map((m) => ({ ...m }));

    let next = 0;
    const worker = async () => {
      while (next < pokemon.length) {
        const mon = pokemon[next++];
        const slug = mon.speciesSlug || normalizePokemonSlug(mon.name);
        mon.speciesSlug = slug;
        const { url, warning } = await this.fetchPokemonSprite(slug, { shiny: mon.shiny === true });
        mon.spriteUrl = url ?? '';
        if (warning) warnings.push(warning);
      }
    };
    const n = Math.max(1, Math.min(Math.floor(concurrency) || 1, pokemon.length || 1));
    await Promise.all(Array.from({ length: n }, worker));
    return { pokemon, warnings };
  }
}
