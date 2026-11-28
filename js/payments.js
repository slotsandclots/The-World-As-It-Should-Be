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
// Layer 2, pegs and currency crises: a nation on the gold standard holds its
// currency at a parity. It adjusts through gold flowing in and out (the money
// supply follows its reserves, money.js), not through the exchange rate. When
// its reserves run out, speculators attack the parity: owners send their
// capital to safe havens, interest rates are raised to defend it, and the
// government either rides it out or leaves gold and lets the currency fall.
// A floating currency that falls fast has a currency crisis: foreign lenders
// stop lending and capital flees for a while.
//
// Layer 3, banks lend abroad: banks in nations with reserves to spare lend part
// of them abroad, as far as their capital allows. Borrowers pay a market rate
// (a base plus premiums for their debt, war and empty reserves) and borrow less
// when it is high. Foreign loans are paid down over about ten years. A foreign
// default hits the lending banks' capital, so it can bring on a banking crisis
// at home (credit.js).
//
// Still to come: pegs to another currency, lending with conditions.
//
// c.econ.reserves (billions, world money) · c.econ.fx (0.3-1.6) · c.extDebt = { lenderId: billions }
// c.econ.importSqueeze (0-0.6) · c.extDefaulted (month of the last foreign default)
// c.econ.fx is the real exchange rate (what trade responds to: the currency's value times prices at
// home over prices abroad); c.econ.fxNom is the rate in currency. A floating rate moves the
// nominal rate; a gold parity fixes it, so only prices at home can move the real rate.
// c.econ.parity (gold nations, nominal) · c.econ.goldFlow (share of the money supply, last month)
// c.econ.bankAbroad (billions our banks have lent abroad) · c.econ.rateAbroad (the market rate we pay)
// c.econ.attack { since, flight } · c.econ.fxCrisis (months left) · c.econ.fxHist (last 13 rates)

const PAY = {
  RESERVE_MONTHS: 3, LEND_LIMIT: 0.25, BASE_RATE: 0.04, FX_MIN: 0.3, FX_MAX: 1.6, DEFAULT_MEMORY: 60,
  ATTACK_AT: -0.08,     // reserves (share of GDP) at which speculators attack a gold parity
  ATTACK_OVER: -0.03,   // ... and above which the attack is beaten off
  FLIGHT: 0.02,         // share of owners' capital that flees each month in an attack
  DEFEND_PREMIUM: 0.04, // interest-rate premium a defended parity costs (money.js)
  FX_CRISIS_DROP: 0.2,  // a floating currency down this much in a year is in crisis
  FX_CRISIS_MONTHS: 6,
  HOT_MONEY: 3,         // a defended parity draws this many times more foreign capital (the premium)
  BANK_LEND: 0.01,      // share of their surplus reserves banks offer abroad each month
  REPAY: 1 / 120,       // foreign loans are paid down over about ten years
  RATE_CUT: 8,          // borrowing falls by this much per point of rate above the base plus 2%
};
function onGold(c) { return !!(c.laws && c.laws.monetary === 'gold'); }

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

// avgBill is the import bill per step; the target is three months of it.
function reserveTarget(c) { return Math.max(c.econ.avgBill * PAY.RESERVE_MONTHS / TIME.STEP_MONTHS, c.gdp * 0.02); }
function extDebtOf(c) { let d = 0; for (const k in c.extDebt || {}) d += c.extDebt[k]; return d; }
function extAssetsOf(game, c) { let a = 0; for (const o of game.countries) if (o.alive && o.extDebt && o.extDebt[c.id]) a += o.extDebt[c.id]; return a; }
// The market rate a nation pays abroad, and why.
function extRateParts(game, c) {
  const E = c.econ, G = Math.max(0.01, c.gdp);
  return [
    ['Base rate', PAY.BASE_RATE + 0.02],
    ['Debt abroad', extDebtOf(c) / G * 0.2],
    ['At war', game && isAtWar(game, c.id) ? 0.02 : 0],
    ['Reserves short', E.reserves != null && E.reserves < 0 ? Math.min(0.06, -E.reserves / G * 0.3) : 0],
  ];
}
function extRate(c, game) { return extRateParts(game, c).reduce((s, p) => s + p[1], 0); }
// A bank's share of what a nation is owed abroad: its losses and repayments go to the banks, not the owners.
function bankShareOf(game, L) { const a = extAssetsOf(game, L); return a > 0 ? clamp((L.econ.bankAbroad || 0) / a, 0, 1) : 0; }
// How much its banks can lend abroad: none in a crisis, more when well capitalized; state banks lend as directed (less).
function bankHealth(c) {
  const E = c.econ;
  if (!E.credit || E.bankCrisis > 0) return 0;
  const capF = clamp((E.bankCap / Math.max(1, E.credit) - CREDIT.CAP_MIN) / (CREDIT.CAP_TARGET - CREDIT.CAP_MIN), 0, 1);
  const law = c.laws && c.laws.banking;
  return capF * (law === 'unregulated' ? 1.2 : law === 'state' ? 0.5 : 1);
}

