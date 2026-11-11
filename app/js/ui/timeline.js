// Timeline multicalque + éditeur de courbes (graph editor).
import * as E from '../engine.js';
import { S, A, $, $$, esc, P, selLayer, layerById, toast, ICON, TYPE_LETTER, fmtNum } from '../state.js';
import { getPeaksCached } from '../audio.js';

const nameW = () => (S.desktop ? 180 : 128);
const frame = () => 1 / P().fps;

function tickStep(pps) {
  for (const s of [1 / 30, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60]) if (s * pps >= 56) return s;
  return 120;
}
export function fitTimeline() {
  const pane = $('.pane[data-pane=timeline]');
  const w = (pane?.clientWidth || 360) - nameW() - 30;
  S.pps = E.clamp(w / P().duration, 4, 600);
}

const depthOf = (L) => { let d = 0, q = L; while (q?.parent && d < 10) { q = layerById(q.parent); d++; } return d; };
const hiddenByGroup = (L) => { let q = L.parent && layerById(L.parent); while (q) { if (q.type === 'null' && !q.open) return true; q = q.parent && layerById(q.parent); } return false; };
const animatedPaths = (L) => Object.keys(L.kf).filter((k) => L.kf[k]?.length);
const hasKids = (L) => P().layers.some((l) => l.parent === L.id);

