import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeText, sanitizeHandle, sanitizePlacing, parsePlacingRank, normalizeHexColor,
  sanitizePlayerCount, sanitizeUrl, validateImageFileMeta, validateTournament,
  MAX_PLAYER_COUNT, MAX_IMAGE_BYTES, MAX_IMAGE_DIMENSION, ALLOWED_IMAGE_TYPES, EVENT_TYPES,
} from '../src/core/validation.js';

describe('constants', () => {
  test('values', () => {
    assert.equal(MAX_PLAYER_COUNT, 9999);
    assert.equal(MAX_IMAGE_BYTES, 10 * 1024 * 1024);
    assert.equal(MAX_IMAGE_DIMENSION, 8000);
    assert.ok(Object.isFrozen(ALLOWED_IMAGE_TYPES));
    assert.ok(Object.isFrozen(EVENT_TYPES));
    assert.deepEqual([...EVENT_TYPES], ['cup', 'challenge', 'other']);
  });
});

describe('sanitizeText', () => {
  test('non-string inputs fall back', () => {
    assert.equal(sanitizeText(null), '');
    assert.equal(sanitizeText(undefined), '');
    assert.equal(sanitizeText({}), '');
    assert.equal(sanitizeText([]), '');
    assert.equal(sanitizeText(true), '');
    assert.equal(sanitizeText(NaN), '');
    assert.equal(sanitizeText(Infinity), '');
    assert.equal(sanitizeText({}, { fallback: 'x' }), 'x');
  });
  test('numbers and bigint are stringified', () => {
    assert.equal(sanitizeText(42), '42');
    assert.equal(sanitizeText(-1.5), '-1.5');
    assert.equal(sanitizeText(10n), '10');
  });
  test('strips control characters', () => {
    assert.equal(sanitizeText('a\x00b\x01c\x1Fd\x7Fe\x85f'), 'abcdef');
    assert.equal(sanitizeText('line1\nline2\tx\r'), 'line1line2x');
  });
  test('strips bidi overrides and separators', () => {
    assert.equal(sanitizeText('a\u202Eb\u202Ac\u2066d\u2069e\u2028f\u2029g\uFEFFh'), 'abcdefgh');
  });
  test('NFD becomes NFC', () => {
    const out = sanitizeText('e\u0301');
    assert.equal(out, '\u00e9');
    assert.equal(out.length, 1);
  });
  test('trims whitespace', () => {
    assert.equal(sanitizeText('   hi  '), 'hi');
  });
  test('maxLength truncates by code point (no split surrogates)', () => {
    assert.equal(sanitizeText('abcdef', { maxLength: 3 }), 'abc');
    const out = sanitizeText('😀😀😀😀', { maxLength: 2 });
    assert.equal(out, '😀😀');
    assert.equal(Array.from(out).length, 2);
    assert.equal(sanitizeText('ab  cd', { maxLength: 3 }), 'ab');
  });
  test('default maxLength is 100', () => {
    assert.equal(sanitizeText('a'.repeat(150)).length, 100);
  });
  test('weird maxLength values', () => {
    assert.equal(sanitizeText('a'.repeat(150), { maxLength: Infinity }).length, 150);
    assert.equal(sanitizeText('a'.repeat(150), { maxLength: 0 }).length, 100);
    assert.equal(sanitizeText('a'.repeat(150), { maxLength: -5 }).length, 100);
    assert.equal(sanitizeText('a'.repeat(150), { maxLength: NaN }).length, 100);
    assert.equal(sanitizeText('abcdef', { maxLength: 2.9 }), 'ab');
  });
  test('empty after cleaning uses fallback', () => {
    assert.equal(sanitizeText('\x00\x01 '), '');
    assert.equal(sanitizeText('  ', { fallback: 'N/A' }), 'N/A');
    assert.equal(sanitizeText('', { fallback: 'N/A' }), 'N/A');
  });
  test('zero is preserved', () => {
    assert.equal(sanitizeText(0), '0');
  });
});

