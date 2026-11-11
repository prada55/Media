// Moteur Montage — éditeur vidéo multipiste.
import * as E from '../../js/engine.js';
import { resumeAudio, layerGain, setElementGain, computePeaks } from '../../js/audio.js';
import { $, $$, toast, fmtT } from '../../js/state.js';
import * as DB from './store.js';
import { St, App, selInfo, localT } from './core.js';
import * as M from './model.js';
import { initTimeline, buildTimeline, updatePlayhead, fitTimeline } from './timeline.js';
import { initPanels, renderPanels, refreshValues } from './panels.js';
import { openProjects, openExport, openFormat } from './sheets.js';

const stage = $('#stage');
const ctx = stage.getContext('2d');
const media = new Map(); // id -> { url, kind, name, blob, el }
const els = new Map();   // id de calque -> <video>/<audio>
const elsView = new Map(); // inclut les alias (arrière-plan flou)
App.media = media;

// ---------- Compilation et rendu ----------
const meta = (id) => St.p.media.find((m) => m.id === id);
function recompile() {
  St.C = M.compile(St.p, meta);
  ensureElements();
  if (!St.playing && !St.exporting) syncMedia(St.t, false);
  St.dirty = true;
}
App.recompile = recompile;

function elementFor(L) {
  const m = media.get(L.style.mediaId);
  if (!m) return null;
  let el = els.get(L.id);
  if (el && el._mid === L.style.mediaId) return el;
  if (el) el.pause();
  el = document.createElement(L.type === 'video' ? 'video' : 'audio');
  el._mid = L.style.mediaId;
  el.setAttribute('playsinline', '');
  el.playsInline = true;
  el.preload = 'auto';
  el.src = m.url;
  el.addEventListener('seeked', () => (St.dirty = true));
  el.addEventListener('loadeddata', () => (St.dirty = true));
  els.set(L.id, el);
  return el;
}
function ensureElements() {
  const keep = new Set();
  elsView.clear();
  for (const L of St.C.layers) {
    if ((L.type === 'video' || L.type === 'audio') && !L.alias && L.style.mediaId) { const el = elementFor(L); if (el) { keep.add(L.id); elsView.set(L.id, el); } }
  }
  for (const L of St.C.layers) if (L.alias && elsView.has(L.alias)) elsView.set(L.id, elsView.get(L.alias));
  for (const [id, el] of els) if (!keep.has(id)) { el.pause(); els.delete(id); }
}

function syncMedia(t, playing) {
  for (const L of St.C.layers) {
    if ((L.type !== 'video' && L.type !== 'audio') || L.alias) continue;
    const el = els.get(L.id);
    if (!el) continue;
    const speed = L.style.speed || 1;
    let lt = (t - L.start) * speed + (L.style.trim || 0);
    if (el.duration) lt = Math.min(lt, el.duration - 0.03);
    if (el.playbackRate !== speed) el.playbackRate = speed;
    if (!E.isActive(L, t) || lt < 0) { if (!el.paused) el.pause(); continue; }
    if (playing) {
      setElementGain(el, layerGain(L, t));
      if (el.paused) el.play().catch(() => { el.muted = true; el.play().catch(() => {}); });
      if (Math.abs(el.currentTime - lt) > 0.25) el.currentTime = lt;
    } else {
      if (!el.paused) el.pause();
      if (L.type === 'video' && !el.seeking && (Math.abs(el.currentTime - lt) > 0.02 || el.readyState < 2)) el.currentTime = lt;
    }
  }
}
App.syncMedia = syncMedia;

// Rendu exact pour l'export image par image.
App.renderExact = async (c, t, sc) => {
  const waits = [];
  for (const L of St.C.layers) {
    if (L.type !== 'video' || L.alias || !E.isActive(L, t)) continue;
    const el = els.get(L.id);
    if (!el) continue;
    if (!el.paused) el.pause();
    const lt = Math.max(0, Math.min((t - L.start) * (L.style.speed || 1) + (L.style.trim || 0), (el.duration || 1e9) - 0.001));
    if (Math.abs(el.currentTime - lt) > 0.25 / St.p.fps || el.readyState < 2) {
      waits.push(new Promise((res) => { const to = setTimeout(res, 4000); el.addEventListener('seeked', () => { clearTimeout(to); res(); }, { once: true }); el.currentTime = lt; }));
    }
  }
  await Promise.all(waits);
  E.renderFrame(c, St.C, t, { scale: sc, media, els: elsView });
};
App.renderLive = (c, t, sc, playing) => { syncMedia(t, playing); E.renderFrame(c, St.C, t, { scale: sc, media, els: elsView }); };

