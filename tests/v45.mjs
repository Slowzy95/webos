import { chromium } from 'playwright';
import assert from 'node:assert/strict';

/* v45 — Interrupteur principal du proxy (Paramètres › Navigateur & proxy).
   Vérifie : coupé, tout charge en direct (Bloxd.io sans détection VPN),
   les options proxy sont grisées, le bouton de mode est verrouillé, un site
   non affichable en direct explique la situation et « Réactiver le proxy »
   rallume l'interrupteur puis recharge via le proxy. */
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await ctx.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
const proxyHits = [];
await ctx.route('https://slowzy95.github.io/proxy/**', route => {
  proxyHits.push(route.request().url());
  return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Fixture</title><div id="root"></div>' });
});
await page.goto('http://127.0.0.1:3000/webos/');
await page.waitForTimeout(2500);

/* 1) Proxy activé par défaut : Bloxd.io part bien par le proxy. */
await page.dblclick('[data-icon-id="browser"]');
await page.waitForTimeout(1200);
await page.locator('#br-url').fill('https://bloxd.io');
await page.locator('#br-go').click();
await page.waitForFunction(() => document.querySelector('#br-frames > iframe')?.src.includes('/proxy/'));
assert.match(await page.locator('#br-frames > iframe').getAttribute('src'), /url=https%3A%2F%2Fbloxd\.io/, 'bloxd.io doit passer par le proxy quand il est activé');
console.log('PASS proxy activé : bloxd.io via le proxy intégré');

/* 2) Coupure de l'interrupteur dans les paramètres. */
await page.click('.wbtn[data-act="close"]');
await page.waitForTimeout(800);
await page.dblclick('[data-icon-id="settings"]');
await page.waitForTimeout(1200);
assert.equal(await page.locator('#st-px-master').isChecked(), true, 'interrupteur allumé par défaut');
await page.locator('#st-px-master-track').click();
await page.waitForTimeout(500);
assert.equal(await page.evaluate(() => localStorage.getItem('webos_proxy_enabled')), '0');
assert.equal(await page.locator('#st-px-master').isChecked(), false);
assert.equal(await page.locator('#st-px-engine').evaluate(el => el.style.opacity), '0.4', 'options proxy estompées');
assert.equal(await page.locator('#st-px-transport').evaluate(el => el.style.opacity), '0.4');
console.log('PASS interrupteur coupé : stockage et options grisées');

/* 3) Proxy désactivé : Bloxd.io charge EN DIRECT (vraie connexion, pas de VPN détecté). */
await page.click('.wbtn[data-act="close"]');
await page.waitForTimeout(800);
await page.dblclick('[data-icon-id="browser"]');
await page.waitForTimeout(1200);
await page.locator('#br-url').fill('https://bloxd.io');
await page.locator('#br-go').click();
await page.waitForTimeout(1500);
assert.equal(await page.locator('#br-frames > iframe').getAttribute('src'), 'https://bloxd.io', 'bloxd.io doit charger en direct');
assert.match(await page.locator('#br-mode').innerHTML(), /fa-power-off/, 'icône de mode : proxy désactivé');
const hitsAfterDirect = proxyHits.length;
await page.locator('#br-reload').click();
await page.waitForTimeout(1200);
assert.equal(proxyHits.length, hitsAfterDirect, 'aucune requête proxy après rechargement en direct');
console.log('PASS proxy désactivé : bloxd.io en direct, aucune requête proxy');

/* 4) Le bouton de mode est verrouillé quand le proxy est coupé. */
await page.locator('#br-mode').click();
await page.waitForTimeout(400);
assert.match(await page.locator('#br-mode').innerHTML(), /fa-power-off/, 'le clic ne doit rien changer quand le proxy est coupé');
console.log('PASS bouton de mode verrouillé proxy désactivé');

/* 5) Site non affichable en direct : notice + bouton « Réactiver le proxy ». */
await page.locator('#br-url').fill('https://www.reddit.com');
await page.locator('#br-go').click();
await page.waitForTimeout(1200);
const srcdoc = await page.locator('#br-frames > iframe').getAttribute('srcdoc').catch(() => '');
assert.ok(srcdoc.includes('sans proxy'), 'notice dédiée pour un site non affichable');
assert.ok(srcdoc.includes('Réactiver le proxy'), 'bouton de réactivation proposé');
console.log('PASS site non affichable : notice et réactivation proposées');

/* 6) « Réactiver le proxy » : rallume l'interrupteur et recharge via le proxy. */
const noticeFrame = page.frames().find(f => f.url() === 'about:srcdoc');
await noticeFrame.getByText('Réactiver le proxy et réessayer').click();
await page.waitForTimeout(1500);
assert.equal(await page.evaluate(() => localStorage.getItem('webos_proxy_enabled')), '1', 'interrupteur rallumé');
await page.waitForFunction(() => document.querySelector('#br-frames > iframe')?.src.includes('/proxy/'), null, { timeout: 8000 });
assert.match(await page.locator('#br-frames > iframe').getAttribute('src'), /reddit\.com/, 'reddit rechargé via le proxy');
console.log('PASS réactivation : proxy rallumé et rechargement via le proxy');

/* 7) Aucune erreur de page pendant toute la suite. */
assert.deepEqual(errors, [], 'aucune erreur JavaScript');
console.log('PASS aucune erreur de page');

await browser.close();
console.log('v45 : tous les tests passent');
