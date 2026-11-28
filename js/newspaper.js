'use strict';
// The newspaper (ROADMAP, "The world newspaper and a generated history book",
// first pass): a front page for each month, built from the game's own news log.
//
// It only reads the log and the state of the world; it changes nothing. Every
// story is scored by importance: what kind of news it is (a war or a revolution
// matters more than a routine law), who is in it (our nation, our neighbours,
// the great powers, the size of their economies) and words that mark big events
// (world wars, revolutions, defaults, crashes). The best story leads; the rest
// fill the page, at home and abroad, so the world feels alive rather than
// revolving around the player.

const PAPER = {
  KIND: { war: 5, crisis: 4, econ: 3, gov: 3, election: 2.5, diplo: 2.5, people: 1.5, culture: 1.5, tech: 1, event: 1.5, info: 0.5, action: 0 },
  BIG: [
    [/world war|Great War|peace conference|Treaty of/i, 6],
    [/revolution|coup|seize[sd]? power|overthrown|ceased to exist|annexed|declares war|declare war/i, 4],
    [/defaults|banking crisis|bank run|runs out of foreign currency|leaves the gold standard|Speculators attack|currency collapses|depression|hyperinflation/i, 3],
    [/collapses|capitulates|surrenders|independence|unif|federation|founded|sign the|Axis/i, 2],
    [/elect|wins|referendum|adopts a new law/i, 1],
  ],
  STORIES: 6,
  WINDOW: 3,   // an edition reaches back this many months, so quiet months still fill a page
  STALE: 1.5,  // ... and older news ranks this much lower for each month of age
  YEAR_STORIES: 8, // the year's edition: the biggest stories of the twelve months, at home and abroad
};

// How much a story matters, from the point of view of the reader's nation.
function storyScore(game, l, readerId, gps, neighbors) {
  let s = PAPER.KIND[l.kind] == null ? 1 : PAPER.KIND[l.kind];
  for (const [re, w] of PAPER.BIG) if (re.test(l.text)) { s += w; break; }
  const ids = l.ids || [];
  if (ids.includes(readerId)) s += 3;
  else if (ids.some(id => neighbors.has(id))) s += 1.5;
  s += Math.min(3, ids.filter(id => gps.has(id)).length * 2);
  // The size of the nations involved: a crisis in a big economy is world news.
  let world = 0, inv = 0;
  for (const c of game.countries) if (c.alive) world += c.gdp || 0;
  for (const id of ids) { const c = game.countries[id]; if (c && c.alive) inv += c.gdp || 0; }
  s += world > 0 ? Math.min(2, (inv / world) * 6) : 0;
  return s;
}

// A headline and the rest of the sentence, from a news line.
function splitHeadline(text) {
  const m = text.match(/^(.{20,90}?)[;:] (.+)$/);
  if (m) return { head: m[1], deck: m[2].charAt(0).toUpperCase() + m[2].slice(1) };
  return { head: text, deck: '' };
}

// The months that have news in the log, newest first.
function paperMonths(game) {
  const ms = new Set();
  for (const l of game.log || []) ms.add(l.m);
  return [...ms].sort((a, b) => b - a);
}

// The best stories, one per subject line (a war or a crisis often logs several near-identical lines).
function pickStories(items, score, n) {
  const scored = items.map((l, i) => ({ l, i, score: score(l) }))
    // Ties keep the order the news happened in, so the page is the same every time it is drawn.
    .sort((a, b) => b.score - a.score || a.i - b.i);
  const seen = new Set(), picked = [];
  for (const x of scored) {
    const key = x.l.text.replace(/[0-9.,%$]+/g, '#').slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key); picked.push(x);
    if (picked.length >= n) break;
  }
  return picked;
}
function paperStory(x, readerId) {
  return Object.assign({ kind: x.l.kind, ids: x.l.ids || [], score: x.score, home: (x.l.ids || []).includes(readerId), m: x.l.m }, splitHeadline(x.l.text));
}

