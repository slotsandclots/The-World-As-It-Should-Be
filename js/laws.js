'use strict';
// Laws and interest groups (Milestone 2). A state's constitution is a set of
// laws, one per category. Each government type comes with a preset; effects
// are measured against the preset of the current regime, so a state that keeps
// its traditional laws feels no extra push, while one that drifts gets the
// consequences. Changing a law takes months and needs support: seats in
// parliament where there are free elections, the power base elsewhere.
//
// c.laws = { category: option }, c.reform = { cat, opt, progress, months } | null

const LAW_CATS = {
  head: {
    name: 'Head of state', opts: {
      elected: { name: 'Elected president', desc: 'The head of state answers to voters.', fx: { legitimacy: 6, intelligentsia: 6, military: -4, pc: -0.15 }, pos: [0, -0.5] },
      monarch: { name: 'Constitutional crown', desc: 'A monarch reigns; ministers govern.', fx: { legitimacy: 8, clergy: 5, stability: 2 }, pos: [0.2, 0] },
      autocrat: { name: 'Sole ruler', desc: 'All power rests with one person or one council.', fx: { pc: 0.3, legitimacy: -6, intelligentsia: -6 }, pos: [0, 0.8] },
    },
  },
  suffrage: {
    name: 'Suffrage', opts: {
      universal: { name: 'Universal suffrage', desc: 'Every adult votes.', fx: { legitimacy: 6, workers: 6, approval: 2, business: -2 }, pos: [-0.2, -0.5] },
      property: { name: 'Property franchise', desc: 'Only those with property vote.', fx: { business: 6, workers: -8, unrest: 3 }, pos: [0.5, 0.2] },
      none: { name: 'No elections', desc: 'The people have no vote.', fx: { legitimacy: -6, unrest: 2, pc: 0.15 }, pos: [0, 0.8] },
    },
  },
  press: {
    name: 'Press', opts: {
      free: { name: 'Free press', desc: 'Newspapers print what they like.', fx: { freedom: 12, intelligentsia: 10, corruption: -6, unrest: 2, pc: -0.1 }, pos: [0, -0.6] },
      licensed: { name: 'Licensed press', desc: 'Papers need a license that can be revoked.', fx: { freedom: -4, intelligentsia: -3 }, pos: [0, 0.2] },
      state: { name: 'State media', desc: 'The state owns the news.', fx: { freedom: -18, intelligentsia: -12, unrest: -3, corruption: 5, pc: 0.2 }, pos: [0, 0.9] },
    },
  },
  assembly: {
    name: 'Assembly', opts: {
      protected: { name: 'Right to protest', desc: 'Strikes and marches are legal.', fx: { freedom: 8, workers: 5, intelligentsia: 4, unrest: 3 }, pos: [-0.2, -0.6] },
      restricted: { name: 'Permits required', desc: 'Gatherings need police approval.', fx: { freedom: -3, unrest: -1 }, pos: [0.1, 0.3] },
      banned: { name: 'Gatherings banned', desc: 'Public meetings are illegal.', fx: { freedom: -12, unrest: -5, stability: -2, workers: -5, intelligentsia: -6 }, pos: [0.1, 0.9] },
    },
  },
  church: {
    name: 'Church and state', opts: {
      secular: { name: 'Secular state', desc: 'Religion is a private matter.', fx: { clergy: -12, intelligentsia: 5, minorities: 4 }, pos: [-0.3, -0.3] },
      tolerant: { name: 'Freedom of worship', desc: 'All faiths are tolerated.', fx: {}, pos: [0, 0] },
      state: { name: 'State church', desc: 'One faith, funded and favored by the state.', fx: { clergy: 12, intelligentsia: -6, legitimacy: 4, minorities: -8 }, pos: [0.3, 0.6] },
    },
  },
  labor: {
    name: 'Labor', opts: {
      unions: { name: 'Free unions', desc: 'Workers organize and bargain.', fx: { workers: 10, business: -8, approval: 1, growth: -0.0001 }, pos: [-0.6, -0.3] },
      none: { name: 'No protections', desc: 'Employers set the terms.', fx: { workers: -9, business: 9, unrest: 3, growth: 0.0002 }, pos: [0.7, 0.2] },
      stateUnions: { name: 'State unions', desc: 'One official union, run by the state.', fx: { workers: 3, business: -3, freedom: -4, pc: 0.1 }, pos: [-0.2, 0.8] },
    },
  },
  economy: {
    name: 'Economic system', opts: {
      laissezFaire: { name: 'Laissez-faire', desc: 'The state keeps out of business.', fx: { business: 12, workers: -6, growth: 0.0003, unrest: 2 }, pos: [0.9, 0] },
      interventionist: { name: 'Interventionist', desc: 'The state regulates and steers.', fx: {}, pos: [0, 0] },
      planned: { name: 'Planned economy', desc: 'Ministries set output and prices.', fx: { business: -20, workers: 8, growth: -0.0003, corruption: 6, pc: 0.15 }, pos: [-1, 0.6] },
    },
  },
  policing: {
    name: 'Policing', opts: {
      civilian: { name: 'Civilian police', desc: 'Police answer to the courts.', fx: { freedom: 6, intelligentsia: 3, corruption: -3 }, pos: [0, -0.5] },
      gendarmerie: { name: 'Gendarmerie', desc: 'A militarized police force.', fx: { freedom: -4, unrest: -2, military: 3 }, pos: [0.1, 0.4] },
      secret: { name: 'Secret police', desc: 'Informers everywhere.', fx: { freedom: -14, unrest: -5, intelligentsia: -10, stability: 3, approval: -2 }, pos: [0, 1] },
    },
  },
  electoral: {
    name: 'Electoral system', opts: {
      proportional: { name: 'Proportional representation', desc: 'Seats follow the national vote: many parties, frequent coalitions.', fx: { intelligentsia: 3, legitimacy: 2 }, pos: [-0.1, -0.3] },
      constituencies: { name: 'Winner-takes-all constituencies', desc: 'Each province elects its own members: big parties win big, regions matter.', fx: { business: 3, stability: 2, intelligentsia: -2 }, pos: [0.2, 0.1] },
    },
  },
  monetary: {
    name: 'Monetary system', opts: {
      gold: { name: 'Gold standard', desc: 'Money is backed by gold: stable prices, but deflation in booms and no way to ease a slump.', fx: { business: 3, clergy: 2, pc: -0.05 }, pos: [0.5, 0.2] },
      centralBank: { name: 'Independent central bank', desc: 'A central bank keeps inflation near 2% and sets interest rates by a rule.', fx: { business: 4, intelligentsia: 2, pc: -0.1 }, pos: [0.2, -0.2] },
      state: { name: 'Government-controlled money', desc: 'The government sets money growth and can print to cover deficits.', fx: { pc: 0.2, workers: 2, business: -4 }, pos: [-0.4, 0.5] },
    },
  },
  banking: {
    name: 'Banking', opts: {
      unregulated: { name: 'Free banking', desc: 'Banks lend as they please: bigger booms, and depositors lose their savings when banks fail.', fx: { business: 5, workers: -2 }, pos: [0.8, -0.1] },
      regulated: { name: 'Regulated banks, insured deposits', desc: 'Leverage is capped and deposits insured: smaller booms; the state pays when banks fail.', fx: { intelligentsia: 2, business: -2 }, pos: [0, 0] },
      state: { name: 'State banks', desc: 'Lending is directed by the state: steadier, but less efficient.', fx: { business: -8, workers: 3, pc: 0.1 }, pos: [-0.8, 0.5] },
    },
  },
  citizenship: {
    name: 'Citizenship', opts: {
      equal: { name: 'Equal citizenship', desc: 'Minorities may vote and hold any job. They assimilate slowly, but have few grievances.', fx: { intelligentsia: 4, legitimacy: 2, minorities: 15 }, pos: [-0.2, -0.6] },
      restricted: { name: 'Restricted citizenship', desc: 'Minorities are kept out of state jobs and the vote. Grievances grow.', fx: { clergy: 2, intelligentsia: -3, minorities: -10 }, pos: [0.3, 0.4] },
      persecution: { name: 'Persecution', desc: 'Minorities are hounded and forced to assimilate. Fast assimilation, bitter grievance, flight abroad.', fx: { intelligentsia: -10, military: 3, legitimacy: -4, minorities: -30 }, pos: [0.5, 0.95] },
    },
  },
  migration: {
    name: 'Immigration', opts: {
      open: { name: 'Open borders', desc: 'Anyone may come to work. Labor grows; newcomers bring their culture.', fx: { business: 5, workers: -3, intelligentsia: 2 }, pos: [0.4, -0.6] },
      limited: { name: 'Limited immigration', desc: 'Some newcomers are let in.', fx: {}, pos: [0, 0] },
      closed: { name: 'Closed borders', desc: 'No one gets in.', fx: { workers: 2, business: -3 }, pos: [-0.1, 0.6] },
    },
  },
  conscription: {
    name: 'Conscription', opts: {
      volunteer: { name: 'Volunteer army', desc: 'A small professional force.', fx: { army: -0.2, military: -4, approval: 2 }, pos: [0.2, -0.4] },
      selective: { name: 'Selective service', desc: 'Some are called up.', fx: {}, pos: [0, 0.2] },
      universal: { name: 'Universal service', desc: 'Every young man serves.', fx: { army: 0.25, military: 6, approval: -2, workers: -2 }, pos: [0, 0.7] },
    },
  },
};
const LAW_KEYS = Object.keys(LAW_CATS);