const QUAL = { low: 360, med: 540, high: 99999 };
function fitStage() {
  const p = St.p;
  if (!p) return;
  const vr = $('#viewer').getBoundingClientRect();
  const k = Math.max(0.01, Math.min((vr.width - 16) / p.width, (vr.height - 16) / p.height));
  const cw = p.width * k, ch = p.height * k;
  stage.style.width = cw + 'px';
  stage.style.height = ch + 'px';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let q = St.q;
  if (q === 'auto') q = (navigator.hardwareConcurrency || 4) <= 4 ? 'med' : 'high';
  const cap = QUAL[q] / Math.min(p.width, p.height);
  St.rs = Math.max(0.05, Math.min(1, (cw * dpr) / p.width, cap));
  stage.width = Math.max(2, Math.round(p.width * St.rs));
  stage.height = Math.max(2, Math.round(p.height * St.rs));
  St.cssScale = k;
  St.dirty = true;
}
App.fitStage = fitStage;

function selectedLayerId() {
  const s = St.sel;
  return s && (s.kind === 'clip' || s.kind === 'item') ? s.id : null;
}
function draw() {
  E.renderFrame(ctx, St.C, St.t, { scale: St.rs, media, els: elsView, overlay: !St.playing, selected: selectedLayerId(), dpr: St.rs / (St.cssScale || 1), noFx: !St.fxPreview, guides: St.guides });
}

let lastTs = 0, acc = 0, n = 0;
function tick(ts) {
  const dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0;
  lastTs = ts;
  if (St.playing && !St.exporting) {
    let t = St.t + dt;
    if (St.stopAt != null && t >= St.stopAt) { St.stopAt = null; St.t = Math.min(t, St.C.duration); setPlaying(false); }
    else if (t >= St.C.duration) { if (St.loop) { t = 0; syncMedia(0, true); } else { t = St.C.duration; setPlaying(false); } }
    if (St.playing) { St.t = t; syncMedia(t, true); }
    St.dirty = true;
    updateTime();
  }
  if (St.dirty && !St.exporting) {
    const t0 = performance.now();
    draw();
    St.dirty = false;
    acc += performance.now() - t0; n++;
    if (n >= 30) { $('#perf').textContent = `${(acc / n).toFixed(1)} ms/img`; acc = 0; n = 0; }
  }
  requestAnimationFrame(tick);
}

const snapT = (t) => E.clamp(Math.round(t * St.p.fps) / St.p.fps, 0, St.C.duration);
function setTime(t) {
  St.t = snapT(t);
  if (!St.playing) syncMedia(St.t, false);
  updateTime();
  refreshValues();
  St.dirty = true;
}
App.setTime = setTime;
function updateTime() {
  $('#timeLabel').textContent = fmtT(St.t);
  $('#durLabel').textContent = fmtT(St.C.duration);
  updatePlayhead();
}
function setPlaying(on) {
  St.playing = on;
  if (on) {
    resumeAudio();
    for (const [id, el] of els) { const L = St.C.layers.find((l) => l.id === id); if (L && !L.style.muted) el.muted = false; }
    if (St.t >= St.C.duration - 0.001) St.t = 0;
  }
  $('#btnPlay').innerHTML = on ? '<svg viewBox="0 0 24 24"><rect x="6" y="4.5" width="4" height="15" rx="1" class="f"/><rect x="14" y="4.5" width="4" height="15" rx="1" class="f"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z" class="f"/></svg>';
  syncMedia(St.t, on);
  if (!on) { St.t = snapT(St.t); updateTime(); refreshValues(); }
  St.dirty = true;
}
App.setPlaying = setPlaying;

// ---------- Historique et sauvegarde ----------
function commit(label) {
  St.hist = St.hist.slice(0, St.hidx + 1);
  St.hist.push(JSON.stringify(St.p));
  if (St.hist.length > 100) St.hist.shift();
  St.hidx = St.hist.length - 1;
  updateUndo();
  scheduleSave();
  if (label) toast(label, 1300);
}
App.commit = commit;
// Modification : recompile, rafraîchit l'interface et enregistre dans l'historique.
App.change = (label, { panels = true } = {}) => {
  const before = St.C?.duration || 0;
  recompile();
  // Réajuste le zoom de la timeline quand la durée change fortement (premier import, gros ajout).
  const w = ($('#timeline')?.clientWidth || 360) - 100;
  if (St.C.duration * St.pps > w * 3 || (St.C.duration > before * 1.8 && St.C.duration * St.pps > w)) fitTimeline();
  if (St.t > St.C.duration) St.t = St.C.duration;
  buildTimeline();
  if (panels) renderPanels();
  updateTime();
  updateTools();
  commit(label);
};
function restore(i) {
  St.hidx = i;
  const id = St.p.id;
  St.p = JSON.parse(St.hist[i]);
  St.p.id = id;
  if (!selInfo()) St.sel = null;
  recompile();
  buildTimeline(); renderPanels(); updateTime(); updateTools();
  updateUndo();
  scheduleSave();
}
App.undo = () => St.hidx > 0 && restore(St.hidx - 1);
App.redo = () => St.hidx < St.hist.length - 1 && restore(St.hidx + 1);
function updateUndo() { $('#btnUndo').disabled = St.hidx <= 0; $('#btnRedo').disabled = St.hidx >= St.hist.length - 1; }

