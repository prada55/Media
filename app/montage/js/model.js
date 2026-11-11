// Modèle du montage (piste principale magnétique + pistes libres) et compilation vers le moteur de rendu.
import * as E from '../../js/engine.js';
import { PRESETS } from '../../js/presets.js';

export const uid = E.uid;

export const FORMATS = [
  { id: '9x16', label: '9:16', sub: 'TikTok · Reels · Shorts', w: 1080, h: 1920 },
  { id: '16x9', label: '16:9', sub: 'YouTube · paysage', w: 1920, h: 1080 },
  { id: '1x1', label: '1:1', sub: 'Carré', w: 1080, h: 1080 },
  { id: '4x5', label: '4:5', sub: 'Instagram portrait', w: 1080, h: 1350 },
  { id: '3x4', label: '3:4', sub: 'Portrait', w: 1080, h: 1440 },
];

export function newMontage(fmt = '9x16', name = 'Sans titre') {
  const f = FORMATS.find((x) => x.id === fmt) || FORMATS[0];
  return {
    id: uid(), kind: 'montage', version: 1, name, width: f.w, height: f.h, fps: 30,
    bg: { type: 'blur', color: '#000000', blur: 45 },
    media: [], main: [], tracks: [], created: Date.now(), updated: Date.now(),
  };
}

const baseVisual = (p) => ({
  props: { x: p.width / 2, y: p.height / 2, scale: 100, rotation: 0, opacity: 100 }, kf: {},
  filter: { id: 'none', amount: 80 }, adjust: { bright: 0, contrast: 0, sat: 0, temp: 0, hue: 0 },
  effects: [], anim: { in: null, out: null, loop: null }, inDur: 0.5, outDur: 0.5,
});

export function newClip(p, m) {
  return {
    id: uid(), mediaId: m.id, kind: m.kind, name: m.name, trim: 0,
    dur: m.kind === 'image' ? 3 : Math.max(0.1, m.dur || 3), srcDur: m.kind === 'image' ? 0 : m.dur || 0,
    speed: 1, volume: 100, muted: false, fadeIn: 0, fadeOut: 0, fit: 'fit', transition: null, ...baseVisual(p),
  };
}
export function newOverlay(p, m, start) {
  const o = newClip(p, m);
  return { ...o, type: 'media', start, fit: 'fit', props: { ...o.props, scale: 55 } };
}
export function newAudioItem(m, start) {
  return { id: uid(), type: 'audio', mediaId: m.id, name: m.name, start, trim: 0, dur: Math.max(0.1, m.dur || 3), srcDur: m.dur || 0, speed: 1, volume: 100, muted: false, fadeIn: 0, fadeOut: 0 };
}

export const TEXT_STYLES = [
  { id: 'basic', label: 'Simple', style: { color: '#ffffff', weight: '800', strokeW: 0, bgOn: false } },
  { id: 'outline', label: 'Contour', style: { color: '#ffffff', weight: '900', strokeW: 6, stroke: '#000000', bgOn: false } },
  { id: 'yellow', label: 'Jaune', style: { color: '#ffe14d', weight: '900', strokeW: 6, stroke: '#000000', bgOn: false } },
  { id: 'box', label: 'Encadré', style: { color: '#111111', weight: '800', strokeW: 0, bgOn: true, bg: '#ffffff' } },
  { id: 'boxdark', label: 'Bandeau', style: { color: '#ffffff', weight: '700', strokeW: 0, bgOn: true, bg: '#000000cc' } },
  { id: 'neon', label: 'Néon', style: { color: '#f0abfc', weight: '900', strokeW: 0, bgOn: false }, glow: '#d946ef' },
  { id: 'grad', label: 'Dégradé', style: { color: '#22d3ee', color2: '#a78bfa', gradOn: true, weight: '900', strokeW: 0, bgOn: false } },
  { id: 'serif', label: 'Élégant', style: { color: '#ffffff', weight: '600', italic: true, font: 'Georgia, serif', strokeW: 0, bgOn: false } },
  { id: 'pop', label: 'Pop 3D', style: { color: '#ffffff', weight: '900', strokeW: 0, depth: 10, depthColor: '#7c3aed', bgOn: false } },
];

