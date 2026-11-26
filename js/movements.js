'use strict';
// Political movements grow out of the pops. Each draws support from certain
// classes when they have a grievance, makes a demand of the state, and grows
// more radical while the demand goes unmet. Radical mass movements fuel
// unrest, tilt revolutions toward their preferred regime, and can rise up.
//
// c.movements = { key: { support (% of population), radicalism (0-100), leader } }

const MOVEMENTS = {
  labor: {
    name: 'Labor Movement', icon: '⚒', gov: 'communist',
    desc: 'Unions and socialists organizing workers and laborers.',
    support: c => { const E = c.econ; const g = clamp((40 - E.solType.workers) / 30, 0, 1.4) + clamp((35 - E.solType.laborers) / 30, 0, 1) + E.unemployment * 4 + clamp((E.strataSol.upper - E.strataSol.lower - 35) / 50, 0, 0.8); return (share(c, 'workers') + share(c, 'laborers') * 0.8) * 100 * g * 1.4; },
    demand: { text: 'Expand welfare to 12% of GDP', met: c => c.policy.welfare >= 12, enact: c => { c.policy.welfare = Math.max(c.policy.welfare, 12); } },
  },
  agrarian: {
    name: 'Agrarian League', icon: '🌾', gov: null,
    desc: 'Peasants demanding relief from taxes and landlords.',
    support: c => share(c, 'peasants') * 100 * clamp((32 - c.econ.solType.peasants) / 25, 0, 1.2) * 0.6,
    demand: { text: 'Cut taxes to 20% or less', met: c => c.policy.tax <= 0.2, enact: c => { c.policy.tax = Math.min(c.policy.tax, 0.2); } },
  },
  liberal: {
    name: 'Liberal Movement', icon: '✎', gov: 'democracy',
    desc: 'Students, clerks and professionals demanding rights and representation.',
    support: c => (share(c, 'clerks') * 3 + share(c, 'capitalists') * 2 + share(c, 'workers') * 0.3) * 100 * clamp((65 - c.freedom) / 40, 0, 1.5) * (0.4 + c.econ.literacy) * 1.1,
    demand: {
      text: c => (GOVS[c.gov].elections === 'free' ? 'Raise education to 6% of GDP' : 'Hold free elections'),
      met: c => (GOVS[c.gov].elections === 'free' ? c.policy.education >= 6 : false),
      enact: (game, c) => {
        if (GOVS[c.gov].elections === 'free') c.policy.education = Math.max(c.policy.education, 6);
        else changeGovernment(game, c, c.gov === 'absMonarchy' ? 'constMonarchy' : 'democracy', 'reform', { keepLeader: true });
      },
    },
  },
  nationalist: {
    name: 'Nationalist Movement', icon: '⚑', gov: 'fascist',
    desc: 'Veterans and patriots demanding a strong army and national revenge.',
    support: c => (share(c, 'soldiers') * 3 + share(c, 'officials') * 1.5 + share(c, 'peasants') * 0.25 + share(c, 'workers') * 0.3) * 100 * clamp(c.warExhaustion / 40 + Math.max(0, c.ideo.auth) + (c.flags.lostLand ? 0.6 : 0), 0, 1.6),
    demand: { text: 'Raise military spending to 5% of GDP', met: c => c.policy.military >= 5, enact: c => { c.policy.military = Math.max(c.policy.military, 5); } },
  },
  clerical: {
    name: 'Religious Revival', icon: '☩', gov: 'theocracy',
    desc: 'The devout, led by the clergy, demanding a place for faith in public life.',
    support: c => (share(c, 'clergy') * 4 + share(c, 'peasants') * 0.4) * 100 * clamp((55 - c.factions.clergy) / 30 + Math.max(0, c.ideo.auth) * 0.5, 0, 1.4),
    demand: { text: 'Give the clergy charge of the schools', met: c => !!c.flags.clericalSchools, enact: c => { c.flags.clericalSchools = true; } },
  },
  monarchist: {
    name: 'Monarchist League', icon: '♛', gov: 'constMonarchy',
    desc: 'Landowners and traditionalists who want the crown back.',
    support: c => (['absMonarchy', 'constMonarchy'].includes(c.gov) ? 0 : (c.prevGov === 'absMonarchy' || c.prevGov === 'constMonarchy' ? 1 : 0.3)) * (share(c, 'landowners') * 8 + share(c, 'clergy') * 2 + share(c, 'peasants') * 0.15) * 100 * clamp((60 - c.stability) / 30, 0.2, 1.3),
    demand: { text: 'Restore the monarchy', met: c => c.gov === 'absMonarchy' || c.gov === 'constMonarchy', enact: (game, c) => { changeGovernment(game, c, 'constMonarchy', 'reform', { keepLeader: true }); } },
  },
};
const MOVEMENT_KEYS = Object.keys(MOVEMENTS);

