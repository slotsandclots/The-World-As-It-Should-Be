'use strict';
// The economy: pops, goods, production buildings, national markets and world trade.
//
// Units: money is in k$ (thousands of dollars), goods are in abstract units,
// pops are counted in people. One building level employs about 1000 people.
//
// Monthly loop (tickEconomy):
//   1. Buildings produce, limited by staffing, productivity and last month's
//      input availability. Peasants produce subsistence grain.
//   2. Pops decide what to buy with last month's income: basic needs first,
//      then everyday goods, then luxuries. The rest is saved.
//   3. The state buys arms, fuel and construction materials with its budget.
//   4. Each national market trades its surplus/shortage with the world market;
//      prices move toward demand/supply, and scarce goods are rationed.
//   5. Buildings pay wages and profits; the state pays its employees and welfare;
//      pops pay taxes, spend and save. Standard of living follows from what
//      they actually managed to buy.
//   6. Pops take or leave jobs, buildings expand or idle with profitability,
//      investors fund new buildings, and pops grow or starve.

const GOODS = {
  grain: { name: 'Grain', base: 20, cat: 'Raw' },
  fish: { name: 'Fish', base: 25, cat: 'Raw' },
  meat: { name: 'Meat', base: 30, cat: 'Raw' },
  fiber: { name: 'Fiber', base: 20, cat: 'Raw' },
  timber: { name: 'Timber', base: 20, cat: 'Raw' },
  coal: { name: 'Coal', base: 25, cat: 'Raw' },
  iron: { name: 'Iron Ore', base: 30, cat: 'Raw' },
  oil: { name: 'Oil', base: 35, cat: 'Raw' },
  steel: { name: 'Steel', base: 50, cat: 'Industrial' },
  tools: { name: 'Tools', base: 50, cat: 'Industrial' },
  fuel: { name: 'Fuel', base: 40, cat: 'Industrial' },
  clothes: { name: 'Clothes', base: 40, cat: 'Consumer' },
  furniture: { name: 'Furniture', base: 45, cat: 'Consumer' },
  consumer: { name: 'Appliances', base: 70, cat: 'Consumer' },
  luxuries: { name: 'Luxuries', base: 90, cat: 'Consumer' },
  arms: { name: 'Arms', base: 60, cat: 'Military' },
};
const GOOD_KEYS = Object.keys(GOODS);

// lean = political position of the class; strata sets political weight.
const POP_TYPES = {
  peasants: { name: 'Peasants', econ: -0.1, auth: 0.3, strata: 'lower', desc: 'Subsistence farmers. The labor reserve every other class is recruited from.' },
  laborers: { name: 'Laborers', econ: -0.5, auth: 0.1, strata: 'lower', desc: 'Work farms, mines, forests and construction sites.' },
  workers: { name: 'Workers', econ: -0.6, auth: 0.0, strata: 'lower', desc: 'Staff the factories.' },
  soldiers: { name: 'Soldiers', econ: 0.2, auth: 0.6, strata: 'lower', desc: 'Paid from the military budget. Their number follows army size.' },
  clerks: { name: 'Clerks', econ: 0.1, auth: -0.4, strata: 'middle', literate: true, desc: 'Managers, teachers and white-collar staff. Need literacy.' },
  officials: { name: 'Officials', econ: 0.2, auth: 0.3, strata: 'middle', literate: true, desc: 'Run the state. Paid from administration and police budgets.' },
  clergy: { name: 'Clergy', econ: 0.3, auth: 0.7, strata: 'middle', literate: true, desc: 'Priests and religious teachers.' },
  capitalists: { name: 'Capitalists', econ: 0.8, auth: 0.0, strata: 'upper', literate: true, desc: 'Own mines and factories, and invest their profits in new ones.' },
  landowners: { name: 'Landowners', econ: 0.6, auth: 0.5, strata: 'upper', desc: 'Own farms, ranches and plantations.' },
};
const POP_KEYS = Object.keys(POP_TYPES);
const JOB_KEYS = POP_KEYS.filter(k => k !== 'peasants');
const STRATA_WEIGHT = { lower: 1, middle: 2.5, upper: 8 };
const SOL_EXPECT = { lower: 30, middle: 50, upper: 70 };
const WAGE_WEIGHT = { laborers: 1, workers: 1.1, clerks: 2.5 };

const RES_INFO = {
  arable: 'Arable land', pasture: 'Pasture', forest: 'Forest', coal: 'Coal', iron: 'Iron', oil: 'Oil', fish: 'Fishing grounds',
};
const RES_KEYS = Object.keys(RES_INFO);

// Per-person monthly needs. Goods listed together substitute for each other.
const NEEDS = {
  basic: [{ goods: ['grain'], q: 0.003 }, { goods: ['fish', 'meat'], q: 0.0006 }, { goods: ['clothes'], q: 0.0007 }, { goods: ['coal', 'fuel'], q: 0.0006 }],
  everyday: [{ goods: ['fish', 'meat'], q: 0.0005 }, { goods: ['clothes'], q: 0.0005 }, { goods: ['furniture'], q: 0.0005 }, { goods: ['consumer'], q: 0.0005 }, { goods: ['fuel'], q: 0.0005 }],
  luxury: [{ goods: ['luxuries'], q: 0.002 }, { goods: ['consumer'], q: 0.0015 }, { goods: ['furniture'], q: 0.001 }],
};

const FARM_JOBS = { laborers: 900, clerks: 50, landowners: 50 };
const MINE_JOBS = { laborers: 900, clerks: 70, capitalists: 30 };
const FACTORY_JOBS = { workers: 800, clerks: 170, capitalists: 30 };

