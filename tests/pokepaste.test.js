import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePokepasteUrl, isPokepasteUrl, toPokepasteRawUrl, parseShowdownTeam,
  MAX_TEAM_SIZE, MAX_PASTE_LENGTH,
} from '../src/core/pokepaste.js';

describe('normalizePokepasteUrl', () => {
  const valid = [
    ['https://pokepast.es/abc123', 'https://pokepast.es/abc123'],
    ['http://pokepast.es/abc123', 'https://pokepast.es/abc123'],
    ['https://pokepast.es/abc123/', 'https://pokepast.es/abc123'],
    ['https://pokepast.es/abc123/raw', 'https://pokepast.es/abc123'],
    ['https://pokepast.es/abc123/raw/', 'https://pokepast.es/abc123'],
    ['https://pokepast.es/abc123/RAW', 'https://pokepast.es/abc123'],
    ['pokepast.es/abc123', 'https://pokepast.es/abc123'],
    ['//pokepast.es/abc123', 'https://pokepast.es/abc123'],
    ['  https://pokepast.es/abc123  ', 'https://pokepast.es/abc123'],
    ['https://pokepast.es/abc123?foo=bar', 'https://pokepast.es/abc123'],
    ['https://pokepast.es/abc123#frag', 'https://pokepast.es/abc123'],
    ['HTTPS://POKEPAST.ES/AbC123', 'https://pokepast.es/AbC123'],
    ['https://pokepast.es/33bbc4f4633968dc', 'https://pokepast.es/33bbc4f4633968dc'],
    ['https://pokepast.es/abc123/raw?x=1', 'https://pokepast.es/abc123'],
  ];
  for (const [input, out] of valid) {
    test(`valid ${JSON.stringify(input)}`, () => assert.equal(normalizePokepasteUrl(input), out));
  }
  const invalid = [
    'javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,hi', 'ftp://pokepast.es/abc',
    'http://user:pass@pokepast.es/abc', 'https://user@pokepast.es/abc',
    'https://pokepast.es:8080/abc', 'pokepast.es:8080/abc',
    'https://evil.com/abc', 'https://pokepast.es.evil.com/abc', 'https://evilpokepast.es/abc',
    'https://www.pokepast.es/abc', 'https://evil.com/pokepast.es/abc',
    'https://pokepast.es/', 'https://pokepast.es', 'https://pokepast.es/abc/def',
    'https://pokepast.es/abc/raw/extra', 'https://pokepast.es/abc/../x/y',
    'https://pokepast.es/a%2Fb', 'https://pokepast.es/ab-c', 'https://pokepast.es/' + 'a'.repeat(65),
    'https://pokepast.es/abc def', 'https://pokepast.es/abc\n', 'https:// pokepast.es/abc',
    '', '   ', 'not a url', 'https://', '///', 'mailto:a@b.c',
  ];
  for (const input of invalid) {
    test(`invalid ${JSON.stringify(input)}`, () => {
      // note: "https://pokepast.es/abc\n" is trimmed to a valid URL
      if (input === 'https://pokepast.es/abc\n') assert.equal(normalizePokepasteUrl(input), 'https://pokepast.es/abc');
      else assert.equal(normalizePokepasteUrl(input), null);
    });
  }
  test('non-string', () => {
    for (const v of [null, undefined, 5, {}, [], true]) assert.equal(normalizePokepasteUrl(v), null);
  });
  test('max length id accepted', () => {
    const id = 'a'.repeat(64);
    assert.equal(normalizePokepasteUrl(`https://pokepast.es/${id}`), `https://pokepast.es/${id}`);
  });
});

describe('isPokepasteUrl / toPokepasteRawUrl', () => {
  test('isPokepasteUrl', () => {
    assert.equal(isPokepasteUrl('pokepast.es/abc'), true);
    assert.equal(isPokepasteUrl('https://example.com/abc'), false);
    assert.equal(isPokepasteUrl(null), false);
  });
  test('toPokepasteRawUrl', () => {
    assert.equal(toPokepasteRawUrl('https://pokepast.es/abc'), 'https://pokepast.es/abc/raw');
    assert.equal(toPokepasteRawUrl('https://pokepast.es/abc/raw'), 'https://pokepast.es/abc/raw');
    assert.equal(toPokepasteRawUrl('https://pokepast.es/abc/RAW'), 'https://pokepast.es/abc/raw');
    assert.equal(toPokepasteRawUrl('pokepast.es/abc/'), 'https://pokepast.es/abc/raw');
    assert.equal(toPokepasteRawUrl('javascript:alert(1)'), null);
    assert.equal(toPokepasteRawUrl('https://evil.com/abc'), null);
    assert.equal(toPokepasteRawUrl(undefined), null);
  });
});

