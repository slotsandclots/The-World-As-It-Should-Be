'use strict';
// Closed-loop economy, phase 1: the state's budget and debt.
//
// The state pays from cash. A deficit is funded by someone: domestic savers
// (the owners' investment pool, so borrowing crowds out private investment
// when it would have been used), banks (which create deposits, so it is
// partly inflationary), foreign lenders (other nations' investment pools),
// or the printing press (money.js). Interest goes to whoever holds the debt.
// If lenders won't lend enough, the bills go unpaid: arrears to state
// workers and suppliers, and next month the state can only spend what it
// can fund. That is a sovereign debt crisis: forced austerity, printing,
// or default, which hits the holders: savers' wealth, bank capital (which
// can start a banking crisis), and foreign lenders (who resent it).
//
// c.debt { savers, banks, arrears, foreign: { id: $B }, yield, trust, payFrac,
//          crisis (months), defaulted (months since), last: { savers, banks, foreign, printed, shortfall, repaid } }
// All holdings are in the national currency, $B. Their sum is the state's debt, -treasury.

const FISCAL = {
  SAVERS_TAKE: 0.25, // share of the idle investment pool savers will put into bonds each month
  BANK_LIMIT: 0.35, // banks hold bonds up to this share of the money stock (deposits)
  BANK_STATE_LIMIT: 0.7, // state banks lend to the state more freely
  FOREIGN_TAKE: 0.03, // share of a foreign nation's investment pool on offer each month
  BANK_MONEY: 1, // bank-bought debt becomes new deposits one for one (money)
  HAIRCUT: 0.5,
};

function debtTotal(D) {
  let s = D.savers + D.banks + D.arrears;
  for (const k in D.foreign) s += D.foreign[k];
  return s;
}

function ensureDebt(c) {
  if (c.debt && c.debt.foreign) return c.debt;
  const owed = Math.max(0, -c.treasury);
  const own = typeof ownersAllowed === 'function' && c.econ ? ownersAllowed(c) : true;
  c.debt = { savers: own ? owed * 0.65 : 0, banks: own ? owed * 0.35 : owed, arrears: 0, foreign: {}, yield: 0.045, trust: 1, payFrac: 1, crisis: 0, defaulted: 0, last: {} };
  return c.debt;
}

// How far lenders trust the state: debt, a record of default, war and inflation.
function debtTrust(game, c) {
  const D = ensureDebt(c);
  const debtR = Math.max(0, -c.treasury) / Math.max(1e-6, c.gdpNom || c.gdp);
  const infl = typeof inflationYoY === 'function' && c.econ && c.econ.pl != null ? Math.max(0, inflationYoY(c)) : 0;
  const parts = [
    ['Base', 1.2],
    ['Debt', -debtR * 0.55],
    ['A recent default', D.defaulted > 0 ? -0.5 * Math.min(1, D.defaulted / 60) : 0],
    ['At war', isAtWar(game, c.id) ? -0.2 : 0],
    ['Inflation', -Math.min(0.5, infl * 1.5)],
    ['Unpaid bills', D.arrears > 0 ? -0.08 : 0],
  ];
  return { value: clamp(parts.reduce((s, p) => s + p[1], 0), 0.05, 1.2), parts };
}

// The yield the state pays: the policy rate plus a premium that rises as trust falls.
function debtYield(c, trust) {
  const base = c.econ && c.econ.rate != null ? c.econ.rate : 0.045;
  return clamp(base + 0.005 + 0.03 * (1.2 / Math.max(0.05, trust) - 1), 0.005, 0.3);
}

// Monthly interest, paid to the holders (arrears earn nothing).
function debtInterest(c) {
  const D = ensureDebt(c);
  return perYear((debtTotal(D) - D.arrears) * D.yield);
}

function econOf(c) { return c.econ || {}; }
const toEcon = (c, x) => x * 1e6 / ((c.econ && c.econ.pl) || 1); // $B → output units
const toMoney = (c, x) => x * ((c.econ && c.econ.pl) || 1) / 1e6;