// Inputs listed in `support` only boost output (missing them slows a building
// down); all other inputs are materials, and output stops without them.
const BUILDINGS = {
  farm: { name: 'Grain Farm', kind: 'Agriculture', res: 'arable', out: { grain: 45 }, in: { tools: 1.5 }, jobs: FARM_JOBS, cost: 18000 },
  ranch: { name: 'Ranch', kind: 'Agriculture', res: 'pasture', out: { meat: 30 }, in: { grain: 5 }, jobs: FARM_JOBS, cost: 18000 },
  plantation: { name: 'Fiber Plantation', kind: 'Agriculture', res: 'arable', out: { fiber: 45 }, in: { tools: 1.5 }, jobs: FARM_JOBS, cost: 18000 },
  fishery: { name: 'Fishing Fleet', kind: 'Extraction', res: 'fish', out: { fish: 36 }, in: { fuel: 1 }, jobs: MINE_JOBS, cost: 21000 },
  logging: { name: 'Logging Camp', kind: 'Extraction', res: 'forest', out: { timber: 45 }, in: { tools: 1.5 }, jobs: MINE_JOBS, cost: 18000 },
  coalMine: { name: 'Coal Mine', kind: 'Extraction', res: 'coal', out: { coal: 36 }, in: { tools: 2 }, jobs: MINE_JOBS, cost: 27000 },
  ironMine: { name: 'Iron Mine', kind: 'Extraction', res: 'iron', out: { iron: 30 }, in: { tools: 2 }, jobs: MINE_JOBS, cost: 27000 },
  oilWell: { name: 'Oil Well', kind: 'Extraction', res: 'oil', out: { oil: 26 }, in: { tools: 2 }, jobs: MINE_JOBS, cost: 30000 },
  steelMill: { name: 'Steel Mill', kind: 'Industry', out: { steel: 36 }, in: { iron: 20, coal: 12 }, jobs: FACTORY_JOBS, cost: 45000 },
  toolWorks: { name: 'Tool Works', kind: 'Industry', out: { tools: 34 }, in: { steel: 12, timber: 8 }, jobs: FACTORY_JOBS, cost: 42000 },
  refinery: { name: 'Refinery', kind: 'Industry', out: { fuel: 42 }, in: { oil: 22 }, jobs: FACTORY_JOBS, cost: 45000 },
  textileMill: { name: 'Textile Mill', kind: 'Industry', out: { clothes: 35 }, in: { fiber: 25 }, jobs: FACTORY_JOBS, cost: 36000 },
  furnitureWorks: { name: 'Furniture Works', kind: 'Industry', out: { furniture: 31 }, in: { timber: 25 }, jobs: FACTORY_JOBS, cost: 36000 },
  applianceFactory: { name: 'Appliance Factory', kind: 'Industry', out: { consumer: 24 }, in: { steel: 8, fuel: 6 }, jobs: FACTORY_JOBS, cost: 48000 },
  luxuryWorkshop: { name: 'Luxury Workshop', kind: 'Industry', out: { luxuries: 14 }, in: { fiber: 6, timber: 6 }, jobs: FACTORY_JOBS, cost: 36000 },
  armsFactory: { name: 'Arms Factory', kind: 'Industry', out: { arms: 27 }, in: { steel: 14 }, jobs: FACTORY_JOBS, cost: 45000 },
};
const BUILDING_KEYS = Object.keys(BUILDINGS);
const SUPPORT_GOODS = { tools: true, fuel: true };
const PRODUCER_OF = {};
for (const k of BUILDING_KEYS) PRODUCER_OF[Object.keys(BUILDINGS[k].out)[0]] = k;
const RES_USERS = {};
for (const k of BUILDING_KEYS) { const r = BUILDINGS[k].res; if (r) (RES_USERS[r] = RES_USERS[r] || []).push(k); }

const ECON = {
  SUBSIST: 0.005, // grain per peasant per month
  LABOR_SHARE: 0.65,
  BUILD_MONTHS: 6,
  PRICE_MIN: 0.25, PRICE_MAX: 4, ELASTICITY: 0.6, PRICE_SPEED: 0.25,
};

const zeroGoods = () => { const o = {}; for (const g of GOOD_KEYS) o[g] = 0; return o; };
const zeroPops = () => { const o = {}; for (const t of POP_KEYS) o[t] = 0; return o; };

// ------------------------------------------------------------------ setup

function initProvinceResources(game) {
  const rng = makeRng(game.seed + '|res');
  const { height, provOf, provinces } = game.world;
  const hsum = new Float32Array(provinces.length), cnt = new Float32Array(provinces.length);
  for (let t = 0; t < provOf.length; t++) { const p = provOf[t]; if (p >= 0) { hsum[p] += height[t]; cnt[p]++; } }
  for (const P of provinces) {
    const h = hsum[P.id] / Math.max(1, cnt[P.id]);
    const tiles = P.tiles;
    const lowland = clamp(1.15 - h * 1.5, 0.05, 1);
    P.res = {
      arable: Math.round(tiles * lowland * 0.35 * rng.range(0.5, 1.5)),
      pasture: Math.round(tiles * 0.1 * rng.range(0.2, 1.6)),
      forest: Math.round(tiles * clamp(h * 1.4, 0.15, 1) * 0.25 * rng.range(0.3, 1.6)),
      coal: rng.chance(0.35 + h * 0.4) ? rng.int(4, Math.ceil(tiles / 2)) : 0,
      iron: rng.chance(0.3 + h * 0.4) ? rng.int(4, Math.ceil(tiles / 2.5)) : 0,
      oil: rng.chance(0.2) ? rng.int(6, Math.ceil(tiles / 1.2)) : 0,
      fish: P.coastal ? rng.int(2, Math.ceil(tiles / 5) + 2) : 0,
    };
  }
}

