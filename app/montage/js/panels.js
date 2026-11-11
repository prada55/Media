// Panneaux : bibliothèque (médias, audio, texte, stickers, sous-titres) et propriétés de la sélection.
import * as E from '../../js/engine.js';
import { $, $$, esc, toast, fmtT, fmtNum, toHex, numRow, colorRow, switchRow, selectRow, segRow, readInput } from '../../js/state.js';
import { St, App, selInfo, localT } from './core.js';
import * as M from './model.js';

const LIB_TABS = [['media', 'Médias'], ['audio', 'Audio'], ['text', 'Texte'], ['stickers', 'Stickers'], ['captions', 'Sous-titres']];
const STICKERS = {
  'Émotions': '😀 😂 🤣 😍 🥰 😎 🤩 😱 😭 😡 🥳 🤯 😴 🤔 🙄 😇 😈 💀 👻 🤖'.split(' '),
  'Gestes': '👍 👎 👏 🙌 🙏 💪 👀 👉 👈 👆 👇 ✌️ 🤞 🤙 👋 ✍️ 🫶 🤝'.split(' '),
  'Symboles': '❤️ 🔥 ✨ ⭐ 💯 ✅ ❌ ⚠️ 💥 💫 💰 🎉 🎁 🏆 🚀 📌 📍 🔔 💡 ⚡'.split(' '),
  'Flèches': '⬆️ ⬇️ ⬅️ ➡️ ↗️ ↘️ 🔄 🔝 🆕 🆓 🔴 🟢 🟡 🔵'.split(' '),
  'Divers': '🎬 🎵 🎶 📸 🎥 📱 💻 🍕 ☕ 🌍 🌈 ☀️ 🌙 🐶 🐱 🦄'.split(' '),
};
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

// ---------- Ouverture ----------
App.openLib = (tab, dest = null) => {
  St.ltab = tab;
  St.libDest = dest;
  if (!St.desktop) St.drawer = 'lib';
  renderPanels();
};
App.openPanel = (tab) => {
  St.ptab = tab;
  if (!St.desktop) St.drawer = 'props';
  renderPanels();
};
App.closeDrawer = () => { St.drawer = null; renderPanels(); };

export function renderPanels() {
  if (!St.p) return;
  if (St.desktop) {
    $('#left').innerHTML = libHtml();
    $('#right').innerHTML = propsHtml();
    $('#drawer').hidden = true;
  } else {
    const d = $('#drawer');
    d.hidden = !St.drawer;
    if (St.drawer) $('#drawerBody').innerHTML = St.drawer === 'lib' ? libHtml() : propsHtml();
  }
  refreshValues();
}