export function newTextItem(p, start, opts = {}) {
  const caption = !!opts.caption;
  return {
    id: uid(), type: 'text', caption, start, dur: opts.dur || 3, name: opts.text || 'Texte',
    text: opts.text || 'Texte', styleId: caption ? 'outline' : 'basic',
    style: {
      font: 'system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif', size: Math.round(Math.min(p.width, p.height) * (caption ? 0.06 : 0.09)),
      weight: '800', italic: false, color: '#ffffff', color2: '#a78bfa', gradOn: false, gradAngle: 90, align: 'center', tracking: 0, leading: 1.15,
      stroke: '#000000', strokeW: caption ? 6 : 0, depth: 0, depthColor: '#7c3aed', depthAngle: 45, bgOn: false, bg: '#000000', bgPad: 24, bgRadius: 18,
    },
    shadow: caption, glow: null,
    textAnim: { type: 'none', by: 'char', dur: 0.4, stagger: 0.04, delay: 0, out: false },
    ...baseVisual(p),
    props: { x: p.width / 2, y: caption ? p.height * 0.78 : p.height / 2, scale: 100, rotation: 0, opacity: 100 },
    ...(opts.sticker ? { sticker: true } : {}),
  };
}
export function newSticker(p, start, emoji) {
  const it = newTextItem(p, start, { text: emoji });
  it.sticker = true;
  it.name = 'Sticker ' + emoji;
  it.style.size = Math.round(Math.min(p.width, p.height) * 0.22);
  it.anim.in = 'pop';
  it.anim.loop = 'float';
  return it;
}

// ---------- Filtres, réglages, effets, animations, transitions ----------
// Filtre = réglages couleur (+ grain / vignette), modulés par l'intensité.
export const FILTERS = [
  { id: 'none', label: 'Aucun', c: {} },
  { id: 'vivid', label: 'Vif', c: { sat: 35, contrast: 15 } },
  { id: 'warm', label: 'Chaud', c: { temp: 45, sat: 10, bright: 4 } },
  { id: 'cool', label: 'Froid', c: { temp: -45, sat: 5 } },
  { id: 'bw', label: 'Noir & blanc', c: { sat: -100, contrast: 20 } },
  { id: 'vintage', label: 'Vintage', c: { sat: -30, temp: 30, contrast: -10 }, grain: 20, vignette: 40 },
  { id: 'cine', label: 'Ciné', c: { contrast: 22, sat: -15, temp: -12 }, vignette: 50 },
  { id: 'fade', label: 'Délavé', c: { contrast: -30, bright: 12, sat: -25 } },
  { id: 'neon', label: 'Néon', c: { sat: 60, hue: 20, contrast: 20 } },
  { id: 'sunset', label: 'Coucher', c: { temp: 60, hue: -10, sat: 20, contrast: 8 } },
  { id: 'matte', label: 'Mat', c: { contrast: -18, sat: -10, bright: 6 }, grain: 10 },
  { id: 'vhs', label: 'VHS', c: { sat: -20, contrast: 10 }, grain: 30, rgb: 5 },
];
export const ADJUST = [['bright', 'Luminosité'], ['contrast', 'Contraste'], ['sat', 'Saturation'], ['temp', 'Température'], ['hue', 'Teinte']];
export const EFFECTS = [
  { id: 'glitch', label: 'Glitch', fx: 'glitch', p: (a) => ({ amount: a, block: 40, speed: 12 }) },
  { id: 'blur', label: 'Flou', fx: 'blur', p: (a) => ({ radius: a * 0.4 }) },
  { id: 'rgb', label: 'RGB Split', fx: 'rgb', p: (a) => ({ amount: a * 0.3, angle: 0 }) },
  { id: 'chroma', label: 'Aberration', fx: 'chroma', p: (a) => ({ amount: a }) },
  { id: 'vignette', label: 'Vignette', fx: 'vignette', p: (a) => ({ amount: a, size: 45, soft: 50 }) },
  { id: 'grain', label: 'Grain', fx: 'grain', p: (a) => ({ amount: a * 0.6, size: 1.5, speed: 24 }) },
  { id: 'glow', label: 'Lueur', fx: 'glow', p: (a) => ({ amount: a * 0.8, color: '#ffffff' }) },
  { id: 'shake', label: 'Secousse', loop: 'shake' },
  { id: 'pulse', label: 'Pulsation', loop: 'pulse' },
  { id: 'swing', label: 'Balancier', loop: 'swing' },
];
export const ANIM_IN = PRESETS.filter((x) => x.group === 'in').map((x) => [x.id, x.label]);
export const ANIM_OUT = PRESETS.filter((x) => x.group === 'out').map((x) => [x.id, x.label]);
export const ANIM_LOOP = [['pulse', 'Pulsation'], ['float', 'Flottement'], ['swing', 'Balancier'], ['spin', 'Rotation ∞'], ['flicker', 'Néon'], ['kenburns', 'Zoom lent (Ken Burns)']];
export const TRANSITIONS = [
  ['fade', 'Fondu enchaîné', true], ['dip', 'Fondu au noir', false], ['slideL', 'Glisser ←', true], ['slideR', 'Glisser →', true],
  ['slideU', 'Glisser ↑', true], ['push', 'Pousser', true], ['zoom', 'Zoom', true], ['wipe', 'Volet', true], ['blur', 'Flou', true], ['spin', 'Tourbillon', true],
];
export const transOverlaps = (type) => (TRANSITIONS.find((x) => x[0] === type) || [])[2] !== false;

