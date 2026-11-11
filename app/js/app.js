// Moteur Motion Studio — application principale.
import * as E from './engine.js';
import * as DB from './storage.js';
import { S, A, $, $$, toast, fmtT, P, selLayer, layerById } from './state.js';
import { resumeAudio, layerGain, setElementGain, computePeaks } from './audio.js';
import { projectFromTemplate } from './templates.js';
import { initTimeline, buildTimeline, updatePlayhead, fitTimeline } from './ui/timeline.js';
import { initInspector, buildProps, refreshPropValues, buildAnimate, buildEffects } from './ui/inspector.js';
import { initLibrary, buildLibrary, importFiles } from './ui/library.js';
import { initTrackPanel, buildTrack, trackOverlay, trackPointer } from './ui/trackpanel.js';
import { initSheets, openProjects, openCompSettings, openExport, openShortcuts } from './ui/sheets.js';

const stage = $('#stage');
const ctx = stage.getContext('2d');
const media = new Map(); // mediaId -> { url, kind, name, el?, blob }
const els = new Map();   // layerId -> élément <video>/<audio> dédié
A.media = media;
A.els = els;

// ---------- Mise en page ----------
const RIGHT_TABS = [['props', 'Propriétés'], ['animate', 'Animer'], ['effects', 'Effets'], ['track', 'Suivi']];
const LEFT_TABS = [['media', 'Médias'], ['add', 'Ajouter'], ['templates', 'Modèles']];
const mq = matchMedia('(min-width: 900px) and (min-height: 540px)');

function applyLayout() {
  S.desktop = mq.matches;
  document.body.classList.toggle('desktop', S.desktop);
  const panes = Object.fromEntries($$('.pane').map((p) => [p.dataset.pane, p]));
  if (S.desktop) {
    $('#leftBody').appendChild(panes.library);
    for (const [id] of RIGHT_TABS) $('#rightBody').appendChild(panes[id]);
    $('#bottom').appendChild(panes.timeline);
    $$('.pane').forEach((p) => p.classList.remove('on'));
    panes.library.classList.add('on');
    panes.timeline.classList.add('on');
    panes[S.rtab].classList.add('on');
  } else {
    for (const p of Object.values(panes)) $('#bottom').appendChild(p);
    $$('.pane').forEach((p) => p.classList.toggle('on', p.dataset.pane === S.tab));
  }
  renderTabs();
  refreshVisible();
  requestAnimationFrame(fitStage);
}
function renderTabs() {
  $('#rightTabs').innerHTML = RIGHT_TABS.map(([id, l]) => `<button data-rtab="${id}" class="${S.rtab === id ? 'on' : ''}">${l}</button>`).join('');
  $('#leftTabs').innerHTML = LEFT_TABS.map(([id, l]) => `<button data-ltab="${id}" class="${S.ltab === id ? 'on' : ''}">${l}</button>`).join('');
  $$('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === S.tab));
}
// Onglet visible : sur mobile un seul panneau, sur grand écran plusieurs.
function isVisible(pane) {
  if (S.desktop) return pane === 'timeline' || pane === 'library' || pane === S.rtab;
  return pane === S.tab;
}
A.isVisible = isVisible;
function showTab(tab) {
  if (S.desktop) {
    if (tab === 'timeline' || tab === 'library') { refreshVisible(); return; }
    S.rtab = tab;
    $$('#rightBody .pane').forEach((p) => p.classList.toggle('on', p.dataset.pane === tab));
  } else {
    S.tab = tab;
    $$('.pane').forEach((p) => p.classList.toggle('on', p.dataset.pane === tab));
  }
  renderTabs();
  refreshVisible();
}
A.showTab = showTab;
function refreshVisible() {
  if (!P()) return;
  if (isVisible('timeline')) buildTimeline();
  if (isVisible('library')) buildLibrary();
  if (isVisible('props')) buildProps();
  if (isVisible('animate')) buildAnimate();
  if (isVisible('effects')) buildEffects();
  if (isVisible('track')) buildTrack();
}
A.refreshVisible = refreshVisible;
A.refreshTimeline = () => { if (isVisible('timeline')) buildTimeline(); };
A.refreshInspector = () => {
  if (isVisible('props')) buildProps();
  if (isVisible('animate')) buildAnimate();
  if (isVisible('effects')) buildEffects();
  if (isVisible('track')) buildTrack();
};

// Séparateurs redimensionnables.
function setupSplitters() {
  const root = document.documentElement;
  const load = (k, d) => { const v = +localStorage.getItem('mm.' + k); return v > 0 ? v : d; };
  root.style.setProperty('--lw', load('lw', 270) + 'px');
  root.style.setProperty('--rw', load('rw', 340) + 'px');
  root.style.setProperty('--bh', load('bh', 280) + 'px');
  root.style.setProperty('--ph', load('ph', Math.round(innerHeight * 0.38)) + 'px');
  const drag = (el, onMove) => {
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      el.classList.add('drag');
      const mv = (ev) => { onMove(ev); fitStage(); };
      const up = () => { el.removeEventListener('pointermove', mv); el.classList.remove('drag'); if (isVisible('timeline')) buildTimeline(); };
      el.addEventListener('pointermove', mv);
      el.addEventListener('pointerup', up, { once: true });
      el.addEventListener('pointercancel', up, { once: true });
    });
  };
  const set = (k, v) => { root.style.setProperty('--' + k, v + 'px'); try { localStorage.setItem('mm.' + k, Math.round(v)); } catch {} };
  drag($('#hsplit'), (e) => {
    const bottom = innerHeight - e.clientY - (S.desktop ? 0 : $('#tabbar').offsetHeight);
    set(S.desktop ? 'bh' : 'ph', Math.max(120, Math.min(innerHeight * 0.75, bottom)));
  });
  drag($('[data-split=left]'), (e) => set('lw', Math.max(200, Math.min(480, e.clientX))));
  drag($('[data-split=right]'), (e) => set('rw', Math.max(260, Math.min(560, innerWidth - e.clientX))));
}

