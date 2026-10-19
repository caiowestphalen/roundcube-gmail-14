// Verify final rendered label contrast against plugin CSS in both themes.
import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
import { base, accounts } from './config.mjs';
import assert from 'node:assert/strict';
const [user, password] = accounts[0];
const out = 'test-results/label-contrast';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] });
const report = [];
try {
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(`${base}/?_task=login`);
  await p.fill('#rcmloginuser', user);
  await p.fill('#rcmloginpwd', password);
  await Promise.all([p.waitForNavigation(), p.click('#rcmloginsubmit')]);
  for (const theme of ['light', 'dark']) {
    await p.context().addCookies([{ name: 'colorMode', value: theme, url: base }]);
    for (const width of [1440, 820, 390]) {
      await p.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await p.goto(`${base}/?_task=mail&_mbox=INBOX`);
      await p.locator('#messagelist tbody tr').first().waitFor();
      if (width <= 1024) {
        const uid = await p
          .locator('#messagelist tbody tr')
          .first()
          .evaluate((row) => row.uid);
        await p.goto(
          `${base}/?_task=mail&_action=show&_mbox=INBOX&_uid=${encodeURIComponent(uid)}`
        );
      } else {
        await p.locator('#messagelist tbody tr .selection').first().click();
      }
      const trigger = p.locator('[data-popup="tb-label-menu"]:visible').first();
      await trigger.click();
      const menu = p.locator('#tb-label-menu');
      await expect(menu).toBeVisible();
      await expect(menu.locator('a.label1')).not.toHaveClass(/disabled/);
      await p.waitForTimeout(300);
      const colors = await menu.evaluate((menu) => {
        function luminance(color) {
          const values = color
            .match(/[\d.]+/g)
            .slice(0, 3)
            .map(Number)
            .map((v) => v / 255)
            .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
          return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
        }
        const bg = luminance(getComputedStyle(menu).backgroundColor);
        return [...menu.querySelectorAll('a[class*="label"]')].map((a) => {
          const color = getComputedStyle(a).color;
          const fg = luminance(color);
          return {
            text: a.textContent.trim(),
            color,
            ratio: (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05),
          };
        });
      });
      assert.ok(colors.length >= 6);
      assert.ok(
        colors.every((c) => c.ratio >= 4.5),
        JSON.stringify(colors)
      );
      await p.screenshot({ path: `${out}/${theme}-${width}-open.png` });
      await p.keyboard.press('Escape');
      await expect(menu).toBeHidden();
      await p.screenshot({ path: `${out}/${theme}-${width}-closed.png` });
      report.push({ theme, width, pass: true, colors });
      console.log('PASS', theme, width, 'all label text contrast >= 4.5:1');
    }
  }
} finally {
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
