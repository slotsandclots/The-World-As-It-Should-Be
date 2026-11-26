'use strict';
// "The First Republic": a story campaign that doubles as the tutorial.
//
// The campaign builds a small world from a fixed seed, then dresses it up: the
// player's nation becomes the young Republic of Velmora with a scripted cast,
// a hostile junta next door and a friendly monarchy beyond. Steps are
// objectives checked against the live simulation, each with a briefing in
// dialogue. The campaign never takes control away: you can play ahead, and any
// objective you've already met completes as soon as it comes up.
//
// game.campaign = { id, step, stepStart, cast{key: charId}, nations{key: id},
//   tabsSeen[], actions{}, flags{}, ended, ending, briefed }

const CAMPAIGN_CAST = {
  mara: { first: 'Mara', last: 'Elsen', female: true, age: 41, traits: ['loyal', 'charismatic'], skills: { admin: 6, diplo: 5, mil: 2, cha: 8 }, faction: 'intelligentsia' },
  ilse: { first: 'Ilse', last: 'Varga', female: true, age: 47, traits: ['technocrat', 'honest'], skills: { admin: 8, diplo: 4, mil: 2, cha: 4 }, faction: 'business' },
  stoll: { first: 'Radek', last: 'Stoll', female: false, age: 56, traits: ['ambitious', 'warHero'], skills: { admin: 4, diplo: 3, mil: 8, cha: 6 }, faction: 'military' },
  lena: { first: 'Lena', last: 'Kovar', female: true, age: 44, traits: ['populist', 'charismatic'], skills: { admin: 5, diplo: 5, mil: 2, cha: 8 } },
  maal: { first: 'Viktor', last: 'Maal', female: false, age: 58, traits: ['militarist', 'cruel'], skills: { admin: 4, diplo: 3, mil: 7, cha: 5 } },
  sol: { first: 'Henrike', last: 'Sol', female: true, age: 50, traits: ['diplomat', 'cautious'], skills: { admin: 6, diplo: 8, mil: 3, cha: 6 } },
  rusk: { first: 'Pavel', last: 'Rusk', female: false, age: 39, traits: ['populist', 'charismatic'], skills: { admin: 4, diplo: 4, mil: 3, cha: 8 }, faction: 'workers' },
  halden: { first: 'Teodor', last: 'Halden', female: false, age: 52, traits: ['reformer', 'cautious'], skills: { admin: 6, diplo: 6, mil: 3, cha: 6 } },
};

function scriptCharacter(game, c, key, role, extra) {
  const T = CAMPAIGN_CAST[key];
  const ch = makeCharacter(game, c, Object.assign({ role, faction: T.faction || null, traits: T.traits.slice() }, extra || {}));
  Object.assign(ch, { first: T.first, last: T.last, name: `${T.first} ${T.last}`, female: T.female, age: T.age, skills: Object.assign({}, T.skills) });
  game.campaign.cast[key] = ch.id;
  return ch;
}

function campaignChar(game, key) {
  const id = game.campaign && game.campaign.cast[key];
  if (!id) return null;
  for (const c of game.countries) { const ch = findCharacter(c, id); if (ch) return ch; }
  return null;
}

function renameNation(c, name, adj) {
  const oldAdj = c.adj;
  c.name = name; c.adj = adj;
  for (const p of c.parties) p.name = p.name.replace(oldAdj, adj);
}