// ---------- Chronologie ----------
// La piste principale est magnétique : chaque clip suit le précédent ; une transition fait chevaucher deux clips.
export function mainLayout(p) {
  let t = 0;
  const out = [];
  p.main.forEach((c, i) => {
    const prev = p.main[i - 1];
    let ov = 0;
    if (prev && prev.transition && transOverlaps(prev.transition.type)) ov = Math.min(prev.transition.dur, prev.dur / 2, c.dur / 2);
    const start = Math.max(0, t - ov);
    out.push({ c, start, end: start + c.dur, ov });
    t = start + c.dur;
  });
  return { items: out, end: t };
}
export function duration(p) {
  let d = mainLayout(p).end;
  for (const tr of p.tracks) for (const it of tr.items) d = Math.max(d, it.start + it.dur);
  return Math.max(0.5, Math.ceil(d * p.fps) / p.fps);
}

// ---------- Compilation vers le moteur ----------
function sizeFor(p, m, fit) {
  const nw = m?.w || p.width, nh = m?.h || p.height;
  const k = (fit === 'fill' ? Math.max : Math.min)(p.width / nw, p.height / nh);
  return { w: Math.round(nw * k), h: Math.round(nh * k) };
}
function shiftedKf(kf, dt) {
  const out = {};
  for (const n in kf) out[n] = kf[n].map((q) => ({ ...q, t: E.roundT(q.t + dt) }));
  return out;
}
function colorFx(o) {
  const fx = [];
  const f = FILTERS.find((x) => x.id === o.filter?.id);
  const k = (o.filter?.amount ?? 80) / 100;
  const c = { bright: 0, contrast: 0, sat: 0, hue: 0, temp: 0 };
  if (f) for (const n in f.c) c[n] += f.c[n] * k;
  for (const [n] of ADJUST) c[n] += o.adjust?.[n] || 0;
  if (Object.values(c).some((v) => Math.abs(v) > 0.01)) { const e = E.newEffect('color'); Object.assign(e.params, c); fx.push(e); }
  if (f?.rgb) { const e = E.newEffect('rgb'); e.params.amount = f.rgb * k; fx.push(e); }
  if (f?.grain) { const e = E.newEffect('grain'); e.params.amount = f.grain * k; fx.push(e); }
  if (f?.vignette) { const e = E.newEffect('vignette'); e.params.amount = f.vignette * k; fx.push(e); }
  for (const ef of o.effects || []) {
    const d = EFFECTS.find((x) => x.id === ef.id);
    if (!d || !d.fx) continue;
    const e = E.newEffect(d.fx);
    Object.assign(e.params, d.p(ef.amount ?? 50));
    fx.push(e);
  }
  return fx;
}
function applyAnims(P, L, o, start, end) {
  const preset = (id) => PRESETS.find((x) => x.id === id);
  if (o.anim?.loop === 'kenburns') {
    const s = E.getProp(L, 'scale', start);
    E.setKey(L, 'scale', start, s, 'linear'); E.setKey(L, 'scale', end, s * 1.15, 'linear');
  } else if (o.anim?.loop && preset(o.anim.loop)) preset(o.anim.loop).fn(L, start, P);
  for (const ef of o.effects || []) { const d = EFFECTS.find((x) => x.id === ef.id); if (d?.loop && preset(d.loop)) preset(d.loop).fn(L, start, P); }
  if (o.anim?.in && preset(o.anim.in)) { const pr = preset(o.anim.in); pr.fn(L, start, P); stretchTo(L, start, start + 0.6, o.inDur); }
  if (o.anim?.out && preset(o.anim.out)) { const pr = preset(o.anim.out); pr.fn(L, end, P); }
}
// Les préréglages durent ~0,6 s : on adapte la durée d'entrée demandée.
function stretchTo(L, t0, t1, d) {
  if (!d || Math.abs(d - 0.6) < 0.01) return;
  const f = d / 0.6;
  for (const n in L.kf) for (const q of L.kf[n]) if (q.t > t0 + 0.0005 && q.t <= t1 + 0.0005) q.t = E.roundT(t0 + (q.t - t0) * f);
}

