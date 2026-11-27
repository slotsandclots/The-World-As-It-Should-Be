'use strict';
// The simulation: one tick = one month. Pure logic, no DOM, so it can be run
// headless (see tools/simtest.js).

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ADMIN_COST = 3; // % of GDP spent on running the state regardless of policy
const POLICY_LIMITS = {
  tax: { min: 0.05, max: 0.7, step: 0.01, label: 'Tax rate', hint: 'Revenue. High taxes slow growth and anger business and workers.' },
  military: { min: 0, max: 12, step: 0.1, label: 'Military', hint: 'Army size and military loyalty.' },
  welfare: { min: 0, max: 25, step: 0.1, label: 'Welfare', hint: 'Approval and worker loyalty.' },
  education: { min: 0, max: 10, step: 0.1, label: 'Education', hint: 'Growth and intelligentsia loyalty; makes the public more liberal.' },
  police: { min: 0, max: 8, step: 0.1, label: 'Police & security', hint: 'Suppresses unrest and props up stability, but erodes freedom.' },
  infrastructure: { min: 0, max: 10, step: 0.1, label: 'Infrastructure', hint: 'Productivity of every building, and business loyalty. Buys steel, timber and tools.' },
  investment: { min: 0, max: 12, step: 0.1, label: 'State investment', hint: 'Funds state construction of new buildings (see Industry below).' },
  tariff: { min: 0, max: 0.5, step: 0.01, label: 'Tariffs', hint: 'Tax on imports: revenue and protection for local producers, but dearer goods and less trade.' },
};
const SPEND_KEYS = ['military', 'welfare', 'education', 'police', 'infrastructure', 'investment'];

// ------------------------------------------------------------------ helpers

function gameDate(game, m) {
  if (m === undefined) m = game.month;
  return MONTH_NAMES[m % 12] + ' ' + (game.startYear + Math.floor(m / 12));
}

function ideoDist(a, b) { return Math.hypot(a.econ - b.econ, a.auth - b.auth); }

function logNews(game, text, kind, ids) {
  game.log.push({ m: game.month, text, kind: kind || 'info', ids: ids || [] });
  if (game.log.length > 600) game.log.shift();
}

function isPlayer(game, c) { return c.id === game.player; }

function notify(game, title, text, extra) { game.pending.push(Object.assign({ type: 'notice', title, text }, extra || {})); }
function toastPlayer(game, text, kind) { game.pending.push({ type: 'toast', text, kind: kind || 'info' }); }

function addMod(c, key, v, months, label) {
  c.mods.push({ key, v, months, label: label || key });
}
function sumMods(c) {
  const out = {};
  for (const m of c.mods) out[m.key] = (out[m.key] || 0) + m.v;
  return out;
}

// Apply a bundle of instant changes. money = fraction of annual GDP.
function adjust(c, fx) {
  for (const k in fx) {
    const v = fx[k];
    if (!v) continue;
    if (FACTIONS[k]) c.factions[k] = clamp(c.factions[k] + v, 0, 100);
    else if (k === 'money') c.treasury += v * (c.gdpNom || c.gdp);
    else if (k === 'econ' || k === 'auth') c.ideo[k] = clamp(c.ideo[k] + v, -1, 1);
    else if (k === 'pc') c.pc = clamp(c.pc + v, 0, 100);
    else if (k in c) c[k] = clamp(c[k] + v, 0, 100);
  }
}

function weightedLoyalty(c, base) {
  let s = 0, w = 0;
  for (const f in base) { s += c.factions[f] * base[f]; w += base[f]; }
  return w ? s / w : 50;
}

function avgLoyalty(c) {
  let s = 0;
  for (const f of FACTION_KEYS) s += c.factions[f];
  return s / FACTION_KEYS.length;
}

function clampPolicy(p) {
  for (const k in POLICY_LIMITS) p[k] = clamp(p[k], POLICY_LIMITS[k].min, POLICY_LIMITS[k].max);
}

function formalName(c) { return federalFormal(c, GOVS[c.gov].formal(c.name, c.provinceCount)); }

function leaderTitle(c) {
  if (c.gov === 'absMonarchy') return c.leader.female ? 'Queen' : 'King';
  return GOVS[c.gov].title;
}
function leaderLine(c) { return `${leaderTitle(c)} ${c.leader.name}`; }

function rulingPartyObj(c) { return c.parties.find(p => p.id === c.rulingParty) || c.parties[0]; }

function relation(game, a, b) {
  if (a === b) return 100;
  const v = game.countries[a].relations[b];
  return v === undefined ? 0 : v;
}
function setRel(game, a, b, v) {
  v = clamp(v, -100, 100);
  game.countries[a].relations[b] = v;
  game.countries[b].relations[a] = v;
}
function addRel(game, a, b, dv) { setRel(game, a, b, relation(game, a, b) + dv); }

// ------------------------------------------------------------------ geography

function recomputeCountry(game, c) {
  let pop = 0, tiles = 0, n = 0;
  for (const p of game.world.provinces) {
    if (p.owner !== c.id) continue;
    pop += p.pop; tiles += p.tiles; n++;
  }
  c.pop = pop; c.tiles = tiles; c.provinceCount = n;
  c.gdp = Math.max(0.01, c.econ ? c.econ.gdpAnnual : pop * 0.33 * c.tech * 12 / 1e6); // real, billions per year
  c.gdpNom = c.gdp * ((c.econ && c.econ.pl) || 1); // in the national currency
  c.gdpPerCap = pop > 0 ? c.gdp * 1e6 / pop : 0; // thousands of $
}

function refreshAll(game) {
  game.neighborCache = {};
  for (const c of game.countries) recomputeCountry(game, c);
}

function getNeighbors(game, id) {
  if (game.neighborCache[id]) return game.neighborCache[id];
  const set = new Set();
  const provs = game.world.provinces;
  for (const p of provs) {
    if (p.owner !== id) continue;
    for (const q of p.neighbors) {
      const o = provs[q].owner;
      if (o !== id && o >= 0) set.add(o);
    }
  }
  const arr = Array.from(set).filter(i => game.countries[i].alive);
  game.neighborCache[id] = arr;
  return arr;
}

function provincesOf(game, id) { return game.world.provinces.filter(p => p.owner === id); }

// ------------------------------------------------------------------ creation

function createGame(seed, opts) {
  opts = Object.assign({ countries: (WORLD_MODELS[opts && opts.model] || {}).countries || 14, difficulty: 'normal' }, opts || {});
  const world = generateWorld(seed, opts);
  const game = {
    seed: String(seed), opts, world, rng: makeRng(String(seed) + '|sim'),
    month: 0, startYear: 1950, countries: [], wars: [], log: [], player: -1,
    nextWarId: 1, truces: {}, pending: [], over: false, neighborCache: {}, mapDirty: true,
    lastEvents: [], stats: { regimeChanges: 0, wars: 0 }, nextCharId: 1,
  };
  world.countrySeeds.forEach((cs, i) => game.countries.push(initCountry(game, cs, i)));
  for (const p of world.provinces) p.core = p.owner; // starting land is core
  refreshAll(game);
  for (const c of game.countries) {
    c.army = armyTarget(c) * game.rng.range(0.85, 1.1);
    initCharacters(game, c);
    ensureMovements(c);
    // Developed nations start with a few technologies.
    const R = ensureResearch(c);
    const n = c.tech > 1.6 ? 3 : c.tech > 1 ? 2 : c.tech > 0.6 ? 1 : 0;
    for (let i = 0; i < n; i++) { const opts = TECH_KEYS.filter(id => techAvailable(c, id)); R.done.push(game.rng.pick(opts)); }
  }
  initEconomy(game);
  refreshAll(game);
  for (const c of game.countries) {
    c.treasury = c.gdp * game.rng.range(0.0, 0.15);
    c.budget = projectBudget(c);
  }
  initRelations(game);
  logNews(game, `The world enters a new era. ${game.countries.length} nations vie for their place in history.`, 'info');
  return game;
}

function initCountry(game, cs, id) {
  const rng = game.rng;
  const gov = rng.weighted(GOV_ORDER, k => GOV_START_WEIGHTS[k]);
  const g = GOVS[gov];
  const c = {
    id, name: cs.name, adj: cs.adj, color: cs.color, rgb: cs.rgb, capital: cs.capital, alive: true,
    gov, prevGov: null, monthsInRegime: rng.int(24, 240),
    ideo: { econ: clamp(g.econ * 0.55 + rng.normal() * 0.25, -1, 1), auth: clamp(g.auth * 0.5 + rng.normal() * 0.25, -1, 1) },
    tech: Math.exp(rng.range(Math.log(0.35), Math.log(2.2))), gdpPerCap: 0, growthAvg: 0.0015, lastGrowth: 0.0015, econ: null,
    pop: 0, gdp: 0, tiles: 0, provinceCount: 0, treasury: 0, army: 0, budget: null,
    policy: defaultPolicy(gov),
    approval: rng.range(42, 62), stability: rng.range(48, 70), unrest: rng.range(5, 20),
    freedom: clamp(g.freedom + rng.range(-8, 8), 0, 100), corruption: clamp(g.corruption + rng.range(-8, 8), 0, 100),
    legitimacy: g.legitimacy,
    factions: {}, parties: [], rulingParty: null, leader: null, dynasty: null,
    nextElection: null, emergency: false, flags: {}, mods: [],
    relations: {}, allies: [], trade: [], warExhaustion: 0, warMomentum: 0, pc: 30,
    hist: { approval: [], stability: [], gdp: [] }, lastElection: null, termsWon: 0,
  };
  for (const f of FACTION_KEYS) c.factions[f] = clamp(rng.range(40, 62) + (g.base[f] ? 8 : 0), 0, 100);
  c.parties = makeParties(game, c);
  c.rulingParty = topPollParty(c);
  c.leader = makeLeader(game, c);
  if (gov === 'absMonarchy') c.dynasty = c.leader.last;
  if (g.elections) c.nextElection = rng.int(3, g.term);
  return c;
}

function initRelations(game) {
  const cs = game.countries;
  for (let i = 0; i < cs.length; i++) {
    for (let j = i + 1; j < cs.length; j++) {
      setRel(game, i, j, relationTarget(game, cs[i], cs[j]) + game.rng.normal() * 15);
    }
  }
}

function singlePartyName(c) {
  const g = GOVS[c.gov];
  if (c.gov === 'communist') return `Communist Party of ${c.name}`;
  if (c.gov === 'fascist') return `${c.adj} National Unity Movement`;
  return g.partyName.replace(/^the /, '').replace(/^./, s => s.toUpperCase());
}

function makeParties(game, c) {
  const g = GOVS[c.gov];
  const rng = game.rng;
  if (g.party === 'single') {
    return [{ id: 'state', name: singlePartyName(c), econ: g.econ, auth: g.auth, color: g.color, boost: 0 }];
  }
  const always = PARTY_TEMPLATES.filter(t => t.key === 'socdem' || t.key === 'cons');
  const rest = rng.shuffle(PARTY_TEMPLATES.filter(t => t.key !== 'socdem' && t.key !== 'cons' && (t.key !== 'roy' || c.gov === 'constMonarchy' || rng.chance(0.3))));
  const chosen = always.concat(rest.slice(0, rng.int(2, 4)));
  return chosen.map(t => ({
    id: t.key,
    name: rng.chance(0.35) ? `${c.adj} ${t.name}` : t.name,
    econ: clamp(t.econ + rng.normal() * 0.08, -1, 1),
    auth: clamp(t.auth + rng.normal() * 0.08, -1, 1),
    color: t.color, boost: 0,
  }));
}

// ------------------------------------------------------------------ economy & military

function armyTarget(c) {
  // Non-core land supplies half as many soldiers.
  return c.pop * (1 - (c.nonCoreShare || 0) * 0.5) * (1 - (c.autonomousShare || 0) * 0.5) * c.policy.military * 0.004 * GOVS[c.gov].milMult * (1 + lawFx(c).army) * (c.mobilized ? 1.6 : 1);
}

