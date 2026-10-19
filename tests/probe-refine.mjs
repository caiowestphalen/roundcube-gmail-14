// Run under systemd-run with MemoryMax=3G, CPUQuota=150%, nice/ionice (see tests/README.md).
// Uses only the existing test account; draft checks never send mail.
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
import { base, accounts } from './config.mjs';
import assert from 'node:assert/strict';

const [user, password] = accounts[0];
const out = 'test-results/refine';
fs.mkdirSync(out, { recursive: true });
const results = [];
const errors = [];
const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] });
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, pass: true });
  } catch (e) {
    results.push({ name, pass: false, error: e.message });
  }
  console.log(`${results.at(-1).pass ? 'PASS' : 'FAIL'} ${name}`);
}
async function login(touch = false) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    hasTouch: touch,
    isMobile: touch,
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/?_task=login`);
  await page.fill('#rcmloginuser', user);
  await page.fill('#rcmloginpwd', password);
  await Promise.all([page.waitForNavigation(), page.click('#rcmloginsubmit')]);
  return page;
}
async function mail(page) {
  await page.goto(`${base}/?_task=mail&_mbox=INBOX`);
  await page.locator('#messagelist tbody tr').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}
async function shot(page, name) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/${name}.png` });
}
try {
  const p = await login();
  await check('custom controls follow plugin visibility and disabled state', async () => {
    await p.goto(`${base}/?_task=settings&_action=plugin.managesieve-action&_framed=1`);
    const hiddenControls = await p.locator('select[style*="display"]').evaluateAll((nodes) =>
      nodes
        .filter((n) => n.style.display === 'none')
        .map((n) => ({
          name: n.name,
          wrapper: n.closest('.gm-select')?.getBoundingClientRect().height || 0,
        }))
    );
    assert.ok(hiddenControls.length > 0);
    assert.ok(
      hiddenControls.every((n) => n.wrapper === 0),
      JSON.stringify(hiddenControls)
    );
    const select = p.locator('.gm-select > select').first();
    await select.evaluate((n) => {
      n.disabled = true;
    });
    await expect(p.locator('.gm-select-btn').first()).toBeDisabled();
    await select.evaluate((n) => {
      n.disabled = false;
      n.style.display = 'none';
    });
    await expect(p.locator('.gm-select-btn').first()).toBeHidden();
    await select.evaluate((n) => {
      n.style.display = '';
    });
    await expect(p.locator('.gm-select-btn').first()).toBeVisible();
    await expect(p.locator('.gm-select-btn').first()).toBeEnabled();
  });
  for (const mode of ['light', 'dark']) {
    await p.context().addCookies([{ name: 'colorMode', value: mode, url: base }]);
    for (const width of [1440, 1280, 1025, 1024, 820, 768, 390, 320]) {
      await p.setViewportSize({ width, height: width < 500 ? 844 : 900 });
      await mail(p);
      await check(`${mode}/${width} layout and readable rows`, async () => {
        const geometry = await p.evaluate(() => {
          const row = document.querySelector('#messagelist tbody tr');
          const rect = (s) => row.querySelector(s).getBoundingClientRect();
          const avatar = rect('.gm-avatar-initial');
          const range = document.createRange();
          range.selectNodeContents(row.querySelector('.gm-avatar-initial'));
          const letter = range.getBoundingClientRect();
          const cell = rect('td.subject');
          return {
            overflow: document.documentElement.scrollWidth - innerWidth,
            subject: rect('td.subject > .subject').width,
            sender: rect('.fromto').width,
            avatarInside: avatar.top >= cell.top && avatar.bottom <= cell.bottom,
            centered: Math.abs(letter.x + letter.width / 2 - avatar.x - avatar.width / 2) < 1,
            avatarBeforeSender: avatar.right <= rect('.fromto').left,
            search: document.querySelector('.gm-search input').getBoundingClientRect().width,
          };
        });
        assert.ok(geometry.overflow <= 1, JSON.stringify(geometry));
        assert.ok(
          geometry.subject >= 40 &&
            geometry.sender >= 40 &&
            geometry.avatarInside &&
            geometry.centered &&
            geometry.avatarBeforeSender,
          JSON.stringify(geometry)
        );
        assert.ok(geometry.search >= 100, JSON.stringify(geometry));
      });
      if ([1440, 820, 390].includes(width)) await shot(p, `mail-${mode}-${width}`);
    }
  }
  await p.setViewportSize({ width: 1440, height: 900 });
  await mail(p);
  await check('Copy and Move folder pickers preserve padding and fit beside parent', async () => {
    await p.locator('#messagelist tbody tr td.selection input').first().click();
    for (const action of ['copy', 'move']) {
      await p.locator('#mailtoolbar .more').click();
      await p.locator(`#message-menu a.${action}`).click();
      await expect(p.locator('#folder-selector')).toBeVisible();
      const folders = await p.locator('#folder-selector').evaluate((menu) => {
        const r = menu.getBoundingClientRect();
        return {
          fits: r.left >= 0 && r.right <= innerWidth,
          padding: [...menu.querySelectorAll('a')].map((a) =>
            parseFloat(getComputedStyle(a).paddingLeft)
          ),
        };
      });
      assert.ok(folders.fits && folders.padding.every((n) => n >= 16), JSON.stringify(folders));
      await shot(p, `${action}-folder-menu`);
      await p.keyboard.press('Escape');
      await p.keyboard.press('Escape');
    }
  });
  for (const kind of ['confirm', 'prompt']) {
    for (const action of ['submit', 'cancel', 'escape', 'scrim']) {
      await check(`${kind}/${action} result`, async () => {
        await p.evaluate(
          ({ kind }) => {
            window.refineResult = 'pending';
            const options = { title: 'UI regression check', value: 'test value' };
            UI.modal[kind]('Test dialog — no mailbox action', options).then((v) => {
              window.refineResult = v;
            });
          },
          { kind }
        );
        const d = p.locator('.gm-dialog');
        await expect(d).toBeVisible();
        if (action === 'submit') await d.locator('[data-mainaction]').click();
        if (action === 'cancel') await d.locator('.gm-dialog-actions button').first().click();
        if (action === 'escape') await p.keyboard.press('Escape');
        if (action === 'scrim') await p.locator('.gm-scrim').click({ position: { x: 2, y: 2 } });
        await expect(d).toHaveCount(0);
        assert.equal(
          await p.evaluate(() => window.refineResult),
          action === 'submit'
            ? kind === 'confirm'
              ? true
              : 'test value'
            : kind === 'confirm'
              ? false
              : null
        );
      });
    }
  }
  const phone = await login(true);
  await phone.setViewportSize({ width: 390, height: 844 });
  await mail(phone);
  await check('touch selection preserves inbox and bulk controls', async () => {
    await phone.locator('#messagelist tbody tr td.selection input').first().tap();
    await expect(phone.locator('#layout-list')).toBeVisible();
    await expect(phone.locator('.gm-bulk-toolbar')).toBeVisible();
    await phone.locator('#messagelist tbody tr td.selection input').nth(1).tap();
    assert.equal(await phone.evaluate(() => rcmail.message_list.get_selection().length), 2);
    await shot(phone, 'phone-bulk-selection');
    await phone.locator('.gm-bulk-toolbar .markmessage').tap();
    await expect(phone.locator('#markmessage-menu')).toBeVisible();
    await phone.keyboard.press('Escape');
    await phone.locator('.gm-bulk-toolbar .close').tap();
    assert.equal(await phone.evaluate(() => rcmail.message_list.get_selection().length), 0);
  });
  await check('touch row opens message and back restores inbox', async () => {
    await phone.locator('#messagelist tbody tr td.subject > .subject').first().tap();
    await expect(phone.locator('#layout-content')).toBeVisible();
    await phone.locator('#layout-content .back-list-button').tap();
    await expect(phone.locator('#layout-list')).toBeVisible();
  });
  await phone.context().close();

  for (const mode of ['light', 'dark']) {
    await p.context().addCookies([{ name: 'colorMode', value: mode, url: base }]);
    for (const width of [1440, 820, 390]) {
      await p.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      for (const [task, query] of [
        ['contacts', '_task=addressbook'],
        ['settings', '_task=settings&_action=preferences'],
        ['compose', '_task=mail&_action=compose'],
      ]) {
        await p.goto(`${base}/?${query}`);
        await p.waitForTimeout(task === 'compose' ? 1400 : 500);
        await check(`${task}/${mode}/${width} fits viewport`, async () => {
          assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
          if (task === 'compose') await expect(p.locator('.gm-send-group')).toBeInViewport();
        });
        await shot(p, `${task}-${mode}-${width}`);
      }
    }
  }
  await p.setViewportSize({ width: 1440, height: 900 });
  await mail(p);
  await check('popup cancel, failed save, and successful draft persistence', async () => {
    const subject = `UI refinement draft ${Date.now()}`;
    await p.locator('.gm-compose').first().click();
    const popup = p.locator('.gm-cwin');
    await expect(popup).toBeVisible();
    const frame = p.frameLocator('.gm-cwin-frame');
    await frame.locator('#compose-subject').fill(subject);
    await popup.locator('.gm-cwin-btn.close').click();
    await expect(p.locator('.gm-dialog')).toBeVisible();
    await p.keyboard.press('Escape');
    await expect(popup).toBeVisible();
    await expect(frame.locator('#compose-subject')).toHaveValue(subject);
    // Simulate a failed save without sending or changing server data.
    await frame.locator('body').evaluate(() => {
      window.refineCommand = rcmail.command;
      rcmail.command = function (name, ...args) {
        if (name === 'savedraft') return false;
        return window.refineCommand.call(this, name, ...args);
      };
    });
    await popup.locator('.gm-cwin-btn.close').click();
    await p.locator('.gm-dialog [data-mainaction]').click();
    await p.waitForTimeout(15500);
    await expect(popup).toBeVisible();
    await expect(frame.locator('#compose-subject')).toHaveValue(subject);
    await frame.locator('body').evaluate(() => {
      rcmail.command = window.refineCommand;
    });
    await popup.locator('.gm-cwin-btn.close').click();
    await p.locator('.gm-dialog [data-mainaction]').click();
    await expect(popup).toHaveCount(0, { timeout: 20000 });
    const drafts = await p.evaluate(() => rcmail.env.drafts_mailbox);
    await p.goto(`${base}/?_task=mail&_mbox=${encodeURIComponent(drafts)}`);
    await expect(p.locator('#messagelist')).toContainText(subject);
  });
  await check('no browser exceptions', async () => assert.deepEqual(errors, []));
} finally {
  await browser.close();
  fs.writeFileSync(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
}
if (results.some((r) => !r.pass)) process.exitCode = 1;
