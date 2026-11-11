// Moteur Motion — moteur de rendu : calques, keyframes, interpolation, rendu Canvas 2D.

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
  linear: 'Linéaire', in: 'Accélération', out: 'Décélération', inOut: 'Douce (in/out)',
  expo: 'Expo (rapide)', expoInOut: 'Expo in/out', back: 'Dépassement', elastic: 'Élastique',
  bounce: 'Rebond', hold: 'Maintien (saut)',
};

// ---------- Propriétés animables ----------
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

const BASE_STYLE = { anchorX: 50, anchorY: 50, glow: 0, glowColor: '#ffffff', shadow: 0, blend: 'source-over' };

const TYPE_STYLE = {
  text: (p) => ({
    text: 'Votre texte', font: FONTS[0][0], size: Math.round(p.width * 0.09), weight: '800', italic: false,
    color: '#ffffff', align: 'center', tracking: 0, leading: 1.1, stroke: '#000000', strokeW: 0,
    bgOn: false, bg: '#7c5cff', bgPad: Math.round(p.width * 0.025), bgRadius: Math.round(p.width * 0.02),
  }),
  rect: (p) => ({ w: Math.round(p.width * 0.6), h: Math.round(p.width * 0.3), radius: Math.round(p.width * 0.03), fill: '#7c5cff', gradOn: false, gradType: 'linear', fill2: '#22d3ee', gradAngle: 90, stroke: '#ffffff', strokeW: 0 }),
  ellipse: (p) => ({ w: Math.round(p.width * 0.4), h: Math.round(p.width * 0.4), fill: '#22d3ee', gradOn: false, gradType: 'radial', fill2: '#7c5cff', gradAngle: 90, stroke: '#ffffff', strokeW: 0 }),
  solid: () => ({ fill: '#111118', gradOn: false, gradType: 'linear', fill2: '#2a1d5c', gradAngle: 90 }),
  image: () => ({ mediaId: null, w: 400, h: 400, radius: 0 }),
  video: () => ({ mediaId: null, w: 400, h: 400, radius: 0, trim: 0, speed: 1, muted: false }),
};

export const TYPE_NAMES = { text: 'Texte', rect: 'Rectangle', ellipse: 'Ellipse', solid: 'Fond', image: 'Image', video: 'Vidéo' };

export function newLayer(p, type, extra = {}) {
  const L = {
    id: uid(), type, name: TYPE_NAMES[type], start: 0, end: p.duration, visible: true, locked: false,
    props: defaultProps(p), kf: {},
    style: { ...BASE_STYLE, ...TYPE_STYLE[type](p) },
    anim: { type: 'none', by: 'char', dur: 0.5, stagger: 0.04, delay: 0, out: false },
  };
  if (extra.props) Object.assign(L.props, extra.props);
  if (extra.style) Object.assign(L.style, extra.style);
  if (extra.anim) Object.assign(L.anim, extra.anim);
  for (const k of ['name', 'start', 'end', 'visible', 'locked']) if (k in extra) L[k] = extra[k];
  if (extra.kf) L.kf = JSON.parse(JSON.stringify(extra.kf));
  if (type === 'text' && !extra.name) L.name = String(L.style.text).split('\n')[0].slice(0, 24) || 'Texte';
  return L;
}

export function newProject(opts = {}) {
  return {
    id: uid(), name: opts.name || 'Sans titre', width: opts.width || 1080, height: opts.height || 1920,
    fps: opts.fps || 30, duration: opts.duration || 6, bg: opts.bg || '#000000', layers: [], fonts: [],
    created: Date.now(), updated: Date.now(),
  };
}

// ---------- Keyframes ----------
export function getProp(layer, name, t) {
  const k = layer.kf[name];
  if (!k || !k.length) return layer.props[name];
  if (t <= k[0].t) return k[0].v;
  const last = k[k.length - 1];
  if (t >= last.t) return last.v;
  for (let i = 0; i < k.length - 1; i++) {
    const a = k[i], b = k[i + 1];
    if (t >= a.t && t < b.t) {
      const u = (t - a.t) / (b.t - a.t);
      return a.v + (b.v - a.v) * (EASES[a.e] || EASES.linear)(u);
    }
  }
  return last.v;
}

