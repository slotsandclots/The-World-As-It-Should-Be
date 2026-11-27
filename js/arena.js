'use strict';
// The political arena: crises for every nation (not just the player's),
// province-by-province elections, referendums, and press barons.

// ------------------------------------------------------------------ crises for everyone
// Crisis events are ordinary events. The player gets them as dialogs; AI
// nations face the same conditions and choose an option by weighing it.

const CRISIS_EVENTS = ['termLimit', 'impeachment', 'succession', 'exception', 'petition'];

// How attractive an option is to an AI government.
function aiOptionWeight(game, c, ev, o, i) {
  if (o.cond && !o.cond(game, c, {})) return 0;
  if (o.ai) return Math.max(0, o.ai(game, c));
  const fx = o.fx || {}, base = GOVS[c.gov].base;
  let w = 1 + (fx.legitimacy || 0) * 0.04 + (fx.stability || 0) * 0.05 + (fx.approval || 0) * 0.03 - (fx.unrest || 0) * 0.04;
  for (const f in base) w += (fx[f] || 0) * 0.04 * base[f];
  return Math.max(0.05, w);
}

function resolveEventFor(game, c, ev, optIndex, ctx) {
  const opt = ev.options[optIndex];
  const prev = game._actor;
  game._actor = c.id;
  adjust(c, opt.fx || {});
  const extra = opt.run ? opt.run(game, c, ctx || {}) : '';
  game._actor = prev;
  logNews(game, `${c.name}: ${ev.title.toLowerCase()}. ${opt.label}.${extra && ev.id !== 'petition' ? ' ' + extra : ''}`, 'crisis', [c.id]);
  return extra;
}

function aiCrisis(game, c, ev, ctx) {
  const opts = ev.options.map((o, i) => ({ o, i, w: aiOptionWeight(game, c, ev, o, i) })).filter(x => x.w > 0);
  if (!opts.length) return;
  resolveEventFor(game, c, ev, game.rng.weighted(opts, x => x.w).i, ctx);
}

function tickAICrises(game, c) {
  // Follow-ups scheduled for this nation.
  if (game.scheduled && game.scheduled.length) {
    const due = game.scheduled.filter(e => e.cid === c.id && e.month <= game.month);
    if (due.length) {
      game.scheduled = game.scheduled.filter(e => !due.includes(e));
      for (const d of due) { const ev = eventById(d.id); if (ev && (!ev.cond || ev.cond(game, c, d.ctx))) aiCrisis(game, c, ev, d.ctx); }
    }
  }
  if (!game.rng.chance(0.05)) return;
  const cands = CRISIS_EVENTS.map(eventById).filter(ev => ev && (ev.id !== 'petition' || game.rng.chance(0.2)) && ev.cond(game, c, {}));
  if (cands.length) aiCrisis(game, c, game.rng.weighted(cands, ev => ev.id === 'petition' ? 0.25 : 1), {});
}

// ------------------------------------------------------------------ regional politics

// A province's political leanings, from the classes living there.
function provinceIdeo(game, p) {
  let e = 0, a = 0, w = 0;
  for (const t in p.pops || {}) {
    const N = p.pops[t]; if (!N) continue;
    const T = POP_TYPES[t], sol = p.sol ? p.sol[t] || 40 : 40;
    const misery = Math.max(0, 45 - sol) / 45, ww = N * STRATA_WEIGHT[T.strata];
    e += ww * (T.econ - misery * 0.4); a += ww * (T.auth + misery * 0.3); w += ww;
  }
  return w ? { econ: clamp(e / w, -1, 1), auth: clamp(a / w, -1, 1) } : { econ: 0, auth: 0 };
}

function partyAppeal(p, ideo) { return Math.exp(-((p.econ - ideo.econ) ** 2 + (p.auth - ideo.auth) ** 2) / 0.3) + 0.04; }

