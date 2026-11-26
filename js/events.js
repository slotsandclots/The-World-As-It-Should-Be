'use strict';
// Random events for the player's nation. Each option has `fx` (instant
// changes shown to the player) and optionally `run`, which can do more and
// return an extra line of outcome text.

function capitalName(game, c) { return game.world.provinces[c.capital].name; }
function randomProvince(game, c) { return game.rng.pick(provincesOf(game, c.id)).name; }
function strongestOpposition(c) {
  const polls = computePolls(c);
  let best = null, bv = -1;
  c.parties.forEach((p, i) => { if (p.id !== c.rulingParty && polls[i] > bv) { bv = polls[i]; best = p; } });
  return best;
}

const EVENTS = [
  {
    id: 'strike', title: 'General Strike', weight: 1.2,
    cond: (game, c) => c.factions.workers < 50,
    text: (game, c) => `Dockworkers and factory hands in ${capitalName(game, c)} have walked off the job, demanding higher wages. The unions threaten to shut the country down.`,
    options: [
      { label: 'Raise wages', fx: { workers: 15, business: -6, money: -0.004 } },
      { label: 'Break the strike', fx: { workers: -15, unrest: -8, freedom: -3, business: 5 } },
      { label: 'Wait it out', fx: { workers: -5, approval: -4 }, run: (game, c) => { addMod(c, 'growth', -0.001, 3, 'Strike'); } },
    ],
  },
  {
    id: 'scandal', title: 'Ministry Scandal', weight: 1,
    cond: (game, c) => c.corruption > 25,
    text: () => 'Journalists have uncovered a minister siphoning state funds into foreign bank accounts. The story is spreading fast.',
    options: [
      { label: 'Fire the minister', fx: { pc: -10, corruption: -6, approval: 2 } },
      {
        label: 'Cover it up', fx: { corruption: 4 },
        run: (game, c) => {
          if (game.rng.chance(0.4)) { adjust(c, { approval: -10, legitimacy: -10 }); return 'The cover-up unravels! Approval −10, legitimacy −10.'; }
          return 'The story quietly dies.';
        },
      },
    ],
  },
  {
    id: 'generals', title: 'The Generals Demand More', weight: 1,
    cond: (game, c) => c.factions.military < 55,
    text: () => 'A delegation of senior officers warns that the armed forces are underfunded and morale is collapsing. They want a bigger budget, and they make clear they are not asking.',
    options: [
      { label: 'Raise military spending by 1.5% of GDP', fx: { military: 15 }, run: (game, c) => { c.policy.military = clamp(c.policy.military + 1.5, 0, 12); } },
      { label: 'Refuse', fx: { military: -12 } },
    ],
  },
  {
    id: 'students', title: 'Student Protests', weight: 1,
    cond: (game, c) => c.factions.intelligentsia < 45 || c.freedom < 40,
    text: (game, c) => `Thousands of students have occupied the main square of ${capitalName(game, c)}, demanding free speech and an end to censorship.`,
    options: [
      { label: 'Allow the protests', fx: { freedom: 4, intelligentsia: 8, approval: -3, unrest: 5 } },
      { label: 'Disperse them', fx: { intelligentsia: -15, unrest: -8, freedom: -5 } },
      { label: 'Promise reforms', fx: { pc: -15, intelligentsia: 10, unrest: -5, auth: -0.02 } },
    ],
  },
  {
    id: 'boom', title: 'Economic Boom', weight: 0.8,
    cond: (game, c) => c.growthAvg > 0.0018,
    text: () => 'A surge in exports and a run of good harvests have sent the economy soaring. Advisors debate what to do with the windfall.',
    options: [
      { label: 'Invest in industry', fx: { business: 5 }, run: (game, c) => { c.econ.tech *= 1.02; return 'Productivity +2%.'; } },
      { label: 'Fill the coffers', fx: { money: 0.015 } },
      { label: 'Hand out bonuses', fx: { approval: 8, workers: 5 } },
    ],
  },
  {
    id: 'disaster', title: 'Natural Disaster', weight: 0.7,
    cond: () => true,
    text: (game, c) => `Devastating floods have swept through ${randomProvince(game, c)}. Tens of thousands are homeless.`,
    options: [
      { label: 'Full relief effort', fx: { money: -0.01, approval: 5, workers: 3 } },
      { label: 'Minimal relief', fx: { approval: -8, workers: -6 } },
      {
        label: 'Blame foreign saboteurs', fx: { approval: 2, freedom: -2 },
        run: (game, c) => {
          const ns = getNeighbors(game, c.id);
          if (!ns.length) return '';
          const n = game.countries[game.rng.pick(ns)];
          addRel(game, c.id, n.id, -20);
          return `Relations with ${n.name} −20.`;
        },
      },
    ],
  },
  {
    id: 'revival', title: 'Religious Revival', weight: 0.7,
    cond: (game, c) => c.gov !== 'theocracy',
    text: () => 'Charismatic preachers are drawing vast crowds across the countryside, and the faithful want a greater voice in public life.',
    options: [
      { label: 'Embrace the movement', fx: { clergy: 12, auth: 0.05, intelligentsia: -6 } },
      { label: 'Keep church and state apart', fx: { clergy: -10, intelligentsia: 5 } },
    ],
  },
  {
    id: 'opposition', title: 'A Rising Opposition Star', weight: 1,
    cond: (game, c) => free(c) && !!strongestOpposition(c),
    text: (game, c) => `${makeFirstName(game.rng, game.rng.chance(0.4))} ${makeSurname(game.rng)}, a fiery orator of the ${strongestOpposition(c).name}, is drawing record crowds and climbing in the polls.`,
    options: [
      { label: 'Let democracy run its course', fx: { legitimacy: 3 }, run: (game, c) => { strongestOpposition(c).boost += 0.3; } },
      { label: 'Run a smear campaign', fx: { pc: -15, freedom: -3 }, run: (game, c) => { strongestOpposition(c).boost += 0.08; } },
      { label: 'Have them arrested', fx: { freedom: -12, intelligentsia: -20, legitimacy: -15, approval: -8 } },
    ],
  },
  {
    id: 'assassination', title: 'Assassination Attempt', weight: 0.8,
    cond: (game, c) => c.stability < 45,
    text: (game, c) => `Shots ring out at a parade in ${capitalName(game, c)}. ${leaderLine(c)} survives, shaken but unhurt. The nation holds its breath.`,
    options: [
      { label: 'Declare martial law', fx: { unrest: -20, freedom: -12, military: 5, intelligentsia: -10 } },
      { label: 'Call for national unity', fx: { approval: 6, stability: 4 } },
    ],
  },
  {
    id: 'border', title: 'Border Incident', weight: 1,
    cond: (game, c) => getNeighbors(game, c.id).some(n => !atWarWith(game, c.id, n)),
    setup: (game, c) => ({ other: game.rng.pick(getNeighbors(game, c.id).filter(n => !atWarWith(game, c.id, n))) }),
    text: (game, c, ctx) => `Soldiers of the ${formalName(game.countries[ctx.other])} and our border guards exchanged fire overnight. Each side blames the other.`,
    options: [
      { label: 'Demand an apology', fx: { approval: 3 }, run: (game, c, ctx) => { addRel(game, c.id, ctx.other, -15); return 'Relations −15.'; } },
      { label: 'Let it go', fx: { military: -5 }, run: (game, c, ctx) => { addRel(game, c.id, ctx.other, 5); return 'Relations +5.'; } },
      { label: 'Mobilize the army', fx: { military: 8, money: -0.003 }, run: (game, c, ctx) => { addRel(game, c.id, ctx.other, -30); return 'Relations −30.'; } },
    ],
  },
  {
    id: 'spy', title: 'Spy Ring Uncovered', weight: 0.7,
    cond: (game, c) => game.countries.filter(o => o.alive && o.id !== c.id).length > 0,
    setup: (game, c) => ({ other: game.rng.pick(game.countries.filter(o => o.alive && o.id !== c.id)).id }),
    text: (game, c, ctx) => `Counter-intelligence has arrested a ring of agents working for the ${formalName(game.countries[ctx.other])}.`,
    options: [
      { label: 'Expel their diplomats', fx: { approval: 2 }, run: (game, c, ctx) => { addRel(game, c.id, ctx.other, -25); return 'Relations −25.'; } },
      { label: 'Turn them into double agents', fx: { pc: 10 } },
      { label: 'Quietly trade them back', fx: {}, run: (game, c, ctx) => { addRel(game, c.id, ctx.other, 10); return 'Relations +10.'; } },
    ],
  },
  {
    id: 'inflation', title: 'Inflation Spiral', weight: 1,
    cond: (game, c) => c.budget && c.budget.net < 0 && c.treasury < 0,
    text: () => 'Years of deficits are catching up with us. Prices are climbing every week and the central bank wants a decision.',
    options: [
      { label: 'Austerity: cut welfare by 2%', fx: { workers: -10, business: 5, approval: -4 }, run: (game, c) => { c.policy.welfare = clamp(c.policy.welfare - 2, 0, 25); } },
      { label: 'Print money', fx: { money: 0.01, approval: -3 }, run: (game, c) => { addMod(c, 'growth', -0.001, 6, 'Inflation'); } },
    ],
  },
  {
    id: 'royalWedding', title: 'A Royal Wedding', weight: 0.8,
    cond: (game, c) => c.gov === 'absMonarchy' || c.gov === 'constMonarchy',
    text: () => 'The heir to the throne is to be married. The court is planning the celebrations.',
    options: [
      { label: 'A lavish ceremony', fx: { money: -0.004, approval: 6, legitimacy: 5 } },
      { label: 'A modest affair', fx: { business: 3, legitimacy: 1 } },
    ],
  },
  {
    id: 'plot', title: 'Officers Plotting', weight: 1,
    cond: (game, c) => c.factions.military < 40 && !free(c),
    text: () => 'Our secret police report that a group of colonels is meeting in secret. They may be planning a coup.',
    options: [
      { label: 'Purge the conspirators', fx: { military: 8, stability: -3 }, run: (game, c) => { c.army *= 0.92; } },
      { label: 'Buy them off', fx: { money: -0.006, military: 15 } },
      {
        label: 'Ignore the rumors', fx: {},
        run: (game, c) => {
          if (game.rng.chance(0.4)) { changeGovernment(game, c, c.gov === 'junta' ? 'fascist' : 'junta', 'coup'); return 'The rumors were true.'; }
          return 'Nothing comes of it, for now.';
        },
      },
    ],
  },
  {
    id: 'agitation', title: 'Socialist Agitation', weight: 0.8,
    cond: (game, c) => c.ideo.econ < -0.25 && c.gov !== 'communist',
    text: () => 'Radical pamphlets and workers\' councils are spreading through the industrial districts, calling for the means of production to be seized.',
    options: [
      { label: 'Legalize independent unions', fx: { workers: 12, business: -8, econ: -0.03 } },
      { label: 'Ban the agitators', fx: { workers: -10, freedom: -4, unrest: -5 } },
    ],
  },
  {
    id: 'march', title: 'Nationalist March', weight: 0.8,
    cond: (game, c) => c.ideo.auth > 0.25 && c.gov !== 'fascist',
    text: (game, c) => `Columns of uniformed nationalists march through ${capitalName(game, c)}, demanding "strong leadership" and the return of lost glory.`,
    options: [
      { label: 'Tolerate them', fx: { military: 4, intelligentsia: -6, auth: 0.03 } },
      { label: 'Ban paramilitary groups', fx: { intelligentsia: 5, military: -4, unrest: 4 } },
    ],
  },
  {
    id: 'techBreakthrough', title: 'Scientific Breakthrough', weight: 0.6,
    cond: (game, c) => c.policy.education >= 4,
    text: () => 'Researchers at our national university have made a discovery with major industrial applications.',
    options: [
      { label: 'Fund commercialization', fx: { money: -0.003, business: 6 }, run: (game, c) => { addMod(c, 'growth', 0.0015, 12, 'Innovation'); return 'Growth boosted for a year.'; } },
      { label: 'Celebrate our scholars', fx: { intelligentsia: 10, approval: 2 } },
    ],
  },
];

function maybeEvent(game, c) {
  const cands = EVENTS.filter(e => !game.lastEvents.includes(e.id) && e.cond(game, c));
  if (!cands.length) return;
  const ev = game.rng.weighted(cands, e => e.weight);
  const ctx = ev.setup ? ev.setup(game, c) : {};
  game.lastEvents.push(ev.id);
  if (game.lastEvents.length > 5) game.lastEvents.shift();
  game.pending.push({ type: 'event', id: ev.id, ctx, text: ev.text(game, c, ctx) });
}

function resolveEvent(game, item, optIndex) {
  const ev = EVENTS.find(e => e.id === item.id);
  const c = game.countries[game.player];
  const opt = ev.options[optIndex];
  adjust(c, opt.fx);
  const extra = opt.run ? opt.run(game, c, item.ctx) : '';
  logNews(game, `${ev.title}: ${opt.label}.${extra ? ' ' + extra : ''}`, 'event', [c.id]);
  return extra || '';
}
