// Moteur Motion Studio — moteur de rendu.
// Calques, keyframes (toutes propriétés), courbes Bézier, parentage, effets, masques, rendu Canvas 2D + WebGL.
import { getFX } from './fx.js';

export const uid = () => Math.random().toString(36).slice(2, 10);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------- Courbes d'interpolation ----------
const bounceOut = (t) => {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};
export const EASES = {
  linear: (t) => t,
  in: (t) => t * t * t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  expo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  expoInOut: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  back: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  elastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  bounce: bounceOut,
  hold: () => 0,
};
export const EASE_LABELS = {
  linear: 'Linéaire', in: 'Ease In (accélération)', out: 'Ease Out (décélération)', inOut: 'Ease In-Out',
  expo: 'Expo (rapide)', expoInOut: 'Expo In-Out', back: 'Dépassement', elastic: 'Élastique',
  bounce: 'Rebond', hold: 'Maintien (saut)', bezier: 'Bézier personnalisée',
};
// Approximation Bézier des courbes nommées (point de départ pour l'éditeur de courbes).
export const BEZ_OF = {
  linear: [0.333, 0.333, 0.667, 0.667], in: [0.55, 0, 1, 0.45], out: [0, 0.55, 0.45, 1], inOut: [0.65, 0, 0.35, 1],
  expo: [0.16, 1, 0.3, 1], expoInOut: [0.87, 0, 0.13, 1], back: [0.34, 1.56, 0.64, 1],
};

const bezCache = new Map();
export function cubicBezier(x1, y1, x2, y2) {
  x1 = clamp(x1, 0, 1); x2 = clamp(x2, 0, 1);
  const key = `${x1},${y1},${x2},${y2}`;
  let f = bezCache.get(key);
  if (f) return f;
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  f = (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-6) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 40; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-6) break;
      if (x > v) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
  if (bezCache.size > 500) bezCache.clear();
  bezCache.set(key, f);
  return f;
}
export const easeOfKey = (k) => (k.e === 'bezier' && k.b ? cubicBezier(...k.b) : EASES[k.e] || EASES.linear);