let saveTimer = null;
function scheduleSave() { clearTimeout(saveTimer); $('#saveState').textContent = '•'; saveTimer = setTimeout(saveNow, 800); }
async function saveNow() {
  clearTimeout(saveTimer);
  St.p.updated = Date.now();
  try {
    St.p.thumb = makeThumb();
    await DB.saveProject(JSON.parse(JSON.stringify(St.p)));
    localStorage.setItem('mt.last', St.p.id);
    $('#saveState').textContent = '✓';
  } catch (e) { console.warn(e); $('#saveState').textContent = '!'; toast('Échec de la sauvegarde (stockage plein ?)', 3500, 'err'); }
}
App.saveNow = saveNow;
function makeThumb() {
  const c = document.createElement('canvas');
  const sc = 220 / Math.max(St.p.width, St.p.height);
  c.width = Math.round(St.p.width * sc); c.height = Math.round(St.p.height * sc);
  E.renderFrame(c.getContext('2d'), St.C, Math.min(1, St.C.duration / 2), { scale: sc, media, els: elsView, noFx: true });
  return c.toDataURL('image/jpeg', 0.7);
}

// ---------- Indicateur de chargement ----------
let busyCancel = null;
App.busy = (text, progress = null, onCancel = null) => {
  const el = $('#busy');
  if (!text) { el.hidden = true; busyCancel = null; return; }
  el.hidden = false;
  $('#busyText').textContent = text;
  $('#busyBar').parentElement.hidden = progress == null;
  $('#busyBar').style.width = Math.round((progress || 0) * 100) + '%';
  busyCancel = onCancel;
  $('#busyCancel').hidden = !onCancel;
};
$('#busyCancel').addEventListener('click', () => busyCancel && busyCancel());

// ---------- Médias ----------
async function attachMedia(rec) {
  if (media.has(rec.id)) return media.get(rec.id);
  const m = { url: URL.createObjectURL(rec.blob), kind: rec.kind, name: rec.name, blob: rec.blob, el: null };
  if (rec.kind === 'image') { m.el = new Image(); m.el.src = m.url; try { await m.el.decode(); } catch {} }
  if (rec.kind === 'font') { try { const ff = new FontFace(rec.name, await rec.blob.arrayBuffer()); await ff.load(); document.fonts.add(ff); E.clearTextCache(); } catch {} }
  if (rec.kind === 'audio' || rec.kind === 'video') computePeaks(rec.id, rec.blob).then(() => buildTimeline());
  media.set(rec.id, m);
  St.dirty = true;
  return m;
}
App.attachMedia = attachMedia;
App.mediaUrl = (id) => media.get(id)?.url;

function probeMedia(url, kind) {
  return new Promise((res) => {
    if (kind === 'image') { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight, thumbs: [{ t: 0, u: url }] }); im.onerror = () => res({ error: true }); im.src = url; return; }
    const el = document.createElement(kind === 'video' ? 'video' : 'audio');
    el.muted = true; el.preload = 'auto'; el.playsInline = true; el.setAttribute('playsinline', '');
    const fail = setTimeout(() => res({ dur: el.duration || 0 }), 15000);
    el.onerror = () => { clearTimeout(fail); res({ error: true }); };
    el.onloadedmetadata = async () => {
      if (kind !== 'video') { clearTimeout(fail); res({ dur: el.duration }); return; }
      // Vignettes de la piste (pellicule).
      const thumbs = [];
      const N = Math.min(12, Math.max(2, Math.ceil(el.duration / 1.5)));
      const c = document.createElement('canvas');
      const k = 90 / Math.max(el.videoWidth, el.videoHeight);
      c.width = Math.max(8, Math.round(el.videoWidth * k)); c.height = Math.max(8, Math.round(el.videoHeight * k));
      const g = c.getContext('2d');
      for (let i = 0; i < N; i++) {
        const t = Math.min(el.duration - 0.05, (el.duration * (i + 0.5)) / N);
        await new Promise((r) => { const to = setTimeout(r, 2500); el.onseeked = () => { clearTimeout(to); r(); }; el.currentTime = Math.max(0, t); });
        try { g.drawImage(el, 0, 0, c.width, c.height); thumbs.push({ t, u: c.toDataURL('image/jpeg', 0.6) }); } catch {}
      }
      clearTimeout(fail);
      res({ w: el.videoWidth, h: el.videoHeight, dur: el.duration, thumbs });
      el.removeAttribute('src'); el.load();
    };
    el.src = url;
  });
}

