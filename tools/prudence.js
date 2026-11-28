// The prudent-nation check (ROADMAP, "Playing tall": proof, kept true).
//
// Does prudence pay? Each world is played twice from the same start: once as
// usual, and once with one mid-sized nation held to prudent choices:
//   - regulated banks (insured deposits, capped leverage)
//   - an independent central bank (not gold, not state money)
//   - no printing money to cover deficits
// Everything else (taxes, spending, diplomacy, wars) stays in the AI's hands.
// The same nation is then compared across the two runs, world by world, so the
// difference is prudence rather than luck. The world itself should stay stormy.
//
// Separating the political cost from the economic one (ROADMAP, "Playing tall", next step 1):
//   --pick middle      the middle-sized nation, whatever its regime (default)
//   --pick democracy   the middle-sized democracy (free elections), whose voters choose such laws
//   --mode impose      the laws are held in place from the start, whatever the interest groups think (default)
//   --mode accepted    each law is adopted only once the decision-makers back it (lawSupport ≥ 50%),
//                      through enactLaw so the interest groups react as to any law; then it is kept
//
// Usage: node tools/prudence.js [--seeds 12] [--years 40] [--from 0] [--pick middle|democracy] [--mode impose|accepted] [--out file.json]
const fs = require('fs');
const { run } = require('./load').loadGame();

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const SEEDS = +opt('seeds', 12), YEARS = +opt('years', 40), FROM = +opt('from', 0);
const PICK = opt('pick', 'middle'), MODE = opt('mode', 'impose');
if (!['middle', 'democracy'].includes(PICK) || !['impose', 'accepted'].includes(MODE)) throw new Error('--pick middle|democracy, --mode impose|accepted');
const MODELS = ['continents', 'pangaea', 'archipelago'];

function play(seed, model, prudent) {
  return run(`(() => {
    const g = createGame(${JSON.stringify(seed)}, { model: ${JSON.stringify(model)}, countries: 14 });
    const FULL = [], keepNews = logNews;
    logNews = (game, text, kind, ids) => { FULL.push({ m: game.month, text, ids: ids || [] }); keepNews(game, text, kind, ids); };
    // The nation in the middle of the world by size: neither a giant nor a minnow
    // (with --pick democracy, the middle one of the nations with free elections, if there are any).
    const all = g.countries.filter(c => c.alive).sort((a, b) => b.gdp - a.gdp);
    const dem = all.filter(c => GOVS[c.gov].elections === 'free');
    const byGdp = ${JSON.stringify(PICK)} === 'democracy' && dem.length ? dem : all;
    const c = byGdp[Math.floor(byGdp.length / 2)], id = c.id, gov0 = c.gov;
    const PRUDENT = [['banking', 'regulated'], ['monetary', 'centralBank']];
    let lawMonths = 0, adopted = {};
    const months = ${YEARS} * 12;
    let stab = 0, crisis = 0, alive = 0, govChanges = 0, lastGov = c.gov, gdp0 = c.gdpPerCap, worldStab = 0, worldN = 0;
    for (let m = 0; m < months; m++) {
      if (${prudent} && c.alive) {
        c.policy.monetize = false;
        for (const [cat, o] of PRUDENT) {
          if (${JSON.stringify(MODE)} === 'impose') c.laws[cat] = o;
          // Accepted: adopted once the decision-makers back it, then kept.
          else if (c.laws[cat] !== o && (adopted[cat] || lawSupport(g, c, cat, o) >= 0.5)) { enactLaw(g, c, cat, o); adopted[cat] = true; }
          if (c.reform && c.reform.cat === cat && (${JSON.stringify(MODE)} === 'impose' || adopted[cat])) c.reform = null;
        }
        if (PRUDENT.every(([cat, o]) => c.laws[cat] === o)) lawMonths++;
      }
      tick(g); g.pending.length = 0;
      if (!c.alive) continue;
      alive++; stab += c.stability; if (c.stability < CRISIS_LEVEL) crisis++;
      if (c.gov !== lastGov) { govChanges++; lastGov = c.gov; }
      for (const o of g.countries) if (o.alive && o.id !== id) { worldStab += o.stability; worldN++; }
    }
    const mine = re => FULL.filter(n => n.ids.includes(id) && re.test(n.text)).length;
    const years = Math.max(1, alive / 12);
    return {
      seed: ${JSON.stringify(seed)}, nation: c.name, gov: gov0, democracy: GOVS[gov0].elections === 'free', survived: c.alive,
      lawShare: lawMonths / months,
      stability: stab / Math.max(1, alive), crisisShare: crisis / Math.max(1, alive),
      growth: c.alive && gdp0 > 0 ? (Math.pow(c.gdpPerCap / gdp0, 1 / years) - 1) * 100 : null,
      regimeChanges: govChanges,
      bankingCrises: mine(/Bank run|Banking crisis/), debtCrises: mine(/Lenders refuse/), payCrises: mine(/runs out of foreign currency/),
      bankruptcyWaves: mine(/Bankruptcies sweep/), hyperYears: 0,
      worldStability: worldStab / Math.max(1, worldN),
    };
  })()`);
}