function visualLayer(P, p, o, kind, start, end, meta) {
  const sz = sizeFor(p, meta, o.fit);
  const L = E.newLayer(P, kind, {
    name: o.name, start, end,
    style: { mediaId: o.mediaId, w: sz.w, h: sz.h, trim: o.trim, speed: o.speed, volume: o.volume, muted: o.muted, fadeIn: o.fadeIn, fadeOut: o.fadeOut },
    props: { ...o.props },
  });
  L.id = o.id;
  L.kf = shiftedKf(o.kf, start);
  L.fx = colorFx(o);
  return L;
}

function transition(P, A, B, tr, a, b) {
  const d = Math.max(0.1, tr.dur);
  const t0 = B.start, t1 = B.start + Math.min(d, b.c.dur / 2);
  const W = P.width, H = P.height;
  const key = (L, n, ta, va, tb, vb, e = 'expoInOut') => { E.setKey(L, n, ta, va, e); E.setKey(L, n, tb, vb, e); };
  const gv = (L, n, t) => E.getProp(L, n, t);
  switch (tr.type) {
    case 'fade': key(B, 'opacity', t0, 0, t1, gv(B, 'opacity', t1), 'linear'); break;
    case 'dip': {
      const h = Math.min(d / 2, a.c.dur / 2, b.c.dur / 2);
      key(A, 'opacity', A.end - h, gv(A, 'opacity', A.end - h), A.end, 0, 'linear');
      key(B, 'opacity', B.start, 0, B.start + h, gv(B, 'opacity', B.start + h), 'linear');
      break;
    }
    case 'slideL': key(B, 'x', t0, gv(B, 'x', t1) + W, t1, gv(B, 'x', t1)); break;
    case 'slideR': key(B, 'x', t0, gv(B, 'x', t1) - W, t1, gv(B, 'x', t1)); break;
    case 'slideU': key(B, 'y', t0, gv(B, 'y', t1) + H, t1, gv(B, 'y', t1)); break;
    case 'push': key(B, 'x', t0, gv(B, 'x', t1) + W, t1, gv(B, 'x', t1)); key(A, 'x', t0, gv(A, 'x', t0), t1, gv(A, 'x', t0) - W); break;
    case 'zoom': key(B, 'scale', t0, gv(B, 'scale', t1) * 1.5, t1, gv(B, 'scale', t1)); key(B, 'opacity', t0, 0, t1, gv(B, 'opacity', t1), 'linear'); break;
    case 'wipe': key(B, 's.clipR', t0, 100, t1, 0); break;
    case 'blur': key(B, 'blur', t0, 40, t1, 0, 'out'); key(B, 'opacity', t0, 0, t1, gv(B, 'opacity', t1), 'linear'); key(A, 'blur', t0, 0, t1, 40, 'in'); break;
    case 'spin': key(B, 'rotation', t0, gv(B, 'rotation', t1) - 120, t1, gv(B, 'rotation', t1)); key(B, 'scale', t0, 0, t1, gv(B, 'scale', t1)); break;
  }
}

function textLayer(P, it) {
  const L = E.newLayer(P, 'text', { name: it.name, start: it.start, end: it.start + it.dur, style: { ...it.style, text: it.text }, props: { ...it.props } });
  L.id = it.id;
  L.kf = shiftedKf(it.kf, it.start);
  L.anim = { ...it.textAnim };
  L.fx = colorFx({ ...it, filter: null, adjust: null });
  if (it.shadow) { const e = E.newEffect('shadow'); e.params.blur = 18; e.params.dist = 6; e.params.opacity = 70; L.fx.push(e); }
  if (it.glow) { const e = E.newEffect('glow'); e.params.color = it.glow; e.params.amount = 40; L.fx.push(e); }
  return L;
}

