// Panneaux Propriétés, Animer et Effets.
import * as E from '../engine.js';
import { fxAvailable } from '../fx.js';
import { PRESETS, PRESET_GROUPS, TRANSITIONS, stretchKeys } from '../presets.js';
import { S, A, $, $$, esc, P, selLayer, layerById, toast, fmtT, fmtNum, toHex, ICON, numRow, colorRow, switchRow, selectRow, segRow, section, readInput } from '../state.js';

const pane = (id) => $(`.pane[data-pane=${id}]`);
const pathOf = (k) => (k.startsWith('p.') ? k.slice(2) : k);

const PROP_UI = {
  x: ['Position X', -1, 2, 1, 'W'], y: ['Position Y', -1, 2, 1, 'H'],
  scale: ['Échelle %', 0, 400, 0.5], stretchX: ['Largeur %', 0, 400, 0.5], stretchY: ['Hauteur %', 0, 400, 0.5],
  rotation: ['Rotation °', -720, 720, 0.5], opacity: ['Opacité %', 0, 100, 1], blur: ['Flou', 0, 100, 0.5],
};
const BLENDS = [['source-over', 'Normal'], ['screen', 'Superposition claire'], ['lighter', 'Addition'], ['multiply', 'Produit'], ['overlay', 'Incrustation'], ['soft-light', 'Lumière douce'], ['hard-light', 'Lumière crue'], ['difference', 'Différence'], ['color-dodge', 'Densité couleur −'], ['color-burn', 'Densité couleur +'], ['hue', 'Teinte'], ['saturation', 'Saturation'], ['color', 'Couleur'], ['luminosity', 'Luminosité']];

const noLayer = (title, msg) => `<div class="empty"><b>${title}</b>${msg}</div>`;

