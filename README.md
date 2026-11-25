# Pokémon VGC Standings Generator (Web App & Gist)

A zero-dependency, 100% client-side web application for generating Pokémon Video Game Championships (VGC) local tournament standings graphics. Runs directly in the browser using HTML5 `<canvas>` and can be built into a single standalone HTML file for hosting as a **GitHub Gist**.

## Features

* **100% Client-Side & Gist-Ready**: Runs with zero backend servers (PokéPaste, PokéAPI, and GitHub raw assets all support CORS). Build a single standalone `dist/vgc-standings.html` ready to paste into a GitHub Gist.
* **Interactive Editor + Live Preview**: Edit tournament metadata, themes, colors, custom uploaded images, and player standings with instant canvas preview and PNG download.
* **Dual Team Input**: Accepts either a `pokepast.es` URL **or** raw Pokémon Showdown paste text directly.
* **CSV & Analytics-Ready JSON Import/Export**: Backward compatible with the original `data.csv` format, plus versioned `TournamentRecord` JSON export/import preserving full Pokémon sets (items, abilities, Tera types, EVs, IVs, natures, moves) and live usage analytics for future hosting/data compilation.
* **Built-In Themes**: Includes the 3 Portland VGC themes (Dark, Light, B&W) plus 4 self-contained procedural Canvas themes (Midnight Pokéball, Crimson Arena, Emerald Circuit, Minimal Slate) that require zero external image assets.
* **Hardened Against Malformed Input**: Handles long strings (auto-fit + ellipsis truncation), Unicode/emoji/RTL safety, duplicate/tied placings, non-numeric placings (`T4`, `1st`), nicknames in PokéPastes, missing/corrupt artwork fallbacks, and large player counts (dynamic canvas height).

## Quick Start

Requires **Node.js >= 22** (zero `npm install` needed).

### Run the Test Suite
```bash
npm test
```

### Run with Coverage
```bash
npm run test:coverage
```

### Build the Single-File GitHub Gist Bundle
```bash
npm run build:gist
```
This outputs `dist/vgc-standings.html`, which you can:
- Open directly in any modern browser, or
- Paste into a GitHub Gist as `index.html` and open via `https://gistpreview.github.io/?<YOUR_GIST_ID>`.

### Run Locally During Development
Serve the repo root with any static server so ES modules and `./assets/` resolve:
```bash
npx serve .
# Then open http://localhost:3000/web/index.html
```

## Project Structure

```text
vgc_standings/
├── src/
│   ├── core/              # Pure domain logic (zero DOM/network deps)
│   │   ├── schema.js      # Versioned TournamentRecord + analytics summary
│   │   ├── validation.js  # Input sanitization, hex/URL/image/schema validation
│   │   ├── pokemon-names.js # Showdown species -> PokéAPI slug normalizer
│   │   ├── pokepaste.js   # Strict pokepast.es URL normalizer & Showdown parser
│   │   ├── csv-parser.js  # RFC-4180 CSV import/export (data.csv compatible)
│   │   └── layout.js      # Dynamic card grid & binary-search text fitting
│   ├── adapters/          # Swappable I/O & storage boundaries
│   │   ├── storage.js     # TournamentStore (Memory + LocalStorage; drop-in for future API)
│   │   ├── api.js         # PokeApiClient (timeout, caching, sprite fallback chain)
│   │   └── themes.js      # Built-in Portland VGC + procedural themes
│   ├── renderer/
│   │   └── canvas-renderer.js # HTML5 Canvas 2D renderer with safe fallbacks
│   └── app.js             # Browser UI controller
├── web/
│   ├── index.html         # Dev entry point
│   └── styles.css         # Responsive accessible dark-mode UI
├── scripts/
│   └── build-gist.mjs     # Zero-dependency single-file Gist bundler
├── tests/                 # Comprehensive node:test unit & edge-case suite
├── dist/
│   └── vgc-standings.html # Built single-file Gist output
├── assets/                # Portland VGC theme artwork
└── data.csv               # Sample Masters Eight CSV
```

## License and Attribution

Originally created by JoshBell302 on GitHub and refactored into a cross-platform web app. Pokémon names, artwork, and related assets belong to their respective owners.
