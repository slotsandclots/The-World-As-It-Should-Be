'use strict';
// Milestone 3a: peoples. Every province has a mix of cultures and faiths.
// Each nation has a founding culture and a majority faith. Minorities live
// along borders and in scattered communities, and migration moves people
// (and their culture) toward jobs and safety, building diasporas over time.
//
// Laws decide how minorities live. Citizenship laws decide whether they may
// work for the state and vote; the church law decides how religious
// minorities fare. Exclusion keeps them out of clerk and official jobs (lower
// output) and out of the electorate; it breeds grievance, which feeds unrest
// and separatism. Assimilation and conversion slowly change the mix.
//
// Nationalism: a nation whose people live under foreign rule claims those
// provinces. Claims sour relations and make AI governments far readier to
// go to war to "bring our people home".
//
// game.cultures = [{ id, name, color, homeland }] · game.faiths = [{ id, name, color }]
// p.cult = { cultureId: share } · p.rel = { faithId: share } · c.culture · c.faith

const FAITH_NAMES = ['the Old Covenant', 'the Reformed Covenant', 'Solarism', 'the Way of the Ancestors', 'Lumenism', 'the Brethren of the Book', 'the Concord', 'Starwardism'];
const FAITH_COLORS = [[196, 160, 82], [120, 150, 205], [222, 120, 70], [120, 170, 110], [210, 200, 150], [150, 110, 170], [90, 170, 175], [200, 110, 130]];

function ensurePeoples(game) {
  if (game.cultures) return;
  const rng = makeRng(String(game.seed) + ':peoples');
  const provs = game.world.provinces;
  game.cultures = game.countries.map(c => ({ id: c.id, name: adjectiveOf(c.name), color: c.rgb.map(v => Math.round(v * 0.85 + 30)), homeland: c.id }));
  // A few faiths, spread across the world in regional blocks.
  const alive = game.countries.filter(c => c.alive);
  const nF = clamp(Math.round(alive.length / 4), 2, FAITH_NAMES.length);
  const names = FAITH_NAMES.slice().sort(() => rng() - 0.5).slice(0, nF);
  game.faiths = names.map((name, i) => ({ id: i, name, color: FAITH_COLORS[FAITH_NAMES.indexOf(name) % FAITH_COLORS.length] }));
  const seeds = alive.slice().sort(() => rng() - 0.5).slice(0, nF);
  const capOf = c => provs[c.capital] || provs.find(p => p.owner === c.id);
  for (const c of game.countries) {
    c.culture = c.id;
    const cp = capOf(c);
    let best = 0, bd = Infinity;
    seeds.forEach((s, i) => { const sp = capOf(s); if (!sp || !cp) return; const d = (sp.lx - cp.lx) ** 2 + (sp.ly - cp.ly) ** 2; if (d < bd) { bd = d; best = i; } });
    c.faith = rng.chance(0.85) ? best : rng.int(0, nF - 1);
  }
  for (const p of provs) {
    if (p.owner < 0) continue;
    const owner = game.countries[p.owner];
    const cult = { [owner.culture]: 1 }, rel = { [owner.faith]: 1 };
    // Border regions are mixed.
    for (const q of p.neighbors) {
      const o = provs[q].owner;
      if (o >= 0 && o !== p.owner && rng.chance(0.55)) {
        const k = rng.range(0.06, 0.3), oc = game.countries[o];
        cult[oc.culture] = (cult[oc.culture] || 0) + k; cult[owner.culture] -= k;
        if (oc.faith !== owner.faith && rng.chance(0.6)) { rel[oc.faith] = (rel[oc.faith] || 0) + k * 0.8; rel[owner.faith] -= k * 0.8; }
      }
    }
    // Scattered communities from farther away.
    if (rng.chance(0.08)) { const o = rng.pick(game.countries); const k = rng.range(0.05, 0.15); cult[o.culture] = (cult[o.culture] || 0) + k; cult[owner.culture] -= k; }
    if (rng.chance(0.1)) { const f = rng.int(0, nF - 1); const k = rng.range(0.05, 0.2); rel[f] = (rel[f] || 0) + k; rel[owner.faith] -= k; }
    p.cult = normShares(cult); p.rel = normShares(rel);
  }
}

