// Pure sanitization / validation helpers. No I/O, no globals besides built-ins.

const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F-\u009F]/g;
// Bidi overrides/isolates (text-spoofing vectors), line/paragraph separators, BOM / ZWNBSP.
const UNSAFE_FORMAT_RE = /[\u202A-\u202E\u2066-\u2069\u2028\u2029\uFEFF]/g;

export const MAX_PLAYER_COUNT = 9999;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 8000;
export const ALLOWED_IMAGE_TYPES = Object.freeze(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
export const EVENT_TYPES = Object.freeze(['challenge', 'cup', 'local', 'custom']);

function toStringSafe(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'bigint') return value.toString();
  return null;
}

/** Strips control chars, normalizes to NFC, trims and truncates by code point. */
export function sanitizeText(value, { maxLength = 100, fallback = '' } = {}) {
  const raw = toStringSafe(value);
  if (raw === null) return fallback;
  let text = raw.replace(CONTROL_CHARS_RE, '').replace(UNSAFE_FORMAT_RE, '');
  try {
    text = text.normalize('NFC');
  } catch {
    // normalize never throws for strings, but stay defensive.
  }
  text = text.trim();
  const limit = Number.isFinite(maxLength) && maxLength > 0 ? Math.floor(maxLength) : maxLength === Infinity ? Infinity : 100;
  if (limit !== Infinity) {
    const chars = Array.from(text);
    if (chars.length > limit) text = chars.slice(0, limit).join('').trim();
  }
  return text === '' ? fallback : text;
}

/** Returns '@handle' (letters, digits, _ . -) or '' when nothing usable remains. */
export function sanitizeHandle(value) {
  const text = sanitizeText(value, { maxLength: 60, fallback: '' });
  if (!text) return '';
  const cleaned = text
    .replace(/^@+/, '')
    .replace(/[^\p{L}\p{N}\p{M}_.\-]/gu, '')
    .slice(0, 30);
  return cleaned ? `@${cleaned}` : '';
}

/** Placing label such as "1", "1st", "T-3", "Top 8". */
export function sanitizePlacing(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(Math.trunc(value)) : '';
  }
  return sanitizeText(value, { maxLength: 12, fallback: '' });
}

/** Numeric rank from a placing label, or null. */
export function parsePlacingRank(placing) {
  if (typeof placing === 'number') {
    return Number.isSafeInteger(placing) && placing >= 1 ? placing : null;
  }
  if (typeof placing !== 'string') return null;
  const match = placing.match(/\d+/);
  if (!match) return null;
  const rank = Number.parseInt(match[0], 10);
  return Number.isSafeInteger(rank) && rank >= 1 ? rank : null;
}

/** Normalizes #rgb / #rrggbb / rrggbb / #rrggbbaa to uppercase #RRGGBB. */
export function normalizeHexColor(value, fallback = '#000000') {
  const parse = (input) => {
    if (typeof input !== 'string') return null;
    const match = input.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (!match) return null;
    let hex = match[1];
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    if (hex.length === 8) hex = hex.slice(0, 6);
    return `#${hex.toUpperCase()}`;
  };
  return parse(value) ?? parse(fallback) ?? '#000000';
}

/** Integer in [0, MAX_PLAYER_COUNT]; invalid input yields 0. */
export function sanitizePlayerCount(value) {
  let num;
  if (typeof value === 'number') num = value;
  else if (typeof value === 'string' && /^\s*\d+(\.\d+)?\s*$/.test(value)) num = Number(value);
  else return 0;
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.min(Math.floor(num), MAX_PLAYER_COUNT);
}

/** Allows http(s) URLs, small inline raster data URLs and (optionally) './' relative paths. */
export function sanitizeUrl(value, { allowRelative = false, allowData = false } = {}) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (!text || text.length > 2048 || CONTROL_CHARS_RE.test(text)) {
    CONTROL_CHARS_RE.lastIndex = 0;
    return '';
  }
  CONTROL_CHARS_RE.lastIndex = 0;
  if (allowData && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(text)) return text;
  if (allowRelative && /^\.\.?\//.test(text) && !text.includes(':')) return text;
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    return url.href;
  } catch {
    return '';
  }
}

