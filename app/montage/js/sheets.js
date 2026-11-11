// Fenêtres : projets, format, export.
import * as E from '../../js/engine.js';
import { RESOLUTIONS, dimsFor, probe, exportWebCodecs, exportRealtime, hasWebCodecs } from '../../js/export.js';
import { mixdown, exportAudioStream, restoreMonitor, resumeAudio, getPeaksCached } from '../../js/audio.js';
import { $, $$, esc, toast } from '../../js/state.js';
import * as DB from './store.js';
import { St, App } from './core.js';
import * as M from './model.js';

function openSheet(html, onClick) {
  $('#sheetBody').innerHTML = html;
  const sh = $('#sheet');
  sh.hidden = false;
  sh.onclick = (e) => { if (e.target.closest('[data-close]')) return closeSheet(); onClick && onClick(e); };
}
function closeSheet() { if (St.exporting) return; $('#sheet').hidden = true; $('#sheetBody').innerHTML = ''; }
App.closeSheet = closeSheet;
const safe = (s) => String(s).replace(/[\\/:*?"<>|]+/g, '-').trim() || 'montage';
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

// ---------- Format ----------
export function openFormat() {
  const p = St.p;
  openSheet(`<h2>Format</h2><div class="fmts">${M.FORMATS.map((f) => `<button class="fmt ${f.w === p.width && f.h === p.height ? 'on' : ''}" data-fmt="${f.id}"><b>${f.label}</b><small>${f.sub} · ${f.w}×${f.h}</small></button>`).join('')}</div>
    <div class="hint">Les textes et incrustations gardent leur position relative.</div><button class="btn block" data-close>Fermer</button>`, (e) => {
    const b = e.target.closest('[data-fmt]');
    if (!b) return;
    const f = M.FORMATS.find((x) => x.id === b.dataset.fmt);
    const kx = f.w / p.width, ky = f.h / p.height, k = Math.min(kx, ky);
    const moveObj = (o) => {
      if (!o.props) return;
      o.props.x *= kx; o.props.y *= ky;
      (o.kf?.x || []).forEach((q) => (q.v *= kx));
      (o.kf?.y || []).forEach((q) => (q.v *= ky));
      if (o.type === 'text') { o.style.size = Math.round(o.style.size * k); o.style.bgPad *= k; o.style.bgRadius *= k; }
    };
    p.main.forEach(moveObj);
    p.tracks.forEach((t) => t.items.forEach(moveObj));
    p.width = f.w; p.height = f.h;
    E.clearTextCache();
    closeSheet();
    App.fitStage();
    App.change(`Format ${f.label}`);
  });
}
App.openFormat = openFormat;

// ---------- Projets ----------
export async function openProjects() {
  let list = [];
  try { list = (await DB.listProjects()).sort((a, b) => b.updated - a.updated); } catch (e) { toast('Stockage indisponible : ' + e.message, 4000, 'err'); }
  let fmt = '9x16';
  openSheet(`<h2>Mes montages</h2>
    <h4>Nouveau projet</h4><div class="fmts">${M.FORMATS.map((f) => `<button class="fmt ${f.id === fmt ? 'on' : ''}" data-fmt="${f.id}"><b>${f.label}</b><small>${f.sub}</small></button>`).join('')}</div>
    <button class="btn pri block" data-new>Créer un projet</button>
    <h4>Projets (${list.length})</h4>
    <div class="plist">${list.map((x) => `<div class="pcard ${x.id === St.p.id ? 'cur' : ''}" data-open="${x.id}"><div class="th" style="background-image:url('${x.thumb || ''}')"></div>
      <div class="meta"><b>${esc(x.name)}</b><small>${x.width}×${x.height} · ${new Date(x.updated).toLocaleDateString('fr-FR')}</small></div>
      <button class="more" data-more="${x.id}" aria-label="Options">⋯</button></div>`).join('')}</div>
    <div class="hint">Les projets et médias sont enregistrés automatiquement sur cet appareil, rien n'est envoyé en ligne.</div>
    <a class="btn block" href="../">Ouvrir Moteur Studio (motion design avancé)</a>`, async (e) => {
    const f = e.target.closest('[data-fmt]');
    if (f) { fmt = f.dataset.fmt; $$('.fmt').forEach((b) => b.classList.toggle('on', b === f)); return; }
    if (e.target.closest('[data-new]')) { await App.saveNow(); closeSheet(); await App.openProject(M.newMontage(fmt), true); return; }
    const more = e.target.closest('[data-more]');
    if (more) {
      e.stopPropagation();
      const x = list.find((q) => q.id === more.dataset.more);
      openSheet(`<h2>${esc(x.name)}</h2><button class="btn block" data-dup>Dupliquer</button><button class="btn block" data-ren>Renommer</button><button class="btn block danger" data-del>Supprimer</button><button class="btn block" data-close>Annuler</button>`, async (ev) => {
        if (ev.target.closest('[data-dup]')) { const c = JSON.parse(JSON.stringify(x.id === St.p.id ? St.p : x)); c.id = M.uid(); c.name += ' copie'; c.updated = Date.now(); await DB.saveProject(c); toast('Projet dupliqué'); openProjects(); }
        if (ev.target.closest('[data-ren]')) { const n = prompt('Nouveau nom', x.name); if (n) { x.name = n; if (x.id === St.p.id) App.rename(n); else await DB.saveProject(x); } openProjects(); }
        if (ev.target.closest('[data-del]')) {
          if (!confirm(`Supprimer « ${x.name} » ?`)) return;
          await DB.deleteProject(x.id);
          if (x.id === St.p.id) { const rest = list.filter((q) => q.id !== x.id); closeSheet(); await App.openProject(rest[0] ? await DB.getProject(rest[0].id) : M.newMontage(), !rest[0]); }
          openProjects();
        }
      });
      return;
    }
    const o = e.target.closest('[data-open]');
    if (o) { closeSheet(); if (o.dataset.open !== St.p.id) { await App.saveNow(); await App.openProject(await DB.getProject(o.dataset.open)); } }
  });
}

// ---------- Export ----------
export async function openExport() {
  if (St.playing) App.setPlaying(false);
  App.recompile();
  const P = St.C;
  if (!St.p.main.length && !St.p.tracks.length) { toast('Le montage est vide : ajoutez des médias d\'abord'); return; }
  const hasAudio = P.layers.some((L) => (L.type === 'audio' || L.type === 'video') && !L.alias && !L.style.muted && L.style.mediaId && !(getPeaksCached(L.style.mediaId) && !getPeaksCached(L.style.mediaId).data));
  const st = { format: 'mp4', res: '1080', fps: [24, 30, 60].includes(St.p.fps) ? St.p.fps : 30, q: 'std', caps: null };
  openSheet(`<h2>Exporter la vidéo</h2><div id="expBody"><div class="hint">Analyse des capacités de l'appareil…</div></div><div id="expOut"></div>`, onClick);
  const plan = () => {
    const f = st.caps.formats[st.format], r = f.res[st.res];
    if (r.wc) {
      if (hasAudio && !f.audioWC && f.recorder && r.rec) return { mode: 'rt', note: 'Encodeur audio indisponible pour ce format : export en temps réel pour garder le son (ou choisissez l\'autre format).' };
      return { mode: 'wc', audio: hasAudio && f.audioWC, note: hasAudio && !f.audioWC ? 'Le son ne pourra pas être inclus dans ce format sur cet appareil : essayez l\'autre format.' : '' };
    }
    return r.rec ? { mode: 'rt', note: '' } : null;
  };
  const render = () => {
    const f = st.caps.formats[st.format];
    const pl = plan();
    const { w, h } = dimsFor(P, RESOLUTIONS.find((x) => x.id === st.res).short);
    $('#expBody').innerHTML = `
      <h4>Résolution</h4><div class="fmts">${RESOLUTIONS.map((r) => { const s = f.res[r.id]; const ok = s.wc || s.rec; return `<button class="fmt ${st.res === r.id ? 'on' : ''}" data-res="${r.id}" ${ok ? '' : 'disabled'}><b>${r.label}</b><small>${s.w}×${s.h}${ok ? '' : ' · non pris en charge'}</small></button>`; }).join('')}</div>
      <h4>Images par seconde</h4><div class="seg big" data-g="fps">${[24, 30, 60].map((x) => `<button data-v="${x}" class="${st.fps === x ? 'on' : ''}">${x}</button>`).join('')}</div>
      <h4>Format</h4><div class="seg big" data-g="format">${['mp4', 'webm'].map((x) => { const ok = Object.values(st.caps.formats[x].res).some((r) => r.wc || r.rec); return `<button data-v="${x}" class="${st.format === x ? 'on' : ''}" ${ok ? '' : 'disabled'}>${x.toUpperCase()}</button>`; }).join('')}</div>
      <h4>Qualité</h4><div class="seg big" data-g="q"><button data-v="std" class="${st.q === 'std' ? 'on' : ''}">Standard</button><button data-v="high" class="${st.q === 'high' ? 'on' : ''}">Haute</button></div>
      <div class="hint exsum">${pl ? `${st.format.toUpperCase()} ${w}×${h} · ${st.fps} i/s · ${P.duration.toFixed(1)} s · ${pl.mode === 'wc' ? 'rendu image par image (aucune image perdue)' : 'enregistrement en temps réel : gardez la page ouverte'} · ${hasAudio ? (pl.mode === 'rt' || pl.audio ? 'avec le son' : 'sans le son') : 'sans piste audio'} · sans filigrane${pl.note ? `<br><b class="warn">${pl.note}</b>` : ''}` : '<b class="warn">Combinaison non prise en charge par ce navigateur.</b>'}</div>
      <button class="btn pri block" data-go ${pl ? '' : 'disabled'}>Exporter</button>`;
  };
  const load = async () => { st.caps = await probe(P, st.fps); render(); };
  async function onClick(e) {
    const g = e.target.closest('[data-g] button[data-v]');
    if (g && !g.disabled) { const k = g.parentElement.dataset.g; st[k] = k === 'fps' ? +g.dataset.v : g.dataset.v; if (k === 'fps') { $('#expBody').innerHTML = '<div class="hint">Analyse…</div>'; await load(); } else render(); return; }
    const r = e.target.closest('[data-res]');
    if (r && !r.disabled) { st.res = r.dataset.res; render(); return; }
    if (e.target.closest('[data-go]')) return run(st, plan(), hasAudio);
    if (e.target.closest('[data-cancelexp]')) { St.expAbort?.abort(); return; }
    if (e.target.closest('[data-share]')) { const { blob, name } = St.lastExport; try { await navigator.share({ files: [new File([blob], name, { type: blob.type })] }); } catch (err) { if (err.name !== 'AbortError') download(blob, name); } return; }
    if (e.target.closest('[data-dl]')) download(St.lastExport.blob, St.lastExport.name);
  }
  if (!hasWebCodecs() && !window.MediaRecorder) { $('#expBody').innerHTML = '<div class="hint warn">Ce navigateur ne permet pas d\'exporter de vidéo. Utilisez Chrome, Edge ou Safari récent.</div>'; return; }
  await load();
}

async function run(st, pl, hasAudio) {
  const P = St.C;
  const { w, h } = dimsFor(P, RESOLUTIONS.find((x) => x.id === st.res).short);
  const ctrl = new AbortController();
  St.expAbort = ctrl;
  St.exporting = true;
  $('#expBody').querySelectorAll('button').forEach((b) => (b.disabled = true));
  $('#expOut').innerHTML = '<div class="prog"><i id="expBar"></i></div><div class="hint" id="expTxt">Préparation…</div><button class="btn block" data-cancelexp>Annuler</button>';
  const prog = (q, eta, label) => {
    const bar = $('#expBar');
    if (!bar) return;
    bar.style.width = Math.round(q * 100) + '%';
    $('#expTxt').textContent = `${label} · ${Math.round(q * 100)} %${eta > 0.5 ? ` · reste ~${eta >= 60 ? Math.round(eta / 60) + ' min' : Math.round(eta) + ' s'}` : ''}`;
  };
  const t0 = performance.now();
  let lock = null;
  try { lock = await navigator.wakeLock?.request('screen'); } catch {}
  try {
    let res;
    if (pl.mode === 'wc') {
      let audioBuffer = null;
      if (pl.audio) { prog(0, 0, 'Mixage audio'); audioBuffer = await mixdown({ ...P, layers: P.layers.filter((L) => !L.alias) }, async (id) => App.media.get(id)?.blob, 48000, (s) => prog(0, 0, s)); }
      res = await exportWebCodecs({ p: P, w, h, fps: st.fps, format: st.format, quality: st.q, audioBuffer, signal: ctrl.signal, onProgress: prog, renderAt: (c, t, sc) => App.renderExact(c, t, sc) });
    } else {
      resumeAudio();
      res = await exportRealtime({ p: P, w, h, fps: st.fps, format: st.format, quality: st.q, audioStream: hasAudio ? exportAudioStream(true) : null, signal: ctrl.signal, onProgress: prog, renderAt: (c, t, sc, playing) => App.renderLive(c, t, sc, playing), onEnd: () => restoreMonitor() });
    }
    const name = `${safe(St.p.name)}.${st.format}`;
    if (St.lastExport) URL.revokeObjectURL(St.lastExport.url);
    const url = URL.createObjectURL(res.blob);
    St.lastExport = { blob: res.blob, name, url };
    let canShare = false;
    try { canShare = !!navigator.canShare?.({ files: [new File([res.blob], name, { type: res.blob.type })] }); } catch {}
    $('#expOut').innerHTML = `<div class="result"><h4>Terminé · ${(res.blob.size / 1e6).toFixed(1)} Mo · ${((performance.now() - t0) / 1000).toFixed(1)} s${hasAudio ? (res.audio ? ' · avec le son' : ' · sans le son') : ''}</h4>
      <video src="${url}" controls playsinline></video>
      ${canShare ? '<button class="btn pri block" data-share>Partager / Enregistrer</button>' : ''}<button class="btn block" data-dl>Télécharger</button></div>`;
  } catch (err) {
    restoreMonitor();
    $('#expOut').innerHTML = err.name === 'AbortError' ? '<div class="hint">Export annulé.</div>' : `<div class="hint warn">Échec de l'export : ${esc(err.message || err)}. Essayez une résolution plus basse ou l'autre format.</div>`;
  } finally {
    St.exporting = false;
    try { await lock?.release(); } catch {}
    $('#expBody')?.querySelectorAll('button').forEach((b) => (b.disabled = false));
    App.syncMedia(St.t, false);
    St.dirty = true;
  }
}
