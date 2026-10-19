// Full visual sweep: logs in once and captures every view/state at desktop (light + dark) and
// phone widths into test-results/sweep/<theme>-<width>/<state>.png (+ .html, errors.json).
// Usage: node tests/sweep.mjs [--only=state,state] [--widths=1440,390] [--themes=light,dark]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { base, accounts } from './config.mjs';
import path from 'node:path';

const arg = (k, d) =>
  (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1];
const ONLY = arg('only', '') ? arg('only', '').split(',') : null;
const WIDTHS = arg('widths', '1440,390').split(',').map(Number);
const THEMES = arg('themes', 'light,dark').split(',');
const [user, pass] = accounts[0];
const OUT = 'test-results/sweep';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const go = async (p, q) => {
  const r = await p.goto(`${base}/?${q}`);
  // nav collapse state persists in localStorage — never leak it into the next state
  await p
    .evaluate(() => {
      try {
        localStorage.removeItem('gm.nav');
      } catch {
        /* blocked */
      }
      document.documentElement.classList.remove('nav-collapsed');
    })
    .catch(() => {});
  return r;
};
const firstRow = async (p) => {
  await p.waitForSelector('#messagelist tbody tr', { timeout: 15000 });
  return p.locator('#messagelist tbody tr').first();
};
const createAction = async (p, selector) => {
  const fab = p.locator('.gm-fab');
  if (await fab.isVisible()) await fab.click();
  else await p.locator(selector).first().click();
};
const clickRow = async (p) => {
  const box = await (await firstRow(p)).boundingBox();
  await p.mouse.click(box.x + box.width * 0.55, box.y + box.height / 2);
  await sleep(1500);
};

