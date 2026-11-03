/* v35 — barre supérieure des systèmes (macOS, Ubuntu, Fedora) et écran de changement de système */
(function () {
  'use strict';
  var TOPBAR_SKINS = { macos: 1, ubuntu: 1, fedora: 1 };
  var SPLASH = {
    macos:    { ico: 'fab fa-apple',  bg: 'radial-gradient(circle at 50% 40%,#2b2f3a,#000)', name: 'macOS' },
    ubuntu:   { ico: 'fab fa-ubuntu', bg: 'linear-gradient(160deg,#2c001e,#772953)', name: 'Ubuntu' },
    fedora:   { ico: 'fab fa-fedora', bg: 'linear-gradient(160deg,#0b1e3f,#3c6eb4)', name: 'Fedora Workstation' },
    mint:     { ico: 'fab fa-linux',  bg: 'linear-gradient(160deg,#1c3a14,#87cf3e)', name: 'Linux Mint' },
    kali:     { ico: 'fa-solid fa-terminal', bg: 'radial-gradient(circle at 30% 80%,#1b3a8a,#05070d 60%)', name: 'Kali Linux' },
    kde:      { ico: 'fab fa-linux',  bg: 'linear-gradient(135deg,#0f2740,#3daee9)', name: 'KDE Plasma' },
    chromeos: { ico: 'fab fa-chrome', bg: 'linear-gradient(135deg,#3b6fe0,#8e5fe0)', name: 'ChromeOS' },
    win11:    { ico: 'fab fa-windows', bg: 'radial-gradient(circle at 50% 40%,#1b4aa0,#06122b)', name: 'Windows 11' },
    win10:    { ico: 'fab fa-windows', bg: 'linear-gradient(160deg,#0a3b76,#1b78c8)', name: 'Windows 10' },
    win7:     { ico: 'fab fa-windows', bg: 'linear-gradient(160deg,#0f4c85,#5fb4ea)', name: 'Windows 7' },
    winxp:    { ico: 'fab fa-windows', bg: 'linear-gradient(160deg,#245edb,#78ad3f)', name: 'Windows XP' },
    win98:    { ico: 'fab fa-windows', bg: '#008080', name: 'Windows 98' }
  };
  var bar, tickTimer;

  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function clickProxy(sel) { var el = document.querySelector(sel); if (el) el.click(); }

  function ensureBar() {
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'os-topbar';
    var desk = document.getElementById('desktop') || document.body;
    desk.appendChild(bar);
    bar.addEventListener('click', function (e) {
      var t = e.target.closest('[data-tb]');
      if (!t) return;
      e.stopPropagation();
      var a = t.dataset.tb;
      if (a === 'start') clickProxy('#start-btn');
      else if (a === 'clock') clickProxy('#tb-clock');
      else if (a === 'wifi') clickProxy('.tray-btn[title="Réseau sans fil"]');
      else if (a === 'settings') { if (typeof openApp === 'function') openApp('settings'); }
      else if (a === 'panic') clickProxy('.tray-btn[title^="Lien de secours"]');
      else if (a === 'menu') { if (typeof toast === 'function') toast('Menu « ' + t.textContent.trim() + ' » — non disponible dans WebOS', 'fa-circle-info', 'text-sky-400'); }
    });
    return bar;
  }

  function appName() {
    try {
      if (typeof focusedApp !== 'undefined' && focusedApp && typeof APPS !== 'undefined' && APPS[focusedApp]) return APPS[focusedApp].title;
    } catch (e) {}
    return null;
  }

  function dateStr(long) {
    var d = new Date();
    var days = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
    var months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    var base = days[d.getDay()] + ' ' + d.getDate() + ' ' + months[d.getMonth()];
    return long ? base + '  ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) : pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function render(id) {
    var b = ensureBar();
    var html = '';
    var app = appName();
    var wifi = '<span class="tb-item" data-tb="wifi" title="Réseau"><i class="fa-solid fa-wifi"></i></span>';
    var bat = '<span class="tb-item" data-tb="settings" title="Paramètres"><i class="fa-solid fa-battery-three-quarters"></i></span>';
    var panic = '<span class="tb-item" data-tb="panic" title="Lien de secours"><i class="fa-solid fa-shield-halved"></i></span>';
    if (id === 'macos') {
      html = '<div class="tb-l"><span class="tb-item" data-tb="start" title="Menu"><i class="fa-brands fa-apple" style="font-size:15px"></i></span>' +
        '<span class="tb-item tb-app" data-tb="menu">' + esc(app || 'Finder') + '</span>' +
        ['Fichier', 'Édition', 'Présentation', 'Fenêtre', 'Aide'].map(function (m) { return '<span class="tb-item tb-menu" data-tb="menu">' + m + '</span>'; }).join('') +
        '</div><div class="tb-r">' + wifi + bat + panic + '<span class="tb-item" data-tb="clock">' + dateStr(true) + '</span></div>';
    } else if (id === 'ubuntu') {
      html = '<div class="tb-l"><span class="tb-item" data-tb="start">Activités</span></div>' +
        '<div class="tb-c"><span class="tb-item" data-tb="clock">' + dateStr(true) + '</span></div>' +
        '<div class="tb-r">' + wifi + '<span class="tb-item" data-tb="settings"><i class="fa-solid fa-volume-high"></i></span>' + bat + panic + '</div>';
    } else if (id === 'fedora') {
      html = '<div class="tb-l"><span class="tb-item tb-act" data-tb="start">Activités</span><span class="tb-item tb-app" data-tb="menu">' + esc(app || '') + '</span></div>' +
        '<div class="tb-c"><span class="tb-item" data-tb="clock">' + dateStr(true) + '</span></div>' +
        '<div class="tb-r">' + wifi + '<span class="tb-item" data-tb="settings"><i class="fa-solid fa-volume-high"></i></span>' + bat + panic + '</div>';
    }
    if (html !== b._html) { b._html = html; b.innerHTML = html; }
  }

  function applyLayout(id) {
    var on = !!TOPBAR_SKINS[id];
    document.body.classList.toggle('has-topbar', on);
    clearInterval(tickTimer);
    if (on) {
      render(id);
      tickTimer = setInterval(function () { if (document.body.classList.contains('has-topbar')) render(document.body.dataset.os); }, 1500);
    }
    /* les fenêtres déjà agrandies suivent la nouvelle taille de la zone de travail */
    try {
      if (typeof windows !== 'undefined' && typeof layer !== 'undefined') {
        var r = layer.getBoundingClientRect();
        windows.forEach(function (w) { if (w.maximized) { w.el.style.left = '0px'; w.el.style.top = '0px'; w.el.style.width = r.width + 'px'; w.el.style.height = r.height + 'px'; } });
      }
    } catch (e) {}
  }

  function splash(id) {
    var s = SPLASH[id];
    if (!s) return;
    var old = document.getElementById('os-splash');
    if (old) old.remove();
    var el = document.createElement('div');
    el.id = 'os-splash';
    el.style.background = s.bg;
    el.innerHTML = '<i class="os-logo ' + s.ico + '"></i><div class="os-name">' + esc(s.name) + '</div><div class="os-bar"><i></i></div>';
    document.body.appendChild(el);
    setTimeout(function () { el.classList.add('out'); }, 1250);
    setTimeout(function () { el.remove(); }, 1800);
  }

  window.addEventListener('webos:skin', function (e) {
    var id = (e.detail && e.detail.id) || document.body.dataset.os || 'win11';
    applyLayout(id);
    setTimeout(function () {
      try {
        var r = layer.getBoundingClientRect();
        windows.forEach(function (w) { if (w && w.el && !w.maximized) webos32.clampWindow(w.el, r); });
      } catch (err) {}
    }, 350);
    if (!(e.detail && e.detail.restore)) splash(id);
  });
  /* état initial (le skin sauvegardé est appliqué avant le chargement de ce fichier) */
  applyLayout(document.body.dataset.os || 'win11');
  window.webos35 = { splash: splash, applyLayout: applyLayout };
})();
