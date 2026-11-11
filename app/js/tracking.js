// Suivi de mouvement, suivi de texte, suivi de caméra 2D et stabilisation.
// Les images sont extraites une à une de la vidéo (image par image), analysées dans un Web Worker,
// puis les résultats sont convertis en keyframes réelles sur les calques cibles.
import { worldMatrix, propsFromWorld, setKey, getProp, uid, roundT, clamp } from './engine.js';

let worker = null, seq = 0;
const pending = new Map();
function rpc(msg, transfer = []) {
  if (!worker) {
    worker = new Worker(new URL('./tracker.worker.js', import.meta.url));
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      e.data.error ? p.rej(new Error(e.data.error)) : p.res(e.data);
    };
    worker.onerror = (e) => { for (const p of pending.values()) p.rej(new Error(e.message || 'Erreur du worker')); pending.clear(); };
  }
  return new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); worker.postMessage({ ...msg, id }, transfer); });
}

// Extraction d'images d'une vidéo à des instants précis.
export class Grabber {
  constructor(url, maxDim = 640) { this.url = url; this.maxDim = maxDim; }
  async open() {
    const v = (this.v = document.createElement('video'));
    v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto';
    v.src = this.url;
    await new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error('La vidéo ne se charge pas')), 15000);
      v.onloadeddata = () => { clearTimeout(to); res(); };
      v.onerror = () => { clearTimeout(to); rej(new Error('Vidéo illisible par ce navigateur')); };
    });
    try { await v.play(); v.pause(); } catch {}
    this.vw = v.videoWidth; this.vh = v.videoHeight;
    this.k = Math.min(1, this.maxDim / Math.max(this.vw, this.vh));
    this.w = Math.max(16, Math.round(this.vw * this.k));
    this.h = Math.max(16, Math.round(this.vh * this.k));
    this.c = document.createElement('canvas');
    this.c.width = this.w; this.c.height = this.h;
    this.ctx = this.c.getContext('2d', { willReadFrequently: true });
    this.duration = v.duration;
  }
  async grab(vt) {
    const v = this.v;
    vt = clamp(vt, 0, Math.max(0, this.duration - 0.001));
    if (Math.abs(v.currentTime - vt) > 1e-4) {
      await new Promise((res) => {
        const to = setTimeout(res, 3000);
        v.onseeked = () => { clearTimeout(to); res(); };
        v.currentTime = vt;
      });
    }
    this.ctx.drawImage(v, 0, 0, this.w, this.h);
    return this.ctx.getImageData(0, 0, this.w, this.h).data.buffer;
  }
  close() { if (this.v) { this.v.removeAttribute('src'); this.v.load(); } }
}

export const videoTime = (L, t) => (t - L.start) * (L.style.speed || 1) + (L.style.trim || 0);

export function newTrack(kind, L, fps, vw, vh) {
  const names = { point: 'Suivi 1 point', two: 'Suivi 2 points', camera: 'Caméra 2D' };
  return { id: uid(), name: names[kind], kind, layerId: L.id, fps, vw, vh, r: 18, s: 30, data: {} };
}

// Conversion pixels vidéo → composition, à l'instant t.
export function videoToComp(p, L, t, track) {
  const { m, w, h } = worldMatrix(p, L, t);
  return m.multiply(new DOMMatrix().scaleSelf(w / track.vw, h / track.vh));
}

const mat = (a) => new DOMMatrix([a[0], a[1], a[2], a[3], a[4], a[5]]);

function simFromPairs(A0, B0, A1, B1) {
  // Similarité exacte envoyant (A0,B0) sur (A1,B1).
  const v0x = B0.x - A0.x, v0y = B0.y - A0.y, v1x = B1.x - A1.x, v1y = B1.y - A1.y;
  const d = v0x * v0x + v0y * v0y;
  if (d < 1e-9) return new DOMMatrix().translateSelf(A1.x - A0.x, A1.y - A0.y);
  const c = (v0x * v1x + v0y * v1y) / d, s = (v0x * v1y - v0y * v1x) / d;
  return new DOMMatrix([c, s, -s, c, A1.x - (c * A0.x - s * A0.y), A1.y - (s * A0.x + c * A0.y)]);
}

