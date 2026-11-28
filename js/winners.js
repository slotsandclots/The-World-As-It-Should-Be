'use strict';
// Who wins, who loses (ROADMAP, "Political economy", step 1; first pass: law reforms).
//
// Before a reform is proposed, the player sees how each interest group would
// take it: how much its loyalty moves when the law changes (the same reaction
// enactLaw applies), how much that group matters (its clout), where its loyalty
// stands now and where it would end up, and whether the change turns it against
// the state. Read-only: it uses the simulation's own numbers and changes nothing.
//
// Still to do (after the tick rework's freeze): the same view for taxes, spending,
// tariffs and money growth, which needs the interest groups' monthly targets
// pulled out of tickCountry (sim.js) into a function both can call.

const WINNERS = {
  REACTION: 0.6,  // the share of a group's preference that moves its loyalty when the law passes (enactLaw)
  HOSTILE: 30,    // below this loyalty a group works against the state
  SUPPORT: 0.34,  // interest groups' weight in the support meter (by clout)
};

// One line per interest group with a stake in the change, the biggest stakes first.
function lawWinners(game, c, cat, opt) {
  if (!c || !c.laws || c.laws[cat] === opt) return { groups: [], support: 0 };
  const clout = interestClout(c);
  const groups = [];
  for (const f of FACTION_KEYS) {
    const pref = lawPreference(c, cat, opt, f);
    if (!pref) continue;
    const now = c.factions[f] == null ? 50 : c.factions[f];
    const delta = pref * WINNERS.REACTION;
    const after = clamp(now + delta, 0, 100);
    groups.push({
      key: f, name: FACTIONS[f].name, icon: FACTIONS[f].icon,
      delta, now, after, clout: clout[f] || 0,
      // A loss that pushes a group below the line where it works against the state, or a gain that brings it back.
      turns: now >= WINNERS.HOSTILE && after < WINNERS.HOSTILE ? 'against' : now < WINNERS.HOSTILE && after >= WINNERS.HOSTILE ? 'back' : null,
      weight: Math.abs(delta) * (clout[f] || 0),
    });
  }
  groups.sort((a, b) => b.weight - a.weight);
  // The change in support from interest groups, weighted by clout, as the support meter weighs them (sim.js).
  const support = groups.reduce((s, x) => s + x.clout * (x.after - x.now), 0) * WINNERS.SUPPORT;
  return { groups, support };
}
