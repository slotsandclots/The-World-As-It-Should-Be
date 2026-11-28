'use strict';
// Who wins, who loses (ROADMAP, "Political economy", step 1; first pass: law reforms).
//
// Before a reform is proposed, the player sees how each interest group would
// take it, from the simulation's own rules:
// - at once: the jump in loyalty when the law passes (enactLaw, 0.6 of its preference);
// - in time: how far the group's loyalty target moves (tickCountry: the law's full
//   preference through lawFx, plus any change in its unmet-demand penalty), so
//   loyalty drifts there over the following months;
// - its clout, and whether the change pushes it under the line where the state is
//   warned that the group is disloyal (alerts.js), or brings it back over;
// - the change in support at once, through both terms of the support meter that
//   read interest groups (the power base and clout-weighted loyalty, sim.js).
// Read-only: it changes nothing.
//
// Taxes, spending and tariffs (policyWinners): a slider moves no loyalty at once; it
// moves each group's loyalty target (interestTargets, sim.js, the same function the
// monthly tick uses), and loyalty drifts there over the following months.

const WINNERS = {
  REACTION: 0.6,  // the share of a group's preference that moves its loyalty when the law passes (enactLaw)
  HOSTILE: 25,    // below this loyalty the state is warned that a group is disloyal (alerts.js)
  DRIFT: 0.07,    // the share of the gap to its target that a group's loyalty closes each month (tickCountry)
};

// A group's unmet-demand penalty under a set of laws (as tickCountry computes it).
function winnersUnmet(c, f) {
  const d = interestDemand(c, f);
  return d ? -Math.min(6, lawPreference(c, d.cat, d.opt, f) * 0.35) : 0;
}

// One line per interest group with a stake in the change, the biggest stakes first.
function lawWinners(game, c, cat, opt, clout) {
  if (!c || !c.laws || c.laws[cat] === opt) return { groups: [], support: 0 };
  clout = clout || interestClout(c);
  const passed = Object.assign({}, c, { laws: Object.assign({}, c.laws, { [cat]: opt }) });
  const groups = [], afterF = Object.assign({}, c.factions);
  for (const f of FACTION_KEYS) {
    const pref = lawPreference(c, cat, opt, f);
    const now = c.factions[f] == null ? 50 : c.factions[f];
    // The target moves by the law's full preference, and by any change in the unmet demand.
    const shift = pref + winnersUnmet(passed, f) - winnersUnmet(c, f);
    const after = clamp(now + pref * WINNERS.REACTION, 0, 100);
    afterF[f] = after;
    const delta = after - now;
    if (Math.abs(delta) < 0.05 && Math.abs(shift) < 0.05) continue;
    const later = clamp(now + shift, 0, 100);
    groups.push({
      key: f, name: FACTIONS[f].name, icon: FACTIONS[f].icon,
      pref, delta, shift, now, after, later, clout: clout[f] || 0,
      // A loss that pushes a group under the line where the state is warned, or a gain that brings it back.
      turns: now >= WINNERS.HOSTILE && Math.min(after, later) < WINNERS.HOSTILE ? 'against'
        : now < WINNERS.HOSTILE && Math.min(after, later) >= WINNERS.HOSTILE ? 'back' : null,
      weight: Math.max(Math.abs(delta), Math.abs(later - now)) * (clout[f] || 0),
    });
  }
  groups.sort((a, b) => b.weight - a.weight);
  // The change in support at once, as the support meter weighs interest groups (sim.js):
  // (0.38 · (1 − approval weight) · power-base loyalty + 0.2 · clout-weighted loyalty) / 0.58.
  const support = winnersMeter(c, afterF, clout) - winnersMeter(c, c.factions, clout);
  return { groups, support };
}

// The support meter as it weighs interest groups (sim.js): the power base and clout-weighted loyalty.
function winnersMeter(c, factions, clout) {
  const g = GOVS[c.gov], aw = g.approvalWeight, x = Object.assign({}, c, { factions });
  let s = 0, w = 0;
  for (const f of FACTION_KEYS) { s += factions[f] * (clout[f] || 0); w += clout[f] || 0; }
  return (0.38 * (1 - aw) * weightedLoyalty(x, g.base) + 0.2 * (w ? s / w : avgLoyalty(x))) / 0.58;
}

// Who gains, who loses from a change of policy (taxes, spending, tariffs, money growth):
// each interest group's loyalty target under the policy `from` (as the month began) and
// under `to` (as the sliders stand), everything else as it is now. Loyalty does not jump:
// it drifts toward the new target, closing 7% of the gap a month. The support change is
// the one the support meter would see once loyalties have settled on the new targets.
function policyWinners(game, c, from, to, clout) {
  if (!c || !c.econ || !from || !to) return { groups: [], support: 0, changed: [] };
  const changed = Object.keys(to).filter(k => typeof to[k] === 'number' && Math.abs((to[k] || 0) - (from[k] || 0)) > 1e-9);
  if (!changed.length) return { groups: [], support: 0, changed };
  clout = clout || interestClout(c);
  const A = interestTargets(game, c, from).target, B = interestTargets(game, c, to).target;
  const groups = [];
  for (const f of FACTION_KEYS) {
    const shift = B[f] - A[f];
    if (Math.abs(shift) < 0.05) continue;
    const now = c.factions[f] == null ? 50 : c.factions[f];
    // Where loyalty would be in six months: the gap to the target shrinks by 7% a month.
    const half = 1 - Math.pow(1 - WINNERS.DRIFT, 6);
    groups.push({
      key: f, name: FACTIONS[f].name, icon: FACTIONS[f].icon, clout: clout[f] || 0,
      now, before: A[f], after: B[f], shift,
      in6: now + (B[f] - now) * half, in6Before: now + (A[f] - now) * half,
      // A cut that sets a group's course under the line where the state is warned, or a gain that lifts it back over.
      turns: A[f] >= WINNERS.HOSTILE && B[f] < WINNERS.HOSTILE ? 'against' : A[f] < WINNERS.HOSTILE && B[f] >= WINNERS.HOSTILE ? 'back' : null,
      weight: Math.abs(shift) * (clout[f] || 0),
    });
  }
  groups.sort((a, b) => b.weight - a.weight);
  return { groups, support: winnersMeter(c, B, clout) - winnersMeter(c, A, clout), changed };
}
