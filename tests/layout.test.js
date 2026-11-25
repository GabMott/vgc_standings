import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CANVAS_WIDTH,
  BASE_CANVAS_HEIGHT,
  HEADER_HEIGHT,
  STANDINGS_GAP,
  STANDINGS_MIN_CARD_HEIGHT,
  STANDINGS_MAX_CARD_HEIGHT,
  SIGNATURE_RESERVED_HEIGHT,
  fitTextToWidth,
  computeRhombusGeometry,
  computeLayout,
  computeSpriteSlots,
  computeGlobalSpriteScale,
  computeEqualGapSpriteRow,
} from '../src/core/layout.js';

describe('fitTextToWidth', () => {
  it('handles empty, null, undefined, and non-string inputs safely', () => {
    for (const val of ['', null, undefined]) {
      const res = fitTextToWidth(val, { maxWidth: 200, maxFontSize: 30, minFontSize: 12 });
      assert.equal(res.text, '');
      assert.equal(res.truncated, false);
      assert.equal(res.width, 0);
      assert.ok(res.fontSize > 0);
    }
    const numRes = fitTextToWidth(12345, { maxWidth: 200, maxFontSize: 20, minFontSize: 10 });
    assert.equal(numRes.text, '12345');
  });

  it('returns maxFontSize when text fits', () => {
    const res = fitTextToWidth('Short', {
      maxWidth: 500,
      maxFontSize: 40,
      minFontSize: 12,
      measureText: (t, s) => t.length * s * 0.5,
    });
    assert.equal(res.text, 'Short');
    assert.equal(res.fontSize, 40);
    assert.equal(res.truncated, false);
  });

  it('shrinks font size cleanly before truncating', () => {
    const res = fitTextToWidth('VG LEAGUE CUP • PORTLAND OREGON', {
      maxWidth: 320,
      maxFontSize: 44,
      minFontSize: 12,
      measureText: (t, s) => t.length * s * 0.6,
    });
    assert.equal(res.truncated, false);
    assert.ok(res.fontSize >= 12 && res.fontSize < 44);
    assert.ok(res.width <= 320);
  });

  it('truncates with ellipsis at minFontSize for extremely long strings without ever hitting fontSize <= 0', () => {
    const huge = 'A'.repeat(300);
    const res = fitTextToWidth(huge, {
      maxWidth: 150,
      maxFontSize: 40,
      minFontSize: 12,
      measureText: (t, s) => Array.from(t).length * s * 0.6,
    });
    assert.equal(res.fontSize, 12);
    assert.equal(res.truncated, true);
    assert.ok(res.text.endsWith('…'));
    assert.ok(res.width <= 150);
  });

  it('does not split emoji surrogate pairs when truncating', () => {
    const emojiStr = '🔥'.repeat(50);
    const res = fitTextToWidth(emojiStr, {
      maxWidth: 60,
      maxFontSize: 20,
      minFontSize: 12,
      measureText: (t, s) => Array.from(t).length * s,
    });
    assert.equal(res.truncated, true);
    assert.ok(res.text.endsWith('…'));
    // Ensure no lone surrogates
    assert.equal(/[\uD800-\uDFFF]/.test(res.text.replace(/\p{Emoji}/gu, '')), false);
  });

  it('handles maxWidth <= 0 and throwing measureText gracefully', () => {
    const zero = fitTextToWidth('Hello', { maxWidth: 0, maxFontSize: 24, minFontSize: 12 });
    assert.equal(zero.text, '');
    assert.equal(zero.truncated, true);
    assert.ok(zero.fontSize >= 1);

    const neg = fitTextToWidth('Hello', { maxWidth: -50, maxFontSize: 24, minFontSize: 12 });
    assert.equal(neg.text, '');

    const throwing = fitTextToWidth('Hello', {
      maxWidth: 100,
      maxFontSize: 24,
      measureText: () => { throw new Error('boom'); },
    });
    assert.equal(throwing.text, 'Hello');
  });
});

describe('computeRhombusGeometry', () => {
  it('returns 4 vertices centered on the header/background seam with positive textMaxWidth', () => {
    const geo = computeRhombusGeometry(CANVAS_WIDTH, HEADER_HEIGHT);
    assert.equal(geo.points.length, 4);
    assert.ok(geo.textMaxWidth > 0);
    assert.ok(geo.topY < geo.dividerY && geo.dividerY < geo.bottomY);
    assert.equal((geo.topY + geo.bottomY) / 2, HEADER_HEIGHT);
  });
});

