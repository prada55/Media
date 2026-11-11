// Audio : lecture mixée (WebAudio), formes d'onde, mixage hors ligne pour l'export.
import { clamp } from './engine.js';

let ac = null, master = null, monitor = null, streamDest = null;
const nodes = new WeakMap();

export function audioCtx() {
  if (ac) return ac;
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return null;
  ac = new C();
  master = ac.createGain();
  monitor = ac.createGain();
  master.connect(monitor);
  monitor.connect(ac.destination);
  return ac;
}
export function resumeAudio() { const a = audioCtx(); if (a && a.state !== 'running') a.resume().catch(() => {}); }

function route(el) {
  let n = nodes.get(el);
  if (n) return n;
  const a = audioCtx();
  if (!a) return null;
  try {
    const src = a.createMediaElementSource(el);
    const g = a.createGain();
    src.connect(g);
    g.connect(master);
    n = { src, g };
    nodes.set(el, n);
    return n;
  } catch (e) { console.warn('route audio', e); return null; }
}

// Volume d'un calque à l'instant t (volume, fondu d'entrée / sortie, muet).
export function layerGain(L, t, vol) {
  const s = L.style;
  if (s.muted) return 0;
  let g = (vol ?? s.volume ?? 100) / 100;
  if (s.fadeIn > 0) g *= clamp((t - L.start) / s.fadeIn, 0, 1);
  if (s.fadeOut > 0) g *= clamp((L.end - t) / s.fadeOut, 0, 1);
  return g;
}
export function setElementGain(el, g) {
  const n = route(el);
  if (n) n.g.gain.setTargetAtTime(g, ac.currentTime, 0.015);
  else { el.muted = g <= 0; try { el.volume = clamp(g, 0, 1); } catch {} }
}
// Flux audio pour l'export temps réel ; coupe les haut-parleurs pendant l'export si demandé.
export function exportAudioStream(silenceMonitor = true) {
  const a = audioCtx();
  if (!a) return null;
  if (!streamDest) { streamDest = a.createMediaStreamDestination(); master.connect(streamDest); }
  monitor.gain.value = silenceMonitor ? 0 : 1;
  return streamDest.stream;
}
export function restoreMonitor() { if (monitor) monitor.gain.value = 1; }

// ---------- Formes d'onde ----------
const peaks = new Map();
export function getPeaksCached(id) { return peaks.get(id); }
export async function computePeaks(id, blob, buckets = 1500) {
  if (peaks.has(id)) return peaks.get(id);
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OAC) return null;
  peaks.set(id, null);
  try {
    // Contexte hors ligne : pas besoin de geste utilisateur pour décoder.
    const buf = await new OAC(1, 1, 44100).decodeAudioData(await blob.arrayBuffer());
    const ch = buf.getChannelData(0);
    const n = Math.min(buckets, Math.max(50, Math.round(buf.duration * 60)));
    const step = Math.floor(ch.length / n) || 1;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let m = 0;
      for (let j = i * step, e = Math.min(ch.length, j + step); j < e; j += 4) { const v = Math.abs(ch[j]); if (v > m) m = v; }
      out[i] = m;
    }
    const r = { data: out, duration: buf.duration };
    peaks.set(id, r);
    return r;
  } catch { peaks.set(id, { data: null, duration: 0 }); return null; }
}

// ---------- Mixage hors ligne (export image par image) ----------
export async function mixdown(p, getBlob, sampleRate = 48000, onStep) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OAC) return null;
  const len = Math.max(1, Math.ceil(p.duration * sampleRate));
  const oc = new OAC(2, len, sampleRate);
  let any = false;
  const layers = p.layers.filter((L) => (L.type === 'audio' || L.type === 'video') && L.visible && !L.style.muted && L.style.mediaId);
  for (const L of layers) {
    onStep && onStep(`Décodage audio : ${L.name}`);
    const blob = await getBlob(L.style.mediaId);
    if (!blob) continue;
    let buf;
    try { buf = await oc.decodeAudioData(await blob.arrayBuffer()); } catch { continue; }
    const speed = L.style.speed || 1;
    const start = Math.max(0, L.start);
    const end = Math.min(L.end, p.duration);
    if (end <= start) continue;
    const src = oc.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = speed;
    const g = oc.createGain();
    const vol = (L.style.volume ?? 100) / 100;
    const fi = L.style.fadeIn || 0, fo = L.style.fadeOut || 0;
    g.gain.setValueAtTime(fi > 0 ? 0 : vol, start);
    if (fi > 0) g.gain.linearRampToValueAtTime(vol, Math.min(end, L.start + fi));
    if (fo > 0) { g.gain.setValueAtTime(vol, Math.max(start, L.end - fo)); g.gain.linearRampToValueAtTime(0, end); }
    src.connect(g);
    g.connect(oc.destination);
    const offset = (L.style.trim || 0) + Math.max(0, -L.start) * speed;
    if (offset >= buf.duration) continue;
    src.start(start, offset, (end - start) * speed);
    any = true;
  }
  if (!any) return null;
  onStep && onStep('Mixage audio…');
  return await oc.startRendering();
}
