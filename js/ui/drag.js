/* Orbit Ranger — drag and drop.
 * The dock of drop slots, the hand that demonstrates a drag, and the pointer
 * handling itself. Used by level 2 and the mission designer.
 */
(function () {
  'use strict';
  var RG = window.RG, W = RG.Widgets = RG.Widgets || {};

  /* ---------- drag and drop ----------
   * Draggable things carry data-drag="<slot>", targets carry data-drop="<slot>".
   * A drop is delivered as an ordinary click on the dragged button, so the same
   * handlers serve the mouse, touch and the keyboard (Enter and Space still pick).
   * On touch a short press-and-hold lifts the piece, so a quick swipe still scrolls.
   */
  W.dock = function (slots) {
    return '<div class="dock" aria-label="Drop zones">' + slots.map(function (s, i) {
      var first = !s.items.length && slots.slice(0, i).every(function (x) { return x.items.length; });
      return '<div class="slot' + (s.items.length ? ' is-full' : '') + (first ? ' is-next' : '') + '" data-drop="' + s.key + '">' +
        '<span class="slot-art">' + (s.items.length ? s.items.map(function (it) {
          return s.multi ? '<button type="button" class="slot-item" ' + it.attrs + ' aria-label="Remove ' + W.esc(it.name) + '">' + W.icon(it.icon) + '<i>×</i></button>' : W.icon(it.icon);
        }).join('') : W.icon(s.icon)) + '</span><b>' + s.label + '</b><span class="slot-arrow" aria-hidden="true">' + W.icon('hand') + '</span></div>';
    }).join('') + '</div>';
  };
  function zoneFor(slot) { return document.querySelector('[data-drop="' + slot + '"]'); }
  /** A tap is not a drag: show a hand carrying the piece to its slot, so the player sees what to do. */
  W.hintDrag = function (el) {
    var zone = zoneFor(el.dataset.drag);
    if (!zone) return;
    var a = el.getBoundingClientRect(), z = zone.getBoundingClientRect();
    var ghost = document.createElement('div');
    ghost.className = 'drag-hint';
    ghost.innerHTML = (el.querySelector('.ico') ? el.querySelector('.ico').outerHTML : '') + W.icon('hand');
    ghost.style.left = (a.left + a.width / 2) + 'px'; ghost.style.top = (a.top + a.height / 3) + 'px';
    document.body.appendChild(ghost);
    zone.classList.add('is-target');
    var dx = z.left + z.width / 2 - (a.left + a.width / 2), dy = z.top + z.height / 2 - (a.top + a.height / 3);
    var anim = ghost.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }, { opacity: 1, offset: 0.15 },
      { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(1.15)', opacity: 1, offset: 0.85 },
      { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(0.8)', opacity: 0 }], { duration: 1100, easing: 'ease-in-out' });
    anim.onfinish = function () { ghost.remove(); zone.classList.remove('is-target'); };
  };
  W.initDrag = function () {
    var cur = null, swallowUntil = 0;
    function lift(e) {
      var el = cur.el, r = el.getBoundingClientRect();
      cur.ghost = document.createElement('div'); // same parent classes, so the copy keeps its styling
      cur.ghost.className = el.parentNode.className + ' drag-ghost';
      cur.ghost.appendChild(el.cloneNode(true));
      cur.ghost.style.width = r.width + 'px';
      cur.dx = cur.x0 - r.left; cur.dy = cur.y0 - r.top;
      document.body.appendChild(cur.ghost);
      document.body.classList.add('is-dragging');
      el.classList.add('is-lifted');
      cur.zone = zoneFor(el.dataset.drag);
      if (cur.zone) cur.zone.classList.add('is-target');
      if (navigator.vibrate && e.pointerType === 'touch') navigator.vibrate(12);
      move(e);
    }
    function move(e) {
      cur.ghost.style.transform = 'translate(' + (e.clientX - cur.dx) + 'px,' + (e.clientY - cur.dy) + 'px) rotate(-4deg) scale(1.06)';
      if (!cur.zone) return;
      var z = cur.zone.getBoundingClientRect(), pad = 28;
      cur.over = e.clientX > z.left - pad && e.clientX < z.right + pad && e.clientY > z.top - pad && e.clientY < z.bottom + pad;
      cur.zone.classList.toggle('is-over', cur.over);
    }
    function end(drop) {
      if (!cur) return;
      clearTimeout(cur.timer);
      var c = cur; cur = null;
      if (!c.ghost) return;
      c.ghost.remove();
      document.body.classList.remove('is-dragging');
      c.el.classList.remove('is-lifted');
      if (c.zone) c.zone.classList.remove('is-target', 'is-over');
      swallowUntil = Date.now() + 80; // the browser's own click after a drag is not a pick
      if (drop && c.over) c.el.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    }
    document.addEventListener('pointerdown', function (e) {
      var el = e.target.closest && e.target.closest('[data-drag]');
      if (!el || el.disabled || e.button) return;
      cur = { el: el, x0: e.clientX, y0: e.clientY, id: e.pointerId };
      if (e.pointerType === 'touch') cur.timer = setTimeout(function () { if (cur && !cur.ghost) lift(e); }, 170);
    });
    document.addEventListener('pointermove', function (e) {
      if (!cur || e.pointerId !== cur.id) return;
      if (cur.ghost) { move(e); return; }
      var far = Math.hypot(e.clientX - cur.x0, e.clientY - cur.y0) > 8;
      if (e.pointerType === 'touch') { if (far) end(false); } // moved before the hold: the player is scrolling
      else if (far) lift(e);
    });
    document.addEventListener('pointerup', function (e) { if (cur && e.pointerId === cur.id) end(true); });
    document.addEventListener('pointercancel', function () { end(false); });
    document.addEventListener('touchmove', function (e) { if (cur && cur.ghost) e.preventDefault(); }, { passive: false });
    document.addEventListener('contextmenu', function (e) { if (cur) e.preventDefault(); });
    document.addEventListener('click', function (e) {
      if (e.detail && Date.now() < swallowUntil) { e.stopPropagation(); e.preventDefault(); }
    }, true);
  };
  /** True when a click came from a real tap rather than the keyboard or a finished drag. */
  W.isTap = function (e) { return !!(e && e.detail); };
})();
