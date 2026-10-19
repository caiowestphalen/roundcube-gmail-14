// CI invariant: every var(--ico-*) referenced in src/css and src/js must be emitted by build-icons.
import fs from 'node:fs';
import path from 'node:path';
const gen = fs.readFileSync('src/css/generated/icons.css', 'utf8');
const defined = new Set([...gen.matchAll(/--ico-([a-z0-9-]+)\s*:/g)].map((m) => m[1]));
const modifiers = new Set(['lg', 'sm', 'xl', 'xs', 'md', 'fill']);
const classes = new Set([...gen.matchAll(/\.ico-([a-z0-9-]+)::before/g)].map((m) => m[1]));
const files = [];
const walk = (d) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(css|js|html)$/.test(f) && !p.includes('generated')) files.push(p);
  }
};
walk('src');
walk('skin/templates');
let bad = 0;
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/var\(--ico-([a-z0-9-]+)\)/g))
    if (!defined.has(m[1])) {
      console.log(`${f}: undefined --ico-${m[1]}`);
      bad++;
    }
  for (const m of s.matchAll(/ico-([a-z0-9-]+)/g))
    if (!m[0].startsWith('ico-') || /^--/.test(s.slice(m.index - 2, m.index))) continue;
    else if (
      s.slice(m.index - 1, m.index) !== '-' &&
      !modifiers.has(m[1]) &&
      !classes.has(m[1]) &&
      !defined.has(m[1]) &&
      /class|ico ico-/.test(s.slice(Math.max(0, m.index - 12), m.index))
    ) {
      console.log(`${f}: unknown class ico-${m[1]}`);
      bad++;
    }
}
console.log(bad ? `${bad} problem(s)` : 'icons ok');
process.exit(bad ? 1 : 0);
