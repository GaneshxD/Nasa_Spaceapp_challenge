'use strict';
/* The game's own rules, shared with the browser.
 * js/core/*.js has no browser code and attaches itself to globalThis.RG, so the
 * server checks picks and launches with exactly the code the players run.
 */
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..', '..');

require(path.join(root, 'assets', 'nasa-fires.js'));
require(path.join(root, 'js', 'core', 'data.js'));
require(path.join(root, 'js', 'core', 'physics.js'));
require(path.join(root, 'js', 'core', 'model.js'));

const RG = globalThis.RG;
module.exports = { DATA: RG.DATA, Model: RG.Model, blankDesign: RG.blankDesign };
