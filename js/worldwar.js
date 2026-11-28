'use strict';
// World wars, and how wars grow into them.
//
// Great powers: the strongest quarter of the world (by army and economy).
//
// Wars grow while they are fought. Every month, nations outside a war weigh
// joining it: allies whose friend is losing, pact members, neighbors with
// claims or a grudge who see a chance, ideological crusaders, and great
// powers alarmed that one side is about to dominate. When enough great powers
// are drawn in, a war becomes a world war: AI powers mobilize and switch to
// war production, shipping is disrupted for everyone, exhausted nations are
// ripe for revolution, and a new revolutionary government may sign a
// separate peace (which the losers' army will remember, revanchism.js).
//
// A world war ends at a peace conference. The victors keep the occupied land
// where their people live, free the peoples the losers had conquered, impose
// reparations and disarmament on the great powers that lost, and draw together
// in an alliance of victors. The losers carry the wound into the next
// generation, and revanchist governments look for allies of their own: the
// sides of the next world war can form out of the peace that ended the last.
//
// war.world = ordinal · war.armyStart / war.dead = { id: soldiers }
// game.worldWars = [{ n, name, start, became, end, a: [ids], b: [ids], victors, losers, treaty, outcome }]

const ORDINALS = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth'];

function greatPowers(game) {
  if (game._gp && game._gpMonth === game.month) return game._gp;
  const alive = game.countries.filter(c => c.alive && c.overlord == null);
  const n = Math.max(3, Math.round(alive.length / 4));
  let ms = 0.001, mg = 0.001;
  for (const c of alive) { ms = Math.max(ms, strength(c)); mg = Math.max(mg, c.gdp); }
  game._gp = alive.map(c => [c.id, strength(c) / ms + c.gdp / mg]).sort((a, b) => b[1] - a[1]).slice(0, n).map(x => x[0]);
  game._gpMonth = game.month;
  return game._gp;
}
function isGreatPower(game, id) { return greatPowers(game).includes(id); }

function worldWarOf(game, id) { return game.wars.find(w => w.world && (w.a.includes(id) || w.b.includes(id))) || null; }
function worldWarRaging(game) { return game.wars.some(w => w.world); }

// Shipping in a world war: every nation trades less, belligerents most (economy.js).
function worldWarTradeDrag(game, c) {
  if (!game.wars || !worldWarRaging(game)) return 0;
  return worldWarOf(game, c.id) ? 0.08 : 0.04;
}

// ------------------------------------------------------------------ war appetite (sim.js AI wars)

// The war dead, as a share of the people, remembered for a generation: a nation that has bled is slow to fight again.
function warWeariness(c) { return clamp((c.bled || 0) * 40, 0, 0.7); }

// Called from endWar: every belligerent counts its dead.
function countTheDead(game, war) {
  for (const id of war.a.concat(war.b)) {
    const c = game.countries[id];
    if (c && c.alive) c.bled = (c.bled || 0) + ((war.dead && war.dead[id]) || 0) / Math.max(1, c.pop);
  }
}

// How a grudge and the hope of allies change an AI's wish to attack a neighbor.
function warAppetite(game, c, targetId) {
  const W = c.wound, rev = c.revanchism || 0;
  const grudge = W && rev > 0.12 && W.by.includes(targetId) ? 1 : 0;
  const lostTo = game.world.provinces.some(p => p.core === c.id && p.owner === targetId) ? 1 : 0;
  const revenge = Math.max(grudge, lostTo) * rev;
  // Revisionist partners are expected to join in.
  const bloc = militaryBloc(game, c.id);
  const partners = bloc && bloc.revisionist ? bloc.members.filter(m => m !== c.id && game.countries[m].alive && !atWarWith(game, m, targetId)).reduce((s, m) => s + strength(game.countries[m]) * 0.5, 0) : 0;
  return {
    revenge,
    need: Math.max(1, 1.4 - revenge * 0.6 - (c.leader.demagogue ? 0.1 : 0)),
    mult: (1 + revenge * 3 + (c.leader.demagogue ? 0.4 : 0)) * (1 - warWeariness(c) * (c.leader.demagogue ? 0.6 : 1)),
    partners,
  };
}

// ------------------------------------------------------------------ joining wars in progress

function sideOf(war, id) { return war.a.includes(id) ? 'a' : war.b.includes(id) ? 'b' : null; }
function sideScore(game, war, side) { return war[side].length ? warScore(game, war, war[side][0]) : 0; }

