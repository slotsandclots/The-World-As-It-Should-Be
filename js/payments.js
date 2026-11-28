'use strict';
// Closed-loop economy, phase 2 (first layer): every import is paid for.
//
// Each nation holds foreign reserves. Exports earn them and imports spend
// them (world trade balances, so reserves only move between nations).
// Reparations are paid out of them. Capital that owners send abroad is not
// lost: it is lent to nations running short of reserves, which owe it to the
// lenders and pay interest out of their reserves. A nation that can neither
// pay nor borrow has to cut its imports: shortages and dearer goods at home,
// fewer sales for the exporters abroad. Long before that, the currency falls,
// which makes imports dearer at home and pays exporters more at home.
//
// Reserves are held in world money. Each currency has an exchange rate
// (c.econ.fx) that falls as reserves drain: imports grow dearer at home and the
// nation buys less abroad, while exporters earn more at home.
//
// Still to come: currency crises and pegs, bank lending at market rates.
//
// c.econ.reserves (billions, world money) · c.econ.fx (0.3-1.6) · c.extDebt = { lenderId: billions }
// c.econ.importSqueeze (0-0.6) · c.extDefaulted (month of the last foreign default)

const PAY = { RESERVE_MONTHS: 3, LEND_LIMIT: 0.6, BASE_RATE: 0.04, FX_MIN: 0.3, FX_MAX: 1.6, DEFAULT_MEMORY: 60 };

// The exchange rate: a currency falls as reserves run short and rises as they pile up.
// A weak currency makes imports dearer, so the nation buys less abroad; a strong one
// buys more. Exporters earn more at home when it is weak (economy.js), so export
// industries grow over time, but no nation's sales are taken from the others directly.
function fxWeights(c) { const f = (c.econ && c.econ.fx) || 1; return [1, f * f]; }

function importBill(game, c) {
  const E = c.econ, W = game.worldMarket;
  let v = 0;
  for (const g of GOOD_KEYS) v += (E.imports[g] || 0) * W.prices[g];
  return v / 1e6;
}

function reserveTarget(c) { return Math.max(c.econ.avgBill * PAY.RESERVE_MONTHS, c.gdp * 0.02); }
function extDebtOf(c) { let d = 0; for (const k in c.extDebt || {}) d += c.extDebt[k]; return d; }
function extAssetsOf(game, c) { let a = 0; for (const o of game.countries) if (o.alive && o.extDebt && o.extDebt[c.id]) a += o.extDebt[c.id]; return a; }
function extRate(c) { return PAY.BASE_RATE + 0.02 + extDebtOf(c) / Math.max(0.01, c.gdp) * 0.1; }

