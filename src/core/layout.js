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
  const bottomY = h + RHOMBUS_DRAG_DOWN;
  const topY = bottomY - RHOMBUS_HEIGHT;
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
  baseHeight = BASE_CANVAS_HEIGHT,
  headerHeight = HEADER_HEIGHT,
  hasSignature = true,
} = {}) {
  const count = Math.max(0, Math.floor(num(playerCount, 0)));
  const canvasWidth = Math.max(1, num(imageWidth, CANVAS_WIDTH));
  const baseH = Math.max(1, num(baseHeight, BASE_CANVAS_HEIGHT));
  const contentTop = Math.max(0, num(headerHeight, HEADER_HEIGHT)) + SEPARATOR_HEIGHT + STANDINGS_GAP;
  const reserved = (hasSignature ? SIGNATURE_RESERVED_HEIGHT : 0) + STANDINGS_GAP;

  if (count === 0) {
    return {
      canvasWidth, canvasHeight: baseH, columns: 0, rows: 0, cardWidth: 0, cardHeight: 0,
      contentTop, contentBottom: Math.max(contentTop, baseH - reserved), cards: [],
    };
  }

  const columns = count <= 2 ? 1 : 2;
  const rows = Math.ceil(count / columns);
  const margin = columns === 1 ? 2 * STANDINGS_GAP : STANDINGS_GAP;
  const cardWidth = Math.max(1, (canvasWidth - 2 * margin - (columns - 1) * STANDINGS_GAP) / columns);

  const available = baseH - contentTop - reserved;
  let cardHeight = Math.min(STANDINGS_MAX_CARD_HEIGHT, (available - (rows - 1) * STANDINGS_GAP) / rows);
  let canvasHeight = baseH;
  if (cardHeight < STANDINGS_MIN_CARD_HEIGHT) {
    cardHeight = STANDINGS_MIN_CARD_HEIGHT;
    canvasHeight = Math.ceil(contentTop + rows * cardHeight + (rows - 1) * STANDINGS_GAP + reserved);
  }
  cardHeight = Math.floor(cardHeight);

  const contentBottom = contentTop + rows * cardHeight + (rows - 1) * STANDINGS_GAP;
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
  const innerW = width - 2 * pad;
  const availH = height - Math.max(0, num(topSlotHeight, 0)) - pad;
  const slotWidth = innerW / n;
  const size = Math.floor(Math.min(slotWidth, availH));
  if (!(size > 0) || !(slotWidth > 0)) return [];
  const slotY = y + height - pad - size;
  return Array.from({ length: n }, (_, i) => ({
    centerX: x + pad + slotWidth * (i + 0.5),
    y: slotY,
    size,
    slotWidth,
  }));
}
