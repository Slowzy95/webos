import { chromium } from 'playwright';
import assert from 'node:assert/strict';
/* Tests v35 : plan de proxy, recherche fonds/curseurs, réglages proxy, systèmes (skins).
   Lancer le site en local (npx serve . -l 3000) puis : node tests/v35.mjs */
const base = process.env.WEBOS_TEST_URL || 'http://127.0.0.1:3000/';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(base); await page.waitForTimeout(2000);

/* 1. Plan de proxy */
const plans = await page.evaluate(() => {
  LS.set('proxy_auto', '1'); LS.set('proxy_engine', 'sj'); LS.set('proxy_transport', 'libcurl'); LS.set('proxy_ok', '{}');
  return { discord: proxyPlan('https://discord.com/login'), bloxd: proxyPlan('https://bloxd.io/') };
});
assert.equal(plans.discord[0].engine, 'sj');
assert.ok(plans.discord.length >= 4);
assert.equal(plans.bloxd[0].engine, 'uv');
assert.ok(new Set(plans.discord.map(a => a.engine + a.transport + a.wisp)).size === plans.discord.length);

/* 2. Classement des suggestions : « d » → DARK en premier */
const rank = await page.evaluate(() => ['Zèbre', 'Ciel dark', 'DARK', 'Dune'].map(n => [n, wosRankName(n, wosNorm('d'))]));
const r = Object.fromEntries(rank);
assert.ok(r['DARK'] < r['Ciel dark'] && r['Ciel dark'] < r['Zèbre'], 'prefixe avant mot suivant avant absent');

/* 3. Réglages navigateur & proxy */
await page.evaluate(() => openApp('settings')); await page.waitForTimeout(800);
await page.click('#st-px-engine [data-pxe="uv"]');
assert.equal(await page.evaluate(() => LS.get('proxy_engine', '')), 'uv');
await page.click('#st-px-transport [data-pxt="epoxy"]');
assert.equal(await page.evaluate(() => LS.get('proxy_transport', '')), 'epoxy');

/* 4. Recherche de fond d'écran avec suggestions */
await page.fill('#st-wall-q', 'd'); await page.waitForTimeout(400);
const sug = await page.$$eval('.wos-suggest *', els => els.map(e => e.textContent.trim()).filter(Boolean));
assert.ok(sug.length > 0, 'suggestions affichées');
assert.ok(/^d/i.test(sug[0]), 'première suggestion commence par D : ' + sug[0]);

/* 4b. Recherche de curseur */
await page.evaluate(() => openApp('cursors')); await page.waitForTimeout(800);
const nCur = await page.$$eval('[data-sname]', e => e.length);
assert.ok(nCur > 0, 'cartes de curseurs');
await page.fill('#cur-q', 'zzzzqq'); await page.waitForTimeout(300);
const vis = await page.$$eval('[data-sname]', els => els.filter(e => e.offsetParent !== null && getComputedStyle(e).display !== 'none').length);
assert.equal(vis, 0, 'filtre curseur');

/* 5. Systèmes */
for (const id of ['macos', 'ubuntu', 'fedora', 'mint', 'kali', 'kde', 'chromeos', 'win11']) {
  await page.evaluate(i => applySkin(i), id); await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => document.body.dataset.os), id);
}
await page.evaluate(() => applySkin('macos')); await page.waitForTimeout(400);
assert.ok(await page.$('#os-topbar'), 'barre de menu macOS');
await page.evaluate(() => applySkin('win11')); await page.waitForTimeout(400);
assert.equal(await page.evaluate(() => document.body.classList.contains('has-topbar')), false);
assert.deepEqual(errors, []);
console.log('v35 OK');
await browser.close();