function kindOf(f) {
  if (/\.(ttf|otf|woff2?)$/i.test(f.name)) return 'font';
  if (f.type.startsWith('image/') || /\.svg$/i.test(f.name)) return 'image';
  if (f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name)) return 'video';
  if (f.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|flac|opus)$/i.test(f.name)) return 'audio';
  return null;
}
// Importe des fichiers dans la médiathèque. dest : null | 'main' | 'overlay' | 'audio'
App.importFiles = async (files, dest = null) => {
  const added = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const kind = kindOf(f);
    if (!kind) { toast(`Format non pris en charge : ${f.name}`, 3000, 'err'); continue; }
    App.busy(`Import de ${f.name} (${i + 1}/${files.length})…`);
    try {
      const id = M.uid();
      const name = f.name.replace(/\.[^.]+$/, '').replace(/["']/g, '').slice(0, 40) || kind;
      const blob = /\.svg$/i.test(f.name) ? new Blob([await f.arrayBuffer()], { type: 'image/svg+xml' }) : f;
      await DB.saveMedia({ id, kind, name, blob });
      const m = await attachMedia({ id, kind, name, blob });
      if (kind === 'font') { (St.p.fonts ||= []).push({ id, name }); toast(`Police « ${name} » importée`); continue; }
      const info = await probeMedia(m.url, kind);
      if (info.error) { toast(`${f.name} : fichier illisible par ce navigateur`, 3500, 'err'); continue; }
      const entry = { id, kind, name, w: info.w || 0, h: info.h || 0, dur: info.dur && isFinite(info.dur) ? info.dur : 0, thumbs: info.thumbs || [] };
      St.p.media.push(entry);
      added.push(entry);
    } catch (e) { console.error(e); toast(`Échec de l'import de ${f.name} : ${e.message}`, 4000, 'err'); }
  }
  App.busy(null);
  let after = null;
  for (const m of added) {
    if (dest === 'main' || (dest == null && St.autoAdd && m.kind !== 'audio')) { const c = App.addToMain(m, false, after); after = c?.id || after; }
    else if (dest === 'overlay') App.addOverlay(m, false);
    else if (dest === 'audio' || (dest == null && St.autoAdd && m.kind === 'audio')) App.addAudio(m, false);
  }
  if (added.length) App.change(`${added.length} fichier${added.length > 1 ? 's' : ''} importé${added.length > 1 ? 's' : ''}`);
  return added;
};

// ---------- Opérations d'édition ----------
function mainIndexAt(t) {
  const lay = M.mainLayout(St.p).items;
  return lay.findIndex((x) => t >= x.start && t < x.end);
}
App.addToMain = (m, doCommit = true, afterId = null) => {
  if (m.kind === 'audio') return App.addAudio(m, doCommit);
  const c = M.newClip(St.p, m);
  // Insère après le clip indiqué, sinon après le clip sous la tête de lecture, sinon à la fin.
  const ai = afterId ? St.p.main.findIndex((x) => x.id === afterId) : -1;
  const i = ai >= 0 ? ai : mainIndexAt(St.t);
  St.p.main.splice(i < 0 ? St.p.main.length : i + 1, 0, c);
  St.sel = { kind: 'clip', id: c.id };
  const lay = M.mainLayout(St.p).items.find((x) => x.c.id === c.id);
  if (doCommit) { App.change('Clip ajouté'); App.setTime(lay.start); }
  return c;
};
// Trouve (ou crée) une piste du type voulu, libre sur l'intervalle.
function freeTrack(type, start, dur, exclude = null) {
  for (const tr of St.p.tracks) {
    if (tr.type !== type) continue;
    if (!tr.items.some((it) => it !== exclude && it.start < start + dur - 1e-3 && it.start + it.dur > start + 1e-3)) return tr;
  }
  const names = { text: 'Texte', overlay: 'Incrustation', audio: 'Audio', caption: 'Sous-titres' };
  const tr = { id: M.uid(), type, name: names[type], items: [] };
  if (type === 'audio') St.p.tracks.unshift(tr); else St.p.tracks.push(tr);
  return tr;
}
App.freeTrack = freeTrack;
App.addItem = (type, it, label) => {
  freeTrack(type, it.start, it.dur).items.push(it);
  St.sel = { kind: 'item', id: it.id };
  App.change(label);
};
App.addOverlay = (m, doCommit = true) => {
  const it = M.newOverlay(St.p, m, St.t);
  if (doCommit) App.addItem('overlay', it, 'Incrustation ajoutée');
  else { freeTrack('overlay', it.start, it.dur).items.push(it); St.sel = { kind: 'item', id: it.id }; }
};
App.addAudio = (m, doCommit = true) => {
  const it = M.newAudioItem(m, St.t);
  if (doCommit) App.addItem('audio', it, 'Audio ajouté');
  else { freeTrack('audio', it.start, it.dur).items.push(it); St.sel = { kind: 'item', id: it.id }; }
};

function splitKf(kf, at) {
  const a = {}, b = {};
  for (const n in kf) {
    const ka = kf[n].filter((q) => q.t <= at + 1e-4), kb = kf[n].filter((q) => q.t >= at - 1e-4).map((q) => ({ ...q, t: E.roundT(q.t - at) }));
    if (ka.length) a[n] = ka;
    if (kb.length) b[n] = kb;
  }
  return [a, b];
}
App.split = () => {
  const s = selInfo();
  let target = s && (s.kind === 'clip' || s.kind === 'item') ? s : null;
  if (!target) { const i = mainIndexAt(St.t); if (i >= 0) { St.sel = { kind: 'clip', id: St.p.main[i].id }; target = selInfo(); } }
  if (!target) { toast('Sélectionnez un élément sous la tête de lecture'); return; }
  const o = target.obj;
  const at = St.t - target.start;
  if (at < 0.05 || at > o.dur - 0.05) { toast('Placez la tête de lecture à l\'intérieur de l\'élément'); return; }
  const b = JSON.parse(JSON.stringify(o));
  b.id = M.uid();
  const [ka, kb] = splitKf(o.kf || {}, at);
  o.kf = ka; b.kf = kb;
  b.dur = o.dur - at;
  o.dur = at;
  if ('trim' in o) b.trim = (o.trim || 0) + at * (o.speed || 1);
  if (target.kind === 'clip') {
    b.transition = o.transition; o.transition = null;
    b.anim = { ...b.anim, in: null }; o.anim = { ...o.anim, out: null };
    St.p.main.splice(target.index + 1, 0, b);
  } else {
    b.start = o.start + at;
    if (b.type === 'text') { b.anim = { ...b.anim, in: null }; o.anim = { ...o.anim, out: null }; }
    target.track.items.push(b);
  }
  St.sel = { kind: target.kind, id: b.id };
  App.change('Coupé');
};
App.remove = () => {
  const s = selInfo();
  if (!s) return;
  if (s.kind === 'clip') St.p.main.splice(s.index, 1);
  else if (s.kind === 'trans') { s.obj.transition = null; St.sel = { kind: 'clip', id: s.obj.id }; App.change('Transition retirée'); return; }
  else { s.track.items = s.track.items.filter((x) => x !== s.obj); if (!s.track.items.length) St.p.tracks = St.p.tracks.filter((t) => t !== s.track); }
  St.sel = null;
  App.change('Supprimé');
};
App.duplicate = () => {
  const s = selInfo();
  if (!s || s.kind === 'trans') return;
  const b = JSON.parse(JSON.stringify(s.obj));
  b.id = M.uid();
  if (s.kind === 'clip') St.p.main.splice(s.index + 1, 0, b);
  else { b.start = s.end; freeTrack(s.track.type, b.start, b.dur).items.push(b); }
  St.sel = { kind: s.kind, id: b.id };
  App.change('Dupliqué');
};
App.replaceMedia = (m) => {
  const s = selInfo();
  if (!s || !('mediaId' in s.obj)) return;
  const o = s.obj;
  if ((o.type === 'audio') !== (m.kind === 'audio')) { toast('Type de média incompatible', 2500, 'err'); return; }
  o.mediaId = m.id; o.kind = m.kind === 'audio' ? o.kind : m.kind; o.name = m.name; o.trim = 0;
  o.srcDur = m.kind === 'image' ? 0 : m.dur;
  if (m.kind !== 'image' && m.dur) o.dur = Math.min(o.dur, m.dur / (o.speed || 1));
  App.change('Média remplacé');
};
App.select = (sel) => {
  St.sel = sel;
  buildTimeline();
  renderPanels();
  updateTools();
  St.dirty = true;
};

// Valeur animable d'un clip / élément (keyframes en temps local).
App.setProp = (info, name, v) => {
  const o = info.obj;
  if (o.kf?.[name]?.length) E.setKey(o, name, localT(info), v);
  else o.props[name] = v;
};

// ---------- Voix off ----------
App.recordVoice = async () => {
  if (St.recording) { St.recording.stop(); return; }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { toast('Enregistrement audio non pris en charge par ce navigateur', 3500, 'err'); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch { toast('Accès au micro refusé. Autorisez-le dans les réglages du navigateur.', 4000, 'err'); return; }
  const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
  const chunks = [];
  const t0 = St.t;
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop());
    St.recording = null;
    document.body.classList.remove('rec');
    setPlaying(false);
    const blob = new Blob(chunks, { type: (mime || 'audio/webm').split(';')[0] });
    const n = St.p.media.filter((m) => m.name.startsWith('Voix off')).length + 1;
    const file = new File([blob], `Voix off ${n}.${blob.type.includes('mp4') ? 'm4a' : 'webm'}`, { type: blob.type });
    const [m] = await App.importFiles([file], null);
    if (m) { const it = M.newAudioItem(m, t0); it.name = m.name; App.addItem('audio', it, 'Voix off ajoutée'); }
  };
  St.recording = rec;
  rec.start(200);
  document.body.classList.add('rec');
  toast('Enregistrement… touchez « Arrêter » pour terminer', 2500);
  setPlaying(true);
  updateTools();
};