// ---------- Couleurs ----------
export function parseColor(c) {
  c = String(c || '#000');
  if (c[0] === '#') {
    let h = c.slice(1);
    if (h.length === 3) h = [...h].map((x) => x + x).join('');
    const n = parseInt(h.slice(0, 6), 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) { const p = m[1].split(',').map(parseFloat); return [p[0], p[1], p[2], p[3] ?? 1]; }
  return [0, 0, 0, 1];
}
export function mixColor(a, b, u) {
  const A = parseColor(a), B = parseColor(b);
  const r = A.map((v, i) => v + (B[i] - v) * u);
  if (r[3] >= 0.999) return '#' + r.slice(0, 3).map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  return `rgba(${r.slice(0, 3).map((v) => Math.round(clamp(v, 0, 255))).join(',')},${clamp(r[3], 0, 1).toFixed(3)})`;
}
const isColor = (v) => typeof v === 'string' && (v[0] === '#' || v.startsWith('rgb'));

// ---------- Propriétés ----------
export const PROPS = ['x', 'y', 'scale', 'stretchX', 'stretchY', 'rotation', 'opacity', 'blur'];
export function defaultProps(p) {
  return { x: p.width / 2, y: p.height / 2, scale: 100, stretchX: 100, stretchY: 100, rotation: 0, opacity: 100, blur: 0 };
}

export const FONTS = [
  ['system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif', 'Système (SF)'],
  ['"Avenir Next", Avenir, "Segoe UI", sans-serif', 'Avenir Next'],
  ['Futura, "Century Gothic", sans-serif', 'Futura'],
  ['"Helvetica Neue", Helvetica, Arial, sans-serif', 'Helvetica Neue'],
  ['Didot, "Bodoni 72", "Times New Roman", serif', 'Didot'],
  ['Georgia, serif', 'Georgia'],
  ['Baskerville, "Times New Roman", serif', 'Baskerville'],
  ['"American Typewriter", "Courier New", monospace', 'Machine à écrire'],
  ['Menlo, "SF Mono", Consolas, monospace', 'Menlo (mono)'],
  ['Copperplate, "Copperplate Gothic", serif', 'Copperplate'],
  ['"Marker Felt", "Comic Sans MS", cursive', 'Marker Felt'],
  ['"Snell Roundhand", "Brush Script MT", cursive', 'Manuscrite'],
];

const BASE_STYLE = { anchorX: 50, anchorY: 50, blend: 'source-over', clipL: 0, clipR: 0, clipT: 0, clipB: 0 };

const TYPE_STYLE = {
  text: (p) => ({
    text: 'Votre texte', font: FONTS[0][0], size: Math.round(p.width * 0.09), weight: '800', italic: false,
    color: '#ffffff', gradOn: false, color2: '#22d3ee', gradAngle: 90, align: 'center', tracking: 0, leading: 1.1,
    stroke: '#000000', strokeW: 0, depth: 0, depthColor: '#3b1d8f', depthAngle: 45,
    bgOn: false, bg: '#7c5cff', bgPad: Math.round(p.width * 0.025), bgRadius: Math.round(p.width * 0.02),
  }),
  rect: (p) => ({ w: Math.round(p.width * 0.6), h: Math.round(p.width * 0.3), radius: Math.round(p.width * 0.03), fill: '#7c5cff', gradOn: false, gradType: 'linear', fill2: '#22d3ee', gradAngle: 90, stroke: '#ffffff', strokeW: 0 }),
  ellipse: (p) => ({ w: Math.round(p.width * 0.4), h: Math.round(p.width * 0.4), fill: '#22d3ee', gradOn: false, gradType: 'radial', fill2: '#7c5cff', gradAngle: 90, stroke: '#ffffff', strokeW: 0 }),
  solid: () => ({ fill: '#111118', gradOn: false, gradType: 'linear', fill2: '#2a1d5c', gradAngle: 90 }),
  image: () => ({ mediaId: null, w: 400, h: 400, radius: 0 }),
  video: () => ({ mediaId: null, w: 400, h: 400, radius: 0, trim: 0, speed: 1, muted: false, volume: 100, fadeIn: 0, fadeOut: 0 }),
  audio: () => ({ mediaId: null, trim: 0, speed: 1, muted: false, volume: 100, fadeIn: 0, fadeOut: 0 }),
  null: () => ({ w: 120, h: 120 }),
  adjust: () => ({}),
};

export const TYPE_NAMES = { text: 'Texte', rect: 'Rectangle', ellipse: 'Ellipse', solid: 'Fond', image: 'Image', video: 'Vidéo', audio: 'Audio', null: 'Groupe', adjust: 'Calque d\'effets' };
export const VISUAL = (L) => !['audio', 'null'].includes(L.type);

// ---------- Effets (définitions partagées moteur / interface) ----------
// Paramètre : [libellé, min, max, pas, défaut] ou [libellé, 'color', défaut]
export const FX_DEFS = {
  blur: { label: 'Flou gaussien', gl: true, params: { radius: ['Rayon', 0, 200, 0.5, 12] } },
  mblur: { label: 'Flou de mouvement', params: { shutter: ['Obturateur °', 0, 720, 1, 180], samples: ['Échantillons', 2, 16, 1, 8] }, nokf: ['samples'] },
  glow: { label: 'Lueur', params: { amount: ['Intensité', 0, 300, 1, 40], color: ['Couleur', 'color', '#a78bfa'] } },
  shadow: { label: 'Ombre portée', params: { blur: ['Flou', 0, 200, 1, 30], dist: ['Distance', 0, 300, 1, 20], angle: ['Angle °', 0, 360, 1, 90], opacity: ['Opacité %', 0, 100, 1, 60], color: ['Couleur', 'color', '#000000'] } },
  color: { label: 'Correction colorimétrique', gl: true, params: { bright: ['Luminosité', -100, 100, 1, 0], contrast: ['Contraste', -100, 100, 1, 0], sat: ['Saturation', -100, 100, 1, 0], hue: ['Teinte °', -180, 180, 1, 0], temp: ['Température', -100, 100, 1, 0] } },
  bright: { label: 'Luminosité', gl: true, params: { bright: ['Luminosité', -100, 100, 1, 25] } },
  contrast: { label: 'Contraste', gl: true, params: { contrast: ['Contraste', -100, 100, 1, 25] } },
  satur: { label: 'Saturation', gl: true, params: { sat: ['Saturation', -100, 100, 1, 40] } },
  rgb: { label: 'RGB Split', gl: true, params: { amount: ['Décalage', 0, 120, 0.5, 14], angle: ['Angle °', 0, 360, 1, 0] } },
  chroma: { label: 'Aberration chromatique', gl: true, params: { amount: ['Intensité', 0, 100, 0.5, 25] } },
  glitch: { label: 'Glitch', gl: true, params: { amount: ['Intensité', 0, 100, 1, 50], block: ['Taille des blocs', 2, 300, 1, 40], speed: ['Vitesse (i/s)', 0, 60, 1, 12] } },
  vignette: { label: 'Vignette', gl: true, params: { amount: ['Intensité', 0, 100, 1, 55], size: ['Taille', 0, 100, 1, 45], soft: ['Douceur', 1, 100, 1, 50] } },
  grain: { label: 'Grain', gl: true, params: { amount: ['Intensité', 0, 100, 1, 25], size: ['Taille', 1, 8, 0.1, 1.5], speed: ['Animation (i/s)', 0, 60, 1, 24] } },
};
export function newEffect(type) {
  const d = FX_DEFS[type];
  const params = {};
  for (const k in d.params) params[k] = d.params[k][1] === 'color' ? d.params[k][2] : d.params[k][4];
  return { id: uid(), type, on: true, params };
}

// ---------- Création ----------
export function migrateLayer(L) {
  L.parent ??= null;
  L.fx ??= [];
  L.kf ??= {};
  for (const k of ['clipL', 'clipR', 'clipT', 'clipB']) L.style[k] ??= 0;
  L.style.anchorX ??= 50; L.style.anchorY ??= 50; L.style.blend ??= 'source-over';
  if (L.style.glow > 0) { const f = newEffect('glow'); f.params.amount = L.style.glow; f.params.color = L.style.glowColor || '#ffffff'; L.fx.push(f); }
  if (L.style.shadow > 0) { const f = newEffect('shadow'); f.params.blur = L.style.shadow; f.params.dist = L.style.shadow * 0.35; f.params.opacity = 55; L.fx.push(f); }
  delete L.style.glow; delete L.style.glowColor; delete L.style.shadow;
  if (L.type === 'text') {
    const d = TYPE_STYLE.text({ width: 1080 });
    for (const k of ['gradOn', 'color2', 'gradAngle', 'depth', 'depthColor', 'depthAngle']) L.style[k] ??= d[k];
  }
  if (L.type === 'video') { L.style.volume ??= 100; L.style.fadeIn ??= 0; L.style.fadeOut ??= 0; }
  return L;
}

export function newLayer(p, type, extra = {}) {
  const L = {
    id: uid(), type, name: TYPE_NAMES[type], start: 0, end: p.duration, visible: true, locked: false, parent: null, open: false,
    props: defaultProps(p), kf: {}, fx: [],
    style: { ...BASE_STYLE, ...TYPE_STYLE[type](p) },
    anim: { type: 'none', by: 'char', dur: 0.5, stagger: 0.04, delay: 0, out: false },
  };
  if (extra.props) Object.assign(L.props, extra.props);
  if (extra.style) Object.assign(L.style, extra.style);
  if (extra.anim) Object.assign(L.anim, extra.anim);
  if (extra.fx) L.fx = extra.fx;
  for (const k of ['name', 'start', 'end', 'visible', 'locked', 'parent']) if (k in extra) L[k] = extra[k];
  if (extra.kf) L.kf = JSON.parse(JSON.stringify(extra.kf));
  if (type === 'text' && !extra.name) L.name = String(L.style.text).split('\n')[0].slice(0, 24) || 'Texte';
  return migrateLayer(L);
}

export function newProject(opts = {}) {
  return {
    id: uid(), version: 2, name: opts.name || 'Sans titre', width: opts.width || 1080, height: opts.height || 1920,
    fps: opts.fps || 30, duration: opts.duration || 6, bg: opts.bg || '#000000', layers: [], fonts: [], media: [], tracks: [],
    created: Date.now(), updated: Date.now(),
  };
}

export function migrateProject(p) {
  p.layers.forEach(migrateLayer);
  p.fonts ??= [];
  p.media ??= [];
  p.tracks ??= [];
  p.version = 2;
  return p;
}

// ---------- Valeurs et keyframes ----------
// Chemins : "x" (transformation), "s.<style>" (contenu), "fx.<id>.<param>" (effets).
export function baseVal(L, path) {
  const i = path.indexOf('.');
  if (i < 0) return L.props[path];
  const sc = path.slice(0, i), rest = path.slice(i + 1);
  if (sc === 's') return L.style[rest];
  if (sc === 'fx') { const [id, pn] = rest.split('.'); const f = L.fx.find((x) => x.id === id); return f ? f.params[pn] : undefined; }
  return undefined;
}
export function setBase(L, path, v) {
  const i = path.indexOf('.');
  if (i < 0) { L.props[path] = v; return; }
  const sc = path.slice(0, i), rest = path.slice(i + 1);
  if (sc === 's') L.style[rest] = v;
  else if (sc === 'fx') { const [id, pn] = rest.split('.'); const f = L.fx.find((x) => x.id === id); if (f) f.params[pn] = v; }
}

export function getProp(L, name, t) {
  const k = L.kf[name];
  if (!k || !k.length) return baseVal(L, name);
  if (t <= k[0].t) return k[0].v;
  const last = k[k.length - 1];
  if (t >= last.t) return last.v;
  let lo = 0, hi = k.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (k[m].t <= t) lo = m; else hi = m; }
  const a = k[lo], b = k[hi];
  const u = easeOfKey(a)((t - a.t) / (b.t - a.t));
  if (isColor(a.v)) return mixColor(a.v, b.v, clamp(u, 0, 1));
  return a.v + (b.v - a.v) * u;
}