export function validateImageFileMeta(meta) {
  const errors = [];
  if (meta === null || typeof meta !== 'object') {
    return { valid: false, errors: ['Missing image metadata.'] };
  }
  const { type, size, width, height } = meta;
  if (typeof type !== 'string' || !ALLOWED_IMAGE_TYPES.includes(type.toLowerCase())) {
    errors.push(`Unsupported image type "${sanitizeText(type, { maxLength: 40, fallback: 'unknown' })}". Use PNG, JPEG, WebP or GIF.`);
  }
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) {
    errors.push('Image file is empty or has an invalid size.');
  } else if (size > MAX_IMAGE_BYTES) {
    errors.push(`Image is larger than ${MAX_IMAGE_BYTES / (1024 * 1024)} MB.`);
  }
  for (const [label, dim] of [['width', width], ['height', height]]) {
    if (dim === undefined) continue;
    if (typeof dim !== 'number' || !Number.isFinite(dim) || dim <= 0) errors.push(`Image ${label} is invalid.`);
    else if (dim > MAX_IMAGE_DIMENSION) errors.push(`Image ${label} exceeds ${MAX_IMAGE_DIMENSION}px.`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateTournament(tournament) {
  const errors = [];
  const warnings = [];
  if (tournament === null || typeof tournament !== 'object' || Array.isArray(tournament)) {
    return { valid: false, errors: ['Tournament must be an object.'], warnings };
  }
  if (tournament.schemaVersion !== 1) errors.push(`Unsupported schemaVersion: ${String(tournament.schemaVersion)}.`);
  if (typeof tournament.id !== 'string' || !tournament.id) errors.push('Tournament id is required.');

  const event = tournament.event;
  if (event === null || typeof event !== 'object') {
    errors.push('Tournament event is required.');
  } else {
    if (!EVENT_TYPES.includes(event.eventType)) errors.push(`Invalid eventType: ${String(event.eventType)}.`);
    if (event.eventType === 'custom' && !sanitizeText(event.customEventLabel)) {
      warnings.push('Custom event has no label.');
    }
    if (!Number.isInteger(event.playerCount) || event.playerCount < 0) errors.push('event.playerCount must be a non-negative integer.');
  }

  const standings = tournament.standings;
  if (!Array.isArray(standings)) {
    errors.push('standings must be an array.');
  } else {
    if (standings.length === 0) warnings.push('Standings are empty.');
    if (standings.length > 32) warnings.push('More than 32 standings entries; the image will be very tall.');
    if (event && Number.isInteger(event.playerCount) && event.playerCount > 0 && standings.length > event.playerCount) {
      warnings.push('More standings entries than players.');
    }
    const ids = new Set();
    const placings = new Set();
    standings.forEach((entry, index) => {
      const label = `standings[${index}]`;
      if (entry === null || typeof entry !== 'object') {
        errors.push(`${label} must be an object.`);
        return;
      }
      if (typeof entry.id !== 'string' || !entry.id) errors.push(`${label}.id is required.`);
      else if (ids.has(entry.id)) errors.push(`${label}.id "${entry.id}" is duplicated.`);
      else ids.add(entry.id);
      if (!sanitizeText(entry.name)) warnings.push(`${label} has no player name.`);
      if (parsePlacingRank(entry.placing) === null) warnings.push(`${label} has an unparseable placing.`);
      else if (placings.has(entry.placing)) warnings.push(`Duplicate placing "${entry.placing}".`);
      else placings.add(entry.placing);
      if (!Array.isArray(entry.pokemon)) errors.push(`${label}.pokemon must be an array.`);
      else {
        if (entry.pokemon.length === 0) warnings.push(`${label} has no Pokémon.`);
        if (entry.pokemon.length > 6) errors.push(`${label} has more than 6 Pokémon.`);
      }
      if (entry.warnings !== undefined && !Array.isArray(entry.warnings)) errors.push(`${label}.warnings must be an array.`);
    });
  }

  const theme = tournament.themeConfig;
  if (theme === null || typeof theme !== 'object') {
    warnings.push('themeConfig missing; defaults will be used.');
  } else if (typeof theme.themeId !== 'string' || !theme.themeId) {
    warnings.push('themeConfig.themeId missing; default theme will be used.');
  }
  return { valid: errors.length === 0, errors, warnings };
}
