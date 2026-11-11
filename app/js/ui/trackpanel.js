// Panneau Suivi : suivi de mouvement (1 ou 2 points), suivi de texte, suivi de caméra 2D, stabilisation.
import * as E from '../engine.js';
import * as T from '../tracking.js';
import { TRANSITIONS } from '../presets.js';
import { S, A, $, esc, P, selLayer, layerById, toast, fmtT, ICON, numRow, switchRow } from '../state.js';

const pane = () => $('.pane[data-pane=track]');
const activeTrack = () => (S.track.id && P().tracks.find((t) => t.id === S.track.id)) || null;
const KIND = { point: 'Suivi de mouvement · 1 point', two: 'Suivi de mouvement · 2 points', camera: 'Suivi de caméra 2D' };
let running = null;

export function buildTrack(light = false) {
  const el = pane();
  if (!el) return;
  if (light && running) return;
  if (light) { // mise à jour légère quand la tête de lecture bouge
    const tr = activeTrack();
    const info = $('#trkFrameInfo');
    if (tr && info) info.innerHTML = frameInfo(tr);
    return;
  }
  const p = P();
  let L = selLayer();
  let tr = activeTrack();
  if (tr && (!L || L.id !== tr.layerId)) { if (L?.type === 'video') { S.track.id = null; tr = null; } else L = layerById(tr.layerId); }
  const list = p.tracks.length ? `<div class="trlist">${p.tracks.map((x) => { const src = layerById(x.layerId); return `<button class="trk ${x.id === S.track.id ? 'on' : ''}" data-trk="${x.id}"><b>${esc(x.name)}</b><small>${src ? esc(src.name) : 'source supprimée'} · ${Object.keys(x.data).length} images</small></button>`; }).join('')}</div>` : '';
  if (!L || L.type !== 'video') {
    el.innerHTML = `<div class="empty"><b>Sélectionnez un calque vidéo</b>Le suivi analyse le mouvement réel de la vidéo, image par image, pour y attacher textes, images ou formes.</div>${list ? `<div class="sect pad"><h4>Suivis du projet</h4>${list}</div>` : ''}`;
    return;
  }
  const head = `<div class="sect pad"><div class="hint">Source : <b>${esc(L.name)}</b></div>
    <h4>Nouveau suivi</h4>
    <div class="grid">
      <button class="tile" data-new="point">${ICON.target}Mouvement<small>1 point · position</small></button>
      <button class="tile" data-new="two">${ICON.target}Mouvement<small>2 points · rotation, échelle</small></button>
      <button class="tile" data-new="text">${ICON.text}Suivi de texte<small>un titre qui suit un sujet</small></button>
      <button class="tile" data-new="camera">${ICON.video}Caméra 2D<small>mouvement de la scène</small></button>
    </div>
    <div class="row"><label>Texte à suivre</label><input type="text" id="trkText" value="${esc(S.trkText || 'Mon titre')}"></div>
    ${list ? `<h4>Suivis de ce projet</h4>${list}` : ''}</div>`;
  el.innerHTML = head + (tr ? trackHtml(tr, L) : '');
}

function frameInfo(tr) {
  const f = Math.round(S.t * tr.fps);
  const d = tr.data[f];
  if (tr.kind === 'camera') return d ? `Image ${f} : ${d.n} points fiables` : `Image ${f} : non analysée`;
  if (!d) return `Image ${f} : aucun point. ${S.track.placing ? `<b>Touchez l'aperçu pour placer le point ${(tr.kind === 'two' ? 2 : 1) - S.track.placing + 1}.</b>` : ''}`;
  return `Image ${f} : ` + d.map((q, i) => `point ${i + 1} confiance <b class="${q[2] > 0.8 ? 'ok' : q[2] > 0.55 ? 'mid' : 'bad'}">${Math.round(q[2] * 100)} %</b>`).join(' · ');
}