function newCountryEcon(c) {
  const prices = {};
  for (const g of GOOD_KEYS) prices[g] = GOODS[g].base;
  return {
    tech: c.tech, prices, pprod: Object.assign({}, prices), fulfill: Object.fromEntries(GOOD_KEYS.map(g => [g, 1])),
    S: zeroGoods(), D: zeroGoods(), imports: zeroGoods(), exports: zeroGoods(),
    investPool: 0, statePool: 0, projects: [], autoInvest: true,
    gdpM: 0, prevGdpM: 0, gdpAnnual: 0, taxBase: 0, tariffRev: 0, stateProfit: 0, tau: 0.25,
    popType: zeroPops(), solType: zeroPops(), incType: zeroPops(), unempType: zeroPops(),
    avgSol: 50, strataSol: { lower: 50, middle: 50, upper: 50 }, unemployment: 0, literacy: 0.3,
    popIdeo: { econ: 0, auth: 0 }, contentment: 0, armsRatio: 1, tradeBalance: 0, built: 0,
  };
}

function productivity(game, c) {
  const p = c.policy;
  let prod = c.econ.tech * (0.85 + p.infrastructure * 0.05);
  if (c.stability < 35) prod *= 1 - (35 - c.stability) * 0.006;
  if (isAtWar(game, c.id)) prod *= 0.96;
  return Math.max(0.05, prod);
}

function constructionCost(c, t) {
  const P = c.econ.prices;
  return BUILDINGS[t].cost * (0.4 * P.steel / GOODS.steel.base + 0.4 * P.timber / GOODS.timber.base + 0.2 * P.tools / GOODS.tools.base);
}

function ownersAllowed(c) { return c.gov !== 'communist'; }

function provinceJobs(c, p) {
  const J = zeroPops();
  const owners = ownersAllowed(c);
  for (const b of p.buildings) {
    const def = BUILDINGS[b.t];
    for (const t in def.jobs) {
      if (!owners && (t === 'capitalists' || t === 'landowners')) { J.officials += def.jobs[t] * b.level * b.active; continue; }
      J[t] += def.jobs[t] * b.level * b.active;
    }
  }
  const pop = p.pop;
  J.officials += pop * 0.012 * (1 + c.policy.police / 8);
  J.clergy += pop * (c.gov === 'theocracy' ? 0.03 : c.gov === 'communist' ? 0.003 : 0.01);
  J.clerks += pop * c.policy.education * 0.0012;
  J.soldiers += c.pop > 0 ? c.army * pop / c.pop : 0;
  return J;
}

// Lay down a starting economy roughly matched to what each nation's people would buy.
function initEconomy(game) {
  initProvinceResources(game);
  const rng = makeRng(game.seed + '|econ');
  for (const p of game.world.provinces) {
    p.pops = zeroPops(); p.pops.peasants = p.pop;
    p.inc = zeroPops(); p.sol = zeroPops(); p.wealth = zeroPops();
    p.buildings = []; p.lit = 0.1;
  }
  for (const c of game.countries) {
    c.econ = newCountryEcon(c);
    planCountryEconomy(game, c, rng);
  }
  // Warm up the markets so prices, staffing and incomes settle before play starts.
  for (const c of game.countries) {
    c.gdp = c.pop * 0.33 * c.econ.tech * 12 / 1e6;
    c.econ.gdpM = c.econ.prevGdpM = c.pop * 0.33 * c.econ.tech;
    c.econ.taxBase = c.econ.gdpM / 1e6;
    c.budget = projectBudget(c);
  }
  for (let i = 0; i < 30; i++) {
    tickEconomy(game, true);
    for (const c of game.countries) { recomputeCountry(game, c); c.budget = projectBudget(c); }
  }
}

