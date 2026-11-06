import { chromium } from 'playwright';
import assert from 'node:assert/strict';

/* v46 (révisé) — Tout reste dans la fenêtre intégrée : galaxy et les sites
   inconnus s'y chargent normalement, aucun onglet ne s'ouvre automatiquement.
   Permissions iframe étendues vérifiées au passage. */
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await ctx.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
let popupOpened = false;
page.on('popup', () => { popupOpened = true; });
await page.goto('http://127.0.0.1:3000/webos/');
await page.waitForTimeout(2500);

/* 1) Permissions étendues sur la frame du navigateur. */
await page.dblclick('[data-icon-id="browser"]');
await page.waitForTimeout(1200);
const allow = await page.$eval('#br-frames iframe', el => el.getAttribute('allow'));
assert.match(allow, /clipboard-read/, 'permissions clipboard-read sur la frame');
assert.match(allow, /encrypted-media/, 'permissions encrypted-media sur la frame');
console.log('PASS permissions iframe étendues');

/* 2) galaxy : reste DANS la fenêtre intégrée (aucun onglet ouvert). */
await page.locator('#br-url').fill('https://galxy.it.com/os');
await page.locator('#br-go').click();
await page.waitForTimeout(2000);
assert.equal(popupOpened, false, 'aucun onglet ne doit s\u2019ouvrir automatiquement');
const frameState = await page.$eval('#br-frames iframe', el => ({ src: el.getAttribute('src') || '', doc: el.getAttribute('srcdoc') || '' })).catch(() => ({ src: '', doc: '' }));
assert.ok(frameState.src.includes('galxy.it.com') || frameState.doc.length > 0, 'galaxy reste dans la fenêtre intégrée');
console.log('PASS galaxy reste dans la fenêtre intégrée, aucun onglet automatique');

/* 3) La barre d'outils garde son bouton « onglet réel » (choix manuel). */
const newtabBtn = await page.$('#br-newtab');
assert.ok(newtabBtn, 'bouton onglet réel présent dans la barre d\u2019outils');
console.log('PASS bouton « onglet réel » toujours disponible (manuel)');

/* 4) Un site normal (bloxd.io) charge comme avant. */
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
