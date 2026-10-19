// Expanded UI inventory. Opening controls is read-only; never submits forms or sends mail.
// Run one theme/width at a time with tools/audit-slice.sh.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { base, accounts } from './config.mjs';

const arg = (key, fallback) =>
  process.argv.find((s) => s.startsWith(`--${key}=`))?.split('=')[1] || fallback;
const theme = arg('theme', 'light');
const width = Number(arg('width', '1440'));
const only = arg('only', '').split(',').filter(Boolean);
const out = `test-results/audit/${theme}-${width}`;
fs.mkdirSync(out, { recursive: true });
const [user, password] = accounts[0];
const pages = {
  mail: '_task=mail&_mbox=INBOX',
  compose: '_task=mail&_action=compose',
  contacts: '_task=addressbook',
  'contact-new': '_task=addressbook&_action=add&_source=0&_framed=1',
  'contact-import': '_task=addressbook&_action=import&_framed=1',
  'contact-search': '_task=addressbook&_action=search&_form=1&_framed=1',
  folders: '_task=settings&_action=folders',
  'folder-edit': '_task=settings&_action=edit-folder&_mbox=INBOX&_framed=1',
  identities: '_task=settings&_action=identities',
  'identity-new': '_task=settings&_action=add-identity&_framed=1',
  responses: '_task=settings&_action=responses',
  'response-new': '_task=settings&_action=add-response&_framed=1',
  filters: '_task=settings&_action=plugin.managesieve',
  'filter-new': '_task=settings&_action=plugin.managesieve-action&_framed=1',
  vacation: '_task=settings&_action=plugin.managesieve-vacation',
  forwarding: '_task=settings&_action=plugin.managesieve-forward',
  password: '_task=settings&_action=plugin.password',
  twofactor: '_task=settings&_action=plugin.twofactor_gauthenticator',
  carddav: '_task=settings&_action=plugin.carddav',
  'carddav-new':
    '_task=settings&_action=plugin.carddav.AccDetails&accountid=new&_framed=1&_nav=hide',
};
for (const section of [
  'general',
  'mailbox',
  'mailview',
  'compose',
  'addressbook',
  'folders',
  'server',
  'encryption',
  'authres_status',
  'scheduled_sending',
  'thunderbird_labels',
]) {
  pages[`prefs-${section}`] = `_task=settings&_action=edit-prefs&_section=${section}&_framed=1`;
}
const report = [];
const browser = await chromium.launch({
  args: ['--disable-dev-shm-usage', '--disable-gpu', '--renderer-process-limit=2'],
});
const context = await browser.newContext({
  viewport: { width, height: width <= 480 ? 844 : 900 },
  hasTouch: width <= 480,
  isMobile: width <= 480,
  colorScheme: theme,
});
await context.addCookies([{ name: 'colorMode', value: theme, url: base }]);
const p = await context.newPage();
p.setDefaultTimeout(5000);
let errors = [];
p.on('pageerror', (e) => errors.push(e.message));
let captureCount = 0;
const safe = (s) => s.replace(/[^a-z0-9-]/gi, '-').slice(0, 100);
async function capture(name) {
  await p.waitForTimeout(160);
  const file = `${safe(name)}.png`;
  await p.screenshot({ path: `${out}/${file}` });
  const geometry = await p.evaluate(() => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      return (
        r.width > 0 &&
        r.height > 0 &&
        r.bottom > 0 &&
        r.top < innerHeight &&
        getComputedStyle(el).visibility !== 'hidden'
      );
    };
    return {
      action: window.rcmail?.env.action,
      title: document.title,
      scrollWidth: document.documentElement.scrollWidth,
      viewport: innerWidth,
      overflowing: [
        ...document.querySelectorAll('button,input,select,textarea,.gm-open,.gm-dialog'),
      ]
        .filter(visible)
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.left < -1 || r.right > innerWidth + 1;
        })
        .map((el) => ({ tag: el.tagName, id: el.id, class: el.className })),
      native: [
        ...document.querySelectorAll(
          'select,input[type="file"],input[type="date"],input[type="datetime-local"]'
        ),
      ]
        .filter(visible)
        .filter(
          (el) => getComputedStyle(el).opacity !== '0' && getComputedStyle(el).appearance !== 'none'
        )
        .map((el) => ({ tag: el.tagName, type: el.type, id: el.id })),
    };
  });
  report.push({ name, file, configuredWidth: width, geometry, errors: [...errors] });
  captureCount++;
}
async function controls(name) {
  // Discover accessible controls from actual rendered markup, including plugin additions.
  const selectors = ['.gm-select-btn:not(:disabled)', '.gm-dt-btn', '[data-popup]'];
  for (const selector of selectors) {
    const handles = await p.locator(selector).elementHandles();
    for (let i = 0; i < handles.length; i++) {
      const control = handles[i];
      if (
        !(await control.isVisible()) ||
        (await control.getAttribute('aria-disabled')) === 'true' ||
        (await control.evaluate(
          (el) => el.classList.contains('disabled') || getComputedStyle(el).pointerEvents === 'none'
        ))
      )
        continue;
      const label = await control.evaluate(
        (el) =>
          el.dataset.popup ||
          el.closest('.gm-select')?.querySelector('select')?.name ||
          el.id ||
          el.textContent.trim()
      );
      const state = `${name}-${safe(label || selector)}-${i}`;
      try {
        await control.scrollIntoViewIfNeeded();
        await control.click();
        await capture(`${state}-open`);
        // Nested menus, e.g. Copy to / Move to, are only available after opening More.
        const nested = p.locator('.popupmenu.gm-open a[aria-haspopup="true"]');
        const subCount = await nested.count();
        for (let n = 0; n < subCount; n++) {
          const sub = nested.nth(n);
          if (!(await sub.isVisible())) continue;
          const subLabel = await sub.innerText();
          await sub.click();
          await capture(`${state}-${safe(subLabel)}-open`);
          await p.keyboard.press('Escape');
        }
        await p.keyboard.press('Escape');
        await capture(`${state}-closed`);
      } catch (e) {
        report.push({ name: state, failure: e.message.split('\n')[0] });
        await p.keyboard.press('Escape');
      }
    }
  }
}
async function scrolls(name) {
  const documentHeight = await p.evaluate(() => document.scrollingElement.scrollHeight);
  const viewportHeight = p.viewportSize().height;
  for (let y = viewportHeight - 100; y < documentHeight; y += viewportHeight - 100) {
    await p.evaluate((y) => window.scrollTo(0, y), y);
    await capture(`${name}-document-scroll-${y}`);
  }
  await p.evaluate(() => window.scrollTo(0, 0));
  const count = await p.locator('.scroller,.gm-dialog-body,.formcontent').count();
  for (let i = 0; i < count; i++) {
    const el = p.locator('.scroller,.gm-dialog-body,.formcontent').nth(i);
    if (!(await el.isVisible())) continue;
    const sizes = await el.evaluate((n) => ({ height: n.clientHeight, total: n.scrollHeight }));
    if (sizes.height < 40 || sizes.total <= sizes.height + 2) continue;
    for (
      let y = Math.max(1, sizes.height - 80);
      y < sizes.total;
      y += Math.max(1, sizes.height - 80)
    ) {
      await el.evaluate((n, y) => {
        n.scrollTop = y;
      }, y);
      await capture(`${name}-scroll-${i}-${y}`);
    }
    await el.evaluate((n) => {
      n.scrollTop = 0;
    });
  }
}
try {
  await p.goto(`${base}/?_task=login`);
  await p.fill('#rcmloginuser', user);
  await p.fill('#rcmloginpwd', password);
  await Promise.all([p.waitForNavigation(), p.click('#rcmloginsubmit')]);
  for (const [name, query] of Object.entries(pages)) {
    if (only.length && !only.includes(name)) continue;
    errors = [];
    try {
      await p.goto(`${base}/?${query}`);
      await p.waitForTimeout(name === 'compose' ? 1400 : 500);
      await capture(`${name}-base`);
      if (name === 'mail') {
        await p.locator('#messagelist tbody tr td.selection input').first().click();
        await capture('mail-selected');
      }
      await controls(name);
      await scrolls(name);
      console.log(`${theme}/${width} ${name}: ${captureCount} captures total`);
    } catch (e) {
      report.push({ name, failure: e.message.split('\n')[0] });
      console.log(`${theme}/${width} ${name}: FAILED ${e.message.split('\n')[0]}`);
    }
    fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
    await p.goto('about:blank');
  }
} finally {
  await browser.close();
  fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
}
console.log(
  `${captureCount} screenshots. ${report.filter((r) => r.failure).length} failed actions. Review every image in ${out}.`
);