function planCountryEconomy(game, c, rng) {
  const E = c.econ, T = E.tech;
  const provs = provincesOf(game, c.id);
  const pop = c.pop;
  const prod = T * (0.85 + c.policy.infrastructure * 0.05);
  // Estimate demand from a poor countryside and a better-paid urban share.
  const rural = clamp(0.8 - 0.18 * T, 0.35, 0.8);
  const Cb = 0.123, Ce = 0.111, Cl = 0.33;
  const D = zeroGoods();
  const addTier = (groups, mult) => { for (const gr of groups) for (const g of gr.goods) D[g] += gr.q * mult / gr.goods.length; };
  const addGroup = (n, inc) => {
    const fb = Math.min(1, inc / Cb);
    const ev = clamp((inc - Cb) / Ce, 0, 1);
    const lux = Math.max(0, inc - Cb - Ce) * 0.65 / Cl;
    addTier(NEEDS.basic, n * fb); addTier(NEEDS.everyday, n * ev); addTier(NEEDS.luxury, n * lux);
  };
  addGroup(pop * rural, 0.11);
  addGroup(pop * (1 - rural), 0.5 * T);
  const gdpM = pop * (rural * 0.11 + (1 - rural) * 0.6 * T);
  D.arms += gdpM * c.policy.military / 100 * 0.35 / GOODS.arms.base;
  D.fuel += gdpM * c.policy.military / 100 * 0.15 / GOODS.fuel.base;
  D.steel += gdpM * c.policy.infrastructure / 100 * 0.3 / GOODS.steel.base;
  D.timber += gdpM * c.policy.infrastructure / 100 * 0.2 / GOODS.timber.base;
  D.grain -= pop * rural * ECON.SUBSIST * Math.pow(T, 0.3);

  const cap = {};
  for (const r of RES_KEYS) cap[r] = provs.reduce((s, p) => s + p.res[r], 0);
  let levels = {};
  for (let iter = 0; iter < 5; iter++) {
    const tot = Object.assign({}, D);
    for (const b in levels) for (const g in BUILDINGS[b].in) tot[g] += levels[b] * BUILDINGS[b].in[g] * prod;
    const next = {};
    for (const g of GOOD_KEYS) {
      const b = PRODUCER_OF[g];
      next[b] = Math.max(0, tot[g]) / (BUILDINGS[b].out[g] * prod);
    }
    levels = next;
  }
  // Raw producers are limited by land; farms and plantations share arable land.
  const arableNeed = levels.farm + levels.plantation;
  if (arableNeed > cap.arable * 0.85) { const k = cap.arable * 0.85 / arableNeed; levels.farm *= k; levels.plantation *= k; }
  for (const b of BUILDING_KEYS) {
    const def = BUILDINGS[b];
    let n = levels[b] * rng.range(0.75, 1.15);
    if (def.res && def.res !== 'arable') n = Math.min(n, cap[def.res] * 0.85);
    let total = Math.floor(n + rng());
    if (total <= 0) continue;
    const pool = def.res ? provs.filter(p => p.res[def.res] > 0) : provs;
    if (!pool.length) continue;
    const used = {};
    while (total-- > 0) {
      const p = rng.weighted(pool, q => def.res ? Math.max(0, q.res[def.res] - (q.buildings.filter(x => BUILDINGS[x.t].res === def.res).reduce((s, x) => s + x.level, 0))) : q.pop);
      if (def.res && resourceFree(p, def.res) <= 0) break;
      addBuilding(p, b, 1);
      used[p.id] = true;
    }
  }
  // Staff the buildings from the peasantry.
  for (const p of provs) {
    p.lit = clamp(0.05 + 0.22 * T + rng.range(-0.05, 0.05), 0.03, 0.9);
    const J = provinceJobs(c, p);
    let need = JOB_KEYS.reduce((s, t) => s + J[t], 0);
    const scale = need > p.pop * 0.85 ? p.pop * 0.85 / need : 1;
    for (const t of JOB_KEYS) { p.pops[t] = J[t] * scale * 0.97; }
    p.pops.peasants = Math.max(0, p.pop - JOB_KEYS.reduce((s, t) => s + p.pops[t], 0));
    const est = { peasants: 0.08, laborers: 0.5, workers: 0.5, soldiers: 0.4, clerks: 1.2, officials: 0.8, clergy: 0.6, capitalists: 6, landowners: 5 };
    for (const t of POP_KEYS) { p.inc[t] = est[t] * (t === 'peasants' ? 1 : T); p.wealth[t] = p.inc[t] * 2; }
  }
}

function resourceFree(p, r) {
  let used = 0;
  for (const b of p.buildings) if (BUILDINGS[b.t].res === r) used += b.level;
  return p.res[r] - used;
}

function addBuilding(p, t, n) {
  const b = p.buildings.find(x => x.t === t);
  if (b) b.level += n;
  else p.buildings.push({ t, level: n, active: 1, idle: 0, va: 0 });
}

// ------------------------------------------------------------------ monthly tick