function startCampaign() {
  const game = createGame('velmora-1950', { model: 'continents', size: 'small', countries: 9 });
  game.campaign = { id: 'firstRepublic', step: 0, stepStart: 0, cast: {}, nations: {}, tabsSeen: [], actions: {}, flags: {}, ended: false, ending: null, briefed: -1 };
  const cs = game.campaign;
  // Velmora: a mid-sized nation with several neighbors.
  const pick = game.countries.filter(c => getNeighbors(game, c.id).length >= 2)
    .sort((a, b) => Math.abs(a.provinceCount - 9) - Math.abs(b.provinceCount - 9))[0] || game.countries[0];
  const v = pick;
  renameNation(v, 'Velmora', 'Velmoran');
  if (v.gov !== 'democracy') changeGovernment(game, v, 'democracy', 'reform');
  game.stats.regimeChanges = 0;
  const ruling = v.parties.find(p => p.id === 'centre') || v.parties.find(p => p.id === 'lib') || v.parties[0];
  v.rulingParty = ruling.id;
  ruling.name = 'Republican Union';
  ruling.leader = null;
  v.leader = scriptCharacter(game, v, 'halden', 'leader', { party: ruling.id });
  v.leader.since = 0;
  const opp = v.parties.find(p => p.id === 'socdem') || v.parties.find(p => p.id !== ruling.id);
  opp.leader = scriptCharacter(game, v, 'lena', 'opposition', { party: opp.id, ideo: opp });
  v.cabinet = {};
  initCharacters(game, v);
  v.cabinet.chief = scriptCharacter(game, v, 'mara', 'minister', { post: 'chief' });
  v.cabinet.chief.post = 'chief';
  v.cabinet.chief.loyalty = 85;
  v.cabinet.finance = null;
  const ilse = scriptCharacter(game, v, 'ilse', 'minister', { post: 'finance', loyalty: 62 });
  candidatesFor(game, v, 'finance').unshift(ilse);
  v.generals[0] = scriptCharacter(game, v, 'stoll', 'general', { loyalty: 48 });
  v.generals[0].ambition = 80;
  // A treasury in trouble and a nervous public.
  Object.assign(v.policy, { tax: 0.22, welfare: 13, education: 4, police: 1.2, military: 2.4, infrastructure: 3.5, investment: 1 });
  v.treasury = v.gdp * 0.03;
  v.stability = 52; v.approval = 54; v.legitimacy = 58;
  v.nextElection = 40;
  v.pc = 40;
  cs.nations.velmora = v.id;

  // Drevany: a junta next door with designs on Velmoran land.
  const nb = getNeighbors(game, v.id).map(id => game.countries[id]).sort((a, b) => b.provinceCount - a.provinceCount);
  const d = nb[0];
  renameNation(d, 'Drevany', 'Drevanian');
  if (d.gov !== 'junta') changeGovernment(game, d, 'junta', 'coup');
  d.leader = scriptCharacter(game, d, 'maal', 'leader');
  d.policy.military = 6.5;
  d.army = armyTarget(d) * 1.1;
  setRel(game, v.id, d.id, -45);
  cs.nations.drevany = d.id;

  // Aldmark: a constitutional monarchy that could be a friend.
  const a = game.countries.filter(c => c.id !== v.id && c.id !== d.id && c.provinceCount >= 3)
    .sort((x, y) => (getNeighbors(game, v.id).includes(y.id) ? 1 : 0) - (getNeighbors(game, v.id).includes(x.id) ? 1 : 0) || y.provinceCount - x.provinceCount)[0];
  renameNation(a, 'Aldmark', 'Aldish');
  if (a.gov !== 'constMonarchy') changeGovernment(game, a, 'constMonarchy', 'reform');
  a.leader = scriptCharacter(game, a, 'sol', 'leader');
  setRel(game, v.id, a.id, 42);
  cs.nations.aldmark = a.id;
  game.stats.regimeChanges = 0;

  // Keep the peace while the player learns the ropes.
  for (const o of game.countries) if (o.id !== v.id) game.truces[truceKey(v.id, o.id)] = 36;
  game.log = [];
  logNews(game, 'King Aurel III abdicates. A provisional constitution proclaims the Republic of Velmora.', 'gov', [v.id]);
  setPlayer(game, v.id);
  refreshAll(game);
  return game;
}

// ------------------------------------------------------------------ the story

const C_NAT = (game, k) => game.countries[game.campaign.nations[k]];

