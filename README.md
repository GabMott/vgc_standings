# Pokémon VGC Standings Generator

A zero-dependency, 100% client-side web application for generating Pokémon Video Game Championships (VGC) tournament standings graphics. Runs directly in modern desktop and mobile browsers (Chrome & Safari) using HTML5 `<canvas>` and builds into a single standalone HTML file for **GitHub Pages** (`index.html`) or offline/Gist use (`dist/vgc-standings.html`).

**Live App:** https://gabmott.github.io/vgc_standings/

## Features

* **100% Client-Side & Zero Dependencies**: No backend required — PokéPaste, PokéAPI, and local assets all work directly from the browser. Built into a single self-contained HTML bundle (`index.html` and `dist/vgc-standings.html`).
* **Interactive Editor + Live Preview**: Edit event details (`Challenge`, `Cup`, or `Other` with custom label; Location; Date picker; Regulation `M-A`–`M-D` or `Other`; numeric Player Count stepper; Top Cut `2`, `4`, or `8`) with instant Canvas preview and PNG download. Defaults to **Challenge**, current date, **Regulation M-C**, **0 players**, and **Top Cut 2**.
* **Per-Player URL/Paste or Manual Team Entry**:
  * **URL / Paste**: Accepts `pokepast.es` URLs or raw Pokémon Showdown paste text in an auto-expanding textarea.
  * **Manual**: Six autocorrect-disabled text fields with multi-word, typo-tolerant fuzzy search (e.g., `"mega floette"`, `"inceneroar"`, `"hisui arcanine"`). Suggestions are automatically filtered to Pokémon legal in the selected Regulation (**M-A**, **M-B**, **M-C**, and **M-D** mirroring M-C), or unrestricted when **Other** is selected.
* **Name & Team Redaction**: Per-player checkboxes at the top of each player card to **Redact name** (disables Name & Handle inputs and renders `"Trainer"`) and **Redact team** (disables team inputs and fills a uniform row of 6 shaded Pokéball sprites), suppressing missing-field warnings for redacted entries.
* **Polished Graphic Layout & Sprite Kerning**:
  * Portland VGC dark header with balanced logo margins, centered rhombus info banner, and a mathematically aligned 45° diagonal Pokéball backdrop.
  * Consistent `675px` player card widths across Top 2 (centered stack), Top 4, and Top 8.
  * Globally consistent sprite scaling across all cards with alpha-bounds trimming and 24-band optical contour kerning so asymmetric sprites keep equal visual spacing without touching.
  * Clean live preview with an **Incomplete Standings** warning popup before downloading a PNG if required fields are missing.
* **Auto-Save, Named Drafts & Upload/Export**:
  * Working edits auto-save in `localStorage` so page reloads (and mobile Safari tab reloads) preserve your progress; **Clear Fields** prompts for confirmation before resetting to defaults.
  * **Save Draft** opens a naming modal with an auto-highlighted default title; saved drafts can be loaded or deleted from the **Drafts** toolbar.
  * Consolidated **Upload** (`.csv` / `.json`, backward compatible with `data.csv`) and **Export** (CSV or JSON) modals.

## Quick Start

Requires **Node.js >= 22** (no `npm install` needed).

### Run the Test Suite
```bash
npm test
```

### Run with Coverage
```bash
npm run test:coverage
```

### Build the Standalone App (GitHub Pages & Gist)
```bash
npm run build:gist
```
This bundles `web/index.html`, `web/styles.css`, and `src/**/*.js` into both:
- `index.html` (served automatically by GitHub Pages at `https://gabmott.github.io/vgc_standings/`), and
- `dist/vgc-standings.html` (standalone single-file copy for offline use or Gist hosting).

### Run Locally During Development
Serve the repo root with any static server so ES modules and `./assets/` resolve:
```bash
npx serve .
# Open http://localhost:3000/web/index.html (dev) or http://localhost:3000/index.html (built)
```

> **Tip (Testing Presets):** Built-in event presets live in `src/adapters/presets.js` and are commented out in `web/index.html` (`#presets-select`) for production use. Uncomment that block and rebuild to re-enable preset switching during testing.

## Project Structure

```text
vgc_standings/
├── index.html                   # Built single-file app for GitHub Pages
├── src/
│   ├── core/                    # Pure domain logic (zero DOM/network deps)
│   │   ├── schema.js            # Versioned TournamentRecord, date/title formatters
│   │   ├── validation.js        # Input sanitization, hex/URL/image/schema validation
│   │   ├── pokemon-names.js     # Showdown -> PokéAPI slug normalizer & fuzzy search
│   │   ├── regulations.js       # Champions regulation legal rosters (M-A through M-D)
│   │   ├── pokepaste.js         # Strict pokepast.es URL normalizer & Showdown parser
│   │   ├── csv-parser.js        # RFC-4180 CSV import/export (data.csv compatible)
│   │   └── layout.js            # Dynamic card grid, sprite scaling/kerning & text fitting
│   ├── adapters/                # Swappable I/O & storage boundaries
│   │   ├── storage.js           # TournamentStore (Memory + LocalStorage)
│   │   ├── api.js               # PokeApiClient (timeout, caching, catalog & sprite fallback)
│   │   ├── themes.js            # Portland Dark theme & auto local/raw-GitHub asset URLs
│   │   └── presets.js           # Event presets for testing
│   ├── renderer/
│   │   └── canvas-renderer.js   # HTML5 Canvas 2D renderer (45° Pokéball lattice, sprites, Pokéball fillers)
│   └── app.js                   # Browser UI controller (autosave, drafts, modals, touch support)
├── web/
│   ├── index.html               # Source HTML template
│   └── styles.css               # Responsive dark-mode UI (Chrome & Safari desktop/mobile)
├── scripts/
│   └── build-gist.mjs           # Zero-dependency single-file bundler
├── tests/                       # node:test unit, layout, renderer, and bundle boot test suite
├── dist/
│   └── vgc-standings.html       # Standalone single-file bundle
├── assets/                      # Portland VGC header and logo artwork
└── data.csv                     # Sample standings CSV
```

## License and Attribution

Originally created by [JoshBell302](https://github.com/JoshBell302/vgc_standings) and refactored/extended by [GabMott](https://github.com/GabMott/vgc_standings). Pokémon names, artwork, and related assets belong to their respective owners.
