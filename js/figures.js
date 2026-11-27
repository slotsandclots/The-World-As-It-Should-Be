'use strict';
// Notable people: writers, political thinkers and inventors who come out of a
// nation's pops, and generals who make their names in battle.
//
// Where they come from:
//  - writers from the literate public (more with secondary schooling and a free press)
//  - thinkers and inventors from university graduates (more with freedom and education)
//
// What they do, through systems that already exist:
//  - A writer's books move public opinion and the idea currents at home. The
//    theme follows the times: a lost war breeds grievance literature or
//    anti-war novels, a slump breeds social novels, repression breeds
//    dissident writing. Translations carry famous books to trade partners and
//    neighbors whose press is free.
//  - A thinker's treatise founds a school that travels further than any novel
//    (idea shocks at home and abroad) and gives the matching movement a doctrine.
//  - An inventor adds research in their field, and breakthroughs jump-start it.
//  - Generals gain experience and renown in battle. Famous ones learn to
//    command (Blitz Commander, Defensive Genius), grow ambitious, and after a
//    war can enter politics or become the face of a myth of defeat.
//
// c.figures = [character + { kind, field, renown, talent, works: [{ m, title, theme }], banned, exile }]
// game.hall = [{ name, kind, nation, born, died, renown, work }]: the most renowned of the dead

const FIGURE_KINDS = {
  writer: { name: 'Writer', plural: 'Writers', icon: '✒', desc: 'Novelists and poets. Their books move public opinion and the national mood, and famous ones are translated abroad.' },
  thinker: { name: 'Political thinker', plural: 'Political thinkers', icon: '❦', desc: 'Philosophers and political scientists. Their treatises found schools of thought that travel between nations and give movements a doctrine.' },
  inventor: { name: 'Inventor', plural: 'Inventors', icon: '⚙', desc: 'Scientists and engineers. They speed research in their field and can make breakthroughs.' },
};
const FIGURE_KIND_KEYS = Object.keys(FIGURE_KINDS);
const FIGURE_CAP = 7;

// Writers' themes: each feeds an idea current, and some feed the memory of defeat (revanchism.js).
const THEMES = {
  grievance: { name: 'Grievance', current: 'fascism', voices: 1, desc: 'the humiliation of defeat and the lost provinces',
    titles: ['The Bitter Peace', 'The Unvanquished', 'Steel and Ashes', 'Betrayed', 'The Lost Provinces', 'Ashes of {lost}', 'They Never Beat Us', 'The Unfinished War', 'Graves Beyond {lost}'] },
  epic: { name: 'National epic', current: 'fascism', voices: 0.4, desc: 'our people living under foreign flags',
    titles: ['Songs of {claim}', 'The Homeland Beyond the River', 'Our Brothers in {claim}', 'The Long Road Home', 'Ballad of the Border'] },
  antiwar: { name: 'Anti-war', current: 'liberalism', voices: -1, desc: 'the dead of the last war and its futility',
    titles: ['The Long Silence', 'Letters from the Trenches', 'The Mud and the Dead', 'Requiem for a Regiment', 'No More Bugles', 'The Quiet Front'] },
  social: { name: 'Social novel', current: 'socialism', desc: 'hunger, rents and the factory floor',
    titles: ['The Iron Mill', 'Bread and Rent', 'The Hungry Quarter', 'Dust in the Looms', 'The Strike at {cap}', 'Children of the Furnace'] },
  freedom: { name: 'Dissident', current: 'liberalism', desc: 'censorship, prisons and the right to speak',
    titles: ['The Censor\'s Night', 'A Voice Under Glass', 'The Closed Door', 'Notes from a Cell', 'The Unwritten Law'] },
  faith: { name: 'Faith and tradition', current: 'traditionalism', desc: 'faith, family and the old ways',
    titles: ['The Bells of {cap}', 'A Pilgrim\'s Year', 'The House of Our Fathers', 'Vespers', 'The Last Harvest Feast'] },
  modern: { name: 'Modernist', current: 'liberalism', desc: 'the city, the machine and the new age',
    titles: ['The Glass City', 'Morning in {cap}', 'The Electric Year', 'Neon and Rain', 'A Room Above the Tramlines'] },
};

