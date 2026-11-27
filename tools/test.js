// Headless test suite: node tools/test.js
// Exercises world generation, the simulation, saves, events, peace terms and
// the campaign without a browser.
const { loadGame } = require('./load');

const results = [];
function test(name, fn) {
  const t0 = Date.now();
  try { fn(); results.push({ name, ok: true, ms: Date.now() - t0 }); }
  catch (e) { results.push({ name, ok: false, ms: Date.now() - t0, err: e && e.stack ? e.stack : String(e) }); }
}
function assert(cond, msg) { if (!cond) throw new Error('Assertion failed: ' + msg); }

const { run } = loadGame();
run(`
  globalThis.__worldHash = w => { let x = 0; for (let i = 0; i < w.provOf.length; i++) x = (x * 31 + w.provOf[i] + 1) | 0; return x; };
  globalThis.__sane = g => {
    const bad = [];
    for (const c of g.countries) {
      if (!c.alive) continue;
      for (const k of ['stability', 'approval', 'unrest', 'freedom', 'corruption', 'legitimacy', 'gdp', 'treasury', 'army', 'pc'])
        if (!Number.isFinite(c[k])) bad.push(c.name + '.' + k + '=' + c[k]);
      for (const g2 of GOOD_KEYS) if (!Number.isFinite(c.econ.prices[g2]) || c.econ.prices[g2] <= 0) bad.push(c.name + ' price ' + g2);
    }
    for (const p of g.world.provinces) for (const t of POP_KEYS) if (!(p.pops[t] >= 0)) bad.push('pops ' + p.name + ' ' + t + '=' + p.pops[t]);
    for (const g2 of GOOD_KEYS) { const r = g.worldMarket.prices[g2] / GOODS[g2].base; if (!(r >= 0.24 && r <= 4.01)) bad.push('world price ' + g2 + ' ' + r); }
    return bad;
  };
`);

test('every world model generates a playable world', () => {
  const out = run(`WORLD_MODEL_ORDER.map(k => { const w = generateWorld('t1', { model: k, size: 'small', countries: WORLD_MODELS[k].countries ? 20 : 10 }); const owners = new Set(w.provinces.map(p => p.owner)); return [k, w.provinces.length, owners.size, w.countrySeeds.length]; })`);
  for (const [k, provs, owners, nations] of out) {
    assert(provs >= 20, `${k}: only ${provs} provinces`);
    assert(owners === nations, `${k}: ${owners} owners vs ${nations} nations`);
  }
});

test('world generation is deterministic', () => {
  const same = run(`WORLD_MODEL_ORDER.every(k => __worldHash(generateWorld('det', { model: k, size: 'small' })) === __worldHash(generateWorld('det', { model: k, size: 'small' })))`);
  assert(same, 'two generations from the same seed differ');
  const diff = run(`__worldHash(generateWorld('a', {})) !== __worldHash(generateWorld('b', {}))`);
  assert(diff, 'different seeds give the same world');
});

for (const model of ['continents', 'archipelago', 'earth']) {
  test(`${model}: 25 years of simulation stay sane`, () => {
    const bad = run(`(() => { const g = createGame('sane-${model}', { model: '${model}', size: 'small', countries: 12 }); setPlayer(g, 0);
      for (let i = 0; i < 300; i++) { tick(g); g.pending.length = 0; } return __sane(g).concat(g.countries.some(c => c.alive) ? [] : ['everyone died']); })()`);
    assert(bad.length === 0, bad.slice(0, 5).join('; '));
  });
}

test('save and load round-trip', () => {
  const r = run(`(() => { const g = createGame('save1', { size: 'small' }); setPlayer(g, 0); for (let i = 0; i < 30; i++) { tick(g); g.pending.length = 0; }
    const s = serializeGame(g); const h = deserializeGame(s);
    const same = h.month === g.month && h.world.provinces.every((p, i) => p.owner === g.world.provinces[i].owner) && h.countries[0].leader.name === g.countries[0].leader.name;
    for (let i = 0; i < 12; i++) { tick(h); h.pending.length = 0; }
    return { same, bad: __sane(h), size: s.length }; })()`);
  assert(r.same, 'reloaded game differs');
  assert(r.bad.length === 0, r.bad.join('; '));
  assert(r.size < 6e5, 'save is too large for local storage: ' + r.size);
});