// Mouvement (dans l'espace de la composition) entre l'image de référence fr et l'image f.
export function motion(p, track, L, f, fr) {
  const fps = track.fps;
  const a = track.data[f], b = track.data[fr];
  if (!a || !b) return null;
  const V = (ff) => videoToComp(p, L, ff / fps, track);
  if (track.kind === 'camera') return V(f).multiply(mat(a.m)).multiply(mat(b.m).inverse()).multiply(V(fr).inverse());
  const P = (arr, i, ff) => V(ff).transformPoint(new DOMPoint(arr[i][0], arr[i][1]));
  if (track.kind === 'two' && a.length > 1 && b.length > 1) return simFromPairs(P(b, 0, fr), P(b, 1, fr), P(a, 0, f), P(a, 1, f));
  const p1 = P(a, 0, f), p0 = P(b, 0, fr);
  return new DOMMatrix().translateSelf(p1.x - p0.x, p1.y - p0.y);
}

export const trackFrames = (track) => Object.keys(track.data).map(Number).sort((x, y) => x - y);

function clearRange(L, prop, t0, t1) {
  const k = L.kf[prop];
  if (!k) return;
  L.kf[prop] = k.filter((q) => q.t < t0 - 0.0005 || q.t > t1 + 0.0005);
  if (!L.kf[prop].length) delete L.kf[prop];
}

// Attache un calque au suivi : il reproduit le mouvement mesuré, en gardant son décalage initial.
export function applyTrack(p, track, src, target, opts) {
  const frames = trackFrames(track);
  if (frames.length < 2) throw new Error('Le suivi ne contient pas assez d\'images');
  const fps = track.fps;
  let fr = opts.ref != null ? opts.ref : frames[0];
  if (!track.data[fr]) fr = frames.reduce((best, f) => (Math.abs(f - fr) < Math.abs(best - fr) ? f : best), frames[0]);
  const Dref = worldMatrix(p, target, fr / fps).m;
  const props = ['x', 'y', ...(opts.rot ? ['rotation'] : []), ...(opts.scale ? ['scale'] : [])];
  const base = { rotation: getProp(target, 'rotation', fr / fps), scale: getProp(target, 'scale', fr / fps) };
  const rows = [];
  let prevRot = null;
  for (const f of frames) {
    const G = motion(p, track, src, f, fr);
    if (!G) continue;
    const t = f / fps;
    const pr = propsFromWorld(p, target, G.multiply(Dref), t);
    if (prevRot != null) while (pr.rotation - prevRot > 180) pr.rotation -= 360;
    if (prevRot != null) while (pr.rotation - prevRot < -180) pr.rotation += 360;
    prevRot = pr.rotation;
    if (!opts.rot) pr.rotation = base.rotation;
    if (!opts.scale) pr.scale = base.scale;
    rows.push([t, pr]);
  }
  const t0 = rows[0][0], t1 = rows[rows.length - 1][0];
  for (const n of props) clearRange(target, n, t0, t1);
  for (const [t, pr] of rows) for (const n of props) setKey(target, n, roundT(t), Math.round(pr[n] * 100) / 100, 'linear');
  return rows.length;
}

// Stabilisation : applique le mouvement inverse au calque vidéo lui-même.
export function stabilize(p, track, L, opts) {
  const frames = trackFrames(track);
  if (frames.length < 2) throw new Error('Le suivi ne contient pas assez d\'images');
  const fps = track.fps, fr = frames[0];
  const zoom = (opts.zoom || 100) / 100;
  const c = new DOMPoint(p.width / 2, p.height / 2);
  const Z = new DOMMatrix().translateSelf(c.x, c.y).scaleSelf(zoom, zoom).translateSelf(-c.x, -c.y);
  const pre = frames.map((f) => ({ f, G: motion(p, track, L, f, fr), W: worldMatrix(p, L, f / fps).m }));
  const props = opts.full ? ['x', 'y', 'rotation', 'scale'] : ['x', 'y', 'scale'];
  const rows = [];
  let prevRot = null;
  for (const { f, G, W } of pre) {
    if (!G) continue;
    let Gi = G.inverse();
    if (!opts.full) Gi = new DOMMatrix().translateSelf(Gi.e + (Gi.a - 1) * c.x + Gi.c * c.y, Gi.f + Gi.b * c.x + (Gi.d - 1) * c.y);
    const pr = propsFromWorld(p, L, Z.multiply(Gi).multiply(W), f / fps);
    if (prevRot != null) { while (pr.rotation - prevRot > 180) pr.rotation -= 360; while (pr.rotation - prevRot < -180) pr.rotation += 360; }
    prevRot = pr.rotation;
    rows.push([f / fps, pr]);
  }
  const t0 = rows[0][0], t1 = rows[rows.length - 1][0];
  for (const n of props) clearRange(L, n, t0, t1);
  for (const [t, pr] of rows) for (const n of props) setKey(L, n, roundT(t), Math.round(pr[n] * 100) / 100, 'linear');
  return rows.length;
}