// ---------- Construction ----------
export function buildTimeline() {
  const pane = $('.pane[data-pane=timeline]');
  if (!pane || !P()) return;
  pane.style.setProperty('--namew', nameW() + 'px');
  const tools = `<div class="tl-tools">
    <div class="seg mini" id="tlMode"><button data-mode="layers" class="${S.tlMode === 'layers' ? 'on' : ''}">${ICON.layers}<span>Calques</span></button><button data-mode="graph" class="${S.tlMode === 'graph' ? 'on' : ''}">${ICON.graph}<span>Courbes</span></button></div>
    <span class="tsep"></span>
    <button class="chip ic" data-tl="split" title="Couper à la tête de lecture (S)">${ICON.cut}</button>
    <button class="chip ic" data-tl="dup" title="Dupliquer (Ctrl+D)">${ICON.dup}</button>
    <button class="chip ic" data-tl="del" title="Supprimer (Suppr)">${ICON.del}</button>
    <button class="chip ic ${S.multiMode ? 'on' : ''}" data-tl="multi" title="Sélection multiple">${ICON.select}</button>
    <button class="chip ic" data-tl="group" title="Grouper (Ctrl+G)">${ICON.group}</button>
    <button class="chip ic ${S.snap ? 'on' : ''}" data-tl="snap" title="Magnétisme">${ICON.magnet}</button>
    <div class="grow"></div>
    <button class="chip" data-tl="zoomOut" title="Dézoomer">−</button>
    <button class="chip" data-tl="fit" title="Tout afficher">⟷</button>
    <button class="chip" data-tl="zoomIn" title="Zoomer">+</button>
  </div>`;
  if (S.tlMode === 'graph') { pane.innerHTML = tools + buildGraphShell(); drawGraph(); return; }
  const p = P();
  const keep = $('#tlScroll') ? [$('#tlScroll').scrollLeft, $('#tlScroll').scrollTop] : null;
  const NW = nameW();
  const width = NW + p.duration * S.pps + 60;
  const step = tickStep(S.pps);
  const minor = step / 5;
  let ruler = '';
  const nTicks = Math.min(4000, Math.floor(p.duration / minor) + 1);
  for (let i = 0; i < nTicks; i++) {
    const t = i * minor, x = t * S.pps, maj = i % 5 === 0;
    ruler += `<i class="${maj ? 'maj' : ''}" style="left:${x}px"></i>`;
    if (maj) ruler += `<b style="left:${x}px">${step < 1 ? (step < 0.1 ? Math.round(t * p.fps) + 'i' : t.toFixed(step < 0.5 ? 2 : 1) + 's') : Math.round(t) + 's'}</b>`;
  }
  const rows = [];
  for (const L of p.layers) {
    if (hiddenByGroup(L)) continue;
    const paths = animatedPaths(L);
    const canOpen = paths.length || (L.type === 'null' && hasKids(L));
    const kfs = E.keyTimes(L).map((t) => `<b class="kf ${Math.abs(t - S.t) < 0.0015 ? 'at' : ''}" data-t="${t}" style="left:${(t - L.start) * S.pps}px"></b>`).join('');
    const isSel = L.id === S.sel, isMulti = S.multi.has(L.id);
    const parent = L.parent && layerById(L.parent);
    rows.push(`<div class="tl-row ${isSel ? 'sel' : ''} ${isMulti ? 'multi' : ''} ${L.visible ? '' : 'hid'}" data-id="${L.id}">
      <div class="tl-name" style="padding-left:${2 + depthOf(L) * 12}px">
        <button class="tw ${L.open ? 'open' : ''} ${canOpen ? '' : 'none'}" data-act="twirl" aria-label="Déplier">▸</button>
        <button class="eye ${L.visible ? '' : 'off'}" data-act="eye" aria-label="Visibilité">${L.visible ? ICON.eye : ICON.eyeOff}</button>
        <span class="tl-ty ty-${L.type}">${TYPE_LETTER[L.type]}</span>
        <span class="nm" title="${esc(L.name)}${parent ? ' · lié à ' + esc(parent.name) : ''}">${parent ? '<i class="lnk">↳</i>' : ''}${esc(L.name)}</span>
        <button class="lk ${L.locked ? 'on' : ''}" data-act="lock" aria-label="Verrouiller">${L.locked ? ICON.lock : ICON.unlock}</button>
      </div>
      <div class="tl-track"><div class="tl-bar ty-${L.type}" data-id="${L.id}" style="left:${L.start * S.pps}px;width:${Math.max(4, (L.end - L.start) * S.pps)}px">
        ${L.type === 'audio' || L.type === 'video' ? '<canvas class="wave"></canvas>' : ''}
        <i class="h l" data-act="trimL"></i><span class="lbl">${esc(L.name)}</span>${kfs}<i class="h r" data-act="trimR"></i>
      </div></div>
    </div>`);
    if (L.open) for (const path of paths) {
      const keys = L.kf[path].map((q) => `<b class="kf sk ${S.selKey && S.selKey.id === L.id && S.selKey.path === path && Math.abs(S.selKey.t - q.t) < 0.0015 ? 'selk' : ''} ${Math.abs(q.t - S.t) < 0.0015 ? 'at' : ''} e-${q.e}" data-t="${q.t}" data-path="${path}" style="left:${q.t * S.pps}px"></b>`).join('');
      rows.push(`<div class="tl-row sub ${S.graphPath === path && isSel ? 'gsel' : ''}" data-id="${L.id}" data-path="${path}">
        <div class="tl-name sub" style="padding-left:${26 + depthOf(L) * 12}px"><span class="nm">${esc(E.propLabel(L, path))}</span><span class="val">${valStr(L, path)}</span><button class="kfb anim ${E.hasKeyAt(L, path, S.t) ? 'at' : ''}" data-act="subkf" aria-label="Keyframe"></button></div>
        <div class="tl-track abs">${keys}</div>
      </div>`);
    }
  }
  pane.innerHTML = tools + `<div class="tl-scroll" id="tlScroll"><div class="tl-content" style="width:${width}px">
      <div class="tl-rrow"><div class="tl-corner">${p.layers.length} calque${p.layers.length > 1 ? 's' : ''}</div><div class="tl-ruler" id="tlRuler">${ruler}</div></div>
      ${rows.join('') || '<div class="tl-empty">Aucun calque. Ouvrez <b>Ajouter</b> ou <b>Médias</b> pour commencer.</div>'}
      <div class="tl-playhead" id="tlPlayhead" style="left:${NW + S.t * S.pps}px"></div>
    </div></div>`;
  if (keep) { $('#tlScroll').scrollLeft = keep[0]; $('#tlScroll').scrollTop = keep[1]; }
  drawWaves();
}
function valStr(L, path) {
  const v = E.getProp(L, path, S.t);
  return typeof v === 'number' ? fmtNum(v) : `<i class="sw3" style="background:${esc(v)}"></i>`;
}

function drawWaves() {
  for (const cv of $$('.tl-bar canvas.wave')) {
    const L = layerById(cv.parentElement.dataset.id);
    const pk = L && getPeaksCached(L.style.mediaId);
    if (!pk || !pk.data) continue;
    const w = Math.min(4000, cv.parentElement.clientWidth), h = cv.parentElement.clientHeight;
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    c.fillStyle = L.type === 'audio' ? 'rgba(10,10,20,0.55)' : 'rgba(10,10,20,0.35)';
    const sp = L.style.speed || 1;
    for (let x = 0; x < w; x++) {
      const lt = (L.style.trim || 0) + (x / S.pps) * sp;
      const i = Math.floor((lt / pk.duration) * pk.data.length);
      if (i < 0 || i >= pk.data.length) continue;
      const a = pk.data[i] * h * 0.42 * ((L.style.volume ?? 100) / 100);
      c.fillRect(x, h / 2 - a, 1, Math.max(1, a * 2));
    }
  }
}