const SCHOOL_TITLES = {
  liberalism: ['On Liberty and the State', 'Essay on Representation', 'The Sovereign Citizen', 'Treatise on Free Exchange', 'The Limits of Power'],
  socialism: ['Capital and Labor', 'The Coming Commonwealth', 'Theses on the Factory', 'The Wages of Others', 'The Common Ownership of Things'],
  fascism: ['The Will of the Nation', 'The Iron Nation', 'Order and Rebirth', 'The Organic State', 'The Destiny of Peoples'],
  traditionalism: ['The Ancestral Order', 'Throne and Altar', 'Against the Modern Age', 'The Duties of Rank', 'The Wisdom of Custom'],
};

const INVENTIONS = {
  Industry: ['engine', 'rolling mill', 'alloy', 'assembly method', 'turbine', 'dynamo'],
  Land: ['tractor', 'wheat strain', 'harvester', 'fertilizer process', 'irrigation pump'],
  Society: ['vaccine', 'radio valve', 'printing press', 'water filter', 'X-ray tube'],
  Military: ['rifle', 'tank', 'field gun', 'aero engine', 'radar set'],
  Statecraft: ['tabulating machine', 'census method', 'cipher', 'filing system'],
};

// Command traits that generals learn in battle. Added after TRAIT_KEYS is
// built, so nobody is born with them.
TRAITS.blitz = { name: 'Blitz Commander', desc: 'Learned in battle: armies under this general attack 15% harder' };
TRAITS.bulwark = { name: 'Defensive Genius', desc: 'Learned in battle: armies under this general defend 15% better' };

// ------------------------------------------------------------------ emergence

function figureRates(c) {
  const E = c.econ || {};
  const literateM = c.pop * (E.literacy || 0.3) * (0.4 + (c.sec || 0)) / 1e6;
  const gradsM = c.pop * (c.uni || 0.01) / 1e6;
  const press = typeof pressStrength === 'function' ? pressStrength(c) : 1;
  return {
    writer: 0.0022 * Math.sqrt(Math.max(0, literateM)) * (0.5 + 0.5 * press),
    thinker: 0.0032 * Math.sqrt(Math.max(0, gradsM)) * (0.6 + c.freedom / 200 + c.unrest / 200),
    inventor: 0.005 * Math.sqrt(Math.max(0, gradsM)) * (0.6 + (c.policy.education || 0) / 8),
  };
}

function makeFigure(game, c, kind, o) {
  o = o || {};
  const rng = game.rng;
  const ch = makeCharacter(game, c, { role: 'figure', ageRange: o.ageRange || [26, 44], traitCount: 1, traitPool: ['charismatic', 'reformer', 'pious', 'populist', 'technocrat', 'honest', 'ambitious', 'cunning', 'paranoid', 'cautious', 'militarist'], faction: kind === 'inventor' ? 'business' : 'intelligentsia' });
  // Their politics come from the public around them, with a personal twist.
  ch.ideo = { econ: clamp(c.ideo.econ + rng.normal() * 0.45, -1, 1), auth: clamp(c.ideo.auth + rng.normal() * 0.45, -1, 1) };
  ch.kind = kind;
  ch.talent = clamp(Math.round(5 + rng.normal() * 1.8), 2, 10);
  ch.renown = 0;
  ch.works = [];
  ch.nextWork = game.month + rng.int(6, 40);
  if (kind === 'inventor') ch.field = rng.weighted(TECH_CATS, cat => (TECH_TASTE[c.gov] && TECH_TASTE[c.gov][cat]) || 1);
  if (kind === 'thinker') ch.field = schoolOf(game, c, ch);
  return ch;
}

function ensureFigures(game, c) {
  if (c.figures) return c.figures;
  c.figures = [];
  // A world doesn't start empty: draw the figures already at work, of all ages.
  const R = figureRates(c);
  for (const k of FIGURE_KIND_KEYS) {
    const n = Math.min(3, Math.floor(R[k] * 380 + game.rng()));
    for (let i = 0; i < n && c.figures.length < FIGURE_CAP - 1; i++) {
      const f = makeFigure(game, c, k, { ageRange: [30, 68] });
      f.renown = clamp(0.4 * Math.pow(f.talent, 2.5) * game.rng.range(0.3, 1), 2, 75);
      f.nextWork = game.month + game.rng.int(1, 40);
      c.figures.push(f);
    }
  }
  return c.figures;
}

// ------------------------------------------------------------------ what they write and discover