const CAMPAIGN_STEPS = [
  // ---------------------------------------------- Chapter I
  {
    chapter: 'I. A Republic Without Republicans', title: 'The Morning After',
    brief: [
      ['mara', 'Good morning, Mr. President. Three weeks ago Velmora had a king. Today it has a constitution, a parliament nobody trusts yet, and you.'],
      ['mara', 'Up top you can see what matters: the date, the treasury, your political capital (★ PC) for getting things done, the public\'s approval, and stability. If stability falls below 30, people start looking for someone else to run the country.'],
      ['mara', 'First, let\'s see who our neighbors are. Click any nation bordering ours on the map.'],
    ],
    objective: 'Click a nation that borders Velmora on the map.',
    hint: 'Move the mouse over the map to see province details, then click a neighbor. The Diplomacy tab opens with their details.',
    check: (game, c, ui) => ui.selected != null && getNeighbors(game, c.id).includes(ui.selected),
  },
  {
    chapter: 'I. A Republic Without Republicans', title: 'Forming a Government',
    brief: [
      ['mara', 'Every country on that map is run by people: presidents, generals, kings. You\'ll learn who to fear. But first, your own people.'],
      ['mara', 'Open the Leader tab. You\'ll see your skills and traits, your cabinet, the generals, and the opposition. Each minister\'s key skill runs their department, and ministers bring their faction\'s goodwill while they\'re loyal.'],
      ['mara', 'We have no Minister of Finance. The last one left with the king. Appoint one. I\'d look closely at Ilse Varga: she\'s honest, she\'s competent, and the business community likes her.'],
    ],
    objective: 'Open the Leader tab and appoint a Minister of Finance.',
    hint: 'Leader tab → Cabinet → "Appoint…" next to the vacant Minister of Finance.',
    highlight: { tab: 'leader', sel: '[data-act="appoint"][data-post="finance"]' },
    check: (game, c) => !!c.cabinet.finance,
    done: (game, c) => `${c.cabinet.finance.name} takes over the finance ministry.`,
  },
  // ---------------------------------------------- Chapter II
  {
    chapter: 'II. The Treasury Is Empty', title: 'Balancing the Books',
    brief: [
      ['ilse', (game, c) => c.cabinet.finance && c.cabinet.finance.last === 'Varga' ? 'Thank you for your confidence, Mr. President. I\'ll be blunt: we are spending more than we collect. The monarchy bought peace with welfare it couldn\'t pay for.' : 'Mr. President, the new finance minister has looked at the books. We are spending more than we collect.'],
      ['mara', 'Open the Economy tab. The monthly budget shows taxes coming in and spending going out. The sliders below set the tax rate and what we spend on the army, welfare, education, police, infrastructure and state investment.'],
      ['ilse', 'Raise taxes or cut spending, whichever you think the country can bear, until the monthly balance is positive. Remember: higher taxes anger business and workers, and welfare cuts hit the poor.'],
    ],
    objective: 'Make the monthly budget balance positive (Economy tab).',
    hint: 'Economy tab → Policy sliders. Watch "Balance" in the Monthly budget card update as you drag.',
    highlight: { tab: 'economy' },
    check: (game, c) => projectBudget(c).net > 0,
  },
  {
    chapter: 'II. The Treasury Is Empty', title: 'Letting Time Pass',
    brief: [
      ['mara', 'Good. Changes take effect month by month. Use the "Next month" button, or the play buttons to let time run (Space pauses). Events will interrupt you when something needs your decision.'],
    ],
    objective: 'Advance time by three months.',
    hint: 'Click "Next month ⏭" three times, or press ▶ and let it run.',
    highlight: { sel: '#btn-next' },
    check: (game, c, ui, cs) => game.month >= cs.stepStart + 3,
  },
  {
    chapter: 'II. The Treasury Is Empty', title: 'Bread and Steel',
    brief: [
      ['ilse', 'Every good in Velmora has a price, set by supply and demand in our national market. What we lack we import from the world market; what we have too much of, we export.'],
      ['ilse', 'Open the Market tab. Anything priced well above 100%, or not fully met, is scarce: pops go without, factories stall. Scarce goods are where new investment pays best.'],
    ],
    objective: 'Open the Market tab.',
    hint: 'Click "Market" in the tabs at the top of the side panel.',
    highlight: { tab: 'market' },
    check: (game, c, ui, cs) => cs.tabsSeen.includes('market'),
  },
  {
    chapter: 'II. The Treasury Is Empty', title: 'Building the Republic',
    brief: [
      ['ilse', 'Our capitalists invest their profits wherever returns are best. But the state can build too. Go back to the Economy tab: the Industry table lists every kind of building, with its expected return (ROI).'],
      ['ilse', 'Order one. Farms and mines need the right land in a province; factories need workers and the goods they process. Construction takes six months.'],
    ],
    objective: 'Order the construction of any building (Economy tab → Industry).',
    hint: 'Economy tab → Industry & construction → click one of the "+ $" buttons. A high ROI means it pays for itself quickly.',
    highlight: { tab: 'economy', sel: '[data-act="build"]' },
    check: (game, c, ui, cs) => c.econ.projects.some(p => p.funder === 'you') || Object.keys(cs.actions).some(k => k.startsWith('build:')),
  },
  {
    chapter: 'II. The Treasury Is Empty', title: 'Who Lives in Velmora',
    brief: [
      ['mara', 'Numbers on a budget are people in the street. Open the Pops tab. Velmora is home to peasants, laborers, workers, clerks, officials, clergy, soldiers, capitalists and landowners.'],
      ['mara', 'Each class has an income and a standard of living. When people live worse than they expect, they turn against us, and poverty pushes them toward radicals. Keep an eye on the lower classes especially.'],
    ],
    objective: 'Open the Pops tab.',
    hint: 'Click "Pops" in the tab bar.',
    highlight: { tab: 'pops' },
    check: (game, c, ui, cs) => cs.tabsSeen.includes('pops'),
  },
  // ---------------------------------------------- Chapter III
  {
    chapter: 'III. The People\'s Verdict', title: 'The Campaign Trail',
    start: (game, c) => { if (c.nextElection - game.month > 8) c.nextElection = game.month + 8; },
    brief: [
      ['mara', 'Parliament has set the date: the Republic\'s first free election is in a few months. If we lose, the Republican Union goes into opposition and someone else governs.'],
      ['lena', 'Lena Kovar, leader of the opposition, has a message for you: "The people did not bring down a king to be ruled by his accountants. See you at the ballot box, Mr. President."'],
      ['mara', 'Open the Politics tab. You\'ll see the parties and their polling. Parties closest to public opinion poll best, and approval helps the governing party. Launch an Election Campaign from the domestic actions.'],
    ],
    objective: 'Launch an Election Campaign (Politics tab → Domestic actions).',
    hint: 'Politics tab → scroll to Domestic actions → "Election Campaign". It costs political capital and money.',
    highlight: { tab: 'politics', sel: '[data-act="dom"][data-id="campaign"]' },
    check: (game, c, ui, cs) => !!cs.actions['dom:campaign'],
  },
  {
    chapter: 'III. The People\'s Verdict', title: 'Election Day',
    start: (game, c) => {
      const lena = campaignChar(game, 'lena');
      const p = lena && c.parties.find(x => x.id === lena.party);
      if (p && p.id !== c.rulingParty) scheduleEvent(game, 'debate', 1, { party: p.id });
    },
    brief: [
      ['mara', 'Now we wait for the voters. Kovar has challenged you to a radio debate; your charisma against hers. Keep approval up until election day: the budget, welfare and the economy all count.'],
      ['mara', 'If we lose, you\'ll have a choice to make. A democrat concedes. Others have not.'],
    ],
    objective: 'Hold the election (advance time until election day).',
    hint: 'Keep advancing time. The Politics tab shows the date of the next election and the latest polls.',
    check: (game, c, ui, cs) => !!(c.lastElection && c.lastElection.month > cs.stepStart && !game.pending.some(p => p.type === 'election')),
    done: (game, c) => {
      const res = c.lastElection;
      const won = res.winner === res.prev;
      setFlag(game, won ? 'cWonElection' : 'cLostElection');
      return won ? 'The Republican Union is returned to power.' : 'The voters have spoken.';
    },
  },
  // ---------------------------------------------- Chapter IV
  {
    chapter: 'IV. Men With Medals', title: 'The General\'s Ultimatum',
    start: (game, c) => {
      const s = campaignChar(game, 'stoll');
      if (s && c.generals.includes(s)) { s.loyalty = 27; s.favor = -10; scheduleEvent(game, 'generalUltimatum', 1, { gen: s.id, _setup: true }); }
      else game.campaign.flags.noStoll = true;
    },
    brief: [
      ['mara', 'There\'s someone in the anteroom who wouldn\'t take no for an answer. General Radek Stoll, hero of the last war, commander of the Northern Army.'],
      ['stoll', 'Mr. President. The army kept this country together when the king fled. We\'ve been rewarded with cuts and contempt. My officers are... restless.'],
      ['mara', 'Every regime rests on factions. In a democracy it\'s the voters first, but the army, workers, business, clergy and intelligentsia all matter. A disloyal general with ambition can stage a coup. Check the High command in the Leader tab.'],
    ],
    objective: 'Answer General Stoll, then keep the Republic standing for six months.',
    hint: 'Choose a response when the ultimatum arrives. Afterwards, the Leader tab shows Stoll\'s loyalty; "Honor" raises it. More military spending pleases the whole army.',
    highlight: { tab: 'leader' },
    check: (game, c, ui, cs) => game.month >= cs.stepStart + 7 && !game.pending.some(p => p.type === 'event'),
  },
  {
    chapter: 'IV. Men With Medals', title: 'Keeping the Factions Sweet',
    brief: [
      ['mara', 'One more lesson from the generals: when a faction grows restless, you can buy its goodwill. The Politics tab lists all five factions. Those marked ★ are the regime\'s power base.'],
      ['mara', 'Make concessions to one of them. Choose the one whose loyalty is lowest, or the one you need most.'],
    ],
    objective: 'Appease a faction (Politics tab → Factions → Appease).',
    hint: 'Politics tab → Factions → "Appease" next to any faction.',
    highlight: { tab: 'politics', sel: '[data-act="appease"]' },
    check: (game, c, ui, cs) => Object.keys(cs.actions).some(k => k.startsWith('appease:')),
  },
  // ---------------------------------------------- Chapter V
  {
    chapter: 'V. The Drevany Question', title: 'The Junta Next Door',
    brief: [
      ['mara', 'Trouble on the border. Drevany has been ruled by a military junta since the war, and its leader wants the provinces we took from them.'],
      ['maal', 'A message from General-President Viktor Maal: "Velmora is a kingdom that forgot its king. Kingdoms without kings do not last. Drevany will be patient, but not forever."'],
      ['mara', 'Open Drevany in the Diplomacy tab: you can click them on the map, or find them in the list. You\'ll see their strength compared with ours, their allies, and what we can do.'],
    ],
    objective: 'Open Drevany in the Diplomacy tab.',
    hint: 'Click Drevany on the map, or Diplomacy tab → click Drevany in the list.',
    highlight: { tab: 'diplomacy' },
    check: (game, c, ui) => ui.selected === game.campaign.nations.drevany && ui.tab === 'diplomacy',
  },
  {
    chapter: 'V. The Drevany Question', title: 'Securing the Border',
    start: (game, c, cs) => {
      const d = C_NAT(game, 'drevany');
      if (d && d.alive) { setRel(game, c.id, d.id, Math.min(relation(game, c.id, d.id), -55)); game.truces[truceKey(c.id, d.id)] = game.month + 10; }
      cs.flags.borderDeadline = game.month + 10;
    },
    brief: [
      ['mara', 'Our options: talk Maal down by improving relations, find friends abroad, or prepare for war. Aldmark\'s prime minister, Henrike Sol, has been friendly. An alliance means they\'d come to our aid if we were attacked.'],
      ['sol', 'From Aldmark: "Velmora and Aldmark both chose parliaments over thrones. We would be glad to stand with you."'],
      ['mara', 'Secure the border within ten months: raise relations with Drevany above −20, or sign an alliance with any nation. Our army\'s strength is in the Military tab if it comes to that.'],
    ],
    objective: 'Within 10 months, raise relations with Drevany above −20 or form an alliance.',
    hint: 'Diplomacy tab → Drevany → "Improve Relations" (repeatable), or Aldmark → "Propose Alliance" (needs relations of 50; improve them first). If war breaks out, the Military tab shows the war score; "Negotiate peace…" lets you demand provinces or reparations once you are winning.',
    highlight: { tab: 'diplomacy' },
    check: (game, c, ui, cs) => {
      const d = C_NAT(game, 'drevany');
      if (!d || !d.alive) return true;
      if (atWarWith(game, c.id, d.id)) return false;
      if (relation(game, c.id, d.id) > -20 || c.allies.length > 0) return true;
      if (game.month >= cs.flags.borderDeadline && !cs.flags.drevanyAttacked) {
        cs.flags.drevanyAttacked = true;
        declareWar(game, d.id, c.id);
      }
      return cs.flags.drevanyAttacked && cs.flags.warOver;
    },
    tick: (game, c, cs) => {
      const d = C_NAT(game, 'drevany');
      if (cs.flags.drevanyAttacked && (!d || !d.alive || !atWarWith(game, c.id, d.id))) cs.flags.warOver = true;
    },
    objectiveFn: (game, c, cs) => (cs.flags.drevanyAttacked && !cs.flags.warOver ? 'Drevany has invaded! Survive the war and make peace (Military tab).' : null),
  },
  // ---------------------------------------------- Chapter VI
  {
    chapter: 'VI. Forces From Below', title: 'Science and Progress',
    brief: [
      ['ilse', 'A quieter matter, Mr. President, but it decides where we\'ll be in twenty years. Our universities and laboratories need direction.'],
      ['ilse', 'Open the Research tab. Each technology gives a specific advantage: more productive factories and farms, a stronger army, less corruption. Research is faster with more education spending and a more literate people.'],
    ],
    objective: 'Choose a research project (Research tab).',
    hint: 'Research tab → click "Research" next to any available technology.',
    highlight: { tab: 'research', sel: '[data-act="research"]' },
    check: (game, c) => !!(c.research && c.research.current),
  },
  {
    chapter: 'VI. Forces From Below', title: 'The Dockyard Strike',
    start: (game, c) => {
      const M = ensureMovements(c);
      const m = M.labor;
      m.support = Math.max(m.support, 18);
      m.radicalism = Math.max(m.radicalism, 62);
      m.leader = scriptCharacter(game, c, 'rusk', 'movement', { loyalty: 10 });
      m.leader.movement = 'labor';
    },
    brief: [
      ['mara', 'The docks have stopped. The railways may be next. A labor movement has grown up under our feet, and its leader is in the newspapers every morning.'],
      ['rusk', '"We built this Republic with our hands. All we ask is that it doesn\'t let our children go hungry. Welfare for working families, or the docks stay shut."'],
      ['mara', 'Movements grow out of the pops: when a class lives worse than it expects, it organizes. Each makes a demand and grows more radical while it goes unmet. You\'ll find them in the Politics tab. You can meet the demand, suppress them, or try to bring their leader inside the tent.'],
    ],
    objective: 'Respond to the labor movement: meet its demand, suppress it, or co-opt Pavel Rusk.',
    hint: 'Politics tab → Political movements → Labor Movement → choose an action.',
    highlight: { tab: 'politics', sel: '[data-act="move"]' },
    check: (game, c, ui, cs) => Object.keys(cs.actions).some(k => k.startsWith('move:')),
  },
  // ---------------------------------------------- Epilogue
  {
    chapter: 'Epilogue', title: 'What Kind of Country?',
    brief: [
      ['mara', 'Whatever happens next, Velmora has come through its first years. There\'s far more to explore: change the form of government itself from the Politics tab, fund rebels abroad, rig an election if you dare, or watch the World tab as other nations rise and fall.'],
      ['mara', 'From here on, it\'s your Republic. Or whatever you decide to make of it.'],
    ],
    objective: 'Campaign complete. See how history judges you.',
    check: () => true,
    final: true,
  },
];

