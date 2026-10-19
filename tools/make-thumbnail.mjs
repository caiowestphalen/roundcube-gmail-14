// Build skin/thumbnail.png (shown in Settings > User Interface > Skin) from a mail-view screenshot.
// Usage: node tools/make-thumbnail.mjs [source.png] (default: curated fictional-data screenshot)
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const src = path.resolve(process.argv[2] || 'docs/screenshots/01-inbox-light.png');
if (!fs.existsSync(src)) {
  console.error('source screenshot not found:', src);
  process.exit(1);
}
const data = fs.readFileSync(src).toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 300 }, deviceScaleFactor: 1 });
await page.setContent(
  `<body style="margin:0;background:#f8fafd"><img id="i" src="data:image/png;base64,${data}" style="display:block;width:400px;height:250px;object-fit:cover;object-position:left top;border-radius:8px;margin:0"></body>`
);
await page.locator('#i').screenshot({ path: 'skin/thumbnail.png' });
await browser.close();
console.log('thumbnail: skin/thumbnail.png');
