'use strict';
// Milestone 4a: money, the price level and the central bank.
//
// The real economy (goods, buildings, pops) keeps working in real units. On
// top of it each nation has a currency: a money supply, a price level, and
// expectations of inflation. Prices follow money growth beyond real growth,
// with inertia from expectations. Nominal wages chase prices with a lag (set
// by the labor law), so inflation cuts real wages and fattens profits, and
// deflation does the reverse. Savings lose real value to inflation and earn
// interest. The treasury and the national debt are in currency, so inflation
// erodes debt, which is the temptation to print.
//
// E.pl price level · E.money money supply (MONEY_MONTHS months of output at the price level)
// E.pi monthly inflation · E.piE expected monthly inflation · E.wIdx nominal wage index
// E.rate interest rate (annual) · E.realWage = wIdx / pl

const INFLATION_TARGET = 0.02; // a year
const MONEY_MONTHS = 8;       // money held ≈ eight months of output (velocity ~1.5 a year)
const MONETARY_INFO = {
  gold: 'Money grows only as gold comes in (about 1.5% a year). Prices are stable over time, but fall in a boom and can\'t be eased in a slump.',
  centralBank: `An independent central bank grows money to keep inflation near ${INFLATION_TARGET * 100}% a year, and sets interest rates by a rule.`,
  state: 'The government decides how fast money grows, and can print it to pay for deficits. Powerful, and dangerous.',
};

function ensureMoney(c) {
  const E = c.econ;
  if (E.pl == null) Object.assign(E, { pl: 1, pi: 0, piE: 0, wIdx: 1, realWage: 1, rate: 0.04, money: null, gY: 0.0008, printed: 0, moneyGrowth: 0 });
  return E;
}

// A rate per step, compounded over a year (time.js).
function annual(m) { return Math.pow(1 + m, 12 / TIME.STEP_MONTHS) - 1; }
// A rate per step of the money system, compounded over a year, read from anywhere:
// money runs weekly, so its rates (pi, piE, moneyGrowth, gY) are per week.
function moneyAnnual(E, m) { return Math.pow(1 + (m || 0), 12 / ((E && E.moneyStep) || 1)) - 1; }

function tickMoney(game, c) {
  const E = ensureMoney(c);
  ensureLaws(c);
  const law = c.laws.monetary, p = c.policy;
  // The money system's rates are per step: remember the step, so other systems can read them (moneyAnnual).
  E.moneyStep = TIME.STEP_MONTHS;
  const Y = Math.max(1, E.gdpRealM || E.gdpM || 1);
  if (E.money == null) E.money = Y * E.pl * MONEY_MONTHS;
  // Real output is measured once a month (economy.js, the accounts): its latest monthly
  // growth, converted to this step, is what money and the banks expect.
  if (Y !== E.prevRealForMoney) {
    if (E.prevRealForMoney) E.gYm = clamp(Y / E.prevRealForMoney - 1, -0.03, 0.03);
    E.prevRealForMoney = Y;
  }
  if (E.gYm != null) E.gY += (growStep(E.gYm) - E.gY) * smooth(0.03);

  // Money growth, by monetary system.
  let g;
  // On gold, money also follows the gold flowing in and out with the balance of payments (payments.js).
  if (law === 'gold') g = perStep(0.0012) + (E.goldFlow || 0);
  else if (law === 'centralBank') g = Math.max(-perStep(0.003), E.gY + perYear(INFLATION_TARGET) + 0.6 * (perYear(INFLATION_TARGET) - E.piE));
  else g = (p.moneyGrowth == null ? 4 : p.moneyGrowth) * TIME.STEP_MONTHS / 1200;
  E.moneyGrowth = g;
  E.money *= 1 + g;
  // Printing to pay for the deficit: the treasury is spared, the money supply swells.
  E.printed = 0;
  if (law === 'state' && p.monetize && c.budget && c.budget.net < 0) {
    // The budget is monthly (sim.js): this step prints its share of the month's deficit.
    E.printed = -perStep(c.budget.net);
    c.treasury += E.printed;
    E.money += E.printed * 1e6; // $B a month → raw output units
  }

  // The price level: money chasing real output, with inertia from expectations.
  const broad = E.money + 0.6 * ((E.credit || 0) - (E.creditTrend == null ? (E.credit || 0) : E.creditTrend));
  const plT = Math.max(E.money * 0.5, broad) / (Y * MONEY_MONTHS);
  const pi = clamp(E.piE + smooth(0.15) * Math.log(plT / E.pl), -perStep(0.02), perStep(0.5));
  E.pi = pi;
  E.pl *= 1 + pi;
  E.piE += (pi - E.piE) * smooth(0.12);

  // Nominal wages chase prices; stronger labor laws make them catch up faster.
  const lam = c.laws.labor === 'unions' ? 0.12 : c.laws.labor === 'stateUnions' ? 0.07 : 0.05;
  E.wIdx *= 1 + E.piE + smooth(lam) * Math.log(E.pl / E.wIdx);
  E.realWage = clamp(E.wIdx / E.pl, 0.5, 1.5);

  // Interest rates.
  const piEa = annual(E.piE);
  // Defending a gold parity under attack costs a premium (payments.js).
  if (law === 'gold') E.rate = clamp(0.04 + Math.max(0, -piEa) * 0.5 + (E.attack && typeof PAY !== 'undefined' ? PAY.DEFEND_PREMIUM : 0), 0.02, 0.16);
  // The central bank also leans against booms and slumps (output gap from credit.js).
  else if (law === 'centralBank') E.rate = clamp(0.02 + piEa + 0.5 * (piEa - INFLATION_TARGET) + 0.6 * (E.gap || 0), 0, 0.3);
  else E.rate = clamp(0.01 + 0.7 * piEa, 0, 0.8);

  // Savings: inflation eats their real value; savers earn part of the interest rate.
  const keep = (1 + perYear(E.rate * 0.5)) / (1 + pi);
  for (const pr of c._provs || []) if (pr.wealth) for (const t in pr.wealth) pr.wealth[t] *= keep;
}

