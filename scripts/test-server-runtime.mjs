import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

// Vercel's Node functions retain ESM imports after emitting .js files. Bundled
// UI/tests resolve .ts imports during bundling and cannot catch this failure.
const root = new URL('../', import.meta.url);
const output = await mkdtemp(join(tmpdir(), 'ckb-server-runtime-'));
try {
  await writeFile(join(output, 'package.json'), '{"type":"module"}');
  for (const dir of ['lib', 'api']) {
    await mkdir(join(output, dir));
    for (const name of await readdir(new URL(`${dir}/`, root))) {
      if (!/\.(ts|js)$/.test(name) || name.endsWith('.d.ts')) continue;
      const source = await readFile(new URL(`${dir}/${name}`, root), 'utf8');
      const emitted = name.endsWith('.ts') ? ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
        fileName: name,
      }).outputText : source;
      await writeFile(join(output, dir, name.replace(/\.ts$/, '.js')), emitted);
    }
  }
  await cp(new URL('data/', root), join(output, 'data'), { recursive: true });
  await writeFile(join(output, 'smoke.mjs'), `
    import assert from 'node:assert/strict';
    globalThis.fetch = async () => { throw new Error('Network access forbidden in runtime smoke test'); };
    const { GET } = await import('./api/subscription.js');
    for (const [locale, channel] of [['zh','CKBCommunityFundDAO_CN'],['en','CKBCommunityFundDAO']]) {
      const response = await GET(new Request('https://example.test/api/subscription?action=telegram&locale=' + locale));
      assert.equal(response.status, 302);
      assert.equal(response.headers.get('location'), 'https://t.me/' + channel);
    }
    const response = await GET(new Request('https://example.test/api/subscription?action=digest'));
    assert.equal(response.status, 401);
  `);
  const result = spawnSync(process.execPath, [join(output, 'smoke.mjs')], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.equal(result.status, 0, `Compiled subscription function failed to start:\n${result.stderr}`);
  console.log('Compiled Node subscription runtime starts, redirects both channels, and rejects unauthenticated digest requests (offline; no messages sent).');
} finally {
  await rm(output, { recursive: true, force: true });
}
