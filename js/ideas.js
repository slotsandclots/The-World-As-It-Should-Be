'use strict';
// Milestone 3d: universities, kinship between peoples, and ideas that travel.
//
// Universities: education spending above the basics builds higher
// education. Graduates speed research, staff the state (officials), and give
// the intelligentsia clout.
//
// Kinship: cultures belong to families of related peoples. Kin across the
// border count toward nationalist claims (at half weight), kin nations get
// on better, and strong, like-minded kin neighbors can unite peacefully.
//
// Ideas: liberalism, socialism, fascism and traditionalism are currents that
// travel between nations along borders, trade and bloc ties. Prosperous,
// stable regimes inspire imitation; a revolution sends a shock wave through
// its neighbors. Currents feed the matching movements and pull public
// opinion, so revolutions can spread like 1848 or 1989.
//
// p.uni share of adults with higher education · game.families [{ id, name, members: [cultureId] }]
// c.currents { liberalism, socialism, fascism, traditionalism } · c.ideaShock (same keys)

// ------------------------------------------------------------------ universities

function tickUniversities(game, c) {
  const edu = c.policy.education || 0;
  let s = 0, n = 0;
  let s2 = 0;
  for (const p of c._provs || []) {
    const target = clamp((edu - 3) * 0.025 + (p.lit || 0) * 0.08 - 0.02, 0, 0.35);
    p.uni = (p.uni || 0.02) + (target - (p.uni || 0.02)) * 0.004;
    // Secondary schools come before universities: they need literacy and a basic budget.
    const secT = clamp((edu - 1.5) * 0.07 + (p.lit || 0) * 0.3 - 0.05, 0, 0.7);
    p.sec = (p.sec == null ? secT * 0.8 : p.sec) + (secT - (p.sec == null ? secT * 0.8 : p.sec)) * 0.006;
    s += p.uni * p.pop; s2 += p.sec * p.pop; n += p.pop;
  }
  c.uni = n ? s / n : 0;
  c.sec = n ? s2 / n : 0;
}

// ------------------------------------------------------------------ kinship

function ensureFamilies(game) {
  if (game.families || !game.cultures) return;
  const rng = makeRng(String(game.seed) + ':families');
  const provs = game.world.provinces;
  const center = c => { const p = provs[c.capital]; return p ? [p.lx, p.ly] : [0, 0]; };
  const free = game.countries.filter(c => c.alive).map(c => c.id);
  const fam = [];
  const prefixes = ['Pan-', 'Greater ', 'Old ', 'Common '];
  while (free.length) {
    const a = free.splice(rng.int(0, free.length - 1), 1)[0];
    const members = [a];
    // One or two nearest neighbors share the family, about half the time.
    const near = free.map(id => [id, (center(game.countries[id])[0] - center(game.countries[a])[0]) ** 2 + (center(game.countries[id])[1] - center(game.countries[a])[1]) ** 2]).sort((x, y) => x[1] - y[1]);
    const k = rng.chance(0.55) ? (rng.chance(0.4) ? 2 : 1) : 0;
    for (const [id] of near.slice(0, k)) { members.push(id); free.splice(free.indexOf(id), 1); }
    const root = game.cultures[a].name.replace(/(ian|an|ic|i|ese|ish)$/, '');
    fam.push({ id: fam.length, name: members.length > 1 ? `${rng.pick(prefixes)}${root}ic peoples` : game.cultures[a].name, members: members.map(id => game.countries[id].culture) });
  }
  game.families = fam;
  for (const f of fam) for (const cu of f.members) if (game.cultures[cu]) game.cultures[cu].family = f.id;
}

function kinCultures(game, a, b) {
  const A = game.cultures && game.cultures[a], B = game.cultures && game.cultures[b];
  return !!(A && B && a !== b && A.family != null && A.family === B.family);
}

function kinNations(game, c, t) { return kinCultures(game, c.culture, t.culture); }

// Yearly: strong, like-minded kin neighbors may unite peacefully.
function tickUnification(game) {
  ensureFamilies(game);
  for (const c of game.countries) {
    if (!c.alive || c.id === game.player || c.overlord != null || isAtWar(game, c.id)) continue;
    for (const n of getNeighbors(game, c.id)) {
      const t = game.countries[n];
      if (!t.alive || t.id === game.player || t.overlord != null || isAtWar(game, t.id) || !kinNations(game, c, t)) continue;
      if (t.pop > c.pop * 0.7) continue;
      const rel = relation(game, c.id, t.id), like = ideoDist(GOVS[c.gov], GOVS[t.gov]);
      const pull = ((t.currents && t.currents.fascism) || 0) + (t.movements && t.movements.nationalist ? t.movements.nationalist.support / 40 : 0);
      if (rel > 45 && like < 0.7 && game.rng.chance(0.05 + pull * 0.1)) { unite(game, c, t); return; }
    }
  }
}

function unite(game, big, small) {
  makeSubject(game, big.id, small.id, 'protectorate', 'unification');
  if (small.overlord !== big.id) return;
  absorbSubject(game, small.id, true);
  logNews(game, `${small.name} and ${big.name} unite: the ${game.families[game.cultures[big.culture].family].name} are joined under one flag.`, 'gov', [big.id, small.id]);
  if (game.player >= 0) toastPlayer(game, `${small.name} unites with ${big.name}.`, 'info');
}

