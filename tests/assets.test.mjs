import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { build } from 'esbuild';

for (const base of ['./', '/', '/Cortex-TV/']) {
  test(`flags resolve against the ${base} deployment base`, async () => {
    const result = await build({ entryPoints: ['src/shared/lib/channelUtils.ts'], bundle: true, platform: 'node', format: 'esm', write: false, define: { 'import.meta.env.BASE_URL': JSON.stringify(base) } });
    const { flagUrl, FLAG_CODE_MAP } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
    for (const iso of ['US', 'JO', 'AE', 'GB', ...Object.keys(FLAG_CODE_MAP)]) {
      const url = flagUrl(iso);
      assert.ok(url.startsWith(`${base}icons/flags/`));
      assert.ok(existsSync(`public/${url.slice(base.length)}`), `${iso} has a bundled flag`);
    }
    assert.ok(existsSync(`public/${flagUrl('').slice(base.length)}`));
    assert.ok(!flagUrl('GB').includes('classic_3_ico'));
  });
}
