'use strict';
/* Small, auditable helpers. Imported cursor HTML is NEVER inserted into DOM. */
window.webos32 = {
  imageURL(value) {
    const s = String(value).trim();
    if (!s || s.length > 700000 || /["'\\\s<>]/.test(s)) return '';
    if (/^data:image\/(?:png|gif|webp|x-icon|vnd\.microsoft\.icon);base64,[a-zA-Z0-9+/=]+$/.test(s)) return s;
    try { const u = new URL(s); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch (e) { return ''; }
  },
  parseCursor(code) {
    if (typeof code !== 'string' || code.length > 1800000) throw new Error('Code trop volumineux (maximum 1,8 Mo).');
    const frames = [];
    const re = /cursor\s*:\s*url\(\s*(?:"([^"]+)"|'([^']+)'|([^)\s]+))\s*\)\s*(?:(\d+)\s+(\d+))?\s*(?:,\s*(?:auto|default|pointer))?\s*;?/gi;
    for (const m of code.matchAll(re)) {
      const url = this.imageURL(m[1] || m[2] || m[3]);
      if (!url) throw new Error('Image refusée : utilise une image HTTPS ou PNG/GIF/WebP en base64.');
      const x = Number(m[4] || 0), y = Number(m[5] || 0);
      if (x > 127 || y > 127) throw new Error('Point du curseur hors limite (0 à 127).');
      const before = code.slice(Math.max(0, m.index - 180), m.index);
      const percentages = before.match(/(?:\d+(?:\.\d+)?%[\s,]*)+\{\s*$/)?.[0];
      const times = percentages ? [...percentages.matchAll(/(\d+(?:\.\d+)?)%/g)].map(v => Number(v[1])) : [];
      frames.push({ url, x, y, times: times.length ? times : [0] });
      if (frames.length > 64) throw new Error('Maximum 64 étapes par curseur.');
    }
    if (!frames.length) throw new Error('Aucune règle cursor: url(...) trouvée dans ce code.');
    const duration = code.match(/animation(?:-duration)?\s*:[^;{}]*?(\d+(?:\.\d+)?)\s*(ms|s)\b/i);
    const ms = duration ? Number(duration[1]) * (duration[2].toLowerCase() === 's' ? 1000 : 1) : 1000;
    return { frames, ms: Math.max(100, Math.min(60000, ms)) };
  },
  applyCursor(config, style) {
    if (!config || !Array.isArray(config.frames) || !config.frames.length || config.frames.length > 64) throw new Error('Curseur enregistré invalide.');
    const frames = config.frames.map(f => {
      const url = this.imageURL(f.url);
      if (!url || !Number.isInteger(f.x) || !Number.isInteger(f.y) || f.x < 0 || f.y < 0 || f.x > 127 || f.y > 127) throw new Error('Image ou point invalide.');
      const times = Array.isArray(f.times) ? f.times.filter(t => Number.isFinite(t) && t >= 0 && t <= 100).slice(0, 64) : [0];
      return { url, x: f.x, y: f.y, times: times.length ? times : [0] };
    });
    const value = f => `url("${f.url}") ${f.x} ${f.y}, auto`;
    const selector = 'body, .window, .win-header, #taskbar, #desk-icons, a, button, .desk-icon, .chip, .sm-tile, .wbtn, select';
    if (frames.length === 1) style.textContent = `${selector}{cursor:${value(frames[0])}!important}input,textarea{cursor:text!important}`;
    else {
      const rules = frames.map(f => f.times.map(t => t + '%').join(',') + '{--wos32cursor:' + value(f) + '}').join('');
      const ms = Math.max(100, Math.min(60000, Number(config.ms) || 1000));
      style.textContent = `@keyframes wos32cursor{${rules}}html{animation:wos32cursor ${ms}ms steps(1,end) infinite}${selector}{cursor:var(--wos32cursor,${value(frames[0])})!important}input,textarea{cursor:text!important}`;
    }
  },
  cursorPanel(body, target) {
    if (body.querySelector('#cur-code')) return;
    const section = document.createElement('section');
    section.className = 'cursor-code-panel';
    section.innerHTML = '<h3>Importer un code de curseur</h3><p>Colle ton code HTML/CSS, comme celui de RW Designer. Seules les images, les points et les étapes du curseur sont extraits. Aucun script ni style étranger n’est exécuté.</p><label for="cur-code">Code HTML / CSS</label><textarea id="cur-code" class="field" rows="6" spellcheck="false" placeholder="&lt;style&gt; body { cursor: url(...) 0 0, auto; } &lt;/style&gt;"></textarea><div class="cursor-code-actions"><button class="btn btn-blue" id="cur-code-apply">Vérifier et appliquer</button><button class="btn btn-ghost" id="cur-code-reset">Curseur par défaut</button></div><p id="cur-code-status" role="status">Compatible avec les images intégrées en base64 et les animations par étapes. Les images trop grandes peuvent être refusées par le navigateur.</p><div id="cur-code-preview">Zone d’aperçu : déplace la souris ici après application.</div>';
    (target || body.firstElementChild).prepend(section);
    const status = section.querySelector('#cur-code-status');
    section.querySelector('#cur-code-apply').onclick = () => {
      try {
        const config = this.parseCursor(section.querySelector('#cur-code').value);
        let style = document.getElementById('cursor-style');
        if (!style) { style = document.createElement('style'); style.id = 'cursor-style'; document.head.append(style); }
        this.applyCursor(config, style);
        LS.setJSON('cursor_code', config); LS.set('cursor', 'code');
        status.textContent = `Curseur appliqué et enregistré : ${config.frames.length} étape(s), ${Math.round(config.ms)} ms.`;
        status.dataset.state = 'ok';
      } catch (e) { status.textContent = e.message; status.dataset.state = 'error'; }
    };
    section.querySelector('#cur-code-reset').onclick = () => {
      setCursorTheme('default'); status.textContent = 'Curseur par défaut restauré.'; delete status.dataset.state;
    };
  },
  clampWindow(el, desk) {
    if (desk.width < 720) return;
    // offsetWidth/Height can still contain the interpolated maximize size.
    const logicalWidth = parseFloat(el.style.width) || el.offsetWidth;
    const logicalHeight = parseFloat(el.style.height) || el.offsetHeight;
    const width = Math.min(logicalWidth, desk.width);
    const height = Math.min(logicalHeight, desk.height);
    if (logicalWidth > desk.width) el.style.width = width + 'px';
    if (logicalHeight > desk.height) el.style.height = height + 'px';
    const left = parseFloat(el.style.left) || 0, top = parseFloat(el.style.top) || 0;
    el.style.left = Math.max(0, Math.min(left, desk.width - width)) + 'px';
    el.style.top = Math.max(0, Math.min(top, desk.height - height)) + 'px';
  },
  settings(body) {
    const content = body.firstElementChild;
    if (!content || content.querySelector('.settings-nav32')) return;
    const groups = [
      ['appearance', 'Apparence', 'fa-palette'], ['cursor', 'Curseurs', 'fa-arrow-pointer'],
      ['ai', 'Intelligence artificielle', 'fa-robot'], ['security', 'Navigation et sécurité', 'fa-shield-halved'],
      ['apps', 'Applications', 'fa-grip'], ['system', 'Sauvegarde et système', 'fa-sliders'],
      ['all', 'Tout afficher', 'fa-list']
    ];
    const nav = document.createElement('nav'); nav.className = 'settings-nav32'; nav.setAttribute('aria-label', 'Catégories des paramètres');
    const search = document.createElement('input'); search.className = 'field'; search.placeholder = 'Rechercher un réglage…'; search.setAttribute('aria-label', 'Rechercher un réglage');
    nav.append(search);
    groups.forEach(([id, label, icon]) => {
      const b = document.createElement('button'); b.className = 'settings-category32'; b.dataset.category = id; b.type = 'button';
      b.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i><span>${label}</span>`;
      b.onclick = () => { category = id; search.value = ''; LS.set('settings_category_v32', id); update(); content.scrollTop = 0; };
      nav.append(b);
    });
    const sections = [...content.children].filter(el => el.tagName === 'SECTION');
    const categorize = el => {
      if (!el.querySelector('h3')) return 'system';
      if (el.querySelector('#st-cursors')) return 'cursor';
      if (el.querySelector('#st-keys')) return 'ai';
      if (el.querySelector('#st-title, #st-panic-url')) return 'security';
      if (el.querySelector('#st-app-list, #st-app-add')) return 'apps';
      if (el.querySelector('#st-export, #st-boost')) return 'system';
      return 'appearance';
    };
    sections.forEach(el => { el.dataset.settingsCategory = categorize(el); });
    const cursor = sections.find(el => el.dataset.settingsCategory === 'cursor');
    if (cursor) this.cursorPanel(body, cursor);
    const ai = sections.find(el => el.dataset.settingsCategory === 'ai');
    if (ai) {
      const p = ai.querySelector('p');
      if (p) p.textContent = 'Pollinations est disponible sans clé, avec une requête toutes les 45 secondes. Tes autres clés restent enregistrées uniquement sur cet appareil. Le diagnostic dans l’app IA utilise ces clés localement et consomme le quota du fournisseur.';
    }
    content.prepend(nav); content.classList.add('settings-layout32');
    const empty = document.createElement('p'); empty.className = 'settings-empty32'; empty.textContent = 'Aucun réglage trouvé. Essaie un autre mot.'; content.append(empty);
    let category = LS.get('settings_category_v32', 'appearance');
    if (!groups.some(g => g[0] === category)) category = 'appearance';
    const update = () => {
      const q = search.value.trim().toLocaleLowerCase('fr');
      let visible = 0;
      sections.forEach(el => {
        const show = (q || category === 'all' || el.dataset.settingsCategory === category) && (!q || el.textContent.toLocaleLowerCase('fr').includes(q));
        el.hidden = !show; if (show) visible++;
      });
      nav.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(!q && b.dataset.category === category)));
      empty.hidden = visible > 0;
    };
    search.oninput = update;
    // v30 adds storage controls asynchronously; keep its original handlers.
    const adoptStorage = () => {
      const storage = content.querySelector('#st-storage-v30');
      if (storage && !storage.dataset.settingsCategory) { storage.dataset.settingsCategory = 'system'; nav.after(storage); sections.push(storage); update(); }
    };
    const observer = new MutationObserver(adoptStorage);
    observer.observe(content, { childList: true }); adoptStorage(); update();
    body.closest('.window')?.addEventListener('webos:cleanup', () => observer.disconnect(), { once: true });
  },
  async selectResult(action, signal) {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      if (signal?.aborted) throw new Error('Action annulée');
      if (!browserAPI || !windows.has('browser')) throw new Error('Le navigateur est fermé');
      const isWeb = action.cmd === 'open_result';
      const doc = isWeb ? browserAPI.readerDocument() : document;
      const selector = isWeb ? '.result a.title[data-inapp]' : '#yt-results button[data-yt]';
      const list = doc ? [...doc.querySelectorAll(selector)].filter(el => el.getClientRects().length) : [];
      if (list.length) {
        const index = action.index == null ? 1 : Number(action.index);
        const title = String(action.title || '').trim().toLocaleLowerCase('fr');
        const el = title ? list.find(x => (x.dataset.title || x.textContent).toLocaleLowerCase('fr').includes(title)) : list[index - 1];
        if (!el) throw new Error('Résultat ou vidéo introuvable parmi les éléments visibles');
        if (isWeb) browserAPI.navigate(el.href); else el.click();
        return;
      }
      if (doc?.querySelector('[role="alert"]')) throw new Error('Le service de recherche ne fournit pas de résultats');
      await new Promise(resolve => {
        const finish = () => { clearTimeout(timer); signal?.removeEventListener('abort', finish); resolve(); };
        const timer = setTimeout(finish, 100);
        signal?.addEventListener('abort', finish, { once: true });
      });
    }
    throw new Error('Aucun résultat accessible après 20 secondes. Les sites externes intégrés ne sont pas pilotables.');
  }
};
