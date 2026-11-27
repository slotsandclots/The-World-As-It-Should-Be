// Balance report: run many AI-only worlds and summarize what happens.
// Usage:
//   node tools/balance-report.js [--seeds 6] [--years 40] [--out file.json] [--compare file.json]
// The design philosophy (ROADMAP.md) asks for every layer to be measured
// across many seeds before the next goes on top; this is that measurement.
const fs = require('fs');
const { run } = require('./load').loadGame();

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const SEEDS = +opt('seeds', 6), YEARS = +opt('years', 40);
const MODELS = ['continents', 'pangaea', 'archipelago'];

const worlds = [];
const t0 = Date.now();
for (let i = 0; i < SEEDS; i++) {
  const seed = 'bal-' + i, model = MODELS[i % MODELS.length];
  const w = run(`(() => {
    const g = createGame(${JSON.stringify(seed)}, { model: ${JSON.stringify(model)}, countries: 14 });
    const months = ${YEARS} * 12, t = Date.now();
    ensurePeoples(g); tickPeoples(g);
    const pop0 = g.countries.reduce((t, c) => t + (c.alive ? c.pop : 0), 0);
    const minority0 = g.countries.filter(c => c.alive).reduce((s, c) => s + (c._minority || 0), 0) / g.countries.filter(c => c.alive).length;
    let migrants = 0;
    const warStart = {}, warLen = [], yearGdp = {}, unemp = [], stab = [], lowStab = { n: 0, of: 0 }, accY = {};
    const startPrices = {}; const priceSeries = {}; const infl = [], rates = [], creditGdp = [], conf = [];
    for (let m = 0; m < months; m++) {
      tick(g); g.pending.length = 0;
      for (const w of g.wars) if (warStart[w.id] == null) warStart[w.id] = g.month;
      for (const id in warStart) if (warStart[id] >= 0 && !g.wars.some(w => w.id === +id)) { warLen.push(g.month - warStart[id]); warStart[id] = -1; }
      if (g.month % 12 === 0) for (const c of g.countries) if (c.migYear) migrants += c.migYear.in / Math.max(1, c.pop);
      for (const c of g.countries) {
        if (!c.alive) continue;
        stab.push(c.stability); lowStab.of++; if (c.stability < CRISIS_LEVEL) lowStab.n++;
        unemp.push(c.econ.unemployment || 0);
        // Annual totals of real output, as statistics offices measure them; years with a war or a regime change are flagged.
        const a = accY[c.id] || (accY[c.id] = { y: 0, pop: 0, war: false, gov: c.gov });
        a.y += c.econ.gdpRealM || c.econ.gdpM; a.pop += c.pop; if (isAtWar(g, c.id)) a.war = true; if (c.gov !== a.gov) a.reg = true;
        if (g.month % 12 === 0) { (yearGdp[c.id] = yearGdp[c.id] || []).push({ gdp: a.y, pc: a.y / Math.max(1, a.pop), prov: c.provinceCount, calm: !a.war && !a.reg }); accY[c.id] = { y: 0, pop: 0, war: false, gov: c.gov }; if (g.month > 60) { infl.push(inflationYoY(c)); rates.push(c.econ.rate || 0); creditGdp.push((c.econ.credit || 0) / Math.max(1, (c.econ.gdpRealM || c.econ.gdpM) * 12)); conf.push(c.econ.conf || 1); } }
      }
      if (g.worldMarket && g.worldMarket.prices) for (const k in GOODS) { const p = g.worldMarket.prices[k]; if (p != null) (priceSeries[k] = priceSeries[k] || []).push(p / GOODS[k].base); }
    }
    const ms = (Date.now() - t) / months;
    // Economy: annual growth per nation.
    // Per-person GDP, skipping years when the nation's borders changed, so
    // conquests and secessions don't count as booms or busts.
    const growth = [], growthTotal = [], calmGrowth = [], acfPairs = [[], [], [], [], [], []];
    let recessions = 0, depressions = 0, nationYears = 0;
    for (const id in yearGdp) {
      const s = yearGdp[id];
      let peak = s[0].pc, inSlump = false;
      for (let k = 1; k < s.length; k++) {
        const gt = s[k].gdp / s[k - 1].gdp - 1;
        if (isFinite(gt)) growthTotal.push(gt);
        if (s[k].prov !== s[k - 1].prov) { peak = s[k].pc; inSlump = false; continue; }
        const gr = s[k].pc / s[k - 1].pc - 1;
        if (!isFinite(gr) || s[k - 1].pc <= 0) continue;
        growth.push(gr); nationYears++;
        if (s[k].calm && s[k - 1].calm) calmGrowth.push(gr);
        s[k].gr = gr;
        for (let L = 1; L <= 5; L++) { const q = s[k - L]; if (q && q.gr != null && q.prov === s[k].prov) acfPairs[L].push([q.gr, gr]); }
        if (gr < 0) recessions++;
        peak = Math.max(peak, s[k].pc);
        if (s[k].pc < peak * 0.9 && !inSlump) { depressions++; inSlump = true; }
        if (s[k].pc >= peak) inSlump = false;
      }
    }
    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
    const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
    const priceCV = mean(Object.values(priceSeries).map(s => sd(s.slice(60)) / Math.max(1e-9, mean(s.slice(60)))));
    const priceRange = mean(Object.values(priceSeries).map(s => { const t = s.slice(60); return Math.max(...t) / Math.max(1e-9, Math.min(...t)); }));
    const L = g.log;
    const count = re => L.filter(n => re.test(n.text)).length;
    const crisisKinds = {};
    for (const n of L) if (n.kind === 'crisis') { const m = n.text.match(/: ([a-z' -]+)\\./); const k = m ? m[1] : /into the streets/.test(n.text) ? 'interest group takes to the streets' : 'other'; crisisKinds[k] = (crisisKinds[k] || 0) + 1; }
    const alive = g.countries.filter(c => c.alive);
    const govs = {}; for (const c of alive) govs[c.gov] = (govs[c.gov] || 0) + 1;
    const sol = mean(alive.map(c => c.econ.avgSol));
    const ineq = mean(alive.map(c => c.econ.strataSol.upper / Math.max(1, c.econ.strataSol.lower)));
    const electionLines = L.filter(n => n.kind === 'election' && /election:/.test(n.text));
    return {
      seed: ${JSON.stringify(seed)}, model: ${JSON.stringify(model)}, msPerMonth: +ms.toFixed(1),
      regimeChanges: g.stats.regimeChanges, wars: g.stats.wars, warMonthsMean: +mean(warLen).toFixed(1),
      capitulations: count(/capitulates/), negotiatedPeace: count(/negotiated peace/),
      elections: electionLines.length, hung: electionLines.filter(n => /short of a majority/.test(n.text)).length,
      lawsAdopted: count(/adopts a new law/), referendums: count(/referendum/),
      crises: crisisKinds, survivors: alive.length, govs,
      growthMean: +(mean(growth) * 100).toFixed(2), growthSd: +(sd(growth) * 100).toFixed(2), growthTotalSd: +(sd(growthTotal) * 100).toFixed(2), calmFalling: +(calmGrowth.filter(x => x < 0).length / Math.max(1, calmGrowth.length)).toFixed(3),
      recessionShare: +(recessions / Math.max(1, nationYears)).toFixed(3), depressions,
      priceCV: +priceCV.toFixed(3), priceRange: +priceRange.toFixed(2),
      sol: +sol.toFixed(1), inequality: +ineq.toFixed(2),
      unemployment: +(mean(unemp) * 100).toFixed(2), unemploymentMax: +(Math.max(...unemp) * 100).toFixed(1),
      stability: +mean(stab).toFixed(1), crisisShare: +(lowStab.n / Math.max(1, lowStab.of)).toFixed(3),
      inflation: +(mean(infl) * 100).toFixed(2), inflationSd: +(sd(infl) * 100).toFixed(2), hyperinflation: infl.filter(x => x > 0.5).length, deflationShare: +(infl.filter(x => x < 0).length / Math.max(1, infl.length)).toFixed(3), rate: +(mean(rates) * 100).toFixed(2),
      urbanShare: +(mean(alive.map(c => c.urbanShare || 0)) * 100).toFixed(1), slumShare: +(mean(alive.map(c => c.slumShare || 0)) * 100).toFixed(2),
      rentBurden: +(mean(alive.map(c => c.rentBurden || 0)) * 100).toFixed(2), elderly: +(mean(alive.map(c => c.elderly || 0)) * 100).toFixed(1),
      popGrowth: +((Math.pow(g.countries.reduce((t, c) => t + (c.alive ? c.pop : 0), 0) / pop0, 1 / ${YEARS}) - 1) * 100).toFixed(2),
      minorityStart: +(minority0 * 100).toFixed(1), minorityEnd: +(mean(alive.map(c => c._minority || 0)) * 100).toFixed(1), grievance: +(mean(alive.map(c => c._grievance || 0)) * 100).toFixed(2),
      immigration: +(migrants / Math.max(1, alive.length) / ${YEARS} * 100).toFixed(3), claimWars: count(/bring its people/), claimsHeld: alive.reduce((t, c) => t + (c.claims || []).length, 0),
      creditGdp: +(mean(creditGdp) * 100).toFixed(1), confidence: +mean(conf).toFixed(2),
      bankingCrises: count(/Bank run|Banking crisis/), bankruptcyWaves: count(/Bankruptcies sweep/),
      acf: acfPairs.slice(1).map(P => { if (P.length < 10) return 0; const mx = mean(P.map(x => x[0])), my = mean(P.map(x => x[1])); let a = 0, bx = 0, by = 0; for (const [x, y] of P) { a += (x - mx) * (y - my); bx += (x - mx) ** 2; by += (y - my) ** 2; } return +(a / Math.sqrt(bx * by)).toFixed(2); }),
      sane: g.countries.filter(c => c.alive && ![c.stability, c.approval, c.gdp, c.treasury, c.pop].every(isFinite)).length,
    };
  })()`);
  worlds.push(w);
  process.stdout.write(`  ${w.seed} (${w.model}): ${w.msPerMonth} ms/month\n`);
}

