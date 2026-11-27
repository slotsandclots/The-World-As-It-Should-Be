'use strict';
// The memory of defeat. A nation that loses a war remembers it: the provinces
// it lost (and the people living there), the terms it was made to sign, the
// reparations it still pays and its war dead. Together they make revanchism,
// a grievance that feeds the nationalist movement, the fascist current, the
// army's mood and, in AI hands, the wish for a war of revenge (worldwar.js).
//
// When the army comes home undefeated in the field (still mostly intact, our
// homeland mostly unoccupied) and the peace is signed by elected politicians
// or by a government that came to power during the war, a myth can take hold:
// the army was "stabbed in the back" by traitors at home. The myth turns the
// grievance inward. The officers turn on the civilian government, and a
// demagogue can rise at the head of the nationalist movement, win votes, take
// power and ask for powers to rule by decree.
//
// c.wound = { since, by: [victor ids], humiliation, dead, myth, voices, armyIntact, civilian }
// c.revanchism (0-1) · c.treaty = { until, milCap, by: [ids], broken } (disarmament clauses)

function woundOf(c) {
  if (!c.wound) c.wound = { since: -1, by: [], humiliation: 0, dead: 0, myth: 0, voices: 0 };
  return c.wound;
}

const HUMILIATION = { capitulation: 0.35, province: 0.06, reparations: 0.15, regime: 0.35, subjugate: 0.4, disarm: 0.2, conference: 0.1 };

// Called whenever a nation signs a losing peace (sim.js, worldwar.js).
function recordDefeat(game, loserId, victorIds, how, terms, war) {
  const L = game.countries[loserId];
  if (!L || !L.alive) return;
  terms = terms || {};
  const W = woundOf(L);
  W.since = game.month;
  W.by = [...new Set(victorIds.concat(W.by))].filter(id => id !== loserId).slice(0, 5);
  let h = how === 'capitulation' ? HUMILIATION.capitulation : how === 'conference' ? HUMILIATION.conference : 0;
  h += (terms.provinces || 0) * HUMILIATION.province + (terms.reparations ? HUMILIATION.reparations : 0) + (terms.regime ? HUMILIATION.regime : 0) + (terms.subjugate ? HUMILIATION.subjugate : 0) + (terms.disarm ? HUMILIATION.disarm : 0);
  W.humiliation = clamp(W.humiliation + h, 0, 1);
  if (war) W.dead = clamp(W.dead + ((war.dead && war.dead[loserId]) || 0) / Math.max(1, L.pop), 0, 0.2);
  // Was the army beaten in the field, or did it come home undefeated?
  const start = war && war.armyStart && war.armyStart[loserId];
  const fell = how === 'capitulation' || !!(war && war.fallen && war.fallen[loserId] != null);
  const intact = (!start || L.army >= start * 0.55) && occupiedOf(game, L) < 0.25 && !fell;
  // The ones who signed: elected politicians, or a government or leader that took over during the war.
  const civilian = GOVS[L.gov].elections === 'free' || (war && (L.monthsInRegime < game.month - war.start || (L.leader.since || 0) > war.start));
  const gen = L.generals && L.generals.length ? L.generals.slice().sort((a, b) => (b.renown || 0) - (a.renown || 0))[0] : null;
  const seed = intact ? 0.28 + (civilian ? 0.2 : 0) + (gen ? (gen.renown || 0) / 250 : 0) : 0.06;
  W.armyIntact = intact; W.civilian = civilian;
  W.myth = clamp(Math.max(W.myth, seed), 0, 1);
  if (seed > 0.25 && !(game.scheduled || []).some(e => e.id === 'stabInBack' && e.cid === loserId)) {
    logNews(game, `In ${L.name}, veterans insist the army was never beaten in the field${civilian ? ', only betrayed by those who signed the peace' : ''}.`, 'gov', [loserId]);
    game.scheduled = game.scheduled || [];
    game.scheduled.push({ id: 'stabInBack', month: game.month + game.rng.int(2, 5), ctx: { gen: gen ? gen.id : null }, cid: loserId });
  }
}

