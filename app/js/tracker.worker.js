// Worker de vision par ordinateur (aucune dépendance) :
// - suivi de points par corrélation croisée normalisée (NCC) avec prédiction de vitesse et affinage sous-pixel ;
// - suivi de caméra 2D : détection de coins (Shi-Tomasi), suivi image à image,
//   estimation robuste d'une similarité (translation, rotation, échelle) par RANSAC + moindres carrés.

let W = 0, H = 0;
let pts = [];      // suivi de points : { x, y, vx, vy, tpl, r }
let cam = null;    // suivi caméra : { prev, feats, cum }

function gray(rgba) {
  const g = new Float32Array(W * H);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2];
  return g;
}
function integrals(g) {
  const w1 = W + 1, I = new Float64Array(w1 * (H + 1)), I2 = new Float64Array(w1 * (H + 1));
  for (let y = 0; y < H; y++) {
    let s = 0, s2 = 0;
    for (let x = 0; x < W; x++) {
      const v = g[y * W + x];
      s += v; s2 += v * v;
      I[(y + 1) * w1 + x + 1] = I[y * w1 + x + 1] + s;
      I2[(y + 1) * w1 + x + 1] = I2[y * w1 + x + 1] + s2;
    }
  }
  return { I, I2 };
}
function rectSum(I, x0, y0, x1, y1) { const w1 = W + 1; return I[y1 * w1 + x1] - I[y0 * w1 + x1] - I[y1 * w1 + x0] + I[y0 * w1 + x0]; }

function bilinear(g, x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const cx = (v) => Math.min(W - 1, Math.max(0, v)), cy = (v) => Math.min(H - 1, Math.max(0, v));
  const a = g[cy(y0) * W + cx(x0)], b = g[cy(y0) * W + cx(x0 + 1)], c = g[cy(y0 + 1) * W + cx(x0)], d = g[cy(y0 + 1) * W + cx(x0 + 1)];
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}
function patch(g, cx, cy, r) {
  const n = 2 * r + 1, d = new Float32Array(n * n);
  let k = 0, s = 0;
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const v = bilinear(g, cx + i, cy + j); d[k++] = v; s += v; }
  return finishTpl(d, r);
}
function finishTpl(d, r) {
  const N = d.length;
  let s = 0;
  for (let i = 0; i < N; i++) s += d[i];
  const mean = s / N;
  const z = new Float32Array(N);
  let v = 0;
  for (let i = 0; i < N; i++) { z[i] = d[i] - mean; v += z[i] * z[i]; }
  return { d, z, r, std: Math.sqrt(v / N) };
}

// Recherche NCC autour de (px, py) dans un rayon s.
function search(g, ii, tpl, px, py, s) {
  const r = tpl.r, n = 2 * r + 1, N = n * n;
  const x0 = Math.round(px), y0 = Math.round(py);
  const side = 2 * s + 1, sc = new Float32Array(side * side).fill(-2);
  let best = -2, bx = x0, by = y0;
  if (tpl.std < 1e-3) return { x: px, y: py, score: 0 };
  for (let dy = -s; dy <= s; dy++) {
    const cy = y0 + dy;
    if (cy - r < 0 || cy + r >= H) continue;
    for (let dx = -s; dx <= s; dx++) {
      const cx = x0 + dx;
      if (cx - r < 0 || cx + r >= W) continue;
      const sum = rectSum(ii.I, cx - r, cy - r, cx + r + 1, cy + r + 1);
      const sq = rectSum(ii.I2, cx - r, cy - r, cx + r + 1, cy + r + 1);
      const mean = sum / N, varr = sq / N - mean * mean;
      if (varr < 1e-4) continue;
      let cross = 0, k = 0;
      for (let j = -r; j <= r; j++) {
        let o = (cy + j) * W + cx - r;
        for (let i = 0; i < n; i++) cross += g[o++] * tpl.z[k++];
      }
      const ncc = cross / (N * Math.sqrt(varr) * tpl.std);
      sc[(dy + s) * side + dx + s] = ncc;
      if (ncc > best) { best = ncc; bx = cx; by = cy; }
    }
  }
  // Affinage sous-pixel par ajustement parabolique.
  let sx = 0, sy = 0;
  const ix = bx - x0 + s, iy = by - y0 + s;
  const at = (x, y) => (x < 0 || y < 0 || x >= side || y >= side ? -2 : sc[y * side + x]);
  const l = at(ix - 1, iy), rr = at(ix + 1, iy), u = at(ix, iy - 1), d = at(ix, iy + 1);
  if (l > -2 && rr > -2) { const den = l - 2 * best + rr; if (Math.abs(den) > 1e-6) sx = Math.max(-0.5, Math.min(0.5, (0.5 * (l - rr)) / den)); }
  if (u > -2 && d > -2) { const den = u - 2 * best + d; if (Math.abs(den) > 1e-6) sy = Math.max(-0.5, Math.min(0.5, (0.5 * (u - d)) / den)); }
  return { x: bx + sx, y: by + sy, score: best };
}

