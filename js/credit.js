'use strict';
// Milestone 4b: credit, confidence and the business cycle.
//
// Business borrows to build when confidence is high and money is cheap, so
// private debt piles up through a boom and pays for real construction
// projects. New capacity arrives months later, often after demand has
// peaked; prices and profits fall just as the debts come due. When debt
// service eats too much of owners' profits, firms default: real buildings
// close and their workers lose their jobs. Defaults eat bank capital; when
// it runs thin, a banking crisis cuts lending, and (without deposit
// insurance) a bank run wipes out savings. Confidence ties it together:
// growth breeds optimism and more borrowing; defaults and crises breed fear.
//
// E.credit private debt (raw output units) · E.conf business confidence (0.3–1.8, 1 = normal)
// E.bankCap bank capital · E.bankCrisis months of banking crisis left · E.defaults monthly default rate

const BANKING_INFO = {
  unregulated: 'Banks lend freely: bigger booms, and when they fail, depositors lose their savings.',
  regulated: 'Leverage is capped and deposits are insured: smaller booms, and the state pays when banks fail.',
  state: 'State banks lend as the government directs: steadier credit, but less of it goes where it pays.',
};
const CREDIT = { LEND: 0.022, REPAY: 1 / 120, SPREAD: 0.02, CAP_MIN: 0.04, CAP_TARGET: 0.1, CRISIS_MONTHS: 18 };

function ensureCredit(c) {
  const E = c.econ;
  if (E.credit == null) {
    const Y = Math.max(1, E.gdpRealM || E.gdpM || 1);
    Object.assign(E, { credit: Y * 3, conf: 1, bankCap: Y * 0.3, bankCrisis: 0, defaults: 0, lending: 0, dsr: 0, trendY: Y, gap: 0, profitPrev: null, lastCrisis: -999 });
  }
  return E;
}

function ownerProfit(c) {
  let p = 0;
  for (const pr of c._provs || []) if (pr.gross) p += (pr.gross.capitalists || 0) + (pr.gross.landowners || 0);
  return p + Math.max(0, c.econ.stateProfitK || 0);
}