function strength(c) {
  const arms = c.econ ? c.econ.armsRatio : 1;
  const tech = c.econ ? c.econ.tech : c.tech;
  const gen = c.generals ? bestGeneral(c) : null;
  const command = (1 + (gen ? (gen.skills.mil - 5) * 0.03 : 0)) * (1 + (c.leader && c.leader.skills ? (c.leader.skills.mil - 5) * 0.01 : 0)) * (1 + (c.cabinet ? cabinetFx(c).strength : 0)) * (1 + techSum(c, 'strength'));
  return (1 + (c.aiArmyBonus || 0)) * command * c.army / 1000 * (0.6 + 0.4 * Math.sqrt(tech)) * (0.55 + 0.45 * Math.min(1.2, arms)) * (0.7 + 0.3 * c.stability / 100) * (0.75 + 0.5 * c.factions.military / 100);
}

function projectBudget(c) {
  const p = c.policy;
  const E = c.econ;
  const taxBase = E ? E.taxBase : c.gdp / 12;
  const pl = (E && E.pl) || 1;
  const taxes = pl * taxBase * p.tax * (1 - c.corruption / 250) * (1 - (c.nonCoreShare || 0) * 0.3) * (c.federal ? 0.95 : 1) * (1 + (c.cabinet ? cabinetFx(c).taxEff : 0) + techSum(c, 'taxEff'));
  const tariffs = E ? E.tariffRev * pl : 0;
  const stateProfit = E ? E.stateProfit * pl : 0;
  const revenue = taxes + tariffs + stateProfit;
  const spendPct = ADMIN_COST + SPEND_KEYS.reduce((s, k) => s + p[k], 0);
  const gN = c.gdpNom || c.gdp;
  const spend = gN * spendPct / 100 / 12;
  // Interest follows the money system's rate, plus a premium as debt piles up.
  const debtR = Math.max(0, -c.treasury) / Math.max(1e-6, gN);
  const rate = (E && E.rate != null ? E.rate : 0.048) + Math.max(0, debtR - 0.6) * 0.05;
  const interest = c.treasury < 0 ? -c.treasury * rate / 12 : 0;
  return { revenue, taxes, tariffs, stateProfit, spend, interest, net: revenue - spend - interest, spendPct };
}

function tickCountry(game, c) {
  const g = GOVS[c.gov], p = c.policy, rng = game.rng;
  const T = traitFx(c.leader);
  const M = sumMods(c);
  const L = c.leader.skills;
  const CF = cabinetFx(c);
  const LF = lawFx(c);
  const atWar = isAtWar(game, c.id);
  const debtRatio = Math.max(0, -c.treasury) / Math.max(1e-6, c.gdpNom || c.gdp);

  // --- Economy. Production, markets and pops run in tickEconomy (economy.js);
  // here technology advances and growth is measured.
  const E = c.econ;
  let techG = 0.0013 + (L.admin - 5) * 0.00004 + (p.education - 4) * 0.00012 + c.trade.length * 0.00005 + Math.max(0, 1.5 - E.tech) * 0.0002
    - c.corruption * 0.000006 + g.growth * 0.6 + (T.growth || 0) + (M.growth || 0) + LF.growth + rng.normal() * 0.0004;
  if (debtRatio > 0.8) techG -= (debtRatio - 0.8) * 0.002;
  E.tech = Math.max(0.1, E.tech * (1 + techG));
  tickMoney(game, c);
  tickCredit(game, c);
  c.gdpNom = c.gdp * E.pl;
  const gr = (E.gdpRealM && E.prevGdpRealM ? E.gdpRealM / E.prevGdpRealM : E.gdpM / E.prevGdpM) - 1;
  c.lastGrowth = gr;
  c.growthAvg = c.growthAvg * 0.92 + clamp(gr, -0.05, 0.05) * 0.08;
  recomputeCountry(game, c);

  // --- Budget
  c.budget = projectBudget(c);
  c.treasury += c.budget.net;
  if (-c.treasury / c.gdpNom > 1.5) sovereignDefault(game, c);

  // --- Public opinion drifts
  let de = rng.normal() * 0.004, da = rng.normal() * 0.004;
  if (p.tax > 0.4) de += 0.0015;
  if (p.welfare < 5) de -= 0.0015;
  if (c.growthAvg < 0) { de += Math.sign(c.ideo.econ || 1) * 0.002; da += 0.002; }
  da -= (c.freedom - 50) * 0.00003;
  if (atWar) da += 0.0015;
  da -= (p.education - 4) * 0.0003;
  if (M.propaganda) { de += (g.econ - c.ideo.econ) * 0.02; da += (g.auth - c.ideo.auth) * 0.02; }
  // The public's views follow the classes that make it up (see economy.js).
  de += (E.popIdeo.econ - c.ideo.econ) * 0.012; da += (E.popIdeo.auth - c.ideo.auth) * 0.012;
  c.ideo.econ = clamp(c.ideo.econ + de, -1, 1);
  c.ideo.auth = clamp(c.ideo.auth + da, -1, 1);

  // --- Freedom & corruption
  const freeT = clamp(g.freedom - p.police * 4 + (c.emergency ? -25 : 0) + (M.freedom || 0) + LF.freedom, 0, 100);
  c.freedom += (freeT - c.freedom) * 0.08;
  const corrT = clamp(g.corruption + techSum(c, 'corruption') + (T.corruption || 0) - (L.admin - 5) * 1.5 + CF.corruption + (50 - c.freedom) * 0.15 + (M.corruption || 0) + LF.corruption, 0, 100);
  c.corruption += (corrT - c.corruption) * 0.02;

  // --- Factions
  const growthA = c.growthAvg * 1200; // annualized %
  const ft = {
    military: 32 + p.military * 4.5 + (g.base.military ? 10 : 0) + (atWar ? (c.warMomentum > 0 ? 8 : c.warMomentum < 0 ? -10 : 0) : 0),
    workers: 48 + techSum(c, 'workers') - (c.sezCount || 0) * 3 + (p.welfare - 8) * 1.5 - (p.tax - 0.25) * 40 - g.econ * 12 - Math.max(0, p.police - 3) * 3 + growthA + (E.strataSol.lower - 35) * 0.4 - E.unemployment * 40,
    business: 46 + g.econ * 12 - (p.tax - 0.25) * 80 + (p.infrastructure - 3) * 2 - c.corruption * 0.1 + growthA * 2 + (E.strataSol.upper - 75) * 0.3 - p.tariff * 10,
    clergy: 48 + g.clergyBonus - (c.freedom - 50) * 0.12 + c.ideo.auth * 10 + (c.flags.clericalSchools ? 10 : 0),
    intelligentsia: 28 - (c.flags.clericalSchools ? 6 : 0) + c.freedom * 0.35 + (p.education - 4) * 3 - p.police * 2.5 - (c.emergency ? 15 : 0) + (E.strataSol.middle - 65) * 0.2,
  };
  // Interest groups also judge the state by how their own people live, and by whether their demands are met.
  ft.military += ((E.solType && E.solType.soldiers) || 40) * 0.15 - 6;
  ft.clergy += ((E.solType && E.solType.clergy) || 50) * 0.12 - 6;
  const unmet = {};
  for (const f of FACTION_KEYS) { const d = interestDemand(c, f); unmet[f] = d ? -Math.min(6, lawPreference(c, d.cat, d.opt, f) * 0.35) : 0; ft[f] += unmet[f] - radicalWingPressure(c, f); }
  c._unmet = unmet;
  for (const f of FACTION_KEYS) {
    const target = clamp(ft[f] + (T[f] || 0) + (M[f] || 0) + (CF.factions[f] || 0) + (f === 'military' ? CF.military : 0) + LF[f], 0, 100);
    c.factions[f] += (target - c.factions[f]) * 0.07;
  }

  // --- Unrest. Each target is a sum of labelled parts, kept in c._why so the
  // interface can explain every number.
  const mismatch = ideoDist(c.ideo, g);
  const unParts = [
    ['Low approval', Math.max(0, 55 - c.approval) * 1.4], ['Public opinion vs. the regime', mismatch * 14], ['War exhaustion', c.warExhaustion * 0.2],
    ['Recession', Math.max(0, -growthA) * 2], ['Unemployment', E.unemployment * 40], ['Poverty of the lower classes', Math.max(0, 30 - E.strataSol.lower) * 0.5],
    ['Cabinet', CF.unrest], ['Dissidents', dissidentPressure(c)], ['Political movements', movementPressure(c)], ['Occupied land', occupiedShare(game, c) * 45],
    ['Unintegrated conquests', (c.nonCoreShare || 0) * 18], ['Separatism', c.separatistPressure || 0], ['Special economic zones', (c.sezCount || 0) * 1.5], ['Minority grievances', (c._grievance || 0) * 30], ['Slums', (c.slumShare || 0) * 40], ['Laws', LF.unrest], ['Temporary effects', M.unrest || 0],
  ];
  let unrestT = sumParts(unParts);
  const repress = clamp(p.police / 5 * g.repression * 0.5, 0, 0.75);
  if (repress > 0) unParts.push([`Repression (−${Math.round(repress * 100)}%)`, -unrestT * repress]);
  unrestT *= 1 - repress;
  c.unrest += (clamp(unrestT, 0, 100) - c.unrest) * 0.12;

  // --- Approval
  const apParts = [
    ['Baseline', 50], ['Economic growth', clamp(growthA * 2, -15, 10)], ['Welfare spending', (p.welfare - 8) * 0.6], ['Education spending', (p.education - 4) * 0.5],
    ['Infrastructure spending', (p.infrastructure - 3) * 0.4], ['Taxes', -(p.tax - 0.25) * 60], ['Corruption', -c.corruption * 0.12], ['War exhaustion', -c.warExhaustion * 0.25],
    ['Public opinion vs. the regime', -mismatch * 8], ['Leader\'s traits', T.approval || 0], ['Temporary effects', M.approval || 0], ['National debt', -Math.max(0, debtRatio - 0.6) * 15],
    ['Contentment of the people', E.contentment * 0.5], ['Unemployment', -E.unemployment * 50], ['Leader\'s charisma', (L.cha - 5) * 0.8], ['Cabinet', CF.approval], ['Laws', LF.approval], ['The press', pressApproval(c)], ['Mobilization', c.mobilized ? -3 : 0], ['Technology', techSum(c, 'approval')],
  ];
  const apT = sumParts(apParts);
  c.approval = clamp(c.approval + (clamp(apT, 0, 100) - c.approval) * 0.1 + rng.normal() * 0.6, 0, 100);

  // --- Legitimacy
  // Autocracies grow stale: legitimacy erodes the longer a regime rules without renewal.
  const fatigue = g.elections === 'free' ? 0 : Math.min(18, Math.max(0, c.monthsInRegime - 96) / 20);
  const legT = g.legitimacy + LF.legitimacy + (c.emergency ? -20 : 0) + (M.legitimacy || 0) - fatigue - (c.nonCoreShare || 0) * 15;
  c.legitimacy += (clamp(legT, 0, 100) - c.legitimacy) * 0.02;

  // --- Stability
  const aw = g.approvalWeight;
  const baseLoy = weightedLoyalty(c, g.base);
  // The four meters: legitimacy, support, unrest, and stability derived from them.
  const clout = cloutLoyalty(c);
  c.support = clamp((0.38 * (aw * c.approval + (1 - aw) * baseLoy) + 0.2 * clout) / 0.58, 0, 100);
  const stParts = [
    ['Baseline', 8], [`Support: public approval (weight ${Math.round(aw * 100)}%)`, 0.38 * aw * c.approval], [`Support: the power base (weight ${Math.round((1 - aw) * 100)}%)`, 0.38 * (1 - aw) * baseLoy],
    ['Support: interest groups, by clout', 0.2 * clout], ['Legitimacy', 0.25 * c.legitimacy], ['Unrest', -0.4 * c.unrest], ['Police', p.police * 1.2 * g.repression],
    ['War exhaustion', -c.warExhaustion * 0.1], ['Leader\'s traits', T.stability || 0], ['Cabinet', CF.stability], ['Laws', LF.stability], ['Temporary effects', M.stability || 0], ['Unintegrated conquests', -Math.min(25, (c.nonCoreCount || 0) * 0.6)],
  ];
  const stT = sumParts(stParts);
  c.stability = clamp(c.stability + (clamp(stT, 0, 100) - c.stability) * 0.08 + rng.normal() * 1.1, 0, 100);
  c._why = { support: { target: c.support, parts: [[`Public approval (×${(0.38 * aw / 0.58).toFixed(2)})`, 0.38 * aw * c.approval / 0.58], [`Power base loyalty (×${(0.38 * (1 - aw) / 0.58).toFixed(2)})`, 0.38 * (1 - aw) * baseLoy / 0.58], ['Interest groups by clout (×0.34)', 0.2 * clout / 0.58]], rate: 1 }, approval: { target: apT, parts: apParts, rate: 0.1 }, stability: { target: stT, parts: stParts, rate: 0.08 }, unrest: { target: unrestT, parts: unParts, rate: 0.12 } };

  // --- Military
  c.army += (armyTarget(c) - c.army) * 0.06;
  c.warMomentum *= 0.7;
  if (!atWar) c.warExhaustion = Math.max(0, c.warExhaustion - 2);

  // --- Political capital & bookkeeping
  c.pc = clamp(c.pc + pcIncome(c), 0, 100);
  for (const m of c.mods) m.months--;
  c.mods = c.mods.filter(m => m.months > 0);
  for (const pt of c.parties) pt.boost *= 0.93;
  c.monthsInRegime++;
}