// ---------- Bibliothèque ----------
function libHtml() {
  const tabs = `<div class="ptabs">${LIB_TABS.map(([id, l]) => `<button data-ltab="${id}" class="${St.ltab === id ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const p = St.p;
  let body = '';
  const dest = St.replacing ? 'remplacer le média sélectionné' : St.libDest === 'overlay' ? 'ajouter en incrustation' : 'ajouter à la piste principale';
  if (St.ltab === 'media') {
    const list = p.media.filter((m) => m.kind === 'video' || m.kind === 'image');
    body = `<div class="pad"><button class="btn pri block" data-imp="media">＋ Importer vidéos / photos</button>
      <div class="hint">Touchez un média pour <b>${dest}</b>. ${St.libDest !== 'overlay' && !St.replacing ? '<a href="#" data-dest="overlay">Incruster plutôt</a>' : St.libDest === 'overlay' ? '<a href="#" data-dest="main">Piste principale plutôt</a>' : '<a href="#" data-cancelrep>Annuler</a>'}</div></div>
      ${list.length ? `<div class="mgrid">${list.map(mediaCard).join('')}</div>` : '<div class="empty"><b>Aucun média</b>Importez des vidéos et des photos depuis votre appareil.</div>'}`;
  } else if (St.ltab === 'audio') {
    const list = p.media.filter((m) => m.kind === 'audio');
    body = `<div class="pad"><button class="btn pri block" data-imp="audio">＋ Importer de la musique / des sons</button>
      <button class="btn block ${St.recording ? 'danger' : ''}" data-voice>🎙 ${St.recording ? 'Arrêter l\'enregistrement' : 'Enregistrer une voix off'}</button>
      <div class="hint">La voix off s'enregistre pendant la lecture, à partir de la tête de lecture. Touchez un son pour l'ajouter ${St.replacing ? '(remplacement)' : 'à la tête de lecture'}.</div></div>
      ${list.length ? `<div class="alist">${list.map((m) => `<button class="arow" data-mid="${m.id}"><span class="aic">♪</span><span class="an">${esc(m.name)}</span><span class="ad">${fmtT(m.dur || 0)}</span></button>`).join('')}</div>` : '<div class="empty"><b>Aucun son</b>Importez un MP3, M4A ou WAV, ou enregistrez une voix off.</div>'}`;
  } else if (St.ltab === 'text') {
    body = `<div class="pad"><button class="btn pri block" data-addtext="basic">＋ Ajouter un texte</button><h4>Styles</h4>
      <div class="grid">${M.TEXT_STYLES.map((s) => `<button class="tile tstyle ts-${s.id}" data-addtext="${s.id}"><span style="${styleCss(s)}">Aa</span><small>${s.label}</small></button>`).join('')}</div></div>`;
  } else if (St.ltab === 'stickers') {
    body = `<div class="pad">${Object.entries(STICKERS).map(([cat, list]) => `<h4>${cat}</h4><div class="stk">${list.map((s) => `<button data-sticker="${s}">${s}</button>`).join('')}</div>`).join('')}</div>`;
  } else if (St.ltab === 'captions') {
    const caps = p.tracks.filter((t) => t.type === 'caption').flatMap((t) => t.items).sort((a, b) => a.start - b.start);
    body = `<div class="pad">
      <button class="btn pri block" data-cap="add">＋ Sous-titre à la tête de lecture</button>
      <div class="row2"><button class="btn" data-cap="import">Importer .srt</button><button class="btn" data-cap="export" ${caps.length ? '' : 'disabled'}>Exporter .srt</button></div>
      <h4>Style pour tous les sous-titres</h4>
      <div class="stk wide">${M.TEXT_STYLES.slice(0, 6).map((s) => `<button data-capstyle="${s.id}" style="${styleCss(s)}">${s.label}</button>`).join('')}</div>
      <div class="hint">La transcription automatique de la voix n'est pas encore disponible : saisissez vos sous-titres ici ou importez un fichier .srt (créé par exemple avec un outil de transcription).</div></div>
      ${caps.length ? `<div class="caplist">${caps.map((c) => `<div class="cap ${St.sel?.id === c.id ? 'sel' : ''}" data-capid="${c.id}"><button class="ct" data-capgo="${c.id}">${fmtT(c.start)}</button><textarea data-captext="${c.id}" rows="1">${esc(c.text)}</textarea></div>`).join('')}</div>` : ''}`;
  }
  return tabs + `<div class="pscroll">${body}</div>`;
}
function mediaCard(m) {
  const n = St.p.main.filter((c) => c.mediaId === m.id).length + St.p.tracks.reduce((a, t) => a + t.items.filter((i) => i.mediaId === m.id).length, 0);
  const th = m.thumbs?.[0]?.u || (m.kind === 'image' ? App.mediaUrl(m.id) : '');
  return `<button class="mcard" data-mid="${m.id}"><span class="mth" style="${th ? `background-image:url('${th}')` : ''}">${m.dur ? `<i class="dur">${fmtT(m.dur)}</i>` : ''}${!App.media.has(m.id) ? '<i class="miss">absent</i>' : ''}${n ? `<i class="used">×${n}</i>` : ''}</span><span class="mnm">${esc(m.name)}</span></button>`;
}
function styleCss(s) {
  const st = s.style;
  return [`color:${st.color}`, st.bgOn ? `background:${st.bg};padding:2px 6px;border-radius:5px` : '', st.strokeW ? `-webkit-text-stroke:1.5px ${st.stroke}` : '', st.gradOn ? `background:linear-gradient(90deg,${st.color},${st.color2});-webkit-background-clip:text;color:transparent` : '', st.italic ? 'font-style:italic' : '', st.font ? `font-family:${st.font.replace(/"/g, "'")}` : '', s.glow ? `text-shadow:0 0 8px ${s.glow}` : '', st.depth ? `text-shadow:3px 3px 0 ${st.depthColor}` : '', 'font-weight:900'].filter(Boolean).join(';');
}

