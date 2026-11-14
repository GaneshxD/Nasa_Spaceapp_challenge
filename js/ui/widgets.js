/* Orbit Ranger — small UI building blocks: icons, the resource gauges, the
 * live line on each option card, and the “what your sensor sees” picture.
 */
(function () {
  'use strict';
  var RG = window.RG, D = RG.DATA, M = RG.Model, P = RG.Physics;
  var W = {};

  W.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  W.num = function (n) { return Math.round(n).toLocaleString('en-US'); };

  /* ---------- icons: chunky, glossy sticker drawings on a 48×48 grid ---------- */
  var Y = '#ffc93c', Yd = '#f0a020', R = '#ff5c5c', Rd = '#e23b3b', B = '#3bb4f2', Bd = '#1e8fd0', G = '#6cd33a', Gd = '#48a81e',
    V = '#b98cf5', Vd = '#8f5fe0', O = '#ff9a3c', Od = '#ef7a1a', S = '#cfd8e3', Sd = '#9aa8b8', K = '#4a5568', T = '#35c8b4', N = '#2b3a55';
  var STAR = 'M12 2.6l2.9 6 6.5.9-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5L2.6 9.5l6.5-.9z';
  function shine(x, y, w, h) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + Math.min(w, h) / 2 + '" fill="#fff" opacity=".5"/>'; }
  function planet(r, ring, dot) {
    return '<circle cx="24" cy="24" r="' + r + '" fill="' + B + '"/><path d="M17 18c4-2 6 1 5 4s-6 2-7-1 0-2 2-3zM26 26c3-1 6 1 5 4s-5 3-6 0 0-3 1-4z" fill="' + G + '" transform="translate(24 24) scale(' + (r / 12) + ') translate(-24 -24)"/>' +
      '<circle cx="' + (24 - r * 0.35) + '" cy="' + (24 - r * 0.4) + '" r="' + r * 0.22 + '" fill="#fff" opacity=".45"/>' + ring +
      '<circle cx="' + dot[0] + '" cy="' + dot[1] + '" r="4" fill="#fff" stroke="' + K + '" stroke-width="2"/>';
  }
  function face(mouth) {
    return '<circle cx="24" cy="24" r="21" fill="currentColor"/><ellipse cx="16" cy="13" rx="7" ry="4" fill="#fff" opacity=".35" transform="rotate(-30 16 13)"/>' +
      '<circle cx="17" cy="20" r="3" fill="#fff"/><circle cx="31" cy="20" r="3" fill="#fff"/><path d="' + mouth + '" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>';
  }
  var ICONS = {
    cam: '<rect x="16" y="8" width="16" height="10" rx="4" fill="' + Rd + '"/><rect x="5" y="13" width="38" height="28" rx="9" fill="' + R + '"/><path d="M5 31h38v1a9 9 0 0 1-9 9H14a9 9 0 0 1-9-9z" fill="' + Rd + '"/>' +
      '<circle cx="24" cy="27" r="10" fill="#fff"/><circle cx="24" cy="27" r="7" fill="' + N + '"/><circle cx="21.5" cy="24.5" r="2.2" fill="#fff"/>' + shine(9, 17, 9, 3),
    scan: '<path d="M24 18L5 44h38z" fill="' + Y + '"/><path d="M24 18l-8 26h16z" fill="' + O + '" opacity=".7"/><rect x="12" y="4" width="24" height="18" rx="7" fill="' + B + '"/><path d="M12 15h24a7 7 0 0 1-7 7H19a7 7 0 0 1-7-7z" fill="' + Bd + '"/>' +
      '<circle cx="24" cy="14" r="5" fill="' + N + '"/><circle cx="22.5" cy="12.5" r="1.6" fill="#fff"/>' + shine(15, 7, 7, 2.5),
    scope: '<path d="M21 30l-7 15M27 30l7 15" stroke="' + K + '" stroke-width="4" stroke-linecap="round"/><g transform="rotate(-28 24 22)"><rect x="4" y="14" width="32" height="16" rx="7" fill="' + V + '"/>' +
      '<path d="M4 23h32a7 7 0 0 1-7 7H11a7 7 0 0 1-7-7z" fill="' + Vd + '"/><rect x="31" y="10" width="12" height="24" rx="5" fill="' + Vd + '"/><rect x="39" y="13" width="4" height="18" rx="2" fill="' + N + '"/>' + shine(8, 17, 14, 3) + '</g>',
    eye: '<path d="M3 24c5-10 12-14 21-14s16 4 21 14c-5 10-12 14-21 14S8 34 3 24z" fill="#fff" stroke="' + Bd + '" stroke-width="3"/><circle cx="24" cy="24" r="10" fill="' + B + '"/><circle cx="24" cy="24" r="5" fill="' + N + '"/><circle cx="20.5" cy="20.5" r="2.6" fill="#fff"/>',
    cloud: '<path d="M13 40a10 10 0 0 1-1-20 13 13 0 0 1 25-2 10.5 10.5 0 0 1-1 22z" fill="#eaf1f9"/><path d="M3.5 32A10 10 0 0 0 13 40h23a10.5 10.5 0 0 0 9.5-8z" fill="#c3d0e0"/>' +
      '<circle cx="19" cy="27" r="2.2" fill="' + N + '"/><circle cx="29" cy="27" r="2.2" fill="' + N + '"/><path d="M20 32q4 3 8 0" fill="none" stroke="' + N + '" stroke-width="2" stroke-linecap="round"/>' + shine(16, 12, 9, 3),
    bolt: '<path d="M28 3L8 27h12l-4 18 24-27H27z" fill="' + Y + '" stroke="' + Yd + '" stroke-width="2.5" stroke-linejoin="round"/><path d="M25 9L14 23" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>',
    leo: planet(12, '<ellipse cx="24" cy="24" rx="21" ry="8" fill="none" stroke="' + O + '" stroke-width="3.5" transform="rotate(-35 24 24)"/>', [41.2, 12]),
    sso: planet(11, '<ellipse cx="24" cy="24" rx="21" ry="8" fill="none" stroke="' + V + '" stroke-width="3.5" transform="rotate(-80 24 24)"/>', [27.6, 3.8]),
    geo: planet(7, '<ellipse cx="24" cy="24" rx="20" ry="9" fill="none" stroke="' + G + '" stroke-width="3.5" transform="rotate(-10 24 24)"/>', [43.7, 20.5]),
    box: '<path d="M24 4l18 9.5-18 9.5-18-9.5z" fill="#ffe08a"/><path d="M6 13.5L24 23v21L6 34.5z" fill="' + Y + '"/><path d="M42 13.5L24 23v21l18-9.5z" fill="' + Yd + '"/>' + '<path d="M10 20l10 5.3" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55"/>',
    sun: '<rect x="1" y="13" width="18" height="22" rx="4" fill="' + B + '"/><rect x="29" y="13" width="18" height="22" rx="4" fill="' + B + '"/><path d="M1 24h18M29 24h18M10 13v22M38 13v22" stroke="#fff" stroke-width="1.8" opacity=".65"/>' +
      '<rect x="18" y="17" width="12" height="14" rx="4" fill="' + Y + '"/><path d="M18 25h12v2a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z" fill="' + Yd + '"/>',
    batt: '<rect x="40" y="18" width="6" height="12" rx="2.5" fill="' + Gd + '"/><rect x="3" y="11" width="38" height="26" rx="8" fill="' + G + '"/><path d="M3 27h38v2a8 8 0 0 1-8 8H11a8 8 0 0 1-8-8z" fill="' + Gd + '"/><path d="M24 14l-8 11h7l-2 9 9-12h-7z" fill="#fff"/>' + shine(7, 14, 8, 3),
    chip: '<path d="M16 3v8M24 3v8M32 3v8M16 37v8M24 37v8M32 37v8M3 16h8M3 24h8M3 32h8M37 16h8M37 24h8M37 32h8" stroke="' + Sd + '" stroke-width="3.5" stroke-linecap="round"/><rect x="9" y="9" width="30" height="30" rx="8" fill="' + T + '"/>' +
      '<path d="M9 28h30v3a8 8 0 0 1-8 8H17a8 8 0 0 1-8-8z" fill="#22a996"/><rect x="17" y="17" width="14" height="14" rx="4" fill="#157f70"/><circle cx="21.5" cy="22.5" r="1.6" fill="#fff"/><circle cx="26.5" cy="22.5" r="1.6" fill="#fff"/>' + shine(12, 12, 9, 3),
    magnet: '<path d="M8 5v19a16 16 0 0 0 32 0V5H28v19a4 4 0 0 1-8 0V5z" fill="' + R + '"/><path d="M8 24a16 16 0 0 0 32 0h-4a12 12 0 0 1-24 0z" fill="' + Rd + '"/><path d="M8 5h12v9H8zM28 5h12v9H28z" fill="' + S + '"/>' + shine(10.5, 16, 3, 9),
    wheel: '<circle cx="24" cy="24" r="20" fill="' + Sd + '"/><circle cx="24" cy="23" r="19" fill="' + S + '"/><circle cx="24" cy="23" r="13" fill="#eef3f8"/><path d="M24 10v26M11 23h26" stroke="' + Sd + '" stroke-width="3.5"/><circle cx="24" cy="23" r="6" fill="' + O + '"/><circle cx="22.5" cy="21.5" r="2" fill="#fff" opacity=".6"/>',
    radio: '<path d="M12 28a15 15 0 0 1 0-22M36 6a15 15 0 0 1 0 22" fill="none" stroke="' + B + '" stroke-width="4" stroke-linecap="round"/><path d="M24 20v24M15 44h18" stroke="' + K + '" stroke-width="4.5" stroke-linecap="round"/><circle cx="24" cy="17" r="6.5" fill="' + R + '"/><circle cx="22" cy="15" r="2" fill="#fff" opacity=".6"/>',
    dish: '<path d="M17 33l-5 11h16" fill="none" stroke="' + K + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 16a19 19 0 0 0 25 25z" fill="#eef3f8" stroke="' + Sd + '" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M18 30l11-11" stroke="' + K + '" stroke-width="3.5" stroke-linecap="round"/><circle cx="31" cy="17" r="4.5" fill="' + R + '"/><path d="M36 4a11 11 0 0 1 8 8" fill="none" stroke="' + B + '" stroke-width="4" stroke-linecap="round"/>',
    laser: '<path d="M18 30L43 5" stroke="#ff6ce0" stroke-width="7" stroke-linecap="round"/><path d="M18 30L43 5" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="14" cy="34" r="11" fill="' + V + '"/><path d="M3 34a11 11 0 0 0 22 0z" fill="' + Vd + '"/><circle cx="14" cy="34" r="5" fill="' + N + '"/><circle cx="12" cy="32" r="1.8" fill="#fff"/>',
    pin: '<ellipse cx="24" cy="44" rx="9" ry="2.5" fill="#000" opacity=".15"/><path d="M24 45S8 30 8 18a16 16 0 0 1 32 0c0 12-16 27-16 27z" fill="' + R + '"/><path d="M24 45s16-15 16-27a16 16 0 0 0-3-9.3C38 20 30 32 24 45z" fill="' + Rd + '"/>' + '<circle cx="24" cy="18" r="6.5" fill="#fff"/>' + shine(13, 8, 6, 3),
    rocket: '<path d="M18 37l6 10 6-10z" fill="' + O + '"/><path d="M21 37l3 6 3-6z" fill="' + Y + '"/><path d="M15 25L6 37h10zM33 25l9 12H32z" fill="' + R + '"/><path d="M24 2c8 6 11 15 11 23v12H13V25c0-8 3-17 11-23z" fill="#f4f7fb"/>' +
      '<path d="M24 2c8 6 11 15 11 23v12h-6V25c0-8-1.5-17-5-23z" fill="#d5deea"/>' + '<path d="M24 2c4 3 6.7 7 8.5 11h-17c1.8-4 4.5-8 8.5-11z" fill="' + R + '"/>' + '<circle cx="24" cy="23" r="5.5" fill="' + B + '" stroke="' + Sd + '" stroke-width="2.5"/>' + '<circle cx="22.5" cy="21.5" r="1.6" fill="#fff"/>',
    kg: '<circle cx="24" cy="11" r="6" fill="none" stroke="#7c8aa0" stroke-width="4.5"/><path d="M13 17h22a3 3 0 0 1 3 2.3l5 21a3 3 0 0 1-3 3.7H8a3 3 0 0 1-3-3.7l5-21a3 3 0 0 1 3-2.3z" fill="#8f9db3"/>' + '<path d="M6.5 36h35l1.5 4.3a3 3 0 0 1-3 3.7H8a3 3 0 0 1-3-3.7z" fill="#7c8aa0"/>' + shine(14, 21, 3, 9),
    coin: '<circle cx="24" cy="26" r="20" fill="' + Yd + '"/><circle cx="24" cy="23" r="20" fill="' + Y + '"/><circle cx="24" cy="23" r="14" fill="#ffe08a"/><path d="' + STAR + '" fill="' + Yd + '" transform="translate(13 12) scale(.92)"/><path d="M11 15a15 15 0 0 1 8-7" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>',
    disk: '<path d="M7 12v25c0 4 7.6 7 17 7s17-3 17-7V12z" fill="' + Bd + '"/><ellipse cx="24" cy="12" rx="17" ry="7.5" fill="' + B + '"/>' + '<path d="M7 21c0 4 7.6 7 17 7s17-3 17-7M7 30c0 4 7.6 7 17 7s17-3 17-7" fill="none" stroke="#fff" stroke-width="2.5" opacity=".55"/>' + '<ellipse cx="18" cy="10.5" rx="6" ry="2" fill="#fff" opacity=".5"/>',
    up: '<path d="M24 4L7 23h10v20h14V23h10z" fill="' + G + '" stroke="' + Gd + '" stroke-width="2.5" stroke-linejoin="round"/><path d="M21 14v22" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".5"/>',
    moon: '<path d="M40 31A18 18 0 1 1 20 6a14 14 0 0 0 20 25z" fill="#ffe9a3" stroke="' + Yd + '" stroke-width="2.5" stroke-linejoin="round"/><circle cx="16" cy="26" r="3" fill="' + Y + '"/><circle cx="24" cy="35" r="2" fill="' + Y + '"/>',
    ok: face('M15 28a10 10 0 0 0 18 0'), warn: face('M16 31h16'), bad: face('M15 35a10 10 0 0 1 18 0'),
    tank: '<rect x="13" y="3" width="22" height="42" rx="11" fill="' + O + '"/><path d="M24 3a11 11 0 0 1 11 11v20a11 11 0 0 1-11 11z" fill="' + Od + '"/><rect x="13" y="21" width="22" height="5" fill="#c9620f"/>' + shine(17, 8, 4, 11),
    engine: '<rect x="16" y="3" width="16" height="12" rx="4" fill="' + S + '"/><path d="M19 15h10l9 21H10z" fill="#8f9db3"/><path d="M24 15h5l9 21H24z" fill="#7c8aa0"/><path d="M14 36h20l-10 11z" fill="' + O + '"/><path d="M19 36h10l-5 6z" fill="' + Y + '"/>' + shine(19, 6, 6, 2.5),
    booster: '<path d="M14 40h20l3 6H11z" fill="#7c8aa0"/><path d="M24 2l8 11v28H16V13z" fill="#f4f7fb"/><path d="M24 2l8 11v28h-8z" fill="#d5deea"/><path d="M24 2l8 11H16z" fill="' + R + '"/><rect x="16" y="26" width="16" height="4" fill="' + R + '"/>',
    none: '<circle cx="24" cy="24" r="17" fill="#f1f4f8" stroke="' + Sd + '" stroke-width="4" stroke-dasharray="7 6"/><path d="M14 34l20-20" stroke="' + Sd + '" stroke-width="4" stroke-linecap="round"/>',
    medal: '<path d="M12 2h10l7 18H19zM36 2H26l-7 18h10z" fill="' + R + '"/><path d="M36 2H26l-3.5 9 5 9H29z" fill="' + Rd + '"/>' + '<circle cx="24" cy="32" r="14" fill="' + Yd + '"/><circle cx="24" cy="30.5" r="13.5" fill="' + Y + '"/><path d="' + STAR + '" fill="#fff3c4" transform="translate(14.4 20.5) scale(.8)"/>',
    lock: '<path d="M15 22v-7a9 9 0 0 1 18 0v7" fill="none" stroke="' + Sd + '" stroke-width="5"/><rect x="8" y="20" width="32" height="24" rx="7" fill="' + S + '"/><circle cx="24" cy="31" r="3.5" fill="' + K + '"/><path d="M24 32v6" stroke="' + K + '" stroke-width="3" stroke-linecap="round"/>',
    hand: '<path d="M20 45c-6 0-10-4-11-9l-2-8c-.5-3 3-4 4.5-1.5L13 29V10c0-4.5 6-4.5 6 0v9c1-3 6-2.5 6 1 1-3 6-2 6 1 1-2.5 6-1.5 6 2v11c0 7-4 11-11 11z" fill="#fff" stroke="' + K + '" stroke-width="2.5" stroke-linejoin="round"/>',
    plus: '<path d="M24 12v24M12 24h24" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>'
  };
  W.icon = function (name) {
    return '<svg class="ico" viewBox="0 0 48 48" aria-hidden="true">' + (ICONS[name] || ICONS.box) + '</svg>';
  };

  /* ---------- Pip, the guide: a small round satellite who reacts to how things are going ---------- */
  var PIP_MOUTH = {
    happy: '<path d="M25 43q7 6 14 0" fill="none" stroke="#3c3c3c" stroke-width="3" stroke-linecap="round"/>',
    cheer: '<path d="M24 41h16a8 8 0 0 1-16 0z" fill="#3c3c3c"/><path d="M28 46a5 3 0 0 1 8 0z" fill="#ff7b7b"/>',
    wow: '<ellipse cx="32" cy="45" rx="4" ry="5" fill="#3c3c3c"/>',
    worry: '<path d="M25 46q3.5-3 7 0t7 0" fill="none" stroke="#3c3c3c" stroke-width="3" stroke-linecap="round"/><path d="M20 22l8 3M44 22l-8 3" stroke="#3c3c3c" stroke-width="2.5" stroke-linecap="round"/>',
    sad: '<path d="M25 47q7-6 14 0" fill="none" stroke="#3c3c3c" stroke-width="3" stroke-linecap="round"/><path d="M20 24l8-3M44 24l-8-3" stroke="#3c3c3c" stroke-width="2.5" stroke-linecap="round"/>'
  };
  W.pip = function (mood) {
    mood = PIP_MOUTH[mood] ? mood : 'happy';
    return '<svg class="pip" data-mood="' + mood + '" viewBox="0 0 64 64" aria-hidden="true"><rect x="2" y="24" width="14" height="16" rx="3" fill="#1cb0f6"/><rect x="48" y="24" width="14" height="16" rx="3" fill="#1cb0f6"/>' +
      '<path d="M32 6v8" stroke="#ffc800" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="5" r="4" fill="#ff4b4b"/>' +
      '<circle cx="32" cy="34" r="20" fill="#ffc800"/><circle cx="32" cy="34" r="20" fill="none" stroke="#e6a800" stroke-width="3"/><ellipse cx="24" cy="21" rx="7" ry="3.5" fill="#fff" opacity=".45" transform="rotate(-25 24 21)"/>' +
      '<circle cx="25" cy="31" r="5.5" fill="#fff"/><circle cx="39" cy="31" r="5.5" fill="#fff"/><circle cx="26" cy="32" r="2.6" fill="#3c3c3c"/><circle cx="40" cy="32" r="2.6" fill="#3c3c3c"/>' + PIP_MOUTH[mood] + '</svg>';
  };

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

  /* ---------- “what went wrong” replays: tiny looping cartoons ---------- */
  var RK = '<g class="rp-rocket"><path d="M-5 0h10v-22c0-5-2-9-5-12-3 3-5 7-5 12z" fill="#f4f7fb" stroke="#9aa8b8" stroke-width="1.5"/><path d="M-5 0l-5 5h5zM5 0l5 5H5z" fill="' + R + '"/><circle cx="0" cy="-18" r="2.5" fill="' + B + '"/></g>';
  var REPLAYS = {
    heavy: '<path d="M0 104h220" stroke="#58cc02" stroke-width="12"/><g transform="translate(110 96)"><g class="rp-shake">' + RK + '<path d="M-4 2l4 9 4-9z" fill="' + O + '" class="rp-flick"/></g></g>' +
      '<g class="rp-press"><path d="M110 12v26M102 30l8 9 8-9" fill="none" stroke="' + R + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g><text x="150" y="34">too heavy</text>',
    fall: '<path d="M0 104h220" stroke="#58cc02" stroke-width="12"/><path id="rp-arc" d="M30 96Q110 -40 190 96" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4 5" opacity=".7"/>' +
      '<g>' + RK + '<animateMotion dur="3s" repeatCount="indefinite" rotate="auto-reverse" path="M30 96Q110 -40 190 96" keyPoints="0;1;1" keyTimes="0;0.8;1" calcMode="linear"/></g><text x="110" y="20" text-anchor="middle">too slow</text>',
    tip: '<path d="M0 104h220" stroke="#58cc02" stroke-width="12"/><g transform="translate(110 70)"><g class="rp-tip">' + RK + '<path d="M-4 2l4 9 4-9z" fill="' + O + '"/></g></g><text x="150" y="34">tipped over</text>',
    fuel: '<circle cx="110" cy="190" r="120" fill="' + B + '"/><path d="M40 60Q110 10 180 60" fill="none" stroke="#58cc02" stroke-width="2" stroke-dasharray="4 5"/><path d="M180 60q22 16 30 40" fill="none" stroke="' + R + '" stroke-width="2" stroke-dasharray="4 5"/>' +
      '<g>' + RK + '<animateMotion dur="3.5s" repeatCount="indefinite" rotate="auto" path="M40 60Q110 10 180 60q22 16 30 40"/></g>' + '<text x="110" y="100" text-anchor="middle" fill="#fff">not fast enough to stay up</text>',
    battery: '<circle cx="40" cy="60" r="26" fill="' + B + '"/><path d="M66 40l150-14v68L66 80z" fill="#000" opacity=".45"/><rect x="118" y="44" width="62" height="32" rx="7" fill="#fff"/><rect x="180" y="53" width="6" height="14" rx="2" fill="#fff"/><rect x="123" y="49" height="22" rx="4" fill="' + R + '" class="rp-drain"/><text x="150" y="104" text-anchor="middle">battery runs flat in the shadow</text>',
    data: '<rect x="80" y="34" width="60" height="50" rx="9" fill="' + B + '"/><rect x="86" y="40" width="48" class="rp-fill" fill="' + Y + '" rx="4"/><g class="rp-spill"><rect x="150" y="40" width="14" height="11" rx="2" fill="' + Y + '"/><rect x="168" y="52" width="14" height="11" rx="2" fill="' + Y + '"/></g><text x="110" y="106" text-anchor="middle">memory full: pictures deleted</text>',
    blur: '<g class="rp-pix">' + [0, 1, 2, 3, 4, 5].map(function (i) { return [0, 1, 2].map(function (j) { return '<rect x="' + (38 + i * 24) + '" y="' + (14 + j * 24) + '" width="23" height="23" fill="' + ((i + j) % 2 ? '#1d2a4a' : '#22305a') + '"/>'; }).join(''); }).join('') + '</g>' +
      '<circle cx="110" cy="50" r="5" fill="' + O + '" class="rp-flick"/><text x="110" y="106" text-anchor="middle">the fire hides inside one big pixel</text>'
  };
  W.replay = function (kind) {
    return REPLAYS[kind] ? '<svg class="replay" viewBox="0 0 220 112" role="img" aria-label="What went wrong">' + REPLAYS[kind] + '</svg>' : '';
  };

  /** Turn {orbit} style markers in teaching text into tappable glossary words. */
  W.terms = function (text) {
    return W.esc(text).replace(/\{(\w+)\}/g, function (m, key) {
      var g = D.GLOSSARY[key];
      if (!g) return key;
      return '<button type="button" class="term" data-act="term" data-term="' + key + '">' + W.esc(g[0].toLowerCase()) + '</button>';
    });
  };

  /* ---------- the numbers printed on an option card ---------- */
  W.chips = function (group, item) {
    var out = []; // [icon, hidden word for screen readers, value]
    if (group === 'orbit') {
      var g = P.dayGeometry(Object.keys(D.ORBITS).filter(function (k) { return D.ORBITS[k] === item; })[0]);
      out.push(['up', 'height', W.num(item.alt) + ' km']);
      out.push(['moon', 'in shadow', g.shadowFrac < 0.005 ? 'no shadow' : Math.round(g.shadowFrac * 100) + '% dark']);
    } else {
      if (item.mass != null) out.push(['kg', 'weighs', item.mass + ' kg']);
      if (item.watts != null) out.push(['sun', 'makes', W.num(item.watts) + ' W']);
      if (item.wh != null) out.push(['batt', 'holds', W.num(item.wh) + ' Wh']);
      if (item.power != null) out.push(['bolt', 'uses', item.power + ' W']);
      if (item.mbps != null) out.push(['radio', 'sends', W.num(item.mbps) + ' Mbps']);
      if (item.data != null) out.push(['disk', 'makes', item.data + ' GB/day']);
      if (item.cost != null) out.push(['coin', 'costs', M.fmtMoney(item.cost)]);
    }
    return out.map(function (t) {
      return '<span class="chip" data-kind="' + t[0] + '" title="' + t[1] + '">' + W.icon(t[0]) + '<span class="sr">' + t[1] + ' </span>' + W.esc(t[2]) + '</span>';
    }).join('');
  };

  function withPick(design, group, key) {
    var t = JSON.parse(JSON.stringify(design));
    if (group === 'extras') { if (t.extras.indexOf(key) < 0) t.extras.push(key); }
    else t[group] = key;
    return t;
  }

  /**
   * One sentence, worked out for the player's own design, saying what this
   * option would mean. Returns {text, level: 'ok' | 'warn' | 'bad' | ''}.
   */
  W.liveLine = function (group, key, design, diff) {
    var t = withPick(design, group, key), ev = M.evaluate(t, diff);
    var orbit = t.orbit && D.ORBITS[t.orbit];
    var text = '', level = '';
    if (group === 'sensor') {
      var s = D.SENSORS[key], alt = orbit ? orbit.alt : 700, blur = t.pointing ? D.POINTING[t.pointing].blur : 1;
      var px = P.pixelMeters(alt, s.ifov, blur);
      text = (orbit ? 'From your orbit: ' : 'From 700 km up: ') + M.fmtPixel(px) + ' pixels, a strip ' + W.num(P.swathKm(alt, s.scanHalfDeg)) + ' km wide.';
      level = px <= 500 ? 'ok' : px <= 10000 ? 'warn' : 'bad';
    } else if (group === 'orbit') {
      var g = ev.geometry;
      text = 'One lap takes ' + (g.periodMin < 200 ? Math.round(g.periodMin) + ' minutes' : 'a whole day') + ' at ' + W.num(Math.round(g.speedKms * 3.6) * 1000) + ' km/h.';
      if (ev.pixel != null) {
        var cov = ev.coverage, seen = cov.zones - cov.neverSeen.length;
        text += ' Your sensor here: ' + M.fmtPixel(ev.pixel) + ' pixels, flies over ' + seen + ' of ' + cov.zones + ' fire zones.';
        level = !ev.sizes.length ? 'bad' : (cov.neverSeen.length || ev.sizes.indexOf('small') < 0) ? 'warn' : 'ok';
      }
    } else if (group === 'bus') {
      var b = D.BUSES[key];
      text = 'Carries ' + b.payloadCap + ' kg of instruments. Yours: ' + W.num(ev.payloadMass) + ' kg.';
      level = ev.payloadMass > b.payloadCap ? 'bad' : 'ok';
    } else if (group === 'panels') {
      var bus = t.bus && D.BUSES[t.bus];
      if (bus && bus.panels.indexOf(key) < 0) { text = 'Cannot be mounted on the ' + bus.name.toLowerCase() + '.'; level = 'bad'; }
      else {
        text = 'Your satellite needs about ' + W.num(Math.ceil(ev.genNeed / 5) * 5) + ' W from its wings.';
        level = ev.watts < ev.genNeed ? 'bad' : ev.watts * 0.8 < ev.genNeed ? 'warn' : 'ok';
      }
    } else if (group === 'battery') {
      if (ev.shadowMin < 1) { text = 'Up here there is almost no shadow, so any battery will do.'; level = 'ok'; }
      else {
        text = 'Each shadow uses about ' + W.num(Math.ceil(ev.battNeed / 5) * 5) + ' Wh.';
        level = ev.battWh < ev.battNeed ? 'bad' : ev.battWh * 0.8 < ev.battNeed ? 'warn' : 'ok';
      }
    } else if (group === 'computer') {
      var c = D.COMPUTERS[key];
      text = 'Memory: ' + c.storage + ' GB. ' + (c.radHard ? 'Safe in a solar storm.' : 'Not safe in a solar storm.');
      level = c.radHard ? 'ok' : 'warn';
    } else if (group === 'pointing') {
      if (ev.pixel != null) {
        text = 'Your pixels: ' + M.fmtPixel(ev.pixel) + (ev.blur > 1 ? ', blurred.' : ', sharp.');
        level = !ev.sizes.length ? 'bad' : ev.sizes.indexOf('small') < 0 ? 'warn' : 'ok';
      }
    } else if (group === 'radio') {
      var per = ev.linkRate * 10;
      text = 'Sends ' + (per < 10 ? Math.round(per * 10) / 10 : W.num(per)) + ' GB in a 10-minute pass' + (orbit && orbit.kind === 'geo' ? ' (far orbit: one tenth speed)' : '') + '.';
      if (t.network) {
        text += ' About ' + W.num(ev.downPerDay) + ' GB a day with your stations. You make ' + W.num(ev.dataGen) + '.';
        level = ev.downPerDay < ev.dataGen ? 'bad' : 'ok';
      } else text += ' Your instruments make ' + W.num(ev.dataGen) + ' GB a day.';
    } else if (group === 'network') {
      if (ev.contact) {
        text = 'Station time: ' + W.num(ev.contact.minutesPerDay) + ' minutes a day. Longest wait: ' + M.fmtHours(ev.contact.maxGapMin / 60) + '.';
        if (t.radio) {
          text += ' Can send ' + W.num(ev.downPerDay) + ' GB a day. You make ' + W.num(ev.dataGen) + '.';
          level = ev.downPerDay < ev.dataGen ? 'bad' : 'ok';
        }
      }
    } else if (group === 'rocket') {
      if (!orbit) return { text: '', level: '' };
      if (ev.cap == null) { text = 'Does not fly to the ' + orbit.short.toLowerCase() + '.'; level = 'bad'; }
      else {
        text = 'Lifts ' + W.num(ev.cap) + ' kg to your orbit. Your satellite: ' + W.num(ev.mass) + ' kg.';
        level = ev.mass > ev.cap ? 'bad' : 'ok';
      }
    }
    return { text: text, level: level };
  };

  /* ---------- resource gauges ---------- */
  var METER_ICON = { Money: 'coin', Mass: 'kg', Power: 'bolt', Data: 'disk', Sharpness: 'eye' };
  function meter(name, big, small, frac, level) {
    var pct = frac == null ? 0 : Math.max(3, Math.min(100, frac * 100));
    var word = { ok: 'OK', tight: 'Tight', over: 'Too much', idle: '' }[level];
    return '<div class="meter" data-level="' + level + '">' +
      '<div class="meter-top"><span class="meter-ico">' + W.icon(METER_ICON[name]) + '</span><span class="meter-name">' + name + '</span><span class="meter-state">' + word + '</span></div>' +
      '<div class="meter-num">' + big + '</div>' +
      '<div class="meter-bar"><i style="width:' + pct.toFixed(0) + '%"></i></div>' +
      '<div class="meter-sub">' + small + '</div></div>';
  }
  function lvl(use, have, tight) { return use > have ? 'over' : use > have * (tight || 0.8) ? 'tight' : 'ok'; }

  W.gauges = function (ev, d) {
    var out = '';
    if (isFinite(ev.budget)) {
      out += meter('Money', M.fmtMoney(ev.cost), 'of ' + M.fmtMoney(ev.budget), ev.cost / ev.budget, lvl(ev.cost, ev.budget, 0.95));
    } else out += meter('Money', M.fmtMoney(ev.cost), 'no limit in sandbox', null, 'idle');

    if (ev.cap != null) out += meter('Mass', W.num(ev.mass) + ' kg', 'rocket lifts ' + W.num(ev.cap) + ' kg', ev.mass / ev.cap, lvl(ev.mass, ev.cap, 0.97));
    else out += meter('Mass', W.num(ev.mass) + ' kg', d.rocket && d.orbit ? 'rocket cannot reach this orbit' : 'rocket comes last', null, d.rocket && d.orbit ? 'over' : 'idle');

    if (d.panels) out += meter('Power', 'needs ' + W.num(Math.ceil(ev.genNeed / 5) * 5) + ' W', 'wings make ' + W.num(ev.watts) + ' W', ev.genNeed / ev.watts, lvl(ev.genNeed, ev.watts));
    else out += meter('Power', 'uses ' + W.num(ev.load) + ' W', 'wings come later', null, 'idle');

    if (d.radio && d.network && d.orbit) out += meter('Data', W.num(ev.dataGen) + ' GB a day', 'radio sends ' + W.num(ev.downPerDay), ev.dataGen / Math.max(ev.downPerDay, 0.01), lvl(ev.dataGen, ev.downPerDay, 0.9));
    else out += meter('Data', W.num(ev.dataGen) + ' GB a day', 'radio comes later', null, 'idle');

    if (ev.pixel != null) {
      var see = !ev.sizes.length ? 'no fires visible' : ev.sizes.indexOf('small') >= 0 ? 'sees small fires' : ev.sizes.indexOf('medium') >= 0 ? 'medium fires and up' : 'large fires only';
      var lv = !ev.sizes.length ? 'over' : ev.sizes.indexOf('small') >= 0 ? 'ok' : 'tight';
      out += meter('Sharpness', M.fmtPixel(ev.pixel) + ' pixels', see, Math.min(1, 500 / ev.pixel), lv).replace('Too much', 'Too blurry').replace('Tight', 'Blurry');
    } else out += meter('Sharpness', 'not known yet', 'needs a sensor and an orbit', null, 'idle');
    return out;
  };

  /* ---------- “what your sensor sees” ---------- */
  var SCENE_W = 6000, SCENE_H = 4600; // metres of ground shown
  var FIRES = [
    { key: 'small', x: 1150, y: 3500, d: 170 },
    { key: 'medium', x: 2300, y: 1350, d: 620 },
    { key: 'large', x: 4300, y: 2800, d: 1750 }
  ];

  /** Draw the real scene (left) and the satellite's heat picture (right). */
  W.drawSight = function (canvas, pixelM) {
    var g = canvas.getContext('2d'), CW = canvas.width, CH = canvas.height;
    var gap = 16, w = (CW - gap) / 2, h = CH, k = w / SCENE_W;
    var rnd = RG.Stage.seeded(5);
    g.clearRect(0, 0, CW, CH);

    // left: the ground as a person in a plane would see it
    g.save();
    g.beginPath(); g.rect(0, 0, w, h); g.clip();
    g.fillStyle = '#31452e'; g.fillRect(0, 0, w, h);
    for (var i = 0; i < 70; i++) {
      g.fillStyle = rnd() > 0.5 ? 'rgba(20,40,20,0.35)' : 'rgba(120,130,70,0.22)';
      g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 10 + rnd() * 40, 6 + rnd() * 22, rnd() * 3, 0, 7); g.fill();
    }
    g.strokeStyle = 'rgba(110,160,200,0.8)'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(-5, h * 0.2); g.bezierCurveTo(w * 0.3, h * 0.5, w * 0.6, h * 0.05, w + 5, h * 0.42); g.stroke();
    FIRES.forEach(function (f) {
      var r = Math.max(2.5, (f.d / 2) * k), x = f.x * k, y = f.y * k;
      var gr = g.createRadialGradient(x, y, 0, x, y, r * 1.5);
      gr.addColorStop(0, '#fff4b8'); gr.addColorStop(0.45, '#ff8a1e'); gr.addColorStop(1, 'rgba(160,30,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 1.5, 0, 7); g.fill();
      g.font = 'bold ' + Math.round(h * 0.085) + 'px sans-serif'; g.textAlign = 'center';
      g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.fillStyle = '#fff';
      var ty = y - r * 1.5 - 6 < 20 ? y + r * 1.5 + 22 : y - r * 1.5 - 6;
      g.strokeText(f.key, x, ty); g.fillText(f.key, x, ty);
    });
    g.restore();

    // right: what the heat sensor records, one square per pixel
    var x0 = w + gap, cell = Math.max(3, pixelM * k);
    g.save();
    g.beginPath(); g.rect(x0, 0, w, h); g.clip();
    for (var cy = 0; cy < h; cy += cell) {
      for (var cx = 0; cx < w; cx += cell) {
        var heat = 0;
        for (var j = 0; j < FIRES.length; j++) {
          var f = FIRES[j];
          if (pixelM > D.FIRE_SIZES[f.key].maxPixel) continue;
          var fx = f.x * k, fy = f.y * k, fr = Math.max(1.5, (f.d / 2) * k);
          var nx = Math.max(cx, Math.min(fx, cx + cell)), ny = Math.max(cy, Math.min(fy, cy + cell));
          if ((nx - fx) * (nx - fx) + (ny - fy) * (ny - fy) <= fr * fr) {
            heat = Math.max(heat, Math.min(1, 0.4 + 0.6 * (f.d / pixelM)));
          }
        }
        if (heat > 0) {
          var a = Math.round(120 + 120 * heat), b = Math.round(40 + 190 * heat * heat);
          g.fillStyle = 'rgb(255,' + a + ',' + b + ')';
        } else {
          var n = Math.round(rnd() * 10);
          g.fillStyle = 'rgb(' + (22 + n) + ',' + (30 + n) + ',' + (62 + n) + ')';
        }
        g.fillRect(x0 + cx, cy, cell + 0.5, cell + 0.5);
      }
    }
    if (cell >= 10) {
      g.strokeStyle = 'rgba(255,255,255,0.13)'; g.lineWidth = 1;
      g.beginPath();
      for (var gx = 0; gx <= w; gx += cell) { g.moveTo(x0 + gx, 0); g.lineTo(x0 + gx, h); }
      for (var gy = 0; gy <= h; gy += cell) { g.moveTo(x0, gy); g.lineTo(x0 + w, gy); }
      g.stroke();
    }
    g.restore();
  };

  RG.Widgets = W;
})();
