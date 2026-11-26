'use strict';
// Events for the player's nation.
//
// An event: { id, title, weight, cond(game,c), setup(game,c) -> ctx,
//   text(game,c,ctx), speaker(game,c,ctx) -> character (shown with portrait),
//   once (fires at most once per game), triggered (never random: only fired by
//   scheduleEvent or another event's `next`), options: [...] }
// An option: { label, fx (instant changes shown to the player), run(game,c,ctx)
//   -> extra outcome text, cond(game,c,ctx) (option only shown if true),
//   flag ('name' sets a story flag), next: { id, delay, ctx } (schedules a follow-up) }

function capitalName(game, c) { return game.world.provinces[c.capital].name; }
function randomProvince(game, c) { return game.rng.pick(provincesOf(game, c.id)).name; }
function strongestOpposition(c) {
  const polls = computePolls(c);
  let best = null, bv = -1;
  c.parties.forEach((p, i) => { if (p.id !== c.rulingParty && polls[i] > bv) { bv = polls[i]; best = p; } });
  return best;
}

function setFlag(game, k, v) { game.flags = game.flags || {}; game.flags[k] = v === undefined ? true : v; }
function getFlag(game, k) { return game.flags ? game.flags[k] : undefined; }

function scheduleEvent(game, id, delay, ctx) {
  game.scheduled = game.scheduled || [];
  game.scheduled.push({ id, month: game.month + (delay || 0), ctx: ctx || {}, cid: game._actor != null ? game._actor : undefined });
}

