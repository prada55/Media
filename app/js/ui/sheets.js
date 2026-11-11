// Fenêtres : projets, réglages de composition, export, raccourcis.
import * as E from '../engine.js';
import * as DB from '../storage.js';
import { FORMATS, projectFromTemplate } from '../templates.js';
import { RESOLUTIONS, dimsFor, probe, exportWebCodecs, exportRealtime, hasWebCodecs } from '../export.js';
import { mixdown, exportAudioStream, restoreMonitor, resumeAudio, getPeaksCached } from '../audio.js';
import { S, A, $, $$, esc, P, toast, fmtT, toHex, ICON } from '../state.js';

export function openSheet(html, onClick, cls = '') {
  const sh = $('#sheet');
  $('#sheetBody').innerHTML = html;
  sh.className = 'sheet ' + cls;
  sh.hidden = false;
  sh.onclick = (e) => { if (e.target.closest('[data-close]')) return closeSheet(); onClick && onClick(e); };
}
export function closeSheet() {
  if (S.exporting) return;
  $('#sheet').hidden = true;
  $('#sheetBody').innerHTML = '';
}
A.closeSheet = closeSheet;

function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
const safeName = (s) => String(s).replace(/[\\/:*?"<>|]+/g, '-').trim() || 'export';

// ---------- Composition ----------
export function openCompSettings() {
  const p = P();
  let fmt = FORMATS.find((f) => f.w === p.width && f.h === p.height)?.id || 'custom';
  openSheet(`<h2>Composition</h2>
    <div class="row"><label>Nom</label><input type="text" id="cName" value="${esc(p.name)}"></div>
    <h4>Format</h4>
    <div class="fmts">${FORMATS.map((f) => `<button class="fmt ${f.id === fmt ? 'on' : ''}" data-fmt="${f.id}"><b>${f.w}×${f.h}</b><small>${f.label}</small></button>`).join('')}
      <button class="fmt ${fmt === 'custom' ? 'on' : ''}" data-fmt="custom"><b>Personnalisé</b><small><input type="number" id="cW" value="${p.width}" min="16" max="4096"> × <input type="number" id="cH" value="${p.height}" min="16" max="4096"></small></button></div>
    <h4>Temps</h4>
    <div class="row"><label>Durée (s)</label><input type="number" class="fld" id="cDur" min="0.5" max="600" step="0.1" value="${p.duration}"></div>
    <div class="row"><label>Images/s</label><div class="seg" id="cFps">${[24, 25, 30, 50, 60].map((f) => `<button data-v="${f}" class="${f === p.fps ? 'on' : ''}">${f}</button>`).join('')}</div></div>
    <div class="row"><label>Fond</label><div class="sp"></div><input type="color" id="cBg" value="${toHex(p.bg)}"></div>
    <button class="btn pri block" data-ok>Appliquer</button>
    <button class="btn block" data-close>Annuler</button>`, (e) => {
    const f = e.target.closest('[data-fmt]');
    if (f && !e.target.matches('input')) { fmt = f.dataset.fmt; $$('.fmt').forEach((b) => b.classList.toggle('on', b === f)); return; }
    if (e.target.matches('#cW,#cH')) { fmt = 'custom'; $$('.fmt').forEach((b) => b.classList.toggle('on', b.dataset.fmt === 'custom')); return; }
    const fb = e.target.closest('#cFps button');
    if (fb) { $$('#cFps button').forEach((b) => b.classList.toggle('on', b === fb)); return; }
    if (!e.target.closest('[data-ok]')) return;
    p.name = $('#cName').value.trim() || 'Sans titre';
    const nd = E.clamp(parseFloat($('#cDur').value) || p.duration, 0.5, 600);
    for (const l of p.layers) if (Math.abs(l.end - p.duration) < 0.01 || l.end > nd) l.end = Math.max(l.start + 0.1, nd);
    p.duration = nd;
    const nf = +$('#cFps button.on').dataset.v;
    if (nf !== p.fps) for (const tr of p.tracks) { /* les suivis gardent leur cadence d'origine */ void tr; }
    p.fps = nf;
    p.bg = $('#cBg').value;
    const F = fmt === 'custom' ? { w: E.clamp(Math.round(+$('#cW').value / 2) * 2, 16, 4096), h: E.clamp(Math.round(+$('#cH').value / 2) * 2, 16, 4096) } : FORMATS.find((x) => x.id === fmt);
    if (F && (F.w !== p.width || F.h !== p.height)) {
      const kx = F.w / p.width, ky = F.h / p.height, k = Math.min(kx, ky);
      for (const l of p.layers) {
        if (!l.parent) {
          l.props.x *= kx; l.props.y *= ky;
          (l.kf.x || []).forEach((q) => (q.v *= kx));
          (l.kf.y || []).forEach((q) => (q.v *= ky));
        }
        if (l.type === 'text') { l.style.size = Math.round(l.style.size * k); l.style.bgPad *= k; l.style.bgRadius *= k; (l.kf['s.size'] || []).forEach((q) => (q.v *= k)); }
        else if (!['solid', 'adjust', 'audio'].includes(l.type)) { l.style.w *= k; l.style.h *= k; }
      }
      p.width = F.w; p.height = F.h;
      E.clearTextCache();
    }
    closeSheet();
    A.refreshAll();
    A.commit('Composition mise à jour');
  });
}
A.openCompSettings = openCompSettings;

// ---------- Projets ----------
export async function openProjects() {
  let list = [];
  try { list = (await DB.listProjects()).sort((a, b) => b.updated - a.updated); } catch (e) { toast('Stockage local indisponible : ' + e.message, 4000, 'err'); }
  let fmt = '9x16';
  openSheet(`<h2>Projets</h2>
    <h4>Nouveau projet</h4>
    <div class="fmts">${FORMATS.map((f) => `<button class="fmt ${f.id === fmt ? 'on' : ''}" data-fmt="${f.id}"><b>${f.label}</b><small>${f.w}×${f.h}</small></button>`).join('')}</div>
    <button class="btn pri block" data-new>Créer un projet vide</button>
    <h4>Mes projets (${list.length})</h4>
    <div class="plist">${list.map((x) => `<div class="pcard ${x.id === P().id ? 'cur' : ''}" data-open="${x.id}">
      <div class="th" style="background-image:url('${x.thumb || ''}')"></div>
      <div class="meta"><b>${esc(x.name)}</b><small>${x.width}×${x.height} · ${x.duration.toFixed(1)} s · ${new Date(x.updated).toLocaleDateString('fr-FR')}</small></div>
      <button class="more" data-more="${x.id}" aria-label="Options">${ICON.more}</button></div>`).join('')}</div>
    <h4>Sauvegarde</h4>
    <div class="row"><button class="btn" data-exportjson style="flex:1">Exporter (.json)</button><button class="btn" data-importjson style="flex:1">Importer…</button></div>
    <div class="hint">Les projets sont enregistrés automatiquement sur cet appareil. Le fichier .json contient la structure du projet, pas les médias importés.</div>`, async (e) => {
    const f = e.target.closest('[data-fmt]');
    if (f) { fmt = f.dataset.fmt; $$('.fmt').forEach((b) => b.classList.toggle('on', b === f)); return; }
    if (e.target.closest('[data-new]')) { await A.saveNow(); closeSheet(); await A.openProject(projectFromTemplate('empty', fmt, 'Sans titre'), true); return; }
    const more = e.target.closest('[data-more]');
    if (more) {
      e.stopPropagation();
      const x = list.find((q) => q.id === more.dataset.more);
      openSheet(`<h2>${esc(x.name)}</h2>
        <button class="btn block" data-dupp>Dupliquer</button>
        <button class="btn block" data-ren>Renommer</button>
        <button class="btn block danger" data-delp>Supprimer</button>
        <button class="btn block" data-close>Annuler</button>`, async (ev) => {
        if (ev.target.closest('[data-dupp]')) { const c = JSON.parse(JSON.stringify(x.id === P().id ? P() : x)); c.id = E.uid(); c.name = x.name + ' copie'; c.updated = Date.now(); await DB.saveProject(c); toast('Projet dupliqué'); openProjects(); }
        if (ev.target.closest('[data-ren]')) { const n = prompt('Nouveau nom', x.name); if (n) { x.name = n; if (x.id === P().id) { P().name = n; A.refreshAll(); } await DB.saveProject(x); } openProjects(); }
        if (ev.target.closest('[data-delp]')) {
          if (!confirm(`Supprimer définitivement « ${x.name} » ?`)) return;
          await DB.deleteProject(x.id);
          if (x.id === P().id) { const rest = list.filter((q) => q.id !== x.id); closeSheet(); await A.openProject(rest[0] ? await DB.getProject(rest[0].id) : projectFromTemplate('empty', '9x16'), !rest[0]); }
          openProjects();
        }
      });
      return;
    }
    const o = e.target.closest('[data-open]');
    if (o) { closeSheet(); if (o.dataset.open !== P().id) { await A.saveNow(); await A.openProject(await DB.getProject(o.dataset.open)); } return; }
    if (e.target.closest('[data-exportjson]')) {
      const blob = new Blob([JSON.stringify({ app: 'moteur-motion', version: 2, project: { ...P(), thumb: undefined } }, null, 1)], { type: 'application/json' });
      downloadBlob(blob, `${safeName(P().name)}.json`);
      return;
    }
    if (e.target.closest('[data-importjson]')) $('#fileProject').click();
  });
}

// ---------- Export ----------
export async function openExport() {
  if (S.playing) A.setPlaying(false);
  const p = P();
  // Une vidéo sans piste son (forme d'onde indécodable) ne compte pas comme source audio.
  const hasAudio = p.layers.some((L) => (L.type === 'audio' || L.type === 'video') && L.visible && !L.style.muted && L.style.mediaId &&
    !(getPeaksCached(L.style.mediaId) && !getPeaksCached(L.style.mediaId).data));
  const st = { format: 'mp4', res: p.height >= p.width ? (p.width >= 1080 ? '1080' : '720') : (p.height >= 1080 ? '1080' : '720'), fps: [24, 30, 60].includes(p.fps) ? p.fps : 30, q: 'std', caps: null };
  openSheet(`<h2>Exporter</h2><div id="expBody"><div class="hint">Analyse des capacités d'encodage de cet appareil…</div></div><div id="expOut"></div>`, onClick);
  const loadCaps = async () => { st.caps = await probe(p, st.fps); render(); };
  const plan = () => {
    const f = st.caps.formats[st.format];
    const r = f.res[st.res];
    if (r.wc) {
      if (hasAudio && !f.audioWC && f.recorder && r.rec) return { mode: 'rt', note: 'Encodage audio WebCodecs indisponible : export en temps réel pour inclure le son.' };
      return { mode: 'wc', audio: hasAudio && f.audioWC, note: hasAudio && !f.audioWC ? 'Le son ne pourra pas être inclus (encodeur audio indisponible).' : '' };
    }
    if (r.rec) return { mode: 'rt', note: '' };
    return null;
  };
  const render = () => {
    const c = st.caps;
    const f = c.formats[st.format];
    const pl = plan();
    const { w, h } = dimsFor(p, RESOLUTIONS.find((x) => x.id === st.res).short);
    $('#expBody').innerHTML = `
      <h4>Format</h4>
      <div class="seg big" data-g="format">${['mp4', 'webm'].map((x) => { const ok = Object.values(c.formats[x].res).some((r) => r.wc || r.rec); return `<button data-v="${x}" class="${st.format === x ? 'on' : ''}" ${ok ? '' : 'disabled'}>${x.toUpperCase()}${ok ? '' : ' (indisponible)'}</button>`; }).join('')}</div>
      <h4>Résolution</h4>
      <div class="fmts">${RESOLUTIONS.map((r) => { const s = f.res[r.id]; const ok = s.wc || s.rec; return `<button class="fmt ${st.res === r.id ? 'on' : ''}" data-res="${r.id}" ${ok ? '' : 'disabled'}><b>${r.label}</b><small>${s.w}×${s.h} · ${s.wc ? 'image par image' : s.rec ? 'temps réel' : 'non pris en charge ici'}</small></button>`; }).join('')}</div>
      <h4>Images par seconde</h4>
      <div class="seg big" data-g="fps">${[24, 30, 60].map((x) => `<button data-v="${x}" class="${st.fps === x ? 'on' : ''}">${x}</button>`).join('')}</div>
      <h4>Qualité</h4>
      <div class="seg big" data-g="q"><button data-v="std" class="${st.q === 'std' ? 'on' : ''}">Standard</button><button data-v="high" class="${st.q === 'high' ? 'on' : ''}">Élevée</button></div>
      <div class="hint exsum">${pl ? `${st.format.toUpperCase()} ${w}×${h} · ${st.fps} i/s · ${p.duration.toFixed(1)} s · ${pl.mode === 'wc' ? 'rendu image par image (WebCodecs), aucune image perdue' : 'enregistrement en temps réel : gardez l\'app au premier plan et l\'écran allumé'} · ${hasAudio ? (pl.mode === 'rt' || pl.audio ? 'avec le son' : 'sans le son') : 'sans piste audio'} · sans filigrane.${pl.note ? `<br><b class="warn">${pl.note}</b>` : ''}` : '<b class="warn">Cette combinaison n\'est pas prise en charge par ce navigateur.</b>'}</div>
      <button class="btn pri block" data-go ${pl ? '' : 'disabled'}>Exporter la vidéo</button>
      <h4>Image</h4>
      <button class="btn block" data-png>Exporter l'image actuelle (PNG, ${p.width}×${p.height})</button>
      ${!c.webcodecs ? '<div class="hint">WebCodecs n\'est pas disponible dans ce navigateur : seul l\'export en temps réel est possible (jusqu\'au 1080p).</div>' : ''}`;
  };
  async function onClick(e) {
    const g = e.target.closest('[data-g] button[data-v]');
    if (g && !g.disabled) {
      const k = g.parentElement.dataset.g;
      st[k] = k === 'fps' ? +g.dataset.v : g.dataset.v;
      if (k === 'fps') { $('#expBody').innerHTML = '<div class="hint">Analyse…</div>'; await loadCaps(); } else render();
      return;
    }
    const r = e.target.closest('[data-res]');
    if (r && !r.disabled) { st.res = r.dataset.res; render(); return; }
    if (e.target.closest('[data-png]')) {
      const c = document.createElement('canvas');
      c.width = p.width; c.height = p.height;
      await A.renderExact(c.getContext('2d'), S.t, 1);
      c.toBlob((b) => showResult(b, `${safeName(p.name)}-${Math.round(S.t * p.fps)}.png`), 'image/png');
      return;
    }
    if (e.target.closest('[data-go]')) return runExport(st, plan(), hasAudio);
    if (e.target.closest('[data-cancelexp]')) { S.expAbort?.abort(); return; }
    if (e.target.closest('[data-share]')) return shareResult();
    if (e.target.closest('[data-dl]')) downloadBlob(S.lastExport.blob, S.lastExport.name);
  }
  if (!hasWebCodecs() && !window.MediaRecorder) { $('#expBody').innerHTML = '<div class="hint warn">Ce navigateur ne permet pas d\'exporter de la vidéo. Mettez à jour iOS / votre navigateur. L\'export PNG reste possible.</div><button class="btn block" data-png>Exporter l\'image actuelle (PNG)</button>'; return; }
  await loadCaps();
}

async function runExport(st, pl, hasAudio) {
  const p = P();
  const { w, h } = dimsFor(p, RESOLUTIONS.find((x) => x.id === st.res).short);
  const ctrl = new AbortController();
  S.expAbort = ctrl;
  S.exporting = true;
  $('#expBody').querySelectorAll('button').forEach((b) => (b.disabled = true));
  $('#expOut').innerHTML = `<div class="prog"><i id="expBar"></i></div><div class="hint" id="expTxt">Préparation…</div><button class="btn block" data-cancelexp>Annuler l'export</button>`;
  const prog = (q, eta, label) => {
    const bar = $('#expBar');
    if (!bar) return;
    bar.style.width = Math.round(q * 100) + '%';
    $('#expTxt').textContent = `${label} · ${Math.round(q * 100)} %${eta > 0.5 ? ` · reste environ ${eta >= 60 ? Math.round(eta / 60) + ' min' : Math.round(eta) + ' s'}` : ''}`;
  };
  const t0 = performance.now();
  // Wake lock : évite la mise en veille de l'écran pendant l'export (si disponible).
  let lock = null;
  try { lock = await navigator.wakeLock?.request('screen'); } catch {}
  try {
    let res;
    if (pl.mode === 'wc') {
      let audioBuffer = null;
      if (pl.audio) {
        prog(0, 0, 'Mixage audio');
        audioBuffer = await mixdown(p, async (id) => A.media.get(id)?.blob, 48000, (s) => prog(0, 0, s));
      }
      for (const el of A.els.values()) el.pause();
      res = await exportWebCodecs({ p, w, h, fps: st.fps, format: st.format, quality: st.q, audioBuffer, signal: ctrl.signal, onProgress: prog, renderAt: (c, t, sc) => A.renderExact(c, t, sc) });
    } else {
      resumeAudio();
      const stream = hasAudio ? exportAudioStream(true) : null;
      res = await exportRealtime({ p, w, h, fps: st.fps, format: st.format, quality: st.q, audioStream: stream, signal: ctrl.signal, onProgress: prog, renderAt: (c, t, sc, playing) => A.renderLive(c, t, sc, playing), onEnd: () => restoreMonitor() });
      for (const el of A.els.values()) el.pause();
    }
    const secs = (performance.now() - t0) / 1000;
    showResult(res.blob, `${safeName(p.name)}.${st.format}`, `Rendu en ${secs.toFixed(1)} s${hasAudio ? res.audio ? ' · avec le son' : ' · sans le son' : ''}`);
  } catch (err) {
    restoreMonitor();
    if (err.name === 'AbortError') { $('#expOut').innerHTML = '<div class="hint">Export annulé.</div>'; }
    else { console.error(err); $('#expOut').innerHTML = `<div class="hint warn">Échec de l'export : ${esc(err.message || err)}.<br>Essayez une résolution plus basse, l'autre format, ou 30 i/s.</div>`; }
  } finally {
    S.exporting = false;
    S.expAbort = null;
    try { await lock?.release(); } catch {}
    $('#expBody')?.querySelectorAll('button').forEach((b) => (b.disabled = false));
    A.syncMedia(S.t, false);
    A.requestRender();
  }
}

function showResult(blob, name, extra = '') {
  if (S.lastExport) URL.revokeObjectURL(S.lastExport.url);
  const url = URL.createObjectURL(blob);
  S.lastExport = { blob, name, url };
  const isVid = blob.type.startsWith('video');
  let canShare = false;
  try { canShare = !!navigator.canShare && navigator.canShare({ files: [new File([blob], name, { type: blob.type })] }); } catch {}
  const out = $('#expOut');
  if (!out) return;
  out.innerHTML = `<div class="result"><h4>Terminé · ${(blob.size / 1e6).toFixed(1)} Mo ${extra ? '· ' + extra : ''}</h4>
    ${isVid ? `<video src="${url}" controls playsinline loop></video>` : `<img src="${url}" alt="Aperçu de l'export">`}
    ${canShare ? '<button class="btn pri block" data-share>Partager / Enregistrer dans Photos</button>' : ''}
    <button class="btn block" data-dl>Télécharger le fichier</button></div>`;
}
async function shareResult() {
  const { blob, name } = S.lastExport;
  try { await navigator.share({ files: [new File([blob], name, { type: blob.type })], title: name }); }
  catch (e) { if (e.name !== 'AbortError') downloadBlob(blob, name); }
}

// ---------- Raccourcis ----------
export function openShortcuts() {
  const rows = [
    ['Espace', 'Lecture / pause'], ['← / →', 'Image précédente / suivante'], ['Maj + ← / →', '10 images'], ['Début / Fin', 'Aller au début / à la fin'],
    ['J / K', 'Keyframe précédente / suivante'], ['L', 'Boucle'], ['S', 'Couper le calque à la tête de lecture'], ['[ / ]', 'Début / fin du calque à la tête de lecture'],
    ['I', 'Keyframes de transformation à la tête de lecture'], ['U', 'Afficher les propriétés animées du calque'], ['Ctrl/⌘ + D', 'Dupliquer'], ['Suppr', 'Supprimer'],
    ['Ctrl/⌘ + G', 'Grouper (Maj : dissocier)'], ['Ctrl/⌘ + A', 'Tout sélectionner'], ['Maj + clic', 'Sélection multiple'], ['Ctrl/⌘ + Z', 'Annuler (Maj : rétablir)'],
    ['Ctrl/⌘ + S', 'Enregistrer'], ['Ctrl/⌘ + E', 'Exporter'], ['Ctrl + molette', 'Zoom timeline / échelle du calque'], ['F', 'Mode focus (grand écran)'], ['Échap', 'Désélectionner'], ['?', 'Cette aide'],
  ];
  openSheet(`<h2>Raccourcis clavier</h2><div class="keys">${rows.map(([k, d]) => `<div><kbd>${k}</kbd><span>${d}</span></div>`).join('')}</div>
    <h4>Gestes tactiles</h4><div class="keys">
      <div><kbd>Glisser</kbd><span>Déplacer l'élément</span></div><div><kbd>Pincer</kbd><span>Échelle et rotation</span></div>
      <div><kbd>Double appui</kbd><span>Modifier le texte / renommer un calque</span></div><div><kbd>Séparateur</kbd><span>Redimensionner les panneaux</span></div></div>
    <button class="btn block" data-close>Fermer</button>`);
}

export function initSheets() {
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
      await A.openProject(p, true);
      toast('Projet importé');
    } catch { toast('Fichier de projet invalide', 3000, 'err'); }
  });
  void fmtT;
}
