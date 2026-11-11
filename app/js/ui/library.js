// Médiathèque, ajout d'éléments, modèles et générateur de texte cinétique.
import * as E from '../engine.js';
import * as DB from '../storage.js';
import { TEMPLATES, FORMATS, projectFromTemplate, kineticLayers, KINETIC_STYLES } from '../templates.js';
import { S, A, $, esc, P, selLayer, toast, fmtT, ICON, numRow, selectRow } from '../state.js';

const pane = () => $('.pane[data-pane=library]');
const KIND_LABEL = { image: 'Image', video: 'Vidéo', audio: 'Audio', font: 'Police' };

export function buildLibrary() {
  const el = pane();
  if (!el) return;
  const sub = S.desktop ? '' : `<div class="subtabs">${[['media', 'Médias'], ['add', 'Ajouter'], ['templates', 'Modèles']].map(([id, l]) => `<button data-ltab="${id}" class="${S.ltab === id ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  el.innerHTML = sub + (S.ltab === 'add' ? addHtml() : S.ltab === 'templates' ? templatesHtml() : mediaHtml());
}

// ---------- Médias ----------
function usage(id) { return P().layers.filter((l) => l.style.mediaId === id).length; }
function mediaHtml() {
  const list = P().media.filter((m) => m.kind !== 'font');
  return `<div class="sect pad">
      <button class="btn pri block" data-lib="import">${ICON.plus} Importer des médias</button>
      <div class="hint">Vidéos, images, logos (SVG, PNG), fichiers audio. Sur ordinateur, vous pouvez aussi glisser-déposer des fichiers.</div>
    </div>
    ${list.length ? `<div class="mgrid">${list.map((m) => {
      const loaded = A.media.has(m.id);
      const thumb = m.kind === 'image' && loaded ? A.media.get(m.id).url : m.thumb || '';
      const n = usage(m.id);
      return `<button class="mcard ${S.libSel === m.id ? 'on' : ''}" data-mid="${m.id}">
        <span class="mth ${m.kind}" style="${thumb ? `background-image:url('${thumb}')` : ''}">${!thumb ? ICON[m.kind] || '' : ''}${m.dur ? `<i class="dur">${fmtT(m.dur)}</i>` : ''}${!loaded ? '<i class="miss">absent</i>' : ''}</span>
        <span class="mnm">${esc(m.name)}</span><span class="mmeta">${KIND_LABEL[m.kind]}${m.w ? ` · ${m.w}×${m.h}` : ''}${n ? ` · utilisé ×${n}` : ''}</span></button>`;
    }).join('')}</div>` : '<div class="empty"><b>Médiathèque vide</b>Importez des vidéos, images ou sons pour les utiliser dans vos compositions.</div>'}
    ${S.libSel && list.find((m) => m.id === S.libSel) ? mediaActions(list.find((m) => m.id === S.libSel)) : ''}`;
}
function mediaActions(m) {
  const L = selLayer();
  const compatible = L && ((m.kind === 'image' && L.type === 'image') || (m.kind === 'video' && L.type === 'video') || (m.kind === 'audio' && L.type === 'audio'));
  return `<div class="sect pad mact">
    <b>${esc(m.name)}</b>
    <div class="actions flat">
      <button class="act" data-lib="addTl">${ICON.plus}Ajouter à la timeline</button>
      <button class="act" data-lib="replace" ${compatible ? '' : 'disabled'}>${ICON.replace}Remplacer le calque</button>
      <button class="act" data-lib="rename">${ICON.text}Renommer</button>
      <button class="act danger" data-lib="delete">${ICON.del}Supprimer</button>
    </div>
    ${!compatible ? '<div class="hint">« Remplacer » : sélectionnez d\'abord un calque du même type.</div>' : ''}</div>`;
}