function share(c, t) { return c.econ && c.pop > 0 ? c.econ.popType[t] / c.pop : 0; }

function demandText(c, key) { const d = MOVEMENTS[key].demand.text; return typeof d === 'function' ? d(c) : d; }

function ensureMovements(c) {
  if (!c.movements) { c.movements = {}; for (const k of MOVEMENT_KEYS) c.movements[k] = { support: 0, radicalism: 10, leader: null }; }
  return c.movements;
}

function tickMovements(game, c) {
  const M = ensureMovements(c);
  const repressive = c.policy.police > 3.5 || c.freedom < 30;
  for (const k of MOVEMENT_KEYS) {
    const def = MOVEMENTS[k], m = M[k];
    const target = clamp(def.support(c), 0, 60);
    m.support += (target - m.support) * 0.05;
    const met = def.demand.met(c);
    const radT = clamp((met ? 5 : 35) + m.support * 1.2 + (repressive ? 12 : 0) - (c.approval - 50) * 0.3 + (m.angry || 0), 0, 100);
    m.radicalism += (radT - m.radicalism) * 0.04;
    m.angry = (m.angry || 0) * 0.95;
    if (m.support > 8 && !m.leader) {
      m.leader = makeCharacter(game, c, { role: 'movement', ideo: def.gov ? GOVS[def.gov] : c.ideo, faction: k === 'labor' ? 'workers' : k === 'nationalist' ? 'military' : k === 'clerical' ? 'clergy' : k === 'monarchist' ? 'business' : k === 'liberal' ? 'intelligentsia' : 'workers', skillBias: { cha: 2 }, loyalty: 10 });
      m.leader.movement = k;
      if (isPlayer(game, c) && m.support > 10) toastPlayer(game, `A ${def.name} is forming under ${m.leader.name}.`, 'info');
    }
    if (m.support < 3) m.leader = null;
    if (m.leader && game.month % 12 === 0) m.leader.age++;
  }
  // Uprisings: radical, popular movements may try to seize power.
  for (const k of MOVEMENT_KEYS) {
    const m = M[k], def = MOVEMENTS[k];
    if (m.support < 22 || m.radicalism < 72 || c.monthsInRegime < 6) continue;
    if (!game.rng.chance(0.02 + (m.radicalism - 72) * 0.002)) continue;
    if (def.gov && def.gov !== c.gov && c.stability < 45) {
      logNews(game, `The ${def.name} rises up in ${c.name}!`, 'gov', [c.id]);
      const leader = m.leader;
      m.radicalism = 30; m.support *= 0.6; m.leader = null;
      changeGovernment(game, c, def.gov, 'revolution', leader ? { leader } : {});
    } else {
      adjust(c, { unrest: 20, stability: -6 });
      m.radicalism -= 15;
      logNews(game, `Mass strikes and riots: the ${def.name} brings ${c.name} to a standstill.`, 'crisis', [c.id]);
      if (isPlayer(game, c)) notify(game, `The ${def.name} Takes to the Streets`, `${m.leader ? m.leader.name + ' leads' : 'There are'} mass demonstrations demanding: "${demandText(c, k)}". Unrest soars. Meet their demand, suppress them, or win over their leader before they try to seize power.`, m.leader ? { charId: m.leader.id } : {});
    }
  }
  if (!isPlayer(game, c)) {
    for (const k of MOVEMENT_KEYS) {
      const m = M[k];
      if (m.support > 15 && m.radicalism > 60 && game.rng.chance(0.05)) {
        if (GOVS[c.gov].repression >= 1.2 && game.rng.chance(0.6)) suppressMovement(game, c, k);
        else if (!MOVEMENTS[k].demand.met(c) && k !== 'liberal' && k !== 'monarchist') enactDemand(game, c, k);
      }
    }
  }
}

