import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { ensureProxyTransport } from '../../proxy/scripts/transport.mjs';

const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
await ctx.addInitScript(() => {
  try {
    if (navigator.storage) navigator.storage.persist = () =>
      Promise.reject(new DOMException('Persistence not available in this context', 'NotSupportedError'));
  } catch {}
});
await ctx.route('https://slowzy95.github.io/proxy/**', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Fixture</title>' }));
const page = await ctx.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(process.env.WEBOS_TEST_URL || 'http://127.0.0.1:3000/webos/');
const positions = () => page.locator('#desk-icons .desk-icon:not([hidden])').evaluateAll(es =>
  Object.fromEntries(es.map(e => [e.dataset.iconId, { x: e.offsetLeft, y: e.offsetTop, w: e.offsetWidth, h: e.offsetHeight }])));
async function validGrid() {
  const p = await positions(), values = Object.values(p);
  for (const a of values) {
    assert.equal(a.x % 104, 0); assert.equal(a.y % 112, 0);
    assert.ok(a.x >= 0 && a.y >= 0);
    for (const b of values) if (a !== b)
      assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, 'icons overlap');
  }
  return p;
}
async function drag(id, dx, dy) {
  const box = await page.locator(`#desk-icons [data-icon-id="${id}"]`).boundingBox();
  await page.mouse.move(box.x + 35, box.y + 25); await page.mouse.down();
  await page.mouse.move(box.x + 35 + dx, box.y + 25 + dy, { steps: 9 }); await page.mouse.up();
}
const initial = await validGrid();
await page.keyboard.press('Control+a');
await drag('browser', 208, 0);
const grouped = await validGrid();
assert.deepEqual(Object.keys(grouped).sort(), Object.keys(initial).sort());
for (const id of Object.keys(initial)) {
  assert.equal(grouped[id].x - initial[id].x, 208, id);
  assert.equal(grouped[id].y, initial[id].y, id);
}
assert.equal(await page.evaluate(() => TRASH.length), 0);
console.log('PASS first layout; Ctrl+A keeps icons, relative shape and trash');
await page.reload();
assert.deepEqual(await validGrid(), grouped);
await page.locator('#desk-icons [data-icon-id="browser"]').click({ modifiers: ['Control'] });
await page.locator('#desk-icons [data-icon-id="ai"]').click({ modifiers: ['Control'] });
assert.equal(await page.locator('.window').count(), 0);
await drag('browser', 208, 0);
const partial = await validGrid();
assert.equal(partial.browser.x - grouped.browser.x, partial.ai.x - grouped.ai.x);
assert.equal(partial.browser.y - grouped.browser.y, partial.ai.y - grouped.ai.y);
for (const id of Object.keys(grouped).filter(id => !['browser', 'ai'].includes(id)))
  assert.deepEqual(partial[id], grouped[id], id + ' should stay put');
await page.mouse.click(1100, 650);
await drag('trash', partial.browser.x - partial.trash.x, partial.browser.y - partial.trash.y);
await validGrid();
console.log('PASS partial selection and trash cannot overlap');
// Setup an occupied former cell, then exercise actual Restore UI.
await page.evaluate(() => {
  moveToTrash(document.querySelector('#desk-icons [data-icon-id="media"]'));
  const p = getIconPos(); p.media = { ...p.browser }; LS.setJSON('iconpos', p);
});
await page.waitForFunction(() => !document.querySelector('#desk-icons [data-icon-id="trash"]')._dragged);
await page.locator('#desk-icons [data-icon-id="trash"]').click();
await page.locator('[data-twrestore]').first().click();
assert.ok((await validGrid()).media);
await page.getByRole('button', { name: 'Afficher le bureau', exact: true }).click();
await page.locator('#desk-icons [data-icon-id="addapp"]').click();
await page.locator('#aa-name').fill('Fixture app');
await page.locator('#aa-url').fill('https://example.com/');
await page.locator('#aa-ok').click();
assert.ok(Object.keys(await validGrid()).some(id => id.startsWith('custom_')));
await page.reload(); await validGrid();
await page.setViewportSize({ width: 375, height: 812 }); await validGrid();
assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
await page.screenshot({ path: '/home/user/workspace/webos-v43-mobile.png' });
await page.setViewportSize({ width: 1366, height: 768 }); await validGrid();
await page.screenshot({ path: '/home/user/workspace/webos-v43-desktop.png' });
console.log('PASS restore, new app, reload and mobile grid');