// Our former core land now ruled by others: the people we "lost".
function lostShare(game, c) {
  let lost = 0;
  for (const p of game.world.provinces) if (p.core === c.id && p.owner !== c.id && p.owner >= 0) lost += p.pop * (p.cult ? (p.cult[c.culture] || 0) * 0.7 + 0.3 : 1);
  return lost / Math.max(1, c.pop + lost);
}

function reparationsBurden(game, c) {
  let r = 0;
  for (const x of game.reparations || []) if (x.from === c.id) r += x.amount * 12;
  return r / Math.max(1e-6, c.gdp);
}

function treatyActive(game, c) { return !!(c.treaty && c.treaty.until > game.month && !c.treaty.broken); }

function tickRevanchism(game, c) {
  const W = c.wound;
  const lost = lostShare(game, c);
  if (!W && lost < 0.005) { c.revanchism = (c.revanchism || 0) * 0.98; return; }
  const w = woundOf(c);
  const E = c.econ || {};
  const victors = w.by.map(id => game.countries[id]).filter(o => o && o.alive);
  const dem = demagogueOf(c);
  const base = [
    ['Our lost provinces', Math.min(0.3, lost)],
    ['Humiliating peace terms', w.humiliation * 0.3],
    ['Reparations we pay', Math.min(0.15, reparationsBurden(game, c) * 4)],
    ['Our war dead', w.since >= 0 ? Math.min(0.1, w.dead * 8) : 0],
    ['Disarmed by treaty', treatyActive(game, c) ? 0.08 : 0],
  ];
  const core = sumParts(base);
  const parts = base.concat([
    ['Writers and agitators', Math.min(core, w.voices * 0.15 + (dem ? (dem.renown || 0) / 100 * 0.08 : 0))],
    ['Hard times feed the grievance', core * clamp(Math.max(0, -c.growthAvg * 1200) * 0.05 + (E.unemployment || 0) * 2, 0, 0.4)],
    ['The myth of the stab in the back', core * w.myth * 0.4],
    ['Prosperity', -clamp(c.growthAvg * 1200 - 1.5, 0, 3) * 0.02 * Math.min(1, core * 3)],
    ['Reconciliation with the victors', -Math.min(0.12, victors.reduce((s, o) => s + Math.max(0, relation(game, c.id, o.id) - 20) / 600, 0)) * Math.min(1, core * 3)],
  ]);
  const target = clamp(sumParts(parts), 0, 1);
  const cur = c.revanchism || 0;
  c.revanchism = cur + (target - cur) * (target > cur ? 0.05 : 0.012);
  if (c._why) c._why.revanchism = { target: target * 100, parts: parts.map(([k, v]) => [k, v * 100]), rate: target > cur ? 0.05 : 0.012 };
  // Memories fade as the generation that lived through the war passes on.
  w.humiliation *= 0.995; w.dead *= 0.996; w.voices *= 0.99;
  // The myth lives on where agitators, nationalist writers and an angry army keep telling it.
  const told = Math.max(0, w.voices) * 0.004 + (dem ? 0.003 : 0) + (c.factions.military < 40 ? 0.001 : 0);
  w.myth = clamp(w.myth * (c.growthAvg > 0.002 ? 0.993 : 0.997) + told * (1 - w.myth), 0, 1);
  if (w.myth < 0.01 && w.humiliation < 0.01 && w.dead < 0.0005 && lost < 0.005 && c.revanchism < 0.01) { c.wound = null; c.revanchism = 0; }
}

// How the myth turns the army against the civilians who signed the peace (sim.js).
function mythOnArmy(c) {
  const m = c.wound ? c.wound.myth : 0;
  if (!m) return 0;
  return GOVS[c.gov].elections === 'free' ? -m * 14 : m * 5;
}
function mythOnLegitimacy(c) {
  const m = c.wound ? c.wound.myth : 0;
  return m && GOVS[c.gov].elections === 'free' ? -m * 12 : 0;
}

