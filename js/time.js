'use strict';
// Time and pacing (ROADMAP, "Time and pacing", stage 2, step 1): one place for
// the length of a simulation step.
//
// The simulation steps once a month today (STEP_MONTHS = 1). Per-month rates,
// yearly rates, smoothing factors, decay multipliers, chances and countdowns in
// the systems that will run faster than monthly (markets, money, credit, the
// budget, payments, trade flows, war) go through these helpers instead of
// "/ 12", fixed per-month factors and "-- each month", so the step can shrink
// (weekly ticks) without retuning each file.
//
// With STEP_MONTHS = 1 every helper returns exactly what the old code computed,
// bit for bit, so this layer changes nothing until the step changes.
// Slow systems (demographics, ideas, figures, research) stay monthly: when the
// step shrinks they will run only at the start of each month.
//
// game.month counts months of game time; durations are compared against it in months.

const TIME = { STEP_MONTHS: 1 };

// An amount or small rate per month → per step (flows, drifts, per-month nudges).
function perStep(monthly) { return TIME.STEP_MONTHS === 1 ? monthly : monthly * TIME.STEP_MONTHS; }
// A yearly rate or amount → per step (replaces "x / 12").
function perYear(yearly) { return TIME.STEP_MONTHS === 1 ? yearly / 12 : yearly * TIME.STEP_MONTHS / 12; }
// A per-step flow → per year (replaces "x * 12" when annualizing a month's flow).
function annualize(step) { return TIME.STEP_MONTHS === 1 ? step * 12 : step * 12 / TIME.STEP_MONTHS; }
// A compounding monthly growth rate → per step: (1 + g)^step − 1.
function growStep(g) { return TIME.STEP_MONTHS === 1 ? g : Math.pow(1 + g, TIME.STEP_MONTHS) - 1; }
// A smoothing factor (the share of a gap closed in a month: x += (target − x) · k) → per step.
function smooth(k) { return TIME.STEP_MONTHS === 1 ? k : 1 - Math.pow(1 - k, TIME.STEP_MONTHS); }
// A decay multiplier per month (x *= m) → per step.
function decay(m) { return TIME.STEP_MONTHS === 1 ? m : Math.pow(m, TIME.STEP_MONTHS); }
// A chance per month → per step (the yearly frequency stays the same).
function perStepChance(p) { return TIME.STEP_MONTHS === 1 ? p : 1 - Math.pow(1 - p, TIME.STEP_MONTHS); }
// A lag in months for "x += (target − x) / n" → per step: the divisor that closes the same share per month.
function lagMonths(n) { return TIME.STEP_MONTHS === 1 ? n : 1 / smooth(1 / n); }
// A countdown in months, one step later (replaces "x--" on month counters).
function countdown(months) { return months - TIME.STEP_MONTHS; }

// Rates and amounts (tick rework, step 2: flows at their source).
// The national statistics (GDP, incomes, wages, imports and exports, the trade
// balance, tax and tariff bases) are rates per month, whatever the step of the
// system that computed them, so every reader sees the same scale. A rate becomes
// an amount (perStep) once, where it changes a stock: wealth, the treasury,
// reserves, the investment funds, the money supply, credit.
// A monthly rate → a yearly rate (replaces "x * 12" on a rate; independent of the step).
function yearlyOf(monthly) { return monthly * 12; }
// A yearly rate → a monthly rate (replaces "x / 12" on a rate; independent of the step).
function monthlyOf(yearly) { return yearly / 12; }
// An amount over this step → a monthly rate.
function rateOf(amount) { return TIME.STEP_MONTHS === 1 ? amount : amount / TIME.STEP_MONTHS; }

// ------------------------------------------------------------------ the scheduler
// Each system declares its rhythm: how many months of game time pass between its runs
// (WEEK = a quarter month; 1 = monthly; 12 = yearly) and, for slow systems, the month
// of the year it runs in (phase). A step of the game is the shortest rhythm in use.
// game.month counts months of game time and moves on when a new month starts;
// game.week (0–3) is kept only while some system runs faster than monthly.
// While a system runs, TIME.STEP_MONTHS is its own step, so the helpers above
// scale its rates, chances and countdowns to how often it runs.
const RHYTHM = { WEEK: 0.25, MONTH: 1, YEAR: 12 };

// The length of one step of the game, in months: the fastest rhythm in the schedule.
function baseStepMonths(systems) {
  let s = 1;
  for (const sys of systems) if (sys.every < s) s = sys.every;
  return s;
}

// Is the system due on this step? newMonth: this step starts a new month.
function systemDue(game, sys, newMonth) {
  if (sys.every < 1) return true;
  if (!newMonth) return false;
  return sys.every === 1 || (game.month - (sys.phase || 0)) % sys.every === 0;
}

// Run one step of the game: move the clock on, then each due system in order.
function runSchedule(game, systems) {
  const base = baseStepMonths(systems), perMonth = Math.round(1 / base);
  let newMonth = true;
  if (perMonth > 1) {
    game.week = ((game.week || 0) + 1) % perMonth;
    newMonth = game.week === 0;
  } else if (game.week != null) delete game.week;
  if (newMonth) game.month++;
  const outer = TIME.STEP_MONTHS;
  for (const sys of systems) {
    if (!systemDue(game, sys, newMonth)) continue;
    TIME.STEP_MONTHS = sys.step || sys.every;
    try { sys.run(game); } finally { TIME.STEP_MONTHS = outer; }
  }
  return newMonth;
}