// Informations d'une vidéo / d'un son : dimensions, durée, vignette.
function mediaInfo(url, kind) {
  return new Promise((res) => {
    if (kind === 'image') { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => res({}); im.src = url; return; }
    const el = document.createElement(kind === 'video' ? 'video' : 'audio');
    el.muted = true; el.preload = 'auto'; el.playsInline = true; el.setAttribute('playsinline', '');
    const done = (info) => { el.removeAttribute('src'); el.load(); res(info); };
    const to = setTimeout(() => done({ dur: el.duration || 0 }), 8000);
    el.onerror = () => { clearTimeout(to); res({ error: true }); };
    el.onloadedmetadata = () => {
      if (kind !== 'video') { clearTimeout(to); done({ dur: el.duration }); return; }
      el.currentTime = Math.min(0.5, (el.duration || 1) / 3);
    };
    el.onseeked = () => {
      clearTimeout(to);
      let thumb = '';
      try {
        const c = document.createElement('canvas');
        const k = 220 / Math.max(el.videoWidth, el.videoHeight);
        c.width = Math.round(el.videoWidth * k); c.height = Math.round(el.videoHeight * k);
        c.getContext('2d').drawImage(el, 0, 0, c.width, c.height);
        thumb = c.toDataURL('image/jpeg', 0.7);
      } catch {}
      done({ w: el.videoWidth, h: el.videoHeight, dur: el.duration, thumb });
    };
    el.src = url;
  });
}

function kindOf(f) {
  if (/\.(ttf|otf|woff2?)$/i.test(f.name) || f.type.startsWith('font/')) return 'font';
  if (f.type.startsWith('image/') || /\.svg$/i.test(f.name)) return 'image';
  if (f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(f.name)) return 'video';
  if (f.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(f.name)) return 'audio';
  return null;
}

