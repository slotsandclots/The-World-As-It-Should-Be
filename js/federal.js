'use strict';
// Internal structure: province designations, separatism and federations.
//
// p.designation: null | 'sez' | 'autonomous' | 'colonial'
// p.state: id of the former nation a federal state came from (or a region index for a federalized nation)
// c.federal: true for federations; c.separatists = { key: { support, radicalism, leaderId } }

const DESIGNATIONS = {
  sez: {
    name: 'Special Economic Zone', short: 'SEZ', pc: 20, max: 3, tax: 0.4, prod: 1.12, buildCost: 0.7,
    desc: 'Low taxes and light rules draw investment: buildings here are 12% more productive and 30% cheaper to build, and capital flows here first. Income taxes are only 40% of normal. Workers elsewhere resent it.',
  },
  autonomous: {
    name: 'Autonomous Region', short: 'Autonomy', pc: 15, tax: 0.7, separatism: 0.3, soldiers: 0.5,
    desc: 'Local self-rule: separatism falls by 70%, but the region pays 30% less tax and sends half the soldiers.',
  },
  colonial: {
    name: 'Colonial Administration', short: 'Colony', pc: 10, tax: 1.25, rawProd: 1.25, separatism: 1.8, onlyNonCore: true,
    desc: 'Extraction above all: farms, mines and wells produce 25% more and taxes are 25% higher, but separatism nearly doubles.',
  },
};
const DESIGNATION_KEYS = Object.keys(DESIGNATIONS);

function designationOf(p) { return p.designation ? DESIGNATIONS[p.designation] : null; }
function provTaxFactor(p) { const d = designationOf(p); return d ? d.tax : 1; }
function provProdFactor(p, def) {
  const d = designationOf(p);
  if (!d) return 1;
  if (d.prod) return d.prod;
  if (d.rawProd && def.kind !== 'Industry') return d.rawProd;
  return 1;
}
function sezCount(game, c) { return game.world.provinces.filter(p => p.owner === c.id && p.designation === 'sez').length; }

function setDesignation(game, pid, key) {
  const c = game.countries[game.player], p = game.world.provinces[pid];
  if (!p || p.owner !== c.id) return { ok: false, msg: 'Not our province.' };
  if (!key) { p.designation = null; return { ok: true, msg: `${p.name} returns to ordinary administration.` }; }
  const D = DESIGNATIONS[key];
  if (D.onlyNonCore && p.core === c.id) return { ok: false, msg: 'Only conquered land can be run as a colony.' };
  if (key === 'sez' && p.designation !== 'sez' && sezCount(game, c) >= D.max) return { ok: false, msg: `We can run at most ${D.max} special economic zones.` };
  if (c.pc < D.pc) return { ok: false, msg: `Needs ${D.pc} political capital.` };
  c.pc -= D.pc;
  p.designation = key;
  return { ok: true, msg: `${p.name} becomes a ${D.name.toLowerCase()}.` };
}

// ------------------------------------------------------------------ separatism

// Regions with their own identity: unintegrated conquests, grouped by original owner,
// and the states of a federation.
function separatistRegions(game, c) {
  const regions = {};
  for (const p of game.world.provinces) {
    if (p.owner !== c.id || p.id === c.capital) continue;
    let key = null;
    if (p.core !== undefined && p.core !== c.id) key = 'c' + p.core;
    else if (c.federal && p.state !== undefined && p.state !== null) key = 's' + p.state;
    if (!key) continue;
    (regions[key] = regions[key] || { key, provs: [], core: p.core !== c.id ? p.core : null, state: p.state }).provs.push(p);
  }
  return Object.values(regions);
}

function regionName(game, c, r) {
  if (r.core != null) return game.countries[r.core].name;
  const capital = r.provs.slice().sort((a, b) => b.pop - a.pop)[0];
  return capital.name;
}

