'use strict';
// Characters: the leader, the cabinet, the high command, the opposition and
// royal heirs. Every nation has them, so foreign leaders have personalities too.
//
// A character: { id, first, last, name, female, age, traits[], trait, skills{admin,
// diplo, mil, cha} (1-10), ideo{econ,auth}, faction, party, role, post, loyalty,
// ambition, health, popularity, favor, look, since }

const SKILLS = { admin: 'Administration', diplo: 'Diplomacy', mil: 'Military', cha: 'Charisma' };
const SKILL_KEYS = Object.keys(SKILLS);

const FACTION_IDEO = {
  military: { econ: 0.3, auth: 0.7 }, workers: { econ: -0.6, auth: 0.1 }, business: { econ: 0.7, auth: 0 },
  clergy: { econ: 0.3, auth: 0.7 }, intelligentsia: { econ: -0.2, auth: -0.6 },
  minorities: { econ: -0.2, auth: -0.5 },
};

const sgn = (v, d) => { const s = v.toFixed(d === undefined ? 1 : d); return v > 0 ? '+' + s : s.replace('-', '−'); };

// What each post does, per point of skill above (or below) 5.
const CABINET_POSTS = {
  chief: {
    name: 'Chief of Staff', skill: 'cha', desc: 'Runs the leader\'s office and manages the press.',
    fx: d => ({ pc: d * 0.06, approval: d * 0.3 }), text: d => `${sgn(d * 0.06, 2)} PC/month, ${sgn(d * 0.3)} approval`,
  },
  interior: {
    name: 'Minister of the Interior', skill: 'admin', desc: 'Police, provinces and internal order.',
    fx: d => ({ unrest: -d * 1.6, stability: d * 0.4 }), text: d => `${sgn(-d * 1.6)} unrest, ${sgn(d * 0.4)} stability`,
  },
  finance: {
    name: 'Minister of Finance', skill: 'admin', desc: 'Tax collection, the budget and the central bank.',
    fx: d => ({ taxEff: d * 0.012, corruption: -d * 0.8 }), text: d => `${sgn(d * 1.2)}% tax revenue, ${sgn(-d * 0.8)} corruption`,
  },
  foreign: {
    name: 'Foreign Minister', skill: 'diplo', desc: 'Embassies, treaties and the nation\'s image abroad.',
    fx: d => ({ relations: d * 1.5 }), text: d => `${sgn(d * 1.5)} relations with every nation`,
  },
  defense: {
    name: 'Minister of Defense', skill: 'mil', desc: 'Runs the armed forces and keeps the officers in line.',
    fx: d => ({ strength: d * 0.025, military: d * 1.2 }), text: d => `${sgn(d * 2.5)}% army strength, ${sgn(d * 1.2)} military loyalty`,
  },
};
const POST_KEYS = Object.keys(CABINET_POSTS);
const VACANT_SKILL = 2;

// ------------------------------------------------------------------ creation

function pickTraits(rng, n, pool) {
  const out = [];
  const keys = rng.shuffle(pool || TRAIT_KEYS);
  for (const k of keys) {
    if (out.length >= n) break;
    const clash = out.some(o => (TRAITS[o].conflicts || []).includes(k) || (TRAITS[k].conflicts || []).includes(o));
    if (!clash) out.push(k);
  }
  return out;
}

