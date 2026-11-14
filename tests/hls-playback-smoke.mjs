// Uses the public sample from the official hls.js README to verify real decoding.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
const origin = process.env.CORTEX_TEST_URL || 'http://127.0.0.1:5177';
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await context.route('https://iptv-org.github.io/api/channels.json', (route) => route.fulfill({ json: [{ id: 'hls-sample', name: 'HLS playback verification', country: 'US', logo: null, categories: ['movies'], languages: ['eng'], is_nsfw: false }] }));
await context.route('https://iptv-org.github.io/api/streams.json', (route) => route.fulfill({ json: [{ channel: 'hls-sample', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' }] }));
try {
  await page.goto(origin);
  await page.getByText('Global IPTV Explorer', { exact: true }).waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('button', { name: 'Search Channels Find any public stream' }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('HLS playback verification');
  await page.getByRole('dialog').getByText('HLS playback verification', { exact: true }).click();
  await page.locator('video').waitFor();
  await page.waitForFunction(() => document.querySelector('video')?.currentTime > 0.5 || document.querySelector('.center-play'), { timeout: 40000 });
  if (await page.locator('.center-play').isVisible()) await page.locator('.center-play').click();
  await page.waitForFunction(() => document.querySelector('video')?.currentTime > 1, { timeout: 40000 });
  const media = await page.locator('video').evaluate((video) => ({ time: video.currentTime, frames: video.getVideoPlaybackQuality().totalVideoFrames, width: video.videoWidth, height: video.videoHeight }));
  assert.ok(media.frames > 0 && media.width > 0);
  assert.equal(await page.locator('.theatre').getAttribute('data-playback-engine'), 'hls');
  assert.ok(await page.locator('select[aria-label="Quality"] option').count() > 1);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  assert.equal(await page.locator('video').evaluate((video) => video.paused), true);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  assert.equal(await page.evaluate(() => !!document.fullscreenElement), true);
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await page.locator('select[aria-label="Quality"]').selectOption('0');
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
  await mkdir('docs/screenshots', { recursive: true });
  await page.screenshot({ path: 'docs/screenshots/classic/playback-sample.png' });
  await page.getByRole('button', { name: 'Back to browse', exact: true }).click();
  assert.equal(await page.locator('video').count(), 0);
  assert.deepEqual(errors, []);
  console.log(`PASS: real HLS decoding (${media.width}x${media.height}, ${media.frames} frames), quality levels, pause/resume, fullscreen and teardown.`);
} catch (error) {
  console.error('Playback smoke state:', await page.locator('body').innerText());
  throw error;
} finally { await browser.close(); }