// [name, action, {phone:false to skip on phone}]
const STATES = [
  ['login', async (p) => go(p, '_task=login'), { noauth: true }],
  [
    'mail',
    async (p) => {
      await go(p, '_task=mail&_mbox=INBOX');
      await firstRow(p);
    },
  ],
  [
    'mail-hover',
    async (p) => {
      await go(p, '_task=mail&_mbox=INBOX');
      const r = await firstRow(p);
      await r.hover();
      await sleep(400);
    },
  ],
  [
    'mail-selected',
    async (p) => {
      await go(p, '_task=mail&_mbox=INBOX');
      await firstRow(p);
      await sleep(600);
      await p.locator('#messagelist tbody tr td.selection input').nth(0).click();
      await p.locator('#messagelist tbody tr td.selection input').nth(1).click();
      await sleep(400);
    },
  ],
  [
    'mail-selectmenu',
    async (p) => {
      await go(p, '_task=mail&_mbox=INBOX');
      await firstRow(p);
      await p.click('#messagelist-header a.select-caret');
      await sleep(400);
    },
  ],
  [
    'mail-listoptions',
    async (p) => {
      await go(p, '_task=mail&_mbox=INBOX');
      await firstRow(p);
      await p.click('#messagelist-header a.options');
      await sleep(500);
    },
  ],
  [
    'mail-folderactions',
    async (p) => {
      await go(p, '_task=mail&_mbox=INBOX');
      await firstRow(p);
      await p.locator('#mailboxlist li.inbox a').first().click({ button: 'right' });
      await sleep(500);
    },
  ],
  [
    'message',
    async (p) => {
      await go(p, '_task=mail&_mbox=INBOX');
      await clickRow(p);
    },
  ],
  [
    'message-more',
    async (p) => {
      await go(p, '_task=mail&_mbox=INBOX');
      await clickRow(p);
      await p.click('#layout-content .toolbar a.more');
      await sleep(400);
    },
  ],
  [
    'message-mark',
    async (p) => {
      await go(p, '_task=mail&_mbox=INBOX');
      await clickRow(p);
      await p.click('#layout-content .toolbar a.markmessage');
      await sleep(400);
    },
  ],
  [
    'show',
    async (p) => {
      await go(p, '_task=mail&_mbox=INBOX');
      await firstRow(p);
      const href = await p
        .locator('#messagelist tbody tr td.subject a')
        .first()
        .getAttribute('href');
      await p.goto(base + href);
      await sleep(800);
    },
  ],
  [
    'compose',
    async (p) => {
      await go(p, '_task=mail&_action=compose');
      await sleep(1200);
    },
  ],
  [
    'compose-cc',
    async (p) => {
      await go(p, '_task=mail&_action=compose');
      await sleep(800);
      await p.click('.gm-hlink[data-header="cc"]');
      await p.keyboard.type('someone@example.com, "Jane Doe" <jane@example.com>, ');
      await sleep(300);
      await p.click('#compose-subject');
      await p.keyboard.type('Subject sample');
      await sleep(300);
    },
  ],
  [
    'compose-options',
    async (p) => {
      await go(p, '_task=mail&_action=compose');
      await sleep(800);
      await p.click('.gm-compose-tools a.more');
      await sleep(500);
    },
  ],
  [
    'compose-sendmenu',
    async (p) => {
      await go(p, '_task=mail&_action=compose');
      await sleep(800);
      await p.click('.gm-send-more');
      await sleep(500);
    },
  ],
  [
    'compose-popup',
    async (p) => {
      await go(p, '_task=mail&_mbox=INBOX');
      await firstRow(p);
      await p.click('.gm-compose');
      await sleep(2500);
    },
    { phone: false },
  ],
  [
    'compose-popup-min',
    async (p) => {
      await go(p, '_task=mail&_mbox=INBOX');
      await firstRow(p);
      await p.click('.gm-compose');
      await sleep(2000);
      await p.click('.gm-cwin-btn.min');
      await sleep(400);
    },
    { phone: false },
  ],
  [
    'compose-popup-full',
    async (p) => {
      await go(p, '_task=mail&_mbox=INBOX');
      await firstRow(p);
      await p.click('.gm-compose');
      await sleep(2000);
      await p.click('.gm-cwin-btn.full');
      await sleep(500);
    },
    { phone: false },
  ],
  [
    'reply',
    async (p) => {
      await go(p, '_task=mail&_mbox=INBOX');
      await clickRow(p);
      await p.click('#layout-content .toolbar a.reply');
      await sleep(2500);
    },
  ],
  [
    'search-options',
    async (p) => {
      await go(p, '_task=mail&_mbox=INBOX');
      await firstRow(p);
      await p.click('.gm-search .button.options');
      await sleep(500);
    },
  ],
  [
    'apps-menu',
    async (p) => {
      await go(p, '_task=mail&_mbox=INBOX');
      await p.click('#apps-toggle');
      await sleep(400);
    },
  ],
  [
    'account-menu',
    async (p) => {
      await go(p, '_task=mail&_mbox=INBOX');
      await p.click('#account-toggle');
      await sleep(400);
    },
  ],
  [
    'about',
    async (p) => {
      await go(p, '_task=mail&_mbox=INBOX');
      await p.click('#account-toggle');
      await sleep(300);
      await p.click('#account-menu a.about');
      await sleep(1200);
    },
  ],
  [
    'nav-collapsed',
    async (p) => {
      await go(p, '_task=mail&_mbox=INBOX');
      await firstRow(p);
      await p.click('#nav-toggle');
      await sleep(500);
    },
  ],
  [
    'contacts',
    async (p) => {
      await go(p, '_task=addressbook');
      await sleep(800);
    },
  ],
  [
    'contact-new',
    async (p) => {
      await go(p, '_task=addressbook');
      await sleep(600);
      await createAction(p, '#layout-menu .gm-compose');
      await sleep(1500);
    },
  ],
  [
    'settings',
    async (p) => {
      await go(p, '_task=settings');
      await sleep(600);
    },
  ],
  [
    'prefs-general',
    async (p) => {
      await go(p, '_task=settings&_action=preferences');
      await sleep(500);
      await p.click('#sections-table tr.general td');
      await sleep(1200);
    },
  ],
  [
    'prefs-mailbox',
    async (p) => {
      await go(p, '_task=settings&_action=preferences');
      await sleep(500);
      await p.click('#sections-table tr.mailbox td');
      await sleep(1200);
    },
  ],
  [
    'prefs-compose',
    async (p) => {
      await go(p, '_task=settings&_action=preferences');
      await sleep(500);
      await p.click('#sections-table tr.compose td');
      await sleep(1200);
    },
  ],
  [
    'folders',
    async (p) => {
      await go(p, '_task=settings&_action=folders');
      await sleep(800);
    },
  ],
  [
    'folder-edit',
    async (p) => {
      await go(p, '_task=settings&_action=folders');
      await sleep(600);
      await p.locator('#subscription-table li.inbox a').first().click();
      await sleep(1200);
    },
  ],
  [
    'identities',
    async (p) => {
      await go(p, '_task=settings&_action=identities');
      await sleep(600);
      await p.locator('#identities-table tbody tr').first().click();
      await sleep(1200);
    },
  ],
  [
    'responses',
    async (p) => {
      await go(p, '_task=settings&_action=responses');
      await sleep(600);
      await createAction(p, '#layout-content .toolbar a.create');
      await sleep(1200);
    },
  ],
  [
    'filters',
    async (p) => {
      await go(p, '_task=settings&_action=plugin.managesieve');
      await sleep(800);
      await createAction(
        p,
        '#layout-content .toolbar a.create, #filterslist-toolbar a.create, a.create'
      );
      await sleep(1500);
    },
  ],
  [
    'vacation',
    async (p) => {
      await go(p, '_task=settings&_action=plugin.managesieve-vacation');
      await sleep(1200);
    },
  ],
  [
    'password',
    async (p) => {
      await go(p, '_task=settings&_action=plugin.password');
      await sleep(1000);
    },
  ],
  [
    'twofactor',
    async (p) => {
      await go(p, '_task=settings&_action=plugin.twofactor_gauthenticator');
      await sleep(1000);
    },
  ],
  [
    'carddav',
    async (p) => {
      await go(p, '_task=settings&_action=plugin.carddav');
      await sleep(1000);
    },
  ],
  [
    'dialog-confirm',
    async (p) => {
      await go(p, '_task=mail&_mbox=INBOX');
      await clickRow(p);
      await p.click('#layout-content .toolbar a.more');
      await sleep(300);
      await p.evaluate(() => {
        UI.modal.confirm('Delete this conversation permanently?', {
          title: 'Confirm',
          danger: true,
          okLabel: 'Delete',
        });
      });
      await sleep(400);
    },
  ],
  [
    'toast',
    async (p) => {
      await go(p, '_task=mail&_mbox=INBOX');
      await p.evaluate(() => {
        rcmail.display_message('Message sent.', 'confirmation');
        rcmail.display_message('Could not connect to the server.', 'error');
        UI.toast.show('Conversation archived', { action: { label: 'Undo' } });
      });
      await sleep(400);
    },
  ],
  [
    'nav-open',
    async (p) => {
      await go(p, '_task=mail&_mbox=INBOX');
      await firstRow(p);
      await p.click('#nav-toggle');
      await sleep(500);
    },
    { desktop: false },
  ],
];