function makeCharacter(game, c, o) {
  o = o || {};
  const rng = game.rng;
  const female = o.female !== undefined ? o.female : rng.chance(o.role === 'general' ? 0.12 : 0.35);
  const first = makeFirstName(rng, female);
  const last = o.surname || makeSurname(rng);
  const ageR = o.young ? [17, 38] : o.role === 'general' ? [44, 64] : o.ageRange || [36, 66];
  const base = o.ideo || (o.faction ? FACTION_IDEO[o.faction] : c ? GOVS[c.gov] : { econ: 0, auth: 0 });
  const traits = o.traits || pickTraits(rng, o.traitCount || rng.int(1, 2), o.traitPool);
  const skills = {};
  for (const k of SKILL_KEYS) {
    let v = rng.range(2, 8) + ((o.skillBias && o.skillBias[k]) || 0);
    for (const t of traits) v += (TRAITS[t].skill && TRAITS[t].skill[k]) || 0;
    skills[k] = clamp(Math.round(v), 1, 10);
  }
  let loyaltyBase = o.loyalty !== undefined ? o.loyalty : rng.range(45, 72);
  let ambition = rng.range(15, 85);
  for (const t of traits) { loyaltyBase += TRAITS[t].loyalty || 0; ambition += TRAITS[t].ambition || 0; }
  return {
    id: game.nextCharId++, first, last,
    name: o.regnal ? `${first} ${romanNumeral(o.regnal)} ${last}` : `${first} ${last}`,
    female, age: rng.int(ageR[0], ageR[1]), traits, trait: traits[0] || 'cautious', skills,
    ideo: { econ: clamp(base.econ + rng.normal() * 0.25, -1, 1), auth: clamp(base.auth + rng.normal() * 0.25, -1, 1) },
    faction: o.faction || null, party: o.party || null, role: o.role || 'leader', post: o.post || null,
    loyalty: clamp(loyaltyBase, 0, 100), ambition: clamp(ambition, 0, 100), health: rng.range(70, 100),
    popularity: o.popularity || 0, favor: 0, look: rng.int(1, 2e9), since: game.month,
  };
}

function mainFaction(c) {
  const base = GOVS[c.gov].base;
  let best = null, bw = -1;
  for (const f in base) if (base[f] > bw) { bw = base[f]; best = f; }
  return best;
}

function closestFaction(ideo) {
  let best = 'workers', bd = Infinity;
  for (const f in FACTION_IDEO) { const d = ideoDist(ideo, FACTION_IDEO[f]); if (d < bd) { bd = d; best = f; } }
  return best;
}

function makeLeader(game, c, opts) {
  opts = opts || {};
  const party = GOVS[c.gov].party === 'multi' ? c.parties.find(p => p.id === c.rulingParty) : null;
  return makeCharacter(game, c, Object.assign({
    role: 'leader', traitCount: 2, party: c.rulingParty, faction: party ? closestFaction(party) : mainFaction(c),
    ideo: party || GOVS[c.gov], skillBias: { admin: 0.5, cha: 1 },
  }, opts));
}

function makeGeneral(game, c) {
  return makeCharacter(game, c, {
    role: 'general', faction: 'military', loyalty: clamp(c.factions.military + game.rng.range(-15, 10), 5, 95),
    skillBias: { mil: 2.5, diplo: -1 }, traitPool: ['militarist', 'cautious', 'loyal', 'ambitious', 'warHero', 'cruel', 'honest', 'corrupt', 'incompetent', 'paranoid'],
  });
}

function makeOpposition(game, c, party) {
  if (party) return makeCharacter(game, c, { role: 'opposition', party: party.id, ideo: party, faction: closestFaction(party), skillBias: { cha: 1.5 }, loyalty: 20 });
  return makeCharacter(game, c, {
    role: 'dissident', ideo: { econ: c.ideo.econ, auth: Math.min(c.ideo.auth, -0.2) }, faction: 'intelligentsia', loyalty: 5,
    skillBias: { cha: 2 }, popularity: game.rng.range(5, 25), traitPool: ['charismatic', 'populist', 'reformer', 'honest', 'ambitious', 'pious', 'cunning'],
  });
}

// Fill out a nation's cast. Called at game start and after regime changes.
function initCharacters(game, c, keep) {
  keep = keep || {};
  c.cabinet = c.cabinet && keep.cabinet ? c.cabinet : {};
  c.candidates = {};
  if (!keep.generals || !c.generals) c.generals = [];
  while (c.generals.length < 3) c.generals.push(makeGeneral(game, c));
  for (const p of c.parties) if (p.id !== c.rulingParty && !p.leader) p.leader = makeOpposition(game, c, p);
  if (GOVS[c.gov].party === 'single') {
    c.dissidents = (keep.dissidents && c.dissidents) || [];
    while (c.dissidents.length < (game.rng.chance(0.5) ? 2 : 1)) c.dissidents.push(makeOpposition(game, c, null));
  } else c.dissidents = [];
  c.heir = c.gov === 'absMonarchy' ? (c.heir && keep.heir ? c.heir : makeCharacter(game, c, { role: 'heir', young: true, surname: c.dynasty || c.leader.last, traitCount: 1 })) : null;
  c.monarch = c.gov === 'constMonarchy' ? (c.monarch || makeCharacter(game, c, { role: 'monarch', ageRange: [30, 70], traitCount: 1, ideo: { econ: 0.2, auth: 0.2 } })) : null;
  for (const post of POST_KEYS) if (!c.cabinet[post]) aiAppoint(game, c, post);
}

