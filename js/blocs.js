'use strict';
// International blocs: military pacts, free-trade zones, customs unions and
// confederations. A nation may belong to one military and one economic bloc
// (a confederation counts as both).
//
// game.blocs = [{ id, name, type, leader, members[], founded, tariff, color }]

const BLOC_TYPES = {
  pact: {
    name: 'Military Pact', military: true, economic: false, rel: 15, foundPc: 25, icon: '⚔',
    desc: 'Collective defense: an attack on one member is an attack on all.',
  },
  freeTrade: {
    name: 'Free-Trade Zone', military: false, economic: true, rel: 8, foundPc: 20, icon: '⇄', openness: 0.55,
    desc: 'Members trade with each other first and without tariffs. Each keeps its own tariff toward the rest of the world.',
  },
  customs: {
    name: 'Customs Union', military: false, economic: true, rel: 12, foundPc: 25, icon: '⛁', openness: 0.65,
    desc: 'Free trade inside, and one common tariff toward the world, set by the leader. Members give up their own tariff policy.',
  },
  confederation: {
    name: 'Confederation', military: true, economic: true, rel: 20, foundPc: 40, icon: '✦', openness: 0.7,
    desc: 'A league of sovereign states: collective defense, a customs union and a council. Can one day become a federation.',
  },
};
const BLOC_KEYS = Object.keys(BLOC_TYPES);
const BLOC_COLORS = [[230, 120, 60], [70, 160, 220], [200, 80, 170], [90, 190, 110], [230, 200, 70], [140, 110, 230], [60, 200, 190], [220, 90, 90]];

function blocsOf(game, id) { return (game.blocs || []).filter(b => b.members.includes(id)); }
function economicBloc(game, id) { return blocsOf(game, id).find(b => BLOC_TYPES[b.type].economic) || null; }
function militaryBloc(game, id) { return blocsOf(game, id).find(b => BLOC_TYPES[b.type].military) || null; }
function blocById(game, id) { return (game.blocs || []).find(b => b.id === id) || null; }

// The tariff a nation actually charges on world imports.
function effectiveTariff(game, c) {
  const b = economicBloc(game, c.id);
  return b && (b.type === 'customs' || b.type === 'confederation') ? b.tariff : c.policy.tariff;
}

function blocName(game, founder, type) {
  const cap = game.world.provinces[founder.capital].name;
  return {
    pact: `Pact of ${cap}`, freeTrade: `${cap} Free-Trade Area`, customs: `${founder.adj} Customs Union`, confederation: `${founder.adj} Confederation`,
  }[type];
}

function canJoin(game, c, type) {
  const T = BLOC_TYPES[type];
  if (c.overlord != null) return 'Subjects cannot join blocs on their own.';
  if (T.military && militaryBloc(game, c.id)) return 'Already in a military bloc.';
  if (T.economic && economicBloc(game, c.id)) return 'Already in an economic bloc.';
  return null;
}

function foundBloc(game, founderId, type, name) {
  const F = game.countries[founderId];
  game.blocs = game.blocs || [];
  game.nextBlocId = game.nextBlocId || 1;
  const b = {
    id: game.nextBlocId++, name: name || blocName(game, F, type), type, leader: founderId, members: [founderId],
    founded: game.month, tariff: clamp(F.policy.tariff, 0, 0.5), color: BLOC_COLORS[(game.nextBlocId - 2) % BLOC_COLORS.length],
  };
  game.blocs.push(b);
  logNews(game, `${F.name} founds the ${b.name}.`, 'diplo', [founderId]);
  return b;
}

function joinBloc(game, b, id) {
  if (b.members.includes(id)) return;
  b.members.push(id);
  if (BLOC_TYPES[b.type].economic && (b.type === 'customs' || b.type === 'confederation')) {
    // The common tariff moves toward the average of its members.
    b.tariff = b.members.reduce((s, m) => s + game.countries[m].policy.tariff, 0) / b.members.length;
  }
  logNews(game, `${game.countries[id].name} joins the ${b.name}.`, 'diplo', [id, ...b.members]);
}

function leaveBloc(game, b, id, why) {
  b.members = b.members.filter(m => m !== id);
  for (const m of b.members) addRel(game, id, m, why === 'expelled' ? -25 : -12);
  logNews(game, `${game.countries[id].name} ${why === 'expelled' ? 'is expelled from' : 'leaves'} the ${b.name}.`, 'diplo', [id, ...b.members]);
  if (b.leader === id && b.members.length) b.leader = b.members.slice().sort((x, y) => strength(game.countries[y]) - strength(game.countries[x]))[0];
  if (b.members.length < 2) dissolveBloc(game, b);
}

function dissolveBloc(game, b) {
  game.blocs = game.blocs.filter(x => x !== b);
  logNews(game, `The ${b.name} is dissolved.`, 'diplo', b.members);
}

