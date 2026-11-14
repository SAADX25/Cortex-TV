import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({ entryPoints: ['src/features/player/services/LivePlayback.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { LivePlayback } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);

class Video extends EventTarget {
  paused = true; readyState = 4; currentTime = 0; videoWidth = 1920; src = ''; error = null; trace = []; native = false; blocked = false;
  canPlayType() { return this.native ? 'maybe' : ''; }
  play() {
    if (this.blocked) return Promise.reject(new DOMException('User gesture required', 'NotAllowedError'));
    this.paused = false;
    this.dispatchEvent(new Event('playing'));
    return Promise.resolve();
  }
  pause() { this.trace.push('pause'); this.paused = true; this.dispatchEvent(new Event('pause')); }
  removeAttribute(name) { this.trace.push(`remove:${name}`); this.src = ''; }
  load() { this.trace.push('load'); }
  advance(time) { this.paused = false; this.currentTime = time; this.dispatchEvent(new Event('timeupdate')); }
}
class FakeHls {
  static Events = { MANIFEST_PARSED: 'manifest', LEVEL_SWITCHED: 'level', ERROR: 'error' };
  static ErrorTypes = { NETWORK_ERROR: 'network', MEDIA_ERROR: 'media' };
  static instances = [];
  static isSupported() { return true; }
  handlers = new Map(); levels = [{ height: 720, bitrate: 2000000 }, { height: 1080, bitrate: 4000000 }];
  starts = 0; recoveries = 0; swaps = 0; destroyed = false;
  constructor(config) { this.config = config; FakeHls.instances.push(this); }
  on(name, callback) { this.handlers.set(name, callback); }
  emit(name, data) { this.handlers.get(name)?.(name, data); }
  attachMedia(video) { this.video = video; }
  loads = 0;
  loadSource(source) { this.source = source; this.loads++; }
  startLoad() { this.starts++; }
  stopLoad() { this.video.trace.push('stop'); }
  detachMedia() { this.video.trace.push('detach'); }
  destroy() { this.video.trace.push('destroy'); this.destroyed = true; }
  recoverMediaError() { this.recoveries++; }
  swapAudioCodec() { this.swaps++; }
  fatal(type) { this.emit('error', { fatal: true, type, details: 'simulatedFailure' }); }
}
async function setup(t, options = {}) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1000 });
  const video = new Video(); Object.assign(video, options.video);
  const snapshots = [];
  const engine = new LivePlayback({ video, source: 'https://example.test/live.m3u8', hlsClass: FakeHls, onChange: (state) => snapshots.push(state), ...options.engine });
  t.after(() => engine.dispose());
  await engine.start();
  return { video, engine, hls: FakeHls.instances.at(-1), snapshots, state: () => snapshots.at(-1) };
}

test('fatal network failures retry after 1, 2 and 4 seconds, then stop', async (t) => {
  const { hls, state } = await setup(t);
  for (const [index, delay] of [1000, 2000, 4000].entries()) {
    hls.fatal('network'); assert.equal(state().attempt, index + 1);
    t.mock.timers.tick(delay - 1); assert.equal(hls.starts, index);
    t.mock.timers.tick(1); assert.equal(hls.starts, index + 1);
  }
  hls.fatal('network'); assert.equal(state().status, 'error'); assert.ok(hls.destroyed);
  t.mock.timers.tick(60000); assert.equal(hls.starts, 3);
});
test('media recovery swaps audio only on the second failure and terminates on the third', async (t) => {
  const { hls, state } = await setup(t);
  hls.fatal('media'); assert.equal(hls.recoveries, 1); assert.equal(hls.swaps, 0);
  hls.fatal('media'); assert.equal(hls.recoveries, 2); assert.equal(hls.swaps, 1);
  hls.fatal('media'); assert.equal(state().status, 'error');
});
test('an initial manifest failure reloads its source before startLoad resumes fragments', async (t) => {
  const { hls } = await setup(t);
  hls.levels = [];
  hls.fatal('network');
  t.mock.timers.tick(1000);
  assert.equal(hls.loads, 2);
  assert.equal(hls.starts, 1);
});
test('downloaded fragments cannot mark playback healthy; watchdog catches mid-stream stalls', async (t) => {
  const { video, hls, state } = await setup(t);
  hls.emit('fragmentLoaded'); t.mock.timers.tick(11000); assert.equal(hls.starts, 0);
  t.mock.timers.tick(1000); assert.equal(state().status, 'buffering');
  t.mock.timers.tick(1000); assert.equal(hls.starts, 1);
  video.advance(2); assert.equal(state().status, 'playing');
  video.dispatchEvent(new Event('waiting')); t.mock.timers.tick(12000); assert.equal(state().attempt, 2);
});
test('native-capable devices get one fallback after HLS recovery is exhausted', async (t) => {
  const { video, hls, state } = await setup(t, { video: { native: true } });
  hls.fatal('media'); hls.fatal('media'); hls.fatal('media');
  assert.ok(hls.destroyed); assert.equal(state().engine, 'native'); assert.equal(video.src, 'https://example.test/live.m3u8');
  video.dispatchEvent(new Event('loadedmetadata')); assert.equal(state().status, 'playing');
});
test('autoplay rejection waits for a gesture without consuming reconnect attempts', async (t) => {
  const { video, hls, engine, state } = await setup(t, { video: { blocked: true } });
  hls.emit('manifest'); await Promise.resolve(); assert.equal(state().status, 'blocked');
  t.mock.timers.tick(60000); assert.equal(hls.starts, 0);
  video.blocked = false; engine.togglePlay(); assert.equal(state().status, 'playing');
});
test('intentional pause suspends the watchdog and resume restarts loading', async (t) => {
  const { video, hls, engine, state } = await setup(t);
  await engine.play(); engine.togglePlay(); assert.equal(state().status, 'paused');
  t.mock.timers.tick(60000); assert.equal(hls.starts, 0);
  engine.togglePlay(); assert.equal(hls.starts, 1); assert.equal(video.paused, false);
});
test('dispose cancels retry timers, detaches, destroys and releases video in order', async (t) => {
  const { engine, video, hls, snapshots } = await setup(t);
  hls.fatal('network'); video.trace.length = 0; engine.dispose();
  assert.deepEqual(video.trace, ['stop', 'detach', 'destroy', 'pause', 'remove:src', 'load']);
  const count = snapshots.length; t.mock.timers.tick(60000); video.dispatchEvent(new Event('playing'));
  assert.equal(snapshots.length, count); assert.equal(hls.starts, 0);
  engine.dispose(); assert.equal(video.trace.length, 6);
});
test('switching aborts an unresolved source and ignores its late result', async () => {
  const video = new Video(); let signal; let finish; const before = FakeHls.instances.length;
  const engine = new LivePlayback({ video, source: 'resolve://example.test/live', hlsClass: FakeHls, onChange: () => {}, resolve: (_source, abortSignal) => { signal = abortSignal; return new Promise((resolve) => { finish = resolve; }); } });
  const started = engine.start(); engine.dispose(); assert.ok(signal.aborted);
  finish('https://example.test/late.m3u8'); await started;
  assert.equal(FakeHls.instances.length, before); assert.equal(video.src, '');
});