function tickEconomy(game, warmup) {
  const provs = game.world.provinces;
  const alive = game.countries.filter(c => c.alive);

  // Per-country setup: weights for substitutable needs, tier costs, government spending.
  for (const c of alive) {
    const E = c.econ;
    E.S = zeroGoods(); E.D = zeroGoods(); E.govQ = zeroGoods();
    E.prod = productivity(game, c);
    E.N = zeroPops();
    E.tau = clamp(0.2 + 0.07 * c.trade.length - c.policy.tariff * 0.6 - (isAtWar(game, c.id) ? 0.1 : 0) - (c.gov === 'communist' ? 0.08 : 0), 0.03, 0.75);
    E.vec = {}; E.cost = {};
    for (const tier in NEEDS) {
      const v = zeroGoods();
      let cost = 0;
      for (const gr of NEEDS[tier]) {
        const ws = gr.goods.map(g => 1 / (E.prices[g] * E.prices[g]));
        const wt = ws.reduce((a, b) => a + b, 0);
        gr.goods.forEach((g, i) => { const q = gr.q * ws[i] / wt; v[g] += q; cost += q * E.prices[g]; });
      }
      E.vec[tier] = v; E.cost[tier] = cost;
    }
    const gm = E.gdpM, pol = c.policy;
    E.gov = {
      military: gm * pol.military / 100, welfare: gm * pol.welfare / 100, education: gm * pol.education / 100,
      police: gm * pol.police / 100, infrastructure: gm * pol.infrastructure / 100, admin: gm * ADMIN_COST / 100,
      investment: gm * pol.investment / 100,
    };
    E.construction = 0;
    for (const pr of E.projects) E.construction += pr.cost / ECON.BUILD_MONTHS;
  }
  for (const p of provs) { const E = game.countries[p.owner].econ; for (const t of POP_KEYS) E.N[t] += p.pops[t]; }

  // 1. Production
  for (const p of provs) {
    const c = game.countries[p.owner], E = c.econ;
    const J = provinceJobs(c, p);
    p.jobs = J;
    const fill = {};
    for (const t of POP_KEYS) fill[t] = J[t] > 0 ? Math.min(1, p.pops[t] / J[t]) : 1;
    p.fill = fill;
    for (const b of p.buildings) {
      const def = BUILDINGS[b.t];
      let jw = 0, jf = 0;
      for (const t in def.jobs) { const tt = (!ownersAllowed(c) && (t === 'capitalists' || t === 'landowners')) ? 'officials' : t; jw += def.jobs[t]; jf += def.jobs[t] * fill[tt]; }
      b.staff = jw ? jf / jw : 1;
      const scale = b.level * b.active * b.staff * E.prod;
      let inF = 1;
      for (const g in def.in) {
        const f = E.fulfill[g];
        if (SUPPORT_GOODS[g] && def.kind !== 'Industry') inF *= 0.6 + 0.4 * f;
        else inF = Math.min(inF, f);
      }
      b.inF = inF;
      b.outQ = {};
      for (const g in def.out) { const q = def.out[g] * scale * inF; b.outQ[g] = q; E.S[g] += q; }
      b.inQ = {};
      for (const g in def.in) { const q = def.in[g] * scale; b.inQ[g] = q; E.D[g] += q; }
    }
    p.subsist = p.pops.peasants * ECON.SUBSIST * Math.pow(E.tech, 0.3) * (c.stability < 35 ? 0.9 : 1);
    E.S.grain += p.subsist;
  }

  // 2. Pop demand
  for (const p of provs) {
    const E = game.countries[p.owner].econ;
    p.plan = {};
    for (const t of POP_KEYS) {
      const N = p.pops[t];
      if (N < 1) { p.plan[t] = null; continue; }
      const I = Math.max(0, p.inc[t]);
      const Cb = E.cost.basic, Ce = E.cost.everyday, Cl = E.cost.luxury;
      const B = I + Math.min(p.wealth[t] * 0.3, Math.max(0, Cb + Ce - I));
      const fb = Math.min(1, B / Cb);
      let rem = B - fb * Cb;
      const fe = Math.min(1, rem / Ce);
      rem -= fe * Ce;
      const luxM = Math.max(0, rem * 0.65 / Cl);
      p.plan[t] = { fb, fe, luxM };
      const vb = E.vec.basic, ve = E.vec.everyday, vl = E.vec.luxury;
      for (const g of GOOD_KEYS) E.D[g] += N * (fb * vb[g] + fe * ve[g] + luxM * vl[g]);
    }
  }

  // 3. Government purchases
  for (const c of alive) {
    const E = c.econ, P = E.prices, G = E.gov;
    const buy = (g, k) => { const q = k / P[g]; E.govQ[g] += q; E.D[g] += q; };
    buy('arms', G.military * 0.35 + G.police * 0.3);
    buy('fuel', G.military * 0.15);
    buy('steel', G.infrastructure * 0.3 + E.construction * 0.25);
    buy('timber', G.infrastructure * 0.2 + E.construction * 0.15);
    buy('tools', G.infrastructure * 0.1 + E.construction * 0.1);
  }

  // 4. Markets
  clearMarkets(game, alive);

  // 5. Accounting
  for (const c of alive) {
    const E = c.econ;
    E.prevGdpM = E.gdpM || 1;
    E.gdpNew = 0; E.taxGross = 0; E.stateProfitK = 0;
    E.gross = {};
  }
  for (const p of provs) {
    const c = game.countries[p.owner], E = c.econ, P = E.pprod, PC = E.prices;
    const gross = zeroPops();
    for (const b of p.buildings) {
      const def = BUILDINGS[b.t];
      let rev = 0, inCost = 0;
      for (const g in b.outQ) rev += b.outQ[g] * P[g];
      for (const g in b.inQ) inCost += b.inQ[g] * Math.min(E.fulfill[g], SUPPORT_GOODS[g] ? 1 : b.inF) * PC[g];
      const va = rev - inCost;
      b.va = b.va * 0.7 + (b.level > 0 ? va / b.level : 0) * 0.3;
      // Potential value added at full staffing and inputs decides whether the owners keep it running.
      let pva = 0;
      for (const g in def.out) pva += def.out[g] * P[g];
      for (const g in def.in) pva -= def.in[g] * PC[g];
      b.pva = (b.pva === undefined ? pva : b.pva * 0.7 + pva * 0.3);
      E.gdpNew += va;
      const wages = Math.max(0, va) * ECON.LABOR_SHARE;
      const profit = va - wages;
      let w = 0;
      for (const t in def.jobs) if (WAGE_WEIGHT[t]) w += def.jobs[t] * WAGE_WEIGHT[t] * p.fill[t];
      if (w > 0) for (const t in def.jobs) if (WAGE_WEIGHT[t]) gross[t] += wages * def.jobs[t] * WAGE_WEIGHT[t] * p.fill[t] / w;
      const owner = def.jobs.capitalists ? 'capitalists' : 'landowners';
      if (!ownersAllowed(c)) E.stateProfitK += profit;
      else gross[owner] += profit;
    }
    gross.peasants += p.subsist * P.grain;
    E.gdpNew += p.subsist * P.grain;
    p.gross = gross;
  }
  // State wages and welfare, paid per head across the nation.
  for (const c of alive) {
    const E = c.econ, G = E.gov, N = E.N;
    const theo = c.gov === 'theocracy' ? 0.3 : 0;
    E.govWagePC = {
      officials: N.officials > 0 ? (G.admin * (1 - theo) + G.police * 0.7) / N.officials : 0,
      soldiers: N.soldiers > 0 ? G.military * 0.5 / N.soldiers : 0,
      clerks: N.clerks > 0 ? G.education * 0.7 / N.clerks : 0,
      clergy: N.clergy > 0 ? (G.education * 0.3 + G.admin * theo) / N.clergy : 0,
      laborers: N.laborers > 0 ? (G.infrastructure * 0.4 + E.construction * 0.5) / N.laborers : 0,
    };
    E.gdpNew += G.admin + G.police * 0.7 + G.military * 0.5 + G.education + G.infrastructure * 0.4 + E.construction * 0.5;
    const ww = N.peasants * 1.5 + N.laborers + N.workers;
    E.welfarePC = { peasants: ww > 0 ? G.welfare * 1.5 / ww : 0, laborers: ww > 0 ? G.welfare / ww : 0, workers: ww > 0 ? G.welfare / ww : 0 };
    E.statePool += G.investment;
  }
  // Pops: taxes, spending, savings, standard of living.
  for (const c of alive) {
    const E = c.econ;
    E.popType = zeroPops(); E.solType = zeroPops(); E.incType = zeroPops(); E.unempType = zeroPops();
    E.privateSavings = 0;
  }
  for (const p of provs) {
    const c = game.countries[p.owner], E = c.econ, PC = E.prices, F = E.fulfill;
    const tax = c.policy.tax;
    for (const t of POP_KEYS) {
      const N = p.pops[t];
      const plan = p.plan[t];
      const grossT = p.gross[t] + (E.govWagePC[t] || 0) * N;
      E.taxGross += grossT;
      const net = grossT * (1 - tax) + (E.welfarePC[t] || 0) * N;
      if (N < 1 || !plan) { p.inc[t] = 0; p.sol[t] = 0; continue; }
      const vb = E.vec.basic, ve = E.vec.everyday, vl = E.vec.luxury;
      let spend = 0, bVal = 0, bGot = 0, eVal = 0, eGot = 0, lGot = 0;
      for (const g of GOOD_KEYS) {
        const q = plan.fb * vb[g] + plan.fe * ve[g] + plan.luxM * vl[g];
        spend += q * F[g] * PC[g];
        bVal += vb[g] * PC[g]; bGot += plan.fb * vb[g] * F[g] * PC[g];
        eVal += ve[g] * PC[g]; eGot += plan.fe * ve[g] * F[g] * PC[g];
        lGot += plan.luxM * vl[g] * F[g] * PC[g];
      }
      const incPC = net / N;
      p.inc[t] = incPC;
      let saved = incPC - spend;
      if (saved > 0 && (t === 'capitalists' || t === 'landowners')) {
        E.privateSavings += saved * 0.6 * N;
        saved *= 0.4;
      }
      p.wealth[t] = clamp(p.wealth[t] + saved, 0, incPC * 24 + 5);
      const fbA = bVal > 0 ? bGot / bVal : 1, feA = eVal > 0 ? eGot / eVal : 1;
      const lux = Math.min(1, lGot / (E.cost.luxury * 3));
      p.fb = p.fb || {};
      p.fb[t] = fbA;
      p.sol[t] = clamp(45 * fbA + 30 * feA + 25 * lux, 0, 100);
    }
  }

  // 6. Labor market, building activity, pop growth, literacy
  for (const p of provs) {
    const c = game.countries[p.owner];
    const J = p.jobs;
    for (const b of p.buildings) {
      if (b.pva <= 0) b.active = Math.max(0, b.active - 0.1);
      else if (b.staff > 0.85) b.active = Math.min(1, b.active + 0.05);
      b.idle = b.active < 0.15 ? b.idle + 1 : 0;
    }
    if (!warmup) {
      p.buildings = p.buildings.filter(b => {
        if (b.idle >= 24) { b.level--; b.idle = 0; b.active = 0.3; }
        return b.level > 0;
      });
    }
    for (const t of JOB_KEYS) {
      const N = p.pops[t], want = J[t];
      if (N < want) {
        const lit = POP_TYPES[t].literate ? 0.15 + 0.85 * p.lit : 1;
        const hire = Math.min(p.pops.peasants * 0.05, (want - N) * (t === 'soldiers' ? 0.5 : 0.25)) * lit;
        p.pops.peasants -= hire; p.pops[t] += hire;
      } else if (N > want) {
        const fire = (N - want) * (t === 'soldiers' ? 0.3 : 0.06);
        p.pops[t] -= fire; p.pops.peasants += fire;
      }
    }
    if (!warmup) {
      const war = isAtWar(game, c.id) ? 0.0005 : 0;
      for (const t of POP_KEYS) {
        const fb = p.fb ? (p.fb[t] === undefined ? 1 : p.fb[t]) : 1;
        p.pops[t] *= 1 + (-0.0016 + 0.0028 * fb - war);
      }
      const litT = clamp(0.05 + c.policy.education * 0.08 + c.econ.tech * 0.08, 0, 0.98);
      p.lit += (litT - p.lit) * 0.008;
    }
    p.pop = POP_KEYS.reduce((s, t) => s + p.pops[t], 0);
  }

  // 7. Investment & construction
  for (const c of alive) {
    const E = c.econ;
    if (ownersAllowed(c)) E.investPool += E.privateSavings;
    if (!warmup) {
      runConstruction(game, c);
      invest(game, c, 'private');
      if (c.id !== game.player || E.autoInvest) invest(game, c, 'state');
    }
    E.investPool *= 0.995; // capital that finds no use slowly leaks abroad
  }

  // 8. National statistics
  for (const p of provs) {
    const E = game.countries[p.owner].econ;
    for (const t of POP_KEYS) {
      const N = p.pops[t];
      E.popType[t] += N;
      E.solType[t] += p.sol[t] * N;
      E.incType[t] += p.inc[t] * N;
      if (t !== 'peasants') E.unempType[t] += Math.max(0, N - p.jobs[t]);
    }
    E.litSum = (E.litSum || 0) + p.lit * p.pop;
  }
  for (const c of alive) {
    const E = c.econ;
    let tot = 0, solSum = 0, jobPop = 0, unemp = 0, ie = 0, ia = 0, iw = 0;
    const st = { lower: [0, 0], middle: [0, 0], upper: [0, 0] };
    for (const t of POP_KEYS) {
      const N = E.popType[t];
      tot += N;
      if (N > 0) { E.solType[t] /= N; E.incType[t] /= N; }
      solSum += E.solType[t] * N;
      const s = POP_TYPES[t].strata;
      st[s][0] += E.solType[t] * N; st[s][1] += N;
      if (t !== 'peasants') { jobPop += N; unemp += E.unempType[t]; }
      // Political weight: richer classes count for more; misery radicalizes.
      const sol = E.solType[t];
      const w = N * STRATA_WEIGHT[s];
      const misery = Math.max(0, 45 - sol) / 45;
      ie += w * (POP_TYPES[t].econ - misery * 0.4);
      ia += w * (POP_TYPES[t].auth + misery * 0.3);
      iw += w;
    }
    E.literacy = tot > 0 ? (E.litSum || 0) / tot : 0;
    E.litSum = 0;
    E.popIdeo = iw > 0 ? { econ: clamp(ie / iw - E.literacy * 0.1, -1, 1), auth: clamp(ia / iw - E.literacy * 0.35, -1, 1) } : { econ: 0, auth: 0 };
    E.avgSol = tot > 0 ? solSum / tot : 0;
    // Contentment: standard of living measured against what each class expects.
    let cs = 0;
    for (const t of POP_KEYS) cs += (E.solType[t] - SOL_EXPECT[POP_TYPES[t].strata]) * E.popType[t];
    E.contentment = tot > 0 ? cs / tot : 0;
    for (const s in st) E.strataSol[s] = st[s][1] > 0 ? st[s][0] / st[s][1] : 0;
    E.unemployment = jobPop > 0 ? unemp / jobPop : 0;
    E.gdpM = Math.max(1, E.gdpNew);
    E.gdpAnnual = E.gdpM * 12 / 1e6;
    E.taxBase = E.taxGross / 1e6;
    E.stateProfit = E.stateProfitK / 1e6;
    const desiredArms = (E.gov.military * 0.35 + E.gov.police * 0.3) / GOODS.arms.base;
    E.armsRatio = desiredArms > 0 ? clamp(E.govQ.arms * E.fulfill.arms / desiredArms, 0, 1.5) : 1;
    let tb = 0;
    for (const g of GOOD_KEYS) tb += (E.exports[g] - E.imports[g]) * game.worldMarket.prices[g];
    E.tradeBalance = tb / 1e6;
  }
}

