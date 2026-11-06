import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await ctx.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
const attempts = [];
await ctx.route('https://slowzy95.github.io/proxy/**', route => {
  attempts.push(route.request().url());
  return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Fixture</title><div id="root"></div>' });
});
await page.clock.install();
await page.goto('http://127.0.0.1:3000/webos/');
await page.getByRole('button', { name: 'Game Hub', exact: true }).click();
assert.equal(await page.locator('[data-game]').count(), 6);
assert.equal(await page.locator('#gh-platforms [data-inapp]').count(), 13);
await page.locator('[data-inapp="https://bloxd.io"]').click();
await page.waitForFunction(() => document.querySelector('#br-frames > iframe')?.src.includes('/proxy/'));
let frame = page.frames().find(f => f.url().startsWith('https://slowzy95.github.io/proxy/?'));
if (!frame) frame = await page.waitForEvent('framenavigated', { predicate: f => f.url().startsWith('https://slowzy95.github.io/proxy/?') });
await frame.evaluate(() => parent.postMessage({
  wosProxy: 'loaded', url: 'https://bloxd.io/', request: new URL(location.href).searchParams.get('request')
}, '*'));
await page.waitForFunction(() => document.querySelector('#br-status')?.textContent.includes('chargement terminé'));
const afterReady = attempts.length;
await page.clock.fastForward(23000);
assert.equal(attempts.length, afterReady, 'canonical loaded URL must cancel fallback');
assert.equal(await page.locator('#br-frames > iframe').getAttribute('src').then(u => new URL(u).searchParams.get('wisp')), '0');
console.log('PASS canonical target URL stops retries and preserves the selected server');

await page.locator('#br-url').fill('https://discord.com/login');
await page.locator('#br-url').press('Enter');
await page.waitForFunction(() => document.querySelector('#br-frames > iframe')?.src.includes('discord.com'));
frame = page.frames().find(f => f.url().includes('discord.com') && f.url().startsWith('https://slowzy95.github.io/proxy/'));
if (!frame) frame = await page.waitForEvent('framenavigated', { predicate: f => f.url().includes('discord.com') && f.url().startsWith('https://slowzy95.github.io/proxy/') });
const discordStart = attempts.length;
await page.clock.fastForward(30000);
assert.equal(attempts.length, discordStart, 'a heavy app must not restart at 22 seconds');
await page.evaluate(() => addEventListener('message', e => {
  if (e.data?.request === 'obsolete-request') window.__obsoleteSeen = true;
}));
await frame.evaluate(() => parent.postMessage({
  wosProxy: 'loaded', url: 'https://discord.com/login', request: 'obsolete-request'
}, '*'));
await page.waitForFunction(() => window.__obsoleteSeen);
assert.ok(!(await page.locator('#br-status').textContent()).includes('chargement terminé'),
  'an obsolete request must not complete the current navigation');
await frame.evaluate(() => parent.postMessage({
  wosProxy: 'progress', url: 'https://discord.com/login',
  request: new URL(location.href).searchParams.get('request'), elapsed: 30, resources: 350
}, '*'));
await page.waitForFunction(() => document.querySelector('#br-status')?.textContent.includes('350 fichiers'));
await frame.evaluate(() => parent.postMessage({
  wosProxy: 'stalled', url: 'https://discord.com/login',
  request: new URL(location.href).searchParams.get('request')
}, '*'));
await page.waitForFunction(() => document.querySelector('#br-status')?.textContent.includes('Démarrage non terminé'));
await page.clock.fastForward(240000);
assert.equal(attempts.length, discordStart, 'stalled application must keep its frame, not rotate servers');
assert.ok(await page.locator('#br-frames > iframe').getAttribute('src').then(u => u.includes('discord.com')));
console.log('PASS slow Discord, progress and bounded stalled state never replace the application');
await ctx.close();

