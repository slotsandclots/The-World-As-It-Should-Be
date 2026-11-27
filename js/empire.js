'use strict';
// Empires: overlords and their subjects, integration and annexation, and
// releasing nations from conquered land.
//
// A subject has c.overlord (id), c.subjectType, c.liberty (0-100, its desire
// for independence), c.subjectSince, and optionally c.integration = { start }.

const SUBJECT_TYPES = {
  protectorate: {
    name: 'Protectorate', tribute: 0, joinsWars: false, base: 12, order: 0,
    desc: 'Under our protection: we defend them; they keep their own foreign policy and pay nothing.',
  },
  vassal: {
    name: 'Vassal', tribute: 0.1, joinsWars: true, base: 28, order: 1,
    desc: 'Pays 10% of its taxes as tribute, fights in our wars and cannot declare its own.',
  },
  puppet: {
    name: 'Puppet', tribute: 0.15, joinsWars: true, base: 34, order: 2,
    desc: 'Run by a government loyal to us: 15% tribute, our wars are its wars.',
  },
  colony: {
    name: 'Colony', tribute: 0.25, joinsWars: true, base: 42, order: 3,
    desc: 'Exploited for our benefit: 25% tribute, deep resentment, a liberation movement waiting to happen.',
  },
};
const SUBJECT_KEYS = Object.keys(SUBJECT_TYPES);
const INTEGRATION_TIME = 24;

function subjectsOf(game, id) { return game.countries.filter(c => c.alive && c.overlord === id); }
function overlordOf(game, c) { return c.overlord != null ? game.countries[c.overlord] : null; }

function makeSubject(game, overlordId, subId, type, how) {
  const O = game.countries[overlordId], S = game.countries[subId];
  if (!S.alive || !O.alive || S.overlord != null) return;
  // A subject's own subjects pass to the new overlord.
  for (const x of subjectsOf(game, subId)) { x.overlord = overlordId; }
  S.overlord = overlordId;
  S.subjectType = type;
  S.subjectSince = game.month;
  S.liberty = how === 'war' ? 45 : 20;
  S.integration = null;
  S.allies = S.allies.filter(a => a === overlordId);
  for (const o of game.countries) if (o.id !== overlordId) o.allies = o.allies.filter(a => a !== subId);
  setRel(game, overlordId, subId, Math.max(relation(game, overlordId, subId), how === 'war' ? 10 : 40));
  logNews(game, `${S.name} becomes a ${SUBJECT_TYPES[type].name.toLowerCase()} of ${O.name}.`, 'diplo', [overlordId, subId]);
  if (subId === game.player) notify(game, `We Are Now a ${SUBJECT_TYPES[type].name}`, `${formalName(S)} is now a ${SUBJECT_TYPES[type].name.toLowerCase()} of the ${formalName(O)}. ${SUBJECT_TYPES[type].desc} Our desire for independence will grow; when the moment is right, we can declare it.`, { charId: O.leader.id });
}

function freeSubject(game, subId, reason) {
  const S = game.countries[subId];
  const O = overlordOf(game, S);
  if (!O) return;
  S.overlord = null; S.subjectType = null; S.integration = null; S.liberty = 0;
  logNews(game, `${S.name} is ${reason === 'war' ? 'independent after a war of liberation' : reason === 'released' ? 'granted independence' : 'independent'} from ${O.name}.`, 'diplo', [S.id, O.id]);
  if (S.id === game.player) notify(game, 'Independence!', `${formalName(S)} is free of the ${formalName(O)}.`);
  else if (O.id === game.player) toastPlayer(game, `${S.name} is no longer our ${(SUBJECT_TYPES[S.subjectType] || {}).name || 'subject'}.`, 'bad');
}