// ---------- Détection de coins (Shi-Tomasi) ----------
function detect(g, max, avoid = [], border = 16) {
  const Ixx = new Float32Array(W * H), Iyy = new Float32Array(W * H), Ixy = new Float32Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    const gx = (g[i + 1] - g[i - 1]) * 0.5, gy = (g[i + W] - g[i - W]) * 0.5;
    Ixx[i] = gx * gx; Iyy[i] = gy * gy; Ixy[i] = gx * gy;
  }
  const box = (a) => { const t = integralSingle(a); return t; };
  const A = box(Ixx), B = box(Iyy), C = box(Ixy);
  const R = 3, cands = [];
  let maxL = 0;
  const lam = new Float32Array(W * H);
  for (let y = border; y < H - border; y += 2) for (let x = border; x < W - border; x += 2) {
    const a = rs(A, x - R, y - R, x + R + 1, y + R + 1), c = rs(B, x - R, y - R, x + R + 1, y + R + 1), b = rs(C, x - R, y - R, x + R + 1, y + R + 1);
    const l = (a + c) / 2 - Math.sqrt(((a - c) / 2) ** 2 + b * b);
    lam[y * W + x] = l;
    if (l > maxL) maxL = l;
  }
  const cell = Math.max(8, Math.round(Math.sqrt((W * H) / (max * 3))));
  for (let cy = border; cy < H - border; cy += cell) for (let cx = border; cx < W - border; cx += cell) {
    let bl = 0, bx = -1, by = -1;
    for (let y = cy; y < Math.min(H - border, cy + cell); y += 2) for (let x = cx; x < Math.min(W - border, cx + cell); x += 2) {
      const l = lam[y * W + x];
      if (l > bl) { bl = l; bx = x; by = y; }
    }
    if (bx >= 0 && bl > maxL * 0.02) cands.push({ x: bx, y: by, l: bl });
  }
  cands.sort((p, q) => q.l - p.l);
  const out = [], minD2 = (cell * 0.8) ** 2;
  for (const c of cands) {
    if (out.length + avoid.length >= max) break;
    if ([...out, ...avoid].some((o) => (o.x - c.x) ** 2 + (o.y - c.y) ** 2 < minD2)) continue;
    out.push(c);
  }
  return out;
}
function integralSingle(a) {
  const w1 = W + 1, I = new Float64Array(w1 * (H + 1));
  for (let y = 0; y < H; y++) { let s = 0; for (let x = 0; x < W; x++) { s += a[y * W + x]; I[(y + 1) * w1 + x + 1] = I[y * w1 + x + 1] + s; } }
  return I;
}
function rs(I, x0, y0, x1, y1) { const w1 = W + 1; return I[y1 * w1 + x1] - I[y0 * w1 + x1] - I[y1 * w1 + x0] + I[y0 * w1 + x0]; }