function themeWeights(game, c, ch) {
  const E = c.econ || {}, W = c.wound;
  const right = ch.ideo.auth > 0 ? 1.5 : 0.5, left = ch.ideo.econ < 0 ? 1.5 : 0.5, liberal = ch.ideo.auth < 0 ? 1.5 : 0.4;
  const claims = (c.claims || []).length;
  return {
    grievance: (c.revanchism || 0) * 6 * right,
    epic: Math.min(1, claims / 3) * 0.6 * right,
    antiwar: (Math.min(1.5, (c.bled || 0) * 150) + (W ? W.dead * 30 : 0) + c.warExhaustion / 40) * liberal,
    social: ((E.unemployment || 0) * 8 + Math.max(0, (c.gini || 0.45) - 0.45) * 5 + Math.max(0, 35 - ((E.strataSol && E.strataSol.lower) || 35)) / 15) * left,
    freedom: Math.max(0, 55 - c.freedom) / 35 * liberal,
    faith: Math.max(0, c.ideo.auth) * 0.6 * (ch.ideo.auth > 0.2 ? 1.3 : 0.4) + (c.flags.clericalSchools ? 0.3 : 0),
    modern: 0.35 + Math.max(0, c.growthAvg * 1200) * 0.08 + (c.urbanShare || 0) * 0.8,
  };
}

// The school a thinker belongs to: the current closest to their politics, pulled by the times.
function schoolOf(game, c, ch) {
  const E = c.econ || {};
  const crisis = Math.max(0, -c.growthAvg * 1200) / 3 + (E.unemployment || 0) * 4 + (c.revanchism || 0);
  return game.rng.weighted(CURRENT_KEYS, k => {
    const P = CURRENTS[k].pos;
    let w = Math.exp(-((P[0] - ch.ideo.econ) ** 2 + (P[1] - ch.ideo.auth) ** 2) / 0.35) + 0.03;
    if (k === 'socialism' || k === 'fascism') w *= 1 + crisis;
    if (k === 'fascism') w *= 1 + (c.revanchism || 0) * 3;
    w *= 1 + ((c.ideaShock && c.ideaShock[k]) || 0) * 3;
    return w;
  });
}

function fillTitle(game, c, t) {
  const provs = game.world.provinces;
  const lost = provs.find(p => p.core === c.id && p.owner !== c.id && p.owner >= 0);
  const claim = (c.claims || []).map(id => provs[id]).find(p => p && p.owner !== c.id);
  return t.replace('{lost}', lost ? lost.name : capitalName(game, c)).replace('{claim}', claim ? claim.name : 'the Borderlands').replace('{cap}', capitalName(game, c));
}

// Where a work is read at home: censorship drives it underground.
function homeReach(c, ch) {
  if (ch.exile != null || ch.banned) return 0.35;
  const press = typeof pressStrength === 'function' ? pressStrength(c) : 1;
  // Under a state press only writers in tune with the regime get printed.
  if (press === 0) return ideoDist(ch.ideo, GOVS[c.gov]) < 0.6 ? 0.9 : 0.3;
  return 0.55 + 0.45 * press;
}

// Nations that read a figure's work in translation, with a weight for each.
function readers(game, c, ch, wide) {
  const out = new Map();
  const add = (id, w) => { const o = game.countries[id]; if (!o || !o.alive || id === c.id) return; out.set(id, Math.max(out.get(id) || 0, w)); };
  for (const n of getNeighbors(game, c.id)) add(n, 1);
  for (const t of c.trade || []) add(t, 0.8);
  for (const b of blocsOf(game, c.id)) for (const m of b.members) add(m, 0.6);
  if (ch.exile != null) add(ch.exile, 1.2);
  if (wide) for (const o of game.countries) if (o.alive) add(o.id, 0.25);
  return out;
}

