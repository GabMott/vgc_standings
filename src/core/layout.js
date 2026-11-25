// Pure layout geometry engine. No DOM access.

export const CANVAS_WIDTH = 1500;
export const BASE_CANVAS_HEIGHT = 1500;
export const HEADER_HEIGHT = 500;
export const SEPARATOR_HEIGHT = 50;
export const RHOMBUS_HEIGHT = 125;
export const RHOMBUS_DRAG_DOWN = 30;
export const RHOMBUS_WIDTH_DIFFERENCE = 100;
export const RHOMBUS_WIDTH_RATIO = 0.75;
export const STANDINGS_GAP = 50;
export const STANDINGS_MAX_CARD_HEIGHT = 200;
export const STANDINGS_MIN_CARD_HEIGHT = 150;
export const STANDINGS_CARD_RADIUS = 20;
export const STANDINGS_CARD_BORDER = 5;
export const STANDINGS_PLACING_BADGE_SIZE = 50;
export const STANDINGS_PLACING_BADGE_BORDER = 15;
export const STANDINGS_PLACING_BADGE_RADIUS = 10;
export const SIGNATURE_RESERVED_HEIGHT = 80;
export const CARD_COLOR = '#202B40';
export const TEXT_COLOR = '#FFFFFF';
export const MUTED_COLOR = '#C3D0E5';
export const SIGNATURE_BORDER_COLOR = '#D8B45A';
export const PLACEMENT_COLORS = Object.freeze({
  1: '#D8B45A',
  2: '#C0C7D1',
  3: '#C27C43',
  default: '#5B6B86',
});

const num = (v, fallback) => (Number.isFinite(v) ? v : fallback);

function defaultMeasure(text, fontSize) {
  return Array.from(text).length * fontSize * 0.55;
}

/** Fits text to maxWidth: shrinks the font first, then truncates with an ellipsis. */
export function fitTextToWidth(text, { maxWidth, maxFontSize, minFontSize = 12, measureText } = {}) {
  const str = typeof text === 'string' ? text : text == null ? '' : String(text);
  const maxF = Math.max(1, num(maxFontSize, 24));
  const minF = Math.max(1, Math.min(num(minFontSize, 12), maxF));
  const measure = typeof measureText === 'function' ? measureText : defaultMeasure;
  const width = (t, f) => {
    try {
      const w = Number(measure(t, f));
      return Number.isFinite(w) ? w : 0;
    } catch {
      return 0;
    }
  };
  if (!str) return { text: '', fontSize: maxF, width: 0, truncated: false };
  const limit = num(maxWidth, 0);
  if (limit <= 0) return { text: '', fontSize: minF, width: 0, truncated: str.length > 0 };

  if (width(str, maxF) <= limit) return { text: str, fontSize: maxF, width: width(str, maxF), truncated: false };
  if (width(str, minF) <= limit) {
    let lo = minF;
    let hi = maxF;
    // Integer binary search for the largest font size that fits.
    lo = Math.ceil(lo);
    hi = Math.floor(hi);
    let best = minF;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (width(str, mid) <= limit) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return { text: str, fontSize: best, width: width(str, best), truncated: false };
  }

  const chars = Array.from(str);
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (width(chars.slice(0, mid).join('').trimEnd() + '…', minF) <= limit) lo = mid;
    else hi = mid - 1;
  }
  const out = lo > 0 ? chars.slice(0, lo).join('').trimEnd() + '…' : '…';
  return { text: out, fontSize: minF, width: width(out, minF), truncated: true };
}

export function computeRhombusGeometry(imageWidth = CANVAS_WIDTH, headerHeight = HEADER_HEIGHT) {
  const w = Math.max(1, num(imageWidth, CANVAS_WIDTH));
  const h = Math.max(0, num(headerHeight, HEADER_HEIGHT));
  const width = Math.round(w * RHOMBUS_WIDTH_RATIO);
  const topY = h - RHOMBUS_HEIGHT / 2;
  const bottomY = h + RHOMBUS_HEIGHT / 2;
  const cx = w / 2;
  const topHalf = Math.max(0, (width - RHOMBUS_WIDTH_DIFFERENCE) / 2);
  const bottomHalf = width / 2;
  const points = [
    { x: cx - topHalf, y: topY },
    { x: cx + topHalf, y: topY },
    { x: cx + bottomHalf, y: bottomY },
    { x: cx - bottomHalf, y: bottomY },
  ];
  return {
    points,
    topY,
    bottomY,
    width,
    textMaxWidth: Math.max(0, width - RHOMBUS_WIDTH_DIFFERENCE - 60),
    dividerY: topY + RHOMBUS_HEIGHT * 0.56,
  };
}