function tickCredit(game, c) {
  const E = ensureCredit(c), rng = game.rng;
  ensureLaws(c);
  const law = c.laws.banking || 'regulated';
  const Y = Math.max(1, E.gdpRealM || E.gdpM || 1);
  // The trend grows with the economy, so a growing nation is not always "above trend".
  E.trendY = E.trendY * (1 + (E.gY || 0)) + (Y - E.trendY) / lagMonths(60);
  E.gap = Math.log(Y / E.trendY);
  const piEa = annual(E.piE || 0);
  const realRate = (E.rate == null ? 0.04 : E.rate) - piEa;
  const annualY = yearlyOf(Y);
  const lev = E.credit / annualY;

  // 1. New lending: confidence, the real interest rate, and how indebted firms already are.
  const capLev = law === 'regulated' ? 0.7 : law === 'state' ? 0.6 : 1.0;
  const levF = clamp(1 - (lev - capLev * 0.6) / (capLev * 0.6), 0, 1.3);
  const rateF = clamp(1 - (realRate - 0.02) * 6, 0.2, 2);
  const crisisF = E.bankCrisis > 0 ? 0.1 : 1;
  const capF = clamp((E.bankCap / Math.max(1, E.credit) - CREDIT.CAP_MIN) / (CREDIT.CAP_TARGET - CREDIT.CAP_MIN), 0.1, 1.2);
  const stateF = law === 'state' ? 0.7 : 1;
  E.lending = perStep(Y * CREDIT.LEND * Math.pow(E.conf, 2) * rateF * levF * crisisF * capF * stateF);
  // State banks lend steadily, whatever the mood.
  if (law === 'state') E.lending = E.lending * 0.5 + perStep(Y * CREDIT.LEND * 0.35 * crisisF);
  E.credit += E.lending;
  E.creditTrend = E.creditTrend == null ? E.credit : E.creditTrend + (E.credit - E.creditTrend) / lagMonths(120);

  // 2. Debt service out of owners' profits; interest goes to the savers who lent it.
  const rateL = Math.max(0.01, (E.rate == null ? 0.04 : E.rate) + CREDIT.SPREAD);
  const interest = perYear(E.credit * rateL), principal = perStep(E.credit * CREDIT.REPAY);
  E.credit -= principal;
  // Owners' profits are a monthly rate; debt service is paid over this step.
  const profit = Math.max(1e-6, perStep(ownerProfit(c)));
  E.dsr = (interest + principal) / profit;
  // Borrowed money is spent building; repayments come out of what owners could invest.
  if (ownersAllowed(c)) E.investPool = Math.max(0, E.investPool + E.lending - principal - interest * 0.4);
  else E.statePool = Math.max(0, (E.statePool || 0) + E.lending - principal - interest * 0.4);

  // 3. Defaults: when debts outrun profits, firms go under, closing real buildings.
  const distress = Math.max(0, E.dsr - 0.4);
  E.defaults = perStep(clamp(distress * 0.03 / Math.max(0.5, E.conf), 0, 0.02));
  if (E.defaults > perStep(0.001)) {
    const loss = E.credit * E.defaults;
    E.credit -= loss;
    E.bankCap -= loss * (law === "unregulated" ? 0.8 : 0.55);
    bankruptcies(game, c, E.defaults);
  }
  // Banks earn the spread and build capital back up.
  E.bankCap += perYear(E.credit * CREDIT.SPREAD) * 0.5;
  // Free banks run thin buffers; regulated ones must hold more.
  E.bankCap = Math.min(E.bankCap, E.credit * (law === "unregulated" ? 0.065 : 0.12));

  // 4. Banking crises.
  if (E.bankCrisis > 0) {
    E.bankCrisis = countdown(E.bankCrisis);
    if (!(E.bankCrisis > 0)) logNews(game, `${c.name}'s banks are lending again.`, 'econ', [c.id]);
  } else if (E.bankCap < E.credit * CREDIT.CAP_MIN && lev > 0.15) bankingCrisis(game, c, law);

  // 5. Confidence: growth breeds optimism, defaults and crises breed fear.
  const pg = E.profitPrev ? profit / E.profitPrev - 1 : 0;
  E.profitPrev = E.profitPrev == null ? profit : E.profitPrev + (profit - E.profitPrev) * smooth(0.15);
  const confT = clamp(1 + E.gap * 4 + pg * 1 - E.defaults * 40 - (E.bankCrisis > 0 ? 0.45 : 0) - (isAtWar(game, c.id) ? 0.15 : 0)
    - Math.max(0, c.unrest - 40) * 0.008 + rng.normal() * 0.04 * Math.sqrt(TIME.STEP_MONTHS), 0.3, 1.8);
  E.conf += (confT - E.conf) * smooth(0.1);
}

// Close capacity, the least profitable buildings first.
function bankruptcies(game, c, share) {
  const all = [];
  for (const p of c._provs || []) for (const b of p.buildings) if (b.level > 0) all.push(b);
  if (!all.length) return;
  all.sort((a, b) => (a.pva || 0) / Math.max(1, BUILDINGS[a.t].cost) - (b.pva || 0) / Math.max(1, BUILDINGS[b.t].cost));
  let levels = all.reduce((s, b) => s + b.level, 0) * share, closed = 0;
  for (const b of all) {
    if (levels < 0.5) break;
    if (game.rng.chance(Math.min(1, levels))) { b.level--; levels--; closed++; }
  }
  const wave = closed >= Math.max(4, all.length * 0.03);
  if (wave && isPlayer(game, c)) toastPlayer(game, `A wave of bankruptcies: ${closed} businesses close their doors.`, 'bad');
  if (wave) logNews(game, `Bankruptcies sweep ${c.name}: ${closed} businesses fail.`, 'econ', [c.id]);
}

