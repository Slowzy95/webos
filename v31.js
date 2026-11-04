'use strict';

/* A bounded, read-only RSS result reader, independent of the game proxy.
   No API key, login cookie or assistant context is sent to this service. */
/* v39.3 — Parse le flux RSS Bing (lecture via le proxy du WebOS, sans Jina) */
window.webosParseSearchRSS = function (text) {
  const results = [];
  const seen = new Set();
  let doc;
  try { doc = new DOMParser().parseFromString(String(text).slice(0, 300000), 'text/xml'); } catch (e) { return results; }
  if (doc.querySelector('parsererror')) return results;
  const items = doc.querySelectorAll('item');
  const clean = s => String(s || '').replace(/<[^>]+>/g, '').trim();
  for (const it of items) {
    let url;
    try {
      url = new URL((it.querySelector('link') && it.querySelector('link').textContent) || '');
      if (!/^https?:$/.test(url.protocol) || url.username || url.password || seen.has(url.href)) continue;
    } catch (e) { continue; }
    results.push({
      title: clean(it.querySelector('title') && it.querySelector('title').textContent).slice(0, 200),
      url: url.href,
      snippet: clean(it.querySelector('description') && it.querySelector('description').textContent).slice(0, 500)
    });
    seen.add(url.href);
    if (results.length === 10) break;
  }
  return results;
};

