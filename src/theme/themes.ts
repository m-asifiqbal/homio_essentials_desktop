/**
 * Colour themes. One choice sets the whole look in BOTH day and night mode:
 *   - the accent ramp (--ac-50 … --ac-950): buttons, selection, focus, links, charts' accent
 *   - the night surfaces (--nt-<hex>): the dark page, cards, inputs and borders take a faint tint of the same hue
 *   - day tints: page background, table headers, filter bars, row hover / selection
 * Everything is plain CSS custom properties on <html>, so a change repaints instantly (and is animated, see index.css).
 * Stored on this computer only. Same engine as bondhu-fund-desktop; the presets are Homio Essentials' accents
 * (the same four the mobile app offers, plus two extra), with Homio teal as the default.
 */

export interface ThemePreset { id: string; name: string; bn: string; base: string }

/** `base` is the main colour (the 600 step): solid buttons with white text sit on it, so it is always a deep, readable shade. */
export const PRESETS: ThemePreset[] = [
  { id: 'teal', name: 'Homio teal', bn: 'হোমিও টিল', base: '#0f6466' },
  { id: 'ocean', name: 'Ocean', bn: 'সাগর নীল', base: '#1d5c96' },
  { id: 'forest', name: 'Forest', bn: 'বন সবুজ', base: '#2f6a3a' },
  { id: 'plum', name: 'Plum', bn: 'প্লাম', base: '#6a3f7e' },
  { id: 'rose', name: 'Rose', bn: 'গোলাপি', base: '#a3324f' },
  { id: 'graphite', name: 'Graphite', bn: 'গ্রাফাইট', base: '#475569' },
];
export const DEFAULT_THEME = 'teal';
export const CUSTOM_ID = 'custom';

/** Dark surfaces the app uses (the hex values that used to be written into the markup). Each becomes `--nt-<hex>`. */
export const NIGHT_HEX = [
  '0b1317', '0c161c', '0f1a20', '101b21', '111e24', '121f26', '132026', '132027', '142026', '14232b', '15232b', '16252d', '182830', '1a2b34', '1b2c34', '1d2e36',
  '1d303b', '22343d', '22353f', '223640', '243d48', '283d47', '283e4a', '2a3f49', '2d424e', '2c4250', '2e4553', '2f4a58', '34505e', '3a5463', '0f1f27', '12202a',
] as const;