const near = (a, b) => Math.abs(a - b) < 0.0015;
export const roundT = (t) => Math.round(t * 1000) / 1000;

export function setKey(L, name, t, v, e) {
  t = roundT(t);
  const k = (L.kf[name] ||= []);
  const ex = k.find((q) => near(q.t, t));
  if (ex) { ex.v = v; if (e) { ex.e = e; if (e !== 'bezier') delete ex.b; } }
  else { k.push({ t, v, e: e || 'inOut' }); k.sort((a, b) => a.t - b.t); }
}
export const hasKeyAt = (L, name, t) => !!(L.kf[name] || []).find((q) => near(q.t, t));
export function removeKey(L, name, t) {
  const k = L.kf[name];
  if (!k) return;
  const v = getProp(L, name, t);
  L.kf[name] = k.filter((q) => !near(q.t, t));
  if (!L.kf[name].length) { delete L.kf[name]; setBase(L, name, v); }
}
export const isAnimated = (L, name) => !!(L.kf[name] && L.kf[name].length);
export function keyTimes(L) {
  const s = new Set();
  for (const n in L.kf) for (const q of L.kf[n]) s.add(q.t);
  return [...s].sort((a, b) => a - b);
}
export function shiftKeys(L, dt) { for (const n in L.kf) for (const q of L.kf[n]) q.t = roundT(q.t + dt); }
export function clearKeys(L, t = null) {
  for (const n of Object.keys(L.kf)) setBase(L, n, t == null ? L.kf[n][0].v : getProp(L, n, t));
  L.kf = {};
}
export function removeEffect(L, id) {
  L.fx = L.fx.filter((f) => f.id !== id);
  for (const n of Object.keys(L.kf)) if (n.startsWith(`fx.${id}.`)) delete L.kf[n];
}