export function computeLayout({
  playerCount,
  imageWidth = CANVAS_WIDTH,
  headerHeight = HEADER_HEIGHT,
  hasSignature = true,
} = {}) {
  const count = Math.max(0, Math.floor(num(playerCount, 0)));
  const canvasWidth = Math.max(1, num(imageWidth, CANVAS_WIDTH));
  const hdrH = Math.max(0, num(headerHeight, HEADER_HEIGHT));
  const bannerBottom = hdrH + RHOMBUS_HEIGHT / 2;
  const verticalPad = hasSignature ? SIGNATURE_RESERVED_HEIGHT + 20 : STANDINGS_GAP + 10;

  if (count === 0) {
    const emptyHeight = 200;
    const contentTop = Math.round(bannerBottom + verticalPad);
    const contentBottom = contentTop + emptyHeight;
    const canvasHeight = Math.round(contentBottom + verticalPad);
    return {
      canvasWidth, canvasHeight, columns: 0, rows: 0, cardWidth: 0, cardHeight: 0,
      contentTop, contentBottom, cards: [],
    };
  }

  const columns = count <= 2 ? 1 : 2;
  const rows = Math.ceil(count / columns);
  const cardWidth = Math.max(1, (canvasWidth - 3 * STANDINGS_GAP) / 2);
  const margin = columns === 1 ? (canvasWidth - cardWidth) / 2 : STANDINGS_GAP;
  const cardHeight = STANDINGS_MAX_CARD_HEIGHT;
  const cardsBlockHeight = rows * cardHeight + (rows - 1) * STANDINGS_GAP;

  const contentTop = Math.round(bannerBottom + verticalPad);
  const contentBottom = contentTop + cardsBlockHeight;
  const canvasHeight = Math.round(contentBottom + verticalPad);

  const cards = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    let x = margin + col * (cardWidth + STANDINGS_GAP);
    if (columns === 2 && count % 2 === 1 && i === count - 1) x = (canvasWidth - cardWidth) / 2;
    const y = contentTop + row * (cardHeight + STANDINGS_GAP);
    cards.push({
      x, y, width: cardWidth, height: cardHeight,
      left: x, top: y, right: x + cardWidth, bottom: y + cardHeight,
    });
  }
  return { canvasWidth, canvasHeight, columns, rows, cardWidth, cardHeight, contentTop, contentBottom, cards };
}

/** Evenly spaced square sprite slots in the area under the card's top slot. */
export function computeSpriteSlots(cardBounds, topSlotHeight, pokemonCount) {
  const n = Math.floor(num(pokemonCount, 0));
  if (n <= 0 || !cardBounds) return [];
  const x = num(cardBounds.x ?? cardBounds.left, 0);
  const y = num(cardBounds.y ?? cardBounds.top, 0);
  const width = num(cardBounds.width, 0);
  const height = num(cardBounds.height, 0);
  const pad = 10;
  const topPad = 6;
  const bottomPad = 8;
  const innerW = width - 2 * pad;
  const areaTop = y + Math.max(0, num(topSlotHeight, 0)) + topPad;
  const availH = y + height - bottomPad - areaTop;
  const slotWidth = innerW / n;
  const size = Math.floor(Math.min(slotWidth, availH));
  if (!(size > 0) || !(slotWidth > 0)) return [];
  const slotY = areaTop + Math.floor((availH - size) / 2);
  return Array.from({ length: n }, (_, i) => ({
    centerX: x + pad + slotWidth * (i + 0.5),
    y: slotY,
    size,
    slotWidth,
  }));
}

const SPRITE_ROW_DEFAULTS = Object.freeze({
  minGap: 22,
  maxGap: 52,
  minClearance: 12,
  padX: 22,
  topPad: 14,
  bottomPad: 14,
  maxAspect: 1.35,
  heightFill: 0.88,
});