// ---------- Indicateur de chargement ----------
let busyCancel = null;
A.busy = (text, progress = null, onCancel = null) => {
  const el = $('#busy');
  if (!text) { el.hidden = true; busyCancel = null; S.busy = false; return; }
  S.busy = true;
  el.hidden = false;
  $('#busyText').textContent = text;
  $('#busyBar').style.width = progress == null ? '0' : Math.round(progress * 100) + '%';
  $('#busyBar').parentElement.hidden = progress == null;
  busyCancel = onCancel;
  $('#busyCancel').hidden = !onCancel;
};
$('#busyCancel').addEventListener('click', () => busyCancel && busyCancel());

// ---------- Historique ----------
function commit(label) {
  S.hist = S.hist.slice(0, S.hidx + 1);
  S.hist.push(JSON.stringify(P()));
  if (S.hist.length > 100) S.hist.shift();
  S.hidx = S.hist.length - 1;
  updateUndo();
  scheduleSave();
  if (label) toast(label, 1300);
}
A.commit = commit;
function resetHistory() { S.hist = [JSON.stringify(P())]; S.hidx = 0; updateUndo(); }
function restore(i) {
  S.hidx = i;
  const id = P().id;
  S.project = JSON.parse(S.hist[i]);
  S.project.id = id;
  if (!selLayer()) S.sel = null;
  S.multi = new Set([...S.multi].filter((x) => layerById(x)));
  E.clearTextCache();
  ensureElements();
  refreshAll();
  updateUndo();
  scheduleSave();
}
const undo = () => S.hidx > 0 && restore(S.hidx - 1);
const redo = () => S.hidx < S.hist.length - 1 && restore(S.hidx + 1);
A.undo = undo; A.redo = redo;
function updateUndo() {
  $('#btnUndo').disabled = S.hidx <= 0;
  $('#btnRedo').disabled = S.hidx >= S.hist.length - 1;
}

// ---------- Sauvegarde automatique ----------
let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  $('#saveState').textContent = '•';
  $('#saveState').title = 'Modifications non enregistrées';
  saveTimer = setTimeout(saveNow, 800);
}
async function saveNow() {
  clearTimeout(saveTimer);
  const p = P();
  p.updated = Date.now();
  try {
    p.thumb = makeThumb();
    await DB.saveProject(JSON.parse(JSON.stringify(p)));
    localStorage.setItem('mm.last', p.id);
    $('#saveState').textContent = '✓';
    $('#saveState').title = 'Enregistré sur cet appareil';
  } catch (e) {
    console.warn('save', e);
    $('#saveState').textContent = '!';
    toast('Échec de la sauvegarde : espace de stockage insuffisant ?', 4000, 'err');
  }
}
A.saveNow = saveNow;
function makeThumb() {
  const p = P();
  const c = document.createElement('canvas');
  const sc = 240 / Math.max(p.width, p.height);
  c.width = Math.round(p.width * sc); c.height = Math.round(p.height * sc);
  E.renderFrame(c.getContext('2d'), p, Math.min(p.duration * 0.5, 2), { scale: sc, media, els, noFx: true });
  return c.toDataURL('image/jpeg', 0.7);
}

