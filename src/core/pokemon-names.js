// Showdown / PokéPaste species names -> PokeAPI slugs. Ported from generate_standings.py with typos fixed.

const entries = {};

function addAll(names, slug) {
  for (const name of names) entries[name] = slug;
}

const TYPES_NO_NORMAL = ['Fighting', 'Flying', 'Poison', 'Ground', 'Rock', 'Bug', 'Ghost', 'Steel', 'Fire', 'Water', 'Grass', 'Electric', 'Psychic', 'Ice', 'Dragon', 'Dark', 'Fairy'];

// Pikachu cap / costume forms
for (const cap of ['Original', 'Partner', 'World', 'Hoenn', 'Sinnoh', 'Unova', 'Kalos', 'Alola']) {
  entries[`Pikachu-${cap}`] = `pikachu-${cap.toLowerCase()}-cap`;
}
for (const breed of ['Combat', 'Blaze', 'Aqua']) {
  entries[`Tauros-Paldea-${breed}`] = `tauros-paldea-${breed.toLowerCase()}-breed`;
}
entries['Mr. Mime'] = 'mr-mime';
entries['Mr. Mime-Galar'] = 'mr-mime-galar';
entries['Mr. Rime'] = 'mr-rime';
entries['Mime Jr.'] = 'mime-jr';
entries['Nidoran-F'] = 'nidoran-f';
entries['Nidoran-M'] = 'nidoran-m';
entries['Nidoran\u2640'] = 'nidoran-f';
entries['Nidoran\u2642'] = 'nidoran-m';

// Unown
for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') entries[`Unown-${letter}`] = 'unown';
addAll(['Unown-Exclamation', 'Unown-Question'], 'unown');

// Gen 4
entries['Deoxys'] = 'deoxys-normal';
entries['Wormadam'] = 'wormadam-plant';
entries['Cherrim-Sunshine'] = 'cherrim';
entries['Shellos-East'] = 'shellos';
entries['Gastrodon-East'] = 'gastrodon';
entries['Giratina'] = 'giratina-altered';
entries['Shaymin'] = 'shaymin-land';
entries['Arceus-Normal'] = 'arceus';
for (const type of TYPES_NO_NORMAL) {
  entries[`Arceus-${type}`] = 'arceus';
  entries[`Silvally-${type}`] = 'silvally';
}
entries['Silvally-Normal'] = 'silvally';

// Gen 5
entries['Darmanitan'] = 'darmanitan-standard';
entries['Darmanitan-Galar'] = 'darmanitan-galar-standard';
addAll(['Deerling-Winter', 'Deerling-Summer', 'Deerling-Autumn'], 'deerling');
addAll(['Sawsbuck-Winter', 'Sawsbuck-Summer', 'Sawsbuck-Autumn'], 'sawsbuck');
entries['Tornadus'] = 'tornadus-incarnate';
entries['Thundurus'] = 'thundurus-incarnate';
entries['Landorus'] = 'landorus-incarnate';
entries['Keldeo'] = 'keldeo-ordinary';
entries['Meloetta'] = 'meloetta-aria';
entries['Basculin'] = 'basculin-red-striped';
entries['Basculin-White-Striped'] = 'basculin-white-striped';
for (const drive of ['Douse', 'Shock', 'Burn', 'Chill']) entries[`Genesect-${drive}`] = 'genesect';

// Gen 6
for (const pattern of ['Icy-Snow', 'Polar', 'Tundra', 'Continental', 'Garden', 'Elegant', 'Modern', 'Marine', 'Archipelago', 'High Plains', 'Sandstorm', 'River', 'Monsoon', 'Savanna', 'Sun', 'Ocean', 'Jungle', 'Fancy', 'Pokeball']) {
  entries[`Vivillon-${pattern}`] = 'vivillon';
}
// Flabébé: both NFC (\u00e9) and NFD (e + \u0301) spellings, plus ASCII.
const FLABEBE_NFC = 'Flab\u00e9b\u00e9';
const FLABEBE_NFD = 'Flabe\u0301be\u0301';
for (const base of [FLABEBE_NFC, FLABEBE_NFD, 'Flabebe']) {
  entries[base] = 'flabebe';
  for (const color of ['Blue', 'Orange', 'White', 'Yellow', 'Red']) entries[`${base}-${color}`] = 'flabebe';
}
for (const color of ['Blue', 'Orange', 'White', 'Yellow', 'Red']) {
  entries[`Floette-${color}`] = 'floette';
  entries[`Florges-${color}`] = 'florges';
}
for (const trim of ['Heart', 'Star', 'Diamond', 'Debutante', 'Matron', 'Dandy', 'La Reine', 'Kabuki', 'Pharaoh']) {
  entries[`Furfrou-${trim}`] = 'furfrou';
}
entries['Meowstic'] = 'meowstic-male';
entries['Meowstic-M'] = 'meowstic-male';
entries['Meowstic-F'] = 'meowstic-female';
entries['Meowstic-M-Mega'] = 'meowstic-male-mega';
entries['Meowstic-F-Mega'] = 'meowstic-female-mega';
entries['Aegislash'] = 'aegislash-shield';
entries['Aegislash-Shield'] = 'aegislash-shield';
entries['Aegislash-Blade'] = 'aegislash-blade';
for (const size of ['Small', 'Large', 'Super']) {
  entries[`Pumpkaboo-${size}`] = `pumpkaboo-${size.toLowerCase()}`;
  entries[`Gourgeist-${size}`] = `gourgeist-${size.toLowerCase()}`;
}
entries['Pumpkaboo'] = 'pumpkaboo-average';
entries['Gourgeist'] = 'gourgeist-average';
entries['Xerneas-Neutral'] = 'xerneas';
entries['Zygarde'] = 'zygarde-50';
entries['Zygarde-50%'] = 'zygarde-50';
entries['Zygarde-10%'] = 'zygarde-10';
entries['Zygarde-Complete'] = 'zygarde-complete';
entries['Groudon-Primal'] = 'groudon-primal';
entries['Kyogre-Primal'] = 'kyogre-primal';