// Why nation c might enter `war` on `side`, as a monthly chance and a reason.
function entryWish(game, war, c, side) {
  const mine = war[side], theirs = side === 'a' ? war.b : war.a;
  if (!mine.length || !theirs.length) return null;
  // Never against an ally, a pact partner, an overlord or subject, or across a truce.
  const cBloc = militaryBloc(game, c.id);
  for (const t of theirs) {
    if (c.allies.includes(t) || (cBloc && cBloc.members.includes(t)) || c.overlord === t || game.countries[t].overlord === c.id || hasTruce(game, c.id, t)) return null;
  }
  const losing = Math.max(0, -sideScore(game, war, side)), winningThem = Math.max(0, sideScore(game, war, side === 'a' ? 'b' : 'a'));
  const nb = getNeighbors(game, c.id);
  let w = 0, why = '';
  const allied = mine.filter(m => c.allies.includes(m));
  if (allied.length) { w += 0.012 * (1 + losing / 30); why = `to stand by its ally ${game.countries[allied[0]].name}`; }
  if (cBloc && mine.some(m => cBloc.members.includes(m))) {
    // Pacts defend; revisionist pacts attack together; and pact members close ranks against their leader's rival.
    const rival = theirs.find(t => isGreatPower(game, t) && t !== cBloc.leader && relation(game, cBloc.leader, t) < -10);
    if (side === 'b' || cBloc.revisionist) { w += 0.01 * (1 + losing / 40); why = why || `as a member of the ${cBloc.name}`; }
    else if (rival != null) { w += 0.008 * (1 + losing / 40); why = why || `as the ${cBloc.name} closes ranks against ${game.countries[rival].name}`; }
  }
  const ag = GOVS[c.gov].aggression * leaderAggression(c);
  for (const t of theirs) {
    if (!nb.includes(t)) continue;
    const claims = claimsOn(game, c, t), grudge = c.wound && (c.revanchism || 0) > 0.12 && c.wound.by.includes(t);
    if (!claims && !grudge) continue;
    const T = game.countries[t];
    if (strength(c) < strength(T) * (losing ? 1.2 : 0.7)) continue;
    w += 0.009 * (1 + Math.min(3, claims)) * (1 + (c.revanchism || 0) * 3) * clamp(ag * 4, 0.2, 2.5) * (sideScore(game, war, side) > 10 ? 1.5 : losing ? 0.5 : 1);
    why = why || (grudge ? `to settle old scores with ${T.name}` : `to bring its people in ${T.name} home`);
  }
  if (mine.length && GOVS[c.gov].party === 'single' && ['fascist', 'communist'].includes(c.gov) && game.countries[mine[0]].gov === c.gov && theirs.some(t => relation(game, c.id, t) < -40)) {
    w += 0.003 * clamp(ag * 4, 0.5, 2); why = why || `in solidarity with its fellow ${GOVS[c.gov].short.toLowerCase()}s`;
  }
  // The balance of power: great powers step in against a side about to dominate.
  if (isGreatPower(game, c.id) && winningThem > 20) {
    const tot = game.countries.filter(x => x.alive).reduce((s, x) => s + strength(x), 0) || 1;
    const share = sideStrength(game, theirs) / tot;
    if (share > 0.3 && theirs.every(t => relation(game, c.id, t) < 25)) { w += 0.012 * (share / 0.3) * (winningThem / 40); why = why || 'to stop one side from dominating the world'; }
  }
  w *= 1 - warWeariness(c);
  return w > 0 ? { w, why } : null;
}

