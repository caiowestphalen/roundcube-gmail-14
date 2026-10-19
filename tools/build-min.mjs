// Produce skin/styles/*.min.css next to the readable builds (Roundcube serves .min unless devel_mode).
import { readFileSync, writeFileSync } from 'node:fs';
import * as esbuild from 'esbuild';

for (const name of ['styles', 'print', 'embed']) {
  const src = readFileSync(`skin/styles/${name}.css`, 'utf8');
  const { code } = await esbuild.transform(src, { loader: 'css', minify: true });
  writeFileSync(`skin/styles/${name}.min.css`, code);
  console.log(`css:min: ${name}.min.css ${(code.length / 1024).toFixed(1)} KB`);
}
