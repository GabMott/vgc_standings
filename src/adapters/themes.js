import { normalizeHexColor } from '../core/validation.js';

export const DEFAULT_RAW_GITHUB_ASSETS = 'https://raw.githubusercontent.com/GabMott/vgc_standings/main/assets/';

export function getDefaultAssetBaseUrl(loc = globalThis.location) {
  try {
    const host = String(loc?.hostname ?? '').toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return './assets/';
    if (host.endsWith('.github.io') && host !== 'gistpreview.github.io' && host !== 'htmlpreview.github.io') {
      return './assets/';
    }
  } catch {
    /* fall through */
  }
  return DEFAULT_RAW_GITHUB_ASSETS;
}

const COLOR_KEYS = [
  'headerStart', 'headerEnd', 'bgStart', 'bgEnd', 'card', 'text', 'muted',
  'accent', 'patternColor', 'bannerFill', 'bannerBorder', 'signatureBorder',
];

const portland = (id, name, bg, colors) => ({
  id, name, pattern: 'pokeball',
  images: { header: 'Portland VGC Header.jpg', vgcIcon: 'Pokemon VGC Icon.png', localIcon: 'Portland VGC Icon.png', background: bg },
  colors,
});

const procedural = (id, name, pattern, colors) => ({
  id, name, pattern,
  images: { header: null, vgcIcon: null, localIcon: null, background: null },
  colors,
});

const base = { text: '#FFFFFF', muted: '#C3D0E5', signatureBorder: '#D8B45A' };

export const BUILTIN_THEMES = Object.freeze([
  portland('portland-dark', 'Portland Dark', 'Background DB.png', {
    ...base, headerStart: '#101A2E', headerEnd: '#24365A', bgStart: '#0B1220', bgEnd: '#16233D',
    card: '#202B40', accent: '#D8B45A', patternColor: '#FFFFFF', bannerFill: '#101A2E', bannerBorder: '#D8B45A',
  }),
  portland('portland-light', 'Portland Light', 'Background B.png', {
    ...base, headerStart: '#2B4A7A', headerEnd: '#4D74B0', bgStart: '#8FB2E6', bgEnd: '#C9DBF5',
    card: '#202B40', accent: '#D8B45A', patternColor: '#FFFFFF', bannerFill: '#1B2F54', bannerBorder: '#D8B45A',
  }),
  portland('portland-bw', 'Portland B&W', 'Background BW.png', {
    ...base, headerStart: '#1A1A1A', headerEnd: '#3A3A3A', bgStart: '#111111', bgEnd: '#2A2A2A',
    card: '#242424', accent: '#E0E0E0', patternColor: '#FFFFFF', bannerFill: '#141414', bannerBorder: '#E0E0E0',
  }),
  procedural('midnight-pokeball', 'Midnight Pokéball', 'pokeball', {
    ...base, headerStart: '#0B1020', headerEnd: '#1E2A55', bgStart: '#0A0F1E', bgEnd: '#16204A',
    card: '#1B2442', accent: '#E3463C', patternColor: '#FFFFFF', bannerFill: '#0B1020', bannerBorder: '#E3463C',
  }),
  procedural('crimson-arena', 'Crimson Arena', 'diagonal', {
    ...base, headerStart: '#3A0A12', headerEnd: '#7A1626', bgStart: '#220509', bgEnd: '#4A0F1B',
    card: '#2E1219', accent: '#FFB347', patternColor: '#FF6B6B', bannerFill: '#2A070D', bannerBorder: '#FFB347',
  }),
  procedural('emerald-circuit', 'Emerald Circuit', 'grid', {
    ...base, headerStart: '#062B22', headerEnd: '#0E5A45', bgStart: '#04201A', bgEnd: '#0A3F32',
    card: '#0F2F27', accent: '#4DF0B0', patternColor: '#4DF0B0', bannerFill: '#052219', bannerBorder: '#4DF0B0',
  }),
  procedural('minimal-slate', 'Minimal Slate', 'none', {
    ...base, headerStart: '#2A3140', headerEnd: '#3C4558', bgStart: '#1E2430', bgEnd: '#2A3140',
    card: '#202B40', accent: '#8FA3C7', patternColor: '#FFFFFF', bannerFill: '#222938', bannerBorder: '#8FA3C7',
  }),
]);

function joinUrl(baseUrl, file) {
  if (!file) return null;
  if (/^(https?:|data:|blob:)/i.test(file)) return file;
  return baseUrl + encodeURI(file);
}

/** Returns a fully resolved theme: validated colors and absolute image URLs (or null). */
export function resolveTheme(themeId, overrides = {}, assetBaseUrl = getDefaultAssetBaseUrl()) {
  const theme = BUILTIN_THEMES.find((t) => t.id === themeId) ?? BUILTIN_THEMES[0];
  const ov = overrides && typeof overrides === 'object' ? overrides : {};
  const colors = {};
  for (const key of COLOR_KEYS) {
    const fallback = theme.colors[key];
    colors[key] = normalizeHexColor(Object.hasOwn(ov, key) ? ov[key] : fallback, fallback);
  }
  let baseUrl = typeof assetBaseUrl === 'string' && assetBaseUrl ? assetBaseUrl : getDefaultAssetBaseUrl();
  if (!baseUrl.endsWith('/')) baseUrl += '/';
  const images = {};
  for (const [k, file] of Object.entries(theme.images)) {
    const override = Object.hasOwn(ov, `${k}Url`) && typeof ov[`${k}Url`] === 'string' ? ov[`${k}Url`] : file;
    images[k] = joinUrl(baseUrl, override) || null;
  }
  const pattern = ['pokeball', 'grid', 'diagonal', 'none'].includes(ov.pattern) ? ov.pattern : theme.pattern;
  return { id: theme.id, name: theme.name, pattern, colors, images };
}
