// Legal Pokémon slug sets per Pokémon Champions VGC Regulation (sourced from Showdown/Serebii).
// M-D mirrors M-C until officially announced.

const REG_MA_SLUGS = Object.freeze(["abomasnow","abomasnow-mega","absol","absol-mega","aegislash-shield","aerodactyl","aerodactyl-mega","aggron","aggron-mega","alakazam","alakazam-mega","alcremie","altaria","altaria-mega","ampharos","ampharos-mega","appletun","araquanid","arbok","arcanine","arcanine-hisui","archaludon","ariados","armarouge","aromatisse","audino","audino-mega","aurorus","avalugg","avalugg-hisui","azumarill","banette","banette-mega","basculegion-female","basculegion-male","bastiodon","beartic","beedrill","beedrill-mega","bellibolt","blastoise","blastoise-mega","camerupt","camerupt-mega","castform","ceruledge","chandelure","chandelure-mega","charizard","charizard-mega-x","charizard-mega-y","chesnaught","chesnaught-mega","chimecho","chimecho-mega","clawitzer","clefable","clefable-mega","cofagrigus","conkeldurr","corviknight","crabominable","crabominable-mega","decidueye","decidueye-hisui","dedenne","delphox","delphox-mega","diggersby","ditto","dragapult","dragonite","dragonite-mega","drampa","drampa-mega","emboar","emboar-mega","emolga","empoleon","espathra","espeon","excadrill","excadrill-mega","farigiraf","feraligatr","feraligatr-mega","flapple","flareon","floette-eternal","florges","forretress","froslass","froslass-mega","furfrou","gallade","gallade-mega","garbodor","garchomp","garchomp-mega","gardevoir","gardevoir-mega","garganacl","gengar","gengar-mega","glaceon","glalie","glalie-mega","glimmora","glimmora-mega","gliscor","golurk","golurk-mega","goodra","goodra-hisui","gourgeist-average","gourgeist-large","gourgeist-small","gourgeist-super","greninja","greninja-mega","gyarados","gyarados-mega","hatterene","hawlucha","hawlucha-mega","heliolisk","heracross","heracross-mega","hippowdon","houndoom","houndoom-mega","hydrapple","hydreigon","incineroar","infernape","jolteon","kangaskhan","kangaskhan-mega","kingambit","kleavor","klefki","kommo-o","krookodile","leafeon","liepard","lopunny","lopunny-mega","lucario","lucario-mega","luxray","lycanroc-dusk","lycanroc-midday","lycanroc-midnight","machamp","mamoswine","manectric","manectric-mega","maushold-family-of-three","medicham","medicham-mega","meganium","meganium-mega","meowscarada","meowstic-male","milotic","mimikyu-disguised","morpeko-full-belly","mr-rime","mudsdale","ninetales","ninetales-alola","noivern","oranguru","orthworm","palafin-hero","pangoro","passimian","pelipper","pidgeot","pidgeot-mega","pikachu","pinsir","pinsir-mega","politoed","polteageist","primarina","quaquaval","raichu","raichu-alola","rampardos","reuniclus","rhyperior","roserade","rotom","rotom-fan","rotom-frost","rotom-heat","rotom-mow","rotom-wash","runerigus","sableye","sableye-mega","salazzle","samurott","samurott-hisui","sandaconda","scizor","scizor-mega","scovillain","scovillain-mega","serperior","sharpedo","sharpedo-mega","simipour","simisage","simisear","sinistcha","skarmory","skarmory-mega","skeledirge","slowbro","slowbro-galar","slowbro-mega","slowking","slowking-galar","slurpuff","sneasler","snorlax","spiritomb","starmie","starmie-mega","steelix","steelix-mega","stunfisk","stunfisk-galar","sylveon","talonflame","tauros","tauros-paldea-aqua-breed","tauros-paldea-blaze-breed","tauros-paldea-combat-breed","tinkaton","torkoal","torterra","toucannon","toxapex","toxicroak","trevenant","tsareena","typhlosion","typhlosion-hisui","tyranitar","tyranitar-mega","tyrantrum","umbreon","vanilluxe","vaporeon","venusaur","venusaur-mega","victreebel","victreebel-mega","vivillon","volcarona","watchog","weavile","whimsicott","wyrdeer","zoroark","zoroark-hisui"]);
const REG_MB_ADDED = Object.freeze(["annihilape","barbaracle","barbaracle-mega","blaziken","blaziken-mega","dragalge","dragalge-mega","eelektross","eelektross-mega","falinks","falinks-mega","gholdengo","grimmsnarl","houndstone","malamar","malamar-mega","mawile","mawile-mega","metagross","metagross-mega","musharna","overqwil","pyroar-male","pyroar-mega","qwilfish","raichu-mega-x","raichu-mega-y","sceptile","sceptile-mega","scolipede","scolipede-mega","scrafty","scrafty-mega","staraptor","staraptor-mega","swampert","swampert-mega","vileplume"]);
const REG_MC_ADDED = Object.freeze(["absol-mega-z","arboliva","baxcalibur","baxcalibur-mega","cinderace","farfetchd","garchomp-mega-z","gogoat","golisopod","golisopod-mega","grapploct","indeedee-female","indeedee-male","inteleon","lucario-mega-z","mabosstiff","mr-mime","pawmot","perrserker","persian","persian-alola","pincurchin","rillaboom","salamence","salamence-mega","sirfetchd","squawkabilly-blue-plumage","squawkabilly-green-plumage","squawkabilly-white-plumage","squawkabilly-yellow-plumage","swalot","thievul","toxtricity-amped","toxtricity-low-key","wigglytuff"]);

const MA_SET = new Set(REG_MA_SLUGS);
const MB_SET = new Set([...REG_MA_SLUGS, ...REG_MB_ADDED]);
const MC_SET = new Set([...MB_SET, ...REG_MC_ADDED]);

export const REGULATION_LEGAL_SLUGS = Object.freeze({
  "M-A": MA_SET,
  "M-B": MB_SET,
  "M-C": MC_SET,
  "M-D": MC_SET,
});

/**
 * Returns the legal slug Set for a regulation (e.g. "M-A", "M-B", "M-C", "M-D"),
 * or null when unrestricted ("Other" or unset).
 */
export function getRegulationLegalSet(regulation) {
  const key = typeof regulation === "string" ? regulation.trim().toUpperCase() : "";
  if (!key || key === "OTHER") return null;
  return REGULATION_LEGAL_SLUGS[key] ?? null;
}

/** Filters a Pokémon catalog to the given regulation, or returns full catalog for Other/unset. */
export function filterCatalogByRegulation(catalog, regulation) {
  if (!Array.isArray(catalog)) return [];
  const allowed = getRegulationLegalSet(regulation);
  if (!allowed) return catalog;
  return catalog.filter((item) => item && allowed.has(item.slug));
}
