import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_RAW_GITHUB_ASSETS,
  BUILTIN_THEMES,
  getDefaultAssetBaseUrl,
  resolveTheme,
} from '../src/adapters/themes.js';
import {
  drawRoundedRectPath,
  drawImageCover,
  drawImageContain,
  renderStandingsCanvas,
} from '../src/renderer/canvas-renderer.js';
import { createEmptyTournament, createStandingEntry } from '../src/core/schema.js';

function createMockCanvas() {
  const calls = [];
  const ctx = {
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineJoin: 'miter',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    save() { calls.push('save'); },
    restore() { calls.push('restore'); },
    beginPath() { calls.push('beginPath'); },
    closePath() { calls.push('closePath'); },
    moveTo() {},
    lineTo() {},
    arc() {},
    arcTo() {},
    rect() {},
    clip() {},
    fill() { calls.push('fill'); },
    stroke() { calls.push('stroke'); },
    fillRect() { calls.push('fillRect'); },
    clearRect() { calls.push('clearRect'); },
    fillText(text) { calls.push(['fillText', text]); },
    drawImage() { calls.push('drawImage'); },
    measureText(text) { return { width: String(text).length * 10 }; },
    createLinearGradient() { return { addColorStop() {} }; },
  };
  return {
    width: 0,
    height: 0,
    calls,
    getContext() { return ctx; },
  };
}

describe('themes', () => {
  it('provides 7 built-in themes (3 Portland + 4 procedural)', () => {
    assert.equal(BUILTIN_THEMES.length, 7);
    const portlandDark = resolveTheme('portland-dark', {}, 'https://example.com/assets/');
    assert.equal(portlandDark.images.vgcIcon, 'https://example.com/assets/Pokemon%20VGC%20Icon.png');
    assert.equal(portlandDark.images.localIcon, 'https://example.com/assets/Portland%20VGC%20Icon.png');
  });

  it('auto-detects local vs GitHub raw asset base URL', () => {
    assert.equal(getDefaultAssetBaseUrl({ hostname: 'localhost' }), './assets/');
    assert.equal(getDefaultAssetBaseUrl({ hostname: '127.0.0.1' }), './assets/');
    assert.equal(getDefaultAssetBaseUrl({ hostname: 'user.github.io' }), './assets/');
    assert.equal(getDefaultAssetBaseUrl({ hostname: 'gistpreview.github.io' }), DEFAULT_RAW_GITHUB_ASSETS);
    assert.equal(getDefaultAssetBaseUrl({ hostname: 'htmlpreview.github.io' }), DEFAULT_RAW_GITHUB_ASSETS);
    assert.equal(getDefaultAssetBaseUrl({ hostname: '' }), DEFAULT_RAW_GITHUB_ASSETS);
    assert.equal(getDefaultAssetBaseUrl(undefined), DEFAULT_RAW_GITHUB_ASSETS);
  });

  it('falls back safely on unknown theme id and invalid color overrides', () => {
    const resolved = resolveTheme('nonexistent', { headerStart: 'not-a-color', accent: '#0f0' });
    assert.equal(resolved.id, 'portland-dark');
    assert.equal(resolved.colors.headerStart, '#101A2E');
    assert.equal(resolved.colors.accent, '#00FF00');
  });
});

describe('canvas-renderer', () => {
  it('drawImageCover and drawImageContain guard against broken/0x0 images', () => {
    const canvas = createMockCanvas();
    const ctx = canvas.getContext('2d');
    assert.equal(drawImageCover(ctx, null, 0, 0, 100, 100), false);
    assert.equal(drawImageCover(ctx, { naturalWidth: 0, naturalHeight: 0 }, 0, 0, 100, 100), false);
    assert.equal(drawImageContain(ctx, { naturalWidth: 100, naturalHeight: 50 }, 0, 0, 0, 100), false);
    assert.equal(drawImageCover(ctx, { naturalWidth: 200, naturalHeight: 100 }, 0, 0, 100, 100), true);
    assert.equal(drawImageContain(ctx, { naturalWidth: 200, naturalHeight: 100 }, 0, 0, 100, 100), true);
  });

  it('drawRoundedRectPath works without native ctx.roundRect', () => {
    const canvas = createMockCanvas();
    const ctx = canvas.getContext('2d');
    assert.doesNotThrow(() => drawRoundedRectPath(ctx, 10, 10, 100, 50, 12));
  });

  it('renders cleanly across extreme and malformed inputs without ever throwing', () => {
    const theme = resolveTheme('midnight-pokeball');

    // 1. Null / junk tournament
    const c1 = createMockCanvas();
    const r1 = renderStandingsCanvas(c1, null, null, null);
    assert.equal(r1.canvasWidth, 1500);
    assert.equal(r1.canvasHeight, 1500);

    // 2. Empty standings (0 players)
    const c2 = createMockCanvas();
    renderStandingsCanvas(c2, createEmptyTournament(), theme);
    assert.ok(c2.calls.some((c) => Array.isArray(c) && c[1] === 'No standings yet'));

    // 3. Extreme strings, emoji, RTL, non-numeric placings, 0 pokemon, 16 players
    const entries = Array.from({ length: 16 }, (_, i) =>
      createStandingEntry({
        placing: i === 0 ? 'T-16🔥' : i === 1 ? '1st' : i === 2 ? '' : String(i + 1),
        name: `${'TrainerName🔥'.repeat(10)} \u202Ertl`,
        handle: `@${'longhandle'.repeat(5)}`,
        pokemon: i % 3 === 0 ? [] : [{ name: 'Flutter Mane', speciesSlug: 'flutter-mane', spriteUrl: 'https://img/fm.png' }],
      }),
    );
    const big = createEmptyTournament({
      event: {
        eventType: 'custom',
        customEventLabel: 'EXTREMELY LONG CUSTOM TOURNAMENT LABEL '.repeat(5),
        location: 'A'.repeat(200),
        date: 'December 31st, 2026',
        regulation: 'G',
        playerCount: 512,
      },
      standings: entries,
    });
    const c3 = createMockCanvas();
    const r3 = renderStandingsCanvas(c3, big, theme, {
      sprites: { 'https://img/fm.png': { naturalWidth: 475, naturalHeight: 475 } },
    });
    assert.equal(c3.width, 1500);
    assert.ok(r3.canvasHeight > 1500);
    assert.ok(c3.calls.includes('drawImage'));
  });
});