// ------------------------------------------------------------------ cabinet

function candidatesFor(game, c, post) {
  c.candidates = c.candidates || {};
  const cur = c.candidates[post];
  if (cur && game.month - cur.m < 12 && cur.list.length) return cur.list;
  const rng = game.rng;
  const base = Object.keys(GOVS[c.gov].base);
  const multi = GOVS[c.gov].party === 'multi';
  const facs = [rng.pick(base), rng.pick(FACTION_KEYS), post === 'defense' ? 'military' : rng.pick(FACTION_KEYS)];
  const list = facs.map(f => makeCharacter(game, c, {
    role: 'minister', post, faction: f, party: multi ? (rng.chance(0.75) ? c.rulingParty : rng.pick(c.parties).id) : null,
    ideo: { econ: (FACTION_IDEO[f].econ + GOVS[c.gov].econ) / 2, auth: (FACTION_IDEO[f].auth + GOVS[c.gov].auth) / 2 },
    skillBias: { [CABINET_POSTS[post].skill]: 1.5 },
  }));
  c.candidates[post] = { m: game.month, list };
  return list;
}

function aiAppoint(game, c, post) {
  const list = candidatesFor(game, c, post);
  const sk = CABINET_POSTS[post].skill;
  let best = list[0], bs = -Infinity;
  for (const ch of list) {
    const s = ch.skills[sk] + ch.loyalty / 25 + (GOVS[c.gov].base[ch.faction] ? 1.5 : 0);
    if (s > bs) { bs = s; best = ch; }
  }
  installMinister(c, post, best);
}

function installMinister(c, post, ch) {
  c.cabinet[post] = ch;
  ch.role = 'minister'; ch.post = post; ch.since = ch.since || 0;
  if (c.candidates && c.candidates[post]) c.candidates[post].list = c.candidates[post].list.filter(x => x.id !== ch.id);
}

const APPOINT_PC = 5;

function appointMinister(game, post, charId) {
  const c = game.countries[game.player];
  const ch = candidatesFor(game, c, post).find(x => x.id === charId);
  if (!ch) return { ok: false, msg: 'That candidate is no longer available.' };
  if (c.pc < APPOINT_PC) return { ok: false, msg: `Needs ${APPOINT_PC} political capital.` };
  c.pc -= APPOINT_PC;
  const old = c.cabinet[post];
  if (old && old.faction) c.factions[old.faction] = clamp(c.factions[old.faction] - 4, 0, 100);
  ch.since = game.month;
  installMinister(c, post, ch);
  logNews(game, `${c.name}: ${ch.name} is appointed ${CABINET_POSTS[post].name}.`, 'gov', [c.id]);
  return { ok: true, msg: `${ch.name} is the new ${CABINET_POSTS[post].name}.` };
}

function dismissMinister(game, post) {
  const c = game.countries[game.player];
  const old = c.cabinet[post];
  if (!old) return { ok: false, msg: 'The post is already vacant.' };
  c.cabinet[post] = null;
  if (old.faction) c.factions[old.faction] = clamp(c.factions[old.faction] - 6, 0, 100);
  logNews(game, `${c.name}: ${CABINET_POSTS[post].name} ${old.name} is dismissed.`, 'gov', [c.id]);
  return { ok: true, msg: `${old.name} has been dismissed. The ${FACTIONS[old.faction] ? FACTIONS[old.faction].name.toLowerCase() : 'public'} take note.` };
}

