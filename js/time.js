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