const monitorCtx = await browser.newContext(), monitorPage = await monitorCtx.newPage();
await monitorPage.goto('http://127.0.0.1:3000/');
const result = await monitorPage.evaluate(async () => {
  const { inspectDocument, monitorFrame, createLoadNotice } = await import('/proxy/scripts/load-state.mjs?v=44');
  const index = await fetch('/proxy/').then(r => r.text());
  if (index.includes('lstimer.js')) throw new Error('Legacy script disables real 1s/5s intervals');
  const notice = createLoadNotice({target: 'https://discord.com/login', onRetry() {}});
  const box = document.querySelector('#proxy-load-state');
  const [stop, retry] = box.querySelectorAll('button');
  const initialButtons = getComputedStyle(stop).display !== 'none' && getComputedStyle(retry).display === 'none';
  notice.show({phase: 'ready'});
  const readyHidden = getComputedStyle(box).display === 'none';
  notice.show({phase: 'stalled'});
  const stalledButtons = getComputedStyle(stop).display === 'none' && getComputedStyle(retry).display !== 'none';
  if (!initialButtons || !readyHidden || !stalledButtons) throw new Error('Load notice visibility must not depend on global CSS');
  notice.setActive(false);
  if (getComputedStyle(box).display !== 'none') throw new Error('Inactive tabs must not overlay another game');
  notice.setActive(true);
  if (getComputedStyle(box).display === 'none') throw new Error('Returning to a tab restores its status');
  notice.remove();
  const { search } = await import('/proxy/scripts/prxy.mjs?v=44');
  if (!search('chaton bleu').endsWith('q=chaton%20bleu')) throw new Error('Proxy search requires a default template');
  const f = document.createElement('iframe'); document.body.append(f);
  let realTicks = 0;
  const realMonitor = monitorFrame(f, {intervalMs: 1000, onState: () => realTicks++});
  await new Promise(resolve => setTimeout(resolve, 1150));
  realMonitor.stop();
  if (realTicks < 2) throw new Error('Readiness monitoring requires a working real 1s interval');
  const blank = inspectDocument(f.contentDocument).phase;
  f.contentDocument.body.innerHTML = '<div id="app-mount"></div>';
  // srcdoc gives this test document an application URL, rather than about:blank.
  f.srcdoc = '<!doctype html><div id="app-mount"></div>';
  await new Promise(resolve => f.onload = resolve);
  let time = 0, states = [];
  const m = monitorFrame(f, { now: () => time, maxMs: 90000, onState: s => states.push(s.phase) });
  m.check();
  const empty = states.at(-1);
  const ad = f.contentDocument.createElement('iframe'); ad.srcdoc = '<title>Error</title>';
  f.contentDocument.body.append(ad);
  await new Promise(resolve => ad.onload = resolve);
  f.contentDocument.querySelector('#app-mount').innerHTML = '<input name="email" type="email">';
  m.check();
  const ready = states.at(-1);
  time = 100000; m.check();
  const readyStayed = states.at(-1);
  f.contentDocument.querySelector('#app-mount').innerHTML = '';
  states = []; time = 0;
  const n = monitorFrame(f, { now: () => time, maxMs: 90000, onState: s => states.push(s.phase) });
  n.check(); time = 90000; n.check();
  const stalled = states.at(-1);
  f.contentDocument.querySelector('#app-mount').innerHTML = '<button>Late</button>';
  n.check();
  return { blank, empty, ready, readyStayed, stalled, stalledStayed: states.at(-1), framePreserved: f.isConnected };
});
assert.deepEqual(result, {
  blank: 'connecting', empty: 'preparing', ready: 'ready', readyStayed: 'ready',
  stalled: 'stalled', stalledStayed: 'stalled', framePreserved: true
});
assert.deepEqual(errors, []);
console.log('PASS initial blank, empty SPA, actual controls, child-ad error and hard deadline');
const startup = await monitorCtx.newPage(), startupErrors = [];
startup.on('pageerror', e => startupErrors.push(e.message));
await startup.route(/https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\//, route => route.abort());
await startup.goto('http://127.0.0.1:3000/proxy/');
await startup.waitForFunction(() => typeof van === 'object' && document.querySelector('#tab-view iframe'));
assert.ok(await startup.locator('#tab-view iframe').count(), 'proxy tabs start even if public CDNs are unavailable');
assert.deepEqual(startupErrors, []);
console.log('PASS real proxy startup with public CDNs blocked and local VanJS');
await monitorCtx.close(); await browser.close();
console.log('v44 OK (fixtures; real Discord and embedded-game checks remain separate)');