describe('computeLayout', () => {
  it('handles 0 players cleanly without division by zero', () => {
    const layout = computeLayout({ playerCount: 0 });
    assert.equal(layout.cards.length, 0);
    assert.equal(layout.columns, 0);
    assert.equal(layout.rows, 0);
    assert.equal(layout.canvasWidth, CANVAS_WIDTH);
    assert.ok(layout.canvasHeight > HEADER_HEIGHT);
  });

  it('uses symmetrical centered single-column cards matching 4/8-player width for 1 and 2 players', () => {
    const fourPlayerWidth = computeLayout({ playerCount: 4 }).cardWidth;
    for (const count of [1, 2]) {
      const layout = computeLayout({ playerCount: count });
      assert.equal(layout.columns, 1);
      assert.equal(layout.cards.length, count);
      assert.equal(layout.cardWidth, fourPlayerWidth);
      const card = layout.cards[0];
      const leftMargin = card.left;
      const rightMargin = layout.canvasWidth - card.right;
      assert.equal(leftMargin, rightMargin);
      assert.ok(card.height >= STANDINGS_MIN_CARD_HEIGHT && card.height <= STANDINGS_MAX_CARD_HEIGHT);
    }
  });

  it('centers the last card for odd player counts > 2', () => {
    for (const count of [3, 5, 7]) {
      const layout = computeLayout({ playerCount: count });
      assert.equal(layout.columns, 2);
      const last = layout.cards[count - 1];
      const expectedX = (layout.canvasWidth - layout.cardWidth) / 2;
      assert.equal(last.x, expectedX);
    }
  });

  it('scales canvas height to fit players and centers cards between info banner and bottom', () => {
    const geo = computeRhombusGeometry(CANVAS_WIDTH, HEADER_HEIGHT);
    for (const hasSignature of [true, false]) {
      const heights = [];
      for (const count of [1, 2, 4, 8, 16, 32]) {
        const layout = computeLayout({ playerCount: count, hasSignature });
        heights.push(layout.canvasHeight);
        assert.equal(layout.cards.length, count);
        assert.ok(layout.cardHeight >= STANDINGS_MIN_CARD_HEIGHT);

        const topGap = layout.cards[0].top - geo.bottomY;
        const maxBottom = Math.max(...layout.cards.map((c) => c.bottom));
        const bottomGap = layout.canvasHeight - maxBottom;
        assert.ok(
          Math.abs(topGap - bottomGap) <= 1,
          `count=${count} sig=${hasSignature}: topGap=${topGap} vs bottomGap=${bottomGap}`,
        );
        if (hasSignature) {
          assert.ok(
            maxBottom <= layout.canvasHeight - SIGNATURE_RESERVED_HEIGHT,
            `count=${count}: bottom ${maxBottom} overlapped signature area`,
          );
        }

        // Verify no two cards overlap
        for (let i = 0; i < layout.cards.length; i++) {
          for (let j = i + 1; j < layout.cards.length; j++) {
            const a = layout.cards[i];
            const b = layout.cards[j];
            const overlaps = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
            assert.equal(overlaps, false, `Cards ${i} and ${j} overlap for count=${count}`);
          }
        }
      }
      // Height scales up as row count increases (1 row < 2 rows < 4 rows < 8 rows < 16 rows)
      assert.ok(heights[0] < heights[2] && heights[2] < heights[3] && heights[3] < heights[4] && heights[4] < heights[5]);
      assert.ok(heights[5] > BASE_CANVAS_HEIGHT);
    }
  });
});

describe('computeSpriteSlots', () => {
  const card = { x: 50, y: 600, width: 675, height: 200 };

  it('returns empty array for 0 or negative pokemonCount', () => {
    assert.deepEqual(computeSpriteSlots(card, 76, 0), []);
    assert.deepEqual(computeSpriteSlots(card, 76, -3), []);
    assert.deepEqual(computeSpriteSlots(null, 76, 6), []);
  });

  it('computes positive, non-overlapping slots within card bounds for 1..6 pokemon', () => {
    for (let n = 1; n <= 6; n++) {
      const slots = computeSpriteSlots(card, 76, n);
      assert.equal(slots.length, n);
      for (const s of slots) {
        assert.ok(s.size > 0);
        assert.ok(s.centerX - s.size / 2 >= card.x);
        assert.ok(s.centerX + s.size / 2 <= card.x + card.width);
        assert.ok(s.y >= card.y + 76);
        assert.ok(s.y + s.size <= card.y + card.height);
      }
    }
  });

  it('returns empty array if card height is too small for any sprite', () => {
    assert.deepEqual(computeSpriteSlots({ x: 0, y: 0, width: 500, height: 50 }, 60, 6), []);
  });
});