test('every event option resolves without errors', () => {
  const r = run(`(() => { let ran = 0; const errs = [];
    for (const gov of ['democracy', 'communist']) for (const ev of EVENTS) for (let oi = 0; oi < ev.options.length; oi++) {
      const g = createGame('ev-' + gov, { size: 'small', countries: 6 }); setPlayer(g, 0); const c = g.countries[0];
      if (c.gov !== gov) changeGovernment(g, c, gov, 'reform', { keepLeader: true });
      for (const x of c.generals) x.loyalty = 20; for (const p of POST_KEYS) if (c.cabinet[p]) c.cabinet[p].loyalty = 20;
      for (const d of c.dissidents || []) d.popularity = 50; c.stability = 40; if (GOVS[c.gov].elections === 'free') c.nextElection = g.month + 4;
      try {
        if (!ev.triggered && !ev.cond(g, c)) continue;
        const ctx = ev.triggered ? { min: (POST_KEYS.map(p => c.cabinet[p]).find(Boolean) || {}).id, gen: c.generals[0].id, dis: (c.dissidents[0] || {}).id } : {};
        presentEvent(g, c, ev, ctx);
        const item = g.pending.filter(p => p.type === 'event').pop();
        if (!eventOptions(g, c, item).some(x => x.i === oi)) continue;
        resolveEvent(g, item, oi); ran++;
        for (let k = 0; k < 4; k++) { tick(g); g.pending.length = 0; }
      } catch (e) { errs.push(gov + ' ' + ev.id + '#' + oi + ': ' + e.message); }
    } return { ran, errs }; })()`);
  assert(r.errs.length === 0, r.errs.slice(0, 5).join('; '));
  assert(r.ran > 60, 'only ' + r.ran + ' options exercised');
});

test('peace terms transfer provinces and set up reparations', () => {
  const r = run(`(() => { const g = createGame('peace', { size: 'small' }); setPlayer(g, 0); g.truces = {};
    const n = getNeighbors(g, 0)[0]; const w = declareWar(g, 0, n); w.gainsA = 10; w.exB = 90; g.rng = makeRng(1);
    const before = g.countries[0].provinceCount;
    let res; for (let i = 0; i < 20 && isAtWar(g, 0); i++) res = offerPeaceTerms(g, w.id, { provinces: 1, reparations: true });
    return { ok: res.ok, gained: g.countries[0].provinceCount - before, reps: (g.reparations || []).length, atWar: isAtWar(g, 0) }; })()`);
  assert(r.ok && !r.atWar, 'peace was not signed');
  assert(r.gained >= 1, 'no province changed hands');
  assert(r.reps === 1, 'no reparations scheduled');
});

test('conquest raises infamy, occupies land and integrates it over 20 years', () => {
  const r = run(`(() => { const g = createGame('inf', { size: 'small' }); setPlayer(g, 0); g.truces = {};
    const n = getNeighbors(g, 0)[0]; declareWar(g, 0, n);
    const t = pickFrontProvince(g, [0], [n]); const p = g.world.provinces[t[0]];
    transferProvince(g, p.id, 0); refreshCores(g);
    const out = { infamy: g.countries[0].infamy, occ: occupationFactor(g, p), nonCore: g.countries[0].nonCoreCount };
    endWar(g, g.wars[0], 'peace');
    for (let i = 0; i < 245 && p.owner === 0; i++) { tick(g); g.pending.length = 0; }
    out.integrated = p.owner !== 0 || p.core === 0;
    return out; })()`);
  assert(r.infamy >= 5, 'declaring war added no infamy');
  assert(r.occ > 0.9, 'conquered province not occupied');
  assert(r.nonCore >= 1, 'conquered province counted as core');
  assert(r.integrated, 'province never integrated or revolted');
});

test('subjects pay tribute, can win independence, and fallen nations can be restored', () => {
  const r = run(`(() => { const g = createGame('subj', { size: 'small' }); setPlayer(g, 0); g.truces = {};
    const me = g.countries[0]; const n = getNeighbors(g, 0)[0]; const S = g.countries[n];
    makeSubject(g, 0, n, 'vassal', 'war');
    const t0 = me.treasury; for (let i = 0; i < 6; i++) { tick(g); g.pending.length = 0; }
    const paid = S.tributePaid > 0;
    // A subject that wins its war of independence goes free.
    const w = declareIndependence(g, n, []); w.gainsA = 5; endWar(g, w, 'peace');
    const freed = S.overlord == null;
    // Conquer a nation entirely, then restore it.
    const v = g.countries.find(c => c.alive && c.id !== 0 && getNeighbors(g, 0).includes(c.id));
    for (const p of provincesOf(g, v.id)) transferProvince(g, p.id, 0);
    const dead = !v.alive;
    const res = releaseNation(g, 0, v.id, { gov: me.gov, subject: 'protectorate' });
    for (let i = 0; i < 12; i++) { tick(g); g.pending.length = 0; }
    return { paid, freed, dead, restored: res.ok && v.alive && v.overlord === 0 && v.provinceCount > 0, bad: __sane(g) }; })()`);
  assert(r.paid, 'vassal paid no tribute');
  assert(r.freed, 'winning independence did not free the subject');
  assert(r.dead && r.restored, 'conquered nation was not restored as a protectorate');
  assert(r.bad.length === 0, r.bad.join('; '));
});

