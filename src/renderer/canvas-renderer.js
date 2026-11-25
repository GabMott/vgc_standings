import {
  CANVAS_WIDTH, HEADER_HEIGHT, SEPARATOR_HEIGHT, STANDINGS_CARD_RADIUS, STANDINGS_CARD_BORDER,
  STANDINGS_PLACING_BADGE_SIZE, STANDINGS_PLACING_BADGE_BORDER, STANDINGS_PLACING_BADGE_RADIUS,
  SIGNATURE_RESERVED_HEIGHT, CARD_COLOR, TEXT_COLOR, MUTED_COLOR, SIGNATURE_BORDER_COLOR, PLACEMENT_COLORS,
  computeLayout, computeRhombusGeometry, computeSpriteSlots, fitTextToWidth,
} from '../core/layout.js';
import { formatEventTitle, formatEventSubtitle } from '../core/schema.js';
import { parsePlacingRank } from '../core/validation.js';

const FONT = '"Helvetica Neue", Arial, sans-serif';

/** Loads an image; resolves null on error/timeout. Never throws. */
export function loadImage(src, { timeoutMs = 10000 } = {}) {
  return new Promise((resolve) => {
    try {
      if (typeof src !== 'string' || !src || typeof Image === 'undefined') return resolve(null);
      const img = new Image();
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(v);
      };
      const timer = setTimeout(() => finish(null), timeoutMs);
      img.onload = () => finish(img.naturalWidth > 0 ? img : null);
      img.onerror = () => finish(null);
      if (/^https?:/i.test(src)) img.crossOrigin = 'anonymous';
      img.src = src;
    } catch {
      resolve(null);
    }
  });
}

export function drawRoundedRectPath(ctx, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(Number(r) || 0, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, rad);
    return;
  }
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function imageSize(img) {
  const w = img?.naturalWidth || img?.videoWidth || img?.width || 0;
  const h = img?.naturalHeight || img?.videoHeight || img?.height || 0;
  return w > 0 && h > 0 ? { w, h } : null;
}

function drawFit(ctx, img, dx, dy, dw, dh, cover) {
  const s = imageSize(img);
  if (!s || !(dw > 0) || !(dh > 0)) return false;
  const scale = cover ? Math.max(dw / s.w, dh / s.h) : Math.min(dw / s.w, dh / s.h);
  const w = s.w * scale;
  const h = s.h * scale;
  const ox = dx + (dw - w) / 2;
  const oy = dy + (dh - h) / 2;
  try {
    if (cover) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(dx, dy, dw, dh);
      ctx.clip();
      ctx.drawImage(img, ox, oy, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(img, ox, oy, w, h);
    }
    return true;
  } catch {
    return false;
  }
}

export const drawImageCover = (ctx, img, dx, dy, dw, dh) => drawFit(ctx, img, dx, dy, dw, dh, true);
export const drawImageContain = (ctx, img, dx, dy, dw, dh) => drawFit(ctx, img, dx, dy, dw, dh, false);