// ------------------------------------------------------------------ demagogues

function demagogueOf(c) {
  if (c.leader && c.leader.demagogue) return c.leader;
  const m = c.movements && c.movements.nationalist;
  return m && m.leader && m.leader.demagogue ? m.leader : null;
}

// A demagogue rises from the defeat: a famous general, a grievance writer, or a decorated veteran with a gift for oratory.
function tickDemagogue(game, c) {
  const m = c.movements && c.movements.nationalist;
  if (!m) return;
  const rng = game.rng;
  const dem = demagogueOf(c);
  if (dem && dem !== c.leader) {
    dem.renown = clamp((dem.renown || 0) + (m.support * 0.012 - 0.12) * (1 - (dem.renown || 0) / 110), 0, 100);
    if (rng.chance(deathChance(dem))) { logNews(game, `${dem.name}, the firebrand of ${c.adj} nationalism, has died.`, 'gov', [c.id]); m.leader = null; return; }
  }
  if (c.leader && c.leader.demagogue) {
    if (!c.leader.tookPower) {
      c.leader.tookPower = game.month;
      logNews(game, `${c.leader.name}, the demagogue of the defeat, comes to power in ${c.name}.`, 'gov', [c.id]);
      if (!isPlayer(game, c) && game.player >= 0 && (c.wound && c.wound.by.includes(game.player))) notify(game, `${c.leader.name} Comes to Power`, `In ${c.name}, the nation we defeated, ${c.leader.name} has come to power on the promise of revenge. Expect them to rearm and look for allies.`, { charId: c.leader.id });
    }
    if (m.leader === c.leader) m.leader = null;
    if (c.igLeaders && c.igLeaders.military === c.leader) c.igLeaders.military = makeIGLeader(game, c, 'military');
    // In a free state, a demagogue in power asks for the power to rule by decree.
    if (GOVS[c.gov].elections === 'free' && !c.leader.askedDecree) {
      c.leader.askedDecree = true;
      game.scheduled = game.scheduled || [];
      game.scheduled.push({ id: 'enablingAct', month: game.month + rng.int(4, 10), ctx: {}, cid: c.id });
    }
    return;
  }
  if (dem || (c.revanchism || 0) < 0.22 || m.support < 5 || !rng.chance(0.04)) return;
  const myth = c.wound ? c.wound.myth : 0;
  let ch = null, origin = '';
  const gen = (c.generals || []).filter(g => (g.renown || 0) > 30 && g.ideo.auth > 0).sort((a, b) => b.renown - a.renown)[0];
  const writer = (c.figures || []).filter(f => f.kind === 'writer' && f.exile == null && f.works.some(w => w.theme === 'grievance') && f.renown > 30).sort((a, b) => b.renown - a.renown)[0];
  if (gen && myth > 0.3 && rng.chance(0.6)) {
    c.generals = c.generals.filter(g => g !== gen);
    ch = gen; origin = `General ${gen.name}, who says the army was never beaten,`;
  } else if (writer && rng.chance(0.5)) {
    c.figures = c.figures.filter(f => f !== writer);
    ch = writer; origin = `${writer.name}, author of "${writer.works.find(w => w.theme === 'grievance').title}",`;
  } else {
    ch = makeCharacter(game, c, { role: 'movement', ideo: GOVS.fascist, faction: 'military', traits: ['charismatic', rng.pick(['populist', 'militarist', 'cruel', 'ambitious'])], skillBias: { cha: 2.5 }, loyalty: 5, ageRange: [30, 46] });
    ch.renown = 10;
    origin = `${ch.name}, a decorated veteran with a gift for oratory,`;
  }
  ch.role = 'movement'; ch.movement = 'nationalist'; ch.demagogue = true;
  ch.ideo = { econ: clamp(ch.ideo.econ * 0.3 + 0.35, -1, 1), auth: clamp(Math.max(ch.ideo.auth, 0.7), -1, 1) };
  ch.skills.cha = clamp(Math.max(ch.skills.cha, 7), 1, 10);
  ch.ambition = Math.max(ch.ambition, 75);
  ch.renown = Math.max(ch.renown || 0, 20);
  if (!ch.traits.includes('charismatic')) ch.traits.push('charismatic');
  m.leader = ch;
  m.radicalism = clamp(m.radicalism + 10, 0, 100);
  // In a multi-party state, the demagogue leads a nationalist party into elections.
  if (GOVS[c.gov].party === 'multi') {
    let p = c.parties.find(x => x.id === 'nat');
    if (!p) {
      const T = PARTY_TEMPLATES.find(t => t.key === 'nat');
      p = { id: 'nat', name: `${c.adj} National Front`, econ: T.econ, auth: T.auth, color: T.color, boost: 0 };
      c.parties.push(p);
    }
    if (p.id !== c.rulingParty) { p.leader = ch; ch.party = 'nat'; p.boost += 0.1; }
  }
  logNews(game, `${origin} takes the lead of the ${c.adj} nationalists, vowing to avenge the defeat.`, 'gov', [c.id]);
  if (isPlayer(game, c)) notify(game, 'A Demagogue Rises', `${origin} now leads the Nationalist Movement. ${myth > 0.3 ? 'They blame the defeat on traitors at home, and the army is listening.' : 'They promise to undo the defeat.'} Nationalist support grows with every rally while the grievance lasts.`, { charId: ch.id });
}