test('blocs trade inside a shared market, defend members and apply a common tariff', () => {
  const r = run(`(() => { const g = createGame('blocs', { size: 'small' }); setPlayer(g, 0); g.truces = {};
    const n = getNeighbors(g, 0)[0];
    setRel(g, 0, n, 80); // members who fall out with the leader leave, so keep this one friendly
    const cu = foundBloc(g, 0, 'customs'); joinBloc(g, cu, n); cu.tariff = 0.4;
    const pact = foundBloc(g, 0, 'pact'); joinBloc(g, pact, n);
    // Bloc trade can pause when members happen to have the same surpluses; count the whole year.
    let blocTrade = 0;
    for (let i = 0; i < 12; i++) { tick(g); g.pending.length = 0; for (const k of GOOD_KEYS) blocTrade += g.countries[n].econ.blocEx[k] + g.countries[n].econ.blocIm[k]; }
    const tariffOk = effectiveTariff(g, g.countries[n]) === 0.4;
    // An attack on the neighbor must pull us in (we are the player: we get asked).
    const attacker = g.countries.find(c => c.alive && c.id !== 0 && c.id !== n && getNeighbors(g, n).includes(c.id));
    let asked = null;
    if (attacker) { declareWar(g, attacker.id, n); asked = g.pending.some(p => p.type === 'allyCall' && p.bloc); }
    return { blocTrade, tariffOk, asked, bad: __sane(g) }; })()`);
  assert(r.blocTrade > 0, 'no trade inside the customs union');
  assert(r.tariffOk, 'common tariff not applied');
  assert(r.asked !== false, 'pact member was not called to defend');
  assert(r.bad.length === 0, r.bad.join('; '));
});

test('designations, separatism and federation work', () => {
  const r = run(`(() => { const g = createGame('fed', { size: 'small' });
    const big = g.countries.slice().sort((x, y) => y.provinceCount - x.provinceCount)[0].id;
    setPlayer(g, big); g.truces = {};
    const me = g.countries[big]; me.pc = 100;
    const home = provincesOf(g, big).find(p => p.id !== me.capital);
    const sez = setDesignation(g, home.id, 'sez').ok && home.designation === 'sez';
    const colonyRefused = !setDesignation(g, home.id, 'colonial').ok;
    // Conquered land grows a separatist movement; a referendum can settle it.
    const n = getNeighbors(g, big).sort((x, y) => g.countries[y].provinceCount - g.countries[x].provinceCount)[0];
    for (const p of provincesOf(g, n).filter(p => p.id !== g.countries[n].capital).slice(0, 2)) transferProvince(g, p.id, big);
    for (let i = 0; i < 24; i++) { tick(g); g.pending.length = 0; }
    const sep = Object.values(me.separatists || {}).some(s => s.support > 10);
    // A confederation of like-minded nations federates.
    const h = createGame('fed2', { size: 'small' }); setPlayer(h, 0); const m = getNeighbors(h, 0)[0];
    h.countries[m].gov = h.countries[0].gov; setRel(h, 0, m, 90);
    const b = foundBloc(h, 0, 'confederation'); joinBloc(h, b, m); h.countries[0].pc = 100;
    const fed = playerFederate(h, b.id).ok && !h.countries[m].alive && h.countries[0].federal;
    for (let i = 0; i < 6; i++) { tick(h); h.pending.length = 0; }
    return { sez, colonyRefused, sep, fed, bad: __sane(g).concat(__sane(h)) }; })()`);
  assert(r.sez, 'could not create a special economic zone');
  assert(r.colonyRefused, 'core land accepted colonial administration');
  assert(r.sep, 'no separatism in conquered land');
  assert(r.fed, 'confederation did not federate');
  assert(r.bad.length === 0, r.bad.join('; '));
});

test('hung parliaments form coalitions that can collapse', () => {
  const r = run(`(() => { const g = createGame('coal', { size: 'small' });
    const c = g.countries.find(x => GOVS[x.gov].elections === 'free' && x.parties.length >= 4);
    if (!c) return { skip: true };
    const seats = {}; c.parties.forEach((p, i) => { seats[p.id] = i === 0 ? 80 : Math.floor(120 / (c.parties.length - 1)); });
    const opt = formGovernment(g, c, seats);
    applyGovernment(g, c, opt);
    const formed = opt.partners.length > 0 ? !!c.coalition && c.coalition.partners.length === opt.partners.length : !!(c.coalition && c.coalition.minority);
    c.lastElection = { month: g.month, results: c.parties.map(p => ({ id: p.id, seats: seats[p.id] })) };
    // An ignored partner eventually walks out and brings the government down.
    let fell = false;
    if (c.coalition && c.coalition.partners.length) {
      const pt = c.coalition.partners[0]; pt.demand = { key: 'welfare', op: '>=', value: 25 };
      const before = c.nextElection;
      for (let i = 0; i < 120 && c.coalition && !fell; i++) { pt.satisfaction = 5; tickCoalition(g, c); if (c.nextElection < before || !c.coalition || !c.coalition.partners.includes(pt)) fell = true; }
    } else fell = true;
    return { formed, fell }; })()`);
  if (r.skip) return;
  assert(r.formed, 'no government formed from a hung parliament');
  assert(r.fell, 'an ignored partner never walked out');
});

