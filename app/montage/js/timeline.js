// Timeline de montage : piste principale magnétique + pistes libres (texte, incrustation, sous-titres, audio).
import * as E from '../../js/engine.js';
import { getPeaksCached } from '../../js/audio.js';
import { $, $$, esc, toast } from '../../js/state.js';
import { St, App, selInfo } from './core.js';
import * as M from './model.js';

const headW = () => (St.desktop ? 92 : 46);
const TRACK_ICON = { text: 'T', caption: 'CC', overlay: '▣', audio: '♪' };
const fmtD = (d) => (d >= 60 ? `${Math.floor(d / 60)}:${String(Math.round(d % 60)).padStart(2, '0')}` : d.toFixed(1) + 's');

export function fitTimeline() {
  const w = ($('#timeline')?.clientWidth || 360) - headW() - 40;
  St.pps = E.clamp(w / Math.max(5, St.C.duration), 4, 300);
}

function tickStep(pps) { for (const s of [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60]) if (s * pps >= 60) return s; return 120; }

export function buildTimeline() {
  const el = $('#timeline');
  if (!el || !St.C) return;
  el.style.setProperty('--head', headW() + 'px');
  const keep = $('#mtScroll') ? [$('#mtScroll').scrollLeft, $('#mtScroll').scrollTop] : null;
  const p = St.p;
  const dur = St.C.duration;
  const width = headW() + (dur + 8) * St.pps;
  const step = tickStep(St.pps);
  let ruler = '';
  for (let i = 0, n = Math.min(3000, Math.ceil((dur + 8) / (step / 2))); i <= n; i++) {
    const t = (i * step) / 2, x = t * St.pps;
    ruler += `<i class="${i % 2 ? '' : 'maj'}" style="left:${x}px"></i>`;
    if (i % 2 === 0) ruler += `<b style="left:${x}px">${fmtD(t)}</b>`;
  }
  const sel = St.sel?.id;
  const above = p.tracks.filter((t) => t.type !== 'audio').slice().reverse();
  const below = p.tracks.filter((t) => t.type === 'audio');
  const rowFor = (tr) => `<div class="mt-row ${tr.type}" data-track="${tr.id}">
      <div class="mt-head"><span class="ti">${TRACK_ICON[tr.type]}</span><span class="tn">${esc(tr.name)}</span>
        <button class="tb ${tr.muted || tr.hidden ? 'off' : ''}" data-tact="${tr.type === 'audio' ? 'mute' : 'hide'}" title="${tr.type === 'audio' ? 'Couper le son' : 'Masquer'}">${tr.type === 'audio' ? (tr.muted ? '🔇' : '🔊') : tr.hidden ? '🙈' : '👁'}</button></div>
      <div class="mt-lane">${tr.items.map((it) => itemHtml(it, sel)).join('')}</div></div>`;
  const lay = M.mainLayout(p).items;
  const main = lay.map((x, i) => {
    const c = x.c;
    // Affichage bout à bout : une transition chevauchante est représentée à la jonction.
    const visEnd = i < lay.length - 1 ? lay[i + 1].start : x.end;
    const thumbs = thumbsFor(c, (visEnd - x.start) * St.pps);
    const tr = i < lay.length - 1 ? `<button class="tbtn ${c.transition ? 'on' : ''} ${St.sel?.kind === 'trans' && sel === c.id ? 'sel' : ''}" data-trans="${c.id}" style="left:${lay[i + 1].start * St.pps}px" title="Transition">${c.transition ? '⧓' : '+'}</button>` : '';
    return `<div class="clip main ${sel === c.id && St.sel.kind === 'clip' ? 'sel' : ''}" data-id="${c.id}" style="left:${x.start * St.pps}px;width:${Math.max(6, (visEnd - x.start) * St.pps - 2)}px">
      <div class="thumbs">${thumbs}</div>${c.kind === 'video' && c.volume !== 0 && !c.muted ? '<canvas class="wave"></canvas>' : ''}
      <span class="cname">${c.speed !== 1 ? `<em>${c.speed}×</em>` : ''}${esc(c.name)} · ${fmtD(c.dur)}</span>
      <i class="h l" data-act="trimL"></i><i class="h r" data-act="trimR"></i></div>${tr}`;
  }).join('');
  el.innerHTML = `<div class="mt-scroll" id="mtScroll"><div class="mt-content" style="width:${width}px">
    <div class="mt-row ruler"><div class="mt-head zoom"><button data-z="-">−</button><button data-z="fit">⟷</button><button data-z="+">+</button></div><div class="mt-ruler" id="mtRuler">${ruler}</div></div>
    ${above.map(rowFor).join('')}
    <div class="mt-row mainrow" data-track="main"><div class="mt-head"><span class="ti">🎬</span><span class="tn">Principal</span><button class="tb ${p.mainMuted ? 'off' : ''}" data-tact="mainmute" title="Couper le son des clips">${p.mainMuted ? '🔇' : '🔊'}</button></div>
      <div class="mt-lane">${main}<button class="addclip" data-addclip style="left:${M.mainLayout(p).end * St.pps + 8}px" title="Ajouter des médias">+</button>${!lay.length ? '<div class="mt-hint">Touchez + ou « Médias » pour ajouter vos vidéos et photos</div>' : ''}</div></div>
    ${below.map(rowFor).join('')}
    <div class="mt-playhead" id="mtPlayhead" style="left:${headW() + St.t * St.pps}px"></div>
  </div></div>`;
  if (keep) { $('#mtScroll').scrollLeft = keep[0]; $('#mtScroll').scrollTop = keep[1]; }
  drawWaves();
}