// Absorb a subject entirely. Peaceful integration avoids occupation and infamy.
function absorbSubject(game, subId, peaceful) {
  const S = game.countries[subId], O = overlordOf(game, S);
  if (!O) return;
  const provs = provincesOf(game, subId);
  for (const x of subjectsOf(game, subId)) x.overlord = O.id;
  S.overlord = null;
  for (const p of provs) {
    transferProvince(game, p.id, O.id);
    // Peacefully integrated land skips occupation and integrates in fifteen years.
    if (peaceful && p.conquered) p.conquered.month = game.month - 60;
  }
  if (!peaceful) addInfamy(game, O.id, 15);
  logNews(game, `${S.name} is ${peaceful ? 'integrated into' : 'annexed by'} ${O.name}.`, 'diplo', [O.id, subId]);
}

function libertyTarget(game, S) {
  const O = overlordOf(game, S);
  const T = SUBJECT_TYPES[S.subjectType];
  let t = T.base + T.tribute * 80;
  t += ideoDist(GOVS[S.gov], GOVS[O.gov]) * 15;
  const ratio = strength(S) / (strength(O) + 0.001);
  if (ratio > 0.4) t += (ratio - 0.4) * 50;
  t -= relation(game, S.id, O.id) / 4;
  if (S.subjectType === 'colony') t += Math.max(0, 35 - S.econ.strataSol.lower) * 0.5;
  if (S.integration) t += 15;
  t += (S.libertyMod || 0);
  return clamp(t, 0, 100);
}

function tickSubjects(game) {
  const rng = game.rng;
  for (const S of game.countries) {
    if (!S.alive || S.overlord == null) continue;
    const O = overlordOf(game, S);
    if (!O || !O.alive) { S.overlord = null; S.subjectType = null; continue; }
    const T = SUBJECT_TYPES[S.subjectType];
    // Tribute.
    const tribute = Math.max(0, (S.budget ? S.budget.taxes : 0) * T.tribute);
    S.treasury -= tribute; O.treasury += tribute;
    S.tributePaid = tribute;
    S.liberty += (libertyTarget(game, S) - S.liberty) * 0.04;
    S.libertyMod = (S.libertyMod || 0) * 0.97;
    // Integration in progress.
    if (S.integration) {
      if (S.liberty > 75) {
        S.integration = null;
        logNews(game, `${S.name} resists integration into ${O.name}.`, 'diplo', [S.id, O.id]);
        if (O.id === game.player) notify(game, 'Integration Fails', `${formalName(S)} has grown too restless to be integrated. Their desire for independence has soared.`);
      } else if (game.month - S.integration.start >= INTEGRATION_TIME) {
        absorbSubject(game, S.id, true);
        continue;
      }
    }
    // Independence wars.
    if (S.id !== game.player && S.liberty > 72 && !isAtWar(game, S.id) && !isAtWar(game, O.id) && rng.chance(0.04)) {
      const supporters = game.countries.filter(x => x.alive && x.id !== S.id && x.id !== O.id && x.overlord == null && relation(game, x.id, O.id) < -40);
      const mine = strength(S) + supporters.reduce((s, x) => s + strength(x) * 0.6, 0);
      if (mine > strength(O) * 0.5) declareIndependence(game, S.id, supporters);
    }
    // AI overlords integrate loyal, long-held subjects.
    if (O.id !== game.player && !S.integration && S.liberty < 40 && game.month - S.subjectSince > 120 && rng.chance(0.006)) {
      S.integration = { start: game.month };
      logNews(game, `${O.name} begins integrating ${S.name}.`, 'diplo', [O.id, S.id]);
      if (S.id === game.player) notify(game, 'Our Overlord Moves to Absorb Us', `${formalName(O)} has begun integrating us. In ${INTEGRATION_TIME} months we will cease to exist, unless our desire for independence rises above 75 or we break free first.`);
    }
  }
}

function declareIndependence(game, subId, supporters) {
  const S = game.countries[subId], O = overlordOf(game, S);
  if (!O) return null;
  S.integration = null;
  const war = declareWar(game, subId, O.id, { coalition: true });
  war.independence = true;
  war.name = `${S.adj} War of Independence`;
  for (const x of supporters || []) if (game.rng.chance(0.5)) joinWar(game, war, x.id, 'a');
  if (O.id === game.player) notify(game, 'A War of Independence!', `${formalName(S)} has declared its independence and taken up arms against us.`, { charId: S.leader.id });
  return war;
}

