// État partagé et utilitaires d'interface.
export const S = {
  project: null, t: 0, playing: false, loop: true, sel: null, multi: new Set(), multiMode: false,
  tab: 'timeline', rtab: 'props', ltab: 'media', desktop: false,
  pps: 80, rs: 0.5, cssScale: 1, dirty: true, hist: [], hidx: -1, guides: null, exporting: false, snap: true,
  tlMode: 'layers', graphPath: null, graphMode: 'value', selKey: null,
  track: { id: null, placing: 0, drag: null }, busy: false,
};
// API de l'application (remplie par app.js) — permet aux modules d'interface de déclencher rendu, historique, etc.
export const A = {};

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmtT = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s.toFixed(2).padStart(5, '0')}`; };
export const fmtNum = (v) => (typeof v !== 'number' || Number.isNaN(v) ? '0' : Math.abs(v - Math.round(v)) < 0.001 ? String(Math.round(v)) : v.toFixed(Math.abs(v) < 10 ? 2 : 1));
export const P = () => S.project;
export const selLayer = () => (S.sel && S.project.layers.find((l) => l.id === S.sel)) || null;
export const layerById = (id) => S.project.layers.find((l) => l.id === id) || null;

export function toast(msg, ms = 2400, kind = '') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'on ' + kind;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (el.className = ''), ms);
}

export function toHex(c) {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  if (/^#[0-9a-f]{3}$/i.test(c)) return '#' + [...c.slice(1)].map((x) => x + x).join('');
  const m = String(c).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return '#' + [m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, '0')).join('');
  return '#000000';
}

// ---------- Composants de formulaire ----------
const kfBtn = '<button class="kfb" data-act="kf" aria-label="Keyframe" title="Ajouter / retirer une keyframe"></button>';
export function numRow(k, label, min, max, step, val, kf = false) {
  return `<div class="row" data-k="${k}">${kf ? kfBtn : ''}<label>${label}</label>
    <input type="range" min="${min}" max="${max}" step="${step}" value="${val}">
    <input class="nv" type="number" step="${step}" value="${fmtNum(+val)}"></div>`;
}
export const colorRow = (k, label, val, kf = false) => `<div class="row" data-k="${k}">${kf ? kfBtn : ''}<label>${label}</label><div class="sp"></div><input type="color" value="${toHex(val)}"></div>`;
export const switchRow = (k, label, on) => `<div class="row" data-k="${k}"><label class="wide">${label}</label><label class="sw"><input type="checkbox" ${on ? 'checked' : ''}><span></span></label></div>`;
export const selectRow = (k, label, val, opts) => `<div class="row" data-k="${k}"><label>${label}</label><select>${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
export const segRow = (k, label, val, opts) => `<div class="row" data-k="${k}"><label>${label}</label><div class="seg">${opts.map(([v, l]) => `<button data-v="${esc(v)}" class="${String(v) === String(val) ? 'on' : ''}">${l}</button>`).join('')}</div></div>`;
export const section = (title, body, id = '', right = '') => `<details class="sect" ${id ? `data-sect="${id}"` : ''} ${sectOpen(id) ? 'open' : ''}><summary><span>${title}</span>${right ? `<span class="r">${right}</span>` : ''}</summary><div class="sbody">${body}</div></details>`;

const closed = new Set(JSON.parse(localStorage.getItem('mm.closed') || '[]'));
const sectOpen = (id) => !id || !closed.has(id);
document.addEventListener('toggle', (e) => {
  const d = e.target;
  if (!(d instanceof HTMLDetailsElement) || !d.dataset.sect) return;
  if (d.open) closed.delete(d.dataset.sect); else closed.add(d.dataset.sect);
  try { localStorage.setItem('mm.closed', JSON.stringify([...closed])); } catch {}
}, true);

export function readInput(el) {
  if (el.type === 'checkbox') return el.checked;
  if (el.type === 'range' || el.type === 'number') return parseFloat(el.value);
  return el.value;
}

export const ICON = {
  eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24"><path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.3 6.3C3.6 8.1 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.7-1.7"/></svg>',
  dup: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>',
  del: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>',
  cut: '<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/></svg>',
  inP: '<svg viewBox="0 0 24 24"><path d="M8 4v16M12 12h9M15 8l-4 4 4 4"/></svg>',
  outP: '<svg viewBox="0 0 24 24"><path d="M16 4v16M3 12h9M9 8l4 4-4 4"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  unlock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/></svg>',
  center: '<svg viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="4"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6" class="f"/><circle cx="12" cy="12" r="1.6" class="f"/><circle cx="19" cy="12" r="1.6" class="f"/></svg>',
  text: '<svg viewBox="0 0 24 24"><path d="M5 6V4h14v2M12 4v16M9 20h6"/></svg>',
  rect: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2"/></svg>',
  ellipse: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>',
  solid: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 15l6-6 12 12"/></svg>',
  grad: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 3v18M11 3v18M15 3v18" opacity=".5"/></svg>',
  image: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5L5 20"/></svg>',
  video: '<svg viewBox="0 0 24 24"><rect x="2" y="5" width="14" height="14" rx="2"/><path d="m16 10 6-3v10l-6-3"/></svg>',
  audio: '<svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  font: '<svg viewBox="0 0 24 24"><path d="M4 20 10 4h1l6 16M6.5 14h8"/><path d="M18 10v10"/></svg>',
  pill: '<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="10" rx="5"/><path d="M7 12h10"/></svg>',
  title: '<svg viewBox="0 0 24 24"><path d="M4 7V5h16v2M12 5v10"/><path d="M7 19h10"/></svg>',
  group: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/><path d="M11 7h4a2 2 0 0 1 2 2v4"/></svg>',
  adjust: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" class="f"/></svg>',
  link: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
  magnet: '<svg viewBox="0 0 24 24"><path d="M6 3v8a6 6 0 0 0 12 0V3"/><path d="M6 7h4M14 7h4"/></svg>',
  graph: '<svg viewBox="0 0 24 24"><path d="M3 20h18M3 4v16"/><path d="M5 16c4 0 5-10 9-10s4 6 7 6"/></svg>',
  layers: '<svg viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/></svg>',
  select: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/></svg>',
  target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z" class="f"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M17 4.5v15L4 12z" class="f"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" class="f"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  replace: '<svg viewBox="0 0 24 24"><path d="M4 7h13l-3-3M20 17H7l3 3"/></svg>',
  svg: '<svg viewBox="0 0 24 24"><path d="M4 18 12 4l8 14z"/><circle cx="12" cy="13" r="2"/></svg>',
};
export const TYPE_LETTER = { text: 'T', rect: '▭', ellipse: '◯', solid: '■', image: '▣', video: '▶', audio: '♪', null: '◇', adjust: '◐' };
