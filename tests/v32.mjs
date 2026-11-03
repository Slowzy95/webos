import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// Deterministic integration fixtures. Real anonymous inference is checked
// separately; no owner's API key is present in this suite.
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const url = process.env.WEBOS_TEST_URL || 'http://127.0.0.1:3000/';
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAA7EAAAOxAGVKw4bAAACIklEQVRYhc2Xv07bUBTGfxcYqCIxgLIVRxFCitShnbImUyWExNQHYOhQUQYqKoZW6koX3qDKY8BKhg71whrUqQHRqimNZCl0ibgM9r25JHY4tpOUT4ri2Pf88Xe+c+6NQoilWlVL1wIETV9J1s2lcToN2CzfbHn2DX/8+gfA1ydlu2r18AC0pt/pOlYhForLoMN1i2slQPP91VtQCuA2aPrzSQnIGVCEDpOIVUPfwhgLouDaeI6RgUnMUKBEpb9nDkDFK9gw2xtPAWhs7o8Y/Dz6MsbL4Edw+k2UyQgDqaQea5TOg03gqvzM3mxsvg4fFpcjnxpvbwdQnPu/03H8AOQi1JqM/IzFoATGt/t+KQWVBcpMuNXPB1ESmv6fbvhw951Nov48LIeZEcDtid9J7G8pBgy4rWSgx1I+kSlqE+h3rm0ZTKsFFzduDbTbouYeOZkYvIVAXwlLcjEhMq54BXs9aV2KRnGr3YNIHI3jSzsxay9WANioFg05qcsxyoCw1SdVDsuAO/WGm2EICiwruYXptCHOrpeMKPC9aDEQMxHTBenHbR5hWgYW10thbDvzRV5Vq93LJUynC8acdhIwiXIogKVaFZSy9u9fbvHpw8dMxFa8wogwT8/+QgITcwBB04/UH36yBjdIw8TUjuVSYU5twzdnTIB6JExnK+fE7yh4BH9MZMfyDGi1e5KtfHYMJI23mZYgTpjTP3U6iBPmfxfhHaxTrn50b/zhAAAAAElFTkSuQmCC';
const snippet = `<style>@keyframes rwdcur24921 {0%,99.9%,100% {cursor:url(${png}) 0 0, auto;}}body{animation:rwdcur24921 0.16666666666667s linear infinite forwards;}</style><a href="https://www.rw-designer.com/cursor-set/minecraft-diamond-edition">Minecraft</a>`;
let response = { say: 'Je lance la recherche.', actions: [{ cmd: 'search', query: 'météo Paris' }, { cmd: 'open_result', index: 1 }] };
let requests = 0, freeHeaders, delayReader = false, releaseReader;
const json = (route, obj, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(obj) });
await context.route('https://api.groq.com/**', route => {
  if (route.request().url().endsWith('/models')) return json(route, { data: [{ id: 'openai/gpt-oss-120b', active: true }, { id: 'openai/gpt-oss-20b', active: true }, { id: 'llama-removed', active: true }] });
  const request = route.request().postDataJSON(), model = request.model;
  if (model === 'llama-removed') return json(route, { error: { message: 'model does not exist', code: 'model_not_found' } }, 404);
  if (model === 'openai/gpt-oss-20b') return json(route, { choices: [{ message: { content: 'Bonjour, réponse de conversation seulement.' } }] });
  if (request.messages.some(m => m.content?.includes?.('Ne navigue pas réellement'))) return json(route, { choices: [{ message: { content: JSON.stringify({ say: 'ok', actions: [{ cmd: 'navigate', url: 'https://www.youtube.com/' }] }) } }] });
  return json(route, { choices: [{ message: { content: JSON.stringify(response) } }] });
});
await context.route('https://text.pollinations.ai/**', route => {
  requests++; freeHeaders = route.request().headers();
  return json(route, { choices: [{ message: { content: 'Bonjour sans clé.' } }] });
});
await context.route('https://r.jina.ai/**', route => {
  if (route.request().url().includes('youtube.com')) {
    const html = '<script>var ytInitialData=' + JSON.stringify({ contents: { videoRenderer: { videoId: 'dQw4w9WgXcQ', title: { runs: [{ text: 'Première vidéo de test' }] }, ownerText: { runs: [{ text: 'Chaîne test' }] } } } }) + ';</script>' + ' '.repeat(12000);
    return route.fulfill({ contentType: 'text/plain', body: html });
  }
  const finish = () => route.fulfill({ contentType: 'text/plain', body: '# météo Paris - Bing\n\n### [Météo Paris](https://example.org/meteo)\n\nPrévision météo du jour.\n\n### [Autre résultat](https://example.org/autre)\n\nAutre prévision.\n' });
  if (delayReader) return new Promise(resolve => { releaseReader = async () => { await finish(); resolve(); }; });
  return finish();
});
await context.route('https://slowzy95.github.io/proxy/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Remote navigation fixture</p>' }));
const open = async name => {
  await page.locator('#start-btn').click(); await page.locator('#sm-search').fill(name);
  await page.locator('#sm-apps .sm-tile:visible').click();
};
const close = async () => {
  if (await page.locator('#aiw-panel').isVisible()) await page.locator('#aiw-min').click();
  while (await page.locator('.window:not(.win-close)').count()) await page.locator('.window:not(.win-close) [data-act=close]').last().click();
  await page.waitForFunction(() => !document.querySelector('.window'));
};
const send = async text => {
  if (!await page.locator('#aiw-panel').isVisible()) await page.locator('#aiw-bubble').click();
  await page.locator('#aiw-input').fill(text); await page.locator('#aiw-input').press('Enter');
  await page.waitForFunction(() => !aiwBusy);
};
try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await open('Paramètres');
  const original = await page.locator('.window').evaluate(n => [n.style.left, n.style.top, n.style.width, n.style.height]);
  for (let i = 0; i < 25; i++) {
    await page.locator('.window [data-act=min]').click();
    await page.locator('#tb-pinned [title=Paramètres]').click();
    assert.deepEqual(await page.locator('.window').evaluate(n => [n.style.left, n.style.top, n.style.width, n.style.height]), original);
  }
  for (let i = 0; i < 4; i++) {
    await page.locator('.window [data-act=max]').click(); await page.waitForFunction(() => !document.querySelector('.window').style.transition);
    await page.locator('.window [data-act=max]').click(); await page.waitForFunction(() => !document.querySelector('.window').style.transition);
    assert.deepEqual(await page.locator('.window').evaluate(n => [n.style.left, n.style.top, n.style.width, n.style.height]), original);
  }
  await page.locator('.window').evaluate(el => {
    Object.defineProperty(el, 'offsetWidth', { configurable: true, value: 1440 });
    Object.defineProperty(el, 'offsetHeight', { configurable: true, value: 900 });
    webos32.clampWindow(el, document.querySelector('#windows-layer').getBoundingClientRect());
    delete el.offsetWidth; delete el.offsetHeight;
  });
  assert.deepEqual(await page.locator('.window').evaluate(n => [n.style.left, n.style.top, n.style.width, n.style.height]), original);
  console.log('PASS stable geometry after 25 restore cycles and 4 maximize cycles');
  await page.locator('[data-category=system]').click(); await page.locator('#st-storage-v30').waitFor();
  assert.equal(await page.locator('#st-themes').isVisible(), false);
  await page.getByRole('textbox', { name: 'Rechercher un réglage' }).fill('Camouflage');
  assert.equal(await page.locator('#st-title').isVisible(), true);
  await page.getByRole('textbox', { name: 'Rechercher un réglage' }).fill('no-setting-has-this-name');
  await page.getByText('Aucun réglage trouvé.', { exact: false }).waitFor();
  await page.locator('[data-category=cursor]').click();
  await page.locator('#cur-code').fill(snippet); await page.locator('#cur-code-apply').click();
  assert.match(await page.locator('#cur-code-status').textContent(), /appliqué et enregistré/);
  assert.match(await page.locator('#cursor-style').textContent(), /0 0, auto/);
  await page.reload(); await open('Paramètres'); await page.locator('[data-category=cursor]').click();
  assert.match(await page.locator('#cursor-style').textContent(), /base64/);
  await page.locator('#cur-code').fill('<script>window.badCursor=true</script><style>body{background:url(https://example.org/track)}</style>');
  await page.locator('#cur-code-apply').click();
  assert.match(await page.locator('#cur-code-status').textContent(), /Aucune règle/);
  assert.equal(await page.evaluate(() => window.badCursor), undefined);
  await page.locator('#cur-code').fill('body{cursor:url(javascript:alert(1)) 0 0, auto;}'); await page.locator('#cur-code-apply').click();
  assert.match(await page.locator('#cur-code-status').textContent(), /refusée/);
  await page.locator('#cur-code').fill(`@keyframes demo{0%{cursor:url(${png}) 0 0, auto;}100%{cursor:url(${png}) 1 1, auto;}}body{animation:demo 1s infinite}`);
  await page.locator('#cur-code-apply').click(); assert.match(await page.locator('#cursor-style').textContent(), /--wos32cursor/);
  await page.locator('#cur-code-reset').click(); assert.equal(await page.locator('#cursor-style').textContent(), '');
  await page.screenshot({ path: '/home/user/workspace/webos-v32-cursor-desktop.png' });
  await close(); await open('Curseurs'); await page.locator('#cur-code').waitFor();
  console.log('PASS settings categories, search, late storage controls, safe cursor import/animation/rejection/persistence/reset in both entry points');
  await close(); await open('Assistant IA');
  await page.locator('#ai-provider').selectOption('pollinations'); assert.equal(await page.locator('#ai-key').isVisible(), false);
  await page.locator('#ai-input').fill('Bonjour'); await page.locator('#ai-input').press('Enter');
  await page.waitForFunction(() => !aiChatBusy);
  assert.equal(requests, 1); assert.equal(freeHeaders.authorization, undefined);
  await page.locator('#ai-input').fill('Encore'); await page.locator('#ai-input').press('Enter'); await page.waitForFunction(() => !aiChatBusy);
  assert.equal(requests, 1); assert.match(await page.locator('#ai-messages').textContent(), /45 s|attends encore/);
  await page.locator('#ai-provider').selectOption('groq'); await page.locator('#ai-key').fill('gsk_fixture_not_a_real_key');
  await page.locator('#ai-savekey').click(); await page.locator('#ai-ctrl').click();
  await send('Cherche la météo et ouvre le premier lien');
  assert.match(await page.locator('#br-url').inputValue(), /example\.org\/meteo/);
  console.log('PASS anonymous provider UI, shared 45s cooldown, no bearer header and ordered search/first-result actions (fixtures)');
  await close(); await open('Assistant IA');
  await page.locator('#ai-diagnostics').click(); await page.waitForFunction(() => !aiDiagnosticsBusy);
  assert.equal(await page.locator('#ai-model option[value="llama-removed"]').count(), 0);
  assert.equal(await page.locator('#ai-model option[value="openai/gpt-oss-20b"]').count(), 1);
  assert.equal(await page.locator('#aiw-model option[value="openai/gpt-oss-20b"]').count(), 0);
  await page.locator('#ai-diagnostics-all').click();
  await page.waitForFunction(() => !document.querySelector('#ai-diagnostics-all').disabled);
  assert.match(await page.locator('#ai-diagnostics-results').textContent(), /aucune clé enregistrée/);
  assert.match(await page.locator('#ai-diagnostics-results').textContent(), /Groq/);
  await page.reload(); await open('Assistant IA');
  assert.equal(await page.locator('#aiw-model option[value="openai/gpt-oss-20b"]').count(), 0);
  console.log('PASS definitive model removal, persisted chat-only exclusion from control but not conversation');
  await close();
  response = { say: 'Je sélectionne la vidéo.', actions: [{ cmd: 'youtube', query: 'test vidéo' }, { cmd: 'play_video', index: 1 }] };
  await send('Cherche une vidéo et clique sur la première');
  await page.waitForFunction(() => document.querySelector('#yt-player')?.src.includes('dQw4w9WgXcQ'));
  console.log('PASS visible YouTube card selection after asynchronous search (remote playback not asserted)');
  delayReader = true;
  response = { say: 'Recherche puis sélection.', actions: [{ cmd: 'search', query: 'annulation résultat' }, { cmd: 'open_result', index: 1 }] };
  await page.locator('#aiw-input').fill('Recherche puis ouvre le résultat'); await page.locator('#aiw-input').press('Enter');
  await page.waitForFunction(() => document.querySelector('#br-url')?.value.includes('annulation'));
  await page.locator('#aiw-power').click();
  await releaseReader(); delayReader = false;
  await page.frameLocator('#br-frames>iframe:visible').locator('.result').first().waitFor();
  assert.match(await page.locator('#br-url').inputValue(), /bing\.com/);
  console.log('PASS Stop cancels result selection while the reader is still loading');
  await close(); await page.setViewportSize({ width: 375, height: 812 }); await open('Paramètres');
  await page.locator('[data-category=system]').click(); await page.locator('#st-storage-v30').waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.waitForFunction(() => !document.querySelector('#toasts').children.length);
  await page.screenshot({ path: '/home/user/workspace/webos-v32-settings-mobile.png' });
  await page.locator('[data-category=cursor]').click(); await page.locator('#cur-code').waitFor();
  await page.screenshot({ path: '/home/user/workspace/webos-v32-cursor-mobile.png' });
  assert.deepEqual(errors, []);
  console.log('PASS 375px categories/cursor, viewport fit and no uncaught script errors');
} finally { await browser.close(); }