// ---------- Barre d'outils contextuelle ----------
const T = (id, label, icon) => `<button class="tool" data-tool="${id}">${icon}<span>${label}</span></button>`;
const I = {
  media: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M10 9l5 3-5 3z" class="f"/></svg>',
  audio: '<svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  text: '<svg viewBox="0 0 24 24"><path d="M5 6V4h14v2M12 4v16M9 20h6"/></svg>',
  sticker: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>',
  cc: '<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M10 10.5a2.5 2.5 0 1 0 0 3M17 10.5a2.5 2.5 0 1 0 0 3"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/></svg>',
  ratio: '<svg viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 8h8v8H8z"/></svg>',
  bg: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15l6-6 12 12"/></svg>',
  overlay: '<svg viewBox="0 0 24 24"><rect x="2" y="3" width="14" height="12" rx="2"/><rect x="8" y="9" width="14" height="12" rx="2"/></svg>',
  split: '<svg viewBox="0 0 24 24"><path d="M12 3v18"/><path d="m8 7-4 5 4 5M16 7l4 5-4 5"/></svg>',
  speed: '<svg viewBox="0 0 24 24"><path d="M12 14l4-6"/><path d="M3.3 17a9 9 0 1 1 17.4 0"/></svg>',
  vol: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>',
  anim: '<svg viewBox="0 0 24 24"><path d="m12 3 3 6 6 1-4.5 4.5L18 21l-6-3-6 3 1.5-6.5L3 10l6-1z"/></svg>',
  filter: '<svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="6"/><circle cx="15" cy="15" r="6"/></svg>',
  adjust: '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>',
  fx: '<svg viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M5 9 2 12l3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/></svg>',
  dup: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>',
  del: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/></svg>',
  replace: '<svg viewBox="0 0 24 24"><path d="M4 7h13l-3-3M20 17H7l3 3"/></svg>',
  trans: '<svg viewBox="0 0 24 24"><path d="M3 5h8v14H3zM13 5h8v14h-8z"/><path d="m9 12 6 0"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
  style: '<svg viewBox="0 0 24 24"><path d="M4 20 10 4h1l6 16M6.5 14h8"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" class="f"/></svg>',
};
App.icons = I;
function updateTools() {
  const s = selInfo();
  let html = '';
  if (St.recording) html = T('stopRec', 'Arrêter', I.stop);
  else if (!s) html = [T('add', 'Médias', I.media), T('audio', 'Audio', I.audio), T('text', 'Texte', I.text), T('sticker', 'Stickers', I.sticker), T('overlayAdd', 'Incrustation', I.overlay), T('captions', 'Sous-titres', I.cc), T('voice', 'Voix off', I.mic), T('format', 'Format', I.ratio), T('bgp', 'Arrière-plan', I.bg)].join('');
  else if (s.kind === 'trans') html = T('deselect', 'Retour', I.back) + T('p:trans', 'Transition', I.trans) + T('del', 'Retirer', I.del);
  else if (s.obj.type === 'audio') html = [T('deselect', 'Retour', I.back), T('split', 'Diviser', I.split), T('p:audio', 'Volume', I.vol), T('p:speed', 'Vitesse', I.speed), T('replace', 'Remplacer', I.replace), T('dup', 'Dupliquer', I.dup), T('del', 'Supprimer', I.del)].join('');
  else if (s.obj.type === 'text') html = [T('deselect', 'Retour', I.back), T('p:text', 'Texte', I.text), T('p:tstyle', 'Style', I.style), T('p:anim', 'Animations', I.anim), T('p:edit', 'Position', I.edit), T('split', 'Diviser', I.split), T('dup', 'Dupliquer', I.dup), T('del', 'Supprimer', I.del)].join('');
  else {
    const isVid = s.obj.kind === 'video';
    html = [T('deselect', 'Retour', I.back), T('split', 'Diviser', I.split), T('p:edit', 'Cadrage', I.edit), isVid ? T('p:speed', 'Vitesse', I.speed) : '', isVid ? T('p:audio', 'Volume', I.vol) : '', T('p:anim', 'Animations', I.anim), T('p:filters', 'Filtres', I.filter), T('p:adjust', 'Ajuster', I.adjust), T('p:effects', 'Effets', I.fx), s.kind === 'clip' && s.index < St.p.main.length - 1 ? T('p:trans', 'Transition', I.trans) : '', T('replace', 'Remplacer', I.replace), T('dup', 'Dupliquer', I.dup), T('del', 'Supprimer', I.del)].join('');
  }
  $('#tools').innerHTML = html;
}
App.updateTools = updateTools;