function normShares(o) {
  let t = 0;
  for (const k in o) { o[k] = Math.max(0, o[k]); t += o[k]; }
  const out = {};
  for (const k in o) if (o[k] / t > 0.004) out[k] = o[k] / t;
  return out;
}

function topShare(o) { let bk = null, bv = -1; for (const k in o || {}) if (o[k] > bv) { bv = o[k]; bk = k; } return [bk == null ? null : +bk, bv]; }

const CITIZENSHIP = {
  equal: { exclude: 0, voteExclude: 0, grievance: 0.15, assimilate: 0.0006 },
  restricted: { exclude: 0.7, voteExclude: 1, grievance: 0.55, assimilate: 0.0003 },
  persecution: { exclude: 0.95, voteExclude: 1, grievance: 1, assimilate: 0.003 },
};
const CHURCH_MINORITY = { secular: { grievance: 0.08, convert: 0.0003 }, tolerant: { grievance: 0.18, convert: 0.0004 }, state: { grievance: 0.55, convert: 0.0018 } };

// Monthly: assimilation, grievance, migration.
function tickPeoples(game) {
  ensurePeoples(game);
  const provs = game.world.provinces;
  for (const c of game.countries) { c._minority = 0; c._grievance = 0; c._migIn = c._migIn || 0; c._migOut = c._migOut || 0; }
  for (const p of provs) {
    if (p.owner < 0 || !p.cult) continue;
    const c = game.countries[p.owner];
    ensureLaws(c);
    const L = CITIZENSHIP[c.laws.citizenship] || CITIZENSHIP.equal, R = CHURCH_MINORITY[c.laws.church] || CHURCH_MINORITY.tolerant;
    const mine = c.culture, myFaith = c.faith;
    const m = 1 - (p.cult[mine] || 0), f = 1 - (p.rel[myFaith] || 0);
    // Assimilation and conversion: faster with schooling and in cities.
    const lit = p.lit || 0.3;
    const a = L.assimilate * (0.5 + lit), cv = R.convert * (0.6 + lit * 0.5);
    if (m > 0.002) { for (const k in p.cult) if (+k !== mine) { const d = p.cult[k] * a; p.cult[k] -= d; p.cult[mine] = (p.cult[mine] || 0) + d; } }
    if (f > 0.002) { for (const k in p.rel) if (+k !== myFaith) { const d = p.rel[k] * cv; p.rel[k] -= d; p.rel[myFaith] = (p.rel[myFaith] || 0) + d; } }
    // Grievance: exclusion and a state faith not their own, worse when poor.
    const poor = clamp((40 - provinceSol(p)) / 30, 0, 1);
    p.grievance = (m * L.grievance + f * R.grievance) * (0.6 + poor * 0.8);
    p.excl = m * L.exclude;
    p.voteExcl = m * L.voteExclude;
    c._minority += m * p.pop; c._grievance += p.grievance * p.pop;
  }
  for (const c of game.countries) if (c.pop > 0) { c._minority /= c.pop; c._grievance /= c.pop; }
  if (game.month % 3 === 0) migrate(game);
  if (game.month % 12 === 0) for (const c of game.countries) { if (c.alive) c.claims = nationalClaims(game, c); c.migYear = { in: c._migIn || 0, out: c._migOut || 0 }; c._migIn = 0; c._migOut = 0; }
}