function effectiveSkill(ch, post) {
  if (!ch) return VACANT_SKILL;
  let s = ch.skills[CABINET_POSTS[post].skill];
  if (ch.loyalty < 25) s -= 2; // disloyal ministers drag their feet
  return clamp(s, 1, 10);
}

// Combined effect of the leader's cabinet on the nation.
function cabinetFx(c) {
  const out = { pc: 0, approval: 0, unrest: 0, stability: 0, taxEff: 0, corruption: 0, relations: 0, strength: 0, military: 0, factions: {} };
  if (!c.cabinet) return out;
  for (const post of POST_KEYS) {
    const ch = c.cabinet[post];
    const fx = CABINET_POSTS[post].fx(effectiveSkill(ch, post) - 5);
    for (const k in fx) out[k] += fx[k];
    if (ch) {
      for (const t of ch.traits) { const mf = TRAITS[t].ministerFx; if (mf) for (const k in mf) out[k] = (out[k] || 0) + mf[k]; }
      if (ch.faction && ch.loyalty >= 30) out.factions[ch.faction] = (out.factions[ch.faction] || 0) + 4;
    }
  }
  return out;
}

// Sum of a character's trait effects (used for the leader).
function traitFx(ch) {
  const out = {};
  for (const t of (ch.traits || [ch.trait])) {
    const T = TRAITS[t];
    if (!T) continue;
    for (const k in T) if (typeof T[k] === 'number') out[k] = (out[k] || 0) + T[k];
  }
  return out;
}

function leaderAggression(c) {
  let a = 1;
  for (const t of c.leader.traits || []) a *= TRAITS[t].aggression || 1;
  return a;
}

function bestGeneral(c) {
  let best = null;
  for (const g of c.generals || []) if (!best || g.skills.mil > best.skills.mil) best = g;
  return best;
}

function dissidentPressure(c) {
  return (c.dissidents || []).reduce((s, d) => s + d.popularity * 0.12, 0);
}

// ------------------------------------------------------------------ monthly tick

function allCharacters(c) {
  const out = [c.leader];
  for (const post of POST_KEYS) if (c.cabinet && c.cabinet[post]) out.push(c.cabinet[post]);
  for (const g of c.generals || []) out.push(g);
  for (const d of c.dissidents || []) out.push(d);
  for (const p of c.parties) if (p.leader) out.push(p.leader);
  if (c.heir) out.push(c.heir);
  if (c.monarch) out.push(c.monarch);
  if (c.movements) for (const k in c.movements) if (c.movements[k].leader) out.push(c.movements[k].leader);
  if (c.igLeaders) for (const k in c.igLeaders) out.push(c.igLeaders[k]);
  if (c.barons) for (const b of c.barons) out.push(b.ch);
  if (c.figures) for (const f of c.figures) out.push(f);
  return [...new Set(out)];
}

function deathChance(ch) {
  return 0.0003 + (ch.age > 55 ? Math.pow(ch.age - 55, 2) * 0.00004 : 0) + Math.max(0, 50 - ch.health) * 0.0002;
}

function subordinateLoyaltyTarget(c, ch) {
  let t = 50 + (c.leader.skills.cha - 5) * 3 + (c.stability - 50) * 0.3 - (ch.ambition - 50) * 0.25 - ideoDist(ch.ideo, GOVS[c.gov]) * 10;
  for (const tr of ch.traits) t += (TRAITS[tr].loyalty || 0) * 0.5;
  if (ch.faction && c.factions[ch.faction] !== undefined) t += (c.factions[ch.faction] - 50) * 0.4;
  // Famous generals feel they are owed more than a salute.
  if (ch.role === 'general') t += (c.policy.military - 3) * 2 + (GOVS[c.gov].base.military ? 8 : 0) - Math.max(0, (ch.renown || 0) - 40) * 0.15;
  return clamp(t + ch.favor, 0, 100);
}

