// Effets temps réel en WebGL (fonctionne sur Safari iOS, où les filtres Canvas 2D ne sont pas disponibles).
// Travaille en alpha prémultiplié. Chaque effet est une passe de shader ; le flou gaussien en utilise deux.

const VS = `attribute vec2 p; varying vec2 uv; void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
const HEAD = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 uv; uniform sampler2D tex; uniform vec2 res; uniform float time; uniform float scale;
float rand(vec2 c){ return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
`;

const SHADERS = {
  blur: `uniform vec2 dir; uniform float sigma;
  void main(){ vec4 acc = vec4(0.0); float ws = 0.0;
    for (int i = -24; i <= 24; i++) { float x = float(i); float w = exp(-x * x / (2.0 * sigma * sigma));
      acc += texture2D(tex, uv + dir * x) * w; ws += w; }
    gl_FragColor = acc / ws; }`,
  color: `uniform float bright; uniform float contrast; uniform float sat; uniform float hue; uniform float temp;
  void main(){ vec4 c = texture2D(tex, uv); if (c.a <= 0.0001) { gl_FragColor = c; return; }
    vec3 col = c.rgb / c.a;
    col += bright / 200.0;
    col = (col - 0.5) * (1.0 + contrast / 100.0) + 0.5;
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(l), col, 1.0 + sat / 100.0);
    float a = radians(hue); float cs = cos(a); float sn = sin(a);
    mat3 m = mat3(0.299 + 0.701*cs + 0.168*sn, 0.299 - 0.299*cs - 0.328*sn, 0.299 - 0.3*cs + 1.25*sn,
                  0.587 - 0.587*cs + 0.330*sn, 0.587 + 0.413*cs + 0.035*sn, 0.587 - 0.588*cs - 1.05*sn,
                  0.114 - 0.114*cs - 0.497*sn, 0.114 - 0.114*cs + 0.292*sn, 0.114 + 0.886*cs - 0.203*sn);
    col = m * col;
    col.r += temp / 400.0; col.b -= temp / 400.0;
    gl_FragColor = vec4(clamp(col, 0.0, 1.0) * c.a, c.a); }`,
  rgb: `uniform float amount; uniform float angle;
  void main(){ vec2 o = vec2(cos(radians(angle)), sin(radians(angle))) * amount * scale / res;
    vec4 r = texture2D(tex, uv + o); vec4 g = texture2D(tex, uv); vec4 b = texture2D(tex, uv - o);
    gl_FragColor = vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a)); }`,
  chroma: `uniform float amount;
  void main(){ vec2 d = (uv - 0.5); vec2 o = d * amount / 100.0 * 0.06;
    vec4 r = texture2D(tex, uv + o); vec4 g = texture2D(tex, uv); vec4 b = texture2D(tex, uv - o);
    gl_FragColor = vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a)); }`,
  glitch: `uniform float amount; uniform float block; uniform float speed;
  void main(){ float seed = floor(time * max(speed, 0.0001)); float k = amount / 100.0;
    float by = floor(uv.y * res.y / max(block * scale, 1.0));
    float r = rand(vec2(by, seed));
    vec2 st = uv;
    if (r < k * 0.45) st.x += (rand(vec2(by + 7.0, seed)) - 0.5) * k * 0.25;
    float sh = (rand(vec2(seed, 3.0)) - 0.5) * k * 0.03;
    vec4 c = texture2D(tex, st);
    vec4 cr = texture2D(tex, st + vec2(sh, 0.0)); vec4 cb = texture2D(tex, st - vec2(sh, 0.0));
    vec4 o = vec4(cr.r, c.g, cb.b, max(max(cr.a, c.a), cb.a));
    if (rand(vec2(by * 3.1, seed + 1.0)) < k * 0.06) o.rgb = o.a * vec3(rand(vec2(uv.x, seed)));
    gl_FragColor = o; }`,
  vignette: `uniform float amount; uniform float size; uniform float soft;
  void main(){ vec4 c = texture2D(tex, uv); vec2 d = (uv - 0.5) * vec2(res.x / max(res.x, res.y), res.y / max(res.x, res.y)) * 2.0;
    float r = length(d); float inner = mix(1.2, 0.1, size / 100.0); float f = smoothstep(inner, inner + soft / 100.0 * 1.2 + 0.01, r);
    gl_FragColor = vec4(c.rgb * (1.0 - f * amount / 100.0), c.a); }`,
  grain: `uniform float amount; uniform float size; uniform float speed;
  void main(){ vec4 c = texture2D(tex, uv); float seed = floor(time * speed);
    float n = rand(floor(uv * res / max(size * scale, 1.0)) + seed * 17.13) - 0.5;
    gl_FragColor = vec4(clamp(c.rgb + n * amount / 100.0 * 0.6 * c.a, 0.0, 1.0), c.a); }`,
};
const ALIAS = { bright: 'color', contrast: 'color', satur: 'color' };
const COLOR_DEFAULTS = { bright: 0, contrast: 0, sat: 0, hue: 0, temp: 0 };