// Called by endWar: settle an independence war.
function settleIndependence(game, war) {
  const S = game.countries[war.a[0] !== undefined ? war.a[0] : -1];
  if (!S || !S.alive || S.overlord == null) return;
  if (war.gainsA >= war.gainsB || war.exB > war.exA + 20) freeSubject(game, S.id, 'war');
  else { S.liberty = 30; logNews(game, `${S.name}'s bid for independence fails.`, 'diplo', [S.id]); }
}

// ------------------------------------------------------------------ releasing nations

// Land we hold whose core belongs to someone else, grouped by that core owner.
function releasableGroups(game, c) {
  const groups = {};
  for (const p of game.world.provinces) {
    if (p.owner !== c.id || p.core === undefined || p.core === c.id || p.id === c.capital) continue;
    (groups[p.core] = groups[p.core] || []).push(p);
  }
  return Object.entries(groups).map(([core, provs]) => ({ core: +core, provs, owner: game.countries[+core] }));
}

// Revive a fallen nation (or hand land back to a living one).
function releaseNation(game, fromId, coreId, opts) {
  opts = opts || {};
  const F = game.countries[fromId], N = game.countries[coreId];
  const provs = game.world.provinces.filter(p => p.owner === fromId && p.core === coreId && p.id !== F.capital);
  if (!provs.length) return { ok: false, msg: 'There is no land to release.' };
  const reviving = !N.alive;
  if (reviving) resetNation(game, N, opts.gov || F.gov, F);
  for (const p of provs) { p.conquered = null; transferProvince(game, p.id, coreId); p.conquered = null; }
  N.capital = provs.slice().sort((a, b) => b.pop - a.pop)[0].id;
  if (reviving) { refreshAll(game); finishNation(game, N, F); }
  setRel(game, fromId, coreId, Math.max(relation(game, fromId, coreId), 40));
  F.infamy = Math.max(0, (F.infamy || 0) - provs.length * 2);
  if (opts.subject && reviving) makeSubject(game, fromId, coreId, opts.subject, 'released');
  logNews(game, reviving ? `${F.name} restores the ${formalName(N)}.` : `${F.name} returns ${provs.length} province${provs.length > 1 ? 's' : ''} to ${N.name}.`, 'diplo', [fromId, coreId]);
  game.mapDirty = true;
  return { ok: true, msg: reviving ? `The ${formalName(N)} is reborn${opts.subject ? ` as our ${SUBJECT_TYPES[opts.subject].name.toLowerCase()}` : ''}.` : `${provs.length} province${provs.length > 1 ? 's' : ''} returned to ${N.name}.` };
}

// Bring a dead nation back to life with a fresh government and cast.
function resetNation(game, N, gov, patron) {
  N.alive = true;
  N.gov = gov;
  N.prevGov = null;
  N.monthsInRegime = 0;
  N.allies = []; N.trade = []; N.mods = []; N.flags = {};
  N.infamy = 0; N.warExhaustion = 0; N.warMomentum = 0; N.emergency = false;
  N.overlord = null; N.subjectType = null; N.integration = null; N.liberty = 0;
  N.policy = defaultPolicy(gov);
  N.stability = 50; N.approval = 55; N.unrest = 15; N.legitimacy = 45;
  N.freedom = GOVS[gov].freedom; N.corruption = GOVS[gov].corruption;
  N.pc = 30;
  N.parties = makeParties(game, N);
  N.rulingParty = topPollParty(N);
  N.leader = makeLeader(game, N);
  N.cabinet = {}; N.generals = []; N.dissidents = []; N.heir = null; N.monarch = null;
  N.movements = null;
  if (N.econ && patron.econ) N.econ.tech = Math.max(N.econ.tech, patron.econ.tech * 0.85);
  N.research = N.research || { current: null, progress: 0, done: [] };
}

function finishNation(game, N, patron) {
  recomputeCountry(game, N);
  N.army = armyTarget(N) * 0.5;
  N.treasury = N.gdp * 0.05;
  initCharacters(game, N);
  ensureMovements(N);
  for (const o of game.countries) if (o.alive && o.id !== N.id) setRel(game, N.id, o.id, relationTarget(game, N, o));
  game.truces[truceKey(N.id, patron.id)] = game.month + 60;
}

