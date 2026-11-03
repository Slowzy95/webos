import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const base = process.env.WEBOS_TEST_URL || 'http://127.0.0.1:3000/';
const shared = 'https://api.restful-api.dev/objects/ff808181a09d98f701a1a0d154871bf8';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const code = `<style>@keyframes diamond{0%{cursor:url(${png}) 0 0,auto;}100%{cursor:url(${png}) 0 0,auto;}}body{animation:diamond 1s infinite}</style><script>window.badCursor=true</script>`;
let members = [{ name: 'Ancien curseur', arrow: 'https://example.org/legacy.png', pointer: 'https://example.org/legacy.png' }];
let puts = 0, getFails = false, response = { say: 'Sélection.', actions: [{ cmd: 'play_video', title: 'minecraft episode incroyable survie' }] };
let delayAI = false, releaseAI;
const errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => {
  if (window === window.top) {
    window.__topErrors = [];
    window.addEventListener('error', e => window.__topErrors.push(e.message));
    window.addEventListener('unhandledrejection', e => window.__topErrors.push(String(e.reason?.message || e.reason)));
  }
});
const json = (r, data, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
async function routes(ctx) {
  await ctx.route(shared, r => {
    if (r.request().method() === 'PUT') { puts++; const body = r.request().postDataJSON(); assert.ok(!JSON.stringify(body).includes('<script>')); members = body.data.cursors; return json(r, body); }
    return getFails ? json(r, { error: 'quota' }, 429) : json(r, { data: { cursors: members } });
  });
  await ctx.route('https://api.groq.com/**', r => {
    const finish = () => json(r, { choices: [{ message: { content: JSON.stringify(response) } }] });
    if (delayAI) return new Promise(resolve => { releaseAI = async () => { await finish(); resolve(); }; });
    return finish();
  });
  await ctx.route('https://r.jina.ai/**', r => {
    const music = r.request().url().includes('musique');
    const titles = music ? ['Musique calme pour travailler', 'Une autre chanson'] : ['Minecraft : L’ÉPISODE incroyable en survie !', 'Minecraft : défi survie épisode 2', 'Minecraft : défi survie épisode 3'];
    const ids = music ? ['MUSIQUE0001', 'MUSIQUE0002'] : ['MINECRAFT01', 'MINECRAFT02', 'MINECRAFT03'];
    const data = titles.map((title, i) => ({ videoRenderer: { videoId: ids[i], title: { runs: [{ text: title }] } } }));
    return r.fulfill({ contentType: 'text/plain', body: '<script>var ytInitialData=' + JSON.stringify(data) + ';</script>' + ' '.repeat(12000) });
  });
  await ctx.route(/https:\/\/(?:www\.)?youtube-nocookie\.com\//, r => r.fulfill({ contentType: 'text/html', body: '<p>Lecteur simulé : pas de lecture distante attestée.</p>' }));
  await ctx.route('https://slowzy95.github.io/proxy/**', r => r.fulfill({ contentType: 'text/html', body: '<button id="counter" onclick="this.textContent=Number(this.textContent)+1">0</button>' }));
}
await routes(context);
const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
async function open(name, p = page) {
  if (await p.locator('#aiw-panel').isVisible()) await p.locator('#aiw-min').click();
  await p.locator('#start-btn').click(); await p.locator('#sm-search').fill(name); await p.locator('#sm-apps .sm-tile:visible').click();
}
async function address(value) { await page.locator('#br-url').fill(value); await page.locator('#br-url').press('Enter'); }
async function yt(query) { await address('https://www.youtube.com/results?search_query=' + query); await page.locator('#yt-results button[data-yt]').first().waitFor(); }
async function send(text) {
  if (!await page.locator('#aiw-panel').isVisible()) await page.locator('#aiw-bubble').click();
  await page.locator('#aiw-input').fill(text); await page.locator('#aiw-input').press('Enter'); await page.waitForFunction(() => !aiwBusy);
}
try {
  await page.goto(base); await open('Curseurs');
  await page.locator('#cur-code').fill(code); await page.locator('#cur-code-name').fill('Diamant animé');
  await page.locator('#cur-code-publish').click(); await page.waitForFunction(() => !document.querySelector('#cur-code-publish').disabled);
  assert.equal(puts, 1); assert.equal(members.length, 2); assert.equal(members[0].code.frames.length, 2);
  assert.equal(await page.evaluate(() => window.badCursor), undefined);
  const roundTrip = await page.evaluate(() => webos32.parseCursor(webos32.cursorCode(MEMBER_CURSORS[0].code)));
  assert.equal(roundTrip.ms, 1000); assert.equal(roundTrip.frames.length, 2);
  await page.locator('#cursor-members').getByText('Diamant animé', { exact: true }).waitFor();
  const fresh = await browser.newContext(); await routes(fresh);
  const p2 = await fresh.newPage(); await p2.goto(base); await open('Curseurs', p2);
  await p2.locator('#cursor-members').getByText('Diamant animé', { exact: true }).waitFor();
  await p2.locator('[data-membercur-apply="0"]').click();
  assert.match(await p2.locator('#cursor-style').textContent(), /wos32cursor/);
  await p2.reload(); assert.match(await p2.locator('#cursor-style').textContent(), /wos32cursor/);
  await fresh.close();
  getFails = true; await page.locator('#cur-code-name').fill('Pas publié');
  await page.locator('#cur-code-publish').click(); await page.waitForFunction(() => !document.querySelector('#cur-code-publish').disabled);
  assert.equal(puts, 1); assert.match(await page.locator('#cur-code-status').textContent(), /indisponible/); getFails = false;
  await page.locator('#cur-code').fill('body{cursor:url(data:image/png;base64,' + 'A'.repeat(70000) + ') 0 0,auto;}');
  await page.locator('#cur-code-publish').click(); await page.waitForFunction(() => !document.querySelector('#cur-code-publish').disabled);
  assert.equal(puts, 1); assert.match(await page.locator('#cur-code-status').textContent(), /64 Ko/);
  console.log('PASS code publication to simulated shared gallery, independent client apply/persistence, legacy retention, no scripts, quota and size failures without PUT');
  await page.locator('.window [data-act=close]').click(); await open('Navigateur');
  await yt('Minecraft'); await page.locator('#yt-results button[data-yt]').first().click();
  const tab1 = await page.locator('#br-tabs [data-tab]').first().getAttribute('data-tab'), player1 = await page.locator('#yt-player').getAttribute('src');
  await page.locator('#br-tab-add').click(); await yt('musique'); await page.locator('#yt-results button[data-yt]').first().click();
  const tab2 = await page.locator('#br-tabs [data-tab].active').getAttribute('data-tab'), player2 = await page.locator('#yt-player').getAttribute('src');
  await page.locator('#br-tab-add').click(); await yt('Minecraft');
  await page.locator('#br-tab-add').click(); await address('https://example.org/jeu');
  const gameTab = await page.locator('#br-tabs [data-tab].active').getAttribute('data-tab');
  const game = page.frameLocator('#br-frames>iframe:visible'); await game.locator('#counter').click();
  if (await game.locator('#counter').textContent() === '0') await game.locator('#counter').click();
  assert.equal(await game.locator('#counter').textContent(), '1', 'Game counter must increment before tab switching');
  await page.locator(`[data-tab="${tab1}"]`).click(); assert.equal(await page.locator('#yt-player').getAttribute('src'), player1);
  await page.locator(`[data-tab="${tab2}"]`).click(); assert.equal(await page.locator('#yt-player').getAttribute('src'), player2);
  await page.locator(`[data-tab="${gameTab}"]`).click(); assert.equal(await game.locator('#counter').textContent(), '1');
  await page.locator('.chip[data-url="https://www.youtube.com"]').click();
  assert.equal(await page.locator('#br-tabs [data-tab]').count(), 5);
  assert.equal(context.pages().length, 1);
  console.log('PASS three independent YouTube tabs and one preserved game, background players retained, service shortcut opens inside same browser without popup');
  await page.locator(`[data-tab="${tab1}"]`).click();
  await open('Assistant IA'); await page.locator('#ai-provider').selectOption('groq'); await page.locator('#ai-key').fill('gsk_fixture_not_a_real_key'); await page.locator('#ai-savekey').click(); await page.locator('#ai-ctrl').click();
  await page.locator('.window[data-app=ai] [data-act=close]').click();
  await send('Clique le titre Minecraft épisode incroyable survie');
  assert.match(await page.locator('#yt-player').getAttribute('src'), /MINECRAFT01/);
  response = { say: 'Autre vidéo.', actions: [{ cmd: 'play_video', title: 'Minecraft defi survie episode 3' }] };
  await send('Clique le défi survie épisode 3'); assert.match(await page.locator('#yt-player').getAttribute('src'), /MINECRAFT03/);
  response = { say: 'Titre erroné.', actions: [{ cmd: 'play_video', title: 'La recette du gâteau au chocolat' }] };
  await send('Titre sans rapport'); assert.match(await page.locator('#aiw-msgs').textContent(), /Aucun titre assez proche/);
  response = { say: 'Titre ambigu.', actions: [{ cmd: 'play_video', title: 'Minecraft défi survie' }] };
  await send('Titre ambigu'); assert.match(await page.locator('#aiw-msgs').textContent(), /Plusieurs titres sont proches/);
  response = { say: 'Tolérance aux fautes.', actions: [{ cmd: 'play_video', title: 'minecrft episode incroyable survie' }] };
  await send('Titre avec une faute'); assert.match(await page.locator('#yt-player').getAttribute('src'), /MINECRAFT01/);
  console.log('PASS approximate title accents/punctuation/missing words/typo, numeric episode guard, explicit unrelated/ambiguous title errors');
  await page.locator('#aiw-clear').click(); await page.locator('#aiw-clear-no').click(); assert.match(await page.locator('#aiw-msgs').textContent(), /Titre avec une faute/);
  delayAI = true;
  await page.locator('#aiw-input').fill('Message lent à supprimer'); await page.locator('#aiw-input').press('Enter');
  await page.waitForFunction(() => aiwBusy);
  // Wait for the intercepted request, not an arbitrary sleep.
  await page.waitForFunction(() => !!document.querySelector('.ai-typing'));
  await page.locator('#aiw-clear').click(); await page.locator('#aiw-clear-yes').click();
  if (releaseAI) await releaseAI(); delayAI = false;
  assert.deepEqual(await page.evaluate(() => LS.getJSON('aiwhist', null)), []);
  assert.equal(await page.evaluate(() => aiwBusy), false);
  assert.match(await page.locator('#aiw-msgs').textContent(), /Conversation effacée/);
  assert.doesNotMatch(await page.locator('#aiw-msgs').textContent(), /Message lent/);
  assert.equal(await page.evaluate(() => apiKeys.groq), 'gsk_fixture_not_a_real_key');
  assert.equal(await page.locator('#br-tabs [data-tab]').count(), 5);
  await page.screenshot({ path: '/home/user/workspace/webos-v33-tabs-desktop.png' });
  await page.setViewportSize({ width: 375, height: 812 }); await page.locator('#aiw-clear').click();
  await page.screenshot({ path: '/home/user/workspace/webos-v33-clear-mobile.png' });
  await page.locator('#aiw-clear-yes').click(); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(await page.evaluate(() => window.__topErrors), []);
  if (errors.length) console.log('NOTE remote iframe errors observed; streaming playback is not part of the assertion:', [...new Set(errors)].join(', '));
  console.log('PASS widget clear confirmation/cancel, pending request cancellation, empty saved context, keys/tabs preserved, mobile and zero top-level script errors');
} finally { await browser.close(); }