// Who is willing to lend this month, in $B.
function lendingOffers(game, c) {
  const D = ensureDebt(c), E = econOf(c), T = D.trust;
  const own = ownersAllowed(c);
  const law = c.laws && c.laws.banking;
  // Savers: in a slump the idle pool flees to safe bonds; in a boom firms bid for it.
  const safety = clamp(1.6 - (E.conf == null ? 1 : E.conf), 0.4, 1.4);
  const yieldF = clamp(0.7 + (D.yield - (E.rate || 0.04)) * 15, 0.5, 1.6);
  const savers = own ? toMoney(c, Math.max(0, E.investPool || 0)) * smooth(FISCAL.SAVERS_TAKE) * Math.min(1, T) * safety * yieldF : 0;
  // Banks: up to a share of their deposits (the money stock), less in a banking crisis.
  const lim = law === 'state' ? FISCAL.BANK_STATE_LIMIT : FISCAL.BANK_LIMIT;
  const deposits = E.money != null ? E.money / 1e6 : toMoney(c, (E.gdpRealM || E.gdpM || 0) * 8);
  const banks = Math.max(0, deposits * lim - D.banks) * smooth(0.2) * (law === 'state' ? 1 : Math.min(1, T)) * (E.bankCrisis > 0 ? 0.3 : 1);
  // Foreign lenders: other nations at peace with us, by how they regard us.
  const foreign = [];
  if (T > 0.3) for (const l of game.countries) {
    if (!l.alive || l.id === c.id || !l.econ || atWarWith(game, c.id, l.id)) continue;
    const rel = relation(game, c.id, l.id);
    if (rel < -20) continue;
    const pool = ownersAllowed(l) ? l.econ.investPool : l.econ.statePool;
    // Real value moves across the border: the lender's output units, in our currency.
    const offer = Math.max(0, pool || 0) * smooth(FISCAL.FOREIGN_TAKE) * (T - 0.3) * clamp(0.6 + rel / 100, 0.2, 1.3) * ((c.econ && c.econ.pl) || 1) / 1e6;
    if (offer > 1e-7) foreign.push([l.id, offer]);
  }
  return { savers, banks, foreign, total: savers + banks + foreign.reduce((s, f) => s + f[1], 0) };
}

// State debt held abroad is paid for in foreign currency: $B of the borrower's money moves reserves
// (payments.js, world money) from payer to receiver, as reparations and foreign loans do.
function bondReserves(game, c, payerId, receiverId, amt) {
  const P = game.countries[payerId], R = game.countries[receiverId];
  if (!P || !R || !P.econ || !R.econ || P.econ.reserves == null || R.econ.reserves == null) return;
  const b = amt / ((c.econ && c.econ.pl) || 1);
  P.econ.reserves -= b; R.econ.reserves += b;
}

// Move $B of claims; positive = new lending to the state, negative = repayment.
function borrowFrom(game, c, kind, amt, lenderId) {
  const D = c.debt, E = econOf(c);
  if (kind === 'savers') { D.savers += amt; E.investPool = Math.max(0, (E.investPool || 0) - toEcon(c, amt)); }
  else if (kind === 'banks') { D.banks += amt; if (amt > 0 && E.money != null) E.money += amt * 1e6 * FISCAL.BANK_MONEY; }
  else if (kind === 'foreign') {
    const l = game.countries[lenderId];
    D.foreign[lenderId] = (D.foreign[lenderId] || 0) + amt;
    if (D.foreign[lenderId] < 1e-9) delete D.foreign[lenderId];
    if (l && l.econ) {
      const units = amt * 1e6 / ((c.econ && c.econ.pl) || 1);
      // The lender pays in reserves when it lends; we pay back in reserves.
      bondReserves(game, c, l.id, c.id, amt);
      if (ownersAllowed(l)) l.econ.investPool = Math.max(0, (l.econ.investPool || 0) - units);
      else l.econ.statePool = Math.max(0, (l.econ.statePool || 0) - units);
    }
  } else if (kind === 'arrears') D.arrears += amt;
}

// Pay interest to whoever holds the debt. Called before the treasury moves.
function payInterest(game, c, interest) {
  const D = c.debt, E = econOf(c);
  const held = debtTotal(D) - D.arrears;
  if (!(held > 0) || !(interest > 0)) { E.bondIncome = 0; return; }
  const f = interest / held;
  // Savers' interest is income for the owning classes, paid next month (economy.js): a monthly rate.
  E.bondIncome = rateOf(toEcon(c, D.savers * f));
  if (E.bankCap != null) E.bankCap += toEcon(c, D.banks * f);
  for (const id in D.foreign) {
    const l = game.countries[id];
    if (!l || !l.econ) continue;
    const units = D.foreign[id] * f * 1e6 / ((c.econ && c.econ.pl) || 1);
    // Coupons to foreign holders are paid in reserves.
    bondReserves(game, c, c.id, +id, D.foreign[id] * f);
    if (ownersAllowed(l)) l.econ.investPool = (l.econ.investPool || 0) + units;
    else l.econ.statePool = (l.econ.statePool || 0) + units;
  }
}