const LAW_PRESETS = {
  democracy: { head: 'elected', suffrage: 'universal', press: 'free', assembly: 'protected', church: 'secular', labor: 'unions', economy: 'interventionist', policing: 'civilian', conscription: 'volunteer', electoral: 'proportional', monetary: 'centralBank', banking: 'regulated', citizenship: 'equal', migration: 'limited' },
  constMonarchy: { head: 'monarch', suffrage: 'universal', press: 'free', assembly: 'protected', church: 'tolerant', labor: 'unions', economy: 'laissezFaire', policing: 'civilian', conscription: 'selective', electoral: 'constituencies', monetary: 'gold', banking: 'unregulated', citizenship: 'equal', migration: 'limited' },
  absMonarchy: { head: 'autocrat', suffrage: 'property', press: 'licensed', assembly: 'restricted', church: 'state', labor: 'none', economy: 'laissezFaire', policing: 'gendarmerie', conscription: 'selective', electoral: 'proportional', monetary: 'gold', banking: 'unregulated', citizenship: 'restricted', migration: 'closed' },
  junta: { head: 'autocrat', suffrage: 'none', press: 'licensed', assembly: 'banned', church: 'tolerant', labor: 'none', economy: 'interventionist', policing: 'gendarmerie', conscription: 'universal', electoral: 'proportional', monetary: 'state', banking: 'regulated', citizenship: 'restricted', migration: 'closed' },
  communist: { head: 'autocrat', suffrage: 'none', press: 'state', assembly: 'banned', church: 'secular', labor: 'stateUnions', economy: 'planned', policing: 'secret', conscription: 'universal', electoral: 'proportional', monetary: 'state', banking: 'state', citizenship: 'equal', migration: 'closed' },
  fascist: { head: 'autocrat', suffrage: 'none', press: 'state', assembly: 'banned', church: 'tolerant', labor: 'stateUnions', economy: 'interventionist', policing: 'secret', conscription: 'universal', electoral: 'proportional', monetary: 'state', banking: 'state', citizenship: 'persecution', migration: 'closed' },
  theocracy: { head: 'autocrat', suffrage: 'property', press: 'licensed', assembly: 'restricted', church: 'state', labor: 'none', economy: 'interventionist', policing: 'gendarmerie', conscription: 'selective', electoral: 'proportional', monetary: 'gold', banking: 'unregulated', citizenship: 'restricted', migration: 'closed' },
};