function trackHtml(tr, L) {
  const p = P();
  const frames = T.trackFrames(tr);
  const range = frames.length ? `${fmtT(frames[0] / tr.fps)} → ${fmtT(frames[frames.length - 1] / tr.fps)} (${frames.length} images)` : 'pas encore analysé';
  const targets = p.layers.filter((x) => x.id !== L.id && E.VISUAL(x) && x.type !== 'solid' && x.type !== 'adjust' || x.type === 'null');
  const isCam = tr.kind === 'camera';
  const ctrl = isCam ? `
    <div class="row"><label>Précision</label><select id="trkPrec"><option value="360">Rapide</option><option value="480" selected>Normale</option><option value="720">Fine (plus lent)</option></select></div>
    <button class="btn pri block" data-tact="analyze">Analyser le mouvement de la caméra</button>
    <div class="hint">Estimation 2D du mouvement global de la scène (translation, rotation, zoom) à partir de points caractéristiques suivis image par image, avec rejet des points aberrants (RANSAC). Ce n'est pas une reconstruction 3D de la caméra : la perspective et la parallaxe ne sont pas modélisées.</div>`
    : `
    <div class="hint" id="trkFrameInfo">${frameInfo(tr)}</div>
    <div class="row"><button class="btn" data-tact="place" style="flex:1">${ICON.target} Replacer ${tr.kind === 'two' ? 'les points' : 'le point'} ici</button></div>
    ${numRow('trk.r', 'Taille du motif', 4, 60, 1, tr.r)}
    ${numRow('trk.s', 'Zone de recherche', 6, 120, 1, tr.s)}
    ${switchRow('trk.snap', 'Aimanter sur le détail le plus net', S.trackSnap !== false)}
    <div class="row trkbtns">
      <button class="btn" data-tact="back">${ICON.back} Suivre en arrière</button>
      <button class="btn pri" data-tact="fwd">Suivre ${ICON.play}</button>
    </div>
    <button class="btn block" data-tact="clearAfter">Effacer le suivi après la tête de lecture</button>
    <div class="hint">Glissez un point dans l'aperçu pour le corriger à l'image courante, puis relancez le suivi depuis cette image.</div>`;
  return `<div class="sect pad trbox">
    <div class="trtitle"><b>${KIND[tr.kind]}</b><input type="text" id="trkName" value="${esc(tr.name)}"></div>
    <div class="hint">${range}</div>
    ${ctrl}
    <h4>Utiliser le suivi</h4>
    <div class="row"><label>Calque cible</label><select id="trkTarget">${targets.map((x) => `<option value="${x.id}" ${S.trkTarget === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('') || '<option value="">(aucun calque)</option>'}</select></div>
    <div class="row chk">
      <label><input type="checkbox" id="trkPos" checked disabled> Position</label>
      <label><input type="checkbox" id="trkRot" ${tr.kind === 'point' ? 'disabled' : 'checked'}> Rotation</label>
      <label><input type="checkbox" id="trkSc" ${tr.kind === 'point' ? 'disabled' : 'checked'}> Échelle</label>
    </div>
    <button class="btn pri block" data-tact="apply" ${frames.length > 1 && targets.length ? '' : 'disabled'}>Attacher le calque au suivi</button>
    <button class="btn block" data-tact="text" ${frames.length > 1 ? '' : 'disabled'}>${ICON.text} Créer un texte qui suit</button>
    <h4>Stabilisation</h4>
    ${numRow('trk.zoom', 'Zoom de compensation %', 100, 160, 1, S.stabZoom || 110)}
    <div class="row chk"><label><input type="checkbox" id="trkFull" ${tr.kind === 'point' ? 'disabled' : 'checked'}> Compenser aussi rotation / zoom</label></div>
    <button class="btn block" data-tact="stab" ${frames.length > 1 ? '' : 'disabled'}>Stabiliser la vidéo source</button>
    <button class="btn block danger" data-tact="delete">Supprimer ce suivi</button>
  </div>`;
}

function trackVideoSize(L) {
  const el = A.els.get(L.id);
  return [el?.videoWidth || P().media.find((m) => m.id === L.style.mediaId)?.w || L.style.w, el?.videoHeight || P().media.find((m) => m.id === L.style.mediaId)?.h || L.style.h];
}

async function newTrack(kind) {
  const L = selLayer();
  if (!L || L.type !== 'video') return;
  if (!A.mediaUrl(L.style.mediaId)) { toast('Vidéo absente de cet appareil', 3000, 'err'); return; }
  if (!E.isActive(L, S.t)) A.setTime(Math.max(L.start, Math.min(S.t, L.end - 0.05)));
  const [vw, vh] = trackVideoSize(L);
  const tr = T.newTrack(kind === 'text' ? 'point' : kind, L, P().fps, vw, vh);
  const big = Math.max(vw, vh);
  tr.r = Math.round(big * 0.025); tr.s = Math.round(big * 0.045);
  if (kind === 'text') { tr.name = 'Suivi de texte'; S.track.textFollow = true; S.trkText = $('#trkText')?.value || 'Mon titre'; }
  else S.track.textFollow = false;
  P().tracks.push(tr);
  S.track.id = tr.id;
  S.track.placing = kind === 'camera' ? 0 : kind === 'two' ? 2 : 1;
  A.commit();
  buildTrack();
  A.requestRender();
  if (kind === 'camera') toast('Lancez « Analyser le mouvement de la caméra »');
  else toast(kind === 'two' ? 'Touchez l\'aperçu pour placer 2 points sur des détails contrastés de l\'objet' : 'Touchez l\'aperçu sur un détail contrasté de l\'objet à suivre', 3500);
}

async function runTrack(dir) {
  const tr = activeTrack();
  const L = tr && layerById(tr.layerId);
  if (!tr || !L) return;
  const f = Math.round(S.t * tr.fps);
  if (!tr.data[f]) { toast('Aucun point à l\'image courante : placez-les ou placez la tête de lecture sur une image suivie', 3500, 'err'); return; }
  const ctrl = new AbortController();
  running = ctrl;
  A.busy('Suivi en cours…', 0, () => ctrl.abort());
  try {
    const r = await T.runPointTrack({
      p: P(), L, url: A.mediaUrl(L.style.mediaId), track: tr, fromT: S.t, dir, signal: ctrl.signal,
      onProgress: (q, ff, c) => { A.busy(`Suivi image ${ff} · confiance ${Math.round(c * 100)} %`, q, () => ctrl.abort()); if (ff % 8 === 0) { S.t = ff / tr.fps; A.requestRender(); } },
    });
    running = null;
    A.busy(null);
    A.commit();
    toast(`${r.frames} images suivies — ${r.reason}`, 4000, r.reason.startsWith('suivi perdu') ? 'err' : '');
    return r;
  } catch (e) {
    running = null;
    A.busy(null);
    toast('Échec du suivi : ' + e.message, 4500, 'err');
  } finally { A.setTime(S.t); buildTrack(); }
}

async function analyzeCamera() {
  const tr = activeTrack();
  const L = tr && layerById(tr.layerId);
  if (!tr || !L) return;
  const ctrl = new AbortController();
  running = ctrl;
  A.busy('Analyse du mouvement de la caméra…', 0, () => ctrl.abort());
  try {
    const r = await T.runCameraTrack({
      p: P(), L, url: A.mediaUrl(L.style.mediaId), track: tr, signal: ctrl.signal, maxDim: +($('#trkPrec')?.value || 480),
      onProgress: (q, f, n) => { A.busy(`Image ${f} · ${n} points fiables`, q, () => ctrl.abort()); if (f % 8 === 0) { S.t = f / tr.fps; A.requestRender(); } },
    });
    running = null;
    A.busy(null);
    A.commit();
    toast(`${r.frames} images analysées — ${r.reason}`, 4000);
  } catch (e) {
    running = null;
    A.busy(null);
    toast('Échec de l\'analyse : ' + e.message, 4500, 'err');
  } finally { A.setTime(S.t); buildTrack(); }
}

async function createFollowingText(tr, L) {
  const p = P();
  const frames = T.trackFrames(tr);
  const f0 = frames[0];
  const pt = tr.kind === 'camera' ? new DOMPoint(p.width / 2, p.height / 2) : T.trackPointComp(p, tr, L, f0, 0);
  const txt = E.newLayer(p, 'text', {
    style: { text: S.trkText || $('#trkText')?.value || 'Mon titre', size: Math.round(Math.min(p.width, p.height) * 0.07), weight: '800', bgOn: true, bg: '#7c3aed' },
    props: { x: pt.x, y: pt.y - Math.min(p.width, p.height) * 0.09 },
    start: frames[0] / tr.fps, end: frames[frames.length - 1] / tr.fps + 1 / tr.fps,
  });
  txt.fx.push(E.newEffect('shadow'));
  p.layers.unshift(txt);
  T.applyTrack(p, tr, L, txt, { rot: false, scale: false, ref: f0 });
  const d = Math.min(0.4, (txt.end - txt.start) / 3);
  TRANSITIONS.find((x) => x.id === 'zoom').fn(txt, 'in', d, p);
  TRANSITIONS.find((x) => x.id === 'fade').fn(txt, 'out', d, p);
  S.trkTarget = txt.id;
  A.select(txt.id);
  A.commit('Texte attaché au suivi');
  A.refreshVisible();
  A.preview(txt.start, txt.end);
}

async function action(a) {
  const tr = activeTrack();
  const L = tr && layerById(tr.layerId);
  const p = P();
  if (!tr || !L) return;
  switch (a) {
    case 'place': S.track.placing = tr.kind === 'two' ? 2 : 1; toast('Touchez l\'aperçu pour placer ' + (tr.kind === 'two' ? 'les 2 points' : 'le point')); buildTrack(); return;
    case 'fwd': case 'back': {
      const r = await runTrack(a === 'fwd' ? 1 : -1);
      if (r && S.track.textFollow && a === 'fwd' && T.trackFrames(tr).length > 1) { S.track.textFollow = false; await createFollowingText(tr, L); }
      return;
    }
    case 'analyze': return analyzeCamera();
    case 'clearAfter': {
      const f = Math.round(S.t * tr.fps);
      for (const k of Object.keys(tr.data)) if (+k > f) delete tr.data[k];
      A.commit('Suivi effacé après la tête de lecture'); buildTrack(); A.requestRender();
      return;
    }
    case 'apply': {
      const target = layerById($('#trkTarget').value);
      if (!target) return toast('Choisissez un calque cible');
      try {
        const n = T.applyTrack(p, tr, L, target, { rot: $('#trkRot').checked && !$('#trkRot').disabled, scale: $('#trkSc').checked && !$('#trkSc').disabled, ref: Math.round(S.t * tr.fps) });
        A.commit(`« ${target.name} » suit maintenant le mouvement (${n} keyframes)`);
        A.refreshVisible(); A.requestRender();
      } catch (e) { toast(e.message, 3500, 'err'); }
      return;
    }
    case 'text': return createFollowingText(tr, L);
    case 'stab': {
      try {
        const n = T.stabilize(p, tr, L, { zoom: S.stabZoom || 110, full: $('#trkFull').checked && !$('#trkFull').disabled });
        A.commit(`Vidéo stabilisée (${n} images)`);
        A.refreshVisible(); A.requestRender();
      } catch (e) { toast(e.message, 3500, 'err'); }
      return;
    }
    case 'delete':
      if (!confirm('Supprimer ce suivi ? Les keyframes déjà créées sont conservées.')) return;
      p.tracks = p.tracks.filter((x) => x.id !== tr.id);
      S.track.id = null;
      A.commit(); buildTrack(); A.requestRender();
  }
}

export function initTrackPanel() {
  const el = pane();
  el.addEventListener('click', (e) => {
    const n = e.target.closest('[data-new]');
    if (n) return newTrack(n.dataset.new);
    const t = e.target.closest('[data-trk]');
    if (t) {
      S.track.id = t.dataset.trk;
      const tr = activeTrack();
      S.track.placing = 0;
      if (tr && S.sel !== tr.layerId) A.select(tr.layerId); else buildTrack();
      A.requestRender();
      return;
    }
    const b = e.target.closest('[data-tact]');
    if (b) action(b.dataset.tact);
  });
  el.addEventListener('input', (e) => {
    const tr = activeTrack();
    if (e.target.id === 'trkText') { S.trkText = e.target.value; return; }
    if (e.target.id === 'trkName' && tr) { tr.name = e.target.value; return; }
    const row = e.target.closest('[data-k]');
    if (!row) return;
    const k = row.dataset.k;
    const v = e.target.type === 'checkbox' ? e.target.checked : parseFloat(e.target.value);
    if (e.target.type === 'range') { const nv = row.querySelector('.nv'); if (nv) nv.value = v; }
    if (e.target.type === 'number') { const r = row.querySelector('input[type=range]'); if (r) r.value = v; }
    if (k === 'trk.snap') S.trackSnap = v;
    else if (k === 'trk.zoom') S.stabZoom = v;
    else if (tr && (k === 'trk.r' || k === 'trk.s')) { tr[k.slice(4)] = v; A.requestRender(); }
  });
  el.addEventListener('change', (e) => {
    if (e.target.id === 'trkTarget') S.trkTarget = e.target.value;
    if (e.target.id === 'trkName' || e.target.closest('[data-k^="trk.r"],[data-k^="trk.s"]')) A.commit();
  });
  A.trackCancelPlacing = () => { S.track.placing = 0; buildTrack(); };
}

// ---------- Interaction sur l'aperçu ----------
function trackingActive() {
  const tr = activeTrack();
  if (!tr || !A.isVisible('track')) return null;
  const L = layerById(tr.layerId);
  if (!L || !E.isActive(L, S.t)) return null;
  return { tr, L };
}

export function trackOverlay(ctx, sc, dpr) {
  const a = trackingActive();
  if (!a) return;
  T.drawTrackOverlay(ctx, sc, dpr, P(), S.t, a.tr, a.L);
}

export function trackPointer(type, q) {
  const a = trackingActive();
  if (type !== 'down' && !S.track.drag) return false;
  if (type === 'up') {
    const d = S.track.drag;
    S.track.drag = null;
    if (d && d.moved) { A.commit('Point corrigé'); buildTrack(); }
    return true;
  }
  if (!a || a.tr.kind === 'camera') return false;
  const { tr, L } = a;
  const p = P();
  const f = Math.round(S.t * tr.fps);
  if (type === 'move') {
    T.setTrackPoint(p, tr, L, f, S.track.drag.i, q.x, q.y);
    S.track.drag.moved = true;
    A.requestRender();
    return true;
  }
  const n = tr.kind === 'two' ? 2 : 1;
  if (S.track.placing > 0) {
    const i = n - S.track.placing;
    if (!tr.data[f] || S.track.placing === n) tr.data[f] = [];
    T.setTrackPoint(p, tr, L, f, i, q.x, q.y);
    S.track.placing--;
    if (S.track.placing === 0) finishPlacing(tr, L, f);
    buildTrack();
    A.requestRender();
    return true;
  }
  for (let i = 0; i < n; i++) {
    const c = T.trackPointComp(p, tr, L, f, i);
    if (c && Math.hypot(c.x - q.x, c.y - q.y) * S.cssScale < 34) { S.track.drag = { i, moved: false }; return true; }
  }
  return false;
}

async function finishPlacing(tr, L, f) {
  if (S.trackSnap !== false) {
    try {
      const vt = T.videoTime(L, f / tr.fps);
      const snapped = await T.snapPoints(A.mediaUrl(L.style.mediaId), vt, tr.data[f].map((q) => [q[0], q[1]]), tr.r * 1.5);
      tr.data[f] = snapped.map(([x, y]) => [x, y, 1]);
    } catch (e) { console.warn(e); }
  }
  A.commit();
  buildTrack();
  A.requestRender();
  toast(S.track.textFollow ? 'Point placé. Touchez « Suivre ▶ » : le texte sera créé et attaché automatiquement.' : 'Point placé. Lancez « Suivre ▶ ».', 3500);
}