function publish(game, c, ch) {
  const rng = game.rng, K = ch.kind;
  const age = ch.age > 65 ? clamp(1 - (ch.age - 65) / 15, 0.2, 1) : 1;
  const gain = 0.12 * Math.pow(ch.talent, 2.5) * rng.range(0.5, 1.5) * (1 - ch.renown / 110) * age * (ch.patron > game.month ? 1.3 : 1);
  ch.renown = clamp(ch.renown + gain, 0, 100);
  const impact = ch.renown / 100;
  let title, theme = null, text;
  if (K === 'writer') {
    theme = rng.weighted(Object.keys(THEMES), k => themeWeights(game, c, ch)[k] + 0.02);
    const T = THEMES[theme];
    title = fillTitle(game, c, rng.pick(T.titles));
    const reach = homeReach(c, ch);
    const k = T.current;
    c.ideaShock[k] = (c.ideaShock[k] || 0) + 0.08 * impact * reach;
    const P = CURRENTS[k].pos;
    c.ideo.econ = clamp(c.ideo.econ + (P[0] - c.ideo.econ) * 0.02 * impact * reach, -1, 1);
    c.ideo.auth = clamp(c.ideo.auth + (P[1] - c.ideo.auth) * 0.02 * impact * reach, -1, 1);
    if (T.voices && typeof woundOf === 'function') { const W = woundOf(c); W.voices = clamp(W.voices + T.voices * 0.12 * impact * reach, -1, 1); }
    if (ch.renown > 30) for (const [id, w] of readers(game, c, ch, false)) { const o = game.countries[id]; o.ideaShock = o.ideaShock || {}; o.ideaShock[k] = (o.ideaShock[k] || 0) + 0.03 * impact * w * (typeof pressStrength === 'function' ? pressStrength(o) : 1); }
    text = `${c.adj} writer ${ch.name} publishes "${title}", a ${T.name.toLowerCase()} book about ${T.desc}`;
  } else if (K === 'thinker') {
    if (rng.chance(0.25)) ch.field = schoolOf(game, c, ch);
    const k = ch.field;
    title = rng.pick(SCHOOL_TITLES[k]);
    const reach = homeReach(c, ch);
    c.ideaShock[k] = (c.ideaShock[k] || 0) + 0.1 * impact * (0.6 + 0.4 * reach);
    const mv = CURRENTS[k].movement;
    if (mv && c.movements && c.movements[mv]) c.movements[mv].radicalism = clamp(c.movements[mv].radicalism + 6 * impact, 0, 100);
    for (const [id, w] of readers(game, c, ch, ch.renown > 55)) { const o = game.countries[id]; o.ideaShock = o.ideaShock || {}; o.ideaShock[k] = (o.ideaShock[k] || 0) + 0.05 * impact * w * (0.3 + 0.7 * (typeof pressStrength === 'function' ? pressStrength(o) : 1)); }
    text = `${c.adj} thinker ${ch.name} publishes "${title}", a treatise of ${CURRENTS[k].name.toLowerCase()} read far beyond ${c.name}`;
  } else {
    const R = ensureResearch(c);
    const cur = R.current && TECHS[R.current];
    const match = cur && cur.cat === ch.field;
    if (cur) R.progress += cur.cost * 0.25 * impact * (match ? 1 : 0.3);
    title = `the ${ch.last} ${rng.pick(INVENTIONS[ch.field])}`;
    text = `${c.adj} inventor ${ch.name} unveils ${title}${match ? `, a breakthrough for our work on ${cur.name.toLowerCase()}` : ''}`;
  }
  ch.works.push({ m: game.month, title, theme });
  if (ch.works.length > 3) ch.works.shift();
  if (ch.renown > 25 || isPlayer(game, c)) logNews(game, text + '.', 'culture', [c.id]);
}

// Extra research from the nation's inventors (tech.js calls this).
function inventorBonus(c) {
  if (!c.figures) return 0;
  const cur = c.research && c.research.current && TECHS[c.research.current];
  let b = 0;
  for (const f of c.figures) if (f.kind === 'inventor' && f.exile == null) b += (cur && cur.cat === f.field ? 0.3 : 0.06) * f.renown / 100 * (f.lab > 0 ? 1.5 : 1);
  return Math.min(0.8, b);
}

// AI research leans toward the fields of famous inventors (tech.js).
function inventorPull(c, cat) {
  let w = 1;
  for (const f of c.figures || []) if (f.kind === 'inventor' && f.field === cat) w += f.renown / 50;
  return w;
}

// ------------------------------------------------------------------ the monthly tick

function tickFigures(game, c) {
  const rng = game.rng;
  const F = ensureFigures(game, c);
  c.ideaShock = c.ideaShock || {};
  for (const ch of F.slice()) {
    if (rng.chance(deathChance(ch)) || ch.age > 92) { figureDies(game, c, ch); continue; }
    ch.renown *= 0.995;
    if (ch.lab > 0) ch.lab--;
    if (game.month >= ch.nextWork && ch.age < 80) {
      publish(game, c, ch);
      ch.nextWork = game.month + rng.int(18, 54);
    }
  }
  if (F.length < FIGURE_CAP) {
    const R = figureRates(c);
    for (const k of FIGURE_KIND_KEYS) if (rng.chance(R[k])) {
      const f = makeFigure(game, c, k);
      F.push(f);
      if (isPlayer(game, c)) logNews(game, `A new ${FIGURE_KINDS[k].name.toLowerCase()} makes a name in ${c.name}: ${f.name}.`, 'culture', [c.id]);
      break;
    }
  }
  if (!isPlayer(game, c)) aiFigures(game, c);
}

