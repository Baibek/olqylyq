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

// 4. Class view: level groups (IELTS, then math), kk and ru
await page.goto(URL0 + '#class'); await wait(300);
for (const lang of ['ru', 'kk']) {
  if (lang === 'kk') { await page.click('text=ҚАЗ'); await wait(300); }
  await page.click('.subjseg button[data-s="eng"]'); await page.waitForSelector('#grpBtn', { timeout: 30000 });
  await page.click('#grpBtn'); await wait(300);
  const eg = await page.$$eval('.grp', xs => xs.map(x => x.innerText));
  check(eg.length >= 2, `[${lang}] IELTS groups: ${eg.length}`);
  check(eg.every(t => LEVEL.test(t) && /\d/.test(t)), `[${lang}] IELTS group card lacks level or count`);
  await page.click('.subjseg button[data-s="math"]'); await page.waitForSelector('#grpBtn', { timeout: 30000 }); await wait(200);
  if (!(await page.$('.grp'))) { await page.click('#grpBtn'); await wait(300); }
  const mg = await page.$$eval('.grp', xs => xs.map(x => x.innerText));
  const names = lang === 'kk' ? /Бастапқы|Орта|Жоғары/ : /Начальный|Средний|Высокий/;
  check(mg.length >= 1 && mg.every(t => names.test(t) && !LEVEL.test(t)), `[${lang}] math groups not recomputed: ${JSON.stringify(mg.map(t => t.slice(0, 40)))}`);
  const all = await page.innerText('#v-class');
  check(!/undefined/.test(all), `[${lang}] class view contains "undefined"`);
}

// 5. Tutor bot knows the IELTS level (AI mocked)
{
  const c2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await c2.addInitScript(() => {
    window.__prompts = [];
    const sample = async (turns, opts) => { window.__prompts.push(turns); const t = 'OK.\n>>> a | b | c\n@@@ -'; opts.onText && opts.onText({ text: t }); return { text: t }; };
    sample.json = async () => ({ cards: [] }); sample.limits = async () => ({ images: 0 });
    window.claude = { use: async k => (k === 'sample' ? sample : null) };
  });
  const p2 = await c2.newPage(); p2.on('pageerror', e => errs.push('bot: ' + e));
  await p2.goto(URL0 + '#class'); await p2.waitForTimeout(300);
  await p2.click('.subjseg button[data-s="eng"]'); await p2.waitForSelector('tr.click', { timeout: 30000 });
  await p2.click('tr.click'); await p2.waitForTimeout(400);
  await p2.evaluate(() => { location.hash = '#course'; }); await p2.waitForTimeout(600);
  const hello = await p2.innerText('#chatLog');
  check(LEVEL.test(hello) && /IELTS/.test(hello), 'bot greeting does not name the IELTS level');
  await p2.click('.qchip'); await p2.waitForTimeout(600);
  const sys = await p2.evaluate(() => (window.__prompts[0] || [{}])[0].content || '');
  check(/IELTS/.test(sys) && LEVEL.test(sys), 'bot system context lacks IELTS role or level');
  await c2.close();
}

check(!errs.length, 'page errors: ' + errs.join(' | '));
await browser.close();
console.log('problems:', bad.length ? bad : 'none');
process.exit(bad.length ? 1 : 0);