describe('computeEqualGapSpriteRow', () => {
  const card = { x: 50, y: 600, width: 675, height: 200 };

  it('produces equal visual gaps between adjacent sprites of mixed aspect ratios', () => {
    const items = [
      { sw: 180, sh: 420 }, // tall narrow (e.g. Farigiraf)
      { sw: 400, sh: 300 }, // wide (e.g. Charizard)
      { sw: 240, sh: 380 }, // tall
      { sw: 360, sh: 260 }, // wide
      { sw: 220, sh: 300 }, // medium
      { sw: 320, sh: 320 }, // square
    ];
    const slots = computeEqualGapSpriteRow(card, 68, items);
    assert.equal(slots.length, 6);
    const gaps = [];
    for (let i = 1; i < slots.length; i++) {
      gaps.push(slots[i].x - (slots[i - 1].x + slots[i - 1].width));
    }
    for (const g of gaps) {
      assert.ok(g >= 13.9, `expected gap >= minGap, got ${g}`);
      assert.ok(Math.abs(g - gaps[0]) < 0.01, `expected equal gaps, got ${gaps}`);
    }
    // Stays cleanly inside card bounds and centered horizontally
    const leftMargin = slots[0].x - card.x;
    const rightMargin = (card.x + card.width) - (slots[5].x + slots[5].width);
    assert.ok(Math.abs(leftMargin - rightMargin) < 0.01);
    for (const s of slots) {
      assert.ok(s.y >= card.y + 68);
      assert.ok(s.y + s.height <= card.y + card.height);
    }
  });

  it('keeps identical sprites the exact same size across cards using computeGlobalSpriteScale', () => {
    const charizard = { sw: 420, sh: 340 };
    const narrowTeam = [{ sw: 150, sh: 420 }, { sw: 180, sh: 400 }, charizard, { sw: 200, sh: 360 }, { sw: 210, sh: 350 }, { sw: 200, sh: 380 }];
    const wideTeam = [{ sw: 430, sh: 300 }, charizard, { sw: 440, sh: 310 }, { sw: 420, sh: 300 }, { sw: 430, sh: 320 }, { sw: 410, sh: 310 }];
    const globalScale = computeGlobalSpriteScale([
      { cardBounds: card, topSlotHeight: 68, items: narrowTeam },
      { cardBounds: card, topSlotHeight: 68, items: wideTeam },
    ]);
    const rowA = computeEqualGapSpriteRow(card, 68, narrowTeam, { scaleMultiplier: globalScale });
    const rowB = computeEqualGapSpriteRow(card, 68, wideTeam, { scaleMultiplier: globalScale });
    // Charizard is index 2 in rowA and index 1 in rowB -> identical rendered dimensions
    assert.ok(Math.abs(rowA[2].width - rowB[1].width) < 0.01);
    assert.ok(Math.abs(rowA[2].height - rowB[1].height) < 0.01);
  });

  it('optically kerns asymmetric sprites so visual body gaps stay equal without overlapping', () => {
    const chunky = { sw: 320, sh: 320, coreLeft: 0.04, coreRight: 0.96, leftProfile: Array(24).fill(0), rightProfile: Array(24).fill(1) };
    // Floette-Eternal style: thin flower stem on the right (only top 2 bands reach 1.0, body ends at 0.80)
    const floetteRight = Array(24).fill(0.80);
    floetteRight[0] = 1.0;
    floetteRight[1] = 1.0;
    const floette = { sw: 320, sh: 340, coreLeft: 0.08, coreRight: 0.80, leftProfile: Array(24).fill(0.05), rightProfile: floetteRight };
    // Sneasler style: thin claw on the left (only bottom 2 bands reach 0.0, body starts at 0.14)
    const sneaslerLeft = Array(24).fill(0.14);
    sneaslerLeft[22] = 0.0;
    sneaslerLeft[23] = 0.0;
    const sneasler = { sw: 240, sh: 360, coreLeft: 0.14, coreRight: 0.94, leftProfile: sneaslerLeft, rightProfile: Array(24).fill(1) };

    const items = [chunky, floette, sneasler, chunky];
    const slots = computeEqualGapSpriteRow(card, 68, items);
    // Visual body gap to Floette's left (chunky -> floette) vs to Floette's right (floette -> sneasler) should match!
    const leftBodyGap = (slots[1].x + floette.coreLeft * slots[1].width) - (slots[0].x + chunky.coreRight * slots[0].width);
    const rightBodyGap = (slots[2].x + sneasler.coreLeft * slots[2].width) - (slots[1].x + floette.coreRight * slots[1].width);
    assert.ok(Math.abs(leftBodyGap - rightBodyGap) < 1, `expected equal optical body gaps, got left=${leftBodyGap}, right=${rightBodyGap}`);
  });

  it('returns empty array for empty items or tiny card', () => {
    assert.deepEqual(computeEqualGapSpriteRow(card, 68, []), []);
    assert.deepEqual(computeEqualGapSpriteRow({ x: 0, y: 0, width: 500, height: 50 }, 60, [{ sw: 100, sh: 100 }]), []);
  });
});