/** Wraps a context so missing methods (mock contexts) are no-ops. */
function safeContext(ctx) {
  return new Proxy(ctx, {
    get(target, prop) {
      const v = target[prop];
      if (typeof v === 'function') return v.bind(target);
      if (v === undefined) {
        if (prop === 'measureText') return (t) => ({ width: String(t).length * 8 });
        if (prop === 'createLinearGradient') return () => ({ addColorStop() {} });
        return () => {};
      }
      return v;
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  });
}

function section(fn) {
  try {
    fn();
  } catch {
    /* rendering must never throw */
  }
}

function setFont(ctx, size, weight = 'bold') {
  ctx.font = `${weight} ${Math.round(size)}px ${FONT}`;
}

function fitText(ctx, text, maxWidth, maxFontSize, minFontSize, weight = 'bold') {
  return fitTextToWidth(text, {
    maxWidth, maxFontSize, minFontSize,
    measureText: (t, size) => {
      setFont(ctx, size, weight);
      return ctx.measureText(t)?.width ?? 0;
    },
  });
}

function drawFitted(ctx, text, x, y, maxWidth, maxFont, minFont, { color = TEXT_COLOR, align = 'left', weight = 'bold' } = {}) {
  const fit = fitText(ctx, text, maxWidth, maxFont, minFont, weight);
  if (!fit.text) return fit;
  setFont(ctx, fit.fontSize, weight);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(fit.text, x, y);
  return fit;
}

function drawGradientRect(ctx, x, y, w, h, c0, c1, horizontal = false) {
  const g = ctx.createLinearGradient(x, y, horizontal ? x + w : x, horizontal ? y : y + h);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

export function drawPokeball(ctx, cx, cy, r, { top = '#E3463C', bottom = '#F4F4F4', line = '#1A1A1A', alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = top;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI);
  ctx.closePath();
  ctx.fillStyle = bottom;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.strokeStyle = line;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.moveTo(cx - r, cy);
  ctx.lineTo(cx + r, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = bottom;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawPattern(ctx, pattern, color, x, y, w, h) {
  if (pattern === 'none' || !(w > 0) || !(h > 0)) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (pattern === 'pokeball') {
    const step = 150;
    for (let row = 0, py = y + 60; py < y + h + step; row++, py += step) {
      for (let px = x + (row % 2 ? step / 2 : 0); px < x + w + step; px += step) {
        drawPokeball(ctx, px, py, 34, { top: color, bottom: color, line: color, alpha: 0.06 });
      }
    }
  } else if (pattern === 'grid') {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.1;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let gx = x; gx <= x + w; gx += 60) { ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); }
    for (let gy = y; gy <= y + h; gy += 60) { ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); }
    ctx.stroke();
  } else if (pattern === 'diagonal') {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.08;
    ctx.lineWidth = 16;
    ctx.beginPath();
    for (let d = -h; d < w; d += 70) { ctx.moveTo(x + d, y + h); ctx.lineTo(x + d + h, y); }
    ctx.stroke();
  }
  ctx.restore();
}

function placementColor(placing) {
  const rank = parsePlacingRank(placing);
  return PLACEMENT_COLORS[rank] ?? PLACEMENT_COLORS.default;
}

function drawHeader(ctx, theme, assets, width, headerH) {
  const c = theme.colors;
  if (!drawImageCover(ctx, assets.header, 0, 0, width, headerH)) {
    drawGradientRect(ctx, 0, 0, width, headerH, c.headerStart, c.headerEnd);
    drawPattern(ctx, theme.pattern, c.patternColor, 0, 0, width, headerH);
  }
  const iconSize = 220;
  const iy = (headerH - iconSize) / 2 - 20;
  drawImageContain(ctx, assets.vgcIcon, 40, iy, iconSize, iconSize);
  drawImageContain(ctx, assets.localIcon, width - 40 - iconSize, iy, iconSize, iconSize);
}

function drawBanner(ctx, theme, tournament, geo) {
  const c = theme.colors;
  ctx.save();
  ctx.beginPath();
  geo.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = c.bannerFill;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = c.bannerBorder;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();

  const cx = (geo.points[0].x + geo.points[1].x) / 2;
  const titleY = geo.topY + (geo.dividerY - geo.topY) / 2;
  drawFitted(ctx, tournament.titleText, cx, titleY, geo.textMaxWidth, 44, 18, { color: c.text, align: 'center' });
  const half = geo.textMaxWidth / 2;
  ctx.strokeStyle = c.accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - half, geo.dividerY);
  ctx.lineTo(cx + half, geo.dividerY);
  ctx.stroke();
  drawFitted(ctx, tournament.subtitleText, cx, geo.dividerY + (geo.bottomY - geo.dividerY) / 2, geo.textMaxWidth, 30, 14, {
    color: c.muted, align: 'center', weight: 'normal',
  });
}