// Per-province vote shares. National shares (with campaign swings, noise and
// fraud) are tilted by how each province leans compared with the nation.
function regionalResults(game, c, nationalShares) {
  const provs = game.world.provinces.filter(p => p.owner === c.id && p.pop > 0);
  const natApp = c.parties.map(p => partyAppeal(p, c.ideo));
  const out = [];
  for (const p of provs) {
    const li = provinceIdeo(game, p);
    const old = (c.elderly || 0.06) - 0.08;
    const loc = { econ: c.ideo.econ * 0.45 + li.econ * 0.55 - old * 0.6, auth: c.ideo.auth * 0.45 + li.auth * 0.55 + old * 0.8 };
    const raw = c.parties.map((pt, i) => nationalShares[i] * partyAppeal(pt, loc) / natApp[i] * (1 + game.rng.normal() * 0.08));
    const tot = raw.reduce((s, v) => s + Math.max(0, v), 0) || 1;
    out.push({ prov: p, shares: raw.map(v => Math.max(0, v) / tot) });
  }
  return out;
}

// Seats per province, by population (largest remainder).
function apportion(provs, total) {
  const voters = r => r.prov.pop * (1 - (r.prov.voteExcl || 0));
  const pop = provs.reduce((s, r) => s + voters(r), 0) || 1;
  const q = provs.map(r => voters(r) / pop * total);
  const seats = q.map(Math.floor);
  let left = total - seats.reduce((a, b) => a + b, 0);
  q.map((v, i) => [v - seats[i], i]).sort((a, b) => b[0] - a[0]).slice(0, left).forEach(([, i]) => seats[i]++);
  return seats;
}

// Returns { seats, prov } for a free election.
function electSeats(game, c, shares) {
  const regions = regionalResults(game, c, shares);
  const prov = {};
  for (const r of regions) { let bi = 0; r.shares.forEach((v, i) => { if (v > r.shares[bi]) bi = i; }); prov[r.prov.id] = c.parties[bi].id; }
  ensureLaws(c);
  if (c.laws.electoral !== 'constituencies' || !regions.length) return { seats: allocateSeats(shares, 200, 0.03), prov };
  // Winner takes all in each constituency.
  const per = apportion(regions, 200), seats = c.parties.map(() => 0);
  regions.forEach((r, k) => { const idx = c.parties.findIndex(p => p.id === prov[r.prov.id]); seats[idx] += per[k]; });
  return { seats, prov };
}

// ------------------------------------------------------------------ referendums

const REFERENDUM_PC = 25;

// The share of voters, weighted by class, who prefer the new law.
function publicSupport(game, c, cat, opt) {
  ensureLaws(c);
  const cur = lawOpt(cat, c.laws[cat]).pos, nxt = lawOpt(cat, opt).pos;
  let yes = 0, tot = 0;
  for (const p of game.world.provinces) {
    if (p.owner !== c.id) continue;
    for (const t in p.pops || {}) {
      const N = p.pops[t]; if (!N) continue;
      const T = POP_TYPES[t], lit = c.econ.literacy || 0.3;
      // Each class's view, as the rest of the game sees it: shaped by literacy and by national opinion.
      const e = (T.econ - lit * 0.1) * 0.5 + c.ideo.econ * 0.5, au = (T.auth - lit * 0.35) * 0.5 + c.ideo.auth * 0.5;
      const gain = Math.hypot(e - cur[0], au - cur[1]) - Math.hypot(e - nxt[0], au - nxt[1]);
      yes += N * clamp(0.5 + gain * 0.6, 0, 1); tot += N;
    }
  }
  let s = tot ? yes / tot : 0.5;
  // Voters defend the freedoms they already have.
  const fc = lawOpt(cat, c.laws[cat]).fx, fn = lawOpt(cat, opt).fx;
  s += ((fn.freedom || 0) - (fc.freedom || 0)) * 0.008 + ((fn.legitimacy || 0) - (fc.legitimacy || 0)) * 0.006;
  if (cat === 'suffrage' && opt === 'none') s -= 0.3;
  return clamp(s + (c.approval - 50) / 250 + pressSwing(c, cur, nxt), 0, 1);
}

