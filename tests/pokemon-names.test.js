import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  splitNameLine, stripNicknameAndGender, normalizePokemonSlug, lookupSpecialAdjustment,
  SPECIAL_POKEMON_URL_ADJUSTMENTS,
} from '../src/core/pokemon-names.js';

describe('splitNameLine', () => {
  test('plain species', () => {
    assert.deepEqual(splitNameLine('Pikachu'), { species: 'Pikachu', nickname: '', gender: '' });
  });
  test('nickname', () => {
    assert.deepEqual(splitNameLine('Sparky (Pikachu)'), { species: 'Pikachu', nickname: 'Sparky', gender: '' });
  });
  test('gender', () => {
    assert.deepEqual(splitNameLine('Pikachu (M)'), { species: 'Pikachu', nickname: '', gender: 'M' });
    assert.deepEqual(splitNameLine('Pikachu (f)'), { species: 'Pikachu', nickname: '', gender: 'F' });
  });
  test('nickname + gender + item', () => {
    assert.deepEqual(splitNameLine('Sparky (Pikachu) (F) @ Light Ball'), { species: 'Pikachu', nickname: 'Sparky', gender: 'F' });
  });
  test('item only', () => {
    assert.equal(splitNameLine('Incineroar @ Sitrus Berry').species, 'Incineroar');
    assert.equal(splitNameLine('@ Item').species, '');
  });
  test('nested / weird parens', () => {
    assert.equal(splitNameLine('Nick (A) (Pikachu)').species, 'Pikachu');
    assert.equal(splitNameLine('Nick (A) (Pikachu)').nickname, 'Nick (A)');
    assert.equal(splitNameLine('Pikachu ()').species, 'Pikachu ()');
    assert.equal(splitNameLine('Pika (Pikachu').species, 'Pika (Pikachu');
    assert.equal(splitNameLine('((Pikachu))').species, '((Pikachu))');
    assert.doesNotThrow(() => splitNameLine('((((((('));
  });
  test('non-strings', () => {
    for (const v of [null, undefined, 5, {}, [], true]) {
      assert.deepEqual(splitNameLine(v), { species: '', nickname: '', gender: '' });
    }
  });
  test('NFD normalized to NFC', () => {
    assert.equal(splitNameLine('Flabe\u0301be\u0301').species, 'Flab\u00e9b\u00e9');
  });
  test('whitespace', () => {
    assert.equal(splitNameLine('   Pikachu   ').species, 'Pikachu');
    assert.equal(splitNameLine('').species, '');
  });
});

describe('stripNicknameAndGender', () => {
  test('cases', () => {
    assert.equal(stripNicknameAndGender('Pika (Pikachu) (M) @ Light Ball'), 'Pikachu');
    assert.equal(stripNicknameAndGender('Meowstic-F (F)'), 'Meowstic-F');
    assert.equal(stripNicknameAndGender(null), '');
    assert.equal(stripNicknameAndGender('Urshifu-Rapid-Strike'), 'Urshifu-Rapid-Strike');
  });
});

