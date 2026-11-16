// Browser smoke test of the built page (index.html). Run: python3 build.py && node tests/smoke.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = createRequire('/usr/lib/node_modules/')('playwright'); }
const URL0 = 'file://' + fileURLToPath(new URL('../index.html', import.meta.url));
const bad = [], check = (ok, msg) => { if (!ok) bad.push(msg); };
const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e)));
const wait = ms => page.waitForTimeout(ms);
const LEVEL = /\b(A0|A1|A2|B1|B2|C1)\b/;

// 1. IELTS first; a stored subject still wins
await page.goto(URL0); await wait(500);
check(await page.$eval('.subj', b => b.dataset.s) === 'eng', 'first subject button is not IELTS');
await page.evaluate(() => localStorage.setItem('olq-subj', 'math')); await page.reload(); await wait(500);
check(await page.$eval('.subj[aria-pressed="true"]', b => b.dataset.s) === 'math', 'stored subject "math" was not restored');

// 2. IELTS: no grade picker, run a diagnostic to the end
await page.locator('.ss[data-s="eng"]:visible, .subj[data-s="eng"]:visible').first().click(); await wait(300);
check(!(await page.isVisible('.gradeseg')), 'grade picker is visible for IELTS');
{ const home = await page.innerText('#v-home'); check(!/\d+[- ]?(сынып|класс)/.test(home), 'IELTS home mentions a school grade: ' + (home.match(/.{0,30}\d+[- ]?(сынып|класс).{0,10}/) || [''])[0]); }
await page.click('#startForm button[type="submit"]');
for (let i = 0; i < 60; i++) {
  await wait(450);
  if (await page.isVisible('#v-result')) break;
  const opt = await page.$('.opt:not([disabled])'); if (opt) await opt.click().catch(() => {});
  const nx = await page.$('#nextBtn'); if (nx && await nx.isVisible()) await nx.click().catch(() => {});
}
await wait(400);
check(await page.isVisible('#v-result'), 'result view was not reached');

// 3. Result names a CEFR level and IELTS, never a school grade (kk and ru)
for (const lang of ['kk', 'ru']) {
  if (lang === 'ru') { await page.click('text=РУС'); await wait(400); }
  const txt = await page.innerText('#v-result');
  check(LEVEL.test(txt) && /IELTS/.test(txt), `[${lang}] result has no CEFR level or IELTS`);
  check(!/сынып|класс/.test(txt), `[${lang}] result mentions a school grade: ${(txt.match(/.{0,30}(сынып|класс).{0,10}/) || [''])[0]}`);
  check(!/undefined/.test(txt), `[${lang}] result contains "undefined"`);
}

check(!errs.length, 'page errors: ' + errs.join(' | '));
await browser.close();
console.log('problems:', bad.length ? bad : 'none');
process.exit(bad.length ? 1 : 0);