function sumParts(parts) { let t = 0; for (const x of parts) t += x[1]; return t; }

// Monthly political capital, broken into its parts for the interface.
function pcParts(c) {
  const g = GOVS[c.gov];
  const base = g.pcGain * (0.6 + c.stability / 120);
  const parts = [[`${g.name} (scaled by stability)`, base]];
  if (c.federal) parts.push(['Federal system (−10%)', -base * 0.1]);
  if (c.coalition && c.coalition.minority) parts.push(['Minority government (−25%)', -base * (c.federal ? 0.9 : 1) * 0.25]);
  parts.push(['Laws', lawFx(c).pc], ['Technology', techSum(c, 'pc')], ['Leader\'s traits', traitFx(c.leader).pc || 0], ['Cabinet', c.cabinet ? cabinetFx(c).pc : 0]);
  return parts;
}

function pcIncome(c) {
  return GOVS[c.gov].pcGain * (c.federal ? 0.9 : 1) * (c.coalition && c.coalition.minority ? 0.75 : 1) * (0.6 + c.stability / 120) + lawFx(c).pc + techSum(c, 'pc') + (traitFx(c.leader).pc || 0) + (c.cabinet ? cabinetFx(c).pc : 0);
}

function sovereignDefault(game, c) {
  c.treasury = -c.gdpNom * 0.9;
  adjust(c, { stability: -15, approval: -10, business: -25 });
  addMod(c, 'growth', -0.002, 12, 'Debt default');
  logNews(game, `${c.name} defaults on its national debt. Markets panic.`, 'econ', [c.id]);
  if (isPlayer(game, c)) notify(game, 'Sovereign Default', 'Our debts have become unpayable and the state has defaulted. Creditors have written down part of the debt, but the economy will suffer for a year and business is furious.');
}

// ------------------------------------------------------------------ elections

function computePolls(c) {
  const raw = c.parties.map(p => {
    const d2 = (p.econ - c.ideo.econ) ** 2 + (p.auth - c.ideo.auth) ** 2;
    let s = Math.exp(-d2 / 0.3) + 0.04;
    if (p.id === c.rulingParty) s *= clamp(0.4 + c.approval / 60, 0.5, 1.8);
    const face = p.id === c.rulingParty ? c.leader : p.leader;
    if (face && face.skills) s *= 1 + (face.skills.cha - 5) * 0.04;
    s *= 1 + p.boost;
    return Math.max(0.001, s);
  });
  const tot = raw.reduce((a, b) => a + b, 0);
  return raw.map(v => v / tot);
}

function topPollParty(c) {
  const polls = computePolls(c);
  let bi = 0;
  polls.forEach((v, i) => { if (v > polls[bi]) bi = i; });
  return c.parties[bi].id;
}