// People move toward work and safety every quarter, taking their culture with them.
function migrate(game) {
  const provs = game.world.provinces, MOVERS = ['peasants', 'laborers', 'workers'];
  const move = (from, to, t, n) => {
    if (n <= 1 || !from.pops[t]) return;
    n = Math.min(n, from.pops[t] * 0.05);
    from.pops[t] -= n; to.pops[t] = (to.pops[t] || 0) + n;
    from.pop -= n; to.pop += n;
    // Their culture and faith come with them.
    const w = n / Math.max(1, to.pop);
    for (const k in from.cult) to.cult[k] = (to.cult[k] || 0) + from.cult[k] * w;
    for (const k in from.rel) to.rel[k] = (to.rel[k] || 0) + from.rel[k] * w;
    to.cult = normShares(to.cult); to.rel = normShares(to.rel);
    if (from.owner !== to.owner) { game.countries[from.owner]._migOut += n; game.countries[to.owner]._migIn += n; }
  };
  const byOwner = {};
  for (const p of provs) if (p.owner >= 0 && p.pops) (byOwner[p.owner] = byOwner[p.owner] || []).push(p);
  for (const id in byOwner) {
    const list = byOwner[id], c = game.countries[id];
    if (list.length < 2) continue;
    const solOf = p => provinceSol(p) - (p.occ != null ? 25 : 0);
    const ranked = list.slice().sort((a, b) => solOf(b) - solOf(a));
    const best = ranked.slice(0, Math.max(1, Math.ceil(ranked.length / 5)));
    const avg = ranked.reduce((s, p) => s + solOf(p), 0) / ranked.length;
    // Internal migration toward the best provinces with jobs.
    for (const p of ranked.slice(-Math.ceil(ranked.length / 3))) {
      const gap = avg - solOf(p);
      if (gap < 4) continue;
      const to = best[game.rng.int(0, best.length - 1)];
      for (const t of MOVERS) if (!to.jobs || (to.jobs[t] || 0) > (to.pops[t] || 0) * 0.9 || t === 'peasants') move(p, to, t, (p.pops[t] || 0) * 0.006 * Math.min(1, gap / 20) * (p.occ != null ? 3 : 1));
    }
  }
  // Emigration abroad: from misery or war, to richer neighbors that let people in.
  for (const p of provs) {
    if (p.owner < 0 || !p.pops) continue;
    const c = game.countries[p.owner];
    const sol = provinceSol(p), danger = p.occ != null ? 30 : 0;
    if (sol > 70 && !danger) continue;
    let best = null, bv = 0;
    for (const q of p.neighbors) {
      const d = provs[q];
      if (d.owner < 0 || d.owner === p.owner || !d.pops) continue;
      const dc = game.countries[d.owner];
      ensureLaws(dc);
      const open = dc.laws.migration === 'open' ? 1 : dc.laws.migration === 'limited' ? 0.4 : 0;
      if (!open || atWarWith(game, c.id, dc.id)) continue;
      const v = (provinceSol(d) - sol + danger) * open;
      if (v > bv) { bv = v; best = d; }
    }
    if (best && bv > 6) for (const t of MOVERS) move(p, best, t, (p.pops[t] || 0) * 0.006 * Math.min(1.5, bv / 25));
  }
}

// Provinces abroad where our people are a large share: claims for nationalists.
function nationalClaims(game, c) {
  const out = [];
  for (const p of game.world.provinces) {
    if (p.owner < 0 || p.owner === c.id || !p.cult) continue;
    // Kin count at half weight (ideas.js).
    let ours = p.cult[c.culture] || 0;
    if (typeof kinCultures === 'function') for (const k in p.cult) if (kinCultures(game, c.culture, +k)) ours += p.cult[k] * 0.3;
    // Kin alone don't make a claim: some of our own people must live there.
    if ((ours > 0.45 && (p.cult[c.culture] || 0) > 0.15) || p.core === c.id) out.push(p.id);
  }
  return out;
}

function claimsOn(game, c, targetId) { return (c.claims || []).filter(pid => game.world.provinces[pid].owner === targetId).length; }

function cultureName(game, id) { const k = game.cultures && game.cultures[id]; return k ? k.name : '?'; }
function faithName(game, id) { const f = game.faiths && game.faiths[id]; return f ? f.name : '?'; }

// National composition, for the interface.
function nationComposition(game, c, key) {
  const t = {};
  let pop = 0;
  for (const p of game.world.provinces) if (p.owner === c.id && p[key]) { for (const k in p[key]) t[k] = (t[k] || 0) + p[key][k] * p.pop; pop += p.pop; }
  return Object.entries(t).map(([k, v]) => [+k, v / Math.max(1, pop)]).sort((a, b) => b[1] - a[1]);
}
