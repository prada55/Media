// Moteur Motion — interface iPhone.
import * as E from './engine.js';
import * as DB from './storage.js';
import { PRESETS, PRESET_GROUPS } from './presets.js';
import { TEMPLATES, FORMATS, projectFromTemplate, kineticLayers, KINETIC_STYLES } from './templates.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NAMEW = 118;

const S = {
  project: null, t: 0, playing: false, loop: true, sel: null, tab: 'timeline',
  pps: 80, rs: 0.5, dirty: true, hist: [], hidx: -1, guides: null, saveTimer: null,
};
const media = new Map(); // mediaId -> { el, url, kind }
const stage = $('#stage');
const ctx = stage.getContext('2d');

// ---------- Utilitaires ----------
const P = () => S.project;
const selLayer = () => (S.sel && P().layers.find((l) => l.id === S.sel)) || null;
const frame = () => 1 / P().fps;
const snapT = (t) => E.clamp(Math.round(t * P().fps) / P().fps, 0, P().duration);
const fmtT = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s.toFixed(2).padStart(5, '0')}`; };
const requestRender = () => { S.dirty = true; };

function toast(msg, ms = 2200) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('on'), ms);
}

const ICON = {
  eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24"><path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.3 6.3C3.6 8.1 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.7-1.7"/></svg>',
  dup: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>',
  del: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>',
  cut: '<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/></svg>',
  inP: '<svg viewBox="0 0 24 24"><path d="M8 4v16M12 12h9M15 8l-4 4 4 4"/></svg>',
  outP: '<svg viewBox="0 0 24 24"><path d="M16 4v16M3 12h9M9 8l4 4-4 4"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  center: '<svg viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="4"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6" class="f"/><circle cx="12" cy="12" r="1.6" class="f"/><circle cx="19" cy="12" r="1.6" class="f"/></svg>',
  text: '<svg viewBox="0 0 24 24"><path d="M5 6V4h14v2M12 4v16M9 20h6"/></svg>',
  rect: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2"/></svg>',
  ellipse: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>',
  solid: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 15l6-6 12 12"/></svg>',
  grad: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 3v18M11 3v18M15 3v18" opacity=".5"/></svg>',
  image: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5L5 20"/></svg>',
  video: '<svg viewBox="0 0 24 24"><rect x="2" y="5" width="14" height="14" rx="2"/><path d="m16 10 6-3v10l-6-3"/></svg>',
  font: '<svg viewBox="0 0 24 24"><path d="M4 20 10 4h1l6 16M6.5 14h8"/><path d="M18 10v10"/></svg>',
  pill: '<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="10" rx="5"/><path d="M7 12h10"/></svg>',
  title: '<svg viewBox="0 0 24 24"><path d="M4 7V5h16v2M12 5v10"/><path d="M7 19h10"/></svg>',
};
const TYPE_LETTER = { text: 'T', rect: '▭', ellipse: '◯', solid: '■', image: '▣', video: '▶' };

// ---------- Historique ----------
function commit(label) {
  S.hist = S.hist.slice(0, S.hidx + 1);
  S.hist.push(JSON.stringify(P()));
  if (S.hist.length > 80) S.hist.shift();
  S.hidx = S.hist.length - 1;
  updateUndo();
  scheduleSave();
  if (label) toast(label, 1200);
}
function resetHistory() { S.hist = [JSON.stringify(P())]; S.hidx = 0; updateUndo(); }
function restore(i) {
  S.hidx = i;
  const id = P().id;
  S.project = JSON.parse(S.hist[i]);
  S.project.id = id;
  if (!selLayer()) S.sel = null;
  E.clearTextCache();
  refreshAll();
  updateUndo();
  scheduleSave();
}
function updateUndo() {
  $('#btnUndo').disabled = S.hidx <= 0;
  $('#btnRedo').disabled = S.hidx >= S.hist.length - 1;
}

// ---------- Sauvegarde ----------
function scheduleSave() {
  clearTimeout(S.saveTimer);
  S.saveTimer = setTimeout(saveNow, 700);
}
async function saveNow() {
  const p = P();
  p.updated = Date.now();
  try {
    p.thumb = makeThumb();
    await DB.saveProject(JSON.parse(JSON.stringify(p)));
    localStorage.setItem('mm.last', p.id);
  } catch (e) { console.warn('save', e); }
}
function makeThumb() {
  const p = P();
  const c = document.createElement('canvas');
  const sc = 240 / Math.max(p.width, p.height);
  c.width = Math.round(p.width * sc); c.height = Math.round(p.height * sc);
  E.renderFrame(c.getContext('2d'), p, Math.min(p.duration * 0.5, 2), { scale: sc, media });
  return c.toDataURL('image/jpeg', 0.7);
}

// ---------- Médias ----------
async function loadMedia(id) {
  if (media.has(id)) return media.get(id);
  const rec = await DB.getMedia(id);
  if (!rec) return null;
  return attachMedia(rec);
}
async function attachMedia(rec) {
  const url = URL.createObjectURL(rec.blob);
  let el = null;
  if (rec.kind === 'image') {
    el = new Image();
    el.src = url;
    try { await el.decode(); } catch {}
  } else if (rec.kind === 'video') {
    el = document.createElement('video');
    el.setAttribute('playsinline', ''); el.playsInline = true; el.muted = true; el.preload = 'auto'; el.crossOrigin = 'anonymous';
    el.src = url;
    el.addEventListener('seeked', requestRender);
    el.addEventListener('loadeddata', requestRender);
    await new Promise((r) => { el.onloadedmetadata = r; el.onerror = r; setTimeout(r, 5000); });
    try { el.load(); } catch {}
  } else if (rec.kind === 'font') {
    try {
      const ff = new FontFace(rec.name, await rec.blob.arrayBuffer());
      await ff.load();
      document.fonts.add(ff);
      E.clearTextCache();
    } catch (e) { console.warn('font', e); }
  }
  const m = { el, url, kind: rec.kind, name: rec.name };
  media.set(rec.id, m);
  requestRender();
  return m;
}
async function loadProjectMedia(p) {
  const ids = new Set(p.layers.filter((l) => l.style.mediaId).map((l) => l.style.mediaId));
  (p.fonts || []).forEach((f) => ids.add(f.id));
  await Promise.all([...ids].map((id) => loadMedia(id).catch(() => null)));
  E.clearTextCache();
  requestRender();
}

function syncVideos(t, playing) {
  for (const L of P().layers) {
    if (L.type !== 'video') continue;
    const m = media.get(L.style.mediaId);
    if (!m || !m.el) continue;
    const v = m.el;
    const active = E.isActive(L, t);
    let lt = (t - L.start) * (L.style.speed || 1) + (L.style.trim || 0);
    if (v.duration) lt = Math.min(lt, v.duration - 0.03);
    v.playbackRate = L.style.speed || 1;
    if (!active) { if (!v.paused) v.pause(); continue; }
    if (playing) {
      v.muted = !!L.style.muted || S.exporting;
      if (v.paused) v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
      if (Math.abs(v.currentTime - lt) > 0.25) v.currentTime = lt;
    } else {
      if (!v.paused) v.pause();
      if (Math.abs(v.currentTime - lt) > 0.02) v.currentTime = lt;
    }
  }
}

// ---------- Rendu de la scène ----------
function fitStage() {
  const p = P();
  const vr = $('#viewer').getBoundingClientRect();
  const pad = 12;
  const k = Math.min((vr.width - pad * 2) / p.width, (vr.height - pad * 2) / p.height);
  const cw = Math.max(10, p.width * k), ch = Math.max(10, p.height * k);
  stage.style.width = cw + 'px';
  stage.style.height = ch + 'px';
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  S.rs = Math.min(1, (cw * dpr) / p.width);
  stage.width = Math.round(p.width * S.rs);
  stage.height = Math.round(p.height * S.rs);
  S.cssScale = k;
  requestRender();
}

function draw() {
  E.renderFrame(ctx, P(), S.t, {
    scale: S.rs, media, overlay: !S.playing, selected: S.sel, guides: S.guides,
    dpr: S.rs / (S.cssScale || 1),
  });
}

let lastTs = 0;
function tick(ts) {
  const dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0;
  lastTs = ts;
  if (S.playing && !S.exporting) {
    let t = S.t + dt;
    if (t >= P().duration) {
      if (S.loop) { t = 0; syncVideos(0, true); }
      else { t = P().duration; setPlaying(false); }
    }
    S.t = t;
    syncVideos(S.t, true);
    S.dirty = true;
    updateTime();
  }
  if (S.dirty && !S.exporting) { draw(); S.dirty = false; }
  requestAnimationFrame(tick);
}

function setTime(t, opts = {}) {
  S.t = opts.raw ? E.clamp(t, 0, P().duration) : snapT(t);
  if (!S.playing) syncVideos(S.t, false);
  updateTime();
  if (S.tab === 'props') refreshPropValues();
  requestRender();
}
function updateTime() {
  $('#timeLabel').textContent = fmtT(S.t);
  $('#frameLabel').textContent = `i ${Math.round(S.t * P().fps)} / ${Math.round(P().duration * P().fps)}`;
  const ph = $('#tlPlayhead');
  if (ph) {
    const x = NAMEW + S.t * S.pps;
    ph.style.left = x + 'px';
    if (S.playing) {
      const sc = $('#tlScroll');
      if (sc && (x > sc.scrollLeft + sc.clientWidth - 30 || x < sc.scrollLeft + NAMEW)) sc.scrollLeft = x - NAMEW - 20;
    }
  }
  $$('.tl-bar .kf').forEach((k) => k.classList.toggle('at', Math.abs(+k.dataset.t - S.t) < 0.0015));
}
function setPlaying(on) {
  S.playing = on;
  if (on && S.t >= P().duration - 0.001) S.t = 0;
  $('#icoPlay').innerHTML = on
    ? '<rect x="6" y="4.5" width="4" height="15" rx="1" class="f"/><rect x="14" y="4.5" width="4" height="15" rx="1" class="f"/>'
    : '<path d="M7 4.5v15l13-7.5z" class="f"/>';
  syncVideos(S.t, on);
  if (!on) { S.t = snapT(S.t); updateTime(); if (S.tab === 'props') refreshPropValues(); }
  requestRender();
}

// ---------- Modification des valeurs ----------
function setVal(L, prop, v) {
  if (E.isAnimated(L, prop)) E.setKey(L, prop, S.t, v);
  else L.props[prop] = v;
}

function select(id) {
  if (S.sel === id) return;
  S.sel = id;
  $$('.tl-row').forEach((r) => r.classList.toggle('sel', r.dataset.id === id));
  if (S.tab === 'props') buildProps();
  if (S.tab === 'animate') buildAnimate();
  requestRender();
}

function addLayer(L, { at = 'top' } = {}) {
  const p = P();
  if (at === 'top') p.layers.unshift(L);
  else p.layers.push(L);
  S.sel = L.id;
  buildTimeline();
  commit();
  requestRender();
}

// ---------- Interaction sur la scène ----------
function setupStage() {
  const pts = new Map();
  let g = null, lastTap = 0;
  const toComp = (e) => {
    const r = stage.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * P().width, y: ((e.clientY - r.top) / r.height) * P().height };
  };
  const startPinch = () => {
    const L = selLayer();
    if (!L) return;
    const [a, b] = [...pts.values()];
    g = {
      type: 'pinch', L, d0: Math.hypot(b.x - a.x, b.y - a.y), a0: Math.atan2(b.y - a.y, b.x - a.x),
      s0: E.getProp(L, 'scale', S.t), r0: E.getProp(L, 'rotation', S.t), changed: false,
    };
  };
  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, toComp(e));
    if (S.playing) setPlaying(false);
    if (pts.size === 1) {
      const q = toComp(e);
      const hit = E.hitTest(P(), S.t, q.x, q.y);
      const cur = selLayer();
      const now = Date.now();
      if (hit) {
        if (hit.id === S.sel && now - lastTap < 320 && hit.type === 'text') { showTab('props'); setTimeout(() => $('#paneProps textarea')?.focus(), 50); }
        lastTap = now;
        select(hit.id);
        g = { type: 'move', L: hit, q0: q, x0: E.getProp(hit, 'x', S.t), y0: E.getProp(hit, 'y', S.t), changed: false };
      } else if (cur && !cur.locked && cur.type !== 'solid' && E.isActive(cur, S.t)) {
        g = { type: 'move', L: cur, q0: q, x0: E.getProp(cur, 'x', S.t), y0: E.getProp(cur, 'y', S.t), changed: false };
      } else { select(null); g = null; }
    } else if (pts.size === 2) startPinch();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, toComp(e));
    if (!g) return;
    const p = P();
    if (g.type === 'move' && pts.size === 1) {
      const q = toComp(e);
      let x = g.x0 + q.x - g.q0.x, y = g.y0 + q.y - g.q0.y;
      const snap = 14 / (S.cssScale || 1);
      const gv = Math.abs(x - p.width / 2) < snap, gh = Math.abs(y - p.height / 2) < snap;
      if (gv) x = p.width / 2;
      if (gh) y = p.height / 2;
      S.guides = gv || gh ? { v: gv, h: gh } : null;
      setVal(g.L, 'x', Math.round(x));
      setVal(g.L, 'y', Math.round(y));
      g.changed = true;
      requestRender();
    } else if (g.type === 'pinch' && pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(b.x - a.x, b.y - a.y), an = Math.atan2(b.y - a.y, b.x - a.x);
      setVal(g.L, 'scale', Math.round(Math.max(1, g.s0 * (d / g.d0)) * 10) / 10);
      let r = g.r0 + ((an - g.a0) * 180) / Math.PI;
      const near = Math.round(r / 45) * 45;
      if (Math.abs(r - near) < 3) r = near;
      setVal(g.L, 'rotation', Math.round(r * 10) / 10);
      g.changed = true;
      requestRender();
    }
  });
  const end = (e) => {
    pts.delete(e.pointerId);
    if (g && g.changed && pts.size === 0) {
      commit();
      if (S.tab === 'props') refreshPropValues();
      buildTimeline();
    }
    if (pts.size === 0) { g = null; S.guides = null; requestRender(); }
    else if (pts.size === 1 && g && g.type === 'pinch') {
      const L = g.L, q = [...pts.values()][0];
      g = { type: 'move', L, q0: q, x0: E.getProp(L, 'x', S.t), y0: E.getProp(L, 'y', S.t), changed: g.changed };
    }
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
}

// ---------- Timeline ----------
function tickStep(pps) {
  for (const s of [0.1, 0.25, 0.5, 1, 2, 5, 10, 30]) if (s * pps >= 56) return s;
  return 60;
}
function fitTimeline() {
  const pane = $('#paneTimeline');
  const w = (pane.clientWidth || 360) - NAMEW - 24;
  S.pps = E.clamp(w / P().duration, 8, 400);
}

function buildTimeline() {
  const p = P();
  const pane = $('#paneTimeline');
  const keepScroll = $('#tlScroll') ? [$('#tlScroll').scrollLeft, $('#tlScroll').scrollTop] : null;
  const width = NAMEW + p.duration * S.pps + 40;
  const step = tickStep(S.pps);
  let ruler = '';
  const minor = step / 5;
  for (let i = 0; i * minor <= p.duration + 1e-6; i++) {
    const t = i * minor, x = t * S.pps;
    const maj = i % 5 === 0;
    ruler += `<i class="${maj ? 'maj' : ''}" style="left:${x}px"></i>`;
    if (maj) ruler += `<b style="left:${x}px">${step < 1 ? t.toFixed(step < 0.5 ? 2 : 1) : Math.round(t)}s</b>`;
  }
  const rows = p.layers.map((L) => {
    const kfs = E.keyTimes(L).map((t) => `<b class="kf ${Math.abs(t - S.t) < 0.0015 ? 'at' : ''}" data-t="${t}" style="left:${(t - L.start) * S.pps}px"></b>`).join('');
    return `<div class="tl-row ${L.id === S.sel ? 'sel' : ''}" data-id="${L.id}">
      <div class="tl-name" data-act="sel">
        <button class="eye ${L.visible ? '' : 'off'}" data-act="eye" aria-label="Visibilité">${L.visible ? ICON.eye : ICON.eyeOff}</button>
        <span class="tl-ty ty-${L.type}">${TYPE_LETTER[L.type]}</span>
        <span class="nm">${esc(L.name)}${L.locked ? ' 🔒' : ''}</span>
      </div>
      <div class="tl-track"><div class="tl-bar ty-${L.type}" data-id="${L.id}" style="left:${L.start * S.pps}px;width:${Math.max(4, (L.end - L.start) * S.pps)}px">
        <i class="h l" data-act="trimL"></i><span class="lbl">${esc(L.name)}</span>${kfs}<i class="h r" data-act="trimR"></i>
      </div></div>
    </div>`;
  }).join('');
  pane.innerHTML = `
    <div class="tl-tools">
      <button class="chip" data-tl="zoomOut">−</button>
      <button class="chip" data-tl="fit">Ajuster</button>
      <button class="chip" data-tl="zoomIn">+</button>
      <div class="grow"></div>
      <button class="chip" data-tl="comp">${p.duration.toFixed(1)} s · ${p.fps} i/s</button>
    </div>
    <div class="tl-scroll" id="tlScroll">
      <div class="tl-content" style="width:${width}px">
        <div class="tl-rrow"><div class="tl-corner">${p.layers.length} calque${p.layers.length > 1 ? 's' : ''}</div><div class="tl-ruler" id="tlRuler">${ruler}</div></div>
        ${rows || '<div class="tl-empty">Aucun calque. Touchez <b>Ajouter</b> pour commencer.</div>'}
        <div class="tl-playhead" id="tlPlayhead" style="left:${NAMEW + S.t * S.pps}px"></div>
      </div>
    </div>`;
  if (keepScroll) { $('#tlScroll').scrollLeft = keepScroll[0]; $('#tlScroll').scrollTop = keepScroll[1]; }
}

function setupTimeline() {
  const pane = $('#paneTimeline');
  pane.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tl]');
    if (!b) return;
    const a = b.dataset.tl;
    const sc = $('#tlScroll');
    const center = sc ? (sc.scrollLeft + sc.clientWidth / 2 - NAMEW) / S.pps : 0;
    if (a === 'zoomIn') S.pps = Math.min(600, S.pps * 1.5);
    if (a === 'zoomOut') S.pps = Math.max(6, S.pps / 1.5);
    if (a === 'fit') fitTimeline();
    if (a === 'comp') return openCompSettings();
    buildTimeline();
    const sc2 = $('#tlScroll');
    if (sc2 && a !== 'fit') sc2.scrollLeft = center * S.pps + NAMEW - sc2.clientWidth / 2;
  });

  let drag = null;
  pane.addEventListener('pointerdown', (e) => {
    const t = e.target;
    if (t.closest('.tl-ruler')) {
      const ruler = $('#tlRuler');
      drag = { type: 'scrub', ruler };
      pane.setPointerCapture(e.pointerId);
      if (S.playing) setPlaying(false);
      scrubTo(e);
      return;
    }
    const eye = t.closest('[data-act=eye]');
    if (eye) {
      const L = P().layers.find((l) => l.id === eye.closest('.tl-row').dataset.id);
      L.visible = !L.visible;
      buildTimeline(); commit(); requestRender();
      return;
    }
    const row = t.closest('.tl-row');
    if (!row) return;
    const L = P().layers.find((l) => l.id === row.dataset.id);
    if (t.closest('.tl-name')) { select(L.id); return; }
    const bar = t.closest('.tl-bar');
    if (!bar) { select(L.id); return; }
    select(L.id);
    const kf = t.closest('.kf');
    const mode = kf ? 'kf' : t.dataset.act === 'trimL' ? 'trimL' : t.dataset.act === 'trimR' ? 'trimR' : 'move';
    drag = { type: mode, L, bar, x0: e.clientX, start: L.start, end: L.end, kt: kf ? +kf.dataset.t : 0, kfEl: kf, moved: false, snapshot: JSON.stringify(L.kf) };
    pane.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  const scrubTo = (e) => {
    const r = $('#tlRuler').getBoundingClientRect();
    setTime((e.clientX - r.left) / S.pps);
  };
  pane.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (drag.type === 'scrub') { scrubTo(e); return; }
    const p = P();
    let dt = (e.clientX - drag.x0) / S.pps;
    if (Math.abs(e.clientX - drag.x0) > 3) drag.moved = true;
    if (!drag.moved) return;
    const L = drag.L;
    const snap = (v) => {
      v = Math.round(v * p.fps) / p.fps;
      if (Math.abs(v - S.t) * S.pps < 8) v = S.t;
      return Math.round(v * 1000) / 1000;
    };
    if (drag.type === 'move') {
      const len = drag.end - drag.start;
      let ns = snap(drag.start + dt);
      ns = E.clamp(ns, -len + frame(), p.duration - frame());
      if (Math.abs(ns + len - S.t) * S.pps < 8) ns = S.t - len;
      const shift = ns - L.start;
      L.start = E.roundT(ns); L.end = E.roundT(ns + len);
      E.shiftKeys(L, shift);
    } else if (drag.type === 'trimL') {
      L.start = E.clamp(snap(drag.start + dt), -100, L.end - frame());
    } else if (drag.type === 'trimR') {
      L.end = E.clamp(snap(drag.end + dt), L.start + frame(), p.duration + 600);
    } else if (drag.type === 'kf') {
      const nt = snap(drag.kt + dt);
      L.kf = JSON.parse(drag.snapshot);
      for (const n in L.kf) {
        const k = L.kf[n];
        const hit = k.find((q) => Math.abs(q.t - drag.kt) < 0.0015);
        if (hit) { L.kf[n] = k.filter((q) => q === hit || Math.abs(q.t - nt) > 0.0015); hit.t = nt; L.kf[n].sort((a, b) => a.t - b.t); }
      }
      drag.nt = nt;
    }
    drag.bar.style.left = L.start * S.pps + 'px';
    drag.bar.style.width = Math.max(4, (L.end - L.start) * S.pps) + 'px';
    $$('.kf', drag.bar).forEach((k) => k.remove());
    drag.bar.insertAdjacentHTML('beforeend', E.keyTimes(L).map((t) => `<b class="kf" data-t="${t}" style="left:${(t - L.start) * S.pps}px"></b>`).join(''));
    requestRender();
  });
  const end = () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.type === 'scrub') return;
    if (!d.moved) {
      if (d.type === 'kf') setTime(d.kt);
      return;
    }
    if (d.type === 'kf' && d.nt !== undefined) setTime(d.nt);
    buildTimeline();
    commit();
    if (S.tab === 'props') buildProps();
  };
  pane.addEventListener('pointerup', end);
  pane.addEventListener('pointercancel', end);
}

// ---------- Propriétés ----------
const PROP_UI = {
  x: ['Position X', -1, 2, 1, 'W'], y: ['Position Y', -1, 2, 1, 'H'],
  scale: ['Échelle %', 0, 400, 0.5], stretchX: ['Largeur %', 0, 400, 0.5], stretchY: ['Hauteur %', 0, 400, 0.5],
  rotation: ['Rotation °', -720, 720, 0.5], opacity: ['Opacité %', 0, 100, 1], blur: ['Flou', 0, 100, 0.5],
};
const fmtNum = (v) => (Math.abs(v - Math.round(v)) < 0.001 ? String(Math.round(v)) : v.toFixed(1));

function numRow(k, label, min, max, step, val, kf) {
  return `<div class="row" data-k="${k}">${kf ? '<button class="kfb" data-act="kf" aria-label="Keyframe"></button>' : ''}
    <label>${label}</label>
    <input type="range" min="${min}" max="${max}" step="${step}" value="${val}">
    <input class="nv" type="number" step="${step}" value="${fmtNum(+val)}"></div>`;
}
const colorRow = (k, label, val) => `<div class="row" data-k="${k}"><label>${label}</label><div class="sp"></div><input type="color" value="${toHex(val)}"></div>`;
const switchRow = (k, label, on) => `<div class="row" data-k="${k}"><label style="width:auto">${label}</label><label class="sw"><input type="checkbox" ${on ? 'checked' : ''}><span></span></label></div>`;
const selectRow = (k, label, val, opts) => `<div class="row" data-k="${k}"><label>${label}</label><select>${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
const segRow = (k, label, val, opts) => `<div class="row" data-k="${k}"><label>${label}</label><div class="seg">${opts.map(([v, l]) => `<button data-v="${esc(v)}" class="${String(v) === String(val) ? 'on' : ''}">${l}</button>`).join('')}</div></div>`;

function toHex(c) {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  if (/^#[0-9a-f]{3}$/i.test(c)) return '#' + [...c.slice(1)].map((x) => x + x).join('');
  const m = String(c).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return '#' + [m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, '0')).join('');
  return '#000000';
}

function buildProps() {
  const pane = $('#paneProps');
  const L = selLayer();
  const p = P();
  if (!L) {
    pane.innerHTML = `<div class="empty"><b>Aucun calque sélectionné</b>Touchez un élément dans l'aperçu ou dans la timeline.</div>
    <div class="sect"><h3>Composition</h3>
      ${colorRow('c.bg', 'Fond', p.bg)}
      <button class="btn block" data-act="comp">Réglages de la composition…</button></div>`;
    return;
  }
  const s = L.style;
  const range = (n) => { const u = PROP_UI[n]; const m = u[4] === 'W' ? p.width : u[4] === 'H' ? p.height : 1; return [u[1] * m, u[2] * m]; };
  const tr = E.PROPS.map((n) => { const [mn, mx] = range(n); return numRow('p.' + n, PROP_UI[n][0], mn, mx, PROP_UI[n][3], E.getProp(L, n, S.t), true); }).join('');
  let content = '';
  if (L.type === 'text') {
    content = `<div class="sect"><h3>Texte</h3>
      <textarea class="fld" data-k="s.text" rows="2">${esc(s.text)}</textarea>
      ${selectRow('s.font', 'Police', s.font, [...E.FONTS, ...(p.fonts || []).map((f) => [`"${f.name}"`, f.name + ' (importée)'])])}
      ${numRow('s.size', 'Taille', 8, Math.round(p.width * 0.5), 1, s.size)}
      ${selectRow('s.weight', 'Graisse', s.weight, [['300', 'Light'], ['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold'], ['800', 'Heavy'], ['900', 'Black']])}
      ${switchRow('s.italic', 'Italique', s.italic)}
      ${colorRow('s.color', 'Couleur', s.color)}
      ${segRow('s.align', 'Alignement', s.align, [['left', 'Gauche'], ['center', 'Centre'], ['right', 'Droite']])}
      ${numRow('s.tracking', 'Espacement', -20, 200, 0.5, s.tracking)}
      ${numRow('s.leading', 'Interligne', 0.6, 3, 0.05, s.leading)}
      ${numRow('s.strokeW', 'Contour', 0, 40, 0.5, s.strokeW)}
      ${s.strokeW > 0 ? colorRow('s.stroke', 'Couleur contour', s.stroke) : ''}
      ${switchRow('s.bgOn', 'Bulle de fond', s.bgOn)}
      ${s.bgOn ? colorRow('s.bg', 'Couleur bulle', s.bg) + numRow('s.bgPad', 'Marge', 0, 200, 1, s.bgPad) + numRow('s.bgRadius', 'Arrondi', 0, 300, 1, s.bgRadius) : ''}
    </div>`;
  } else if (L.type === 'rect' || L.type === 'ellipse' || L.type === 'solid') {
    content = `<div class="sect"><h3>${L.type === 'solid' ? 'Fond' : 'Forme'}</h3>
      ${L.type !== 'solid' ? numRow('s.w', 'Largeur', 1, p.width * 2, 1, s.w) + numRow('s.h', 'Hauteur', 1, p.height * 2, 1, s.h) : ''}
      ${L.type === 'rect' ? numRow('s.radius', 'Arrondi', 0, Math.max(s.w, s.h) / 2, 1, s.radius) : ''}
      ${colorRow('s.fill', s.gradOn ? 'Couleur 1' : 'Couleur', s.fill)}
      ${switchRow('s.gradOn', 'Dégradé', s.gradOn)}
      ${s.gradOn ? colorRow('s.fill2', 'Couleur 2', s.fill2) + segRow('s.gradType', 'Type', s.gradType, [['linear', 'Linéaire'], ['radial', 'Radial']]) + (s.gradType === 'linear' ? numRow('s.gradAngle', 'Angle', 0, 360, 1, s.gradAngle) : '') : ''}
      ${L.type !== 'solid' ? numRow('s.strokeW', 'Contour', 0, 80, 0.5, s.strokeW) + (s.strokeW > 0 ? colorRow('s.stroke', 'Couleur contour', s.stroke) : '') : ''}
    </div>`;
  } else {
    const m = media.get(s.mediaId);
    content = `<div class="sect"><h3>${L.type === 'video' ? 'Vidéo' : 'Image'}</h3>
      ${numRow('s.w', 'Largeur', 1, p.width * 3, 1, s.w)}
      ${numRow('s.h', 'Hauteur', 1, p.height * 3, 1, s.h)}
      <div class="row"><label></label><div class="seg"><button data-act="fit">Ajuster</button><button data-act="fill">Remplir</button><button data-act="native">Taille réelle</button></div></div>
      ${numRow('s.radius', 'Arrondi', 0, 400, 1, s.radius)}
      ${L.type === 'video' ? numRow('s.trim', 'Début clip (s)', 0, Math.max(1, m?.el?.duration || 10), 0.01, s.trim) + numRow('s.speed', 'Vitesse ×', 0.25, 4, 0.05, s.speed) + switchRow('s.muted', 'Muet', s.muted) : ''}
      ${!m ? '<div class="hint">Média introuvable sur cet appareil.</div>' : ''}
    </div>`;
  }
  const keysHere = E.PROPS.flatMap((n) => (L.kf[n] || []).filter((q) => Math.abs(q.t - S.t) < 0.0015));
  const easeVal = keysHere.length && keysHere.every((q) => q.e === keysHere[0].e) ? keysHere[0].e : '';
  pane.innerHTML = `
    <div class="actions">
      <button class="act" data-act="dup">${ICON.dup}Dupliquer</button>
      <button class="act" data-act="split">${ICON.cut}Scinder</button>
      <button class="act" data-act="inP">${ICON.inP}Début ici</button>
      <button class="act" data-act="outP">${ICON.outP}Fin ici</button>
      <button class="act" data-act="up">${ICON.up}Devant</button>
      <button class="act" data-act="down">${ICON.down}Derrière</button>
      <button class="act" data-act="center">${ICON.center}Centrer</button>
      <button class="act" data-act="lock">${ICON.lock}${L.locked ? 'Déverr.' : 'Verrou.'}</button>
      <button class="act danger" data-act="del">${ICON.del}Supprimer</button>
    </div>
    <div class="sect"><h3>Calque</h3>
      <div class="row" data-k="l.name"><label>Nom</label><input type="text" value="${esc(L.name)}"></div>
    </div>
    ${content}
    <div class="sect"><h3>Transformation <span class="r hint">◆ = keyframe</span></h3>${tr}
      <div class="row" id="easeRow" data-k="k.ease"><label>Interpolation</label>
        <select ${keysHere.length ? '' : 'disabled'}><option value="">${keysHere.length ? '— mixte —' : 'Aucune keyframe ici'}</option>
        ${Object.entries(E.EASE_LABELS).map(([v, l]) => `<option value="${v}" ${v === easeVal ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      ${numRow('s.anchorX', 'Ancre X %', 0, 100, 1, s.anchorX)}
      ${numRow('s.anchorY', 'Ancre Y %', 0, 100, 1, s.anchorY)}
    </div>
    <div class="sect"><h3>Effets</h3>
      ${numRow('s.glow', 'Lueur', 0, 200, 1, s.glow)}
      ${s.glow > 0 ? colorRow('s.glowColor', 'Couleur lueur', s.glowColor) : ''}
      ${numRow('s.shadow', 'Ombre', 0, 200, 1, s.shadow)}
      ${selectRow('s.blend', 'Fusion', s.blend, [['source-over', 'Normal'], ['screen', 'Superposition claire'], ['lighter', 'Addition'], ['multiply', 'Produit'], ['overlay', 'Incrustation'], ['soft-light', 'Lumière douce'], ['difference', 'Différence'], ['color-dodge', 'Densité couleur −'], ['hue', 'Teinte'], ['color', 'Couleur'], ['luminosity', 'Luminosité']])}
    </div>
    <div class="sect"><button class="btn block danger" data-act="clearKf">Effacer toutes les keyframes</button></div>`;
  refreshPropValues();
}

function refreshPropValues() {
  const L = selLayer();
  if (!L) return;
  for (const row of $$('#paneProps .row[data-k^="p."]')) {
    const n = row.dataset.k.slice(2);
    const v = E.getProp(L, n, S.t);
    const [r, num] = row.querySelectorAll('input');
    if (document.activeElement !== num) num.value = fmtNum(v);
    r.value = v;
    const kb = row.querySelector('.kfb');
    kb.classList.toggle('anim', E.isAnimated(L, n));
    kb.classList.toggle('at', E.hasKeyAt(L, n, S.t));
  }
  const er = $('#easeRow select');
  if (er) {
    const keysHere = E.PROPS.flatMap((n) => (L.kf[n] || []).filter((q) => Math.abs(q.t - S.t) < 0.0015));
    er.disabled = !keysHere.length;
    er.options[0].textContent = keysHere.length ? '— mixte —' : 'Aucune keyframe ici';
    er.value = keysHere.length && keysHere.every((q) => q.e === keysHere[0].e) ? keysHere[0].e : '';
  }
}

const REBUILD_KEYS = new Set(['s.gradOn', 's.gradType', 's.bgOn', 's.strokeW', 's.glow']);

function applyKey(k, v) {
  const L = selLayer();
  const [scope, name] = [k.slice(0, 1), k.slice(2)];
  if (scope === 'c') { P()[name] = v; return; }
  if (!L) return;
  if (scope === 'p') setVal(L, name, v);
  else if (scope === 's') { L.style[name] = v; if (name === 'text') { const first = String(v).split('\n')[0].slice(0, 24); if (!L._named) L.name = first || 'Texte'; } }
  else if (scope === 'a') L.anim[name] = v;
  else if (scope === 'l') { L[name] = v; L._named = true; }
  else if (scope === 'k' && name === 'ease' && v) {
    for (const n of E.PROPS) for (const q of L.kf[n] || []) if (Math.abs(q.t - S.t) < 0.0015) q.e = v;
  }
}

function readInput(el) {
  if (el.type === 'checkbox') return el.checked;
  if (el.type === 'range' || el.type === 'number') return parseFloat(el.value);
  return el.value;
}

function setupProps() {
  const pane = $('#paneProps');
  let wasRebuildCheck = null;
  pane.addEventListener('input', (e) => {
    const el = e.target;
    const row = el.closest('[data-k]');
    if (!row) return;
    const k = el.dataset.k || row.dataset.k;
    let v = readInput(el);
    if (typeof v === 'number' && Number.isNaN(v)) return;
    if (el.type === 'range') { const n = row.querySelector('.nv'); if (n) n.value = fmtNum(v); }
    if (el.type === 'number') { const r = row.querySelector('input[type=range]'); if (r) r.value = v; }
    applyKey(k, v);
    if (k.startsWith('p.')) {
      const kb = row.querySelector('.kfb');
      const L = selLayer();
      if (kb && L) { kb.classList.toggle('at', E.hasKeyAt(L, k.slice(2), S.t)); }
    }
    if (k === 's.text' || k === 'l.name') { const r = $(`.tl-row[data-id="${S.sel}"] .nm`); if (r) r.textContent = selLayer().name; }
    wasRebuildCheck = k;
    requestRender();
  });
  pane.addEventListener('change', (e) => {
    const row = e.target.closest('[data-k]');
    if (!row) return;
    const k = e.target.dataset.k || row.dataset.k;
    if (k === 'k.ease') { applyKey(k, e.target.value); buildTimeline(); }
    commit();
    if (REBUILD_KEYS.has(k) || k === 's.font') { E.clearTextCache(); buildProps(); }
    if (k === 'l.name' || k === 's.text') buildTimeline();
    wasRebuildCheck = null;
  });
  pane.addEventListener('click', (e) => {
    const seg = e.target.closest('.seg button[data-v]');
    if (seg) {
      const row = seg.closest('[data-k]');
      applyKey(row.dataset.k, seg.dataset.v);
      $$('button', row).forEach((b) => b.classList.toggle('on', b === seg));
      commit(); requestRender();
      if (row.dataset.k === 's.gradType') buildProps();
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const L = selLayer();
    const p = P();
    const act = b.dataset.act;
    if (act === 'comp') return openCompSettings();
    if (!L) return;
    switch (act) {
      case 'kf': {
        const n = b.closest('[data-k]').dataset.k.slice(2);
        if (E.hasKeyAt(L, n, S.t)) E.removeKey(L, n, S.t);
        else E.setKey(L, n, S.t, E.getProp(L, n, S.t));
        refreshPropValues(); buildTimeline(); commit();
        return;
      }
      case 'dup': {
        const c = JSON.parse(JSON.stringify(L));
        c.id = E.uid(); c.name = L.name + ' copie';
        p.layers.splice(p.layers.indexOf(L), 0, c);
        S.sel = c.id; buildTimeline(); buildProps(); commit('Calque dupliqué');
        break;
      }
      case 'split': {
        if (S.t <= L.start || S.t >= L.end) return toast('Placez la tête de lecture sur le calque');
        const c = JSON.parse(JSON.stringify(L));
        c.id = E.uid(); c.name = L.name + ' (2)';
        if (c.type === 'video') c.style.trim = (L.style.trim || 0) + (S.t - L.start) * (L.style.speed || 1);
        c.start = S.t; L.end = S.t;
        p.layers.splice(p.layers.indexOf(L), 0, c);
        S.sel = c.id; buildTimeline(); buildProps(); commit('Calque scindé');
        break;
      }
      case 'inP': if (S.t < L.end) { L.start = S.t; buildTimeline(); commit(); } break;
      case 'outP': if (S.t > L.start) { L.end = S.t; buildTimeline(); commit(); } break;
      case 'up': case 'down': {
        const i = p.layers.indexOf(L), j = act === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= p.layers.length) return;
        [p.layers[i], p.layers[j]] = [p.layers[j], p.layers[i]];
        buildTimeline(); commit();
        break;
      }
      case 'center': setVal(L, 'x', p.width / 2); setVal(L, 'y', p.height / 2); refreshPropValues(); buildTimeline(); commit(); break;
      case 'lock': L.locked = !L.locked; buildProps(); buildTimeline(); commit(); break;
      case 'del': p.layers.splice(p.layers.indexOf(L), 1); S.sel = null; buildTimeline(); buildProps(); commit('Calque supprimé'); break;
      case 'clearKf': E.clearKeys(L); buildProps(); buildTimeline(); commit('Keyframes effacées'); break;
      case 'fit': case 'fill': case 'native': {
        const m = media.get(L.style.mediaId);
        const nw = m?.el?.naturalWidth || m?.el?.videoWidth || L.style.w, nh = m?.el?.naturalHeight || m?.el?.videoHeight || L.style.h;
        const k = act === 'native' ? 1 : (act === 'fit' ? Math.min : Math.max)(p.width / nw, p.height / nh);
        L.style.w = Math.round(nw * k); L.style.h = Math.round(nh * k);
        buildProps(); commit();
        break;
      }
    }
    requestRender();
  });
}

// ---------- Animer ----------
function buildAnimate() {
  const pane = $('#paneAnimate');
  const L = selLayer();
  if (!L) { pane.innerHTML = '<div class="empty"><b>Sélectionnez un calque</b>Les animations s\'appliquent à partir de la tête de lecture.</div>'; return; }
  const groups = Object.entries(PRESET_GROUPS).map(([g, label]) => `<div class="sect"><h3>${label}</h3><div class="grid">
    ${PRESETS.filter((x) => x.group === g).map((x) => `<button class="tile" data-preset="${x.id}"><span class="ic">${x.icon}</span>${x.label}</button>`).join('')}
  </div></div>`).join('');
  const a = L.anim;
  const textSect = L.type === 'text' ? `<div class="sect"><h3>Animateur de texte</h3>
    <div class="grid">${Object.entries(E.TEXT_ANIMS).map(([v, l]) => `<button class="tile ${a.type === v ? 'on' : ''}" data-tanim="${v}">${l}</button>`).join('')}</div>
    ${a.type !== 'none' ? `<div style="margin-top:8px">
      ${segRow('a.by', 'Par', a.by, [['char', 'Lettre'], ['word', 'Mot'], ['line', 'Ligne']])}
      ${numRow('a.dur', 'Durée (s)', 0.05, 3, 0.05, a.dur)}
      ${numRow('a.stagger', 'Décalage (s)', 0, 0.5, 0.005, a.stagger)}
      ${numRow('a.delay', 'Retard (s)', 0, 10, 0.05, a.delay)}
      ${switchRow('a.out', 'Animer aussi la sortie', a.out)}
    </div>` : ''}
  </div>` : '';
  pane.innerHTML = `<div class="sect"><div class="hint">Calque : <b>${esc(L.name)}</b> · tête de lecture ${fmtT(S.t)}</div></div>${textSect}${groups}`;
}
function setupAnimate() {
  const pane = $('#paneAnimate');
  pane.addEventListener('click', (e) => {
    const L = selLayer();
    if (!L) return;
    const pr = e.target.closest('[data-preset]');
    if (pr) {
      const preset = PRESETS.find((x) => x.id === pr.dataset.preset);
      preset.fn(L, S.t, P());
      buildTimeline(); commit(`« ${preset.label} » appliqué`);
      requestRender();
      if (!S.playing) { const back = S.t; setTime(Math.max(0, preset.group === 'out' ? S.t - 0.8 : S.t)); setPlaying(true); S._stopAt = back + (preset.group === 'in' ? 1.2 : 0.3); }
      return;
    }
    const ta = e.target.closest('[data-tanim]');
    if (ta) {
      L.anim.type = ta.dataset.tanim;
      if (L.anim.type === 'typewriter') { L.anim.dur = 0.05; L.anim.stagger = 0.06; L.anim.by = 'char'; }
      else if (L.anim.dur < 0.2) { L.anim.dur = 0.5; L.anim.stagger = 0.04; }
      buildAnimate(); commit(); E.clearTextCache();
      setTime(L.start); setPlaying(true); S._stopAt = Math.min(L.end, L.start + 2.5);
      return;
    }
    const seg = e.target.closest('.seg button[data-v]');
    if (seg) {
      const row = seg.closest('[data-k]');
      applyKey(row.dataset.k, seg.dataset.v);
      $$('button', row).forEach((b) => b.classList.toggle('on', b === seg));
      commit(); requestRender();
    }
  });
  pane.addEventListener('input', (e) => {
    const row = e.target.closest('[data-k]');
    if (!row) return;
    const v = readInput(e.target);
    if (typeof v === 'number' && Number.isNaN(v)) return;
    if (e.target.type === 'range') { const n = row.querySelector('.nv'); if (n) n.value = fmtNum(v); }
    if (e.target.type === 'number') { const r = row.querySelector('input[type=range]'); if (r) r.value = v; }
    applyKey(row.dataset.k, v);
    requestRender();
  });
  pane.addEventListener('change', () => commit());
}

// ---------- Ajouter ----------
function buildAdd() {
  $('#paneAdd').innerHTML = `
    <div class="sect"><h3>Calques</h3><div class="grid">
      <button class="tile" data-add="text">${ICON.text}Texte</button>
      <button class="tile" data-add="title">${ICON.title}Titre animé</button>
      <button class="tile" data-add="pill">${ICON.pill}Bulle</button>
      <button class="tile" data-add="rect">${ICON.rect}Rectangle</button>
      <button class="tile" data-add="ellipse">${ICON.ellipse}Cercle</button>
      <button class="tile" data-add="solid">${ICON.solid}Fond uni</button>
      <button class="tile" data-add="grad">${ICON.grad}Dégradé</button>
      <button class="tile" data-add="image">${ICON.image}Image</button>
      <button class="tile" data-add="video">${ICON.video}Vidéo</button>
      <button class="tile" data-add="font">${ICON.font}Police…</button>
    </div></div>
    <div class="sect"><h3>Générateur de texte cinétique</h3>
      <textarea class="fld" id="kinText" placeholder="Tapez une phrase… chaque ligne = un plan">Crée des animations
directement sur ton iPhone
sans ordinateur</textarea>
      ${selectRow('kin.style', 'Style', 'punch', Object.entries(KINETIC_STYLES))}
      ${numRow('kin.speed', 'Vitesse', 0.5, 2, 0.1, 1)}
      <div class="row"><label style="width:auto">Remplacer les calques existants</label><label class="sw"><input type="checkbox" id="kinReplace"><span></span></label></div>
      <button class="btn pri block" data-add="kinetic">Générer l'animation</button>
    </div>
    <div class="sect"><h3>Modèles</h3>
      ${TEMPLATES.map((t) => `<button class="tpl" data-tpl="${t.id}"><span class="sw2" style="background:${{ empty: '#222', intro: 'radial-gradient(#fff,#aaa)', neon: 'radial-gradient(#8b5cff,#05040b)', cta: 'linear-gradient(#2b0a6b,#0a0420)', countdown: 'linear-gradient(135deg,#22d3ee,#f472b6)' }[t.id]}"></span><span><b>${t.name}</b><small>${t.desc}</small></span></button>`).join('')}
      <div class="hint">Un modèle s'ouvre dans un nouveau projet, au format de la composition actuelle.</div>
    </div>`;
}
function setupAdd() {
  const pane = $('#paneAdd');
  pane.addEventListener('input', (e) => {
    const row = e.target.closest('[data-k="kin.speed"]');
    if (!row) return;
    const v = readInput(e.target);
    if (e.target.type === 'range') row.querySelector('.nv').value = fmtNum(v);
    else row.querySelector('input[type=range]').value = v;
  });
  pane.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-add],[data-tpl]');
    if (!b) return;
    const p = P();
    const at = (L) => { const len = Math.min(p.duration - S.t, Math.max(3, p.duration - S.t)); if (S.t < p.duration - 0.5) { L.start = S.t; L.end = S.t + len; } return L; };
    if (b.dataset.tpl) {
      const fmt = FORMATS.find((f) => f.w === p.width && f.h === p.height)?.id || '9x16';
      const np = projectFromTemplate(b.dataset.tpl, fmt);
      await openProject(np, true);
      toast(`Modèle « ${np.name} » ouvert`);
      return;
    }
    const kind = b.dataset.add;
    switch (kind) {
      case 'text': addLayer(at(E.newLayer(p, 'text'))); break;
      case 'title': {
        const L = at(E.newLayer(p, 'text', { style: { text: 'Titre', size: Math.round(p.width * 0.14), weight: '900' }, anim: { type: 'fadeUp', dur: 0.5, stagger: 0.05 } }));
        addLayer(L); break;
      }
      case 'pill': addLayer(at(E.newLayer(p, 'text', { name: 'Bulle', style: { text: 'Commente « GO »', size: Math.round(p.width * 0.055), weight: '700', bgOn: true } }))); break;
      case 'rect': addLayer(at(E.newLayer(p, 'rect'))); break;
      case 'ellipse': addLayer(at(E.newLayer(p, 'ellipse'))); break;
      case 'solid': addLayer(E.newLayer(p, 'solid', { name: 'Fond' }), { at: 'bottom' }); break;
      case 'grad': addLayer(E.newLayer(p, 'solid', { name: 'Dégradé', style: { gradOn: true, fill: '#7c3aed', fill2: '#0ea5e9', gradAngle: 120 } }), { at: 'bottom' }); break;
      case 'image': $('#fileImage').click(); return;
      case 'video': $('#fileVideo').click(); return;
      case 'font': $('#fileFont').click(); return;
      case 'kinetic': {
        const txt = $('#kinText').value;
        const style = $('[data-k="kin.style"] select').value;
        const speed = parseFloat($('[data-k="kin.speed"] input[type=range]').value) || 1;
        const layers = kineticLayers(p, txt, style, speed);
        if (!layers.length) return toast('Écrivez un texte d\'abord');
        if ($('#kinReplace').checked) p.layers = p.layers.filter((l) => l.type === 'solid');
        const end = layers[layers.length - 1].end + 0.4;
        if ($('#kinReplace').checked || end > p.duration) p.duration = Math.ceil(end * 10) / 10;
        p.layers.unshift(...layers.reverse());
        if (!p.layers.some((l) => l.type === 'solid')) p.layers.push(E.newLayer(p, 'solid', { name: 'Fond', locked: true, style: { fill: '#0b0b10', fill2: '#2a1d5c', gradOn: true, gradType: 'radial' } }));
        for (const l of p.layers) if (l.type === 'solid') l.end = Math.max(l.end, p.duration);
        S.sel = null; fitTimeline(); refreshAll(); commit(`${layers.length} plans générés`);
        setTime(0); setPlaying(true);
        return;
      }
    }
    showTab('props');
  });

  const importFile = async (input, kind) => {
    const f = input.files[0];
    input.value = '';
    if (!f) return;
    const p = P();
    const id = E.uid();
    toast('Import…', 900);
    if (kind === 'font') {
      const name = f.name.replace(/\.[^.]+$/, '').replace(/["']/g, '');
      await DB.saveMedia({ id, kind: 'font', name, blob: f });
      await attachMedia({ id, kind: 'font', name, blob: f });
      (p.fonts ||= []).push({ id, name });
      const L = selLayer();
      if (L && L.type === 'text') { L.style.font = `"${name}"`; E.clearTextCache(); }
      commit(`Police « ${name} » importée`);
      if (S.tab === 'props') buildProps();
      return;
    }
    await DB.saveMedia({ id, kind, name: f.name, blob: f });
    const m = await attachMedia({ id, kind, name: f.name, blob: f });
    const nw = (kind === 'image' ? m.el.naturalWidth : m.el.videoWidth) || p.width;
    const nh = (kind === 'image' ? m.el.naturalHeight : m.el.videoHeight) || p.height;
    const k = Math.min(p.width / nw, p.height / nh);
    const L = E.newLayer(p, kind, { name: f.name.replace(/\.[^.]+$/, '').slice(0, 24), style: { mediaId: id, w: Math.round(nw * k), h: Math.round(nh * k) } });
    if (kind === 'video' && m.el.duration && isFinite(m.el.duration)) {
      const d = m.el.duration;
      L.start = S.t;
      if (S.t + d > p.duration) { p.duration = Math.min(600, Math.ceil((S.t + d) * 10) / 10); for (const l of p.layers) if (l.type === 'solid' && l.end >= p.duration - 60) l.end = p.duration; fitTimeline(); toast(`Durée étendue à ${p.duration.toFixed(1)} s`); }
      L.end = E.roundT(S.t + d);
    } else { L.start = 0; }
    addLayer(L);
    syncVideos(S.t, false);
    showTab('props');
  };
  $('#fileImage').addEventListener('change', (e) => importFile(e.target, 'image'));
  $('#fileVideo').addEventListener('change', (e) => importFile(e.target, 'video'));
  $('#fileFont').addEventListener('change', (e) => importFile(e.target, 'font'));
}

// ---------- Onglets ----------
function showTab(tab) {
  S.tab = tab;
  $$('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  $$('.pane').forEach((p) => p.classList.toggle('on', p.dataset.pane === tab));
  if (tab === 'timeline') buildTimeline();
  if (tab === 'props') buildProps();
  if (tab === 'animate') buildAnimate();
  if (tab === 'add') buildAdd();
}
function refreshAll() {
  const p = P();
  $('#projName').textContent = p.name;
  $('#projMeta').textContent = `${p.width}×${p.height} · ${p.fps} i/s · ${p.duration.toFixed(1)} s`;
  S.t = Math.min(S.t, p.duration);
  fitStage();
  showTab(S.tab);
  updateTime();
}

// ---------- Feuilles ----------
function openSheet(html, onClick) {
  const sh = $('#sheet');
  $('#sheetBody').innerHTML = html;
  sh.hidden = false;
  sh.onclick = (e) => {
    if (e.target.closest('[data-close]')) return closeSheet();
    onClick && onClick(e);
  };
}
function closeSheet() { $('#sheet').hidden = true; $('#sheetBody').innerHTML = ''; }

function openCompSettings() {
  const p = P();
  let fmt = FORMATS.find((f) => f.w === p.width && f.h === p.height)?.id || 'custom';
  openSheet(`<h2>Composition</h2>
    <div class="row"><label>Nom</label><input type="text" id="cName" value="${esc(p.name)}"></div>
    <h4>Format</h4>
    <div class="fmts">${FORMATS.map((f) => `<button class="fmt ${f.id === fmt ? 'on' : ''}" data-fmt="${f.id}"><b>${f.w}×${f.h}</b><small>${f.label}</small></button>`).join('')}</div>
    <h4>Temps</h4>
    <div class="row"><label>Durée (s)</label><input type="number" class="fld" id="cDur" min="0.5" max="600" step="0.1" value="${p.duration}"></div>
    <div class="row"><label>Images/s</label><div class="seg" id="cFps">${[24, 25, 30, 60].map((f) => `<button data-v="${f}" class="${f === p.fps ? 'on' : ''}">${f}</button>`).join('')}</div></div>
    <div class="row"><label>Fond</label><div class="sp"></div><input type="color" id="cBg" value="${toHex(p.bg)}"></div>
    <button class="btn pri block" data-ok>Appliquer</button>`, (e) => {
    const f = e.target.closest('[data-fmt]');
    if (f) { fmt = f.dataset.fmt; $$('.fmt').forEach((b) => b.classList.toggle('on', b === f)); return; }
    const fb = e.target.closest('#cFps button');
    if (fb) { $$('#cFps button').forEach((b) => b.classList.toggle('on', b === fb)); return; }
    if (e.target.closest('[data-ok]')) {
      p.name = $('#cName').value.trim() || 'Sans titre';
      const nd = E.clamp(parseFloat($('#cDur').value) || p.duration, 0.5, 600);
      for (const l of p.layers) if (Math.abs(l.end - p.duration) < 0.01 || l.end > nd) l.end = Math.max(l.start + 0.1, nd);
      p.duration = nd;
      p.fps = +$('#cFps button.on').dataset.v;
      p.bg = $('#cBg').value;
      const F = FORMATS.find((x) => x.id === fmt);
      if (F && (F.w !== p.width || F.h !== p.height)) {
        const kx = F.w / p.width, ky = F.h / p.height, k = Math.min(kx, ky);
        for (const l of p.layers) {
          const mapX = (v) => v * kx, mapY = (v) => v * ky;
          l.props.x = mapX(l.props.x); l.props.y = mapY(l.props.y);
          (l.kf.x || []).forEach((q) => (q.v = mapX(q.v)));
          (l.kf.y || []).forEach((q) => (q.v = mapY(q.v)));
          if (l.type === 'text') { l.style.size = Math.round(l.style.size * k); l.style.bgPad *= k; l.style.bgRadius *= k; }
          else if (l.type !== 'solid') { l.style.w *= k; l.style.h *= k; }
        }
        p.width = F.w; p.height = F.h;
        E.clearTextCache();
      }
      closeSheet(); fitTimeline(); refreshAll(); commit('Composition mise à jour');
    }
  });
}

async function openProjects() {
  const list = (await DB.listProjects()).sort((a, b) => b.updated - a.updated);
  let fmt = '9x16';
  const render = () => `<h2>Projets</h2>
    <h4>Nouveau projet</h4>
    <div class="fmts">${FORMATS.map((f) => `<button class="fmt ${f.id === fmt ? 'on' : ''}" data-fmt="${f.id}"><b>${f.label}</b><small>${f.w}×${f.h}</small></button>`).join('')}</div>
    <button class="btn pri block" data-new>Créer un projet vide</button>
    <h4>Mes projets (${list.length})</h4>
    <div class="plist">${list.map((x) => `<div class="pcard ${x.id === P().id ? 'cur' : ''}" data-open="${x.id}">
      <div class="th" style="background-image:url('${x.thumb || ''}')"></div>
      <div class="meta"><b>${esc(x.name)}</b><small>${x.width}×${x.height} · ${x.duration.toFixed(1)} s</small></div>
      <button class="more" data-more="${x.id}" aria-label="Options">${ICON.more}</button></div>`).join('')}</div>
    <h4>Sauvegarde</h4>
    <div class="row"><button class="btn" data-exportjson style="flex:1">Exporter le projet (.json)</button><button class="btn" data-importjson style="flex:1">Importer…</button></div>
    <div class="hint">Les projets sont enregistrés automatiquement sur cet appareil. Les fichiers .json ne contiennent pas les médias importés.</div>`;
  openSheet(render(), async (e) => {
    const f = e.target.closest('[data-fmt]');
    if (f) { fmt = f.dataset.fmt; $$('.fmt').forEach((b) => b.classList.toggle('on', b === f)); return; }
    if (e.target.closest('[data-new]')) { closeSheet(); await openProject(projectFromTemplate('empty', fmt, 'Sans titre'), true); return; }
    const more = e.target.closest('[data-more]');
    if (more) {
      e.stopPropagation();
      const id = more.dataset.more;
      const x = list.find((q) => q.id === id);
      openSheet(`<h2>${esc(x.name)}</h2>
        <button class="btn block" data-dupp>Dupliquer</button>
        <button class="btn block" data-ren>Renommer</button>
        <button class="btn block danger" data-delp>Supprimer</button>
        <button class="btn block" data-close>Annuler</button>`, async (ev) => {
        if (ev.target.closest('[data-dupp]')) { const c = JSON.parse(JSON.stringify(x)); c.id = E.uid(); c.name = x.name + ' copie'; c.updated = Date.now(); await DB.saveProject(c); openProjects(); }
        if (ev.target.closest('[data-ren]')) { const n = prompt('Nouveau nom', x.name); if (n) { x.name = n; if (x.id === P().id) { P().name = n; refreshAll(); } await DB.saveProject(x); } openProjects(); }
        if (ev.target.closest('[data-delp]')) {
          if (!confirm(`Supprimer « ${x.name} » ?`)) return;
          await DB.deleteProject(id);
          if (id === P().id) { const rest = list.filter((q) => q.id !== id); await openProject(rest[0] || projectFromTemplate('empty', '9x16'), !rest[0]); }
          openProjects();
        }
      });
      return;
    }
    const o = e.target.closest('[data-open]');
    if (o) { closeSheet(); if (o.dataset.open !== P().id) { await saveNow(); await openProject(await DB.getProject(o.dataset.open)); } return; }
    if (e.target.closest('[data-exportjson]')) {
      const blob = new Blob([JSON.stringify({ app: 'moteur-motion', version: 1, project: { ...P(), thumb: undefined } }, null, 1)], { type: 'application/json' });
      downloadBlob(blob, `${P().name}.json`);
      return;
    }
    if (e.target.closest('[data-importjson]')) $('#fileProject').click();
  });
}

$('#fileProject').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const p = data.project || data;
    if (!p.layers || !p.width) throw new Error('format');
    p.id = E.uid();
    closeSheet();
    await openProject(p, true);
    toast('Projet importé');
  } catch { toast('Fichier de projet invalide'); }
});

function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

// ---------- Export ----------
function pickMime() {
  if (!window.MediaRecorder) return null;
  const c = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return c.find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch { return false; } }) || null;
}

function openExport() {
  if (S.playing) setPlaying(false);
  const p = P();
  const mime = pickMime();
  let q = 1;
  openSheet(`<h2>Exporter</h2>
    <h4>Vidéo</h4>
    <div class="fmts">
      <button class="fmt on" data-q="1"><b>Pleine qualité</b><small>${p.width}×${p.height}</small></button>
      <button class="fmt" data-q="0.5"><b>Légère</b><small>${Math.round(p.width / 2)}×${Math.round(p.height / 2)}</small></button>
    </div>
    <div class="hint">${mime ? `Format : ${mime.includes('mp4') ? 'MP4 (H.264)' : 'WebM'} · ${p.fps} i/s · ${p.duration.toFixed(1)} s. L'export se fait en temps réel : gardez l'app ouverte et l'écran allumé.` : 'L\'enregistrement vidéo n\'est pas pris en charge par ce navigateur (iOS 14.5 minimum requis).'}</div>
    <button class="btn pri block" data-go ${mime ? '' : 'disabled'}>Exporter la vidéo</button>
    <h4>Image</h4>
    <button class="btn block" data-png>Exporter l'image actuelle (PNG)</button>
    <div id="expOut"></div>`, async (e) => {
    const qb = e.target.closest('[data-q]');
    if (qb) { q = +qb.dataset.q; $$('[data-q]').forEach((b) => b.classList.toggle('on', b === qb)); return; }
    if (e.target.closest('[data-png]')) {
      const c = document.createElement('canvas');
      c.width = p.width; c.height = p.height;
      E.renderFrame(c.getContext('2d'), p, S.t, { scale: 1, media });
      c.toBlob((b) => showResult(b, `${p.name}-${Math.round(S.t * p.fps)}.png`), 'image/png');
      return;
    }
    if (e.target.closest('[data-go]')) {
      const go = e.target.closest('[data-go]');
      go.disabled = true;
      try { const blob = await exportVideo(q, mime); showResult(blob, `${p.name}.${mime.includes('mp4') ? 'mp4' : 'webm'}`); }
      catch (err) { console.error(err); S.exporting = false; toast('Échec de l\'export : ' + err.message, 4000); }
      go.disabled = false;
    }
    if (e.target.closest('[data-share]')) shareResult();
    if (e.target.closest('[data-dl]')) downloadBlob(S.lastExport.blob, S.lastExport.name);
  });
}

async function exportVideo(q, mime) {
  const p = P();
  const even = (v) => Math.max(2, Math.round(v / 2) * 2);
  const c = document.createElement('canvas');
  c.width = even(p.width * q); c.height = even(p.height * q);
  const cx = c.getContext('2d');
  const sc = c.width / p.width;
  if (!c.captureStream) throw new Error('captureStream indisponible');
  const stream = c.captureStream(p.fps);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.round(16e6 * q * q) });
  const chunks = [];
  rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
  const stopped = new Promise((r) => (rec.onstop = r));
  $('#expOut').innerHTML = '<div class="prog"><i id="expBar"></i></div><div class="hint" id="expTxt">Préparation…</div>';
  S.exporting = true;
  syncVideos(0, false);
  await new Promise((r) => setTimeout(r, 300));
  E.renderFrame(cx, p, 0, { scale: sc, media });
  rec.start(250);
  syncVideos(0, true);
  const t0 = performance.now();
  await new Promise((resolve) => {
    const step = () => {
      const t = (performance.now() - t0) / 1000;
      if (t >= p.duration) { E.renderFrame(cx, p, p.duration - 1e-3, { scale: sc, media }); resolve(); return; }
      syncVideos(t, true);
      E.renderFrame(cx, p, t, { scale: sc, media });
      const bar = $('#expBar');
      if (bar) { bar.style.width = (t / p.duration) * 100 + '%'; $('#expTxt').textContent = `Rendu ${fmtT(t)} / ${fmtT(p.duration)}`; }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  await new Promise((r) => setTimeout(r, 120));
  rec.stop();
  await stopped;
  S.exporting = false;
  syncVideos(S.t, false);
  requestRender();
  return new Blob(chunks, { type: mime.split(';')[0] });
}

function showResult(blob, name) {
  if (S.lastExport) URL.revokeObjectURL(S.lastExport.url);
  const url = URL.createObjectURL(blob);
  S.lastExport = { blob, name, url };
  const isVid = blob.type.startsWith('video');
  const canShare = navigator.canShare && navigator.canShare({ files: [new File([blob], name, { type: blob.type })] });
  const out = $('#expOut');
  if (!out) return;
  out.innerHTML = `<div class="result"><h4>Terminé · ${(blob.size / 1e6).toFixed(1)} Mo</h4>
    ${isVid ? `<video src="${url}" controls playsinline loop autoplay muted></video>` : `<img src="${url}" style="width:100%;border-radius:12px">`}
    ${canShare ? '<button class="btn pri block" data-share>Partager / Enregistrer dans Photos</button>' : ''}
    <button class="btn block" data-dl>Télécharger le fichier</button></div>`;
}
async function shareResult() {
  const { blob, name } = S.lastExport;
  try { await navigator.share({ files: [new File([blob], name, { type: blob.type })], title: name }); }
  catch (e) { if (e.name !== 'AbortError') downloadBlob(blob, name); }
}

// ---------- Ouverture de projet ----------
async function openProject(p, isNew = false) {
  if (S.playing) setPlaying(false);
  S.project = p;
  p.fonts ||= [];
  S.sel = null;
  S.t = 0;
  media.forEach((m) => { if (m.el && m.kind === 'video') m.el.pause(); });
  E.clearTextCache();
  await loadProjectMedia(p);
  fitTimeline();
  resetHistory();
  refreshAll();
  if (isNew) await saveNow();
  localStorage.setItem('mm.last', p.id);
}

// ---------- Initialisation ----------
async function init() {
  setupStage();
  setupTimeline();
  setupProps();
  setupAnimate();
  setupAdd();
  $('#tabbar').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) showTab(b.dataset.tab); });
  $('#btnPlay').addEventListener('click', () => { S._stopAt = null; setPlaying(!S.playing); });
  $('#btnStart').addEventListener('click', () => { setPlaying(false); setTime(0); });
  $('#btnLoop').addEventListener('click', (e) => { S.loop = !S.loop; e.currentTarget.classList.toggle('on', S.loop); });
  const jumpKey = (dir) => {
    const L = selLayer();
    const times = (L ? E.keyTimes(L) : [...new Set(P().layers.flatMap((l) => E.keyTimes(l)))].sort((a, b) => a - b))
      .concat(L ? [L.start, L.end] : [0, P().duration]).sort((a, b) => a - b);
    const t = dir > 0 ? times.find((x) => x > S.t + 0.002) : [...times].reverse().find((x) => x < S.t - 0.002);
    if (t !== undefined) { setPlaying(false); setTime(t); }
  };
  $('#btnPrevKey').addEventListener('click', () => jumpKey(-1));
  $('#btnNextKey').addEventListener('click', () => jumpKey(1));
  $('#btnUndo').addEventListener('click', () => S.hidx > 0 && restore(S.hidx - 1));
  $('#btnRedo').addEventListener('click', () => S.hidx < S.hist.length - 1 && restore(S.hidx + 1));
  $('#btnProjects').addEventListener('click', openProjects);
  $('#projTitle').addEventListener('click', openCompSettings);
  $('#btnExport').addEventListener('click', openExport);
  new ResizeObserver(() => fitStage()).observe($('#viewer'));
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (S.playing) setPlaying(false); saveNow(); } });
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input,textarea,select')) return;
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!S.playing); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); (e.shiftKey ? $('#btnRedo') : $('#btnUndo')).click(); }
    if (e.key === 'ArrowRight') setTime(S.t + frame());
    if (e.key === 'ArrowLeft') setTime(S.t - frame());
  });

  // Arrêt automatique des aperçus d'animation
  setInterval(() => { if (S.playing && S._stopAt != null && S.t >= S._stopAt) { S._stopAt = null; setPlaying(false); } }, 50);

  let p = null;
  try {
    const last = localStorage.getItem('mm.last');
    if (last) p = await DB.getProject(last);
  } catch (e) { console.warn(e); }
  const first = !p;
  if (!p) p = projectFromTemplate('cta', '9x16', 'Mon premier projet');
  await openProject(p, first);
  requestAnimationFrame(tick);
  if (first) setTimeout(() => { setPlaying(true); toast('Bienvenue ! Touchez un élément pour le modifier.', 3200); }, 400);

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