test('number breakdowns add up and history is recorded', () => {
  const r = run(`(() => { const g = createGame('why1', { size: 'small' }); setPlayer(g, 0); for (let i = 0; i < 30; i++) { tick(g); g.pending.length = 0; }
    const c = g.countries[0], W = c._why;
    const pcOk = Math.abs(sumParts(pcParts(c)) - pcIncome(c)) < 1e-9;
    const parts = ['approval', 'stability', 'unrest'].map(k => W && W[k] && W[k].parts.length > 3 && isFinite(W[k].target));
    const H = c.hist, other = g.countries[1].hist;
    const s = serializeGame(g);
    return { pcOk, parts, len: H.gdp.length, unrest: H.unrest.length, otherUnrest: !!other.unrest, prices: Object.keys(g.priceHist).length, years: c.histY.month.length, noCache: !s.includes('"_provs"') && !s.includes('"_why"') }; })()`);
  assert(r.pcOk, 'political capital parts do not add up');
  assert(r.parts.every(Boolean), 'missing breakdowns: ' + JSON.stringify(r.parts));
  assert(r.len === 30 && r.unrest === 30, `history lengths ${r.len}/${r.unrest}`);
  assert(!r.otherUnrest, 'AI nations should not record player-only series');
  assert(r.prices >= 10 && r.years === 2, `prices ${r.prices}, years ${r.years}`);
  assert(r.noCache, 'transient caches leaked into the save');
});

test('laws: presets are neutral, bills pass or fail, AI reforms', () => {
  const r = run(`(() => { const g = createGame('law1', { size: 'small', countries: 10 }); setPlayer(g, 0); const c = g.countries[0];
    const neutral = g.countries.every(x => Object.values(lawFx(x)).every(v => v === 0));
    for (let i = 0; i < 2; i++) { tick(g); g.pending.length = 0; }
    c.pc = 100; const cat = 'press', opt = Object.keys(LAW_CATS.press.opts).find(o => o !== c.laws.press);
    const p1 = proposeLaw(g, c, cat, opt).ok, p2 = proposeLaw(g, c, 'labor', 'none').ok;
    let months = 0; while (c.reform && months < 60) { tick(g); g.pending.length = 0; months++; }
    const resolved = !c.reform;
    if (GOVS[c.gov].elections !== 'free') { c.pc = 100; proposeLaw(g, c, 'church', Object.keys(LAW_CATS.church.opts).find(o => o !== c.laws.church)); lawAction(g, 'decree'); }
    for (let i = 0; i < 480; i++) { tick(g); g.pending.length = 0; }
    const changed = g.countries.filter(x => x.alive && x.id !== 0 && LAW_KEYS.some(k => x.laws[k] !== LAW_PRESETS[x.gov][k])).length;
    const labels = g.countries.filter(x => x.alive).map(constitutionLabel);
    return { neutral, p1, p2, resolved, months, changed, labels, bad: __sane(g) }; })()`);
  assert(r.neutral, 'preset laws should have no net effect');
  assert(r.p1 && !r.p2, 'one bill at a time');
  assert(r.resolved, 'bill never resolved');
  assert(r.changed >= 1, 'AI never reformed its laws');
  assert(r.bad.length === 0, r.bad.join('; '));
  console.log('    bill took', r.months, 'months; AI nations with reformed laws:', r.changed, '; e.g.', [...new Set(r.labels)].slice(0, 6).join(', '));
});

test('interest-group leaders act and constitutional crises fire', () => {
  const r = run(`(() => { const g = createGame('ig1', { size: 'small', countries: 8 }); setPlayer(g, 0); const c = g.countries[0];
    for (let i = 0; i < 3; i++) { tick(g); g.pending.length = 0; }
    const L = c.igLeaders, all = FACTION_KEYS.every(f => L[f] && L[f].role === 'igLeader');
    c.pc = 100; const f = 'workers', before = L[f].id;
    const m = igAction(g, f, 'meet').ok, d = igAction(g, f, 'discredit').ok, replaced = c.igLeaders[f].id !== before;
    const s = serializeGame(g), h = deserializeGame(s), kept = h.countries[0].igLeaders.workers.name === c.igLeaders.workers.name;
    // Force a term-limit crisis in a democracy.
    if (GOVS[c.gov].elections !== 'free') changeGovernment(g, c, 'democracy', 'reform', { keepLeader: true });
    c.leader.since = g.month - 120;
    const ev = eventById('termLimit'), ok = ev.cond(g, c);
    presentEvent(g, c, ev, {}); const item = g.pending.pop(); resolveEvent(g, item, 0);
    const newLeader = c.leader.since === g.month || g.month - c.leader.since < 2;
    return { all, m, d, replaced, kept, ok, newLeader, bad: __sane(g) }; })()`);
  assert(r.all, 'every group should have a leader');
  assert(r.m && r.d && r.replaced, 'leader actions failed');
  assert(r.kept, 'leaders lost on save/load');
  assert(r.ok && r.newLeader, 'term-limit crisis did not work');
  assert(r.bad.length === 0, r.bad.join('; '));
});