function clearMarkets(game, alive) {
  const W = game.worldMarket || (game.worldMarket = { prices: {}, S: {}, D: {}, traded: {} });
  for (const c of alive) c.econ.tariffK = 0;
  for (const g of GOOD_KEYS) {
    const base = GOODS[g].base;
    let exportable = 0, need = 0, SS = 0, DD = 0;
    for (const c of alive) {
      const E = c.econ, S = E.S[g], D = E.D[g];
      SS += S; DD += D;
      if (S > D) exportable += (S - D) * E.tau; else need += (D - S) * E.tau;
    }
    const traded = Math.min(exportable, need);
    const rE = exportable > 0 ? traded / exportable : 0, rI = need > 0 ? traded / need : 0;
    const wpT = base * clamp(Math.pow((DD + 1e-6) / (SS + 1e-6), ECON.ELASTICITY), ECON.PRICE_MIN, ECON.PRICE_MAX);
    const wp = W.prices[g] = (W.prices[g] || base) * (1 - ECON.PRICE_SPEED) + wpT * ECON.PRICE_SPEED;
    W.S[g] = SS; W.D[g] = DD; W.traded[g] = traded;
    for (const c of alive) {
      const E = c.econ, S = E.S[g], D = E.D[g];
      const ex = S > D ? (S - D) * E.tau * rE : 0;
      const im = D > S ? (D - S) * E.tau * rI : 0;
      const avail = S - ex + im;
      E.exports[g] = ex; E.imports[g] = im;
      E.fulfill[g] = D > 0 ? Math.min(1, avail / D) : 1;
      let localT;
      if (D <= 0 && S <= 0) localT = base;
      else if (avail <= 0) localT = base * ECON.PRICE_MAX;
      else localT = base * clamp(Math.pow((D + 1e-6) / avail, ECON.ELASTICITY), ECON.PRICE_MIN, ECON.PRICE_MAX);
      const wpEff = wp * (im > 0 ? 1 + c.policy.tariff : 1);
      const target = Math.exp((1 - E.tau) * Math.log(localT) + E.tau * Math.log(wpEff));
      E.prices[g] = E.prices[g] * (1 - ECON.PRICE_SPEED) + target * ECON.PRICE_SPEED;
      // Producers sell exports at the world price.
      E.pprod[g] = S > 0 ? ((S - ex) * E.prices[g] + ex * wp) / S : E.prices[g];
      E.tariffK += im * wp * c.policy.tariff;
    }
  }
  for (const c of alive) c.econ.tariffRev = c.econ.tariffK / 1e6;
}