describe('sanitizeHandle', () => {
  test('adds / keeps single @', () => {
    assert.equal(sanitizeHandle('ash'), '@ash');
    assert.equal(sanitizeHandle('@ash'), '@ash');
    assert.equal(sanitizeHandle('@@@ash'), '@ash');
  });
  test('strips spaces and symbols', () => {
    assert.equal(sanitizeHandle('a s h!#$%'), '@ash');
    assert.equal(sanitizeHandle('he<script>llo'), '@hescriptllo');
  });
  test('keeps _ . -', () => {
    assert.equal(sanitizeHandle('a_b.c-d'), '@a_b.c-d');
  });
  test('Unicode handles preserved', () => {
    assert.equal(sanitizeHandle('@ポケモン'), '@ポケモン');
    assert.equal(sanitizeHandle('José'), '@José');
    assert.equal(sanitizeHandle('Jose\u0301'), '@Jos\u00e9');
  });
  test('empty / unusable', () => {
    assert.equal(sanitizeHandle(''), '');
    assert.equal(sanitizeHandle(null), '');
    assert.equal(sanitizeHandle(undefined), '');
    assert.equal(sanitizeHandle('@'), '');
    assert.equal(sanitizeHandle('!!! ???'), '');
    assert.equal(sanitizeHandle({}), '');
  });
  test('numbers accepted', () => {
    assert.equal(sanitizeHandle(123), '@123');
  });
  test('length capped to 30 chars', () => {
    assert.equal(sanitizeHandle('a'.repeat(100)), '@' + 'a'.repeat(30));
  });
});

describe('sanitizePlacing / parsePlacingRank', () => {
  test('sanitizePlacing', () => {
    assert.equal(sanitizePlacing(1), '1');
    assert.equal(sanitizePlacing(3.9), '3');
    assert.equal(sanitizePlacing(NaN), '');
    assert.equal(sanitizePlacing(Infinity), '');
    assert.equal(sanitizePlacing('1st'), '1st');
    assert.equal(sanitizePlacing(' T4 '), 'T4');
    assert.equal(sanitizePlacing('Top 8'), 'Top 8');
    assert.equal(sanitizePlacing(null), '');
    assert.equal(sanitizePlacing(undefined), '');
    assert.equal(sanitizePlacing('x'.repeat(30)).length, 12);
    assert.equal(sanitizePlacing(-1), '-1');
  });
  test('parsePlacingRank strings', () => {
    assert.equal(parsePlacingRank('1'), 1);
    assert.equal(parsePlacingRank('1st'), 1);
    assert.equal(parsePlacingRank('T4'), 4);
    assert.equal(parsePlacingRank('Top 8'), 8);
    assert.equal(parsePlacingRank('T-3'), 3);
    assert.equal(parsePlacingRank('0'), null);
    assert.equal(parsePlacingRank('-1'), 1); // minus sign ignored, digits parsed
    assert.equal(parsePlacingRank(''), null);
    assert.equal(parsePlacingRank('abc'), null);
    assert.equal(parsePlacingRank('99999999999999999999'), null);
  });
  test('parsePlacingRank numbers / others', () => {
    assert.equal(parsePlacingRank(5), 5);
    assert.equal(parsePlacingRank(-1), null);
    assert.equal(parsePlacingRank(0), null);
    assert.equal(parsePlacingRank(NaN), null);
    assert.equal(parsePlacingRank(1.5), null);
    assert.equal(parsePlacingRank(Infinity), null);
    assert.equal(parsePlacingRank(null), null);
    assert.equal(parsePlacingRank(undefined), null);
    assert.equal(parsePlacingRank({}), null);
  });
});

describe('normalizeHexColor', () => {
  test('valid forms', () => {
    assert.equal(normalizeHexColor('#abc'), '#AABBCC');
    assert.equal(normalizeHexColor('#a1b2c3'), '#A1B2C3');
    assert.equal(normalizeHexColor('#a1b2c3ff'), '#A1B2C3');
    assert.equal(normalizeHexColor('a1b2c3'), '#A1B2C3');
    assert.equal(normalizeHexColor('  #FFF  '), '#FFFFFF');
    assert.equal(normalizeHexColor('fff'), '#FFFFFF');
  });
  test('invalid -> fallback', () => {
    assert.equal(normalizeHexColor('red'), '#000000');
    assert.equal(normalizeHexColor('#ggg'), '#000000');
    assert.equal(normalizeHexColor('#12345'), '#000000');
    assert.equal(normalizeHexColor('#1234'), '#000000');
    assert.equal(normalizeHexColor(''), '#000000');
    assert.equal(normalizeHexColor(null), '#000000');
    assert.equal(normalizeHexColor(123456), '#000000');
    assert.equal(normalizeHexColor('red', '#abc'), '#AABBCC');
    assert.equal(normalizeHexColor('red', 'nope'), '#000000');
    assert.equal(normalizeHexColor('##fff'), '#000000');
  });
});