function tickPayments(game) {
  // A nation that no longer exists pays no one: its lenders lose what it owed them.
  for (const o of game.countries) if (!o.alive && o.extDebt) o.extDebt = null;
  const alive = game.countries.filter(c => c.alive && c.econ);
  const bill = {};
  // 1. Trade settles in reserves; interest on foreign debt is paid to the lenders.
  for (const c of alive) {
    const E = c.econ;
    bill[c.id] = Math.max(1e-4, importBill(game, c));
    E.avgBill = E.avgBill == null ? bill[c.id] : E.avgBill * 0.9 + bill[c.id] * 0.1;
    if (E.reserves == null) E.reserves = c.gdp * 0.03;
    E.reserves += E.tradeBalance || 0;
    E.interestOut = 0;
    const rate = extRate(c) / 12;
    for (const k in c.extDebt || {}) {
      const L = game.countries[k], due = c.extDebt[k] * rate;
      if (!L || !L.alive) { delete c.extDebt[k]; continue; }
      // Paid by the borrowers at home, in reserves to the lenders, as income for the lending owners.
      E.reserves -= due; L.econ.reserves += due; E.interestOut += due;
      payAtHome(c, due); L.econ.investPool += due * 1e6;
    }
  }
  // 2. Owners' capital looking abroad is lent to nations short of reserves.
  const need = {}, offer = {};
  let totalNeed = 0, totalOffer = 0;
  for (const c of alive) {
    const E = c.econ;
    const target = reserveTarget(c);
    const room = c.gdp * PAY.LEND_LIMIT - extDebtOf(c);
    // No one lends to a state in a debt crisis, or to one that defaulted abroad in the last five years.
    const trusted = !(c.debt && c.debt.crisis > 0) && !(c.extDefaulted != null && game.month - c.extDefaulted < PAY.DEFAULT_MEMORY);
    need[c.id] = E.reserves < target && room > 0 && trusted ? Math.min(target - E.reserves, room) : 0;
    // Capital goes abroad only from nations with reserves to spare: a nation short of them keeps its savings home.
    offer[c.id] = Math.max(0, (E.capitalOffer || 0) / 1e6) * clamp((E.reserves - target) / Math.max(1e-6, target), 0, 1);
    totalNeed += need[c.id]; totalOffer += offer[c.id];
  }
  const lentShare = totalOffer > 0 ? Math.min(1, totalNeed / totalOffer) : 0;
  const filled = totalNeed > 0 ? Math.min(1, totalOffer / totalNeed) : 0;
  for (const c of alive) {
    const E = c.econ;
    // Lenders: what was lent leaves, as reserves paid over and a claim on the borrowers.
    const out = offer[c.id] * lentShare;
    E.investPool -= out * 1e6; E.reserves -= out; E.lentOut = out;
    E.borrowed = need[c.id] * filled;
    E.reserves += E.borrowed;
    // Foreign capital funds investment at home (the state's fund where there are no private owners).
    if (ownersAllowed(c)) E.investPool += E.borrowed * 1e6; else E.statePool += E.borrowed * 1e6;
  }
  if (totalNeed > 0 && totalOffer > 0) for (const c of alive) {
    if (!need[c.id]) continue;
    c.extDebt = c.extDebt || {};
    for (const L of alive) { const share = offer[L.id] * lentShare / Math.max(1e-9, totalOffer * lentShare); if (share > 0 && L.id !== c.id) c.extDebt[L.id] = (c.extDebt[L.id] || 0) + need[c.id] * filled * share; }
  }
  // 3. Surpluses repay old debts; nations that cannot pay must cut imports.
  for (const c of alive) {
    const E = c.econ, target = reserveTarget(c);
    const debt = extDebtOf(c);
    if (debt > 0 && E.reserves > target * 2) {
      const pay = Math.min(debt, (E.reserves - target * 2) * 0.1);
      for (const k in c.extDebt) { const part = pay * c.extDebt[k] / debt; c.extDebt[k] -= part; const L = game.countries[k]; L.econ.reserves += part; L.econ.investPool += part * 1e6; }
      E.reserves -= pay; payAtHome(c, pay);
    }
    // One default at a time: a nation that defaulted in the last five years is not counted as defaulting again.
    if (debt > c.gdp * 1.2 && !(c.extDefaulted != null && game.month - c.extDefaulted < PAY.DEFAULT_MEMORY)) foreignDefault(game, c);
    // Reserves are judged against the size of the economy: trade is small, but reparations and debts are not.
    const r = (E.reserves - target) / Math.max(0.01, c.gdp);
    // A floating currency keeps falling while reserves drain: imports grow dearer at home and exporters earn more.
    const fxT = clamp(1 + r * 4, PAY.FX_MIN, PAY.FX_MAX);
    E.fx = (E.fx || 1) + (fxT - (E.fx || 1)) * 0.04;
    // Only a nation in arrears (deep in the red, no one left to lend) has to ration its imports outright.
    const sq = E.reserves < -c.gdp * 0.1 ? clamp((-E.reserves / c.gdp - 0.1) / 0.2, 0, 0.6) : 0;
    E.importSqueeze = (E.importSqueeze || 0) + (sq - (E.importSqueeze || 0)) * 0.3;
    if (E.importSqueeze < 0.005) E.importSqueeze = 0;
    if (sq > 0.2 && !E.payCrisis) { E.payCrisis = game.month; logNews(game, `${c.name} runs out of foreign currency and must cut its imports.`, 'econ', [c.id]); if (isPlayer(game, c)) notify(game, 'A Balance-of-Payments Crisis', 'Our reserves of foreign currency are gone and no one will lend us more. Imports are being cut: expect shortages and rising prices until exports recover or the debts are paid.'); }
    if (sq === 0 && E.payCrisis && E.reserves > target) E.payCrisis = null;

  }
}

// Debt service at home comes out of the owners' capital, then the state's fund, then the treasury.
function payAtHome(c, amount) {
  const E = c.econ;
  let k = amount * 1e6;
  const a = Math.min(Math.max(0, E.investPool), k); E.investPool -= a; k -= a;
  const b = Math.min(Math.max(0, E.statePool), k); E.statePool -= b; k -= b;
  if (k > 0) c.treasury -= k / 1e6 * (E.pl || 1);
}

// Debts abroad past paying: the lenders take the loss and remember it.
function foreignDefault(game, c) {
  for (const k in c.extDebt) {
    const L = game.countries[k];
    c.extDebt[k] *= 0.5;
    if (L && L.alive) addRel(game, c.id, L.id, -20);
  }
  c.extDefaulted = game.month;
  logNews(game, `${c.name} defaults on its foreign debts; its creditors abroad take heavy losses.`, 'econ', [c.id, ...Object.keys(c.extDebt).map(Number)]);
  if (isPlayer(game, c)) notify(game, 'Default on Foreign Debts', 'We could not pay what we owe abroad. Half of our foreign debt is written off, but lenders and their governments will not forget: no one abroad will lend to us for five years.');
}

// Who we owe and who owes us, for the interface.
function foreignPositions(game, c) {
  const owe = Object.entries(c.extDebt || {}).filter(([, v]) => v > 1e-4).map(([k, v]) => [game.countries[k].name, v]).sort((a, b) => b[1] - a[1]);
  const owed = game.countries.filter(o => o.alive && o.extDebt && o.extDebt[c.id] > 1e-4).map(o => [o.name, o.extDebt[c.id]]).sort((a, b) => b[1] - a[1]);
  return { owe, owed };
}