function tickPayments(game) {
  // A nation that no longer exists pays no one: its lenders lose what it owed them.
  for (const o of game.countries) if (!o.alive && o.extDebt) o.extDebt = null;
  const alive = game.countries.filter(c => c.alive && c.econ);
  const bill = {};
  // 1. Trade settles in reserves; interest on foreign debt is paid to the lenders.
  for (const c of alive) {
    const E = c.econ;
    bill[c.id] = Math.max(1e-4, importBill(game, c));
    E.avgBill = E.avgBill == null ? bill[c.id] : E.avgBill * (1 - smooth(0.1)) + bill[c.id] * smooth(0.1);
    if (E.reserves == null) E.reserves = c.gdp * 0.03;
    E.res0 = E.reserves;
    E.reserves += E.tradeBalance || 0;
    E.interestOut = 0;
    E.rateAbroad = extRate(c, game);
    const rate = perYear(E.rateAbroad);
    for (const k in c.extDebt || {}) {
      const L = game.countries[k], due = c.extDebt[k] * rate;
      if (!L || !L.alive) { delete c.extDebt[k]; continue; }
      // Paid by the borrowers at home, in reserves to the lenders, as income for the lending owners.
      E.reserves -= due; L.econ.reserves += due; E.interestOut += due;
      payAtHome(c, due); L.econ.investPool += due * 1e6;
    }
    // Loans are paid down over time, out of reserves when there are any; the banks' share goes back to the banks.
    const debt0 = extDebtOf(c);
    if (debt0 > 0 && E.reserves > 0) {
      const pay = Math.min(E.reserves, perStep(debt0 * PAY.REPAY));
      for (const k in c.extDebt) repayTo(game, c, k, pay * c.extDebt[k] / debt0);
      E.reserves -= pay; payAtHome(c, pay);
    }
  }
  // 2. Owners' capital looking abroad is lent to nations short of reserves.
  const need = {}, offer = {}, bankOffer = {};
  let totalNeed = 0, totalOffer = 0;
  for (const c of alive) {
    const E = c.econ;
    const target = reserveTarget(c);
    const room = c.gdp * PAY.LEND_LIMIT - extDebtOf(c);
    // No one lends to a state in a debt crisis, or to one that defaulted abroad in the last five years.
    // Nor to a falling floating currency: lenders wait to see where it settles.
    // A gold parity defended with high interest rates is another matter: the premium draws capital in.
    const trusted = !(c.debt && c.debt.crisis > 0) && !(c.extDefaulted != null && game.month - c.extDefaulted < PAY.DEFAULT_MEMORY) && !(E.fxCrisis > 0);
    need[c.id] = E.reserves < target && room > 0 && trusted ? Math.min(target - E.reserves, room) : 0;
    // Capital goes abroad only from nations with reserves to spare: a nation short of them keeps its savings home.
    offer[c.id] = Math.max(0, (E.capitalOffer || 0) / 1e6) * clamp((E.reserves - target) / Math.max(1e-6, target), 0, 1);
    // Banks lend part of the reserves to spare, as far as their capital allows.
    bankOffer[c.id] = Math.max(0, E.reserves - target) * smooth(PAY.BANK_LEND) * bankHealth(c);
    offer[c.id] += bankOffer[c.id];
    // Borrowers borrow less when the market rate is high.
    need[c.id] *= clamp(1 - (extRate(c, game) - PAY.BASE_RATE - 0.02) * PAY.RATE_CUT, 0.2, 1);
    totalNeed += need[c.id]; totalOffer += offer[c.id];
  }
  // Hot money: while a parity is defended, owners abroad lend more to earn its premium, and the defenders are served first.
  const defending = alive.filter(c => c.econ.attack && need[c.id] > 0);
  if (defending.length) {
    let firstCall = 0; for (const c of defending) firstCall += need[c.id];
    // The premium draws up to HOT_MONEY times the usual capital, but only as much more as the defenders need.
    const extra = Math.min(totalOffer * (PAY.HOT_MONEY - 1), firstCall), k0 = totalOffer > 0 ? (totalOffer + extra) / totalOffer : 1;
    totalOffer = 0;
    for (const c of alive) { offer[c.id] *= k0; bankOffer[c.id] *= k0; totalOffer += offer[c.id]; }
    // Others' needs are scaled down so that the defenders' are met first from what is offered.
    const left = Math.max(0, totalOffer - firstCall), others = totalNeed - firstCall;
    if (others > 0 && left < others) {
      const k = left / others; totalNeed = firstCall;
      for (const c of alive) if (!c.econ.attack) { need[c.id] *= k; totalNeed += need[c.id]; }
    }
  }
  const lentShare = totalOffer > 0 ? Math.min(1, totalNeed / totalOffer) : 0;
  const filled = totalNeed > 0 ? Math.min(1, totalOffer / totalNeed) : 0;
  for (const c of alive) {
    const E = c.econ;
    // Lenders: what was lent leaves, as reserves paid over and a claim on the borrowers.
    // The banks' part is lent out of reserves; the owners' part out of their capital too.
    const out = offer[c.id] * lentShare, bankPart = offer[c.id] > 0 ? out * bankOffer[c.id] / offer[c.id] : 0;
    E.investPool -= (out - bankPart) * 1e6; E.reserves -= out; E.lentOut = out;
    E.bankAbroad = (E.bankAbroad || 0) + bankPart;
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
  // Prices abroad: the world's price level, weighted by the size of each economy.
  let wplN = 0, wplD = 0;
  for (const c of alive) { wplN += (c.econ.pl || 1) * c.gdp; wplD += c.gdp; }
  const wpl = wplD > 0 ? wplN / wplD : 1;
  for (const c of alive) {
    const E = c.econ, target = reserveTarget(c);
    const debt = extDebtOf(c);
    if (debt > 0 && E.reserves > target * 2) {
      const pay = Math.min(debt, (E.reserves - target * 2) * smooth(0.1));
      for (const k in c.extDebt) repayTo(game, c, k, pay * c.extDebt[k] / debt);
      E.reserves -= pay; payAtHome(c, pay);
    }
    // One default at a time: a nation that defaulted in the last five years is not counted as defaulting again.
    if (debt > c.gdp * 1.2 && !(c.extDefaulted != null && game.month - c.extDefaulted < PAY.DEFAULT_MEMORY)) foreignDefault(game, c);
    // Reserves are judged against the size of the economy: trade is small, but reparations and debts are not.
    const r = (E.reserves - target) / Math.max(0.01, c.gdp);
    tickCurrency(game, c, r, wpl);
    // Only a nation in arrears (deep in the red, no one left to lend) has to ration its imports outright.
    const sq = E.reserves < -c.gdp * 0.1 ? clamp((-E.reserves / c.gdp - 0.1) / 0.2, 0, 0.6) : 0;
    E.importSqueeze = (E.importSqueeze || 0) + (sq - (E.importSqueeze || 0)) * smooth(0.3);
    if (E.importSqueeze < 0.005) E.importSqueeze = 0;
    if (sq > 0.2 && !E.payCrisis) { E.payCrisis = game.month; logNews(game, `${c.name} runs out of foreign currency and must cut its imports.`, 'econ', [c.id]); if (isPlayer(game, c)) notify(game, 'A Balance-of-Payments Crisis', 'Our reserves of foreign currency are gone and no one will lend us more. Imports are being cut: expect shortages and rising prices until exports recover or the debts are paid.'); }
    if (sq === 0 && E.payCrisis && E.reserves > target) E.payCrisis = null;
  }
  // Gold leaves with the deficit (and with fleeing capital) and comes in with the surplus (and with capital
  // fleeing to it); the money supply follows it (money.js). Measured once every nation has paid and fled.
  for (const c of alive) if (onGold(c)) measureGoldFlow(c);
}

// The month's gold flow as a share of the money supply.
function measureGoldFlow(c) {
  const E = c.econ, moneyB = Math.max(1e-6, (E.money || 0) / 1e6 / (E.pl || 1));
  E.goldFlow = clamp((E.reserves - (E.res0 || 0)) / moneyB, -0.01, 0.01);
}

// The currency: a gold parity held (and attacked), or a floating rate (and its crises).
function tickCurrency(game, c, r, wpl) {
  const E = c.econ;
  E.flightOut = 0;
  if (onGold(c)) {
    // A nation joining gold fixes its parity at today's rate. The parity holds the currency;
    // the real rate then moves only with prices: deflation at home makes its goods cheaper than imports.
    const rel = (E.pl || 1) / Math.max(1e-6, wpl || 1);
    if (E.parity == null) E.parity = (E.fx || 1) / rel;
    E.fxNom = E.parity;
    E.fx = clamp(E.parity * rel, PAY.FX_MIN, PAY.FX_MAX);
    // Gold leaves with the deficit and comes in with the surplus; the money supply follows it (money.js).
    measureGoldFlow(c); // measured again once all capital flight is done (tickPayments)
    // A crisis from the floating days runs out on gold as well (lenders stay away until it does).
    if (E.fxCrisis > 0) E.fxCrisis = Math.max(0, countdown(E.fxCrisis));
    const res = E.reserves / Math.max(0.01, c.gdp);
    // After a parity has been defended, speculators wait two years, unless the reserves fall to a new low.
    const rested = !(E.defended && game.month - E.defended.month < 24 && E.reserves > E.defended.low);
    if (!E.attack && res < PAY.ATTACK_AT && rested) {
      E.attack = { since: game.month, flight: 0, low: E.reserves };
      logNews(game, `Speculators attack the ${c.name} gold parity; capital flees the country.`, 'econ', [c.id]);
      if (isPlayer(game, c)) notify(game, 'A Run on the Currency', 'Our gold reserves are gone and speculators are betting the parity will break. Owners are sending their capital abroad. Interest rates have been raised to defend the parity, which will deepen the slump. We can ride it out until the reserves recover, or leave the gold standard and let the currency fall (Economy tab).');
    }
    if (E.attack) {
      flee(game, c, smooth(PAY.FLIGHT));
      // Speculators give up once the drain is clearly reversing, or the reserves are rebuilt.
      E.attack.rising = E.reserves > (E.res0 || 0) ? (E.attack.rising || 0) + TIME.STEP_MONTHS : 0;
      E.attack.low = Math.min(E.attack.low, E.reserves);
      if (res > PAY.ATTACK_OVER || E.attack.rising >= 4) {
        logNews(game, `${c.name} defends its gold parity; the speculators retreat.`, 'econ', [c.id]);
        E.defended = { month: game.month, low: E.attack.low };
        E.attack = null;
      } else if (!isPlayer(game, c) && aiLeavesGold(game, c, res)) leaveGold(game, c);
    }
  } else {
    E.parity = null; E.goldFlow = 0; E.attack = null;
    // A floating currency keeps falling while reserves drain: imports grow dearer at home and exporters earn more.
    // Just after leaving gold it falls fast: the devaluation.
    const fxT = clamp(1 + r * 4, PAY.FX_MIN, PAY.FX_MAX);
    const speed = smooth(E.leftGold != null && game.month - E.leftGold < 6 ? 0.25 : 0.04);
    E.fx = (E.fx || 1) + (fxT - (E.fx || 1)) * speed;
    // In currency, a floating rate also falls with inflation at home beyond inflation abroad.
    E.fxNom = E.fx * (wpl || 1) / Math.max(1e-6, E.pl || 1);
    if (E.fxCrisis > 0) { E.fxCrisis = countdown(E.fxCrisis); flee(game, c, smooth(PAY.FLIGHT * 0.5)); }
  }
  // A year of rates, to spot a collapse.
  E.fxHist = E.fxHist || [];
  const yearSteps = Math.round(12 / TIME.STEP_MONTHS);
  E.fxHist.push(E.fx); if (E.fxHist.length > yearSteps + 1) E.fxHist.shift();
  const yearAgo = E.fxHist[0];
  // A devaluation after leaving gold is not a crisis, and a crisis is not called again while the last one is fresh.
  const recent = m => m != null && game.month - m < 36;
  if (!onGold(c) && !(E.fxCrisis > 0) && E.fxHist.length === yearSteps + 1 && E.fx < yearAgo * (1 - PAY.FX_CRISIS_DROP) && !recent(E.leftGold) && !recent(E.fxCrisisAt)) {
    E.fxCrisis = PAY.FX_CRISIS_MONTHS; E.fxCrisisAt = game.month;
    logNews(game, `The ${c.name} currency collapses, down ${Math.round((1 - E.fx / yearAgo) * 100)}% in a year; foreign lenders pull out.`, 'econ', [c.id]);
    if (isPlayer(game, c)) notify(game, 'A Currency Crisis', 'Our currency has lost a fifth of its value in a year. Foreign lenders will not lend to us until it settles, and owners are moving their capital abroad. Imports are dearer; exporters earn more.');
  }
}

// Capital flight: owners move a share of their capital to the nation with the most reserves to spare.
// It leaves as reserves paid over, so nothing is created or lost.
function flee(game, c, share) {
  const E = c.econ;
  let haven = null, best = -Infinity;
  for (const o of game.countries) {
    if (!o.alive || !o.econ || o.id === c.id || o.econ.attack || o.econ.fxCrisis > 0) continue;
    const v = (o.econ.reserves || 0) / Math.max(0.01, o.gdp);
    if (v > best) { best = v; haven = o; }
  }
  const f = Math.max(0, E.investPool) * share / 1e6;
  if (!haven || f <= 0) { if (E.attack) E.attack.flight = 0; return 0; }
  E.investPool -= f * 1e6; E.reserves -= f;
  haven.econ.investPool += f * 1e6; haven.econ.reserves += f;
  if (E.attack) E.attack.flight = f;
  E.flightOut = f;
  return f;
}

// How long an AI government defends gold depends on who it answers to.
function aiLeavesGold(game, c, res) {
  const E = c.econ, months = game.month - E.attack.since;
  if (res < PAY.ATTACK_AT * 4) return true; // nothing left to defend with
  let patience = 9;
  if (c.gov === 'absMonarchy' || c.gov === 'theocracy' || c.gov === 'constMonarchy') patience += 6; // gold is the old order's money
  if (GOVS[c.gov] && GOVS[c.gov].elections === 'free' && (E.unemployment || 0) > 0.06) patience -= 5; // voters out of work
  if (c.gov === 'fascist' || c.gov === 'communist' || c.gov === 'junta') patience -= 4;
  return months >= Math.max(2, patience);
}

// Leaving gold: the parity is abandoned, money is managed, and the currency falls.
function leaveGold(game, c) {
  const E = c.econ;
  const to = GOVS[c.gov] && GOVS[c.gov].elections === 'free' ? 'centralBank' : 'state';
  // enactLaw clears the bill in parliament; a bill on anything but money carries on.
  const bill = c.reform && c.reform.cat !== 'monetary' ? c.reform : null;
  enactLaw(game, c, 'monetary', to);
  c.reform = bill;
  E.leftGold = game.month; E.attack = null; E.parity = null; E.goldFlow = 0;
  logNews(game, `${c.name} leaves the gold standard; its currency falls.`, 'econ', [c.id]);
  return { ok: true, msg: 'We have left the gold standard. The currency will fall over the coming months: imports dearer, exports cheaper abroad, and money is ours to manage.' };
}

// Going (back) on gold needs reserves to back the parity, and markets remember a recent exit.
function goldBlocked(game, c) {
  const E = c.econ;
  if (!E || E.reserves == null) return null;
  if (E.leftGold != null && game.month - E.leftGold < 120) return 'We left the gold standard less than ten years ago; no one would believe a new parity yet.';
  if (E.reserves < reserveTarget(c)) return `Going on gold needs reserves to back the parity: at least $${reserveTarget(c).toFixed(1)}B (we hold $${E.reserves.toFixed(1)}B).`;
  return null;
}

function playerLeaveGold(game) {
  const c = game.countries[game.player];
  if (!onGold(c)) return { ok: false, msg: 'We are not on the gold standard.' };
  return leaveGold(game, c);
}

// Debt service at home comes out of the owners' capital, then the state's fund, then the treasury.
// The treasury's part is charged with next month's budget, so the state borrows it from real lenders (fiscal.js).
function payAtHome(c, amount) {
  const E = c.econ;
  let k = amount * 1e6;
  const a = Math.min(Math.max(0, E.investPool), k); E.investPool -= a; k -= a;
  const b = Math.min(Math.max(0, E.statePool), k); E.statePool -= b; k -= b;
  if (k > 0) E.treasuryAbroad = (E.treasuryAbroad || 0) + k / 1e6 * (E.pl || 1);
}

// Charged before the budget is financed (sim.js). Reparations go through it too: negative for the receiver.
function chargeTreasuryAbroad(c) {
  const E = c.econ;
  if (!E || !E.treasuryAbroad) return 0;
  const t = E.treasuryAbroad; E.treasuryAbroad = 0;
  c.treasury -= t;
  return t;
}

// Debts abroad past paying: the lenders take the loss and remember it.
function foreignDefault(game, c) {
  for (const k in c.extDebt) {
    const L = game.countries[k], loss = c.extDebt[k] * 0.5;
    if (L && L.alive && L.econ) {
      // The lending banks take their share of the loss out of their capital: contagion.
      const bs = bankShareOf(game, L), bankLoss = loss * bs;
      L.econ.bankAbroad = Math.max(0, (L.econ.bankAbroad || 0) - bankLoss);
      if (bankLoss > 0 && L.econ.bankCap != null) {
        L.econ.bankCap -= bankLoss * 1e6;
        if (bankLoss > L.gdp * 0.002) logNews(game, `${c.name}'s default costs the banks of ${L.name} $${bankLoss.toFixed(1)}B.`, 'econ', [c.id, L.id]);
        if (isPlayer(game, L)) notify(game, 'Our Banks Lose Abroad', `${c.name} has defaulted on its foreign debts. Our banks lose $${bankLoss.toFixed(1)}B of what they lent; if their capital runs thin, lending at home will freeze.`);
      }
      addRel(game, c.id, L.id, -20);
    }
    c.extDebt[k] -= loss;
  }
  c.extDefaulted = game.month;
  logNews(game, `${c.name} defaults on its foreign debts; its creditors abroad take heavy losses.`, 'econ', [c.id, ...Object.keys(c.extDebt).map(Number)]);
  if (isPlayer(game, c)) notify(game, 'Default on Foreign Debts', 'We could not pay what we owe abroad. Half of our foreign debt is written off, but lenders and their governments will not forget: no one abroad will lend to us for five years.');
}

// A repayment to one lender: the banks' share back to the banks (as reserves), the rest to the owners.
function repayTo(game, c, k, part) {
  const L = game.countries[k];
  c.extDebt[k] -= part;
  if (!L || !L.econ) return;
  const bs = bankShareOf(game, L), bankPart = part * bs;
  L.econ.bankAbroad = Math.max(0, (L.econ.bankAbroad || 0) - bankPart);
  L.econ.reserves += part; L.econ.investPool += (part - bankPart) * 1e6;
}

// Who we owe and who owes us, for the interface.
function foreignPositions(game, c) {
  const owe = Object.entries(c.extDebt || {}).filter(([, v]) => v > 1e-4).map(([k, v]) => [game.countries[k].name, v]).sort((a, b) => b[1] - a[1]);
  const owed = game.countries.filter(o => o.alive && o.extDebt && o.extDebt[c.id] > 1e-4).map(o => [o.name, o.extDebt[c.id]]).sort((a, b) => b[1] - a[1]);
  return { owe, owed };
}
