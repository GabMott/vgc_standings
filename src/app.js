import {
  DEFAULT_THEME_ID,
  MAX_POKEMON_PER_TEAM,
  createEmptyTournament,
  createStandingEntry,
  createPokemonSet,
  serializeTournament,
  deserializeTournament,
  formatEventDate,
} from './core/schema.js';
import {
  MAX_PLAYER_COUNT,
  REGULATION_OPTIONS,
  TOP_CUT_OPTIONS,
  sanitizeText,
  sanitizeHandle,
  sanitizePlayerCount,
  validateTournament,
} from './core/validation.js';
import {
  normalizePokemonSlug,
  buildPokemonCatalog,
  fuzzySearchPokemon,
} from './core/pokemon-names.js';
import { filterCatalogByRegulation } from './core/regulations.js';
import { isPokepasteUrl, parseShowdownTeam } from './core/pokepaste.js';
import { parseStandingsCsv, exportStandingsCsv } from './core/csv-parser.js';
import { LocalStorageTournamentStore } from './adapters/storage.js';
import { PokeApiClient } from './adapters/api.js';
import { resolveTheme } from './adapters/themes.js';
import { DEFAULT_PRESET_ID, EVENT_PRESETS, createPresetTournament } from './adapters/presets.js';
import { loadImage, renderStandingsCanvas } from './renderer/canvas-renderer.js';

function toIsoDateInput(value) {
  const text = sanitizeText(value, { maxLength: 40 });
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const m = Number.parseInt(slashMatch[1], 10);
    const day = Number.parseInt(slashMatch[2], 10);
    const y = Number.parseInt(slashMatch[3], 10);
    if (m >= 1 && m <= 12 && day >= 1 && day <= 31) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  if (!/\b\d{4}\b/.test(text)) return '';
  const ts = Date.parse(text);
  if (!Number.isFinite(ts)) return '';
  const d = new Date(ts);
  const y = String(d.getFullYear()).padStart(4, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function readFileAsText(file) {
  if (typeof file?.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Could not read file.'));
      reader.readAsText(file);
    } catch (err) {
      reject(err);
    }
  });
}

