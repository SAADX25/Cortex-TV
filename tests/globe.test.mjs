import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({
  entryPoints: ['src/features/globe/utils/countryFocus.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});

const {
  normalizeGlobeIso,
  isoMatches,
  findCountryFeature,
  computeCountryFocusTarget,
  computeFlightDurationMs,
} = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);

test('normalizeGlobeIso and isoMatches handle UK/GB aliases and empty/invalid codes', () => {
  assert.equal(normalizeGlobeIso(' uk '), 'GB');
  assert.equal(normalizeGlobeIso('gb'), 'GB');
  assert.equal(normalizeGlobeIso('-99'), '');
  assert.ok(isoMatches('UK', 'GB'));
  assert.ok(isoMatches('gb', 'UK'));
  assert.equal(isoMatches('US', 'GB'), false);
  assert.equal(isoMatches('-99', 'FR'), false);
});

test('findCountryFeature matches ISO-A2, UK/GB alias, and A3/ADM0_A3 fallbacks', () => {
  const features = [
    { __isoA2: 'GB', properties: { NAME: 'United Kingdom', ISO_A3: 'GBR' } },
    { properties: { NAME: 'France', ISO_A2: '-99', ISO_A3: 'FRA', ADM0_A3: 'FRA' } },
  ];

  assert.equal(findCountryFeature(features, 'UK')?.properties?.NAME, 'United Kingdom');
  assert.equal(findCountryFeature(features, 'FR')?.properties?.NAME, 'France');
  assert.equal(findCountryFeature(features, 'JP'), undefined);
});

test('computeCountryFocusTarget picks mainland polygon instead of distant territories and zooms adaptively', () => {
  const franceMock = {
    __isoA2: 'FR',
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [[[-54.5, 2.2], [-51.8, 2.2], [-51.8, 5.7], [-54.5, 5.7], [-54.5, 2.2]]],
        [[[-4.5, 42.5], [7.8, 42.5], [7.8, 51.0], [-4.5, 51.0], [-4.5, 42.5]]],
      ],
    },
  };

  const frTarget = computeCountryFocusTarget(franceMock, 'FR');
  assert.ok(frTarget);
  assert.ok(frTarget.lat > 43 && frTarget.lat < 50, `Expected mainland FR lat, got ${frTarget.lat}`);
  assert.ok(frTarget.lng > -2 && frTarget.lng < 6, `Expected mainland FR lng, got ${frTarget.lng}`);

  const qatarMock = {
    __isoA2: 'QA',
    geometry: {
      type: 'Polygon',
      coordinates: [[[50.8, 24.6], [51.6, 24.6], [51.6, 26.1], [50.8, 26.1], [50.8, 24.6]]],
    },
  };
  const qaTarget = computeCountryFocusTarget(qatarMock, 'QA');
  assert.ok(qaTarget);
  assert.ok(
    qaTarget.altitude < frTarget.altitude,
    `Expected tighter altitude for QA (${qaTarget.altitude}) vs FR (${frTarget.altitude})`
  );
});

test('computeCountryFocusTarget keeps antimeridian-crossing polygons near +-180 deg instead of Prime Meridian', () => {
  const pacificCrossMock = {
    __isoA2: 'FJ',
    geometry: {
      type: 'Polygon',
      coordinates: [[[178, -19], [-179, -19], [-179, -16], [178, -16], [178, -19]]],
    },
  };

  const target = computeCountryFocusTarget(pacificCrossMock, 'FJ');
  assert.ok(target);
  assert.ok(
    Math.abs(target.lng) > 175,
    `Expected lng near antimeridian, got ${target.lng}`
  );
  assert.ok(target.lat > -19 && target.lat < -16);
});

const perfResult = await build({
  entryPoints: ['src/features/globe/utils/globePerf.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});

const {
  resolveTargetFps,
  resolvePixelRatio,
  shouldRenderFrame,
} = await import(`data:text/javascript;base64,${Buffer.from(perfResult.outputFiles[0].text).toString('base64')}`);

test('computeFlightDurationMs scales by distance and respects reduced motion', () => {
  assert.equal(computeFlightDurationMs(20, 0, 30, 35, true), 0);
  assert.equal(computeFlightDurationMs(31.9, 35.9, 32.0, 36.0, false), 450);

  const nearMs = computeFlightDurationMs(30, 30, 35, 35, false);
  const farMs = computeFlightDurationMs(30, 0, -30, 180, false);
  assert.ok(farMs > nearMs && farMs <= 1600, `near=${nearMs}, far=${farMs}`);
});

test('globePerf resolves adaptive FPS caps, pixel ratio bounds, and frame pacing', () => {
  assert.equal(resolveTargetFps(30, true, true), 30);
  assert.equal(resolveTargetFps(60, false, false), 60);
  assert.equal(resolveTargetFps('auto', true, false), 60);
  assert.equal(resolveTargetFps('auto', false, true), 24);
  assert.equal(resolveTargetFps('auto', false, false), 20);

  assert.equal(resolvePixelRatio(3, 'auto', false), 1);
  assert.equal(resolvePixelRatio(3, 60, true), 2);
  assert.equal(resolvePixelRatio(1, 'auto', false), 1);

  assert.equal(shouldRenderFrame(100, 0, 30, false), true);
  assert.equal(shouldRenderFrame(116, 100, 30, false), false);
  assert.equal(shouldRenderFrame(116, 100, 30, true), true);
  assert.equal(shouldRenderFrame(133, 100, 30, false), true);
  // 60Hz VSync tolerance keeps 16.0ms frame instead of dropping to 30fps
  assert.equal(shouldRenderFrame(116, 100, 60, false), true);
  // 120Hz intermediate 8.3ms tick is skipped under 60fps cap
  assert.equal(shouldRenderFrame(108.3, 100, 60, false), false);
});