const rows = [];
const t0 = Date.now();
for (let i = FROM; i < FROM + SEEDS; i++) {
  const seed = 'prudence-' + i, model = MODELS[i % MODELS.length];
  const a = play(seed, model, false), b = play(seed, model, true);
  rows.push({ seed, nation: a.nation, usual: a, prudent: b });
  process.stdout.write('.');
}
const KEYS = [['stability', 'Stability, mean', +1], ['crisisShare', 'Share of months in crisis', -1], ['growth', 'Growth per person, %/yr', +1], ['regimeChanges', 'Regime changes', -1],
  ['bankingCrises', 'Banking crises', -1], ['debtCrises', 'Debt crises', -1], ['payCrises', 'Balance-of-payments crises', -1], ['bankruptcyWaves', 'Bankruptcy waves', -1], ['worldStability', 'Rest of the world: stability', 0]];
const mean = xs => { const v = xs.filter(x => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : NaN; };
const summary = {};
const who = PICK === 'democracy' ? 'mid-sized democracy' : 'mid-sized nation', how = MODE === 'impose' ? 'held to prudent choices' : 'adopting prudent laws once its decision-makers back them';
console.log(`\n\nPrudent-nation check: ${SEEDS} worlds × ${YEARS} years, the same ${who} played as usual and ${how} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
console.log(`Democracies picked: ${rows.filter(r => r.usual.democracy).length} of ${rows.length}; prudent laws in place ${(mean(rows.map(r => r.prudent.lawShare)) * 100).toFixed(0)}% of months.\n`);
console.log('Measure'.padEnd(34) + 'As usual'.padStart(10) + 'Prudent'.padStart(10) + '   Better in');
for (const [k, label, dir] of KEYS) {
  const u = mean(rows.map(r => r.usual[k])), p = mean(rows.map(r => r.prudent[k]));
  const pairs = rows.filter(r => r.usual[k] != null && r.prudent[k] != null);
  const better = dir === 0 ? null : pairs.filter(r => dir > 0 ? r.prudent[k] > r.usual[k] : r.prudent[k] < r.usual[k]).length;
  const worse = dir === 0 ? null : pairs.filter(r => dir > 0 ? r.prudent[k] < r.usual[k] : r.prudent[k] > r.usual[k]).length;
  summary[k] = { usual: +u.toFixed(3), prudent: +p.toFixed(3), better, worse, of: pairs.length };
  console.log(label.padEnd(34) + u.toFixed(2).padStart(10) + p.toFixed(2).padStart(10) + (dir === 0 ? '' : `   ${better} of ${pairs.length} worlds (worse in ${worse})`));
}
const surv = [rows.filter(r => r.usual.survived).length, rows.filter(r => r.prudent.survived).length];
summary.survived = { usual: surv[0], prudent: surv[1], of: rows.length };
console.log('Nation survived'.padEnd(34) + String(surv[0]).padStart(10) + String(surv[1]).padStart(10) + `   of ${rows.length}`);
const out = opt('out', null);
if (out) fs.writeFileSync(out, JSON.stringify({ date: new Date().toISOString().slice(0, 10), seeds: SEEDS, years: YEARS, from: FROM, pick: PICK, mode: MODE, summary, rows }, null, 1));
