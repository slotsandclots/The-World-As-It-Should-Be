'use strict';
// War on the map. Armies fight along the fronts where the two sides' land
// meets. Provinces are occupied, not annexed, until a peace treaty; terrain
// favors the defender; cut-off provinces are hard to hold; posture and
// mobilization are the player's main levers.
//
// p.occ = id of the occupying nation (wartime control) or undefined
// war.posture = { [countryId]: 'offensive' | 'balanced' | 'defensive' }

const POSTURES = {
  offensive: { name: 'Offensive', attack: 1.2, defense: 0.95, tempo: 1.5, losses: 1.4, desc: 'Push hard: more battles, heavier losses.' },
  balanced: { name: 'Balanced', attack: 1, defense: 1, tempo: 1, losses: 1, desc: 'Attack where the odds are good.' },
  defensive: { name: 'Defensive', attack: 0.85, defense: 1.3, tempo: 0.35, losses: 0.7, desc: 'Dig in: hold the line and bleed the attacker.' },
};

function controller(p) { return p.occ != null ? p.occ : p.owner; }

function posture(war, id) { return POSTURES[(war.posture && war.posture[id]) || 'balanced']; }

// Front sectors for one side: enemy-held provinces next to land it holds.
function frontSectors(game, war, side) {
  const provs = game.world.provinces, mine = new Set(side), theirs = new Set(side === war.a ? war.b : war.a);
  const out = [];
  for (const p of provs) {
    if (p.owner < 0 || !theirs.has(controller(p))) continue;
    let adj = 0, land = 0, from = -1;
    for (const q of p.neighbors) {
      const cq = controller(provs[q]);
      if (mine.has(cq)) { adj++; from = cq; if (!(game.world.seaLinks && isSeaLink(game, p.id, q))) land++; }
    }
    if (adj) out.push({ p, adj, land, from, n: p.neighbors.length });
  }
  return out;
}

function isSeaLink(game, a, b) {
  const L = game.world.seaLinks;
  if (!L) return false;
  if (!game._seaSet) { game._seaSet = new Set(); for (const [x, y] of L) { game._seaSet.add(x + ':' + y); game._seaSet.add(y + ':' + x); } }
  return game._seaSet.has(a + ':' + b);
}

function sideMight(game, ids, war) {
  return ids.reduce((s, id) => s + strength(game.countries[id]) * posture(war, id).attack, 0) + 0.001;
}

// One month of fighting along every front of a war. Returns events for news.
function fightFronts(game, war) {
  const rng = game.rng, provs = game.world.provinces;
  for (const [side, other, key] of [[war.a, war.b, 'A'], [war.b, war.a, 'B']]) {
    if (!game.wars.includes(war)) return;
    const sectors = frontSectors(game, war, side);
    if (!sectors.length) continue;
    const defSectors = Math.max(1, frontSectors(game, war, other).length);
    const lead = game.countries[side[0]], P = posture(war, side[0]);
    const mA = sideMight(game, side, war), mD = sideMight(game, other, war);
    // Bigger, stronger sides fight more battles each month.
    const tempo = clamp(sectors.length / 10, 0.3, 1.6) * P.tempo * clamp(mA / mD, 0.5, 1.5);
    let n = Math.floor(tempo) + (rng.chance(tempo % 1) ? 1 : 0);
    for (let k = 0; k < n; k++) {
      // Generals pick soft targets: flat land, already half-surrounded.
      const s = rng.weighted(sectors, x => (x.adj / x.n + 0.2) * (1.4 - (x.p.rough || 0.3)) * (x.land ? 1 : 0.35));
      const p = s.p, defId = controller(p), def = game.countries[defId];
      const supply = 0.55 + 0.45 * s.adj / s.n * (s.land ? 1 : 0.6);
      const home = p.owner === defId && p.core === defId ? 1.15 : 1;
      const terrain = 1 + (p.rough || 0.3) * 0.9;
      const dP = posture(war, defId);
      // Generals who have learned their trade in battle command better (figures.js).
      const cmdA = typeof commandBonus === 'function' ? commandBonus(lead, 'attack') : 0, cmdD = typeof commandBonus === 'function' ? commandBonus(def, 'defense') : 0;
      const atk = mA / sectors.length * supply * P.attack * (1 + cmdA);
      const dfn = mD / defSectors * terrain * home * dP.defense * (1 + techSum(def, 'defense')) * (1 + cmdD);
      const odds = atk / (atk + dfn);
      const win = rng.chance(clamp(odds * 0.9, 0.04, 0.85));
      const lossA = 0.006 * P.losses * (win ? 0.8 : 1.3), lossD = 0.006 * dP.losses * (win ? 1.3 : 0.8);
      // The dead are counted: they are mourned, and remembered (revanchism.js).
      war.dead = war.dead || {};
      for (const id of side) { const x = game.countries[id]; war.dead[id] = (war.dead[id] || 0) + x.army * lossA; x.army *= 1 - lossA; }
      for (const id of other) { const x = game.countries[id]; war.dead[id] = (war.dead[id] || 0) + x.army * lossD; x.army *= 1 - lossD; }
      if (typeof battleFought === 'function') battleFought(game, win ? s.from : defId, win ? defId : s.from, win);
      if (!win) continue;
      const taker = s.from;
      const liberated = side.includes(p.owner);
      if (liberated) p.occ = undefined; else p.occ = taker;
      game.mapDirty = true;
      sectors.splice(sectors.indexOf(s), 1);
      war['gains' + key]++;
      war['ex' + (key === 'A' ? 'B' : 'A')] += 2;
      const loser = game.countries[defId], winner = game.countries[taker];
      adjust(loser, { approval: -1, stability: -0.8 });
      loser.warExhaustion = clamp(loser.warExhaustion + 2, 0, 100);
      winner.warMomentum = 3; loser.warMomentum = -3;
      if (taker === game.player) toastPlayer(game, `Our forces ${liberated ? 'liberate' : 'occupy'} ${p.name}.`, 'good');
      else if (defId === game.player) toastPlayer(game, `${winner.name} ${liberated ? 'retakes' : 'occupies'} ${p.name}!`, 'bad');
      if (!sectors.length) break;
    }
  }
  // Collapse: a nation that has lost most of its land, or its capital, sues for peace.
  for (const id of war.a.concat(war.b)) {
    const c = game.countries[id];
    if (!c.alive || !game.wars.includes(war)) continue;
    const share = occupiedOf(game, c);
    const capLost = provs[c.capital] && provs[c.capital].occ != null;
    if (share >= 0.75 || (capLost && share >= 0.45)) {
      const enemies = war.a.includes(id) ? war.b : war.a;
      const taker = provs[c.capital] && provs[c.capital].occ != null ? provs[c.capital].occ : enemies[0];
      capitulate(game, war, id, taker);
    }
  }
}