const LAW_PC = 15;           // political capital to put a bill forward
const LAW_FX_KEYS = ['freedom', 'unrest', 'approval', 'stability', 'legitimacy', 'corruption', 'growth', 'pc', 'army', ...FACTION_KEYS];

function ensureLaws(c) {
  if (!c.laws) c.laws = Object.assign({}, LAW_PRESETS[c.gov]);
  for (const k of LAW_KEYS) if (!c.laws[k]) c.laws[k] = LAW_PRESETS[c.gov][k];
  if (c.reform === undefined) c.reform = null;
  return c.laws;
}

function lawOpt(cat, key) { return LAW_CATS[cat].opts[key]; }

// Net effect of the laws compared with the regime's traditional constitution.
function lawFx(c) {
  ensureLaws(c);
  const preset = LAW_PRESETS[c.gov], out = {};
  for (const k of LAW_FX_KEYS) out[k] = 0;
  for (const cat of LAW_KEYS) {
    if (c.laws[cat] === preset[cat]) continue;
    const a = lawOpt(cat, c.laws[cat]).fx, b = lawOpt(cat, preset[cat]).fx;
    for (const k of LAW_FX_KEYS) out[k] += (a[k] || 0) - (b[k] || 0);
  }
  return out;
}

function presetLaws(gov) { return Object.assign({}, LAW_PRESETS[gov]); }