function drawSpriteFallback(ctx, slot, name, theme) {
  const r = slot.size * 0.3;
  drawPokeball(ctx, slot.centerX, slot.y + slot.size * 0.38, r, { top: theme.colors.accent });
  const pillH = Math.max(14, slot.size * 0.22);
  const pillW = Math.max(20, slot.slotWidth - 8);
  const py = slot.y + slot.size - pillH;
  drawRoundedRectPath(ctx, slot.centerX - pillW / 2, py, pillW, pillH, pillH / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();
  drawFitted(ctx, name || '?', slot.centerX, py + pillH / 2, pillW - 8, pillH * 0.7, 8, { align: 'center' });
}

function drawCard(ctx, entry, bounds, theme, assets) {
  const c = theme.colors;
  const { x, y, width, height } = bounds;
  const color = placementColor(entry.placing);
  drawRoundedRectPath(ctx, x, y, width, height, STANDINGS_CARD_RADIUS);
  ctx.fillStyle = c.card || CARD_COLOR;
  ctx.fill();
  ctx.lineWidth = STANDINGS_CARD_BORDER;
  ctx.strokeStyle = color;
  ctx.stroke();

  const topH = Math.round(height * 0.38);
  const badge = STANDINGS_PLACING_BADGE_SIZE;
  const badgeW = badge + STANDINGS_PLACING_BADGE_BORDER;
  const bx = x + 14;
  const by = y + 12;
  drawRoundedRectPath(ctx, bx, by, badgeW, badge, STANDINGS_PLACING_BADGE_RADIUS);
  ctx.fillStyle = color;
  ctx.fill();
  drawFitted(ctx, entry.placing || '-', bx + badgeW / 2, by + badge / 2, badgeW - 10, 28, 10, { color: '#101010', align: 'center' });

  const tx = bx + badgeW + 14;
  const maxW = x + width - 16 - tx;
  const hasHandle = Boolean(entry.handle);
  const nameFit = drawFitted(ctx, entry.name || 'Unknown Trainer', tx, by + (hasHandle ? 14 : badge / 2), maxW, 30, 12, { color: c.text });
  if (hasHandle) {
    const room = Math.max(0, maxW - 0);
    drawFitted(ctx, entry.handle, tx, by + 40, room, 18, 10, { color: c.muted, weight: 'normal' });
  }
  void nameFit;

  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 16, y + topH + 6);
  ctx.lineTo(x + width - 16, y + topH + 6);
  ctx.stroke();

  const mons = Array.isArray(entry.pokemon) ? entry.pokemon : [];
  const slots = computeSpriteSlots(bounds, topH + 6, mons.length);
  slots.forEach((slot, i) => {
    const mon = mons[i] ?? {};
    const key = mon.speciesSlug ? `${mon.speciesSlug}${mon.shiny ? ':shiny' : ''}` : '';
    const img = assets.sprites?.[mon.spriteUrl] ?? assets.sprites?.[key] ?? null;
    if (!drawImageContain(ctx, img, slot.centerX - slot.size / 2, slot.y, slot.size, slot.size)) {
      drawSpriteFallback(ctx, slot, mon.name || mon.speciesSlug, theme);
    }
  });
}

function drawSignature(ctx, theme, text, width, height) {
  const h = 50;
  const y = height - SIGNATURE_RESERVED_HEIGHT / 2 - h / 2 - 5;
  ctx.font = `normal 22px ${FONT}`;
  const tw = Math.min(width - 100, (ctx.measureText(text)?.width ?? 300) + 60);
  const x = (width - tw) / 2;
  drawRoundedRectPath(ctx, x, y, tw, h, 14);
  ctx.fillStyle = theme.colors.card || CARD_COLOR;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = theme.colors.signatureBorder || SIGNATURE_BORDER_COLOR;
  ctx.stroke();
  drawFitted(ctx, text, width / 2, y + h / 2, tw - 30, 22, 10, { color: theme.colors.muted || MUTED_COLOR, align: 'center', weight: 'normal' });
}