// Unrest and stability pressure from radical movements.
function movementPressure(c) {
  if (!c.movements) return 0;
  let p = 0;
  for (const k of MOVEMENT_KEYS) { const m = c.movements[k]; p += m.support * m.radicalism / 100 * 0.35; }
  return p;
}

function movementRevolutionWeight(c, gov) {
  if (!c.movements) return 0;
  let w = 0;
  for (const k of MOVEMENT_KEYS) if (MOVEMENTS[k].gov === gov) { const m = c.movements[k]; w += m.support * m.radicalism / 100 * 2; }
  return w;
}

function enactDemand(game, c, k) {
  const def = MOVEMENTS[k], m = c.movements[k];
  const enact = def.demand.enact;
  enact.length >= 2 ? enact(game, c) : enact(c);
  m.radicalism = Math.max(0, m.radicalism - 40);
  m.support *= 0.7;
  if (k === 'clerical') adjust(c, { clergy: 15, intelligentsia: -10 });
  logNews(game, `${c.name} gives in to the ${def.name}: ${demandText(c, k).toLowerCase()}.`, 'gov', [c.id]);
}

function suppressMovement(game, c, k) {
  const m = c.movements[k];
  const backlash = m.radicalism > 60;
  m.support *= 0.6;
  m.angry = (m.angry || 0) + 15;
  if (m.leader && game.rng.chance(0.5)) m.leader = null;
  adjust(c, { freedom: -6, intelligentsia: -5, unrest: backlash ? 10 : -5 });
  logNews(game, `${c.name} cracks down on the ${MOVEMENTS[k].name}.`, 'gov', [c.id]);
  return backlash;
}

const MOVEMENT_ACTIONS = {
  enact: { name: 'Meet the demand', pc: 10 },
  suppress: { name: 'Suppress', pc: 15 },
  coopt: { name: 'Co-opt the leader', pc: 20 },
};

function movementAction(game, k, action) {
  const c = game.countries[game.player];
  const m = ensureMovements(c)[k];
  const A = MOVEMENT_ACTIONS[action];
  if (c.pc < A.pc) return { ok: false, msg: `Needs ${A.pc} political capital.` };
  if (action === 'enact' && MOVEMENTS[k].demand.met(c)) return { ok: false, msg: 'Their demand is already met.' };
  if (action === 'coopt' && !m.leader) return { ok: false, msg: 'The movement has no leader to win over.' };
  c.pc -= A.pc;
  if (action === 'enact') { enactDemand(game, c, k); return { ok: true, msg: `We meet the ${MOVEMENTS[k].name}'s demand. Radicalism falls.` }; }
  if (action === 'suppress') { const b = suppressMovement(game, c, k); return { ok: true, msg: b ? 'The crackdown provokes riots.' : 'The movement is driven underground.' }; }
  const ch = m.leader;
  if (!game.rng.chance(clamp(0.45 - m.radicalism / 200 + (c.leader.skills.cha - 5) * 0.05, 0.1, 0.8))) return { ok: false, msg: `${ch.name} rejects our overtures.` };
  m.leader = null; m.radicalism *= 0.6; m.support *= 0.85;
  ch.role = 'minister'; ch.loyalty = 50;
  const post = POST_KEYS.find(p => !c.cabinet[p]) || 'chief';
  candidatesFor(game, c, post).push(ch);
  return { ok: true, msg: `${ch.name} accepts a seat at the table and is now a candidate for ${CABINET_POSTS[post].name}. The movement loses its fire.` };
}