function toolAction(id) {
  const s = selInfo();
  if (id.startsWith('p:')) { const tab = id.slice(2); if (tab === 'trans' && s?.kind === 'clip') St.sel = { kind: 'trans', id: s.obj.id }; App.openPanel(tab); updateTools(); buildTimeline(); return; }
  switch (id) {
    case 'add': return App.openLib('media');
    case 'audio': return App.openLib('audio');
    case 'text': return App.openLib('text');
    case 'sticker': return App.openLib('stickers');
    case 'captions': return App.openLib('captions');
    case 'overlayAdd': return App.openLib('media', 'overlay');
    case 'voice': return App.recordVoice();
    case 'stopRec': return St.recording?.stop();
    case 'format': return openFormat();
    case 'bgp': return App.openPanel('project');
    case 'deselect': return App.select(null);
    case 'split': return App.split();
    case 'dup': return App.duplicate();
    case 'del': return App.remove();
    case 'replace': St.replacing = true; toast('Choisissez le nouveau média dans la médiathèque', 2500); return App.openLib(s?.obj.type === 'audio' ? 'audio' : 'media');
  }
}

// ---------- Interaction sur l'aperçu ----------
function setupStage() {
  const pts = new Map();
  let g = null;
  const toComp = (e) => { const r = stage.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * St.p.width, y: ((e.clientY - r.top) / r.height) * St.p.height }; };
  const startMove = (info, q) => ({ type: 'move', info, q0: q, x0: E.getProp(info.obj, 'x', localT(info)), y0: E.getProp(info.obj, 'y', localT(info)), changed: false });
  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId);
    const q = toComp(e);
    pts.set(e.pointerId, q);
    if (St.playing) setPlaying(false);
    if (pts.size === 1) {
      const hit = E.hitTest(St.C, St.t, q.x, q.y);
      if (hit) {
        const isClip = St.p.main.some((c) => c.id === hit.id);
        if (!St.sel || St.sel.id !== hit.id) App.select({ kind: isClip ? 'clip' : 'item', id: hit.id });
        const info = selInfo();
        g = info && info.obj.props ? startMove(info, q) : null;
      } else { const info = selInfo(); g = info && info.obj.props && St.t >= info.start && St.t < info.end ? startMove(info, q) : null; }
    } else if (pts.size === 2) {
      const info = selInfo();
      if (!info || !info.obj.props) return;
      const [a, b] = [...pts.values()];
      g = { type: 'pinch', info, d0: Math.hypot(b.x - a.x, b.y - a.y), a0: Math.atan2(b.y - a.y, b.x - a.x), s0: E.getProp(info.obj, 'scale', localT(info)), r0: E.getProp(info.obj, 'rotation', localT(info)), changed: false };
    }
  });
  stage.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    const q = toComp(e);
    pts.set(e.pointerId, q);
    if (!g) return;
    if (g.type === 'move' && pts.size === 1) {
      let x = g.x0 + q.x - g.q0.x, y = g.y0 + q.y - g.q0.y;
      const snap = 14 / (St.cssScale || 1);
      const gv = Math.abs(x - St.p.width / 2) < snap, gh = Math.abs(y - St.p.height / 2) < snap;
      if (gv) x = St.p.width / 2;
      if (gh) y = St.p.height / 2;
      St.guides = gv || gh ? { v: gv, h: gh } : null;
      App.setProp(g.info, 'x', Math.round(x));
      App.setProp(g.info, 'y', Math.round(y));
      g.changed = true;
    } else if (g.type === 'pinch' && pts.size === 2) {
      const [a, b] = [...pts.values()];
      App.setProp(g.info, 'scale', Math.max(1, Math.round(g.s0 * (Math.hypot(b.x - a.x, b.y - a.y) / g.d0) * 10) / 10));
      let r = g.r0 + ((Math.atan2(b.y - a.y, b.x - a.x) - g.a0) * 180) / Math.PI;
      if (Math.abs(r - Math.round(r / 90) * 90) < 4) r = Math.round(r / 90) * 90;
      App.setProp(g.info, 'rotation', Math.round(r * 10) / 10);
      g.changed = true;
    }
    if (g.changed) { recompile(); }
  });
  const end = (e) => {
    pts.delete(e.pointerId);
    if (pts.size === 0) { if (g?.changed) { commit(); refreshValues(); } g = null; St.guides = null; St.dirty = true; }
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  stage.addEventListener('wheel', (e) => {
    const info = selInfo();
    if (!info?.obj.props || !e.ctrlKey) return;
    e.preventDefault();
    App.setProp(info, 'scale', Math.max(1, E.getProp(info.obj, 'scale', localT(info)) * (e.deltaY < 0 ? 1.04 : 0.96)));
    recompile();
    clearTimeout(stage._wt);
    stage._wt = setTimeout(() => { commit(); refreshValues(); }, 300);
  }, { passive: false });
}