function tickEscalation(game) {
  const rng = game.rng;
  const alive = game.countries.filter(c => c.alive);
  for (const war of game.wars.slice()) {
    if (war.independence || game.month - war.start < 2 || !war.a.length || !war.b.length) continue;
    // The player is asked when an ally is losing.
    const P = game.player >= 0 ? game.countries[game.player] : null;
    if (P && P.alive && !sideOf(war, P.id) && !isAtWar(game, P.id) && rng.chance(0.04)) {
      for (const side of ['a', 'b']) {
        const ally = war[side].find(m => P.allies.includes(m));
        if (ally != null && sideScore(game, war, side) < -20 && entryWish(game, war, P, side) && !game.pending.some(p => p.type === 'allyCall' && p.warId === war.id)) {
          game.pending.push({ type: 'allyCall', warId: war.id, ally, enemy: (side === 'a' ? war.b : war.a)[0], late: true });
          break;
        }
      }
    }
    for (const c of rng.shuffle(alive)) {
      if (c.id === game.player || sideOf(war, c.id) || c.overlord != null || isAtWar(game, c.id) || c.stability < 30 || c.monthsInRegime < 3) continue;
      let best = null;
      for (const side of ['a', 'b']) { const e = entryWish(game, war, c, side); if (e && (!best || e.w > best.w)) best = Object.assign(e, { side }); }
      if (!best || !rng.chance(Math.min(0.15, best.w))) continue;
      joinWar(game, war, c.id, best.side);
      logNews(game, `${c.name} enters the ${war.name} ${best.why}.`, 'war', [c.id, ...war[best.side]]);
      if (war.a.concat(war.b).includes(game.player) && c.id !== game.player) toastPlayer(game, `${c.name} enters the ${war.name} on the side of ${game.countries[war[best.side][0]].name}.`, war[best.side].includes(game.player) ? 'good' : 'bad');
      break; // one new belligerent per war each month
    }
  }
}

// ------------------------------------------------------------------ world wars

function tickWorldWars(game) {
  game.worldWars = game.worldWars || [];
  const alive = game.countries.filter(c => c.alive);
  const gdpAll = alive.reduce((s, c) => s + c.gdp, 0) || 1;
  for (const war of game.wars) {
    const ids = war.a.concat(war.b);
    if (!war.world) {
      // A world war: great powers on both sides, and three of them in all (or a war of half the world).
      // It has to be a real contest, not a crushing: the weaker side holds a third of the other's strength, for months.
      if (ids.length < 5 || game.month - war.start < 4) continue;
      const gpA = war.a.filter(id => isGreatPower(game, id)).length, gpB = war.b.filter(id => isGreatPower(game, id)).length;
      const share = ids.reduce((s, id) => s + game.countries[id].gdp, 0) / gdpAll;
      const sA = sideStrength(game, war.a), sB = sideStrength(game, war.b);
      const balance = Math.min(sA, sB) / Math.max(sA, sB);
      // One nation against the world is a world war only if it can hold the world off.
      if (gpA && gpB && balance >= (Math.min(war.a.length, war.b.length) >= 2 ? 0.3 : 0.5) && (gpA + gpB >= 3 || (ids.length >= 7 && share >= 0.5))) becomeWorldWar(game, war, gpA + gpB);
      continue;
    }
    // Total war: AI powers mobilize and turn their factories to arms.
    for (const id of ids) {
      const c = game.countries[id];
      if (id !== game.player && !c.mobilized && game.rng.chance(0.08)) { c.mobilized = game.month + 1; adjust(c, { military: 4, workers: -4 }); }
    }
    const rec = game.worldWars.find(r => r.n === war.world);
    if (rec) { rec.a = [...new Set(rec.a.concat(war.a))]; rec.b = [...new Set(rec.b.concat(war.b))]; }
  }
  // Separate peace: a war-weary minor belligerent, or a new revolutionary government, quits.
  for (const war of game.wars.slice()) {
    if (war.a.length + war.b.length < 3) continue;
    for (const id of war.a.concat(war.b)) {
      const c = game.countries[id], side = sideOf(war, id);
      if (!c.alive || id === game.player || war[side][0] === id || !game.wars.includes(war)) continue;
      const score = warScore(game, war, id);
      const newRegime = c.monthsInRegime < Math.min(8, game.month - war.start);
      if ((newRegime && c.warExhaustion > 30 && score < 10) || (c.warExhaustion > 75 && score < -30 && game.rng.chance(perStepChance(0.05)))) separatePeace(game, war, id, newRegime);
    }
  }
}

