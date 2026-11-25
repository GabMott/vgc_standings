import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { EVENT_TYPES, REGULATION_OPTIONS, TOP_CUT_OPTIONS } from '../src/core/validation.js';
import { EVENT_PRESETS, DEFAULT_PRESET_ID } from '../src/adapters/presets.js';
import { parseShowdownTeam } from '../src/core/pokepaste.js';
import { isPokepasteUrl } from '../src/core/pokepaste.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function createMockElement(tag, id = '') {
  const listeners = new Map();
  const children = [];
  const classSet = new Set();
  const attrs = new Map();
  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    id,
    value: '',
    checked: false,
    disabled: false,
    hidden: false,
    textContent: '',
    width: 1500,
    height: 1500,
    style: {},
    children,
    classList: {
      add: (...c) => c.forEach((x) => classSet.add(x)),
      remove: (...c) => c.forEach((x) => classSet.delete(x)),
      toggle: (c, force) => {
        if (force === undefined) classSet.has(c) ? classSet.delete(c) : classSet.add(c);
        else if (force) classSet.add(c);
        else classSet.delete(c);
      },
      contains: (c) => classSet.has(c),
    },
    get className() {
      return [...classSet].join(' ');
    },
    set className(v) {
      classSet.clear();
      String(v || '').split(/\s+/).filter(Boolean).forEach((x) => classSet.add(x));
    },
    get innerHTML() {
      return '';
    },
    set innerHTML(_v) {
      children.length = 0;
    },
    setAttribute(k, v) {
      attrs.set(k, String(v));
    },
    getAttribute(k) {
      return attrs.get(k) ?? null;
    },
    appendChild(child) {
      children.push(child);
      return child;
    },
    removeChild(child) {
      const idx = children.indexOf(child);
      if (idx !== -1) children.splice(idx, 1);
      return child;
    },
    append(...nodes) {
      for (const n of nodes) children.push(n);
    },
    remove() {},
    matches() {
      return false;
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    dispatch(type, event = {}) {
      let defaultPrevented = false;
      const ev = {
        type,
        target: el,
        preventDefault() { defaultPrevented = true; },
        get defaultPrevented() { return defaultPrevented; },
        ...event,
      };
      for (const fn of listeners.get(type) || []) fn(ev);
      return ev;
    },
    getContext() {
      return {
        canvas: el,
        save() {},
        restore() {},
        beginPath() {},
        closePath() {},
        moveTo() {},
        lineTo() {},
        arc() {},
        arcTo() {},
        rect() {},
        clip() {},
        fill() {},
        stroke() {},
        fillRect() {},
        strokeRect() {},
        clearRect() {},
        fillText() {},
        strokeText() {},
        drawImage() {},
        translate() {},
        rotate() {},
        measureText: (t) => ({ width: String(t).length * 8 }),
        createLinearGradient: () => ({ addColorStop() {} }),
      };
    },
  };
  return el;
}

function createMockDocument({ readyState = 'loading', includePresets = false } = {}) {
  const byId = new Map();
  const ids = [
    'announcer', 'btn-upload', 'btn-export',
    'dialog-upload', 'file-upload', 'btn-upload-cancel',
    'dialog-export', 'btn-export-csv', 'btn-export-json', 'btn-export-cancel',
    'dialog-save-draft', 'f-draftName', 'btn-save-draft-cancel', 'btn-save-draft-confirm',
    'dialog-clear', 'btn-clear-cancel', 'btn-clear-confirm',
    'dialog-download-warn', 'download-warn-list', 'btn-download-warn-cancel', 'btn-download-warn-confirm',
    'drafts-select', 'btn-draft-save', 'btn-draft-new', 'btn-draft-delete',
    'f-eventType', 'wrap-customLabel', 'f-customLabel', 'f-location', 'f-date', 'f-regulation',
    'f-playerCount', 'btn-playerCount-dec', 'btn-playerCount-inc',
    'f-topCut', 'players',
    'standings-canvas', 'btn-render', 'btn-download', 'status', 'warnings',
  ];
  if (includePresets) ids.push('presets-select');
  for (const id of ids) {
    const el = createMockElement(id === 'standings-canvas' ? 'canvas' : 'div', id);
    if (id === 'f-draftName') {
      el.selectedRange = null;
      el.focus = () => { el.focused = true; };
      el.select = () => { el.selected = true; };
      el.setSelectionRange = (s, e) => { el.selectedRange = [s, e]; };
    }
    byId.set(id, el);
  }
  const docListeners = new Map();
  return {
    readyState,
    byId,
    getElementById: (id) => byId.get(id) ?? null,
    createElement: (tag) => createMockElement(tag),
    createTextNode: (text) => ({ nodeType: 3, textContent: String(text) }),
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    },
    body: createMockElement('body'),
  };
}