function tickSeparatism(game, c) {
  c.separatists = c.separatists || {};
  const regions = separatistRegions(game, c);
  const keys = new Set(regions.map(r => r.key));
  for (const k in c.separatists) if (!keys.has(k)) delete c.separatists[k];
  let pressure = 0;
  for (const r of regions) {
    const s = c.separatists[r.key] = c.separatists[r.key] || { support: 10, radicalism: 20, leaderId: null };
    let pop = 0, sol = 0, occ = 0, mult = 0;
    for (const p of r.provs) {
      pop += p.pop; sol += provinceSol(p) * p.pop; occ += occupationFactor(game, p) * p.pop;
      const d = designationOf(p);
      mult += (d && d.separatism !== undefined ? d.separatism : 1) * p.pop;
    }
    if (pop <= 0) continue;
    sol /= pop; occ /= pop; mult /= pop;
    const ageFrac = r.core != null ? Math.min(1, ...r.provs.map(p => (p.conquered ? (game.month - p.conquered.month) / INTEGRATION_MONTHS : 0.5))) : 1;
    let t = r.core != null ? 35 + occ * 30 - ageFrac * 25 : 8;
    if (r.core != null && game.countries[r.core].alive && getNeighbors(game, c.id).includes(r.core)) t += 12; // a homeland next door
    t += Math.max(0, 32 - sol) * 0.8;
    t -= (c.approval - 50) * 0.2;
    t += r.provs.reduce((s, p) => s + (p.grievance || 0) * p.pop, 0) / Math.max(1, pop) * 40;
    const ml = c.movements && c.movements.minority;
    if (ml) t += ml.support * ml.radicalism / 100 * 0.6;
    if (c.federal) t *= 0.5;
    t *= mult;
    s.support += (clamp(t, 0, 95) - s.support) * 0.04;
    const repressive = c.policy.police > 3.5 || c.freedom < 30;
    s.radicalism += (clamp(s.support * 0.9 + (repressive ? 12 : 0) + (s.angry || 0), 0, 100) - s.radicalism) * 0.04;
    s.angry = (s.angry || 0) * 0.95;
    pressure += s.support * s.radicalism / 100 * (pop / Math.max(1, c.pop)) * 0.5;
    // Secession.
    if (s.support > 55 && s.radicalism > 65 && game.rng.chance(0.015)) secede(game, c, r);
  }
  c.separatistPressure = pressure;
}

function secede(game, c, r) {
  const name = regionName(game, c, r);
  delete c.separatists[r.key];
  if (r.core != null) {
    const N = game.countries[r.core];
    const res = releaseNation(game, c.id, r.core, { gov: N.alive ? N.gov : rngGov(game) });
    if (!res.ok) return;
    adjust(c, { stability: -10, legitimacy: -8 });
    logNews(game, `${name} breaks away from ${c.name}!`, 'gov', [c.id, r.core]);
    if (c.id === game.player) notify(game, `${name} Secedes`, `Separatists have taken control of ${r.provs.length} province${r.provs.length > 1 ? 's' : ''} and declared ${N.alive ? 'their return to ' + N.name : 'the rebirth of ' + N.name}. Granting autonomy or integrating land faster might have kept them.`);
  }
}

function rngGov(game) { return game.rng.weighted(GOV_ORDER, k => GOV_START_WEIGHTS[k]); }

const SEPARATISM_ACTIONS = {
  autonomy: { name: 'Grant autonomy', pc: 20, desc: 'Make every province of the region autonomous.' },
  suppress: { name: 'Suppress', pc: 15, desc: 'Arrest the leaders: support falls, but radicalism rises and freedom suffers.' },
  referendum: { name: 'Hold a referendum', pc: 10, desc: 'Let them vote. If more than half support independence, the region leaves peacefully; if not, the movement loses its fire.' },
};

function separatismAction(game, key, action) {
  const c = game.countries[game.player];
  const r = separatistRegions(game, c).find(x => x.key === key);
  const s = c.separatists && c.separatists[key];
  const A = SEPARATISM_ACTIONS[action];
  if (!r || !s) return { ok: false, msg: 'The movement is gone.' };
  if (c.pc < A.pc) return { ok: false, msg: `Needs ${A.pc} political capital.` };
  c.pc -= A.pc;
  const name = regionName(game, c, r);
  if (action === 'autonomy') { for (const p of r.provs) p.designation = 'autonomous'; s.radicalism *= 0.6; return { ok: true, msg: `${name} becomes an autonomous region.` }; }
  if (action === 'suppress') { s.support *= 0.75; s.angry = (s.angry || 0) + 15; adjust(c, { freedom: -5, intelligentsia: -4 }); return { ok: true, msg: `Separatist leaders in ${name} are arrested.` }; }
  const yes = clamp(s.support / 100 + game.rng.normal() * 0.06, 0, 1);
  if (yes > 0.5 && r.core != null) {
    const N = game.countries[r.core];
    releaseNation(game, c.id, r.core, { gov: N.alive ? N.gov : c.gov });
    adjust(c, { legitimacy: 5 });
    addRel(game, c.id, r.core, 30);
    return { ok: true, msg: `${name} votes ${(yes * 100).toFixed(0)}% for independence and leaves peacefully.` };
  }
  s.support *= 0.5; s.radicalism *= 0.4;
  adjust(c, { legitimacy: 4 });
  return { ok: true, msg: `${name} votes ${(yes * 100).toFixed(0)}% for independence: the union holds.` };
}

// ------------------------------------------------------------------ federations

