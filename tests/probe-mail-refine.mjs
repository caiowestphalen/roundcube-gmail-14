// Actual delivery, attachments, reply, copy/move/search and labels between test accounts only.
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
import { base, accounts } from './config.mjs';
import assert from 'node:assert/strict';
if (accounts.length < 2) throw new Error('Mail workflows require two dedicated test accounts.');
const out = 'test-results/mail-refine';
fs.mkdirSync(out, { recursive: true });
const subject = `UI verification ${Date.now().toString(36)}`;
const attachment = 'Theme UI verification attachment.\n';
const report = [],
  errors = [];
const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] });
async function login(i) {
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${base}/?_task=login`);
  await p.fill('#rcmloginuser', accounts[i][0]);
  await p.fill('#rcmloginpwd', accounts[i][1]);
  await Promise.all([p.waitForNavigation(), p.click('#rcmloginsubmit')]);
  return p;
}
async function check(name, fn) {
  try {
    await fn();
    report.push({ name, pass: true });
    console.log(`PASS ${name}`);
  } catch (e) {
    report.push({ name, pass: false, error: e.message });
    throw e;
  } finally {
    fs.writeFileSync(`${out}/results.json`, JSON.stringify({ subject, report, errors }, null, 2));
  }
}
async function shot(p, name) {
  await p.screenshot({ path: `${out}/${name}.png` });
}
async function inbox(p, mbox = 'INBOX') {
  await p.goto(`${base}/?_task=mail&_mbox=${mbox}`);
  await p.waitForTimeout(500);
}
async function findMessage(p, text) {
  for (let i = 0; i < 12; i++) {
    const row = p.locator('#messagelist tbody tr', { hasText: text }).first();
    if (await row.count()) return row;
    await p.waitForTimeout(1000);
    await p.locator('#layout-list .toolbar a.refresh').click();
    await p.waitForTimeout(400);
  }
  throw Error(`Message not received: ${text}`);
}
async function selectMessage(p, row) {
  const uid = await row.evaluate((n) => n.uid);
  await row.locator('td.subject').click();
  await p.waitForFunction(
    (uid) => document.querySelector('#messagecontframe')?.contentWindow?.rcmail?.env.uid == uid,
    uid
  );
  await p.frameLocator('#messagecontframe').locator('#messagebody').waitFor();
  await p.waitForFunction(() => !rcmail.busy);
}
try {
  const a = await login(0);
  await check('send with attachment', async () => {
    await a.goto(`${base}/?_task=mail&_action=compose`);
    await a.locator('#composebody_ifr').waitFor();
    await a.locator('#compose_to .recipient-input input').fill(accounts[1][0]);
    await a.locator('#compose_to .recipient-input input').press('Enter');
    await a.fill('#compose-subject', subject);
    await a
      .frameLocator('#composebody_ifr')
      .locator('body')
      .fill('Hello from the UI verification. Please reply to confirm delivery.');
    await a.locator('input[name="_attachments[]"]').setInputFiles({
      name: 'ui-verification.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(attachment),
    });
    await expect(a.locator('#attachment-list')).toContainText('ui-verification.txt');
    await a.waitForFunction(() => !rcmail.busy);
    await shot(a, 'compose-attachment');
    await a.locator('.gm-send').click();
    await a.waitForTimeout(1500);
    await shot(a, 'after-send');
    console.log(
      'SEND STATE',
      await a.evaluate(() => ({
        url: location.search,
        notices: [...document.querySelectorAll('.gm-toast,.gm-dialog')].map((n) => n.textContent),
        busy: rcmail.busy,
      }))
    );
    await a.waitForURL(
      (url) => !url.searchParams.has('_action') || url.searchParams.get('_action') !== 'compose'
    );
  });
  const b = await login(1);
  let uid;
  await check('receive and download exact attachment', async () => {
    await inbox(b);
    const row = await findMessage(b, subject);
    uid = await row.evaluate((n) => n.uid);
    await selectMessage(b, row);
    const f = b.frameLocator('#messagecontframe');
    await expect(f.locator('#messagebody')).toContainText('Hello from the UI verification');
    await expect(f.locator('#attachment-list')).toContainText('ui-verification.txt');
    const href = await f.locator('#attachment-list a.filename').first().getAttribute('href');
    const response = await b.request.get(new URL(href, base).href + '&_download=1');
    assert.equal(await response.text(), attachment);
    await shot(b, 'received-attachment');
  });
  await check('reply popup sends and arrives', async () => {
    await b.locator('#layout-content .toolbar a.reply').click();
    await expect.poll(() => b.frames().some((f) => f.url().includes('_action=compose'))).toBe(true);
    const frame = b.frames().find((f) => f.url().includes('_action=compose'));
    await frame.locator('#composebody_ifr').waitFor();
    await frame
      .frameLocator('#composebody_ifr')
      .locator('body')
      .fill('Confirmed: reply from the second test account.');
    await shot(b, 'reply-popup');
    await frame.locator('.gm-send').click();
    await inbox(a);
    await findMessage(a, `Re: ${subject}`);
    await shot(a, 'reply-received');
  });
  await check('labels apply and clear', async () => {
    await inbox(b);
    const row = await findMessage(b, subject);
    await selectMessage(b, row);
    const labelButton = b
      .locator('#layout-content [data-popup*="label"], #layout-content a[onclick*="tb-label-menu"]')
      .first();
    await labelButton.click();
    await shot(b, 'labels-open');
    const menu = b.locator('.popupmenu.gm-open');
    await menu.locator('a', { hasText: 'Important' }).click();
    await b.waitForTimeout(500);
    await shot(b, 'label-applied');
    await labelButton.click();
    await menu.locator('a', { hasText: 'No Label' }).click();
  });
  await check('copy, move and restore test message', async () => {
    await inbox(b);
    let row = await findMessage(b, subject);
    await selectMessage(b, row);
    await b.locator('#layout-content .toolbar a.more').click();
    await b.locator('.popupmenu.gm-open a.copy').click();
    await shot(b, 'copy-folder-menu');
    await b.locator('#folder-selector a', { hasText: 'Drafts' }).click();
    await b.waitForTimeout(500);
    await inbox(b, 'Drafts');
    row = await findMessage(b, subject);
    uid = await row.evaluate((n) => n.uid);
    await inbox(b);
    row = await findMessage(b, subject);
    await selectMessage(b, row);
    await b.locator('#layout-content .toolbar a.more').click();
    await b.locator('.popupmenu.gm-open a.move').click();
    await b.locator('#folder-selector a', { hasText: 'Trash' }).click();
    await b.waitForTimeout(1200);
    await shot(b, 'after-move');
    console.log(
      'MOVE STATE',
      await b.evaluate(() => ({
        selected: rcmail.message_list.get_selection(),
        busy: rcmail.busy,
        notices: [...document.querySelectorAll('.gm-toast,.gm-dialog')].map((n) => n.textContent),
      }))
    );
    await expect(b.locator('#messagelist tbody tr:visible', { hasText: subject })).toHaveCount(0);
    await inbox(b, 'Trash');
    row = await findMessage(b, subject);
    await selectMessage(b, row);
    await b.locator('#layout-content .toolbar a.more').click();
    await b.locator('.popupmenu.gm-open a.move').click();
    await b.locator('#folder-selector a', { hasText: 'Inbox' }).click();
    await b.waitForFunction(() => !rcmail.busy);
    await inbox(b);
    row = await findMessage(b, subject);
    uid = await row.evaluate((n) => n.uid);
  });
  await check('search, thread mode and print', async () => {
    await a.locator('.gm-search input[type="text"]').fill(subject);
    await a.keyboard.press('Enter');
    await expect(a.locator('#messagelist tbody tr', { hasText: subject }).first()).toBeVisible();
    await shot(a, 'search-result');
    await a.evaluate(() => rcmail.set_list_options([], 'date', 'DESC', 1));
    await a.waitForTimeout(600);
    await shot(a, 'thread-mode');
    await a.evaluate(() => rcmail.set_list_options([], 'date', 'DESC', 0));
    await b.goto(`${base}/?_task=mail&_action=print&_uid=${uid}&_mbox=INBOX`);
    await expect(b.locator('#messagebody')).toContainText('Hello from the UI verification');
    await shot(b, 'print-view');
  });
} finally {
  await browser.close();
  fs.writeFileSync(`${out}/results.json`, JSON.stringify({ subject, report, errors }, null, 2));
}
if (errors.length) process.exitCode = 1;