export function updatePlayhead() {
  const ph = $('#tlPlayhead');
  if (ph) {
    const x = nameW() + S.t * S.pps;
    ph.style.left = x + 'px';
    const sc = $('#tlScroll');
    if (S.playing && sc && (x > sc.scrollLeft + sc.clientWidth - 30 || x < sc.scrollLeft + nameW())) sc.scrollLeft = x - nameW() - 20;
    $$('.tl-bar .kf, .tl-track .kf').forEach((k) => k.classList.toggle('at', Math.abs(+k.dataset.t - S.t) < 0.0015));
    if (!S.playing) for (const r of $$('.tl-row.sub')) {
      const L = layerById(r.dataset.id);
      if (!L) continue;
      const v = r.querySelector('.val');
      if (v) v.innerHTML = valStr(L, r.dataset.path);
      r.querySelector('.kfb')?.classList.toggle('at', E.hasKeyAt(L, r.dataset.path, S.t));
    }
  }
  if (S.tlMode === 'graph') drawGraph();
}

// ---------- Interactions ----------
export function initTimeline() {
  const pane = $('.pane[data-pane=timeline]');
  pane.addEventListener('click', (e) => {
    const m = e.target.closest('[data-mode]');
    if (m) { S.tlMode = m.dataset.mode; if (S.tlMode === 'graph') pickGraphPath(); buildTimeline(); return; }
    const b = e.target.closest('[data-tl]');
    if (b) return toolAction(b.dataset.tl);
    const g = e.target.closest('[data-gpath]');
    if (g) { S.graphPath = g.dataset.gpath; S.gview = null; buildTimeline(); return; }
    const gm = e.target.closest('[data-gmode]');
    if (gm) { S.graphMode = gm.dataset.gmode; S.gview = null; buildTimeline(); return; }
    const ge = e.target.closest('[data-gease]');
    if (ge) return applyGraphEase(ge.dataset.gease);
    if (e.target.closest('[data-gfit]')) { S.gview = null; drawGraph(); }
  });
  pane.addEventListener('dblclick', (e) => {
    const nm = e.target.closest('.tl-row:not(.sub) .nm');
    if (!nm) return;
    const L = layerById(nm.closest('.tl-row').dataset.id);
    rename(nm, L);
  });
  pane.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey) || S.tlMode !== 'layers') return;
    e.preventDefault();
    S.pps = E.clamp(S.pps * (e.deltaY < 0 ? 1.15 : 0.87), 4, 600);
    buildTimeline();
  }, { passive: false });

  let drag = null;
  let lastNameTap = 0;
  pane.addEventListener('pointerdown', (e) => {
    const t = e.target;
    if (S.tlMode === 'graph') { if (t.closest('#graphCv')) graphDown(e); return; }
    if (t.closest('.tl-ruler')) {
      drag = { type: 'scrub' };
      pane.setPointerCapture(e.pointerId);
      if (S.playing) A.setPlaying(false);
      scrub(e);
      return;
    }
    const act = t.closest('[data-act]')?.dataset.act;
    const row = t.closest('.tl-row');
    if (!row) return;
    const L = layerById(row.dataset.id);
    if (!L) return;
    if (act === 'eye') { L.visible = !L.visible; buildTimeline(); A.commit(); A.requestRender(); return; }
    if (act === 'lock') { L.locked = !L.locked; buildTimeline(); A.commit(); return; }
    if (act === 'twirl') { L.open = !L.open; buildTimeline(); return; }
    if (act === 'subkf') {
      const path = row.dataset.path;
      if (E.hasKeyAt(L, path, S.t)) E.removeKey(L, path, S.t); else E.setKey(L, path, S.t, E.getProp(L, path, S.t));
      buildTimeline(); A.refreshInspector(); A.commit(); A.requestRender();
      return;
    }
    if (t.closest('.tl-name')) {
      const now = Date.now();
      if (row.dataset.path) { S.graphPath = row.dataset.path; if (S.sel !== L.id) A.select(L.id); else buildTimeline(); return; }
      // Double appui sur mobile = renommer.
      if (!S.desktop && now - lastNameTap < 350 && S.sel === L.id && t.closest('.nm')) { rename(t.closest('.nm'), L); return; }
      lastNameTap = now;
      A.select(L.id, { add: e.shiftKey || e.metaKey || e.ctrlKey });
      return;
    }
    const kf = t.closest('.kf');
    if (row.classList.contains('sub')) {
      if (!kf) return;
      const path = kf.dataset.path, kt = +kf.dataset.t;
      if (S.sel !== L.id) A.select(L.id);
      S.selKey = { id: L.id, path, t: kt };
      S.graphPath = path;
      drag = { type: 'subkf', L, path, kt, x0: e.clientX, moved: false, el: kf };
      pane.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    const bar = t.closest('.tl-bar');
    if (!bar) { A.select(L.id, { add: e.shiftKey || e.metaKey || e.ctrlKey }); return; }
    if (!S.multi.has(L.id) || S.multi.size <= 1 || e.shiftKey || e.metaKey || e.ctrlKey) A.select(L.id, { add: e.shiftKey || e.metaKey || e.ctrlKey });
    if (L.locked) { toast('Calque verrouillé'); return; }
    const mode = kf ? 'kf' : act === 'trimL' ? 'trimL' : act === 'trimR' ? 'trimR' : 'move';
    const group = mode === 'move' && S.multi.size > 1 ? [...S.multi].map(layerById).filter((x) => x && !x.locked && x.id !== L.id).map((x) => ({ L: x, start: x.start, end: x.end })) : [];
    drag = { type: mode, L, x0: e.clientX, start: L.start, end: L.end, kt: kf ? +kf.dataset.t : 0, moved: false, snapshot: JSON.stringify(L.kf), trim: L.style.trim || 0, group };
    pane.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  const scrub = (e) => {
    const r = $('#tlRuler').getBoundingClientRect();
    A.setTime((e.clientX - r.left) / S.pps);
  };
  // Points d'accroche : tête de lecture, bords des calques, keyframes.
  const snapPoints = (exclude) => {
    const pts = [S.t, 0, P().duration];
    for (const l of P().layers) if (!exclude.has(l.id)) pts.push(l.start, l.end);
    return pts;
  };
  const snapTo = (v, exclude) => {
    v = Math.round(v * P().fps) / P().fps;
    if (!S.snap) return E.roundT(v);
    let best = null, bd = 9 / S.pps;
    for (const q of snapPoints(exclude)) { const d = Math.abs(q - v); if (d < bd) { bd = d; best = q; } }
    return E.roundT(best ?? v);
  };
  pane.addEventListener('pointermove', (e) => {
    if (S.tlMode === 'graph') { graphMove(e); return; }
    if (!drag) return;
    if (drag.type === 'scrub') { scrub(e); return; }
    const p = P();
    const dt = (e.clientX - drag.x0) / S.pps;
    if (Math.abs(e.clientX - drag.x0) > 3) drag.moved = true;
    if (!drag.moved) return;
    const L = drag.L;
    const ex = new Set([L.id, ...(drag.group || []).map((g) => g.L.id)]);
    if (drag.type === 'subkf') {
      const nt = E.clamp(snapTo(drag.kt + dt, new Set()), 0, p.duration);
      const k = L.kf[drag.path];
      const key = k.find((q) => Math.abs(q.t - (drag.cur ?? drag.kt)) < 0.0015);
      if (!key) return;
      if (k.some((q) => q !== key && Math.abs(q.t - nt) < 0.0015)) return;
      key.t = nt; k.sort((a, b) => a.t - b.t);
      drag.cur = nt;
      drag.el.style.left = nt * S.pps + 'px';
      S.selKey = { id: L.id, path: drag.path, t: nt };
      A.requestRender();
      return;
    }
    if (drag.type === 'move') {
      const len = drag.end - drag.start;
      let ns = snapTo(drag.start + dt, ex);
      const ne = snapTo(drag.start + dt + len, ex);
      if (Math.abs(ne - (drag.start + dt + len)) < Math.abs(ns - (drag.start + dt))) ns = ne - len;
      ns = E.clamp(ns, -len + frame(), p.duration - frame());
      const shift = ns - L.start;
      L.start = E.roundT(ns); L.end = E.roundT(ns + len);
      E.shiftKeys(L, shift);
      for (const g of drag.group) { g.L.start = E.roundT(g.L.start + shift); g.L.end = E.roundT(g.L.end + shift); E.shiftKeys(g.L, shift); }
    } else if (drag.type === 'trimL') {
      const ns = E.clamp(snapTo(drag.start + dt, ex), -600, L.end - frame());
      if ((L.type === 'video' || L.type === 'audio')) {
        const nt = drag.trim + (ns - drag.start) * (L.style.speed || 1);
        if (nt < 0) return;
        L.style.trim = Math.round(nt * 1000) / 1000;
      }
      L.start = ns;
    } else if (drag.type === 'trimR') {
      L.end = E.clamp(snapTo(drag.end + dt, ex), L.start + frame(), p.duration + 600);
    } else if (drag.type === 'kf') {
      const nt = snapTo(drag.kt + dt, ex);
      L.kf = JSON.parse(drag.snapshot);
      for (const n in L.kf) {
        const k = L.kf[n];
        const hit = k.find((q) => Math.abs(q.t - drag.kt) < 0.0015);
        if (hit) { L.kf[n] = k.filter((q) => q === hit || Math.abs(q.t - nt) > 0.0015); hit.t = nt; L.kf[n].sort((a, b) => a.t - b.t); }
      }
      drag.nt = nt;
    }
    for (const x of [L, ...(drag.group || []).map((g) => g.L)]) {
      const bar = $(`.tl-bar[data-id="${x.id}"]`);
      if (!bar) continue;
      bar.style.left = x.start * S.pps + 'px';
      bar.style.width = Math.max(4, (x.end - x.start) * S.pps) + 'px';
      $$('.kf', bar).forEach((k) => k.remove());
      bar.insertAdjacentHTML('beforeend', E.keyTimes(x).map((t) => `<b class="kf" data-t="${t}" style="left:${(t - x.start) * S.pps}px"></b>`).join(''));
    }
    A.requestRender();
  });
  const end = (e) => {
    if (S.tlMode === 'graph') { graphUp(e); return; }
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.type === 'scrub') return;
    if (!d.moved) {
      if (d.type === 'kf') A.setTime(d.kt);
      if (d.type === 'subkf') { A.setTime(d.kt); buildTimeline(); }
      return;
    }
    if (d.type === 'kf' && d.nt !== undefined) A.setTime(d.nt);
    if (d.type === 'subkf' && d.cur !== undefined) A.setTime(d.cur);
    buildTimeline();
    A.commit();
    A.refreshInspector();
  };
  pane.addEventListener('pointerup', end);
  pane.addEventListener('pointercancel', end);
}

function rename(nm, L) {
  const inp = document.createElement('input');
  inp.type = 'text'; inp.value = L.name; inp.className = 'rn';
  nm.replaceWith(inp);
  inp.focus(); inp.select();
  let done = false;
  const fin = (ok) => { if (done) return; done = true; if (ok && inp.value.trim()) { L.name = inp.value.trim(); L._named = true; A.commit(); } buildTimeline(); A.refreshInspector(); };
  inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') fin(true); if (ev.key === 'Escape') fin(false); ev.stopPropagation(); });
  inp.addEventListener('blur', () => fin(true));
}

function toolAction(a) {
  const p = P();
  const sc = $('#tlScroll');
  const center = sc ? (sc.scrollLeft + sc.clientWidth / 2 - nameW()) / S.pps : 0;
  const ids = [...S.multi];
  const L = selLayer();
  switch (a) {
    case 'zoomIn': S.pps = Math.min(600, S.pps * 1.5); break;
    case 'zoomOut': S.pps = Math.max(4, S.pps / 1.5); break;
    case 'fit': fitTimeline(); break;
    case 'split': if (L) A.splitLayer(L); else toast('Sélectionnez un calque'); return;
    case 'dup': if (ids.length) A.duplicateLayers(ids); else toast('Sélectionnez un calque'); return;
    case 'del': if (ids.length) A.deleteLayers(ids); else toast('Sélectionnez un calque'); return;
    case 'multi': S.multiMode = !S.multiMode; toast(S.multiMode ? 'Sélection multiple : touchez plusieurs calques' : 'Sélection simple', 1600); break;
    case 'group': if (L?.type === 'null' && ids.length <= 1) A.ungroup(L); else if (ids.length) A.groupLayers(ids); else toast('Sélectionnez des calques à grouper'); return;
    case 'snap': S.snap = !S.snap; toast(S.snap ? 'Magnétisme activé' : 'Magnétisme désactivé', 1200); break;
  }
  buildTimeline();
  const sc2 = $('#tlScroll');
  if (sc2 && (a === 'zoomIn' || a === 'zoomOut')) sc2.scrollLeft = center * S.pps + nameW() - sc2.clientWidth / 2;
  void p;
}

// ---------- Éditeur de courbes ----------
function pickGraphPath() {
  const L = selLayer();
  if (!L) return;
  const paths = animatedPaths(L).filter((k) => typeof L.kf[k][0].v === 'number');
  if (!paths.includes(S.graphPath)) S.graphPath = paths[0] || null;
}

function buildGraphShell() {
  const L = selLayer();
  pickGraphPath();
  if (!L) return '<div class="tl-empty">Sélectionnez un calque animé pour afficher ses courbes.</div>';
  const paths = animatedPaths(L).filter((k) => typeof L.kf[k][0].v === 'number');
  if (!paths.length) return `<div class="tl-empty">« ${esc(L.name)} » n'a pas de propriété numérique animée.<br>Ajoutez des keyframes (bouton ◆) dans Propriétés.</div>`;
  return `<div class="g-head">
      <div class="g-props">${paths.map((k) => `<button class="chip ${k === S.graphPath ? 'on' : ''}" data-gpath="${k}">${esc(E.propLabel(L, k))}</button>`).join('')}</div>
      <div class="g-tools">
        <div class="seg mini"><button data-gmode="value" class="${S.graphMode === 'value' ? 'on' : ''}">Valeur</button><button data-gmode="speed" class="${S.graphMode === 'speed' ? 'on' : ''}">Vitesse</button></div>
        <button class="chip" data-gease="linear" title="Linéaire">Linéaire</button>
        <button class="chip" data-gease="in" title="Ease In : arrivée douce">Ease In</button>
        <button class="chip" data-gease="out" title="Ease Out : départ doux">Ease Out</button>
        <button class="chip" data-gease="inOut" title="Ease In-Out">In-Out</button>
        <button class="chip" data-gease="hold" title="Maintien">Maintien</button>
        <button class="chip" data-gfit>Ajuster</button>
      </div>
    </div>
    <div class="g-wrap"><canvas id="graphCv"></canvas><div class="g-hint" id="graphHint"></div></div>`;
}

function graphView(cv, L, path) {
  if (S.gview && S.gview.path === path && S.gview.mode === S.graphMode) return S.gview;
  const p = P();
  const k = L.kf[path];
  const t0 = Math.max(0, Math.min(k[0].t, L.start) - 0.2), t1 = Math.min(p.duration, Math.max(k[k.length - 1].t, Math.min(L.end, p.duration)) + 0.2);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i <= 200; i++) {
    const t = t0 + ((t1 - t0) * i) / 200;
    const v = S.graphMode === 'speed' ? speedAt(L, path, t) : E.getProp(L, path, t);
    lo = Math.min(lo, v); hi = Math.max(hi, v);
  }
  if (S.graphMode === 'value') for (let i = 0; i < k.length - 1; i++) {
    const bz = segBez(k[i]);
    if (!bz) continue;
    const dv = k[i + 1].v - k[i].v;
    lo = Math.min(lo, k[i].v + bz[1] * dv, k[i].v + bz[3] * dv); hi = Math.max(hi, k[i].v + bz[1] * dv, k[i].v + bz[3] * dv);
  }
  if (hi - lo < 1e-6) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.12;
  S.gview = { path, mode: S.graphMode, t0, t1, lo: lo - pad, hi: hi + pad };
  return S.gview;
}
const segBez = (a) => (a.e === 'bezier' && a.b ? a.b : E.BEZ_OF[a.e] || null);
function speedAt(L, path, t) { const h = 1 / 240; return (E.getProp(L, path, t + h) - E.getProp(L, path, t - h)) / (2 * h); }