// ------------------------------------------------------------------ investment

function buildingProspects(game, c) {
  const E = c.econ, P = E.prices;
  const provs = provincesOf(game, c.id);
  return BUILDING_KEYS.map(t => {
    const def = BUILDINGS[t];
    let prov = null;
    if (def.res) {
      let best = -1;
      for (const p of provs) { const free = resourceFree(p, def.res); if (free > 0 && p.pops.peasants > best) { best = p.pops.peasants; prov = p; } }
    } else {
      let best = -1;
      for (const p of provs) if (p.pops.peasants > best) { best = p.pops.peasants; prov = p; }
    }
    let rev = 0, cost = 0;
    for (const g in def.out) rev += def.out[g] * E.pprod[g];
    for (const g in def.in) cost += def.in[g] * P[g];
    const va = (rev - cost) * E.prod;
    const price = constructionCost(c, t);
    const g0 = Object.keys(def.out)[0];
    return { t, prov, va, cost: price, roi: va * 12 / price, scarcity: P[g0] / GOODS[g0].base, reason: prov ? null : def.res ? `No free ${RES_INFO[def.res].toLowerCase()}` : 'No province' };
  });
}

function startProject(game, c, t, prov, cost, funder) {
  c.econ.projects.push({ t, prov: prov.id, cost, done: game.month + ECON.BUILD_MONTHS, funder });
}