function becomeWorldWar(game, war, gp) {
  game.worldWarCount = (game.worldWarCount || 0) + 1;
  const n = game.worldWarCount;
  war.world = n;
  war.oldName = war.name;
  war.name = n === 1 ? 'Great War' : `${ORDINALS[n] || n + 'th'} World War`;
  game.worldWars.push({ n, name: war.name, origin: war.oldName, start: war.start, became: game.month, end: null, a: war.a.slice(), b: war.b.slice(), victors: null, losers: null, treaty: null, outcome: null });
  const count = war.a.length + war.b.length;
  logNews(game, `What began as the ${war.oldName} has become the ${war.name}: ${count} nations and ${gp} great powers are at war.`, 'war', war.a.concat(war.b));
  if (game.player >= 0) {
    const inIt = sideOf(war, game.player);
    notify(game, `The ${war.name}`, `The ${war.oldName} has engulfed the world. ${count} nations, among them ${gp} great powers, are now at war: ${war.a.map(id => game.countries[id].name).join(', ')} against ${war.b.map(id => game.countries[id].name).join(', ')}. ${inIt ? 'Every factory and every family will feel it. Our rivals are mobilizing; so should we.' : 'We are not in it yet, but shipping is disrupted everywhere, and our allies may call on us.'}`);
  }
}

function separatePeace(game, war, id, revolutionary) {
  const c = game.countries[id], side = sideOf(war, id), other = side === 'a' ? 'b' : 'a';
  const enemy = war[other][0];
  if (enemy == null) return;
  const held = game.world.provinces.filter(p => p.owner === id && p.occ != null && war[other].includes(p.occ)).length;
  const terms = { provinces: Math.min(2, held) };
  const result = peaceTermsCost(terms) > 0 ? applyPeaceTerms(game, enemy, id, terms) : '';
  war[side] = war[side].filter(x => x !== id);
  c.bled = (c.bled || 0) + ((war.dead && war.dead[id]) || 0) / Math.max(1, c.pop);
  for (const p of game.world.provinces) if ((p.owner === id && p.occ != null && war[other].includes(p.occ)) || (p.occ === id)) p.occ = undefined;
  game.mapDirty = true;
  for (const e of war[other]) { game.truces[truceKey(id, e)] = game.month + 60; setRel(game, id, e, -40); }
  for (const f of war[side]) addRel(game, id, f, -25);
  logNews(game, `${revolutionary ? `The new government of ${c.name}` : c.name} signs a separate peace with ${game.countries[enemy].name} and leaves the ${war.name}${result ? ': ' + result : ''}.`, 'war', [id, enemy]);
  if (war[side].includes(game.player)) toastPlayer(game, `${c.name} abandons us and signs a separate peace.`, 'bad');
}

