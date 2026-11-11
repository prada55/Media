// Export vidéo.
// 1) WebCodecs (image par image, précis, aucune image perdue) + muxer MP4 / WebM.
// 2) Repli : MediaRecorder en temps réel (navigateurs sans WebCodecs).
import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4Target } from './vendor/mp4-muxer.mjs';
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmTarget } from './vendor/webm-muxer.mjs';

export const RESOLUTIONS = [
  { id: '720', label: '720p', short: 720 },
  { id: '1080', label: '1080p', short: 1080 },
  { id: '1440', label: '2K (1440p)', short: 1440 },
  { id: '2160', label: '4K (2160p)', short: 2160 },
];

const even = (v) => Math.max(2, Math.round(v / 2) * 2);
export function dimsFor(p, short) {
  const ar = p.width / p.height;
  return ar >= 1 ? { w: even(short * ar), h: even(short) } : { w: even(short), h: even(short / ar) };
}

const AVC = ['avc1.640034', 'avc1.640033', 'avc1.640032', 'avc1.64002A', 'avc1.640028', 'avc1.4D4028', 'avc1.42E01F'];
const VP = ['vp09.00.10.08', 'vp8'];

export const hasWebCodecs = () => typeof window.VideoEncoder === 'function' && typeof window.VideoFrame === 'function';

async function findVideoConfig(format, w, h, fps, bitrate) {
  if (!hasWebCodecs()) return null;
  for (const codec of format === 'mp4' ? AVC : VP) {
    const cfg = { codec, width: w, height: h, bitrate, framerate: fps, latencyMode: 'quality' };
    if (format === 'mp4') cfg.avc = { format: 'avc' };
    try { const r = await VideoEncoder.isConfigSupported(cfg); if (r.supported) return r.config || cfg; } catch {}
  }
  return null;
}
async function findAudioConfig(format) {
  if (typeof window.AudioEncoder !== 'function') return null;
  const cfg = { codec: format === 'mp4' ? 'mp4a.40.2' : 'opus', sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 };
  try { const r = await AudioEncoder.isConfigSupported(cfg); return r.supported ? cfg : null; } catch { return null; }
}

export function recorderMime(format) {
  if (!window.MediaRecorder) return null;
  const c = format === 'mp4' ? ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4'] : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return c.find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch { return false; } }) || null;
}

const bitrateFor = (w, h, fps, q) => Math.round(w * h * fps * (q === 'high' ? 0.2 : 0.11));

// Capacités réelles de l'appareil pour chaque combinaison format / résolution / i/s.
export async function probe(p, fps) {
  const out = { webcodecs: hasWebCodecs(), formats: {} };
  for (const format of ['mp4', 'webm']) {
    const f = { recorder: recorderMime(format), audioWC: !!(await findAudioConfig(format)), res: {} };
    for (const r of RESOLUTIONS) {
      const { w, h } = dimsFor(p, r.short);
      const wc = !!(await findVideoConfig(format, w, h, fps, bitrateFor(w, h, fps, 'std')));
      // Le repli temps réel est limité au 1080p : au-delà, l'appareil perd des images.
      f.res[r.id] = { w, h, wc, rec: !!f.recorder && r.short <= 1080 };
    }
    out.formats[format] = f;
  }
  return out;
}

