// Bundle src/js/index.js → skin/ui.js (readable, devel_mode) and skin/ui.min.js (production).
// Roundcube's file_mod() prefers the .min variant unless devel_mode is on.
import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');
const common = {
  entryPoints: ['src/js/index.js'],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  legalComments: 'none',
  logLevel: 'info',
};

const dev = { ...common, outfile: 'skin/ui.js', sourcemap: 'linked' };
const prod = { ...common, outfile: 'skin/ui.min.js', minify: true };

if (watch) {
  const ctx = await esbuild.context(dev);
  await ctx.watch();
  console.log('js: watching src/js → skin/ui.js');
} else {
  await Promise.all([esbuild.build(dev), esbuild.build(prod)]);
  console.log('js: skin/ui.js + skin/ui.min.js');
}
