// Loads the game's simulation scripts (no DOM) into a fresh VM context.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SIM_FILES = ['rng', 'names', 'governments', 'earth-data', 'mapgen', 'economy', 'sim', 'balance', 'empire', 'blocs', 'federal', 'coalitions', 'laws', 'characters', 'tech', 'movements', 'events', 'campaign'];

function loadGame() {
  const ctx = vm.createContext({ console, Math, JSON });
  for (const f of SIM_FILES) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
  }
  return { ctx, run: code => vm.runInContext(code, ctx) };
}

module.exports = { loadGame, SIM_FILES };
