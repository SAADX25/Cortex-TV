import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { build } from 'esbuild';

let mockLoaderImpl = null;

const hlsStubPlugin = {
  name: 'test-stubs',
  setup(buildCtx) {
    buildCtx.onResolve({ filter: /^hls\.js$/ }, () => ({ path: 'hls-stub', namespace: 'stub' }));
    buildCtx.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
      contents: `
        class BaseLoader {
          load(context, config, callbacks) {
            if (globalThis.__mockHlsLoad) {
              globalThis.__mockHlsLoad(context, config, callbacks);
            }
          }
        }
        export default { DefaultConfig: { loader: BaseLoader } };
      `,
      loader: 'js',
    }));
  },
};

const result = await build({
  entryPoints: ['src/features/player/services/playbackProxy.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  alias: {
    '@': path.resolve('src'),
  },
  plugins: [hlsStubPlugin],
});

const {
  PROXY_ENDPOINTS,
  normalizeProxyPrefix,
  proxyRewrite,
  createPlaybackLoader,
  resetProxyStateForTests,
} = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);

const originalWindow = globalThis.window;

beforeEach(() => {
  resetProxyStateForTests();
  globalThis.window = {
    location: {
      protocol: 'https:',
      hostname: 'tv.saadx.software',
      origin: 'https://tv.saadx.software',
    },
  };
  mockLoaderImpl = null;
  globalThis.__mockHlsLoad = (ctx, cfg, cb) => mockLoaderImpl?.(ctx, cfg, cb);
});

afterEach(() => {
  globalThis.window = originalWindow;
  delete globalThis.__mockHlsLoad;
});

test('normalizeProxyPrefix normalizes bare worker URLs and preserves explicit query forms', () => {
  assert.equal(normalizeProxyPrefix(''), '');
  assert.equal(normalizeProxyPrefix('   '), '');
  assert.equal(normalizeProxyPrefix('ftp://bad.example.com'), '');
  assert.equal(
    normalizeProxyPrefix('https://cortextv-proxy.example.workers.dev'),
    'https://cortextv-proxy.example.workers.dev/?url='
  );
  assert.equal(
    normalizeProxyPrefix('https://cortextv-proxy.example.workers.dev/'),
    'https://cortextv-proxy.example.workers.dev/?url='
  );
  assert.equal(
    normalizeProxyPrefix('https://cortextv-proxy.example.workers.dev/?url='),
    'https://cortextv-proxy.example.workers.dev/?url='
  );
  assert.equal(
    normalizeProxyPrefix('https://corsproxy.io/?'),
    'https://corsproxy.io/?'
  );
});

test('proxyRewrite routes mixed content, referer-locked CDNs, and normalized custom proxies without double-wrapping', () => {
  const customWorker = 'https://my-worker.example.workers.dev';
  const expectedPrefix = 'https://my-worker.example.workers.dev/?url=';

  const directHttps = 'https://cdn.example.org/live/stream.m3u8';
  assert.equal(proxyRewrite(directHttps), directHttps);

  const mixedHttp = 'http://cdn.example.org/live/stream.m3u8';
  assert.equal(
    proxyRewrite(mixedHttp),
    `${PROXY_ENDPOINTS[0]}${encodeURIComponent(mixedHttp)}`
  );

  const rotana = 'https://rotana.hibridcdn.net/rotana/live.m3u8';
  assert.equal(
    proxyRewrite(rotana, customWorker),
    `${expectedPrefix}${encodeURIComponent(rotana)}`
  );

  const alreadyWrapped = `${expectedPrefix}${encodeURIComponent(directHttps)}`;
  assert.equal(proxyRewrite(alreadyWrapped, customWorker), alreadyWrapped);
});

test('createPlaybackLoader puts failing 404 proxies on cooldown and falls back cleanly', () => {
  const LoaderClass = createPlaybackLoader();
  const loader = new LoaderClass({});

  const mixedUrl = 'http://stream.example.org/ch1.m3u8';
  const requestedUrls = [];

  mockLoaderImpl = (context, _config, callbacks) => {
    requestedUrls.push(context.url);
    callbacks.onError({ code: 404, text: 'Not Found' }, context, null, {});
  };

  // First load hits PROXY_ENDPOINTS[0] and marks it dead with 404
  loader.load({ url: mixedUrl }, {}, { onSuccess() {}, onError() {} });
  // Second load hits PROXY_ENDPOINTS[1] and marks it dead with 404
  loader.load({ url: mixedUrl }, {}, { onSuccess() {}, onError() {} });

  assert.equal(requestedUrls[0], `${PROXY_ENDPOINTS[0]}${encodeURIComponent(mixedUrl)}`);
  assert.equal(requestedUrls[1], `${PROXY_ENDPOINTS[1]}${encodeURIComponent(mixedUrl)}`);

  // Once all default proxies are on cooldown and no custom proxy exists, stop routing into 404 loops
  assert.equal(proxyRewrite(mixedUrl), mixedUrl);
});