describe('normalizePokemonSlug', () => {
  const cases = [
    ['Arceus-Poison', 'arceus'],
    ['Arceus-Normal', 'arceus'],
    ['Furfrou-Debutante', 'furfrou'],
    ['Silvally-Poison', 'silvally'],
    ['Slither Wing', 'slither-wing'],
    ['Silther Wing', 'slither-wing'],
    ['Flab\u00e9b\u00e9', 'flabebe'],
    ['Flabe\u0301be\u0301', 'flabebe'],
    ['Flabebe', 'flabebe'],
    ['Urshifu-Rapid-Strike', 'urshifu-rapid-strike'],
    ['Urshifu', 'urshifu-single-strike'],
    ['Calyrex-Ice', 'calyrex-ice-rider'],
    ['Calyrex-Shadow', 'calyrex-shadow-rider'],
    ['Type: Null', 'type-null'],
    ['Tapu Koko', 'tapu-koko'],
    ['Ho-Oh', 'ho-oh'],
    ['Porygon-Z', 'porygon-z'],
    ['Zygarde-10%', 'zygarde-10'],
    ['Zygarde-Complete', 'zygarde-complete'],
    ['Zygarde', 'zygarde-50'],
    ['Ogerpon-Wellspring', 'ogerpon-wellspring-mask'],
    ['Ogerpon-Hearthflame', 'ogerpon-hearthflame-mask'],
    ['Ogerpon-Cornerstone', 'ogerpon-cornerstone-mask'],
    ['Ogerpon', 'ogerpon'],
    ['Mr. Mime', 'mr-mime'],
    ['Pikachu', 'pikachu'],
    ['Incineroar', 'incineroar'],
    ['Iron Hands', 'iron-hands'],
  ];
  for (const [input, slug] of cases) {
    test(`${JSON.stringify(input)} -> ${slug}`, () => assert.equal(normalizePokemonSlug(input), slug));
  }

  test("Sirfetch'd apostrophe variants", () => {
    const expected = normalizePokemonSlug("Sirfetch'd");
    assert.equal(expected, 'sirfetchd');
    for (const apos of ['\u2019', '\u2018', '\u02BC', '`', '\u00B4']) {
      assert.equal(normalizePokemonSlug(`Sirfetch${apos}d`), expected);
    }
    assert.equal(normalizePokemonSlug('Sirfetchd'), expected);
    // mojibake of a right single quote (UTF-8 decoded as Latin-1) must at least not throw
    assert.doesNotThrow(() => normalizePokemonSlug('Sirfetch\u00e2\u0080\u0099d'));
    assert.equal(typeof normalizePokemonSlug('Sirfetch\u00e2\u0080\u0099d'), 'string');
  });
  test('Indeedee M/F', () => {
    assert.equal(normalizePokemonSlug('Indeedee-M'), normalizePokemonSlug('Indeedee-M'));
    assert.match(normalizePokemonSlug('Indeedee-M'), /^indeedee/);
    assert.match(normalizePokemonSlug('Indeedee-F'), /^indeedee/);
    assert.match(normalizePokemonSlug('Indeedee-F'), /female/);
    assert.match(normalizePokemonSlug('Indeedee-M'), /male/);
    assert.notEqual(normalizePokemonSlug('Indeedee-M'), normalizePokemonSlug('Indeedee-F'));
  });
  test('Indeedee with gender marker in name line', () => {
    assert.equal(normalizePokemonSlug('Indeedee-F (F)'), normalizePokemonSlug('Indeedee-F'));
  });
  test('case-insensitive', () => {
    assert.equal(normalizePokemonSlug('URSHIFU-RAPID-STRIKE'), 'urshifu-rapid-strike');
    assert.equal(normalizePokemonSlug('tapu koko'), 'tapu-koko');
    assert.equal(normalizePokemonSlug('HO-OH'), 'ho-oh');
  });
  test('whitespace insensitive', () => {
    assert.equal(normalizePokemonSlug('  Tapu    Koko '), 'tapu-koko');
  });
  test('nickname and gender stripped before slugging', () => {
    assert.equal(normalizePokemonSlug('Tiny (Urshifu-Rapid-Strike) (M) @ Mystic Water'), 'urshifu-rapid-strike');
  });
  test('default slugging for unknown names', () => {
    assert.equal(normalizePokemonSlug('Some Unknown Mon'), 'some-unknown-mon');
    assert.equal(normalizePokemonSlug('Foo.Bar:Baz'), 'foobarbaz');
    assert.equal(normalizePokemonSlug('Ab!!c'), 'abc');
  });
  test('empty / garbage inputs', () => {
    for (const v of ['', '   ', null, undefined, 5, {}, '@ Item', '()']) {
      assert.doesNotThrow(() => normalizePokemonSlug(v));
    }
    assert.equal(normalizePokemonSlug(''), '');
    assert.equal(normalizePokemonSlug(null), '');
    assert.equal(normalizePokemonSlug(undefined), '');
    assert.equal(normalizePokemonSlug(42), '');
    assert.equal(normalizePokemonSlug('@ Item'), '');
    assert.equal(normalizePokemonSlug('!!!'), '');
  });
});

describe('lookupSpecialAdjustment / table', () => {
  test('lookup', () => {
    assert.equal(lookupSpecialAdjustment('tapu koko'), 'tapu-koko');
    assert.equal(lookupSpecialAdjustment('Nonexistent'), undefined);
    assert.equal(lookupSpecialAdjustment(''), undefined);
    assert.equal(lookupSpecialAdjustment(null), undefined);
    assert.equal(lookupSpecialAdjustment(5), undefined);
  });
  test('table is frozen', () => {
    assert.ok(Object.isFrozen(SPECIAL_POKEMON_URL_ADJUSTMENTS));
  });
});