// Inflation over the last twelve months, from the price-level history.
function inflationYoY(c) {
  const H = c.hist && c.hist.pl;
  if (!H || H.length < 2) return moneyAnnual(c.econ, (c.econ && c.econ.pi) || 0);
  // Histories are kept per month (sim.js, recordHistory).
  const yearSteps = 12;
  const a = H[Math.max(0, H.length - 1 - yearSteps)], b = H[H.length - 1];
  return a > 0 ? Math.pow(b / a, yearSteps / Math.min(yearSteps, H.length - 1)) - 1 : 0;
}

// What is driving inflation, for the breakdown.
function inflationParts(c) {
  const E = ensureMoney(c);
  const gap = Math.log((E.money / (Math.max(1, E.gdpRealM || E.gdpM) * MONEY_MONTHS)) / E.pl);
  const A = m => moneyAnnual(E, m);
  return [
    ['Money growth', A(E.moneyGrowth) * 100],
    ['Real growth absorbs money', -A(E.gY) * 100],
    ['Expectations (inertia)', A(E.piE) * 100 - (A(E.moneyGrowth) - A(E.gY)) * 100],
    ['Too much / too little money', (A(E.piE + (1 - Math.pow(0.85, E.moneyStep || 1)) * gap) - A(E.piE)) * 100],
  ];
}

// AI governments that control the money supply: print more when at war, in
// debt or when the leader is a populist; tighten when inflation runs away
// (unless an election is near).
function aiMoney(game, c) {
  if (c.laws.monetary !== 'state') return;
  const p = c.policy, E = ensureMoney(c);
  const debt = Math.max(0, -c.treasury) / Math.max(1e-6, c.gdpNom || c.gdp);
  let target = 4 + (isAtWar(game, c.id) ? 8 : 0) + (debt > 0.6 ? 6 : 0) + ((c.leader.traits || []).includes('populist') ? 4 : 0);
  const infl = inflationYoY(c);
  const electionSoon = GOVS[c.gov].elections === 'free' && c.nextElection - game.month < 12;
  if (infl > 0.25 && !electionSoon) target = 2;
  p.moneyGrowth = clamp((p.moneyGrowth == null ? 4 : p.moneyGrowth) + (target - (p.moneyGrowth || 4)) * smooth(0.1), 0, 40);
  p.monetize = (debt > 0.7 || isAtWar(game, c.id)) && !(infl > 0.4 && !electionSoon);
}