// ---------- Propriétés ----------
function tabsFor(info) {
  if (!info) return [];
  if (info.kind === 'trans') return [['trans', 'Transition']];
  const o = info.obj;
  if (o.type === 'audio') return [['audio', 'Volume'], ['speed', 'Vitesse']];
  if (o.type === 'text') return [['text', 'Texte'], ['tstyle', 'Style'], ['anim', 'Animations'], ['edit', 'Position']];
  const t = [['edit', 'Cadrage']];
  if (o.kind === 'video') t.push(['speed', 'Vitesse'], ['audio', 'Volume']);
  t.push(['anim', 'Animations'], ['filters', 'Filtres'], ['adjust', 'Ajuster'], ['effects', 'Effets']);
  if (info.kind === 'clip' && info.index < St.p.main.length - 1) t.push(['trans', 'Transition']);
  return t;
}
function propsHtml() {
  const info = selInfo();
  const tabs = tabsFor(info);
  if (!info) return `<div class="ptabs"><button class="on">Projet</button></div><div class="pscroll">${projectHtml()}</div>`;
  if (!tabs.find((t) => t[0] === St.ptab)) St.ptab = tabs[0][0];
  const o = info.obj;
  const title = info.kind === 'trans' ? `Transition après « ${esc(o.name)} »` : o.type === 'text' ? (o.sticker ? 'Sticker' : o.caption ? 'Sous-titre' : 'Texte') : o.type === 'audio' ? 'Audio' : info.kind === 'clip' ? (o.kind === 'video' ? 'Clip vidéo' : 'Photo') : 'Incrustation';
  return `<div class="ptabs scroll">${tabs.map(([id, l]) => `<button data-ptab="${id}" class="${St.ptab === id ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="pscroll"><div class="ptitle">${title}<span>${fmtT(info.start)} → ${fmtT(info.end)} · ${(info.end - info.start).toFixed(2)} s</span></div>${tabHtml(St.ptab, info)}</div>`;
}

const kfRow = (info, name, label, min, max, step) => numRow('props.' + name, label, min, max, step, E.getProp(info.obj, name, localT(info)), true);