let G = null; // géométrie du dernier dessin
export function drawGraph() {
  const cv = $('#graphCv');
  const L = selLayer();
  if (!cv || !L || !S.graphPath || !L.kf[S.graphPath]) return;
  const path = S.graphPath;
  const k = L.kf[path];
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = cv.clientHeight;
  if (!W || !H) return;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, W, H);
  const v = graphView(cv, L, path);
  const padL = 52, padR = 14, padT = 22, padB = 14;
  const X = (t) => padL + ((t - v.t0) / (v.t1 - v.t0)) * (W - padL - padR);
  const Y = (val) => padT + (1 - (val - v.lo) / (v.hi - v.lo)) * (H - padT - padB);
  const T = (x) => v.t0 + ((x - padL) / (W - padL - padR)) * (v.t1 - v.t0);
  const V = (y) => v.lo + (1 - (y - padT) / (H - padT - padB)) * (v.hi - v.lo);
  G = { X, Y, T, V, L, path, padT, W, H, handles: [], keys: [] };
  // Grille
  c.font = '10px system-ui';
  c.fillStyle = '#8a8aa6';
  c.strokeStyle = '#ffffff12';
  c.lineWidth = 1;
  const st = tickStep((W - padL - padR) / (v.t1 - v.t0));
  for (let t = Math.ceil(v.t0 / st) * st; t <= v.t1; t += st) { c.beginPath(); c.moveTo(X(t), padT); c.lineTo(X(t), H - padB); c.stroke(); c.fillText(st < 1 ? t.toFixed(2) : t.toFixed(0) + 's', X(t) + 3, 12); }
  for (let i = 0; i <= 4; i++) { const val = v.lo + ((v.hi - v.lo) * i) / 4; c.beginPath(); c.moveTo(padL, Y(val)); c.lineTo(W - padR, Y(val)); c.stroke(); c.fillText(fmtNum(val), 4, Y(val) + 3); }
  // Plage du calque
  c.fillStyle = '#8b7bff10';
  c.fillRect(X(L.start), padT, X(L.end) - X(L.start), H - padT - padB);
  // Courbe
  c.strokeStyle = S.graphMode === 'speed' ? '#22d3ee' : '#c4b5fd';
  c.lineWidth = 2;
  c.beginPath();
  const n = Math.max(100, Math.round(W));
  for (let i = 0; i <= n; i++) {
    const t = v.t0 + ((v.t1 - v.t0) * i) / n;
    const val = S.graphMode === 'speed' ? speedAt(L, path, t) : E.getProp(L, path, t);
    i ? c.lineTo(X(t), Y(val)) : c.moveTo(X(t), Y(val));
  }
  c.stroke();
  // Poignées Bézier (mode valeur)
  const sel = S.selKey && S.selKey.id === L.id && S.selKey.path === path ? S.selKey.t : null;
  if (S.graphMode === 'value') {
    for (let i = 0; i < k.length - 1; i++) {
      const a = k[i], b = k[i + 1];
      const bz = segBez(a);
      const near = sel == null || Math.abs(a.t - sel) < 0.0015 || Math.abs(b.t - sel) < 0.0015 || k.length <= 4;
      if (!bz || !near) continue;
      const dt = b.t - a.t, dv = b.v - a.v;
      const h1 = [X(a.t + bz[0] * dt), Y(a.v + bz[1] * dv)], h2 = [X(a.t + bz[2] * dt), Y(a.v + bz[3] * dv)];
      c.strokeStyle = '#ffcc4d99'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(X(a.t), Y(a.v)); c.lineTo(...h1); c.moveTo(X(b.t), Y(b.v)); c.lineTo(...h2); c.stroke();
      c.fillStyle = '#ffcc4d';
      for (const h of [h1, h2]) { c.beginPath(); c.arc(h[0], h[1], 5, 0, Math.PI * 2); c.fill(); }
      G.handles.push({ i, which: 1, x: h1[0], y: h1[1] }, { i, which: 2, x: h2[0], y: h2[1] });
    }
  }
  // Keyframes
  k.forEach((q, i) => {
    const x = X(q.t), y = Y(S.graphMode === 'speed' ? speedAt(L, path, q.t) : q.v);
    const on = sel != null && Math.abs(q.t - sel) < 0.0015;
    c.fillStyle = on ? '#fff' : '#ffcc4d';
    c.strokeStyle = '#0b0b10'; c.lineWidth = 1.5;
    c.beginPath(); c.rect(x - 5, y - 5, 10, 10); c.fill(); c.stroke();
    G.keys.push({ i, x, y });
  });
  // Tête de lecture
  c.strokeStyle = '#ff4f8b'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(X(S.t), 0); c.lineTo(X(S.t), H); c.stroke();
  const hint = $('#graphHint');
  if (hint) hint.textContent = S.graphMode === 'speed'
    ? 'Courbe de vitesse (unités / s) — affichage. Modifiez les courbes en mode Valeur.'
    : 'Glissez les keyframes (carrés) ou les poignées Bézier (ronds). Bande du haut : déplacer la tête de lecture.';
}