function bankingCrisis(game, c, law) {
  const E = c.econ;
  E.bankCrisis = CREDIT.CRISIS_MONTHS;
  E.lastCrisis = game.month;
  E.conf = Math.min(E.conf, 0.6);
  const need = Math.max(0, E.credit * 0.08 - E.bankCap);
  if (law === 'unregulated') {
    // A run on the banks: depositors lose part of their savings.
    for (const p of c._provs || []) if (p.wealth) for (const t in p.wealth) p.wealth[t] *= 0.8;
    E.bankCap = E.credit * 0.05;
    logNews(game, `Bank run in ${c.name}! Banks close their doors and savers lose a fifth of their money.`, 'crisis', [c.id]);
    if (isPlayer(game, c)) notify(game, 'A Run on the Banks', 'Panicked savers have emptied the banks. With no deposit insurance, families have lost a fifth of their savings, and lending has frozen. You can bail out the banks (Economy tab) to restart lending sooner.');
  } else {
    // Insured deposits: the state recapitalizes the banks.
    const cost = need / 1e6 * (E.pl || 1);
    c.treasury -= cost;
    E.bankCap += need;
    logNews(game, `Banking crisis in ${c.name}: the state spends ${moneyText(cost)} rescuing the banks.`, 'crisis', [c.id]);
    if (isPlayer(game, c)) notify(game, 'Banking Crisis', `Bad loans have wiped out the banks' capital. Deposits are insured, so the treasury has paid to keep them open, but lending will stay frozen for a while.`);
  }
}

// Player: recapitalize the banks so lending resumes sooner.
const BAILOUT_PC = 10;
function bailoutBanks(game) {
  const c = game.countries[game.player], E = ensureCredit(c);
  if (!E.bankCrisis) return { ok: false, msg: 'The banks are not in crisis.' };
  if (c.pc < BAILOUT_PC) return { ok: false, msg: `Needs ${BAILOUT_PC} political capital.` };
  const need = Math.max(0, E.credit * CREDIT.CAP_TARGET - E.bankCap), cost = need / 1e6 * (E.pl || 1);
  c.pc -= BAILOUT_PC;
  c.treasury -= cost;
  E.bankCap += need;
  E.bankCrisis = Math.ceil(E.bankCrisis / 3);
  adjust(c, { workers: -6, business: 6 });
  return { ok: true, msg: `The banks are recapitalized for ${moneyText(cost)}. Lending will resume soon. Workers ask why bankers were rescued and they weren't.` };
}

// Where the economy is in the cycle, for the interface.
function cyclePhase(c) {
  const E = c.econ;
  if (!E || E.gap == null) return 'steady';
  const H = c.hist && c.hist.rgdp, d = H && H.length > 13 ? H[H.length - 1] / H[H.length - 13] - 1 : 0;
  if (E.bankCrisis > 0) return 'crisis';
  if (E.gap > 0.03) return d > 0.01 ? 'boom' : 'peak';
  if (E.gap < -0.03) return d < -0.005 ? 'recession' : 'recovery';
  return d >= 0 ? 'expansion' : 'slowdown';
}
const CYCLE_NAMES = { steady: 'Steady', boom: 'Boom', peak: 'Overheating', recession: 'Recession', recovery: 'Recovery', expansion: 'Expansion', slowdown: 'Slowdown', crisis: 'Banking crisis' };

// What moves confidence, for the breakdown.
function confidenceParts(c) {
  const E = ensureCredit(c);
  return [
    ['Economy above / below trend', E.gap * 4], ['Defaults', -E.defaults * 40], ['Banking crisis', E.bankCrisis > 0 ? -0.45 : 0], ['Unrest', -Math.max(0, c.unrest - 40) * 0.008],
  ].map(([l, v]) => [l, v * 100]);
}

function moneyText(b) { return b >= 1 ? "$" + b.toFixed(1) + "B" : "$" + Math.round(b * 1000) + "M"; }