// Meilleur coin à proximité d'un point (aimantation de la sélection).
function snapCorner(g, x, y, radius) {
  const found = detect(g, 400, [], 8).filter((c) => (c.x - x) ** 2 + (c.y - y) ** 2 <= radius * radius);
  if (!found.length) return { x, y };
  found.sort((a, b) => b.l - a.l);
  return { x: found[0].x, y: found[0].y };
}

// ---------- Similarité 2D ----------
function fitSim(P, Q) {
  const n = P.length;
  let mpx = 0, mpy = 0, mqx = 0, mqy = 0;
  for (let i = 0; i < n; i++) { mpx += P[i][0]; mpy += P[i][1]; mqx += Q[i][0]; mqy += Q[i][1]; }
  mpx /= n; mpy /= n; mqx /= n; mqy /= n;
  let a = 0, b = 0, nn = 0;
  for (let i = 0; i < n; i++) {
    const px = P[i][0] - mpx, py = P[i][1] - mpy, qx = Q[i][0] - mqx, qy = Q[i][1] - mqy;
    a += px * qx + py * qy; b += px * qy - py * qx; nn += px * px + py * py;
  }
  if (nn < 1e-9) return [1, 0, 0, 1, mqx - mpx, mqy - mpy];
  const c = a / nn, s = b / nn;
  return [c, s, -s, c, mqx - (c * mpx - s * mpy), mqy - (s * mpx + c * mpy)];
}
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
function invert(m) {
  const det = m[0] * m[3] - m[1] * m[2];
  const a = m[3] / det, b = -m[1] / det, c = -m[2] / det, d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
}
const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];

function ransac(P, Q, thr = 1.5, iters = 120) {
  const n = P.length;
  if (n < 2) return null;
  let best = null, bestIn = [];
  for (let it = 0; it < iters; it++) {
    const i = (Math.random() * n) | 0, j = (Math.random() * n) | 0;
    if (i === j) continue;
    const m = fitSim([P[i], P[j]], [Q[i], Q[j]]);
    const sc = Math.hypot(m[0], m[1]);
    if (sc < 0.7 || sc > 1.4) continue;
    const inl = [];
    for (let k = 0; k < n; k++) { const [x, y] = apply(m, P[k][0], P[k][1]); if ((x - Q[k][0]) ** 2 + (y - Q[k][1]) ** 2 < thr * thr) inl.push(k); }
    if (inl.length > bestIn.length) { bestIn = inl; best = m; }
  }
  if (!best || bestIn.length < Math.max(4, n * 0.3)) return null;
  return { m: fitSim(bestIn.map((k) => P[k]), bestIn.map((k) => Q[k])), inliers: bestIn };
}