// How keen nation c is to join bloc b (0..1).
function joinAppeal(game, c, b) {
  const T = BLOC_TYPES[b.type];
  const L = game.countries[b.leader];
  let s = relation(game, c.id, b.leader) / 70 - ideoDist(GOVS[c.gov], GOVS[L.gov]) * 0.25;
  s += b.members.reduce((acc, m) => acc + relation(game, c.id, m), 0) / b.members.length / 150;
  if (T.military) s += (threatLevel(game, c) - 1) * 0.4;
  if (T.economic) {
    const blocGdp = b.members.reduce((acc, m) => acc + game.countries[m].gdp, 0);
    s += clamp(blocGdp / (c.gdp * 4), 0, 0.5);
    if (b.type !== 'freeTrade') s -= 0.1; // giving up tariff policy
  }
  if (b.members.some(m => atWarWith(game, c.id, m))) return 0;
  return clamp(s, 0, 0.95);
}

// The chance that partner accepts founding a bloc of this type with founder.
// Every founding path goes through it, the player's and the AI's alike, so a
// founding partner always weighs the offer the way a joining nation does.
// bonus carries the founder's reason to ask (a shared grievance, a common rival).
const FOUND_BONUS = 0.15;
function foundingChance(game, partner, founderId, type, bonus) {
  if (canJoin(game, partner, type) || atWarWith(game, partner.id, founderId)) return 0;
  const appeal = joinAppeal(game, partner, { type, leader: founderId, members: [founderId] });
  return clamp(appeal + (bonus == null ? FOUND_BONUS : bonus), 0.05, 0.95);
}

// Found a bloc with a partner who decides. Returns the bloc, or null when the
// partner declines (the founder is snubbed a little).
function proposeBloc(game, founderId, partnerId, type, name, bonus) {
  const P = game.countries[partnerId];
  if (!game.rng.chance(foundingChance(game, P, founderId, type, bonus))) {
    addRel(game, founderId, partnerId, -3);
    return null;
  }
  const b = foundBloc(game, founderId, type, name);
  joinBloc(game, b, partnerId);
  return b;
}

// Members vote on an applicant: each says yes if relations are decent.
function memberVote(game, b, applicantId) {
  let yes = 0;
  for (const m of b.members) if (relation(game, m, applicantId) > 5 && !atWarWith(game, m, applicantId)) yes++;
  return { yes, total: b.members.length, passed: yes * 2 > b.members.length };
}

// The chance that an invited nation ends up a member: the members must vote it
// in, and then it decides. Shown on the Blocs tab beside each candidate.
function inviteChance(game, b, targetId) {
  const v = memberVote(game, b, targetId);
  return v.passed ? clamp(joinAppeal(game, game.countries[targetId], b) + 0.1, 0, 1) : 0;
}

// Collective defense, called from declareWar.
function blocDefense(game, war, attackerId, defenderId) {
  for (const b of blocsOf(game, defenderId)) {
    if (!BLOC_TYPES[b.type].military) continue;
    if (b.members.includes(attackerId)) { leaveBloc(game, b, attackerId, 'expelled'); if (!game.blocs.includes(b)) continue; }
    for (const m of b.members) {
      if (m === defenderId || war.a.includes(m) || war.b.includes(m)) continue;
      if (m === game.player) game.pending.push({ type: 'allyCall', warId: war.id, ally: defenderId, enemy: attackerId, bloc: b.name });
      else if (game.rng.chance(0.85)) joinWar(game, war, m, 'b');
    }
  }
}

function tickBlocs(game) {
  const rng = game.rng;
  game.blocs = game.blocs || [];
  for (const b of game.blocs.slice()) {
    b.members = b.members.filter(m => game.countries[m].alive && game.countries[m].overlord == null);
    if (b.members.length < 2) { dissolveBloc(game, b); continue; }
    if (!b.members.includes(b.leader)) b.leader = b.members[0];
    // Members drift apart when relations with the leader collapse.
    for (const m of b.members.slice()) {
      if (m === game.player || m === b.leader) continue;
      if (relation(game, m, b.leader) < -20 && rng.chance(0.05)) leaveBloc(game, b, m);
    }
  }
  // AI: found and join blocs.
  for (const c of game.countries) {
    if (!c.alive || c.id === game.player || c.overlord != null || !rng.chance(0.02)) continue;
    const others = game.countries.filter(o => o.alive && o.id !== c.id && o.overlord == null);
    // Seek a military bloc when threatened.
    if (!militaryBloc(game, c.id) && threatLevel(game, c) > 1.2) {
      const offer = game.blocs.filter(b => BLOC_TYPES[b.type].military && b.leader !== game.player).sort((x, y) => joinAppeal(game, c, y) - joinAppeal(game, c, x))[0];
      if (offer && rng.chance(joinAppeal(game, c, offer)) && memberVote(game, offer, c.id).passed) joinBloc(game, offer, c.id);
      else {
        const friend = others.find(o => !militaryBloc(game, o.id) && relation(game, c.id, o.id) > 45 && o.id !== game.player);
        if (friend && rng.chance(0.3)) proposeBloc(game, c.id, friend.id, 'pact');
      }
    }
    // Seek an economic bloc with trading partners.
    if (!economicBloc(game, c.id)) {
      const offer = game.blocs.filter(b => BLOC_TYPES[b.type].economic && b.leader !== game.player).sort((x, y) => joinAppeal(game, c, y) - joinAppeal(game, c, x))[0];
      if (offer && rng.chance(joinAppeal(game, c, offer) * 0.7) && memberVote(game, offer, c.id).passed) joinBloc(game, offer, c.id);
      else if (c.trade.length >= 2 && rng.chance(0.15)) {
        const partner = c.trade.map(id => game.countries[id]).find(o => o.alive && !economicBloc(game, o.id) && o.overlord == null && o.id !== game.player && relation(game, c.id, o.id) > 35);
        if (partner) proposeBloc(game, c.id, partner.id, rng.chance(0.6) ? 'freeTrade' : 'customs');
      }
    }
    // Leaders invite friendly nations, including the player.
    for (const b of game.blocs.filter(x => x.leader === c.id && x.members.length < 8)) {
      const cand = others.find(o => !b.members.includes(o.id) && !canJoin(game, o, b.type) && relation(game, c.id, o.id) > 40);
      if (!cand || !rng.chance(0.2)) continue;
      if (cand.id === game.player) { if (!game.pending.some(p => p.type === 'blocInvite')) game.pending.push({ type: 'blocInvite', bloc: b.id }); }
      else if (rng.chance(joinAppeal(game, cand, b))) joinBloc(game, b, cand.id);
    }
  }
}