function minister(c, pred) { return POST_KEYS.map(p => c.cabinet[p]).filter(Boolean).find(pred) || null; }
function postOf(c, ch) { return POST_KEYS.find(p => c.cabinet[p] === ch) || null; }
function charById(c, id) { return findCharacter(c, id); }

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
    cond: (game, c) => free(c) && !!strongestOpposition(c) && !!strongestOpposition(c).leader,
    speaker: (game, c) => strongestOpposition(c).leader,
    text: (game, c) => `${strongestOpposition(c).leader.name}, leader of the ${strongestOpposition(c).name}, is drawing record crowds and climbing in the polls. Their speeches are the talk of every café.`,
    options: [
      { label: 'Let democracy run its course', fx: { legitimacy: 3 }, run: (game, c) => { strongestOpposition(c).boost += 0.3; } },
      { label: 'Run a smear campaign', fx: { pc: -15, freedom: -3 }, run: (game, c) => { strongestOpposition(c).boost += 0.08; } },
      { label: 'Have them arrested', fx: { freedom: -12, intelligentsia: -20, legitimacy: -15, approval: -8 }, run: (game, c) => { const p = strongestOpposition(c); p.leader = makeOpposition(game, c, p); return 'A new leader takes over the party.'; } },
    ],
  },
  {
    id: 'assassination', title: 'Assassination Attempt', weight: 0.8,
    cond: (game, c) => c.stability < 45,
    speaker: (game, c) => c.leader,
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
    cond: (game, c) => !free(c) && c.generals.some(g => g.loyalty < 30),
    setup: (game, c) => ({ gen: c.generals.slice().sort((a, b) => a.loyalty - b.loyalty)[0].id }),
    speaker: (game, c, ctx) => charById(c, ctx.gen),
    text: (game, c, ctx) => `Our secret police report that General ${charById(c, ctx.gen).name} has been meeting colonels in secret. They may be planning a coup.`,
    options: [
      { label: 'Arrest the general', fx: { military: -6, stability: -3 }, run: (game, c, ctx) => { const g = charById(c, ctx.gen); c.generals = c.generals.filter(x => x !== g); c.generals.push(makeGeneral(game, c)); c.army *= 0.95; return 'The plot is broken up.'; } },
      { label: 'Buy their loyalty', fx: { money: -0.006 }, run: (game, c, ctx) => { const g = charById(c, ctx.gen); if (g) { g.favor += 25; g.loyalty += 20; } return 'The general is suddenly very well off.'; } },
      {
        label: 'Ignore the rumors', fx: {},
        run: (game, c, ctx) => {
          const g = charById(c, ctx.gen);
          if (g && game.rng.chance(0.4)) { generalCoup(game, c, g); return 'The rumors were true.'; }
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
  // ---------------------------------------------------- character-driven events
  {
    id: 'ministerScandal', title: 'A Minister Caught Out', weight: 1.1,
    cond: (game, c) => !!minister(c, m => m.traits.includes('corrupt') || m.loyalty < 35),
    setup: (game, c) => ({ min: minister(c, m => m.traits.includes('corrupt') || m.loyalty < 35).id }),
    speaker: (game, c, ctx) => charById(c, ctx.min),
    text: (game, c, ctx) => { const m = charById(c, ctx.min); return `Investigators have found that ${m.name}, our ${CABINET_POSTS[postOf(c, m)].name}, has been steering state contracts to friends. Only a handful of officials know, so far.`; },
    options: [
      { label: 'Dismiss them quietly', fx: { corruption: -4 }, run: (game, c, ctx) => { const m = charById(c, ctx.min); const p = postOf(c, m); if (p) c.cabinet[p] = null; if (m.faction) c.factions[m.faction] = clamp(c.factions[m.faction] - 6, 0, 100); return 'The post is now vacant.'; } },
      { label: 'Make them pay it back', fx: { pc: -10, money: 0.002 }, run: (game, c, ctx) => { const m = charById(c, ctx.min); if (m) m.favor -= 10; } },
      { label: 'Protect them', fx: { corruption: 4 }, run: (game, c, ctx) => { const m = charById(c, ctx.min); if (m) m.favor += 15; }, next: (game) => (game.rng.chance(0.45) ? { id: 'scandalBreaks', delay: game.rng.int(2, 6) } : null) },
    ],
  },
  {
    id: 'scandalBreaks', title: 'The Story Breaks', weight: 0, triggered: true,
    speaker: (game, c, ctx) => charById(c, ctx.min),
    text: (game, c, ctx) => { const m = charById(c, ctx.min); return `Every newspaper carries the same front page: the contracts scandal${m ? ` around ${m.name}` : ''}, and the government's cover-up. Opposition deputies demand answers.`; },
    options: [
      { label: 'Throw them to the wolves', fx: { approval: -4, corruption: -3 }, run: (game, c, ctx) => { const m = charById(c, ctx.min); const p = m && postOf(c, m); if (p) c.cabinet[p] = null; } },
      { label: 'Deny everything', fx: { approval: -9, legitimacy: -8 } },
      { label: 'Shut down the papers', fx: { freedom: -10, intelligentsia: -15, approval: -3 }, cond: (game, c) => !free(c) || c.emergency },
    ],
  },
  {
    id: 'generalUltimatum', title: 'The General\'s Ultimatum', weight: 1,
    cond: (game, c) => c.generals.some(g => g.loyalty < 32),
    setup: (game, c) => ({ gen: c.generals.slice().sort((a, b) => a.loyalty - b.loyalty)[0].id }),
    speaker: (game, c, ctx) => charById(c, ctx.gen),
    text: (game, c, ctx) => { const g = charById(c, ctx.gen); return `General ${g.name} arrives unannounced with a list of demands. "The army has been neglected long enough. Give us what we need, or I cannot answer for my officers."`; },
    options: [
      { label: 'Make them Minister of Defense', fx: {}, run: (game, c, ctx) => { const g = charById(c, ctx.gen); c.generals = c.generals.filter(x => x !== g); const old = c.cabinet.defense; if (old && old.faction) c.factions[old.faction] = clamp(c.factions[old.faction] - 4, 0, 100); g.loyalty = 70; g.since = game.month; installMinister(c, 'defense', g); c.generals.push(makeGeneral(game, c)); return `${g.name} joins the cabinet.`; } },
      { label: 'Raise military spending by 1.5% of GDP', fx: { military: 10 }, run: (game, c, ctx) => { c.policy.military = clamp(c.policy.military + 1.5, 0, 12); const g = charById(c, ctx.gen); if (g) g.favor += 25; } },
      { label: 'Promise to consider it', fx: { pc: -5 }, run: (game, c, ctx) => { const g = charById(c, ctx.gen); if (g) g.favor += 10; }, next: { id: 'generalReturns', delay: 4 } },
      {
        label: 'Retire them on the spot', fx: { military: -8 },
        run: (game, c, ctx) => {
          const g = charById(c, ctx.gen);
          if (!g) return '';
          if (c.factions.military < 45 && game.rng.chance(0.35)) { generalCoup(game, c, g); return 'The general refuses and marches on the capital!'; }
          c.generals = c.generals.filter(x => x !== g); c.generals.push(makeGeneral(game, c));
          return 'The general salutes stiffly and leaves.';
        },
      },
    ],
  },
  {
    id: 'generalReturns', title: 'The General Returns', weight: 0, triggered: true,
    speaker: (game, c, ctx) => charById(c, ctx.gen),
    text: (game, c, ctx) => { const g = charById(c, ctx.gen); return g ? `General ${g.name} is back. "You asked for time. Time is up."` : 'The general who threatened us has left the army.'; },
    options: [
      { label: 'Give the army its budget', fx: { military: 12 }, run: (game, c, ctx) => { c.policy.military = clamp(c.policy.military + 1.5, 0, 12); const g = charById(c, ctx.gen); if (g) g.favor += 25; } },
      {
        label: 'Call their bluff', fx: {},
        run: (game, c, ctx) => {
          const g = charById(c, ctx.gen);
          if (g && g.loyalty < 30 && game.rng.chance(0.45)) { generalCoup(game, c, g); return 'It was not a bluff.'; }
          if (g) g.favor -= 10;
          return 'The general backs down, for now.';
        },
      },
    ],
  },
  {
    id: 'ministerResigns', title: 'A Threat to Resign', weight: 0.8,
    cond: (game, c) => !!minister(c, m => m.loyalty < 25),
    setup: (game, c) => ({ min: minister(c, m => m.loyalty < 25).id }),
    speaker: (game, c, ctx) => charById(c, ctx.min),
    text: (game, c, ctx) => { const m = charById(c, ctx.min); return `${m.name} has drafted a resignation letter attacking the government's direction. Released to the press, it would be embarrassing.`; },
    options: [
      { label: 'Accept the resignation', fx: { approval: -3 }, run: (game, c, ctx) => { const m = charById(c, ctx.min); const p = postOf(c, m); if (p) c.cabinet[p] = null; } },
      { label: 'Win them back with concessions', fx: { pc: -10 }, run: (game, c, ctx) => { const m = charById(c, ctx.min); if (m) { m.favor += 25; m.loyalty += 15; if (m.faction) c.factions[m.faction] = clamp(c.factions[m.faction] + 4, 0, 100); } } },
    ],
  },
  {
    id: 'debate', title: 'The Great Debate', weight: 1.2,
    cond: (game, c) => free(c) && !c.emergency && c.nextElection - game.month <= 8 && c.nextElection - game.month >= 1 && !!strongestOpposition(c) && !!strongestOpposition(c).leader,
    setup: (game, c) => ({ party: strongestOpposition(c).id }),
    speaker: (game, c, ctx) => c.parties.find(p => p.id === ctx.party).leader,
    text: (game, c, ctx) => { const p = c.parties.find(x => x.id === ctx.party); return `With the election approaching, ${p.leader.name} of the ${p.name} challenges ${c.leader.name} to a live radio debate. The whole country will be listening.`; },
    options: [
      {
        label: 'Go on the attack', fx: {},
        run: (game, c, ctx) => {
          const p = c.parties.find(x => x.id === ctx.party), mine = rulingPartyObj(c);
          const win = game.rng.chance(clamp(0.5 + (c.leader.skills.cha - (p.leader ? p.leader.skills.cha : 5)) * 0.08, 0.1, 0.9));
          if (win) { mine.boost += 0.25; return `${c.leader.name} wins the debate decisively.`; }
          p.boost += 0.25; return `${c.leader.name} is outclassed. The opposition surges.`;
        },
      },
      {
        label: 'Stick to the economic record', fx: {},
        run: (game, c, ctx) => {
          const p = c.parties.find(x => x.id === ctx.party), mine = rulingPartyObj(c);
          if (c.growthAvg > 0.001 && c.econ.unemployment < 0.06) { mine.boost += 0.2; return 'Voters like what they hear about the economy.'; }
          p.boost += 0.15; return 'The record is hard to defend.';
        },
      },
      { label: 'Decline the debate', fx: { approval: -2 }, run: (game, c, ctx) => { c.parties.find(x => x.id === ctx.party).boost += 0.1; } },
    ],
  },
  {
    id: 'manifesto', title: 'A Dissident\'s Manifesto', weight: 1,
    cond: (game, c) => (c.dissidents || []).some(d => d.popularity > 25),
    setup: (game, c) => ({ dis: c.dissidents.slice().sort((a, b) => b.popularity - a.popularity)[0].id }),
    speaker: (game, c, ctx) => charById(c, ctx.dis),
    text: (game, c, ctx) => { const d = charById(c, ctx.dis); return `Copies of a manifesto by ${d.name} are passing from hand to hand, demanding ${d.ideo.auth < 0 ? 'free elections and a free press' : 'an end to the regime\'s corruption'}. Students are reading it aloud in the squares.`; },
    options: [
      { label: 'Arrest the author', fx: { intelligentsia: -10, freedom: -6 }, run: (game, c, ctx) => { const d = charById(c, ctx.dis); c.dissidents = c.dissidents.filter(x => x !== d); adjust(c, { unrest: d.popularity > 45 ? 10 : -5 }); return d.popularity > 45 ? 'Their followers riot.' : 'The movement loses its voice.'; } },
      { label: 'Open a dialogue', fx: { freedom: 4, intelligentsia: 6, pc: -10 }, run: (game, c, ctx) => { const d = charById(c, ctx.dis); if (d) d.popularity *= 0.6; }, next: { id: 'dialogue', delay: 6 } },
      { label: 'Ignore it', fx: {}, run: (game, c, ctx) => { const d = charById(c, ctx.dis); if (d) d.popularity += 10; } },
    ],
  },
  {
    id: 'dialogue', title: 'The Round Table', weight: 0, triggered: true,
    speaker: (game, c, ctx) => charById(c, ctx.dis),
    text: (game, c, ctx) => { const d = charById(c, ctx.dis); return `${d ? d.name : 'The dissidents'} and the government's delegates have talked for months. They now propose a deal: legal opposition parties and elections within a year, in exchange for an end to the protests.`; },
    options: [
      { label: 'Accept: begin a democratic transition', fx: { approval: 8, intelligentsia: 15 }, run: (game, c) => { changeGovernment(game, c, c.gov === 'absMonarchy' ? 'constMonarchy' : 'democracy', 'reform', { keepLeader: true }); return `The ${formalName(c)} is proclaimed.`; } },
      { label: 'Offer token reforms', fx: { freedom: 5, pc: -10 } },
      { label: 'Break off the talks', fx: { unrest: 15, intelligentsia: -15 } },
    ],
  },
  {
    id: 'petition', title: 'A Petition to the Government', weight: 1.1,
    cond: (game, c) => !c.reform && !!petitionTarget(c),
    text: (game, c) => { const t = petitionTarget(c); return `Leaders of the ${FACTIONS[t.f].name.toLowerCase()} have delivered a petition with thousands of signatures. They demand a new law: ${LAW_CATS[t.cat].opts[t.opt].name.toLowerCase()} (${LAW_CATS[t.cat].opts[t.opt].desc.toLowerCase()}) and warn that their patience is wearing thin.`; },
    options: [
      { label: 'Put their bill before the government', fx: {}, run: (game, c) => { const t = petitionTarget(c); if (!t) return ''; proposeLaw(game, c, t.cat, t.opt, true); c.factions[t.f] = clamp(c.factions[t.f] + 8, 0, 100); return 'The bill is introduced at no cost in political capital. Follow it in the Politics tab.'; } },
      { label: 'Promise to consider it', fx: { pc: -5 }, run: (game, c) => { const t = petitionTarget(c); if (t) c.factions[t.f] = clamp(c.factions[t.f] + 3, 0, 100); } },
      { label: 'Refuse', fx: {}, run: (game, c) => { const t = petitionTarget(c); if (t) { c.factions[t.f] = clamp(c.factions[t.f] - 10, 0, 100); c.unrest = clamp(c.unrest + 4, 0, 100); } } },
    ],
  },
  // ---- Constitutional crises
  {
    id: 'termLimit', title: 'The Question of a Third Term', weight: 3,
    cond: (game, c) => GOVS[c.gov].elections === 'free' && c.leader.role === 'leader' && game.month - (c.leader.since || 0) >= 96 && !getFlag(game, 'term:' + c.leader.id),
    speaker: (game, c) => c.cabinet.chief || null,
    text: (game, c) => `${c.leader.name} has led the nation for ${Math.floor((game.month - (c.leader.since || 0)) / 12)} years, and the constitution allows no more. Loyalists are drafting an amendment; the courts and the press are watching.`,
    options: [
      { label: 'Respect the limit: step aside for a successor', ai: (game, c) => 2.2 - (c.leader.ambition || 50) / 50, fx: { legitimacy: 8, intelligentsia: 6 }, run: (game, c) => { const old = c.leader.name; c.leader = makeLeader(game, c); setFlag(game, 'term:' + c.leader.id); return `${old} retires to applause. ${c.leader.name} takes over.`; } },
      { label: 'Amend the constitution', ai: (game, c) => (c.leader.ambition || 50) / 60 * c.approval / 55, cond: (game, c) => c.pc >= 20, fx: { pc: -20, legitimacy: -12, intelligentsia: -15 }, run: (game, c) => { setFlag(game, 'term:' + c.leader.id); scheduleEvent(game, 'impeachment', 8, { why: 'term' }); return 'The amendment passes, narrowly. The opposition vows to fight on.'; } },
      { label: 'Suspend the limit under emergency powers', ai: (game, c) => (c.leader.ambition || 50) / 100 * c.factions.military / 70 * (c.ideo.auth + 1) * 0.6, fx: { legitimacy: -20, freedom: -10, military: 5 }, run: (game, c) => { setFlag(game, 'term:' + c.leader.id); c.emergency = true; scheduleEvent(game, 'exception', 10, {}); return 'A state of emergency is declared. Elections are postponed.'; } },
    ],
  },
  {
    id: 'impeachment', title: 'Impeachment Proceedings', weight: 1.5,
    cond: (game, c) => GOVS[c.gov].elections === 'free' && c.approval < 30 && c.legitimacy < 55,
    speaker: (game, c) => { const p = c.parties.find(x => x.id !== c.rulingParty && x.leader); return p ? p.leader : null; },
    text: (game, c, ctx) => `${ctx.why === 'term' ? 'Outraged by the term-limit amendment, the' : 'With the government\'s approval collapsing, the'} opposition has moved to impeach ${c.leader.name}. Parliament will vote within weeks.`,
    options: [
      { label: 'Fight the vote in parliament', fx: {}, run: (game, c) => {
        const seats = c.lastElection && !c.lastElection.sham ? seatsOf(c.lastElection) : {};
        const mine = (seats[c.rulingParty] || 0) + ((c.coalition && c.coalition.partners) || []).reduce((t, p) => t + (seats[p.id] || 0), 0);
        const chance = clamp(mine / 200 + 0.15 + (c.approval - 30) / 100, 0.1, 0.9);
        if (game.rng.chance(chance)) { adjust(c, { legitimacy: -5 }); return `The motion fails: ${c.leader.name} survives, bruised.`; }
        const old = c.leader.name; c.leader = makeLeader(game, c); adjust(c, { stability: -8, legitimacy: 5 });
        return `Impeached. ${old} is removed from office; ${c.leader.name} takes over.`;
      } },
      { label: 'Resign with dignity', fx: { stability: 4, approval: 6 }, run: (game, c) => { const old = c.leader.name; c.leader = makeLeader(game, c); return `${old} resigns. ${c.leader.name} forms a new government.`; } },
      { label: 'Dissolve parliament and call elections', fx: { legitimacy: -10, stability: -4 }, run: (game, c) => { c.nextElection = Math.min(c.nextElection, game.month + 3); return 'Parliament is dissolved. The country votes in three months.'; } },
    ],
  },
  {
    id: 'succession', title: 'A Disputed Succession', weight: 2,
    cond: (game, c) => c.gov === 'absMonarchy' && c.leader.age >= 66 && c.heir && (c.generals || []).length > 0 && !getFlag(game, 'succ:' + c.leader.id),
    speaker: (game, c) => c.heir,
    text: (game, c) => { const gen = (c.generals || []).slice().sort((a, b) => b.ambition - a.ambition)[0]; return `${c.leader.name} is ${c.leader.age} and failing. The court whispers that ${c.heir.name}, aged ${c.heir.age}, is not ready, and ${gen.name} lets it be known that the army would prefer a firmer hand.`; },
    options: [
      { label: 'Confirm the heir before the court', fx: { legitimacy: 6, military: -6, clergy: 4 }, run: (game, c) => { setFlag(game, 'succ:' + c.leader.id); c.heir.loyalty = clamp(c.heir.loyalty + 15, 0, 100); } },
      { label: 'Name the general as successor', fx: { military: 12, legitimacy: -10, clergy: -8 }, run: (game, c) => { setFlag(game, 'succ:' + c.leader.id); const gen = c.generals.slice().sort((a, b) => b.ambition - a.ambition)[0]; c.generals = c.generals.filter(x => x !== gen); gen.role = 'heir'; c.heir = gen; return `${gen.name} is proclaimed heir. The old dynasty's partisans seethe.`; } },
      { label: 'Grant a constitution to secure the throne', fx: { intelligentsia: 12, legitimacy: 4, pc: -10 }, run: (game, c) => { setFlag(game, 'succ:' + c.leader.id); changeGovernment(game, c, 'constMonarchy', 'reform', { keepLeader: true }); return `The ${formalName(c)} is proclaimed: the crown is safe, its power shared.`; } },
    ],
  },
  {
    id: 'exception', title: 'The State of Exception', weight: 2,
    cond: (game, c) => c.emergency && GOVS[c.gov].elections === 'free',
    speaker: (game, c) => c.cabinet.interior || null,
    text: () => 'The emergency was meant to last weeks. It has lasted months. Judges are refusing to sign decrees, and generals ask whether the constitution still binds them.',
    options: [
      { label: 'Lift the emergency and restore the constitution', ai: (game, c) => 0.6 + c.legitimacy / 80, fx: { legitimacy: 8, intelligentsia: 8, unrest: 4 }, run: (game, c) => { c.emergency = false; } },
      { label: 'Extend it another year', fx: { legitimacy: -6, freedom: -5 }, run: (game, c) => { scheduleEvent(game, 'exception', 12, {}); } },
      { label: 'Suspend the constitution for good', ai: (game, c) => c.factions.military / 100 * (c.ideo.auth + 1) * 0.7 * (c.leader.ambition || 50) / 60, fx: { military: 8, intelligentsia: -20 }, run: (game, c) => { c.emergency = false; changeGovernment(game, c, c.ideo.econ < -0.3 ? 'communist' : c.ideo.econ > 0.3 ? 'fascist' : 'junta', 'coup', { keepLeader: true }); return `The republic is over. The ${formalName(c)} takes its place.`; } },
    ],
  },
  {
    id: 'summit', title: 'An Invitation to a Summit', weight: 0.9,
    cond: (game, c) => game.countries.some(o => o.alive && o.id !== c.id && relation(game, c.id, o.id) > 0 && !atWarWith(game, c.id, o.id)),
    setup: (game, c) => ({ other: game.rng.pick(game.countries.filter(o => o.alive && o.id !== c.id && relation(game, c.id, o.id) > 0 && !atWarWith(game, c.id, o.id))).id }),
    speaker: (game, c, ctx) => game.countries[ctx.other].leader,
    text: (game, c, ctx) => { const o = game.countries[ctx.other]; return `${leaderLine(o)} of the ${formalName(o)} invites ${c.leader.name} to a summit at a lakeside villa. "Our nations have more in common than our newspapers admit."`; },
    options: [
      {
        label: 'Attend and negotiate', fx: { pc: -5 },
        run: (game, c, ctx) => {
          const o = game.countries[ctx.other];
          const good = game.rng.chance(clamp(0.45 + (c.leader.skills.diplo - 5) * 0.07 + (o.leader.skills.diplo - 5) * 0.04, 0.1, 0.9));
          if (!good) { addRel(game, c.id, o.id, 5); return 'Pleasant, but nothing comes of it.'; }
          addRel(game, c.id, o.id, 20);
          if (!c.trade.includes(o.id)) { c.trade.push(o.id); o.trade.push(c.id); return 'A breakthrough: relations +20 and a trade agreement.'; }
          return 'A breakthrough: relations +20.';
        },
      },
      { label: 'Send the Foreign Minister', fx: {}, cond: (game, c) => !!c.cabinet.foreign, run: (game, c, ctx) => { addRel(game, c.id, ctx.other, 4 + c.cabinet.foreign.skills.diplo); return `Relations +${4 + c.cabinet.foreign.skills.diplo}.`; } },
      { label: 'Decline', fx: {}, run: (game, c, ctx) => { addRel(game, c.id, ctx.other, -8); return 'Relations −8.'; } },
    ],
  },
  {
    id: 'heirTrouble', title: 'The Heir Misbehaves', weight: 0.8,
    cond: (game, c) => !!c.heir && c.heir.age >= 16,
    speaker: (game, c) => c.heir,
    text: (game, c) => `${c.heir.name} has been seen in gambling dens and has run up debts across the capital. The court is scandalized.`,
    options: [
      { label: 'Pay the debts and hush it up', fx: { money: -0.002, legitimacy: -2 } },
      { label: 'Send them to military academy', fx: { legitimacy: 2 }, run: (game, c) => { if (!c.heir.traits.includes('warHero') && c.heir.traits.length < 3) c.heir.traits.push('militarist'); c.heir.skills.mil = clamp(c.heir.skills.mil + 2, 1, 10); return 'The heir returns disciplined and martial.'; } },
      { label: 'Let them be', fx: { legitimacy: -4 }, run: (game, c) => { if (!c.heir.traits.includes('corrupt') && !c.heir.traits.includes('honest') && c.heir.traits.length < 3) c.heir.traits.push('corrupt'); return 'The heir grows up spoiled.'; } },
    ],
  },
];

function eventById(id) { return EVENTS.find(e => e.id === id); }

function presentEvent(game, c, ev, ctx) {
  ctx = ctx || {};
  if (ev.setup && !ctx._setup) ctx = Object.assign({}, ev.setup(game, c, ctx), ctx, { _setup: true });
  const sp = ev.speaker ? ev.speaker(game, c, ctx) : null;
  game.pending.push({ type: 'event', id: ev.id, ctx, text: ev.text(game, c, ctx), charId: sp ? sp.id : null });
  if (ev.once) setFlag(game, 'seen:' + ev.id);
}

// Scheduled and chained events fire first; otherwise there is a chance of a random one.
function runScheduledEvents(game, c) {
  if (!game.scheduled || !game.scheduled.length) return;
  const mine = e => e.cid == null || e.cid === game.player;
  const due = game.scheduled.filter(e => mine(e) && e.month <= game.month);
  game.scheduled = game.scheduled.filter(e => !due.includes(e));
  for (const d of due) {
    const ev = eventById(d.id);
    if (ev && (!ev.cond || !ev.condOnSchedule || ev.cond(game, c, d.ctx))) presentEvent(game, c, ev, d.ctx);
  }
}

function maybeEvent(game, c) {
  const cands = EVENTS.filter(e => !e.triggered && !game.lastEvents.includes(e.id) && !(e.once && getFlag(game, 'seen:' + e.id)) && e.cond(game, c));
  if (!cands.length) return;
  const ev = game.rng.weighted(cands, e => e.weight);
  game.lastEvents.push(ev.id);
  if (game.lastEvents.length > 6) game.lastEvents.shift();
  presentEvent(game, c, ev, {});
}

function eventOptions(game, c, item) {
  const ev = eventById(item.id);
  return ev.options.map((o, i) => ({ o, i })).filter(x => !x.o.cond || x.o.cond(game, c, item.ctx));
}

function resolveEvent(game, item, optIndex) {
  const ev = eventById(item.id);
  const c = game.countries[game.player];
  const opt = ev.options[optIndex];
  adjust(c, opt.fx || {});
  const extra = opt.run ? opt.run(game, c, item.ctx) : '';
  if (opt.flag) setFlag(game, opt.flag);
  const next = typeof opt.next === 'function' ? opt.next(game, c, item.ctx) : opt.next;
  if (next) scheduleEvent(game, next.id, next.delay || 0, Object.assign({}, item.ctx, next.ctx || {}, { _setup: false }));
  logNews(game, `${ev.title}: ${opt.label}.${extra ? ' ' + extra : ''}`, 'event', [c.id]);
  return extra || '';
}
