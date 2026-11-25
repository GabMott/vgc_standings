import { splitNameLine, normalizePokemonSlug } from './pokemon-names.js';

export const MAX_TEAM_SIZE = 6;
export const MAX_PASTE_LENGTH = 100000;

const POKEPASTE_ID_RE = /^[A-Za-z0-9]{1,64}$/;

/** Canonical "https://pokepast.es/<id>" or null when the input is not a valid PokéPaste link. */
export function normalizePokepasteUrl(input) {
  if (typeof input !== 'string') return null;
  let text = input.trim();
  if (!text || /\s/.test(text)) return null;
  const scheme = text.match(/^([a-z][a-z0-9+.-]*):/i);
  if (scheme && !/^\/\//.test(text.slice(scheme[0].length))) {
    // "javascript:alert(1)" style, or host:port without scheme — only http(s) with // is allowed.
    return null;
  }
  if (scheme) {
    if (!/^https?$/i.test(scheme[1])) return null;
  } else if (text.startsWith('//')) {
    text = `https:${text}`;
  } else {
    text = `https://${text}`;
  }
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.hostname.toLowerCase() !== 'pokepast.es') return null;
  if (url.username || url.password || url.port) return null;
  const segments = url.pathname.split('/').filter((s, i, arr) => !(s === '' && (i === 0 || i === arr.length - 1)));
  if (segments.length === 2 && segments[1].toLowerCase() === 'raw') segments.pop();
  if (segments.length !== 1 || !POKEPASTE_ID_RE.test(segments[0])) return null;
  return `https://pokepast.es/${segments[0]}`;
}

export function isPokepasteUrl(input) {
  return normalizePokepasteUrl(input) !== null;
}

export function toPokepasteRawUrl(input) {
  const base = normalizePokepasteUrl(input);
  return base ? `${base}/raw` : null;
}

const STAT_KEYS = { hp: 'hp', atk: 'atk', def: 'def', spa: 'spa', spd: 'spd', spe: 'spe' };

function emptyStats(fill) {
  return { hp: fill, atk: fill, def: fill, spa: fill, spd: fill, spe: fill };
}

function parseStats(text, base, max) {
  const stats = { ...base };
  for (const match of text.matchAll(/(\d+)\s*(HP|Atk|Def|SpA|SpD|Spe)\b/gi)) {
    const value = Math.min(max, Number.parseInt(match[1], 10));
    stats[STAT_KEYS[match[2].toLowerCase()]] = value;
  }
  return stats;
}

const STAT_LINE_RE = /^(ability|level|evs|ivs|tera type|shiny|happiness|-|–|—|[A-Za-z]+ nature)/i;

function parseBlock(block, blockIndex, warnings) {
  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const first = lines[0];
  if (/^===.*===$/.test(first)) return null; // Showdown folder/team header
  if (STAT_LINE_RE.test(first) && !first.includes('@')) {
    warnings.push(`Block ${blockIndex}: missing Pokémon name line.`);
    return null;
  }
  const at = first.indexOf('@');
  const item = at === -1 ? '' : first.slice(at + 1).trim();
  const { species, nickname, gender } = splitNameLine(first);
  if (!species || !/^[\p{L}\p{N}][\p{L}\p{N} .'’:%\-♀♂]*$/u.test(species) || species.length > 60) {
    warnings.push(`Block ${blockIndex}: could not read Pokémon name "${first.slice(0, 40)}".`);
    return null;
  }
  const mon = {
    name: species,
    speciesSlug: normalizePokemonSlug(species),
    nickname,
    gender,
    item: item === 'None' ? '' : item.slice(0, 60),
    ability: '',
    teraType: '',
    nature: '',
    evs: emptyStats(0),
    ivs: emptyStats(31),
    moves: [],
    shiny: false,
    level: 100,
    spriteUrl: '',
  };
  for (const line of lines.slice(1)) {
    let m;
    if ((m = line.match(/^Ability:\s*(.*)$/i))) mon.ability = m[1].trim().slice(0, 60);
    else if ((m = line.match(/^Tera Type:\s*(.*)$/i))) mon.teraType = m[1].trim().slice(0, 30);
    else if ((m = line.match(/^Shiny:\s*(.*)$/i))) mon.shiny = /^(yes|true|1)$/i.test(m[1].trim());
    else if ((m = line.match(/^Level:\s*(.*)$/i))) {
      const level = Number.parseInt(m[1], 10);
      if (Number.isInteger(level) && level >= 1 && level <= 100) mon.level = level;
      else warnings.push(`${species}: invalid level "${m[1].trim().slice(0, 10)}".`);
    } else if ((m = line.match(/^EVs:\s*(.*)$/i))) mon.evs = parseStats(m[1], mon.evs, 252);
    else if ((m = line.match(/^IVs:\s*(.*)$/i))) mon.ivs = parseStats(m[1], mon.ivs, 31);
    else if ((m = line.match(/^([A-Za-z]+)\s+Nature\b/i))) mon.nature = m[1];
    else if ((m = line.match(/^[-–—]\s*(.+)$/))) {
      const move = m[1].trim().slice(0, 60);
      if (move) {
        if (mon.moves.length < 4) mon.moves.push(move);
        else if (mon.moves.length === 4) {
          warnings.push(`${species}: more than 4 moves; extras ignored.`);
          mon.moves.length = 4;
          mon.moves.push(null); // sentinel to warn once; removed below
        }
      }
    }
  }
  mon.moves = mon.moves.filter((x) => typeof x === 'string');
  return mon;
}

/** Parses Showdown/PokéPaste team text. Never throws. */
export function parseShowdownTeam(rawText) {
  const warnings = [];
  if (typeof rawText !== 'string') {
    return { pokemon: [], warnings: ['Team text is not a string.'] };
  }
  let text = rawText.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (text.length > MAX_PASTE_LENGTH) {
    warnings.push('Team text is very large; truncated.');
    text = text.slice(0, MAX_PASTE_LENGTH);
  }
  if (!text) return { pokemon: [], warnings: ['Team text is empty.'] };
  const blocks = text.split(/\n[ \t]*\n/);
  const pokemon = [];
  blocks.forEach((block, i) => {
    if (!block.trim()) return;
    const mon = parseBlock(block, i + 1, warnings);
    if (mon) pokemon.push(mon);
  });
  if (pokemon.length === 0) warnings.push('No Pokémon found in team text.');
  if (pokemon.length > MAX_TEAM_SIZE) {
    warnings.push(`Found ${pokemon.length} Pokémon; only the first ${MAX_TEAM_SIZE} are kept.`);
    pokemon.length = MAX_TEAM_SIZE;
  }
  return { pokemon, warnings };
}