function tabHtml(tab, info) {
  const o = info.obj, p = St.p;
  switch (tab) {
    case 'edit': return `<div class="pad">
      ${o.type !== 'text' ? segRow('fit', 'Cadrage', o.fit, [['fit', 'Ajuster'], ['fill', 'Remplir']]) : ''}
      ${kfRow(info, 'x', 'Position X', -p.width / 2, p.width * 1.5, 1)}
      ${kfRow(info, 'y', 'Position Y', -p.height / 2, p.height * 1.5, 1)}
      ${kfRow(info, 'scale', 'Échelle %', 1, 400, 0.5)}
      ${kfRow(info, 'rotation', 'Rotation °', -360, 360, 0.5)}
      ${kfRow(info, 'opacity', 'Opacité %', 0, 100, 1)}
      <div class="row2"><button class="btn" data-op="center">Centrer</button><button class="btn" data-op="resetT">Réinitialiser</button></div>
      <div class="hint">◆ crée une keyframe à la tête de lecture : placez-en plusieurs à des instants différents pour animer (zoom, déplacement…). Sur l'aperçu : glisser pour déplacer, pincer pour zoomer et tourner.</div>
      ${info.kind === 'item' ? numRow('start', 'Début (s)', 0, Math.max(10, St.C.duration), 0.01, o.start) : ''}
      ${o.kind === 'image' || o.type === 'text' ? numRow('dur', 'Durée (s)', 0.1, 120, 0.1, o.dur) : ''}
      ${Object.keys(o.kf || {}).length ? '<button class="btn block danger" data-op="clearKf">Effacer les keyframes</button>' : ''}</div>`;
    case 'speed': return `<div class="pad"><div class="chips">${SPEEDS.map((s) => `<button class="chip ${Math.abs((o.speed || 1) - s) < 0.001 ? 'on' : ''}" data-speed="${s}">${s}×</button>`).join('')}</div>
      ${numRow('speedv', 'Vitesse ×', 0.1, 10, 0.05, o.speed || 1)}
      <div class="hint">Durée à l'écran : <b>${o.dur.toFixed(2)} s</b>. La hauteur du son est préservée pendant la lecture ; dans l'export, le son accéléré change de hauteur.</div></div>`;
    case 'audio': return `<div class="pad">
      ${numRow('volume', 'Volume %', 0, 200, 1, o.volume ?? 100)}
      ${switchRow('muted', 'Couper le son', o.muted)}
      ${numRow('fadeIn', 'Fondu d\'entrée (s)', 0, Math.min(10, o.dur / 2), 0.05, o.fadeIn || 0)}
      ${numRow('fadeOut', 'Fondu de sortie (s)', 0, Math.min(10, o.dur / 2), 0.05, o.fadeOut || 0)}
      ${info.kind === 'clip' && o.kind === 'video' ? '<button class="btn block" data-op="extract">Extraire l\'audio sur une piste séparée</button>' : ''}</div>`;
    case 'anim': {
      const g = (key, list, title) => `<h4>${title}</h4><div class="chips">${[[null, 'Aucune'], ...list].map(([id, l]) => `<button class="chip ${(o.anim[key] || null) === id ? 'on' : ''}" data-anim="${key}" data-v="${id ?? ''}">${l}</button>`).join('')}</div>`;
      return `<div class="pad">
        ${o.type === 'text' && !o.sticker ? `<h4>Animation des lettres</h4><div class="chips">${Object.entries(E.TEXT_ANIMS).map(([id, l]) => `<button class="chip ${o.textAnim.type === id ? 'on' : ''}" data-tanim="${id}">${l}</button>`).join('')}</div>
          ${o.textAnim.type !== 'none' ? segRow('textAnim.by', 'Par', o.textAnim.by, [['char', 'Lettre'], ['word', 'Mot'], ['line', 'Ligne']]) + numRow('textAnim.dur', 'Durée (s)', 0.02, 2, 0.01, o.textAnim.dur) + numRow('textAnim.stagger', 'Décalage (s)', 0, 0.4, 0.005, o.textAnim.stagger) + switchRow('textAnim.out', 'Animer la sortie', o.textAnim.out) : ''}` : ''}
        ${g('in', M.ANIM_IN, 'Entrée')}${o.anim.in ? numRow('inDur', 'Durée entrée (s)', 0.1, 3, 0.05, o.inDur || 0.6) : ''}
        ${g('out', M.ANIM_OUT, 'Sortie')}
        ${g('loop', M.ANIM_LOOP, 'En boucle')}</div>`;
    }
    case 'filters': return `<div class="pad"><div class="fgrid">${M.FILTERS.map((f) => `<button class="ftile ${o.filter.id === f.id ? 'on' : ''}" data-filter="${f.id}"><span class="fsw f-${f.id}"></span>${f.label}</button>`).join('')}</div>
      ${o.filter.id !== 'none' ? numRow('filter.amount', 'Intensité %', 0, 100, 1, o.filter.amount) : ''}</div>`;
    case 'adjust': return `<div class="pad">${M.ADJUST.map(([k, l]) => numRow('adjust.' + k, l, -100, 100, 1, o.adjust[k] || 0)).join('')}<button class="btn block" data-op="resetAdj">Réinitialiser</button></div>`;
    case 'effects': return `<div class="pad"><div class="chips">${M.EFFECTS.map((f) => `<button class="chip ${o.effects.some((x) => x.id === f.id) ? 'on' : ''}" data-effect="${f.id}">${f.label}</button>`).join('')}</div>
      ${o.effects.filter((x) => M.EFFECTS.find((f) => f.id === x.id)?.fx).map((x) => numRow('effect.' + x.id, M.EFFECTS.find((f) => f.id === x.id).label, 0, 100, 1, x.amount)).join('')}
      <div class="hint">Les effets sont calculés par la carte graphique (WebGL). Sur un PC lent, désactivez « Effets dans l'aperçu » : ils resteront appliqués à l'export.</div></div>`;
    case 'trans': {
      const c = info.kind === 'trans' ? o : o;
      const cur = c.transition?.type || null;
      return `<div class="pad"><div class="chips">${[[null, 'Aucune'], ...M.TRANSITIONS.map(([id, l]) => [id, l])].map(([id, l]) => `<button class="chip ${cur === id ? 'on' : ''}" data-trans="${id ?? ''}">${l}</button>`).join('')}</div>
        ${cur ? numRow('transition.dur', 'Durée (s)', 0.1, 2, 0.05, c.transition.dur) + '<button class="btn block" data-op="transAll">Appliquer à tous les clips</button>' : ''}</div>`;
    }
    case 'text': return `<div class="pad">
      <textarea class="fld" data-k="text" rows="2">${esc(o.text)}</textarea>
      ${selectRow('style.font', 'Police', o.style.font, [...E.FONTS, ...(St.p.fonts || []).map((f) => [`"${f.name}"`, f.name])])}
      <button class="btn block" data-imp="font">Importer une police (.ttf / .otf)</button>
      ${numRow('style.size', 'Taille', 10, Math.round(Math.min(p.width, p.height) * 0.4), 1, o.style.size)}
      ${colorRow('style.color', 'Couleur', o.style.color)}
      ${segRow('style.align', 'Alignement', o.style.align, [['left', 'Gauche'], ['center', 'Centre'], ['right', 'Droite']])}
      ${selectRow('style.weight', 'Graisse', o.style.weight, [['400', 'Normal'], ['600', 'Semi-gras'], ['800', 'Gras'], ['900', 'Très gras']])}
      ${switchRow('style.italic', 'Italique', o.style.italic)}
      ${numRow('style.tracking', 'Espacement', -10, 60, 0.5, o.style.tracking)}
      ${numRow('style.leading', 'Interligne', 0.7, 2.5, 0.05, o.style.leading)}
      ${numRow('dur', 'Durée (s)', 0.1, 120, 0.1, o.dur)}</div>`;
    case 'tstyle': return `<div class="pad"><div class="grid">${M.TEXT_STYLES.map((s) => `<button class="tile tstyle ${o.styleId === s.id ? 'on' : ''}" data-tstyle="${s.id}"><span style="${styleCss(s)}">Aa</span><small>${s.label}</small></button>`).join('')}</div>
      ${numRow('style.strokeW', 'Contour', 0, 30, 0.5, o.style.strokeW)}${colorRow('style.stroke', 'Couleur contour', o.style.stroke)}
      ${switchRow('style.bgOn', 'Fond', o.style.bgOn)}${o.style.bgOn ? colorRow('style.bg', 'Couleur du fond', o.style.bg) : ''}
      ${switchRow('style.gradOn', 'Dégradé', o.style.gradOn)}${o.style.gradOn ? colorRow('style.color2', 'Couleur 2', o.style.color2) : ''}
      ${switchRow('shadow', 'Ombre', !!o.shadow)}
      ${switchRow('glowOn', 'Lueur', !!o.glow)}${o.glow ? colorRow('glow', 'Couleur lueur', o.glow) : ''}
      ${numRow('style.depth', 'Relief 3D', 0, 40, 1, o.style.depth)}${o.style.depth ? colorRow('style.depthColor', 'Couleur relief', o.style.depthColor) : ''}</div>`;
  }
  return '';
}