const NUM = ['regimeChanges', 'wars', 'warMonthsMean', 'capitulations', 'negotiatedPeace', 'elections', 'hung', 'lawsAdopted', 'referendums', 'survivors',
  'growthMean', 'growthSd', 'growthTotalSd', 'calmFalling', 'recessionShare', 'depressions', 'priceCV', 'priceRange', 'sol', 'inequality', 'unemployment', 'unemploymentMax', 'inflation', 'inflationSd', 'deflationShare', 'hyperinflation', 'rate', 'creditGdp', 'confidence', 'bankingCrises', 'bankruptcyWaves', 'urbanShare', 'slumShare', 'rentBurden', 'elderly', 'popGrowth', 'minorityStart', 'minorityEnd', 'grievance', 'immigration', 'claimWars', 'claimsHeld', 'stability', 'crisisShare', 'msPerMonth'];
const LABEL = {
  regimeChanges: 'Regime changes / world', wars: 'Wars / world', warMonthsMean: 'War length (months)', capitulations: 'Capitulations', negotiatedPeace: 'Negotiated peaces',
  elections: 'Free elections', hung: 'Hung parliaments', lawsAdopted: 'Laws adopted', referendums: 'Referendum news', survivors: 'Nations surviving (of 14)',
  growthMean: 'GDP per person growth, mean %/yr', growthSd: 'GDP per person growth, std dev (pp)', growthTotalSd: 'Total GDP growth std dev, incl. borders', calmFalling: 'Calm years with falling GDP/person (target <0.2)', recessionShare: 'Share of nation-years with falling GDP/person', depressions: 'Depressions (GDP/person >10% below peak)',
  priceCV: 'World price volatility (CV)', priceRange: 'World price max/min ratio', sol: 'Living standard (end)', inequality: 'Upper/lower living standard',
  inflation: 'Inflation, mean %/yr', inflationSd: 'Inflation, std dev (pp)', deflationShare: 'Share of nation-years with deflation', hyperinflation: 'Nation-years above 50% inflation', rate: 'Interest rate, mean %', creditGdp: 'Private debt, % of GDP', confidence: 'Business confidence, mean', bankingCrises: 'Banking crises / world', bankruptcyWaves: 'Bankruptcy waves / world', urbanShare: 'City dwellers, % of people (end)', slumShare: 'In slums, % of people (end)', rentBurden: 'Excess rent, % of urban income', elderly: 'Elderly, % of people (end)', popGrowth: 'World population growth, %/yr',
  minorityStart: 'Minorities, % of people (start)', minorityEnd: 'Minorities, % of people (end)', grievance: 'Minority grievance (x100)', immigration: 'Immigration, % of pop per year', claimWars: 'Wars to bring our people home', claimsHeld: 'Provinces claimed by nationalists (end)', unemployment: 'Unemployment, mean %', unemploymentMax: 'Unemployment, worst %', stability: 'Stability, mean', crisisShare: 'Share of nation-months in crisis', msPerMonth: 'Speed (ms/month)',
};
const avg = k => worlds.reduce((s, w) => s + w[k], 0) / worlds.length;
const summary = {};
for (const k of NUM) summary[k] = +avg(k).toFixed(3);
const crises = {};
for (const w of worlds) for (const k in w.crises) crises[k] = (crises[k] || 0) + w.crises[k] / worlds.length;

