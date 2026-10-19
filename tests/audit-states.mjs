// Deeper transient states. No settings are saved and no mail is sent.
// Run in a resource-capped scope, one browser at a time.
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
import { base, accounts } from './config.mjs';
const theme = process.argv[2] || 'light';
const width = Number(process.argv[3] || 1440);
const out = `test-results/states/${theme}-${width}`;
fs.mkdirSync(out, { recursive: true });
const [user, password] = accounts[0];
const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] });
const context = await browser.newContext({
  viewport: { width, height: width < 500 ? 844 : 900 },
  hasTouch: width < 500,
  isMobile: width < 500,
  colorScheme: theme,
});
await context.addCookies([{ name: 'colorMode', value: theme, url: base }]);
const p = await context.newPage();
p.setDefaultTimeout(6000);
const report = [],
  errors = [];
p.on('pageerror', (e) => errors.push(e.message));
async function shot(name) {
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${out}/${name}.png` });
  const geometry = await p.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    overlays: [
      ...document.querySelectorAll('.gm-dialog,.popupmenu.gm-open,.gm-select-menu,.tox-dialog'),
    ]
      .filter((n) => n.getBoundingClientRect().width)
      .map((n) => {
        const r = n.getBoundingClientRect();
        return { id: n.id, x: r.x, y: r.y, width: r.width, height: r.height };
      }),
  }));
  report.push({ name, geometry });
}
async function run(name, fn) {
  try {
    await fn();
    report.push({ check: name, pass: true });
    console.log(`PASS ${name}`);
  } catch (e) {
    report.push({ check: name, pass: false, error: e.message });
    console.log(`FAIL ${name}: ${e.message.split('\n')[0]}`);
    await p.keyboard.press('Escape');
  }
  fs.writeFileSync(`${out}/report.json`, JSON.stringify({ report, errors }, null, 2));
}
async function go(query) {
  await p.goto(`${base}/?${query}`);
  await p.waitForTimeout(500);
}
async function nested(name, parent) {
  const buttons = p.locator(`${parent} .gm-select-btn:visible`);
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    await buttons.nth(i).click();
    await shot(`${name}-select-${i}-open`);
    await p.keyboard.press('Escape');
    await expect(buttons.nth(i)).toBeVisible();
    await shot(`${name}-select-${i}-closed`);
  }
}
try {
  await go('_task=login');
  await p.fill('#rcmloginuser', user);
  await p.fill('#rcmloginpwd', password);
  await Promise.all([p.waitForNavigation(), p.click('#rcmloginsubmit')]);
  await run('navigation folder tree and hover', async () => {
    await go('_task=mail&_mbox=INBOX');
    if (width <= 1024) await p.locator('#nav-toggle').click();
    const toggle = p.locator('#mailboxlist .treetoggle').first();
    await toggle.click();
    await shot('folders-tree-expanded');
    await toggle.hover();
    await shot('folders-tree-hover');
    await p.mouse.move(width - 1, 0);
    await toggle.click();
    await shot('folders-tree-collapsed');
    if (width > 1024) {
      await p.locator('#nav-toggle').click();
      await shot('navigation-rail');
      await p.locator('#mailboxlist a').first().hover();
      await shot('navigation-rail-hover');
      await p.locator('#nav-toggle').click();
    }
  });
  await run('search options nested controls', async () => {
    await go('_task=mail&_mbox=INBOX');
    await p.locator('.gm-search .button.options').click();
    await shot('search-options-open');
    await nested('search', '#searchmenu');
    await p.keyboard.press('Escape');
    await shot('search-options-closed');
  });
  await run('message headers and summary', async () => {
    await go('_task=mail&_mbox=INBOX');
    const uid = await p.evaluate(() => Object.keys(rcmail.message_list.rows)[0]);
    await go(`_task=mail&_action=show&_mbox=INBOX&_uid=${uid}`);
    await p.locator('.gm-msg-to').click();
    await shot('message-expanded-headers');
    await p.locator('.headers-all').click();
    await shot('message-raw-headers');
    await p.keyboard.press('Escape');
    await p.locator('.ai-summarize').click();
    await expect(p.locator('.gm-ai-card-text')).not.toBeEmpty();
    await expect(p.locator('.gm-ai-card-text')).not.toContainText('var tb_labels_for_message');
    await shot('message-summary');
    await p.locator('.gm-ai-card-close').click();
    await shot('message-summary-closed');
  });
  await run('compose options and recipient picker', async () => {
    await go('_task=mail&_action=compose');
    await p.locator('#composebody_ifr').waitFor();
    await p.locator('[data-popup="compose-options-menu"]').click();
    await shot('compose-options-open');
    await nested('compose-options', '#compose-options-menu');
    for (const id of ['compose-mdn', 'compose-dsn', 'compose-keep-formatting']) {
      const cb = p.locator(`#${id}`);
      if (await cb.isVisible()) {
        await cb.click();
        await shot(`${id}-on`);
        await cb.click();
      }
    }
    await p.keyboard.press('Escape');
    await shot('compose-options-closed');
    await p.locator('#compose_to a[href="#add-contact"]').click();
    await expect(p.locator('.gm-dialog #directorylist')).toBeVisible();
    await shot('recipient-dialog');
    await nested('recipient', '.gm-dialog');
    await p.locator('.gm-dialog #contacts-table tbody tr').first().click();
    await p.locator('.gm-dialog-actions [data-mainaction]').click();
    await expect(p.locator('#compose_to .recipient')).toHaveCount(1);
    await expect(p.locator('.gm-dialog')).toHaveCount(0);
    await shot('recipient-dialog-closed');
    await p.evaluate(() => {
      document.querySelector('#_to').value = '';
      document.querySelector('#_to').dispatchEvent(new Event('change'));
      rcmail.cmp_hash = rcmail.compose_field_hash();
    });
  });
  await run('editor menus and dialogs', async () => {
    await go('_task=mail&_action=compose');
    await p.locator('#composebody_ifr').waitFor();
    const toolbar = p.locator('.tox-toolbar-overlord');
    const overflow = toolbar.locator('button[data-alloy-tabstop="true"][aria-label="More..."]');
    if (await overflow.isVisible()) {
      await overflow.click();
      await shot('editor-toolbar-overflow-open');
    }
    const menus = toolbar.locator('button[aria-haspopup="true"]');
    for (let i = 0; i < (await menus.count()); i++) {
      const btn = menus.nth(i);
      if (!(await btn.isVisible())) continue;
      await btn.click();
      await shot(`editor-menu-${i}-open`);
      await p.keyboard.press('Escape');
      await shot(`editor-menu-${i}-closed`);
    }
    for (const command of ['mceLink', 'mceImage']) {
      await p.evaluate((command) => tinymce.get('composebody').execCommand(command), command);
      await p.locator('.tox-dialog').waitFor();
      await shot(`editor-${command}-dialog`);
      await p.keyboard.press('Escape');
      await shot(`editor-${command}-closed`);
    }
    report.push({
      spell: await p.evaluate(() => ({
        langs: rcmail.env.spell_langs,
        buttons: [...document.querySelectorAll('[data-popup="spell-menu"]')].map((n) => ({
          display: getComputedStyle(n).display,
          parent: getComputedStyle(n.parentElement).display,
        })),
      })),
    });
  });
  await run('AI result and insert', async () => {
    await go('_task=mail&_action=compose');
    await p.locator('#composebody_ifr').waitFor();
    await p.frameLocator('#composebody_ifr').locator('body').fill('Please refine this test draft.');
    await p.locator('#gm-ai-button').click();
    await shot('ai-menu');
    await p.locator('#ai-menu .ai-improve').click();
    await expect(p.locator('.gm-ai-text')).not.toBeEmpty();
    await shot('ai-result');
    await p.locator('.gm-dialog-actions [data-mainaction]').click();
    await shot('ai-inserted');
    await p.evaluate(() => {
      tinymce.get('composebody').setContent('');
      rcmail.cmp_hash = rcmail.compose_field_hash();
    });
  });
  await run('conditional filter controls', async () => {
    await go('_task=settings&_action=plugin.managesieve-action&_framed=1');
    for (const name of ['_header[', '_action_type[']) {
      const select = p.locator(`select[name^="${name}"]`).first();
      await expect(select).toHaveCount(1);
      const options = await select
        .locator('option')
        .evaluateAll((nodes) =>
          nodes.filter((n) => !n.disabled).map((n) => ({ value: n.value, text: n.textContent }))
        );
      for (const option of options) {
        await select.selectOption(option.value, { force: true });
        await shot(
          `filter-${name.includes('header') ? 'rule' : 'action'}-${option.value.replace(/[^a-z0-9]/gi, '-')}`
        );
        const tall = await p.evaluate(() => document.scrollingElement.scrollHeight > innerHeight);
        if (tall) {
          await p.evaluate(() => window.scrollTo(0, document.scrollingElement.scrollHeight));
          await shot(
            `filter-${name.includes('header') ? 'rule' : 'action'}-${option.value.replace(/[^a-z0-9]/gi, '-')}-bottom`
          );
          await p.evaluate(() => window.scrollTo(0, 0));
        }
      }
    }
  });
  await run('contact details and photo dialog', async () => {
    await go('_task=addressbook');
    const cid = await p.evaluate(() => Object.keys(rcmail.contact_list.rows)[0]);
    await go(`_task=addressbook&_action=show&_source=0&_cid=${cid}&_framed=1`);
    await shot('contact-details');
    await go(`_task=addressbook&_action=edit&_source=0&_cid=${cid}&_framed=1`);
    await shot('contact-edit');
    await go('_task=addressbook&_action=add&_source=0&_framed=1');
    const chooser = p.waitForEvent('filechooser');
    await p.locator('.gm-photo-choose').click();
    await (
      await chooser
    ).setFiles({
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: fs.readFileSync('skin/images/icon-192.png'),
    });
    await expect(p.locator('#ff_photo')).not.toHaveValue('-del-');
    await expect(p.locator('.gm-photo-remove')).toBeVisible();
    await shot('contact-photo-uploaded');
    await p.locator('.gm-photo-remove').click();
    await expect(p.locator('#ff_photo')).toHaveValue('-del-');
    await shot('contact-photo-closed');
  });
  await run('twofactor setup without saving', async () => {
    await go('_task=settings&_action=plugin.twofactor_gauthenticator');
    await p.locator('[id="2FA_setup_fields"]').click();
    // The test secret is deliberately masked in captures and never saved.
    await p
      .locator('input[name="2FA_secret"]')
      .evaluate((n) => (n.type = 'password'))
      .catch(() => {});
    await shot('twofactor-setup');
    await p.keyboard.press('Escape');
    await p
      .locator('#twofactor_gauthenticator-form')
      .evaluate((n) => n.scrollIntoView({ block: 'end' }));
    await shot('twofactor-setup-bottom');
  });
} finally {
  await browser.close();
  fs.writeFileSync(`${out}/report.json`, JSON.stringify({ report, errors }, null, 2));
}
if (report.some((r) => r.pass === false) || errors.length) process.exitCode = 1;