// Gen 7
entries['Oricorio'] = 'oricorio-baile';
entries["Oricorio-Pa'u"] = 'oricorio-pau';
entries['Oricorio-Pau'] = 'oricorio-pau';
entries['Lycanroc'] = 'lycanroc-midday';
entries['Wishiwashi'] = 'wishiwashi-solo';
entries['Wishiwashi-School'] = 'wishiwashi-school';
entries['Mimikyu'] = 'mimikyu-disguised';
entries['Mimikyu-Busted'] = 'mimikyu-busted';
entries['Minior'] = 'minior-red-meteor';
entries['Minior-Meteor'] = 'minior-red-meteor';
entries['Minior-Red'] = 'minior-red-meteor';
for (const color of ['Orange', 'Yellow', 'Green', 'Blue', 'Indigo', 'Violet']) {
  entries[`Minior-${color}`] = `minior-${color.toLowerCase()}-meteor`;
}
entries['Necrozma-Dawn-Wings'] = 'necrozma-dawn';
entries['Necrozma-Dusk-Mane'] = 'necrozma-dusk';
entries['Type: Null'] = 'type-null';
for (const tapu of ['Koko', 'Lele', 'Bulu', 'Fini']) entries[`Tapu ${tapu}`] = `tapu-${tapu.toLowerCase()}`;

// Gen 8
entries['Toxtricity'] = 'toxtricity-amped';
entries['Toxtricity-Low-Key'] = 'toxtricity-low-key';
entries['Sinistea-Antique'] = 'sinistea';
entries['Polteageist-Antique'] = 'polteageist';
for (const flavor of ['Vanilla', 'Ruby', 'Matcha', 'Mint', 'Lemon', 'Salted']) {
  entries[`Alcremie-${flavor}-Cream`] = 'alcremie';
  entries[`Alcremie-${flavor}`] = 'alcremie';
}
addAll(['Alcremie-Ruby-Swirl', 'Alcremie-Caramel-Swirl', 'Alcremie-Rainbow-Swirl'], 'alcremie');
entries['Eiscue'] = 'eiscue-ice';
entries['Eiscue-Noice'] = 'eiscue-noice';
entries['Indeedee'] = 'indeedee-male';
entries['Indeedee-M'] = 'indeedee-male';
entries['Indeedee-F'] = 'indeedee-female';
entries['Morpeko'] = 'morpeko-full-belly';
entries['Morpeko-Hangry'] = 'morpeko-hangry';
entries["Sirfetch'd"] = 'sirfetchd';
entries['Sirfetch\u2019d'] = 'sirfetchd';
entries['Sirfetch\u00e2\u0080\u0099d'] = 'sirfetchd'; // mojibake seen in legacy pastes
entries["Farfetch'd"] = 'farfetchd';
entries['Farfetch\u2019d'] = 'farfetchd';
entries["Farfetch'd-Galar"] = 'farfetchd-galar';
entries['Urshifu'] = 'urshifu-single-strike';
entries['Urshifu-Single-Strike'] = 'urshifu-single-strike';
entries['Urshifu-Rapid-Strike'] = 'urshifu-rapid-strike';
entries['Calyrex-Ice'] = 'calyrex-ice-rider';
entries['Calyrex-Shadow'] = 'calyrex-shadow-rider';
entries['Zacian'] = 'zacian';
entries['Zacian-Crowned'] = 'zacian-crowned';
entries['Zamazenta'] = 'zamazenta';
entries['Zamazenta-Crowned'] = 'zamazenta-crowned';
entries['Enamorus'] = 'enamorus-incarnate';
entries['Basculegion'] = 'basculegion-male';
entries['Basculegion-M'] = 'basculegion-male';
entries['Basculegion-F'] = 'basculegion-female';