function thumbsFor(c, w) {
  const m = St.p.media.find((x) => x.id === c.mediaId);
  if (!m || !m.thumbs?.length) return '';
  if (c.kind === 'image' || m.thumbs.length === 1) {
    const n = Math.min(40, Math.ceil(w / 50));
    return Array.from({ length: n }, () => `<img src="${m.thumbs[0].u}" alt="">`).join('');
  }
  const tw = 50 * Math.max(0.5, Math.min(2, (m.w || 16) / (m.h || 9)));
  const n = Math.min(40, Math.max(1, Math.ceil(w / tw)));
  let html = '';
  for (let i = 0; i < n; i++) {
    const st = (c.trim || 0) + ((i + 0.5) * tw / St.pps) * (c.speed || 1);
    let best = m.thumbs[0];
    for (const q of m.thumbs) if (Math.abs(q.t - st) < Math.abs(best.t - st)) best = q;
    html += `<img src="${best.u}" style="width:${tw}px" alt="">`;
  }
  return html;
}

function itemHtml(it, sel) {
  const label = it.type === 'text' ? (it.sticker ? it.text : `T ${it.text.split('\n')[0]}`) : it.name;
  const m = it.mediaId && St.p.media.find((x) => x.id === it.mediaId);
  const bgimg = it.type === 'media' && m?.thumbs?.[0] ? `background-image:url('${m.thumbs[0].u}')` : '';
  return `<div class="clip item it-${it.type}${it.caption ? ' it-caption' : ''} ${sel === it.id ? 'sel' : ''}" data-id="${it.id}" style="left:${it.start * St.pps}px;width:${Math.max(6, it.dur * St.pps)}px;${bgimg}">
    ${it.type === 'audio' ? '<canvas class="wave"></canvas>' : ''}<span class="cname">${esc(label)}</span>
    <i class="h l" data-act="trimL"></i><i class="h r" data-act="trimR"></i></div>`;
}

function drawWaves() {
  for (const cv of $$('#timeline canvas.wave')) {
    const box = cv.parentElement;
    const info = findObj(box.dataset.id);
    if (!info) continue;
    const o = info.obj;
    const pk = getPeaksCached(o.mediaId);
    if (!pk?.data) continue;
    const w = Math.min(4000, box.clientWidth), h = box.clientHeight;
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    c.fillStyle = o.type === 'audio' ? 'rgba(10,10,20,0.6)' : 'rgba(94,234,212,0.55)';
    for (let x = 0; x < w; x++) {
      const lt = (o.trim || 0) + (x / St.pps) * (o.speed || 1);
      const i = Math.floor((lt / pk.duration) * pk.data.length);
      if (i < 0 || i >= pk.data.length) continue;
      const a = pk.data[i] * (o.type === 'audio' ? h * 0.42 : h * 0.22) * ((o.volume ?? 100) / 100);
      if (o.type === 'audio') c.fillRect(x, h / 2 - a, 1, Math.max(1, a * 2)); else c.fillRect(x, h - a * 2, 1, a * 2);
    }
  }
}

