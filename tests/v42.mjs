import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// All remote content and AI responses below are fixtures. No real user keys.
const base = process.env.WEBOS_TEST_URL || 'http://127.0.0.1:3000/webos/';
const proxyPath = new URL('../../proxy/', import.meta.url);
const uvSource = await readFile(new URL('scripts/tabs.mjs', proxyPath), 'utf8');
const sjSource = await readFile(new URL('sj/go.html', proxyPath), 'utf8');
const openSource = await readFile(new URL('scripts/open-page.js', proxyPath), 'utf8');
const uvGuard = uvSource.slice(uvSource.indexOf('function attachLinkGuard(tab)'), uvSource.indexOf('\nasync function renavTab'));
const sjGuard = sjSource.slice(sjSource.indexOf('  const guardDoc = '), sjSource.indexOf('  const guardAll = '));
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
let aiRequests = [];
const models = [
  { id: 'test/text:free', architecture: { input_modalities: ['text'], output_modalities: ['text'] } },
  { id: 'test/vision:free', architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] } }
];
await ctx.route('https://openrouter.ai/api/v1/**', async route => {
  if (route.request().url().endsWith('/models'))
    return route.fulfill({ json: { data: models } });
  aiRequests.push(route.request().postDataJSON());
  return route.fulfill({ json: { choices: [{ message: { content: 'Image reçue : un carré bleu.' } }] } });
});
await ctx.route('https://slowzy95.github.io/proxy/**', route =>
  route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Fixture proxy</title><p>Page distante simulée</p>' }));
await page.goto(base);
await page.getByRole('button', { name: 'Paramètres', exact: true }).click();
await page.locator('[data-pxs="brave"]').click();
await page.locator('[data-pxe="uv"]').click();
await page.locator('[data-pxt="epoxy"]').click();
assert.equal(await page.locator('#st-px-auto').isChecked(), false);
assert.equal(await page.evaluate(() => proxyPlan('https://example.com/').length), 1);
await page.getByRole('button', { name: 'Navigateur', exact: true }).click();
await page.locator('#br-url').fill('un test de recherche');
await page.locator('#br-url').press('Enter');
assert.match(await page.locator('#br-frames > iframe').first().getAttribute('src'), /search\.brave\.com/);
assert.match(await page.locator('#br-frames > iframe').first().getAttribute('src'), /transport=epoxy/);
assert.match(await page.locator('#br-frames > iframe').first().getAttribute('src'), /proxy\/\?url=/);
await page.reload();
await page.getByRole('button', { name: 'Navigateur', exact: true }).click();
assert.equal(await page.evaluate(() => LS.get('engine', '')), 'brave');
console.log('PASS settings before browser, reload, manual UV/Epoxy');

// Stage a source document with a visible state marker, then exercise the real
// message listener with source windows including an inactive tab.
await page.evaluate(() => {
  const f = document.querySelector('#br-frames > iframe');
  f.removeAttribute('src'); f.srcdoc = '<p id="state">Jeu en cours</p>';
});
await page.frameLocator('#br-frames > iframe').first().locator('#state').waitFor();
await page.evaluate(() => {
  const f = document.querySelector('#br-frames > iframe');
  f.contentWindow.eval("parent.postMessage({wosNewTab:'https://example.com/ad'},'*')");
});
await page.waitForFunction(() => document.querySelectorAll('#br-frames > iframe').length === 2);
assert.equal(await page.frameLocator('#br-frames > iframe').first().locator('#state').innerText(), 'Jeu en cours');
await page.evaluate(() => {
  document.querySelector('#br-frames > iframe').contentWindow.eval("parent.postMessage({wosNav:'https://example.com/source'},'*')");
});
await page.waitForFunction(() => document.querySelector('#br-frames > iframe').src.includes('source'));
assert.match(await page.locator('#br-frames > iframe').nth(1).getAttribute('src'), /example\.com%2Fad/);
const count = await page.locator('#br-frames > iframe').count();
await page.evaluate(() => window.postMessage({ wosNewTab: 'https://example.com/foreign' }, '*'));
assert.equal(await page.locator('#br-frames > iframe').count(), count);
console.log('PASS new tabs preserve game, inactive source navigation, foreign messages');

await page.evaluate(() => {
  apiKeys.openrouter = 'fixture-only';
  AI_PROVIDERS.openrouter.models = ['test/text:free', 'test/vision:free'];
});
await page.getByRole('button', { name: 'Assistant IA', exact: true }).click();
await page.locator('#ai-provider').selectOption('openrouter');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
await page.locator('#ai-file').setInputFiles({ name: 'blue.png', mimeType: 'image/png', buffer: png });
await page.locator('#ai-input').fill('Tu vois quoi ?');
await page.locator('#ai-send').click();
await page.waitForFunction(() => !aiChatBusy);
assert.equal(aiRequests.length, 0);
assert.equal(await page.locator('#ai-imgbar').isVisible(), true);
assert.equal(await page.locator('#ai-model option').count(), 2);
await page.locator('#ai-model').selectOption('test/vision:free');
await page.locator('#ai-send').click();
await page.locator('#ai-messages').getByText('Image reçue : un carré bleu.', { exact: true }).waitFor();
assert.equal(aiRequests.length, 1);
assert.equal(aiRequests[0].model, 'test/vision:free');
assert.equal(aiRequests[0].messages.at(-1).content[1].type, 'image_url');
console.log('PASS text model rejected locally, image kept, vision model payload accepted');

// Exercise the exact guard code used by each engine in a controlled same-origin
// frame. This validates routing, not third-party games or service workers.
for (const engine of ['uv', 'sj']) {
  await page.evaluate(({ openSource, uvGuard, sjGuard, engine }) => {
    window.__guardEvents = [];
    window.eval(openSource);
    window.wosOpenPage = u => { window.__guardEvents.push(['new', u]); return null; };
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;inset:10px;width:600px;height:250px;z-index:2147483647;background:white';
    f.id = 'guard-fixture'; document.body.append(f);
    f.contentDocument.body.innerHTML = '<p id="state">Jeu conservé</p><a id="blank" target="_blank" href="https://example.com/ad">Pub</a><a id="plain" href="https://example.com/next">Suite</a><form target="_blank" method="post"></form>';
    if (engine === 'uv') {
      window.__uv$config = { prefix: '/proxy/uv/service/', decodeUrl: u => u };
      window.renavTab = (tab, u) => window.__guardEvents.push(['same', u]);
      window.eval(uvGuard);
      window.attachLinkGuard({ view: f });
      f.dispatchEvent(new Event('load'));
    } else {
      window.realOf = u => u;
      window.eval(sjGuard + '\nwindow.__testGuard = guardDoc;');
      window.__testGuard(f.contentDocument, f.contentWindow);
    }
  }, { openSource, uvGuard, sjGuard, engine });
  await page.frameLocator('#guard-fixture').locator('#blank').click();
  await page.evaluate(() => document.querySelector('#guard-fixture').contentWindow.open('https://example.com/popup'));
  await page.frameLocator('#guard-fixture').locator('#plain').click({ modifiers: ['Control'] });
  assert.equal(await page.evaluate(() => window.__guardEvents.filter(e => e[0] === 'new').length), 3, engine);
  assert.equal(await page.frameLocator('#guard-fixture').locator('#state').innerText(), 'Jeu conservé');
  assert.equal(await page.frameLocator('#guard-fixture').locator('form').getAttribute('target'), '_blank');
  await page.evaluate(() => document.querySelector('#guard-fixture').remove());
  console.log('PASS ' + engine + ' real guard: target blank, window.open, modified click, POST target intact');
}
assert.deepEqual(errors, []);
await page.screenshot({ path: '/home/user/workspace/webos-v42-desktop.png' });
await page.setViewportSize({ width: 375, height: 812 });
assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
await page.screenshot({ path: '/home/user/workspace/webos-v42-mobile.png' });
await page.setViewportSize({ width: 1366, height: 768 });
await browser.close();
console.log('v42 OK (fixtures only; no real Discord login, game or AI credentials tested)');