function allocateSeats(votes, seats, threshold) {
  const eligible = votes.map(v => (v >= threshold ? v : 0));
  const tot = eligible.reduce((a, b) => a + b, 0) || 1;
  const quotas = eligible.map(v => v / tot * seats);
  const out = quotas.map(Math.floor);
  let left = seats - out.reduce((a, b) => a + b, 0);
  const order = quotas.map((q, i) => [q - Math.floor(q), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0; k++, left--) out[order[k % order.length][1]]++;
  return out;
}

function runElection(game, c) {
  const g = GOVS[c.gov], rng = game.rng;
  c.nextElection = game.month + g.term;
  if (g.elections === 'sham') {
    const share = rng.range(0.93, 0.995);
    const party = c.parties[0];
    c.legitimacy = clamp(c.legitimacy + 5, 0, 100);
    c.lastElection = { month: game.month, sham: true, results: [{ id: party.id, name: party.name, color: party.color, vote: share, seats: 200 }], winner: party.id };
    logNews(game, `${c.name} holds single-list elections: ${party.name} wins ${(share * 100).toFixed(1)}% of the vote.`, 'election', [c.id]);
    if (isPlayer(game, c)) toastPlayer(game, `Elections held. ${party.name} "wins" ${(share * 100).toFixed(1)}%. Legitimacy +5.`, 'good');
    return;
  }
  const polls = computePolls(c);
  const votes = polls.map(s => Math.max(0.002, s * (1 + rng.normal() * 0.12)));
  let fraud = false, exposed = false;
  if (c.flags.fraud) {
    fraud = true; c.flags.fraud = false;
    const i = c.parties.findIndex(p => p.id === c.rulingParty);
    const tot = votes.reduce((a, b) => a + b, 0);
    if (i >= 0) votes[i] += tot * 0.18;
    exposed = rng.chance(0.35);
  }
  const tot = votes.reduce((a, b) => a + b, 0);
  const shares = votes.map(v => v / tot);
  const ES = electSeats(game, c, shares);
  const seats = ES.seats;
  let wi = 0;
  seats.forEach((s, i) => { if (s > seats[wi]) wi = i; });
  const winner = c.parties[wi].id;
  const result = {
    month: game.month, fraud, exposed, winner, prev: c.rulingParty, turnout: rng.range(0.52, 0.81),
    results: c.parties.map((p, i) => ({ id: p.id, name: p.name, color: p.color, vote: shares[i], seats: seats[i] })), prov: ES.prov, system: c.laws.electoral,
  };
  c.lastElection = result;
  const seatMap = seatsOf(result);
  const majority = (seatMap[c.rulingParty] || 0) >= MAJORITY;
  let won = winner === c.rulingParty && majority;
  // Hung parliament for the player: coalition talks (or a minority government) if we can lead one.
  let hung = null;
  if (isPlayer(game, c) && !majority) {
    const options = coalitionOptions(c, seatMap, c.rulingParty);
    const canMinority = winner === c.rulingParty;
    if (options.length || canMinority) { hung = { options, canMinority }; result.hung = true; }
    else result.winner = formGovernment(game, c, seatMap, c.rulingParty).lead;
  }
  if (exposed) {
    adjust(c, { stability: -15, legitimacy: -25, intelligentsia: -20, approval: -10 });
    logNews(game, `Election fraud exposed in ${c.name}! Protesters fill the streets.`, 'election', [c.id]);
  }
  if (won || (winner === c.rulingParty && !isPlayer(game, c))) {
    c.legitimacy = Math.max(c.legitimacy, 72);
    c.approval = clamp(c.approval + 2, 0, 100);
  }
  const wp = c.parties[wi];
  logNews(game, `${c.name} election: ${wp.name} wins ${seats[wi]}/200 seats (${(shares[wi] * 100).toFixed(1)}%)${seats[wi] >= MAJORITY ? ', an outright majority' : ', short of a majority'}.`, 'election', [c.id]);
  if (isPlayer(game, c)) {
    if (won) { c.termsWon++; c.coalition = null; }
    game.pending.push(Object.assign({ type: 'election', result, won }, hung ? { hung: true, options: hung.options, canMinority: hung.canMinority } : {}));
  } else {
    applyGovernment(game, c, formGovernment(game, c, seatMap));
  }
}

function setRulingParty(game, c, pid) {
  const oldParty = rulingPartyObj(c), oldLeader = c.leader;
  c.rulingParty = pid;
  const np = rulingPartyObj(c);
  // The winning party's leader takes office; the loser goes into opposition.
  c.leader = np.leader || makeLeader(game, c);
  c.leader.role = 'leader';
  np.leader = null;
  if (oldParty && oldParty.id !== pid) { oldLeader.role = 'opposition'; oldLeader.party = oldParty.id; oldParty.leader = oldLeader.age < 75 ? oldLeader : null; }
  c.cabinet = {};
  initCharacters(game, c, { generals: true, heir: true, dissidents: true });
  c.legitimacy = Math.max(c.legitimacy, 70);
  if (!isPlayer(game, c)) {
    const pt = rulingPartyObj(c), p = c.policy;
    p.tax = lerp(p.tax, 0.27 - pt.econ * 0.1, 0.5);
    p.welfare = lerp(p.welfare, 9 - pt.econ * 6, 0.5);
    p.police = lerp(p.police, 1.5 + pt.auth * 1.5, 0.5);
    p.military = lerp(p.military, 2.5 + pt.auth * 1.5, 0.5);
    clampPolicy(p);
  }
}

// ------------------------------------------------------------------ regime change

function changeGovernment(game, c, newGov, how, opts) {
  opts = opts || {};
  const old = c.gov, g = GOVS[newGov];
  const oldFormal = formalName(c);
  c.prevGov = old;
  c.gov = newGov;
  // Coups and reforms keep society's institutions; revolutions remake them.
  const oldLaws = c.laws;
  c.laws = presetLaws(newGov);
  if (oldLaws && how !== 'revolution') for (const k of ['church', 'economy', 'labor', 'electoral', 'monetary', 'banking', 'migration']) if (oldLaws[k]) c.laws[k] = oldLaws[k];
  c.reform = null;
  if (g.party === 'multi' && GOVS[old].party === 'multi') {
    // keep the existing party system
  } else {
    c.parties = makeParties(game, c);
    c.rulingParty = null;
  }
  c.rulingParty = g.party === 'single' ? 'state' : (c.rulingParty && c.parties.some(p => p.id === c.rulingParty) ? c.rulingParty : topPollParty(c));
  if (opts.leader) { c.leader = opts.leader; c.leader.role = 'leader'; }
  else if (!opts.keepLeader) {
    // Revolutions are led by dissidents where there are any.
    const dis = how === 'revolution' && (c.dissidents || []).length ? c.dissidents.slice().sort((a, b) => b.popularity - a.popularity)[0] : null;
    if (dis) { c.dissidents = c.dissidents.filter(d => d !== dis); dis.role = 'leader'; c.leader = dis; }
    else c.leader = makeLeader(game, c);
  }
  if (newGov === 'absMonarchy') c.dynasty = c.leader.last;
  if (!opts.keepLeader) c.cabinet = {};
  for (const gen of c.generals || []) gen.loyalty = clamp(gen.loyalty + (g.base.military ? 15 : -5), 0, 100);
  if (newGov !== 'absMonarchy') c.heir = null;
  if (newGov !== 'constMonarchy') c.monarch = null;
  initCharacters(game, c, { cabinet: !!opts.keepLeader, generals: true, dissidents: g.party === 'single' && GOVS[old].party === 'single' });
  c.emergency = false;
  c.flags.fraud = false;
  c.coalition = null;
  c.nextElection = g.elections ? game.month + (how === 'reform' ? 6 : 12) : null;
  c.legitimacy = how === 'reform' ? 50 : 32;
  if (how === 'reform') c.stability = clamp(c.stability - 10, 5, 100);
  else c.stability = Math.max(c.stability, 38);
  c.unrest *= how === 'reform' ? 0.8 : 0.4;
  for (const f of FACTION_KEYS) {
    if (g.base[f]) c.factions[f] = clamp(c.factions[f] + 15, 0, 100);
    else c.factions[f] = clamp(c.factions[f] - (GOVS[old].base[f] ? 15 : 6), 0, 100);
  }
  const d = defaultPolicy(newGov);
  for (const k in d) c.policy[k] = lerp(c.policy[k], d[k], how === 'reform' ? 0.3 : 0.6);
  clampPolicy(c.policy);
  c.monthsInRegime = 0;
  game.stats.regimeChanges++;

  const verb = how === 'coup' ? 'Military coup in' : how === 'revolution' ? 'Revolution in' : how === 'conquest' ? 'Regime imposed on' : 'Reform in';
  logNews(game, `${verb} ${c.name}! The ${oldFormal} is no more: the ${formalName(c)} is proclaimed under ${leaderLine(c)}.`, 'gov', [c.id]);
  if (isPlayer(game, c) && (how === 'coup' || how === 'revolution')) {
    game.pending.push({ type: 'deposed', how, gov: newGov, oldGov: old, oldFormal });
  }
}

function crisisRisk(c) {
  if (c.monthsInRegime < 3) return 0;
  const fromStability = c.stability < CRISIS_LEVEL ? (CRISIS_LEVEL - c.stability) / CRISIS_LEVEL * 0.08 : 0;
  const fromUnrest = c.unrest > 55 ? (c.unrest - 55) / 45 * 0.03 : 0;
  return fromStability + fromUnrest;
}

function pickRevolution(game, c) {
  const F = c.factions, I = c.ideo;
  const wasMon = c.prevGov === 'absMonarchy' || c.prevGov === 'constMonarchy';
  const opts = [
    { gov: 'junta', how: 'coup', w: Math.max(0, 55 - F.military) * 1.2 + 8 },
    { gov: 'communist', how: 'revolution', w: Math.max(0, -I.econ) * 45 + Math.max(0, 50 - F.workers) * 0.8 },
    { gov: 'fascist', how: 'revolution', w: Math.max(0, I.econ) * 20 + Math.max(0, I.auth) * 30 + c.warExhaustion * 0.15 },
    { gov: 'democracy', how: 'revolution', w: Math.max(0, -I.auth) * 45 + Math.max(0, 50 - F.intelligentsia) * 0.6 },
    { gov: 'theocracy', how: 'revolution', w: Math.max(0, 50 - F.clergy) * 0.3 + Math.max(0, I.auth) * 8 + 2 },
    { gov: 'absMonarchy', how: 'coup', w: wasMon ? 12 : 2 },
    { gov: 'constMonarchy', how: 'revolution', w: wasMon ? 8 : 2 },
  ].filter(o => o.gov !== c.gov);
  return game.rng.weighted(opts, o => o.w + movementRevolutionWeight(c, o.gov));
}

function checkCrisis(game, c) {
  const risk = crisisRisk(c);
  if (!risk || !game.rng.chance(risk)) return;
  const g = GOVS[c.gov];
  if (g.elections === 'free' && !c.emergency && game.rng.chance(0.55)) {
    // In a democracy the usual outlet is the government falling, not the system.
    c.nextElection = game.month + 2;
    adjust(c, { stability: 12, legitimacy: -5 });
    logNews(game, `The government of ${c.name} collapses amid mass protests. Snap elections are called.`, 'gov', [c.id]);
    if (isPlayer(game, c)) notify(game, 'Government Collapse', 'Mass protests have brought down the cabinet. Snap elections will be held in two months. Win them to restore your mandate.');
    return;
  }
  const r = pickRevolution(game, c);
  changeGovernment(game, c, r.gov, r.how);
}

// ------------------------------------------------------------------ war

function isAtWar(game, id) { return game.wars.some(w => w.a.includes(id) || w.b.includes(id)); }
function warsOf(game, id) { return game.wars.filter(w => w.a.includes(id) || w.b.includes(id)); }
function atWarWith(game, x, y) {
  return game.wars.some(w => (w.a.includes(x) && w.b.includes(y)) || (w.b.includes(x) && w.a.includes(y)));
}
function warBetween(game, x, y) {
  return game.wars.find(w => (w.a.includes(x) && w.b.includes(y)) || (w.b.includes(x) && w.a.includes(y)));
}
function truceKey(a, b) { return a < b ? a + '-' + b : b + '-' + a; }
function truceUntil(game, a, b) { return game.truces[truceKey(a, b)] || -1; }
function hasTruce(game, a, b) { return truceUntil(game, a, b) > game.month; }

function removeAlly(game, a, b) {
  const A = game.countries[a], B = game.countries[b];
  A.allies = A.allies.filter(x => x !== b);
  B.allies = B.allies.filter(x => x !== a);
}
function removeTrade(game, a, b) {
  const A = game.countries[a], B = game.countries[b];
  A.trade = A.trade.filter(x => x !== b);
  B.trade = B.trade.filter(x => x !== a);
}

function declareWar(game, aId, bId, opts) {
  opts = opts || {};
  const A = game.countries[aId], B = game.countries[bId];
  const war = { id: game.nextWarId++, name: `${A.adj}–${B.adj} War`, a: [aId], b: [bId], start: game.month, exA: 0, exB: 0, gainsA: 0, gainsB: 0, offered: -99, startProv: {} };
  war.startProv[aId] = A.provinceCount; war.startProv[bId] = B.provinceCount;
  if (opts.coalition) war.coalition = true;
  game.wars.push(war);
  game.stats.wars++;
  // Wars of aggression make a nation infamous, unless the target was itself a menace.
  if (!opts.coalition && (B.infamy || 0) < INFAMY.coalitionAt) addInfamy(game, aId, INFAMY.war);
  setRel(game, aId, bId, -100);
  removeAlly(game, aId, bId);
  removeTrade(game, aId, bId);
  const ga = GOVS[A.gov];
  if (ga.elections === 'free') adjust(A, { approval: relation(game, aId, bId) < -50 ? -2 : -8 });
  if (A.gov === 'fascist') adjust(A, { approval: 4 });
  adjust(B, { approval: 5, stability: 3 });
  logNews(game, `WAR! ${formalName(A)} declares war on ${formalName(B)}.`, 'war', [aId, bId]);
  if (bId === game.player) notify(game, 'War Declared on Us!', `${formalName(A)} under ${leaderLine(A)} has declared war on us. Raise military spending and look to our allies.`);

  for (const allyId of B.allies.slice()) {
    const ally = game.countries[allyId];
    if (!ally.alive || allyId === aId || ally.allies.includes(aId) || atWarWith(game, allyId, bId)) continue;
    if (allyId === game.player) game.pending.push({ type: 'allyCall', warId: war.id, ally: bId, enemy: aId });
    else if (game.rng.chance(0.75)) joinWar(game, war, allyId, 'b');
  }
  for (const allyId of A.allies.slice()) {
    const ally = game.countries[allyId];
    if (!ally.alive || allyId === bId || allyId === game.player || ally.allies.includes(bId)) continue;
    if (game.rng.chance(0.35)) joinWar(game, war, allyId, 'a');
  }
  // Overlords defend their subjects; subjects fight their overlords' wars.
  if (B.overlord != null && B.overlord !== aId && !war.independence && !opts.coalition) {
    const O = game.countries[B.overlord];
    if (O.alive && !war.a.includes(O.id) && !war.b.includes(O.id)) {
      if (O.id === game.player) game.pending.push({ type: 'allyCall', warId: war.id, ally: bId, enemy: aId, subject: true });
      else joinWar(game, war, O.id, 'b');
    }
  }
  for (const s of subjectsOf(game, bId)) if (!war.a.includes(s.id)) joinWar(game, war, s.id, 'b');
  if (!war.independence) blocDefense(game, war, aId, bId);
  for (const s of subjectsOf(game, aId)) if (SUBJECT_TYPES[s.subjectType].joinsWars && !war.b.includes(s.id)) joinWar(game, war, s.id, 'a');
  return war;
}

function joinWar(game, war, id, side) {
  if (war.a.includes(id) || war.b.includes(id)) return;
  war[side].push(id);
  war.startProv[id] = game.countries[id].provinceCount;
  const enemies = side === 'a' ? war.b : war.a;
  for (const e of enemies) { setRel(game, id, e, -100); removeAlly(game, id, e); removeTrade(game, id, e); }
  const c = game.countries[id];
  logNews(game, `${c.name} joins the ${war.name} on the side of ${game.countries[war[side][0]].name}.`, 'war', [id]);
  for (const s of subjectsOf(game, id)) {
    if (SUBJECT_TYPES[s.subjectType].joinsWars && !war.a.includes(s.id) && !war.b.includes(s.id)) joinWar(game, war, s.id, side);
  }
}

function sideStrength(game, ids) {
  return ids.reduce((s, id) => s + strength(game.countries[id]), 0) + 0.001;
}

function pickFrontProvince(game, winSide, loseSide) {
  const provs = game.world.provinces;
  const cands = [];
  // Land the winner already occupies is ceded first.
  const occ = provs.filter(p => loseSide.includes(p.owner) && p.occ != null && winSide.includes(p.occ));
  if (occ.length) { const p = game.rng.pick(occ); return [p.id, p.occ]; }
  for (const p of provs) {
    if (!loseSide.includes(p.owner)) continue;
    const takers = [];
    for (const q of p.neighbors) if (winSide.includes(provs[q].owner)) takers.push(provs[q].owner);
    if (takers.length) cands.push([p.id, takers]);
  }
  if (!cands.length) return null;
  const [pid, takers] = game.rng.pick(cands);
  return [pid, game.rng.pick(takers)];
}

function transferProvince(game, pid, to) {
  const pr = game.world.provinces[pid];
  const fromId = pr.owner;
  if (fromId === to) return;
  pr.occ = undefined;
  const from = game.countries[fromId], T = game.countries[to];
  pr.owner = to;
  from.flags.lostLand = game.month;
  // Track occupation: liberated land is freed, newly taken land is restless for years.
  if (pr.conquered && pr.conquered.from === to) pr.conquered = null;
  else pr.conquered = { from: pr.conquered ? pr.conquered.from : fromId, month: game.month };
  game.neighborCache = {};
  game.mapDirty = true;
  recomputeCountry(game, T);
  recomputeCountry(game, from);
  if (from.provinceCount === 0) { eliminateCountry(game, fromId, to); return; }
  if (from.capital === pid) {
    let best = null;
    for (const p of game.world.provinces) if (p.owner === fromId && (!best || p.pop > best.pop)) best = p;
    from.capital = best.id;
    adjust(from, { stability: -8 });
    logNews(game, `${T.name} captures ${pr.name}, the capital of ${from.name}! The government flees to ${best.name}.`, 'war', [to, fromId]);
  }
}

function eliminateCountry(game, id, by) {
  const c = game.countries[id];
  c.alive = false;
  c.overlord = null; c.subjectType = null; c.integration = null;
  for (const s of game.countries) if (s.overlord === id) { s.overlord = null; s.subjectType = null; s.integration = null; }
  for (const w of game.wars) { w.a = w.a.filter(x => x !== id); w.b = w.b.filter(x => x !== id); }
  for (const o of game.countries) { o.allies = o.allies.filter(x => x !== id); o.trade = o.trade.filter(x => x !== id); }
  logNews(game, `${formalName(c)} has ceased to exist, annexed by ${game.countries[by].name}.`, 'war', [id, by]);
  if (id === game.player) game.pending.push({ type: 'gameover', reason: `${formalName(c)} has been conquered by ${formalName(game.countries[by])}. Your nation is no more.` });
}

function capitulate(game, war, loserId, takerId) {
  const loser = game.countries[loserId];
  const side = war.a.includes(loserId) ? 'a' : 'b';
  const enemies = side === 'a' ? war.b : war.a;
  // Tribute: the victor takes what it occupies, up to three provinces.
  for (let i = 0; i < 3; i++) {
    const t = pickFrontProvince(game, [takerId], [loserId]);
    if (!t || !loser.alive) break;
    transferProvince(game, t[0], takerId);
    addInfamy(game, takerId, INFAMY.province);
  }
  war[side] = war[side].filter(x => x !== loserId);
  for (const e of enemies) { game.truces[truceKey(loserId, e)] = game.month + 60; setRel(game, loserId, e, -60); }
  adjust(loser, { stability: -10, approval: -10 });
  logNews(game, `${loser.name} capitulates in the ${war.name} and cedes territory to ${game.countries[takerId].name}.`, 'war', [loserId, takerId]);
  if (loserId === game.player && loser.alive) notify(game, 'We Have Capitulated', `With our capital in enemy hands, we were forced to sign a humiliating peace in the ${war.name}, ceding more territory.`);
  if (enemies.includes(game.player)) toastPlayer(game, `${loser.name} capitulates! We gain territory.`, 'good');
  if (!war[side].length) endWar(game, war, 'victory');
}

function endWar(game, war, reason) {
  const idx = game.wars.indexOf(war);
  if (idx < 0) return;
  game.wars.splice(idx, 1);
  clearOccupation(game, war);
  if (war.independence) settleIndependence(game, war);
  for (const x of war.a) {
    for (const y of war.b) {
      game.truces[truceKey(x, y)] = game.month + 60;
      if (game.countries[x].alive && game.countries[y].alive) setRel(game, x, y, -50);
    }
  }
  const verdict = war.gainsA > war.gainsB ? `${game.countries[war.a[0] ?? 0].name}'s side came out ahead` : war.gainsB > war.gainsA ? 'the defenders came out ahead' : 'neither side gained much';
  logNews(game, `The ${war.name} has ended (${reason === 'peace' ? 'negotiated peace' : reason}); ${verdict}.`, 'war', war.a.concat(war.b));
  if (war.a.concat(war.b).includes(game.player) && reason !== 'victory') toastPlayer(game, `The ${war.name} is over.`, 'info');
}

function tickWars(game) {
  const rng = game.rng;
  for (const war of game.wars.slice()) {
    if (!game.wars.includes(war)) continue;
    war.a = war.a.filter(id => game.countries[id].alive);
    war.b = war.b.filter(id => game.countries[id].alive);
    if (!war.a.length || !war.b.length) { endWar(game, war, 'collapse'); continue; }
    fightFronts(game, war);
    if (!game.wars.includes(war)) continue;
    for (const id of war.a.concat(war.b)) {
      const c = game.countries[id];
      c.army *= 0.995;
      c.warExhaustion = clamp(c.warExhaustion + 1.5, 0, 100);
    }
    war.exA += 1.2; war.exB += 1.2;

    const involvesPlayer = war.a.includes(game.player) || war.b.includes(game.player);
    const months = game.month - war.start;
    if (!involvesPlayer) {
      const ex = Math.max(war.exA, war.exB);
      if ((ex > 45 && rng.chance(0.06 + (ex - 45) * 0.004)) || months > 120) {
        const sa = warScore(game, war, war.a[0]);
        const W = sa > 0 ? war.a[0] : war.b[0], Lo = sa > 0 ? war.b[0] : war.a[0];
        const weak = strength(game.countries[Lo]) < strength(game.countries[W]) * 0.4;
        if (!war.independence && Math.abs(sa) > 55 && weak && rng.chance(0.5)) applyPeaceTerms(game, W, Lo, { subjugate: true });
        else if (!war.independence && Math.abs(sa) > 30) applyPeaceTerms(game, W, Lo, { provinces: 1, reparations: Math.abs(sa) > 55 });
        endWar(game, war, 'peace');
      }
    } else {
      const enemyEx = war.a.includes(game.player) ? war.exB : war.exA;
      const enemyLeader = war.a.includes(game.player) ? war.b[0] : war.a[0];
      const theirScore = warScore(game, war, enemyLeader);
      if (game.month - war.offered > 12 && ((enemyEx > 50 && rng.chance(0.08)) || (theirScore > 35 && rng.chance(0.06)))) {
        war.offered = game.month;
        // A winning enemy dictates terms; a beaten or exhausted one asks for white peace.
        const terms = theirScore > 25 ? { provinces: theirScore > 55 ? 2 : 1, reparations: theirScore > 45 } : {};
        game.pending.push({ type: 'peaceOffer', warId: war.id, from: enemyLeader, terms });
      }
    }
  }
}

// War score from one participant's point of view: -100 (crushed) .. +100 (triumphant).
function warScore(game, war, id) {
  const mine = war.a.includes(id) ? 'A' : 'B', th = mine === 'A' ? 'B' : 'A';
  const gains = war['gains' + mine] - war['gains' + th];
  const ex = war['ex' + th] - war['ex' + mine];
  return clamp(occupationScore(game, war, id) + gains * 1.5 + ex * 0.4, -100, 100);
}

const PEACE_COST = { province: 12, reparations: 15, regime: 40, subjugate: 45 };

function peaceTermsCost(t) { return (t.provinces || 0) * PEACE_COST.province + (t.reparations ? PEACE_COST.reparations : 0) + (t.regime ? PEACE_COST.regime : 0) + (t.subjugate ? PEACE_COST.subjugate : 0); }

function peaceChance(game, war, id, terms) {
  const mine = war.a.includes(id) ? 'a' : 'b';
  const enemyEx = mine === 'a' ? war.exB : war.exA;
  return clamp(0.08 + (warScore(game, war, id) - peaceTermsCost(terms)) / 70 + enemyEx / 250, 0.02, 0.95);
}

function applyPeaceTerms(game, winnerId, loserId, terms) {
  const W = game.countries[winnerId], L = game.countries[loserId];
  const out = [];
  let taken = 0;
  for (let i = 0; i < (terms.provinces || 0) && L.alive; i++) {
    const t = pickFrontProvince(game, [winnerId], [loserId]);
    if (!t) break;
    transferProvince(game, t[0], winnerId);
    addInfamy(game, winnerId, INFAMY.peaceProvince);
    taken++;
  }
  if (taken) out.push(`${taken} province${taken > 1 ? 's' : ''} ceded`);
  if (terms.reparations && L.alive) {
    game.reparations = game.reparations || [];
    game.reparations.push({ from: loserId, to: winnerId, months: 60, amount: L.gdp * 0.03 / 12 });
    out.push('reparations for five years');
    addInfamy(game, winnerId, INFAMY.reparations);
  }
  if (terms.regime && L.alive && L.gov !== W.gov) {
    changeGovernment(game, L, W.gov, 'conquest');
    out.push(`a ${GOVS[W.gov].name} imposed`);
    addInfamy(game, winnerId, INFAMY.regime);
  }
  if (terms.subjugate && L.alive && L.overlord == null && W.overlord == null) {
    makeSubject(game, winnerId, loserId, terms.regime ? 'puppet' : 'vassal', 'war');
    out.push(`they become our ${terms.regime ? 'puppet' : 'vassal'}`);
    addInfamy(game, winnerId, 8);
  }
  return out.join(', ');
}

function settleWar(game, war, side, reason) {
  // A participant on `side` leaves; if it led its side, the whole war ends.
  const pid = game.player;
  if (war[side][0] === pid) { endWar(game, war, reason); return; }
  war[side] = war[side].filter(x => x !== pid);
  for (const e of (side === 'a' ? war.b : war.a)) { game.truces[truceKey(pid, e)] = game.month + 60; setRel(game, pid, e, -50); }
  logNews(game, `${game.countries[pid].name} signs a separate peace in the ${war.name}.`, 'war', [pid]);
}

function offerPeaceTerms(game, warId, terms) {
  terms = terms || {};
  const war = game.wars.find(w => w.id === warId);
  if (!war) return { ok: false, msg: 'That war is already over.' };
  const pid = game.player;
  const side = war.a.includes(pid) ? 'a' : 'b';
  const enemy = (side === 'a' ? war.b : war.a)[0];
  const wait = (war.lastPlayerOffer === undefined ? -99 : war.lastPlayerOffer) + 6 - game.month;
  if (wait > 0) return { ok: false, msg: `They rejected our last offer and won't hear new terms for ${wait} more month${wait > 1 ? 's' : ''}.` };
  war.lastPlayerOffer = game.month;
  if (!game.rng.chance(peaceChance(game, war, pid, terms))) return { ok: false, msg: 'The enemy rejects our terms. They will not negotiate again for six months.' };
  const result = applyPeaceTerms(game, pid, enemy, terms);
  settleWar(game, war, side, 'peace');
  logNews(game, `Peace between ${game.countries[pid].name} and ${game.countries[enemy].name}${result ? ': ' + result : ' (white peace)'}.`, 'war', [pid, enemy]);
  return { ok: true, msg: `Peace is signed${result ? ': ' + result : ''}.` };
}

function offerPeace(game, warId) { return offerPeaceTerms(game, warId, {}); }

function tickReparations(game) {
  if (!game.reparations) return;
  game.reparations = game.reparations.filter(r => {
    const A = game.countries[r.from], B = game.countries[r.to];
    if (!A.alive || !B.alive || r.months <= 0) return false;
    A.treasury -= r.amount; B.treasury += r.amount;
    r.months--;
    return true;
  });
}

// ------------------------------------------------------------------ diplomacy

function relationTarget(game, a, b) {
  let t = 30 - 38 * ideoDist(GOVS[a.gov], GOVS[b.gov]);
  // Personal diplomacy: skilled leaders and foreign ministers make friends.
  for (const x of [a, b]) {
    if (!x.leader || !x.leader.skills) continue;
    t += (x.leader.skills.diplo - 5) * 1.2 + (traitFx(x.leader).relations || 0) * 0.5;
    if (x.cabinet) t += cabinetFx(x).relations * 0.5;
  }
  if (getNeighbors(game, a.id).includes(b.id)) t -= 10;
  if (a.allies.includes(b.id)) t += 25;
  if (a.overlord === b.id || b.overlord === a.id) t += 20;
  for (const bl of blocsOf(game, a.id)) if (bl.members.includes(b.id)) t += BLOC_TYPES[bl.type].rel;
  if (a.trade.includes(b.id)) t += 10;
  if (hasTruce(game, a.id, b.id)) t -= 20;
  // Infamous nations are distrusted by everyone; nations sharing a dangerous neighbor draw together.
  t -= ((a.infamy || 0) + (b.infamy || 0)) * 0.7;
  const an = getNeighbors(game, a.id), bn = getNeighbors(game, b.id);
  if (an.some(x => bn.includes(x) && (game.countries[x].infamy || 0) > 25)) t += 12;
  if (a.id === game.player || b.id === game.player) t -= difficulty(game).hostility;
  // Nationalism: our people under their rule (or theirs under ours) poisons relations.
  const cl = (game.countries && typeof claimsOn === 'function') ? claimsOn(game, a, b.id) + claimsOn(game, b, a.id) : 0;
  t -= Math.min(30, cl * 6);
  return clamp(t, -100, 100);
}

function tickDiplomacy(game) {
  const rng = game.rng;
  const alive = game.countries.filter(c => c.alive);
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j];
      if (atWarWith(game, a.id, b.id)) { setRel(game, a.id, b.id, -100); continue; }
      const cur = relation(game, a.id, b.id);
      setRel(game, a.id, b.id, cur + (relationTarget(game, a, b) - cur) * 0.03 + rng.normal() * 0.6);
    }
  }
  for (const c of alive) {
    if (c.id === game.player) continue;
    const o = rng.pick(alive);
    if (o === c) continue;
    const rel = relation(game, c.id, o.id);
    const war = atWarWith(game, c.id, o.id);
    if (c.allies.includes(o.id) && rel < 15) {
      removeAlly(game, c.id, o.id);
      logNews(game, `${c.name} breaks off its alliance with ${o.name}.`, 'diplo', [c.id, o.id]);
      if (o.id === game.player) notify(game, 'Alliance Broken', `${formalName(c)} has broken off its alliance with us.`);
    }
    if (c.trade.includes(o.id) && rel < -10) {
      removeTrade(game, c.id, o.id);
      if (o.id === game.player) toastPlayer(game, `${c.name} cancels its trade agreement with us.`, 'bad');
    }
    if (war) continue;
    if (o.id === game.player) {
      if (!c.allies.includes(o.id) && rel > 60 && rng.chance(0.03)) game.pending.push({ type: 'diploOffer', kind: 'alliance', from: c.id });
      else if (!c.trade.includes(o.id) && rel > 30 && rng.chance(0.03)) game.pending.push({ type: 'diploOffer', kind: 'trade', from: c.id });
      continue;
    }
    if (!c.trade.includes(o.id) && rel > 30 && rng.chance(0.05)) {
      c.trade.push(o.id); o.trade.push(c.id);
    }
    if (!c.allies.includes(o.id) && rel > 65 && rng.chance(0.03)) {
      c.allies.push(o.id); o.allies.push(c.id);
      logNews(game, `${c.name} and ${o.name} sign a defensive alliance.`, 'diplo', [c.id, o.id]);
    }
  }
  // AI wars of aggression
  for (const c of alive) {
    if (c.id === game.player || !c.alive || c.overlord != null || isAtWar(game, c.id) || c.stability < 35 || c.monthsInRegime < 6) continue;
    const g = GOVS[c.gov];
    for (const n of getNeighbors(game, c.id)) {
      const rel = relation(game, c.id, n);
      const claims = claimsOn(game, c, n);
      if (rel > (claims ? 5 : -15) || c.allies.includes(n) || hasTruce(game, c.id, n) || game.countries[n].overlord === c.id) continue;
      const target = game.countries[n];
      const theirs = strength(target) + target.allies.reduce((s, x) => s + (game.countries[x].alive ? strength(game.countries[x]) * 0.5 : 0), 0);
      const ratio = strength(c) / (theirs + 0.001);
      if (ratio < 1.4) continue;
      // Nationalists want their people home: claims make war far more likely.
      const p = g.aggression * leaderAggression(c) * 0.012 * Math.min(2, ratio - 1) * Math.max(0.3, -rel / 50) * (1 + Math.min(3, claims) * 0.8) * (claims && c.laws && c.laws.citizenship === 'persecution' ? 1.5 : 1);
      if (rng.chance(p)) { declareWar(game, c.id, n); if (claims) logNews(game, `${c.name} vows to bring its people in ${game.countries[n].name} home.`, 'war', [c.id, n]); break; }
    }
  }
}