// ------------------------------------------------------------------ player actions

function playerFoundBloc(game, type, invitee) {
  const c = game.countries[game.player], T = BLOC_TYPES[type];
  const r = canJoin(game, c, type);
  if (r) return { ok: false, msg: r };
  const t = game.countries[invitee];
  if (!t || !t.alive) return { ok: false, msg: 'Choose a founding partner.' };
  const rt = canJoin(game, t, type);
  if (rt) return { ok: false, msg: `${t.name}: ${rt.toLowerCase()}` };
  if (c.pc < T.foundPc) return { ok: false, msg: `Needs ${T.foundPc} political capital.` };
  c.pc -= T.foundPc;
  const b = proposeBloc(game, c.id, t.id, type);
  if (!b) return { ok: false, msg: `${t.name} declines to found a ${T.name.toLowerCase()} with us.` };
  return { ok: true, msg: `The ${b.name} is founded with ${t.name}.` };
}

function playerInvite(game, blocId, targetId) {
  const c = game.countries[game.player], b = blocById(game, blocId), t = game.countries[targetId];
  if (!b || b.leader !== c.id) return { ok: false, msg: 'Only the leader can invite.' };
  const r = canJoin(game, t, b.type);
  if (r) return { ok: false, msg: `${t.name}: ${r.toLowerCase()}` };
  if (c.pc < 10) return { ok: false, msg: 'Needs 10 political capital.' };
  c.pc -= 10;
  if (!memberVote(game, b, t.id).passed) return { ok: false, msg: `The other members vote against admitting ${t.name}.` };
  if (!game.rng.chance(inviteChance(game, b, t.id))) return { ok: false, msg: `${t.name} declines our invitation.` };
  joinBloc(game, b, t.id);
  return { ok: true, msg: `${t.name} joins the ${b.name}.` };
}

function playerApply(game, blocId) {
  const c = game.countries[game.player], b = blocById(game, blocId);
  const r = canJoin(game, c, b.type);
  if (r) return { ok: false, msg: r };
  if (c.pc < 15) return { ok: false, msg: 'Needs 15 political capital.' };
  c.pc -= 15;
  const v = memberVote(game, b, c.id);
  if (!v.passed) return { ok: false, msg: `Our application is rejected: ${v.yes} of ${v.total} members in favor.` };
  joinBloc(game, b, c.id);
  return { ok: true, msg: `We join the ${b.name} (${v.yes} of ${v.total} members in favor).` };
}

function playerLeave(game, blocId) {
  const b = blocById(game, blocId);
  if (!b || !b.members.includes(game.player)) return { ok: false, msg: 'Not a member.' };
  leaveBloc(game, b, game.player);
  return { ok: true, msg: `We leave the ${b.name}.` };
}

function playerExpel(game, blocId, targetId) {
  const c = game.countries[game.player], b = blocById(game, blocId);
  if (!b || b.leader !== c.id) return { ok: false, msg: 'Only the leader can expel members.' };
  if (c.pc < 10) return { ok: false, msg: 'Needs 10 political capital.' };
  c.pc -= 10;
  leaveBloc(game, b, targetId, 'expelled');
  return { ok: true, msg: `${game.countries[targetId].name} is expelled.` };
}

function setBlocTariff(game, blocId, value) {
  const b = blocById(game, blocId);
  if (!b || b.leader !== game.player) return;
  b.tariff = clamp(value, 0, 0.5);
}

function resolveBlocInvite(game, item, accept) {
  const b = blocById(game, item.bloc), c = game.countries[game.player];
  if (!b) return 'The bloc no longer exists.';
  if (!accept) { addRel(game, c.id, b.leader, -5); return 'We decline.'; }
  const r = canJoin(game, c, b.type);
  if (r) return r;
  joinBloc(game, b, c.id);
  return `We join the ${b.name}.`;
}
