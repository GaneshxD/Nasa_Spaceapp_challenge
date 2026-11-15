/* Orbit Ranger — “what went wrong” replays.
 * Tiny looping cartoons shown when a flight or a mission fails, one per cause.
 */
(function () {
  'use strict';
  var RG = window.RG, W = RG.Widgets = RG.Widgets || {};

  /* ---------- “what went wrong” replays: tiny looping cartoons ---------- */
  var R = W.palette.red, B = W.palette.blue, O = W.palette.orange, Y = W.palette.yellow;
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
})();