// ------------------------------------------------------------------ AI governance

function aiPolicy(game, c) {
  aiMoney(game, c);
  const rng = game.rng;
  if (!rng.chance(0.35)) return;
  const p = c.policy, d = defaultPolicy(c.gov), g = GOVS[c.gov];
  const debt = -c.treasury / (c.gdpNom || c.gdp);
  if (debt > 0.3) { p.tax += 0.01; p.welfare -= 0.3; p.infrastructure -= 0.1; }
  else if (c.treasury > (c.gdpNom || c.gdp) * 0.15) { p.tax -= 0.01; p.welfare += 0.2; p.education += 0.1; p.infrastructure += 0.1; }
  // Arms races: threatened nations arm up.
  const threat = threatLevel(game, c);
  const milT = isAtWar(game, c.id) ? Math.max(d.military * 1.8, 5) : d.military * clamp(1 + (threat - 1) * 0.6, 1, 2.4);
  p.military += (milT - p.military) * 0.2;
  if (c.unrest > 45 && g.repression >= 1) p.police += 0.2;
  else p.police += (d.police - p.police) * 0.1;
  clampPolicy(p);
  if (c.unrest > 60 && g.repression >= 1 && rng.chance(0.08)) adjust(c, { unrest: -20, freedom: -5, intelligentsia: -8 });
  if (c.stability < 35 && rng.chance(0.1)) {
    for (const f in g.base) c.factions[f] = clamp(c.factions[f] + 8, 0, 100);
    c.treasury -= (c.gdpNom || c.gdp) * 0.005;
  }
}