// Compile le montage en projet du moteur (liste de calques, le premier au-dessus).
export function compile(p, mediaMeta) {
  const P = { width: p.width, height: p.height, fps: p.fps, duration: duration(p), bg: p.bg.type === 'color' ? p.bg.color : '#000000', layers: [], fonts: p.fonts || [], media: [], tracks: [] };
  const meta = (id) => mediaMeta(id) || p.media.find((m) => m.id === id);
  const top = [];
  // Pistes libres : la dernière piste est au-dessus.
  for (const tr of [...p.tracks].reverse()) {
    if (tr.hidden) continue;
    for (const it of tr.items) {
      if (it.type === 'text') { const L = textLayer(P, it); applyAnims(P, L, it, it.start, it.start + it.dur); top.push(L); }
      else if (it.type === 'media') { const L = visualLayer(P, p, it, it.kind, it.start, it.start + it.dur, meta(it.mediaId)); if (tr.muted) L.style.muted = true; applyAnims(P, L, it, it.start, it.start + it.dur); top.push(L); }
      else if (it.type === 'audio') {
        const L = E.newLayer(P, 'audio', { name: it.name, start: it.start, end: it.start + it.dur, style: { mediaId: it.mediaId, trim: it.trim, speed: it.speed, volume: it.volume, muted: it.muted || tr.muted, fadeIn: it.fadeIn, fadeOut: it.fadeOut } });
        L.id = it.id;
        top.push(L);
      }
    }
  }
  // Piste principale.
  const lay = mainLayout(p).items;
  const mainLayers = lay.map((x) => {
    const L = visualLayer(P, p, x.c, x.c.kind, x.start, x.end, meta(x.c.mediaId));
    if (p.mainMuted) L.style.muted = true;
    return L;
  });
  lay.forEach((x, i) => { if (i > 0 && lay[i - 1].c.transition) transition(P, mainLayers[i - 1], mainLayers[i], lay[i - 1].c.transition, lay[i - 1], x); });
  lay.forEach((x, i) => applyAnims(P, mainLayers[i], x.c, x.start, x.end));
  // Arrière-plan flou : copie agrandie et floutée de chaque clip (même élément vidéo, aucun décodage en plus).
  const bgs = [];
  if (p.bg.type === 'blur') lay.forEach((x, i) => {
    const L = visualLayer(P, p, { ...x.c, fit: 'fill', props: { x: p.width / 2, y: p.height / 2, scale: 100, rotation: 0, opacity: 100 }, kf: {}, effects: [], filter: x.c.filter }, x.c.kind, x.start, x.end, meta(x.c.mediaId));
    L.id = 'bg_' + x.c.id;
    L.locked = true;
    L.style.muted = true;
    L.alias = x.c.id;
    if (mainLayers[i].kf.opacity) L.kf.opacity = mainLayers[i].kf.opacity.map((q) => ({ ...q }));
    const b = E.newEffect('blur'); b.params.radius = p.bg.blur;
    const c = E.newEffect('bright'); c.params.bright = -25;
    L.fx.push(b, c);
    bgs.push(L);
  });
  P.layers = [...top, ...mainLayers.reverse(), ...bgs.reverse()];
  return P;
}

// ---------- Sous-titres SRT ----------
const srtTime = (s) => { const [h, m, rest] = s.trim().split(':'); const [sec, ms] = rest.split(/[,.]/); return +h * 3600 + +m * 60 + +sec + (+ms || 0) / 1000; };
export function parseSRT(txt) {
  const out = [];
  for (const block of txt.replace(/\r/g, '').split(/\n\s*\n/)) {
    const lines = block.trim().split('\n');
    const i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const [a, b] = lines[i].split('-->');
    const text = lines.slice(i + 1).join('\n').replace(/<[^>]+>/g, '').trim();
    if (text) out.push({ start: srtTime(a), end: srtTime(b.trim().split(' ')[0]), text });
  }
  return out;
}
const fmtSrt = (t) => { const ms = Math.round(t * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
export function toSRT(items) {
  return items.slice().sort((a, b) => a.start - b.start).map((it, i) => `${i + 1}\n${fmtSrt(it.start)} --> ${fmtSrt(it.start + it.dur)}\n${it.text}\n`).join('\n');
}