// Aimante les points sur le détail le plus contrasté à proximité (« détection » du point à suivre).
export async function snapPoints(url, vt, ptsVideo, radiusVideo) {
  const g = new Grabber(url, 640);
  await g.open();
  try {
    const buf = await g.grab(vt);
    const r = await rpc({ cmd: 'snap', w: g.w, h: g.h, rgba: buf, pts: ptsVideo.map(([x, y]) => [x * g.k, y * g.k]), radius: radiusVideo * g.k }, [buf]);
    return r.pts.map(([x, y]) => [x / g.k, y / g.k]);
  } finally { g.close(); }
}

// Suivi de points (1 ou 2), vers l'avant ou l'arrière, à partir de l'image courante.
export async function runPointTrack({ p, L, url, track, fromT, dir, onProgress, signal, adapt = true, maxDim = 640 }) {
  const fps = track.fps;
  const g = new Grabber(url, maxDim);
  await g.open();
  track.vw = g.vw; track.vh = g.vh;
  let f = Math.round(fromT * fps);
  const start = track.data[f];
  if (!start) throw new Error('Placez d\'abord les points de suivi sur l\'image courante');
  const firstF = Math.ceil(L.start * fps), lastF = Math.ceil(L.end * fps) - 1;
  const endF = dir > 0 ? lastF : firstF;
  const total = Math.max(1, Math.abs(endF - f));
  let done = 0, lost = 0, reason = 'fin du calque';
  try {
    let buf = await g.grab(videoTime(L, f / fps));
    const r = Math.max(4, Math.round(track.r * g.k)), s = Math.max(6, Math.round(track.s * g.k));
    await rpc({ cmd: 'start', w: g.w, h: g.h, rgba: buf, pts: start.map(([x, y]) => [x * g.k, y * g.k]), r, s }, [buf]);
    for (f += dir; dir > 0 ? f <= endF : f >= endF; f += dir) {
      if (signal?.aborted) { reason = 'arrêté'; break; }
      const vt = videoTime(L, f / fps);
      if (vt < 0 || vt > g.duration) { reason = 'fin de la vidéo'; break; }
      buf = await g.grab(vt);
      const res = await rpc({ cmd: 'next', rgba: buf, adapt }, [buf]);
      track.data[f] = res.pts.map(([x, y, c]) => [x / g.k, y / g.k, Math.round(c * 1000) / 1000]);
      done++;
      const minC = Math.min(...res.pts.map((q) => q[2]));
      lost = minC < 0.4 ? lost + 1 : 0;
      onProgress && onProgress(done / total, f, minC);
      if (lost >= 4) { reason = `suivi perdu (confiance ${Math.round(minC * 100)} %) — corrigez le point puis relancez`; break; }
    }
  } finally { g.close(); }
  return { frames: done, reason };
}

// Suivi de caméra 2D : mouvement global de la scène (translation, rotation, échelle) par image.
export const camViz = new Map(); // trackId -> Map(frame -> [[x,y]...]) (pixels vidéo, non sauvegardé)
export async function runCameraTrack({ p, L, url, track, onProgress, signal, maxDim = 480, features = 90 }) {
  const fps = track.fps;
  const g = new Grabber(url, maxDim);
  await g.open();
  track.vw = g.vw; track.vh = g.vh;
  track.data = {};
  const viz = new Map();
  camViz.set(track.id, viz);
  const f0 = Math.ceil(L.start * fps), f1 = Math.ceil(L.end * fps) - 1;
  const total = Math.max(1, f1 - f0);
  let weak = 0, reason = 'terminé';
  try {
    let buf = await g.grab(videoTime(L, f0 / fps));
    const st = await rpc({ cmd: 'camStart', w: g.w, h: g.h, rgba: buf, max: features }, [buf]);
    if (st.n < 6) throw new Error('Pas assez de détails dans l\'image pour suivre la caméra');
    track.data[f0] = { m: [1, 0, 0, 1, 0, 0], n: st.n };
    viz.set(f0, st.feats.map(([x, y]) => [x / g.k, y / g.k]));
    for (let f = f0 + 1; f <= f1; f++) {
      if (signal?.aborted) { reason = 'arrêté'; break; }
      const vt = videoTime(L, f / fps);
      if (vt > g.duration) break;
      buf = await g.grab(vt);
      const r = await rpc({ cmd: 'camNext', rgba: buf }, [buf]);
      const m = r.m;
      track.data[f] = { m: [m[0], m[1], m[2], m[3], m[4] / g.k, m[5] / g.k], n: r.n };
      viz.set(f, r.feats.map(([x, y]) => [x / g.k, y / g.k]));
      weak = r.ok ? 0 : weak + 1;
      onProgress && onProgress((f - f0) / total, f, r.n);
      if (weak > 15) { reason = 'scène trop instable ou trop uniforme : suivi interrompu'; break; }
    }
  } finally { g.close(); }
  return { frames: Object.keys(track.data).length, reason };
}

