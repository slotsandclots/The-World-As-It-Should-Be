// Economic diagnostics: node tools/econtest.js [seed] [years]
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ctx = vm.createContext({ console, Math, JSON });
for (const f of ['rng', 'names', 'governments', 'earth-data', 'mapgen', 'economy', 'sim', 'characters', 'events', 'campaign']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
}
const seed = process.argv[2] || 'test';
const years = +(process.argv[3] || 20);
console.log(vm.runInContext(`(() => {
  const t0 = Date.now();
  const game = createGame(${JSON.stringify(seed)}, { countries: 14 });
  const L = ['init ' + (Date.now() - t0) + 'ms'];
  const report = label => {
    L.push('=== ' + label + ' (' + gameDate(game) + ')');
    const wm = game.worldMarket;
    L.push('world price/base: ' + GOOD_KEYS.map(g => g + ' ' + (wm.prices[g] / GOODS[g].base).toFixed(2) + (wm.S[g] ? '(s/d ' + (wm.S[g] / Math.max(1, wm.D[g])).toFixed(2) + ')' : '')).join(', '));
    for (const c of game.countries.filter(c => c.alive)) {
      const E = c.econ;
      const share = t => (E.popType[t] / c.pop * 100).toFixed(0);
      const lv = c => provincesOf(game, c.id).reduce((s, p) => s + p.buildings.reduce((a, b) => a + b.level, 0), 0);
      L.push(c.name.padEnd(11) + GOVS[c.gov].short.padEnd(15) + 'tech ' + E.tech.toFixed(2) + ' gdp/c ' + c.gdpPerCap.toFixed(1).padStart(5) +
        ' gr ' + (c.growthAvg * 1200).toFixed(1).padStart(5) + '% sol L/M/U ' + [E.strataSol.lower, E.strataSol.middle, E.strataSol.upper].map(v => v.toFixed(0)).join('/') +
        ' unemp ' + (E.unemployment * 100).toFixed(0) + '% peas ' + share('peasants') + '% wrk ' + share('workers') + '% lab ' + share('laborers') +
        '% lit ' + (E.literacy * 100).toFixed(0) + ' bld ' + lv(c) + ' proj ' + E.projects.length + ' pool ' + (E.investPool / 1e6).toFixed(1) +
        ' debt ' + (-c.treasury / c.gdp * 100).toFixed(0) + '% appr ' + c.approval.toFixed(0) + ' stab ' + c.stability.toFixed(0) + ' arms ' + E.armsRatio.toFixed(2) + ' tau ' + E.tau.toFixed(2) + ' pop ' + (c.pop / 1e6).toFixed(1));
    }
  };
  report('start');
  const t1 = Date.now();
  for (let i = 0; i < ${years} * 12; i++) { tick(game); game.pending.length = 0; if (i === 59) report('5 years'); }
  L.push('tick avg ' + ((Date.now() - t1) / (${years} * 12)).toFixed(1) + 'ms');
  report('${years} years');
  const s = serializeGame(game); const g2 = deserializeGame(s); tick(g2);
  L.push('save ' + (s.length / 1024).toFixed(0) + 'KB reload ok; regime changes ' + game.stats.regimeChanges + ', wars ' + game.stats.wars + ', alive ' + game.countries.filter(c => c.alive).length);
  return L.join('\\n');
})()`, ctx));