// Hybrid regimes get a descriptive label.
function constitutionLabel(c) {
  ensureLaws(c);
  const g = GOVS[c.gov], L = c.laws, P = LAW_PRESETS[c.gov];
  const pre = [];
  const free = g.elections === 'free';
  if (free && (L.press === 'state' || L.policing === 'secret' || L.assembly === 'banned')) pre.push('Guided');
  if (!free && L.suffrage === 'universal') pre.push('Plebiscitary');
  if (L.economy === 'planned' && P.economy !== 'planned') pre.push('Socialist');
  if (L.economy === 'laissezFaire' && P.economy === 'planned') pre.push('Market');
  if (L.church === 'state' && P.church !== 'state') pre.push('Confessional');
  if (L.church === 'secular' && P.church === 'state') pre.push('Secularized');
  if (!free && L.press === 'free') pre.push('Liberalized');
  if (c.gov === 'absMonarchy' && L.head === 'monarch') return [...pre, 'Limited Monarchy'].join(' ');
  if (c.gov === 'constMonarchy' && L.head === 'elected') return [...pre, 'Crowned Republic'].join(' ');
  if (c.gov === 'democracy' && L.head === 'autocrat') return [...pre, 'Presidential Autocracy'].join(' ');
  if (!pre.length) return g.name;
  return pre.join(' ') + ' ' + g.name;
}

// How much each faction likes moving a category to an option (>0 likes).
function lawPreference(c, cat, opt, f) {
  ensureLaws(c);
  return (lawOpt(cat, opt).fx[f] || 0) - (lawOpt(cat, c.laws[cat]).fx[f] || 0);
}

// Interest-group clout, from the classes that make them up.
function interestClout(c) {
  const t = { military: 0, workers: 0, business: 0, clergy: 0, intelligentsia: 0, minorities: 0 };
  for (const p of c._provs || []) {
    const P = p.pops || {};
    t.military += (P.soldiers || 0) * 3;
    t.workers += (P.workers || 0) + (P.laborers || 0) * 0.8;
    t.business += (P.capitalists || 0) * 40 + (P.landowners || 0) * 15;
    t.clergy += (P.clergy || 0) * 20 + (P.peasants || 0) * 0.15;
    t.intelligentsia += (P.clerks || 0) * 1.5 + (P.officials || 0) * 1.5 + (p.pop || 0) * (p.uni || 0) * 0.6;
    if (p.cult && game_cultureOf(c) != null) t.minorities += (p.pop || 0) * (1 - (p.cult[game_cultureOf(c)] || 0)) * 0.25;
  }
  if (c.igLeaders) for (const k in t) if (c.igLeaders[k]) t[k] *= 0.8 + c.igLeaders[k].skills.cha / 25;
  const s = Object.values(t).reduce((a, b) => a + b, 0) || 1;
  for (const k in t) t[k] /= s;
  return t;
}