function invest(game, c, kind) {
  const E = c.econ;
  const pool = kind === 'private' ? 'investPool' : 'statePool';
  for (let tries = 0; tries < 12; tries++) {
    const opts = buildingProspects(game, c).filter(o => o.prov && o.prov.pops.peasants > 1500 && o.va > 0 && !pendingFor(c, o));
    if (!opts.length) return;
    let best = null, bs = 0;
    for (const o of opts) {
      // Private capital chases owner returns; the state builds what is scarce.
      const score = kind === 'private' ? o.roi * 0.35 : o.roi * Math.pow(o.scarcity, 1.5);
      if (score > bs) { bs = score; best = o; }
    }
    if (!best || (kind === 'private' ? best.roi * 0.35 < 0.08 : best.roi < 0.06)) return;
    if (E[pool] < best.cost) return;
    E[pool] -= best.cost;
    startProject(game, c, best.t, best.prov, best.cost, kind);
  }
}

function pendingFor(c, o) {
  // Avoid queueing several identical resource buildings on the last free slot.
  const def = BUILDINGS[o.t];
  if (!def.res) return false;
  const pending = c.econ.projects.filter(p => p.prov === o.prov.id && BUILDINGS[p.t].res === def.res).length;
  return pending >= resourceFree(o.prov, def.res);
}

function runConstruction(game, c) {
  const E = c.econ;
  const done = [];
  E.projects = E.projects.filter(pr => {
    if (game.month < pr.done) return true;
    const p = game.world.provinces[pr.prov];
    if (p.owner !== c.id) return false; // lost the province
    const def = BUILDINGS[pr.t];
    if (def.res && resourceFree(p, def.res) <= 0) return false;
    addBuilding(p, pr.t, 1);
    E.built++;
    if (pr.funder === 'you') done.push(def.name);
    return false;
  });
  if (done.length && c.id === game.player) {
    const counts = {};
    for (const n of done) counts[n] = (counts[n] || 0) + 1;
    toastPlayer(game, 'Construction complete: ' + Object.entries(counts).map(([n, k]) => (k > 1 ? k + '× ' : '') + n).join(', ') + '.', 'good');
  }
}

// Player-ordered construction, paid from the state investment fund first, then the treasury.
function orderBuilding(game, t) {
  const c = game.countries[game.player], E = c.econ;
  const o = buildingProspects(game, c).find(x => x.t === t);
  if (!o.prov) return { ok: false, msg: o.reason };
  if (pendingFor(c, o)) return { ok: false, msg: 'All suitable land is already being developed.' };
  const costB = o.cost / 1e6;
  const fromPool = Math.min(E.statePool, o.cost);
  const fromTreasury = (o.cost - fromPool) / 1e6;
  if (c.treasury - fromTreasury < -c.gdp) return { ok: false, msg: 'The treasury cannot borrow any more.' };
  E.statePool -= fromPool;
  c.treasury -= fromTreasury;
  startProject(game, c, t, o.prov, o.cost, 'you');
  return { ok: true, msg: `Construction of a ${BUILDINGS[t].name} begins in ${o.prov.name} (${fmtBillions(costB)}). Ready in ${ECON.BUILD_MONTHS} months.` };
}

function fmtBillions(b) {
  if (b >= 1) return '$' + b.toFixed(1) + 'B';
  return '$' + (b * 1000).toFixed(0) + 'M';
}

// Aggregate buildings across a nation for display.
function nationalIndustry(game, c) {
  const out = {};
  for (const t of BUILDING_KEYS) out[t] = { t, levels: 0, employed: 0, jobs: 0, va: 0, output: 0, active: 0 };
  for (const p of game.world.provinces) {
    if (p.owner !== c.id) continue;
    for (const b of p.buildings) {
      const o = out[b.t], def = BUILDINGS[b.t];
      o.levels += b.level;
      const jobs = Object.values(def.jobs).reduce((a, x) => a + x, 0) * b.level;
      o.jobs += jobs;
      o.employed += jobs * b.active * (b.staff === undefined ? 1 : b.staff);
      o.va += b.va * b.level;
      o.active += b.active * b.level;
      for (const g in (b.outQ || {})) o.output += b.outQ[g];
    }
  }
  for (const t in out) { const o = out[t]; if (o.levels) { o.va /= o.levels; o.active /= o.levels; } }
  return out;
}

function provinceSol(p) {
  let s = 0, n = 0;
  for (const t of POP_KEYS) { s += (p.sol ? p.sol[t] : 0) * p.pops[t]; n += p.pops[t]; }
  return n > 0 ? s / n : 0;
}

function provinceIndustry(p) {
  let ind = 0;
  for (const b of p.buildings) if (BUILDINGS[b.t].kind === 'Industry') ind += b.level * b.active * 1000;
  return p.pop > 0 ? ind / p.pop : 0;
}
