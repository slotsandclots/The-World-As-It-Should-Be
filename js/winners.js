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
// Still to do (after the tick rework's freeze): the same view for taxes, spending,
// tariffs and money growth, which needs the interest groups' monthly targets
// pulled out of tickCountry (sim.js) into a function both can call.

const WINNERS = {
  REACTION: 0.6,  // the share of a group's preference that moves its loyalty when the law passes (enactLaw)
  HOSTILE: 25,    // below this loyalty the state is warned that a group is disloyal (alerts.js)
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
  const g = GOVS[c.gov], aw = g.approvalWeight;
  const meter = factions => {
    const x = Object.assign({}, c, { factions });
    let s = 0, w = 0;
    for (const f of FACTION_KEYS) { s += factions[f] * (clout[f] || 0); w += clout[f] || 0; }
    return (0.38 * (1 - aw) * weightedLoyalty(x, g.base) + 0.2 * (w ? s / w : avgLoyalty(x))) / 0.58;
  };
  const support = meter(afterF) - meter(c.factions);
  return { groups, support };
}