// Share of a nation's population under enemy occupation.
function occupiedOf(game, c) {
  let o = 0, t = 0;
  for (const p of game.world.provinces) if (p.owner === c.id) { t += p.pop; if (p.occ != null) o += p.pop; }
  return t ? o / t : 0;
}

// War score from occupation: how much of the enemy we hold vs. they hold of us.
function occupationScore(game, war, id) {
  const mine = war.a.includes(id) ? war.a : war.b, theirs = mine === war.a ? war.b : war.a;
  const held = (owners, by) => {
    let o = 0, t = 0;
    for (const p of game.world.provinces) if (owners.includes(p.owner)) { t += p.pop; if (p.occ != null && by.includes(p.occ)) o += p.pop; }
    return t ? o / t : 0;
  };
  return (held(theirs, mine) - held(mine, theirs)) * 160;
}

// When a war ends, armies go home.
function clearOccupation(game, war) {
  const ids = new Set(war.a.concat(war.b));
  for (const p of game.world.provinces) if (p.occ != null && (ids.has(p.occ) || ids.has(p.owner))) p.occ = undefined;
  game.mapDirty = true;
}

// ------------------------------------------------------------------ mobilization

const MOBILIZE_PC = 10;

function setMobilized(game, c, on) {
  if (!!c.mobilized === on) return { ok: false, msg: on ? 'Already mobilized.' : 'Not mobilized.' };
  if (on) {
    if (c.pc < MOBILIZE_PC) return { ok: false, msg: `Needs ${MOBILIZE_PC} political capital.` };
    c.pc -= MOBILIZE_PC;
    c.mobilized = game.month + 1;
    adjust(c, { military: 6, workers: -5 });
    logNews(game, `${c.name} orders a general mobilization.`, 'war', [c.id]);
    return { ok: true, msg: 'General mobilization: the army swells, but the factories lose their workers.' };
  }
  c.mobilized = false;
  return { ok: true, msg: 'The reserves are sent home.' };
}

function tickMobilization(game, c) {
  const war = isAtWar(game, c.id);
  if (!war && c.mobilized) { c.mobilized = false; if (isPlayer(game, c)) toastPlayer(game, 'With peace, the army demobilizes.', 'info'); }
  if (c.mobilized) c.warExhaustion = clamp(c.warExhaustion + 0.6, 0, 100);
  // AI: mobilize when the war is going badly or the enemy is stronger; pick a posture.
  if (!isPlayer(game, c) && war) {
    for (const w of warsOf(game, c.id)) {
      const mine = w.a.includes(c.id) ? w.a : w.b, theirs = mine === w.a ? w.b : w.a;
      const r = sideStrength(game, mine) / sideStrength(game, theirs);
      w.posture = w.posture || {};
      w.posture[c.id] = r > 1.25 ? 'offensive' : r < 0.8 ? 'defensive' : 'balanced';
      if (!c.mobilized && (r < 1 || warScore(game, w, c.id) < -15) && game.rng.chance(0.15)) { c.mobilized = game.month + 1; adjust(c, { military: 4, workers: -4 }); }
    }
  }
}

function setPosture(game, warId, p) {
  const w = game.wars.find(x => x.id === warId);
  if (!w || !POSTURES[p]) return { ok: false, msg: 'No such war.' };
  w.posture = w.posture || {};
  w.posture[game.player] = p;
  return { ok: true, msg: `${POSTURES[p].name} posture: ${POSTURES[p].desc}` };
}
