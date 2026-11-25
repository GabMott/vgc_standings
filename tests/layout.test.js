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
  it('returns 4 vertices and positive textMaxWidth', () => {
    const geo = computeRhombusGeometry(CANVAS_WIDTH, HEADER_HEIGHT);
    assert.equal(geo.points.length, 4);
    assert.ok(geo.textMaxWidth > 0);
    assert.ok(geo.topY < geo.dividerY && geo.dividerY < geo.bottomY);
  });
});

describe('computeLayout', () => {
  it('handles 0 players cleanly without division by zero', () => {
    const layout = computeLayout({ playerCount: 0 });
    assert.equal(layout.cards.length, 0);
    assert.equal(layout.columns, 0);
    assert.equal(layout.rows, 0);
    assert.equal(layout.canvasWidth, CANVAS_WIDTH);
    assert.equal(layout.canvasHeight, BASE_CANVAS_HEIGHT);
  });

  it('uses symmetrical single-column margins for 1 and 2 players', () => {
    for (const count of [1, 2]) {
      const layout = computeLayout({ playerCount: count });
      assert.equal(layout.columns, 1);
      assert.equal(layout.cards.length, count);
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

  it('never overlaps cards and dynamically expands canvas height for large player counts', () => {
    for (const count of [4, 8, 16, 32]) {
      const layout = computeLayout({ playerCount: count, hasSignature: true });
      assert.equal(layout.cards.length, count);
      assert.ok(layout.cardHeight >= STANDINGS_MIN_CARD_HEIGHT);

      // Verify no card overlaps signature area at the bottom
      const maxBottom = Math.max(...layout.cards.map((c) => c.bottom));
      assert.ok(
        maxBottom <= layout.canvasHeight - SIGNATURE_RESERVED_HEIGHT - STANDINGS_GAP + 1,
        `count=${count}: bottom ${maxBottom} exceeded limit`,
      );

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
    const large = computeLayout({ playerCount: 32 });
    assert.ok(large.canvasHeight > BASE_CANVAS_HEIGHT);
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