// The front page for one month, as data the interface lays out.
// visible (optional): which lines the reader has seen yet (the daily clock reveals a month's news over its days).
function frontPage(game, readerId, month, visible) {
  const items = (game.log || []).filter(l => l.m <= month && l.m > month - PAPER.WINDOW && l.kind !== 'action' && (!visible || visible(l)));
  const gps = new Set(typeof greatPowers === 'function' ? greatPowers(game) : []);
  const neighbors = new Set(typeof getNeighbors === 'function' && game.countries[readerId] ? getNeighbors(game, readerId) : []);
  const picked = pickStories(items, l => storyScore(game, l, readerId, gps, neighbors) - (month - l.m) * PAPER.STALE, PAPER.STORIES);
  const story = x => paperStory(x, readerId);
  const reader = game.countries[readerId];
  const E = reader && reader.econ;
  return {
    month,
    title: reader && typeof capitalName === 'function' ? `The ${capitalName(game, reader)} Herald` : 'The World Herald',
    lead: picked[0] ? story(picked[0]) : null,
    stories: picked.slice(1).map(story),
    count: items.length,
    // The month in numbers, for the box beside the stories.
    numbers: reader ? [
      ['Growth', reader.growthAvg != null ? reader.growthAvg * 1200 : null, '%/yr'],
      ['Inflation', typeof inflationYoY === 'function' && E && E.pl != null ? inflationYoY(reader) * 100 : null, '%'],
      ['Unemployment', E && E.unemployment != null ? E.unemployment * 100 : null, '%'],
      ['Wars in the world', (game.wars || []).length, ''],
    ].filter(n => n[1] != null) : [],
  };
}

// The year's edition, on the first of January: the year just ended (its twelve
// months, ending with the month before `month`), its biggest stories at home and
// abroad, and how the reader's nation fared over it. Read-only, like the monthly page.
function yearEdition(game, readerId, month) {
  const from = month - 12, to = month - 1;
  const items = (game.log || []).filter(l => l.m >= from && l.m <= to && l.kind !== 'action');
  const gps = new Set(typeof greatPowers === 'function' ? greatPowers(game) : []);
  const neighbors = new Set(typeof getNeighbors === 'function' && game.countries[readerId] ? getNeighbors(game, readerId) : []);
  const picked = pickStories(items, l => storyScore(game, l, readerId, gps, neighbors), PAPER.YEAR_STORIES);
  const reader = game.countries[readerId], H = (reader && reader.hist) || {};
  // Monthly series end with this month: a year ago is 12 entries back.
  const ago = k => { const a = H[k]; return a && a.length > 12 ? a[a.length - 13] : null; };
  const now = k => { const a = H[k]; return a && a.length ? a[a.length - 1] : null; };
  const perHead = (g, p) => g != null && p ? g / p : null;
  const pc0 = perHead(ago('rgdp'), ago('pop')), pc1 = perHead(now('rgdp'), now('pop'));
  const count = re => items.filter(l => re.test(l.text)).length;
  const numbers = reader ? [
    ['Output per person', pc0 && pc1 ? (pc1 / pc0 - 1) * 100 : null, '%'],
    ['Prices', typeof inflationYoY === 'function' && reader.econ && reader.econ.pl != null ? inflationYoY(reader) * 100 : null, '%'],
    ['Unemployment', reader.econ && reader.econ.unemployment != null ? reader.econ.unemployment * 100 : null, '%'],
    ['Stability', ago('stability') != null && now('stability') != null ? now('stability') - ago('stability') : null, ' pts'],
  ].filter(n => n[1] != null) : [];
  const world = [
    ['Wars declared', count(/declares war|declare war/i)],
    ['Governments overthrown', count(/revolution|coup|overthrown|seize[sd]? power/i)],
    ['Banking and debt crises', count(/banking crisis|bank run|defaults/i)],
    ['Wars still going', (game.wars || []).length],
  ];
  return {
    month, from, to,
    title: reader && typeof capitalName === 'function' ? `The ${capitalName(game, reader)} Herald` : 'The World Herald',
    lead: picked[0] ? paperStory(picked[0], readerId) : null,
    stories: picked.slice(1).map(x => paperStory(x, readerId)),
    count: items.length, numbers, world,
  };
}