export async function importFiles(files, addToTimeline = false) {
  const p = P();
  let added = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const kind = kindOf(f);
    if (!kind) { toast(`Format non pris en charge : ${f.name}`, 3000, 'err'); continue; }
    A.busy(`Import de ${f.name} (${i + 1}/${files.length})…`);
    try {
      const id = E.uid();
      const name = f.name.replace(/\.[^.]+$/, '').replace(/["']/g, '').slice(0, 40) || KIND_LABEL[kind];
      const blob = f.type === 'image/svg+xml' || /\.svg$/i.test(f.name) ? new Blob([await f.arrayBuffer()], { type: 'image/svg+xml' }) : f;
      await DB.saveMedia({ id, kind, name, blob });
      if (kind === 'font') {
        await A.attachMedia({ id, kind, name, blob });
        p.fonts.push({ id, name });
        const L = selLayer();
        if (L && L.type === 'text') { L.style.font = `"${name}"`; E.clearTextCache(); }
        toast(`Police « ${name} » importée`);
        added++;
        continue;
      }
      const m = await A.attachMedia({ id, kind, name, blob });
      const info = await mediaInfo(m.url, kind);
      if (info.error) { toast(`${f.name} : fichier illisible sur ce navigateur`, 3500, 'err'); continue; }
      const entry = { id, kind, name, w: info.w || 0, h: info.h || 0, dur: info.dur && isFinite(info.dur) ? info.dur : 0, thumb: info.thumb || '' };
      p.media.push(entry);
      if (addToTimeline) addMediaLayer(entry, false);
      added++;
    } catch (e) {
      console.error(e);
      toast(`Échec de l'import de ${f.name} : ${e.message}`, 4000, 'err');
    }
  }
  A.busy(null);
  if (added) { A.commit(`${added} fichier${added > 1 ? 's' : ''} importé${added > 1 ? 's' : ''}`); A.refreshVisible(); }
}

function addMediaLayer(m, commit = true) {
  const p = P();
  const kind = m.kind;
  let L;
  if (kind === 'audio') {
    L = E.newLayer(p, 'audio', { name: m.name, style: { mediaId: m.id } });
  } else {
    const nw = m.w || p.width, nh = m.h || p.height;
    const k = Math.min(p.width / nw, p.height / nh);
    L = E.newLayer(p, kind, { name: m.name, style: { mediaId: m.id, w: Math.round(nw * k), h: Math.round(nh * k) } });
  }
  L.start = kind === 'image' ? 0 : S.t;
  if (m.dur) {
    if (S.t + m.dur > p.duration) {
      p.duration = Math.min(600, Math.ceil((S.t + m.dur) * 10) / 10);
      for (const l of p.layers) if (l.type === 'solid' || l.type === 'adjust') l.end = Math.max(l.end, p.duration);
      toast(`Durée de la composition étendue à ${p.duration.toFixed(1)} s`);
      A.refreshAll();
    }
    L.end = E.roundT(S.t + m.dur);
  } else L.end = p.duration;
  if (commit) A.addLayer(L);
  else { p.layers.unshift(L); S.sel = L.id; S.multi = new Set([L.id]); A.ensureElements(); }
}

async function libAction(a) {
  const p = P();
  const m = p.media.find((x) => x.id === S.libSel);
  if (a === 'import') { $('#fileMedia').click(); return; }
  if (!m) return;
  if (!A.media.has(m.id) && a !== 'delete' && a !== 'rename') { toast('Ce média n\'est plus disponible sur cet appareil', 3000, 'err'); return; }
  if (a === 'addTl') { addMediaLayer(m); A.showTab('props'); return; }
  if (a === 'replace') {
    const L = selLayer();
    L.style.mediaId = m.id;
    if (m.w && L.style.w) { const k = Math.min(L.style.w / m.w, L.style.h / m.h); L.style.w = Math.round(m.w * k); L.style.h = Math.round(m.h * k); }
    A.ensureElements();
    A.commit('Média remplacé');
    A.refreshVisible(); A.requestRender();
    return;
  }
  if (a === 'rename') { const n = prompt('Nouveau nom', m.name); if (n) { m.name = n.trim(); A.commit(); buildLibrary(); } return; }
  if (a === 'delete') {
    const n = usage(m.id);
    if (!confirm(n ? `Ce média est utilisé par ${n} calque(s), qui seront supprimés. Continuer ?` : `Retirer « ${m.name} » de la médiathèque ?`)) return;
    const ids = p.layers.filter((l) => l.style.mediaId === m.id).map((l) => l.id);
    p.media = p.media.filter((x) => x.id !== m.id);
    S.libSel = null;
    if (ids.length) A.deleteLayers(ids); else { A.commit('Média retiré'); buildLibrary(); }
  }
}

// ---------- Ajouter ----------
function addHtml() {
  return `<div class="sect pad"><h4>Texte et formes</h4><div class="grid">
      <button class="tile" data-add="text">${ICON.text}Texte</button>
      <button class="tile" data-add="title">${ICON.title}Titre animé</button>
      <button class="tile" data-add="pill">${ICON.pill}Bulle</button>
      <button class="tile" data-add="rect">${ICON.rect}Rectangle</button>
      <button class="tile" data-add="ellipse">${ICON.ellipse}Cercle</button>
      <button class="tile" data-add="solid">${ICON.solid}Fond uni</button>
      <button class="tile" data-add="grad">${ICON.grad}Dégradé</button>
    </div>
    <h4>Médias</h4><div class="grid">
      <button class="tile" data-add="image">${ICON.image}Image / logo</button>
      <button class="tile" data-add="video">${ICON.video}Vidéo</button>
      <button class="tile" data-add="audio">${ICON.audio}Audio</button>
      <button class="tile" data-add="font">${ICON.font}Police…</button>
    </div>
    <h4>Structure</h4><div class="grid">
      <button class="tile" data-add="null">${ICON.group}Groupe vide</button>
      <button class="tile" data-add="adjust">${ICON.adjust}Calque d'effets</button>
    </div></div>
    <div class="sect pad"><h4>Générateur de texte cinétique</h4>
      <textarea class="fld" id="kinText" placeholder="Tapez une phrase… chaque ligne = un plan">Crée des animations
directement sur ton iPhone
sans ordinateur</textarea>
      ${selectRow('kin.style', 'Style', 'punch', Object.entries(KINETIC_STYLES))}
      ${numRow('kin.speed', 'Vitesse', 0.5, 2, 0.1, 1)}
      <div class="row"><label class="wide">Remplacer les calques existants</label><label class="sw"><input type="checkbox" id="kinReplace"><span></span></label></div>
      <button class="btn pri block" data-add="kinetic">Générer l'animation</button>
    </div>`;
}
function templatesHtml() {
  const bg = { empty: '#222', intro: 'radial-gradient(#fff,#aaa)', neon: 'radial-gradient(#8b5cff,#05040b)', cta: 'linear-gradient(#2b0a6b,#0a0420)', countdown: 'linear-gradient(135deg,#22d3ee,#f472b6)' };
  return `<div class="sect pad">${TEMPLATES.map((t) => `<button class="tpl" data-tpl="${t.id}"><span class="sw2" style="background:${bg[t.id] || '#333'}"></span><span><b>${t.name}</b><small>${t.desc}</small></span></button>`).join('')}
    <div class="hint">Un modèle s'ouvre dans un nouveau projet, au format de la composition actuelle. Votre projet en cours reste enregistré.</div></div>`;
}

async function addAction(b) {
  const p = P();
  const at = (L) => { if (S.t < p.duration - 0.5) { L.start = S.t; L.end = p.duration; } return L; };
  if (b.dataset.tpl) {
    const fmt = FORMATS.find((f) => f.w === p.width && f.h === p.height)?.id || '9x16';
    await A.saveNow();
    const np = projectFromTemplate(b.dataset.tpl, fmt);
    await A.openProject(np, true);
    toast(`Modèle « ${np.name} » ouvert`);
    return;
  }
  const kind = b.dataset.add;
  switch (kind) {
    case 'text': A.addLayer(at(E.newLayer(p, 'text'))); break;
    case 'title': A.addLayer(at(E.newLayer(p, 'text', { style: { text: 'Titre', size: Math.round(p.width * 0.14), weight: '900' }, anim: { type: 'fadeUp', dur: 0.5, stagger: 0.05 } }))); break;
    case 'pill': A.addLayer(at(E.newLayer(p, 'text', { name: 'Bulle', style: { text: 'Commente « GO »', size: Math.round(p.width * 0.055), weight: '700', bgOn: true } }))); break;
    case 'rect': A.addLayer(at(E.newLayer(p, 'rect'))); break;
    case 'ellipse': A.addLayer(at(E.newLayer(p, 'ellipse'))); break;
    case 'solid': A.addLayer(E.newLayer(p, 'solid', { name: 'Fond' }), { at: 'bottom' }); break;
    case 'grad': A.addLayer(E.newLayer(p, 'solid', { name: 'Dégradé', style: { gradOn: true, fill: '#7c3aed', fill2: '#0ea5e9', gradAngle: 120 } }), { at: 'bottom' }); break;
    case 'null': A.addLayer(E.newLayer(p, 'null', { name: 'Groupe' })); break;
    case 'adjust': A.addLayer(E.newLayer(p, 'adjust', { name: 'Calque d\'effets', fx: [E.newEffect('color')] })); A.showTab('effects'); return;
    case 'image': $('#fileMedia').accept = 'image/*,.svg'; $('#fileMedia').dataset.tl = '1'; $('#fileMedia').click(); return;
    case 'video': $('#fileMedia').accept = 'video/*'; $('#fileMedia').dataset.tl = '1'; $('#fileMedia').click(); return;
    case 'audio': $('#fileMedia').accept = 'audio/*,.mp3,.m4a,.wav,.aac'; $('#fileMedia').dataset.tl = '1'; $('#fileMedia').click(); return;
    case 'font': $('#fileMedia').accept = '.ttf,.otf,.woff,.woff2'; $('#fileMedia').dataset.tl = ''; $('#fileMedia').click(); return;
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
      S.sel = null; S.multi = new Set();
      A.ensureElements();
      A.refreshAll();
      A.commit(`${layers.length} plans générés`);
      A.setTime(0); A.setPlaying(true);
      return;
    }
  }
  A.showTab('props');
}

