/* WebOS v37 : son coupé PARTOUT (jeux, vidéos, YouTube, sites proxy) + touche d'urgence partout
   (cadres imbriqués, plein écran, vidéos YouTube). Tout est en même origine avec le proxy :
   on peut donc entrer dans chaque cadre, y couper les médias et y relayer le clavier. */
(function () {
  'use strict';
  var state = { muted: false, uncontrolled: 0 };
  var YT = /youtube(-nocookie)?\.com\/embed/i;

  function sameOrigin(f) { try { return !!(f.contentWindow && f.contentWindow.document); } catch (e) { return false; } }
  function walk(win, fn, depth, cross) {
    if (depth > 8) return;
    var doc; try { doc = win.document; fn(win, doc); } catch (e) { return; }
    var list; try { list = doc.querySelectorAll('iframe,frame'); } catch (e) { return; }
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      if (sameOrigin(f)) walk(f.contentWindow, fn, depth + 1, cross);
      else if (cross) cross(f);
    }
  }

  /* ---------- correctif de la fenêtre : médias + Web Audio + synthèse vocale ---------- */
  function patch(win) {
    if (win.__wosAudio) return;
    try {
      win.__wosAudio = true;
      var HME = win.HTMLMediaElement && win.HTMLMediaElement.prototype;
      if (HME) {
        var d = Object.getOwnPropertyDescriptor(HME, 'muted');
        if (d && d.set) {
          Object.defineProperty(HME, 'muted', {
            configurable: true, enumerable: d.enumerable,
            get: function () { return d.get.call(this); },
            set: function (v) { this.__wosWant = !!v; d.set.call(this, state.muted ? true : v); }
          });
          win.__wosMutedDesc = d;
        }
        var play = HME.play;
        HME.play = function () { if (state.muted && d && d.set) { try { d.set.call(this, true); } catch (e) {} } return play.apply(this, arguments); };
      }
      var AN = win.AudioNode && win.AudioNode.prototype;
      if (AN) {
        var conn = AN.connect;
        AN.connect = function () {
          var a = Array.prototype.slice.call(arguments);
          try {
            var dest = a[0];
            if (dest && win.AudioDestinationNode && dest instanceof win.AudioDestinationNode) {
              var ctx = dest.context;
              if (!ctx.__wosGain) {
                var g = ctx.createGain(); g.gain.value = state.muted ? 0 : 1;
                conn.call(g, ctx.destination);
                ctx.__wosGain = g; (win.__wosCtxs = win.__wosCtxs || []).push(ctx);
              }
              if (this !== ctx.__wosGain) a[0] = ctx.__wosGain;
            }
          } catch (e) {}
          return conn.apply(this, a);
        };
      }
      var ss = win.speechSynthesis;
      if (ss && ss.speak) { var sp = ss.speak; ss.speak = function () { if (state.muted) return; return sp.apply(this, arguments); }; }
    } catch (e) {}
  }

  function applyMute(win, doc) {
    patch(win);
    var m = state.muted;
    try {
      var els = doc.querySelectorAll('audio,video');
      for (var i = 0; i < els.length; i++) {
        var el = els[i], d = win.__wosMutedDesc || Object.getOwnPropertyDescriptor(win.HTMLMediaElement.prototype, 'muted');
        if (m) { if (el.__wosPrev === undefined) el.__wosPrev = d.get.call(el); d.set.call(el, true); }
        else if (el.__wosPrev !== undefined) { d.set.call(el, el.__wosWant !== undefined ? el.__wosWant : el.__wosPrev); el.__wosPrev = undefined; }
      }
      (win.__wosCtxs || []).forEach(function (c) { try { c.__wosGain.gain.value = m ? 0 : 1; } catch (e) {} });
      if (m && win.speechSynthesis) win.speechSynthesis.cancel();
    } catch (e) {}
  }

  function crossFrame(f) {
    var src = f.src || '';
    try {
      if (YT.test(src)) f.contentWindow.postMessage(JSON.stringify({ event: 'command', func: state.muted ? 'mute' : 'unMute', args: [] }), '*');
      else { f.contentWindow.postMessage({ wosMute: state.muted }, '*'); if (state.muted) state.uncontrolled++; }
    } catch (e) {}
  }

  function scan() {
    state.uncontrolled = 0;
    walk(window, function (win, doc) {
      applyMute(win, doc);
      relayKeys(win, doc);
      observe(doc);
    }, 0, crossFrame);
  }

  window.wosAudio = {
    get muted() { return state.muted; },
    set: function (m) {
      state.muted = !!m;
      scan();
      /* quelques passes de plus : les jeux relancent parfois leur son juste après */
      [150, 600, 1500].forEach(function (t) { setTimeout(scan, t); });
      return state.uncontrolled;
    }
  };
  setInterval(scan, 700);
  /* correctif très tôt : dès qu'un cadre apparaît (fenêtre vide réutilisée) et toutes les 120 ms pour
     les nouvelles pages — pour que le son d'un jeu soit déjà sous contrôle quand il démarre */
  function patchAll() { walk(window, function (win) { patch(win); }, 0); }
  setInterval(patchAll, 120);
  function observe(doc) {
    if (doc.__wosObs || !doc.documentElement) return; doc.__wosObs = true;
    try {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) for (var j = 0; j < muts[i].addedNodes.length; j++) {
          var n = muts[i].addedNodes[j];
          if (n && n.nodeType === 1) { var fr = n.tagName === 'IFRAME' ? [n] : (n.querySelectorAll ? n.querySelectorAll('iframe') : []); for (var k = 0; k < fr.length; k++) { try { if (sameOrigin(fr[k])) { patch(fr[k].contentWindow); observe(fr[k].contentDocument); } } catch (e) {} } }
        }
      }).observe(doc.documentElement, { childList: true, subtree: true });
    } catch (e) {}
  }
  observe(document);
  document.addEventListener('load', function (e) { if (e.target && e.target.tagName === 'IFRAME') { setTimeout(scan, 30); setTimeout(scan, 400); } }, true);

  /* ---------- touche d'urgence dans TOUS les cadres (imbriqués aussi) ---------- */
  function relayKeys(win, doc) {
    // The desktop already owns its keyboard handler, including menu dismissal.
    if (win === window) return;
    if (doc.__wosPanic) return;
    doc.__wosPanic = true;
    var h = function (ev) {
      if (ev.defaultPrevented) return;
      try { if (typeof panicKey !== 'undefined' && ev.key === panicKey && !(typeof capturingPanicKey !== 'undefined' && capturingPanicKey)) { ev.preventDefault(); ev.stopImmediatePropagation(); triggerPanic(); } } catch (e) {}
    };
    doc.addEventListener('keydown', h, true);
    try { win.addEventListener('keydown', h, true); } catch (e) {}
  }

  /* ---------- plein écran : Échap reste utilisable comme touche d'urgence ---------- */
  function fsChange() {
    try {
      var k = navigator.keyboard;
      if (!k) return;
      if (document.fullscreenElement && typeof panicKey !== 'undefined' && panicKey === 'Escape') { if (k.lock) k.lock(['Escape']).catch(function () {}); }
      else if (k.unlock) k.unlock();
    } catch (e) {}
  }
  document.addEventListener('fullscreenchange', fsChange);
  document.addEventListener('webkitfullscreenchange', fsChange);

  /* ---------- lecteurs YouTube (autre domaine, clavier inaccessible) : on garde le focus ici ---------- */
  window.addEventListener('blur', function () {
    setTimeout(function () {
      var a = document.activeElement;
      if (a && a.tagName === 'IFRAME' && YT.test(a.src || '') && !sameOrigin(a)) { try { a.blur(); window.focus(); } catch (e) {} }
    }, 80);
  });

  scan();
})();