// ---------- Médias ----------
async function attachMedia(rec) {
  if (media.has(rec.id)) return media.get(rec.id);
  const url = URL.createObjectURL(rec.blob);
  const m = { url, kind: rec.kind, name: rec.name, blob: rec.blob, el: null };
  if (rec.kind === 'image') {
    m.el = new Image();
    m.el.src = url;
    try { await m.el.decode(); } catch {}
  } else if (rec.kind === 'font') {
    try {
      const ff = new FontFace(rec.name, await rec.blob.arrayBuffer());
      await ff.load();
      document.fonts.add(ff);
      E.clearTextCache();
    } catch (e) { console.warn('font', e); toast(`Police « ${rec.name} » illisible`, 3000, 'err'); }
  }
  if (rec.kind === 'audio' || rec.kind === 'video') computePeaks(rec.id, rec.blob).then(() => isVisible('timeline') && buildTimeline());
  media.set(rec.id, m);
  requestRender();
  return m;
}
A.attachMedia = attachMedia;
async function loadMedia(id) {
  if (media.has(id)) return media.get(id);
  const rec = await DB.getMedia(id);
  return rec ? attachMedia(rec) : null;
}
A.loadMedia = loadMedia;
A.mediaUrl = (id) => media.get(id)?.url;

// Élément <video>/<audio> propre à chaque calque (deux calques d'un même fichier ne se gênent pas).
function elementFor(L) {
  let el = els.get(L.id);
  const m = media.get(L.style.mediaId);
  if (!m) return null;
  if (el && el._mid === L.style.mediaId) return el;
  if (el) { el.pause(); }
  el = document.createElement(L.type === 'video' ? 'video' : 'audio');
  el._mid = L.style.mediaId;
  el.setAttribute('playsinline', '');
  el.playsInline = true;
  el.preload = 'auto';
  el.src = m.url;
  el.addEventListener('seeked', requestRender);
  el.addEventListener('loadeddata', requestRender);
  els.set(L.id, el);
  return el;
}
function ensureElements() {
  const ids = new Set();
  for (const L of P().layers) if ((L.type === 'video' || L.type === 'audio') && L.style.mediaId) { elementFor(L); ids.add(L.id); }
  for (const [id, el] of els) if (!ids.has(id)) { el.pause(); els.delete(id); }
}
A.ensureElements = ensureElements;

function syncMedia(t, playing) {
  for (const L of P().layers) {
    if (L.type !== 'video' && L.type !== 'audio') continue;
    const el = elementFor(L);
    if (!el) continue;
    const active = E.isActive(L, t);
    const speed = L.style.speed || 1;
    let lt = (t - L.start) * speed + (L.style.trim || 0);
    if (el.duration) lt = Math.min(lt, el.duration - 0.03);
    if (el.playbackRate !== speed) el.playbackRate = speed;
    if (!active || lt < 0) { if (!el.paused) el.pause(); continue; }
    if (playing) {
      setElementGain(el, layerGain(L, t, E.getProp(L, 's.volume', t)));
      if (el.paused) el.play().catch(() => { el.muted = true; el.play().catch(() => {}); });
      if (Math.abs(el.currentTime - lt) > 0.25) el.currentTime = lt;
    } else {
      if (!el.paused) el.pause();
      if (L.type === 'video' && !el.seeking && (Math.abs(el.currentTime - lt) > 0.02 || el.readyState < 2)) el.currentTime = lt;
    }
  }
}
A.syncMedia = syncMedia;

// Rendu exact pour l'export image par image : attend que chaque vidéo soit positionnée.
A.renderExact = async (c, t, sc) => {
  const p = P();
  const waits = [];
  for (const L of p.layers) {
    if (L.type !== 'video' || !E.isActive(L, t)) continue;
    const el = elementFor(L);
    if (!el) continue;
    if (!el.paused) el.pause();
    const lt = Math.min((t - L.start) * (L.style.speed || 1) + (L.style.trim || 0), (el.duration || 1e9) - 0.001);
    if (Math.abs(el.currentTime - lt) > 0.25 / p.fps || el.readyState < 2) {
      waits.push(new Promise((res) => {
        const to = setTimeout(res, 4000);
        el.addEventListener('seeked', () => { clearTimeout(to); res(); }, { once: true });
        el.currentTime = Math.max(0, lt);
      }));
    }
  }
  await Promise.all(waits);
  E.renderFrame(c, p, t, { scale: sc, media, els });
};
A.renderLive = (c, t, sc, playing) => { syncMedia(t, playing); E.renderFrame(c, P(), t, { scale: sc, media, els }); };

// ---------- Rendu de la scène ----------
function fitStage() {
  const p = P();
  if (!p) return;
  const vr = $('#viewer').getBoundingClientRect();
  const pad = 14;
  const k = Math.max(0.01, Math.min((vr.width - pad * 2) / p.width, (vr.height - pad * 2) / p.height));
  const cw = p.width * k, ch = p.height * k;
  stage.style.width = cw + 'px';
  stage.style.height = ch + 'px';
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  S.rs = Math.min(1, (cw * dpr) / p.width);
  stage.width = Math.max(2, Math.round(p.width * S.rs));
  stage.height = Math.max(2, Math.round(p.height * S.rs));
  S.cssScale = k;
  $('#zoomLabel').textContent = Math.round(k * 100) + ' %';
  requestRender();
}
A.fitStage = fitStage;
function requestRender() { S.dirty = true; }
A.requestRender = requestRender;