// Movement support: a demagogue's charisma draws crowds (movements.js).
function demagogueDraw(c, k) {
  if (k !== 'nationalist') return 1;
  const d = demagogueOf(c);
  return d && d !== c.leader ? 1 + (d.skills.cha - 5) * 0.04 + (d.renown || 0) / 500 : 1;
}

// ------------------------------------------------------------------ treaties

// Disarmament clauses cap military spending; revanchist governments may tear them up.
function tickTreaty(game, c) {
  const T = c.treaty;
  if (!T) return;
  if (T.until <= game.month || T.broken) { if (T.until <= game.month) c.treaty = null; return; }
  if (c.policy.military <= T.milCap + 0.05) return;
  if (!isPlayer(game, c)) {
    // They tear it up only when the victors look beatable: weakened, divided, or matched by partners of our own.
    const bold = (c.revanchism || 0) * (c.leader.demagogue || ['fascist', 'junta'].includes(c.gov) ? 3 : 1);
    const victors = T.by.map(id => game.countries[id]).filter(o => o && o.alive);
    const bloc = militaryBloc(game, c.id);
    const ours = strength(c) + (bloc ? bloc.members.filter(m => m !== c.id && !T.by.includes(m)).reduce((s, m) => s + strength(game.countries[m]) * 0.5, 0) : 0);
    const fear = victors.reduce((s, o) => s + strength(o), 0) / Math.max(1, ours);
    if (!game.rng.chance(bold * 0.012 / Math.max(1, fear / 1.5) ** 2)) { c.policy.military = T.milCap; return; }
  }
  T.broken = game.month;
  addInfamy(game, c.id, 5);
  for (const id of T.by) if (game.countries[id] && game.countries[id].alive) addRel(game, c.id, id, -25);
  logNews(game, `${c.name} repudiates the disarmament clauses of the peace and rearms.`, 'war', [c.id, ...T.by]);
  if (isPlayer(game, c)) notify(game, 'We Have Broken the Treaty', 'Our military spending exceeds the limit the victors imposed. The treaty is void in all but name: they are alarmed, and our infamy grows.');
  else if (T.by.includes(game.player)) toastPlayer(game, `${c.name} tears up the disarmament clauses and rearms.`, 'bad');
}

// ------------------------------------------------------------------ crises