function projectHtml() {
  const p = St.p, b = p.bg;
  const f = M.FORMATS.find((x) => x.w === p.width && x.h === p.height);
  return `<div class="pad">
    <h4>Format</h4><button class="btn block" data-op="format">${f ? `${f.label} · ${f.sub}` : `${p.width}×${p.height}`} — changer</button>
    <h4>Arrière-plan</h4>
    ${segRow('bg.type', 'Type', b.type, [['blur', 'Flou'], ['color', 'Couleur']])}
    ${b.type === 'blur' ? numRow('bg.blur', 'Intensité du flou', 5, 120, 1, b.blur) : colorRow('bg.color', 'Couleur', b.color)}
    <h4>Images par seconde</h4>
    <div class="chips">${[24, 25, 30, 60].map((n) => `<button class="chip ${p.fps === n ? 'on' : ''}" data-fps="${n}">${n} i/s</button>`).join('')}</div>
    <div class="hint">Durée totale : <b>${fmtT(St.C.duration)}</b> · ${p.main.length} clip${p.main.length > 1 ? 's' : ''} · ${p.tracks.reduce((a, t) => a + t.items.length, 0)} élément(s) sur d'autres pistes.</div>
    <h4>Raccourcis</h4><div class="hint">Espace lecture · S couper · Suppr supprimer · Ctrl+D dupliquer · Ctrl+Z annuler · ← → image par image · + / − zoom timeline · Ctrl+E exporter</div></div>`;
}

// Met à jour les valeurs animables quand la tête de lecture bouge.
export function refreshValues() {
  const info = selInfo();
  if (!info?.obj.props) return;
  for (const row of $$('.row[data-k^="props."]')) {
    const n = row.dataset.k.slice(6);
    const v = E.getProp(info.obj, n, localT(info));
    const [r, num] = row.querySelectorAll('input');
    if (num && document.activeElement !== num) num.value = fmtNum(v);
    if (r) r.value = v;
    const kb = row.querySelector('.kfb');
    if (kb) { kb.classList.toggle('anim', !!info.obj.kf?.[n]?.length); kb.classList.toggle('at', E.hasKeyAt(info.obj, n, localT(info))); }
  }
}