describe('sanitizePlayerCount', () => {
  test('valid', () => {
    assert.equal(sanitizePlayerCount(8), 8);
    assert.equal(sanitizePlayerCount('16'), 16);
    assert.equal(sanitizePlayerCount(' 16 '), 16);
    assert.equal(sanitizePlayerCount('16.9'), 16);
    assert.equal(sanitizePlayerCount(7.9), 7);
    assert.equal(sanitizePlayerCount(0), 0);
  });
  test('clamps', () => {
    assert.equal(sanitizePlayerCount(1e9), 9999);
    assert.equal(sanitizePlayerCount('123456'), 9999);
    assert.equal(sanitizePlayerCount(-5), 0);
  });
  test('invalid', () => {
    for (const v of ['abc', '', '-3', '1e3', NaN, Infinity, null, undefined, {}, [], '12abc']) {
      assert.equal(sanitizePlayerCount(v), 0, String(v));
    }
  });
});

describe('sanitizeUrl', () => {
  test('http / https', () => {
    assert.equal(sanitizeUrl('https://example.com/a'), 'https://example.com/a');
    assert.equal(sanitizeUrl('http://example.com'), 'http://example.com/');
    assert.equal(sanitizeUrl('  https://example.com  '), 'https://example.com/');
  });
  test('dangerous schemes rejected', () => {
    assert.equal(sanitizeUrl('javascript:alert(1)'), '');
    assert.equal(sanitizeUrl('JaVaScRiPt:alert(1)'), '');
    assert.equal(sanitizeUrl('ftp://example.com'), '');
    assert.equal(sanitizeUrl('file:///etc/passwd'), '');
    assert.equal(sanitizeUrl('vbscript:x'), '');
  });
  test('data URLs only with allowData', () => {
    const d = 'data:image/png;base64,iVBORw0KGgo=';
    assert.equal(sanitizeUrl(d), '');
    assert.equal(sanitizeUrl(d, { allowData: true }), d);
    assert.equal(sanitizeUrl('data:image/svg+xml;base64,AAAA', { allowData: true }), '');
    assert.equal(sanitizeUrl('data:text/html;base64,AAAA', { allowData: true }), '');
    assert.equal(sanitizeUrl('data:image/png;base64,AA AA', { allowData: true }), '');
  });
  test('relative paths only with allowRelative', () => {
    assert.equal(sanitizeUrl('./img/a.png'), '');
    assert.equal(sanitizeUrl('./img/a.png', { allowRelative: true }), './img/a.png');
    assert.equal(sanitizeUrl('../img/a.png', { allowRelative: true }), '../img/a.png');
    assert.equal(sanitizeUrl('/abs/a.png', { allowRelative: true }), '');
    assert.equal(sanitizeUrl('./a:b', { allowRelative: true }), '');
  });
  test('length / control chars / types', () => {
    assert.equal(sanitizeUrl('https://example.com/' + 'a'.repeat(2100)), '');
    assert.equal(sanitizeUrl('https://exa\x00mple.com'), '');
    assert.equal(sanitizeUrl('https://exa\nmple.com'), '');
    assert.equal(sanitizeUrl(''), '');
    assert.equal(sanitizeUrl('   '), '');
    assert.equal(sanitizeUrl(null), '');
    assert.equal(sanitizeUrl(42), '');
    assert.equal(sanitizeUrl('not a url'), '');
  });
  test('control-char regex state does not leak between calls', () => {
    for (let i = 0; i < 5; i += 1) {
      assert.equal(sanitizeUrl('https://example.com/ok'), 'https://example.com/ok');
      assert.equal(sanitizeUrl('https://a\x01b.com'), '');
    }
  });
});