const near = (a, b) => Math.abs(a - b) < 0.0015;
export const roundT = (t) => Math.round(t * 1000) / 1000;

export function setKey(layer, name, t, v, e) {
  t = roundT(t);
  const k = (layer.kf[name] ||= []);
  const ex = k.find((q) => near(q.t, t));
  if (ex) { ex.v = v; if (e) ex.e = e; }
  else { k.push({ t, v, e: e || 'inOut' }); k.sort((a, b) => a.t - b.t); }
}
export function hasKeyAt(layer, name, t) { return !!(layer.kf[name] || []).find((q) => near(q.t, t)); }
export function removeKey(layer, name, t) {
  const k = layer.kf[name];
  if (!k) return;
  const v = getProp(layer, name, t);
  layer.kf[name] = k.filter((q) => !near(q.t, t));
  if (!layer.kf[name].length) { delete layer.kf[name]; layer.props[name] = v; }
}
export function isAnimated(layer, name) { return !!(layer.kf[name] && layer.kf[name].length); }
export function keyTimes(layer) {
  const s = new Set();
  for (const n in layer.kf) for (const q of layer.kf[n]) s.add(q.t);
  return [...s].sort((a, b) => a - b);
}
export function shiftKeys(layer, dt) { for (const n in layer.kf) for (const q of layer.kf[n]) q.t = roundT(q.t + dt); }
export function clearKeys(layer) {
  for (const n of Object.keys(layer.kf)) { layer.props[n] = layer.kf[n][0].v; }
  layer.kf = {};
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
  const lines = String(s.text).split('\n').map((line) => {
    const chars = [];
    const arr = Array.from(line);
    let prefix = '';
    let prevSpace = true;
    arr.forEach((ch, i) => {
      const x = m.measureText(prefix).width + i * s.tracking;
      const w = m.measureText(ch).width;
      const isSpace = /\s/.test(ch);
      if (!isSpace && prevSpace && chars.length) wi++;
      prevSpace = isSpace;
      chars.push({ ch, x, w, i: ci++, wi, space: isSpace });
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
  if (layoutCache.size > 300) layoutCache.clear();
  layoutCache.set(key, L);
  return L;
}

export const TEXT_ANIMS = {
  none: 'Aucune', typewriter: 'Machine à écrire', fadeUp: 'Fondu montant', fadeDown: 'Fondu descendant',
  pop: 'Pop', blur: 'Flou → net', rise: 'Révélation (masque)', spin: 'Rotation', scatter: 'Dispersion',
  tracking: 'Espacement', wave: 'Vague (boucle)',
};

function hash(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

function charState(layer, L, c, t) {
  const a = layer.anim, s = layer.style;
  const idx = a.by === 'word' ? c.wi : a.by === 'line' ? c.li : c.i;
  const total = a.by === 'word' ? L.nw : a.by === 'line' ? L.lines.length : L.n;
  if (a.type === 'wave') {
    return { o: 1, dx: 0, dy: Math.sin((t - layer.start) * 5 - idx * 0.6) * s.size * 0.12, s: 1, r: 0, b: 0 };
  }
  const local = t - layer.start - a.delay;
  let p = clamp((local - idx * a.stagger) / Math.max(0.01, a.dur), 0, 1);
  if (a.out) {
    const po = clamp(((layer.end - t) - (total - 1 - idx) * a.stagger) / Math.max(0.01, a.dur), 0, 1);
    p = Math.min(p, po);
  }
  const e = EASES.out(p);
  const S = { o: 1, dx: 0, dy: 0, s: 1, r: 0, b: 0 };
  switch (a.type) {
    case 'typewriter': S.o = p > 0 ? 1 : 0; break;
    case 'fadeUp': S.o = e; S.dy = (1 - e) * s.size * 0.6; break;
    case 'fadeDown': S.o = e; S.dy = -(1 - e) * s.size * 0.6; break;
    case 'pop': S.s = EASES.back(p); S.o = Math.min(1, p * 3); break;
    case 'blur': S.o = e; S.b = (1 - e) * s.size * 0.25; S.s = 1 + (1 - e) * 0.15; break;
    case 'rise': S.dy = (1 - EASES.expo(p)) * L.lh; break;
    case 'spin': S.o = e; S.r = (1 - e) * -Math.PI / 2; S.s = 0.4 + 0.6 * e; break;
    case 'scatter': S.o = e; S.dx = (hash(c.i) - 0.5) * s.size * 4 * (1 - e); S.dy = (hash(c.i + 99) - 0.5) * s.size * 4 * (1 - e); S.r = (hash(c.i + 7) - 0.5) * 3 * (1 - e); break;
    case 'tracking': S.o = e; S.dx = (c.x + c.w / 2 - L.w / 2) * (1 - e) * 1.2; break;
  }
  return S;
}

// ---------- Géométrie des calques ----------
export function layerSize(p, layer) {
  if (layer.type === 'text') { const L = layoutText(layer.style); return { w: L.w, h: L.h }; }
  if (layer.type === 'solid') return { w: p.width, h: p.height };
  return { w: Math.max(1, layer.style.w), h: Math.max(1, layer.style.h) };
}

export function layerMatrix(p, layer, t) {
  const { w, h } = layerSize(p, layer);
  const P = (n) => getProp(layer, n, t);
  const sc = P('scale') / 100;
  const m = new DOMMatrix();
  m.translateSelf(P('x'), P('y'));
  m.rotateSelf(P('rotation'));
  m.scaleSelf(sc * P('stretchX') / 100, sc * P('stretchY') / 100);
  m.translateSelf((-w * layer.style.anchorX) / 100, (-h * layer.style.anchorY) / 100);
  return { m, w, h };
}

export function isActive(layer, t) { return layer.visible && t >= layer.start && t < layer.end; }

export function hitTest(p, t, x, y) {
  for (const L of p.layers) {
    if (!isActive(L, t) || L.locked || L.type === 'solid') continue;
    const { m, w, h } = layerMatrix(p, L, t);
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

function paint(ctx, s, w, h) {
  if (!s.gradOn) return s.fill;
  let g;
  if (s.gradType === 'radial') {
    g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6);
  } else {
    const a = (s.gradAngle * Math.PI) / 180, cx = w / 2, cy = h / 2;
    const r = Math.abs((w / 2) * Math.cos(a)) + Math.abs((h / 2) * Math.sin(a));
    g = ctx.createLinearGradient(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.addColorStop(0, s.fill);
  g.addColorStop(1, s.fill2);
  return g;
}

const HAS_FILTER = typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype;

function drawText(ctx, layer, t, sc, layerBlur) {
  const s = layer.style, L = layoutText(s);
  if (s.bgOn) {
    ctx.fillStyle = s.bg;
    roundRect(ctx, -s.bgPad, -s.bgPad * 0.6, L.w + 2 * s.bgPad, L.h + 1.2 * s.bgPad, s.bgRadius);
    ctx.fill();
    ctx.shadowColor = 'transparent';
  }
  ctx.font = fontStr(s);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = s.color;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = s.stroke;
  ctx.lineWidth = s.strokeW * 2;
  const animated = layer.anim && layer.anim.type !== 'none';
  L.lines.forEach((line, li) => {
    const y = li * L.lh + L.lh / 2;
    if (!animated && !s.tracking) {
      if (s.strokeW > 0) ctx.strokeText(line.text, line.x0, y);
      ctx.fillText(line.text, line.x0, y);
      return;
    }
    if (animated && layer.anim.type === 'rise') {
      ctx.save();
      ctx.beginPath();
      ctx.rect(-L.w, li * L.lh - L.lh * 0.05, L.w * 3, L.lh * 1.1);
      ctx.clip();
    }
    for (const c of line.chars) {
      if (c.space) continue;
      c.li = li;
      const st = animated ? charState(layer, L, c, t) : null;
      if (st && st.o <= 0.001) continue;
      ctx.save();
      ctx.translate(line.x0 + c.x + c.w / 2, y);
      if (st) {
        ctx.translate(st.dx, st.dy);
        if (st.r) ctx.rotate(st.r);
        if (st.s !== 1) ctx.scale(st.s, st.s);
        ctx.globalAlpha *= st.o;
        if (HAS_FILTER && (st.b > 0.2 || layerBlur > 0)) ctx.filter = `blur(${(st.b + layerBlur) * sc}px)`;
      }
      if (s.strokeW > 0) ctx.strokeText(c.ch, -c.w / 2, 0);
      ctx.fillText(c.ch, -c.w / 2, 0);
      ctx.restore();
    }
    if (animated && layer.anim.type === 'rise') ctx.restore();
  });
}

function drawLayer(ctx, p, layer, t, sc, media) {
  const op = getProp(layer, 'opacity', t) / 100;
  if (op <= 0.001) return;
  const { m, w, h } = layerMatrix(p, layer, t);
  const s = layer.style;
  ctx.save();
  ctx.setTransform(sc, 0, 0, sc, 0, 0);
  ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
  ctx.globalAlpha = op;
  ctx.globalCompositeOperation = s.blend || 'source-over';
  const blur = getProp(layer, 'blur', t);
  if (HAS_FILTER && blur > 0) ctx.filter = `blur(${blur * sc}px)`;
  if (s.glow > 0) { ctx.shadowColor = s.glowColor; ctx.shadowBlur = s.glow * sc; }
  else if (s.shadow > 0) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = s.shadow * sc; ctx.shadowOffsetY = s.shadow * 0.35 * sc; }

  switch (layer.type) {
    case 'text': drawText(ctx, layer, t, sc, blur); break;
    case 'solid': ctx.fillStyle = paint(ctx, s, w, h); ctx.fillRect(0, 0, w, h); break;
    case 'rect':
    case 'ellipse':
      if (layer.type === 'rect') roundRect(ctx, 0, 0, w, h, s.radius);
      else { ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); }
      ctx.fillStyle = paint(ctx, s, w, h);
      ctx.fill();
      if (s.strokeW > 0) { ctx.lineWidth = s.strokeW; ctx.strokeStyle = s.stroke; ctx.stroke(); }
      break;
    case 'image':
    case 'video': {
      const md = media && media.get(s.mediaId);
      const el = md && md.el;
      const ready = el && (layer.type === 'image' ? el.complete && el.naturalWidth : el.readyState >= 2);
      if (s.radius > 0) { roundRect(ctx, 0, 0, w, h, s.radius); ctx.clip(); }
      if (ready) ctx.drawImage(el, 0, 0, w, h);
      else { ctx.fillStyle = 'rgba(128,128,128,0.35)'; ctx.fillRect(0, 0, w, h); }
      break;
    }
  }
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
    if (!isActive(L, t)) continue;
    drawLayer(ctx, p, L, t, sc, o.media);
  }
  if (o.overlay) drawOverlay(ctx, p, t, sc, o);
}

function drawOverlay(ctx, p, t, sc, o) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (o.guides) {
    ctx.strokeStyle = 'rgba(255,64,160,0.9)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    if (o.guides.v) { ctx.beginPath(); ctx.moveTo((p.width / 2) * sc, 0); ctx.lineTo((p.width / 2) * sc, p.height * sc); ctx.stroke(); }
    if (o.guides.h) { ctx.beginPath(); ctx.moveTo(0, (p.height / 2) * sc); ctx.lineTo(p.width * sc, (p.height / 2) * sc); ctx.stroke(); }
    ctx.setLineDash([]);
  }
  const L = o.selected && p.layers.find((l) => l.id === o.selected);
  if (!L || !isActive(L, t)) return;
  const { m, w, h } = layerMatrix(p, L, t);
  const pts = [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => { const q = m.transformPoint(new DOMPoint(x, y)); return [q.x * sc, q.y * sc]; });
  const dpr = o.dpr || 1;
  ctx.strokeStyle = '#8b7bff';
  ctx.lineWidth = 1.5 * dpr;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  for (const [x, y] of pts) { ctx.beginPath(); ctx.rect(x - 4 * dpr, y - 4 * dpr, 8 * dpr, 8 * dpr); ctx.fill(); ctx.stroke(); }
  const ax = getProp(L, 'x', t) * sc, ay = getProp(L, 'y', t) * sc;
  ctx.beginPath();
  ctx.arc(ax, ay, 5 * dpr, 0, Math.PI * 2);
  ctx.moveTo(ax - 9 * dpr, ay); ctx.lineTo(ax + 9 * dpr, ay);
  ctx.moveTo(ax, ay - 9 * dpr); ctx.lineTo(ax, ay + 9 * dpr);
  ctx.stroke();
}