// Share of the decision-makers who back the change, 0..1.
function lawSupport(game, c, cat, opt) {
  ensureLaws(c);
  const g = GOVS[c.gov];
  const cur = lawOpt(cat, c.laws[cat]).pos, nxt = lawOpt(cat, opt).pos;
  const d = (pt, p) => Math.hypot(pt.econ - p[0], pt.auth - p[1]);
  if (g.elections === 'free' && c.lastElection && !c.lastElection.sham) {
    let yes = 0, tot = 0;
    const gov = new Set([c.rulingParty, ...((c.coalition && c.coalition.partners) || []).map(p => p.id)]);
    for (const r of c.lastElection.results) {
      const party = c.parties.find(p => p.id === r.id);
      if (!party) continue;
      tot += r.seats;
      const gain = d(party, cur) - d(party, nxt) + (gov.has(r.id) ? 0.25 : 0);
      if (gain > 0) yes += r.seats;
    }
    return tot ? yes / tot : 0.5;
  }
  // Autocracies: the power base decides, weighted by how much it matters.
  let yes = 0, tot = 0;
  for (const f in g.base) {
    const w = g.base[f];
    tot += w;
    const pref = lawPreference(c, cat, opt, f);
    // Regimes resist loosening their grip, and the reverse in free states.
    const grip = (nxt[1] - cur[1]) * 0.3 * Math.sign(GOVS[c.gov].auth || 1);
    yes += w * clamp(0.5 + pref / 16 + (c.factions[f] - 50) / 200 + grip, 0, 1);
  }
  return tot ? yes / tot : 0.5;
}

function proposeLaw(game, c, cat, opt, free) {
  ensureLaws(c);
  if (c.reform) return { ok: false, msg: 'Another reform is already under way.' };
  if (c.laws[cat] === opt) return { ok: false, msg: 'That is already the law.' };
  if (!free) {
    if (c.pc < LAW_PC) return { ok: false, msg: `Needs ${LAW_PC} political capital.` };
    c.pc -= LAW_PC;
  }
  c.reform = { cat, opt, progress: 0, months: 0 };
  const L = LAW_CATS[cat];
  if (isPlayer(game, c)) logNews(game, `${c.name}: a bill to adopt "${L.opts[opt].name}" is put forward.`, 'gov', [c.id]);
  return { ok: true, msg: `The reform "${L.opts[opt].name}" begins. Watch its support in the Politics tab.` };
}

function enactLaw(game, c, cat, opt) {
  const old = c.laws[cat];
  c.laws[cat] = opt;
  c.reform = null;
  // Interest groups react to the change itself, not just to the new law.
  for (const f of FACTION_KEYS) {
    const pref = (lawOpt(cat, opt).fx[f] || 0) - (lawOpt(cat, old).fx[f] || 0);
    c.factions[f] = clamp(c.factions[f] + pref * 0.6, 0, 100);
  }
  logNews(game, `${c.name} adopts a new law: ${LAW_CATS[cat].opts[opt].name}.`, 'gov', [c.id]);
}

