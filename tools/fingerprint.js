// Game-state fingerprints: a hash of the whole game state after N years, for a few seeds.
// Used to check that a refactor changes nothing: node tools/fingerprint.js [years...]
// It hashes every number at full precision (saves round to 6 digits) and the
// provinces as they stand, including transient caches (keys starting with _),
// so even a tiny drift shows up.
const crypto = require('crypto');
const { loadGame } = require('./load');
const years = process.argv.slice(2).map(Number).filter(n => n > 0);
const seeds = ['fp-a', 'fp-b', 'fp-c'];
for (const seed of seeds) {
  const { run } = loadGame();
  run(`var __g = createGame(${JSON.stringify(seed)}, { size: 'small', countries: 10 }); setPlayer(__g, 0); var __m = 0;
    // Full-precision state: everything a save holds, plus the provinces and caches. Cycles are cut by skipping
    // objects already written on the current path.
    function __state(g) {
      const seen = new WeakSet();
      const walk = (v) => {
        if (v === null || typeof v !== 'object') return typeof v === 'number' && !isFinite(v) ? String(v) : v;
        if (seen.has(v)) return '[ref]';
        seen.add(v);
        if (Array.isArray(v)) return v.map(walk);
        if (v instanceof Set) return [...v].map(walk);
        if (v instanceof Map) return [...v.entries()].map(walk);
        const o = {};
        for (const k of Object.keys(v).sort()) if (typeof v[k] !== 'function') o[k] = walk(v[k]);
        return o;
      };
      return JSON.stringify(walk({ month: g.month, week: g.week, countries: g.countries, wars: g.wars, log: g.log, rng: g.rng.getState(),
        provinces: g.world.provinces, worldMarket: g.worldMarket, blocs: g.blocs, stats: g.stats, flags: g.flags, scheduled: g.scheduled,
        reparations: g.reparations, worldWars: g.worldWars, priceHist: g.priceHist, truces: g.truces, cultures: g.cultures, faiths: g.faiths }));
    }`);
  const out = [];
  for (const y of (years.length ? years : [10, 40])) {
    const json = run(`(() => { while (__m < ${y * 12}) { tick(__g); __g.pending.length = 0; __m++; } return __state(__g); })()`);
    out.push(`${y}y ${crypto.createHash('sha256').update(json).digest('hex').slice(0, 16)}`);
  }
  console.log(seed, out.join('  '));
}