window.webosParseSearch = function (text) {
  const results = [];
  const seen = new Set();
  const content = String(text).slice(0, 300000);
  const blocks = content.split(/^### /m).slice(1);
  for (const block of blocks) {
    const heading = block.match(/^\[([^\n]+)\]\((https?:\/\/[^\s]+)\)\s*$/m);
    if (!heading) continue;
    let url;
    try {
      url = new URL(heading[2]);
      if (!/^https?:$/.test(url.protocol) || url.username || url.password || seen.has(url.href)) continue;
    } catch (e) { continue; }
    const snippet = block.slice(heading.index + heading[0].length).split(/\n\s*\n/).map(s => s.trim()).find(s => s && !/^\[https?:\/\//.test(s)) || '';
    const clean = s => s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').trim();
    results.push({ title: clean(heading[1]).slice(0, 200), url: url.href, snippet: clean(snippet).slice(0, 500) });
    seen.add(url.href);
    if (results.length === 10) break;
  }
  return results;
};

window.webosSearchHTML = function (query, {results = [], error = '', loading = false, retryURL = ''} = {}) {
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const official = 'https://www.bing.com/search?q=' + encodeURIComponent(query);
  const data = JSON.stringify({retryURL}).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(query)} · Recherche WebOS</title><style>
  .result .title,.result .snippet{overflow-wrap:anywhere;word-break:normal}.actions{flex-wrap:wrap}main,header,footer{min-width:0}
  *{box-sizing:border-box}body{margin:0;background:#f8fafc;color:#172b45;font:14px/1.6 "Segoe UI",system-ui,sans-serif}a{color:#1454b4}button,input{font:inherit}button,a,input{outline-offset:4px}button{cursor:pointer}header{padding:24px 32px 0;background:#fff;border-bottom:1px solid #dbe3ed}.brand{display:flex;align-items:center;gap:9px;font-weight:650;letter-spacing:-.02em}.mark{width:26px;height:26px;display:grid;grid-template-columns:1fr 1fr;gap:3px}.mark i{background:#0078d4}.badge{font-size:10px;color:#466283;background:#edf4fc;border-radius:4px;padding:2px 7px;letter-spacing:.02em;margin-left:auto}form{display:flex;max-width:690px;gap:10px;margin:18px 0}input{width:100%;min-width:0;padding:11px 15px;border-radius:7px;border:1px solid #aabed5;background:#fff;color:#172b45}button{border:0;border-radius:6px;background:#006cc1;color:#fff;padding:10px 15px}.tabs{display:flex;align-items:center;gap:24px;flex-wrap:wrap;font-size:12px}.active{border-bottom:3px solid #0078d4;padding:8px 0}.tabs a{margin-left:auto;text-decoration:none}main{padding:24px 32px;max-width:850px}.meta{color:#465c77;font-size:12px;margin:0 0 28px}.result{margin-bottom:26px;max-width:720px}.host{font-size:12px;color:#425c79;overflow-wrap:anywhere}.title{display:block;font-size:19px;line-height:1.35;text-decoration:none;font-weight:500;margin:3px 0 6px}.title:hover{text-decoration:underline}.snippet{margin:0;color:#354a64;font-size:13px}.actions{display:flex;gap:15px;font-size:11px;margin-top:7px}.actions a{color:#355d8c}footer{padding:16px 32px;border-top:1px solid #dbe3ed;color:#465c77;font-size:11px;max-width:850px}.state{padding:28px;background:#fff;border:1px solid #dbe3ed;border-radius:8px;max-width:690px}.state h1{font-size:20px;font-weight:550;margin:0 0 10px}.state p{color:#465c77;margin:0 0 18px}.state a{display:inline-block;margin:10px}.progress{height:3px;width:120px;margin-top:18px;background:linear-gradient(90deg,#0078d4 65%,#dceafa 65%)}@media(max-width:560px){header{padding:18px 16px 0}main{padding:20px 16px}footer{padding:16px}.badge{display:none}.tabs{gap:14px}.tabs a{font-size:11px}.title{font-size:18px}.state{padding:20px}.brand{font-size:15px}}
  </style></head><body><header><div class="brand"><span class="mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>Recherche WebOS<span class="badge">LECTURE SIMPLIFIÉE</span></div><form id="search-form"><input id="query" aria-label="Rechercher sur le Web" value="${esc(query)}" maxlength="1000"><button aria-label="Lancer la recherche">Rechercher</button></form><div class="tabs"><span class="active">Résultats Web</span><span>Bing · RSS</span><a href="${esc(official)}" target="_blank" rel="noopener noreferrer">Moteur officiel ↗</a></div></header><main>
  ${loading ? '<section class="state" role="status"><h1>Recherche en cours…</h1><p>Lecture des résultats. Cette tentative s’arrête après 18 secondes maximum ; tu peux aussi utiliser Arrêter.</p><div class="progress"></div></section>' :
    error ? `<section class="state" role="alert"><h1>Recherche momentanément indisponible</h1><p>${esc(error)}</p><button id="retry">Réessayer</button><a href="${esc(official)}" target="_blank" rel="noopener noreferrer">Ouvrir Bing dans un onglet</a></section>` :
    `<p class="meta">${results.length} résultats pour « ${esc(query)} » · Pas de page Google ou Startpage intégrée.</p>${results.map(r => `<article class="result"><div class="host">${esc(new URL(r.url).hostname)}</div><a class="title" data-inapp href="${esc(r.url)}">${esc(r.title)}</a><p class="snippet">${esc(r.snippet)}</p><div class="actions"><a data-inapp href="${esc(r.url)}">Ouvrir dans WebOS</a><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Onglet officiel ↗</a></div></article>`).join('')}`}
  </main><footer>Résultats fournis par le flux public Bing, lu via Jina Reader. Ta requête est transmise à ces deux services, hors proxy de jeux. Aucun compte ni clé API n’est envoyé. Résultats simplifiés, disponibilité et pertinence variables ; les sites peuvent toujours demander leur propre vérification.</footer>
  <script>const config=${data};const nav=u=>parent.postMessage({wosNav:u},'*');document.querySelector('#search-form').onsubmit=e=>{e.preventDefault();const q=document.querySelector('#query').value.trim();if(q)nav('https://www.bing.com/search?wos_reader=1&q='+encodeURIComponent(q))};document.querySelectorAll('a[data-inapp]').forEach(a=>a.onclick=e=>{e.preventDefault();nav(a.href)});const retry=document.querySelector('#retry');if(retry)retry.onclick=()=>nav(config.retryURL);</script></body></html>`;
};
