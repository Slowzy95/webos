import { chromium } from 'playwright';
import assert from 'node:assert/strict';

// All paid/keyed model requests in this suite are intercepted. Fixture keys are
// synthetic and never authenticate to a provider. Run a real provider diagnostic
// separately with the owner's own keys; these tests cover UI and integration.
const url = process.env.WEBOS_TEST_URL || 'http://127.0.0.1:3000/';
const browser = await chromium.launch({ headless: true, channel: 'chromium' });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const json = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
let response = { say: 'Je demande la navigation.', actions: [{ cmd: 'navigate', url: 'https://www.youtube.com/' }] };
let pendingResolve;
let delayed = false;
let diagnostic = false;
let quota = false;
let requestedModels = [];
await context.route('https://api.groq.com/**', async route => {
  if (route.request().url().endsWith('/models')) return json(route, {
    data: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'whisper-large-v3'].map(id => ({ id, active: true }))
  });
  const request = route.request().postDataJSON();
  assert.ok(!JSON.stringify(request.messages).includes('fixture-not-a-real-key'), 'API key must not appear in model messages');
  requestedModels.push(request.model);
  if (delayed) {
    await new Promise(resolve => { pendingResolve = resolve; });
    return json(route, { choices: [{ message: { content: JSON.stringify({ say: 'Arrêt ignoré ?', actions: [{ cmd: 'theme', id: 'red' }] }) } }] }).catch(() => {});
  }
  if (diagnostic && quota) return json(route, { error: { message: 'Rate limit', code: 'rate_limit' } }, 429);
  if (diagnostic && request.model === 'llama-3.3-70b-versatile')
    return json(route, { error: { message: 'The model does not exist', code: 'model_not_found' } }, 404);
  return json(route, { choices: [{ message: { content: JSON.stringify(response) } }] });
});
await context.route('https://text.pollinations.ai/**', route => json(route, { choices: [{ message: { content: 'fixture reply' } }] }));
await context.route('https://generativelanguage.googleapis.com/**', route => {
  if (route.request().url().includes(':generateContent')) {
    const payload = route.request().postDataJSON();
    assert.ok(Array.isArray(payload.contents));
    assert.ok(!JSON.stringify(payload).includes('fixture-not-a-real-key'));
    return json(route, { candidates: [{ content: { parts: [{ text: JSON.stringify(response) }] } }] });
  }
  return json(route, { models: [{ name: 'models/gemini-3.6-flash', supportedGenerationMethods: ['generateContent'] }] });
});
await context.route('https://openrouter.ai/api/v1/**', route => {
  if (route.request().url().endsWith('/models')) return json(route, { data: [
    { id: 'fixture/model:free', architecture: { output_modalities: ['text'] } },
    { id: 'fixture/paid-model', architecture: { output_modalities: ['text'] } }
  ] });
  const payload = route.request().postDataJSON();
  assert.equal(payload.models, undefined, 'No silent model fallback');
  assert.ok(!JSON.stringify(payload.messages).includes('fixture-not-a-real-key'));
  return json(route, { choices: [{ message: { content: JSON.stringify(response) } }] });
});
// No external account/session is used by these deterministic regression tests.
await context.route('https://slowzy95.github.io/proxy/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Proxy fixture</p>' }));
const open = async title => {
  await page.locator('#start-btn').click();
  await page.locator('#sm-search').fill(title);
  await page.locator('.sm-tile').filter({ hasText: title }).click();
};
const wait = async predicate => page.waitForFunction(predicate);
const send = async text => {
  await page.locator('#aiw-input').fill(text);
  await page.locator('#aiw-input').press('Enter');
  await wait(() => !aiwBusy);
};
try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  assert.equal(await page.locator('#aiwidget').isVisible(), false);
  await open('Navigateur');
  assert.match(await page.locator('#br-frames > iframe').first().getAttribute('srcdoc'), /Nouvel onglet/);
  await page.locator('#br-url').fill('Google');
  await page.locator('#br-url').press('Enter');
  assert.match(await page.locator('#br-frames > iframe').first().getAttribute('src'), /\/proxy\/\?url=/);
  const popupPromise = page.waitForEvent('popup');
  await page.locator('#br-official').click();
  const popup = await popupPromise;
  assert.match(popup.url(), /google\.com/);
  await popup.close();
  await page.locator('#br-home').click();
  await page.locator('#br-back').click();
  assert.match(await page.locator('#br-frames > iframe').first().getAttribute('src'), /\/proxy\/\?url=/);
  await page.locator('#br-fwd').click();
  assert.match(await page.locator('#br-status').textContent(), /Nouvel onglet/);
  await page.locator('#br-tab-add').click();
  assert.equal(await page.locator('[data-tab]').count(), 2);
  await page.locator('[data-close]').last().click();
  assert.equal(await page.locator('[data-tab]').count(), 1);
  console.log('PASS browser home, integrated proxy search, official-tab click, add/close tab');

  await open('Assistant IA');
  await page.locator('#ai-provider').selectOption('groq');
  await page.locator('#ai-key').fill('fixture-not-a-real-key');
  await page.locator('#ai-savekey').click();
  await page.locator('#ai-eye').click(); // revealed keys must still be excluded from DOM observation
  await page.locator('#ai-ctrl').click();
  await page.locator('#aiw-setbtn').click();
  assert.equal(await page.locator('#aiw-prov').inputValue(), 'groq');
  await page.locator('#aiw-model').selectOption('openai/gpt-oss-20b');
  assert.equal(await page.locator('#ai-model').inputValue(), 'openai/gpt-oss-20b');
  await send('Ouvre YouTube.');
  assert.equal(await page.locator('#br-yt').isVisible(), true);
  assert.match(await page.locator('#aiw-msgs').textContent(), /navigation demandée/);
  assert.doesNotMatch(await page.locator('#aiw-msgs').textContent(), /u\.trim/);
  console.log('PASS visible AI navigation, provider/model sync, trim regression');
  await page.locator('#ai-eye').click();

  response = { say: 'Commande impossible.', actions: [{ cmd: 'navigate', url: 'javascript:alert(1)' }] };
  await send('Teste une adresse invalide.');
  assert.match(await page.locator('#aiw-msgs .aiw-msg').last().textContent(), /Erreur/);
  assert.equal(await page.locator('#aiw-msgs .aiw-msg').last().locator('span').getAttribute('style'), 'color:#fca5a5');
  response = { say: 'Commande inconnue.', actions: [{ cmd: 'not_a_command' }] };
  await send('Teste une commande inconnue.');
  assert.match(await page.locator('#aiw-msgs .aiw-msg').last().textContent(), /commande inconnue/);
  response = { say: 'Pas d’action.', actions: 'bad schema' };
  await send('Teste un mauvais schéma.');
  assert.equal(await page.locator('#br-yt').isVisible(), true);
  console.log('PASS invalid URL, unknown action and malformed action list');

  delayed = true;
  await page.locator('#aiw-input').fill('Mets le thème rouge plus tard.');
  await page.locator('#aiw-input').press('Enter');
  await wait(() => aiwBusy);
  await page.locator('#aiw-power').click();
  assert.equal(await page.locator('#aiwidget').isVisible(), false);
  assert.equal(await page.evaluate(() => aiControlOn), false);
  delayed = false;
  if (pendingResolve) pendingResolve();
  await page.locator('#ai-ctrl').click();
  response = { say: 'ok', actions: [] };
  await send('Reprise.');
  assert.equal(await page.locator('body').evaluate(el => el.classList.contains('theme-red')), false);
  const oldBoost = await page.locator('body').evaluate(el => el.classList.contains('boost'));
  await page.locator('#aiw-boost').click();
  assert.equal(await page.locator('body').evaluate(el => el.classList.contains('boost')), !oldBoost);
  await page.locator('#aiw-boost').click();
  assert.equal(await page.locator('body').evaluate(el => el.classList.contains('boost')), oldBoost);
  await page.locator('#aiw-power').click();
  console.log('PASS stop pending request, restart, Boost on/off independent of AI');

  await open('Assistant IA');
  diagnostic = true;
  response = { say: 'ok', actions: [{ cmd: 'navigate', url: 'https://www.youtube.com/' }] };
  await page.locator('#ai-diagnostics').click();
  await wait(() => !aiDiagnosticsBusy);
  const results = await page.locator('#ai-diagnostics-results').textContent();
  assert.match(results, /format actions OK/);
  assert.match(results, /retiré de la liste/);
  assert.equal(await page.locator('#ai-model option[value="llama-3.3-70b-versatile"]').count(), 0);
  assert.equal(await page.locator('#ai-model option[value="whisper-large-v3"]').count(), 0);
  quota = true;
  await page.locator('#ai-diagnostics').click();
  await wait(() => !aiDiagnosticsBusy);
  assert.match(await page.locator('#ai-diagnostics-results').textContent(), /Tests restants non effectués/);
  assert.equal(await page.locator('#ai-model option').count(), 3);
  console.log('PASS catalog discovery, per-model checks, missing-model removal, quota preserves models');
  diagnostic = false; quota = false;
  await page.locator('#ai-input').fill('Bonjour');
  await page.locator('#ai-input').press('Enter');
  await wait(() => !aiChatBusy);
  assert.match(await page.locator('#ai-messages').textContent(), /say/);
  await page.locator('#ai-clear').click();
  assert.match(await page.locator('#ai-messages').textContent(), /Nouvelle conversation/);
  console.log('PASS main chat shared request path and clear conversation');
  for (const provider of ['google', 'openrouter']) {
    await page.locator('#ai-provider').selectOption(provider);
    await page.locator('#ai-key').fill('fixture-not-a-real-key');
    await page.locator('#ai-savekey').click();
    await page.locator('#ai-diagnostics').click();
    await wait(() => !aiDiagnosticsBusy);
    assert.match(await page.locator('#ai-diagnostics-results').textContent(), /format actions OK/);
    assert.equal(await page.locator('#ai-model option').count(), 1);
    await page.locator('#ai-ctrl').click();
    response = { say: 'Changement de thème.', actions: [{ cmd: 'theme', id: 'cyan' }] };
    await send('Mets le thème cyan.');
    assert.equal(await page.locator('body').evaluate(el => el.classList.contains('theme-cyan')), true);
    await page.locator('#aiw-power').click();
    response = { say: 'ok', actions: [{ cmd: 'navigate', url: 'https://www.youtube.com/' }] };
  }
  console.log('PASS Gemini/OpenRouter request schemas, model catalog filtering and visible actions (mocked APIs)');

  // Proxy timer failure is tested using a controlled app clock. No school filter
  // is bypassed and no public proxy connection is needed.
  await open('Navigateur');
  await page.clock.install();
  await page.locator('#br-url').fill('https://example.com/');
  await page.locator('#br-url').press('Enter');
  await page.clock.fastForward(20001);
  await page.clock.fastForward(20001);
  await page.clock.fastForward(20001);
  assert.match(await page.locator('#br-status').textContent(), /tentatives arrêtées/);
  await page.locator('#br-home').click();
  await page.clock.fastForward(70000);
  assert.match(await page.locator('#br-status').textContent(), /Nouvel onglet/);
  console.log('PASS proxy bounded retries and no stale redirect after home navigation');

  for (const title of ['Game Hub', 'Media Hub', 'Curseurs', 'Paramètres']) {
    await open(title);
    assert.equal(await page.locator('.window').filter({ has: page.locator('.win-header', { hasText: title }) }).count() > 0, true);
  }
  assert.deepEqual(errors, []);
  console.log('PASS all main apps open without top-level JavaScript exceptions');
  await open('Assistant IA');
  await page.locator('#ai-ctrl').click();
  await page.screenshot({ path: '/home/user/workspace/webos-desktop-qa.png' });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator('#aiw-setbtn').click();
  const bounds = await page.locator('#aiw-panel').boundingBox();
  assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 375 && bounds.y + bounds.height <= 812, JSON.stringify(bounds));
  await page.screenshot({ path: '/home/user/workspace/webos-mobile-qa.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.setViewportSize({ width: 1280, height: 480 });
  const shortBounds = await page.locator('#aiw-panel').boundingBox();
  assert.ok(shortBounds.y >= 0 && shortBounds.y + shortBounds.height <= 480, JSON.stringify(shortBounds));
  await page.setViewportSize({ width: 1440, height: 900 });
  assert.deepEqual(errors, []);
  console.log('PASS desktop/mobile/desktop widget fit; no new script exceptions');
  console.log('REQUESTED MODELS:', [...new Set(requestedModels)].join(', '));
} finally {
  await context.close();
  await browser.close();
}
