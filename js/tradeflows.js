'use strict';
// Who trades with whom. The economy trades through pooled markets (economy.js):
// each economic bloc clears first, then the world market. This file splits those
// pools into bilateral flows after the fact, for the interface and for systems that
// need to know trade dependence (spheres of influence, later).
//
// Accounting only: it reads the month's trade and changes nothing the economy uses,
// and it draws no random numbers.
//
//  - Bloc trade: each member's bloc imports of a good are split among the bloc's
//    exporters of it, in proportion to their share of the bloc's exports.
//  - World trade: each nation's remaining imports are split among the world's
//    exporters, in proportion to their share of world exports.
//  - Values are at world prices, as the trade balance is (billions a month).
//
// game._flows = { m, map: { "from:to:goodIndex": [quantity, value] } } (this month)
// game._flowAvg = same keys, a 12-month moving average. Both are transient: the
// average is rebuilt from the first month after a game is loaded.

const FLOW_SMOOTH = 1 / 12;

function tickTradeFlows(game) {
  const W = game.worldMarket;
  if (!W || !W.prices) return;
  const alive = game.countries.filter(c => c.alive && c.econ && c.econ.exports);
  const blocs = (game.blocs || []).filter(b => BLOC_TYPES[b.type].economic);
  const cur = {};
  const add = (a, b, gi, q, v) => {
    if (a === b || !(q > 0)) return;
    const k = a + ':' + b + ':' + gi;
    const e = cur[k] || (cur[k] = [0, 0]);
    e[0] += q; e[1] += v;
  };
  GOOD_KEYS.forEach((g, gi) => {
    const wp = W.prices[g] || GOODS[g].base;
    // Bloc partners first: blocs trade internally before the world market.
    for (const b of blocs) {
      const ms = b.members.map(id => game.countries[id]).filter(c => c.alive && c.econ && c.econ.blocEx);
      let X = 0;
      for (const c of ms) X += c.econ.blocEx[g] || 0;
      if (X <= 0) continue;
      for (const cj of ms) {
        const im = cj.econ.blocIm[g] || 0;
        if (im <= 0) continue;
        for (const ci of ms) { const ex = ci.econ.blocEx[g] || 0; if (ex > 0) { const q = im * ex / X; add(ci.id, cj.id, gi, q, q * wp / 1e6); } }
      }
    }
    // The world market: what is left of each nation's trade.
    let X = 0;
    const wex = alive.map(c => { const x = Math.max(0, (c.econ.exports[g] || 0) - ((c.econ.blocEx && c.econ.blocEx[g]) || 0)); X += x; return x; });
    if (X <= 0) return;
    alive.forEach((cj, j) => {
      const im = (cj.econ.imports[g] || 0) - ((cj.econ.blocIm && cj.econ.blocIm[g]) || 0);
      if (im <= 0) return;
      alive.forEach((ci, i) => { if (wex[i] > 0) { const q = im * wex[i] / X; add(ci.id, cj.id, gi, q, q * wp / 1e6); } });
    });
  });
  game._flows = { m: game.month, map: cur };
  // A smoothed 12-month view, so the interface shows trade patterns rather than monthly noise.
  const avg = game._flowAvg;
  if (!avg) { const a = {}; for (const k in cur) a[k] = cur[k].slice(); game._flowAvg = a; return; }
  const fs = smooth(FLOW_SMOOTH);
  for (const k in avg) { avg[k][0] *= 1 - fs; avg[k][1] *= 1 - fs; }
  for (const k in cur) { const e = avg[k] || (avg[k] = [0, 0]); e[0] += cur[k][0] * fs; e[1] += cur[k][1] * fs; }
  for (const k in avg) if (avg[k][1] < 1e-7 && avg[k][0] < 1e-3) delete avg[k];
}

function flowTable(game, smoothed) { return (smoothed === false ? game._flows && game._flows.map : game._flowAvg) || {}; }

// Every flow as { from, to, gi, q, v }, optionally for one good.
function tradeFlowList(game, gi, smoothed) {
  const out = [], T = flowTable(game, smoothed);
  for (const k in T) {
    const [a, b, g] = k.split(':').map(Number);
    if (gi != null && gi >= 0 && g !== gi) continue;
    out.push({ from: a, to: b, gi: g, q: T[k][0], v: T[k][1] });
  }
  return out;
}

// One nation's trade: totals, partners and goods, both ways.
function tradeOf(game, id) {
  const r = { out: 0, in: 0, to: {}, from: {}, goodsOut: {}, goodsIn: {} };
  for (const f of tradeFlowList(game)) {
    if (f.from === id) { r.out += f.v; (r.to[f.to] = r.to[f.to] || { v: 0, goods: {} }).v += f.v; r.to[f.to].goods[f.gi] = (r.to[f.to].goods[f.gi] || 0) + f.v; r.goodsOut[f.gi] = (r.goodsOut[f.gi] || 0) + f.v; }
    if (f.to === id) { r.in += f.v; (r.from[f.from] = r.from[f.from] || { v: 0, goods: {} }).v += f.v; r.from[f.from].goods[f.gi] = (r.from[f.from].goods[f.gi] || 0) + f.v; r.goodsIn[f.gi] = (r.goodsIn[f.gi] || 0) + f.v; }
  }
  return r;
}

// For one good: who we buy from and who we sell to, with shares.
function goodPartners(game, id, gi) {
  const buy = {}, sell = {};
  let bt = 0, st = 0;
  for (const f of tradeFlowList(game, gi)) {
    if (f.to === id) { buy[f.from] = (buy[f.from] || 0) + f.v; bt += f.v; }
    if (f.from === id) { sell[f.to] = (sell[f.to] || 0) + f.v; st += f.v; }
  }
  const rank = (o, t) => Object.entries(o).map(([k, v]) => [+k, v, t > 0 ? v / t : 0]).sort((a, b) => b[1] - a[1]);
  return { buy: rank(buy, bt), sell: rank(sell, st), buyTotal: bt, sellTotal: st };
}

// Pairs of nations with the value flowing each way, for the map.
function tradePairs(game, gi) {
  const P = {};
  for (const f of tradeFlowList(game, gi)) {
    const a = Math.min(f.from, f.to), b = Math.max(f.from, f.to), k = a + ':' + b;
    const p = P[k] || (P[k] = { a, b, ab: 0, ba: 0, goodsAB: {}, goodsBA: {} });
    if (f.from === a) { p.ab += f.v; p.goodsAB[f.gi] = (p.goodsAB[f.gi] || 0) + f.v; } else { p.ba += f.v; p.goodsBA[f.gi] = (p.goodsBA[f.gi] || 0) + f.v; }
  }
  return Object.values(P).map(p => Object.assign(p, { v: p.ab + p.ba })).sort((x, y) => y.v - x.v);
}
