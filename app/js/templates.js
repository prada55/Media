// Modèles de compositions et générateur de texte cinétique.
import { newLayer, newProject, setKey } from './engine.js';

const K = (L, prop, keys) => keys.forEach(([t, v, e]) => setKey(L, prop, t, v, e || 'out'));

export const FORMATS = [
  { id: '9x16', label: 'Story / Reels / TikTok', w: 1080, h: 1920 },
  { id: '1x1', label: 'Carré', w: 1080, h: 1080 },
  { id: '4x5', label: 'Portrait 4:5', w: 1080, h: 1350 },
  { id: '16x9', label: 'Paysage 16:9', w: 1920, h: 1080 },
];

export const TEMPLATES = [
  {
    id: 'empty', name: 'Composition vide', desc: 'Partir de zéro',
    build: (p) => { p.layers.push(newLayer(p, 'solid', { name: 'Fond', locked: true })); },
  },
  {
    id: 'intro', name: 'Présentation', desc: 'Titre élégant sur fond argenté',
    build: (p) => {
      const W = p.width, H = p.height; p.duration = 5;
      const bg = newLayer(p, 'solid', { name: 'Fond argent', locked: true, style: { fill: '#fbfbfd', fill2: '#b9b9c2', gradOn: true, gradType: 'radial' } });
      const t1 = newLayer(p, 'text', { start: 0.2, style: { text: 'Présentation', color: '#111114', weight: '600', size: Math.round(W * 0.095) }, anim: { type: 'blur', dur: 0.7, stagger: 0.04 } });
      K(t1, 'y', [[1.6, H * 0.5, 'expoInOut'], [2.2, H * 0.45]]);
      const t2 = newLayer(p, 'text', { start: 1.9, style: { text: 'du nouveau projet', color: '#55555f', weight: '500', size: Math.round(W * 0.05) }, props: { y: H * 0.53 }, anim: { type: 'rise', by: 'word', dur: 0.6, stagger: 0.08 } });
      const line = newLayer(p, 'rect', { name: 'Trait', start: 2.4, style: { w: W * 0.25, h: Math.max(4, W * 0.006), radius: 4, fill: '#111114' }, props: { y: H * 0.585 } });
      K(line, 'stretchX', [[2.4, 0, 'expoInOut'], [3.1, 100]]);
      for (const L of [t1, t2, line]) K(L, 'opacity', [[4.4, 100, 'in'], [4.9, 0]]);
      p.layers.push(line, t2, t1, bg);
    },
  },
  {
    id: 'neon', name: 'Logo néon', desc: 'Révélation lumineuse sur fond noir',
    build: (p) => {
      const W = p.width, H = p.height; p.duration = 4;
      const bg = newLayer(p, 'solid', { name: 'Fond', locked: true, style: { fill: '#05040b', fill2: '#1b0f3d', gradOn: true, gradType: 'radial' } });
      const orb = newLayer(p, 'ellipse', { name: 'Halo', style: { w: W * 0.5, h: W * 0.5, fill: '#8b5cff', fill2: '#05040b', gradOn: true, gradType: 'radial' }, props: { opacity: 70 } });
      K(orb, 'scale', [[0, 0, 'back'], [0.8, 100, 'inOut'], [4, 130]]);
      const ring = newLayer(p, 'ellipse', { name: 'Anneau', style: { w: W * 0.36, h: W * 0.36, fill: 'rgba(0,0,0,0)', stroke: '#c4b5ff', strokeW: Math.max(3, W * 0.006), glow: 30, glowColor: '#8b5cff' } });
      K(ring, 'scale', [[0.2, 0, 'expo'], [0.9, 100]]);
      K(ring, 'rotation', [[0.2, -90, 'expo'], [1.2, 0]]);
      const txt = newLayer(p, 'text', { start: 0.7, style: { text: 'NOVA', size: Math.round(W * 0.13), weight: '900', tracking: W * 0.02, glow: 40, glowColor: '#a78bfa' }, anim: { type: 'pop', dur: 0.45, stagger: 0.07 } });
      const sub = newLayer(p, 'text', { start: 1.5, style: { text: 'STUDIO', size: Math.round(W * 0.035), weight: '600', tracking: W * 0.025, color: '#c4b5ff' }, props: { y: H / 2 + W * 0.26 }, anim: { type: 'tracking', dur: 0.9, stagger: 0 } });
      p.layers.push(sub, txt, ring, orb, bg);
    },
  },
  {
    id: 'cta', name: 'Appel à l\'action', desc: 'Follow & comment pour les réseaux',
    build: (p) => {
      const W = p.width, H = p.height; p.duration = 5;
      const bg = newLayer(p, 'solid', { name: 'Fond violet', locked: true, style: { fill: '#2b0a6b', fill2: '#0a0420', gradOn: true, gradAngle: 90 } });
      const blob = newLayer(p, 'ellipse', { name: 'Lueur', style: { w: W * 1.1, h: W * 1.1, fill: '#7c3aed', fill2: 'rgba(0,0,0,0)', gradOn: true, gradType: 'radial' }, props: { y: H * 0.3, opacity: 70 } });
      K(blob, 'y', [[0, H * 0.3, 'inOut'], [2.5, H * 0.38, 'inOut'], [5, H * 0.3]]);
      const t1 = newLayer(p, 'text', { start: 0.1, style: { text: 'Tu veux ce pack ?', size: Math.round(W * 0.085), font: 'Georgia, serif', italic: true, weight: '700' }, props: { y: H * 0.3 }, anim: { type: 'fadeUp', by: 'word', dur: 0.6, stagger: 0.1 } });
      const t2 = newLayer(p, 'text', { start: 0.8, style: { text: '+5000 effets', size: Math.round(W * 0.12), weight: '900', color: '#c4b5ff' }, props: { y: H * 0.39 }, anim: { type: 'pop', dur: 0.4, stagger: 0.04 } });
      const pill = newLayer(p, 'text', { start: 1.6, name: 'Bulle commentaire', style: { text: 'Commente « PACK »', size: Math.round(W * 0.06), weight: '800', color: '#ffffff', bgOn: true, bg: '#7c3aed', bgPad: W * 0.04, bgRadius: W * 0.06, shadow: 30 }, props: { y: H * 0.62 } });
      K(pill, 'scale', [[1.6, 0, 'back'], [2.1, 100, 'inOut'], [2.6, 106, 'inOut'], [3.1, 100, 'inOut'], [3.6, 106, 'inOut'], [4.1, 100]]);
      const t3 = newLayer(p, 'text', { start: 2.3, style: { text: 'et je te l\'envoie', size: Math.round(W * 0.045), weight: '500', color: '#e9e3ff' }, props: { y: H * 0.7 }, anim: { type: 'rise', by: 'word', dur: 0.5, stagger: 0.08 } });
      p.layers.push(t3, pill, t2, t1, blob, bg);
    },
  },
  {
    id: 'countdown', name: 'Compte à rebours', desc: '3, 2, 1… impact',
    build: (p) => {
      const W = p.width; p.duration = 4;
      const bg = newLayer(p, 'solid', { name: 'Fond', locked: true, style: { fill: '#0b0b10' } });
      const out = [bg];
      ['3', '2', '1'].forEach((n, i) => {
        const L = newLayer(p, 'text', { name: n, start: i, end: i + 1, style: { text: n, size: Math.round(W * 0.45), weight: '900', color: ['#22d3ee', '#a78bfa', '#f472b6'][i] } });
        K(L, 'scale', [[i, 160, 'expo'], [i + 0.4, 100, 'linear'], [i + 1, 85]]);
        K(L, 'opacity', [[i, 0, 'out'], [i + 0.15, 100, 'linear'], [i + 0.8, 100, 'in'], [i + 1, 0]]);
        out.unshift(L);
      });
      const go = newLayer(p, 'text', { name: 'GO', start: 3, style: { text: 'GO !', size: Math.round(W * 0.3), weight: '900', glow: 50, glowColor: '#f472b6' }, anim: { type: 'pop', dur: 0.35, stagger: 0.05 } });
      K(go, 'scale', [[3.3, 100, 'linear'], [4, 115]]);
      out.unshift(go);
      p.layers.push(...out);
    },
  },
];

