// Render a review gallery of unchanged screenshots; each thumbnail links to its original.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const dir = path.resolve(process.argv[2]);
const phone = /-390$/.test(dir);
const perSheet = phone ? 8 : 6;
const reportFile = path.join(dir, 'report.json');
const data = fs.existsSync(reportFile) ? JSON.parse(fs.readFileSync(reportFile, 'utf8')) : null;
const current = Array.isArray(data) ? data : data?.report;
const names = current?.filter((r) => r.name).map((r) => `${r.name}.png`);
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.png') && !f.startsWith('review-sheet-'))
  .filter((f) => !names?.length || names.includes(f))
  .sort();
const style =
  (phone
    ? '<style>.sheet{grid-template-columns:repeat(4,1fr)!important}img{height:844px!important}</style>'
    : '') +
  '<style>body{margin:0;background:#e8edf2;color:#17212b;font:14px system-ui}.sheet{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;padding:16px}figure{margin:0;background:white;border:1px solid #bcc7d1;border-radius:8px;overflow:hidden}figcaption{height:30px;padding:4px 12px;font-weight:600;box-sizing:border-box}img{display:block;width:100%;height:400px;object-fit:contain;object-position:top}a{color:inherit;text-decoration:none}</style>';
const cards = files.map(
  (f) =>
    `<figure><figcaption>${f}</figcaption><a href="${encodeURI(f)}"><img src="${encodeURI(f)}" loading="eager"></a></figure>`
);
const html = `<!doctype html><meta charset="utf-8"><title>UI audit screenshots</title>${style}<main class="sheet">${cards.join('')}</main>`;
fs.writeFileSync(path.join(dir, 'gallery.html'), html);
const b = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] });
try {
  const p = await b.newPage({
    viewport: { width: phone ? 1640 : 1440, height: phone ? 1800 : 1360 },
  });
  for (let i = 0; i < files.length; i += perSheet) {
    await p.setContent(
      `${style}<main class="sheet">${files
        .slice(i, i + perSheet)
        .map(
          (f) =>
            `<figure><figcaption>${f}</figcaption><img src="data:image/png;base64,${fs.readFileSync(path.join(dir, f)).toString('base64')}"></figure>`
        )
        .join('')}</main>`
    );
    await p.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
    await p.screenshot({
      path: path.join(dir, `review-sheet-${String(i / perSheet + 1).padStart(3, '0')}.png`),
    });
  }
} finally {
  await b.close();
}
console.log(`${files.length} screenshots in ${dir}/gallery.html`);