function draw() {
  E.renderFrame(ctx, P(), S.t, {
    scale: S.rs, media, els, overlay: !S.playing, selected: S.sel, multi: S.multi, guides: S.guides,
    dpr: S.rs / (S.cssScale || 1), extra: (c, sc, dpr) => trackOverlay(c, sc, dpr),
  });
}

let lastTs = 0, fpsAcc = 0, fpsN = 0;
function tick(ts) {
  const dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0;
  lastTs = ts;
  if (S.playing && !S.exporting) {
    let t = S.t + dt;
    if (S.stopAt != null && t >= S.stopAt) { S.stopAt = null; t = Math.min(t, P().duration); setPlaying(false); }
    else if (t >= P().duration) {
      if (S.loop) { t = 0; syncMedia(0, true); } else { t = P().duration; setPlaying(false); }
    }
    if (S.playing) { S.t = t; syncMedia(S.t, true); }
    S.dirty = true;
    updateTime();
  }
  if (S.dirty && !S.exporting) {
    const t0 = performance.now();
    draw();
    S.dirty = false;
    fpsAcc += performance.now() - t0; fpsN++;
    if (fpsN >= 30) { $('#perf').textContent = `${(fpsAcc / fpsN).toFixed(1)} ms/img`; fpsAcc = 0; fpsN = 0; }
  }
  requestAnimationFrame(tick);
}

const snapT = (t) => E.clamp(Math.round(t * P().fps) / P().fps, 0, P().duration);
function setTime(t, opts = {}) {
  S.t = opts.raw ? E.clamp(t, 0, P().duration) : snapT(t);
  if (!S.playing) syncMedia(S.t, false);
  updateTime();
  if (isVisible('props')) refreshPropValues();
  if (isVisible('track')) buildTrack(true);
  requestRender();
}
A.setTime = setTime;
function updateTime() {
  $('#timeLabel').textContent = fmtT(S.t);
  $('#frameLabel').textContent = `${Math.round(S.t * P().fps)} / ${Math.round(P().duration * P().fps)}`;
  updatePlayhead();
}
function setPlaying(on) {
  S.playing = on;
  if (on) {
    resumeAudio();
    // Appelé depuis un geste utilisateur : on réactive le son des médias (iOS les coupe sans geste).
    for (const [id, el] of els) { const L = layerById(id); if (L && !L.style.muted) el.muted = false; }
    if (S.t >= P().duration - 0.001) S.t = 0;
  }
  $('#btnPlay').innerHTML = on
    ? '<svg viewBox="0 0 24 24"><rect x="6" y="4.5" width="4" height="15" rx="1" class="f"/><rect x="14" y="4.5" width="4" height="15" rx="1" class="f"/></svg>'
    : '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z" class="f"/></svg>';
  syncMedia(S.t, on);
  if (!on) { S.t = snapT(S.t); updateTime(); if (isVisible('props')) refreshPropValues(); if (isVisible('track')) buildTrack(true); }
  requestRender();
}
A.setPlaying = setPlaying;
A.preview = (from, to) => { setTime(Math.max(0, from)); S.stopAt = to; setPlaying(true); };

// ---------- Sélection et calques ----------
function select(id, { add = false } = {}) {
  if (add || S.multiMode) {
    if (!id) return;
    if (S.multi.has(id)) S.multi.delete(id); else S.multi.add(id);
    if (S.sel && !S.multi.has(S.sel) && S.sel !== id) S.multi.add(S.sel);
    S.sel = S.multi.has(id) ? id : [...S.multi].pop() || null;
  } else {
    if (S.sel === id && S.multi.size <= 1) return;
    S.sel = id;
    S.multi = new Set(id ? [id] : []);
  }
  S.selKey = null;
  if (isVisible('timeline')) buildTimeline();
  A.refreshInspector();
  requestRender();
}
A.select = select;

function addLayer(L, { at = 'top' } = {}) {
  const p = P();
  if (at === 'top') p.layers.unshift(L); else p.layers.push(L);
  S.sel = L.id;
  S.multi = new Set([L.id]);
  if (L.type === 'video' || L.type === 'audio') elementFor(L);
  refreshVisible();
  commit();
  requestRender();
}
A.addLayer = addLayer;

A.setVal = (L, path, v) => { if (E.isAnimated(L, path)) E.setKey(L, path, S.t, v); else E.setBase(L, path, v); };