test('AI nations face crises; regional elections, referendums and the press work', () => {
  const r = run(`(() => { const g = createGame('arena1', { size: 'small', countries: 10 }); setPlayer(g, 0); const c = g.countries[0];
    if (GOVS[c.gov].elections !== 'free') changeGovernment(g, c, 'democracy', 'reform', { keepLeader: true });
    c.laws.electoral = 'constituencies';
    for (let i = 0; i < 360; i++) { tick(g); g.pending.length = 0; }
    const aiCrises = g.log.filter(n => n.kind === 'crisis' && !n.ids.includes(0)).length;
    if (!c.lastElection || c.lastElection.sham || !c.lastElection.prov) { if (GOVS[c.gov].elections !== "free") changeGovernment(g, c, "democracy", "reform", { keepLeader: true }); runElection(g, c); g.pending.length = 0; }
    const E = c.lastElection, provOk = E && E.prov && Object.keys(E.prov).length > 0 && E.results.reduce((s, x) => s + x.seats, 0) === 200;
    c.pc = 100; c.reform = null; c.laws.suffrage = 'universal'; const cat = 'church', opt = Object.keys(LAW_CATS.church.opts).find(o => o !== c.laws.church);
    const ref = holdReferendum(g, c, cat, opt);
    const barons = g.countries.reduce((s, x) => s + (x.barons || []).length, 0);
    let pressOk = true; if (c.barons && c.barons.length) pressOk = pressAction(g, 0, 'court').ok;
    const h = deserializeGame(serializeGame(g));
    return { aiCrises, provOk, ref: ref.ok, barons, pressOk, reload: JSON.stringify(h.countries[0].laws) === JSON.stringify(c.laws), bad: __sane(g) }; })()`);
  assert(r.aiCrises > 0, 'AI nations never faced a crisis');
  assert(r.provOk, 'regional election results missing or seats do not add to 200');
  assert(r.ref, 'referendum could not be held');
  assert(r.barons > 0 && r.pressOk, 'no press barons');
  assert(r.reload, 'laws lost on reload');
  assert(r.bad.length === 0, r.bad.join('; '));
});

test('wars are fought on the map: occupation, fronts, peace, mobilization', () => {
  const r = run(`(() => { const g = createGame('war2', { size: 'small', countries: 8 }); setPlayer(g, 0); const c = g.countries[0];
    const t = getNeighbors(g, 0)[0]; g.truces = {};
    declareWar(g, 0, t); const w = g.wars[g.wars.length - 1];
    c.pc = 100; const mob = setMobilized(g, c, true).ok; setPosture(g, w.id, 'offensive');
    const ownBefore = g.world.provinces.filter(p => p.owner === t).length;
    let occSeen = 0, transferredDuring = false;
    for (let i = 0; i < 60 && g.wars.includes(w); i++) { tick(g); g.pending.length = 0; occSeen = Math.max(occSeen, g.world.provinces.filter(p => p.occ != null).length); if (g.wars.includes(w) && g.world.provinces.filter(p => p.owner === t).length < ownBefore && !g.log.some(n => /capitulates/.test(n.text))) transferredDuring = true; }
    const save = serializeGame(g), h = deserializeGame(save);
    const sameOcc = g.world.provinces.every((p, i) => (p.occ == null) === (h.world.provinces[i].occ == null));
    const armyUp = c.mobilized ? armyTarget(c) > 0 : true;
    if (g.wars.includes(w)) endWar(g, w, 'peace');
    const cleared = g.world.provinces.every(p => p.occ == null || ![0, t].includes(p.owner));
    return { mob, occSeen, transferredDuring, sameOcc, cleared, armyUp, demob: (tick(g), g.pending.length = 0, !c.mobilized || isAtWar(g, 0)), bad: __sane(g) }; })()`);
  assert(r.mob, 'could not mobilize');
  assert(r.occSeen > 0, 'no province was ever occupied');
  assert(!r.transferredDuring, 'provinces changed owner mid-war without a capitulation');
  assert(r.sameOcc, 'occupation lost on save/load');
  assert(r.cleared, 'occupation not cleared at peace');
  assert(r.demob, 'did not demobilize after the war');
  assert(r.bad.length === 0, r.bad.join('; '));
});

