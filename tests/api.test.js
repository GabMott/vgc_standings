import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PokeApiClient } from '../src/adapters/api.js';

function makeResponse({ ok = true, status = 200, text = '', json = {} } = {}) {
  return {
    ok,
    status,
    async text() { return text; },
    async json() { return json; },
  };
}

describe('PokeApiClient', () => {
  it('fetches and caches pokepaste raw text', async () => {
    let calls = 0;
    const client = new PokeApiClient({
      fetchFn: async (url) => {
        calls += 1;
        assert.equal(url, 'https://pokepast.es/abc123/raw');
        return makeResponse({ text: 'Pikachu @ Light Ball\nAbility: Static\n- Thunderbolt' });
      },
    });

    const first = await client.fetchPokepaste('https://pokepast.es/abc123');
    const second = await client.fetchPokepaste('https://pokepast.es/abc123/raw');
    assert.equal(first, second);
    assert.equal(calls, 1);

    client.clearCache();
    await client.fetchPokepaste('https://pokepast.es/abc123');
    assert.equal(calls, 2);
  });

  it('rejects invalid pokepaste URLs without calling fetch', async () => {
    let called = false;
    const client = new PokeApiClient({
      fetchFn: async () => {
        called = true;
        return makeResponse();
      },
    });
    await assert.rejects(() => client.fetchPokepaste('https://evil.example.com/abc'), /Invalid pokepast\.es URL/);
    assert.equal(called, false);
  });

  it('uses sprite fallback chain: official-artwork -> home -> front_default -> null', async () => {
    const client = new PokeApiClient({
      fetchFn: async (url) => {
        if (url.endsWith('/pikachu')) {
          return makeResponse({
            json: { sprites: { other: { 'official-artwork': { front_default: 'https://img/pika-art.png' } } } },
          });
        }
        if (url.endsWith('/home-only')) {
          return makeResponse({
            json: { sprites: { other: { 'official-artwork': { front_default: null }, home: { front_default: 'https://img/home.png' } } } },
          });
        }
        if (url.endsWith('/basic-only')) {
          return makeResponse({
            json: { sprites: { other: { 'official-artwork': { front_default: null } }, front_default: 'https://img/basic.png' } },
          });
        }
        if (url.endsWith('/shiny-mon')) {
          return makeResponse({
            json: { sprites: { other: { 'official-artwork': { front_shiny: 'https://img/shiny.png' } } } },
          });
        }
        return makeResponse({ ok: false, status: 404 });
      },
    });

    assert.equal((await client.fetchPokemonSprite('pikachu')).url, 'https://img/pika-art.png');
    assert.equal((await client.fetchPokemonSprite('home-only')).url, 'https://img/home.png');
    assert.equal((await client.fetchPokemonSprite('basic-only')).url, 'https://img/basic.png');
    assert.equal((await client.fetchPokemonSprite('shiny-mon', { shiny: true })).url, 'https://img/shiny.png');

    const missing = await client.fetchPokemonSprite('not-a-pokemon');
    assert.equal(missing.url, null);
    assert.match(missing.warning, /404/);
  });

  it('aborts hung requests on timeout and never throws from fetchPokemonSprite', async () => {
    const client = new PokeApiClient({
      timeoutMs: 25,
      fetchFn: (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('Aborted')));
        }),
    });

    const res = await client.fetchPokemonSprite('slowpoke');
    assert.equal(res.url, null);
    assert.match(res.warning, /Could not load sprite/);
  });

  it('resolveTeam accepts raw Showdown text directly and handles partial sprite failures', async () => {
    const client = new PokeApiClient({
      fetchFn: async (url) => {
        if (url.endsWith('/flutter-mane')) {
          return makeResponse({
            json: { sprites: { other: { 'official-artwork': { front_default: 'https://img/fm.png' } } } },
          });
        }
        return makeResponse({ ok: false, status: 404 });
      },
    });

    const raw = `Fluffy (Flutter Mane) @ Booster Energy
Ability: Protosynthesis
Tera Type: Fairy
- Moonblast

MissingNo @ Leftovers
Ability: None
- Tackle`;

    const { pokemon, warnings } = await client.resolveTeam(raw);
    assert.equal(pokemon.length, 2);
    assert.equal(pokemon[0].speciesSlug, 'flutter-mane');
    assert.equal(pokemon[0].spriteUrl, 'https://img/fm.png');
    assert.equal(pokemon[1].spriteUrl, '');
    assert.ok(warnings.some((w) => w.includes('404')));
  });

  it('resolveTeam handles empty input and failed pokepaste fetch gracefully', async () => {
    const client = new PokeApiClient({
      fetchFn: async () => makeResponse({ ok: false, status: 500 }),
    });
    const empty = await client.resolveTeam('');
    assert.deepEqual(empty.pokemon, []);
    assert.ok(empty.warnings.length > 0);

    const failed = await client.resolveTeam('https://pokepast.es/deadbeef');
    assert.deepEqual(failed.pokemon, []);
    assert.ok(failed.warnings[0].includes('500'));
  });
});
