import {
  DEFAULT_SIGNATURE,
  DEFAULT_THEME_ID,
  createEmptyTournament,
  createStandingEntry,
  serializeTournament,
  deserializeTournament,
  computeTournamentSummary,
} from './core/schema.js';
import {
  sanitizeText,
  sanitizeHandle,
  sanitizePlacing,
  sanitizePlayerCount,
  normalizeHexColor,
  validateImageFileMeta,
  validateTournament,
} from './core/validation.js';
import { isPokepasteUrl, parseShowdownTeam } from './core/pokepaste.js';
import { parseStandingsCsv, exportStandingsCsv } from './core/csv-parser.js';
import { LocalStorageTournamentStore } from './adapters/storage.js';
import { PokeApiClient } from './adapters/api.js';
import { BUILTIN_THEMES, resolveTheme } from './adapters/themes.js';
import { loadImage, renderStandingsCanvas } from './renderer/canvas-renderer.js';

const SAMPLE_CSV = `location,date,challenge,cup,regulation,player count
Wyndon Stadium,July 8th,,x,M-8,8
,,,,,
placing,name,handle,local,paste,
1,Ash Ketchum,@pikafan25,Wyndon-Cup-7-8-2022,https://pokepast.es/33bbc4f4633968dc,
2,Leon,,Wyndon-Cup-7-8-2022,https://pokepast.es/380a942db3548064,
3,Cynthia,,Wyndon-Cup-7-8-2022,https://pokepast.es/0b04ab36eb7d7b89,
4,Diantha,@mskalos,Wyndon-Cup-7-8-2022,https://pokepast.es/77ac36ad28fa6ea6,`;

const UPLOAD_SLOTS = [
  { key: 'header', label: 'Header Image' },
  { key: 'background', label: 'Background Image' },
  { key: 'vgcIcon', label: 'Left Icon (VGC)' },
  { key: 'localIcon', label: 'Right Icon (Local)' },
];