// ---------- Messages ----------
self.onmessage = (e) => {
  const d = e.data;
  try {
    if (d.cmd === 'snap') {
      W = d.w; H = d.h;
      const g = gray(new Uint8ClampedArray(d.rgba));
      self.postMessage({ id: d.id, pts: d.pts.map(([x, y]) => { const s = snapCorner(g, x, y, d.radius); return [s.x, s.y]; }) });
    } else if (d.cmd === 'start') {
      W = d.w; H = d.h;
      const g = gray(new Uint8ClampedArray(d.rgba));
      pts = d.pts.map(([x, y]) => ({ x, y, vx: 0, vy: 0, r: d.r, s: d.s, tpl: patch(g, x, y, d.r), ref: null }));
      pts.forEach((p) => (p.ref = p.tpl));
      self.postMessage({ id: d.id, ok: true });
    } else if (d.cmd === 'next') {
      const g = gray(new Uint8ClampedArray(d.rgba));
      const ii = integrals(g);
      const out = pts.map((p) => {
        let r = search(g, ii, p.tpl, p.x + p.vx * 0.8, p.y + p.vy * 0.8, p.s);
        if (r.score < 0.6) {
          const r2 = search(g, ii, p.tpl, p.x, p.y, Math.round(p.s * 1.6));
          if (r2.score > r.score) r = r2;
        }
        // Comparaison avec le motif d'origine pour limiter la dérive.
        const rr = search(g, ii, p.ref, r.x, r.y, 3);
        if (rr.score > r.score - 0.02) r = rr;
        p.vx = r.x - p.x; p.vy = r.y - p.y;
        p.x = r.x; p.y = r.y;
        if (d.adapt && r.score > 0.8) {
          const np = patch(g, r.x, r.y, p.r);
          const blend = new Float32Array(np.d.length);
          for (let i = 0; i < blend.length; i++) blend[i] = p.tpl.d[i] * 0.7 + np.d[i] * 0.3;
          p.tpl = finishTpl(blend, p.r);
        }
        return [r.x, r.y, r.score];
      });
      self.postMessage({ id: d.id, pts: out });
    } else if (d.cmd === 'camStart') {
      W = d.w; H = d.h;
      const g = gray(new Uint8ClampedArray(d.rgba));
      const feats = detect(g, d.max).map((f) => ({ x: f.x, y: f.y, rx: f.x, ry: f.y }));
      cam = { prev: g, feats, cum: [1, 0, 0, 1, 0, 0], max: d.max, vel: [0, 0], last: null };
      self.postMessage({ id: d.id, n: feats.length, feats: feats.map((f) => [f.x, f.y]) });
    } else if (d.cmd === 'camNext') {
      // Chaque point est suivi d'une image à l'autre (petit déplacement), mais la transformation est estimée
      // directement entre ses coordonnées de référence et sa position actuelle : l'erreur ne s'accumule pas.
      const g = gray(new Uint8ClampedArray(d.rgba));
      const ii = integrals(g);
      const R = [], Q = [], F = [];
      for (const f of cam.feats) {
        const tpl = patch(cam.prev, f.x, f.y, 8);
        const r = search(g, ii, tpl, f.x + cam.vel[0], f.y + cam.vel[1], 16);
        if (r.score > 0.7) { R.push([f.rx, f.ry]); Q.push([r.x, r.y]); F.push({ x: r.x, y: r.y, rx: f.rx, ry: f.ry }); }
      }
      const res = ransac(R, Q, 2);
      let ok = false, feats = [];
      if (res) {
        ok = true;
        const prevCum = cam.cum;
        cam.cum = res.m;
        const c0 = apply(prevCum, W / 2, H / 2), c1 = apply(cam.cum, W / 2, H / 2);
        cam.vel = [c1[0] - c0[0], c1[1] - c0[1]];
        feats = res.inliers.map((k) => F[k]);
      } else {
        // Pas d'estimation fiable : on prolonge le dernier mouvement (inertie) et on garde les points.
        cam.cum = [cam.cum[0], cam.cum[1], cam.cum[2], cam.cum[3], cam.cum[4] + cam.vel[0], cam.cum[5] + cam.vel[1]];
        feats = F;
      }
      if (feats.length < cam.max * 0.6) {
        const inv = invert(cam.cum);
        for (const n of detect(g, cam.max, feats)) { const [rx, ry] = apply(inv, n.x, n.y); feats.push({ x: n.x, y: n.y, rx, ry }); }
      }
      cam.feats = feats.filter((f) => f.x > 10 && f.y > 10 && f.x < W - 10 && f.y < H - 10);
      cam.prev = g;
      self.postMessage({ id: d.id, m: cam.cum, ok, n: res ? res.inliers.length : 0, total: R.length, feats: cam.feats.map((f) => [f.x, f.y]) });
    }
  } catch (err) {
    self.postMessage({ id: d.id, error: String(err && err.message || err) });
  }
};