function figureDies(game, c, ch) {
  c.figures = c.figures.filter(x => x !== ch);
  if (ch.renown < 20) return;
  const best = ch.works[ch.works.length - 1];
  logNews(game, `${c.adj} ${FIGURE_KINDS[ch.kind].name.toLowerCase()} ${ch.name} has died at ${ch.age}${best ? `, remembered for ${ch.kind === 'inventor' ? best.title : '"' + best.title + '"'}` : ''}.`, 'culture', [c.id]);
  remember(game, { name: ch.name, kind: ch.kind, nation: c.name, born: game.startYear + Math.floor(game.month / 12) - ch.age, died: game.startYear + Math.floor(game.month / 12), renown: Math.round(ch.renown), work: best ? best.title : '' });
}

// The hall of history: the most renowned people of every kind who have died.
function remember(game, entry) {
  game.hall = game.hall || [];
  game.hall.push(entry);
  game.hall.sort((a, b) => b.renown - a.renown);
  if (game.hall.length > 40) game.hall.length = 40;
}

// AI governments patronize writers in tune with the regime and censor the rest, if the press law allows.
function aiFigures(game, c) {
  if (!game.rng.chance(0.03)) return;
  const press = typeof pressStrength === 'function' ? pressStrength(c) : 1;
  for (const f of c.figures) {
    if (f.kind === 'inventor' || f.exile != null) continue;
    const far = ideoDist(f.ideo, GOVS[c.gov]);
    if (press < 1 && far > 0.9 && f.renown > 25 && !f.banned && GOVS[c.gov].repression >= 1) { banFigure(game, c, f); break; }
    if (far < 0.5 && f.renown > 20 && !(f.patron > game.month) && c.treasury > -(c.gdpNom || c.gdp) * 0.5) { f.patron = game.month + 36; f.renown = clamp(f.renown + 5, 0, 100); break; }
  }
}

function banFigure(game, c, f) {
  f.banned = true;
  adjust(c, { intelligentsia: -4, freedom: -2 });
  let msg = `${f.name}'s works are banned in ${c.name}.`;
  if (game.rng.chance(0.35)) {
    const hosts = game.countries.filter(o => o.alive && o.id !== c.id && (typeof pressStrength !== 'function' || pressStrength(o) === 1) && !atWarWith(game, o.id, c.id));
    if (hosts.length) {
      const host = hosts.slice().sort((a, b) => ideoDist(f.ideo, GOVS[b.gov]) - ideoDist(f.ideo, GOVS[a.gov]) || relation(game, c.id, a.id) - relation(game, c.id, b.id)).pop();
      f.exile = host.id;
      msg = `${f.name} flees ${c.name} and writes on from exile in ${host.name}.`;
    }
  }
  logNews(game, msg, 'culture', [c.id]);
  return msg;
}

// ------------------------------------------------------------------ generals in battle

function commandBonus(c, kind) {
  const g = c && c.generals ? bestGeneral(c) : null;
  if (!g) return 0;
  return kind === 'attack' ? (g.traits.includes('blitz') ? 0.15 : 0) : (g.traits.includes('bulwark') ? 0.15 : 0);
}

// Called from fightFronts after every battle.
function battleFought(game, winnerId, loserId, attackerWon) {
  const W = game.countries[winnerId], L = game.countries[loserId];
  const gw = W && W.generals ? bestGeneral(W) : null, gl = L && L.generals ? bestGeneral(L) : null;
  if (gw) {
    gw.renown = clamp((gw.renown || 0) + 1.2 * (1 - (gw.renown || 0) / 110), 0, 100);
    gw.won = (gw.won || 0) + 1;
    if (attackerWon) gw.wonAtk = (gw.wonAtk || 0) + 1; else gw.wonDef = (gw.wonDef || 0) + 1;
    if (gw.skills.mil < 10 && game.rng.chance(0.015)) gw.skills.mil++;
    if (gw.won >= 8 && gw.renown > 35 && !gw.traits.includes('blitz') && !gw.traits.includes('bulwark') && game.rng.chance(0.08)) {
      const t = (gw.wonAtk || 0) >= (gw.wonDef || 0) ? 'blitz' : 'bulwark';
      gw.traits.push(t);
      logNews(game, `${W.adj} general ${gw.name} earns a name as a ${TRAITS[t].name.toLowerCase()}.`, 'war', [W.id]);
      if (isPlayer(game, W)) toastPlayer(game, `General ${gw.name} is now a ${TRAITS[t].name}.`, 'good');
    }
  }
  if (gl) { gl.renown = clamp((gl.renown || 0) - 0.4, 0, 100); gl.lost = (gl.lost || 0) + 1; }
}