// ---------- Événements ----------
function setPath(o, path, v) {
  const parts = path.split('.');
  let q = o;
  for (let i = 0; i < parts.length - 1; i++) q = q[parts[i]] ??= {};
  q[parts[parts.length - 1]] = v;
}
function applyValue(k, v, live) {
  const info = selInfo();
  const p = St.p;
  if (k.startsWith('bg.')) { setPath(p, k, v); return; }
  if (!info) return;
  const o = info.obj;
  if (k.startsWith('props.')) { App.setProp(info, k.slice(6), v); return; }
  if (k === 'speedv') { if (!live) setSpeed(o, v); return; }
  if (k.startsWith('effect.')) { const e = o.effects.find((x) => x.id === k.slice(7)); if (e) e.amount = v; return; }
  if (k === 'glowOn') { o.glow = v ? '#d946ef' : null; return; }
  if (k === 'text') { o.text = v; if (!o.sticker) o.name = String(v).split('\n')[0].slice(0, 30) || 'Texte'; return; }
  if (k === 'fit') { o.fit = v; return; }
  if (k === 'dur') { o.dur = Math.max(0.1, v); return; }
  setPath(o, k, v);
  if (k.startsWith('style.')) E.clearTextCache();
}
function setSpeed(o, s) {
  s = E.clamp(s, 0.1, 10);
  const f = (o.speed || 1) / s;
  o.speed = s;
  o.dur = Math.max(0.1, E.roundT(o.dur * f));
  for (const n in o.kf || {}) for (const q of o.kf[n]) q.t = E.roundT(q.t * f);
}

function op(name) {
  const info = selInfo();
  const p = St.p;
  const o = info?.obj;
  switch (name) {
    case 'format': return App.openFormat();
    case 'center': if (o) { App.setProp(info, 'x', p.width / 2); App.setProp(info, 'y', p.height / 2); App.change('Centré'); } return;
    case 'resetT': if (o) { o.kf = {}; o.props = { x: p.width / 2, y: o.caption ? p.height * 0.78 : p.height / 2, scale: o.type === 'media' ? 55 : 100, rotation: 0, opacity: 100 }; App.change('Réinitialisé'); } return;
    case 'clearKf': if (o) { for (const n of Object.keys(o.kf || {})) o.props[n] = E.getProp(o, n, localT(info)); o.kf = {}; App.change('Keyframes effacées'); } return;
    case 'resetAdj': if (o) { o.adjust = { bright: 0, contrast: 0, sat: 0, temp: 0, hue: 0 }; App.change(); } return;
    case 'transAll': if (o?.transition) { for (const c of p.main.slice(0, -1)) c.transition = { ...o.transition }; App.change('Transition appliquée à tous les clips'); } return;
    case 'extract': if (o) {
      const it = M.newAudioItem(p.media.find((m) => m.id === o.mediaId) || { id: o.mediaId, name: o.name, dur: o.srcDur }, info.start);
      Object.assign(it, { name: o.name + ' (audio)', trim: o.trim, dur: o.dur, speed: o.speed, volume: o.volume, fadeIn: o.fadeIn, fadeOut: o.fadeOut });
      o.muted = true;
      App.freeTrack('audio', it.start, it.dur).items.push(it);
      App.change('Audio extrait sur une piste séparée');
    } return;
  }
}