EVENTS.push(
  {
    id: 'stabInBack', title: 'The Stab in the Back', weight: 0, triggered: true, condOnSchedule: true,
    cond: (game, c) => !!c.wound,
    speaker: (game, c, ctx) => (ctx.gen && (c.generals || []).find(g => g.id === ctx.gen)) || (c.igLeaders && c.igLeaders.military) || null,
    text: (game, c, ctx) => {
      const g = ctx.gen && (c.generals || []).find(x => x.id === ctx.gen);
      const v = woundOf(c).by.map(id => game.countries[id]).filter(Boolean)[0];
      return `The war${v ? ' with ' + v.name : ''} is lost, but our armies never broke. ${g ? `General ${g.name}` : 'The high command'} tells a commission of inquiry that the army was "stabbed in the back" by strikers, profiteers and the politicians who signed the peace. The phrase is on every front page, and the veterans' leagues are listening.`;
    },
    options: [
      { label: 'Publish the truth: the war was lost on the battlefield', ai: (game, c) => 0.4 + c.freedom / 100 + (GOVS[c.gov].elections === 'free' ? 0.3 : 0), fx: { military: -8, intelligentsia: 6, legitimacy: 3 },
        run: (game, c) => { woundOf(c).myth *= 0.4; return 'The archives are opened. Few want to read them, but the myth loses its edge.'; } },
      { label: 'Honor the army and blame the traitors at home', ai: (game, c) => 0.4 + Math.max(0, c.ideo.auth) + (c.factions.military < 45 ? 0.5 : 0) + (GOVS[c.gov].elections === 'free' ? 0 : 0.6), fx: { military: 10, approval: 3, intelligentsia: -8 },
        run: (game, c) => { const W = woundOf(c); W.myth = clamp(W.myth + 0.3, 0, 1); if (c.movements) c.movements.nationalist.radicalism = clamp(c.movements.nationalist.radicalism + 10, 0, 100); return 'The officers are cheered in the streets. The search for the guilty begins.'; } },
      { label: 'Seek reconciliation with the victors', cond: (game, c) => woundOf(c).by.some(id => game.countries[id] && game.countries[id].alive), ai: (game, c) => 0.3 + (c.leader.skills.diplo - 5) * 0.08 + (GOVS[c.gov].elections === 'free' ? 0.3 : 0), fx: { military: -5, pc: -10 },
        run: (game, c) => { const W = woundOf(c); for (const id of W.by) if (game.countries[id] && game.countries[id].alive) addRel(game, c.id, id, 15); W.humiliation *= 0.75; W.myth *= 0.7; if (c.movements) c.movements.nationalist.radicalism = clamp(c.movements.nationalist.radicalism + 8, 0, 100); return 'Our envoys are received with courtesy abroad, and with jeers at home.'; } },
    ],
  },
  {
    id: 'enablingAct', title: 'The Enabling Act', weight: 0, triggered: true, condOnSchedule: true,
    cond: (game, c) => GOVS[c.gov].elections === 'free' && !!c.leader.demagogue,
    speaker: (game, c) => c.leader,
    text: (game, c) => `${c.leader.name} asks parliament for emergency powers to "restore the nation's honor": four years of rule by decree. Nationalist militias march in ${capitalName(game, c)}, and the army waits to see who wins.`,
    options: [
      { label: 'Grant the powers: rule by decree', ai: (game, c) => (c.leader.ambition || 60) / 50 * c.factions.military / 50 * (1 + (c.revanchism || 0)), fx: { intelligentsia: -20, military: 8 },
        run: (game, c) => { changeGovernment(game, c, 'fascist', 'reform', { keepLeader: true }); return `Parliament votes itself out of existence. The ${formalName(c)} is proclaimed.`; } },
      { label: 'Govern within the constitution', ai: (game, c) => 0.5 + c.legitimacy / 100 + c.factions.intelligentsia / 100, fx: { legitimacy: 4 },
        run: (game, c) => { if (c.movements) c.movements.nationalist.radicalism = clamp(c.movements.nationalist.radicalism + 12, 0, 100); return 'The constitution holds, for now. The militias feel betrayed by their own leader.'; } },
    ],
  },
);

if (typeof EVENT_SCENES !== 'undefined') Object.assign(EVENT_SCENES, { stabInBack: 'army', enablingAct: 'parliament' });