// ------------------------------------------------------------------ diplomacy

function subjectInfo(game, c) {
  if (c.overlord == null) return null;
  return { overlord: game.countries[c.overlord], type: SUBJECT_TYPES[c.subjectType], liberty: c.liberty };
}

const EMPIRE_ACTIONS = [
  {
    id: 'offerProtection', name: 'Offer Protection', pc: 15,
    desc: 'Make them our protectorate: we defend them, they look to us. Needs to be much weaker than us, and on decent terms.',
    check: (game, c, t) => {
      if (t.overlord != null || c.overlord != null || subjectsOf(game, t.id).length || atWarWith(game, c.id, t.id)) return 'hidden';
      if (strength(c) < strength(t) * 2) return 'They must be less than half our strength.';
      if (relation(game, c.id, t.id) < 0) return 'Relations must be at least 0.';
      return null;
    },
    run(game, c, t) {
      const p = clamp(0.15 + (threatLevel(game, t) - 1) * 0.3 + relation(game, c.id, t.id) / 150, 0.05, 0.9);
      if (!game.rng.chance(p)) { addRel(game, c.id, t.id, -5); return `${t.name} prefers to stand alone.`; }
      makeSubject(game, c.id, t.id, 'protectorate', 'diplomacy');
      return `${t.name} accepts our protection.`;
    },
  },
  {
    id: 'demandVassalage', name: 'Demand Vassalage', pc: 30,
    desc: 'An ultimatum: submit or face us. Only works on far weaker nations; refusal costs relations and some infamy.',
    check: (game, c, t) => {
      if (t.overlord != null || c.overlord != null || subjectsOf(game, t.id).length || atWarWith(game, c.id, t.id)) return 'hidden';
      if (strength(c) < strength(t) * 4) return 'They must be less than a quarter of our strength.';
      return null;
    },
    run(game, c, t) {
      const ratio = strength(c) / (strength(t) + 0.001);
      const p = clamp((ratio - 4) * 0.05 + (relation(game, c.id, t.id) + 50) / 300 - (t.allies.length ? 0.2 : 0), 0.03, 0.6);
      if (!game.rng.chance(p)) { addRel(game, c.id, t.id, -30); addInfamy(game, c.id, 3); return `${t.name} defies our ultimatum.`; }
      makeSubject(game, c.id, t.id, 'vassal', 'diplomacy');
      addInfamy(game, c.id, 5);
      return `${t.name} submits and becomes our vassal.`;
    },
  },
  {
    id: 'tighten', name: 'Tighten Control', pc: 15, desc: 'Move them one step down: protectorate → vassal → puppet → colony. More tribute, more resentment.',
    check: (game, c, t) => (t.overlord !== c.id ? 'hidden' : t.subjectType === 'colony' ? 'Already a colony.' : null),
    run(game, c, t) { t.subjectType = SUBJECT_KEYS[SUBJECT_TYPES[t.subjectType].order + 1]; t.liberty = clamp(t.liberty + 15, 0, 100); return `${t.name} is now our ${SUBJECT_TYPES[t.subjectType].name.toLowerCase()}.`; },
  },
  {
    id: 'loosen', name: 'Grant Autonomy', pc: 5, desc: 'Move them one step up: colony → puppet → vassal → protectorate. Less tribute, less resentment.',
    check: (game, c, t) => (t.overlord !== c.id ? 'hidden' : t.subjectType === 'protectorate' ? 'Already a protectorate.' : null),
    run(game, c, t) { t.subjectType = SUBJECT_KEYS[SUBJECT_TYPES[t.subjectType].order - 1]; t.liberty = clamp(t.liberty - 15, 0, 100); return `${t.name} is now our ${SUBJECT_TYPES[t.subjectType].name.toLowerCase()}.`; },
  },
  {
    id: 'investSubject', name: 'Invest in Them', pc: 5, money: 0.004, desc: 'Development aid: their treasury grows, their desire for independence falls.',
    check: (game, c, t) => (t.overlord !== c.id ? 'hidden' : null),
    run(game, c, t) { t.treasury += (c.gdpNom || c.gdp) * 0.004; t.libertyMod = (t.libertyMod || 0) - 15; addRel(game, c.id, t.id, 8); return `Roads, schools and favors flow to ${t.name}.`; },
  },
  {
    id: 'integrate', name: 'Integrate', pc: 40, desc: `Peacefully absorb them over ${INTEGRATION_TIME} months. Needs five years as our subject and liberty desire below 50; fails if it rises above 75.`,
    check: (game, c, t) => {
      if (t.overlord !== c.id) return 'hidden';
      if (t.integration) return `Integration in progress: ${INTEGRATION_TIME - (game.month - t.integration.start)} months left.`;
      if (game.month - t.subjectSince < 60) return `They must be our subject for five years (${Math.ceil((60 - (game.month - t.subjectSince)) / 12)} more).`;
      if (t.liberty >= 50) return 'Their desire for independence is too high.';
      return null;
    },
    run(game, c, t) { t.integration = { start: game.month }; return `Integration of ${t.name} begins. It will take ${INTEGRATION_TIME} months.`; },
  },
  {
    id: 'annexSubject', name: 'Annex Outright', pc: 60, desc: 'Absorb them now, by force of decree. Their land is occupied and restless, and the world takes note (+15 infamy).',
    check: (game, c, t) => (t.overlord !== c.id ? 'hidden' : null),
    run(game, c, t) { absorbSubject(game, t.id, false); return `${t.name} is annexed.`; },
  },
  {
    id: 'releaseSubject', name: 'Grant Independence', pc: 0, desc: 'Set them free. They will remember it kindly.',
    check: (game, c, t) => (t.overlord !== c.id ? 'hidden' : null),
    run(game, c, t) { freeSubject(game, t.id, 'released'); addRel(game, c.id, t.id, 30); return `${t.name} is free.`; },
  },
  {
    id: 'declareIndependence', name: 'Declare Independence', pc: 20, desc: 'Break free of our overlord by force. Nations that hate them may come to our aid.',
    check: (game, c, t) => (c.overlord !== t.id ? 'hidden' : isAtWar(game, c.id) ? 'Not while we are already at war.' : null),
    run(game, c, t) {
      const supporters = game.countries.filter(x => x.alive && x.id !== c.id && x.id !== t.id && x.overlord == null && relation(game, x.id, t.id) < -40);
      declareIndependence(game, c.id, supporters);
      return `We declare our independence from the ${formalName(t)}!`;
    },
  },
];