// ---------- Projets ----------
async function openProject(p, isNew = false) {
  if (St.playing) setPlaying(false);
  St.p = p;
  p.media ||= []; p.main ||= []; p.tracks ||= []; p.fonts ||= [];
  St.sel = null; St.t = 0;
  for (const el of els.values()) el.pause();
  els.clear();
  App.busy('Chargement du projet…');
  try {
    const ids = new Set([...p.media.map((m) => m.id), ...p.fonts.map((f) => f.id)]);
    await Promise.all([...ids].map(async (id) => { if (media.has(id)) return; const rec = await DB.getMedia(id); if (rec) await attachMedia(rec); }));
  } finally { App.busy(null); }
  recompile();
  St.hist = [JSON.stringify(p)]; St.hidx = 0; updateUndo();
  $('#projName').textContent = p.name;
  fitStage();
  fitTimeline();
  buildTimeline();
  renderPanels();
  updateTools();
  updateTime();
  if (isNew) await saveNow();
  localStorage.setItem('mt.last', p.id);
}
App.openProject = openProject;
App.rename = (n) => { St.p.name = n; $('#projName').textContent = n; commit(); };

// ---------- Mise en page ----------
const mq = matchMedia('(min-width: 900px) and (min-height: 540px)');
function applyLayout() {
  St.desktop = mq.matches;
  document.body.classList.toggle('desktop', St.desktop);
  renderPanels();
  requestAnimationFrame(() => { fitStage(); buildTimeline(); });
}