function tickLaws(game, c) {
  ensureLaws(c);
  tickIGLeaders(game, c);
  const R = c.reform;
  if (R) {
    R.months++;
    const sup = lawSupport(game, c, R.cat, R.opt);
    R.support = sup;
    R.progress += sup >= 0.5 ? 10 + (sup - 0.5) * 50 : 2;
    // Opponents grow restless while the bill is debated.
    for (const f of FACTION_KEYS) if (lawPreference(c, R.cat, R.opt, f) < 0) c.factions[f] = clamp(c.factions[f] - 0.3, 0, 100);
    const name = LAW_CATS[R.cat].opts[R.opt].name;
    if (R.progress >= 100) {
      enactLaw(game, c, R.cat, R.opt);
      if (isPlayer(game, c)) toastPlayer(game, `A law is passed: "${name}" is now the law of the land.`, 'good');
    } else if (sup < 0.5 && R.months > 3 && game.rng.chance(0.1)) {
      c.reform = null;
      adjust(c, { legitimacy: -3 });
      if (isPlayer(game, c)) notify(game, 'The Bill Fails', `The reform "${name}" has been voted down. Only ${pct0(sup)} supported it.`);
    }
    return;
  }
  if (!isPlayer(game, c) && game.rng.chance(0.025)) aiLaw(game, c);
}

function pct0(v) { return Math.round(v * 100) + '%'; }

// AI governments reform toward what their power base, or their public, wants.
function aiLaw(game, c) {
  const g = GOVS[c.gov];
  const cat = game.rng.pick(LAW_KEYS);
  let best = null, bv = 2;
  for (const opt in LAW_CATS[cat].opts) {
    if (opt === c.laws[cat]) continue;
    let v = 0;
    for (const f in g.base) v += g.base[f] * lawPreference(c, cat, opt, f);
    if (g.elections === 'free') v += lawSupport(game, c, cat, opt) * 6 - 3;
    if (v > bv) { bv = v; best = opt; }
  }
  if (best) proposeLaw(game, c, cat, best, true);
}

const LAW_ACTIONS = {
  abandon: { name: 'Withdraw the bill' },
  decree: { name: 'Force it through by decree', pc: 20 },
};

function lawAction(game, action) {
  const c = game.countries[game.player], R = c.reform;
  if (!R) return { ok: false, msg: 'No reform is under way.' };
  if (action === 'abandon') { c.reform = null; return { ok: true, msg: 'The bill is withdrawn.' }; }
  if (GOVS[c.gov].elections === 'free') return { ok: false, msg: 'Parliament will not allow it.' };
  if (c.pc < LAW_ACTIONS.decree.pc) return { ok: false, msg: `Needs ${LAW_ACTIONS.decree.pc} political capital.` };
  c.pc -= LAW_ACTIONS.decree.pc;
  adjust(c, { legitimacy: -8, stability: -4 });
  const name = LAW_CATS[R.cat].opts[R.opt].name;
  enactLaw(game, c, R.cat, R.opt);
  return { ok: true, msg: `"${name}" is decreed. The opposition is outraged.` };
}

// What each interest group most wants changed.
function interestDemand(c, f) {
  ensureLaws(c);
  let best = null, bv = 3;
  for (const cat of LAW_KEYS) for (const opt in LAW_CATS[cat].opts) {
    const v = lawPreference(c, cat, opt, f);
    if (v > bv) { bv = v; best = { cat, opt }; }
  }
  return best;
}

// The least loyal interest group that wants a law changed.
function petitionTarget(c) {
  let best = null;
  for (const f of FACTION_KEYS) {
    if (c.factions[f] > 45) continue;
    const d = interestDemand(c, f);
    if (d && (!best || c.factions[f] < c.factions[best.f])) best = { f, cat: d.cat, opt: d.opt };
  }
  return best;
}

// ------------------------------------------------------------------ interest-group leaders
// Each group is led by a character. Moderates keep their group close to the
// government; radicals agitate, and a radical leading an angry group can call
// its people into the streets. c.igLeaders = { faction: character }

function ensureIGLeaders(game, c) {
  c.igLeaders = c.igLeaders || {};
  for (const f of FACTION_KEYS) if (!c.igLeaders[f]) c.igLeaders[f] = makeIGLeader(game, c, f);
  return c.igLeaders;
}

