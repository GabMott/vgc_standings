# Changelog

## Version 2.0.0
* Full refactor from Windows Python/Pillow executable to a zero-dependency, 100% client-side HTML5 Canvas web application.
* Added single-file GitHub Gist bundler (`npm run build:gist` -> `dist/vgc-standings.html`).
* Introduced modular, analytics-ready versioned `TournamentRecord` schema (`schemaVersion: 1`) and pluggable `TournamentStore` interface for future backend hosting and tournament data compilation.
* Added support for both Portland VGC themes and 4 self-contained procedural themes, plus custom image uploads and color overrides.
* Added dual team input (PokéPaste URL or direct Showdown paste text), RFC-4180 CSV import/export, JSON import/export, and LocalStorage drafts.
* Fixed all legacy bugs: Windows-only paths/fonts, duplicate placing overwrites, font-shrink crashes, division-by-zero on empty teams/standings, nickname parsing, CRLF/LF paste parsing, and `SPECIAL_POKEMON_URL_ADJUSTMENTS` typos/encoding issues.
* Added comprehensive `node:test` unit and edge-case test suite covering malformed input, extreme strings/Unicode, layout geometry, API failures, storage errors, and Canvas rendering.

## Version 1.3.3
* Hotfix: Added Aegislash to the URL Adjustments list

## Version 1.3.2
* Cleaned up the README

## Version 1.3.1
* Added .png and .csv to the gitignore so the example stays on the repo
* Added the information to recreate the .exe if needed to the README

## Version 1.3.0
* Added CHANGELOG, README, and examples to be used

## Version 1.2.0
* Created an executable to be used for the project

## Version 1.1.1
* Hotfix for adding Mega Meowstic to the special adjustments

## Version 1.1.0 
* Adjusted Local information to be pulled from the .csv file 
* Adjusted the data gathering to a single function and to load into classes

## Version 1.0.3
* Added a Local Class to better organize the information created and used

## Version 1.0.2
* Added the 'SPECIAL_POKEMON_URL_ADJUSTMENTS' for pokemon that need name adjustments for PokeAPI

## Version 1.0.1
* Added a Signature to the standings image

## Version 1.0.0 
* Initial creation of the project