function canReferendum(c) { ensureLaws(c); return c.laws.suffrage !== 'none' && !c.reform; }

function holdReferendum(game, c, cat, opt, free) {
  if (!canReferendum(c)) return { ok: false, msg: c.reform ? 'A bill is already under way.' : 'Without elections there can be no referendum.' };
  if (!free) { if (c.pc < REFERENDUM_PC) return { ok: false, msg: `Needs ${REFERENDUM_PC} political capital.` }; c.pc -= REFERENDUM_PC; }
  const s = clamp(publicSupport(game, c, cat, opt) + game.rng.normal() * 0.07, 0, 1);
  const name = LAW_CATS[cat].opts[opt].name;
  if (s >= 0.5) {
    enactLaw(game, c, cat, opt);
    adjust(c, { legitimacy: 5 });
    logNews(game, `${c.name} votes yes (${pct0(s)}) in a referendum on ${name.toLowerCase()}.`, 'election', [c.id]);
    return { ok: true, passed: true, msg: `The people approve "${name}" with ${pct0(s)} of the vote.` };
  }
  adjust(c, { legitimacy: -6, approval: -3 });
  logNews(game, `${c.name} rejects ${name.toLowerCase()} in a referendum (${pct0(s)} yes).`, 'election', [c.id]);
  return { ok: true, passed: false, msg: `The referendum fails: only ${pct0(s)} voted yes. A blow to the government.` };
}

// ------------------------------------------------------------------ press barons
// c.barons = [{ ch, paper, reach, slant: {econ, auth}, attitude }]. They exist
// where the press is free or licensed, sway public opinion toward their views,
// back the party closest to them, and make or break a government's approval.

const PAPERS = ['Herald', 'Courier', 'Gazette', 'Tribune', 'Observer', 'Chronicle', 'Sentinel', 'Clarion', 'Daily Post', 'Messenger'];

function makeBaron(game, c) {
  const rng = game.rng;
  const slant = { econ: clamp(rng.normal() * 0.5 + 0.15, -1, 1), auth: clamp(rng.normal() * 0.45, -1, 1) };
  const ch = makeCharacter(game, c, { role: 'baron', ideo: slant, ageRange: [38, 66] });
  const paper = `The ${capitalName(game, c)} ${rng.pick(PAPERS)}`;
  ch.paper = paper;
  return { ch, paper, reach: rng.range(0.15, 0.35), slant, attitude: rng.range(-0.3, 0.4) };
}

function pressStrength(c) { ensureLaws(c); return c.laws.press === 'free' ? 1 : c.laws.press === 'licensed' ? 0.5 : 0; }

function tickPress(game, c) {
  const k = pressStrength(c), rng = game.rng;
  c.barons = c.barons || [];
  if (!k) {
    if (c.barons.length) { logNews(game, `${c.name} nationalizes its newspapers.`, 'gov', [c.id]); c.barons = []; }
    return;
  }
  const lit = c.econ.literacy || 0.3;
  if (c.barons.length < 3 && rng.chance(0.01 + lit * 0.02)) c.barons.push(makeBaron(game, c));
  const gov = rulingPartyObj(c) || GOVS[c.gov];
  for (const b of c.barons) {
    b.reach = clamp(b.reach + (lit * 0.45 - b.reach) * 0.01, 0.05, 0.6);
    // Papers warm to governments that share their views.
    const target = clamp(0.6 - Math.hypot(b.slant.econ - gov.econ, b.slant.auth - gov.auth) * 0.8 + (c.approval - 50) / 200, -1, 1);
    b.attitude += (target - b.attitude) * 0.03;
    c.ideo.econ = clamp(c.ideo.econ + (b.slant.econ - c.ideo.econ) * 0.0015 * b.reach * k, -1, 1);
    c.ideo.auth = clamp(c.ideo.auth + (b.slant.auth - c.ideo.auth) * 0.0015 * b.reach * k, -1, 1);
    // The paper's favorite party gets coverage.
    if (c.parties && c.parties.length > 1) {
      const fav = c.parties.slice().sort((x, y) => Math.hypot(x.econ - b.slant.econ, x.auth - b.slant.auth) - Math.hypot(y.econ - b.slant.econ, y.auth - b.slant.auth))[0];
      fav.boost += 0.005 * b.reach * k;
    }
    if (b.ch.age > 80 || rng.chance(1 / 300)) { const nb = makeBaron(game, c); nb.ch.paper = b.paper; Object.assign(b, nb, { paper: b.paper }); }
  }
}