// Supprime des calques (et détache leurs enfants).
A.deleteLayers = (ids) => {
  const p = P();
  const set = new Set(ids);
  for (const L of p.layers) if (L.parent && set.has(L.parent)) {
    const D = E.worldMatrix(p, L, S.t).m;
    L.parent = null;
    const pr = E.propsFromWorld(p, L, D, S.t);
    for (const k of ['x', 'y', 'rotation', 'scale']) if (!E.isAnimated(L, k)) L.props[k] = pr[k];
  }
  p.layers = p.layers.filter((l) => !set.has(l.id));
  p.tracks = p.tracks.filter((tr) => !set.has(tr.layerId));
  S.sel = null; S.multi = new Set();
  ensureElements();
  refreshVisible();
  commit(ids.length > 1 ? `${ids.length} calques supprimés` : 'Calque supprimé');
};
A.duplicateLayers = (ids) => {
  const p = P();
  const map = new Map();
  const copies = [];
  for (const id of ids) {
    const L = layerById(id);
    if (!L) continue;
    const c = JSON.parse(JSON.stringify(L));
    c.id = E.uid(); c.name = L.name + ' copie';
    c.fx.forEach((f) => { const nid = E.uid(); for (const k of Object.keys(c.kf)) if (k.startsWith(`fx.${f.id}.`)) { c.kf[k.replace(f.id, nid)] = c.kf[k]; delete c.kf[k]; } f.id = nid; });
    map.set(id, c.id);
    copies.push([L, c]);
  }
  for (const [L, c] of copies) { if (map.has(c.parent)) c.parent = map.get(c.parent); p.layers.splice(p.layers.indexOf(L), 0, c); }
  S.multi = new Set(copies.map(([, c]) => c.id));
  S.sel = copies.length ? copies[copies.length - 1][1].id : null;
  ensureElements();
  refreshVisible();
  commit(copies.length > 1 ? `${copies.length} calques dupliqués` : 'Calque dupliqué');
};
A.splitLayer = (L) => {
  const p = P();
  if (S.t <= L.start + 1e-3 || S.t >= L.end - 1e-3) { toast('Placez la tête de lecture sur le calque à couper'); return; }
  const c = JSON.parse(JSON.stringify(L));
  c.id = E.uid(); c.name = L.name.replace(/ \(\d+\)$/, '') + ' (2)';
  if (c.type === 'video' || c.type === 'audio') c.style.trim = (L.style.trim || 0) + (S.t - L.start) * (L.style.speed || 1);
  c.start = S.t; L.end = S.t;
  p.layers.splice(p.layers.indexOf(L), 0, c);
  S.sel = c.id; S.multi = new Set([c.id]);
  ensureElements();
  refreshVisible();
  commit('Calque coupé');
};
// Parentage : conserve la position à l'écran au moment du lien.
A.setParent = (L, parentId) => {
  const p = P();
  if (parentId) { let q = layerById(parentId); while (q) { if (q.id === L.id) { toast('Lien circulaire impossible', 2500, 'err'); return false; } q = q.parent && layerById(q.parent); } }
  const t = S.t;
  const before = new Map();
  const keyed = ['x', 'y', 'rotation', 'scale'];
  for (const k of keyed) for (const q of L.kf[k] || []) before.set(`${k}@${q.t}`, E.worldMatrix(p, L, q.t).m);
  const D = E.worldMatrix(p, L, t).m;
  L.parent = parentId || null;
  const pr = E.propsFromWorld(p, L, D, t);
  for (const k of keyed) {
    if (!E.isAnimated(L, k)) { L.props[k] = pr[k]; continue; }
    for (const q of L.kf[k]) q.v = E.propsFromWorld(p, L, before.get(`${k}@${q.t}`), q.t)[k];
  }
  return true;
};
A.groupLayers = (ids) => {
  const p = P();
  const layers = ids.map(layerById).filter((L) => L && L.type !== 'null');
  if (layers.length < 1) { toast('Sélectionnez au moins un calque'); return; }
  let cx = 0, cy = 0, n = 0;
  for (const L of layers) { if (!E.VISUAL(L)) continue; const { m, w, h } = E.worldMatrix(p, L, S.t); const c = m.transformPoint(new DOMPoint(w / 2, h / 2)); cx += c.x; cy += c.y; n++; }
  const G = E.newLayer(p, 'null', { name: 'Groupe', props: { x: n ? cx / n : p.width / 2, y: n ? cy / n : p.height / 2 }, start: Math.min(...layers.map((l) => l.start)), end: Math.max(...layers.map((l) => l.end)) });
  G.open = true;
  const top = Math.min(...layers.map((l) => p.layers.indexOf(l)));
  p.layers.splice(top, 0, G);
  for (const L of layers) A.setParent(L, G.id);
  // Regroupe les enfants sous le groupe dans la pile.
  const kids = p.layers.filter((l) => l.parent === G.id);
  p.layers = p.layers.filter((l) => l.parent !== G.id);
  p.layers.splice(p.layers.indexOf(G) + 1, 0, ...kids);
  S.sel = G.id; S.multi = new Set([G.id]);
  refreshVisible();
  commit(`Groupe créé (${layers.length} calque${layers.length > 1 ? 's' : ''})`);
};
A.ungroup = (G) => {
  const p = P();
  for (const L of p.layers.filter((l) => l.parent === G.id)) A.setParent(L, null);
  p.layers = p.layers.filter((l) => l !== G);
  S.sel = null; S.multi = new Set();
  refreshVisible();
  commit('Groupe dissous');
};