function tickCharacters(game, c) {
  const rng = game.rng;
  const yearly = game.month % 12 === 0;
  for (const ch of allCharacters(c)) {
    if (yearly) { ch.age++; if (ch.age > 60) ch.health = Math.max(0, ch.health - rng.range(0, 3)); }
    if (ch.role === 'minister' || ch.role === 'general') {
      ch.loyalty += (subordinateLoyaltyTarget(c, ch) - ch.loyalty) * 0.05;
    }
    ch.favor *= 0.95;
  }
  // Deaths. The leader's is handled separately so succession can play out.
  if (rng.chance(deathChance(c.leader))) leaderDies(game, c);
  for (const post of POST_KEYS) {
    const ch = c.cabinet[post];
    if (ch && rng.chance(deathChance(ch))) {
      c.cabinet[post] = null;
      logNews(game, `${c.name}'s ${CABINET_POSTS[post].name}, ${ch.name}, has died at ${ch.age}.`, 'people', [c.id]);
      if (isPlayer(game, c)) toastPlayer(game, `${CABINET_POSTS[post].name} ${ch.name} has died. The post is vacant.`, 'bad');
    }
  }
  c.generals = c.generals.filter(g => {
    if (rng.chance(deathChance(g)) || g.age > 70) { logNews(game, `${c.name}: General ${g.name} ${g.age > 70 ? 'retires' : 'dies'}.`, 'people', [c.id]); return false; }
    return true;
  });
  while (c.generals.length < 3) c.generals.push(makeGeneral(game, c));
  if (c.heir && rng.chance(deathChance(c.heir))) {
    logNews(game, `Tragedy in ${c.name}: the heir, ${c.heir.name}, has died.`, 'gov', [c.id]);
    adjust(c, { stability: -5 });
    c.heir = makeCharacter(game, c, { role: 'heir', young: true, surname: c.dynasty || c.leader.last, traitCount: 1 });
  }
  if (c.monarch && rng.chance(deathChance(c.monarch))) {
    logNews(game, `The ${c.monarch.female ? 'Queen' : 'King'} of ${c.name}, ${c.monarch.name}, has died. A new monarch is crowned.`, 'gov', [c.id]);
    c.monarch = makeCharacter(game, c, { role: 'monarch', ageRange: [20, 50], traitCount: 1, surname: c.monarch.last });
  }
  for (const p of c.parties) {
    if (p.id === c.rulingParty) { p.leader = null; continue; }
    if (!p.leader || rng.chance(deathChance(p.leader)) || p.leader.age > 78) p.leader = makeOpposition(game, c, p);
  }
  // Dissidents gain a following when times are bad and freedom is scarce.
  for (const d of c.dissidents || []) {
    const t = c.unrest * 0.5 + (60 - c.freedom) * 0.25 + (d.skills.cha - 5) * 3 + (100 - c.approval) * 0.15;
    d.popularity = clamp(d.popularity + (t - d.popularity) * 0.03, 0, 100);
  }
  if (!isPlayer(game, c)) {
    for (const post of POST_KEYS) if (!c.cabinet[post]) aiAppoint(game, c, post);
    if (rng.chance(0.01)) {
      const post = rng.pick(POST_KEYS);
      const ch = c.cabinet[post];
      if (ch && ch.loyalty < 35) { c.cabinet[post] = null; aiAppoint(game, c, post); }
    }
    // Disloyal generals strike.
    const plotter = (c.generals || []).find(g => g.loyalty < 22 && g.ambition > 45);
    if (plotter && c.monthsInRegime > 6 && rng.chance(0.012 + Math.max(0, 40 - c.stability) * 0.001)) {
      const odds = clamp(0.25 + (plotter.skills.mil - 5) * 0.05 + (50 - c.factions.military) / 100, 0.1, 0.85);
      if (rng.chance(odds)) generalCoup(game, c, plotter);
      else { c.generals = c.generals.filter(g => g !== plotter); logNews(game, `A coup attempt by General ${plotter.name} in ${c.name} is crushed.`, 'gov', [c.id]); }
    }
  }
}