// Libellés lisibles pour un chemin de propriété.
export const PROP_LABELS = {
  x: 'Position X', y: 'Position Y', scale: 'Échelle', stretchX: 'Largeur %', stretchY: 'Hauteur %', rotation: 'Rotation', opacity: 'Opacité', blur: 'Flou',
  's.anchorX': 'Ancrage X', 's.anchorY': 'Ancrage Y', 's.w': 'Largeur', 's.h': 'Hauteur', 's.radius': 'Arrondi', 's.size': 'Taille du texte',
  's.tracking': 'Espacement', 's.color': 'Couleur', 's.color2': 'Couleur 2', 's.fill': 'Couleur', 's.fill2': 'Couleur 2', 's.gradAngle': 'Angle dégradé',
  's.strokeW': 'Contour', 's.stroke': 'Couleur contour', 's.bg': 'Couleur bulle', 's.depth': 'Profondeur 3D', 's.clipL': 'Masque gauche',
  's.clipR': 'Masque droite', 's.clipT': 'Masque haut', 's.clipB': 'Masque bas', 's.volume': 'Volume',
};
export function propLabel(L, path) {
  if (PROP_LABELS[path]) return PROP_LABELS[path];
  if (path.startsWith('fx.')) {
    const [, id, pn] = path.split('.');
    const f = L.fx.find((x) => x.id === id);
    if (f) return `${FX_DEFS[f.type].label} · ${FX_DEFS[f.type].params[pn]?.[0] || pn}`;
  }
  return path;
}

// Valeurs évaluées à l'instant t (style et paramètres d'effets animés).
export function evalStyle(L, t) {
  let c = null;
  for (const k in L.kf) if (k.charCodeAt(0) === 115 && k[1] === '.') { c ||= { ...L.style }; c[k.slice(2)] = getProp(L, k, t); }
  return c || L.style;
}
export function evalFx(L, f, t) {
  let c = null;
  for (const k in f.params) { const path = `fx.${f.id}.${k}`; if (L.kf[path]) { c ||= { ...f.params }; c[k] = getProp(L, path, t); } }
  return c || f.params;
}

// ---------- Texte ----------
let mctx = null;
const measure = () => (mctx ||= document.createElement('canvas').getContext('2d'));
const layoutCache = new Map();
export function clearTextCache() { layoutCache.clear(); }
export const fontStr = (s) => `${s.italic ? 'italic ' : ''}${s.weight} ${s.size}px ${s.font}`;

export function layoutText(s) {
  const key = [s.text, s.font, s.size, s.weight, s.italic, s.tracking, s.leading, s.align].join('|');
  let L = layoutCache.get(key);
  if (L) return L;
  const m = measure();
  m.font = fontStr(s);
  let ci = 0, wi = 0;
  const lines = String(s.text).split('\n').map((line, li) => {
    const chars = [];
    const arr = Array.from(line);
    let prefix = '', prevSpace = true;
    arr.forEach((ch, i) => {
      const x = m.measureText(prefix).width + i * s.tracking;
      const w = m.measureText(ch).width;
      const isSpace = /\s/.test(ch);
      if (!isSpace && prevSpace && chars.length) wi++;
      prevSpace = isSpace;
      chars.push({ ch, x, w, i: ci++, wi, li, space: isSpace });
      prefix += ch;
    });
    if (arr.length) wi++;
    const width = arr.length ? m.measureText(line).width + (arr.length - 1) * s.tracking : 0;
    return { chars, width, text: line };
  });
  const lh = s.size * s.leading;
  const w = Math.max(1, ...lines.map((l) => l.width));
  const h = Math.max(1, lh * lines.length);
  lines.forEach((l) => { l.x0 = s.align === 'left' ? 0 : s.align === 'right' ? w - l.width : (w - l.width) / 2; });
  L = { lines, w, h, lh, n: ci, nw: Math.max(1, wi) };
  if (layoutCache.size > 400) layoutCache.clear();
  layoutCache.set(key, L);
  return L;
}