function federalFormal(c, formal) {
  if (!c.federal) return formal;
  if (/^(Republic|Kingdom|Realm|Empire|State|Holy State|People's Republic|Grand Duchy) of /.test(formal)) return 'Federal ' + formal;
  return formal + ' Federation';
}

function federateCheck(game, b) {
  if (b.type !== 'confederation') return 'Only a confederation can become a federation.';
  const L = game.countries[b.leader];
  for (const m of b.members) {
    if (m === b.leader) continue;
    const o = game.countries[m];
    if (relation(game, m, b.leader) < 50) return `${o.name} does not trust ${L.name} enough (relations below 50).`;
    const sameFamily = (GOVS[o.gov].elections === 'free') === (GOVS[L.gov].elections === 'free');
    if (!sameFamily) return `${o.name}'s system is incompatible with ${L.name}'s.`;
  }
  return null;
}

// The confederation's members merge into its leader as federal states.
function federate(game, b) {
  const L = game.countries[b.leader];
  const members = b.members.filter(m => m !== b.leader);
  for (const p of game.world.provinces) if (p.owner === L.id && p.state == null) p.state = L.id;
  for (const m of members) {
    const o = game.countries[m];
    for (const x of subjectsOf(game, m)) x.overlord = L.id;
    for (const p of provincesOf(game, m)) {
      transferProvince(game, p.id, L.id);
      p.core = L.id; p.conquered = null; p.state = m;
    }
    logNews(game, `${o.name} joins the ${federalFormal(Object.assign({}, L, { federal: true }), formalName(L))} as a federal state.`, 'gov', [L.id, m]);
  }
  L.federal = true;
  adjust(L, { legitimacy: 8, stability: 5 });
  dissolveBloc(game, b);
  logNews(game, `The ${b.name} becomes the ${formalName(L)}.`, 'gov', [L.id, ...members]);
  if (members.includes(game.player)) game.pending.push({ type: 'gameover', reason: `Our nation has merged into the ${formalName(L)} as a federal state. You can choose another nation in this world.` });
  game.mapDirty = true;
}

function playerFederate(game, blocId) {
  const c = game.countries[game.player], b = blocById(game, blocId);
  if (!b || b.leader !== c.id) return { ok: false, msg: 'Only the leader can propose federation.' };
  const why = federateCheck(game, b);
  if (why) return { ok: false, msg: why };
  if (c.pc < 50) return { ok: false, msg: 'Needs 50 political capital.' };
  c.pc -= 50;
  federate(game, b);
  return { ok: true, msg: `The ${formalName(c)} is born.` };
}

// Split a large unitary nation into federal regions.
function federalize(game, c) {
  const provs = provincesOf(game, c.id);
  const k = clamp(Math.round(provs.length / 5), 2, 6);
  const rng = makeRng(game.seed + '|fed' + c.id);
  let centers = rng.shuffle(provs).slice(0, k).map(p => [p.lx, p.ly]);
  let assign = new Map();
  for (let it = 0; it < 6; it++) {
    for (const p of provs) {
      let best = 0, bd = Infinity;
      centers.forEach((ct, i) => { const d = (p.lx - ct[0]) ** 2 + (p.ly - ct[1]) ** 2; if (d < bd) { bd = d; best = i; } });
      assign.set(p.id, best);
    }
    centers = centers.map((ct, i) => {
      const ps = provs.filter(p => assign.get(p.id) === i);
      return ps.length ? [ps.reduce((s, p) => s + p.lx, 0) / ps.length, ps.reduce((s, p) => s + p.ly, 0) / ps.length] : ct;
    });
  }
  for (const p of provs) if (p.state == null) p.state = 1000 + c.id * 10 + assign.get(p.id);
  c.federal = true;
}

const FEDERAL_ACTIONS = {
  federalize: { name: 'Federalize the nation', pc: 30, desc: 'Divide the nation into self-governing states: separatism halves, stability +4 and legitimacy +5, but tax collection falls 5% and political capital comes 10% slower.' },
  centralize: { name: 'Centralize the state', pc: 30, desc: 'Abolish the federal states. Taxes and political capital recover, but stability −8 and the old states remember.' },
};

function federalAction(game, action) {
  const c = game.countries[game.player], A = FEDERAL_ACTIONS[action];
  if (c.pc < A.pc) return { ok: false, msg: `Needs ${A.pc} political capital.` };
  if (action === 'federalize') {
    if (c.federal) return { ok: false, msg: 'Already a federation.' };
    if (c.provinceCount < 6) return { ok: false, msg: 'Too small to federalize (needs 6 provinces).' };
    c.pc -= A.pc; federalize(game, c); adjust(c, { stability: 4, legitimacy: 5 });
    return { ok: true, msg: `The ${formalName(c)} is proclaimed.` };
  }
  if (!c.federal) return { ok: false, msg: 'Not a federation.' };
  c.pc -= A.pc; c.federal = false; adjust(c, { stability: -8 });
  for (const p of provincesOf(game, c.id)) if (p.state != null && p.state >= 1000) p.state = null;
  return { ok: true, msg: `The federation is abolished. ${c.name} is a unitary state again.` };
}

function tickFederal(game) {
  for (const c of game.countries) {
    if (!c.alive) continue;
    tickSeparatism(game, c);
  }
  // AI confederations occasionally federate.
  for (const b of (game.blocs || []).slice()) {
    if (b.type !== 'confederation' || b.leader === game.player || b.members.includes(game.player)) continue;
    if (game.month - b.founded > 120 && game.rng.chance(0.002) && !federateCheck(game, b)) federate(game, b);
  }
}