function generalCoup(game, c, general) {
  c.generals = c.generals.filter(g => g !== general);
  general.role = 'leader';
  general.loyalty = 100;
  const target = c.gov === 'junta' ? (c.ideo.auth > 0.4 && c.ideo.econ > 0.2 ? 'fascist' : 'junta') : 'junta';
  if (target === c.gov) {
    const old = c.leader;
    c.leader = general;
    adjust(c, { stability: -10, legitimacy: -10 });
    logNews(game, `Palace coup in ${c.name}: General ${general.name} ousts ${old.name}.`, 'gov', [c.id]);
    if (isPlayer(game, c)) game.pending.push({ type: 'deposed', how: 'coup', gov: c.gov, oldGov: c.gov, oldFormal: formalName(c) });
    return;
  }
  changeGovernment(game, c, target, 'coup', { leader: general });
}

function leaderDies(game, c) {
  const old = c.leader;
  const title = leaderTitle(c);
  let note;
  if (c.gov === 'absMonarchy' && c.heir) {
    const heir = c.heir;
    heir.role = 'leader';
    c.leader = heir;
    c.heir = makeCharacter(game, c, { role: 'heir', young: true, surname: c.dynasty || heir.last, traitCount: 1 });
    adjust(c, { stability: -6 });
    note = `The crown passes to ${heir.name}, aged ${heir.age}.`;
  } else if (GOVS[c.gov].elections === 'free') {
    const chief = c.cabinet && c.cabinet.chief;
    if (chief && chief.age < 72) { c.cabinet.chief = null; chief.role = 'leader'; c.leader = chief; }
    else c.leader = makeLeader(game, c);
    adjust(c, { stability: -3 });
    note = `${c.leader.name} takes over as ${leaderTitle(c)}.`;
  } else {
    // In autocracies, the strongest subordinate seizes the succession.
    const rivals = POST_KEYS.map(p => c.cabinet && c.cabinet[p]).filter(Boolean).concat(c.generals || []);
    const heir = rivals.sort((a, b) => (b.ambition + b.skills.cha * 4) - (a.ambition + a.skills.cha * 4))[0];
    if (heir) {
      for (const p of POST_KEYS) if (c.cabinet[p] === heir) c.cabinet[p] = null;
      c.generals = c.generals.filter(g => g !== heir);
      heir.role = 'leader';
      c.leader = heir;
    } else c.leader = makeLeader(game, c);
    adjust(c, { stability: -15, pc: -20 });
    note = `A succession struggle ends with ${c.leader.name} in charge.`;
  }
  logNews(game, `${title} ${old.name} of ${c.name} has died at age ${old.age}. ${note}`, 'gov', [c.id]);
  if (isPlayer(game, c)) notify(game, `${title} ${old.name} Has Died`, `Our leader has died at the age of ${old.age}. ${note}`, { charId: c.leader.id });
}

// ------------------------------------------------------------------ player actions on characters

const CHAR_ACTIONS = {
  honor: { name: 'Honor', pc: 10, desc: 'Medals, titles and a generous budget: +15 loyalty.', roles: ['minister', 'general'] },
  retire: { name: 'Retire', pc: 5, desc: 'Send them into comfortable retirement. Their faction is slighted.', roles: ['general'] },
  arrest: { name: 'Arrest', pc: 15, desc: 'Lock them up. Removes the threat, but freedom and intelligentsia loyalty fall, and unrest may spike.', roles: ['dissident', 'general'] },
  smear: { name: 'Smear', pc: 12, desc: 'Leak damaging stories: their party loses support for a while.', roles: ['opposition'] },
  coopt: { name: 'Co-opt', pc: 25, desc: 'Offer them a post. If they accept, they join the cabinet as a candidate and their following melts away.', roles: ['dissident', 'opposition'] },
};

function findCharacter(c, id) { return allCharacters(c).find(ch => ch.id === id) || null; }