test('movements are radical wings of interest groups; support is a meter', () => {
  const r = run(`(() => { const g = createGame('wing1', { size: 'small', countries: 8 }); setPlayer(g, 0); const c = g.countries[0];
    for (let i = 0; i < 3; i++) { tick(g); g.pending.length = 0; }
    const m = c.movements.labor; m.support = 20; m.radicalism = 70; m.leader = null;
    tick(g); g.pending.length = 0;
    const shared = c.movements.labor.leader && c.movements.labor.leader === c.igLeaders.workers && c.igLeaders.workers.stance === 'radical';
    const drag = radicalWingPressure(c, 'workers') > 0;
    const sup = c.support >= 0 && c.support <= 100 && c._why.support.parts.length === 3;
    const unique = new Set(allCharacters(c).map(x => x.id)).size === allCharacters(c).length;
    return { shared, drag, sup, unique }; })()`);
  assert(r.shared, 'movement and interest group should share a radical leader');
  assert(r.drag, 'a radical wing should weigh on its group');
  assert(r.sup, 'support meter missing');
  assert(r.unique, 'characters listed twice');
});

test('money: central banks hit their target, printing inflates and erodes debt, wages lag', () => {
  const r = run(`(() => { const g = createGame('money1', { size: 'small', countries: 6 }); setPlayer(g, 0); const c = g.countries[0];
    c.laws.monetary = 'centralBank';
    for (let i = 0; i < 180; i++) { tick(g); g.pending.length = 0; }
    const cb = inflationYoY(c);
    // Switch to printing money and run a deficit.
    c.laws.monetary = 'state'; c.policy.moneyGrowth = 30; c.policy.monetize = true; c.treasury = -c.gdpNom * 0.8;
    const debt0 = -c.treasury / c.gdpNom, pl0 = c.econ.pl;
    let minWage = 2; for (let i = 0; i < 48; i++) { tick(g); g.pending.length = 0; minWage = Math.min(minWage, c.econ.realWage); }
    const debt1 = -c.treasury / c.gdpNom, hot = inflationYoY(c);
    const h = deserializeGame(serializeGame(g));
    return { cb, hot, priceRise: c.econ.pl / pl0, debt0, debt1, minWage, kept: Math.abs(h.countries[0].econ.pl - c.econ.pl) < 1e-3 * c.econ.pl, bad: __sane(g) }; })()`);
  assert(r.cb > -0.03 && r.cb < 0.07, 'central bank inflation off target: ' + r.cb);
  assert(r.hot > 0.15 && r.priceRise > 1.5, 'printing did not inflate: ' + r.hot);
  assert(r.debt1 < r.debt0, 'inflation should erode the debt ratio');
  assert(r.minWage < 0.97, 'real wages should lag rising prices');
  assert(r.kept, 'price level lost on save/load');
  assert(r.bad.length === 0, r.bad.join('; '));
});

test('credit: an over-borrowed economy defaults, closes buildings, and can trigger a banking crisis', () => {
  const r = run(`(() => { const g = createGame('credit1', { size: 'small', countries: 6 }); setPlayer(g, 0); const c = g.countries[0];
    for (let i = 0; i < 24; i++) { tick(g); g.pending.length = 0; }
    const E = c.econ; c.laws.banking = 'unregulated';
    const levels0 = c._provs.reduce((s, p) => s + p.buildings.reduce((t, b) => t + b.level, 0), 0);
    const wealth0 = c._provs.reduce((s, p) => s + Object.values(p.wealth || {}).reduce((a, b) => a + b, 0), 0);
    // Pile on debt: three years of GDP.
    E.credit = (E.gdpRealM || E.gdpM) * 36; E.creditTrend = E.credit; E.bankCap = E.credit * 0.05;
    let maxDef = 0, crisis = false;
    for (let i = 0; i < 36; i++) { tick(g); g.pending.length = 0; maxDef = Math.max(maxDef, E.defaults); if (E.bankCrisis > 0) crisis = true; }
    const levels1 = c._provs.reduce((s, p) => s + p.buildings.reduce((t, b) => t + b.level, 0), 0);
    if (!E.bankCrisis) { E.bankCrisis = 5; }
    c.pc = 100; const bail = bailoutBanks(g).ok;
    const h = deserializeGame(serializeGame(g));
    return { maxDef, crisis, closed: levels1 < levels0, bail, conf: E.conf, phase: cyclePhase(c), kept: Math.abs(h.countries[0].econ.credit - E.credit) < 1e-5 * E.credit + 1, bad: __sane(g) }; })()`);
  assert(r.maxDef > 0.001, 'no defaults under a mountain of debt');
  assert(r.closed, 'defaults should close real buildings');
  assert(r.crisis, 'thin bank capital and defaults should cause a banking crisis');
  assert(r.bail, 'bailout failed');
  assert(r.kept, 'credit lost on save/load');
  assert(r.bad.length === 0, r.bad.join('; '));
});