// After the war: a famous general in a democracy may take off the uniform and run for office.
function tickWarHeroes(game, c) {
  if (GOVS[c.gov].party !== 'multi' || isAtWar(game, c.id) || !game.rng.chance(0.01)) return;
  const hero = (c.generals || []).find(g => (g.renown || 0) > 55 && g.age < 72);
  if (!hero) return;
  const opp = c.parties.filter(p => p.id !== c.rulingParty);
  if (!opp.length) return;
  const party = opp.slice().sort((a, b) => ideoDist(a, hero.ideo) - ideoDist(b, hero.ideo))[0];
  c.generals = c.generals.filter(g => g !== hero);
  hero.role = 'opposition'; hero.party = party.id;
  if (!hero.traits.includes('warHero')) hero.traits.push('warHero');
  hero.skills.cha = clamp(hero.skills.cha + 1, 1, 10);
  party.leader = hero;
  party.boost += 0.15;
  logNews(game, `War hero ${hero.name} retires from the army of ${c.name} to lead the ${party.name}.`, 'gov', [c.id]);
  if (isPlayer(game, c)) toastPlayer(game, `General ${hero.name}, hero of the last war, now leads the ${party.name}.`, 'info');
}

// ------------------------------------------------------------------ player actions

const FIGURE_ACTIONS = {
  patronize: { name: 'Patronize', pc: 12, money: 0.002, desc: 'A state prize and a stipend for three years: their renown grows faster and their politics drift toward the regime. Inventors get a laboratory (+50% to their research).' },
  ban: { name: 'Ban their works', pc: 10, desc: 'Censor them: their works circulate only underground at home. Freedom −2, intelligentsia −4, and they may flee abroad and write from exile. Not possible with a free press.' },
};

function figureAction(game, id, action) {
  const c = game.countries[game.player];
  const f = (c.figures || []).find(x => x.id === id);
  const A = FIGURE_ACTIONS[action];
  if (!f || !A) return { ok: false, msg: 'Nothing to do.' };
  if (f.exile != null) return { ok: false, msg: `${f.name} lives in exile, beyond our reach.` };
  const why = costOk(c, A);
  if (why) return { ok: false, msg: why };
  if (action === 'ban') {
    if (f.kind === 'inventor') return { ok: false, msg: 'There is nothing to ban.' };
    if (f.banned) return { ok: false, msg: 'Already banned.' };
    if (pressStrength(c) === 1) return { ok: false, msg: 'Not possible with a free press.' };
    payCost(c, A);
    return { ok: true, msg: banFigure(game, c, f) };
  }
  payCost(c, A);
  f.patron = game.month + 36;
  if (f.kind === 'inventor') f.lab = 36;
  f.renown = clamp(f.renown + 6, 0, 100);
  f.nextWork = Math.min(f.nextWork, game.month + 12);
  f.ideo.econ += (GOVS[c.gov].econ - f.ideo.econ) * 0.3;
  f.ideo.auth += (GOVS[c.gov].auth - f.ideo.auth) * 0.3;
  if (f.kind !== 'inventor') adjust(c, { intelligentsia: 2 });
  return { ok: true, msg: `${f.name} accepts the state's patronage.` };
}

// The most renowned people alive in the world, for the World tab.
function figuresOfTheAge(game, n) {
  const out = [];
  for (const c of game.countries) {
    if (!c.alive) continue;
    for (const f of c.figures || []) out.push({ f, c });
    for (const g of c.generals || []) if ((g.renown || 0) > 20) out.push({ f: g, c });
  }
  return out.sort((a, b) => (b.f.renown || 0) - (a.f.renown || 0)).slice(0, n || 10);
}