export function projectFromTemplate(tplId, format, name) {
  const f = FORMATS.find((x) => x.id === format) || FORMATS[0];
  const tpl = TEMPLATES.find((x) => x.id === tplId) || TEMPLATES[0];
  const p = newProject({ name: name || tpl.name, width: f.w, height: f.h });
  tpl.build(p);
  return p;
}

// Générateur de texte cinétique : découpe un texte en séquences animées.
export const KINETIC_STYLES = {
  punch: 'Punchy (pop + zoom)',
  smooth: 'Doux (fondu montant)',
  type: 'Machine à écrire',
  reveal: 'Révélation par masque',
};

export function kineticLayers(p, text, style = 'punch', speed = 1, colors = ['#ffffff', '#a78bfa']) {
  const parts = [];
  const src = String(text).trim();
  if (!src) return [];
  if (src.includes('\n')) src.split('\n').map((s) => s.trim()).filter(Boolean).forEach((s) => parts.push(s));
  else {
    const words = src.split(/\s+/);
    for (let i = 0; i < words.length;) {
      const n = words[i].length > 7 ? 1 : words.length - i === 3 ? 3 : 2;
      parts.push(words.slice(i, i + n).join(' '));
      i += n;
    }
  }
  const W = p.width;
  let t = 0.2;
  const layers = [];
  parts.forEach((part, i) => {
    const d = (0.55 + part.length * 0.045) / speed;
    const txt = part.length > 12 && part.includes(' ') ? part.replace(/\s+/, '\n') : part;
    const maxLen = Math.max(...txt.split('\n').map((l) => l.length));
    const size = Math.round(Math.min(W * 0.22, (W * 0.88) / (Math.max(3, maxLen) * 0.62)));
    const anim = {
      punch: { type: 'pop', by: 'word', dur: 0.3, stagger: 0.08 },
      smooth: { type: 'fadeUp', by: 'char', dur: 0.45, stagger: 0.025 },
      type: { type: 'typewriter', by: 'char', dur: 0.05, stagger: 0.04 },
      reveal: { type: 'rise', by: 'word', dur: 0.5, stagger: 0.07 },
    }[style];
    const L = newLayer(p, 'text', {
      start: t, end: t + d,
      style: { text: txt, size, weight: '900', color: colors[i % colors.length] },
      anim,
    });
    if (style === 'punch') { setKey(L, 'scale', t, 100, 'linear'); setKey(L, 'scale', t + d, 112, 'linear'); }
    setKey(L, 'opacity', t + d - 0.12, 100, 'linear');
    setKey(L, 'opacity', t + d, 0, 'linear');
    layers.push(L);
    t += d;
  });
  return layers;
}
