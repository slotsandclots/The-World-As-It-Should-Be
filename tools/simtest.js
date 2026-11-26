// Headless balance check: generates a world and lets the AI run it for N years.
// Usage: node tools/simtest.js [seed] [years]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = vm.createContext({ console, Math, JSON });
for (const f of ['rng', 'names', 'governments', 'earth-data', 'mapgen', 'economy', 'sim', 'characters', 'events', 'campaign']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
}

const seed = process.argv[2] || 'test';
const years = +(process.argv[3] || 50);
const out = vm.runInContext(`(() => {
  const t0 = Date.now();
  const game = createGame(${JSON.stringify(seed)}, { countries: 14 });
  const genMs = Date.now() - t0;
  const w = game.world;
  const summary = () => game.countries.filter(c => c.alive).map(c =>
    c.name.padEnd(12) + ' ' + GOVS[c.gov].short.padEnd(16) + ' prov ' + String(c.provinceCount).padStart(3) +
    ' pop ' + (c.pop / 1e6).toFixed(1).padStart(5) + 'M  gdp/c ' + c.gdpPerCap.toFixed(1).padStart(5) +
    ' stab ' + c.stability.toFixed(0).padStart(3) + ' appr ' + c.approval.toFixed(0).padStart(3) +
    ' unrest ' + c.unrest.toFixed(0).padStart(3) + ' debt% ' + (-c.treasury / c.gdp * 100).toFixed(0).padStart(4));
  const lines = ['gen ' + genMs + 'ms, provinces ' + w.provinces.length + ', seaLinks ' + w.seaLinks.length, ...summary()];
  const t1 = Date.now();
  for (let i = 0; i < ${years} * 12; i++) { tick(game); game.pending.length = 0; }
  lines.push('--- after ${years} years (' + (Date.now() - t1) + 'ms)');
  lines.push(...summary());
  lines.push('alive ' + game.countries.filter(c => c.alive).length + ', regime changes ' + game.stats.regimeChanges + ', wars ' + game.stats.wars + ', ongoing ' + game.wars.length);
  const kinds = {};
  for (const l of game.log) kinds[l.kind] = (kinds[l.kind] || 0) + 1;
  lines.push('log kinds ' + JSON.stringify(kinds));
  lines.push(...game.log.filter(l => l.kind === 'gov' || l.kind === 'war').slice(-15).map(l => gameDate(game, l.m) + ': ' + l.text));
  const s = serializeGame(game);
  const g2 = deserializeGame(s);
  tick(g2);
  lines.push('save size ' + (s.length / 1024).toFixed(0) + 'KB, reload ok, month ' + g2.month);
  return lines.join('\\n');
})()`, ctx);
console.log(out);