function makeIGLeader(game, c, f) {
  const ch = makeCharacter(game, c, { role: 'igLeader', faction: f });
  ch.ig = f;
  ch.stance = game.rng.chance(c.factions[f] < 40 ? 0.5 : 0.25) ? 'radical' : 'moderate';
  return ch;
}

function tickIGLeaders(game, c) {
  const L = ensureIGLeaders(game, c), rng = game.rng;
  for (const f of FACTION_KEYS) {
    const ch = L[f];
    const loy = c.factions[f];
    if (ch.stance === 'radical') {
      if (loy < 50) c.factions[f] = clamp(loy - 0.12 * (ch.skills.cha / 5), 0, 100);
      if (loy < 25 && rng.chance(0.012)) {
        adjust(c, { unrest: 6, stability: -2 });
        logNews(game, `${ch.name} leads the ${FACTIONS[f].name.toLowerCase()} into the streets of ${c.name}.`, 'crisis', [c.id]);
        if (isPlayer(game, c)) notify(game, `${FACTIONS[f].name} Take to the Streets`, `${ch.name}, the radical leader of the ${FACTIONS[f].name.toLowerCase()}, has called mass demonstrations. Unrest +6.`, { charId: ch.id });
      }
      if (loy > 60 && rng.chance(0.02)) ch.stance = 'moderate';
    } else {
      c.factions[f] = clamp(loy + (50 - loy) * 0.004 * (ch.skills.cha / 5), 0, 100);
      if (loy < 30 && rng.chance(0.015)) ch.stance = 'radical';
    }
    // Leaders retire or are pushed aside now and then.
    if (rng.chance(1 / 200) || ch.age > 78) L[f] = makeIGLeader(game, c, f);
  }
}

const IG_ACTIONS = {
  meet: { name: 'Meet with them', pc: 8, desc: '+6 loyalty; a radical may soften.' },
  coopt: { name: 'Co-opt', pc: 15, desc: 'Bring the leader into the fold: they turn moderate. −2 approval.' },
  discredit: { name: 'Discredit', pc: 12, desc: 'Smear the leader until the group replaces them. −6 loyalty, −2 legitimacy.' },
};

function igAction(game, f, action) {
  const c = game.countries[game.player], A = IG_ACTIONS[action];
  const ch = ensureIGLeaders(game, c)[f];
  if (!A || !ch) return { ok: false, msg: 'Unknown action.' };
  if (c.pc < A.pc) return { ok: false, msg: `Needs ${A.pc} political capital.` };
  c.pc -= A.pc;
  if (action === 'meet') {
    c.factions[f] = clamp(c.factions[f] + 6, 0, 100);
    if (ch.stance === 'radical' && game.rng.chance(0.3)) { ch.stance = 'moderate'; return { ok: true, msg: `${ch.name} leaves the meeting a changed voice: a moderate now.` }; }
    return { ok: true, msg: `${ch.name} appreciates being heard.` };
  }
  if (action === 'coopt') { ch.stance = 'moderate'; adjust(c, { approval: -2 }); c.factions[f] = clamp(c.factions[f] + 3, 0, 100); return { ok: true, msg: `${ch.name} accepts a seat on a government council and tones it down.` }; }
  for (const k in c.movements || {}) if (c.movements[k].leader === ch) c.movements[k].leader = null;
  c.igLeaders[f] = makeIGLeader(game, c, f);
  adjust(c, { legitimacy: -2 });
  c.factions[f] = clamp(c.factions[f] - 6, 0, 100);
  return { ok: true, msg: `${ch.name} is disgraced. The ${FACTIONS[f].name.toLowerCase()} choose ${c.igLeaders[f].name} (${c.igLeaders[f].stance}) instead.` };
}

// Interest-group loyalty weighted by each group's clout.
function cloutLoyalty(c) {
  const cl = interestClout(c);
  let s = 0, w = 0;
  for (const f of FACTION_KEYS) { s += c.factions[f] * cl[f]; w += cl[f]; }
  return w ? s / w : avgLoyalty(c);
}

function game_cultureOf(c) { return c.culture == null ? null : c.culture; }