const MON_A = `Sparky (Pikachu) (F) @ Light Ball
Ability: Static
Level: 50
Shiny: Yes
Tera Type: Electric
EVs: 252 HP / 4 Def / 252 SpA
IVs: 0 Atk
Modest Nature
- Thunderbolt
- Volt Switch
- Protect
- Fake Out`;
const MON_B = `Incineroar @ Sitrus Berry
Ability: Intimidate
Tera Type: Grass
EVs: 252 HP / 252 Atk / 4 SpD
Adamant Nature
- Flare Blitz
- Knock Off
- Fake Out
- Parting Shot`;

describe('parseShowdownTeam', () => {
  test('full set parsing', () => {
    const { pokemon, warnings } = parseShowdownTeam(`${MON_A}\n\n${MON_B}`);
    assert.deepEqual(warnings, []);
    assert.equal(pokemon.length, 2);
    const [a, b] = pokemon;
    assert.equal(a.name, 'Pikachu');
    assert.equal(a.speciesSlug, 'pikachu');
    assert.equal(a.nickname, 'Sparky');
    assert.equal(a.gender, 'F');
    assert.equal(a.item, 'Light Ball');
    assert.equal(a.ability, 'Static');
    assert.equal(a.teraType, 'Electric');
    assert.equal(a.nature, 'Modest');
    assert.equal(a.level, 50);
    assert.equal(a.shiny, true);
    assert.deepEqual(a.evs, { hp: 252, atk: 0, def: 4, spa: 252, spd: 0, spe: 0 });
    assert.deepEqual(a.ivs, { hp: 31, atk: 0, def: 31, spa: 31, spd: 31, spe: 31 });
    assert.deepEqual(a.moves, ['Thunderbolt', 'Volt Switch', 'Protect', 'Fake Out']);
    assert.equal(b.name, 'Incineroar');
    assert.equal(b.nickname, '');
    assert.equal(b.gender, '');
    assert.equal(b.level, 100);
    assert.equal(b.shiny, false);
    assert.equal(b.nature, 'Adamant');
  });
  test('CRLF and LF produce identical output', () => {
    const lf = `${MON_A}\n\n${MON_B}`;
    const crlf = lf.replace(/\n/g, '\r\n');
    const cr = lf.replace(/\n/g, '\r');
    assert.deepEqual(parseShowdownTeam(crlf), parseShowdownTeam(lf));
    assert.deepEqual(parseShowdownTeam(cr), parseShowdownTeam(lf));
  });
  test('BOM is stripped', () => {
    assert.equal(parseShowdownTeam('\uFEFF' + MON_B).pokemon[0].name, 'Incineroar');
  });
  test('Showdown === header === is skipped', () => {
    const { pokemon, warnings } = parseShowdownTeam(`=== [gen9vgc2024regg] My Team ===\n\n${MON_A}\n\n${MON_B}`);
    assert.equal(pokemon.length, 2);
    assert.deepEqual(warnings, []);
  });
  test('whitespace-only separator lines', () => {
    assert.equal(parseShowdownTeam(`${MON_A}\n  \t \n${MON_B}`).pokemon.length, 2);
    assert.equal(parseShowdownTeam(`${MON_A}\n\n\n\n${MON_B}`).pokemon.length, 2);
  });
  test('Item None becomes empty; no item at all', () => {
    assert.equal(parseShowdownTeam('Ditto @ None').pokemon[0].item, '');
    assert.equal(parseShowdownTeam('Ditto').pokemon[0].item, '');
  });
  test('EV and IV clamping', () => {
    const { pokemon } = parseShowdownTeam('Pikachu\nEVs: 999 HP / 300 Spe\nIVs: 99 Atk');
    assert.equal(pokemon[0].evs.hp, 252);
    assert.equal(pokemon[0].evs.spe, 252);
    assert.equal(pokemon[0].ivs.atk, 31);
  });
  test('invalid level warns and defaults to 100', () => {
    for (const lvl of ['0', '101', 'abc']) {
      const { pokemon, warnings } = parseShowdownTeam(`Pikachu\nLevel: ${lvl}`);
      assert.equal(pokemon[0].level, 100);
      assert.ok(warnings.some((w) => /invalid level/.test(w)), lvl);
    }
  });
  test('Shiny variants', () => {
    assert.equal(parseShowdownTeam('Pikachu\nShiny: Yes').pokemon[0].shiny, true);
    assert.equal(parseShowdownTeam('Pikachu\nShiny: No').pokemon[0].shiny, false);
  });
  test('en/em dash move bullets', () => {
    const { pokemon } = parseShowdownTeam('Pikachu\n– Thunderbolt\n— Protect\n- Surf');
    assert.deepEqual(pokemon[0].moves, ['Thunderbolt', 'Protect', 'Surf']);
  });
  test('>4 moves warns once and keeps 4', () => {
    const { pokemon, warnings } = parseShowdownTeam('Pikachu\n- A\n- B\n- C\n- D\n- E\n- F\n- G');
    assert.deepEqual(pokemon[0].moves, ['A', 'B', 'C', 'D']);
    assert.equal(warnings.filter((w) => /more than 4 moves/.test(w)).length, 1);
  });
  test('exactly 4 moves has no warning', () => {
    const { warnings } = parseShowdownTeam('Pikachu\n- A\n- B\n- C\n- D');
    assert.deepEqual(warnings, []);
  });
  test('>6 pokemon truncated with warning', () => {
    const text = Array.from({ length: 8 }, () => MON_B).join('\n\n');
    const { pokemon, warnings } = parseShowdownTeam(text);
    assert.equal(pokemon.length, MAX_TEAM_SIZE);
    assert.ok(warnings.some((w) => /Found 8 Pokémon; only the first 6/.test(w)));
  });
  test('exactly 6 pokemon: no warning', () => {
    const text = Array.from({ length: 6 }, () => MON_B).join('\n\n');
    const { pokemon, warnings } = parseShowdownTeam(text);
    assert.equal(pokemon.length, 6);
    assert.deepEqual(warnings, []);
  });
  test('0 pokemon', () => {
    const r = parseShowdownTeam('Ability: Static\n- Thunderbolt');
    assert.deepEqual(r.pokemon, []);
    assert.ok(r.warnings.some((w) => /missing Pokémon name line/.test(w)));
    assert.ok(r.warnings.includes('No Pokémon found in team text.'));
  });
  test('empty and non-string', () => {
    assert.deepEqual(parseShowdownTeam(''), { pokemon: [], warnings: ['Team text is empty.'] });
    assert.deepEqual(parseShowdownTeam('   \n\n  '), { pokemon: [], warnings: ['Team text is empty.'] });
    for (const v of [null, undefined, 5, {}, []]) {
      assert.deepEqual(parseShowdownTeam(v), { pokemon: [], warnings: ['Team text is not a string.'] });
    }
  });
  test('garbage lines', () => {
    const r = parseShowdownTeam('<<<>>> ### $$$\n\n!!!!\n\n' + MON_B);
    assert.equal(r.pokemon.length, 1);
    assert.equal(r.warnings.filter((w) => /could not read/.test(w)).length, 2);
  });
  test('overlong name rejected', () => {
    const r = parseShowdownTeam('A'.repeat(70));
    assert.equal(r.pokemon.length, 0);
    assert.ok(r.warnings.some((w) => /could not read/.test(w)));
  });
  test('script injection in name is rejected', () => {
    const r = parseShowdownTeam('<script>alert(1)</script>');
    assert.equal(r.pokemon.length, 0);
  });
  test('>100KB paste truncated', () => {
    const big = Array.from({ length: 1500 }, () => MON_A).join('\n\n');
    assert.ok(big.length > MAX_PASTE_LENGTH);
    const r = parseShowdownTeam(big);
    assert.ok(r.warnings.includes('Team text is very large; truncated.'));
    assert.equal(r.pokemon.length, MAX_TEAM_SIZE);
  });
  test('long single-line junk over limit does not throw', () => {
    assert.doesNotThrow(() => parseShowdownTeam('x'.repeat(MAX_PASTE_LENGTH * 2)));
  });
  test('field length caps', () => {
    const r = parseShowdownTeam(`Pikachu @ ${'I'.repeat(200)}\nAbility: ${'A'.repeat(200)}\nTera Type: ${'T'.repeat(100)}\n- ${'M'.repeat(200)}`);
    assert.equal(r.pokemon[0].item.length, 60);
    assert.equal(r.pokemon[0].ability.length, 60);
    assert.equal(r.pokemon[0].teraType.length, 30);
    assert.equal(r.pokemon[0].moves[0].length, 60);
  });
  test('special species slugs', () => {
    const r = parseShowdownTeam('Urshifu-Rapid-Strike @ Mystic Water\nAbility: Unseen Fist\n\nTapu Koko\n\nHo-Oh');
    assert.deepEqual(r.pokemon.map((p) => p.speciesSlug), ['urshifu-rapid-strike', 'tapu-koko', 'ho-oh']);
  });
  test('default shape fields', () => {
    const [p] = parseShowdownTeam('Pikachu').pokemon;
    assert.deepEqual(p.evs, { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
    assert.deepEqual(p.ivs, { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 });
    assert.equal(p.spriteUrl, '');
    assert.deepEqual(p.moves, []);
  });
});
