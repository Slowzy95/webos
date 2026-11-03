import { chromium } from 'playwright';
import assert from 'node:assert/strict';
/* Tests v38 : coupure du son dans les cadres imbriqués + touche d'urgence (cadres imbriqués, plein écran).
   Prérequis : site sur http://localhost:8766/ et tests/fixtures servi sur http://127.0.0.1:8769/ (autre origine). */
const base = process.env.WEBOS_TEST_URL || 'http://localhost:8766/';
const other = process.env.OTHER_URL || 'http://127.0.0.1:8769/';
const exe = process.env.CHROME_PATH;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'], ...(exe ? { executablePath: exe } : {}) });
const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
await page.goto(base); await page.waitForTimeout(2000);
await page.evaluate((b) => {
  panicUrl = b + 'tests/fixtures/panic.html';
  const f = document.createElement('iframe'); f.id = 'fx'; f.src = b + 'tests/fixtures/media.html';
  f.style.cssText = 'position:fixed;left:10px;top:10px;width:500px;height:400px;z-index:99999';
  document.body.appendChild(f);
}, base);
await page.waitForTimeout(2500);
const probe = () => page.evaluate(() => {
  const outer = document.getElementById('fx').contentWindow, inner = outer.document.getElementById('inner').contentWindow;
  const g = w => (w.ctx && w.ctx.__wosGain) ? w.ctx.__wosGain.gain.value : 'none';
  return { outerAudio: outer.document.getElementById('a').muted, innerAudio: inner.document.getElementById('a').muted, outerGain: g(outer), innerGain: g(inner) };
});
console.log('avant', await probe());
await page.click('.tray-btn[title="Volume"]'); await page.waitForTimeout(1200);
const m = await probe(); console.log('muet', m);
assert.equal(m.outerAudio, true); assert.equal(m.innerAudio, true);
assert.equal(m.outerGain, 0); assert.equal(m.innerGain, 0);
await page.click('.tray-btn[title="Volume"]'); await page.waitForTimeout(1200);
const u = await probe(); console.log('son', u);
assert.equal(u.outerAudio, false); assert.equal(u.innerGain, 1);
/* touche d'urgence dans le cadre imbriqué */
await page.evaluate(() => { panicKey = 'Escape'; });
await page.evaluate(() => document.getElementById('fx').contentWindow.document.getElementById('inner').contentWindow.document.body.focus());
await page.frames().find(f => f.url().endsWith('media2.html')).click('#t');
await page.keyboard.press('Escape'); await page.waitForTimeout(1500);
assert.ok(page.url().includes('panic.html'), 'panic depuis cadre imbriqué : ' + page.url());
/* touche d'urgence avec un lecteur d'un autre domaine en plein écran */
await page.goto(base); await page.waitForTimeout(1800);
await page.evaluate((b) => {
  panicUrl = b + 'tests/fixtures/panic.html'; panicKey = 'p';
  const f = document.createElement('iframe'); f.id = 'yt'; f.src = 'OTHER' + 'youtube.com/embed/fs.html'.replace('OTHER', '');
  f.src = b.replace('localhost:8766', '127.0.0.1:8769') + 'youtube.com/embed/fs.html';
  f.setAttribute('allowfullscreen', ''); f.setAttribute('allow', 'fullscreen');
  f.style.cssText = 'position:fixed;left:10px;top:10px;width:500px;height:400px;z-index:99999';
  document.body.appendChild(f);
}, base);
await page.waitForTimeout(1500);
await page.frames().find(f => f.url().includes('fs.html')).click('#b');
await page.waitForTimeout(800);
const fs = await page.evaluate(() => !!document.fullscreenElement); console.log('plein écran', fs);
await page.keyboard.press('p'); await page.waitForTimeout(1500);
assert.ok(page.url().includes('panic.html'), 'panic avec lecteur externe en plein écran : ' + page.url());
await browser.close();
console.log('v38 OK');
