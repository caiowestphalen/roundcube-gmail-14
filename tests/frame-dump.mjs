// Dump the HTML of framed pages (iframe contents the sweep can't see) to test-results/frames/<name>.html
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { base, accounts } from './config.mjs';
const [user, pass] = accounts[0];
const pages = {
  'prefs-general': '_task=settings&_action=edit-prefs&_section=general&_framed=1',
  'prefs-mailbox': '_task=settings&_action=edit-prefs&_section=mailbox&_framed=1',
  'prefs-compose': '_task=settings&_action=edit-prefs&_section=compose&_framed=1',
  'prefs-mailview': '_task=settings&_action=edit-prefs&_section=mailview&_framed=1',
  'prefs-addressbook': '_task=settings&_action=edit-prefs&_section=addressbook&_framed=1',
  'prefs-folders': '_task=settings&_action=edit-prefs&_section=folders&_framed=1',
  'prefs-server': '_task=settings&_action=edit-prefs&_section=server&_framed=1',
  'identity-edit': '_task=settings&_action=edit-identity&_iid=1&_framed=1',
  'response-new': '_task=settings&_action=add-response&_framed=1',
  'folder-edit': '_task=settings&_action=edit-folder&_mbox=INBOX&_framed=1',
  'filter-edit': '_task=settings&_action=plugin.managesieve-action&_framed=1&_fid=0',
  'filter-new': '_task=settings&_action=plugin.managesieve-action&_framed=1',
  vacation: '_task=settings&_action=plugin.managesieve-vacation&_framed=1',
  forward: '_task=settings&_action=plugin.managesieve-forward&_framed=1',
  password: '_task=settings&_action=plugin.password&_framed=1',
  twofactor: '_task=settings&_action=twofactor_gauthenticator&_framed=1',
  carddav: '_task=settings&_action=plugin.carddav&_framed=1',
  'carddav-new': '_task=settings&_action=plugin.carddav.AbEdit&_framed=1',
  'contact-new': '_task=addressbook&_action=add&_source=0&_framed=1',
  'contact-import': '_task=addressbook&_action=import&_framed=1',
  'contact-search': '_task=addressbook&_action=search&_framed=1',
  'compose-framed': '_task=mail&_action=compose&_extwin=1',
};
const out = 'test-results/frames';
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1000, height: 900 }, ignoreHTTPSErrors: true });
const errors = [];
p.on('pageerror', (e) => errors.push(`[js] ${p.url()} :: ${e.message}`));
p.on('response', (r) => {
  if (r.status() >= 400) errors.push(`[http ${r.status()}] ${r.url()}`);
});
await p.goto(`${base}/?_task=login`);
await p.fill('#rcmloginuser', user);
await p.fill('#rcmloginpwd', pass);
await Promise.all([p.waitForNavigation(), p.click('#rcmloginsubmit')]);
const natives = {};
for (const [name, q] of Object.entries(pages)) {
  try {
    await p.goto(`${base}/?${q}`, { waitUntil: 'networkidle', timeout: 30000 });
    await p.waitForTimeout(800);
    fs.writeFileSync(`${out}/${name}.html`, await p.content());
    await p.screenshot({ path: `${out}/${name}.png` });
    natives[name] = await p.evaluate(() => {
      const vis = (el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return (
          r.width > 2 &&
          r.height > 2 &&
          cs.visibility !== 'hidden' &&
          cs.appearance !== 'none' &&
          cs.opacity !== '0'
        );
      };
      const list = [];
      for (const el of document.querySelectorAll(
        'select, textarea, input:not([type=hidden]):not([type=text]):not([type=password]):not([type=email]):not([type=search])'
      )) {
        if (vis(el))
          list.push(`${el.tagName.toLowerCase()}[${el.type || ''}]#${el.id || ''}.${el.className}`);
      }
      return list;
    });
  } catch (e) {
    errors.push(`[nav] ${name} :: ${e.message.split('\n')[0]}`);
  }
}
fs.writeFileSync(`${out}/natives.json`, JSON.stringify(natives, null, 1));
fs.writeFileSync(`${out}/errors.txt`, errors.join('\n'));
console.log('errors:', errors.length);
console.log(errors.slice(0, 40).join('\n'));
console.log('natives:', JSON.stringify(natives, null, 1));
await b.close();