function measureBaseSprites(items, availH, maxAspect, heightFill) {
  const targetH = availH * heightFill;
  const maxSpriteW = targetH * maxAspect;
  return items.map((it) => {
    const sw = num(it?.sw, 0) > 0 ? it.sw : 100;
    const sh = num(it?.sh, 0) > 0 ? it.sh : 100;
    const scale = Math.min(targetH / sh, maxSpriteW / sw);
    const coreLeft = Number.isFinite(it?.coreLeft) ? Math.max(0, Math.min(0.45, it.coreLeft)) : 0;
    const coreRight = Number.isFinite(it?.coreRight) ? Math.max(0.55, Math.min(1, it.coreRight)) : 1;
    return {
      w: sw * scale,
      h: sh * scale,
      coreLeft,
      coreRight,
      leftProfile: Array.isArray(it?.leftProfile) ? it.leftProfile : null,
      rightProfile: Array.isArray(it?.rightProfile) ? it.rightProfile : null,
    };
  });
}

function computePairCushion(a, b, wA, hA, yA, wB, hB, yB) {
  if (!a.rightProfile || !b.leftProfile || a.rightProfile.length === 0 || b.leftProfile.length === 0) {
    return 0;
  }
  const overlapTop = Math.max(yA, yB);
  const overlapBot = Math.min(yA + hA, yB + hB);
  if (overlapBot <= overlapTop) return wA + wB;

  const bandsA = a.rightProfile.length;
  const bandsB = b.leftProfile.length;
  const samples = Math.max(bandsA, bandsB);
  let minAir = Infinity;

  for (let s = 0; s < samples; s++) {
    const y = overlapTop + ((s + 0.5) / samples) * (overlapBot - overlapTop);
    const idxA = Math.min(bandsA - 1, Math.max(0, Math.floor(((y - yA) / hA) * bandsA)));
    const idxB = Math.min(bandsB - 1, Math.max(0, Math.floor(((y - yB) / hB) * bandsB)));

    // Check ±1 vertical band neighborhood so diagonally close tips keep clearance too
    let rA = 0;
    for (let d = -1; d <= 1; d++) {
      const k = idxA + d;
      if (k >= 0 && k < bandsA && a.rightProfile[k] > rA) rA = a.rightProfile[k];
    }
    let lB = 1;
    for (let d = -1; d <= 1; d++) {
      const k = idxB + d;
      if (k >= 0 && k < bandsB && b.leftProfile[k] < lB) lB = b.leftProfile[k];
    }

    if (rA > 0 && lB < 1) {
      const air = (1 - rA) * wA + lB * wB;
      if (air < minAir) minAir = air;
    }
  }

  return Number.isFinite(minAir) ? minAir : 0;
}

function layoutRowAtScale(base, availH, areaTop, shrink, optGap, minClearance) {
  const sized = base.map((b) => {
    const w = b.w * shrink;
    const h = b.h * shrink;
    const y = areaTop + (availH - h) / 2;
    return { ...b, w, h, y };
  });
  const gaps = [];
  let totalW = 0;
  for (let i = 0; i < sized.length; i++) {
    totalW += sized[i].w;
    if (i < sized.length - 1) {
      const a = sized[i];
      const b = sized[i + 1];
      const leftTail = (1 - a.coreRight) * a.w;
      const rightTail = b.coreLeft * b.w;
      const opticalGap = optGap - leftTail - rightTail;
      const cushion = computePairCushion(a, b, a.w, a.h, a.y, b.w, b.h, b.y);
      const safeGap = minClearance - cushion;
      const g = Math.max(safeGap, opticalGap);
      gaps.push(g);
      totalW += g;
    }
  }
  return { sized, gaps, totalW };
}

/**
 * Computes a single shared scale multiplier (<= 1) across all cards in the graphic
 * so the same Pokémon sprite renders at the exact same size on every card.
 * cardRows: [{ cardBounds, topSlotHeight, items: [{ sw, sh, coreLeft?, coreRight?, leftProfile?, rightProfile? }] }]
 */