// The general peace that ends a world war (called from endWar before armies go home).
function peaceConference(game, war) {
  if (war.settled) return;
  war.settled = true;
  const rec = (game.worldWars || []).find(r => r.n === war.world);
  let sa = war.a.length && war.b.length ? warScore(game, war, war.a[0]) : war.a.length ? 100 : -100;
  // A peace the player signed as a side's leader decides the outcome: white peace is an armistice.
  if (war.peaceBy) sa = war.peaceBy.winner == null ? 0 : (war.peaceBy.winner === 'a' ? 1 : -1) * Math.max(20, Math.abs(sa));
  const winSide = sa >= 0 ? 'a' : 'b', loseSide = winSide === 'a' ? 'b' : 'a';
  // Losers include those who capitulated along the way: they come to the conference too.
  const fallen = Object.keys(war.fallen || {}).map(Number).filter(id => war.fallen[id] === loseSide);
  const winners = war[winSide].filter(id => game.countries[id].alive), losers = [...new Set(war[loseSide].concat(fallen))].filter(id => game.countries[id].alive && !(war.settledWith || []).includes(id));
  const score = Math.abs(sa);
  if (rec) { rec.end = game.month; rec.a = [...new Set(rec.a.concat(war.a))]; rec.b = [...new Set(rec.b.concat(war.b))]; }
  if (!winners.length || score < 15) {
    if (rec) { rec.outcome = 'stalemate'; rec.victors = []; rec.losers = []; }
    logNews(game, `The ${war.name} ends in an armistice: exhausted, neither side can claim victory.`, 'war', war.a.concat(war.b));
    return;
  }
  const lead = winners.slice().sort((x, y) => strength(game.countries[y]) - strength(game.countries[x]))[0];
  const L0 = game.countries[lead];
  const treaty = `Treaty of ${capitalName(game, L0)}`;
  const aggressorLost = loseSide === 'a';
  const lines = [];
  for (const id of losers) {
    const L = game.countries[id];
    if (!L.alive) continue;
    const big = isGreatPower(game, id) || war[loseSide][0] === id;
    let taken = 0;
    // Occupied land where the victor's people live (or that was once theirs) changes hands.
    for (const p of game.world.provinces.filter(q => q.owner === id && q.occ != null && winners.includes(q.occ) && q.id !== L.capital)) {
      const v = game.countries[p.occ];
      if (p.core === v.id || (v.claims || []).includes(p.id) || (score > 50 && taken < 2 && game.rng.chance(0.3))) { transferProvince(game, p.id, v.id); taken++; if (!L.alive) break; }
    }
    if (!L.alive) continue;
    // Self-determination: peoples the loser had conquered are set free.
    let freed = 0;
    // New states take the victors' system: the leading victor's, if free, or a republic.
    if (score > 30) for (const g of releasableGroups(game, L).slice(0, 2)) { if (g.provs.length && g.owner) { releaseNation(game, id, g.core, { gov: GOVS[L0.gov].elections === 'free' ? L0.gov : 'democracy' }); freed++; } }
    const terms = { provinces: taken, reparations: big && score > 25, disarm: big && score > 25, regime: false };
    if (terms.reparations) {
      game.reparations = game.reparations || [];
      game.reparations.push({ from: id, to: lead, months: 120, amount: L.gdp * 0.035 / 12 });
    }
    if (terms.disarm) L.treaty = { until: game.month + 180, milCap: 1.5, by: winners.slice(0, 5), since: game.month };
    // A beaten aggressor regime is replaced by the victors' system, and always after a second world war lost.
    const repeat = (L.wound && L.wound.worldDefeats) || 0;
    if (big && aggressorLost && (score > 60 || repeat >= 1) && ['fascist', 'junta', 'communist', 'absMonarchy'].includes(L.gov) && L0.gov !== L.gov) { changeGovernment(game, L, GOVS[L0.gov].elections === 'free' ? L0.gov : 'democracy', 'conquest'); terms.regime = true; }
    recordDefeat(game, id, winners, 'conference', terms, war);
    woundOf(L).worldDefeats = repeat + 1;
    const bits = [], we = [];
    const say = (they, us) => { bits.push(they); we.push(us); };
    if (taken) say(`cedes ${taken} province${taken > 1 ? 's' : ''}`, `cede ${taken} province${taken > 1 ? 's' : ''}`);
    if (freed) say(`frees ${freed} conquered ${freed > 1 ? 'peoples' : 'people'}`, `free ${freed} conquered ${freed > 1 ? 'peoples' : 'people'}`);
    if (terms.reparations) say('pays reparations for ten years', 'pay reparations for ten years');
    if (terms.disarm) say('is disarmed for fifteen years', `may spend no more than ${L.treaty.milCap}% of GDP on the military for fifteen years`);
    if (terms.regime) say(`becomes a ${GOVS[L.gov].name}`, `become a ${GOVS[L.gov].name}`);
    lines.push(`${L.name} ${bits.length ? bits.join(', ') : 'signs'}`);
    if (id === game.player) notify(game, `The ${treaty}`, `The ${war.name} is over, and we have lost it. At the peace conference the victors dictated their terms: we ${we.length ? we.join(', ') : 'sign what is put before us'}. The nation will not forget.`);
  }
  // The victors draw together: an alliance to guard the peace they made.
  for (const x of winners) for (const y of winners) if (x < y) addRel(game, x, y, 20);
  const gps = winners.filter(id => isGreatPower(game, id) || id === lead);
  if (gps.length >= 2 && !gps.every(id => militaryBloc(game, id) && militaryBloc(game, id) === militaryBloc(game, lead))) {
    let b = militaryBloc(game, lead);
    if (!b && !canJoin(game, L0, 'pact')) b = foundBloc(game, lead, 'pact', `Alliance of ${capitalName(game, L0)}`);
    if (b) { b.victors = true; for (const id of gps) if (!b.members.includes(id) && !canJoin(game, game.countries[id], 'pact')) joinBloc(game, b, id); }
  }
  if (rec) { rec.outcome = winSide; rec.victors = winners; rec.losers = losers; rec.treaty = treaty; }
  logNews(game, `The ${war.name} ends with the ${treaty}. ${lines.join('; ')}.`, 'war', war.a.concat(war.b));
  if (winners.includes(game.player)) notify(game, `Victory: the ${treaty}`, `The ${war.name} is over and our side has won. ${lines.join('; ')}. The losers will remember this peace.`);
}

// ------------------------------------------------------------------ revisionist powers