// ---- colour maths ------------------------------------------------------------------------------------------------
type RGB = [number, number, number];
type HSL = [number, number, number];            // h 0-360, s 0-100, l 0-100
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export function hexToRgb(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbToHex = ([r, g, b]: RGB) => '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
export function rgbToHsl([r, g, b]: RGB): HSL {
  const R = r / 255, G = g / 255, B = b / 255, mx = Math.max(R, G, B), mn = Math.min(R, G, B), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === R ? (G - B) / d + (G < B ? 6 : 0) : mx === G ? (B - R) / d + 2 : (R - G) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
}
export function hslToRgb([h, s, l]: HSL): RGB {
  const S = clamp(s, 0, 100) / 100, L = clamp(l, 0, 100) / 100, H = ((h % 360) + 360) % 360;
  const k = (n: number) => (n + H / 30) % 12, a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
const hsl = (h: number, s: number, l: number): RGB => hslToRgb([h, s, l]);
const triplet = (c: RGB) => c.map(v => Math.round(clamp(v, 0, 255))).join(' ');
const rel = (c: RGB) => { const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
/** WCAG contrast of white text on a colour (used to keep the main colour readable). */
export const contrastOnWhite = (c: RGB) => 1.05 / (rel(c) + 0.05);

/** The emerald ramp the app has always used (explicit, so the default look does not move by a single pixel). */
const EMERALD_RAMP: Record<number, string> = {
  50: '#f0f7f3', 100: '#e6f3ee', 200: '#c6e5d8', 300: '#93cdb6', 400: '#3fc79b', 500: '#2a9a76', 600: '#0f6b50', 700: '#0b5a43', 800: '#0f4a3c', 900: '#0a3a2e', 950: '#06251d',
};
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

/** Builds the 11-step ramp around a base colour (the 600 step). Lighter steps keep the hue and fade towards white, darker ones towards black. */
export function buildRamp(baseHex: string): Record<number, RGB> {
  const base = hexToRgb(baseHex) || hexToRgb('#0f6b50')!;
  let [h, s, l] = rgbToHsl(base);
  // a white-on-colour button must stay readable: darken a too-light pick until the contrast is at least 4.5
  let guard = 0;
  while (contrastOnWhite(hslToRgb([h, s, l])) < 4.5 && l > 12 && guard++ < 40) l -= 1;
  const to = (target: number, f: number) => l + (target - l) * f;
  const sat = (f: number) => s * (1 - 0.28 * f * f);
  const out: Record<number, RGB> = {
    50: hsl(h, sat(0.96) * 0.9, to(97, 0.95)), 100: hsl(h, sat(0.9) * 0.95, to(95, 0.9)), 200: hsl(h, sat(0.76), to(91, 0.76)), 300: hsl(h, sat(0.58), to(86, 0.58)),
    400: hsl(h, Math.min(100, s * 0.95), clamp(to(78, 0.4), 54, 66)), 500: hsl(h, s, to(70, 0.18)), 600: hsl(h, s, l),
    700: hsl(h, s, to(8, 0.14)), 800: hsl(h, s, to(8, 0.3)), 900: hsl(h, Math.min(100, s * 0.95), to(8, 0.5)), 950: hsl(h, Math.min(100, s * 0.9), to(8, 0.72)),
  };
  return out;
}

/** Every CSS variable one theme sets. `base` null/'#0f6b50' → the original emerald look. */
export function themeVars(baseHex: string): Record<string, string> {
  const emerald = baseHex.toLowerCase() === '#0f6b50';
  const ramp: Record<number, RGB> = emerald ? Object.fromEntries(STEPS.map(k => [k, hexToRgb(EMERALD_RAMP[k])!])) as Record<number, RGB> : buildRamp(baseHex);
  const [h0, s0, l600] = rgbToHsl(ramp[600]);
  const hue = emerald ? 150 : h0;
  const sat = emerald ? 60 : clamp(s0, 18, 78);
  const v: Record<string, string> = {};
  for (const k of STEPS) v[`--ac-${k}`] = triplet(ramp[k]);

  // ---- night surfaces: the original dark blue-greys, turned to this theme's hue (hue 200 = unchanged) ----
  const shift = emerald ? 0 : hue - 200;
  const calm = emerald ? 1 : clamp(0.55 + sat / 160, 0.55, 1.05);        // grey-ish themes (graphite) get a more neutral night
  for (const hex of NIGHT_HEX) {
    const [oh, os, ol] = rgbToHsl(hexToRgb(hex)!);
    v[`--nt-${hex}`] = triplet(shift === 0 && calm === 1 ? hexToRgb(hex)! : hsl(oh + shift, os * calm * (sat < 25 ? 0.35 : 1), ol));
  }

  // ---- legacy single-colour variables used by the stylesheet ----
  const hex600 = rgbToHex(ramp[600]);
  v['--bf-green'] = hex600;
  v['--bf-green-hover'] = rgbToHex(ramp[700]);
  v['--bf-green-night'] = emerald ? '#059669' : rgbToHex(hsl(rgbToHsl(ramp[600])[0], rgbToHsl(ramp[600])[1], clamp(l600 + 4, 30, 44)));
  v['--bf-green-night-hover'] = emerald ? '#047857' : rgbToHex(hsl(rgbToHsl(ramp[600])[0], rgbToHsl(ramp[600])[1], clamp(l600 - 2, 24, 40)));
  v['--bf-glow'] = `${ramp[600].map(x => Math.round(x)).join(', ')}`;
  v['--ring'] = emerald ? '16, 185, 129' : ramp[500].map(x => Math.round(x)).join(', ');
  v['--nav-from'] = emerald ? '#3aae86' : rgbToHex(hsl(rgbToHsl(ramp[600])[0], rgbToHsl(ramp[600])[1], clamp(l600 + 11, 38, 52)));
  v['--nav-to'] = emerald ? '#2f9e78' : rgbToHex(hsl(rgbToHsl(ramp[600])[0], rgbToHsl(ramp[600])[1], clamp(l600 + 5, 34, 46)));
  v['--nav-night-text'] = emerald ? '#0f8a63' : rgbToHex(ramp[600]);
  v['--nav-hover'] = emerald ? 'rgba(47, 158, 120, .09)' : `rgba(${ramp[600].map(x => Math.round(x)).join(', ')}, .1)`;

  // ---- day tints ----
  if (emerald) {
    Object.assign(v, {
      '--day-bg': '244 247 250', '--tbl-head': '#d9eadf', '--tbl-head-text': '#1f4a3a', '--tbl-head-line': '#a8cbb8', '--tbl-filter': '#ecf5f0', '--tbl-filter-line': '#bcd7c8',
      '--row-alt': '#f4f9f6', '--row-hover': '#dcece3', '--row-sel': '#bfe3d0', '--row-sel-bar': '#0f4a3c', '--seg-track': '#f3f7f5', '--seg-line': '#cfd9d4',
      '--chip-hover-bg': '#f1faf6', '--chip-hover-line': '#5fb89c', '--edge-line': '#b9cfc4', '--day-line': '#dbe5e0',
    });
  } else {
    const H = hue, S = clamp(sat * 0.5, 16, 40);
    Object.assign(v, {
      '--day-bg': triplet(hsl(H, S * 0.55, 96.2)), '--tbl-head': rgbToHex(hsl(H, S, 90)), '--tbl-head-text': rgbToHex(hsl(H, clamp(sat, 30, 60), 22)), '--tbl-head-line': rgbToHex(hsl(H, S, 76)),
      '--tbl-filter': rgbToHex(hsl(H, S * 0.9, 94.5)), '--tbl-filter-line': rgbToHex(hsl(H, S * 0.9, 82)),
      '--row-alt': rgbToHex(hsl(H, S * 0.8, 96.5)), '--row-hover': rgbToHex(hsl(H, S, 91)), '--row-sel': rgbToHex(hsl(H, clamp(sat * 0.75, 25, 60), 84)), '--row-sel-bar': rgbToHex(ramp[800]),
      '--seg-track': rgbToHex(hsl(H, S * 0.7, 96.3)), '--seg-line': rgbToHex(hsl(H, S * 0.6, 84)),
      '--chip-hover-bg': rgbToHex(hsl(H, S, 96.5)), '--chip-hover-line': rgbToHex(ramp[400]), '--edge-line': rgbToHex(hsl(H, S * 0.6, 80)), '--day-line': rgbToHex(hsl(H, S * 0.5, 89)),
    });
  }
  // night rows
  const nh = emerald ? 200 : hue;
  v['--row-alt-n'] = emerald ? '#182830' : rgbToHex(hsl(nh, 24, 14));
  v['--row-hover-n'] = emerald ? '#243d48' : rgbToHex(hsl(nh, 26, 21));
  v['--row-sel-n'] = emerald ? '#1f5a47' : rgbToHex(hsl(rgbToHsl(ramp[600])[0], clamp(rgbToHsl(ramp[600])[1] * 0.7, 25, 60), 26));
  v['--row-sel-bar-n'] = emerald ? '#34d399' : rgbToHex(ramp[400]);
  return v;
}

// ---- store ----------------------------------------------------------------------------------------------------------
const KEY = 'homio_theme', KEY_CUSTOM = 'homio_theme_custom';
export interface ThemeState { id: string; custom: string }
let state: ThemeState = { id: DEFAULT_THEME, custom: '#2563eb' };
const listeners = new Set<() => void>();

export const baseOf = (s: ThemeState): string => s.id === CUSTOM_ID ? s.custom : (PRESETS.find(p => p.id === s.id) || PRESETS[0]).base;

function paint(s: ThemeState, animate: boolean) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (animate) {
    root.classList.add('theme-fade');
    window.setTimeout(() => root.classList.remove('theme-fade'), 520);
  }
  const vars = themeVars(baseOf(s));
  for (const k of Object.keys(vars)) root.style.setProperty(k, vars[k]);
  root.dataset.theme = s.id;
}

export function loadTheme(): ThemeState {
  try {
    const id = localStorage.getItem(KEY) || DEFAULT_THEME;
    const custom = localStorage.getItem(KEY_CUSTOM) || state.custom;
    state = { id: id === CUSTOM_ID || PRESETS.some(p => p.id === id) ? id : DEFAULT_THEME, custom: hexToRgb(custom) ? custom : state.custom };
  } catch { /* storage unavailable: keep the default */ }
  return state;
}
export function applyStoredTheme() { paint(loadTheme(), false); }
export function setTheme(id: string, custom?: string) {
  const next: ThemeState = { id: id === CUSTOM_ID || PRESETS.some(p => p.id === id) ? id : DEFAULT_THEME, custom: custom && hexToRgb(custom) ? custom : state.custom };
  state = next;
  try { localStorage.setItem(KEY, next.id); localStorage.setItem(KEY_CUSTOM, next.custom); } catch { /* ignore */ }
  paint(next, true);
  listeners.forEach(l => l());
}
export const getTheme = () => state;
export const subscribeTheme = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** The current theme's accent as a hex colour (for charts and other places that cannot use CSS variables). */
export function accentHex(step: 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950): string {
  const base = baseOf(state);
  if (base.toLowerCase() === '#0f6b50') return EMERALD_RAMP[step];
  return rgbToHex(buildRamp(base)[step]);
}
/** Single-hue sequential ramp for heat-maps, light → dark (day) or dim → bright (night). The emerald theme keeps the original colours. */
export function seqRamp(dark: boolean): string[] {
  if (baseOf(state).toLowerCase() === '#0f6b50') return dark ? ['#173029', '#1d4d3e', '#24705a', '#2f9677', '#5cc9a2'] : ['#e6f3ee', '#b5dccb', '#7cc0a5', '#3f9c7c', '#0f4a3c'];
  const steps = dark ? [950, 900, 700, 500, 400] : [100, 200, 300, 500, 800];
  return steps.map(k => accentHex(k as 100));
}
