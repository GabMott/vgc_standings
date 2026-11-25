// Built-in event presets sourced from pokedata.ovh recent major VGC events.
import { DEFAULT_THEME_ID, createEmptyTournament } from "../core/schema.js";

export const DEFAULT_PRESET_ID = "louisville-2027";

export const EVENT_PRESETS = Object.freeze([
  {
    "id": "louisville-2027",
    "label": "2027 Louisville Regional (Top 8)",
    "event": {
      "eventType": "other",
      "customEventLabel": "Regional Championships",
      "location": "Louisville",
      "date": "2026-10-11",
      "regulation": "M-C",
      "playerCount": 1013
    },
    "standings": [
      {
        "placing": "1",
        "name": "Joseph Ugarte",
        "handle": "",
        "teamSource": "Farigiraf @ Sitrus Berry\nAbility: Armor Tail\nQuiet Nature\n- Psychic\n- Thunderbolt\n- Helping Hand\n- Trick Room\n\nIncineroar @ Chople Berry\nAbility: Intimidate\nAdamant Nature\n- Flare Blitz\n- Darkest Lariat\n- Parting Shot\n- Fake Out\n\nCharizard @ Charizardite Y\nAbility: Blaze\nModest Nature\n- Heat Wave\n- Weather Ball\n- Ancient Power\n- Protect\n\nSylveon @ Fairy Feather\nAbility: Pixilate\nModest Nature\n- Hyper Voice\n- Moonblast\n- Yawn\n- Protect\n\nVenusaur @ Focus Sash\nAbility: Chlorophyll\nModest Nature\n- Leaf Storm\n- Sludge Bomb\n- Sleep Powder\n- Protect\n\nGarchomp @ Choice Scarf\nAbility: Rough Skin\nAdamant Nature\n- Rock Slide\n- Stomping Tantrum\n- Dragon Claw\n- Earthquake"
      },
      {
        "placing": "2",
        "name": "Andrew Figueras",
        "handle": "",
        "teamSource": "Archaludon @ Leftovers\nAbility: Stamina\nModest Nature\n- Electro Shot\n- Snarl\n- Dragon Pulse\n- Protect\n\nCharizard @ Charizardite Y\nAbility: Blaze\nModest Nature\n- Heat Wave\n- Weather Ball\n- Hurricane\n- Protect\n\nPelipper @ Sitrus Berry\nAbility: Drizzle\nCalm Nature\n- Weather Ball\n- Hurricane\n- Tailwind\n- Protect\n\nVenusaur @ Focus Sash\nAbility: Chlorophyll\nModest Nature\n- Sludge Bomb\n- Leaf Storm\n- Sleep Powder\n- Protect\n\nGrimmsnarl @ Light Clay\nAbility: Prankster\nImpish Nature\n- Spirit Break\n- Reflect\n- Light Screen\n- Parting Shot\n\nGarchomp @ Choice Scarf\nAbility: Rough Skin\nAdamant Nature\n- Bulldoze\n- Earthquake\n- Rock Slide\n- Dragon Claw"
      },
      {
        "placing": "3",
        "name": "Dorian Kang",
        "handle": "",
        "teamSource": "Venusaur @ Focus Sash\nAbility: Chlorophyll\nModest Nature\n- Sleep Powder\n- Protect\n- Earth Power\n- Sludge Bomb\n\nPolitoed @ Mystic Water\nAbility: Drizzle\nModest Nature\n- Weather Ball\n- Protect\n- Ice Beam\n- Muddy Water\n\nGrimmsnarl @ Light Clay\nAbility: Prankster\nSassy Nature\n- Spirit Break\n- Reflect\n- Light Screen\n- Parting Shot\n\nRaichu @ Raichunite X\nAbility: Lightning Rod\nJolly Nature\n- Fake Out\n- Volt Switch\n- Feint\n- Volt Tackle\n\nArchaludon @ Leftovers\nAbility: Stamina\nBold Nature\n- Dragon Pulse\n- Electro Shot\n- Protect\n- Snarl\n\nCharizard @ Charizardite Y\nAbility: Blaze\nModest Nature\n- Heat Wave\n- Weather Ball\n- Protect\n- Hurricane"
      },
      {
        "placing": "4",
        "name": "JJ Miller",
        "handle": "",
        "teamSource": "Gholdengo @ Life Orb\nAbility: Good as Gold\nTimid Nature\n- Make It Rain\n- Shadow Ball\n- Power Gem\n- Protect\n\nArchaludon @ Leftovers\nAbility: Stamina\nCalm Nature\n- Dragon Pulse\n- Electro Shot\n- Flash Cannon\n- Protect\n\nPelipper @ Sitrus Berry\nAbility: Drizzle\nBold Nature\n- Weather Ball\n- Hurricane\n- Tailwind\n- Wide Guard\n\nSwampert @ Swampertite\nAbility: Torrent\nAdamant Nature\n- Wave Crash\n- Ice Punch\n- Earthquake\n- Protect\n\nStaraptor @ Staraptite\nAbility: Intimidate\nJolly Nature\n- Brave Bird\n- Close Combat\n- Tailwind\n- Protect\n\nSinistcha @ Colbur Berry\nAbility: Hospitality\nRelaxed Nature\n- Matcha Gotcha\n- Rage Powder\n- Trick Room\n- Protect"
      },
      {
        "placing": "5",
        "name": "Ryan Loseto",
        "handle": "",
        "teamSource": "Rillaboom @ Miracle Seed\nAbility: Grassy Surge\nAdamant Nature\n- Wood Hammer\n- Grassy Glide\n- U-turn\n- Fake Out\n\nKingambit @ Chople Berry\nAbility: Defiant\nAdamant Nature\n- Kowtow Cleave\n- Sucker Punch\n- Iron Head\n- Protect\n\nSneasler @ Focus Sash\nAbility: Poison Touch\nJolly Nature\n- Dire Claw\n- Close Combat\n- Fake Out\n- Protect\n\nFloette-Eternal @ Floettite\nAbility: Flower Veil\nBold Nature\n- Moonblast\n- Dazzling Gleam\n- Calm Mind\n- Protect\n\nSalamence @ Salamencite\nAbility: Intimidate\nModest Nature\n- Hyper Voice\n- Flamethrower\n- Tailwind\n- Protect\n\nBasculegion @ Life Orb\nAbility: Adaptability\nJolly Nature\n- Wave Crash\n- Last Respects\n- Aqua Jet\n- Protect"
      },
      {
        "placing": "6",
        "name": "Toler Webb",
        "handle": "",
        "teamSource": "Golisopod @ Golisopite\nAbility: Emergency Exit\nAdamant Nature\n- Leech Life\n- Iron Head\n- Drill Run\n- Protect\n\nGarchomp @ Garchompite Z\nAbility: Rough Skin\nModest Nature\n- Earth Power\n- Draco Meteor\n- Power Gem\n- Protect\n\nPelipper @ Life Orb\nAbility: Drizzle\nModest Nature\n- Weather Ball\n- Muddy Water\n- Hurricane\n- Protect\n\nArchaludon @ Leftovers\nAbility: Stamina\nBold Nature\n- Electro Shot\n- Dragon Pulse\n- Snarl\n- Protect\n\nFarigiraf @ Sitrus Berry\nAbility: Armor Tail\nBold Nature\n- Psychic\n- Helping Hand\n- Trick Room\n- Protect\n\nSneasler @ White Herb\nAbility: Unburden\nAdamant Nature\n- Close Combat\n- Gunk Shot\n- U-turn\n- Protect"
      },
      {
        "placing": "7",
        "name": "Keanu Inosanto",
        "handle": "",
        "teamSource": "Basculegion @ Colbur Berry\nAbility: Adaptability\nAdamant Nature\n- Protect\n- Wave Crash\n- Last Respects\n- Aqua Jet\n\nRillaboom @ Miracle Seed\nAbility: Grassy Surge\nAdamant Nature\n- Wood Hammer\n- High Horsepower\n- Grassy Glide\n- Fake Out\n\nFloette-Eternal @ Floettite\nAbility: Flower Veil\nModest Nature\n- Protect\n- Moonblast\n- Dazzling Gleam\n- Calm Mind\n\nSneasler @ Focus Sash\nAbility: Poison Touch\nJolly Nature\n- Protect\n- Close Combat\n- Dire Claw\n- Fake Out\n\nSalamence @ Salamencite\nAbility: Intimidate\nModest Nature\n- Protect\n- Hyper Voice\n- Flamethrower\n- Tailwind\n\nKingambit @ Chople Berry\nAbility: Defiant\nAdamant Nature\n- Protect\n- Kowtow Cleave\n- Iron Head\n- Sucker Punch"
      },
      {
        "placing": "8",
        "name": "Brian Hough",
        "handle": "",
        "teamSource": "Gholdengo @ Life Orb\nAbility: Good as Gold\nModest Nature\n- Make It Rain\n- Shadow Ball\n- Nasty Plot\n- Protect\n\nDragonite @ Dragoninite\nAbility: Multiscale\nTimid Nature\n- Dragon Pulse\n- Heat Wave\n- Tailwind\n- Protect\n\nIncineroar @ Sitrus Berry\nAbility: Intimidate\nCareful Nature\n- Flare Blitz\n- Darkest Lariat\n- Fake Out\n- Parting Shot\n\nSneasler @ White Herb\nAbility: Unburden\nAdamant Nature\n- Close Combat\n- Dire Claw\n- Rock Tomb\n- Protect\n\nRillaboom @ Miracle Seed\nAbility: Grassy Surge\nAdamant Nature\n- Wood Hammer\n- Grassy Glide\n- High Horsepower\n- Fake Out\n\nGarchomp @ Choice Scarf\nAbility: Rough Skin\nAdamant Nature\n- Dragon Claw\n- Stomping Tantrum\n- Rock Slide\n- Earthquake"
      }
    ]
  },
  {
    "id": "frankfurt-2027",
    "label": "2027 Frankfurt Regional (Top 8)",
    "event": {
      "eventType": "other",
      "customEventLabel": "Regional Championships",
      "location": "Frankfurt",
      "date": "2026-09-27",
      "regulation": "M-C",
      "playerCount": 1129
    },
    "standings": [
      {
        "placing": "1",
        "name": "Eric Rios",
        "handle": "",
        "teamSource": "Gholdengo @ Life Orb\nAbility: Good as Gold\nModest Nature\n- Protect\n- Shadow Ball\n- Nasty Plot\n- Make It Rain\n\nVolcarona @ Rocky Helmet\nAbility: Flame Body\nTimid Nature\n- Overheat\n- Struggle Bug\n- Rage Powder\n- Tailwind\n\nGarchomp @ Garchompite Z\nAbility: Rough Skin\nModest Nature\n- Dragon Pulse\n- Earth Power\n- Power Gem\n- Protect\n\nIncineroar @ Sitrus Berry\nAbility: Intimidate\nImpish Nature\n- Parting Shot\n- Fake Out\n- Flare Blitz\n- Darkest Lariat\n\nRillaboom @ Miracle Seed\nAbility: Grassy Surge\nAdamant Nature\n- Grassy Glide\n- Wood Hammer\n- Fake Out\n- U-turn\n\nRaichu @ Raichunite Y\nAbility: Lightning Rod\nTimid Nature\n- Zap Cannon\n- Focus Blast\n- Fake Out\n- Protect"
      },
      {
        "placing": "2",
        "name": "Sebastian Liu Li",
        "handle": "",
        "teamSource": "Farigiraf @ Sitrus Berry\nAbility: Armor Tail\nSassy Nature\n- Psychic\n- Trick Room\n- Helping Hand\n- Protect\n\nGarchomp @ Garchompite Z\nAbility: Rough Skin\nModest Nature\n- Draco Meteor\n- Flamethrower\n- Power Gem\n- Protect\n\nSneasler @ White Herb\nAbility: Unburden\nAdamant Nature\n- Close Combat\n- Gunk Shot\n- Fake Out\n- Protect\n\nTorkoal @ Charcoal\nAbility: Drought\nQuiet Nature\n- Eruption\n- Earth Power\n- Weather Ball\n- Protect\n\nSylveon @ Fairy Feather\nAbility: Pixilate\nModest Nature\n- Hyper Voice\n- Hyper Beam\n- Yawn\n- Detect\n\nIncineroar @ Chople Berry\nAbility: Intimidate\nAdamant Nature\n- Flare Blitz\n- Darkest Lariat\n- Parting Shot\n- Fake Out"
      },
      {
        "placing": "3",
        "name": "Yvar Vlieger",
        "handle": "",
        "teamSource": "Charizard @ Charizardite Y\nAbility: Blaze\nModest Nature\n- Heat Wave\n- Weather Ball\n- Ancient Power\n- Protect\n\nKingambit @ Chople Berry\nAbility: Defiant\nAdamant Nature\n- Kowtow Cleave\n- Sucker Punch\n- Iron Head\n- Protect\n\nMeowstic-F @ Meowsticite\nAbility: Competitive\nTimid Nature\n- Expanding Force\n- Thunderbolt\n- Fake Out\n- Protect\n\nSneasler @ Psychic Seed\nAbility: Unburden\nAdamant Nature\n- Close Combat\n- Dire Claw\n- Rock Slide\n- Protect\n\nIndeedee @ Focus Sash\nAbility: Psychic Surge\nTimid Nature\n- Expanding Force\n- Energy Ball\n- Imprison\n- Trick Room\n\nKommo-o @ Leftovers\nAbility: Soundproof\nModest Nature\n- Clanging Scales\n- Aura Sphere\n- Clangorous Soul\n- Protect"
      },
      {
        "placing": "4",
        "name": "Eden Batchelor",
        "handle": "",
        "teamSource": "Gholdengo @ Life Orb\nAbility: Good as Gold\nModest Nature\n- Make It Rain\n- Shadow Ball\n- Nasty Plot\n- Protect\n\nDragonite @ Dragoninite\nAbility: Inner Focus\nModest Nature\n- Dragon Pulse\n- Heat Wave\n- Tailwind\n- Protect\n\nIncineroar @ Sitrus Berry\nAbility: Intimidate\nImpish Nature\n- Flare Blitz\n- Throat Chop\n- Parting Shot\n- Fake Out\n\nRillaboom @ Miracle Seed\nAbility: Grassy Surge\nAdamant Nature\n- Grassy Glide\n- Wood Hammer\n- High Horsepower\n- Fake Out\n\nSneasler @ White Herb\nAbility: Unburden\nAdamant Nature\n- Close Combat\n- Dire Claw\n- Rock Tomb\n- Protect\n\nFloette-Eternal @ Floettite\nAbility: Flower Veil\nBold Nature\n- Draining Kiss\n- Dazzling Gleam\n- Calm Mind\n- Protect"
      },
      {
        "placing": "5",
        "name": "Anthony Liuzzo",
        "handle": "",
        "teamSource": "Vivillon @ Focus Sash\nAbility: Compound Eyes\nTimid Nature\n- Sleep Powder\n- Rage Powder\n- Hurricane\n- Protect\n\nPolitoed @ Sitrus Berry\nAbility: Drizzle\nCalm Nature\n- Weather Ball\n- Perish Song\n- Encore\n- Protect\n\nGengar @ Gengarite\nAbility: Cursed Body\nModest Nature\n- Shadow Ball\n- Sludge Bomb\n- Perish Song\n- Protect\n\nIncineroar @ Passho Berry\nAbility: Intimidate\nRelaxed Nature\n- Protect\n- Fake Out\n- Flare Blitz\n- Parting Shot\n\nRillaboom @ Occa Berry\nAbility: Grassy Surge\nAdamant Nature\n- Fake Out\n- Grassy Glide\n- U-turn\n- Protect\n\nKommo-o @ Leftovers\nAbility: Soundproof\nModest Nature\n- Clanging Scales\n- Clangorous Soul\n- Aura Sphere\n- Protect"
      },
      {
        "placing": "6",
        "name": "Juan Manuel Odriozola",
        "handle": "",
        "teamSource": "Toxapex @ Leftovers\nAbility: Regenerator\nRelaxed Nature\n- Baneful Bunker\n- Wide Guard\n- Toxic\n- Infestation\n\nSylveon @ Fairy Feather\nAbility: Pixilate\nModest Nature\n- Detect\n- Yawn\n- Hyper Voice\n- Quick Attack\n\nGarchomp @ Choice Scarf\nAbility: Rough Skin\nAdamant Nature\n- Dragon Claw\n- Earthquake\n- Stomping Tantrum\n- Rock Slide\n\nIncineroar @ Sitrus Berry\nAbility: Intimidate\nImpish Nature\n- Fake Out\n- Parting Shot\n- Flare Blitz\n- Throat Chop\n\nVenusaur @ Life Orb\nAbility: Chlorophyll\nModest Nature\n- Protect\n- Leaf Storm\n- Sludge Bomb\n- Earth Power\n\nCharizard @ Charizardite Y\nAbility: Blaze\nTimid Nature\n- Protect\n- Heat Wave\n- Weather Ball\n- Ancient Power"
      },
      {
        "placing": "7",
        "name": "Valentijn Visser",
        "handle": "",
        "teamSource": "Froslass @ Froslassite\nAbility: Cursed Body\nTimid Nature\n- Protect\n- Blizzard\n- Shadow Ball\n- Aurora Veil\n\nIncineroar @ Sitrus Berry\nAbility: Intimidate\nImpish Nature\n- Flare Blitz\n- Darkest Lariat\n- Fake Out\n- Parting Shot\n\nBasculegion @ Choice Scarf\nAbility: Adaptability\nJolly Nature\n- Wave Crash\n- Last Respects\n- Flip Turn\n- Aqua Jet\n\nGlimmora @ Glimmoranite\nAbility: Toxic Debris\nTimid Nature\n- Spiky Shield\n- Sludge Bomb\n- Power Gem\n- Earth Power\n\nRillaboom @ Miracle Seed\nAbility: Grassy Surge\nAdamant Nature\n- Wood Hammer\n- U-turn\n- Grassy Glide\n- Fake Out\n\nVolcarona @ Grassy Seed\nAbility: Flame Body\nModest Nature\n- Protect\n- Heat Wave\n- Giga Drain\n- Quiver Dance"
      },
      {
        "placing": "8",
        "name": "Giuseppe Musicco",
        "handle": "",
        "teamSource": "Floette-Eternal @ Floettite\nAbility: Flower Veil\nModest Nature\n- Dazzling Gleam\n- Draining Kiss\n- Calm Mind\n- Protect\n\nRillaboom @ Miracle Seed\nAbility: Grassy Surge\nAdamant Nature\n- Wood Hammer\n- Grassy Glide\n- High Horsepower\n- Fake Out\n\nIncineroar @ Sitrus Berry\nAbility: Intimidate\nImpish Nature\n- Flare Blitz\n- Taunt\n- Parting Shot\n- Fake Out\n\nDragonite @ Dragoninite\nAbility: Inner Focus\nModest Nature\n- Dragon Pulse\n- Heat Wave\n- Tailwind\n- Protect\n\nGholdengo @ Life Orb\nAbility: Good as Gold\nModest Nature\n- Make It Rain\n- Shadow Ball\n- Nasty Plot\n- Protect\n\nSneasler @ White Herb\nAbility: Unburden\nAdamant Nature\n- Dire Claw\n- Close Combat\n- Rock Tomb\n- Protect"
      }
    ]
  },
  {
    "id": "baltimore-2027",
    "label": "2027 Baltimore Regional (Top 4)",
    "event": {
      "eventType": "other",
      "customEventLabel": "Regional Championships",
      "location": "Baltimore",
      "date": "2026-09-20",
      "regulation": "M-C",
      "playerCount": 1082
    },
    "standings": [
      {
        "placing": "1",
        "name": "Joseph Ugarte",
        "handle": "",
        "teamSource": "Excadrill @ Focus Sash\nAbility: Sand Rush\nJolly Nature\n- Iron Head\n- High Horsepower\n- Rock Slide\n- Protect\n\nSalamence @ Salamencite\nAbility: Intimidate\nTimid Nature\n- Hyper Voice\n- Draco Meteor\n- Flamethrower\n- Protect\n\nTyranitar @ Tyranitarite\nAbility: Sand Stream\nJolly Nature\n- Rock Slide\n- Knock Off\n- Low Kick\n- Protect\n\nIndeedee @ Choice Scarf\nAbility: Psychic Surge\nModest Nature\n- Expanding Force\n- Mystical Fire\n- Trick\n- Protect\n\nCorviknight @ Psychic Seed\nAbility: Mirror Armor\nCareful Nature\n- Brave Bird\n- Power Trip\n- Bulk Up\n- Roost\n\nSneasler @ White Herb\nAbility: Unburden\nAdamant Nature\n- Dire Claw\n- Close Combat\n- Coaching\n- Protect"
      },
      {
        "placing": "2",
        "name": "Aditya Subramanian",
        "handle": "",
        "teamSource": "Golisopod @ Golisopite\nAbility: Emergency Exit\nAdamant Nature\n- Leech Life\n- Drill Run\n- Iron Head\n- Protect\n\nCharizard @ Charizardite Y\nAbility: Blaze\nTimid Nature\n- Heat Wave\n- Hurricane\n- Weather Ball\n- Protect\n\nPolitoed @ Mystic Water\nAbility: Drizzle\nModest Nature\n- Muddy Water\n- Ice Beam\n- Weather Ball\n- Protect\n\nArchaludon @ Leftovers\nAbility: Stamina\nBold Nature\n- Dragon Pulse\n- Snarl\n- Electro Shot\n- Protect\n\nGrimmsnarl @ Light Clay\nAbility: Prankster\nSassy Nature\n- Light Screen\n- Reflect\n- Parting Shot\n- Spirit Break\n\nFarigiraf @ Sitrus Berry\nAbility: Armor Tail\nBold Nature\n- Psychic\n- Trick Room\n- Protect\n- Grass Knot"
      },
      {
        "placing": "3",
        "name": "Brady Smith",
        "handle": "",
        "teamSource": "Archaludon @ Leftovers\nAbility: Stamina\nBold Nature\n- Dragon Pulse\n- Flash Cannon\n- Electro Shot\n- Protect\n\nIncineroar @ Passho Berry\nAbility: Intimidate\nSassy Nature\n- Fake Out\n- Parting Shot\n- Darkest Lariat\n- Protect\n\nPolitoed @ Sitrus Berry\nAbility: Drizzle\nCalm Nature\n- Perish Song\n- Weather Ball\n- Encore\n- Protect\n\nVivillon @ Focus Sash\nAbility: Compound Eyes\nTimid Nature\n- Sleep Powder\n- Rage Powder\n- Hurricane\n- Protect\n\nRillaboom @ Eject Button\nAbility: Grassy Surge\nCareful Nature\n- Fake Out\n- Grassy Glide\n- U-turn\n- Protect\n\nGengar @ Gengarite\nAbility: Cursed Body\nModest Nature\n- Shadow Ball\n- Sludge Bomb\n- Perish Song\n- Protect"
      },
      {
        "placing": "4",
        "name": "Blaik Thompson",
        "handle": "",
        "teamSource": "Salamence @ Salamencite\nAbility: Intimidate\nTimid Nature\n- Heat Wave\n- Draco Meteor\n- Hyper Voice\n- Protect\n\nArcanine-Hisui @ Focus Sash\nAbility: Rock Head\nJolly Nature\n- Flare Blitz\n- Head Smash\n- Extreme Speed\n- Protect\n\nIndeedee @ Choice Scarf\nAbility: Psychic Surge\nModest Nature\n- Expanding Force\n- Trick\n- Trick Room\n- Imprison\n\nMilotic @ Leftovers\nAbility: Competitive\nCalm Nature\n- Scald\n- Ice Beam\n- Icy Wind\n- Protect\n\nMetagross @ Metagrossite\nAbility: Clear Body\nAdamant Nature\n- Steel Roller\n- Psychic Fangs\n- Body Press\n- Protect\n\nSneasler @ Psychic Seed\nAbility: Unburden\nAdamant Nature\n- Throat Chop\n- Close Combat\n- Rock Slide\n- Protect"
      }
    ]
  },
  {
    "id": "worlds-2026",
    "label": "2026 World Championships (Top 2)",
    "event": {
      "eventType": "other",
      "customEventLabel": "World Championships",
      "location": "San Francisco",
      "date": "2026-08-30",
      "regulation": "M-B",
      "playerCount": 395
    },
    "standings": [
      {
        "placing": "1",
        "name": "Takuma Yamazaki",
        "handle": "",
        "teamSource": "Floette-Eternal @ Floettite\nAbility: Flower Veil\nTimid Nature\n- Moonblast\n- Dazzling Gleam\n- Light of Ruin\n- Protect\n\nBasculegion @ Life Orb\nAbility: Adaptability\nAdamant Nature\n- Wave Crash\n- Last Respects\n- Aqua Jet\n- Protect\n\nKingambit @ Chople Berry\nAbility: Defiant\nAdamant Nature\n- Sucker Punch\n- Kowtow Cleave\n- Low Kick\n- Iron Head\n\nDragonite @ Dragoninite\nAbility: Multiscale\nModest Nature\n- Dragon Pulse\n- Heat Wave\n- Extreme Speed\n- Protect\n\nGarchomp @ Choice Scarf\nAbility: Rough Skin\nAdamant Nature\n- Dragon Claw\n- Stomping Tantrum\n- Earthquake\n- Rock Slide\n\nSneasler @ Focus Sash\nAbility: Poison Touch\nJolly Nature\n- Close Combat\n- Dire Claw\n- Fake Out\n- Feint"
      },
      {
        "placing": "2",
        "name": "Hiroshi Onishi",
        "handle": "",
        "teamSource": "Kingambit @ Occa Berry\nAbility: Defiant\nAdamant Nature\n- Kowtow Cleave\n- Sucker Punch\n- Iron Head\n- Low Kick\n\nBasculegion @ Life Orb\nAbility: Adaptability\nAdamant Nature\n- Wave Crash\n- Last Respects\n- Aqua Jet\n- Protect\n\nGarchomp @ Sitrus Berry\nAbility: Rough Skin\nJolly Nature\n- Dragon Claw\n- Earthquake\n- Rock Slide\n- Protect\n\nCharizard @ Charizardite Y\nAbility: Blaze\nTimid Nature\n- Heat Wave\n- Weather Ball\n- Ancient Power\n- Protect\n\nWhimsicott @ Focus Sash\nAbility: Prankster\nTimid Nature\n- Moonblast\n- Tailwind\n- Encore\n- Protect\n\nFloette-Eternal @ Floettite\nAbility: Flower Veil\nModest Nature\n- Moonblast\n- Dazzling Gleam\n- Light of Ruin\n- Protect"
      }
    ]
  },
  {
    "id": "masters-eight",
    "label": "Masters Eight Sample (PokéPaste URLs, Top 4)",
    "event": {
      "eventType": "cup",
      "customEventLabel": "",
      "location": "Wyndon Stadium",
      "date": "2022-07-08",
      "regulation": "Other",
      "playerCount": 8
    },
    "standings": [
      {
        "placing": "1",
        "name": "Ash Ketchum",
        "handle": "@pikafan25",
        "teamSource": "https://pokepast.es/33bbc4f4633968dc"
      },
      {
        "placing": "2",
        "name": "Leon",
        "handle": "",
        "teamSource": "https://pokepast.es/380a942db3548064"
      },
      {
        "placing": "3",
        "name": "Cynthia",
        "handle": "",
        "teamSource": "https://pokepast.es/0b04ab36eb7d7b89"
      },
      {
        "placing": "4",
        "name": "Diantha",
        "handle": "@mskalos",
        "teamSource": "https://pokepast.es/77ac36ad28fa6ea6"
      }
    ]
  }
]);

export function createPresetTournament(presetId = DEFAULT_PRESET_ID) {
  const preset = EVENT_PRESETS.find((p) => p.id === presetId) ?? EVENT_PRESETS[0];
  return createEmptyTournament({
    event: { ...preset.event },
    standings: preset.standings.map((s) => ({ ...s })),
    themeConfig: { themeId: DEFAULT_THEME_ID, overrides: {} },
    signature: "",
  });
}