function characterAction(game, action, charId) {
  const c = game.countries[game.player];
  const ch = findCharacter(c, charId);
  const A = CHAR_ACTIONS[action];
  if (!ch || !A) return { ok: false, msg: 'Nothing to do.' };
  if (c.pc < A.pc) return { ok: false, msg: `Needs ${A.pc} political capital.` };
  c.pc -= A.pc;
  const free = GOVS[c.gov].elections === 'free';
  switch (action) {
    case 'honor':
      ch.favor += 15; ch.loyalty = clamp(ch.loyalty + 10, 0, 100);
      return { ok: true, msg: `${ch.name} is showered with honors.` };
    case 'retire':
      c.generals = c.generals.filter(g => g !== ch);
      c.factions.military = clamp(c.factions.military - 3, 0, 100);
      c.generals.push(makeGeneral(game, c));
      return { ok: true, msg: `General ${ch.name} retires. A new general joins the high command.` };
    case 'arrest': {
      if (ch.role === 'general') { c.generals = c.generals.filter(g => g !== ch); c.generals.push(makeGeneral(game, c)); adjust(c, { military: -8 }); }
      else c.dissidents = c.dissidents.filter(d => d !== ch);
      adjust(c, { freedom: free ? -12 : -5, intelligentsia: -10, legitimacy: free ? -12 : -3, unrest: ch.popularity > 30 ? 8 : -4 });
      logNews(game, `${c.name}: ${ch.name} is arrested.`, 'gov', [c.id]);
      return { ok: true, msg: `${ch.name} is arrested.${ch.popularity > 30 ? ' Their followers take to the streets.' : ''}` };
    }
    case 'smear': {
      const p = c.parties.find(x => x.id === ch.party);
      if (p) p.boost -= 0.25;
      if (free) adjust(c, { freedom: -2 });
      if (game.rng.chance(0.25)) { adjust(c, { approval: -6 }); return { ok: true, msg: 'The smear campaign is traced back to us! Approval −6.' }; }
      return { ok: true, msg: `Scandal engulfs ${ch.name}. ${p ? p.name : 'Their movement'} slips in the polls.` };
    }
    case 'coopt': {
      const accept = game.rng.chance(clamp(0.35 + (c.stability - 50) / 150 - ideoDist(ch.ideo, GOVS[c.gov]) * 0.2, 0.1, 0.8));
      if (!accept) return { ok: false, msg: `${ch.name} refuses to be bought.` };
      if (ch.role === 'dissident') c.dissidents = c.dissidents.filter(d => d !== ch);
      else { const p = c.parties.find(x => x.id === ch.party); if (p) { p.leader = makeOpposition(game, c, p); p.boost -= 0.15; } }
      // A co-opted demagogue leaves the movement leaderless.
      for (const k in c.movements || {}) if (c.movements[k].leader === ch) c.movements[k].leader = null;
      ch.demagogue = false;
      const post = POST_KEYS.find(k => !c.cabinet[k]) || rng0(game, POST_KEYS);
      ch.role = 'minister'; ch.loyalty = 55; ch.popularity = 0;
      candidatesFor(game, c, post).push(ch);
      return { ok: true, msg: `${ch.name} accepts. They are now a candidate for ${CABINET_POSTS[post].name}.` };
    }
    default:
      return { ok: false, msg: '' };
  }
}

function rng0(game, arr) { return game.rng.pick(arr); }

function roleTitle(c, ch) {
  if (ch.role === 'leader') return leaderTitle(c);
  if (ch.role === 'minister') return CABINET_POSTS[ch.post] ? CABINET_POSTS[ch.post].name : 'Minister';
  if (ch.role === 'general') return 'General';
  if (ch.role === 'heir') return ch.female ? 'Crown Princess' : 'Crown Prince';
  if (ch.role === 'monarch') return ch.female ? 'Queen' : 'King';
  if (ch.role === 'dissident') return 'Dissident';
  if (ch.role === 'baron') return `Owner of ${ch.paper || 'a newspaper'}`;
  if (ch.role === 'igLeader') return `Leader of the ${FACTIONS[ch.ig] ? FACTIONS[ch.ig].name : 'group'} (${ch.stance})`;
  if (ch.role === 'movement') return `${ch.demagogue ? 'Demagogue, leader' : 'Leader'} of the ${MOVEMENTS[ch.movement] ? MOVEMENTS[ch.movement].name : 'movement'}`;
  if (ch.role === 'figure') return FIGURE_KINDS[ch.kind] ? FIGURE_KINDS[ch.kind].name : 'Notable';
  if (ch.role === 'opposition') { const p = c.parties.find(x => x.id === ch.party); return p ? `Leader of the ${p.name}` : 'Opposition leader'; }
  return '';
}