describe('Gist single-file bundle & UI controls', () => {
  test('HTML uses Details heading, hidden presets, clear draft labels, and Chrome/Safari-safe inputs', () => {
    const html = fs.readFileSync(path.join(ROOT, 'web/index.html'), 'utf8');
    const activeHtml = html.replace(/<!--[\s\S]*?-->/g, '');
    assert.match(activeHtml, /<h2 id="h-meta">Details<\/h2>/);
    const eventSelectHtml = activeHtml.match(/<select id="f-eventType"[\s\S]*?<\/select>/)?.[0] || '';
    const eventOptValues = [...eventSelectHtml.matchAll(/<option\s+value="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(eventOptValues, ['cup', 'challenge', 'other']);
    assert.deepEqual([...EVENT_TYPES], ['cup', 'challenge', 'other']);
    assert.match(activeHtml, /<input\s+id="f-date"\s+type="date"/);
    assert.match(activeHtml, /<select\s+id="f-regulation"/);
    for (const reg of ['M-A', 'M-B', 'M-C', 'M-D', 'Other']) {
      assert.match(activeHtml, new RegExp(`<option\\s+value="${reg}"[^>]*>${reg}<\\/option>`));
    }
    assert.match(activeHtml, /id="btn-upload"/);
    assert.match(activeHtml, /id="btn-export"/);
    assert.match(activeHtml, /id="btn-draft-new"[^>]*>Clear Fields</);
    assert.match(activeHtml, /id="btn-draft-save"[^>]*>Save Draft</);
    assert.match(activeHtml, /id="btn-draft-delete"[^>]*disabled[^>]*>Delete Draft</);
    assert.match(activeHtml, /<dialog\s+id="dialog-upload"/);
    assert.match(activeHtml, /<input\s+type="file"\s+id="file-upload"\s+accept="\.csv,\.json/);
    assert.match(activeHtml, /<dialog\s+id="dialog-export"/);
    assert.match(activeHtml, /<dialog\s+id="dialog-save-draft"/);
    assert.match(activeHtml, /<dialog\s+id="dialog-clear"/);
    assert.match(activeHtml, /<dialog\s+id="dialog-download-warn"/);
    assert.match(activeHtml, /<ul\s+id="warnings"\s+class="warning-list"\s+hidden>/);
    assert.doesNotMatch(activeHtml, /id="btn-import-csv"/);
    assert.doesNotMatch(activeHtml, /id="btn-import-json"/);
    assert.match(activeHtml, /id="btn-playerCount-dec"/);
    assert.match(activeHtml, /<input\s+id="f-playerCount"\s+type="text"\s+inputmode="numeric"/);
    assert.match(activeHtml, /id="btn-playerCount-inc"/);
    // Presets selector is commented out for production use
    assert.doesNotMatch(activeHtml, /id="presets-select"/);
    assert.match(html, /id="presets-select"/);
    assert.match(activeHtml, /<select\s+id="f-topCut"/);
    for (const cut of [2, 4, 8]) {
      assert.match(activeHtml, new RegExp(`<option\\s+value="${cut}"[^>]*>${cut}<\\/option>`));
    }
    assert.doesNotMatch(activeHtml, /id="btn-add-player"/);
    assert.doesNotMatch(activeHtml, /id="f-theme"/);
    assert.doesNotMatch(activeHtml, /id="upload-list"/);
    assert.doesNotMatch(activeHtml, /id="f-signature"/);
    assert.doesNotMatch(activeHtml, /id="analytics"/);
    assert.doesNotMatch(activeHtml, /class="hint"/);
    assert.deepEqual([...REGULATION_OPTIONS], ['M-A', 'M-B', 'M-C', 'M-D', 'Other']);
    assert.deepEqual([...TOP_CUT_OPTIONS], [2, 4, 8]);
  });

  test('bundled script boots cleanly on default Challenge / Reg M-C / Top 2 when readyState stays "loading"', async () => {
    const distHtml = fs.readFileSync(path.join(ROOT, 'dist/vgc-standings.html'), 'utf8');
    const match = distHtml.match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(match, 'dist/vgc-standings.html should contain an inline <script>');

    const doc = createMockDocument({ readyState: 'loading', includePresets: false });
    const storageMap = new Map();
    const mockLocalStorage = {
      get length() { return storageMap.size; },
      key: (i) => [...storageMap.keys()][i] ?? null,
      getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
      setItem: (k, v) => { storageMap.set(String(k), String(v)); },
      removeItem: (k) => { storageMap.delete(String(k)); },
    };
    // Simulate Safari < 16.5 throwing SyntaxError on :user-invalid in matches()
    const locInput = doc.byId.get('f-location');
    locInput.matches = (sel) => {
      if (sel === ':user-invalid') throw new Error('SyntaxError: unsupported pseudo-class');
      return sel.includes('input');
    };
    const sandbox = {
      document: doc,
      localStorage: mockLocalStorage,
      console,
      setTimeout,
      clearTimeout,
      URL,
      Map,
      Set,
      Proxy,
      Object,
      Array,
      Number,
      String,
      Boolean,
      Math,
      Date,
      RegExp,
      Error,
      JSON,
      Promise,
      encodeURI,
      encodeURIComponent,
      decodeURIComponent,
      AbortController,
      fetch: async () => ({ ok: false, status: 503, text: async () => '', json: async () => ({}) }),
    };
    sandbox.globalThis = sandbox;

    vm.runInNewContext(match[1], sandbox, { filename: 'vgc-standings-bundle.js' });

    // Default field values: Challenge, blank location, today's date, Reg M-C, 0 players, Top Cut 2, URL/Paste mode
    const now = new Date();
    const todayIso = `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    assert.equal(doc.byId.get('f-eventType').value, 'challenge');
    assert.equal(locInput.value, '');
    assert.equal(doc.byId.get('f-date').value, todayIso);

    // Safari < 16.5 :user-invalid throwing matches() does not crash input handlers
    locInput.value = 'Portland';
    assert.doesNotThrow(() => locInput.dispatch('input'));

    // Regulation dropdown populated with None + M-A..M-D + Other and defaults to M-C
    const regSelect = doc.byId.get('f-regulation');
    assert.deepEqual(
      regSelect.children.map((o) => o.value),
      ['', 'M-A', 'M-B', 'M-C', 'M-D', 'Other'],
    );
    assert.equal(regSelect.value, 'M-C');

    // Drafts dropdown & Delete Draft are disabled when no saved drafts exist
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(doc.byId.get('drafts-select').disabled, true);
    assert.equal(doc.byId.get('btn-draft-delete').disabled, true);

    // Save Draft opens naming modal with auto-generated highlighted title
    const saveDraftDlg = doc.byId.get('dialog-save-draft');
    const draftNameInp = doc.byId.get('f-draftName');
    doc.byId.get('btn-draft-save').dispatch('click');
    assert.equal(saveDraftDlg.open, true);
    assert.match(draftNameInp.value, /^Portland League Challenge \(/);
    assert.equal(draftNameInp.selected, true);
    assert.deepEqual(draftNameInp.selectedRange, [0, draftNameInp.value.length]);
    draftNameInp.value = 'My Custom Challenge Draft';
    doc.byId.get('btn-save-draft-confirm').dispatch('click');
    await new Promise((r) => setTimeout(r, 15));
    assert.equal(saveDraftDlg.open, false);
    assert.equal(doc.byId.get('drafts-select').disabled, false);
    assert.equal(doc.byId.get('btn-draft-delete').disabled, false);
    assert.ok(doc.byId.get('drafts-select').children.some((o) => o.textContent === 'My Custom Challenge Draft'));

    // Clear Fields opens confirmation modal; Cancel keeps values, Confirm resets to defaults
    const clearDlg = doc.byId.get('dialog-clear');
    doc.byId.get('btn-draft-new').dispatch('click');
    assert.equal(clearDlg.open, true);
    assert.equal(locInput.value, 'Portland');
    doc.byId.get('btn-clear-cancel').dispatch('click');
    assert.equal(clearDlg.open, false);
    assert.equal(locInput.value, 'Portland');

    doc.byId.get('btn-draft-new').dispatch('click');
    doc.byId.get('btn-clear-confirm').dispatch('click');
    await new Promise((r) => setTimeout(r, 15));
    assert.equal(clearDlg.open, false);
    assert.equal(doc.byId.get('f-eventType').value, 'challenge');
    assert.equal(locInput.value, '');
    assert.equal(doc.byId.get('f-date').value, todayIso);
    assert.equal(regSelect.value, 'M-C');
    assert.equal(doc.byId.get('f-playerCount').value, '0');
    assert.equal(doc.byId.get('f-topCut').value, '2');

    // Player count stepper works (+ / - / numeric filtering)
    const countInput = doc.byId.get('f-playerCount');
    assert.equal(countInput.value, '0');
    assert.equal(doc.byId.get('btn-playerCount-dec').disabled, true);
    doc.byId.get('btn-playerCount-inc').dispatch('click');
    assert.equal(countInput.value, '1');
    doc.byId.get('btn-playerCount-dec').dispatch('click');
    assert.equal(countInput.value, '0');

    // Non-digit typing is stripped and keydown blocks letters
    const keyEv = countInput.dispatch('keydown', { key: 'a' });
    assert.equal(keyEv.defaultPrevented, true);
    const digitEv = countInput.dispatch('keydown', { key: '5' });
    assert.equal(digitEv.defaultPrevented, false);
    countInput.value = '12abc3';
    countInput.dispatch('input');
    assert.equal(countInput.value, '123');

    // Top Cut dropdown starts at 2 and switches between 2, 4, 8
    const playersEl = doc.byId.get('players');
    const topCutSelect = doc.byId.get('f-topCut');
    assert.deepEqual(topCutSelect.children.map((o) => o.value), ['2', '4', '8']);
    assert.equal(topCutSelect.value, '2');
    assert.equal(playersEl.children.length, 2);

    topCutSelect.value = '4';
    topCutSelect.dispatch('change');
    assert.equal(playersEl.children.length, 4);

    topCutSelect.value = '8';
    topCutSelect.dispatch('change');
    assert.equal(playersEl.children.length, 8);

    topCutSelect.value = '2';
    topCutSelect.dispatch('change');
    assert.equal(playersEl.children.length, 2);

    // Redaction toggles sit at the top of each player card (right below header, above inputs); no Pokémon chips list
    const firstCardChildren = playersEl.children[0].children;
    assert.ok(!firstCardChildren.some((el) => el.className === 'chips'), 'chips list should be removed');
    const redactBar = firstCardChildren[1];
    assert.equal(redactBar.className, 'redact-toggles');
    assert.equal(redactBar.children.length, 2);
    assert.equal(redactBar.children[0].children[1].textContent, 'Redact name');
    assert.equal(redactBar.children[1].children[1].textContent, 'Redact team');

    // Player cards contain only Player Name, Handle, and Team (with URL/Paste & Manual toggle)
    const firstCardGrid = firstCardChildren[2];
    assert.equal(firstCardGrid.className, 'player-grid');
    const fieldLabels = firstCardGrid.children.map((el) => el.children[0].textContent || el.children[0].children?.[0]?.textContent);
    assert.deepEqual(fieldLabels, ['Player Name', 'Handle', 'Team']);

    // Team source textarea dynamically grows for multi-line pastes and stays compact for single-line URLs
    const teamWrap = firstCardGrid.children[2];
    const teamTextarea = teamWrap.children[1];
    teamTextarea.value = 'Incineroar @ Sitrus Berry\nAbility: Intimidate\n- Fake Out\n- Flare Blitz\n- Parting Shot\n- Knock Off\n\nCharizard @ Choice Specs\nAbility: Solar Power\n- Heat Wave\n- Overheat\n- Air Slash\n- Protect';
    teamTextarea.dispatch('input');
    const multiLineHeight = Number.parseInt(teamTextarea.style.height, 10);
    assert.ok(multiLineHeight >= 200, `expected multi-line paste textarea height >= 200px, got ${multiLineHeight}`);
    teamTextarea.value = 'https://pokepast.es/33bbc4f4633968dc';
    teamTextarea.dispatch('input');
    const urlHeight = Number.parseInt(teamTextarea.style.height, 10);
    assert.ok(urlHeight < multiLineHeight && urlHeight <= 60, `expected compact URL height, got ${urlHeight}`);

    // Toggling Redact name disables Player Name & Handle; toggling Redact team disables Team controls
    const nameInput = firstCardGrid.children[0].children[1];
    const handleInput = firstCardGrid.children[1].children[1];
    const redactNameCheckbox = redactBar.children[0].children[0];
    const redactTeamCheckbox = redactBar.children[1].children[0];
    assert.equal(nameInput.disabled, false);
    assert.equal(handleInput.disabled, false);
    redactNameCheckbox.checked = true;
    redactNameCheckbox.dispatch('change');
    assert.equal(nameInput.disabled, true);
    assert.equal(handleInput.disabled, true);
    redactNameCheckbox.checked = false;
    redactNameCheckbox.dispatch('change');
    assert.equal(nameInput.disabled, false);
    assert.equal(handleInput.disabled, false);

    assert.equal(teamTextarea.disabled, false);
    redactTeamCheckbox.checked = true;
    redactTeamCheckbox.dispatch('change');
    assert.equal(teamTextarea.disabled, true);
    redactTeamCheckbox.checked = false;
    redactTeamCheckbox.dispatch('change');
    assert.equal(teamTextarea.disabled, false);

    // Toggle to Manual mode -> swaps team body in-place (preserving card DOM / scroll position) with 6 autocorrect-disabled inputs
    const firstCardNodeBefore = playersEl.children[0];
    const toggleGroup = teamWrap.children[0].children[1];
    const manualBtn = toggleGroup.children[1];
    assert.equal(manualBtn.textContent, 'Manual');
    manualBtn.dispatch('click');
    assert.equal(playersEl.children[0], firstCardNodeBefore, 'switching team mode must not rebuild player list or reset scroll');

    const manualTeamWrap = playersEl.children[0].children[2].children[2];
    const manualGrid = manualTeamWrap.children[1];
    assert.equal(manualGrid.children.length, 6);
    const firstCombo = manualGrid.children[0];
    const firstManualInput = firstCombo.children[0];
    const firstDropdown = firstCombo.children[1];
    assert.equal(firstManualInput.getAttribute('autocomplete'), 'off');
    assert.equal(firstManualInput.getAttribute('autocorrect'), 'off');
    assert.equal(firstManualInput.getAttribute('autocapitalize'), 'off');
    assert.equal(firstManualInput.getAttribute('spellcheck'), 'false');

    // Regulation M-B excludes Rillaboom; switching to M-C includes it
    regSelect.value = 'M-B';
    regSelect.dispatch('change');
    firstManualInput.value = 'rillaboom';
    firstManualInput.dispatch('input');
    assert.equal(firstDropdown.hidden, true, 'Rillaboom should not be suggested in Reg M-B');
    regSelect.value = 'M-C';
    regSelect.dispatch('change');
    firstManualInput.value = 'rillaboom';
    firstManualInput.dispatch('input');
    assert.equal(firstDropdown.hidden, false);
    assert.equal(firstDropdown.children[0].textContent, 'Rillaboom');

    // Touch tap on a non-first suggestion commits the tapped option even if blur fires between touchstart & touchend (iOS Safari)
    firstManualInput.value = 'char';
    firstManualInput.dispatch('input');
    assert.ok(firstDropdown.children.length >= 2);
    const secondOpt = firstDropdown.children[1];
    const secondName = secondOpt.textContent;
    secondOpt.dispatch('touchstart', { touches: [{ clientY: 100 }] });
    firstManualInput.dispatch('blur');
    secondOpt.dispatch('touchend', { changedTouches: [{ clientY: 102 }] });
    assert.equal(firstManualInput.value, secondName);
    assert.equal(firstDropdown.hidden, true);

    // Typing a fuzzy query populates the dropdown and Enter selects the top match
    firstManualInput.value = 'inceneroar';
    firstManualInput.dispatch('input');
    assert.equal(firstDropdown.hidden, false);
    assert.ok(firstDropdown.children.length >= 1 && firstDropdown.children.length <= 6);
    assert.equal(firstDropdown.children[0].textContent, 'Incineroar');
    firstManualInput.dispatch('keydown', { key: 'Enter' });
    assert.equal(firstManualInput.value, 'Incineroar');
    assert.equal(firstDropdown.hidden, true);

    // Warnings list under Download button stays hidden; clicking Download PNG with incomplete data opens warning popup
    const warningsEl = doc.byId.get('warnings');
    const dlWarnDlg = doc.byId.get('dialog-download-warn');
    const dlWarnList = doc.byId.get('download-warn-list');
    assert.equal(warningsEl.children.length, 0);
    countInput.value = '0';
    countInput.dispatch('input');
    doc.byId.get('btn-download').dispatch('click');
    assert.equal(dlWarnDlg.open, true);
    const missingMsgs = dlWarnList.children.map((li) => li.textContent);
    assert.ok(missingMsgs.includes('Location is missing'));
    assert.ok(missingMsgs.includes('Player count is 0'));
    assert.ok(missingMsgs.includes('Player #1: player name is missing'));
    assert.ok(missingMsgs.includes('Player #1: only 2 of 6 Pokémon entered'));
    assert.ok(missingMsgs.includes('Player #2: team is missing'));
    doc.byId.get('btn-download-warn-cancel').dispatch('click');
    assert.equal(dlWarnDlg.open, false);

    // Checking Redact name & Redact team ignores missing name/team data for that player
    redactNameCheckbox.checked = true;
    redactNameCheckbox.dispatch('change');
    redactTeamCheckbox.checked = true;
    redactTeamCheckbox.dispatch('change');
    doc.byId.get('btn-download').dispatch('click');
    const redactedMsgs = dlWarnList.children.map((li) => li.textContent);
    assert.ok(!redactedMsgs.some((m) => m.startsWith('Player #1:')), 'redacted player should have no missing-field warnings');
    assert.ok(redactedMsgs.includes('Player #2: team is missing'));
    doc.byId.get('btn-download-warn-cancel').dispatch('click');

    // Consolidated Upload and Export dialogs open on button click
    doc.byId.get('btn-upload').dispatch('click');
    assert.equal(doc.byId.get('dialog-upload').open, true);
    doc.byId.get('btn-upload-cancel').dispatch('click');
    assert.equal(doc.byId.get('dialog-upload').open, false);

    doc.byId.get('btn-export').dispatch('click');
    assert.equal(doc.byId.get('dialog-export').open, true);
    doc.byId.get('btn-export-cancel').dispatch('click');
    assert.equal(doc.byId.get('dialog-export').open, false);

    // Every built-in preset (retained for testing) still parses cleanly into 6 Pokémon per Showdown team
    for (const preset of EVENT_PRESETS) {
      assert.ok([2, 4, 8].includes(preset.standings.length), `${preset.id} length`);
      for (const entry of preset.standings) {
        if (!isPokepasteUrl(entry.teamSource)) {
          const parsed = parseShowdownTeam(entry.teamSource);
          assert.equal(parsed.pokemon.length, 6, `${preset.id} ${entry.name} should have 6 pokemon`);
        }
      }
    }

    // Wait a tick for initial renderNow() to finish and update status
    await new Promise((r) => setTimeout(r, 25));
    assert.match(doc.byId.get('status').textContent, /Rendered \d+×\d+px/);
  });
});
