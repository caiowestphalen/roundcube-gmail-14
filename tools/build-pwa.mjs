// Render skin/images/logo.svg to PNG app icons (192/512, maskable) and write the web manifest.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const svg = fs.readFileSync('skin/images/logo.svg', 'utf8');
const b = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
for (const size of [192, 512]) {
  const p = await b.newPage({ viewport: { width: size, height: size } });
  await p.setContent(
    `<body style="margin:0;width:${size}px;height:${size}px;background:#0b57d0;display:grid;place-items:center"><div style="width:${Math.round(size * 0.62)}px;height:${Math.round(size * 0.62)}px;display:grid;place-items:center">${svg.replace('<svg', '<svg style="width:100%;height:100%;filter:brightness(0) invert(1)"')}</div></body>`
  );
  await p.screenshot({ path: `skin/images/icon-${size}.png`, type: 'png' });
  await p.close();
}
await b.close();
const manifest = {
  name: 'Webmail',
  short_name: 'Mail',
  description: 'Gmail-inspired webmail for Roundcube',
  start_url: '/?_task=mail',
  scope: '/',
  display: 'standalone',
  orientation: 'any',
  background_color: '#f8fafd',
  theme_color: '#f8fafd',
  icons: [
    {
      src: '/static.php/skins/gmail/images/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any maskable',
    },
    {
      src: '/static.php/skins/gmail/images/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any maskable',
    },
  ],
  shortcuts: [
    {
      name: 'Compose',
      url: '/?_task=mail&_action=compose',
      icons: [{ src: '/static.php/skins/gmail/images/icon-192.png', sizes: '192x192' }],
    },
    { name: 'Contacts', url: '/?_task=addressbook' },
  ],
};
fs.writeFileSync('skin/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log('pwa: icons + manifest written');