// Called after every month and every player action.
function campaignUpdate(game, ui) {
  const cs = game.campaign;
  if (!cs || cs.ended) return null;
  const c = game.countries[game.player];
  if (!c || !c.alive) { endCampaign(game, 'fallen'); return { ending: true }; }
  const step = CAMPAIGN_STEPS[cs.step];
  if (step.tick) step.tick(game, c, cs);
  if (cs.briefed !== cs.step) return { brief: cs.step };
  if (step.check(game, c, ui, cs)) {
    const msg = step.done ? step.done(game, c, cs) : '';
    if (step.final) { endCampaign(game, null); return { ending: true }; }
    cs.step++;
    cs.stepStart = game.month;
    const next = CAMPAIGN_STEPS[cs.step];
    if (next.start) next.start(game, c, cs);
    return { completed: step.title, msg, brief: cs.step };
  }
  return null;
}

function campaignBriefed(game) {
  const cs = game.campaign;
  cs.briefed = cs.step;
  cs.stepStart = Math.max(cs.stepStart, game.month);
  const st = CAMPAIGN_STEPS[cs.step];
  if (cs.step === 0 && st.start && !cs.started0) { cs.started0 = true; st.start(game, game.countries[game.player], cs); }
}

function campaignObjective(game) {
  const cs = game.campaign;
  const step = CAMPAIGN_STEPS[cs.step];
  const c = game.countries[game.player];
  return (step.objectiveFn && step.objectiveFn(game, c, cs)) || step.objective;
}