// Gen 9
entries['Oinkologne'] = 'oinkologne-male';
entries['Oinkologne-M'] = 'oinkologne-male';
entries['Oinkologne-F'] = 'oinkologne-female';
entries['Maushold'] = 'maushold-family-of-three';
entries['Maushold-Three'] = 'maushold-family-of-three';
entries['Maushold-Four'] = 'maushold-family-of-four';
entries['Squawkabilly'] = 'squawkabilly-green-plumage';
for (const color of ['Green', 'Blue', 'White', 'Yellow']) entries[`Squawkabilly-${color}`] = `squawkabilly-${color.toLowerCase()}-plumage`;
entries['Palafin'] = 'palafin-hero';
entries['Palafin-Zero'] = 'palafin-zero';
entries['Tatsugiri'] = 'tatsugiri-curly';
for (const form of ['Curly', 'Droopy', 'Stretchy']) entries[`Tatsugiri-${form}`] = `tatsugiri-${form.toLowerCase()}`;
entries['Dudunsparce'] = 'dudunsparce-two-segment';
entries['Dudunsparce-Two-Segment'] = 'dudunsparce-two-segment';
entries['Dudunsparce-Three-Segment'] = 'dudunsparce-three-segment';
for (const name of ['Great Tusk', 'Scream Tail', 'Brute Bonnet', 'Flutter Mane', 'Slither Wing', 'Sandy Shocks', 'Roaring Moon', 'Walking Wake', 'Gouging Fire', 'Raging Bolt', 'Iron Treads', 'Iron Bundle', 'Iron Hands', 'Iron Jugulis', 'Iron Moth', 'Iron Thorns', 'Iron Valiant', 'Iron Leaves', 'Iron Boulder', 'Iron Crown']) {
  entries[name] = name.toLowerCase().replace(/\s+/g, '-');
}
entries['Silther Wing'] = 'slither-wing'; // legacy typo kept as an alias
entries['Poltchageist-Artisan'] = 'poltchageist';
entries['Sinistcha-Masterpiece'] = 'sinistcha';
entries['Ogerpon'] = 'ogerpon';
for (const mask of ['Wellspring', 'Hearthflame', 'Cornerstone']) {
  entries[`Ogerpon-${mask}`] = `ogerpon-${mask.toLowerCase()}-mask`;
}
entries['Terapagos'] = 'terapagos-terastal';
entries['Terapagos-Terastal'] = 'terapagos-terastal';
entries['Terapagos-Stellar'] = 'terapagos-stellar';

// Misc commonly typed names whose default slugging is already correct but worth pinning.
entries['Ho-Oh'] = 'ho-oh';
entries['Porygon-Z'] = 'porygon-z';
entries['Jangmo-o'] = 'jangmo-o';
entries['Hakamo-o'] = 'hakamo-o';
entries['Kommo-o'] = 'kommo-o';

export const SPECIAL_POKEMON_URL_ADJUSTMENTS = Object.freeze(entries);

/** Case-, diacritic-, whitespace- and quote-insensitive comparison key. */
function lookupKey(name) {
  return String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u02BC\u0060\u00B4]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const LOOKUP = new Map();
for (const [name, slug] of Object.entries(SPECIAL_POKEMON_URL_ADJUSTMENTS)) {
  const key = lookupKey(name);
  if (!LOOKUP.has(key)) LOOKUP.set(key, slug);
}

export function lookupSpecialAdjustment(name) {
  if (typeof name !== 'string' || !name) return undefined;
  return LOOKUP.get(lookupKey(name));
}

/**
 * Splits a Showdown first line ("Nick (Species) (M) @ Item") into parts.
 * Never throws; non-string input yields empty parts.
 */
export function splitNameLine(rawName) {
  const result = { species: '', nickname: '', gender: '' };
  if (typeof rawName !== 'string') return result;
  let text = rawName.normalize('NFC');
  const at = text.indexOf('@');
  if (at !== -1) text = text.slice(0, at);
  text = text.trim();
  const genderMatch = text.match(/^(.*?)\s*\(([MFmf])\)\s*$/);
  if (genderMatch) {
    result.gender = genderMatch[2].toUpperCase();
    text = genderMatch[1].trim();
  }
  const nickMatch = text.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (nickMatch && nickMatch[2].trim()) {
    result.nickname = nickMatch[1].trim();
    text = nickMatch[2].trim();
  }
  result.species = text;
  return result;
}

/** "Pika (Pikachu) (M) @ Light Ball" -> "Pikachu". */
export function stripNicknameAndGender(rawName) {
  return splitNameLine(rawName).species;
}

function defaultSlug(name) {
  return lookupKey(name)
    .replace(/['.:%]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Raw Showdown name (with optional nickname/gender) -> PokeAPI slug, or '' when empty. */
export function normalizePokemonSlug(rawName) {
  const species = stripNicknameAndGender(rawName);
  if (!species) return '';
  return lookupSpecialAdjustment(species) ?? defaultSlug(species);
}