describe('validateImageFileMeta', () => {
  const ok = { type: 'image/png', size: 1000, width: 100, height: 100 };
  test('valid', () => {
    assert.deepEqual(validateImageFileMeta(ok), { valid: true, errors: [] });
    assert.equal(validateImageFileMeta({ type: 'IMAGE/JPEG', size: 5 }).valid, true);
    assert.equal(validateImageFileMeta({ ...ok, size: MAX_IMAGE_BYTES }).valid, true);
    assert.equal(validateImageFileMeta({ ...ok, width: 8000, height: 8000 }).valid, true);
  });
  test('missing meta', () => {
    for (const m of [null, undefined, 'x', 5]) {
      const r = validateImageFileMeta(m);
      assert.equal(r.valid, false);
      assert.equal(r.errors.length, 1);
    }
  });
  test('invalid MIME', () => {
    for (const type of ['image/svg+xml', 'text/html', 'application/pdf', '', undefined, 5]) {
      const r = validateImageFileMeta({ ...ok, type });
      assert.equal(r.valid, false, String(type));
      assert.match(r.errors[0], /Unsupported image type/);
    }
  });
  test('size problems', () => {
    assert.match(validateImageFileMeta({ ...ok, size: 0 }).errors[0], /empty/);
    assert.match(validateImageFileMeta({ ...ok, size: -1 }).errors[0], /empty/);
    assert.match(validateImageFileMeta({ ...ok, size: NaN }).errors[0], /empty/);
    assert.match(validateImageFileMeta({ ...ok, size: '5' }).errors[0], /empty/);
    assert.match(validateImageFileMeta({ ...ok, size: MAX_IMAGE_BYTES + 1 }).errors[0], /10 MB/);
  });
  test('dimension problems', () => {
    assert.match(validateImageFileMeta({ ...ok, width: 8001 }).errors[0], /width exceeds/);
    assert.match(validateImageFileMeta({ ...ok, height: 8001 }).errors[0], /height exceeds/);
    assert.match(validateImageFileMeta({ ...ok, width: 0 }).errors[0], /width is invalid/);
    assert.match(validateImageFileMeta({ ...ok, height: NaN }).errors[0], /height is invalid/);
    assert.equal(validateImageFileMeta({ ...ok, width: 9000, height: 9000 }).errors.length, 2);
  });
  test('multiple errors accumulate', () => {
    const r = validateImageFileMeta({ type: 'x/y', size: 0, width: 9000 });
    assert.equal(r.valid, false);
    assert.equal(r.errors.length, 3);
  });
});