// ---------- Interaction sur la scène ----------
function setupStage() {
  const pts = new Map();
  let g = null, lastTap = 0;
  const toComp = (e) => {
    const r = stage.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * P().width, y: ((e.clientY - r.top) / r.height) * P().height };
  };
  const startMove = (L, q) => ({ type: 'move', L, q0: q, x0: E.getProp(L, 'x', S.t), y0: E.getProp(L, 'y', S.t), changed: false, inv: L.parent ? E.worldMatrix(P(), layerById(L.parent), S.t).m.inverse() : null });
  const startPinch = () => {
    const L = selLayer();
    if (!L || L.locked) return;
    const [a, b] = [...pts.values()];
    g = { type: 'pinch', L, d0: Math.hypot(b.x - a.x, b.y - a.y), a0: Math.atan2(b.y - a.y, b.x - a.x), s0: E.getProp(L, 'scale', S.t), r0: E.getProp(L, 'rotation', S.t), changed: false };
  };
  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId);
    const q = toComp(e);
    pts.set(e.pointerId, q);
    if (S.playing) setPlaying(false);
    if (pts.size === 1 && trackPointer('down', q, e)) { g = { type: 'track' }; return; }
    if (pts.size === 1) {
      const hit = E.hitTest(P(), S.t, q.x, q.y);
      const cur = selLayer();
      const now = Date.now();
      if (hit) {
        if (hit.id === S.sel && now - lastTap < 320 && hit.type === 'text') { showTab('props'); setTimeout(() => $('.pane[data-pane=props] textarea')?.focus(), 60); }
        lastTap = now;
        if (e.shiftKey || e.metaKey || e.ctrlKey) select(hit.id, { add: true });
        else if (!S.multi.has(hit.id) || S.multi.size <= 1) select(hit.id);
        g = startMove(hit, q);
        if (S.multi.size > 1) g.group = [...S.multi].map(layerById).filter((L) => L && !L.locked && L.id !== hit.id && !S.multi.has(L.parent)).map((L) => ({ L, x0: E.getProp(L, 'x', S.t), y0: E.getProp(L, 'y', S.t) }));
      } else if (cur && !cur.locked && E.VISUAL(cur) && cur.type !== 'solid' && cur.type !== 'adjust' && E.isActive(cur, S.t)) {
        g = startMove(cur, q);
      } else { if (!S.multiMode) select(null); g = null; }
    } else if (pts.size === 2 && g?.type !== 'track') startPinch();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    const q = toComp(e);
    pts.set(e.pointerId, q);
    if (!g) return;
    if (g.type === 'track') { trackPointer('move', q, e); return; }
    const p = P();
    if (g.type === 'move' && pts.size === 1) {
      if (g.L.locked) return;
      let dx = q.x - g.q0.x, dy = q.y - g.q0.y;
      if (g.inv) { const a = g.inv.transformPoint(new DOMPoint(q.x, q.y)), b = g.inv.transformPoint(new DOMPoint(g.q0.x, g.q0.y)); dx = a.x - b.x; dy = a.y - b.y; }
      let x = g.x0 + dx, y = g.y0 + dy;
      const snap = 14 / (S.cssScale || 1);
      const gv = !g.L.parent && Math.abs(x - p.width / 2) < snap, gh = !g.L.parent && Math.abs(y - p.height / 2) < snap;
      if (gv) x = p.width / 2;
      if (gh) y = p.height / 2;
      S.guides = gv || gh ? { v: gv, h: gh } : null;
      A.setVal(g.L, 'x', Math.round(x * 10) / 10);
      A.setVal(g.L, 'y', Math.round(y * 10) / 10);
      for (const o of g.group || []) { A.setVal(o.L, 'x', o.x0 + (x - g.x0)); A.setVal(o.L, 'y', o.y0 + (y - g.y0)); }
      g.changed = true;
      requestRender();
    } else if (g.type === 'pinch' && pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(b.x - a.x, b.y - a.y), an = Math.atan2(b.y - a.y, b.x - a.x);
      A.setVal(g.L, 'scale', Math.round(Math.max(1, g.s0 * (d / g.d0)) * 10) / 10);
      let r = g.r0 + ((an - g.a0) * 180) / Math.PI;
      const near = Math.round(r / 45) * 45;
      if (Math.abs(r - near) < 3) r = near;
      A.setVal(g.L, 'rotation', Math.round(r * 10) / 10);
      g.changed = true;
      requestRender();
    }
  });
  const end = (e) => {
    pts.delete(e.pointerId);
    if (g && g.type === 'track') { if (pts.size === 0) { trackPointer('up', null, e); g = null; } return; }
    if (g && g.changed && pts.size === 0) {
      commit();
      if (isVisible('props')) refreshPropValues();
      if (isVisible('timeline')) buildTimeline();
    }
    if (pts.size === 0) { g = null; S.guides = null; requestRender(); }
    else if (pts.size === 1 && g && g.type === 'pinch') g = { ...startMove(g.L, [...pts.values()][0]), changed: g.changed };
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  // Molette (ordinateur) : Ctrl + molette = échelle du calque sélectionné.
  stage.addEventListener('wheel', (e) => {
    const L = selLayer();
    if (!L || !e.ctrlKey) return;
    e.preventDefault();
    A.setVal(L, 'scale', Math.max(1, E.getProp(L, 'scale', S.t) * (e.deltaY < 0 ? 1.04 : 0.96)));
    requestRender();
    clearTimeout(stage._wt);
    stage._wt = setTimeout(() => { commit(); if (isVisible('props')) refreshPropValues(); }, 300);
  }, { passive: false });
}