function setupSplitter() {
  const root = document.documentElement;
  const v = +localStorage.getItem('mt.tlh');
  if (v > 0) root.style.setProperty('--tlh', v + 'px');
  const el = $('#hsplit');
  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId);
    const mv = (ev) => {
      const h = Math.max(110, Math.min(innerHeight * 0.7, innerHeight - ev.clientY - ($('#tools').offsetHeight || 0) - (St.desktop ? 0 : 0)));
      root.style.setProperty('--tlh', h + 'px');
      try { localStorage.setItem('mt.tlh', Math.round(h)); } catch {}
      fitStage();
    };
    el.addEventListener('pointermove', mv);
    el.addEventListener('pointerup', () => { el.removeEventListener('pointermove', mv); buildTimeline(); }, { once: true });
  });
}

function setupKeys() {
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input:not([type=range]):not([type=checkbox]),textarea,select') || !$('#sheet').hidden) { if (e.key === 'Escape') App.closeSheet?.(); return; }
    const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase(), f = 1 / St.p.fps;
    let h = true;
    if (e.code === 'Space') setPlaying(!St.playing);
    else if (mod && k === 'z') (e.shiftKey ? App.redo : App.undo)();
    else if (mod && k === 'y') App.redo();
    else if (mod && k === 'd') App.duplicate();
    else if (mod && k === 'e') openExport();
    else if (mod && k === 's') { saveNow(); toast('Projet enregistré'); }
    else if (k === 's' || k === 'b') App.split();
    else if (k === 'delete' || k === 'backspace') App.remove();
    else if (k === 'arrowright') setTime(St.t + (e.shiftKey ? 10 * f : f));
    else if (k === 'arrowleft') setTime(St.t - (e.shiftKey ? 10 * f : f));
    else if (k === 'home') setTime(0);
    else if (k === 'end') setTime(St.C.duration);
    else if (k === 'escape') App.select(null);
    else if (k === '+' || k === '=') { St.pps = Math.min(400, St.pps * 1.3); buildTimeline(); }
    else if (k === '-') { St.pps = Math.max(4, St.pps / 1.3); buildTimeline(); }
    else h = false;
    if (h) e.preventDefault();
  });
}

async function init() {
  initTimeline();
  initPanels();
  setupStage();
  setupSplitter();
  setupKeys();
  mq.addEventListener('change', applyLayout);
  $('#tools').addEventListener('click', (e) => { const b = e.target.closest('[data-tool]'); if (b) toolAction(b.dataset.tool); });
  $('#btnPlay').addEventListener('click', () => { St.stopAt = null; setPlaying(!St.playing); });
  $('#btnStart').addEventListener('click', () => { setPlaying(false); setTime(0); });
  $('#btnPrev').addEventListener('click', () => { setPlaying(false); setTime(St.t - 1 / St.p.fps); });
  $('#btnNext').addEventListener('click', () => { setPlaying(false); setTime(St.t + 1 / St.p.fps); });
  $('#btnUndo').addEventListener('click', App.undo);
  $('#btnRedo').addEventListener('click', App.redo);
  $('#btnProjects').addEventListener('click', openProjects);
  $('#projTitle').addEventListener('click', () => { const n = prompt('Nom du projet', St.p.name); if (n) App.rename(n.trim()); });
  $('#btnExport').addEventListener('click', openExport);
  $('#qual').addEventListener('change', (e) => { St.q = e.target.value; localStorage.setItem('mt.q', St.q); fitStage(); });
  $('#fxPrev').addEventListener('change', (e) => { St.fxPreview = e.target.checked; localStorage.setItem('mt.fx', St.fxPreview ? '1' : '0'); St.dirty = true; });
  St.q = localStorage.getItem('mt.q') || 'auto';
  St.fxPreview = localStorage.getItem('mt.fx') !== '0';
  $('#qual').value = St.q;
  $('#fxPrev').checked = St.fxPreview;
  new ResizeObserver(() => fitStage()).observe($('#viewer'));
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (St.playing && !St.exporting) setPlaying(false); saveNow(); } });
  document.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); document.body.classList.add('dropping'); } });
  document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('dropping'); });
  document.addEventListener('drop', (e) => { document.body.classList.remove('dropping'); if (e.dataTransfer?.files?.length) { e.preventDefault(); App.importFiles([...e.dataTransfer.files], 'main'); } });
  window.addEventListener('error', (e) => toast('Erreur : ' + (e.message || 'inconnue'), 4000, 'err'));
  window.addEventListener('unhandledrejection', (e) => { if (e.reason?.name !== 'AbortError') toast('Erreur : ' + (e.reason?.message || e.reason), 4000, 'err'); });
  applyLayout();
  let p = null;
  try { const last = localStorage.getItem('mt.last'); if (last) p = await DB.getProject(last); } catch {}
  await openProject(p || M.newMontage('9x16', 'Mon premier montage'), !p);
  requestAnimationFrame(tick);
  if (!p) setTimeout(() => toast('Bienvenue ! Importez vos vidéos avec « Médias » pour commencer le montage.', 4000), 400);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => {});
}

init();
