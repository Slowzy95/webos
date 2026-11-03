import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const url = process.env.WEBOS_TEST_URL || 'http://127.0.0.1:3000/';
const browser = await chromium.launch({headless:true,channel:'chromium'});
const context = await browser.newContext({viewport:{width:1440,height:900}});
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const fixture = 'Title: Bing: fixture\n\nMarkdown Content:\n### [Premier résultat <script>alert(1)</script>](https://example.org/first)\n\nUn résultat lisible et sûr.\n\n[https://example.org/first](https://example.org/first)\n\n### [Second résultat](https://example.com/second)\n\nUn autre site.';
let outcome = 'success', count = 0, release = null;
await context.route('https://r.jina.ai/**', async route => {
  count++;
  assert.equal(route.request().headers().authorization,undefined);
  assert.equal(route.request().headers().cookie,undefined);
  if (outcome === 'delay') await new Promise(resolve => {release=resolve;});
  if (outcome === 'rate') return route.fulfill({status:429,body:'Rate limited'});
  if (outcome === 'empty') return route.fulfill({body:'An upstream page with no search results.'});
  return route.fulfill({contentType:'text/plain',body:fixture}).catch(()=>{});
});
await context.route('https://slowzy95.github.io/proxy/**', async route => {
  const u = new URL(route.request().url()).searchParams.get('url');
  return route.fulfill({contentType:'text/html',body:`<h1>Destination visible</h1><p>${u}</p>`});
});
const home = () => page.frameLocator('#br-frames>iframe:visible');
const search = async text => {
  await page.locator('#br-url').fill(text);
  await page.locator('#br-url').press('Enter');
};
const open = async name => {
  await page.locator('#start-btn').click();
  await page.locator('#sm-search').fill(name);
  await page.locator('#sm-apps .sm-tile:visible').click();
};
const closeAll = async () => {
  while(await page.locator('.window:not(.win-close)').count()) await page.locator('.window:not(.win-close) [data-act="close"]').last().click();
  await page.waitForFunction(()=>!document.querySelector('.window'));
};
try {
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await open('Navigateur');
  await search('une recherche normale');
  await home().locator('.result').first().waitFor();
  assert.equal(await home().locator('.result').count(),2);
  assert.equal(await home().locator('script').count(),1);
  assert.match(await home().locator('.title').first().textContent(),/<script>/);
  assert.equal(await page.locator('#br-stop').isVisible(),false);
  assert.match(await page.locator('#br-status').textContent(),/2 résultats/);
  const popupEvent = page.waitForEvent('popup');
  await home().getByRole('link',{name:'Onglet officiel ↗',exact:true}).first().click();
  const popup=await popupEvent;
  await popup.waitForURL('https://example.org/first');
  await popup.close();
  await home().locator('.title').first().click();
  await home().getByRole('heading',{name:'Destination visible'}).waitFor();
  await page.locator('#br-back').click();
  await home().locator('.result').first().waitFor();
  await page.locator('#br-fwd').click();
  await home().getByRole('heading',{name:'Destination visible'}).waitFor();
  console.log('PASS default reader, escaped output, in-app result, official popup, history');

  await search('Google');
  await home().getByRole('textbox',{name:'Rechercher sur le Web'}).waitFor();
  assert.match(await page.locator('#br-status').textContent(),/Recherche simplifiée/);
  outcome='rate';
  await search('requete limitee');
  await home().getByRole('alert').waitFor();
  assert.match(await home().getByRole('alert').textContent(),/limite les recherches/);
  const beforeRetry=count;
  outcome='success';
  await home().getByRole('button',{name:'Réessayer',exact:true}).click();
  await home().locator('.result').first().waitFor();
  assert.equal(count,beforeRetry+1);
  outcome='empty';
  await search('reponse vide');
  await home().getByRole('alert').waitFor();
  assert.match(await home().getByRole('alert').textContent(),/Aucun résultat lisible/);
  console.log('PASS Google shortcut alternative, rate-limit error, manual retry and empty response');

  outcome='delay';
  await search('ne jamais remplacer accueil');
  await page.locator('#br-stop').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('#br-status').textContent.includes('en cours'));
  await page.locator('#br-home').click();
  if(release)release();
  await home().getByRole('heading',{name:'Qu’est-ce qu’on explore ?'}).waitFor();
  await search('arreter recherche');
  await page.locator('#br-stop').waitFor({state:'visible'});
  await page.locator('#br-stop').click();
  if(release)release();
  await home().getByRole('heading',{name:'Chargement arrêté'}).waitFor();
  await page.clock.install();
  await search('requete trop lente');
  await page.locator('#br-stop').waitFor({state:'visible'});
  await page.clock.fastForward(18100);
  await home().getByRole('alert').waitFor();
  assert.match(await home().getByRole('alert').textContent(),/délai de 18 secondes/);
  if(release)release();
  await page.clock.resume();
  outcome='success';
  await search('https://www.google.com/search?q=requete-test');
  await page.locator('#br-reader').click();
  await home().locator('.result').first().waitFor();
  assert.match(await home().getByRole('textbox',{name:'Rechercher sur le Web'}).inputValue(),/requete-test/);
  console.log('PASS stop, stale response isolation, 18s timeout and alternate reader preserving query');

  await closeAll();
  await open('Paramètres');
  const walls={win11:'original-win11.webp',win10:'original-win10.webp',win7:'original-win7.webp',winxp:'original-winxp.webp'};
  for(const skin of ['win11','win10','win7','winxp','win98']){
    await page.locator(`[data-skin="${skin}"]`).click();
    assert.equal(await page.locator('body').getAttribute('data-os'),skin);
    if(walls[skin]){
      const wall=await page.locator('#wallpaper').getAttribute('style');
      assert.match(wall,new RegExp(walls[skin]));
      assert.ok(await page.evaluate(async source=>{const image=new Image();image.src=source;try{await image.decode();return image.naturalWidth>=800}catch{return false}},'walls/'+walls[skin]));
    }
    assert.match(await page.locator('#desk-icons [data-icon-id="settings"] img').getAttribute('src'),new RegExp('/'+skin+'/'));
    assert.match(await page.locator('.window .win-header img').first().getAttribute('src'),new RegExp('/'+skin+'/'));
    await page.locator('#start-btn').click();
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('#start-menu')).opacity==='1');
    await page.screenshot({path:`/home/user/workspace/webos-v31-theme-${skin}.png`});
    const rect=await page.locator('#start-menu').boundingBox();
    assert.ok(rect.x>=0&&rect.x+rect.width<=1440);
    await page.locator('#start-btn').click();
  }
  await page.reload({waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('body').getAttribute('data-os'),'win98');
  await open('Paramètres');
  await page.locator('[data-skin="win11"]').click();
  await closeAll();
  await open('Navigateur');
  await page.setViewportSize({width:375,height:812});
  await page.waitForFunction(()=>document.querySelector('.window').getBoundingClientRect().right<=375);
  await search('recherche mobile');
  await home().locator('.result').first().waitFor();
  await page.screenshot({path:'/home/user/workspace/webos-v31-mobile-reader.png'});
  assert.equal(await home().locator('body').evaluate(el=>el.scrollWidth>innerWidth),false);
  await page.locator('#br-engine').click();
  await page.locator('[data-eng="webos"]').waitFor({state:'visible'});
  await page.locator('[data-eng="webos"]').click();
  await page.setViewportSize({width:1440,height:900});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  console.log('PASS five Windows skins, original assets, titlebar/desktop icons, persistence, mobile reader and engine menu');
} catch(e) {
  console.log('DEBUG',await page.locator('#br-status').textContent(),await page.locator('#br-url').inputValue(),count);
  console.log((await page.locator('#br-frames>iframe:visible').getAttribute('srcdoc'))?.slice(-2000));
  throw e;
} finally {await browser.close();}
