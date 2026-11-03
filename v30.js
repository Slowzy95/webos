'use strict';

/* v30 desktop integrations. Existing preferences and API-key storage stay intact. */
(() => {
  const LOCAL_GAMES = {
    snake: { title: 'Snake', icon: 'fa-worm', color: '#42d3a0', mount: mountSnake },
    '2048': { title: '2048', icon: 'fa-border-all', color: '#ffb45c', mount: mount2048 },
    demineur: { title: 'Démineur', icon: 'fa-bomb', color: '#a8b8cd', mount: mountDemineur },
    pong: { title: 'Pong', icon: 'fa-table-tennis-paddle-ball', color: '#69c7ff', mount: mountPong },
    memory: { title: 'Memory', icon: 'fa-brain', color: '#f995cc', mount: mountMemory },
    morpion: { title: 'Morpion', icon: 'fa-hashtag', color: '#b9a3ff', mount: mountMorpion }
  };
  const HOME_LINKS = [
    { title: 'Google', url: 'https://www.google.com', color: '#70a8ff' },
    { title: 'YouTube', url: 'https://www.youtube.com', color: '#ff6b78' },
    { title: 'Poki', url: 'https://poki.com', color: '#8db5ff' },
    { title: 'CrazyGames', url: 'https://www.crazygames.com', color: '#ae9aff' },
    { title: 'TikTok', url: 'https://www.tiktok.com', color: '#67e3df' },
    { title: 'Discord', url: 'https://discord.com', color: '#a8acff' },
    { title: 'Wikipédia', url: 'https://fr.wikipedia.org', color: '#d8e2f2' },
    { title: 'Spotify', url: 'https://open.spotify.com', color: '#71d992' }
  ];
  const raw = LS.getJSON('shortcuts_v30', []);
  let shortcuts = [...new Map((Array.isArray(raw) ? raw : []).map(normalizeShortcut).filter(Boolean).map(s => [s.key, s])).values()].slice(0, 100);
  const hiddenRaw = LS.getJSON('desktop_hidden', []);
  const hiddenApps = new Set(Array.isArray(hiddenRaw) ? hiddenRaw.filter(id => APPS[id]) : []);
  const naturalPositions = new Map();
  const menu = document.createElement('div');
  menu.id = 'shortcut-menu';
  menu.hidden = true;
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-label', 'Options du raccourci');
  document.body.append(menu);
  let menuTrigger = null;

  function normalizeShortcut(data) {
    if (!data || typeof data !== 'object') return null;
    const title = typeof data.title === 'string' ? data.title.slice(0, 80) : '';
    if (typeof data.app === 'string' && APPS[data.app]) return { app: data.app, title: APPS[data.app].title, key: 'app:' + data.app };
    if (typeof data.game === 'string' && LOCAL_GAMES[data.game]) {
      const g = LOCAL_GAMES[data.game];
      return { game: data.game, title: g.title, key: 'game:' + data.game, icon: g.icon, color: g.color, desktop: !!data.desktop, taskbar: !!data.taskbar };
    }
    if (typeof data.url !== 'string') return null;
    try {
      const u = new URL(data.url);
      if (!/^https?:$/.test(u.protocol) || u.username || u.password) return null;
      if (/(^|\.)(accounts\.google\.com|login\.microsoftonline\.com|login\.live\.com)$/.test(u.hostname)) return null;
      if ([...u.searchParams.keys()].some(k => /token|password|secret|api.?key|^code$/i.test(k)) || /access_token/i.test(u.hash)) return null;
      if (/\/(oauth|authorize|callback|signin|login)(\/|$)/i.test(u.pathname)) return null;
      const key = 'url:' + u.href;
      return { url: u.href, title: title || u.hostname.replace(/^www\./, ''), key, desktop: !!data.desktop, taskbar: !!data.taskbar, official: !!data.official };
    } catch (e) { return null; }
  }
  function shortcutId(s) {
    // Stable across reloads; full keys remain the authority for deduplication.
    let hash = 2166136261;
    for (const char of s.key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return 'pin_' + (hash >>> 0).toString(36);
  }
  function iconHTML(s, size = 32) {
    if (s.app) return appIconHtml(APPS[s.app], s.app);
    if (s.game) return `<span class="shortcut-game-icon" style="--pin-color:${s.color}"><i class="fa-solid ${s.icon}"></i></span>`;
    const host = new URL(s.url).hostname;
    return `<span class="shortcut-site-icon"><span aria-hidden="true">${escHtml(s.title.charAt(0).toUpperCase())}</span><img src="${escHtml(brandImg(host, size))}" alt="" loading="lazy" onerror="this.remove()"></span>`;
  }
  function currentState(s) {
    if (s.app) return { desktop: !hiddenApps.has(s.app), taskbar: PINNED.includes(s.app) };
    const existing = shortcuts.find(x => x.key === s.key);
    const legacy = s.url && CUSTOM_APPS.find(x => { try { return new URL(x.url).href === s.url; } catch (e) { return false; } });
    return { desktop: !!existing?.desktop || !!legacy, taskbar: !!existing?.taskbar, official: !!existing?.official };
  }
  function persist() {
    LS.setJSON('shortcuts_v30', shortcuts);
    LS.setJSON('taskbarpins', PINNED);
    LS.setJSON('desktop_hidden', [...hiddenApps]);
    renderDesktopShortcuts();
    renderTaskbar();
    renderStartShortcuts();
    refreshButtons();
  }
  function togglePin(s, destination) {
    const state = currentState(s);
    if (s.app) {
      if (destination === 'desktop') state.desktop ? hiddenApps.add(s.app) : hiddenApps.delete(s.app);
      else if (state.taskbar) PINNED.splice(PINNED.indexOf(s.app), 1);
      else PINNED.push(s.app);
    } else {
      let item = shortcuts.find(x => x.key === s.key);
      if (!item) { item = { ...s, desktop: state.desktop, taskbar: state.taskbar }; shortcuts.push(item); }
      item[destination] = !state[destination];
      if (destination === 'desktop' && state.desktop && s.url) {
        CUSTOM_APPS = CUSTOM_APPS.filter(x => { try { return new URL(x.url).href !== s.url; } catch (e) { return true; } });
        LS.setJSON('customapps', CUSTOM_APPS);
        renderCustomIcons();
      }
      shortcuts = shortcuts.filter(x => x.desktop || x.taskbar || x.official);
    }
    persist();
    toast(state[destination] ? 'Raccourci retiré' : destination === 'desktop' ? 'Raccourci ajouté au bureau' : 'Raccourci épinglé à la barre des tâches', 'fa-thumbtack', 'text-sky-400');
  }
  function launch(s) {
    if (s.url && shortcuts.find(x => x.key === s.key)?.official) {
      window.open(s.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (s.app) { openApp(s.app); return; }
    if (s.game) {
      openApp('games');
      const rec = windows.get('games');
      if (rec?.cleanup) { try { rec.cleanup(); } catch (e) {} rec.cleanup = null; }
      rec.gameKeys = null;
      LOCAL_GAMES[s.game].mount(rec.el.querySelector('.win-body'), rec);
      return;
    }
    openInApp(s.url);
  }
  function showMenu(data, trigger, point) {
    const s = normalizeShortcut(data);
    if (!s) { toast('Cette adresse de connexion ne peut pas être enregistrée en raccourci', 'fa-lock', 'text-amber-400'); return; }
    const state = currentState(s);
    menuTrigger = trigger || null;
    menu.innerHTML = `<header>${iconHTML(s)}<span><strong>${escHtml(s.title)}</strong><small>Ton espace, à ta façon</small></span><button aria-label="Fermer" data-pin-close>×</button></header>
      <button data-destination="desktop"><i class="fa-solid fa-desktop"></i><span>${state.desktop ? 'Retirer du bureau' : 'Ajouter au bureau'}</span><i class="fa-solid ${state.desktop ? 'fa-check' : 'fa-plus'}"></i></button>
      <button data-destination="taskbar"><i class="fa-solid fa-thumbtack"></i><span>${state.taskbar ? 'Détacher de la barre des tâches' : 'Épingler à la barre des tâches'}</span><i class="fa-solid ${state.taskbar ? 'fa-check' : 'fa-plus'}"></i></button>
      ${s.url ? `<div class="shortcut-menu-rule"></div><button data-account-mode><i class="fa-solid fa-user-shield"></i><span>Mes raccourcis en onglet officiel<small style="display:block;color:#91a5bf;font-size:10px;margin-top:3px">Connexion gérée par ton navigateur</small></span><i class="fa-solid ${state.official ? 'fa-check' : 'fa-plus'}"></i></button><button data-pin-official><i class="fa-solid fa-arrow-up-right-from-square"></i><span>Ouvrir le site officiel maintenant</span></button>` : ''}`;
    menu.hidden = false;
    const r = trigger?.getBoundingClientRect() || { left: point?.x ?? innerWidth / 2, bottom: point?.y ?? innerHeight / 2 };
    menu.style.left = Math.max(8, Math.min(r.left, innerWidth - menu.offsetWidth - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(r.bottom + 6, innerHeight - menu.offsetHeight - 66)) + 'px';
    menu.querySelector('[data-pin-close]').onclick = () => closeMenu(true);
    menu.querySelectorAll('[data-destination]').forEach(b => b.onclick = () => { togglePin(s, b.dataset.destination); closeMenu(true); });
    const official = menu.querySelector('[data-pin-official]');
    if (official) official.onclick = () => { window.open(s.url, '_blank', 'noopener,noreferrer'); closeMenu(true); };
    const accountMode = menu.querySelector('[data-account-mode]');
    if (accountMode) accountMode.onclick = () => {
      let item = shortcuts.find(x => x.key === s.key);
      if (!item) { item = { ...s, desktop: state.desktop, taskbar: state.taskbar }; shortcuts.push(item); }
      item.official = !state.official;
      persist();
      closeMenu(true);
      toast(item.official ? 'Ce raccourci ouvrira le site officiel pour ton compte' : 'Ce raccourci ouvrira le navigateur intégré', 'fa-user-shield', 'text-sky-400');
    };
    menu.querySelector('[data-destination]').focus({ preventScroll: true });
  }
  function closeMenu(restoreFocus = false) {
    if (menu.hidden) return false;
    menu.hidden = true;
    if (restoreFocus && menuTrigger?.isConnected) menuTrigger.focus({ preventScroll: true });
    return true;
  }
  window.closeShortcutMenu = () => closeMenu(true);
  window.addEventListener('resize', () => closeMenu());
  document.addEventListener('pointerdown', e => { if (!menu.contains(e.target) && !e.target.closest('.shortcut-add')) closeMenu(); });
  menu.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const buttons = [...menu.querySelectorAll('button')];
    const index = buttons.indexOf(document.activeElement);
    e.preventDefault();
    buttons[(index + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
  });

  function createPinButton(s) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'shortcut-add';
    b.title = 'Ajouter ' + s.title + ' au bureau ou à la barre des tâches';
    b.setAttribute('aria-label', b.title);
    b.setAttribute('aria-haspopup', 'dialog');
    b.dataset.shortcutKey = s.key;
    b.innerHTML = '<i class="fa-solid fa-plus"></i>';
    b.onclick = e => { e.preventDefault(); e.stopPropagation(); showMenu(s, b); };
    return b;
  }
  function serviceDescriptor(url, fallback) {
    const all = [...HOME_LINKS, ...GAME_PLATFORMS, ...MEDIA_LINKS, ...FREE_STREAMING];
    const match = all.find(p => { try { return new URL(p.url).href === new URL(url).href; } catch (e) { return false; } });
    return normalizeShortcut({ url, title: match?.name || match?.title || fallback });
  }
  function decorate(root) {
    root.querySelectorAll('[data-inapp], [data-game], .chip[data-url]').forEach(el => {
      if (el.dataset.pinDecorated) return;
      el.dataset.pinDecorated = '1';
      const s = el.dataset.game ? normalizeShortcut({ game: el.dataset.game }) : serviceDescriptor(el.dataset.inapp || el.dataset.url, el.textContent.trim());
      if (!s) return;
      const button = createPinButton(s);
      if (el.matches('.chip')) {
        const group = document.createElement('span');
        group.className = 'browser-quick-link';
        el.before(group);
        group.append(el, button);
      } else {
        const card = el.closest('.glass-card');
        if (card) { card.classList.add('has-shortcut'); button.classList.add('card-pin'); card.append(button); }
        else el.after(button);
      }
    });
    const browserBar = root.querySelector('#br-newtab');
    if (browserBar && !root.querySelector('#br-pin-current')) {
      const b = createPinButton({ key: 'current', title: 'la page actuelle' });
      b.id = 'br-pin-current';
      b.onclick = e => {
        e.stopPropagation();
        const url = browserAPI?.currentUrl();
        if (!url || url === BROWSER_HOME) { toast('Ouvre un site pour créer son raccourci', 'fa-globe', 'text-sky-400'); return; }
        showMenu(serviceDescriptor(url), b);
      };
      browserBar.before(b);
    }
    const ytHeader = root.querySelector('#yt-exit');
    if (ytHeader && !root.querySelector('#yt-pin-app')) {
      const b = createPinButton(normalizeShortcut(HOME_LINKS[1]));
      b.id = 'yt-pin-app';
      ytHeader.before(b);
    }
    const settings = root.querySelector('#st-export');
    if (settings && !root.querySelector('#st-storage-v30')) buildStorageSettings(settings.closest('.win-body'));
    refreshButtons();
  }
  function refreshButtons() {
    document.querySelectorAll('.shortcut-add[data-shortcut-key]').forEach(b => {
      const s = shortcuts.find(x => x.key === b.dataset.shortcutKey);
      const on = !!s && (s.desktop || s.taskbar);
      if (b.dataset.pinState === String(on)) return;
      b.dataset.pinState = String(on);
      b.classList.toggle('is-pinned', on);
      b.innerHTML = `<i class="fa-solid ${on ? 'fa-check' : 'fa-plus'}"></i>`;
    });
  }
  function renderDesktopShortcuts() {
    document.querySelectorAll('#desk-icons .desk-icon[data-v30-shortcut]').forEach(el => el.remove());
    document.querySelectorAll('#desk-icons .desk-icon').forEach(el => {
      if (APPS[el.dataset.iconId]) el.hidden = hiddenApps.has(el.dataset.iconId);
    });
    const positions = LS.getJSON('iconpos', {});
    shortcuts.filter(s => s.desktop && !s.app).forEach(s => {
      if (s.url && CUSTOM_APPS.some(x => { try { return new URL(x.url).href === s.url; } catch (e) { return false; } })) return;
      const id = shortcutId(s);
      const el = addDeskIcon(id, iconHTML(s, 128), escHtml(s.title), () => launch(s));
      // addDeskIcon deliberately has no return value in older versions.
      const icon = el || [...di.querySelectorAll('.desk-icon')].find(x => x.dataset.iconId === id);
      if (!icon) return;
      icon.dataset.v30Shortcut = s.key;
      icon.title = s.title + ' · Clic droit pour les options';
      icon.tabIndex = 0;
      icon.setAttribute('role', 'button');
      icon.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); launch(s); } });
      if (!positions[id]) {
        const cell = nearestFreeCell(0, 0, occupiedCells(id));
        icon.style.position = 'absolute';
        icon.style.left = cell.x * GRID_X + 'px';
        icon.style.top = cell.y * GRID_Y + 'px';
        positions[id] = { x: cell.x * GRID_X, y: cell.y * GRID_Y };
      }
    });
    LS.setJSON('iconpos', positions);
    fitDesktopIcons();
  }
  function fitDesktopIcons() {
    const area = di.getBoundingClientRect();
    const saved = LS.getJSON('iconpos', {});
    const columns = Math.max(1, Math.floor(area.width / GRID_X));
    const rows = Math.max(1, Math.floor(area.height / GRID_Y));
    const taken = new Set();
    di.querySelectorAll('.desk-icon:not([hidden])').forEach(icon => {
      const id = icon.dataset.iconId;
      const r = icon.getBoundingClientRect();
      if (!naturalPositions.has(id)) naturalPositions.set(id, { x: r.left - area.left, y: r.top - area.top });
      const original = saved[id] || naturalPositions.get(id);
      let x = Math.min(columns - 1, Math.max(0, Math.round(original.x / GRID_X)));
      let y = Math.min(rows - 1, Math.max(0, Math.round(original.y / GRID_Y)));
      if (taken.has(x + ',' + y)) {
        let cell = 0;
        do { x = cell % columns; y = Math.floor(cell / columns); cell++; } while (taken.has(x + ',' + y));
      }
      taken.add(x + ',' + y);
      icon.style.position = 'absolute';
      icon.style.left = x * GRID_X + 'px';
      icon.style.top = y * GRID_Y + 'px';
    });
    // A responsive arrangement does not overwrite the user's saved wide layout.
  }
  window.addEventListener('resize', fitDesktopIcons);
  window.renderPinnedShortcuts = container => {
    shortcuts.filter(s => s.taskbar && !s.app).forEach(s => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tb-icon shortcut-task-pin';
      button.title = s.title;
      button.setAttribute('aria-label', 'Ouvrir ' + s.title);
      button.dataset.v30Shortcut = s.key;
      button.innerHTML = `<span class="tb-glyph">${iconHTML(s)}</span><span class="tb-lbl">${escHtml(s.title)}</span>`;
      button.onclick = () => launch(s);
      container.append(button);
    });
  };
  function renderStartShortcuts() {
    document.querySelectorAll('#sm-apps [data-v30-shortcut]').forEach(el => el.remove());
    const container = document.querySelector('#sm-apps');
    if (!container) return;
    shortcuts.filter(s => !s.app && (s.desktop || s.taskbar)).forEach(s => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sm-tile';
      b.dataset.name = s.title.toLocaleLowerCase('fr');
      b.dataset.v30Shortcut = s.key;
      b.innerHTML = `<span class="w-10 h-10">${iconHTML(s, 64)}</span><span class="text-[11.5px] font-medium">${escHtml(s.title)}</span>`;
      b.onclick = () => { toggleStartMenu(false); launch(s); };
      container.append(b);
    });
  }
  document.addEventListener('contextmenu', e => {
    const target = e.target.closest('[data-v30-shortcut], [data-app-pin], .desk-icon, .sm-tile[data-icon-id]');
    if (!target) return;
    const s = target.dataset.v30Shortcut ? shortcuts.find(x => x.key === target.dataset.v30Shortcut) :
      APPS[target.dataset.appPin || target.dataset.iconId] ? normalizeShortcut({ app: target.dataset.appPin || target.dataset.iconId }) : null;
    if (!s) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    hideCtx();
    showMenu(s, null, { x: e.clientX, y: e.clientY });
  }, true);
  window.addEventListener('message', e => {
    if (!browserAPI?.ownsSource(e.source)) return;
    if (e.data?.wosPin) showMenu(e.data.wosPin);
  });

  function buildStorageSettings(root) {
    const panel = document.createElement('section');
    panel.id = 'st-storage-v30';
    panel.className = 'storage-panel';
    panel.innerHTML = `<div class="storage-heading"><span class="storage-icon"><i class="fa-solid fa-floppy-disk"></i></span><div><h3>Ton espace reste à toi.</h3><p>${LS.persistent() ? 'Sauvegarde locale disponible sur cet appareil' : 'Stockage restreint : réglages conservés seulement pendant cette visite'}</p></div><span class="storage-status ${LS.persistent() ? '' : 'warning'}"></span></div>
      <p>Le thème, les fonds d’écran, tes raccourcis et les clés déjà saisies restent dans ce navigateur. Les clés ne sont pas ajoutées au code du site.</p>
      <label><input id="st-remember-tabs" type="checkbox" ${LS.get('remember_tabs', '1') === '1' ? 'checked' : ''}> Retrouver mes onglets à la réouverture du navigateur WebOS</label>
      <p class="storage-note">Comptes YouTube, TikTok, Discord : utilise le site officiel pour te connecter. Dans le menu + d’un raccourci, active « Mes raccourcis en onglet officiel » pour retrouver ce même site à chaque ouverture. Leur session dépend du navigateur, des cookies et des règles du service. Une session du proxy n’est pas la même que celle de l’onglet officiel. WebOS ne sauvegarde pas les mots de passe et ne copie pas les cookies.</p>
      <div class="storage-actions"><button class="btn btn-ghost" id="st-forget-tabs"><i class="fa-solid fa-clock-rotate-left"></i> Oublier les onglets enregistrés</button><button class="btn btn-blue" id="st-fluent-wall"><i class="fa-solid fa-wand-magic-sparkles"></i> Appliquer le style Windows 11</button></div>
      <small>La navigation privée, l’effacement des données ou un autre appareil ne conservent pas forcément ces réglages. La sauvegarde exportée n’inclut pas les clés API.</small>`;
    root.firstElementChild.prepend(panel);
    panel.querySelector('#st-remember-tabs').onchange = e => {
      LS.set('remember_tabs', e.target.checked ? '1' : '0');
      if (!e.target.checked) LS.setJSON('browser_session_v30', null);
    };
    panel.querySelector('#st-forget-tabs').onclick = () => {
      LS.setJSON('browser_session_v30', null);
      LS.set('remember_tabs', '0');
      panel.querySelector('#st-remember-tabs').checked = false;
      toast('Restauration désactivée et liste des onglets oubliée', 'fa-check', 'text-sky-400');
    };
    panel.querySelector('#st-fluent-wall').onclick = () => {
      applySkin('win11');
      setWallpaperById('bloom');
      toast('Style Windows 11 et fond Bloom appliqués', 'fab fa-windows', 'text-sky-400');
    };
  }

  browserHomeHTML = function () {
    const extras = shortcuts.filter(s => s.url && (s.desktop || s.taskbar) && !HOME_LINKS.some(h => new URL(h.url).href === s.url));
    const links = [...HOME_LINKS, ...extras].slice(0, 20);
    const script = `document.getElementById('home-search').addEventListener('submit',function(e){e.preventDefault();var q=document.getElementById('home-query').value.trim();if(q)parent.postMessage({wosNav:q},'*');});document.querySelectorAll('[data-open]').forEach(function(b){b.onclick=function(){parent.postMessage({wosNav:b.dataset.open},'*');};});document.querySelectorAll('[data-pin]').forEach(function(b){b.onclick=function(){parent.postMessage({wosPin:{url:b.dataset.pin,title:b.dataset.title}},'*');};});`;
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nouvel onglet</title><style>
      *{box-sizing:border-box}body{margin:0;min-height:100vh;background:#101722;color:#edf4ff;font-family:"Segoe UI",system-ui,sans-serif}main{max-width:900px;margin:auto;padding:46px 36px 28px}.eyebrow{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#91b4d2;display:flex;align-items:center;gap:8px}.dot{width:5px;height:5px;background:#71caff;border-radius:50%}h1{font-size:clamp(28px,4vw,43px);letter-spacing:-.045em;font-weight:550;margin:16px 0 7px}p{font-size:12px;line-height:1.6;color:#9dacbf;margin:0}form{display:flex;align-items:center;gap:10px;margin:26px 0 30px;background:#1c2737;border:1px solid #38465a;border-radius:12px;padding:7px 8px 7px 18px;box-shadow:0 10px 35px #0002}form:focus-within{border-color:#75bfff;box-shadow:0 0 0 2px #75bfff22}input{color:#f3f7ff;background:none;min-width:0;width:100%;border:0;outline:0;font:13px "Segoe UI",system-ui}button{font:inherit;cursor:pointer}form button{border:0;border-radius:7px;background:#83c5ff;color:#07213e;width:38px;height:36px;font-size:21px;flex-shrink:0}.section{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;font-size:11px;color:#b7c5d6}.section span:last-child{font-size:10px;color:#788ca4}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.tile{position:relative;min-width:0;border-radius:10px;background:#192332;border:1px solid #ffffff0b;transition:background .15s,transform .15s}.tile:hover{background:#233247;transform:translateY(-2px)}.open{width:100%;padding:19px 9px 17px;border:0;background:none;color:#dce9f9;display:flex;align-items:center;justify-content:center;gap:10px;font-size:12px;text-align:left}.logo{width:30px;height:30px;position:relative;display:grid;place-items:center;background:#fff1;border-radius:8px;font-size:17px;color:#b7d8ff;flex:none}.logo img{position:absolute;inset:4px;width:22px;height:22px;object-fit:contain}.pin{position:absolute;right:3px;top:3px;border:0;background:transparent;color:#93a6bd;width:24px;height:24px;border-radius:5px;font-size:17px}.pin:hover{background:#ffffff1a;color:white}.note{margin-top:25px;padding-top:18px;border-top:1px solid #ffffff0b;display:flex;justify-content:space-between;gap:18px;color:#7f92a9;font-size:10px;line-height:1.6}.note strong{color:#adc2dc;font-weight:500}.key{border:1px solid #43526a;padding:1px 5px;border-radius:4px;font-size:9px}.route{white-space:nowrap}button:focus-visible{outline:2px solid #83c5ff;outline-offset:2px}@media(max-width:560px){main{padding:30px 18px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.open{padding:18px 8px;font-size:11px}.section span:last-child{display:none}.note{display:block}.route{margin-top:10px}h1{font-size:29px}form{padding-left:12px;margin-top:23px}}
      </style></head><body><main><div class="eyebrow"><span class="dot"></span> Navigateur WebOS</div><h1>Qu’est-ce qu’on explore ?</h1><p>Une recherche, un jeu, une vidéo. Tout commence ici.</p><form id="home-search"><span aria-hidden="true" style="font-size:20px;color:#8ea5bf">⌕</span><input id="home-query" aria-label="Rechercher ou saisir une adresse" placeholder="Rechercher sur le Web ou saisir une adresse" autocomplete="off"><button aria-label="Lancer la recherche" title="Rechercher">→</button></form><div class="section"><span>À portée de clic</span><span>Le + ajoute une app à ton espace</span></div><div class="grid">${links.map(s => {
      const host = new URL(s.url).hostname;
      return `<div class="tile"><button class="open" data-open="${escHtml(s.url)}"><span class="logo"><span>${escHtml(s.title[0])}</span><img src="${escHtml(brandImg(host, 64))}" alt="" onerror="this.remove()"></span><span>${escHtml(s.title)}</span></button><button class="pin" data-pin="${escHtml(s.url)}" data-title="${escHtml(s.title)}" aria-label="Épingler ${escHtml(s.title)}" title="Ajouter au bureau ou à la barre des tâches">+</button></div>`;
    }).join('')}</div><div class="note"><div><strong>Ton navigateur, tes repères.</strong><br>Les onglets et raccourcis sont mémorisés si le stockage local est autorisé.</div><div class="route"><span class="key">Ctrl</span> + <span class="key">L</span> adresse &nbsp; <span class="key">Ctrl</span> + <span class="key">T</span> onglet</div></div><p style="font-size:11px;margin-top:18px;color:#a5b6cb">Par défaut, recherche simplifiée : ta requête est envoyée à Bing via Jina Reader, sans compte ni clé API. Les autres moteurs restent au choix. Le proxy ne garantit pas l’absence de CAPTCHA ; utilise « Site officiel » pour tes comptes.</p></main><scr` + `ipt>${script}</scr` + 'ipt></body></html>';
  };

  const searchButton = document.createElement('button');
  searchButton.id = 'tb-search-v30';
  searchButton.className = 'tb-icon';
  searchButton.type = 'button';
  searchButton.title = 'Rechercher une application';
  searchButton.setAttribute('aria-label', searchButton.title);
  searchButton.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>';
  searchButton.onclick = () => { toggleStartMenu(true); document.querySelector('#sm-search')?.focus(); };
  document.querySelector('#start-btn').after(searchButton);
  const desktopButton = document.createElement('button');
  desktopButton.id = 'tb-show-desktop';
  desktopButton.type = 'button';
  desktopButton.title = 'Afficher le bureau';
  desktopButton.setAttribute('aria-label', desktopButton.title);
  let hiddenWindows = [];
  desktopButton.onclick = () => {
    if (hiddenWindows.length) {
      hiddenWindows.forEach(id => { if (windows.get(id)?.minimized) toggleMinimize(id); });
      hiddenWindows = [];
    } else {
      hiddenWindows = [...windows].filter(([, w]) => !w.minimized).map(([id]) => id);
      hiddenWindows.forEach(toggleMinimize);
    }
  };
  document.querySelector('#taskbar').append(desktopButton);
  const welcome = document.createElement('aside');
  welcome.id = 'desktop-welcome';
  welcome.innerHTML = '<span class="desktop-edition">WEBOS / ÉDITION 30</span><h1>Un espace bien à toi.</h1><p>Joue. Explore. Personnalise.</p><span class="desktop-save"><span></span> ' + (LS.persistent() ? 'Tes réglages, sur cet appareil' : 'Stockage limité à cette visite') + '</span>';
  document.querySelector('#desk-icons').before(welcome);

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; decorate(layer); });
  });
  observer.observe(layer, { childList: true, subtree: true });
  decorate(layer);
  renderDesktopShortcuts();
  renderTaskbar();
  renderStartShortcuts();
})();
