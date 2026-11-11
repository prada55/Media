// État partagé de l'éditeur de montage.
import { mainLayout } from './model.js';

export const St = {
  p: null, C: null, t: 0, playing: false, loop: false, sel: null, pps: 60, rs: 1, cssScale: 1, dirty: true,
  hist: [], hidx: -1, q: 'auto', fxPreview: true, desktop: false, ptab: null, ltab: 'media', snap: true, recording: null,
};
export const App = {};

// Sélection : { kind: 'clip' | 'item' | 'trans' | 'track', id }
export function selInfo() {
  const s = St.sel;
  if (!s || !St.p) return null;
  if (s.kind === 'clip' || s.kind === 'trans') {
    const lay = mainLayout(St.p).items;
    const x = lay.find((q) => q.c.id === s.id);
    return x ? { kind: s.kind, obj: x.c, start: x.start, end: x.end, index: lay.indexOf(x) } : null;
  }
  for (const tr of St.p.tracks) {
    const it = tr.items.find((q) => q.id === s.id);
    if (it) return { kind: 'item', obj: it, track: tr, start: it.start, end: it.start + it.dur };
  }
  return null;
}
export const localT = (info) => Math.max(0, St.t - info.start);
