/* Orbit Ranger — icons and Pip.
 * Every picture in the interface is an inline SVG drawn here: chunky, glossy
 * sticker icons on a 48×48 grid, and Pip the guide with five moods.
 */
(function () {
  'use strict';
  var RG = window.RG, W = RG.Widgets = RG.Widgets || {};

  W.esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* ---------- icons: chunky, glossy sticker drawings on a 48×48 grid ---------- */
  // the palette: a light and a dark tone of each colour, for a body and its shaded side
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
  W.palette = { red: R, blue: B, orange: O, yellow: Y };
})();
