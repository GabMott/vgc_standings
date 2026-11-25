import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHEMA_VERSION, DEFAULT_SIGNATURE, DEFAULT_THEME_ID, MAX_POKEMON_PER_TEAM, generateId,
  createPokemonSet, createStandingEntry, createEmptyTournament,
  serializeTournament, deserializeTournament, formatEventTitle, formatEventDate, formatEventSubtitle,
  computeTournamentSummary,
} from '../src/core/schema.js';
import { validateTournament } from '../src/core/validation.js';

describe('generateId', () => {
  test('unique non-empty strings', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId('x')));
    assert.equal(ids.size, 100);
    for (const id of ids) assert.ok(typeof id === 'string' && id.length > 0);
  });
  test('fallback without crypto.randomUUID', () => {
    const desc = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
    try {
      const a = generateId('pre');
      const b = generateId('pre');
      assert.match(a, /^pre-/);
      assert.notEqual(a, b);
    } finally {
      if (desc) Object.defineProperty(globalThis, 'crypto', desc);
      else delete globalThis.crypto;
    }
  });
});

describe('createPokemonSet', () => {
  test('defaults from empty / junk', () => {
    for (const v of [undefined, null, 5, 'x', []]) {
      const p = createPokemonSet(v);
      assert.equal(p.name, '');
      assert.equal(p.speciesSlug, '');
      assert.equal(p.level, 100);
      assert.equal(p.shiny, false);
      assert.deepEqual(p.moves, []);
      assert.deepEqual(p.evs, { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
      assert.deepEqual(p.ivs, { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 });
      assert.equal(p.spriteUrl, '');
    }
  });
  test('derives slug from name', () => {
    assert.equal(createPokemonSet({ name: 'Urshifu-Rapid-Strike' }).speciesSlug, 'urshifu-rapid-strike');
    assert.equal(createPokemonSet({ name: 'Pikachu', speciesSlug: 'custom' }).speciesSlug, 'custom');
  });
  test('sanitizes fields', () => {
    const p = createPokemonSet({
      name: 'Pika\x00chu', nickname: 'N'.repeat(100), gender: ' f ', item: 'Item\u202E', ability: 'A', teraType: 'Fire', nature: 'Jolly',
      level: '50', shiny: true,
    });
    assert.equal(p.name, 'Pikachu');
    assert.equal(p.nickname.length, 40);
    assert.equal(p.gender, 'F');
    assert.equal(p.item, 'Item');
    assert.equal(p.level, 50);
    assert.equal(p.shiny, true);
  });
  test('invalid gender / level / shiny', () => {
    assert.equal(createPokemonSet({ gender: 'X' }).gender, '');
    assert.equal(createPokemonSet({ gender: 5 }).gender, '');
    assert.equal(createPokemonSet({ level: 0 }).level, 100);
    assert.equal(createPokemonSet({ level: 101 }).level, 100);
    assert.equal(createPokemonSet({ level: 'abc' }).level, 100);
    assert.equal(createPokemonSet({ shiny: 'true' }).shiny, false);
    assert.equal(createPokemonSet({ shiny: 1 }).shiny, false);
  });
  test('moves capped to 4, blanks removed', () => {
    const p = createPokemonSet({ moves: ['A', '', '  ', 'B', 'C', 'D', 'E', null] });
    assert.deepEqual(p.moves, ['A', 'B', 'C', 'D']);
    assert.deepEqual(createPokemonSet({ moves: 'x' }).moves, []);
  });
  test('stats clamped', () => {
    const p = createPokemonSet({ evs: { hp: 999, atk: -5, def: '100', spa: 'abc', spd: null, spe: 12.7 }, ivs: { hp: 99, atk: -1 } });
    assert.deepEqual(p.evs, { hp: 252, atk: 0, def: 100, spa: 0, spd: 0, spe: 12 });
    assert.equal(p.ivs.hp, 31);
    assert.equal(p.ivs.atk, 0);
    assert.equal(p.ivs.def, 31);
  });
  test('spriteUrl sanitized', () => {
    assert.equal(createPokemonSet({ spriteUrl: 'javascript:alert(1)' }).spriteUrl, '');
    assert.equal(createPokemonSet({ spriteUrl: 'https://img.example/a.png' }).spriteUrl, 'https://img.example/a.png');
    const d = 'data:image/png;base64,AAAA';
    assert.equal(createPokemonSet({ spriteUrl: d }).spriteUrl, d);
  });
});

describe('createStandingEntry', () => {
  test('defaults', () => {
    const e = createStandingEntry();
    assert.ok(e.id);
    assert.equal(e.placing, '');
    assert.equal(e.name, '');
    assert.equal(e.handle, '');
    assert.deepEqual(e.pokemon, []);
    assert.deepEqual(e.warnings, []);
    assert.notEqual(createStandingEntry().id, e.id);
  });
  test('sanitization', () => {
    const e = createStandingEntry({ id: 'abc', placing: 1, name: ' Ash\x00 ', handle: 'pika fan', local: 'Loc', teamSource: 'a\r\nb\x00\u0001c ' });
    assert.equal(e.id, 'abc');
    assert.equal(e.placing, '1');
    assert.equal(e.name, 'Ash');
    assert.equal(e.handle, '@pikafan');
    assert.equal(e.teamSource, 'a\nbc');
    assert.equal(createStandingEntry({ teamSource: 5 }).teamSource, '');
    assert.equal(createStandingEntry({ teamSource: 'x'.repeat(30000) }).teamSource.length, 20000);
  });
  test('>6 pokemon keeps 6 and warns', () => {
    const e = createStandingEntry({ pokemon: Array.from({ length: 9 }, (_, i) => ({ name: 'Mon' + i })) });
    assert.equal(e.pokemon.length, MAX_POKEMON_PER_TEAM);
    assert.ok(e.warnings.some((w) => /Team had 9 Pokémon; only 6 kept/.test(w)));
  });
  test('exactly 6 pokemon: no warning', () => {
    const e = createStandingEntry({ pokemon: new Array(6).fill({ name: 'A' }) });
    assert.deepEqual(e.warnings, []);
  });
  test('warnings sanitized', () => {
    const e = createStandingEntry({ warnings: ['ok', '', null, 'x'.repeat(500), 5] });
    assert.equal(e.warnings.length, 3);
    assert.equal(e.warnings[1].length, 300);
    assert.equal(e.warnings[2], '5');
  });
  test('non-array pokemon / warnings', () => {
    const e = createStandingEntry({ pokemon: 'x', warnings: 'y' });
    assert.deepEqual(e.pokemon, []);
    assert.deepEqual(e.warnings, []);
  });
});

describe('createEmptyTournament', () => {
  test('defaults pass validation', () => {
    const t = createEmptyTournament();
    assert.equal(t.schemaVersion, SCHEMA_VERSION);
    assert.ok(t.id);
    assert.equal(t.event.eventType, 'cup');
    assert.equal(t.event.playerCount, 0);
    assert.deepEqual(t.standings, []);
    assert.equal(t.themeConfig.themeId, DEFAULT_THEME_ID);
    assert.deepEqual(t.themeConfig.overrides, {});
    assert.equal(t.signature, DEFAULT_SIGNATURE);
    assert.ok(!Number.isNaN(Date.parse(t.createdAt)));
    assert.ok(!Number.isNaN(Date.parse(t.updatedAt)));
    const v = validateTournament(t);
    assert.equal(v.valid, true);
  });
  test('overrides applied and sanitized', () => {
    const t = createEmptyTournament({
      id: 'my-id', event: { eventType: 'cup', location: 'X', playerCount: '12' },
      standings: [{ name: 'A' }], signature: 'Sig', createdAt: '2024-01-01T00:00:00Z',
    });
    assert.equal(t.id, 'my-id');
    assert.equal(t.event.eventType, 'cup');
    assert.equal(t.event.playerCount, 12);
    assert.equal(t.standings.length, 1);
    assert.equal(t.signature, 'Sig');
    assert.equal(t.createdAt, '2024-01-01T00:00:00.000Z');
  });
  test('invalid values fall back', () => {
    const t = createEmptyTournament({ event: { eventType: 'bogus' }, createdAt: 'garbage', signature: 5, standings: 'x' });
    assert.equal(t.event.eventType, 'cup');
    assert.ok(!Number.isNaN(Date.parse(t.createdAt)));
    assert.equal(t.signature, DEFAULT_SIGNATURE);
    assert.deepEqual(t.standings, []);
    assert.equal(createEmptyTournament(null).event.eventType, 'cup');
  });
  test('empty signature allowed', () => {
    assert.equal(createEmptyTournament({ signature: '' }).signature, '');
  });
});

describe('serialize / deserialize', () => {
  const sample = () => createEmptyTournament({
    id: 't1',
    event: { eventType: 'challenge', location: 'Wyndon', date: 'July 8th', regulation: 'M-8', playerCount: 8 },
    standings: [
      { id: 'e1', placing: '1', name: 'Ash', handle: '@ash', local: 'L', teamSource: 'https://pokepast.es/abc',
        pokemon: [{ name: 'Pikachu', item: 'Light Ball', moves: ['Thunderbolt'] }] },
      { id: 'e2', placing: '2', name: 'Misty' },
    ],
    themeConfig: { themeId: 'dark', overrides: { accent: '#ff0000', size: 12 } },
  });

  test('round trip', () => {
    const t = sample();
    const json = serializeTournament(t);
    assert.equal(typeof json, 'string');
    const back = deserializeTournament(json);
    assert.deepEqual(back, t);
    assert.equal(back.themeConfig.overrides.size, '12');
    assert.deepEqual(deserializeTournament(back), back);
    assert.equal(serializeTournament(back), json);
  });
  test('accepts object input', () => {
    const t = sample();
    assert.deepEqual(deserializeTournament(JSON.parse(serializeTournament(t))), t);
  });
  test('serialize of junk yields valid default tournament', () => {
    for (const v of [null, undefined, 5, 'x']) {
      assert.equal(JSON.parse(serializeTournament(v)).schemaVersion, SCHEMA_VERSION);
    }
  });
  test('corrupt JSON throws', () => {
    for (const bad of ['{not json', '', '{"a":', 'undefined']) {
      assert.throws(() => deserializeTournament(bad), /Invalid tournament JSON/);
    }
  });
  test('non-object payload throws', () => {
    for (const bad of ['[]', 'null', '5', '"s"', null, 5, []]) {
      assert.throws(() => deserializeTournament(bad), /must be an object/);
    }
  });
  test('wrong schemaVersion throws', () => {
    for (const v of [0, 2, '1', null, undefined]) {
      assert.throws(() => deserializeTournament(JSON.stringify({ schemaVersion: v })), /Unsupported tournament schemaVersion/);
    }
    assert.throws(() => deserializeTournament({}), /Unsupported/);
  });
  test('sanitizes hostile content on load', () => {
    const t = deserializeTournament({
      schemaVersion: 1,
      standings: [{ name: 'Evil\u202E\x00', handle: 'a b', pokemon: [{ name: 'X', spriteUrl: 'javascript:alert(1)' }] }],
    });
    assert.equal(t.standings[0].name, 'Evil');
    assert.equal(t.standings[0].handle, '@ab');
    assert.equal(t.standings[0].pokemon[0].spriteUrl, '');
  });
  test('prototype pollution resistance (overrides)', () => {
    const json = '{"schemaVersion":1,"themeConfig":{"themeId":"x","overrides":{"__proto__":"evil","constructor":"c","prototype":"p","polluted":"yes"}}}';
    const t = deserializeTournament(json);
    assert.equal(Object.getPrototypeOf(t.themeConfig.overrides), Object.prototype);
    assert.equal({}.polluted, undefined);
    assert.equal(t.themeConfig.overrides.polluted, 'yes');
    assert.ok(Object.prototype.hasOwnProperty.call(t.themeConfig.overrides, '__proto__'));
    assert.equal(Object.getOwnPropertyDescriptor(t.themeConfig.overrides, '__proto__').value, 'evil');
    // re-serialization must not poison anything either
    const again = deserializeTournament(serializeTournament(t));
    assert.equal(Object.getPrototypeOf(again.themeConfig.overrides), Object.prototype);
    assert.equal({}.evil, undefined);
  });
  test('prototype pollution via object-valued __proto__ is dropped', () => {
    const json = '{"schemaVersion":1,"__proto__":{"polluted":"yes"},"themeConfig":{"overrides":{"__proto__":{"polluted":"yes"}}},"event":{"__proto__":{"polluted":"yes"}}}';
    const t = deserializeTournament(json);
    assert.equal({}.polluted, undefined);
    assert.equal(t.polluted, undefined);
    assert.deepEqual(t.themeConfig.overrides, {});
  });
  test('overrides limited to 40 entries, non-scalar values dropped', () => {
    const overrides = {};
    for (let i = 0; i < 60; i += 1) overrides['k' + i] = 'v';
    overrides.obj = { a: 1 };
    const t = createEmptyTournament({ themeConfig: { overrides } });
    assert.equal(Object.keys(t.themeConfig.overrides).length, 40);
    const t2 = createEmptyTournament({ themeConfig: { overrides: { obj: {}, arr: [], nul: null, ok: 'v' } } });
    assert.deepEqual(t2.themeConfig.overrides, { ok: 'v' });
  });
  test('empty override key uses fallback key', () => {
    const t = createEmptyTournament({ themeConfig: { overrides: { '': 'v' } } });
    assert.deepEqual(Object.keys(t.themeConfig.overrides), ['_']);
  });
});

describe('formatEventTitle', () => {
  test('event types', () => {
    assert.equal(formatEventTitle({ eventType: 'challenge' }), 'LEAGUE CHALLENGE');
    assert.equal(formatEventTitle({ eventType: 'cup' }), 'LEAGUE CUP');
    assert.equal(formatEventTitle({ eventType: 'other' }), 'EVENT');
    assert.equal(formatEventTitle({ eventType: 'bogus' }), 'EVENT');
    assert.equal(formatEventTitle({}), 'EVENT');
  });
  test('other', () => {
    assert.equal(formatEventTitle({ eventType: 'other', customEventLabel: 'my cup' }), 'MY CUP');
    assert.equal(formatEventTitle({ eventType: 'other', customEventLabel: '' }), 'EVENT');
    assert.equal(formatEventTitle({ eventType: 'other' }), 'EVENT');
  });
  test('with location', () => {
    assert.equal(formatEventTitle({ eventType: 'cup', location: 'Wyndon Stadium' }), 'LEAGUE CUP • WYNDON STADIUM');
    assert.equal(formatEventTitle({ eventType: 'other', customEventLabel: 'x', location: 'y' }), 'X • Y');
    assert.equal(formatEventTitle({ eventType: 'cup', location: '   ' }), 'LEAGUE CUP');
  });
  test('junk input', () => {
    for (const v of [null, undefined, 5, 'x', []]) assert.equal(formatEventTitle(v), 'EVENT');
  });
});

describe('formatEventDate', () => {
  test('formats ISO YYYY-MM-DD dates consistently', () => {
    assert.equal(formatEventDate('2026-07-08'), 'July 8, 2026');
    assert.equal(formatEventDate('2026-01-01'), 'January 1, 2026');
    assert.equal(formatEventDate('2024-02-29'), 'February 29, 2024');
    assert.equal(formatEventDate('2026-12-31'), 'December 31, 2026');
  });
  test('preserves legacy free-text dates and invalid calendar dates as-is', () => {
    assert.equal(formatEventDate('July 8th'), 'July 8th');
    assert.equal(formatEventDate('2026-02-30'), '2026-02-30');
    assert.equal(formatEventDate('2026-13-01'), '2026-13-01');
    assert.equal(formatEventDate(''), '');
    assert.equal(formatEventDate(null), '');
  });
});

describe('formatEventSubtitle', () => {
  test('all parts', () => {
    assert.equal(formatEventSubtitle({ date: 'July 8th', regulation: 'M-8', playerCount: 8 }), 'July 8th • Regulation M-8 • 8 Players');
    assert.equal(formatEventSubtitle({ date: '2026-07-08', regulation: 'M-A', playerCount: 16 }), 'July 8, 2026 • Regulation M-A • 16 Players');
  });
  test('1 Player vs N Players', () => {
    assert.equal(formatEventSubtitle({ playerCount: 1 }), '1 Player');
    assert.equal(formatEventSubtitle({ playerCount: 2 }), '2 Players');
    assert.equal(formatEventSubtitle({ playerCount: 0 }), '');
    assert.equal(formatEventSubtitle({ playerCount: '5' }), '5 Players');
  });
  test('Regulation prefix dedup', () => {
    assert.equal(formatEventSubtitle({ regulation: 'Regulation G' }), 'Regulation G');
    assert.equal(formatEventSubtitle({ regulation: 'regulation g' }), 'regulation g');
    assert.equal(formatEventSubtitle({ regulation: 'G' }), 'Regulation G');
    assert.equal(formatEventSubtitle({ regulation: 'Regulations' }), 'Regulation Regulations');
  });
  test('partial / empty / junk', () => {
    assert.equal(formatEventSubtitle({ date: 'x' }), 'x');
    assert.equal(formatEventSubtitle({}), '');
    for (const v of [null, undefined, 5, []]) assert.equal(formatEventSubtitle(v), '');
  });
});

describe('computeTournamentSummary', () => {
  test('counts', () => {
    const t = createEmptyTournament({
      standings: [
        { name: 'A', pokemon: [
          { name: 'Incineroar', item: 'Sitrus Berry', ability: 'Intimidate', teraType: 'Grass' },
          { name: 'Pikachu', item: 'Light Ball', ability: 'Static', teraType: 'Electric' },
        ] },
        { name: 'B', pokemon: [
          { name: 'Incineroar', item: 'Sitrus Berry', ability: 'Intimidate', teraType: 'Fire' },
          { name: 'Urshifu-Rapid-Strike', item: '', ability: 'Unseen Fist', teraType: '' },
        ] },
        { name: 'C', pokemon: [] },
      ],
    });
    const s = computeTournamentSummary(t);
    assert.equal(s.teams, 2);
    assert.equal(s.totalPokemon, 4);
    assert.deepEqual(s.pokemon, { incineroar: 2, pikachu: 1, 'urshifu-rapid-strike': 1 });
    assert.deepEqual(s.items, { 'Sitrus Berry': 2, 'Light Ball': 1 });
    assert.deepEqual(s.abilities, { Intimidate: 2, Static: 1, 'Unseen Fist': 1 });
    assert.deepEqual(s.teraTypes, { Grass: 1, Electric: 1, Fire: 1 });
  });
  test('falls back to name when slug missing', () => {
    const s = computeTournamentSummary({ standings: [{ pokemon: [{ name: 'Tapu Koko' }, { speciesSlug: 'x' }] }] });
    assert.deepEqual(s.pokemon, { 'tapu-koko': 1, x: 1 });
  });
  test('junk input', () => {
    const empty = { teams: 0, totalPokemon: 0, pokemon: {}, items: {}, abilities: {}, teraTypes: {} };
    for (const v of [null, undefined, 5, {}, { standings: 'x' }, { standings: [] }]) {
      assert.deepEqual(computeTournamentSummary(v), empty);
    }
    const s = computeTournamentSummary({ standings: [null, 5, { pokemon: 'x' }, { pokemon: [null, 7, { name: 'A', item: 5 }] }] });
    assert.equal(s.teams, 1);
    assert.equal(s.totalPokemon, 1);
    assert.deepEqual(s.items, {});
  });
  test('item names are trimmed', () => {
    const s = computeTournamentSummary({ standings: [{ pokemon: [{ name: 'A', item: ' X ' }, { name: 'A', item: 'X' }] }] });
    assert.deepEqual(s.items, { X: 2 });
  });
});