// Random upheavals for AI nations (the player gets interactive events instead).
const AI_SHOCKS = [
  { w: 1, text: c => `A financial crash rocks ${c.name}.`, run: c => { addMod(c, 'growth', -0.003, 12, 'Financial crash'); adjust(c, { approval: -10, business: -10 }); } },
  { w: 1, text: c => `A corruption scandal engulfs the government of ${c.name}.`, run: c => adjust(c, { stability: -12, legitimacy: -12, approval: -6 }) },
  { w: 1, text: c => `Mass protests erupt across ${c.name}.`, run: c => adjust(c, { unrest: 25, stability: -6 }) },
  { w: 0.8, auto: true, text: c => `Rumors of a palace intrigue in ${c.name}: rival factions maneuver for power.`, run: c => adjust(c, { stability: -15, military: -10 }) },
  { w: 0.6, text: c => `Crop failures bring hunger to ${c.name}.`, run: c => adjust(c, { approval: -12, workers: -10, unrest: 10 }) },
];

function aiShock(game, c) {
  if (!game.rng.chance(0.022)) return;
  const pool = AI_SHOCKS.filter(s => !s.auto || !free(c));
  const sh = game.rng.weighted(pool, s => s.w);
  sh.run(c);
  logNews(game, sh.text(c), 'crisis', [c.id]);
}

function tickPolitics(game, c) {
  const g = GOVS[c.gov];
  if (g.elections && c.nextElection != null) {
    if (c.emergency) c.nextElection = Math.max(c.nextElection, game.month + 1);
    else if (game.month >= c.nextElection) runElection(game, c);
  }
  tickCharacters(game, c);
  tickCoalition(game, c);
  tickResearch(game, c);
  tickMovements(game, c);
  tickLaws(game, c);
  tickArena(game, c);
  tickMobilization(game, c);
  if (!isPlayer(game, c)) { aiPolicy(game, c); aiShock(game, c); }
  checkCrisis(game, c);
}

// ------------------------------------------------------------------ main tick

function tick(game) {
  if (game.over) return;
  game.month++;
  const D = difficulty(game);
  for (const c of game.countries) c.aiArmyBonus = c.id === game.player ? 0 : D.aiArmy;
  refreshCores(game);
  tickEconomy(game, false);
  tickPeoples(game);
  tickSociety(game);
  for (const c of game.countries) if (c.alive) tickCountry(game, c);
  tickWars(game);
  tickBalance(game);
  tickSubjects(game);
  aiEmpire(game);
  tickBlocs(game);
  tickFederal(game);
  tickReparations(game);
  tickDiplomacy(game);
  for (const c of game.countries) if (c.alive) tickPolitics(game, c);
  if (game.player >= 0 && game.countries[game.player].alive) playerMonthly(game);
  recordHistory(game);
}

// Monthly series cover the last 20 years; yearly series (each January) cover
// the whole game. The player's nation records extra detail for the ledger.
const HIST_MONTHS = 240;
function recordHistory(game) {
  const push = (o, k, v) => { (o[k] || (o[k] = [])).push(v); if (o[k].length > HIST_MONTHS) o[k].shift(); };
  const r1 = v => Math.round(v * 10) / 10;
  for (const c of game.countries) {
    if (!c.alive) continue;
    const H = c.hist;
    push(H, 'approval', Math.round(c.approval));
    push(H, 'stability', Math.round(c.stability));
    push(H, 'gdp', r1(c.gdp));
    push(H, 'pop', Math.round(c.pop / 1e4) / 100);
    push(H, 'sol', r1(c.econ.avgSol));
    push(H, 'pl', Math.round((c.econ.pl || 1) * 1e4) / 1e4);
    push(H, 'rgdp', r1((c.econ.gdpRealM || c.econ.gdpM) * 12 / 1e6));
    push(H, 'credit', Math.round((c.econ.credit || 0) / Math.max(1, (c.econ.gdpRealM || c.econ.gdpM) * 12) * 1000) / 10);
    push(H, 'conf', Math.round((c.econ.conf || 1) * 100));
    if (c.id === game.player) {
      // Keep the player's series aligned with the shared ones.
      for (const k of ['unrest', 'treasury', 'army', 'unemp', 'pc', 'revenue', 'spend', 'infl', 'rate', 'rwage']) if (!H[k]) H[k] = new Array(Math.max(0, H.gdp.length - 1)).fill(null);
      push(H, 'unrest', Math.round(c.unrest));
      push(H, 'treasury', Math.round(c.treasury * 100) / 100);
      push(H, 'army', Math.round(c.army / 1000));
      push(H, 'unemp', Math.round(c.econ.unemployment * 1000) / 10);
      push(H, 'pc', Math.floor(c.pc));
      push(H, 'infl', Math.round(inflationYoY(c) * 1000) / 10);
      push(H, 'rate', Math.round((c.econ.rate || 0) * 1000) / 10);
      push(H, 'rwage', Math.round((c.econ.realWage || 1) * 1000) / 10);
      push(H, 'revenue', c.budget ? Math.round(c.budget.revenue * 1000) / 1000 : 0);
      push(H, 'spend', c.budget ? Math.round((c.budget.spend + c.budget.interest) * 1000) / 1000 : 0);
    }
    if (game.month % 12 === 0) {
      const Y = c.histY || (c.histY = { month: [], gdp: [], pop: [], sol: [], approval: [], stability: [] });
      Y.month.push(game.month); Y.gdp.push(r1(c.gdp)); Y.pop.push(Math.round(c.pop / 1e4) / 100); Y.sol.push(r1(c.econ.avgSol));
      Y.approval.push(Math.round(c.approval)); Y.stability.push(Math.round(c.stability));
    }
  }
  const W = game.worldMarket;
  if (W && W.prices) {
    const P = game.priceHist || (game.priceHist = {});
    for (const k in GOODS) if (W.prices[k] != null) push(P, k, r1(W.prices[k]));
  }
}

function playerMonthly(game) {
  const c = game.countries[game.player];
  game.playerMonths = (game.playerMonths || 0) + 1;
  if (c.stability < CRISIS_LEVEL && !c.flags.warned) {
    c.flags.warned = true;
    notify(game, 'The Nation Is in Crisis', `Stability has fallen to ${Math.round(c.stability)}. Every month there is a real chance of a coup, a revolution or the government collapsing. Shore up your power base, crack down, or win back the public, and do it fast.`);
  } else if (c.stability > CRISIS_LEVEL + 7) c.flags.warned = false;
  runScheduledEvents(game, c);
  const learning = game.campaign && !game.campaign.ended && game.campaign.step < 7;
  if (!learning && !game.pending.some(p => p.type !== 'toast') && game.rng.chance(0.15)) maybeEvent(game, c);
}

function setPlayer(game, id) {
  game.player = id;
  const c = game.countries[id];
  c.pc = Math.max(c.pc, 40);
  game.playerMonths = 0;
  logNews(game, `A new chapter begins for ${formalName(c)}.`, 'info', [id]);
}

// ------------------------------------------------------------------ player actions