function createSampleTournament() {
  const { tournament } = parseStandingsCsv(SAMPLE_CSV);
  tournament.themeConfig = { themeId: DEFAULT_THEME_ID, overrides: {} };
  tournament.signature = DEFAULT_SIGNATURE;
  return tournament;
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
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function decodeUploadedImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const img = new Image();
      img.onload = () => {
        const check = validateImageFileMeta({
          name: file.name,
          type: file.type,
          size: file.size,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
        if (!check.valid) {
          reject(new Error(check.errors.join(' ')));
          return;
        }
        resolve({ img, dataUrl });
      };
      img.onerror = () => reject(new Error('File could not be decoded as a valid image.'));
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
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
  const analyticsBody = $('analytics-body');
  const playersEl = $('players');
  const playersEmptyEl = $('players-empty');
  const draftsSelect = $('drafts-select');
  const themeSelect = $('f-theme');
  const uploadListEl = $('upload-list');

  let tournament = createSampleTournament();
  const customUploads = { header: null, background: null, vgcIcon: null, localIcon: null };
  const imageCache = new Map();
  let renderTimer = null;
  let isRendering = false;
  let pendingRender = false;

  function announce(msg) {
    if (!announcer) return;
    announcer.textContent = '';
    setTimeout(() => { announcer.textContent = msg; }, 50);
  }

  function setStatus(msg, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.classList.toggle('is-error', isError);
  }

  function syncAriaField(el) {
    if (!el || !el.matches?.('input, select, textarea')) return;
    const invalid = typeof el.matches === 'function' && el.matches(':user-invalid');
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

  function populateThemeOptions() {
    if (!themeSelect) return;
    themeSelect.innerHTML = '';
    for (const theme of BUILTIN_THEMES) {
      const opt = doc.createElement('option');
      opt.value = theme.id;
      opt.textContent = theme.name;
      themeSelect.appendChild(opt);
    }
  }

  function buildUploadControls() {
    if (!uploadListEl) return;
    uploadListEl.innerHTML = '';
    for (const slot of UPLOAD_SLOTS) {
      const row = doc.createElement('div');
      row.className = 'upload-row';

      const label = doc.createElement('label');
      label.setAttribute('for', `upload-${slot.key}`);
      label.textContent = slot.label;

      const input = doc.createElement('input');
      input.type = 'file';
      input.id = `upload-${slot.key}`;
      input.accept = 'image/png,image/jpeg,image/webp,image/gif';

      const clearBtn = doc.createElement('button');
      clearBtn.type = 'button';
      clearBtn.textContent = 'Clear';
      clearBtn.className = 'small';

      const msg = doc.createElement('span');
      msg.className = 'upload-status muted';

      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        const metaCheck = validateImageFileMeta({ name: file.name, type: file.type, size: file.size });
        if (!metaCheck.valid) {
          msg.textContent = metaCheck.errors.join(' ');
          msg.className = 'upload-status error-inline';
          input.value = '';
          return;
        }
        try {
          const decoded = await decodeUploadedImage(file);
          customUploads[slot.key] = decoded.img;
          msg.textContent = `${file.name} (${decoded.img.naturalWidth}×${decoded.img.naturalHeight})`;
          msg.className = 'upload-status muted';
          scheduleRender();
        } catch (err) {
          msg.textContent = err?.message || 'Invalid image file.';
          msg.className = 'upload-status error-inline';
          input.value = '';
        }
      });

      clearBtn.addEventListener('click', () => {
        customUploads[slot.key] = null;
        input.value = '';
        msg.textContent = '';
        scheduleRender();
      });

      row.append(label, input, clearBtn, msg);
      uploadListEl.appendChild(row);
    }
  }

  function syncFormFromState() {
    const ev = tournament.event;
    $('f-eventType').value = ev.eventType || 'local';
    $('f-customLabel').value = ev.customEventLabel || '';
    $('wrap-customLabel').hidden = ev.eventType !== 'custom';
    $('f-location').value = ev.location || '';
    $('f-date').value = ev.date || '';
    $('f-regulation').value = ev.regulation || '';
    $('f-playerCount').value = ev.playerCount ? String(ev.playerCount) : '';
    $('f-signature').value = tournament.signature ?? '';

    const themeId = tournament.themeConfig?.themeId || DEFAULT_THEME_ID;
    themeSelect.value = BUILTIN_THEMES.some((t) => t.id === themeId) ? themeId : DEFAULT_THEME_ID;
    const ov = tournament.themeConfig?.overrides || {};
    const hasCustom = Boolean(ov.headerStart || ov.accent);
    $('f-customColors').checked = hasCustom;
    const resolved = resolveTheme(themeSelect.value, ov);
    $('f-color1').value = resolved.colors.headerStart;
    $('f-color2').value = resolved.colors.accent;
    $('f-color1').disabled = !hasCustom;
    $('f-color2').disabled = !hasCustom;

    renderPlayerList();
    renderAnalytics();
  }

  function readMetadataFromForm() {
    const eventType = $('f-eventType').value;
    $('wrap-customLabel').hidden = eventType !== 'custom';
    tournament.event = {
      eventType,
      customEventLabel: sanitizeText($('f-customLabel').value, { maxLength: 60 }),
      location: sanitizeText($('f-location').value, { maxLength: 80 }),
      date: sanitizeText($('f-date').value, { maxLength: 40 }),
      regulation: sanitizeText($('f-regulation').value, { maxLength: 20 }),
      playerCount: sanitizePlayerCount($('f-playerCount').value),
    };
    tournament.signature = sanitizeText($('f-signature').value, { maxLength: 80 });
    tournament.updatedAt = new Date().toISOString();

    const useCustom = $('f-customColors').checked;
    $('f-color1').disabled = !useCustom;
    $('f-color2').disabled = !useCustom;
    const overrides = useCustom
      ? {
          headerStart: normalizeHexColor($('f-color1').value, '#101A2E'),
          accent: normalizeHexColor($('f-color2').value, '#D8B45A'),
          bannerBorder: normalizeHexColor($('f-color2').value, '#D8B45A'),
          signatureBorder: normalizeHexColor($('f-color2').value, '#D8B45A'),
        }
      : {};
    tournament.themeConfig = { themeId: themeSelect.value, overrides };
  }

  function renderPlayerList() {
    if (!playersEl) return;
    playersEl.innerHTML = '';
    if (playersEmptyEl) playersEmptyEl.hidden = tournament.standings.length > 0;

    tournament.standings.forEach((entry, index) => {
      const li = doc.createElement('li');
      li.className = 'player-card';

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
        renderPlayerList();
        scheduleRender();
      });

      const dupBtn = doc.createElement('button');
      dupBtn.type = 'button';
      dupBtn.className = 'small';
      dupBtn.textContent = 'Duplicate';
      dupBtn.addEventListener('click', () => {
        const copy = createStandingEntry({ ...entry, id: undefined });
        tournament.standings.splice(index + 1, 0, copy);
        renderPlayerList();
        scheduleRender();
      });

      const delBtn = doc.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'small danger';
      delBtn.textContent = 'Remove';
      delBtn.addEventListener('click', () => {
        tournament.standings.splice(index, 1);
        renderPlayerList();
        renderAnalytics();
        scheduleRender();
      });

      actions.append(upBtn, downBtn, dupBtn, delBtn);
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

      const placingField = makeInput('Placing', entry.placing, { placeholder: '1, T4…', maxlength: 12 }, (v) => {
        entry.placing = sanitizePlacing(v);
        scheduleRender();
      });
      const nameField = makeInput('Player Name', entry.name, { placeholder: 'Trainer name', maxlength: 60 }, (v) => {
        entry.name = sanitizeText(v, { maxLength: 60 });
        scheduleRender();
      });
      const handleField = makeInput('Handle', entry.handle, { placeholder: '@handle', maxlength: 32 }, (v) => {
        entry.handle = v.trim() ? sanitizeHandle(v) : '';
        scheduleRender();
      });
      const localField = makeInput('Local / Notes', entry.local, { placeholder: 'Optional tag', maxlength: 80 }, (v) => {
        entry.local = sanitizeText(v, { maxLength: 80 });
      });
      const teamField = makeInput(
        'Team Source (PokéPaste URL or Showdown Paste)',
        entry.teamSource,
        { textarea: true, span2: true, placeholder: 'https://pokepast.es/... or paste Showdown text' },
        (v) => {
          entry.teamSource = v;
          if (!isPokepasteUrl(v) && v.trim()) {
            const parsed = parseShowdownTeam(v);
            if (parsed.pokemon.length > 0) {
              entry.pokemon = parsed.pokemon;
              entry.warnings = parsed.warnings;
              renderAnalytics();
              scheduleRender();
            }
          }
        },
      );
      teamField.inp.addEventListener('blur', async () => {
        if (entry.teamSource && entry.teamSource.trim()) {
          await resolveEntryTeam(entry);
          renderPlayerList();
          renderAnalytics();
          await renderNow();
        }
      });

      grid.append(placingField.wrap, nameField.wrap, handleField.wrap, localField.wrap, teamField.wrap);

      const chips = doc.createElement('div');
      chips.className = 'pokemon-chips';
      for (const mon of entry.pokemon || []) {
        const chip = doc.createElement('span');
        chip.className = 'chip';
        chip.textContent = mon.name || mon.speciesSlug || '?';
        chips.appendChild(chip);
      }

      li.append(head, grid, chips);

      if (entry.warnings?.length) {
        const warnBox = doc.createElement('div');
        warnBox.className = 'entry-warnings';
        warnBox.textContent = entry.warnings.join(' • ');
        li.appendChild(warnBox);
      }

      playersEl.appendChild(li);
    });
  }

  async function resolveEntryTeam(entry) {
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
    renderAnalytics();
  }

  function renderAnalytics() {
    if (!analyticsBody) return;
    const summary = computeTournamentSummary(tournament);
    const fmt = (obj) => {
      const entries = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 12);
      if (entries.length === 0) return 'None yet';
      return entries.map(([k, v]) => `${k} (${v})`).join(', ');
    };
    analyticsBody.innerHTML = '';
    const rows = [
      ['Teams Parsed', `${summary.teams} (${summary.totalPokemon} Pokémon)`],
      ['Top Pokémon', fmt(summary.pokemon)],
      ['Top Items', fmt(summary.items)],
      ['Top Abilities', fmt(summary.abilities)],
      ['Top Tera Types', fmt(summary.teraTypes)],
    ];
    for (const [label, val] of rows) {
      const p = doc.createElement('p');
      const b = doc.createElement('strong');
      b.textContent = `${label}: `;
      p.append(b, doc.createTextNode(val));
      analyticsBody.appendChild(p);
    }
  }

  function renderWarningsList(extraWarnings = []) {
    if (!warningsEl) return;
    const validation = validateTournament(tournament);
    const all = [...validation.errors, ...validation.warnings, ...extraWarnings];
    for (const entry of tournament.standings) {
      for (const w of entry.warnings || []) {
        all.push(`${entry.name || `Placing ${entry.placing || '?'}`}: ${w}`);
      }
    }
    warningsEl.innerHTML = '';
    for (const msg of [...new Set(all)].slice(0, 20)) {
      const li = doc.createElement('li');
      li.textContent = msg;
      warningsEl.appendChild(li);
    }
  }

  async function renderNow() {
    if (isRendering) {
      pendingRender = true;
      return;
    }
    isRendering = true;
    try {
      const theme = resolveTheme(tournament.themeConfig?.themeId, tournament.themeConfig?.overrides);
      const [header, background, vgcIcon, localIcon] = await Promise.all([
        customUploads.header ? Promise.resolve(customUploads.header) : getCachedImage(theme.images.header),
        customUploads.background ? Promise.resolve(customUploads.background) : getCachedImage(theme.images.background),
        customUploads.vgcIcon ? Promise.resolve(customUploads.vgcIcon) : getCachedImage(theme.images.vgcIcon),
        customUploads.localIcon ? Promise.resolve(customUploads.localIcon) : getCachedImage(theme.images.localIcon),
      ]);

      const spriteUrls = new Set();
      for (const entry of tournament.standings) {
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

  async function refreshDraftsDropdown() {
    if (!draftsSelect) return;
    const list = await store.list();
    draftsSelect.innerHTML = '';
    const empty = doc.createElement('option');
    empty.value = '';
    empty.textContent = list.length ? '— select saved draft —' : '— none —';
    draftsSelect.appendChild(empty);
    for (const item of list) {
      const opt = doc.createElement('option');
      opt.value = item.id;
      const loc = item.event?.location || 'Untitled';
      const date = item.event?.date ? ` (${item.event.date})` : '';
      opt.textContent = `${loc}${date}`;
      if (item.id === tournament.id) opt.selected = true;
      draftsSelect.appendChild(opt);
    }
  }

  // Wire metadata & theme form events
  const metaIds = ['f-eventType', 'f-customLabel', 'f-location', 'f-date', 'f-regulation', 'f-playerCount', 'f-signature', 'f-theme', 'f-customColors', 'f-color1', 'f-color2'];
  for (const id of metaIds) {
    const el = $(id);
    if (!el) continue;
    const handler = () => {
      syncAriaField(el);
      readMetadataFromForm();
      scheduleRender();
    };
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
    el.addEventListener('blur', () => syncAriaField(el));
  }

  // Toolbar actions
  $('btn-sample')?.addEventListener('click', async () => {
    tournament = createSampleTournament();
    syncFormFromState();
    await resolveAllTeams();
    await renderNow();
    announce('Loaded Masters Eight sample tournament.');
  });

  $('btn-add-player')?.addEventListener('click', () => {
    const nextPlacing = String(tournament.standings.length + 1);
    tournament.standings.push(createStandingEntry({ placing: nextPlacing }));
    renderPlayerList();
    renderAnalytics();
    scheduleRender();
  });

  $('btn-render')?.addEventListener('click', async () => {
    readMetadataFromForm();
    await resolveAllTeams();
    await renderNow();
  });

  $('btn-download')?.addEventListener('click', () => {
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          setStatus('Could not export PNG (canvas may be tainted by a cross-origin image without CORS).', true);
          return;
        }
        triggerDownload(blob, safeDownloadFilename(tournament, 'png'));
        setStatus('PNG downloaded.');
      }, 'image/png');
    } catch {
      setStatus('PNG export blocked by browser CORS policy. Try a procedural theme or upload images locally.', true);
    }
  });

  // CSV Import / Export
  $('btn-import-csv')?.addEventListener('click', () => $('file-csv')?.click());
  $('file-csv')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const { tournament: parsed, warnings } = parseStandingsCsv(text);
      tournament = parsed;
      syncFormFromState();
      await resolveAllTeams();
      await renderNow();
      if (warnings.length) renderWarningsList(warnings);
      announce(`Imported CSV with ${tournament.standings.length} players.`);
    } catch (err) {
      setStatus(`CSV import failed: ${err?.message || 'invalid file'}`, true);
    } finally {
      e.target.value = '';
    }
  });

  $('btn-export-csv')?.addEventListener('click', () => {
    readMetadataFromForm();
    const csv = exportStandingsCsv(tournament);
    triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), safeDownloadFilename(tournament, 'csv'));
    setStatus('CSV exported.');
  });

  // JSON Import / Export (analytics-ready schema)
  $('btn-import-json')?.addEventListener('click', () => $('file-json')?.click());
  $('file-json')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      tournament = deserializeTournament(text);
      syncFormFromState();
      await renderNow();
      announce('Imported tournament JSON.');
    } catch (err) {
      setStatus(`JSON import failed: ${err?.message || 'invalid JSON'}`, true);
    } finally {
      e.target.value = '';
    }
  });

  $('btn-export-json')?.addEventListener('click', () => {
    readMetadataFromForm();
    const json = JSON.stringify(JSON.parse(serializeTournament(tournament)), null, 2);
    triggerDownload(new Blob([json], { type: 'application/json;charset=utf-8' }), safeDownloadFilename(tournament, 'json'));
    setStatus('Analytics-ready JSON exported.');
  });

  // Drafts (LocalStorageTournamentStore)
  $('btn-draft-save')?.addEventListener('click', async () => {
    readMetadataFromForm();
    const saved = await store.save(tournament);
    if (!saved) {
      setStatus('Could not save draft (localStorage unavailable or full).', true);
      return;
    }
    tournament = saved;
    await refreshDraftsDropdown();
    setStatus('Draft saved locally.');
  });

  $('btn-draft-new')?.addEventListener('click', async () => {
    tournament = createEmptyTournament();
    syncFormFromState();
    await renderNow();
    setStatus('Started a new blank tournament.');
  });

  $('btn-draft-delete')?.addEventListener('click', async () => {
    const id = draftsSelect?.value;
    if (!id) return;
    await store.delete(id);
    await refreshDraftsDropdown();
    setStatus('Draft deleted.');
  });

  draftsSelect?.addEventListener('change', async () => {
    const id = draftsSelect.value;
    if (!id) return;
    const loaded = await store.get(id);
    if (loaded) {
      tournament = loaded;
      syncFormFromState();
      await renderNow();
      setStatus('Draft loaded.');
    }
  });

  // Initial boot
  populateThemeOptions();
  buildUploadControls();
  syncFormFromState();
  refreshDraftsDropdown();
  resolveAllTeams().then(() => renderNow());

  return { renderNow, resolveAllTeams, getTournament: () => tournament };
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initApp(document));
  } else {
    initApp(document);
  }
}