describe('validateTournament', () => {
  const entry = (id, placing, extra = {}) => ({ id, name: 'N' + id, placing, pokemon: [{}], ...extra });
  const base = (over = {}) => ({
    schemaVersion: 1,
    id: 't1',
    event: { eventType: 'cup', playerCount: 8 },
    standings: [entry('a', '1'), entry('b', '2')],
    themeConfig: { themeId: 'x' },
    ...over,
  });

  test('valid tournament has no errors/warnings', () => {
    assert.deepEqual(validateTournament(base()), { valid: true, errors: [], warnings: [] });
  });
  test('non-object', () => {
    for (const v of [null, undefined, [], 'x', 5]) {
      const r = validateTournament(v);
      assert.equal(r.valid, false);
      assert.deepEqual(r.errors, ['Tournament must be an object.']);
    }
  });
  test('top-level errors', () => {
    const r = validateTournament({ schemaVersion: 2, id: '', event: null, standings: 'no' });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => /schemaVersion/.test(e)));
    assert.ok(r.errors.some((e) => /id is required/.test(e)));
    assert.ok(r.errors.some((e) => /event is required/.test(e)));
    assert.ok(r.errors.some((e) => /standings must be an array/.test(e)));
  });
  test('event errors and warnings', () => {
    let r = validateTournament(base({ event: { eventType: 'bogus', playerCount: -1 } }));
    assert.equal(r.valid, false);
    assert.equal(r.errors.length, 2);
    r = validateTournament(base({ event: { eventType: 'cup', playerCount: 1.5 } }));
    assert.equal(r.valid, false);
    r = validateTournament(base({ event: { eventType: 'other', customEventLabel: '  ', playerCount: 8 } }));
    assert.equal(r.valid, true);
    assert.ok(r.warnings.includes('Other event has no label.'));
    r = validateTournament(base({ event: { eventType: 'other', customEventLabel: 'Hi', playerCount: 8 } }));
    assert.deepEqual(r.warnings, []);
  });
  test('empty standings warning', () => {
    const r = validateTournament(base({ standings: [] }));
    assert.equal(r.valid, true);
    assert.deepEqual(r.warnings, ['Standings are empty.']);
  });
  test('duplicate ids are errors', () => {
    const r = validateTournament(base({ standings: [entry('a', '1'), entry('a', '2')] }));
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => /duplicated/.test(e)));
  });
  test('missing entry id', () => {
    const r = validateTournament(base({ standings: [entry('', '1')] }));
    assert.ok(r.errors.some((e) => /\.id is required/.test(e)));
  });
  test('duplicate placings are warnings only', () => {
    const r = validateTournament(base({ standings: [entry('a', '1'), entry('b', '1')] }));
    assert.equal(r.valid, true);
    assert.ok(r.warnings.some((w) => /Duplicate placing "1"/.test(w)));
  });
  test('unparseable placing / no name', () => {
    const r = validateTournament(base({ standings: [entry('a', 'zzz', { name: '' })] }));
    assert.equal(r.valid, true);
    assert.ok(r.warnings.some((w) => /no player name/.test(w)));
    assert.ok(r.warnings.some((w) => /unparseable placing/.test(w)));
  });
  test('pokemon array checks', () => {
    let r = validateTournament(base({ standings: [entry('a', '1', { pokemon: new Array(7).fill({}) })] }));
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => /more than 6/.test(e)));
    r = validateTournament(base({ standings: [entry('a', '1', { pokemon: [] })] }));
    assert.equal(r.valid, true);
    assert.ok(r.warnings.some((w) => /no Pokémon/.test(w)));
    r = validateTournament(base({ standings: [entry('a', '1', { pokemon: 'x' })] }));
    assert.ok(r.errors.some((e) => /pokemon must be an array/.test(e)));
    r = validateTournament(base({ standings: [entry('a', '1', { pokemon: new Array(6).fill({}) })] }));
    assert.equal(r.valid, true);
  });
  test('entry warnings must be array', () => {
    const r = validateTournament(base({ standings: [entry('a', '1', { warnings: 'x' })] }));
    assert.ok(r.errors.some((e) => /warnings must be an array/.test(e)));
  });
  test('non-object entry', () => {
    const r = validateTournament(base({ standings: [null, 'x'] }));
    assert.equal(r.errors.filter((e) => /must be an object/.test(e)).length, 2);
  });
  test('>32 players warning', () => {
    const standings = Array.from({ length: 33 }, (_, i) => entry('id' + i, String(i + 1)));
    const r = validateTournament(base({ standings, event: { eventType: 'cup', playerCount: 100 } }));
    assert.equal(r.valid, true);
    assert.ok(r.warnings.some((w) => /More than 32/.test(w)));
    const r32 = validateTournament(base({ standings: standings.slice(0, 32), event: { eventType: 'cup', playerCount: 100 } }));
    assert.deepEqual(r32.warnings, []);
  });
  test('more standings than players', () => {
    const r = validateTournament(base({ event: { eventType: 'cup', playerCount: 1 } }));
    assert.ok(r.warnings.includes('More standings entries than players.'));
    const r0 = validateTournament(base({ event: { eventType: 'cup', playerCount: 0 } }));
    assert.deepEqual(r0.warnings, []);
  });
  test('themeConfig warnings', () => {
    let r = validateTournament(base({ themeConfig: null }));
    assert.ok(r.warnings.some((w) => /themeConfig missing/.test(w)));
    r = validateTournament(base({ themeConfig: {} }));
    assert.ok(r.warnings.some((w) => /themeId missing/.test(w)));
    assert.equal(r.valid, true);
  });
});