export const TEXT_ANIMS = {
  none: 'Aucune', typewriter: 'Machine à écrire', fadeUp: 'Fondu montant', fadeDown: 'Fondu descendant',
  fade: 'Apparition progressive', pop: 'Pop', blur: 'Flou → net', rise: 'Révélation (masque)', spin: 'Rotation',
  scatter: 'Dispersion', tracking: 'Espacement', flip: 'Bascule 3D', wave: 'Vague (boucle)',
};

function hash(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

function charState(layer, L, s, c, t) {
  const a = layer.anim;
  const idx = a.by === 'word' ? c.wi : a.by === 'line' ? c.li : c.i;
  const total = a.by === 'word' ? L.nw : a.by === 'line' ? L.lines.length : L.n;
  if (a.type === 'wave') return { o: 1, dx: 0, dy: Math.sin((t - layer.start) * 5 - idx * 0.6) * s.size * 0.12, s: 1, sy: 1, r: 0, b: 0 };
  const local = t - layer.start - a.delay;
  let p = clamp((local - idx * a.stagger) / Math.max(0.01, a.dur), 0, 1);
  if (a.out) {
    const po = clamp(((layer.end - t) - (total - 1 - idx) * a.stagger) / Math.max(0.01, a.dur), 0, 1);
    p = Math.min(p, po);
  }
  const e = EASES.out(p);
  const S = { o: 1, dx: 0, dy: 0, s: 1, sy: 1, r: 0, b: 0 };
  switch (a.type) {
    case 'typewriter': S.o = p > 0 ? 1 : 0; break;
    case 'fade': S.o = p; break;
    case 'fadeUp': S.o = e; S.dy = (1 - e) * s.size * 0.6; break;
    case 'fadeDown': S.o = e; S.dy = -(1 - e) * s.size * 0.6; break;
    case 'pop': S.s = EASES.back(p); S.o = Math.min(1, p * 3); break;
    case 'blur': S.o = e; S.b = (1 - e) * s.size * 0.25; S.s = 1 + (1 - e) * 0.15; break;
    case 'rise': S.dy = (1 - EASES.expo(p)) * L.lh; break;
    case 'spin': S.o = e; S.r = ((1 - e) * -Math.PI) / 2; S.s = 0.4 + 0.6 * e; break;
    case 'scatter': S.o = e; S.dx = (hash(c.i) - 0.5) * s.size * 4 * (1 - e); S.dy = (hash(c.i + 99) - 0.5) * s.size * 4 * (1 - e); S.r = (hash(c.i + 7) - 0.5) * 3 * (1 - e); break;
    case 'tracking': S.o = e; S.dx = (c.x + c.w / 2 - L.w / 2) * (1 - e) * 1.2; break;
    case 'flip': S.o = Math.min(1, p * 2); S.sy = Math.cos((1 - EASES.back(p)) * Math.PI / 2); break;
  }
  return S;
}

// ---------- Géométrie ----------
export function layerSize(p, L, t) {
  const s = t == null ? L.style : evalStyle(L, t);
  if (L.type === 'text') { const T = layoutText(s); return { w: T.w, h: T.h }; }
  if (L.type === 'solid' || L.type === 'adjust' || L.type === 'audio') return { w: p.width, h: p.height };
  return { w: Math.max(1, s.w), h: Math.max(1, s.h) };
}

export function layerMatrix(p, L, t) {
  const { w, h } = layerSize(p, L, t);
  const P = (n) => getProp(L, n, t);
  const sc = P('scale') / 100;
  const m = new DOMMatrix();
  m.translateSelf(P('x'), P('y'));
  m.rotateSelf(P('rotation'));
  m.scaleSelf((sc * P('stretchX')) / 100, (sc * P('stretchY')) / 100);
  m.translateSelf((-w * P('s.anchorX')) / 100, (-h * P('s.anchorY')) / 100);
  return { m, w, h };
}

// Matrice monde : inclut la chaîne de parents (groupes, liens).
export function worldMatrix(p, L, t, depth = 0) {
  const r = layerMatrix(p, L, t);
  if (L.parent && depth < 16) {
    const P = p.layers.find((x) => x.id === L.parent);
    if (P) r.m = worldMatrix(p, P, t, depth + 1).m.multiply(r.m);
  }
  return r;
}

// Décompose une matrice monde souhaitée en propriétés locales (position, rotation, échelle).
export function propsFromWorld(p, L, D, t) {
  let local = D;
  if (L.parent) { const P = p.layers.find((x) => x.id === L.parent); if (P) local = worldMatrix(p, P, t).m.inverse().multiply(D); }
  const { w, h } = layerSize(p, L, t);
  const a = local.transformPoint(new DOMPoint((w * getProp(L, 's.anchorX', t)) / 100, (h * getProp(L, 's.anchorY', t)) / 100));
  const sx = Math.hypot(local.a, local.b);
  const rot = (Math.atan2(local.b, local.a) * 180) / Math.PI;
  const stretch = getProp(L, 'stretchX', t) / 100 || 1;
  return { x: a.x, y: a.y, rotation: rot, scale: (sx / stretch) * 100 };
}

export const isActive = (L, t) => L.visible && t >= L.start && t < L.end;

export function hitTest(p, t, x, y) {
  for (const L of p.layers) {
    if (!isActive(L, t) || L.locked || ['solid', 'audio', 'adjust', 'null'].includes(L.type)) continue;
    const { m, w, h } = worldMatrix(p, L, t);
    if (Math.abs(m.a * m.d - m.b * m.c) < 1e-9) continue;
    const q = m.inverse().transformPoint(new DOMPoint(x, y));
    const pad = Math.max(w, h) < 120 ? 30 : 0;
    if (q.x >= -pad && q.x <= w + pad && q.y >= -pad && q.y <= h + pad) return L;
  }
  return null;
}

// ---------- Dessin ----------
export function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function gradient(ctx, c1, c2, type, angle, w, h) {
  let g;
  if (type === 'radial') g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6);
  else {
    const a = (angle * Math.PI) / 180, cx = w / 2, cy = h / 2;
    const r = Math.abs((w / 2) * Math.cos(a)) + Math.abs((h / 2) * Math.sin(a));
    g = ctx.createLinearGradient(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  return g;
}
const paint = (ctx, s, w, h) => (s.gradOn ? gradient(ctx, s.fill, s.fill2, s.gradType, s.gradAngle, w, h) : s.fill);

export const HAS_FILTER = typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype &&
  (() => { try { const c = document.createElement('canvas').getContext('2d'); c.filter = 'blur(2px)'; return c.filter === 'blur(2px)'; } catch { return false; } })();

function drawText(ctx, layer, s, t, sc, layerBlur) {
  const L = layoutText(s);
  if (s.bgOn) {
    ctx.fillStyle = s.bg;
    roundRect(ctx, -s.bgPad, -s.bgPad * 0.6, L.w + 2 * s.bgPad, L.h + 1.2 * s.bgPad, s.bgRadius);
    ctx.fill();
    ctx.shadowColor = 'transparent';
  }
  ctx.font = fontStr(s);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const fill = s.gradOn ? gradient(ctx, s.color, s.color2, 'linear', s.gradAngle, L.w, L.h) : s.color;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = s.stroke;
  ctx.lineWidth = s.strokeW * 2;
  const depth = Math.round(s.depth || 0);
  const ddx = Math.cos((s.depthAngle * Math.PI) / 180), ddy = Math.sin((s.depthAngle * Math.PI) / 180);
  const glyph = (txt, x, y) => {
    if (depth > 0) {
      const sh = ctx.shadowColor;
      ctx.fillStyle = s.depthColor;
      for (let d = depth; d >= 1; d--) ctx.fillText(txt, x + ddx * d, y + ddy * d);
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = fill;
      if (s.strokeW > 0) ctx.strokeText(txt, x, y);
      ctx.fillText(txt, x, y);
      ctx.shadowColor = sh;
      return;
    }
    ctx.fillStyle = fill;
    if (s.strokeW > 0) ctx.strokeText(txt, x, y);
    ctx.fillText(txt, x, y);
  };
  const animated = layer.anim && layer.anim.type !== 'none';
  L.lines.forEach((line, li) => {
    const y = li * L.lh + L.lh / 2;
    if (!animated && !s.tracking) { glyph(line.text, line.x0, y); return; }
    if (animated && layer.anim.type === 'rise') {
      ctx.save();
      ctx.beginPath();
      ctx.rect(-L.w, li * L.lh - L.lh * 0.05, L.w * 3, L.lh * 1.1);
      ctx.clip();
    }
    for (const c of line.chars) {
      if (c.space) continue;
      const st = animated ? charState(layer, L, s, c, t) : null;
      if (st && st.o <= 0.001) continue;
      ctx.save();
      // Les dégradés sont exprimés dans le repère du bloc : on se place au glyphe sans changer de repère.
      const gx = line.x0 + c.x + c.w / 2;
      if (st) {
        ctx.translate(gx + st.dx, y + st.dy);
        if (st.r) ctx.rotate(st.r);
        if (st.s !== 1 || st.sy !== 1) ctx.scale(st.s, st.s * st.sy);
        ctx.translate(-gx, -y);
        ctx.globalAlpha *= st.o;
        if (HAS_FILTER && (st.b > 0.2 || layerBlur > 0)) ctx.filter = `blur(${(st.b + layerBlur) * sc}px)`;
      }
      glyph(c.ch, gx - c.w / 2, y);
      ctx.restore();
    }
    if (animated && layer.anim.type === 'rise') ctx.restore();
  });
}

// Dessine le contenu d'un calque. o.alphaMul / o.comp servent au flou de mouvement.
function drawLayer(ctx, p, L, t, sc, o, extra = {}) {
  const op = (getProp(L, 'opacity', t) / 100) * (extra.alphaMul ?? 1);
  if (op <= 0.0005) return;
  const { m, w, h } = worldMatrix(p, L, t);
  const s = evalStyle(L, t);
  ctx.save();
  ctx.setTransform(sc, 0, 0, sc, 0, 0);
  ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
  ctx.globalAlpha = op;
  ctx.globalCompositeOperation = extra.comp || s.blend || 'source-over';
  const blur = getProp(L, 'blur', t);
  if (HAS_FILTER && blur > 0) ctx.filter = `blur(${blur * sc}px)`;
  // Masque rectangulaire (keyframable : sert aux volets / wipes).
  if (s.clipL || s.clipR || s.clipT || s.clipB) {
    ctx.beginPath();
    ctx.rect((w * s.clipL) / 100, (h * s.clipT) / 100, (w * (100 - s.clipL - s.clipR)) / 100, (h * (100 - s.clipT - s.clipB)) / 100);
    ctx.clip();
  }
  const glow = L.fx.find((f) => f.on && f.type === 'glow');
  const shadow = L.fx.find((f) => f.on && f.type === 'shadow');
  const content = () => {
    switch (L.type) {
      case 'text': drawText(ctx, L, s, t, sc, blur); break;
      case 'solid': ctx.fillStyle = paint(ctx, s, w, h); ctx.fillRect(0, 0, w, h); break;
      case 'rect':
      case 'ellipse':
        if (L.type === 'rect') roundRect(ctx, 0, 0, w, h, s.radius);
        else { ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); }
        ctx.fillStyle = paint(ctx, s, w, h);
        ctx.fill();
        if (s.strokeW > 0) { ctx.lineWidth = s.strokeW; ctx.strokeStyle = s.stroke; ctx.stroke(); }
        break;
      case 'image':
      case 'video': {
        const el = L.type === 'video' ? o.els?.get(L.id) : o.media?.get(s.mediaId)?.el;
        const ready = el && (L.type === 'image' ? el.complete && el.naturalWidth : el.readyState >= 2);
        ctx.save();
        if (s.radius > 0) { roundRect(ctx, 0, 0, w, h, s.radius); ctx.clip(); }
        if (ready) ctx.drawImage(el, 0, 0, w, h);
        else { ctx.fillStyle = 'rgba(128,128,128,0.35)'; ctx.fillRect(0, 0, w, h); }
        ctx.restore();
        break;
      }
      case 'null':
        break;
    }
  };
  if (shadow) {
    const q = evalFx(L, shadow, t);
    const c = parseColor(q.color);
    ctx.save();
    ctx.shadowColor = `rgba(${c[0]},${c[1]},${c[2]},${(q.opacity / 100) * c[3]})`;
    ctx.shadowBlur = q.blur * sc;
    const an = (q.angle * Math.PI) / 180;
    ctx.shadowOffsetX = Math.cos(an) * q.dist * sc;
    ctx.shadowOffsetY = Math.sin(an) * q.dist * sc;
    content();
    ctx.restore();
  }
  if (glow) {
    const q = evalFx(L, glow, t);
    ctx.shadowColor = q.color;
    ctx.shadowBlur = q.amount * sc;
    ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  }
  if (!shadow || glow) content();
  ctx.restore();
}

// Toiles de travail réutilisées (évite les allocations à chaque image).
const scratch = [];
function getScratch(i, w, h) {
  let c = scratch[i];
  if (!c) { c = scratch[i] = document.createElement('canvas'); c._ctx = c.getContext('2d'); }
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  else { c._ctx.setTransform(1, 0, 0, 1, 0, 0); c._ctx.globalCompositeOperation = 'source-over'; c._ctx.globalAlpha = 1; if (HAS_FILTER) c._ctx.filter = 'none'; c._ctx.clearRect(0, 0, w, h); }
  return c;
}

function glChain(L, t, extraBlur) {
  const chain = [];
  if (extraBlur > 0) chain.push({ type: 'blur', params: { radius: extraBlur } });
  for (const f of L.fx) if (f.on && FX_DEFS[f.type]?.gl) chain.push({ type: f.type, params: evalFx(L, f, t) });
  return chain;
}

function drawLayerFull(ctx, p, L, t, sc, o) {
  const mb = L.fx.find((f) => f.on && f.type === 'mblur');
  const blur = getProp(L, 'blur', t);
  const fx = o.noFx ? null : getFX();
  const chain = fx ? glChain(L, t, !HAS_FILTER ? blur : 0) : [];
  if (!mb && !chain.length) { drawLayer(ctx, p, L, t, sc, o); return; }
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const off = getScratch(0, W, H);
  if (mb) {
    const q = evalFx(L, mb, t);
    const n = Math.max(2, Math.round(q.samples));
    const span = q.shutter / 360 / p.fps;
    for (let i = 0; i < n; i++) {
      const ts = t + (-0.5 + i / (n - 1)) * span;
      drawLayer(off._ctx, p, L, ts, sc, o, { alphaMul: 1 / n, comp: 'lighter' });
    }
  } else drawLayer(off._ctx, p, L, t, sc, o, { comp: 'source-over' });
  const src = chain.length ? fx.apply(off, chain, t, sc) : off;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = L.style.blend || 'source-over';
  if (src) ctx.drawImage(src, 0, 0, W, H);
  ctx.restore();
}

// Calque d'effets : applique sa pile d'effets à tout ce qui est en dessous.
function drawAdjust(ctx, p, L, t, sc, o) {
  const fx = o.noFx ? null : getFX();
  if (!fx) return;
  const chain = glChain(L, t, 0);
  if (!chain.length) return;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const snap = getScratch(1, W, H);
  snap._ctx.drawImage(ctx.canvas, 0, 0);
  const res = fx.apply(snap, chain, t, sc);
  if (!res) return;
  const s = evalStyle(L, t);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (s.clipL || s.clipR || s.clipT || s.clipB) {
    const { m, w, h } = worldMatrix(p, L, t);
    const pts = [[s.clipL, s.clipT], [100 - s.clipR, s.clipT], [100 - s.clipR, 100 - s.clipB], [s.clipL, 100 - s.clipB]]
      .map(([x, y]) => m.transformPoint(new DOMPoint((w * x) / 100, (h * y) / 100)));
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x * sc, q.y * sc) : ctx.moveTo(q.x * sc, q.y * sc)));
    ctx.closePath();
    ctx.clip();
  }
  ctx.globalAlpha = getProp(L, 'opacity', t) / 100;
  ctx.drawImage(res, 0, 0, W, H);
  ctx.restore();
}

