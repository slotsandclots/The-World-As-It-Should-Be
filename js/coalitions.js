'use strict';
// Parliamentary coalitions. With 200 seats, a majority is 101. When no party
// has one, parties negotiate: partners take a cabinet post and make a policy
// demand. Unhappy partners walk out, and a government that loses its majority
// falls.
//
// c.coalition = { partners: [{ id, satisfaction, demand, post }], minority, formed } | null

const MAJORITY = 101;

function seatsOf(result) { const m = {}; for (const r of result.results) m[r.id] = r.seats; return m; }

// What a partner party asks for, based on where it stands.
function makeDemand(c, party) {
  const p = c.policy;
  if (party.econ < -0.25) return { key: 'welfare', op: '>=', value: Math.min(25, Math.round(p.welfare + 2)) };
  if (party.econ > 0.3) return { key: 'tax', op: '<=', value: Math.max(0.05, Math.round((p.tax - 0.03) * 100) / 100) };
  if (party.auth < -0.35) return { key: 'education', op: '>=', value: Math.min(10, Math.round(p.education + 1)) };
  if (party.auth > 0.35) return { key: 'military', op: '>=', value: Math.min(12, Math.round(p.military + 1)) };
  return { key: 'infrastructure', op: '>=', value: Math.min(10, Math.round(p.infrastructure + 1)) };
}
function demandMet(c, d) { return d.op === '>=' ? c.policy[d.key] >= d.value - 1e-9 : c.policy[d.key] <= d.value + 1e-9; }
const DEMAND_TEXT = {
  welfare: v => `Raise welfare to ${v}% of GDP`, tax: v => `Cut taxes to ${Math.round(v * 100)}%`, education: v => `Raise education to ${v}% of GDP`,
  military: v => `Raise military spending to ${v}% of GDP`, infrastructure: v => `Raise infrastructure to ${v}% of GDP`,
};
function coalitionDemandText(d) { return DEMAND_TEXT[d.key](d.value); }

// Coalitions a given party could lead: itself plus up to two of the nearest willing parties.
function coalitionOptions(c, seats, leadId) {
  const lead = c.parties.find(p => p.id === leadId);
  if (!lead) return [];
  const others = c.parties.filter(p => p.id !== leadId && (seats[p.id] || 0) > 0 && ideoDist(p, lead) < 1.0)
    .sort((a, b) => ideoDist(a, lead) - ideoDist(b, lead));
  const opts = [];
  for (const a of others) {
    const s1 = (seats[leadId] || 0) + seats[a.id];
    if (s1 >= MAJORITY) { opts.push({ lead: leadId, partners: [a.id], seats: s1 }); continue; }
    for (const b of others) {
      if (b === a || ideoDist(b, lead) < ideoDist(a, lead)) continue;
      const s2 = s1 + seats[b.id];
      if (s2 >= MAJORITY) opts.push({ lead: leadId, partners: [a.id, b.id], seats: s2 });
    }
  }
  // Prefer the smallest, most compatible coalitions.
  const dist = o => o.partners.reduce((s, id) => s + ideoDist(c.parties.find(p => p.id === id), lead), 0);
  return opts.sort((x, y) => x.partners.length - y.partners.length || dist(x) - dist(y)).slice(0, 4);
}

// AI government formation after an election.
function formGovernment(game, c, seats, exclude) {
  const ranked = c.parties.filter(p => p.id !== exclude).sort((a, b) => (seats[b.id] || 0) - (seats[a.id] || 0));
  if (!ranked.length) return null;
  if ((seats[ranked[0].id] || 0) >= MAJORITY) return { lead: ranked[0].id, partners: [], seats: seats[ranked[0].id] };
  for (const p of ranked.slice(0, 2)) {
    const opts = coalitionOptions(c, seats, p.id).filter(o => !o.partners.includes(exclude));
    if (opts.length) return opts[0];
  }
  return { lead: ranked[0].id, partners: [], seats: seats[ranked[0].id], minority: true };
}

// Put a formed government in office: lead party, partner ministers, demands.
function applyGovernment(game, c, opt) {
  if (opt.lead !== c.rulingParty) setRulingParty(game, c, opt.lead);
  const posts = ['foreign', 'interior', 'finance'];
  c.coalition = { partners: [], minority: !!opt.minority, formed: game.month };
  opt.partners.forEach((pid, i) => {
    const party = c.parties.find(p => p.id === pid);
    const post = posts[i];
    const ch = makeCharacter(game, c, { role: 'minister', post, party: pid, ideo: party, faction: closestFaction(party), skillBias: { [CABINET_POSTS[post].skill]: 1 } });
    ch.since = game.month;
    installMinister(c, post, ch);
    c.coalition.partners.push({ id: pid, satisfaction: 65, demand: makeDemand(c, party), post, ministerId: ch.id });
  });
  if (!opt.partners.length && !opt.minority) c.coalition = null;
  const names = [opt.lead, ...opt.partners].map(id => c.parties.find(p => p.id === id).name);
  if (opt.partners.length) logNews(game, `${c.name}: a coalition of ${names.join(', ')} takes office with ${opt.seats} seats.`, 'election', [c.id]);
  else if (opt.minority) logNews(game, `${c.name}: ${names[0]} forms a minority government.`, 'election', [c.id]);
}