// Correction manuelle d'un point à l'image f (coordonnées composition).
export function setTrackPoint(p, track, L, f, i, cx, cy) {
  const V = videoToComp(p, L, f / track.fps, track).inverse();
  const q = V.transformPoint(new DOMPoint(cx, cy));
  const arr = (track.data[f] ||= []);
  arr[i] = [q.x, q.y, 1];
}
export function trackPointComp(p, track, L, f, i) {
  const a = track.data[f];
  if (!a || !a[i]) return null;
  return videoToComp(p, L, f / track.fps, track).transformPoint(new DOMPoint(a[i][0], a[i][1]));
}

// Dessin de l'interface de suivi sur la scène.
export function drawTrackOverlay(ctx, sc, dpr, p, t, track, L) {
  const fps = track.fps;
  const f = Math.round(t * fps);
  const frames = trackFrames(track);
  ctx.save();
  if (track.kind === 'camera') {
    const viz = camViz.get(track.id)?.get(f);
    const V = videoToComp(p, L, t, track);
    if (viz) {
      ctx.fillStyle = '#22d3ee';
      for (const [x, y] of viz) { const q = V.transformPoint(new DOMPoint(x, y)); ctx.beginPath(); ctx.arc(q.x * sc, q.y * sc, 2.5 * dpr, 0, Math.PI * 2); ctx.fill(); }
    }
    // Grille de scène déformée par le mouvement mesuré (visualise le suivi réel).
    const G = frames.length && track.data[f] ? motion(p, track, L, f, frames[0]) : null;
    if (G) {
      ctx.strokeStyle = 'rgba(167,139,250,0.85)';
      ctx.lineWidth = 1.2 * dpr;
      const n = 4;
      for (let i = 0; i <= n; i++) {
        ctx.beginPath();
        for (let j = 0; j <= n; j++) { const q = G.transformPoint(new DOMPoint((p.width * i) / n, (p.height * j) / n)); j ? ctx.lineTo(q.x * sc, q.y * sc) : ctx.moveTo(q.x * sc, q.y * sc); }
        ctx.stroke();
        ctx.beginPath();
        for (let j = 0; j <= n; j++) { const q = G.transformPoint(new DOMPoint((p.width * j) / n, (p.height * i) / n)); j ? ctx.lineTo(q.x * sc, q.y * sc) : ctx.moveTo(q.x * sc, q.y * sc); }
        ctx.stroke();
      }
    }
    ctx.restore();
    return;
  }
  const n = track.kind === 'two' ? 2 : 1;
  const step = Math.max(1, Math.ceil(frames.length / 400));
  for (let i = 0; i < n; i++) {
    ctx.strokeStyle = i ? 'rgba(244,114,182,0.9)' : 'rgba(34,211,238,0.9)';
    ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath();
    let started = false;
    for (let k = 0; k < frames.length; k += step) {
      const q = trackPointComp(p, track, L, frames[k], i);
      if (!q) continue;
      started ? ctx.lineTo(q.x * sc, q.y * sc) : ctx.moveTo(q.x * sc, q.y * sc);
      started = true;
    }
    ctx.stroke();
    const q = trackPointComp(p, track, L, f, i);
    if (!q) continue;
    const V = videoToComp(p, L, t, track);
    const k = Math.hypot(V.a, V.b) * sc;
    const c = track.data[f][i][2] ?? 1;
    ctx.strokeStyle = c > 0.8 ? '#4ade80' : c > 0.55 ? '#facc15' : '#f87171';
    ctx.lineWidth = 2 * dpr;
    const r = track.r * k, s = track.s * k;
    ctx.strokeRect(q.x * sc - r, q.y * sc - r, 2 * r, 2 * r);
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    ctx.strokeRect(q.x * sc - r - s, q.y * sc - r - s, 2 * (r + s), 2 * (r + s));
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(q.x * sc - 6 * dpr, q.y * sc); ctx.lineTo(q.x * sc + 6 * dpr, q.y * sc);
    ctx.moveTo(q.x * sc, q.y * sc - 6 * dpr); ctx.lineTo(q.x * sc, q.y * sc + 6 * dpr);
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.font = `${11 * dpr}px system-ui`;
    ctx.fillText(`${i + 1} · ${Math.round(c * 100)}%`, q.x * sc + r + 4 * dpr, q.y * sc - r);
  }
  ctx.restore();
}
