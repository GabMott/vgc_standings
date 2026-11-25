import {
  CANVAS_WIDTH, HEADER_HEIGHT, SEPARATOR_HEIGHT, STANDINGS_CARD_RADIUS, STANDINGS_CARD_BORDER,
  STANDINGS_PLACING_BADGE_SIZE, STANDINGS_PLACING_BADGE_BORDER, STANDINGS_PLACING_BADGE_RADIUS,
  SIGNATURE_RESERVED_HEIGHT, CARD_COLOR, TEXT_COLOR, MUTED_COLOR, SIGNATURE_BORDER_COLOR, PLACEMENT_COLORS,
  computeLayout, computeRhombusGeometry, computeSpriteSlots, computeGlobalSpriteScale, computeEqualGapSpriteRow, fitTextToWidth,
} from '../core/layout.js';
import { formatEventTitle, formatEventSubtitle } from '../core/schema.js';
import { parsePlacingRank } from '../core/validation.js';

const FONT = '"Helvetica Neue", Arial, sans-serif';

export const REPO_WATERMARKS = Object.freeze([
  'github.com/JoshBell302',
  'github.com/GabMott',
]);

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
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop() {} });
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

export function drawPokeballSprite(ctx, cx, cy, r) {
  if (!(r > 0)) return;
  ctx.save();

  // Subtle drop shadow
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.08, r * 0.98, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
  ctx.fill();

  // Clip interior hemispheres & equator band to the sphere
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  // Top red dome with 3D shading
  const topGrad = ctx.createRadialGradient(cx - r * 0.32, cy - r * 0.38, r * 0.08, cx, cy, r * 1.15);
  topGrad.addColorStop(0, '#FF6052');
  topGrad.addColorStop(0.55, '#E33935');
  topGrad.addColorStop(1, '#9E1B1B');
  ctx.fillStyle = topGrad;
  ctx.fillRect(cx - r, cy - r, r * 2, r);

  // Bottom white dome with subtle cool shading
  const botGrad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.05, r * 0.1, cx, cy + r * 0.15, r * 1.15);
  botGrad.addColorStop(0, '#FFFFFF');
  botGrad.addColorStop(0.65, '#E8EEF5');
  botGrad.addColorStop(1, '#AEBACC');
  ctx.fillStyle = botGrad;
  ctx.fillRect(cx - r, cy, r * 2, r);

  // Soft glossy highlight on upper-left red dome
  ctx.save();
  ctx.translate(cx - r * 0.34, cy - r * 0.42);
  ctx.rotate(-0.55);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.24, r * 0.12, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
  ctx.fill();
  ctx.restore();

  // Equator band
  const bandH = Math.max(2, r * 0.17);
  ctx.fillStyle = '#1B202A';
  ctx.fillRect(cx - r, cy - bandH / 2, r * 2, bandH);
  ctx.restore();

  // Outer outline
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(1.5, r * 0.09);
  ctx.strokeStyle = '#1B202A';
  ctx.stroke();

  // Center button outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = '#1B202A';
  ctx.fill();

  // Center button white face
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.20, 0, Math.PI * 2);
  ctx.fillStyle = '#F7F9FC';
  ctx.fill();

  // Inner button accent ring
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.12, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(1, r * 0.04);
  ctx.strokeStyle = '#AEBACC';
  ctx.stroke();

  ctx.restore();
}