async function onClick(e) {
  const t = e.target;
  const q = (s) => t.closest(s);
  if (q('[data-close-drawer]')) return App.closeDrawer();
  let b;
  if ((b = q('[data-ltab]'))) { St.ltab = b.dataset.ltab; St.replacing = false; return renderPanels(); }
  if ((b = q('[data-ptab]'))) { St.ptab = b.dataset.ptab; return renderPanels(); }
  if ((b = q('[data-dest]'))) { e.preventDefault(); St.libDest = b.dataset.dest; return renderPanels(); }
  if (q('[data-cancelrep]')) { e.preventDefault(); St.replacing = false; return renderPanels(); }
  if ((b = q('[data-imp]'))) {
    const inp = $('#fileIn');
    inp.accept = b.dataset.imp === 'audio' ? 'audio/*,.mp3,.m4a,.wav,.aac,.ogg' : b.dataset.imp === 'font' ? '.ttf,.otf,.woff,.woff2' : 'video/*,image/*,.svg';
    inp.dataset.dest = b.dataset.imp === 'audio' ? 'audio' : b.dataset.imp === 'font' ? '' : (St.libDest || 'main');
    inp.click();
    return;
  }
  if (q('[data-voice]')) return App.recordVoice();
  if ((b = q('[data-mid]'))) {
    const m = St.p.media.find((x) => x.id === b.dataset.mid);
    if (!m) return;
    if (!App.media.has(m.id)) return toast('Ce média n\'est plus disponible sur cet appareil', 3000, 'err');
    if (St.replacing) { St.replacing = false; App.replaceMedia(m); return; }
    if (m.kind === 'audio') App.addAudio(m);
    else if (St.libDest === 'overlay') App.addOverlay(m);
    else App.addToMain(m);
    if (!St.desktop) App.closeDrawer();
    return;
  }
  if ((b = q('[data-addtext]'))) {
    const it = M.newTextItem(St.p, St.t, { text: 'Votre texte' });
    applyTextStyle(it, b.dataset.addtext);
    App.addItem('text', it, 'Texte ajouté');
    St.ptab = 'text';
    if (!St.desktop) { St.drawer = 'props'; renderPanels(); }
    return;
  }
  if ((b = q('[data-sticker]'))) { App.addItem('text', M.newSticker(St.p, St.t, b.dataset.sticker), 'Sticker ajouté'); if (!St.desktop) App.closeDrawer(); return; }
  if ((b = q('[data-cap]'))) return captionOp(b.dataset.cap);
  if ((b = q('[data-capstyle]'))) { for (const tr of St.p.tracks) if (tr.type === 'caption') for (const it of tr.items) applyTextStyle(it, b.dataset.capstyle); return App.change('Style appliqué aux sous-titres'); }
  if ((b = q('[data-capgo]'))) { const it = St.p.tracks.flatMap((x) => x.items).find((x) => x.id === b.dataset.capgo); if (it) { App.setTime(it.start + 0.01); App.select({ kind: 'item', id: it.id }); } return; }
  const info = selInfo();
  if ((b = q('[data-op]'))) return op(b.dataset.op);
  if ((b = q('[data-fps]'))) { St.p.fps = +b.dataset.fps; return App.change(); }
  if (!info) {
    if ((b = q('.seg button[data-v]'))) { applyValue(b.closest('[data-k]').dataset.k, b.dataset.v); return App.change(); }
    return;
  }
  const o = info.obj;
  if ((b = q('.kfb'))) {
    const n = b.closest('[data-k]').dataset.k.slice(6);
    const lt = localT(info);
    o.kf ||= {};
    if (E.hasKeyAt(o, n, lt)) E.removeKey(o, n, lt); else E.setKey(o, n, lt, E.getProp(o, n, lt));
    return App.change(undefined, { panels: false }), refreshValues();
  }
  if ((b = q('.seg button[data-v]'))) { applyValue(b.closest('[data-k]').dataset.k, b.dataset.v); return App.change(); }
  if ((b = q('[data-speed]'))) { setSpeed(o, +b.dataset.speed); return App.change(`Vitesse ${b.dataset.speed}×`); }
  if ((b = q('[data-anim]'))) { o.anim[b.dataset.anim] = b.dataset.v || null; App.change(); return preview(info, b.dataset.anim); }
  if ((b = q('[data-tanim]'))) { o.textAnim.type = b.dataset.tanim; if (o.textAnim.type === 'typewriter') { o.textAnim.dur = 0.05; o.textAnim.stagger = 0.06; } else if (o.textAnim.dur < 0.15) { o.textAnim.dur = 0.4; o.textAnim.stagger = 0.04; } E.clearTextCache(); App.change(); return preview(info, 'in'); }
  if ((b = q('[data-filter]'))) { o.filter.id = b.dataset.filter; return App.change(); }
  if ((b = q('[data-effect]'))) { const id = b.dataset.effect; const i = o.effects.findIndex((x) => x.id === id); if (i >= 0) o.effects.splice(i, 1); else o.effects.push({ id, amount: 50 }); return App.change(); }
  if ((b = q('[data-trans]')) && t.closest('.pscroll')) { const v = b.dataset.trans; o.transition = v ? { type: v, dur: o.transition?.dur || 0.5 } : null; App.change(); const lay = M.mainLayout(St.p).items; const nx = lay[info.index + 1]; if (nx && v) { App.setTime(Math.max(0, nx.start - 0.6)); St.stopAt = nx.start + 1; App.setPlaying(true); } return; }
  if ((b = q('[data-tstyle]'))) { applyTextStyle(o, b.dataset.tstyle); return App.change(); }
}
function applyTextStyle(it, id) {
  const s = M.TEXT_STYLES.find((x) => x.id === id);
  if (!s) return;
  it.styleId = id;
  Object.assign(it.style, { strokeW: 0, bgOn: false, gradOn: false, italic: false, depth: 0, font: E.FONTS[0][0] }, s.style);
  if (it.caption) it.style.bgPad = Math.round(it.style.size * 0.3);
  it.glow = s.glow || null;
  E.clearTextCache();
}
function preview(info, which) {
  const a = which === 'out' ? Math.max(info.start, info.end - 1.2) : info.start;
  App.setTime(a);
  St.stopAt = which === 'out' ? info.end : Math.min(info.end, info.start + 1.6);
  App.setPlaying(true);
}