// AI: strong nations take threatened weak neighbors under their wing.
function aiEmpire(game) {
  const rng = game.rng;
  for (const c of game.countries) {
    if (!c.alive || c.id === game.player || c.overlord != null || !rng.chance(0.02)) continue;
    for (const n of getNeighbors(game, c.id)) {
      const t = game.countries[n];
      if (t.overlord != null || t.id === game.player || subjectsOf(game, t.id).length || atWarWith(game, c.id, t.id)) continue;
      if (strength(c) < strength(t) * 2.5 || relation(game, c.id, t.id) < 15 || threatLevel(game, t) < 1.4) continue;
      if (rng.chance(0.08)) { makeSubject(game, c.id, t.id, 'protectorate', 'diplomacy'); break; }
    }
  }
}

function empireActionList(game, c, t) {
  return EMPIRE_ACTIONS.map(a => { const r = a.check(game, c, t); return r === 'hidden' ? null : { a, reason: r || costOk(c, a) }; }).filter(Boolean);
}

function performEmpire(game, id, targetId) {
  const c = game.countries[game.player], t = game.countries[targetId];
  const a = EMPIRE_ACTIONS.find(x => x.id === id);
  const reason = a.check(game, c, t) || costOk(c, a);
  if (reason) return { ok: false, msg: reason };
  payCost(c, a);
  return { ok: true, msg: a.run(game, c, t) };
}