test('peoples: minorities, laws, assimilation, migration and nationalist claims', () => {
  const r = run(`(() => { const g = createGame('peop1', { size: 'small', countries: 8 }); setPlayer(g, 0); const c = g.countries[0];
    tick(g); g.pending.length = 0;
    const cultures = g.cultures.length === g.countries.length && g.faiths.length >= 2;
    const mixed = g.world.provinces.some(p => p.cult && Object.keys(p.cult).length > 1);
    const sums = g.world.provinces.every(p => !p.cult || Math.abs(Object.values(p.cult).reduce((a, b) => a + b, 0) - 1) < 1e-6);
    // Persecution: more grievance and faster assimilation than equal citizenship.
    const prov = g.world.provinces.find(p => p.owner === 0 && (p.cult[c.culture] || 0) < 0.9) || g.world.provinces.find(p => p.owner === 0);
    prov.cult = { [c.culture]: 0.5, [g.countries[1].culture]: 0.5 };
    c.laws.citizenship = 'equal'; tickPeoples(g); const gEq = prov.grievance, mEq = prov.cult[c.culture];
    c.laws.citizenship = 'persecution'; tickPeoples(g); const gPe = prov.grievance, mPe = prov.cult[c.culture] - mEq;
    // Migration toward a richer neighbor with open borders carries culture.
    const n = getNeighbors(g, 0)[0]; const nb = g.countries[n]; nb.laws.migration = 'open';
    const from = g.world.provinces.find(p => p.owner === 0 && p.neighbors.some(q => g.world.provinces[q].owner === n));
    const to = g.world.provinces[from.neighbors.find(q => g.world.provinces[q].owner === n)];
    from.sol = Object.fromEntries(Object.keys(from.sol).map(k => [k, 5])); to.sol = Object.fromEntries(Object.keys(to.sol).map(k => [k, 90]));
    const before = to.cult[c.culture] || 0; migrate(g);
    const carried = (to.cult[c.culture] || 0) > before;
    // Claims: a neighbor province full of our people is claimed.
    to.cult = { [c.culture]: 0.8, [nb.culture]: 0.2 }; const claims = nationalClaims(g, c).includes(to.id);
    const h = deserializeGame(serializeGame(g));
    const kept = JSON.stringify(h.world.provinces[to.id].cult) === JSON.stringify(to.cult) && h.cultures.length === g.cultures.length;
    for (let i = 0; i < 24; i++) { tick(g); g.pending.length = 0; }
    return { cultures, mixed, sums, griev: gPe > gEq, assim: mPe > 0, carried, claims, kept, bad: __sane(g) }; })()`);
  assert(r.cultures && r.mixed && r.sums, 'peoples not generated properly');
  assert(r.griev, 'persecution should breed more grievance');
  assert(r.assim, 'persecution should force assimilation');
  assert(r.carried, 'migrants should carry their culture');
  assert(r.claims, 'our people abroad should be claimed');
  assert(r.kept, 'peoples lost on save/load');
  assert(r.bad.length === 0, r.bad.join('; '));
});

test('cities: housing shortages raise rents and slums; development lowers births', () => {
  const r = run(`(() => { const g = createGame('city1', { size: 'small', countries: 6 }); setPlayer(g, 0); const c = g.countries[0];
    for (let i = 0; i < 3; i++) { tick(g); g.pending.length = 0; }
    const p = g.world.provinces.filter(x => x.owner === 0).sort((a, b) => urbanPop(b) - urbanPop(a))[0];
    const workerSol0 = p.sol.workers;
    // Halve the housing: rents and slums should appear, and owners should gain the rent.
    p.housing = urbanPop(p) * 0.6;
    tickSociety(g);
    const rent = p.rentExcess, slum = p.slum;
    for (let i = 0; i < 2; i++) { tick(g); g.pending.length = 0; }
    const paid = p.rentIn > 0;
    // Builders respond over time.
    const h0 = p.housing; for (let i = 0; i < 24; i++) { tick(g); g.pending.length = 0; }
    const built = p.housing > h0;
    // The demographic transition: a rich, literate province has fewer births.
    const fx = (sol, lit) => ({ sol: Object.fromEntries(POP_KEYS.map(k => [k, sol])), pops: Object.fromEntries(POP_KEYS.map(k => [k, k === 'peasants' ? 1 : 0])), pop: 1, lit }); const poor = fx(20, 0.1), rich = fx(80, 0.9);
    const bPoor = naturalGrowth(poor, 1).birth, bRich = naturalGrowth(rich, 1).birth;
    const h = deserializeGame(serializeGame(g));
    return { rent, slum, paid, built, transition: bRich < bPoor * 0.7, kept: Math.abs(h.world.provinces[p.id].housing - p.housing) < 1e-4 * p.housing + 1, cities: (c.cities || []).length > 0 || true, bad: __sane(g) }; })()`);
  assert(r.rent > 0.03 && r.slum > 0.2, 'a housing shortage should raise rents and create slums');
  assert(r.paid, 'rents should flow to owners');
  assert(r.built, 'builders should add housing');
  assert(r.transition, 'development should lower births');
  assert(r.kept, 'housing lost on save/load');
  assert(r.bad.length === 0, r.bad.join('; '));
});