// ---------- Raccourcis clavier ----------
function setupKeys() {
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input:not([type=range]):not([type=checkbox]),textarea,select') || !$('#sheet').hidden) {
      if (e.key === 'Escape' && !$('#sheet').hidden) A.closeSheet();
      return;
    }
    const mod = e.metaKey || e.ctrlKey;
    const L = selLayer();
    const f = 1 / P().fps;
    const k = e.key.toLowerCase();
    let handled = true;
    if (e.code === 'Space') setPlaying(!S.playing);
    else if (mod && k === 'z') (e.shiftKey ? redo : undo)();
    else if (mod && k === 'y') redo();
    else if (mod && k === 'd') { if (S.multi.size) A.duplicateLayers([...S.multi]); }
    else if (mod && k === 'g') { if (e.shiftKey) { if (L?.type === 'null') A.ungroup(L); } else if (S.multi.size) A.groupLayers([...S.multi]); }
    else if (mod && k === 'e') openExport();
    else if (mod && k === 's') { saveNow(); toast('Projet enregistré'); }
    else if (mod && k === 'a') { S.multi = new Set(P().layers.map((l) => l.id)); S.sel = P().layers[0]?.id || null; refreshVisible(); requestRender(); }
    else if (k === 'delete' || k === 'backspace') { if (S.multi.size) A.deleteLayers([...S.multi]); }
    else if (k === 's' && L) A.splitLayer(L);
    else if (k === 'arrowright') setTime(S.t + (e.shiftKey ? 10 * f : f));
    else if (k === 'arrowleft') setTime(S.t - (e.shiftKey ? 10 * f : f));
    else if (k === 'home') setTime(0);
    else if (k === 'end') setTime(P().duration);
    else if (k === 'j') jumpKey(-1);
    else if (k === 'k') jumpKey(1);
    else if (k === 'l') { S.loop = !S.loop; $('#btnLoop').classList.toggle('on', S.loop); }
    else if (k === '[' && L) { if (S.t < L.end) { L.start = S.t; buildTimeline(); commit(); } }
    else if (k === ']' && L) { if (S.t > L.start) { L.end = S.t; buildTimeline(); commit(); } }
    else if (k === 'i' && L) { for (const n of ['x', 'y', 'scale', 'rotation', 'opacity']) E.setKey(L, n, S.t, E.getProp(L, n, S.t)); refreshVisible(); commit('Keyframes de transformation ajoutées'); }
    else if (k === 'u' && L) { L.open = !L.open; buildTimeline(); }
    else if (k === 'escape') { select(null); A.trackCancelPlacing?.(); }
    else if (k === '?' || (e.shiftKey && k === '/')) openShortcuts();
    else if (k === 'f') { if (S.desktop) toggleFocus(); }
    else handled = false;
    if (handled) e.preventDefault();
  });
}
function toggleFocus() { document.body.classList.toggle('focus'); setTimeout(fitStage, 50); }

function jumpKey(dir) {
  const L = selLayer();
  const times = (L ? E.keyTimes(L) : [...new Set(P().layers.flatMap((l) => E.keyTimes(l)))])
    .concat(L ? [L.start, L.end] : [0, P().duration]).sort((a, b) => a - b);
  const t = dir > 0 ? times.find((x) => x > S.t + 0.002) : [...times].reverse().find((x) => x < S.t - 0.002);
  if (t !== undefined) { setPlaying(false); setTime(t); }
}

// ---------- Ouverture de projet ----------
function refreshAll() {
  const p = P();
  $('#projName').textContent = p.name;
  $('#projMeta').textContent = `${p.width}×${p.height} · ${p.fps} i/s · ${p.duration.toFixed(1)} s`;
  S.t = Math.min(S.t, p.duration);
  fitStage();
  refreshVisible();
  updateTime();
}
A.refreshAll = refreshAll;