const report = { date: new Date().toISOString().slice(0, 10), seeds: SEEDS, years: YEARS, summary, crises, worlds };
let base = null;
const cmp = opt('compare');
if (cmp && fs.existsSync(cmp)) base = JSON.parse(fs.readFileSync(cmp, 'utf8'));

console.log(`\nBalance report: ${SEEDS} worlds × ${YEARS} years (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
for (const k of NUM) {
  const v = summary[k], b = base && base.summary[k];
  const delta = b != null ? `   (baseline ${b}${b ? `, ${v >= b ? '+' : ''}${((v / b - 1) * 100).toFixed(0)}%` : ''})` : '';
  console.log(`  ${LABEL[k].padEnd(38)} ${String(v).padStart(9)}${delta}`);
}
const acfAvg = [0, 1, 2, 3, 4].map(i => +(worlds.reduce((t, w) => t + (w.acf ? w.acf[i] : 0), 0) / worlds.length).toFixed(2));
summary.acf = acfAvg;
console.log(`\n  Growth autocorrelation at 1..5 years: ${acfAvg.join('  ')}   (a cycle: positive at 1, negative at 3-5)`);
console.log('\n  Crises per world:');
for (const [k, v] of Object.entries(crises).sort((a, b) => b[1] - a[1])) console.log(`    ${k.padEnd(44)} ${v.toFixed(1)}`);
const bad = worlds.reduce((s, w) => s + w.sane, 0);
if (bad) console.log(`\n  WARNING: ${bad} sanity problems found.`);
const out = opt('out');
if (out) { fs.writeFileSync(out, JSON.stringify(report, null, 1)); console.log(`\nSaved to ${out}`); }