export function initLibrary() {
  const el = pane();
  el.addEventListener('click', async (e) => {
    const st = e.target.closest('[data-ltab]');
    if (st) { S.ltab = st.dataset.ltab; buildLibrary(); return; }
    const card = e.target.closest('[data-mid]');
    if (card) { S.libSel = S.libSel === card.dataset.mid ? null : card.dataset.mid; buildLibrary(); return; }
    const lb = e.target.closest('[data-lib]');
    if (lb) { libAction(lb.dataset.lib); return; }
    const b = e.target.closest('[data-add],[data-tpl]');
    if (b) addAction(b);
  });
  el.addEventListener('input', (e) => {
    const row = e.target.closest('[data-k="kin.speed"]');
    if (!row) return;
    const v = parseFloat(e.target.value);
    if (e.target.type === 'range') row.querySelector('.nv').value = v; else row.querySelector('input[type=range]').value = v;
  });
  const input = $('#fileMedia');
  input.addEventListener('change', () => {
    const files = [...input.files];
    const toTl = input.dataset.tl === '1';
    input.value = '';
    input.accept = 'image/*,video/*,audio/*,.svg,.mp3,.m4a,.wav';
    input.dataset.tl = '';
    if (files.length) importFiles(files, toTl).then(() => { if (toTl) A.showTab('props'); });
  });
}