function drawBackdropPokeball(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-35 * Math.PI) / 180);
  ctx.fillStyle = color;

  // Base translucent disc
  ctx.globalAlpha = 0.19;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Brighter center button and lower annular crescent (matches Background DB.png)
  ctx.globalAlpha = 0.1;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.285, 0, Math.PI * 2);
  ctx.fill();

  const innerR = r * 0.43;
  const outerR = r * 0.85;
  const bandHalf = r * 0.07;
  const startOuter = Math.asin(Math.min(1, bandHalf / outerR));
  const endOuter = Math.PI - startOuter;
  const startInner = Math.asin(Math.min(1, bandHalf / innerR));
  const endInner = Math.PI - startInner;
  ctx.beginPath();
  ctx.arc(0, 0, outerR, startOuter, endOuter, false);
  ctx.arc(0, 0, innerR, endInner, startInner, true);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawPattern(ctx, pattern, color, x, y, w, h) {
  if (pattern === 'none' || !(w > 0) || !(h > 0)) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (pattern === 'pokeball') {
    // Clean 45° orthogonal diagonal lattice (exact horizontal/vertical symmetry)
    const step = 150;
    const radius = 60;
    const angle = Math.PI / 4;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const cx0 = x + w / 2;
    const cy0 = y + h / 2;
    const span = Math.ceil((Math.hypot(w, h) / 2 + radius + step) / step);
    for (let j = -span; j <= span; j++) {
      for (let i = -span; i <= span; i++) {
        const px = cx0 + (i * cos - j * sin) * step;
        const py = cy0 + (i * sin + j * cos) * step;
        if (px + radius < x || px - radius > x + w || py + radius < y || py - radius > y + h) {
          continue;
        }
        drawBackdropPokeball(ctx, px, py, radius, color);
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
  const iconMargin = 40;
  drawImageContain(ctx, assets.vgcIcon, iconMargin, iconMargin, iconSize, iconSize);
  drawImageContain(ctx, assets.localIcon, width - iconMargin - iconSize, iconMargin, iconSize, iconSize);
}

const spriteBoundsCache = new WeakMap();
let trimCanvas = null;

/**
 * Computes the tight non-transparent pixel bounding box { sx, sy, sw, sh },
 * optical core horizontal sidebearings (coreLeft, coreRight), and 24-band
 * horizontal silhouette profiles (leftProfile, rightProfile) of an image so
 * asymmetric sprites (e.g. Floette-Eternal, Raichu, Koraidon, Sneasler) get
 * equal optical spacing without ever touching.
 */
export function getSpriteTightBounds(img) {
  const s = imageSize(img);
  if (!s) return null;
  if (typeof img === 'object' && spriteBoundsCache.has(img)) {
    return spriteBoundsCache.get(img);
  }
  const full = { sx: 0, sy: 0, sw: s.w, sh: s.h, coreLeft: 0, coreRight: 1, leftProfile: null, rightProfile: null };
  try {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      return full;
    }
    if (!trimCanvas) trimCanvas = document.createElement('canvas');
    const maxDim = 128;
    const scale = Math.min(1, maxDim / Math.max(s.w, s.h));
    const tw = Math.max(1, Math.round(s.w * scale));
    const th = Math.max(1, Math.round(s.h * scale));
    trimCanvas.width = tw;
    trimCanvas.height = th;
    const tctx = trimCanvas.getContext('2d', { willReadFrequently: true });
    if (!tctx || typeof tctx.getImageData !== 'function') return full;
    tctx.clearRect(0, 0, tw, th);
    tctx.drawImage(img, 0, 0, tw, th);
    const data = tctx.getImageData(0, 0, tw, th).data;
    let minX = tw;
    let minY = th;
    let maxX = -1;
    let maxY = -1;
    let totalOpaque = 0;
    const colCounts = new Int32Array(tw);
    for (let py = 0; py < th; py++) {
      const rowOffset = py * tw * 4;
      for (let px = 0; px < tw; px++) {
        if (data[rowOffset + px * 4 + 3] > 12) {
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
          colCounts[px] += 1;
          totalOpaque += 1;
        }
      }
    }
    if (maxX < minX || maxY < minY || totalOpaque === 0) {
      spriteBoundsCache.set(img, full);
      return full;
    }

    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;

    // 4th–96th percentile horizontal pixel-mass edges (filters out wispy stems/tails/ribbons)
    const threshold = totalOpaque * 0.04;
    let acc = 0;
    let pLeft = minX;
    for (let px = minX; px <= maxX; px++) {
      acc += colCounts[px];
      if (acc >= threshold) {
        pLeft = px;
        break;
      }
    }
    acc = 0;
    let pRight = maxX;
    for (let px = maxX; px >= minX; px--) {
      acc += colCounts[px];
      if (acc >= threshold) {
        pRight = px;
        break;
      }
    }
    const coreLeft = Math.max(0, Math.min(0.4, (pLeft - minX) / bw));
    const coreRight = Math.max(0.6, Math.min(1, (pRight - minX + 1) / bw));

    // 24-band left & right silhouette contours for exact non-overlap kerning
    const BANDS = 24;
    const leftProfile = new Array(BANDS).fill(1);
    const rightProfile = new Array(BANDS).fill(0);
    for (let py = minY; py <= maxY; py++) {
      const band = Math.min(BANDS - 1, Math.floor(((py - minY) / bh) * BANDS));
      const rowOffset = py * tw * 4;
      for (let px = minX; px <= maxX; px++) {
        if (data[rowOffset + px * 4 + 3] > 12) {
          const normL = (px - minX) / bw;
          const normR = (px - minX + 1) / bw;
          if (normL < leftProfile[band]) leftProfile[band] = normL;
          if (normR > rightProfile[band]) rightProfile[band] = normR;
        }
      }
    }

    const padSrc = Math.ceil(1 / scale);
    const sx = Math.max(0, Math.floor(minX / scale) - padSrc);
    const sy = Math.max(0, Math.floor(minY / scale) - padSrc);
    const ex = Math.min(s.w, Math.ceil((maxX + 1) / scale) + padSrc);
    const ey = Math.min(s.h, Math.ceil((maxY + 1) / scale) + padSrc);
    const tight = {
      sx,
      sy,
      sw: Math.max(1, ex - sx),
      sh: Math.max(1, ey - sy),
      coreLeft,
      coreRight,
      leftProfile,
      rightProfile,
    };
    spriteBoundsCache.set(img, tight);
    return tight;
  } catch {
    return full;
  }
}

function drawSeparatedBannerLine(ctx, text, cx, y, maxWidth, maxFont, minFont, { color = TEXT_COLOR, weight = 'bold' } = {}) {
  const str = typeof text === 'string' ? text.trim() : '';
  if (!str) return;
  const parts = str.split(/\s*•\s*/).filter(Boolean);
  if (parts.length <= 1) {
    drawFitted(ctx, str, cx, y, maxWidth, maxFont, minFont, { color, align: 'center', weight });
    return;
  }

  setFont(ctx, maxFont, weight);
  const partWidths = parts.map((p) => ctx.measureText(p)?.width ?? 0);
  const bulletW = ctx.measureText('•')?.width ?? maxFont * 0.35;
  const numSeps = parts.length - 1;
  const minPad = maxFont * 0.35;
  const maxPad = maxFont * 0.95;
  const minTotal = partWidths.reduce((a, b) => a + b, 0) + numSeps * (bulletW + 2 * minPad);

  if (minTotal > maxWidth) {
    drawFitted(ctx, str, cx, y, maxWidth, maxFont, minFont, { color, align: 'center', weight });
    return;
  }

  const rawContent = partWidths.reduce((a, b) => a + b, 0) + numSeps * bulletW;
  const spare = Math.max(0, maxWidth - rawContent);
  const padPerSide = Math.max(minPad, Math.min(maxPad, (spare * 0.3) / (2 * numSeps)));
  const totalWidth = rawContent + numSeps * 2 * padPerSide;

  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let curX = cx - totalWidth / 2;
  parts.forEach((part, idx) => {
    ctx.fillText(part, curX, y);
    curX += partWidths[idx];
    if (idx < numSeps) {
      curX += padPerSide;
      ctx.fillText('•', curX, y);
      curX += bulletW + padPerSide;
    }
  });
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
  drawSeparatedBannerLine(ctx, tournament.titleText, cx, titleY, geo.textMaxWidth, 44, 18, { color: c.text });
  const half = geo.textMaxWidth / 2;
  ctx.strokeStyle = c.accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - half, geo.dividerY);
  ctx.lineTo(cx + half, geo.dividerY);
  ctx.stroke();
  drawSeparatedBannerLine(ctx, tournament.subtitleText, cx, geo.dividerY + (geo.bottomY - geo.dividerY) / 2, geo.textMaxWidth, 30, 14, {
    color: c.muted, weight: 'normal',
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

function cardDividerOffset(cardHeight) {
  return Math.max(STANDINGS_PLACING_BADGE_SIZE + 18, Math.round(cardHeight * 0.34));
}

function resolveCardSprites(entry, assets) {
  const mons = Array.isArray(entry.pokemon) ? entry.pokemon : [];
  if (entry.redactTeam === true) {
    return Array.from({ length: 6 }, () => ({
      mon: { name: 'Poké Ball', speciesSlug: 'poke-ball' },
      img: null,
      tight: null,
      filler: 'pokeball',
    }));
  }
  return mons.map((mon) => {
    const m = mon ?? {};
    const key = m.speciesSlug ? `${m.speciesSlug}${m.shiny ? ':shiny' : ''}` : '';
    const img = assets.sprites?.[m.spriteUrl] ?? assets.sprites?.[key] ?? null;
    const tight = getSpriteTightBounds(img);
    return { mon: m, img, tight, filler: null };
  });
}

function spriteMetricsFromResolved(r) {
  return r.tight
    ? {
        sw: r.tight.sw,
        sh: r.tight.sh,
        coreLeft: r.tight.coreLeft,
        coreRight: r.tight.coreRight,
        leftProfile: r.tight.leftProfile,
        rightProfile: r.tight.rightProfile,
      }
    : { sw: 100, sh: 100 };
}

function drawCard(ctx, entry, bounds, theme, assets, { resolvedMons, globalSpriteScale = 1 } = {}) {
  const c = theme.colors;
  const { x, y, width, height } = bounds;
  const color = placementColor(entry.placing);
  drawRoundedRectPath(ctx, x, y, width, height, STANDINGS_CARD_RADIUS);
  ctx.fillStyle = c.card || CARD_COLOR;
  ctx.fill();
  ctx.lineWidth = STANDINGS_CARD_BORDER;
  ctx.strokeStyle = color;
  ctx.stroke();

  const badge = STANDINGS_PLACING_BADGE_SIZE;
  const badgeW = badge + STANDINGS_PLACING_BADGE_BORDER;
  const bx = x + 14;
  const by = y + 10;
  const dividerOffset = cardDividerOffset(height);
  drawRoundedRectPath(ctx, bx, by, badgeW, badge, STANDINGS_PLACING_BADGE_RADIUS);
  ctx.fillStyle = color;
  ctx.fill();
  drawFitted(ctx, entry.placing || '-', bx + badgeW / 2, by + badge / 2, badgeW - 10, 28, 10, { color: '#101010', align: 'center' });

  const tx = bx + badgeW + 14;
  const maxW = x + width - 16 - tx;
  const displayName = entry.redactName === true ? 'Trainer' : (entry.name || 'Unknown Trainer');
  const displayHandle = entry.redactName === true ? '' : (entry.handle || '');
  const hasHandle = Boolean(displayHandle);
  const nameFit = drawFitted(ctx, displayName, tx, by + (hasHandle ? 14 : badge / 2), maxW, 30, 12, { color: c.text });
  if (hasHandle) {
    const room = Math.max(0, maxW - 0);
    drawFitted(ctx, displayHandle, tx, by + 38, room, 18, 10, { color: c.muted, weight: 'normal' });
  }
  void nameFit;

  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 16, y + dividerOffset);
  ctx.lineTo(x + width - 16, y + dividerOffset);
  ctx.stroke();

  const items = resolvedMons ?? resolveCardSprites(entry, assets);
  const slots = computeEqualGapSpriteRow(
    bounds,
    dividerOffset,
    items.map(spriteMetricsFromResolved),
    { scaleMultiplier: globalSpriteScale },
  );
  slots.forEach((slot, i) => {
    const { mon, img, tight, filler } = items[i];
    let drew = false;
    if (filler === 'pokeball') {
      const r = Math.min(slot.width, slot.height) * 0.41;
      drawPokeballSprite(ctx, slot.x + slot.width / 2, slot.y + slot.height / 2, r);
      drew = true;
    } else if (img && tight) {
      try {
        ctx.drawImage(img, tight.sx, tight.sy, tight.sw, tight.sh, slot.x, slot.y, slot.width, slot.height);
        drew = true;
      } catch {
        drew = false;
      }
    }
    if (!drew) {
      drawSpriteFallback(ctx, slot, mon.name || mon.speciesSlug, theme);
    }
  });
}

function drawWatermarks(ctx, theme, lines, width, height) {
  const clean = (Array.isArray(lines) ? lines : []).filter((l) => typeof l === 'string' && l.trim());
  if (clean.length === 0) return;
  const padX = 24;
  const padBottom = 14;
  const lineGap = 19;
  const maxWidth = Math.max(220, Math.floor(width * 0.38));
  ctx.save();
  ctx.globalAlpha = 0.58;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;
  clean.forEach((line, idx) => {
    const offsetFromBottom = (clean.length - 1 - idx) * lineGap;
    const y = height - padBottom - 7 - offsetFromBottom;
    drawFitted(ctx, line, padX, y, maxWidth, 15, 10, {
      color: theme.colors.text || TEXT_COLOR,
      align: 'left',
      weight: 'normal',
    });
  });
  ctx.restore();
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
  const width = options?.width ?? CANVAS_WIDTH;
  const layout = computeLayout({
    playerCount: standings.length, imageWidth: width, headerHeight: options?.headerHeight ?? HEADER_HEIGHT,
    hasSignature: false,
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
      drawGradientRect(ctx, 0, bgY, W, H - bgY, colors.bgStart, colors.bgEnd, th.pattern === 'pokeball');
      drawPattern(ctx, th.pattern, colors.patternColor, 0, bgY, W, H - bgY);
    }
  });
  section(() => drawHeader(ctx, th, a, W, headerH));
  section(() => {
    const sepH = SEPARATOR_HEIGHT / 5;
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, colors.headerStart);
    g.addColorStop(0.5, colors.accent);
    g.addColorStop(1, colors.headerStart);
    ctx.fillStyle = g;
    ctx.fillRect(0, headerH - sepH / 2, W, sepH);
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
      drawFitted(ctx, 'No standings yet', W / 2, (layout.contentTop + layout.contentBottom) / 2, W - 200, 48, 20, { color: colors.muted, align: 'center' });
    });
  } else {
    const resolvedByCard = standings.map((entry) => resolveCardSprites(entry, a));
    const globalSpriteScale = computeGlobalSpriteScale(
      standings.map((_, i) => ({
        cardBounds: layout.cards[i],
        topSlotHeight: cardDividerOffset(layout.cards[i].height),
        items: resolvedByCard[i].map(spriteMetricsFromResolved),
      })),
    );
    standings.forEach((entry, i) => {
      section(() => drawCard(ctx, entry, layout.cards[i], th, a, {
        resolvedMons: resolvedByCard[i],
        globalSpriteScale,
      }));
    });
  }
  const watermarks = options?.watermarks !== undefined ? options.watermarks : REPO_WATERMARKS;
  section(() => drawWatermarks(ctx, th, watermarks, W, H));
  return result;
}