export function updatePlayhead() {
  const ph = $('#mtPlayhead');
  if (!ph) return;
  const x = headW() + St.t * St.pps;
  ph.style.left = x + 'px';
  const sc = $('#mtScroll');
  if (St.playing && sc && (x > sc.scrollLeft + sc.clientWidth - 30 || x < sc.scrollLeft + headW())) sc.scrollLeft = x - headW() - 30;
}

function findObj(id) {
  const lay = M.mainLayout(St.p).items;
  const x = lay.find((q) => q.c.id === id);
  if (x) return { kind: 'clip', obj: x.c, start: x.start, end: x.end, index: lay.indexOf(x) };
  for (const tr of St.p.tracks) { const it = tr.items.find((q) => q.id === id); if (it) return { kind: 'item', obj: it, track: tr }; }
  return null;
}

// Points d'accroche : tête de lecture, limites des clips et des éléments.
function snapPoints(excludeId) {
  const pts = [St.t, 0];
  for (const x of M.mainLayout(St.p).items) pts.push(x.start, x.end);
  for (const tr of St.p.tracks) for (const it of tr.items) if (it.id !== excludeId) pts.push(it.start, it.start + it.dur);
  return pts;
}
function snap(v, excludeId) {
  v = Math.round(v * St.p.fps) / St.p.fps;
  if (!St.snap) return E.roundT(v);
  let best = null, bd = 10 / St.pps;
  for (const q of snapPoints(excludeId)) { const d = Math.abs(q - v); if (d < bd) { bd = d; best = q; } }
  return E.roundT(best ?? v);
}