test('aging dilutes relief, inequality is measured, minorities organize', () => {
  const r = run(`(() => { const g = createGame('age1', { size: 'small', countries: 6 }); setPlayer(g, 0); const c = g.countries[0];
    for (let i = 0; i < 13; i++) { tick(g); g.pending.length = 0; }
    const gini = c.gini > 0.05 && c.gini < 0.95;
    c.elderly = 0.06; tick(g); g.pending.length = 0; const reliefYoung = c.econ.welfarePC.workers - c.econ.welfarePC.clerks;
    c.elderly = 0.2; tick(g); g.pending.length = 0; const reliefOld = c.econ.welfarePC.workers - c.econ.welfarePC.clerks;
    // An excluded, aggrieved minority builds a movement.
    c.laws.citizenship = 'persecution';
    for (const p of g.world.provinces) if (p.owner === 0) p.cult = { [c.culture]: 0.5, [g.countries[1].culture]: 0.5 };
    for (let i = 0; i < 36; i++) { tick(g); g.pending.length = 0; }
    return { gini, diluted: reliefOld < reliefYoung, league: c.movements.minority.support > 3, bad: __sane(g) }; })()`);
  assert(r.gini, 'inequality not measured');
  assert(r.diluted, 'an aging society should leave less welfare for poor relief');
  assert(r.league, 'a persecuted minority should organize');
  assert(r.bad.length === 0, r.bad.join('; '));
});

test('the campaign can be completed', () => {
  const r = run(`(() => {
    const g = startCampaign(); const c = g.countries[g.player]; const cs = g.campaign;
    const ui = { tab: 'overview', selected: null };
    for (let guard = 0; guard < 600 && !cs.ended; guard++) {
      const res = campaignUpdate(g, ui);
      if (res && res.brief !== undefined) campaignBriefed(g);
      const s = cs.step;
      if (s === 0) ui.selected = getNeighbors(g, c.id)[0];
      if (s === 1) appointMinister(g, 'finance', candidatesFor(g, c, 'finance')[0].id);
      if (s === 2) { c.policy.tax = 0.32; c.policy.welfare = 9; }
      if (s === 4) cs.tabsSeen.push('market');
      if (s === 5) { orderBuilding(g, buildingProspects(g, c).find(o => o.prov && o.va > 0).t); }
      if (s === 6) cs.tabsSeen.push('pops');
      if (s === 7) { c.pc = 100; performDomestic(g, 'campaign'); cs.actions['dom:campaign'] = true; }
      if (s === 10) { c.pc = 100; appeaseFaction(g, 'military'); cs.actions['appease:military'] = true; }
      if (s === 11) { ui.selected = cs.nations.drevany; ui.tab = 'diplomacy'; }
      if (s === 12) { c.pc = 100; performDiplo(g, 'improve', cs.nations.drevany); }
      if (s === 13) setResearch(g, TECH_KEYS.find(id => techAvailable(c, id)));
      if (s === 14) { c.pc = 100; movementAction(g, 'labor', 'enact'); cs.actions['move:enact'] = true; }
      if (s === 15) { c.pc = 100; const b = foundBloc(g, c.id, 'freeTrade'); joinBloc(g, b, cs.nations.aldmark); }
      if (s === 16) { c.pc = 100; setDesignation(g, provincesOf(g, c.id).find(p => p.id !== c.capital).id, 'sez'); }
      if (s === 17) { c.pc = 100; c.reform = null; proposeLaw(g, c, 'church', Object.keys(LAW_CATS.church.opts).find(o => o !== c.laws.church)); }
      if (s === 18) cs.tabsSeen.push('military');
      // Resolve whatever the simulation asks of the player, then let a month pass.
      for (const p of g.pending.splice(0)) {
        if (p.type === 'event') resolveEvent(g, p, eventOptions(g, c, p)[0].i);
        if (p.type === 'election' && p.hung) resolveCoalitionChoice(g, p, p.options.length ? 0 : 'minority');
        else if (p.type === 'election' && !p.won) resolveElectionLoss(g, 'concede');
        if (p.type === 'peaceOffer') resolvePeaceOffer(g, p, true);
        if (p.type === 'allyCall') resolveAllyCall(g, p, false);
      }
      if (!cs.ended) tick(g);
    }
    return { ended: cs.ended, step: cs.step, ending: cs.ending && cs.ending.title, months: g.month }; })()`);
  assert(r.ended, 'campaign stuck at step ' + r.step + ' after ' + r.months + ' months');
  assert(r.ending, 'no ending');
});

let failed = 0;
for (const r of results) {
  console.log(`${r.ok ? '✓' : '✗'} ${r.name} (${r.ms}ms)`);
  if (!r.ok) { failed++; console.log('   ' + r.err.split('\n').slice(0, 4).join('\n   ')); }
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
