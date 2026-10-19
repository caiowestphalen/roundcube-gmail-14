// Final checks for controls, frame-local recipient selection, and the Gmail login preview.
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
import { base, accounts } from './config.mjs';
import assert from 'node:assert/strict';
const [user, password] = accounts[0];
const out = 'test-results/extras';
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] });
const results = [],
  errors = [];
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, pass: true });
    console.log('PASS', name);
  } catch (e) {
    results.push({ name, pass: false, error: e.message });
    console.log('FAIL', name, e.message.split('\n')[0]);
  }
}
try {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${base}/?_task=login`);
  await p.fill('#rcmloginuser', user);
  await p.fill('#rcmloginpwd', password);
  await Promise.all([p.waitForNavigation(), p.click('#rcmloginsubmit')]);
  await check('multiple select retains values and keyboard behavior', async () => {
    await p.goto(`${base}/?_task=settings&_action=edit-prefs&_section=general&_framed=1`);
    const select = p.locator('select[multiple]').first();
    await expect(select).toHaveCount(1);
    const values = await select.evaluate((n) => ({
      name: n.name,
      selected: [...n.selectedOptions].map((o) => o.value),
      first: n.options[0].value,
    }));
    const first = p.locator('.gm-choice-option').first();
    const selected = await first.getAttribute('aria-selected');
    await first.click();
    await expect(first).toHaveAttribute('aria-selected', String(selected !== 'true'));
    const submitted = await select.evaluate((n) => new FormData(n.form).getAll(n.name));
    assert.equal(submitted.includes(values.first), selected !== 'true');
    await first.press('ArrowDown');
    await expect(p.locator('.gm-choice-option').nth(1)).toBeFocused();
    await select.evaluate((n) => {
      n.disabled = true;
    });
    await expect(first).toBeDisabled();
    await select.evaluate((n) => {
      n.disabled = false;
    });
    await p.screenshot({ path: `${out}/multiple-select.png` });
  });
  await check('recipient picker targets Cc inside compose popup', async () => {
    await p.goto(`${base}/?_task=mail&_mbox=INBOX`);
    await p.locator('#messagelist tbody tr').first().waitFor();
    await p.locator('a.gm-compose').click();
    await expect.poll(() => p.frames().some((f) => f.url().includes('_action=compose'))).toBe(true);
    const f = p.frames().find((f) => f.url().includes('_action=compose'));
    await f.locator('#composebody_ifr').waitFor();
    await f.locator('[data-header="cc"]').click();
    await f.locator('#compose_cc a[href="#add-contact"]').click();
    await f.locator('.gm-dialog #contacts-table tbody tr').first().click();
    await f.locator('.gm-dialog-actions [data-mainaction]').click();
    await expect(f.locator('#compose_cc .recipient')).toHaveCount(1);
    await expect(f.locator('#compose_to .recipient')).toHaveCount(0);
    await p.screenshot({ path: `${out}/popup-recipient-cc.png` });
    await f.evaluate(() => {
      document.querySelector('#_cc').value = '';
      document.querySelector('#_cc').dispatchEvent(new Event('change'));
      rcmail.cmp_hash = rcmail.compose_field_hash();
    });
  });
  await check('scheduled table stays within phone viewport', async () => {
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(`${base}/?_task=settings&_action=edit-prefs&_section=scheduled_sending&_framed=1`);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 390);
    await p.screenshot({ path: `${out}/scheduled-phone.png` });
  });
  await check('spell language opens and updates selection', async () => {
    await p.goto(`${base}/?_task=mail&_action=compose`);
    await p.locator('#composebody_ifr').waitFor();
    await p.locator('[data-popup="spell-menu"]').click();
    await expect(p.locator('#spell-menu.gm-open a')).toHaveCount(4);
    await p.screenshot({ path: `${out}/spell-languages.png` });
    const initial = await p.evaluate(() => rcmail.spellcheck_lang());
    const other = p.locator('#spell-menu a').last();
    const language = await other.getAttribute('data-lang');
    await other.click();
    assert.equal(await p.evaluate(() => rcmail.spellcheck_lang()), language);
    await p.evaluate((lang) => rcmail.spellcheck_lang_set(lang), initial);
  });
  await p.close();
  for (const theme of ['light', 'dark'])
    for (const width of [320, 390, 820, 1440])
      await check(`Gmail login ${theme} ${width}`, async () => {
        const ctx = await b.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
        await ctx.addCookies([
          { name: 'colorMode', value: theme, url: process.env.RC_LOGIN_URL || base },
        ]);
        const page = await ctx.newPage();
        await page.goto(`${process.env.RC_LOGIN_URL || base}/?_task=login`);
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator('#rcmloginuser')).toBeVisible();
        assert.equal(await page.evaluate(() => rcmail.env.skin), 'gmail');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
        assert.equal(
          await page
            .locator('img')
            .evaluateAll((ns) => ns.filter((n) => !n.complete || !n.naturalWidth).length),
          0
        );
        await page.screenshot({ path: `${out}/login-${theme}-${width}.png` });
        await ctx.close();
      });
} finally {
  await b.close();
  fs.writeFileSync(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
}
if (results.some((r) => !r.pass) || errors.length) process.exitCode = 1;