function endCampaign(game, reason) {
  const cs = game.campaign;
  if (cs.ended) return;
  cs.ended = true;
  cs.ending = campaignEnding(game, reason);
}

function campaignEnding(game, reason) {
  const c = game.countries[game.player];
  const parts = [];
  let title;
  if (reason === 'fallen' || !c || !c.alive) {
    return { title: 'The Fallen Republic', text: ['Velmora is gone, its provinces divided among its neighbors. Historians will argue about the mistakes, but none of them will be Velmoran.'] };
  }
  const deposed = game.flags && game.flags.cDeposed;
  if (deposed) {
    title = 'The Interregnum';
    parts.push(`The Republic did not survive its infancy. The ${formalName(c)} now rules from the presidential palace, and the constitution of 1950 is a museum piece.`);
  } else if (c.gov === 'democracy') {
    const won = game.flags && game.flags.cWonElection;
    title = won ? 'The Republic Endures' : 'A Peaceful Transfer';
    parts.push(won ? 'The Republic\'s first government survived its first election, its first general and its first border crisis. Velmorans are starting to believe their democracy is here to stay.'
      : 'You lost an election and handed over power, and the Republic is stronger for it. Velmorans learned that governments can change without anyone being shot.');
  } else if (c.gov === 'junta' || c.gov === 'fascist') {
    title = 'The Strongman\'s Republic';
    parts.push('The ballot box gave way to the barracks. Velmora is orderly, its trains run, and its newspapers say only what they are told.');
  } else if (c.gov === 'communist') {
    title = 'The People\'s Velmora';
    parts.push('The Republic became a people\'s state. The factories belong to the nation, and the nation belongs to the Party.');
  } else if (c.gov === 'absMonarchy' || c.gov === 'constMonarchy') {
    title = 'The Crown Returns';
    parts.push('Velmora tried a republic and decided it preferred a crown. Somewhere, King Aurel III is smiling.');
  } else {
    title = 'A Holy Republic';
    parts.push('Velmora found its answers in faith. The clergy now guide the state.');
  }
  const E = c.econ;
  parts.push(`Stability stands at ${Math.round(c.stability)} and approval at ${Math.round(c.approval)}. The average Velmoran's standard of living is ${Math.round(E.avgSol)}, with ${(E.unemployment * 100).toFixed(1)}% unemployment and an economy of ${c.gdp >= 1 ? '$' + c.gdp.toFixed(1) + 'B' : '$' + (c.gdp * 1000).toFixed(0) + 'M'} a year.`);
  const d = C_NAT(game, 'drevany');
  if (game.campaign.flags.drevanyAttacked) parts.push(d && d.alive ? 'The war with Drevany is remembered as the Republic\'s trial by fire.' : 'Drevany is no more.');
  else if (c.allies.length) parts.push(`Velmora no longer stands alone: it is allied with ${c.allies.map(id => game.countries[id].name).join(' and ')}.`);
  return { title, text: parts };
}
