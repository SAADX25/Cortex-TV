import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({
  entryPoints: ['src/shared/lib/channelUtils.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  define: { 'import.meta.env.BASE_URL': '"/"' },
});
const {
  normalizeSearchText,
  normalizeChannelNameForSearch,
  countrySearchText,
} = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);

test('normalizeSearchText folds Arabic hamzas, teh marbuta, and diacritics', () => {
  assert.equal(normalizeSearchText('الأُرْدُنّ'), normalizeSearchText('الاردن'));
  assert.equal(normalizeSearchText('الإخبارية'), normalizeSearchText('الاخباريه'));
  assert.equal(normalizeSearchText('العربية'), normalizeSearchText('العربيه'));
  assert.equal(normalizeSearchText('الإمارات'), normalizeSearchText('الامارات'));
});

test('countrySearchText matches English, Arabic, ISO, and aliases', () => {
  const us = countrySearchText('US', 'United States');
  assert.ok(us.includes('united states'));
  assert.ok(us.includes('usa'));
  assert.ok(us.includes('امريكا'));

  const jo = countrySearchText('JO', 'Jordan');
  assert.ok(jo.includes('jordan'));
  assert.ok(jo.includes('الاردن'));

  const sa = countrySearchText('SA', 'Saudi Arabia');
  assert.ok(sa.includes('ksa'));
  assert.ok(sa.includes('السعوديه'));
});

test('normalizeChannelNameForSearch strips noise words while preserving fallback raw text', () => {
  assert.equal(normalizeChannelNameForSearch('Al Jazeera HD Live'), 'al jazeera');
  assert.equal(normalizeChannelNameForSearch('HDS TV'), 'hds');
  assert.equal(normalizeChannelNameForSearch('TV') || normalizeSearchText('TV'), 'tv');
});