// The player can propose unification to a smaller kin nation.
DIPLO_ACTIONS.push({
  id: 'unify', name: 'Propose Unification', pc: 40, desc: 'Unite with a smaller nation of our kin. They accept if relations are warm (60+), our regimes are alike, and nationalism runs high there.',
  check: (game, c, t) => {
    ensureFamilies(game);
    if (!kinNations(game, c, t) || t.overlord != null) return 'hidden';
    if (atWarWith(game, c.id, t.id)) return 'hidden';
    if (t.pop > c.pop * 0.8) return 'They are too large to join us.';
    if (relation(game, c.id, t.id) < 60) return 'Relations too low (need 60).';
    return null;
  },
  run(game, c, t) {
    const like = ideoDist(GOVS[c.gov], GOVS[t.gov]);
    const pull = ((t.currents && t.currents.fascism) || 0) + (t.movements && t.movements.nationalist ? t.movements.nationalist.support / 40 : 0);
    if (like > 0.8 || !game.rng.chance(clamp(0.3 + pull * 0.5 - like * 0.4, 0.05, 0.9))) { addRel(game, c.id, t.id, -10); return `The ${formalName(t)} declines to give up its independence.`; }
    unite(game, c, t);
    return `${t.name} joins us. Our people are united.`;
  },
});

// ------------------------------------------------------------------ ideas

const CURRENTS = {
  liberalism: { name: 'Liberalism', pos: [0.2, -0.6], govs: ['democracy', 'constMonarchy'], movement: 'liberal' },
  socialism: { name: 'Socialism', pos: [-0.8, 0.3], govs: ['communist'], movement: 'labor' },
  fascism: { name: 'Fascism', pos: [0.5, 0.9], govs: ['fascist'], movement: 'nationalist' },
  traditionalism: { name: 'Traditionalism', pos: [0.4, 0.6], govs: ['absMonarchy', 'theocracy'], movement: 'clerical' },
};
const CURRENT_KEYS = Object.keys(CURRENTS);
const CURRENT_OF_GOV = {};
for (const k of CURRENT_KEYS) for (const gv of CURRENTS[k].govs) CURRENT_OF_GOV[gv] = k;

function tickIdeas(game) {
  const alive = game.countries.filter(c => c.alive);
  for (const c of alive) {
    c.currents = c.currents || {}; c.ideaShock = c.ideaShock || {};
    for (const k of CURRENT_KEYS) { if (!(c.currents[k] >= 0)) c.currents[k] = 0; if (!(c.ideaShock[k] >= 0)) c.ideaShock[k] = 0; }
    // Who inspires us: neighbors, trade partners and bloc partners, weighted by how well their regime is doing.
    const w = Object.fromEntries(CURRENT_KEYS.map(k => [k, 0]));
    let tot = 0, totP = 0;
    const add = (s, weight) => {
      const k = CURRENT_OF_GOV[s.gov];
      const prestige = Math.pow(Math.max(0.1, s.gdp) / Math.max(0.1, c.gdp), 0.3) * clamp(s.stability / 50, 0.2, 1.6) * clamp(1 + (s.econ && s.econ.avgSol ? (s.econ.avgSol - 40) / 40 : 0), 0.4, 1.8);
      tot += weight; totP += weight * prestige;
      if (k) w[k] += weight * prestige;
    };
    for (const n of getNeighbors(game, c.id)) add(game.countries[n], 1);
    for (const t of c.trade || []) if (game.countries[t] && game.countries[t].alive) add(game.countries[t], 0.5);
    for (const b of blocsOf(game, c.id)) for (const m of b.members) if (m !== c.id && game.countries[m].alive) add(game.countries[m], 0.4);
    const press = typeof pressStrength === 'function' ? 0.6 + pressStrength(c) * 0.6 : 1;
    for (const k of CURRENT_KEYS) {
      const t = clamp((totP ? w[k] / totP : 0) * 0.25 * press + c.ideaShock[k], 0, 1);
      c.currents[k] += (t - c.currents[k]) * 0.03;
      c.ideaShock[k] *= 0.97;
      // Ideas pull public opinion a little.
      const P = CURRENTS[k].pos, s = c.currents[k] * 0.0015;
      c.ideo.econ = clamp(c.ideo.econ + (P[0] - c.ideo.econ) * s, -1, 1);
      c.ideo.auth = clamp(c.ideo.auth + (P[1] - c.ideo.auth) * s, -1, 1);
    }
  }
}

// A new regime sends a shock wave of its idea through its neighbors.
function ideaShock(game, c, newGov) {
  const k = CURRENT_OF_GOV[newGov];
  if (!k || !game.countries) return;
  for (const n of getNeighbors(game, c.id)) {
    const t = game.countries[n];
    if (!t.alive) continue;
    t.ideaShock = t.ideaShock || {};
    t.ideaShock[k] = (t.ideaShock[k] || 0) + 0.25;
  }
}

// How much inspiration from abroad boosts a movement.
function ideaBoost(c, movementKey) {
  if (!c.currents) return 1;
  for (const k of CURRENT_KEYS) if (CURRENTS[k].movement === movementKey) return 1 + c.currents[k];
  return 1;
}