// ---------- Propriétés ----------
export function buildProps() {
  const el = pane('props');
  if (!el) return;
  const L = selLayer();
  const p = P();
  if (!L) {
    el.innerHTML = noLayer('Aucun calque sélectionné', 'Touchez un élément dans l\'aperçu ou dans la timeline.') +
      section('Composition', `${colorRow('c.bg', 'Fond', p.bg)}<button class="btn block" data-act="comp">Réglages de la composition…</button>`, 'comp');
    return;
  }
  const s = L.style;
  const range = (n) => { const u = PROP_UI[n]; const m = u[4] === 'W' ? p.width : u[4] === 'H' ? p.height : 1; return [u[1] * m, u[2] * m]; };
  const tr = E.PROPS.map((n) => { const [mn, mx] = range(n); return numRow('p.' + n, PROP_UI[n][0], mn, mx, PROP_UI[n][3], E.getProp(L, n, S.t), true); }).join('');
  const sv = (k) => E.getProp(L, 's.' + k, S.t);
  let content = '';
  if (L.type === 'text') {
    content = section('Texte', `
      <textarea class="fld" data-k="s.text" rows="2">${esc(s.text)}</textarea>
      ${selectRow('s.font', 'Police', s.font, [...E.FONTS, ...(p.fonts || []).map((f) => [`"${f.name}"`, f.name + ' (importée)'])])}
      ${numRow('s.size', 'Taille', 8, Math.round(p.width * 0.5), 1, sv('size'), true)}
      ${selectRow('s.weight', 'Graisse', s.weight, [['300', 'Light'], ['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold'], ['800', 'Heavy'], ['900', 'Black']])}
      ${switchRow('s.italic', 'Italique', s.italic)}
      ${segRow('s.align', 'Alignement', s.align, [['left', 'Gauche'], ['center', 'Centre'], ['right', 'Droite']])}
      ${numRow('s.tracking', 'Espacement', -20, 200, 0.5, sv('tracking'), true)}
      ${numRow('s.leading', 'Interligne', 0.6, 3, 0.05, s.leading)}`, 'text') +
      section('Remplissage et contour', `
      ${colorRow('s.color', s.gradOn ? 'Couleur 1' : 'Couleur', sv('color'), true)}
      ${switchRow('s.gradOn', 'Dégradé', s.gradOn)}
      ${s.gradOn ? colorRow('s.color2', 'Couleur 2', sv('color2'), true) + numRow('s.gradAngle', 'Angle', 0, 360, 1, sv('gradAngle'), true) : ''}
      ${numRow('s.strokeW', 'Contour', 0, 40, 0.5, sv('strokeW'), true)}
      ${s.strokeW > 0 || E.isAnimated(L, 's.strokeW') ? colorRow('s.stroke', 'Couleur contour', sv('stroke'), true) : ''}
      ${switchRow('s.bgOn', 'Bulle de fond', s.bgOn)}
      ${s.bgOn ? colorRow('s.bg', 'Couleur bulle', sv('bg'), true) + numRow('s.bgPad', 'Marge', 0, 200, 1, s.bgPad) + numRow('s.bgRadius', 'Arrondi', 0, 300, 1, s.bgRadius) : ''}`, 'fill') +
      section('Texte 3D (extrusion)', `
      ${numRow('s.depth', 'Profondeur', 0, 60, 1, sv('depth'), true)}
      ${colorRow('s.depthColor', 'Couleur côté', s.depthColor)}
      ${numRow('s.depthAngle', 'Direction °', 0, 360, 1, s.depthAngle)}
      <div class="hint">Ombres et flou : onglet Effets. Animation lettre par lettre / mot par mot : onglet Animer.</div>`, 'text3d');
  } else if (L.type === 'rect' || L.type === 'ellipse' || L.type === 'solid') {
    content = section(L.type === 'solid' ? 'Fond' : 'Forme', `
      ${L.type !== 'solid' ? numRow('s.w', 'Largeur', 1, p.width * 2, 1, sv('w'), true) + numRow('s.h', 'Hauteur', 1, p.height * 2, 1, sv('h'), true) : ''}
      ${L.type === 'rect' ? numRow('s.radius', 'Arrondi', 0, Math.max(s.w, s.h) / 2, 1, sv('radius'), true) : ''}
      ${colorRow('s.fill', s.gradOn ? 'Couleur 1' : 'Couleur', sv('fill'), true)}
      ${switchRow('s.gradOn', 'Dégradé', s.gradOn)}
      ${s.gradOn ? colorRow('s.fill2', 'Couleur 2', sv('fill2'), true) + segRow('s.gradType', 'Type', s.gradType, [['linear', 'Linéaire'], ['radial', 'Radial']]) + (s.gradType === 'linear' ? numRow('s.gradAngle', 'Angle', 0, 360, 1, sv('gradAngle'), true) : '') : ''}
      ${L.type !== 'solid' ? numRow('s.strokeW', 'Contour', 0, 80, 0.5, sv('strokeW'), true) + (s.strokeW > 0 || E.isAnimated(L, 's.strokeW') ? colorRow('s.stroke', 'Couleur contour', sv('stroke'), true) : '') : ''}`, 'shape');
  } else if (L.type === 'image' || L.type === 'video') {
    const m = A.media.get(s.mediaId);
    content = section(L.type === 'video' ? 'Vidéo' : 'Image', `
      ${numRow('s.w', 'Largeur', 1, p.width * 3, 1, sv('w'), true)}
      ${numRow('s.h', 'Hauteur', 1, p.height * 3, 1, sv('h'), true)}
      <div class="row"><label></label><div class="seg"><button data-act="fit">Ajuster</button><button data-act="fill">Remplir</button><button data-act="native">Taille réelle</button></div></div>
      ${numRow('s.radius', 'Arrondi', 0, 400, 1, sv('radius'), true)}
      ${!m ? '<div class="hint warn">Média introuvable sur cet appareil : remplacez-le depuis la médiathèque.</div>' : ''}`, 'media');
  } else if (L.type === 'null') {
    const kids = p.layers.filter((l) => l.parent === L.id);
    content = section('Groupe', `
      <div class="hint">Les ${kids.length} calque${kids.length > 1 ? 's' : ''} lié${kids.length > 1 ? 's' : ''} suivent la position, la rotation et l'échelle de ce groupe. Animez le groupe pour animer tout son contenu.</div>
      ${numRow('s.w', 'Largeur repère', 10, p.width, 1, s.w)}${numRow('s.h', 'Hauteur repère', 10, p.height, 1, s.h)}
      <button class="btn block" data-act="ungroup">Dissocier le groupe</button>`, 'group');
  } else if (L.type === 'adjust') {
    content = section('Calque d\'effets', '<div class="hint">Les effets ajoutés à ce calque (onglet <b>Effets</b>) s\'appliquent à tous les calques situés en dessous dans la pile. Le masque limite la zone affectée ; l\'opacité dose l\'effet.</div><button class="btn block" data-act="goFx">Ouvrir les effets</button>', 'adjust');
  }
  if (L.type === 'video' || L.type === 'audio') {
    const m = A.media.get(s.mediaId);
    const el = A.els.get(L.id);
    content += section('Audio et lecture', `
      ${numRow('s.volume', 'Volume %', 0, 200, 1, s.volume ?? 100)}
      ${switchRow('s.muted', 'Muet', s.muted)}
      ${numRow('s.fadeIn', 'Fondu entrée (s)', 0, 10, 0.05, s.fadeIn || 0)}
      ${numRow('s.fadeOut', 'Fondu sortie (s)', 0, 10, 0.05, s.fadeOut || 0)}
      ${numRow('s.speed', 'Vitesse ×', 0.25, 4, 0.05, s.speed || 1)}
      ${numRow('s.trim', 'Début du clip (s)', 0, Math.max(1, el?.duration || 10), 0.01, s.trim || 0)}
      ${!m ? '<div class="hint warn">Média introuvable sur cet appareil.</div>' : ''}`, 'audio');
  }
  const keysHere = Object.keys(L.kf).flatMap((n) => L.kf[n].filter((q) => Math.abs(q.t - S.t) < 0.0015));
  const easeVal = keysHere.length && keysHere.every((q) => q.e === keysHere[0].e) ? keysHere[0].e : '';
  const others = p.layers.filter((x) => x.id !== L.id && E.VISUAL(x) || x.type === 'null' && x.id !== L.id);
  el.innerHTML = `
    <div class="actions">
      <button class="act" data-act="dup">${ICON.dup}Dupliquer</button>
      <button class="act" data-act="split">${ICON.cut}Couper</button>
      <button class="act" data-act="inP">${ICON.inP}Début ici</button>
      <button class="act" data-act="outP">${ICON.outP}Fin ici</button>
      <button class="act" data-act="up">${ICON.up}Devant</button>
      <button class="act" data-act="down">${ICON.down}Derrière</button>
      ${E.VISUAL(L) ? `<button class="act" data-act="center">${ICON.center}Centrer</button>` : ''}
      <button class="act" data-act="lock">${L.locked ? ICON.lock : ICON.unlock}${L.locked ? 'Déverr.' : 'Verrou.'}</button>
      <button class="act danger" data-act="del">${ICON.del}Supprimer</button>
    </div>
    ${section('Calque', `
      <div class="row" data-k="l.name"><label>Nom</label><input type="text" value="${esc(L.name)}"></div>
      ${L.type !== 'audio' ? `<div class="row" data-k="par"><label>${ICON.link} Parent</label><select><option value="">Aucun</option>${others.filter((x) => x.type !== 'audio').map((x) => `<option value="${x.id}" ${L.parent === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>` : ''}
      ${E.VISUAL(L) && L.type !== 'adjust' ? selectRow('s.blend', 'Fusion', s.blend, BLENDS) : ''}
      <div class="row"><label>Durée</label><span class="hint">${fmtT(L.start)} → ${fmtT(L.end)} (${(L.end - L.start).toFixed(2)} s)</span></div>`, 'layer')}
    ${L.type !== 'audio' ? section('Transformation', `${tr}
      ${numRow('s.anchorX', 'Ancrage X %', 0, 100, 1, sv('anchorX'), true)}
      ${numRow('s.anchorY', 'Ancrage Y %', 0, 100, 1, sv('anchorY'), true)}
      <div class="row" id="easeRow" data-k="k.ease"><label>Interpolation</label>
        <select ${keysHere.length ? '' : 'disabled'}><option value="">${keysHere.length ? '— mixte —' : 'Aucune keyframe ici'}</option>
        ${Object.entries(E.EASE_LABELS).filter(([v]) => v !== 'bezier').map(([v, l]) => `<option value="${v}" ${v === easeVal ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="hint">◆ crée une keyframe à la tête de lecture. Courbes Bézier : timeline → Courbes.</div>`, 'transform', '◆ keyframes') : ''}
    ${content}
    ${E.VISUAL(L) && L.type !== 'null' ? section('Masque (volet)', `
      ${numRow('s.clipL', 'Gauche %', 0, 100, 0.5, sv('clipL'), true)}
      ${numRow('s.clipR', 'Droite %', 0, 100, 0.5, sv('clipR'), true)}
      ${numRow('s.clipT', 'Haut %', 0, 100, 0.5, sv('clipT'), true)}
      ${numRow('s.clipB', 'Bas %', 0, 100, 0.5, sv('clipB'), true)}
      <div class="hint">Animez ces valeurs pour créer des volets et révélations.</div>`, 'mask') : ''}
    <div class="sect pad"><button class="btn block danger" data-act="clearKf">Effacer toutes les keyframes du calque</button></div>`;
  refreshPropValues();
}

// Met à jour les valeurs affichées (sans reconstruire) — appelé quand la tête de lecture bouge.
export function refreshPropValues() {
  const L = selLayer();
  if (!L) return;
  for (const row of $$('.pane[data-pane=props] .row[data-k], .pane[data-pane=effects] .row[data-k]')) {
    const k = row.dataset.k;
    if (!(k.startsWith('p.') || k.startsWith('s.') || k.startsWith('fx.'))) continue;
    const path = pathOf(k);
    const kb = row.querySelector('.kfb');
    const v = E.getProp(L, path, S.t);
    const inputs = row.querySelectorAll('input');
    if (inputs.length === 2 && typeof v === 'number') {
      if (document.activeElement !== inputs[1]) inputs[1].value = fmtNum(v);
      inputs[0].value = v;
    } else if (inputs.length === 1 && inputs[0].type === 'color' && typeof v === 'string') inputs[0].value = toHex(v);
    if (kb) { kb.classList.toggle('anim', E.isAnimated(L, path)); kb.classList.toggle('at', E.hasKeyAt(L, path, S.t)); }
  }
  const er = $('#easeRow select');
  if (er) {
    const keysHere = Object.keys(L.kf).flatMap((n) => L.kf[n].filter((q) => Math.abs(q.t - S.t) < 0.0015));
    er.disabled = !keysHere.length;
    er.options[0].textContent = keysHere.length ? '— mixte —' : 'Aucune keyframe ici';
    er.value = keysHere.length && keysHere.every((q) => q.e === keysHere[0].e) && keysHere[0].e !== 'bezier' ? keysHere[0].e : '';
  }
}

const REBUILD = new Set(['s.gradOn', 's.gradType', 's.bgOn', 's.strokeW', 's.font', 's.muted']);

function applyKey(k, v) {
  const L = selLayer();
  if (k.startsWith('c.')) { P()[k.slice(2)] = v; return; }
  if (!L) return;
  if (k.startsWith('p.') || k.startsWith('s.') || k.startsWith('fx.')) {
    A.setVal(L, pathOf(k), v);
    if (k === 's.text' && !L._named) L.name = String(v).split('\n')[0].slice(0, 24) || 'Texte';
    if (k === 's.font' || k === 's.text') E.clearTextCache();
  } else if (k.startsWith('a.')) L.anim[k.slice(2)] = v;
  else if (k === 'l.name') { L.name = v; L._named = true; }
  else if (k === 'k.ease' && v) { for (const n in L.kf) for (const q of L.kf[n]) if (Math.abs(q.t - S.t) < 0.0015) { q.e = v; delete q.b; } }
}

// Gestion d'événements commune aux trois panneaux.
function wire(el, onAction) {
  el.addEventListener('input', (e) => {
    const t = e.target;
    const row = t.closest('[data-k]');
    if (!row) return;
    const k = t.dataset.k || row.dataset.k;
    if (k === 'par' || k === 'k.ease' || k.startsWith('fxon.')) return;
    const v = readInput(t);
    if (typeof v === 'number' && Number.isNaN(v)) return;
    if (t.type === 'range') { const n = row.querySelector('.nv'); if (n) n.value = fmtNum(v); }
    if (t.type === 'number') { const r = row.querySelector('input[type=range]'); if (r) r.value = v; }
    applyKey(k, v);
    const L = selLayer();
    const kb = row.querySelector('.kfb');
    if (kb && L) kb.classList.toggle('at', E.hasKeyAt(L, pathOf(k), S.t));
    if (k === 's.text' || k === 'l.name') { const r = $(`.tl-row[data-id="${S.sel}"] .nm`); if (r) r.textContent = L.name; }
    A.requestRender();
  });
  el.addEventListener('change', (e) => {
    const row = e.target.closest('[data-k]');
    if (!row) return;
    const k = e.target.dataset.k || row.dataset.k;
    const L = selLayer();
    if (k === 'par' && L) { if (A.setParent(L, e.target.value)) { A.commit('Parent modifié'); A.refreshVisible(); } else e.target.value = L.parent || ''; A.requestRender(); return; }
    if (k === 'k.ease') { applyKey(k, e.target.value); A.commit(); A.refreshVisible(); A.requestRender(); return; }
    if (k.startsWith('fxon.') && L) { const f = L.fx.find((x) => x.id === k.slice(5)); if (f) f.on = e.target.checked; A.commit(); A.requestRender(); return; }
    A.commit();
    if ((k.startsWith('p.') || k.startsWith('s.') || k.startsWith('fx.')) && L && E.isAnimated(L, pathOf(k))) A.refreshTimeline();
    if (REBUILD.has(k)) { E.clearTextCache(); A.refreshInspector(); }
    if (k === 'l.name' || k === 's.text' || k.startsWith('s.') && (k === 's.speed' || k === 's.trim' || k === 's.volume')) A.refreshVisible();
    A.requestRender();
  });
  el.addEventListener('click', (e) => {
    const seg = e.target.closest('.seg button[data-v]');
    if (seg) {
      const row = seg.closest('[data-k]');
      applyKey(row.dataset.k, seg.dataset.v);
      $$('button', row).forEach((b) => b.classList.toggle('on', b === seg));
      A.commit(); A.requestRender();
      if (row.dataset.k === 's.gradType') A.refreshInspector();
      return;
    }
    const kb = e.target.closest('.kfb');
    if (kb) {
      const L = selLayer();
      if (!L) return;
      const path = pathOf(kb.closest('[data-k]').dataset.k);
      if (E.hasKeyAt(L, path, S.t)) E.removeKey(L, path, S.t); else E.setKey(L, path, S.t, E.getProp(L, path, S.t));
      refreshPropValues(); A.refreshVisible(); A.commit();
      return;
    }
    onAction(e);
  });
}

function layerAction(e) {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const L = selLayer();
  const p = P();
  const act = b.dataset.act;
  if (act === 'comp') return A.openCompSettings();
  if (!L) return;
  switch (act) {
    case 'dup': return A.duplicateLayers([L.id]);
    case 'split': return A.splitLayer(L);
    case 'del': return A.deleteLayers([...new Set([L.id, ...S.multi])]);
    case 'inP': if (S.t < L.end) { L.start = S.t; A.refreshVisible(); A.commit(); } break;
    case 'outP': if (S.t > L.start) { L.end = S.t; A.refreshVisible(); A.commit(); } break;
    case 'up': case 'down': {
      const i = p.layers.indexOf(L), j = act === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= p.layers.length) return;
      [p.layers[i], p.layers[j]] = [p.layers[j], p.layers[i]];
      A.refreshVisible(); A.commit();
      break;
    }
    case 'center': {
      const { m, w, h } = E.worldMatrix(p, L, S.t);
      const c = m.transformPoint(new DOMPoint(w / 2, h / 2));
      A.setVal(L, 'x', E.getProp(L, 'x', S.t) + (p.width / 2 - c.x));
      A.setVal(L, 'y', E.getProp(L, 'y', S.t) + (p.height / 2 - c.y));
      refreshPropValues(); A.refreshVisible(); A.commit();
      break;
    }
    case 'lock': L.locked = !L.locked; A.refreshVisible(); A.commit(); break;
    case 'ungroup': return A.ungroup(L);
    case 'goFx': return A.showTab('effects');
    case 'clearKf': if (confirm('Effacer toutes les keyframes de ce calque ?')) { E.clearKeys(L, S.t); A.refreshVisible(); A.commit('Keyframes effacées'); } break;
    case 'fit': case 'fill': case 'native': {
      const m = A.media.get(L.style.mediaId);
      const el = L.type === 'video' ? A.els.get(L.id) : m?.el;
      const nw = el?.naturalWidth || el?.videoWidth || L.style.w, nh = el?.naturalHeight || el?.videoHeight || L.style.h;
      const k = act === 'native' ? 1 : (act === 'fit' ? Math.min : Math.max)(p.width / nw, p.height / nh);
      L.style.w = Math.round(nw * k); L.style.h = Math.round(nh * k);
      A.refreshInspector(); A.commit();
      break;
    }
  }
  A.requestRender();
}

// ---------- Animer ----------
export function buildAnimate() {
  const el = pane('animate');
  if (!el) return;
  const L = selLayer();
  if (!L) { el.innerHTML = noLayer('Sélectionnez un calque', 'Les animations s\'appliquent à partir de la tête de lecture ; les transitions aux bords du calque.'); return; }
  const a = L.anim;
  const textSect = L.type === 'text' ? section('Animateur de texte', `
    <div class="grid">${Object.entries(E.TEXT_ANIMS).map(([v, l]) => `<button class="tile sm ${a.type === v ? 'on' : ''}" data-tanim="${v}">${l}</button>`).join('')}</div>
    ${a.type !== 'none' ? `<div class="mt">
      ${segRow('a.by', 'Par', a.by, [['char', 'Lettre'], ['word', 'Mot'], ['line', 'Ligne']])}
      ${numRow('a.dur', 'Durée (s)', 0.02, 3, 0.01, a.dur)}
      ${numRow('a.stagger', 'Décalage (s)', 0, 0.5, 0.005, a.stagger)}
      ${numRow('a.delay', 'Retard (s)', 0, 10, 0.05, a.delay)}
      ${switchRow('a.out', 'Animer aussi la sortie', a.out)}
    </div>` : ''}`, 'tanim') : '';
  const presets = Object.entries(PRESET_GROUPS).map(([g, label]) => section(label, `<div class="grid">
    ${PRESETS.filter((x) => x.group === g).map((x) => `<button class="tile" data-preset="${x.id}"><span class="ic">${x.icon}</span>${x.label}</button>`).join('')}</div>`, 'pre-' + g)).join('');
  const trans = section('Transitions (bords du calque)', `
    ${numRow('tr.dur', 'Durée (s)', 0.1, 3, 0.05, S.trDur || 0.6)}
    <div class="row"><label>Appliquer à</label><div class="seg" id="trEdge">${[['in', 'Entrée'], ['out', 'Sortie'], ['both', 'Les deux']].map(([v, l]) => `<button data-edge="${v}" class="${(S.trEdge || 'in') === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="grid">${TRANSITIONS.map((x) => `<button class="tile" data-trans="${x.id}"><span class="ic">${x.icon}</span>${x.label}</button>`).join('')}</div>
    <div class="hint">Une transition crée de vraies keyframes, modifiables ensuite. Superposez deux calques avec une sortie et une entrée pour un fondu enchaîné.</div>`, 'trans');
  const speed = section('Vitesse de l\'animation', `
    ${numRow('sp.f', 'Vitesse %', 25, 400, 5, S.stretch || 150)}
    <button class="btn block" data-act="stretch">Appliquer aux keyframes du calque</button>
    <div class="hint">200 % = deux fois plus rapide, 50 % = deux fois plus lent. Les keyframes sont recalculées à partir de la première.</div>`, 'speed');
  el.innerHTML = `<div class="sect pad"><div class="hint">Calque : <b>${esc(L.name)}</b> · tête de lecture ${fmtT(S.t)}</div></div>${textSect}${trans}${presets}${speed}`;
}

function animateAction(e) {
  const L = selLayer();
  if (!L) return;
  const p = P();
  const pr = e.target.closest('[data-preset]');
  if (pr) {
    const preset = PRESETS.find((x) => x.id === pr.dataset.preset);
    preset.fn(L, S.t, p);
    A.commit(`« ${preset.label} » appliqué`);
    A.refreshVisible();
    if (!S.playing) A.preview(preset.group === 'out' ? S.t - 0.8 : S.t, (preset.group === 'out' ? S.t : S.t + 1.2));
    return;
  }
  const tr = e.target.closest('[data-trans]');
  if (tr) {
    const x = TRANSITIONS.find((q) => q.id === tr.dataset.trans);
    const d = Math.min(S.trDur || 0.6, (L.end - L.start) / 2);
    const edge = S.trEdge || 'in';
    if (edge !== 'out') x.fn(L, 'in', d, p);
    if (edge !== 'in') x.fn(L, 'out', d, p);
    A.commit(`Transition « ${x.label} » appliquée`);
    A.refreshVisible();
    A.preview(edge === 'out' ? L.end - d - 0.3 : L.start, edge === 'in' ? L.start + d + 0.4 : L.end);
    return;
  }
  const ed = e.target.closest('[data-edge]');
  if (ed) { S.trEdge = ed.dataset.edge; $$('#trEdge button').forEach((b) => b.classList.toggle('on', b === ed)); return; }
  const ta = e.target.closest('[data-tanim]');
  if (ta) {
    L.anim.type = ta.dataset.tanim;
    if (L.anim.type === 'typewriter') { L.anim.dur = 0.05; L.anim.stagger = 0.06; L.anim.by = 'char'; }
    else if (L.anim.dur < 0.2) { L.anim.dur = 0.5; L.anim.stagger = 0.04; }
    E.clearTextCache();
    buildAnimate(); A.commit();
    if (L.anim.type !== 'none') A.preview(L.start, Math.min(L.end, L.start + 2.5));
    return;
  }
  if (e.target.closest('[data-act=stretch]')) {
    const f = (S.stretch || 150) / 100;
    if (stretchKeys(L, f)) { A.commit(`Vitesse ×${f.toFixed(2)}`); A.refreshVisible(); A.requestRender(); }
    else toast('Ce calque n\'a pas de keyframes');
  }
}

// ---------- Effets ----------
export function buildEffects() {
  const el = pane('effects');
  if (!el) return;
  const L = selLayer();
  if (!L) { el.innerHTML = noLayer('Sélectionnez un calque', 'Ou ajoutez un « Calque d\'effets » (onglet Ajouter) pour traiter toute l\'image.'); return; }
  if (!E.VISUAL(L) || L.type === 'null') { el.innerHTML = noLayer('Pas d\'effet visuel', 'Ce type de calque n\'affiche rien à l\'écran.'); return; }
  const gl = fxAvailable();
  const cards = L.fx.map((f, i) => {
    const d = E.FX_DEFS[f.type];
    const rows = Object.entries(d.params).map(([pn, def]) => {
      const k = `fx.${f.id}.${pn}`;
      const kf = !(d.nokf || []).includes(pn);
      const v = E.getProp(L, k, S.t);
      return def[1] === 'color' ? colorRow(k, def[0], v, kf) : numRow(k, def[0], def[1], def[2], def[3], v, kf);
    }).join('');
    return `<div class="fxcard ${f.on ? '' : 'off'}" data-fx="${f.id}">
      <div class="fxhead"><label class="sw" data-k="fxon.${f.id}"><input type="checkbox" ${f.on ? 'checked' : ''}><span></span></label>
        <b>${d.label}</b>${d.gl && !gl ? '<span class="tag warn">WebGL requis</span>' : ''}
        <span class="grow"></span>
        <button class="ib sm" data-fxact="up" ${i === 0 ? 'disabled' : ''} aria-label="Monter">${ICON.up}</button>
        <button class="ib sm" data-fxact="down" ${i === L.fx.length - 1 ? 'disabled' : ''} aria-label="Descendre">${ICON.down}</button>
        <button class="ib sm danger" data-fxact="del" aria-label="Supprimer">${ICON.del}</button></div>
      <div class="fxbody">${rows}</div></div>`;
  }).join('');
  const groups = [
    ['Flou et lumière', ['blur', 'mblur', 'glow', 'shadow']],
    ['Couleur', ['color', 'bright', 'contrast', 'satur']],
    ['Stylisation', ['rgb', 'chroma', 'glitch', 'vignette', 'grain']],
  ];
  el.innerHTML = `<div class="sect pad"><div class="hint">${L.type === 'adjust' ? 'Calque d\'effets : la pile s\'applique à tout ce qui est en dessous.' : `Effets de <b>${esc(L.name)}</b> — appliqués dans l'ordre de la pile. Chaque paramètre ◆ est animable.`}${gl ? '' : '<br><b class="warn">WebGL est indisponible : les effets marqués ne s\'afficheront pas.</b>'}</div></div>
    ${cards ? `<div class="fxlist">${cards}</div>` : ''}
    ${section('Ajouter un effet', groups.map(([g, types]) => `<h5>${g}</h5><div class="grid">${types.filter((t) => L.type !== 'adjust' || E.FX_DEFS[t].gl).map((t) => `<button class="tile sm" data-addfx="${t}">${E.FX_DEFS[t].label}</button>`).join('')}</div>`).join(''), 'addfx')}`;
  refreshPropValues();
}

function effectsAction(e) {
  const L = selLayer();
  if (!L) return;
  const add = e.target.closest('[data-addfx]');
  if (add) {
    const type = add.dataset.addfx;
    if (['mblur', 'glow', 'shadow'].includes(type) && L.fx.some((f) => f.type === type)) { toast('Cet effet est déjà présent sur le calque'); return; }
    L.fx.push(E.newEffect(type));
    A.commit(`Effet « ${E.FX_DEFS[type].label} » ajouté`);
    buildEffects();
    A.requestRender();
    return;
  }
  const b = e.target.closest('[data-fxact]');
  if (b) {
    const id = b.closest('[data-fx]').dataset.fx;
    const i = L.fx.findIndex((f) => f.id === id);
    if (b.dataset.fxact === 'del') E.removeEffect(L, id);
    else { const j = b.dataset.fxact === 'up' ? i - 1 : i + 1; if (j >= 0 && j < L.fx.length) [L.fx[i], L.fx[j]] = [L.fx[j], L.fx[i]]; }
    A.commit(); buildEffects(); A.refreshVisible(); A.requestRender();
  }
}

export function initInspector() {
  wire(pane('props'), layerAction);
  wire(pane('effects'), effectsAction);
  const an = pane('animate');
  an.addEventListener('click', animateAction);
  an.addEventListener('input', (e) => {
    const row = e.target.closest('[data-k]');
    if (!row) return;
    const k = row.dataset.k;
    const v = readInput(e.target);
    if (typeof v === 'number' && Number.isNaN(v)) return;
    if (e.target.type === 'range') { const n = row.querySelector('.nv'); if (n) n.value = fmtNum(v); }
    if (e.target.type === 'number') { const r = row.querySelector('input[type=range]'); if (r) r.value = v; }
    if (k === 'tr.dur') { S.trDur = v; return; }
    if (k === 'sp.f') { S.stretch = v; return; }
    applyKey(k, v);
    A.requestRender();
  });
  an.addEventListener('change', (e) => { const k = e.target.closest('[data-k]')?.dataset.k; if (k && !k.startsWith('tr.') && !k.startsWith('sp.')) A.commit(); });
  an.addEventListener('click', (e) => {
    const seg = e.target.closest('.seg button[data-v]');
    if (!seg) return;
    const row = seg.closest('[data-k]');
    applyKey(row.dataset.k, seg.dataset.v);
    $$('button', row).forEach((b) => b.classList.toggle('on', b === seg));
    A.commit(); A.requestRender();
  });
  void layerById;
}
