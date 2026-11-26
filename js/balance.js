'use strict';
// Checks on runaway conquest, and difficulty.
//
// Infamy: declaring wars, taking land, imposing regimes and extracting
// reparations make a nation infamous. Infamy fades slowly, sours relations
// with everyone, pushes threatened nations together and into arms races, and
// above a threshold triggers coalitions that declare war together.
//
// Occupation: newly conquered provinces produce less, breed unrest and can
// rise up and return to their former owner for several years.

const DIFFICULTY = {
  easy: { name: 'Easy', desc: 'Forgiving: weaker AI, slower infamy, fewer coalitions.', aiProd: -0.05, aiArmy: -0.1, playerInfamy: 0.6, hostility: 0, coalition: 0.6, insurgency: 0 },
  normal: { name: 'Normal', desc: 'The world pushes back against conquerors.', aiProd: 0, aiArmy: 0, playerInfamy: 1, hostility: 0, coalition: 1, insurgency: 1 },
  hard: { name: 'Hard', desc: 'AI economies and armies are stronger and wary of you.', aiProd: 0.08, aiArmy: 0.15, playerInfamy: 1.25, hostility: 8, coalition: 1.3, insurgency: 1.5 },
  brutal: { name: 'Brutal', desc: 'The world fears and resents you. Every gain will be contested.', aiProd: 0.15, aiArmy: 0.3, playerInfamy: 1.5, hostility: 18, coalition: 1.7, insurgency: 2.5 },
};
const DIFFICULTY_ORDER = ['easy', 'normal', 'hard', 'brutal'];

function difficulty(game) { return DIFFICULTY[(game.opts && game.opts.difficulty) || 'normal'] || DIFFICULTY.normal; }

const INFAMY = { war: 5, province: 2.5, peaceProvince: 4, reparations: 3, regime: 10, coalitionAt: 35 };

function addInfamy(game, id, amount, why) {
  const c = game.countries[id];
  if (!c || !c.alive) return;
  const mult = id === game.player ? difficulty(game).playerInfamy : 1;
  const before = c.infamy || 0;
  c.infamy = clamp(before + amount * mult, 0, 150);
  if (id === game.player && before < INFAMY.coalitionAt && c.infamy >= INFAMY.coalitionAt) {
    notify(game, 'The World Grows Alarmed', `Our conquests have made us infamous (${Math.round(c.infamy)}). Neighbors are arming and talking among themselves; above ${INFAMY.coalitionAt} infamy they may form a coalition and attack together. Infamy fades with time at peace.`);
  }
}

// Occupation: share of the population living in recently conquered land, weighted by how recent.
const OCCUPATION_MONTHS = 60;
function occupationFactor(game, p) {
  if (!p.conquered) return 0;
  const age = game.month - p.conquered.month;
  return age >= OCCUPATION_MONTHS ? 0 : 1 - age / OCCUPATION_MONTHS;
}

// Core land: what a nation held at the start, or has integrated over 20 years.
const INTEGRATION_MONTHS = 240;
function nonCore(c) { let n = 0, pop = 0; for (const p of c._provs || []) if (p.core !== c.id) { n++; pop += p.pop; } return { n, share: c.pop > 0 ? pop / c.pop : 0 }; }

function refreshCores(game) {
  for (const c of game.countries) c._provs = [];
  for (const p of game.world.provinces) {
    if (p.core === undefined) p.core = p.owner;
    if (p.core !== p.owner && p.conquered && game.month - p.conquered.month >= INTEGRATION_MONTHS) { p.core = p.owner; p.conquered = null; }
    game.countries[p.owner]._provs.push(p);
  }
  for (const c of game.countries) { const nc = nonCore(c); c.nonCoreCount = nc.n; c.nonCoreShare = nc.share; }
}

function occupiedShare(game, c) {
  let w = 0;
  for (const p of game.world.provinces) if (p.owner === c.id && p.conquered) w += p.pop * occupationFactor(game, p);
  return c.pop > 0 ? w / c.pop : 0;
}

// The most threatening neighbor: much stronger, or infamous.
function threatLevel(game, c) {
  let t = 0;
  const mine = strength(c) + 0.001;
  for (const n of getNeighbors(game, c.id)) {
    const o = game.countries[n];
    if (c.allies.includes(n)) continue;
    const v = strength(o) / mine * (1 + (o.infamy || 0) / 30);
    if (v > t) t = v;
  }
  return t;
}