/**
 * Draws the full standings graphic. Never throws.
 * assets: { header, vgcIcon, localIcon, background, sprites: { [spriteUrl | slug[:shiny]]: Image } }
 * Returns { canvasWidth, canvasHeight, layout }.
 */
export function renderStandingsCanvas(canvasOrCtx, tournament, theme, assets = {}, options = {}) {
  const t = tournament && typeof tournament === 'object' ? tournament : {};
  const a = assets && typeof assets === 'object' ? assets : {};
  const th = {
    pattern: 'none', ...(theme ?? {}),
    colors: {
      headerStart: '#101A2E', headerEnd: '#24365A', bgStart: '#0B1220', bgEnd: '#16233D', card: CARD_COLOR,
      text: TEXT_COLOR, muted: MUTED_COLOR, accent: SIGNATURE_BORDER_COLOR, patternColor: '#FFFFFF',
      bannerFill: '#101A2E', bannerBorder: SIGNATURE_BORDER_COLOR, signatureBorder: SIGNATURE_BORDER_COLOR,
      ...(theme?.colors ?? {}),
    },
  };
  const standings = Array.isArray(t.standings) ? t.standings.filter((e) => e && typeof e === 'object') : [];
  const signature = typeof t.signature === 'string' ? t.signature.trim() : '';
  const width = options?.width ?? CANVAS_WIDTH;
  const layout = computeLayout({
    playerCount: standings.length, imageWidth: width, headerHeight: options?.headerHeight ?? HEADER_HEIGHT,
    hasSignature: Boolean(signature),
  });
  const result = { canvasWidth: layout.canvasWidth, canvasHeight: layout.canvasHeight, layout };

  let ctx;
  try {
    const raw = canvasOrCtx && typeof canvasOrCtx.getContext === 'function' ? canvasOrCtx : null;
    if (raw) {
      raw.width = layout.canvasWidth;
      raw.height = layout.canvasHeight;
    }
    ctx = safeContext(raw ? raw.getContext('2d') : canvasOrCtx);
  } catch {
    return result;
  }

  const W = layout.canvasWidth;
  const H = layout.canvasHeight;
  const headerH = options?.headerHeight ?? HEADER_HEIGHT;
  const colors = th.colors;

  section(() => { ctx.clearRect(0, 0, W, H); });
  section(() => {
    const bgY = headerH;
    if (!drawImageCover(ctx, a.background, 0, bgY, W, H - bgY)) {
      drawGradientRect(ctx, 0, bgY, W, H - bgY, colors.bgStart, colors.bgEnd);
      drawPattern(ctx, th.pattern, colors.patternColor, 0, bgY, W, H - bgY);
    }
  });
  section(() => drawHeader(ctx, th, a, W, headerH));
  section(() => {
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, colors.headerStart);
    g.addColorStop(0.5, colors.accent);
    g.addColorStop(1, colors.headerStart);
    ctx.fillStyle = g;
    ctx.fillRect(0, headerH, W, SEPARATOR_HEIGHT / 5);
  });
  section(() => {
    const geo = computeRhombusGeometry(W, headerH);
    drawBanner(ctx, th, {
      titleText: options?.title ?? formatEventTitle(t.event),
      subtitleText: options?.subtitle ?? formatEventSubtitle(t.event),
    }, geo);
  });
  if (standings.length === 0) {
    section(() => {
      drawFitted(ctx, 'No standings yet', W / 2, layout.contentTop + 120, W - 200, 48, 20, { color: colors.muted, align: 'center' });
    });
  } else {
    standings.forEach((entry, i) => {
      section(() => drawCard(ctx, entry, layout.cards[i], th, a));
    });
  }
  if (signature) section(() => drawSignature(ctx, th, signature, W, H));
  return result;
}