function tickCoalition(game, c) {
  const C = c.coalition;
  if (!C || GOVS[c.gov].elections !== 'free') { if (C && GOVS[c.gov].elections !== 'free') c.coalition = null; return; }
  const lead = rulingPartyObj(c);
  for (const pt of C.partners.slice()) {
    const party = c.parties.find(p => p.id === pt.id);
    if (!party) { C.partners = C.partners.filter(x => x !== pt); continue; }
    const holdsPost = POST_KEYS.some(k => c.cabinet[k] && c.cabinet[k].id === pt.ministerId);
    const met = demandMet(c, pt.demand);
    // AI governments sometimes give partners what they want.
    if (!met && !isPlayer(game, c) && game.rng.chance(0.03)) { c.policy[pt.demand.key] = pt.demand.value; clampPolicy(c.policy); }
    const t = 60 + (met ? 10 : -38) + (holdsPost ? 8 : -20) - ideoDist(party, lead) * 25 + (c.approval - 50) * 0.3 + (pt.favor || 0);
    pt.favor = (pt.favor || 0) * 0.95;
    pt.satisfaction += (clamp(t, 0, 100) - pt.satisfaction) * 0.06;
    if (pt.satisfaction < 25 && game.rng.chance(0.12)) partnerQuits(game, c, pt);
  }
  // Minority governments are fragile.
  if (C.minority && game.rng.chance(0.006)) {
    logNews(game, `${c.name}'s minority government loses a confidence vote.`, 'election', [c.id]);
    governmentFalls(game, c, 'loses a vote of no confidence');
  }
}

function partnerQuits(game, c, pt) {
  const C = c.coalition;
  const party = c.parties.find(p => p.id === pt.id);
  C.partners = C.partners.filter(x => x !== pt);
  const post = POST_KEYS.find(k => c.cabinet[k] && c.cabinet[k].id === pt.ministerId);
  if (post) c.cabinet[post] = null;
  logNews(game, `${party.name} quits ${c.name}'s governing coalition.`, 'election', [c.id]);
  const seats = c.lastElection && !c.lastElection.sham ? seatsOf(c.lastElection) : {};
  const remaining = (seats[c.rulingParty] || 0) + C.partners.reduce((s, p) => s + (seats[p.id] || 0), 0);
  if (remaining < MAJORITY) governmentFalls(game, c, `loses its majority when the ${party.name} walks out`);
  else if (isPlayer(game, c)) notify(game, 'A Coalition Partner Walks Out', `The ${party.name} has left the government, but we still hold a majority.`);
}

function governmentFalls(game, c, why) {
  c.coalition = null;
  c.nextElection = Math.min(c.nextElection, game.month + 3);
  adjust(c, { stability: -6, legitimacy: -8 });
  if (isPlayer(game, c)) notify(game, 'The Government Falls', `Our government ${why}. Snap elections will be held in three months.`);
}

// ------------------------------------------------------------------ player

function resolveCoalitionChoice(game, item, choice) {
  const c = game.countries[game.player];
  const seats = seatsOf(item.result);
  if (choice === 'minority') {
    applyGovernment(game, c, { lead: c.rulingParty, partners: [], seats: seats[c.rulingParty], minority: true });
    c.lastElection.winner = c.rulingParty;
    c.termsWon++;
    return 'We govern alone, as a minority. Every vote will be a fight, and the government could fall at any time.';
  }
  if (choice === 'concede') {
    const opt = formGovernment(game, c, seats, c.rulingParty);
    c.lastElection.winner = opt.lead;
    applyGovernment(game, c, opt);
    return `We go into opposition. ${rulingPartyObj(c).name} forms the new government.`;
  }
  const opt = item.options[choice];
  applyGovernment(game, c, opt);
  c.lastElection.winner = opt.lead;
  c.legitimacy = Math.max(c.legitimacy, 68);
  c.termsWon++;
  return `The coalition takes office with ${opt.seats} seats.`;
}

const COALITION_ACTIONS = {
  meet: { name: 'Meet their demand', pc: 5 },
  concede: { name: 'Make concessions', pc: 12 },
};

function coalitionAction(game, pid, action) {
  const c = game.countries[game.player], C = c.coalition;
  const pt = C && C.partners.find(p => p.id === pid);
  if (!pt) return { ok: false, msg: 'They are not in the coalition.' };
  const A = COALITION_ACTIONS[action];
  if (c.pc < A.pc) return { ok: false, msg: `Needs ${A.pc} political capital.` };
  c.pc -= A.pc;
  if (action === 'meet') { c.policy[pt.demand.key] = pt.demand.value; clampPolicy(c.policy); pt.satisfaction = clamp(pt.satisfaction + 10, 0, 100); return { ok: true, msg: `${coalitionDemandText(pt.demand)}: done.` }; }
  pt.favor = (pt.favor || 0) + 20;
  return { ok: true, msg: 'Our partners are mollified, for now.' };
}