function costOk(c, a) {
  if (c.pc < (a.pc || 0)) return `Needs ${a.pc} political capital.`;
  if (a.money && c.treasury - a.money * (c.gdpNom || c.gdp) < -(c.gdpNom || c.gdp)) return 'The treasury cannot borrow any more.';
  return null;
}
function payCost(c, a) { c.pc -= a.pc || 0; if (a.money) c.treasury -= a.money * (c.gdpNom || c.gdp); }

const free = c => GOVS[c.gov].elections === 'free';
const CRISIS_LEVEL = 30;

const DOMESTIC_ACTIONS = [
  {
    id: 'propaganda', name: 'Propaganda Campaign', pc: 15, money: 0.002,
    desc: 'Approval +7 for 6 months, and the public drifts toward the regime\'s ideology.',
    check: () => null,
    run(game, c) {
      addMod(c, 'approval', hasTech(c, 'broadcasting') ? 10 : 7, 6, 'Propaganda');
      addMod(c, 'propaganda', 1, 6, 'Propaganda');
      if (free(c)) adjust(c, { freedom: -2 });
      return 'The ministry of information floods the airwaves.';
    },
  },
  {
    id: 'crackdown', name: 'Crack Down on Dissent', pc: 20, money: 0.001,
    desc: 'Unrest −25. Freedom −8, intelligentsia −12, workers −4. Far costlier in a free society.',
    check: () => null,
    run(game, c) {
      const d = free(c);
      adjust(c, { unrest: -25, freedom: -8, intelligentsia: -12, workers: -4, approval: d ? -8 : -3, legitimacy: d ? -10 : 0 });
      return 'Security forces round up agitators and break up demonstrations.';
    },
  },
  {
    id: 'reforms', name: 'Liberalizing Reforms', pc: 20,
    desc: 'Freedom +10, intelligentsia +12, the public grows more liberal. In autocracies people may demand more (unrest +6, military −4).',
    check: () => null,
    run(game, c) {
      const d = free(c);
      adjust(c, { freedom: 10, intelligentsia: 12, auth: -0.04, unrest: d ? 0 : 6, approval: d ? 3 : 1, military: d ? 0 : -4 });
      addMod(c, 'freedom', 5, 12, 'Reforms');
      return 'Censorship is eased and political prisoners are released.';
    },
  },
  {
    id: 'anticorruption', name: 'Anti-Corruption Drive', pc: 25, money: 0.003,
    desc: 'Corruption −12, approval +2, business −5.',
    check: () => null,
    run(game, c) { adjust(c, { corruption: -12, business: -5, approval: 2 }); return 'Investigators descend on the ministries.'; },
  },
  {
    id: 'rally', name: 'Nationalist Rally', pc: 15,
    desc: 'Approval +8 for 4 months, military +5. Relations with every neighbor −10; the public grows more authoritarian.',
    check: () => null,
    run(game, c) {
      addMod(c, 'approval', 8, 4, 'Nationalist fervor');
      adjust(c, { military: 5, auth: 0.03, econ: 0.01 });
      for (const n of getNeighbors(game, c.id)) addRel(game, c.id, n, -10);
      return 'Crowds wave flags and chant for national greatness.';
    },
  },
  {
    id: 'purge', name: 'Purge the Officer Corps', pc: 30,
    desc: 'Military loyalty rises to at least 65, but the army shrinks by 20% and stability −4.',
    check: c => (free(c) ? 'Not possible in a free society.' : null),
    run(game, c) {
      c.factions.military = Math.max(65, c.factions.military + 10);
      c.army *= 0.8;
      adjust(c, { stability: -4 });
      return 'Disloyal officers are dismissed, imprisoned or worse.';
    },
  },
  {
    id: 'campaign', name: 'Election Campaign', pc: 10, money: 0.003,
    desc: 'Boost your party in the polls. The effect fades over the following months.',
    check: c => (free(c) ? null : 'hidden'),
    run(game, c) { const p = rulingPartyObj(c); p.boost += 0.25; return `${p.name} launches a nationwide campaign.`; },
  },
  {
    id: 'snap', name: 'Call Snap Election', pc: 20,
    desc: 'Hold an election in two months. Win it to renew your mandate and legitimacy.',
    check: (c, game) => (!free(c) ? 'hidden' : c.emergency ? 'Elections are suspended.' : c.nextElection - game.month <= 4 ? 'An election is already imminent.' : null),
    run(game, c) { c.nextElection = game.month + 2; return 'Parliament is dissolved. The country goes to the polls in two months.'; },
  },
  {
    id: 'fraud', name: 'Rig the Next Election', pc: 30,
    desc: 'Stuff the ballot boxes: about +18% for your party. 35% chance of exposure (stability −15, legitimacy −25, intelligentsia −20).',
    check: c => (!free(c) ? 'hidden' : c.flags.fraud ? 'Already arranged.' : null),
    run(game, c) { c.flags.fraud = true; return 'Trusted officials are placed in the electoral commission.'; },
  },
  {
    id: 'emergency', name: 'Declare State of Emergency', pc: 25,
    desc: 'Suspend elections indefinitely. Unrest −15 now, but freedom, legitimacy and intelligentsia loyalty fall while it lasts.',
    check: c => (!free(c) || c.emergency ? 'hidden' : null),
    run(game, c) { c.emergency = true; adjust(c, { unrest: -15, intelligentsia: -15, legitimacy: -10 }); return 'Emergency powers are invoked. Elections are suspended.'; },
  },
  {
    id: 'endEmergency', name: 'End State of Emergency', pc: 0,
    desc: 'Restore normal constitutional rule. Elections will be held within three months.',
    check: c => (c.emergency ? null : 'hidden'),
    run(game, c) { c.emergency = false; c.nextElection = game.month + 3; adjust(c, { legitimacy: 5 }); return 'Emergency powers are lifted. Elections are scheduled.'; },
  },
];

function domesticActionList(game, c) {
  return DOMESTIC_ACTIONS.map(a => {
    const reason = a.check(c, game);
    if (reason === 'hidden') return null;
    return { a, reason: reason || costOk(c, a) };
  }).filter(Boolean);
}

function performDomestic(game, id) {
  const c = game.countries[game.player];
  const a = DOMESTIC_ACTIONS.find(x => x.id === id);
  const reason = a.check(c, game) || costOk(c, a);
  if (reason) return { ok: false, msg: reason };
  payCost(c, a);
  const msg = a.run(game, c);
  logNews(game, `${c.name}: ${a.name}. ${msg}`, 'action', [c.id]);
  return { ok: true, msg };
}

const APPEASE_COST = { pc: 12, money: 0.003 };
function appeaseFaction(game, f) {
  const c = game.countries[game.player];
  const reason = costOk(c, APPEASE_COST);
  if (reason) return { ok: false, msg: reason };
  payCost(c, APPEASE_COST);
  c.factions[f] = clamp(c.factions[f] + 12, 0, 100);
  addMod(c, f, 6, 12, `Concessions to ${FACTIONS[f].name}`);
  for (const o of FACTION_KEYS) if (o !== f) c.factions[o] = clamp(c.factions[o] - 2, 0, 100);
  return { ok: true, msg: `${FACTIONS[f].name} receive concessions. Their loyalty rises; others grumble.` };
}

const DIPLO_ACTIONS = [
  {
    id: 'improve', name: 'Improve Relations', pc: 10, money: 0.001, desc: 'Embassies, gifts and state visits: +15 relations.',
    check: (game, c, t) => (atWarWith(game, c.id, t.id) ? 'hidden' : null),
    run(game, c, t) { addRel(game, c.id, t.id, 15); return `Relations with ${t.name} improve.`; },
  },
  {
    id: 'denounce', name: 'Denounce', pc: 5, desc: '−25 relations; +2 approval at home.',
    check: (game, c, t) => (atWarWith(game, c.id, t.id) ? 'hidden' : null),
    run(game, c, t) { addRel(game, c.id, t.id, -25); adjust(c, { approval: 2 }); return `We publicly denounce the ${formalName(t)}.`; },
  },
  {
    id: 'trade', name: 'Propose Trade Agreement', pc: 10, desc: 'Boosts growth for both nations. Needs relations of 20 or more.',
    check: (game, c, t) => (c.trade.includes(t.id) || atWarWith(game, c.id, t.id) ? 'hidden' : relation(game, c.id, t.id) < 20 ? 'Relations too low (need 20).' : null),
    run(game, c, t) {
      const p = clamp((relation(game, c.id, t.id) - 10) / 40, 0.1, 0.95);
      if (!game.rng.chance(p)) { addRel(game, c.id, t.id, -3); return `${t.name} declines our trade proposal.`; }
      c.trade.push(t.id); t.trade.push(c.id); addRel(game, c.id, t.id, 8);
      logNews(game, `${c.name} and ${t.name} sign a trade agreement.`, 'diplo', [c.id, t.id]);
      return `${t.name} accepts! A trade agreement is signed.`;
    },
  },
  {
    id: 'cancelTrade', name: 'Cancel Trade Agreement', pc: 0, desc: 'End the trade agreement (−15 relations).',
    check: (game, c, t) => (c.trade.includes(t.id) ? null : 'hidden'),
    run(game, c, t) { removeTrade(game, c.id, t.id); addRel(game, c.id, t.id, -15); return 'Trade agreement cancelled.'; },
  },
  {
    id: 'alliance', name: 'Propose Alliance', pc: 25, desc: 'A defensive pact: allies are called in when either is attacked. Needs relations of 50 or more.',
    check: (game, c, t) => (c.allies.includes(t.id) || atWarWith(game, c.id, t.id) ? 'hidden' : relation(game, c.id, t.id) < 50 ? 'Relations too low (need 50).' : null),
    run(game, c, t) {
      const p = clamp((relation(game, c.id, t.id) - 40) / 45 - ideoDist(GOVS[c.gov], GOVS[t.gov]) * 0.2, 0.05, 0.95);
      if (!game.rng.chance(p)) return `${t.name} politely declines an alliance.`;
      c.allies.push(t.id); t.allies.push(c.id); addRel(game, c.id, t.id, 10);
      logNews(game, `${c.name} and ${t.name} sign a defensive alliance.`, 'diplo', [c.id, t.id]);
      return `${t.name} accepts! We are now allies.`;
    },
  },
  {
    id: 'breakAlliance', name: 'Break Alliance', pc: 0, desc: 'Leave the alliance (−30 relations).',
    check: (game, c, t) => (c.allies.includes(t.id) ? null : 'hidden'),
    run(game, c, t) { removeAlly(game, c.id, t.id); addRel(game, c.id, t.id, -30); return `We break our alliance with ${t.name}.`; },
  },
  {
    id: 'rebels', name: 'Fund Rebels', pc: 35, money: 0.004,
    desc: 'Stability −12, unrest +15 for the target. 35% chance we are caught (−40 relations). If their regime collapses, it may adopt our system.',
    check: () => null,
    run(game, c, t) {
      adjust(t, { stability: -12, unrest: 15 });
      let msg = `Arms and money flow to dissidents in ${t.name}.`;
      if (game.rng.chance(0.35)) { addRel(game, c.id, t.id, -40); msg += ' Our involvement has been discovered!'; logNews(game, `${t.name} accuses ${c.name} of funding insurgents.`, 'diplo', [c.id, t.id]); }
      if (t.stability < CRISIS_LEVEL && game.rng.chance(0.45) && t.gov !== c.gov) {
        changeGovernment(game, t, c.gov, 'revolution');
        addRel(game, c.id, t.id, 40);
        msg += ` The regime collapses! The ${formalName(t)} rises in its place.`;
      }
      return msg;
    },
  },
  {
    id: 'war', name: 'Declare War', pc: 20, desc: 'Invade a neighbor. Democracies dislike wars of aggression.',
    check: (game, c, t) => {
      if (atWarWith(game, c.id, t.id) || t.overlord === c.id || c.overlord === t.id) return 'hidden';
      if (c.overlord != null) return 'Our overlord forbids us to start wars.';
      if (!getNeighbors(game, c.id).includes(t.id)) return 'Must share a border or a narrow strait.';
      if (c.allies.includes(t.id)) return 'They are our ally.';
      if (hasTruce(game, c.id, t.id)) return `Truce in effect until ${gameDate(game, truceUntil(game, c.id, t.id))}.`;
      return null;
    },
    run(game, c, t) { declareWar(game, c.id, t.id); return `We are at war with ${t.name}!`; },
  },
  {
    id: 'peace', name: 'Offer Peace', pc: 10, desc: 'Propose a white peace. The more exhausted and beaten they are, the likelier they accept.',
    check: (game, c, t) => (atWarWith(game, c.id, t.id) ? null : 'hidden'),
    run(game, c, t) { return offerPeace(game, warBetween(game, c.id, t.id).id).msg; },
  },
];