test('createPlaybackLoader routes direct CORS/403 HTTPS failures via active custom proxy on retry', () => {
  const customWorker = 'https://working-proxy.example.workers.dev';
  const LoaderClass = createPlaybackLoader(customWorker);
  const loader = new LoaderClass({});

  // First test without custom proxy: direct HTTPS request fails with CORS code 0 -> records fallback only if an active proxy exists
  const DefaultLoaderClass = createPlaybackLoader();
  const defaultLoader = new DefaultLoaderClass({});
  const streamUrl = 'https://strict-cors.example.net/live/playlist.m3u8';

  const seen = [];
  mockLoaderImpl = (context, _config, callbacks) => {
    seen.push(context.url);
    if (context.url === streamUrl) {
      callbacks.onError({ code: 0, text: 'CORS error' }, context, null, {});
    } else {
      callbacks.onSuccess({ url: context.url, data: '#EXTM3U' }, {}, context, {});
    }
  };

  defaultLoader.load({ url: streamUrl }, {}, { onSuccess() {}, onError() {} });
  assert.equal(seen[0], streamUrl);
  // Subsequent rewrite uses active proxy for the CORS-failing host
  assert.equal(
    proxyRewrite(streamUrl),
    `${PROXY_ENDPOINTS[0]}${encodeURIComponent(streamUrl)}`
  );

  // Also ensure custom worker unwraps & restores original response.url
  let reportedResponseUrl = '';
  const wrappedUrl = `https://working-proxy.example.workers.dev/?url=${encodeURIComponent(streamUrl)}`;
  loader.load(
    { url: wrappedUrl },
    {},
    {
      onSuccess(resp) {
        reportedResponseUrl = resp.url;
      },
      onError() {},
    }
  );
  assert.equal(reportedResponseUrl, streamUrl);
});

import worker from '../cloudflare-worker/worker.js';

test('cloudflare-worker handles OPTIONS preflight, blocks private SSRF hosts, and rewrites HLS playlists', async () => {
  const preflight = await worker.fetch(new Request('https://proxy.example.workers.dev/?url=https://x.com', { method: 'OPTIONS' }));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), '*');

  const ssrfLocal = await worker.fetch(new Request('https://proxy.example.workers.dev/?url=http://127.0.0.1:8080/live.m3u8'));
  assert.equal(ssrfLocal.status, 403);

  const ssrfPrivate = await worker.fetch(new Request('https://proxy.example.workers.dev/?url=http://192.168.1.5/live.m3u8'));
  assert.equal(ssrfPrivate.status, 403);

  const originalFetch = globalThis.fetch;
  try {
    let seenHeaders = null;
    globalThis.fetch = async (_url, init) => {
      seenHeaders = init.headers;
      const body = [
        '#EXTM3U',
        '#EXT-X-KEY:METHOD=AES-128,URI="/keys/enc.key"',
        '720p/index.m3u8',
        'http://origin.example.com/seg1.ts',
      ].join('\n');
      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'application/vnd.apple.mpegurl' },
      });
    };

    const res = await worker.fetch(
      new Request('https://proxy.example.workers.dev/?url=' + encodeURIComponent('https://rotana.hibridcdn.net/rotana/live.m3u8'))
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(seenHeaders.get('Origin'), 'https://rotana.net');
    assert.equal(seenHeaders.get('Referer'), 'https://rotana.net/');

    const text = await res.text();
    assert.match(text, /URI="https:\/\/proxy\.example\.workers\.dev\/\?url=https%3A%2F%2Frotana\.hibridcdn\.net%2Fkeys%2Fenc\.key"/);
    assert.match(text, /https:\/\/proxy\.example\.workers\.dev\/\?url=https%3A%2F%2Frotana\.hibridcdn\.net%2Frotana%2F720p%2Findex\.m3u8/);
    assert.match(text, /https:\/\/proxy\.example\.workers\.dev\/\?url=http%3A%2F%2Forigin\.example\.com%2Fseg1\.ts/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