// What draws a partner into an axis: its own grievance, and a shared regime.
function revisionistBonus(game, c, o) {
  return FOUND_BONUS + clamp(o.revanchism || 0, 0, 0.5) + (o.gov === c.gov ? 0.1 : 0);
}

// What draws a partner into an alliance against a rival: its own distrust of that rival.
function rivalBonus(game, o, rival) {
  return 0.2 + clamp(-relation(game, o.id, rival) / 200, 0, 0.25);
}

// Nations nursing a defeat look for partners against the order that defeated them.
function tickRevisionists(game) {
  const rng = game.rng;
  for (const c of game.countries) {
    if (!c.alive || c.id === game.player || c.overlord != null || militaryBloc(game, c.id) || !rng.chance(0.02)) continue;
    const grievance = (c.revanchism || 0) + (c.gov === 'fascist' && (c.claims || []).length ? 0.2 : 0);
    if (grievance < 0.25) continue;
    const enemies = new Set((c.wound ? c.wound.by : []).concat(game.countries.filter(o => o.alive && claimsOn(game, c, o.id)).map(o => o.id)));
    const fits = o => o.alive && o.id !== c.id && o.id !== game.player && o.overlord == null && !atWarWith(game, c.id, o.id) && relation(game, c.id, o.id) > 0 && !enemies.has(o.id)
      && ((o.revanchism || 0) > 0.15 || (o.gov === c.gov && GOVS[o.gov].aggression >= 0.3) || (o.wound && o.wound.by.some(x => enemies.has(x))));
    const pact = (game.blocs || []).find(b => b.revisionist && b.leader !== game.player && b.members.some(m => fits(game.countries[m])) && !b.members.some(m => enemies.has(m) || atWarWith(game, c.id, m)));
    if (pact && memberVote(game, pact, c.id).passed) { joinBloc(game, pact, c.id); continue; }
    const partner = game.countries.find(o => fits(o) && !militaryBloc(game, o.id));
    if (!partner) continue;
    // A shared grievance is the founder's case; the partner still decides.
    const b = proposeBloc(game, c.id, partner.id, 'pact', `${capitalName(game, c)} Axis`, revisionistBonus(game, c, partner));
    if (!b) continue;
    b.revisionist = true;
    logNews(game, `${c.name} and ${partner.name}, both bitter at the present order, sign the ${b.name}.`, 'diplo', [c.id, partner.id]);
  }
}

// Great powers facing a hostile rival of their own weight build alliance systems around themselves.
function tickRivalries(game) {
  const rng = game.rng, gp = greatPowers(game);
  for (const id of gp) {
    const c = game.countries[id];
    if (id === game.player || c.overlord != null) continue;
    const rival = gp.filter(r => r !== id && relation(game, id, r) < -10 && strength(game.countries[r]) > strength(c) * 0.5).sort((a, b) => relation(game, id, a) - relation(game, id, b))[0];
    if (rival == null) continue;
    const R = game.countries[rival];
    let b = militaryBloc(game, id);
    const recruit = () => game.countries.filter(o => o.alive && o.id !== id && o.id !== rival && o.id !== game.player && o.overlord == null && !canJoin(game, o, 'pact') && relation(game, id, o.id) > 20 && relation(game, o.id, rival) < 20 && !atWarWith(game, id, o.id))
      .sort((x, y) => relation(game, id, y.id) - relation(game, id, x.id))[0];
    if (!b) {
      if (!rng.chance(0.15)) continue;
      const f = recruit();
      if (!f) continue;
      b = proposeBloc(game, id, f.id, 'pact', null, rivalBonus(game, f, rival));
      if (!b) continue;
      logNews(game, `${c.name} and ${f.name} sign the ${b.name}, aimed at ${R.name}.`, 'diplo', [id, f.id, rival]);
    } else if (b.leader === id && b.members.length < 7 && rng.chance(0.2)) {
      const f = recruit();
      // Never into an alliance with a nation it is fighting, however much it distrusts the rival.
      if (f && !b.members.some(m => atWarWith(game, f.id, m)) && rng.chance(joinAppeal(game, f, b) + rivalBonus(game, f, rival)) && memberVote(game, b, f.id).passed) joinBloc(game, b, f.id);
    }
  }
}

function tickWorld(game) {
  tickEscalation(game);
  tickWorldWars(game);
  if (game.month % 3 === 0) { tickRevisionists(game); tickRivalries(game); }
}
