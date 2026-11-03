import { chromium } from 'playwright';
import assert from 'node:assert/strict';
/* Tests v36 : vrais fonds d'écran et icônes par système, bureau macOS visible, curseurs parasites filtrés. */
const base = process.env.WEBOS_TEST_URL || 'http://127.0.0.1:3000/';
const exe = process.env.CHROME_PATH;
const browser = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe, args: ['--no-sandbox'] } : {}) });
const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(base); await page.waitForTimeout(2000);
for (const sk of ['ubuntu', 'fedora', 'mint', 'kali', 'kde', 'chromeos', 'macos']) {
  await page.evaluate(s => applySkin(s), sk); await page.waitForTimeout(1800);
  const r = await page.evaluate(async () => {
    const bg = getComputedStyle(document.getElementById('wallpaper')).backgroundImage;
    const m = bg.match(/url\("?([^")]+)"?\)/);
    const ok = m ? (await fetch(m[1])).ok : false;
    const imgs = [...document.querySelectorAll('#tb-pinned img, #desk-icons img')].map(i => i.getAttribute('src'));
    const icons = [...document.querySelectorAll('.desk-icon:not([hidden])')].map(e => { const b = e.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth + 1; });
    return { bg: !!m, ok, imgs: imgs.filter(s => s && s.startsWith('icons/os/')).length, allVisible: icons.every(Boolean) };
  });
  assert.ok(r.bg && r.ok, sk + ' : fond image réel');
  assert.ok(r.imgs >= 4, sk + ' : icônes réelles');
  assert.ok(r.allVisible, sk + ' : icônes du bureau visibles');
}
assert.deepEqual(errors, [], errors.join(' | '));
await browser.close();
console.log('v36 OK');