let gd = null;
function graphDown(e) {
  if (!G) return;
  const cv = $('#graphCv');
  const r = cv.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  cv.setPointerCapture(e.pointerId);
  const L = G.L, k = L.kf[G.path];
  if (y < G.padT) { gd = { type: 'scrub' }; A.setTime(G.T(x)); return; }
  const h = G.handles.find((q) => Math.hypot(q.x - x, q.y - y) < 12);
  if (h && S.graphMode === 'value') { gd = { type: 'handle', h, moved: false }; return; }
  const kk = G.keys.find((q) => Math.hypot(q.x - x, q.y - y) < 12);
  if (kk) {
    S.selKey = { id: L.id, path: G.path, t: k[kk.i].t };
    gd = { type: 'key', i: kk.i, moved: false, x0: x, y0: y };
    drawGraph();
    return;
  }
  S.selKey = null;
  gd = null;
  drawGraph();
}
function graphMove(e) {
  if (!gd || !G) return;
  const cv = $('#graphCv');
  const r = cv.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  const L = G.L, k = L.kf[G.path];
  if (gd.type === 'scrub') { A.setTime(G.T(x)); return; }
  if (gd.type === 'key' && S.graphMode === 'value') {
    if (!gd.moved && Math.hypot(x - gd.x0, y - gd.y0) < 3) return;
    gd.moved = true;
    const q = k[gd.i];
    const fps = P().fps;
    let nt = Math.round(G.T(x) * fps) / fps;
    const lo = gd.i > 0 ? k[gd.i - 1].t + 1 / fps : 0, hi = gd.i < k.length - 1 ? k[gd.i + 1].t - 1 / fps : P().duration;
    nt = E.roundT(E.clamp(nt, lo, hi));
    q.t = nt;
    q.v = Math.round(G.V(y) * 100) / 100;
    S.selKey = { id: L.id, path: G.path, t: nt };
  } else if (gd.type === 'handle') {
    gd.moved = true;
    const a = k[gd.h.i], b = k[gd.h.i + 1];
    const bz = (segBez(a) || [0.333, 0.333, 0.667, 0.667]).slice();
    const dt = b.t - a.t, dv = b.v - a.v;
    const nx = E.clamp((G.T(x) - a.t) / dt, 0, 1);
    const ny = Math.abs(dv) > 1e-9 ? E.clamp((G.V(y) - a.v) / dv, -3, 4) : bz[gd.h.which === 1 ? 1 : 3];
    if (gd.h.which === 1) { bz[0] = nx; bz[1] = ny; } else { bz[2] = nx; bz[3] = ny; }
    a.e = 'bezier';
    a.b = bz.map((q) => Math.round(q * 1000) / 1000);
  }
  A.requestRender();
  drawGraph();
}
function graphUp() {
  if (gd && gd.moved) { A.commit(); A.refreshInspector(); }
  gd = null;
}