export function renderFrame(ctx, p, t, o = {}) {
  const sc = o.scale || 1;
  ctx.setTransform(sc, 0, 0, sc, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  if (HAS_FILTER) ctx.filter = 'none';
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, p.width, p.height);
  for (let i = p.layers.length - 1; i >= 0; i--) {
    const L = p.layers[i];
    if (!isActive(L, t) || L.type === 'audio' || L.type === 'null') continue;
    if (L.type === 'adjust') drawAdjust(ctx, p, L, t, sc, o);
    else drawLayerFull(ctx, p, L, t, sc, o);
  }
  if (o.overlay) drawOverlay(ctx, p, t, sc, o);
}

function boxPoints(p, L, t, sc) {
  const { m, w, h } = worldMatrix(p, L, t);
  return [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => { const q = m.transformPoint(new DOMPoint(x, y)); return [q.x * sc, q.y * sc]; });
}

function drawOverlay(ctx, p, t, sc, o) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  if (HAS_FILTER) ctx.filter = 'none';
  const dpr = o.dpr || 1;
  if (o.guides) {
    ctx.strokeStyle = 'rgba(255,64,160,0.9)';
    ctx.lineWidth = dpr;
    ctx.setLineDash([6 * dpr, 4 * dpr]);
    if (o.guides.v) { ctx.beginPath(); ctx.moveTo((p.width / 2) * sc, 0); ctx.lineTo((p.width / 2) * sc, p.height * sc); ctx.stroke(); }
    if (o.guides.h) { ctx.beginPath(); ctx.moveTo(0, (p.height / 2) * sc); ctx.lineTo(p.width * sc, (p.height / 2) * sc); ctx.stroke(); }
    ctx.setLineDash([]);
  }
  for (const id of o.multi || []) {
    const L = p.layers.find((l) => l.id === id);
    if (!L || !isActive(L, t) || !VISUAL(L) || id === o.selected) continue;
    ctx.strokeStyle = 'rgba(34,211,238,0.8)';
    ctx.lineWidth = 1.2 * dpr;
    ctx.beginPath();
    boxPoints(p, L, t, sc).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.stroke();
  }
  if (o.extra) o.extra(ctx, sc, dpr);
  const L = o.selected && p.layers.find((l) => l.id === o.selected);
  if (!L || L.type === 'audio' || !(L.visible && t >= L.start && t < L.end)) return;
  const pts = boxPoints(p, L, t, sc);
  ctx.strokeStyle = L.type === 'null' ? '#22d3ee' : '#8b7bff';
  ctx.lineWidth = 1.5 * dpr;
  if (L.type === 'null') ctx.setLineDash([5 * dpr, 4 * dpr]);
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
  if (L.type === 'adjust') return;
  ctx.fillStyle = '#fff';
  for (const [x, y] of pts) { ctx.beginPath(); ctx.rect(x - 4 * dpr, y - 4 * dpr, 8 * dpr, 8 * dpr); ctx.fill(); ctx.stroke(); }
  const { m, w, h } = worldMatrix(p, L, t);
  const a = m.transformPoint(new DOMPoint((w * getProp(L, 's.anchorX', t)) / 100, (h * getProp(L, 's.anchorY', t)) / 100));
  const ax = a.x * sc, ay = a.y * sc;
  ctx.beginPath();
  ctx.arc(ax, ay, 5 * dpr, 0, Math.PI * 2);
  ctx.moveTo(ax - 9 * dpr, ay); ctx.lineTo(ax + 9 * dpr, ay);
  ctx.moveTo(ax, ay - 9 * dpr); ctx.lineTo(ax, ay + 9 * dpr);
  ctx.stroke();
}