function safeDownloadFilename(tournament, ext) {
  const loc = sanitizeText(tournament?.event?.location, { maxLength: 40, fallback: 'vgc-standings' })
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const date = sanitizeText(tournament?.event?.date, { maxLength: 24, fallback: '' })
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const base = [loc || 'vgc-standings', date].filter(Boolean).join('-');
  return `${base}.${ext}`;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Keep blob URL alive long enough for iOS Safari's asynchronous download prompt
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function getTodayIsoDate() {
  const d = new Date();
  const y = String(d.getFullYear()).padStart(4, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function createDefaultTournament() {
  return createEmptyTournament({
    event: {
      eventType: 'challenge',
      customEventLabel: '',
      location: '',
      date: getTodayIsoDate(),
      regulation: 'M-C',
      playerCount: 0,
    },
    standings: [
      createStandingEntry({ placing: '1' }),
      createStandingEntry({ placing: '2' }),
    ],
    signature: '',
  });
}

function generateDefaultDraftName(t) {
  const ev = t?.event || {};
  let typeLabel = 'Event';
  if (ev.eventType === 'challenge') typeLabel = 'League Challenge';
  else if (ev.eventType === 'cup') typeLabel = 'League Cup';
  else if (ev.customEventLabel) typeLabel = sanitizeText(ev.customEventLabel, { maxLength: 40 });
  const loc = sanitizeText(ev.location, { maxLength: 40 });
  const base = loc ? `${loc} ${typeLabel}` : typeLabel;
  const formattedDate = formatEventDate(ev.date);
  return formattedDate ? `${base} (${formattedDate})` : base;
}

function collectMissingDownloadFields(t) {
  const missing = [];
  const ev = t?.event || {};
  if (ev.eventType === 'other' && !sanitizeText(ev.customEventLabel, { maxLength: 60 })) {
    missing.push('Event label is missing');
  }
  if (!sanitizeText(ev.location, { maxLength: 80 })) {
    missing.push('Location is missing');
  }
  if (!sanitizeText(ev.date, { maxLength: 40 })) {
    missing.push('Date is missing');
  }
  if (!sanitizeText(ev.regulation, { maxLength: 20 })) {
    missing.push('Regulation is not selected');
  }
  if (sanitizePlayerCount(ev.playerCount) <= 0) {
    missing.push('Player count is 0');
  }
  const standings = Array.isArray(t?.standings) ? t.standings : [];
  if (standings.length === 0) {
    missing.push('No players entered');
  } else {
    standings.forEach((entry, idx) => {
      const label = `Player #${idx + 1}`;
      if (entry?.redactName !== true && !sanitizeText(entry?.name, { maxLength: 60 })) {
        missing.push(`${label}: player name is missing`);
      }
      if (entry?.redactTeam !== true) {
        const count = Array.isArray(entry?.pokemon) ? entry.pokemon.length : 0;
        if (count === 0) {
          missing.push(`${label}: team is missing`);
        } else if (count < MAX_POKEMON_PER_TEAM) {
          missing.push(`${label}: only ${count} of ${MAX_POKEMON_PER_TEAM} Pokémon entered`);
        }
      }
    });
  }
  return missing;
}

export function initApp(doc = globalThis.document) {
  if (!doc) return null;

  const $ = (id) => doc.getElementById(id);
  const store = new LocalStorageTournamentStore();
  const api = new PokeApiClient();

  const canvas = $('standings-canvas');
  const announcer = $('announcer');
  const statusEl = $('status');
  const warningsEl = $('warnings');
  const playersEl = $('players');
  const topCutSelect = $('f-topCut');
  const presetsSelect = $('presets-select');
  const draftsSelect = $('drafts-select');
  const saveDraftBtn = $('btn-draft-save');
  const deleteDraftBtn = $('btn-draft-delete');

  let tournament = presetsSelect ? createPresetTournament(DEFAULT_PRESET_ID) : createDefaultTournament();
  let legacyDateFallback = '';
  let standingsStash = [];
  const entryModes = new Map();
  const manualSlotsByEntry = new Map();
  const imageCache = new Map();
  let renderTimer = null;
  let isRendering = false;
  let pendingRender = false;

  // Seed searchable Pokémon catalog immediately from presets + special table,
  // then enrich asynchronously with the full PokéAPI species/form list.
  const presetSeedNames = [];
  for (const preset of EVENT_PRESETS) {
    for (const s of preset.standings || []) {
      if (!isPokepasteUrl(s.teamSource)) {
        const parsed = parseShowdownTeam(s.teamSource);
        for (const m of parsed.pokemon) {
          if (m.name) presetSeedNames.push(m.name);
        }
      }
    }
  }
  let pokemonCatalog = buildPokemonCatalog(presetSeedNames);
  api.fetchPokemonCatalog().then((slugs) => {
    if (Array.isArray(slugs) && slugs.length > 0) {
      pokemonCatalog = buildPokemonCatalog([...presetSeedNames, ...slugs]);
    }
  });

  function announce(msg) {
    if (!announcer) return;
    announcer.textContent = '';
    setTimeout(() => { announcer.textContent = msg; }, 50);
  }

  function setStatus(msg, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.classList.toggle('error', isError);
  }

  function syncAriaField(el) {
    if (!el || typeof el.matches !== 'function') return;
    let isField = false;
    try {
      isField = el.matches('input, select, textarea');
    } catch {
      return;
    }
    if (!isField) return;
    let invalid = false;
    try {
      invalid = el.matches(':user-invalid');
    } catch {
      invalid = typeof el.checkValidity === 'function' ? !el.checkValidity() : false;
    }
    el.setAttribute('aria-invalid', invalid ? 'true' : 'false');
  }

  async function getCachedImage(url) {
    if (!url) return null;
    if (imageCache.has(url)) return imageCache.get(url);
    const p = loadImage(url);
    imageCache.set(url, p);
    const img = await p;
    if (!img) imageCache.delete(url);
    return img;
  }

  function populatePresetOptions(selectedId = DEFAULT_PRESET_ID) {
    if (!presetsSelect) return;
    presetsSelect.innerHTML = '';
    for (const preset of EVENT_PRESETS) {
      const opt = doc.createElement('option');
      opt.value = preset.id;
      opt.textContent = preset.label;
      if (preset.id === selectedId) opt.selected = true;
      presetsSelect.appendChild(opt);
    }
    presetsSelect.value = selectedId;
  }

  function populateRegulationOptions(extraValue = '') {
    const regSelect = $('f-regulation');
    if (!regSelect) return;
    regSelect.innerHTML = '';
    const none = doc.createElement('option');
    none.value = '';
    none.textContent = '— None —';
    regSelect.appendChild(none);
    for (const reg of REGULATION_OPTIONS) {
      const opt = doc.createElement('option');
      opt.value = reg;
      opt.textContent = reg;
      regSelect.appendChild(opt);
    }
    const cleanExtra = sanitizeText(extraValue, { maxLength: 20 });
    if (cleanExtra && !REGULATION_OPTIONS.includes(cleanExtra)) {
      const opt = doc.createElement('option');
      opt.value = cleanExtra;
      opt.textContent = cleanExtra;
      regSelect.appendChild(opt);
    }
  }

  function populateTopCutOptions(currentCount) {
    if (!topCutSelect) return;
    topCutSelect.innerHTML = '';
    const counts = [...TOP_CUT_OPTIONS];
    if (currentCount > 0 && !counts.includes(currentCount)) {
      counts.push(currentCount);
      counts.sort((a, b) => a - b);
    }
    for (const n of counts) {
      const opt = doc.createElement('option');
      opt.value = String(n);
      opt.textContent = String(n);
      topCutSelect.appendChild(opt);
    }
    topCutSelect.value = String(counts.includes(currentCount) ? currentCount : 4);
  }

  function resizeStandings(targetCount) {
    const n = Math.max(1, Math.floor(Number(targetCount) || 4));
    // Stash any existing entries beyond the new length so switching 8 -> 4 -> 8 keeps user edits
    for (let i = 0; i < tournament.standings.length; i++) {
      standingsStash[i] = tournament.standings[i];
    }
    if (tournament.standings.length > n) {
      tournament.standings = tournament.standings.slice(0, n);
    } else {
      while (tournament.standings.length < n) {
        const idx = tournament.standings.length;
        tournament.standings.push(
          standingsStash[idx] || createStandingEntry({ placing: String(idx + 1) }),
        );
      }
    }
    populateTopCutOptions(tournament.standings.length);
  }

  function syncPlayerCountButtons(count) {
    const decBtn = $('btn-playerCount-dec');
    const incBtn = $('btn-playerCount-inc');
    if (decBtn) decBtn.disabled = count <= 0;
    if (incBtn) incBtn.disabled = count >= MAX_PLAYER_COUNT;
  }

  function syncFormFromState() {
    const ev = tournament.event;
    const eventTypeEl = $('f-eventType');
    const customLabelEl = $('f-customLabel');
    const wrapCustomEl = $('wrap-customLabel');
    const locationEl = $('f-location');
    const dateEl = $('f-date');
    const regEl = $('f-regulation');
    const playerCountInput = $('f-playerCount');
    if (eventTypeEl) eventTypeEl.value = ev.eventType || 'challenge';
    if (customLabelEl) customLabelEl.value = ev.customEventLabel || '';
    if (wrapCustomEl) wrapCustomEl.hidden = ev.eventType !== 'other';
    if (locationEl) locationEl.value = ev.location || '';
    const isoDate = toIsoDateInput(ev.date);
    legacyDateFallback = isoDate ? '' : (ev.date || '');
    if (dateEl) dateEl.value = isoDate;
    populateRegulationOptions(ev.regulation);
    if (regEl) regEl.value = sanitizeText(ev.regulation, { maxLength: 20 });
    const count = sanitizePlayerCount(ev.playerCount);
    if (playerCountInput) playerCountInput.value = String(count);
    syncPlayerCountButtons(count);
    if (tournament.standings.length === 0) {
      const target = Number.parseInt(topCutSelect?.value, 10) || 2;
      resizeStandings(TOP_CUT_OPTIONS.includes(target) ? target : 2);
    } else {
      populateTopCutOptions(tournament.standings.length);
    }

    renderPlayerList();
  }

  function readMetadataFromForm() {
    const eventType = $('f-eventType')?.value || 'challenge';
    const wrapCustomEl = $('wrap-customLabel');
    if (wrapCustomEl) wrapCustomEl.hidden = eventType !== 'other';
    const dateVal = $('f-date')?.value || '';
    const count = sanitizePlayerCount($('f-playerCount')?.value);
    syncPlayerCountButtons(count);
    tournament.event = {
      eventType,
      customEventLabel: sanitizeText($('f-customLabel')?.value, { maxLength: 60 }),
      location: sanitizeText($('f-location')?.value, { maxLength: 80 }),
      date: sanitizeText(dateVal || legacyDateFallback, { maxLength: 40 }),
      regulation: sanitizeText($('f-regulation')?.value, { maxLength: 20 }),
      playerCount: count,
    };
    tournament.signature = '';
    tournament.updatedAt = new Date().toISOString();
    tournament.themeConfig = { themeId: DEFAULT_THEME_ID, overrides: {} };
  }

  function autoSizeTextarea(el) {
    if (!el || !el.style) return;
    const minPx = 46;
    const maxPx = 280;
    el.style.height = 'auto';
    const scrollH = Number(el.scrollHeight) || 0;
    if (scrollH > 0) {
      el.style.height = `${Math.max(minPx, Math.min(maxPx, scrollH + 2))}px`;
    } else {
      const lines = String(el.value || '').split('\n').length;
      el.style.height = `${Math.max(minPx, Math.min(maxPx, lines * 20 + 18))}px`;
    }
  }

  function syncPlacingsFromOrder() {
    tournament.standings.forEach((entry, i) => {
      entry.placing = String(i + 1);
    });
  }

  function getActivePokemonCatalog() {
    return filterCatalogByRegulation(pokemonCatalog, tournament.event?.regulation);
  }

  function getManualSlotsForEntry(entry) {
    let slots = manualSlotsByEntry.get(entry.id);
    if (!slots) {
      slots = Array.from({ length: MAX_POKEMON_PER_TEAM }, (_, idx) => {
        const mon = entry.pokemon?.[idx];
        return mon ? { name: mon.name || '', slug: mon.speciesSlug || '' } : { name: '', slug: '' };
      });
      manualSlotsByEntry.set(entry.id, slots);
    }
    return slots;
  }

  function syncManualSlotsFromPokemon(entry) {
    const slots = Array.from({ length: MAX_POKEMON_PER_TEAM }, (_, idx) => {
      const mon = entry.pokemon?.[idx];
      return mon ? { name: mon.name || '', slug: mon.speciesSlug || '' } : { name: '', slug: '' };
    });
    manualSlotsByEntry.set(entry.id, slots);
    return slots;
  }

  async function applyManualSlotsToEntry(entry, slots, warnEl) {
    const existingBySlug = new Map();
    for (const mon of entry.pokemon || []) {
      if (mon.speciesSlug && mon.spriteUrl) existingBySlug.set(mon.speciesSlug, mon.spriteUrl);
    }
    const nextPokemon = [];
    const warnings = [];
    for (const slot of slots) {
      const rawName = sanitizeText(slot.name, { maxLength: 60 });
      if (!rawName) continue;
      const slug = slot.slug || normalizePokemonSlug(rawName);
      if (!slug) continue;
      const mon = createPokemonSet({
        name: rawName,
        speciesSlug: slug,
        spriteUrl: existingBySlug.get(slug) || '',
      });
      nextPokemon.push(mon);
    }
    entry.pokemon = nextPokemon;
    entry.teamSource = nextPokemon.map((m) => m.name).join('\n\n');
    scheduleRender();

    await Promise.all(
      nextPokemon.map(async (mon) => {
        if (mon.spriteUrl) return;
        const { url, warning } = await api.fetchPokemonSprite(mon.speciesSlug);
        mon.spriteUrl = url ?? '';
        if (warning) warnings.push(warning);
      }),
    );
    entry.warnings = warnings;
    if (warnEl) {
      warnEl.textContent = warnings.join(' • ');
      warnEl.hidden = warnings.length === 0;
    }
    await renderNow();
  }

  function renderPlayerList() {
    if (!playersEl) return;
    playersEl.innerHTML = '';

    tournament.standings.forEach((entry, index) => {
      const li = doc.createElement('li');
      li.className = 'player';

      const head = doc.createElement('div');
      head.className = 'player-head';

      const title = doc.createElement('strong');
      title.textContent = `Player #${index + 1}`;

      const actions = doc.createElement('div');
      actions.className = 'player-actions';

      const upBtn = doc.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'small';
      upBtn.textContent = '↑';
      upBtn.title = 'Move up';
      upBtn.disabled = index === 0;
      upBtn.addEventListener('click', () => {
        const tmp = tournament.standings[index - 1];
        tournament.standings[index - 1] = entry;
        tournament.standings[index] = tmp;
        syncPlacingsFromOrder();
        renderPlayerList();
        scheduleRender();
      });

      const downBtn = doc.createElement('button');
      downBtn.type = 'button';
      downBtn.className = 'small';
      downBtn.textContent = '↓';
      downBtn.title = 'Move down';
      downBtn.disabled = index === tournament.standings.length - 1;
      downBtn.addEventListener('click', () => {
        const tmp = tournament.standings[index + 1];
        tournament.standings[index + 1] = entry;
        tournament.standings[index] = tmp;
        syncPlacingsFromOrder();
        renderPlayerList();
        scheduleRender();
      });

      actions.append(upBtn, downBtn);
      head.append(title, actions);

      const grid = doc.createElement('div');
      grid.className = 'player-grid';

      const makeInput = (labelText, value, attrs, onChange) => {
        const wrap = doc.createElement('label');
        wrap.className = 'mini-field';
        const span = doc.createElement('span');
        span.textContent = labelText;
        const inp = doc.createElement(attrs.textarea ? 'textarea' : 'input');
        if (attrs.textarea) {
          inp.rows = 2;
        } else {
          inp.type = 'text';
        }
        if (attrs.placeholder) inp.placeholder = attrs.placeholder;
        if (attrs.maxlength) inp.maxLength = attrs.maxlength;
        inp.value = value || '';
        inp.addEventListener('input', () => onChange(inp.value));
        wrap.append(span, inp);
        if (attrs.span2) wrap.classList.add('span-2');
        return { wrap, inp };
      };

      const nameField = makeInput('Player Name', entry.name, { placeholder: 'Trainer name', maxlength: 60 }, (v) => {
        entry.name = sanitizeText(v, { maxLength: 60 });
        scheduleRender();
      });
      const handleField = makeInput('Handle', entry.handle, { placeholder: '@handle', maxlength: 32 }, (v) => {
        entry.handle = v.trim() ? sanitizeHandle(v) : '';
        scheduleRender();
      });

      const warnBox = doc.createElement('div');
      warnBox.className = 'entry-warnings';
      warnBox.textContent = (entry.warnings || []).join(' • ');
      warnBox.hidden = !(entry.warnings && entry.warnings.length);

      // Team entry section with in-place toggle between URL/Paste and 6-slot Manual Entry
      const teamWrap = doc.createElement('div');
      teamWrap.className = 'mini-field span-2';

      const modeBar = doc.createElement('div');
      modeBar.className = 'team-mode-bar';
      const teamHeading = doc.createElement('span');
      teamHeading.textContent = 'Team';

      const toggleGroup = doc.createElement('div');
      toggleGroup.className = 'mode-toggle';
      toggleGroup.setAttribute('role', 'tablist');
      toggleGroup.setAttribute('aria-label', `Team entry mode for Player #${index + 1}`);

      const pasteBtn = doc.createElement('button');
      pasteBtn.type = 'button';
      pasteBtn.textContent = 'URL / Paste';
      pasteBtn.setAttribute('role', 'tab');

      const manualBtn = doc.createElement('button');
      manualBtn.type = 'button';
      manualBtn.textContent = 'Manual';
      manualBtn.setAttribute('role', 'tab');

      toggleGroup.append(pasteBtn, manualBtn);
      modeBar.append(teamHeading, toggleGroup);
      teamWrap.appendChild(modeBar);

      let currentTeamBody = null;
      let currentPasteTextarea = null;

      const buildPasteBody = () => {
        const ta = doc.createElement('textarea');
        ta.rows = 1;
        ta.placeholder = 'https://pokepast.es/... or paste Showdown text';
        ta.value = entry.teamSource || '';
        ta.setAttribute('aria-label', 'Team Source (PokéPaste URL or Showdown Paste)');
        ta.addEventListener('input', () => {
          const v = ta.value;
          entry.teamSource = v;
          autoSizeTextarea(ta);
          if (!isPokepasteUrl(v) && v.trim()) {
            const parsed = parseShowdownTeam(v);
            if (parsed.pokemon.length > 0) {
              entry.pokemon = parsed.pokemon;
              entry.warnings = parsed.warnings;
              manualSlotsByEntry.delete(entry.id);
              scheduleRender();
            }
          }
        });
        ta.addEventListener('blur', async () => {
          if (entry.teamSource && entry.teamSource.trim()) {
            await resolveEntryTeam(entry);
            manualSlotsByEntry.delete(entry.id);
            warnBox.textContent = (entry.warnings || []).join(' • ');
            warnBox.hidden = !(entry.warnings && entry.warnings.length);
            await renderNow();
          }
        });
        return ta;
      };

      const buildManualBody = () => {
        const slots = getManualSlotsForEntry(entry);
        const manualGrid = doc.createElement('div');
        manualGrid.className = 'manual-grid';

        for (let slotIdx = 0; slotIdx < MAX_POKEMON_PER_TEAM; slotIdx++) {
          const combo = doc.createElement('div');
          combo.className = 'poke-combo';

          const inp = doc.createElement('input');
          inp.type = 'text';
          inp.maxLength = 60;
          inp.value = slots[slotIdx].name || '';
          inp.placeholder = `Pokémon ${slotIdx + 1}`;
          inp.autocomplete = 'off';
          inp.spellcheck = false;
          inp.setAttribute('autocomplete', 'off');
          inp.setAttribute('autocorrect', 'off');
          inp.setAttribute('autocapitalize', 'off');
          inp.setAttribute('spellcheck', 'false');
          inp.setAttribute('data-gramm', 'false');
          inp.setAttribute('aria-label', `Player #${index + 1} Pokémon ${slotIdx + 1}`);
          inp.setAttribute('role', 'combobox');
          inp.setAttribute('aria-autocomplete', 'list');
          inp.setAttribute('aria-expanded', 'false');

          const dropdown = doc.createElement('ul');
          dropdown.className = 'poke-suggest';
          dropdown.setAttribute('role', 'listbox');
          dropdown.hidden = true;

          let currentMatches = [];
          let activeIdx = -1;
          let suppressBlur = false;

          const closeDropdown = () => {
            dropdown.hidden = true;
            dropdown.innerHTML = '';
            currentMatches = [];
            activeIdx = -1;
            inp.setAttribute('aria-expanded', 'false');
          };

          const commitSelection = (match) => {
            slots[slotIdx] = { name: match.name, slug: match.slug };
            inp.value = match.name;
            closeDropdown();
            applyManualSlotsToEntry(entry, slots, warnBox);
          };

          const renderDropdown = (query) => {
            const matches = fuzzySearchPokemon(query, getActivePokemonCatalog(), { limit: 6 });
            currentMatches = matches;
            dropdown.innerHTML = '';
            if (matches.length === 0) {
              closeDropdown();
              return;
            }
            activeIdx = 0;
            matches.forEach((m, mi) => {
              const item = doc.createElement('li');
              item.setAttribute('role', 'option');
              item.textContent = m.name;
              if (mi === activeIdx) item.classList.add('active');
              let touchStartY = null;
              item.addEventListener('touchstart', (ev) => {
                suppressBlur = true;
                touchStartY = ev.touches?.[0]?.clientY ?? null;
                setTimeout(() => { suppressBlur = false; }, 350);
              }, { passive: true });
              item.addEventListener('touchend', (ev) => {
                const endY = ev.changedTouches?.[0]?.clientY ?? touchStartY;
                const moved = touchStartY !== null && endY !== null ? Math.abs(endY - touchStartY) : 0;
                touchStartY = null;
                if (moved < 10) {
                  ev.preventDefault();
                  commitSelection(m);
                }
                suppressBlur = false;
              });
              item.addEventListener('mousedown', (ev) => {
                ev.preventDefault();
                commitSelection(m);
              });
              dropdown.appendChild(item);
            });
            dropdown.hidden = false;
            inp.setAttribute('aria-expanded', 'true');
          };

          const highlightActive = () => {
            const opts = dropdown.children || [];
            for (let i = 0; i < opts.length; i++) {
              opts[i].classList.toggle('active', i === activeIdx);
            }
          };

          inp.addEventListener('input', () => {
            const val = inp.value;
            slots[slotIdx] = { name: val, slug: '' };
            if (val.trim()) {
              renderDropdown(val);
            } else {
              closeDropdown();
              applyManualSlotsToEntry(entry, slots, warnBox);
            }
          });

          inp.addEventListener('focus', () => {
            if (inp.value.trim()) renderDropdown(inp.value);
          });

          inp.addEventListener('keydown', (ev) => {
            if (ev.key === 'ArrowDown' && currentMatches.length > 0) {
              ev.preventDefault();
              activeIdx = (activeIdx + 1) % currentMatches.length;
              highlightActive();
            } else if (ev.key === 'ArrowUp' && currentMatches.length > 0) {
              ev.preventDefault();
              activeIdx = (activeIdx - 1 + currentMatches.length) % currentMatches.length;
              highlightActive();
            } else if (ev.key === 'Enter') {
              if (!dropdown.hidden && currentMatches.length > 0) {
                ev.preventDefault();
                commitSelection(currentMatches[Math.max(0, activeIdx)]);
              }
            } else if (ev.key === 'Escape') {
              closeDropdown();
            }
          });

          inp.addEventListener('blur', () => {
            if (suppressBlur) return;
            const raw = inp.value.trim();
            if (!raw) {
              closeDropdown();
              if (slots[slotIdx].name || slots[slotIdx].slug) {
                slots[slotIdx] = { name: '', slug: '' };
                applyManualSlotsToEntry(entry, slots, warnBox);
              }
              return;
            }
            if (!slots[slotIdx].slug) {
              const matches = currentMatches.length > 0
                ? currentMatches
                : fuzzySearchPokemon(raw, getActivePokemonCatalog(), { limit: 1 });
              const top = matches[0];
              if (top) {
                commitSelection(top);
                return;
              }
              slots[slotIdx] = { name: raw, slug: normalizePokemonSlug(raw) };
              applyManualSlotsToEntry(entry, slots, warnBox);
            }
            closeDropdown();
          });

          combo.append(inp, dropdown);
          manualGrid.appendChild(combo);
        }
        return manualGrid;
      };

      const applyTeamRedactionState = () => {
        const redacted = Boolean(entry.redactTeam);
        pasteBtn.disabled = redacted;
        manualBtn.disabled = redacted;
        if (currentPasteTextarea) {
          currentPasteTextarea.disabled = redacted;
        } else if (currentTeamBody && Array.isArray(currentTeamBody.children)) {
          for (const combo of currentTeamBody.children) {
            const inp = combo?.children?.[0];
            if (inp) inp.disabled = redacted;
          }
        }
        warnBox.hidden = redacted || !(entry.warnings && entry.warnings.length);
      };

      const mountTeamMode = (nextMode) => {
        const isManual = nextMode === 'manual';
        pasteBtn.setAttribute('aria-selected', isManual ? 'false' : 'true');
        pasteBtn.classList.toggle('active', !isManual);
        manualBtn.setAttribute('aria-selected', isManual ? 'true' : 'false');
        manualBtn.classList.toggle('active', isManual);
        if (currentTeamBody && typeof teamWrap.removeChild === 'function') {
          teamWrap.removeChild(currentTeamBody);
        }
        if (isManual) {
          currentPasteTextarea = null;
          currentTeamBody = buildManualBody();
          teamWrap.appendChild(currentTeamBody);
        } else {
          currentPasteTextarea = buildPasteBody();
          currentTeamBody = currentPasteTextarea;
          teamWrap.appendChild(currentTeamBody);
          autoSizeTextarea(currentPasteTextarea);
        }
        applyTeamRedactionState();
      };

      pasteBtn.addEventListener('click', () => {
        if ((entryModes.get(entry.id) || 'paste') === 'paste') return;
        entryModes.set(entry.id, 'paste');
        mountTeamMode('paste');
      });

      manualBtn.addEventListener('click', () => {
        if (entryModes.get(entry.id) === 'manual') return;
        if ((!entry.pokemon || entry.pokemon.length === 0) && entry.teamSource && !isPokepasteUrl(entry.teamSource)) {
          const parsed = parseShowdownTeam(entry.teamSource);
          if (parsed.pokemon.length > 0) entry.pokemon = parsed.pokemon;
        }
        syncManualSlotsFromPokemon(entry);
        entryModes.set(entry.id, 'manual');
        mountTeamMode('manual');
      });

      mountTeamMode(entryModes.get(entry.id) === 'manual' ? 'manual' : 'paste');

      // Redaction toggles at the top of the player card (name -> "Trainer", team -> 6 Pokéball sprites)
      const redactBar = doc.createElement('div');
      redactBar.className = 'redact-toggles';

      const makeToggle = (labelText, checked, onToggle) => {
        const lbl = doc.createElement('label');
        lbl.className = 'redact-toggle';
        const cb = doc.createElement('input');
        cb.type = 'checkbox';
        cb.checked = Boolean(checked);
        cb.addEventListener('change', () => onToggle(cb.checked));
        const txt = doc.createElement('span');
        txt.textContent = labelText;
        lbl.append(cb, txt);
        return lbl;
      };

      const applyNameRedactionState = () => {
        const redacted = Boolean(entry.redactName);
        nameField.inp.disabled = redacted;
        handleField.inp.disabled = redacted;
      };
      applyNameRedactionState();

      const redactNameToggle = makeToggle('Redact name', entry.redactName, (checked) => {
        entry.redactName = checked;
        applyNameRedactionState();
        renderNow();
      });
      const redactTeamToggle = makeToggle('Redact team', entry.redactTeam, (checked) => {
        entry.redactTeam = checked;
        applyTeamRedactionState();
        renderNow();
      });
      redactBar.append(redactNameToggle, redactTeamToggle);

      grid.append(nameField.wrap, handleField.wrap, teamWrap);
      li.append(head, redactBar, grid, warnBox);
      playersEl.appendChild(li);
      if (currentPasteTextarea) autoSizeTextarea(currentPasteTextarea);
    });
  }

  async function resolveEntryTeam(entry) {
    if (entry.redactTeam === true) {
      entry.warnings = [];
      return;
    }
    const src = (entry.teamSource || '').trim();
    if (!src) {
      entry.pokemon = [];
      entry.warnings = [];
      return;
    }
    const { pokemon, warnings } = await api.resolveTeam(src);
    entry.pokemon = pokemon;
    entry.warnings = warnings;
  }

  async function resolveAllTeams() {
    setStatus('Fetching teams & Pokémon sprites…');
    await Promise.all(tournament.standings.map((entry) => resolveEntryTeam(entry)));
    renderPlayerList();
  }

  function renderWarningsList() {
    // Keep persistent warnings hidden under the Download button; incomplete
    // fields are surfaced in a confirmation dialog when downloading a PNG.
    if (!warningsEl) return;
    warningsEl.innerHTML = '';
    warningsEl.hidden = true;
  }

  async function renderNow() {
    if (isRendering) {
      pendingRender = true;
      return;
    }
    isRendering = true;
    try {
      const theme = resolveTheme(DEFAULT_THEME_ID);
      const [header, background, vgcIcon, localIcon] = await Promise.all([
        getCachedImage(theme.images.header),
        getCachedImage(theme.images.background),
        getCachedImage(theme.images.vgcIcon),
        getCachedImage(theme.images.localIcon),
      ]);

      const spriteUrls = new Set();
      for (const entry of tournament.standings) {
        if (entry.redactTeam === true) continue;
        for (const mon of entry.pokemon || []) {
          if (mon.spriteUrl) spriteUrls.add(mon.spriteUrl);
        }
      }
      const sprites = {};
      await Promise.all(
        [...spriteUrls].map(async (url) => {
          const img = await getCachedImage(url);
          if (img) sprites[url] = img;
        }),
      );

      const result = renderStandingsCanvas(canvas, tournament, theme, {
        header,
        background,
        vgcIcon,
        localIcon,
        sprites,
      });

      renderWarningsList();
      setStatus(`Rendered ${result.canvasWidth}×${result.canvasHeight}px (${tournament.standings.length} players).`);
    } catch (err) {
      setStatus(`Render error: ${err?.message || 'unexpected error'}`, true);
    } finally {
      isRendering = false;
      if (pendingRender) {
        pendingRender = false;
        renderNow();
      }
    }
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      renderNow();
    }, 150);
  }

  function syncDraftButtons() {
    if (deleteDraftBtn) {
      deleteDraftBtn.disabled = !(draftsSelect && draftsSelect.value);
    }
  }

  async function refreshDraftsDropdown() {
    if (!draftsSelect) return;
    const list = await store.list();
    draftsSelect.innerHTML = '';
    const empty = doc.createElement('option');
    empty.value = '';
    empty.textContent = list.length ? 'Load draft…' : 'No saved drafts';
    draftsSelect.appendChild(empty);
    let matchedId = '';
    for (const item of list) {
      const opt = doc.createElement('option');
      opt.value = item.id;
      opt.textContent = item.draftName || generateDefaultDraftName(item);
      if (item.id === tournament.id) {
        opt.selected = true;
        matchedId = item.id;
      }
      draftsSelect.appendChild(opt);
    }
    draftsSelect.value = matchedId;
    draftsSelect.disabled = list.length === 0;
    syncDraftButtons();
  }

  // Wire metadata form events
  const metaIds = ['f-eventType', 'f-customLabel', 'f-location', 'f-date', 'f-regulation'];
  for (const id of metaIds) {
    const el = $(id);
    if (!el) continue;
    const handler = () => {
      if (id === 'f-date') legacyDateFallback = '';
      syncAriaField(el);
      readMetadataFromForm();
      scheduleRender();
    };
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
    el.addEventListener('blur', () => syncAriaField(el));
  }

  // Player count numeric-only text entry + left/right stepper buttons
  const playerCountEl = $('f-playerCount');
  const setPlayerCount = (next) => {
    const clamped = Math.max(0, Math.min(MAX_PLAYER_COUNT, Math.floor(Number(next) || 0)));
    if (playerCountEl) playerCountEl.value = String(clamped);
    syncPlayerCountButtons(clamped);
    readMetadataFromForm();
    scheduleRender();
  };
  if (playerCountEl) {
    playerCountEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setPlayerCount(sanitizePlayerCount(playerCountEl.value) + 1);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setPlayerCount(sanitizePlayerCount(playerCountEl.value) - 1);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length === 1 && !/^\d$/.test(e.key)) {
        e.preventDefault();
      }
    });
    playerCountEl.addEventListener('input', () => {
      const digitsOnly = playerCountEl.value.replace(/\D+/g, '');
      let nextVal = digitsOnly;
      if (digitsOnly !== '' && Number(digitsOnly) > MAX_PLAYER_COUNT) {
        nextVal = String(MAX_PLAYER_COUNT);
      }
      if (playerCountEl.value !== nextVal) playerCountEl.value = nextVal;
      syncAriaField(playerCountEl);
      readMetadataFromForm();
      scheduleRender();
    });
    playerCountEl.addEventListener('blur', () => {
      const clamped = sanitizePlayerCount(playerCountEl.value);
      playerCountEl.value = String(clamped);
      syncPlayerCountButtons(clamped);
      syncAriaField(playerCountEl);
      readMetadataFromForm();
    });
  }
  $('btn-playerCount-dec')?.addEventListener('click', () => {
    setPlayerCount(sanitizePlayerCount(playerCountEl?.value) - 1);
  });
  $('btn-playerCount-inc')?.addEventListener('click', () => {
    setPlayerCount(sanitizePlayerCount(playerCountEl?.value) + 1);
  });

  // Toolbar actions
  presetsSelect?.addEventListener('change', async () => {
    const presetId = presetsSelect.value;
    if (!presetId) return;
    const preset = EVENT_PRESETS.find((p) => p.id === presetId);
    standingsStash = [];
    manualSlotsByEntry.clear();
    tournament = createPresetTournament(presetId);
    syncFormFromState();
    renderNow();
    await resolveAllTeams();
    await renderNow();
    announce(`Loaded preset: ${preset?.label || presetId}.`);
  });

  topCutSelect?.addEventListener('change', () => {
    const selected = Number.parseInt(topCutSelect.value, 10);
    if (!Number.isFinite(selected) || selected <= 0) return;
    resizeStandings(selected);
    renderPlayerList();
    scheduleRender();
    announce(`Top Cut set to ${selected} players.`);
  });

  $('btn-render')?.addEventListener('click', async () => {
    readMetadataFromForm();
    await resolveAllTeams();
    await renderNow();
  });

  const performPngDownload = () => {
    const filename = safeDownloadFilename(tournament, 'png');
    try {
      if (typeof canvas?.toBlob === 'function') {
        canvas.toBlob((blob) => {
          if (!blob) {
            setStatus('Could not export PNG (canvas may be tainted by a cross-origin image without CORS).', true);
            return;
          }
          triggerDownload(blob, filename);
          setStatus('PNG downloaded.');
        }, 'image/png');
      } else if (typeof canvas?.toDataURL === 'function') {
        const dataUrl = canvas.toDataURL('image/png');
        const a = doc.createElement('a');
        a.href = dataUrl;
        a.download = filename;
        doc.body.appendChild(a);
        a.click();
        a.remove();
        setStatus('PNG downloaded.');
      }
    } catch {
      setStatus('PNG export blocked by browser CORS policy. Try reloading or using local images.', true);
    }
  };

  // Consolidated dialogs (Upload, Export, Save Draft, Clear Fields, Incomplete Download Warning)
  const openDialog = (dlg) => {
    if (!dlg) return;
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.open = true;
  };
  const closeDialog = (dlg) => {
    if (!dlg) return;
    if (typeof dlg.close === 'function') dlg.close();
    else dlg.open = false;
  };

  const uploadDialog = $('dialog-upload');
  const exportDialog = $('dialog-export');
  const saveDraftDialog = $('dialog-save-draft');
  const clearDialog = $('dialog-clear');
  const downloadWarnDialog = $('dialog-download-warn');
  const downloadWarnList = $('download-warn-list');
  const draftNameInput = $('f-draftName');
  for (const dlg of [uploadDialog, exportDialog, saveDraftDialog, clearDialog, downloadWarnDialog]) {
    dlg?.addEventListener('click', (e) => {
      if (e.target === dlg) closeDialog(dlg);
    });
  }

  $('btn-download')?.addEventListener('click', () => {
    readMetadataFromForm();
    const missing = collectMissingDownloadFields(tournament);
    if (missing.length > 0 && downloadWarnDialog) {
      if (downloadWarnList) {
        downloadWarnList.innerHTML = '';
        for (const msg of missing) {
          const li = doc.createElement('li');
          li.textContent = msg;
          downloadWarnList.appendChild(li);
        }
      }
      openDialog(downloadWarnDialog);
      return;
    }
    performPngDownload();
  });

  $('btn-download-warn-cancel')?.addEventListener('click', () => closeDialog(downloadWarnDialog));
  $('btn-download-warn-confirm')?.addEventListener('click', () => {
    closeDialog(downloadWarnDialog);
    performPngDownload();
  });

  $('btn-upload')?.addEventListener('click', () => openDialog(uploadDialog));
  $('btn-upload-cancel')?.addEventListener('click', () => closeDialog(uploadDialog));
  $('file-upload')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const name = String(file.name || '').toLowerCase();
      const isJsonExt = name.endsWith('.json') || file.type === 'application/json';
      const isCsvExt = name.endsWith('.csv') || file.type === 'text/csv';
      if (!isJsonExt && !isCsvExt) {
        setStatus('Please select a .csv or .json file.', true);
        return;
      }
      const text = await readFileAsText(file);
      standingsStash = [];
      manualSlotsByEntry.clear();
      if (isJsonExt || (!isCsvExt && text.trim().startsWith('{'))) {
        tournament = deserializeTournament(text);
        syncFormFromState();
        closeDialog(uploadDialog);
        await renderNow();
        announce('Imported tournament JSON.');
      } else {
        const { tournament: parsed, warnings } = parseStandingsCsv(text);
        tournament = parsed;
        syncFormFromState();
        closeDialog(uploadDialog);
        await resolveAllTeams();
        await renderNow();
        if (warnings.length) renderWarningsList(warnings);
        announce(`Imported CSV with ${tournament.standings.length} players.`);
      }
    } catch (err) {
      setStatus(`Upload failed: ${err?.message || 'invalid file'}`, true);
    } finally {
      e.target.value = '';
    }
  });

  $('btn-export')?.addEventListener('click', () => openDialog(exportDialog));
  $('btn-export-cancel')?.addEventListener('click', () => closeDialog(exportDialog));

  $('btn-export-csv')?.addEventListener('click', () => {
    readMetadataFromForm();
    const csv = exportStandingsCsv(tournament);
    triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), safeDownloadFilename(tournament, 'csv'));
    closeDialog(exportDialog);
    setStatus('CSV exported.');
  });

  $('btn-export-json')?.addEventListener('click', () => {
    readMetadataFromForm();
    const json = JSON.stringify(JSON.parse(serializeTournament(tournament)), null, 2);
    triggerDownload(new Blob([json], { type: 'application/json;charset=utf-8' }), safeDownloadFilename(tournament, 'json'));
    closeDialog(exportDialog);
    setStatus('JSON exported.');
  });

  // Drafts (LocalStorageTournamentStore)
  let saveFlashTimer = null;
  const commitSaveDraft = async () => {
    readMetadataFromForm();
    const enteredName = sanitizeText(draftNameInput?.value, { maxLength: 80 });
    tournament.draftName = enteredName || generateDefaultDraftName(tournament);
    const saved = await store.save(tournament);
    closeDialog(saveDraftDialog);
    if (!saved) {
      setStatus('Could not save draft (browser storage unavailable or full).', true);
      return;
    }
    tournament = saved;
    await refreshDraftsDropdown();
    setStatus(`Saved draft "${tournament.draftName}".`);
    if (saveDraftBtn) {
      clearTimeout(saveFlashTimer);
      saveDraftBtn.textContent = 'Saved ✓';
      saveFlashTimer = setTimeout(() => { saveDraftBtn.textContent = 'Save Draft'; }, 1500);
    }
  };

  saveDraftBtn?.addEventListener('click', () => {
    readMetadataFromForm();
    const suggested = tournament.draftName || generateDefaultDraftName(tournament);
    if (draftNameInput) {
      draftNameInput.value = suggested;
    }
    openDialog(saveDraftDialog);
    const selectDraftName = () => {
      if (!draftNameInput) return;
      try {
        draftNameInput.focus?.();
        draftNameInput.select?.();
        if (typeof draftNameInput.setSelectionRange === 'function') {
          draftNameInput.setSelectionRange(0, draftNameInput.value.length);
        }
      } catch {
        /* ignore */
      }
    };
    selectDraftName();
    setTimeout(selectDraftName, 0);
  });

  $('btn-save-draft-cancel')?.addEventListener('click', () => closeDialog(saveDraftDialog));
  $('btn-save-draft-confirm')?.addEventListener('click', () => commitSaveDraft());
  draftNameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitSaveDraft();
    }
  });

  $('btn-draft-new')?.addEventListener('click', () => openDialog(clearDialog));
  $('btn-clear-cancel')?.addEventListener('click', () => closeDialog(clearDialog));
  $('btn-clear-confirm')?.addEventListener('click', async () => {
    standingsStash = [];
    manualSlotsByEntry.clear();
    entryModes.clear();
    tournament = createDefaultTournament();
    syncFormFromState();
    await refreshDraftsDropdown();
    closeDialog(clearDialog);
    await renderNow();
    setStatus('Fields cleared.');
    announce('All fields reset to defaults.');
  });

  deleteDraftBtn?.addEventListener('click', async () => {
    const id = draftsSelect?.value;
    if (!id) return;
    await store.delete(id);
    await refreshDraftsDropdown();
    setStatus('Saved draft deleted.');
  });

  draftsSelect?.addEventListener('change', async () => {
    const id = draftsSelect.value;
    syncDraftButtons();
    if (!id) return;
    const loaded = await store.get(id);
    if (loaded) {
      standingsStash = [];
      manualSlotsByEntry.clear();
      entryModes.clear();
      tournament = loaded;
      syncFormFromState();
      await renderNow();
      setStatus('Draft loaded.');
    }
  });

  // Initial boot
  populatePresetOptions(DEFAULT_PRESET_ID);
  populateRegulationOptions();
  syncFormFromState();
  refreshDraftsDropdown();
  renderNow();
  resolveAllTeams().then(() => renderNow());

  return { renderNow, resolveAllTeams, getTournament: () => tournament };
}

if (typeof document !== 'undefined') {
  let booted = false;
  const boot = () => {
    if (booted) return;
    if (!document.getElementById('standings-canvas') || !document.getElementById('players')) return;
    booted = true;
    try {
      initApp(document);
    } catch (err) {
      const st = document.getElementById('status');
      if (st) st.textContent = `Startup error: ${err?.message || 'unexpected error'}`;
    }
  };
  // gistpreview.github.io uses document.write() without document.close(),
  // leaving readyState === 'loading' forever even though the script sits at
  // the end of <body> and the DOM is already parsed.
  boot();
  if (!booted) {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('load', boot, { once: true });
    }
    setTimeout(boot, 50);
  }
  // Close gistpreview's open document.write() stream on next tick so Safari
  // stops spinning and completes document lifecycle cleanly.
  setTimeout(() => {
    try {
      if (typeof location !== 'undefined' && location.hostname === 'gistpreview.github.io' && document.readyState === 'loading') {
        document.close();
      }
    } catch {
      /* ignore */
    }
  }, 0);
}