async function openProject(p, isNew = false) {
  if (S.playing) setPlaying(false);
  E.migrateProject(p);
  S.project = p;
  S.sel = null; S.multi = new Set(); S.t = 0; S.selKey = null; S.graphPath = null;
  S.track = { id: null, placing: 0, drag: null };
  for (const el of els.values()) el.pause();
  els.clear();
  E.clearTextCache();
  A.busy('Chargement du projet…');
  try {
    const ids = new Set(p.layers.filter((l) => l.style.mediaId).map((l) => l.style.mediaId));
    p.media.forEach((m) => ids.add(m.id));
    p.fonts.forEach((f) => ids.add(f.id));
    await Promise.all([...ids].map((id) => loadMedia(id).catch(() => null)));
    // Projets v1 : reconstruit la médiathèque à partir des calques.
    for (const L of p.layers) if (L.style.mediaId && !p.media.find((m) => m.id === L.style.mediaId) && media.has(L.style.mediaId)) {
      const m = media.get(L.style.mediaId);
      p.media.push({ id: L.style.mediaId, kind: m.kind, name: m.name || L.name });
    }
    ensureElements();
  } finally { A.busy(null); }
  fitTimeline();
  resetHistory();
  refreshAll();
  if (isNew) await saveNow();
  localStorage.setItem('mm.last', p.id);
}
A.openProject = openProject;

// ---------- Initialisation ----------
async function init() {
  setupSplitters();
  setupStage();
  setupKeys();
  initTimeline();
  initInspector();
  initLibrary();
  initTrackPanel();
  initSheets();
  mq.addEventListener('change', applyLayout);
  $('#tabbar').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) showTab(b.dataset.tab); });
  $('#rightTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-rtab]'); if (b) showTab(b.dataset.rtab); });
  $('#leftTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-ltab]'); if (b) { S.ltab = b.dataset.ltab; renderTabs(); buildLibrary(); } });
  $('#btnPlay').addEventListener('click', () => { S.stopAt = null; setPlaying(!S.playing); });
  $('#btnStart').addEventListener('click', () => { setPlaying(false); setTime(0); });
  $('#btnEnd').addEventListener('click', () => { setPlaying(false); setTime(P().duration); });
  $('#btnLoop').addEventListener('click', (e) => { S.loop = !S.loop; e.currentTarget.classList.toggle('on', S.loop); });
  $('#btnPrevKey').addEventListener('click', () => jumpKey(-1));
  $('#btnPrevFrame').addEventListener('click', () => { setPlaying(false); setTime(S.t - 1 / P().fps); });
  $('#btnNextFrame').addEventListener('click', () => { setPlaying(false); setTime(S.t + 1 / P().fps); });
  $('#btnNextKey').addEventListener('click', () => jumpKey(1));
  $('#btnUndo').addEventListener('click', undo);
  $('#btnRedo').addEventListener('click', redo);
  $('#btnProjects').addEventListener('click', openProjects);
  $('#projTitle').addEventListener('click', openCompSettings);
  $('#btnSettings').addEventListener('click', openCompSettings);
  $('#btnExport').addEventListener('click', openExport);
  $('#btnHelp').addEventListener('click', openShortcuts);
  $('#btnFit').addEventListener('click', fitStage);
  $('#btnFocus').addEventListener('click', toggleFocus);
  new ResizeObserver(() => fitStage()).observe($('#viewer'));
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (S.playing && !S.exporting) setPlaying(false); saveNow(); } });
  // Glisser-déposer de fichiers (ordinateur).
  document.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); document.body.classList.add('dropping'); } });
  document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('dropping'); });
  document.addEventListener('drop', (e) => { document.body.classList.remove('dropping'); if (e.dataTransfer?.files?.length) { e.preventDefault(); importFiles([...e.dataTransfer.files], true); } });
  window.addEventListener('error', (e) => toast('Erreur : ' + (e.message || 'inconnue'), 4000, 'err'));
  window.addEventListener('unhandledrejection', (e) => { if (e.reason?.name !== 'AbortError') toast('Erreur : ' + (e.reason?.message || e.reason), 4000, 'err'); });

  applyLayout();
  let p = null;
  try { const last = localStorage.getItem('mm.last'); if (last) p = await DB.getProject(last); } catch (e) { console.warn(e); }
  const first = !p;
  if (!p) p = projectFromTemplate('cta', '9x16', 'Mon premier projet');
  await openProject(p, first);
  requestAnimationFrame(tick);
  if (first) setTimeout(() => { setPlaying(true); toast('Bienvenue dans Moteur Motion Studio ! Touchez un élément pour le modifier.', 3500); }, 400);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
}

init();