class GLFX {
  constructor() {
    this.canvas = document.createElement('canvas');
    const gl = (this.gl = this.canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, preserveDrawingBuffer: true, antialias: false }));
    if (!gl) throw new Error('WebGL indisponible');
    this.progs = {};
    this.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    this.src = this.tex();
    this.fb = [this.target(), this.target()];
    this.w = this.h = 0;
  }
  tex() {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  target() { const gl = this.gl; const tex = this.tex(); const fbo = gl.createFramebuffer(); return { tex, fbo }; }
  resize(w, h) {
    if (w === this.w && h === this.h) return;
    const gl = this.gl;
    this.w = this.canvas.width = w;
    this.h = this.canvas.height = h;
    for (const f of this.fb) {
      gl.bindTexture(gl.TEXTURE_2D, f.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, f.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, f.tex, 0);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  prog(name) {
    if (this.progs[name]) return this.progs[name];
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader ' + name + ': ' + gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, HEAD + SHADERS[name]));
    gl.bindAttribLocation(p, 0, 'p');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link ' + name);
    p._u = {};
    return (this.progs[name] = p);
  }
  u(p, name) { return name in p._u ? p._u[name] : (p._u[name] = this.gl.getUniformLocation(p, name)); }

  // src : toile 2D (taille de rendu). chain : [{type, params}]. Renvoie la toile WebGL contenant le résultat.
  apply(src, chain, t, sc) {
    const gl = this.gl;
    this.resize(src.width, src.height);
    gl.bindTexture(gl.TEXTURE_2D, this.src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    const passes = [];
    for (const f of chain) {
      if (f.type === 'blur') {
        const r = Math.max(0, f.params.radius * sc);
        if (r < 0.3) continue;
        const step = Math.max(1, r / 16);
        const sigma = Math.max(0.5, r / 3 / step);
        passes.push({ name: 'blur', u: { dir: [step / this.w, 0], sigma } }, { name: 'blur', u: { dir: [0, step / this.h], sigma } });
      } else {
        const name = ALIAS[f.type] || f.type;
        if (!SHADERS[name]) continue;
        passes.push({ name, u: name === 'color' ? { ...COLOR_DEFAULTS, ...f.params } : f.params });
      }
    }
    if (!passes.length) return src;
    gl.viewport(0, 0, this.w, this.h);
    gl.disable(gl.BLEND);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    let input = this.src;
    passes.forEach((ps, i) => {
      const last = i === passes.length - 1;
      const out = last ? null : this.fb[i % 2];
      gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fbo : null);
      const p = this.prog(ps.name);
      gl.useProgram(p);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, input);
      gl.uniform1i(this.u(p, 'tex'), 0);
      gl.uniform2f(this.u(p, 'res'), this.w, this.h);
      gl.uniform1f(this.u(p, 'time'), t);
      gl.uniform1f(this.u(p, 'scale'), sc);
      for (const k in ps.u) {
        const loc = this.u(p, k);
        if (!loc) continue;
        const v = ps.u[k];
        if (Array.isArray(v)) gl.uniform2f(loc, v[0], v[1]); else if (typeof v === 'number') gl.uniform1f(loc, v);
      }
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (out) input = out.tex;
    });
    return this.canvas;
  }
}

let inst;
export function getFX() {
  if (inst === undefined) {
    try { inst = new GLFX(); } catch (e) { console.warn('Effets WebGL désactivés :', e.message); inst = null; }
  }
  return inst;
}
export const fxAvailable = () => !!getFX();
