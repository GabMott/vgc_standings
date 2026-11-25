import { createEmptyTournament, createStandingEntry } from './schema.js';
import { parseShowdownTeam, normalizePokepasteUrl } from './pokepaste.js';
import { sanitizePlayerCount } from './validation.js';

const FALSY_CELLS = new Set(['', 'false', '0', 'no', 'n', 'off', 'f']);

/** RFC-4180 tokenizer: returns an array of rows (arrays of strings). Never throws. */
export function tokenizeCsv(text) {
  const rows = [];
  if (typeof text !== 'string') return rows;
  let src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  let row = [];
  let field = '';
  let inQuotes = false;
  let fieldStarted = false;
  let i = 0;
  const pushField = () => {
    row.push(field);
    field = '';
    fieldStarted = false;
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };
  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
      i += 1;
    } else if (ch === ',') {
      pushField();
      i += 1;
    } else if (ch === '\r' || ch === '\n') {
      pushRow();
      i += ch === '\r' && src[i + 1] === '\n' ? 2 : 1;
    } else {
      field += ch;
      fieldStarted = true;
      i += 1;
    }
  }
  if (field !== '' || row.length > 0 || fieldStarted || inQuotes) pushRow();
  return rows;
}

function normalizeHeader(cell) {
  return String(cell ?? '').replace(/^\uFEFF/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isEmptyRow(row) {
  return row.every((c) => String(c).trim() === '');
}

function isTruthyCell(cell) {
  return !FALSY_CELLS.has(String(cell ?? '').trim().toLowerCase());
}

function columnIndex(headers, names, fallback) {
  for (const name of names) {
    const idx = headers.indexOf(name);
    if (idx !== -1) return idx;
  }
  return fallback;
}

/** Parses data.csv style files. Never throws; problems go to warnings. */
export function parseStandingsCsv(csvText) {
  const warnings = [];
  const rows = tokenizeCsv(csvText);
  if (typeof csvText !== 'string') warnings.push('CSV input is not a string.');
  if (rows.length === 0 || rows.every(isEmptyRow)) {
    if (typeof csvText === 'string') warnings.push('CSV is empty.');
    return { tournament: createEmptyTournament(), warnings };
  }

  // Locate the standings header ("placing" in first column) after the event rows.
  let headerIdx = rows.findIndex((r, i) => i > 0 && normalizeHeader(r[0]) === 'placing');
  const metaHeaders = rows[0].map(normalizeHeader);
  const startsWithStandings = normalizeHeader(rows[0][0]) === 'placing';
  let event = {};
  if (startsWithStandings) {
    warnings.push('Event info row missing; using defaults.');
    headerIdx = 0;
  } else {
    const metaRow = rows[1] && headerIdx !== 1 ? rows[1] : [];
    if (headerIdx === 1 || !rows[1]) warnings.push('Event info row missing; using defaults.');
    const get = (names) => {
      const idx = columnIndex(metaHeaders, names, -1);
      return idx === -1 ? '' : String(metaRow[idx] ?? '').trim();
    };
    const challenge = isTruthyCell(get(['challenge']));
    const cup = isTruthyCell(get(['cup']));
    event = {
      eventType: challenge && !cup ? 'challenge' : cup && !challenge ? 'cup' : 'other',
      location: get(['location']),
      date: get(['date']),
      regulation: get(['regulation', 'reg']),
      playerCount: sanitizePlayerCount(get(['playercount', 'players', 'playercounts'])),
    };
  }

  let dataStart;
  let headers;
  if (headerIdx === -1) {
    warnings.push('Standings header row ("placing,name,...") not found; assuming default columns.');
    headers = ['placing', 'name', 'handle', 'local', 'paste'];
    dataStart = rows[2] && isEmptyRow(rows[2]) ? 3 : 2;
  } else {
    headers = rows[headerIdx].map(normalizeHeader);
    dataStart = headerIdx + 1;
  }
  const col = {
    placing: columnIndex(headers, ['placing', 'place', 'rank'], 0),
    name: columnIndex(headers, ['name', 'player'], 1),
    handle: columnIndex(headers, ['handle'], 2),
    local: columnIndex(headers, ['local'], 3),
    paste: columnIndex(headers, ['paste', 'pokepaste', 'team', 'teamsource'], 4),
  };

  const standings = [];
  for (let r = dataStart; r < rows.length; r += 1) {
    const row = rows[r];
    if (isEmptyRow(row)) continue;
    const cell = (idx) => String(row[idx] ?? '');
    if (row.length <= col.paste) warnings.push(`Row ${r + 1} is short/truncated; missing fields left blank.`);
    if (cell(col.placing).trim() === '' && cell(col.name).trim() === '') {
      warnings.push(`Row ${r + 1} has no placing or name; skipped.`);
      continue;
    }
    const paste = cell(col.paste).trim();
    const entryWarnings = [];
    let teamSource = paste;
    let pokemon = [];
    if (paste) {
      const url = normalizePokepasteUrl(paste);
      if (url) teamSource = url;
      else if (/\n/.test(paste) || /@|Ability:/i.test(paste)) {
        const parsed = parseShowdownTeam(paste);
        pokemon = parsed.pokemon;
        entryWarnings.push(...parsed.warnings);
      } else {
        entryWarnings.push('Team link is not a valid pokepast.es URL.');
      }
    } else {
      entryWarnings.push('No team provided.');
    }
    standings.push(
      createStandingEntry({
        placing: cell(col.placing),
        name: cell(col.name),
        handle: cell(col.handle),
        local: cell(col.local),
        teamSource,
        pokemon,
        warnings: entryWarnings,
      }),
    );
  }
  if (standings.length === 0) warnings.push('No standings rows found.');
  if (!event.playerCount && standings.length > 0) event.playerCount = standings.length;
  const tournament = createEmptyTournament({ event, standings });
  return { tournament, warnings };
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]|^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportStandingsCsv(tournament) {
  const event = tournament && typeof tournament === 'object' && tournament.event ? tournament.event : {};
  const standings = tournament && Array.isArray(tournament.standings) ? tournament.standings : [];
  const lines = [];
  lines.push(['location', 'date', 'challenge', 'cup', 'regulation', 'player count'].join(','));
  lines.push(
    [
      event.location,
      event.date,
      event.eventType === 'challenge' ? 'x' : '',
      event.eventType === 'cup' ? 'x' : '',
      event.regulation,
      event.playerCount ? String(event.playerCount) : '',
    ]
      .map(csvCell)
      .join(','),
  );
  lines.push(',,,,,');
  lines.push('placing,name,handle,local,paste,');
  for (const entry of standings) {
    if (!entry || typeof entry !== 'object') continue;
    lines.push([entry.placing, entry.name, entry.handle, entry.local, entry.teamSource, ''].map(csvCell).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}