async function captionOp(kind) {
  const p = St.p;
  if (kind === 'add') {
    const it = M.newTextItem(p, St.t, { caption: true, text: 'Sous-titre', dur: 2 });
    applyTextStyle(it, 'outline');
    it.shadow = true;
    App.addItem('caption', it, 'Sous-titre ajouté');
    St.ltab = 'captions';
    return renderPanels();
  }
  if (kind === 'import') { const inp = $('#srtIn'); inp.click(); return; }
  if (kind === 'export') {
    const caps = p.tracks.filter((t) => t.type === 'caption').flatMap((t) => t.items);
    const blob = new Blob([M.toSRT(caps)], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `${p.name}.srt`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }
}

export function initPanels() {
  for (const el of [$('#left'), $('#right'), $('#drawer')]) {
    el.addEventListener('click', onClick);
    el.addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset.captext) {
        const it = St.p.tracks.flatMap((x) => x.items).find((x) => x.id === t.dataset.captext);
        if (it) { it.text = t.value; it.name = t.value.slice(0, 30); App.recompile(); }
        return;
      }
      const row = t.closest('[data-k]');
      if (!row) return;
      const k = t.dataset.k || row.dataset.k;
      const v = readInput(t);
      if (typeof v === 'number' && Number.isNaN(v)) return;
      if (t.type === 'range') { const n = row.querySelector('.nv'); if (n) n.value = fmtNum(v); }
      if (t.type === 'number') { const r = row.querySelector('input[type=range]'); if (r) r.value = v; }
      applyValue(k, v, true);
      App.recompile();
    });
    el.addEventListener('change', (e) => {
      const t = e.target;
      if (t.dataset.captext) { App.change(undefined, { panels: false }); return; }
      const row = t.closest('[data-k]');
      if (!row) return;
      const k = t.dataset.k || row.dataset.k;
      const v = readInput(t);
      if (typeof v === 'number' && Number.isNaN(v)) return;
      applyValue(k, v, false);
      const rebuild = ['style.bgOn', 'style.gradOn', 'glowOn', 'style.depth', 'bg.type', 'speedv', 'dur', 'start', 'textAnim.out'].includes(k) || k.startsWith('transition');
      App.change(undefined, { panels: rebuild });
    });
  }
  $('#fileIn').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    const dest = e.target.dataset.dest || null;
    e.target.value = '';
    if (!files.length) return;
    await App.importFiles(files, dest || null);
    if (!St.desktop && dest) App.closeDrawer();
  });
  $('#srtIn').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const caps = M.parseSRT(await f.text());
    if (!caps.length) return toast('Aucun sous-titre trouvé dans ce fichier', 3000, 'err');
    let tr = St.p.tracks.find((t) => t.type === 'caption');
    if (!tr) { tr = { id: M.uid(), type: 'caption', name: 'Sous-titres', items: [] }; St.p.tracks.push(tr); }
    for (const c of caps) {
      const it = M.newTextItem(St.p, c.start, { caption: true, text: c.text, dur: Math.max(0.2, c.end - c.start) });
      applyTextStyle(it, 'outline');
      it.shadow = true;
      tr.items.push(it);
    }
    App.change(`${caps.length} sous-titres importés`);
  });
  void toHex; void esc;
}