// Monthly: infamy fades, occupied provinces may revolt, coalitions may form,
// and hostile AIs may stir up trouble in nations they hate.
function tickBalance(game) {
  const rng = game.rng, D = difficulty(game);
  const alive = game.countries.filter(c => c.alive);
  for (const c of alive) {
    if (c.infamy) c.infamy = Math.max(0, c.infamy * (isAtWar(game, c.id) ? 0.999 : 0.994) - 0.02);
    // Revolts in occupied land.
    const occ = occupiedShare(game, c);
    if (occ > 0 && c.unrest > 40 && rng.chance(0.015 + occ * 0.05)) {
      const cands = game.world.provinces.filter(p => p.owner === c.id && p.conquered && occupationFactor(game, p) > 0.2 && game.countries[p.conquered.from].alive && p.id !== c.capital);
      const pr = cands.length ? rng.pick(cands) : null;
      if (pr && getNeighbors(game, pr.conquered.from).includes(c.id)) {
        const back = game.countries[pr.conquered.from];
        transferProvince(game, pr.id, back.id);
        pr.conquered = null;
        logNews(game, `${pr.name} rises against ${c.adj} occupation and returns to ${back.name}.`, 'war', [c.id, back.id]);
        if (c.id === game.player) notify(game, 'Revolt in Occupied Land', `The people of ${pr.name} have risen against our occupation and rejoined ${formalName(back)}. Conquered provinces stay restless for years: keep unrest down, or expect more.`);
        else if (back.id === game.player) toastPlayer(game, `${pr.name} throws off ${c.adj} occupation and rejoins us!`, 'good');
      }
    }
  }
  // Coalitions against infamous nations.
  for (const x of alive) {
    if ((x.infamy || 0) < INFAMY.coalitionAt) continue;
    if (game.wars.some(w => w.coalition && w.b.includes(x.id))) continue;
    const p = 0.015 * D.coalition * (x.infamy - INFAMY.coalitionAt + 5) / 20;
    if (!rng.chance(p)) continue;
    const neighbors = getNeighbors(game, x.id);
    // Neighbors join first; at high infamy, every nation that distrusts the aggressor joins too.
    const wide = x.infamy >= 55;
    const members = alive.filter(o => o.id !== x.id && !o.allies.includes(x.id) && !atWarWith(game, o.id, x.id) && o.id !== game.player
      && relation(game, o.id, x.id) < 10 && (wide || neighbors.includes(o.id) || o.allies.some(a => neighbors.includes(a))));
    if (members.length < 2 || !members.some(o => neighbors.includes(o.id))) continue;
    const total = members.reduce((s, o) => s + strength(o), 0);
    if (total < strength(x) * (wide ? 0.4 : 0.8)) continue;
    members.sort((a, b) => strength(b) - strength(a));
    const lead = members.find(o => neighbors.includes(o.id)) || members[0];
    const war = declareWar(game, lead.id, x.id, { coalition: true });
    for (const o of members) if (o !== lead) joinWar(game, war, o.id, 'a');
    war.name = `War of the ${x.adj} Coalition`;
    logNews(game, `A coalition of ${members.length} nations led by ${lead.name} declares war on ${x.name} to contain its aggression.`, 'war', [x.id, ...members.map(o => o.id)]);
    if (x.id === game.player) notify(game, 'A Coalition Forms Against Us', `Alarmed by our conquests, ${members.map(o => o.name).join(', ')} have declared war on us together. Hold the line, or make peace and let our infamy fade.`, { charId: lead.leader.id });
  }
  // Hostile AIs fund insurgents in nations they hate.
  if (D.insurgency > 0) {
    for (const c of alive) {
      if (c.id === game.player || c.stability < 45 || c.pc < 35) continue;
      const enemies = alive.filter(o => o.id !== c.id && relation(game, c.id, o.id) < -55 && !atWarWith(game, c.id, o.id));
      if (!enemies.length || !rng.chance(0.004 * D.insurgency)) continue;
      const t = rng.pick(enemies);
      c.pc -= 35;
      adjust(t, { stability: -8, unrest: 12 });
      if (t.id === game.player) toastPlayer(game, `Insurgents armed by ${c.name} are stirring up trouble in our provinces.`, 'bad');
    }
  }
}
