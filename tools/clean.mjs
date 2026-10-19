// Remove build outputs (everything the build regenerates).
import { rmSync } from 'node:fs';

for (const p of [
  'skin/styles',
  'skin/ui.js',
  'skin/ui.min.js',
  'skin/ui.js.map',
  'skin/fonts/roboto-flex-latin-wght-normal.woff2',
  'skin/fonts/roboto-flex-latin-ext-wght-normal.woff2',
  'skin/fonts/icons.woff2',
  'src/css/generated',
]) {
  rmSync(p, { recursive: true, force: true });
}
console.log('clean: done');
