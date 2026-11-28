// Game-state fingerprints: a hash of the saved game after N years, for a few seeds.
// Used to check that a refactor changes nothing: node tools/fingerprint.js [years...]
const crypto = require('crypto');
const { loadGame } = require('./load');
const years = process.argv.slice(2).map(Number).filter(n => n > 0);
const seeds = ['fp-a', 'fp-b', 'fp-c'];
for (const seed of seeds) {
  const { run } = loadGame();
  run(`var __g = createGame(${JSON.stringify(seed)}, { size: 'small', countries: 10 }); setPlayer(__g, 0); var __m = 0;`);
  const out = [];
  for (const y of (years.length ? years : [10, 40])) {
    const json = run(`(() => { while (__m < ${y * 12}) { tick(__g); __g.pending.length = 0; __m++; } return serializeGame(__g); })()`);
    out.push(`${y}y ${crypto.createHash('sha256').update(json).digest('hex').slice(0, 16)}`);
  }
  console.log(seed, out.join('  '));
}