// Approval from the press, for the breakdown.
function pressApproval(c) {
  const k = pressStrength(c);
  if (!k || !c.barons) return 0;
  return c.barons.reduce((s, b) => s + b.attitude * b.reach * 14 * k, 0);
}

// How the press moves a referendum.
function pressSwing(c, cur, nxt) {
  const k = pressStrength(c);
  if (!k || !c.barons) return 0;
  return c.barons.reduce((s, b) => s + (Math.hypot(b.slant.econ - cur[0], b.slant.auth - cur[1]) - Math.hypot(b.slant.econ - nxt[0], b.slant.auth - nxt[1])) * b.reach * 0.08 * k, 0);
}

const PRESS_ACTIONS = {
  court: { name: 'Court', pc: 10, desc: 'Dinners, access and exclusives: the paper warms to us.' },
  buy: { name: 'Buy out', money: 0.02, desc: 'Friends of the government buy the paper (2% of GDP). Readers notice: reach falls.' },
  censor: { name: 'Censor', pc: 12, desc: 'Needs a licensed press. Halves the paper\'s reach; freedom −4, intelligentsia −6.' },
};

function pressAction(game, i, action) {
  const c = game.countries[game.player], b = (c.barons || [])[i], A = PRESS_ACTIONS[action];
  if (!b || !A) return { ok: false, msg: 'No such paper.' };
  if (A.pc && c.pc < A.pc) return { ok: false, msg: `Needs ${A.pc} political capital.` };
  if (action === 'censor' && c.laws.press !== 'licensed') return { ok: false, msg: 'Censorship needs a licensed press law.' };
  if (A.pc) c.pc -= A.pc;
  if (action === 'court') { b.attitude = clamp(b.attitude + 0.3, -1, 1); return { ok: true, msg: `${b.ch.name}'s ${b.paper} softens its tone.` }; }
  if (action === 'buy') { c.treasury -= A.money * (c.gdpNom || c.gdp); b.attitude = 0.8; b.reach *= 0.85; adjust(c, { freedom: -2 }); return { ok: true, msg: `${b.paper} changes hands. Its new editors are very understanding.` }; }
  b.reach *= 0.5; adjust(c, { freedom: -4, intelligentsia: -6 }); b.attitude = clamp(b.attitude - 0.3, -1, 1);
  return { ok: true, msg: `${b.paper} loses its license for three months.` };
}

function tickArena(game, c) {
  tickPress(game, c);
  if (!isPlayer(game, c)) {
    tickAICrises(game, c);
    // Free governments go to the people when parliament balks.
    if (GOVS[c.gov].elections === 'free' && !c.reform && game.rng.chance(0.03)) {
      const cat = game.rng.pick(LAW_KEYS), opts = Object.keys(LAW_CATS[cat].opts).filter(o => o !== c.laws[cat]);
      const opt = game.rng.pick(opts);
      if (publicSupport(game, c, cat, opt) > 0.55 && lawSupport(game, c, cat, opt) < 0.5) holdReferendum(game, c, cat, opt, true);
    }
  }
}
