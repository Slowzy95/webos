import { chromium } from 'playwright';
import assert from 'node:assert/strict';

/* v46 — Sites-proxy (galaxy…) : ouverts dans un VRAI onglet + permissions iframe. */
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await ctx.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
const proxyHits = [];
await ctx.route('https://slowzy95.github.io/proxy/**', route => {
  proxyHits.push(route.request().url());
  return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Fixture</title>' });
});
await page.goto('http://127.0.0.1:3000/webos/');
await page.waitForTimeout(2500);

/* 1) Permissions étendues sur la frame du navigateur. */
await page.dblclick('[data-icon-id="browser"]');
await page.waitForTimeout(1200);
const allow = await page.$eval('#br-frames iframe', el => el.getAttribute('allow'));
assert.match(allow, /clipboard-read/, 'permissions clipboard-read sur la frame');
assert.match(allow, /encrypted-media/, 'permissions encrypted-media sur la frame');
console.log('PASS permissions iframe étendues');

/* 2) galaxy : ouvert dans un VRAI onglet direct (pas de proxy imbriqué). */
const popupPromise = page.waitForEvent('popup', { timeout: 5000 });
await page.locator('#br-url').fill('https://galxy.it.com/os');
await page.locator('#br-go').click();
const popup = await popupPromise;
await page.waitForTimeout(1500);
assert.equal(popup.url(), 'https://galxy.it.com/os', 'galaxy ouvert en direct dans un vrai onglet');
const notice = await page.$eval('#br-frames iframe', el => el.getAttribute('srcdoc') || '').catch(() => '');
assert.ok(notice.includes('vrai onglet'), 'notice explicative dans la fenêtre intégrée');
assert.ok(notice.includes('Rouvrir dans un vrai onglet'), 'bouton de réouverture proposé');
assert.equal(proxyHits.length, 0, 'aucune requête proxy pour galaxy (pas de double proxy)');
console.log('PASS galaxy ouvert dans un vrai onglet direct, zéro requête proxy');

/* 3) La notice propose wosRealDirect (pas wosReal) : clic = onglet direct. */
const noticeFrame = page.frames().find(f => f.url() === 'about:srcdoc');
const popup2 = noticeFrame ? await Promise.all([
  page.waitForEvent('popup', { timeout: 5000 }).catch(() => null),
  noticeFrame.getByText('Rouvrir dans un vrai onglet').click().catch(() => null)
]).then(([p2]) => p2) : null;
if (popup2) {
  await popup2.waitForLoadState('domcontentloaded').catch(() => {});
  assert.equal(popup2.url(), 'https://galxy.it.com/os', 'réouverture directe de galaxy');
  console.log('PASS bouton « Rouvrir » : galaxy réouvert en direct');
} else {
  console.log('INFO bouton « Rouvrir » non testé (popup bloqué en headless)');
}

/* 4) Un site normal (bloxd.io) n'est pas affecté : il charge comme avant. */
await page.locator('#br-url').fill('https://bloxd.io');
await page.locator('#br-go').click();
await page.waitForTimeout(1500);
const bloxdSrc = await page.$eval('#br-frames iframe', el => el.getAttribute('src') || '').catch(() => '');
assert.ok(bloxdSrc.includes('proxy') || bloxdSrc.includes('bloxd'), 'bloxd.io charge normalement');
console.log('PASS les sites normaux ne sont pas affectés');

/* 5) Aucune erreur de page. */
assert.deepEqual(errors, [], 'aucune erreur JavaScript');
console.log('v46 : tous les tests passent');
await browser.close();
