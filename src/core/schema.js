import {
  EVENT_TYPES,
  sanitizeText,
  sanitizeHandle,
  sanitizePlacing,
  sanitizePlayerCount,
  sanitizeUrl,
} from './validation.js';
import { normalizePokemonSlug } from './pokemon-names.js';

export const SCHEMA_VERSION = 1;
export const DEFAULT_SIGNATURE = 'Created by JoshBell302 on GitHub';
export const DEFAULT_THEME_ID = 'portland-dark';
export const MAX_POKEMON_PER_TEAM = 6;

let idCounter = 0;
export function generateId(prefix = 'id') {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') return cryptoObj.randomUUID();
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeStats(input, fill, max) {
  const out = { hp: fill, atk: fill, def: fill, spa: fill, spd: fill, spe: fill };
  if (!isPlainObject(input)) return out;
  for (const key of Object.keys(out)) {
    const n = Number(input[key]);
    if (input[key] !== undefined && input[key] !== null && Number.isFinite(n)) {
      out[key] = Math.max(0, Math.min(max, Math.floor(n)));
    }
  }
  return out;
}

function sanitizeTeamSource(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
    .normalize('NFC')
    .trim()
    .slice(0, 20000);
}

export function createPokemonSet(input = {}) {
  const src = isPlainObject(input) ? input : {};
  const name = sanitizeText(src.name, { maxLength: 60 });
  const gender = typeof src.gender === 'string' && /^[MF]$/i.test(src.gender.trim()) ? src.gender.trim().toUpperCase() : '';
  const level = Number.parseInt(src.level, 10);
  const slugInput = sanitizeText(src.speciesSlug, { maxLength: 80 });
  return {
    name,
    speciesSlug: slugInput || normalizePokemonSlug(name),
    nickname: sanitizeText(src.nickname, { maxLength: 40 }),
    gender,
    item: sanitizeText(src.item, { maxLength: 60 }),
    ability: sanitizeText(src.ability, { maxLength: 60 }),
    teraType: sanitizeText(src.teraType, { maxLength: 30 }),
    nature: sanitizeText(src.nature, { maxLength: 20 }),
    evs: normalizeStats(src.evs, 0, 252),
    ivs: normalizeStats(src.ivs, 31, 31),
    moves: (Array.isArray(src.moves) ? src.moves : [])
      .map((m) => sanitizeText(m, { maxLength: 60 }))
      .filter(Boolean)
      .slice(0, 4),
    shiny: src.shiny === true,
    level: Number.isInteger(level) && level >= 1 && level <= 100 ? level : 100,
    spriteUrl: sanitizeUrl(src.spriteUrl, { allowData: true }),
  };
}

export function createStandingEntry(input = {}) {
  const src = isPlainObject(input) ? input : {};
  const warnings = (Array.isArray(src.warnings) ? src.warnings : [])
    .map((w) => sanitizeText(w, { maxLength: 300 }))
    .filter(Boolean);
  const rawPokemon = Array.isArray(src.pokemon) ? src.pokemon : [];
  if (rawPokemon.length > MAX_POKEMON_PER_TEAM) {
    warnings.push(`Team had ${rawPokemon.length} Pokémon; only ${MAX_POKEMON_PER_TEAM} kept.`);
  }
  return {
    id: sanitizeText(src.id, { maxLength: 80 }) || generateId('entry'),
    placing: sanitizePlacing(src.placing),
    name: sanitizeText(src.name, { maxLength: 60 }),
    handle: sanitizeHandle(src.handle),
    local: sanitizeText(src.local, { maxLength: 100 }),
    teamSource: sanitizeTeamSource(src.teamSource),
    pokemon: rawPokemon.slice(0, MAX_POKEMON_PER_TEAM).map(createPokemonSet),
    redactName: src.redactName === true,
    redactTeam: src.redactTeam === true,
    warnings,
  };
}

function normalizeEvent(input) {
  const src = isPlainObject(input) ? input : {};
  const rawType = src.eventType === 'custom' || src.eventType === 'local' ? 'other' : src.eventType;
  return {
    eventType: EVENT_TYPES.includes(rawType) ? rawType : 'cup',
    customEventLabel: sanitizeText(src.customEventLabel, { maxLength: 60 }),
    location: sanitizeText(src.location, { maxLength: 80 }),
    date: sanitizeText(src.date, { maxLength: 40 }),
    regulation: sanitizeText(src.regulation, { maxLength: 20 }),
    playerCount: sanitizePlayerCount(src.playerCount),
  };
}

function normalizeThemeConfig(input) {
  const src = isPlainObject(input) ? input : {};
  const overrides = {};
  if (isPlainObject(src.overrides)) {
    for (const [key, value] of Object.entries(src.overrides).slice(0, 40)) {
      if (typeof value === 'string' || typeof value === 'number') {
        Object.defineProperty(overrides, sanitizeText(key, { maxLength: 40, fallback: '_' }), {
          value: sanitizeText(value, { maxLength: 2048 }),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
    }
  }
  return { themeId: sanitizeText(src.themeId, { maxLength: 60, fallback: DEFAULT_THEME_ID }), overrides };
}

function isoOrNow(value, fallback) {
  if (typeof value === 'string') {
    const t = Date.parse(value);
    if (Number.isFinite(t)) return new Date(t).toISOString();
  }
  return fallback;
}

export function createEmptyTournament(overrides = {}) {
  const now = new Date().toISOString();
  const src = isPlainObject(overrides) ? overrides : {};
  return {
    schemaVersion: SCHEMA_VERSION,
    id: sanitizeText(src.id, { maxLength: 80 }) || generateId('tournament'),
    draftName: sanitizeText(src.draftName, { maxLength: 80 }),
    createdAt: isoOrNow(src.createdAt, now),
    updatedAt: isoOrNow(src.updatedAt, now),
    event: normalizeEvent(src.event),
    standings: (Array.isArray(src.standings) ? src.standings : []).map(createStandingEntry),
    themeConfig: normalizeThemeConfig(src.themeConfig),
    signature: typeof src.signature === 'string' ? sanitizeText(src.signature, { maxLength: 80 }) : DEFAULT_SIGNATURE,
  };
}

/** Full normalization of untrusted input into a valid TournamentRecord. */
function normalizeTournament(input) {
  const record = createEmptyTournament(input);
  return record;
}

export function serializeTournament(tournament) {
  return JSON.stringify(normalizeTournament(tournament));
}

/** Accepts a JSON string or object. Throws Error on invalid JSON or unsupported schemaVersion. */
export function deserializeTournament(data) {
  let parsed = data;
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data);
    } catch {
      throw new Error('Invalid tournament JSON.');
    }
  }
  if (!isPlainObject(parsed)) throw new Error('Tournament data must be an object.');
  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Unsupported tournament schemaVersion: ${String(parsed.schemaVersion)}.`);
  }
  return normalizeTournament(parsed);
}

export function formatEventTitle(event) {
  const src = isPlainObject(event) ? event : {};
  let label;
  switch (src.eventType) {
    case 'challenge':
      label = 'LEAGUE CHALLENGE';
      break;
    case 'cup':
      label = 'LEAGUE CUP';
      break;
    case 'other':
    case 'custom':
      label = sanitizeText(src.customEventLabel, { maxLength: 60 }).toUpperCase() || 'EVENT';
      break;
    default:
      label = 'EVENT';
  }
  const location = sanitizeText(src.location, { maxLength: 80 }).toUpperCase();
  return location ? `${label} • ${location}` : label;
}

const MONTH_NAMES = Object.freeze([
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]);

/** Formats ISO YYYY-MM-DD dates consistently (e.g. "July 8, 2026"); leaves legacy text as-is. */
export function formatEventDate(value) {
  const text = sanitizeText(value, { maxLength: 40 });
  if (!text) return '';
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return text;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return text;
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return text;
  }
  return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}

export function formatEventSubtitle(event) {
  const src = isPlainObject(event) ? event : {};
  const parts = [];
  const date = formatEventDate(src.date);
  if (date) parts.push(date);
  const regulation = sanitizeText(src.regulation, { maxLength: 20 });
  if (regulation && regulation.toLowerCase() !== 'other') {
    parts.push(/^regulation\b/i.test(regulation) ? regulation : `Regulation ${regulation}`);
  }
  const count = sanitizePlayerCount(src.playerCount);
  if (count > 0) parts.push(`${count} ${count === 1 ? 'Player' : 'Players'}`);
  return parts.join(' • ');
}

function bump(map, key) {
  if (typeof key !== 'string' || !key) return;
  map.set(key, (map.get(key) ?? 0) + 1);
}

/** Usage counts across all standings: { teams, pokemon, items, abilities, teraTypes }. */
export function computeTournamentSummary(tournament) {
  const pokemon = new Map();
  const items = new Map();
  const abilities = new Map();
  const teraTypes = new Map();
  const standings = isPlainObject(tournament) && Array.isArray(tournament.standings) ? tournament.standings : [];
  let teams = 0;
  let totalPokemon = 0;
  for (const entry of standings) {
    if (!isPlainObject(entry) || !Array.isArray(entry.pokemon)) continue;
    if (entry.pokemon.length > 0) teams += 1;
    for (const mon of entry.pokemon) {
      if (!isPlainObject(mon)) continue;
      totalPokemon += 1;
      bump(pokemon, mon.speciesSlug || normalizePokemonSlug(mon.name));
      bump(items, typeof mon.item === 'string' ? mon.item.trim() : '');
      bump(abilities, typeof mon.ability === 'string' ? mon.ability.trim() : '');
      bump(teraTypes, typeof mon.teraType === 'string' ? mon.teraType.trim() : '');
    }
  }
  return {
    teams,
    totalPokemon,
    pokemon: Object.fromEntries(pokemon),
    items: Object.fromEntries(items),
    abilities: Object.fromEntries(abilities),
    teraTypes: Object.fromEntries(teraTypes),
  };
}