function diploActionList(game, c, t) {
  return DIPLO_ACTIONS.map(a => {
    const reason = a.check(game, c, t);
    if (reason === 'hidden') return null;
    return { a, reason: reason || costOk(c, a) };
  }).filter(Boolean);
}

function performDiplo(game, id, targetId) {
  const c = game.countries[game.player], t = game.countries[targetId];
  const a = DIPLO_ACTIONS.find(x => x.id === id);
  const reason = a.check(game, c, t) || costOk(c, a);
  if (reason) return { ok: false, msg: reason };
  payCost(c, a);
  return { ok: true, msg: a.run(game, c, t) };
}

const REGIME_PC = 50;

function regimeMethod(from, to) {
  if (GOVS[from].elections === 'free' && GOVS[to].elections !== 'free') return to === 'absMonarchy' ? 'Crown yourself' : 'Self-coup';
  if (GOVS[from].elections !== 'free' && GOVS[to].elections === 'free') return from === 'absMonarchy' && to === 'constMonarchy' ? 'Grant a constitution' : 'Democratic transition';
  if (to === 'absMonarchy') return 'Restore the crown';
  return 'Revolution from above';
}

function regimeChance(c, to) {
  const g = GOVS[to];
  const baseLoy = weightedLoyalty(c, g.base);
  const fit = 1 - Math.min(1, ideoDist(c.ideo, g) / 1.6);
  return clamp(0.1 + baseLoy / 100 * 0.5 + fit * 0.35 + (c.stability - 50) / 200, 0.05, 0.95);
}

function regimeOptions(game, c) {
  return GOV_ORDER.filter(k => k !== c.gov).map(k => {
    let reason = null;
    if (c.stability < 30) reason = 'Stability must be at least 30.';
    else if (c.pc < REGIME_PC) reason = `Needs ${REGIME_PC} political capital.`;
    else if (isAtWar(game, c.id)) reason = 'Not while at war.';
    return { gov: k, method: regimeMethod(c.gov, k), chance: regimeChance(c, k), reason };
  });
}

function attemptRegimeChange(game, to) {
  const c = game.countries[game.player];
  const opt = regimeOptions(game, c).find(o => o.gov === to);
  if (!opt || opt.reason) return { ok: false, msg: opt ? opt.reason : 'Invalid.' };
  c.pc -= REGIME_PC;
  if (game.rng.chance(opt.chance)) {
    const wasFree = free(c);
    changeGovernment(game, c, to, 'reform', { keepLeader: true });
    if (wasFree && !free(c)) adjust(c, { freedom: -20, intelligentsia: -20, approval: -8 });
    if (!wasFree && free(c)) adjust(c, { freedom: 10, intelligentsia: 15, approval: 5 });
    return { ok: true, msg: `${opt.method} succeeds! The ${formalName(c)} is proclaimed.` };
  }
  adjust(c, { stability: -20, legitimacy: -15 });
  logNews(game, `An attempt to transform ${c.name} into a ${GOVS[to].name} fails.`, 'gov', [c.id]);
  if (game.rng.chance(0.35)) {
    const r = pickRevolution(game, c);
    changeGovernment(game, c, r.gov, r.how);
    return { ok: false, msg: 'The attempt fails and the backlash topples you!' };
  }
  return { ok: false, msg: `${opt.method} fails. Stability −20, legitimacy −15.` };
}

// --------------------------------------------------------- resolving player prompts

function resolveElectionLoss(game, choice) {
  const c = game.countries[game.player];
  const res = c.lastElection;
  if (choice === 'concede') {
    applyGovernment(game, c, formGovernment(game, c, seatsOf(res), c.rulingParty));
    res.winner = c.rulingParty;
    adjust(c, { legitimacy: 5 });
    return { ok: true, msg: `Power passes peacefully to ${rulingPartyObj(c).name}. You continue to guide the nation through the new government of ${leaderLine(c)}.` };
  }
  // Refuse to step down: a self-coup that needs the army.
  const chance = clamp(c.factions.military / 100 * 0.9 - 0.05, 0.05, 0.9);
  if (game.rng.chance(chance)) {
    const target = c.ideo.econ < -0.3 ? 'communist' : c.ideo.auth > 0.2 ? 'fascist' : 'junta';
    changeGovernment(game, c, target, 'reform', { keepLeader: true });
    adjust(c, { freedom: -25, intelligentsia: -30, approval: -15, legitimacy: -15 });
    return { ok: true, msg: `Tanks surround parliament. The results are annulled and the ${formalName(c)} is proclaimed.` };
  }
  setRulingParty(game, c, res.winner);
  adjust(c, { stability: -15, legitimacy: -10 });
  logNews(game, `In ${c.name}, the outgoing government's attempt to annul the election collapses as the army refuses to march.`, 'gov', [c.id]);
  return { ok: false, msg: 'The army refuses to back you. You are forced out in disgrace and the winners take office.' };
}

function resolveAllyCall(game, item, accept) {
  const war = game.wars.find(w => w.id === item.warId);
  const c = game.countries[game.player];
  if (!war) return 'The war is already over.';
  if (accept) { joinWar(game, war, game.player, war.b.includes(item.ally) ? 'b' : 'a'); return `We honor our ${item.bloc ? 'pledge to the ' + item.bloc : 'alliance with ' + game.countries[item.ally].name}.`; }
  if (item.bloc) {
    const b = (game.blocs || []).find(x => x.name === item.bloc);
    if (b && b.members.includes(c.id)) leaveBloc(game, b, c.id, 'expelled');
    return `We abandon ${game.countries[item.ally].name}. The ${item.bloc} expels us.`;
  }
  if (item.subject) {
    const S = game.countries[item.ally];
    S.libertyMod = (S.libertyMod || 0) + 40;
    for (const x of subjectsOf(game, c.id)) x.libertyMod = (x.libertyMod || 0) + 12;
    return `We abandon our ${SUBJECT_TYPES[S.subjectType].name.toLowerCase()}, ${S.name}. Every subject of ours takes note.`;
  }
  removeAlly(game, c.id, item.ally);
  addRel(game, c.id, item.ally, -40);
  return `We abandon ${game.countries[item.ally].name}. The alliance is dissolved.`;
}

function resolvePeaceOffer(game, item, accept) {
  const war = game.wars.find(w => w.id === item.warId);
  if (!war) return 'The war is already over.';
  if (!accept) return 'We fight on.';
  const pid = game.player;
  const side = war.a.includes(pid) ? 'a' : 'b';
  const result = item.terms && peaceTermsCost(item.terms) > 0 ? applyPeaceTerms(game, item.from, pid, item.terms) : '';
  settleWar(game, war, side, 'peace');
  return `Peace is signed${result ? ': ' + result : ''}.`;
}

function resolveDiploOffer(game, item, accept) {
  const c = game.countries[game.player], o = game.countries[item.from];
  if (!o.alive) return '';
  if (!accept) { addRel(game, c.id, o.id, -5); return 'We decline.'; }
  if (item.kind === 'alliance') {
    if (!c.allies.includes(o.id)) { c.allies.push(o.id); o.allies.push(c.id); }
    logNews(game, `${c.name} and ${o.name} sign a defensive alliance.`, 'diplo', [c.id, o.id]);
    return `We are now allied with ${o.name}.`;
  }
  if (!c.trade.includes(o.id)) { c.trade.push(o.id); o.trade.push(c.id); }
  return `Trade agreement signed with ${o.name}.`;
}

// ------------------------------------------------------------------ save / load

const SAVE_VERSION = 3;

function serializeGame(game) {
  return JSON.stringify({
    v: SAVE_VERSION, seed: game.seed, opts: game.opts, month: game.month, startYear: game.startYear,
    countries: game.countries, wars: game.wars, log: game.log.slice(-300), player: game.player,
    nextWarId: game.nextWarId, truces: game.truces, rng: game.rng.getState(),
    owners: game.world.provinces.map(p => p.owner),
    provEcon: game.world.provinces.map(p => ({
      pops: p.pops, inc: p.inc, sol: p.sol, wealth: p.wealth, lit: p.lit, res: p.res,
      b: p.buildings.map(b => ({ t: b.t, level: b.level, active: b.active, idle: b.idle, va: b.va })), conq: p.conquered || null, occ: p.occ == null ? null : p.occ, cu: p.cult || null, re: p.rel || null, ho: p.housing == null ? null : p.housing, core: p.core, des: p.designation || null, st: p.state == null ? null : p.state,
    })),
    worldMarket: game.worldMarket, cultures: game.cultures || null, faiths: game.faiths || null,
    lastEvents: game.lastEvents, stats: game.stats, playerMonths: game.playerMonths || 0, nextCharId: game.nextCharId,
    flags: game.flags || {}, scheduled: game.scheduled || [], campaign: game.campaign || null, reparations: game.reparations || [],
    blocs: game.blocs || [], nextBlocId: game.nextBlocId || 1, priceHist: game.priceHist || {},
  }, saveReplacer);
}

// Saves skip transient caches (keys starting with _) and trim float noise.
function saveReplacer(k, v) {
  if (k.charCodeAt(0) === 95) return undefined;
  return typeof v === 'number' && !Number.isInteger(v) && isFinite(v) ? +v.toPrecision(6) : v;
}

function deserializeGame(str) {
  const d = JSON.parse(str);
  if (d.v !== SAVE_VERSION) throw new Error('This save comes from an older version of the game and cannot be loaded.');
  const world = generateWorld(d.seed, d.opts);
  world.provinces.forEach((p, i) => {
    const e = d.provEcon[i];
    p.owner = d.owners[i];
    p.pops = e.pops; p.inc = e.inc; p.sol = e.sol; p.wealth = e.wealth; p.lit = e.lit; p.res = e.res;
    p.buildings = e.b;
    p.conquered = e.conq || null;
    p.occ = e.occ == null ? undefined : e.occ;
    if (e.cu) p.cult = e.cu;
    if (e.ho != null) p.housing = e.ho;
    if (e.re) p.rel = e.re;
    p.core = e.core === undefined ? p.owner : e.core;
    p.designation = e.des || null;
    p.state = e.st == null ? null : e.st;
    p.pop = POP_KEYS.reduce((s, t) => s + p.pops[t], 0);
  });
  const game = {
    seed: d.seed, opts: d.opts, world, rng: makeRng(d.seed + '|sim'), month: d.month, startYear: d.startYear,
    countries: d.countries, wars: d.wars, log: d.log, player: d.player, nextWarId: d.nextWarId, truces: d.truces,
    pending: [], over: false, neighborCache: {}, mapDirty: true, lastEvents: d.lastEvents || [], stats: d.stats,
    playerMonths: d.playerMonths, worldMarket: d.worldMarket, cultures: d.cultures || null, faiths: d.faiths || null, nextCharId: d.nextCharId || 1,
    flags: d.flags || {}, scheduled: d.scheduled || [], campaign: d.campaign || null, reparations: d.reparations || [],
    blocs: d.blocs || [], nextBlocId: d.nextBlocId || 1, priceHist: d.priceHist || {},
  };
  game.rng.setState(d.rng);
  refreshAll(game);
  return game;
}