// Each month, after the budget: fund the change in debt from real lenders.
function financeBudget(game, c) {
  const D = ensureDebt(c);
  const E = econOf(c);
  D.last = { savers: 0, banks: 0, foreign: 0, printed: E.printed || 0, shortfall: 0, repaid: 0 };
  // Claims of nations that no longer exist are gone.
  for (const id in D.foreign) if (!game.countries[id] || !game.countries[id].alive) { c.treasury += D.foreign[id]; delete D.foreign[id]; }
  // No private owners left: their bonds were nationalized with the banks.
  if (!ownersAllowed(c) && D.savers > 0) { D.banks += D.savers; D.savers = 0; }
  if (D.defaulted > 0) D.defaulted += TIME.STEP_MONTHS;
  if (D.defaulted > 240) D.defaulted = 0;
  const tr = debtTrust(game, c);
  D.trust = tr.value;
  D.yield = debtYield(c, D.trust);

  const owed = Math.max(0, -c.treasury), held = debtTotal(D);
  let change = owed - held;
  if (change < -1e-9) {
    // A surplus repays lenders: unpaid bills first, then everyone pro rata.
    let rep = -change;
    D.last.repaid = rep;
    const a = Math.min(D.arrears, rep); D.arrears -= a; rep -= a;
    const tot = debtTotal(D);
    if (tot > 0 && rep > 0) {
      const f = Math.min(1, rep / tot);
      borrowFrom(game, c, 'savers', -D.savers * f);
      D.banks -= D.banks * f;
      for (const id of Object.keys(D.foreign)) borrowFrom(game, c, 'foreign', -D.foreign[id] * f, +id);
    }
    D.payFrac += (1 - D.payFrac) * smooth(0.3);
    calmMonth(D);
    return;
  }
  if (change <= 1e-9) { D.payFrac += (1 - D.payFrac) * smooth(0.3); calmMonth(D); return; }
  // New borrowing.
  const off = lendingOffers(game, c);
  const take = Math.min(1, change / Math.max(1e-12, off.total));
  if (off.savers > 0) { borrowFrom(game, c, 'savers', off.savers * take); D.last.savers = off.savers * take; }
  if (off.banks > 0) { borrowFrom(game, c, 'banks', off.banks * take); D.last.banks = off.banks * take; }
  for (const [id, amt] of off.foreign) { borrowFrom(game, c, 'foreign', amt * take, id); D.last.foreign += amt * take; }
  const short = change - off.total * take;
  if (short > 1e-9) {
    // Nobody will lend the rest: the state owes its workers and suppliers.
    borrowFrom(game, c, 'arrears', short);
    D.last.shortfall = short;
    const spendM = c.budget ? c.budget.spend : 0;
    D.payFrac = clamp(D.payFrac - (spendM > 0 ? short / spendM : 0.1), 0.55, 1);
    D.calm = 0;
    if (!D.crisis) {
      logNews(game, `Lenders refuse ${c.name} credit: the state cannot pay its bills.`, 'econ', [c.id]);
      if (isPlayer(game, c)) notify(game, 'Sovereign Debt Crisis', 'Lenders will no longer cover our deficit. The state is falling behind on wages and suppliers, and spending is being cut to what we can pay. We can raise taxes, cut spending, print money if the law allows it, or default on our debts (Economy tab).');
    }
    D.crisis = (D.crisis || 0) + TIME.STEP_MONTHS;
  } else {
    D.payFrac += (1 - D.payFrac) * smooth(0.15);
    calmMonth(D);
  }
}

// A debt crisis ends after six months in which lenders covered every bill.
function calmMonth(D) {
  if (!(D.crisis > 0)) return;
  D.calm = (D.calm || 0) + TIME.STEP_MONTHS;
  if (D.calm >= 6) { D.crisis = 0; D.calm = 0; }
  else D.crisis += TIME.STEP_MONTHS;
}

// The deficit lenders will tolerate, as a share of GDP: more in a slump stimulus, less as trust fades.
function deficitRoom(c, stance) {
  const T = c.debt ? c.debt.trust : 1;
  return (stance === 'stimulus' ? 0.06 : 0.04) * clamp(T - 0.1, 0, 1);
}