export function computeGlobalSpriteScale(cardRows, opts = {}) {
  if (!Array.isArray(cardRows) || cardRows.length === 0) return 1;
  const { minGap, minClearance, padX, topPad, bottomPad, maxAspect, heightFill } = { ...SPRITE_ROW_DEFAULTS, ...opts };
  let globalShrink = 1;
  for (const row of cardRows) {
    const items = row?.items;
    const b = row?.cardBounds;
    if (!b || !Array.isArray(items) || items.length === 0) continue;
    const innerW = num(b.width, 0) - 2 * padX;
    const availH = num(b.height, 0) - Math.max(0, num(row.topSlotHeight, 0)) - topPad - bottomPad;
    if (!(innerW > 0) || !(availH > 0)) continue;
    const base = measureBaseSprites(items, availH, maxAspect, heightFill);
    const areaTop = num(b.y ?? b.top, 0) + Math.max(0, num(row.topSlotHeight, 0)) + topPad;
    if (layoutRowAtScale(base, availH, areaTop, globalShrink, minGap, minClearance).totalW <= innerW) {
      continue;
    }
    let lo = 0.1;
    let hi = globalShrink;
    for (let iter = 0; iter < 14; iter++) {
      const mid = (lo + hi) / 2;
      if (layoutRowAtScale(base, availH, areaTop, mid, minGap, minClearance).totalW <= innerW) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    globalShrink = Math.min(globalShrink, lo);
  }
  return globalShrink;
}

/**
 * Dynamically sizes and positions sprites from their tight (trimmed) silhouettes
 * and optical body bounds so that all sprites share a balanced visual scale and
 * have EQUAL optical horizontal spacing between every adjacent pair without touching.
 * Pass `scaleMultiplier` from computeGlobalSpriteScale() to keep sizes identical across all cards.
 */
export function computeEqualGapSpriteRow(cardBounds, topSlotHeight, items, opts = {}) {
  if (!cardBounds || !Array.isArray(items) || items.length === 0) return [];
  const { minGap, maxGap, minClearance, padX, topPad, bottomPad, maxAspect, heightFill, scaleMultiplier } = {
    ...SPRITE_ROW_DEFAULTS,
    ...opts,
  };
  const x = num(cardBounds.x ?? cardBounds.left, 0);
  const y = num(cardBounds.y ?? cardBounds.top, 0);
  const width = num(cardBounds.width, 0);
  const height = num(cardBounds.height, 0);
  const innerW = width - 2 * padX;
  const areaTop = y + Math.max(0, num(topSlotHeight, 0)) + topPad;
  const availH = y + height - bottomPad - areaTop;
  if (!(innerW > 0) || !(availH > 0)) return [];

  const n = items.length;
  const base = measureBaseSprites(items, availH, maxAspect, heightFill);
  let shrink = Number.isFinite(scaleMultiplier) && scaleMultiplier > 0 ? Math.min(1, scaleMultiplier) : 1;

  // Ensure row fits at minGap even if caller didn't pre-compute global scale
  if (layoutRowAtScale(base, availH, areaTop, shrink, minGap, minClearance).totalW > innerW) {
    let lo = 0.1;
    let hi = shrink;
    for (let iter = 0; iter < 14; iter++) {
      const mid = (lo + hi) / 2;
      if (layoutRowAtScale(base, availH, areaTop, mid, minGap, minClearance).totalW <= innerW) lo = mid;
      else hi = mid;
    }
    shrink = lo;
  }

  // Expand optical gap evenly up to maxGap to fill available width
  let optGap = minGap;
  if (n > 1) {
    if (layoutRowAtScale(base, availH, areaTop, shrink, maxGap, minClearance).totalW <= innerW) {
      optGap = maxGap;
    } else {
      let lo = minGap;
      let hi = maxGap;
      for (let iter = 0; iter < 14; iter++) {
        const mid = (lo + hi) / 2;
        if (layoutRowAtScale(base, availH, areaTop, shrink, mid, minClearance).totalW <= innerW) lo = mid;
        else hi = mid;
      }
      optGap = lo;
    }
  }

  const { sized, gaps, totalW } = layoutRowAtScale(base, availH, areaTop, shrink, optGap, minClearance);

  // Center visually by core body bounds (clamped so actual pixels stay within padX)
  const firstCoreInset = sized[0].coreLeft * sized[0].w;
  const lastCoreInset = (1 - sized[n - 1].coreRight) * sized[n - 1].w;
  const coreCenterOffset = (lastCoreInset - firstCoreInset) / 2;
  const minX = x + padX;
  const maxX = x + width - padX - totalW;
  let curX = x + (width - totalW) / 2 + coreCenterOffset;
  if (maxX >= minX) curX = Math.max(minX, Math.min(maxX, curX));
  else curX = x + (width - totalW) / 2;

  return sized.map((s, idx) => {
    const dx = curX;
    const gap = idx < gaps.length ? gaps[idx] : 0;
    curX += s.w + gap;
    return {
      x: dx,
      y: s.y,
      width: s.w,
      height: s.h,
      centerX: dx + s.w / 2,
      size: Math.min(s.w, s.h),
      slotWidth: s.w,
      gap,
      optGap,
    };
  });
}
