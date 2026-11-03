import { chromium } from 'playwright';
import assert from 'node:assert/strict';
/* Tests v34 : publication avec file d'attente, onglet détaché, disposition du bureau, titre YouTube FR/EN.
   Lancer le site en local (npx serve . -l 3000) puis : node tests/v34.mjs */
const base = process.env.WEBOS_TEST_URL || 'http://127.0.0.1:3000/';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(base); await page.waitForTimeout(2000);

/* 1. Publication : service principal simulé, puis indisponible, puis de retour */
let store = ''; let down = false;
await ctx.route('https://textdb.dev/**', r => {
  if (down) return r.abort();
  if (r.request().method() === 'POST') { store = r.request().postData(); return r.fulfill({ status: 200, body: store }); }
  return r.fulfill({ status: 200, body: store });
});
await ctx.route('https://api.restful-api.dev/**', r => r.fulfill({ status: 429, body: '{"error":"quota"}' }));
const pub = await page.evaluate(async () => (await memberCursorPublish('A', 'https://example.org/a.png', 'https://example.org/a.png')).shared);
assert.equal(pub, true);
down = true;
const off = await page.evaluate(async () => { const l = await memberCursorPublish('B', 'https://example.org/b.png', 'https://example.org/b.png'); return { shared: l.shared, n: l.length, out: galleryOutbox('cursors').length }; });
assert.deepEqual(off, { shared: false, n: 2, out: 1 });
down = false;
const back = await page.evaluate(async () => { const l = await memberCursorsFetch(); return { n: l.length, out: galleryOutbox('cursors').length }; });
assert.deepEqual(back, { n: 2, out: 0 });
assert.equal(JSON.parse(store).cursors.length, 2);

/* 2. Onglet glissé hors de la barre = fenêtre indépendante */
await page.locator('.desk-icon[data-icon-id="browser"]').click(); await page.waitForTimeout(1200);
await page.locator('#br-tab-add').click();
const tab = await page.locator('#br-tabs [data-tab]').first().boundingBox();
await page.mouse.move(tab.x + 40, tab.y + 10); await page.mouse.down();
await page.mouse.move(tab.x + 60, tab.y + 60, { steps: 5 }); await page.mouse.move(tab.x + 200, tab.y + 400, { steps: 10 }); await page.mouse.up();
await page.waitForTimeout(800);
assert.ok(await page.evaluate(() => [...document.querySelectorAll('.window')].some(w => w.dataset.app.startsWith('pop'))));

await page.evaluate(() => [...windows.keys()].forEach(id => closeApp(id))); await page.waitForTimeout(500);
/* 3. Bureau : toutes les positions sont mémorisées après un déplacement */
const icon = page.locator('.desk-icon[data-icon-id="games"]'); const bb = await icon.boundingBox();
await page.mouse.move(bb.x + 30, bb.y + 30); await page.mouse.down(); await page.mouse.move(bb.x + 330, bb.y + 330, { steps: 10 }); await page.mouse.up();
const saved = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('webos_iconpos'))));
for (const id of ['browser', 'ai', 'media', 'games']) assert.ok(saved.includes(id), id + ' non sauvegardé');

/* 4. Vidéo : titre français, vidéo anglaise → variante donnée par l'IA */
const vid = await page.evaluate(async () => {
  const mk = t => { let b = document.getElementById('yt-results'); if (!b) { b = document.createElement('div'); b.id = 'yt-results'; b.style.cssText = 'position:fixed;top:0;left:0'; document.body.appendChild(b); } b.innerHTML = t.map((x, i) => `<button data-yt="i${i}" data-title="${x}">${x}</button>`).join(''); return [...b.querySelectorAll('button')]; };
  mk(['Gâteau facile', 'Chat qui danse']);
  webos32.searchYouTube = async () => mk(['Why Cats Dance Like This | Science', 'Other']);
  const r = await webos32.playVideoSmart({ cmd: 'play_video', title: 'Pourquoi les chats dansent', alt: ['Why Cats Dance Like This'] }, null);
  return r.el.dataset.title;
});
assert.equal(vid, 'Why Cats Dance Like This | Science');
assert.deepEqual(errors, []);
await browser.close();
console.log('v34 OK');