// Default: holders take a haircut. Savers lose wealth, banks lose capital
// (perhaps starting a banking crisis), foreign lenders turn hostile.
function defaultOnDebt(game, c, haircut) {
  const D = ensureDebt(c), E = econOf(c);
  const h = haircut == null ? FISCAL.HAIRCUT : haircut;
  const before = debtTotal(D) - D.arrears;
  if (!(before > 0)) return 0;
  const lossSavers = D.savers * h, lossBanks = D.banks * h;
  D.savers -= lossSavers; D.banks -= lossBanks;
  // Bondholders are the owning classes: their wealth falls with the write-down.
  let left = toEcon(c, lossSavers), ownersN = 0;
  for (const p of c._provs || []) ownersN += (p.pops.capitalists || 0) + (p.pops.landowners || 0);
  if (ownersN > 0) for (const p of c._provs) for (const t of ['capitalists', 'landowners']) {
    const n = p.pops[t] || 0; if (n < 1) continue;
    const cut = Math.min(p.wealth[t], left / ownersN * 0.5);
    p.wealth[t] -= cut;
  }
  if (E.bankCap != null) {
    E.bankCap -= toEcon(c, lossBanks);
    if (E.credit > 0 && E.bankCap < E.credit * CREDIT.CAP_MIN && !(E.bankCrisis > 0)) bankingCrisis(game, c, c.laws.banking || 'regulated');
  }
  let lossF = 0;
  for (const id of Object.keys(D.foreign)) {
    const l = D.foreign[id] * h; lossF += l; D.foreign[id] -= l;
    addRel(game, c.id, +id, -25);
  }
  const written = lossSavers + lossBanks + lossF;
  c.treasury += written;
  D.defaulted = 1; D.crisis = 0; D.payFrac = Math.max(D.payFrac, 0.85);
  adjust(c, { stability: -12, approval: -6, business: -10 - 30 * (lossSavers / before) });
  addMod(c, 'growth', -0.0015, 12, 'Debt default');
  logNews(game, `${c.name} defaults on its debt: holders lose ${Math.round(h * 100)}%.`, 'econ', [c.id, ...Object.keys(D.foreign).map(Number)]);
  return written;
}

// The player's choice in a debt crisis.
const DEFAULT_PC = 15;
function playerDefault(game) {
  const c = game.countries[game.player];
  const D = ensureDebt(c);
  if (debtTotal(D) - D.arrears <= 0) return { ok: false, msg: 'We owe nothing to default on.' };
  if (c.pc < DEFAULT_PC) return { ok: false, msg: `Needs ${DEFAULT_PC} political capital.` };
  c.pc -= DEFAULT_PC;
  const w = defaultOnDebt(game, c);
  return { ok: true, msg: `We default. ${fmtDebt(w)} of debt is written off. Bondholders are furious, and lenders will not trust us for years.` };
}

function fmtDebt(x) { return typeof fmtMoney === 'function' ? fmtMoney(x) : x.toFixed(2) + 'B'; }

// AI: in a debt crisis, governments cut, and the deeply indebted may default.
function aiDebt(game, c) {
  const D = ensureDebt(c);
  if (!(D.crisis > 0)) return;
  const debt = -c.treasury / (c.gdpNom || c.gdp);
  const lean = typeof econLean === 'function' ? econLean(c) : 0;
  // Populists default sooner; orthodox governments squeeze harder first.
  const burden = c.budget && c.budget.revenue > 0 ? c.budget.interest / c.budget.revenue : 0;
  if (D.crisis > 3 && (debt > 0.5 || burden > 0.25) && game.rng.chance(perStepChance(0.08 + Math.max(0, -lean) * 0.08 + Math.max(0, burden - 0.25) * 0.5))) defaultOnDebt(game, c);
}

// For the interface: who holds the debt.
function debtHolders(game, c) {
  const D = ensureDebt(c);
  const rows = [['Domestic savers', D.savers], ['Banks', D.banks]];
  for (const id in D.foreign) rows.push([game.countries[id] ? game.countries[id].name : 'Abroad', D.foreign[id], +id]);
  if (D.arrears > 0) rows.push(['Unpaid wages and suppliers', D.arrears]);
  return rows.filter(r => r[1] > 1e-9).sort((a, b) => b[1] - a[1]);
}
