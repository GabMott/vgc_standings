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

const base = { text: '#FFFFFF', muted: '#C3D0E5', signatureBorder: '#D8B45A' };

export const BUILTIN_THEMES = Object.freeze([
  {
    id: 'portland-dark',
    name: 'Portland Dark',
    pattern: 'pokeball',
    images: {
      header: 'Portland VGC Header.jpg',
      vgcIcon: 'Pokemon VGC Icon.png',
      localIcon: 'Portland VGC Icon.png',
      background: null,
    },
    colors: {
      ...base,
      headerStart: '#101A2E',
      headerEnd: '#24365A',
      bgStart: '#000000',
      bgEnd: '#3533CC',
      card: '#202B40',
      accent: '#D8B45A',
      patternColor: '#FFFFFF',
      bannerFill: '#101A2E',
      bannerBorder: '#D8B45A',
    },
  },
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
    colors[key] = normalizeHexColor(Object.prototype.hasOwnProperty.call(ov, key) ? ov[key] : fallback, fallback);
  }
  let baseUrl = typeof assetBaseUrl === 'string' && assetBaseUrl ? assetBaseUrl : getDefaultAssetBaseUrl();
  if (!baseUrl.endsWith('/')) baseUrl += '/';
  const images = {};
  for (const [k, file] of Object.entries(theme.images)) {
    const override = Object.prototype.hasOwnProperty.call(ov, `${k}Url`) && typeof ov[`${k}Url`] === 'string' ? ov[`${k}Url`] : file;
    images[k] = joinUrl(baseUrl, override) || null;
  }
  const pattern = ['pokeball', 'grid', 'diagonal', 'none'].includes(ov.pattern) ? ov.pattern : theme.pattern;
  return { id: theme.id, name: theme.name, pattern, colors, images };
}