// Resource discipline: this runs on the production box. One browser, one page, modest renderer
// limits, a pause between states, about:blank between captures (drops compose iframes/TinyMCE).
const PAUSE = Number(arg('pause', '400'));
// states that need the nav drawer or the hidden content toolbar on phones
const PHONE_SKIP = new Set(['apps-menu', 'mail-folderactions']);
const browser = await chromium.launch({
  args: [
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--renderer-process-limit=2',
    '--js-flags=--max-old-space-size=256',
  ],
});
const shutdown = async () => {
  await browser.close().catch(() => {});
  process.exit(1);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
const summary = [];
for (const theme of THEMES) {
  for (const width of WIDTHS) {
    const phone = width <= 1024;
    const dir = path.join(OUT, `${theme}-${width}`);
    fs.mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({
      viewport: { width, height: phone ? 844 : 900 },
      isMobile: phone,
      hasTouch: phone,
      ignoreHTTPSErrors: true,
      colorScheme: theme === 'dark' ? 'dark' : 'light',
    });
    await ctx.addCookies([
      { name: 'colorMode', value: theme, domain: new URL(base).hostname, path: '/' },
    ]);
    const page = await ctx.newPage();
    page.setDefaultTimeout(20000);
    page.setDefaultNavigationTimeout(30000);
    let errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on(
      'response',
      (r) =>
        r.status() >= 400 &&
        !/wp-content/.test(r.url()) &&
        errors.push(`http ${r.status()}: ${r.url()}`)
    );
    page.on(
      'console',
      (m) =>
        m.type() === 'error' &&
        !/ERR_SSL|wp-content|Failed to load resource/.test(m.text()) &&
        errors.push(`console: ${m.text()}`)
    );

    // login
    await page.goto(`${base}/?_task=login`);
    await page.fill('#rcmloginuser', user);
    await page.fill('#rcmloginpwd', pass);
    await Promise.all([page.waitForNavigation(), page.click('#rcmloginsubmit')]);

    for (const [name, act, opts = {}] of STATES) {
      if (ONLY && !ONLY.includes(name)) continue;
      if (phone && (opts.phone === false || PHONE_SKIP.has(name))) continue;
      if (!phone && opts.desktop === false) continue;
      errors = [];
      const t0 = Date.now();
      try {
        if (opts.noauth) {
          const c2 = await browser.newContext({
            viewport: { width, height: phone ? 844 : 900 },
            ignoreHTTPSErrors: true,
            colorScheme: theme === 'dark' ? 'dark' : 'light',
          });
          await c2.addCookies([
            { name: 'colorMode', value: theme, domain: new URL(base).hostname, path: '/' },
          ]);
          const p2 = await c2.newPage();
          await act(p2);
          await sleep(500);
          await p2.screenshot({ path: path.join(dir, `${name}.png`) });
          fs.writeFileSync(path.join(dir, `${name}.html`), await p2.content());
          await c2.close();
        } else {
          let deadline;
          try {
            await Promise.race([
              act(page),
              new Promise((_, rej) => {
                deadline = setTimeout(() => rej(new Error('state timeout (60s)')), 60000);
              }),
            ]);
          } finally {
            clearTimeout(deadline);
          }
          await sleep(300);
          await page.screenshot({ path: path.join(dir, `${name}.png`) });
          fs.writeFileSync(path.join(dir, `${name}.html`), await page.content());
        }
        summary.push({
          theme,
          width,
          name,
          ok: true,
          ms: Date.now() - t0,
          errors: [...new Set(errors)],
        });
        console.log(
          `[${theme} ${width}] ${name} ok${errors.length ? ` (${errors.length} err)` : ''}`
        );
      } catch (e) {
        summary.push({
          theme,
          width,
          name,
          ok: false,
          error: e.message.split('\n')[0],
          errors: [...new Set(errors)],
        });
        console.log(`[${theme} ${width}] ${name} FAILED: ${e.message.split('\n')[0]}`);
        await page.screenshot({ path: path.join(dir, `${name}.FAILED.png`) }).catch(() => {});
      }
      // reset state between captures
      await page
        .evaluate(() => {
          try {
            UI.popup.closeAll();
            UI.modal.closeAll();
            UI.composeWindow?.closeAll?.();
          } catch (e) {
            /* ignore */
          }
        })
        .catch(() => {});
      await page.goto('about:blank').catch(() => {});
      await sleep(PAUSE);
    }
    await ctx.close();
  }
}
await browser.close();
// merge into summary.json so slices run one at a time (--themes/--widths) build one report
const sumPath = path.join(OUT, 'summary.json');
let merged;
try {
  merged = JSON.parse(fs.readFileSync(sumPath, 'utf8'));
} catch {
  merged = [];
}
const ran = new Set(summary.map((s) => `${s.theme}-${s.width}-${s.name}`));
merged = merged.filter((s) => !ran.has(`${s.theme}-${s.width}-${s.name}`)).concat(summary);
fs.writeFileSync(sumPath, JSON.stringify(merged, null, 1));
const failed = summary.filter((s) => !s.ok);
const withErr = summary.filter((s) => s.ok && s.errors.length);
console.log(
  `\n${summary.length} captures, ${failed.length} failed, ${withErr.length} with JS/HTTP errors → ${OUT}/summary.json`
);