// Courbes rapides appliquées à la keyframe sélectionnée (ou à celles sous la tête de lecture).
function applyGraphEase(kind) {
  const L = selLayer();
  if (!L) return;
  const targets = [];
  if (S.selKey && S.selKey.id === L.id) targets.push([S.selKey.path, S.selKey.t]);
  else for (const n of Object.keys(L.kf)) if (E.hasKeyAt(L, n, S.t)) targets.push([n, S.t]);
  if (!targets.length) { toast('Sélectionnez une keyframe (ou placez la tête de lecture dessus)'); return; }
  for (const [path, t] of targets) {
    const k = L.kf[path];
    const i = k.findIndex((q) => Math.abs(q.t - t) < 0.0015);
    if (i < 0) continue;
    const cur = k[i], prev = k[i - 1];
    const toBez = (q) => { if (q.e !== 'bezier' || !q.b) { q.b = (E.BEZ_OF[q.e] || [0.333, 0.333, 0.667, 0.667]).slice(); q.e = 'bezier'; } return q.b; };
    if (kind === 'hold') { cur.e = 'hold'; delete cur.b; continue; }
    if (kind === 'linear') { cur.e = 'linear'; delete cur.b; if (prev && prev.e === 'bezier') { prev.b[2] = 0.667; prev.b[3] = 0.667; } continue; }
    if ((kind === 'out' || kind === 'inOut') && i < k.length - 1) { const b = toBez(cur); b[0] = 0.5; b[1] = 0; }
    if ((kind === 'in' || kind === 'inOut') && prev) { const b = toBez(prev); b[2] = 0.5; b[3] = 1; }
  }
  S.gview = null;
  A.commit('Courbe appliquée');
  buildTimeline();
  A.requestRender();
}
