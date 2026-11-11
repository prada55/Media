// Préréglages d'animation appliqués à la tête de lecture.
import { getProp, setKey, roundT } from './engine.js';

function clearBetween(L, prop, t0, t1) {
  const k = L.kf[prop];
  if (!k) return;
  L.kf[prop] = k.filter((q) => q.t <= Math.min(t0, t1) + 0.0005 || q.t >= Math.max(t0, t1) - 0.0005);
}
function ramp(L, prop, t0, t1, v0, v1, e = 'out') {
  t0 = roundT(t0); t1 = roundT(t1);
  clearBetween(L, prop, t0, t1);
  setKey(L, prop, t0, v0, e);
  setKey(L, prop, t1, v1, e);
}
const cur = (L, prop, t, fallback) => {
  const v = getProp(L, prop, t);
  return fallback !== undefined && Math.abs(v) < 0.001 ? fallback : v;
};

// Les entrées partent de la tête de lecture, les sorties se terminent à la tête de lecture.
export const PRESETS = [
  // Entrées
  { id: 'fadeIn', group: 'in', label: 'Fondu', icon: '◐', fn: (L, t) => ramp(L, 'opacity', t, t + 0.5, 0, cur(L, 'opacity', t + 0.5, 100)) },
  { id: 'pop', group: 'in', label: 'Pop', icon: '✦', fn: (L, t) => { ramp(L, 'scale', t, t + 0.55, 0, cur(L, 'scale', t + 0.55, 100), 'back'); } },
  { id: 'slideUp', group: 'in', label: 'Glisse ↑', icon: '↑', fn: (L, t, p) => { const y = cur(L, 'y', t + 0.7); ramp(L, 'y', t, t + 0.7, y + p.height * 0.12, y, 'expo'); ramp(L, 'opacity', t, t + 0.4, 0, cur(L, 'opacity', t + 0.7, 100)); } },
  { id: 'slideDown', group: 'in', label: 'Glisse ↓', icon: '↓', fn: (L, t, p) => { const y = cur(L, 'y', t + 0.7); ramp(L, 'y', t, t + 0.7, y - p.height * 0.12, y, 'expo'); ramp(L, 'opacity', t, t + 0.4, 0, cur(L, 'opacity', t + 0.7, 100)); } },
  { id: 'slideLeft', group: 'in', label: 'Glisse ←', icon: '←', fn: (L, t, p) => { const x = cur(L, 'x', t + 0.7); ramp(L, 'x', t, t + 0.7, x + p.width * 0.6, x, 'expo'); } },
  { id: 'slideRight', group: 'in', label: 'Glisse →', icon: '→', fn: (L, t, p) => { const x = cur(L, 'x', t + 0.7); ramp(L, 'x', t, t + 0.7, x - p.width * 0.6, x, 'expo'); } },
  { id: 'zoomIn', group: 'in', label: 'Zoom flou', icon: '⊕', fn: (L, t) => { const s = cur(L, 'scale', t + 0.7, 100); ramp(L, 'scale', t, t + 0.7, s * 1.8, s, 'expo'); ramp(L, 'blur', t, t + 0.6, 30, 0, 'out'); ramp(L, 'opacity', t, t + 0.35, 0, cur(L, 'opacity', t + 0.7, 100)); } },
  { id: 'growIn', group: 'in', label: 'Croissance', icon: '◎', fn: (L, t) => { const s = cur(L, 'scale', t + 0.6, 100); ramp(L, 'scale', t, t + 0.6, s * 0.6, s, 'out'); ramp(L, 'opacity', t, t + 0.4, 0, cur(L, 'opacity', t + 0.6, 100)); } },
  { id: 'spinIn', group: 'in', label: 'Tourbillon', icon: '↻', fn: (L, t) => { const r = cur(L, 'rotation', t + 0.8); ramp(L, 'rotation', t, t + 0.8, r - 180, r, 'back'); ramp(L, 'scale', t, t + 0.8, 0, cur(L, 'scale', t + 0.8, 100), 'back'); } },
  { id: 'drop', group: 'in', label: 'Chute', icon: '⤓', fn: (L, t, p) => { const y = cur(L, 'y', t + 0.9); ramp(L, 'y', t, t + 0.9, y - p.height * 0.5, y, 'bounce'); } },
  { id: 'blurIn', group: 'in', label: 'Mise au point', icon: '◌', fn: (L, t) => { ramp(L, 'blur', t, t + 0.7, 40, 0, 'out'); ramp(L, 'opacity', t, t + 0.5, 0, cur(L, 'opacity', t + 0.7, 100)); } },
  { id: 'wipeX', group: 'in', label: 'Balayage ↔', icon: '⇔', fn: (L, t) => ramp(L, 'stretchX', t, t + 0.6, 0, cur(L, 'stretchX', t + 0.6, 100), 'expoInOut') },
  { id: 'wipeY', group: 'in', label: 'Balayage ↕', icon: '⇕', fn: (L, t) => ramp(L, 'stretchY', t, t + 0.6, 0, cur(L, 'stretchY', t + 0.6, 100), 'expoInOut') },
  { id: 'elastic', group: 'in', label: 'Élastique', icon: '〰', fn: (L, t) => ramp(L, 'scale', t, t + 1, 0, cur(L, 'scale', t + 1, 100), 'elastic') },
  // Sorties
  { id: 'fadeOut', group: 'out', label: 'Fondu', icon: '◑', fn: (L, t) => ramp(L, 'opacity', t - 0.5, t, cur(L, 'opacity', t - 0.5, 100), 0, 'in') },
  { id: 'popOut', group: 'out', label: 'Pop', icon: '✧', fn: (L, t) => ramp(L, 'scale', t - 0.4, t, cur(L, 'scale', t - 0.4, 100), 0, 'in') },
  { id: 'slideOutUp', group: 'out', label: 'Sortie ↑', icon: '⇡', fn: (L, t, p) => { const y = cur(L, 'y', t - 0.6); ramp(L, 'y', t - 0.6, t, y, y - p.height * 0.12, 'in'); ramp(L, 'opacity', t - 0.4, t, cur(L, 'opacity', t - 0.4, 100), 0, 'in'); } },
  { id: 'slideOutLeft', group: 'out', label: 'Sortie ←', icon: '⇠', fn: (L, t, p) => { const x = cur(L, 'x', t - 0.6); ramp(L, 'x', t - 0.6, t, x, x - p.width * 0.8, 'expoInOut'); } },
  { id: 'zoomOut', group: 'out', label: 'Zoom flou', icon: '⊖', fn: (L, t) => { const s = cur(L, 'scale', t - 0.6, 100); ramp(L, 'scale', t - 0.6, t, s, s * 1.8, 'in'); ramp(L, 'blur', t - 0.6, t, 0, 30, 'in'); ramp(L, 'opacity', t - 0.3, t, cur(L, 'opacity', t - 0.3, 100), 0, 'linear'); } },
  { id: 'blurOut', group: 'out', label: 'Flou', icon: '◍', fn: (L, t) => { ramp(L, 'blur', t - 0.6, t, 0, 40, 'in'); ramp(L, 'opacity', t - 0.6, t, cur(L, 'opacity', t - 0.6, 100), 0, 'in'); } },
  // Boucles (de la tête de lecture jusqu'à la fin du calque)
  { id: 'pulse', group: 'loop', label: 'Pulsation', icon: '♥', fn: (L, t) => loop(L, 'scale', t, 0.5, (i, v) => (i % 2 ? v * 1.08 : v), 'inOut') },
  { id: 'float', group: 'loop', label: 'Flottement', icon: '≈', fn: (L, t, p) => loop(L, 'y', t, 1, (i, v) => (i % 2 ? v - p.height * 0.012 : v), 'inOut') },
  { id: 'swing', group: 'loop', label: 'Balancier', icon: '⌒', fn: (L, t) => loop(L, 'rotation', t, 0.6, (i, v) => v + (i % 2 ? 6 : -6) * (i ? 1 : 0), 'inOut') },
  { id: 'shake', group: 'loop', label: 'Secousse', icon: '⚡', fn: (L, t, p) => { const x = cur(L, 'x', t); for (let i = 0; i <= 10; i++) setKey(L, 'x', t + i * 0.05, i === 10 ? x : x + (i % 2 ? 1 : -1) * p.width * 0.015 * (1 - i / 10), 'linear'); } },
  { id: 'spin', group: 'loop', label: 'Rotation ∞', icon: '⟳', fn: (L, t) => { const r = cur(L, 'rotation', t); const d = Math.max(0.1, L.end - t); clearBetween(L, 'rotation', t, L.end); setKey(L, 'rotation', t, r, 'linear'); setKey(L, 'rotation', L.end, r + 120 * d, 'linear'); } },
  { id: 'flicker', group: 'loop', label: 'Néon', icon: '✺', fn: (L, t) => { const o = cur(L, 'opacity', t, 100); const seq = [o, o * 0.2, o, o * 0.4, o, o, o * 0.1, o]; seq.forEach((v, i) => setKey(L, 'opacity', t + i * 0.07, v, 'hold')); } },
];

function loop(L, prop, t, period, f, e) {
  const v0 = cur(L, prop, t);
  const end = L.end;
  const n = Math.min(120, Math.floor((end - t) / period));
  clearBetween(L, prop, t, end);
  for (let i = 0; i <= n; i++) setKey(L, prop, t + i * period, f(i, v0), e);
}

export const PRESET_GROUPS = { in: 'Entrées', out: 'Sorties (finissent à la tête de lecture)', loop: 'Boucles' };