export function initTimeline() {
  const el = $('#timeline');
  let drag = null;
  el.addEventListener('click', (e) => {
    const z = e.target.closest('[data-z]');
    if (z) {
      if (z.dataset.z === 'fit') fitTimeline(); else St.pps = E.clamp(St.pps * (z.dataset.z === '+' ? 1.4 : 1 / 1.4), 4, 400);
      buildTimeline();
      return;
    }
    const ta = e.target.closest('[data-tact]');
    if (ta) {
      const id = ta.closest('[data-track]').dataset.track;
      const tr = St.p.tracks.find((t) => t.id === id);
      if (ta.dataset.tact === 'mainmute') St.p.mainMuted = !St.p.mainMuted;
      else if (tr && ta.dataset.tact === 'mute') tr.muted = !tr.muted;
      else if (tr) tr.hidden = !tr.hidden;
      App.change();
      return;
    }
    if (e.target.closest('[data-addclip]')) { App.openLib('media', 'main'); return; }
    const tb = e.target.closest('[data-trans]');
    if (tb) { App.select({ kind: 'trans', id: tb.dataset.trans }); App.openPanel('trans'); return; }
  });
  el.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    St.pps = E.clamp(St.pps * (e.deltaY < 0 ? 1.15 : 0.87), 4, 400);
    buildTimeline();
  }, { passive: false });

  el.addEventListener('pointerdown', (e) => {
    const t = e.target;
    if (t.closest('.mt-ruler')) {
      drag = { type: 'scrub' };
      el.setPointerCapture(e.pointerId);
      if (St.playing) App.setPlaying(false);
      scrub(e);
      return;
    }
    const box = t.closest('.clip');
    if (!box) {
      if (t.closest('.mt-lane') && !t.closest('button')) { App.select(null); drag = { type: 'scrub' }; el.setPointerCapture(e.pointerId); scrub(e); }
      return;
    }
    const info = findObj(box.dataset.id);
    if (!info) return;
    if (St.sel?.id !== info.obj.id || St.sel?.kind === 'trans') App.select({ kind: info.kind, id: info.obj.id });
    const act = t.dataset.act;
    const o = info.obj;
    drag = {
      type: act || 'move', info, x0: e.clientX, y0: e.clientY, moved: false, box: $(`.clip[data-id="${o.id}"]`),
      start: o.start, dur: o.dur, trim: o.trim || 0, kf: JSON.stringify(o.kf || {}),
    };
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  const scrub = (e) => { const r = $('#mtRuler').getBoundingClientRect(); App.setTime((e.clientX - r.left) / St.pps); };
  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (drag.type === 'scrub') { scrub(e); return; }
    const dx = e.clientX - drag.x0;
    if (!drag.moved && Math.abs(dx) < 4 && Math.abs(e.clientY - drag.y0) < 4) return;
    drag.moved = true;
    const dt = dx / St.pps;
    const o = drag.info.obj;
    const sp = o.speed || 1;
    const maxSpan = o.srcDur ? o.srcDur : Infinity; // durée de la source (vidéo / audio)
    if (drag.type === 'move') {
      if (drag.info.kind === 'clip') { drag.box.style.transform = `translateX(${dx}px)`; drag.box.classList.add('dragging'); return; }
      o.start = Math.max(0, snap(drag.start + dt, o.id));
    } else if (drag.type === 'trimL') {
      let d = Math.round(dt * St.p.fps) / St.p.fps;
      d = Math.max(d, -(drag.trim / sp));                  // pas avant le début de la source
      if (drag.info.kind === 'item') d = Math.max(d, -drag.start);
      d = Math.min(d, drag.dur - 0.1);
      if (drag.info.kind === 'item') { const ns = snap(drag.start + d, o.id); d = Math.min(drag.dur - 0.1, Math.max(ns - drag.start, -(drag.trim / sp))); o.start = E.roundT(drag.start + d); }
      if ('trim' in o) o.trim = Math.max(0, E.roundT(drag.trim + d * sp));
      o.dur = E.roundT(drag.dur - d);
      // Les keyframes restent attachées au contenu.
      const kf = JSON.parse(drag.kf);
      for (const n in kf) kf[n] = kf[n].map((q) => ({ ...q, t: E.roundT(q.t - d) })).filter((q) => q.t >= -0.0005);
      o.kf = kf;
    } else if (drag.type === 'trimR') {
      let nd = drag.dur + dt;
      if (drag.info.kind === 'item') nd = snap(drag.start + nd, o.id) - drag.start;
      else nd = Math.round(nd * St.p.fps) / St.p.fps;
      if (maxSpan !== Infinity) nd = Math.min(nd, (maxSpan - (o.trim || 0)) / sp);
      o.dur = E.roundT(Math.max(0.1, nd));
    }
    App.recompile();
    const box = drag.box;
    if (box) {
      const st = drag.info.kind === 'clip' ? M.mainLayout(St.p).items.find((x) => x.c.id === o.id).start : o.start;
      box.style.left = st * St.pps + 'px';
      box.style.width = Math.max(6, o.dur * St.pps - 2) + 'px';
    }
  });
  const end = (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.type === 'scrub' || !d.moved) return;
    if (d.type === 'move' && d.info.kind === 'clip') {
      // Réordonne la piste principale selon la position de dépôt.
      // Centre du clip déplacé, comparé à la disposition des autres clips (sans lui).
      const center = d.info.start + d.info.obj.dur / 2 + (e.clientX - d.x0) / St.pps;
      const lay = M.mainLayout({ ...St.p, main: St.p.main.filter((c) => c.id !== d.info.obj.id) }).items;
      let idx = lay.findIndex((x) => center < (x.start + x.end) / 2);
      if (idx < 0) idx = lay.length;
      const list = St.p.main.filter((c) => c.id !== d.info.obj.id);
      list.splice(idx, 0, d.info.obj);
      const changed = list.some((c, i) => c !== St.p.main[i]);
      St.p.main = list;
      App.change(changed ? 'Clip déplacé' : undefined);
      return;
    }
    App.change();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  void toast;
}