// ---------- WebCodecs ----------
export async function exportWebCodecs(o) {
  const { p, w, h, fps, format, quality, renderAt, audioBuffer, onProgress, signal } = o;
  const bitrate = bitrateFor(w, h, fps, quality);
  const vcfg = await findVideoConfig(format, w, h, fps, bitrate);
  if (!vcfg) throw new Error(`Encodage ${format.toUpperCase()} ${w}×${h} non pris en charge par cet appareil`);
  const acfg = audioBuffer ? await findAudioConfig(format) : null;
  const isMp4 = format === 'mp4';
  const target = isMp4 ? new Mp4Target() : new WebmTarget();
  const muxer = isMp4
    ? new Mp4Muxer({ target, fastStart: 'in-memory', firstTimestampBehavior: 'offset', video: { codec: 'avc', width: w, height: h, frameRate: fps }, audio: acfg ? { codec: 'aac', numberOfChannels: 2, sampleRate: 48000 } : undefined })
    : new WebmMuxer({ target, firstTimestampBehavior: 'offset', video: { codec: vcfg.codec.startsWith('vp09') ? 'V_VP9' : 'V_VP8', width: w, height: h, frameRate: fps }, audio: acfg ? { codec: 'A_OPUS', numberOfChannels: 2, sampleRate: 48000 } : undefined });

  let err = null;
  const venc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => (err = e) });
  venc.configure(vcfg);

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false });
  const total = Math.max(1, Math.round(p.duration * fps));
  const t0 = performance.now();
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) { venc.close(); throw new DOMException('Annulé', 'AbortError'); }
    if (err) throw err;
    const t = i / fps;
    await renderAt(ctx, t, w / p.width);
    const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
    venc.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();
    while (venc.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 2));
    if (i % 3 === 0 || i === total - 1) {
      const el = (performance.now() - t0) / 1000;
      onProgress && onProgress((i + 1) / total, el / (i + 1) * (total - i - 1), `Image ${i + 1} / ${total}`);
    }
  }
  await venc.flush();
  venc.close();
  if (err) throw err;

  if (acfg && audioBuffer) {
    onProgress && onProgress(1, 0, 'Encodage audio…');
    let aerr = null;
    const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => (aerr = e) });
    aenc.configure(acfg);
    const sr = audioBuffer.sampleRate, n = audioBuffer.length, block = 1024;
    const L = audioBuffer.getChannelData(0), R = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : L;
    for (let s = 0; s < n; s += block) {
      const len = Math.min(block, n - s);
      const data = new Float32Array(len * 2);
      data.set(L.subarray(s, s + len), 0);
      data.set(R.subarray(s, s + len), len);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: len, numberOfChannels: 2, timestamp: Math.round((s / sr) * 1e6), data });
      aenc.encode(ad);
      ad.close();
      if (aenc.encodeQueueSize > 20) await new Promise((r) => setTimeout(r, 1));
    }
    await aenc.flush();
    aenc.close();
    if (aerr) throw aerr;
  }
  muxer.finalize();
  return { blob: new Blob([target.buffer], { type: isMp4 ? 'video/mp4' : 'video/webm' }), audio: !!(acfg && audioBuffer) };
}

// ---------- Repli temps réel ----------
export async function exportRealtime(o) {
  const { p, w, h, fps, format, quality, renderAt, audioStream, onProgress, signal, onStart, onEnd } = o;
  const mime = recorderMime(format);
  if (!mime) throw new Error(`L'enregistrement ${format.toUpperCase()} n'est pas pris en charge par ce navigateur`);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!canvas.captureStream) throw new Error('Capture de la toile indisponible');
  const stream = canvas.captureStream(fps);
  const tracks = [...stream.getVideoTracks()];
  if (audioStream) tracks.push(...audioStream.getAudioTracks());
  const rec = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: bitrateFor(w, h, fps, quality), audioBitsPerSecond: 192000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
  const stopped = new Promise((r) => (rec.onstop = r));
  await renderAt(ctx, 0, w / p.width, false);
  onStart && onStart();
  rec.start(250);
  const t0 = performance.now();
  let aborted = false;
  await new Promise((resolve) => {
    const step = () => {
      if (signal?.aborted) { aborted = true; resolve(); return; }
      const t = (performance.now() - t0) / 1000;
      if (t >= p.duration) { renderAt(ctx, p.duration - 1e-3, w / p.width, true); resolve(); return; }
      renderAt(ctx, t, w / p.width, true);
      onProgress && onProgress(t / p.duration, p.duration - t, 'Enregistrement en temps réel');
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  await new Promise((r) => setTimeout(r, 150));
  rec.stop();
  await stopped;
  onEnd && onEnd();
  if (aborted) throw new DOMException('Annulé', 'AbortError');
  return { blob: new Blob(chunks, { type: mime.split(';')[0] }), audio: !!audioStream };
}
