/* Orbit Ranger — the installable app.
 * Registers the service worker (sw.js) so the game works offline, shows an
 * "Install app" button when the browser can install it, opens the shortcuts
 * from the app icon, and can save every NASA model for offline use.
 * None of this runs when the game is opened from a double-click (file://),
 * where service workers do not exist; the game itself still works there.
 */
(function () {
  'use strict';
  var RG = window.RG, P = {};
  var http = /^https?:$/.test(window.location.protocol);
  var MODELS = 'orbit-ranger-models-v1';
  function toast(text) { if (RG.Designer) RG.Designer.toast(text); }

  P.canSave = function () { return http && 'serviceWorker' in navigator && 'caches' in window; };

  if (http && 'serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      var had = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        reg.addEventListener('updatefound', function () {
          var w = reg.installing;
          if (!w) return;
          w.addEventListener('statechange', function () {
            if (w.state === 'activated') toast(had ? 'Game updated. It will be used the next time you open it.' : 'Ready to play offline.');
          });
        });
      }).catch(function () { /* offline play is a bonus; the game works without it */ });
    });
  }

  /* ---------- install ---------- */
  var btn = null, waiting = null;
  var native = typeof Navigator !== 'undefined' && typeof Navigator.prototype.install === 'function';
  function show(on) { if (btn) btn.hidden = !on; }
  // Browsers without navigator.install() announce that they can install with this event.
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    waiting = e;
    if (!native) show(true);
  });
  window.addEventListener('appinstalled', function () { waiting = null; show(false); toast('Orbit Ranger is installed.'); });
  function install() {
    if (btn.getAttribute('aria-disabled') === 'true') return;
    btn.setAttribute('aria-disabled', 'true'); // not `disabled`, so the button keeps keyboard focus
    var job;
    if (native) job = navigator.install().then(function () { show(false); toast('Orbit Ranger is installed.'); }); // must be called straight from the click
    else if (waiting) {
      var ev = waiting; waiting = null; // the event can be used once
      job = Promise.resolve(ev.prompt()).then(function () { return ev.userChoice; }).then(function (c) { if (!waiting) show(false); if (c && c.outcome !== 'accepted') toast('Not installed. You can install it later from the browser menu.'); });
    } else job = Promise.resolve();
    job.catch(function (err) { if (!err || err.name !== 'AbortError') toast('The app could not be installed from here. Try the browser menu.'); })
      .then(function () { btn.removeAttribute('aria-disabled'); });
  }

  /* ---------- every model, for offline use ---------- */
  P.saveModels = function (el) {
    if (!P.canSave() || P.saving) return;
    P.saving = true;
    var ids = RG.Models.all().map(function (m) { return m.id; }), done = 0, failed = 0, next = 0;
    function label() { el.textContent = 'Saving models: ' + done + ' of ' + ids.length; }
    label();
    caches.open(MODELS).then(function (cache) {
      function one() {
        if (next >= ids.length) return Promise.resolve();
        var url = 'assets/nasa3d/' + ids[next++] + '.js';
        return cache.match(url).then(function (hit) { return hit || fetch(url).then(function (res) { if (!res.ok) throw new Error('missing'); return cache.put(url, res); }); })
          .catch(function () { failed++; }).then(function () { done++; label(); return one(); });
      }
      return Promise.all([one(), one(), one(), one()]);
    }).then(function () {
      P.saving = false;
      el.textContent = failed ? (ids.length - failed) + ' models saved, ' + failed + ' could not be fetched. Try again when online.' : 'All ' + ids.length + ' models are saved on this device.';
    });
  };

  function start() {
    btn = document.getElementById('install-btn');
    if (btn) { btn.addEventListener('click', install); if (native && http) show(true); }
    // shortcuts from the app icon: index.html#hangar and index.html#moon
    var hash = window.location.hash;
    if (hash === '#hangar' && RG.Hangar) setTimeout(function () { RG.Hangar.open(); }, 60);
    else if (hash === '#moon' && RG.Levels) setTimeout(function () {
      RG.Levels.showMap();
      var node = document.querySelector('.node[data-id="6"]:not(:disabled)');
      if (node) node.click();
    }, 60);
    window.addEventListener('offline', function () { toast('You are offline. Everything already opened still works.'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  RG.PWA = P;
})();