// Provider responses are fixtures; no real account key is used.
let kind = 'zero';
await ctx.route('https://generativelanguage.googleapis.com/**', r => r.fulfill({
  status: 429, json: { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded', details: [
    { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaValue: kind === 'zero' ? '0' : '15' }] }
  ] } }
}));
await page.evaluate(() => {
  apiKeys.google = 'fixture-account-A';
  AI_PROVIDERS.google.models = ['fixture-one', 'fixture-two'];
});
await page.getByRole('button', { name: 'Assistant IA', exact: true }).click();
await page.locator('#ai-provider').selectOption('google');
await page.locator('#ai-file').setInputFiles({ name: 'test.png', mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') });
await page.locator('#ai-input').fill('Bonjour'); await page.locator('#ai-send').click();
await page.locator('#ai-messages').getByText(/limite de quota égale à zéro/).waitFor();
assert.equal(await page.locator('#ai-model option[value="fixture-one"]').count(), 0);
assert.equal(await page.locator('#ai-imgbar').isVisible(), true);
kind = 'temporary';
await page.locator('#ai-input').fill('Encore'); await page.locator('#ai-send').click();
await page.locator('#ai-messages').getByText(/Limite temporaire du fournisseur/).waitFor();
assert.equal(await page.locator('#ai-model option[value="fixture-two"]').count(), 1);
await page.evaluate(async () => { apiKeys.google = 'fixture-account-B'; await aiRefreshKeyTag('google'); aiSyncSelectors(); });
assert.equal(await page.locator('#ai-model option[value="fixture-one"]').count(), 1);
await page.evaluate(async () => { apiKeys.google = 'fixture-account-A'; await aiRefreshKeyTag('google'); aiSyncSelectors(); });
assert.equal(await page.locator('#ai-model option[value="fixture-one"]').count(), 0);
await page.locator('#ai-show-unavailable').click();
assert.equal(await page.locator('#ai-model option[value="fixture-one"]').count(), 1);
assert.deepEqual(errors, []);
console.log('PASS quota zero hiding, temporary limit, key isolation and restore');

let current = '', resets = 0;
const fake = {
  getTransport: async () => current,
  setManualTransport: async (factory, options) => {
    current = JSON.parse(factory.match(/return \[Transport, (.*)\];/)[1]); resets++;
  }
};
const ep = '/proxy/prxy/epoxy/index.mjs', lc = '/proxy/prxy/libcurl/index.mjs';
await ensureProxyTransport(fake, ep, [{ wisp: 'wss://fixture/' }]);
await ensureProxyTransport(fake, ep, [{ wisp: 'wss://fixture/' }]);
await ensureProxyTransport(fake, lc, [{ websocket: 'wss://other/' }], { reuseExisting: true });
assert.equal(resets, 1);
await ensureProxyTransport(fake, lc, [{ websocket: 'wss://other/' }]);
assert.equal(resets, 2);
console.log('PASS shared transport reuse and explicit changes');
assert.equal(await page.evaluate(async () => {
  const { ensureProxyTransport } = await import('/proxy/scripts/transport.mjs?v=43');
  let state = '', resets = 0;
  const connection = {
    getTransport: async () => state,
    setManualTransport: async factory => {
      state = JSON.parse(factory.match(/return \[Transport, (.*)\];/)[1]); resets++;
    }
  };
  await Promise.all(Array.from({ length: 12 }, () => ensureProxyTransport(connection,
    '/proxy/prxy/epoxy/index.mjs', [{ wisp: 'wss://fixture/' }])));
  return resets;
}), 1);
const sw = await readFile(new URL('../../proxy/uv/sw.js', import.meta.url), 'utf8');
const canonical = sw.slice(sw.indexOf('function canonicalRelativeProxyURL'), sw.indexOf('async function handleRequest'));
const origin = 'https://proxy.example', prefix = '/proxy/uv/service/';
const malformed = origin + prefix + encodeURIComponent('https://game.example/game/') + '/static/js/chunk.js?x=1';
const repaired = vm.runInNewContext(canonical + '\ncanonicalRelativeProxyURL(input)', {
  URL, input: malformed, location: { origin }, __uv$config: { prefix, decodeUrl: decodeURIComponent, encodeUrl: encodeURIComponent }
});
assert.equal(decodeURIComponent(repaired.slice((origin + prefix).length)), 'https://game.example/game/static/js/chunk.js?x=1');
console.log('PASS concurrent transport initialization and relative game chunks');
await page.addScriptTag({ url: '/proxy/uv/uv.bundle.js?v=43' });
await page.addScriptTag({ url: '/proxy/uv/uv.config.js?v=43' });
const imports = await page.evaluate(() => {
  const uv = new Ultraviolet({ ...__uv$config });
  uv.meta.origin = location.origin;
  uv.meta.url = 'https://game.example/static/js/main.js';
  uv.meta.base = uv.meta.url;
  uv.blobUrls = new Map([['blob:https://game.example/fixture', 'blob:' + location.origin + '/fixture']]);
  if (uv.rewriteUrl('blob:https://game.example/fixture') !== 'blob:' + location.origin + '/fixture' ||
    uv.rewriteUrl('blob:' + location.origin + '/physical') !== 'blob:' + location.origin + '/physical')
    throw new Error('Page-created blobs must remain local');
  if (!uv.rewriteJS('import("../../static/js/chunk.js")')
    .includes('__uv.rewriteImport("https://game.example/static/js/main.js",'))
    throw new Error('UV dynamic-import emitter changed its argument order');
  return ['../../static/js/chunk.js', '/assets/chunk.js', 'https://cdn.example/chunk.js']
    .map(specifier => {
      const rewritten = uv.rewriteImport(uv.meta.url, specifier);
      return __uv$config.decodeUrl(rewritten.slice((location.origin + __uv$config.prefix).length));
    });
});
assert.deepEqual(imports, [
  'https://game.example/static/js/chunk.js',
  'https://game.example/assets/chunk.js',
  'https://cdn.example/chunk.js'
]);
console.log('PASS real UV dynamic import resolution uses chunk, not importing module');
const client = await readFile(new URL('../../proxy/uv/uv.client.js', import.meta.url), 'utf8');
await page.addScriptTag({ content: client });
assert.equal(await page.evaluate(async () => {
  const uv = new UVClient(window);
  uv.message.overridePostMessage();
  const channel = new MessageChannel();
  const got = new Promise(resolve => {
    window.addEventListener('message', e => { if (e.data?.testV43) resolve(e.data.port instanceof MessagePort); }, { once: true });
  });
  const send = uv.message.wrapPostMessage(window, 'postMessage');
  send({ testV43: true, port: channel.port2 }, { targetOrigin: location.origin, transfer: [channel.port2] });
  return await got;
}), true);
console.log('PASS messaging transfer dictionary preserves ownership');
await browser.close();
console.log('v43 OK; no real Google account/quota tested');
