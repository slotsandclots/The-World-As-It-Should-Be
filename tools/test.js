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
  assert(r.cb > -0.06 && r.cb < 0.08, 'central bank inflation off target: ' + r.cb);
  assert(r.hot > 0.15 && r.priceRise > 1.5, 'printing did not inflate: ' + r.hot);
  assert(r.debt1 < r.debt0, 'inflation should erode the debt ratio');
  assert(r.minWage < 0.97, 'real wages should lag rising prices');
  assert(r.kept, 'price level lost on save/load');
  assert(r.bad.length === 0, r.bad.join('; '));
});

test('4c: sticky wages, unemployment insurance and the AI fiscal stance', () => {
  const r = run(`(() => { const g = createGame('wages1', { size: 'small', countries: 6 }); setPlayer(g, 0); const c = g.countries[0];
    for (let i = 0; i < 24; i++) { tick(g); g.pending.length = 0; }
    const E = c.econ;
    const b = c._provs.flatMap(p => p.buildings).find(b => b.wb > 0);
    // Value added halves: the wage bill falls only slowly, so the margin is squeezed.
    const wb0 = b.wb; b.vaS = b.vaS * 0.5;
    c.laws.labor = 'unions'; const fallU = wageFall(c); c.laws.labor = 'none'; const fallN = wageFall(c); c.laws.labor = 'unions';
    tick(g); g.pending.length = 0;
    const sticky = b.wb > wb0 * 0.9;
    c.policy.welfare = 8; const rrU = uiRate(c); c.laws.labor = 'none'; const rrN = uiRate(c); c.laws.labor = 'unions';
    // Make people jobless: benefits flow and the fund runs a deficit.
    for (const p of c._provs) for (const bb of p.buildings) bb.active = 0.3;
    for (let i = 0; i < 3; i++) { tick(g); g.pending.length = 0; }
    const ui = E.uiShare, avg = E.uiAvg, bud = projectBudget(c);
    // AI stances: a left government spends in a slump, an indebted right one cuts.
    const a = g.countries[1]; a.econ.gap = -0.08; a.econ.bankCrisis = 0; a.treasury = 0;
    const left = (() => { a.gov = 'communist'; return fiscalStance(a, 0.1); })();
    const right = (() => { a.gov = 'fascist'; return fiscalStance(a, 0.5); })();
    a.econ.gap = 0.06; const boom = fiscalStance(a, 0.3);
    deserializeGame(serializeGame(g));
    return { sticky, fallU, fallN, rrU, rrN, ui, avg, bud: bud.ui > 0 && bud.uiContrib >= 0, left, right, boom,
      bad: __sane(g) }; })()`);
  assert(r.fallU < r.fallN, 'unions should make wages fall more slowly');
  assert(r.sticky, 'wages should not fall at once with value added');
  assert(r.rrU > r.rrN, 'free unions should give a higher benefit');
  assert(r.ui > 0 && r.ui > r.avg, 'mass layoffs should raise benefits above their long-run cost: ' + r.ui + ' vs ' + r.avg);
  assert(r.bud, 'benefits and contributions should show in the budget');
  assert(r.left === 'stimulus', 'a left government should spend in a slump: ' + r.left);
  assert(r.right === 'austerity', 'an indebted right government should cut in a slump: ' + r.right);
  assert(r.boom === 'cooling', 'a boom should bring cooling: ' + r.boom);
  assert(r.bad.length === 0, r.bad.join('; '));
});

test('closed loop: state debt has real holders, lenders can refuse, default hits them', () => {
  const r = run(`(() => { const g = createGame('debt1', { size: 'small', countries: 6 });
    for (let i = 0; i < 120; i++) { tick(g); g.pending.length = 0; }
    const c = g.countries.find(x => x.alive && ownersAllowed(x)); setPlayer(g, c.id);
    c.treasury = Math.min(c.treasury, 0); financeBudget(g, c);
    // Every unit of debt is someone's asset.
    const mism = g.countries.filter(x => x.alive && x.debt && Math.abs(debtTotal(x.debt) - Math.max(0, -x.treasury)) > 1e-6 * (1 + Math.abs(x.treasury))).length;
    const E = c.econ, D = ensureDebt(c);
    // A new deficit is lent by savers, out of the pool that funds private investment.
    E.investPool = Math.max(E.investPool, E.gdpM * 3); E.conf = 0.7;
    const pool0 = E.investPool, sav0 = D.savers;
    c.treasury -= c.gdpNom * 0.01; financeBudget(g, c);
    const saversLent = D.savers > sav0, crowded = E.investPool < pool0;
    // Interest on foreign-held debt reaches the lender.
    const l = g.countries.find(x => x.alive && x.id !== c.id && ownersAllowed(x));
    D.foreign[l.id] = (D.foreign[l.id] || 0) + c.gdpNom * 0.1; c.treasury -= c.gdpNom * 0.1;
    const lp0 = l.econ.investPool; payInterest(g, c, debtInterest(c)); const lenderPaid = l.econ.investPool > lp0;
    // No one will lend: the bills go unpaid and spending is cut.
    E.investPool = 0; E.money = 0; for (const x of g.countries) if (x.econ) { x.econ.investPool = 0; x.econ.statePool = 0; }
    c.budget = projectBudget(c);
    c.treasury -= c.gdpNom * 0.05; financeBudget(g, c);
    const refused = D.arrears > 0 && D.payFrac < 1 && D.crisis > 0;
    const spendCut = projectBudget(c).payFrac < 1;
    // Default: holders lose, banks lose capital, the foreign lender resents it.
    const rel0 = relation(g, c.id, l.id), debt0 = Math.max(0, -c.treasury), cap0 = E.bankCap, banks0 = D.banks;
    c.pc = 100; const res = playerDefault(g);
    const ok2 = Math.abs(debtTotal(D) - Math.max(0, -c.treasury)) < 1e-6 * (1 + debt0);
    const h = deserializeGame(serializeGame(g));
    return { mism, saversLent, crowded, lenderPaid, refused, spendCut, defOk: res.ok, lower: Math.max(0, -c.treasury) < debt0, bankHit: banks0 <= 0 || E.bankCap < cap0 || E.bankCrisis > 0,
      soured: relation(g, c.id, l.id) < rel0, ok2, kept: h.countries[c.id].debt && Math.abs(debtTotal(h.countries[c.id].debt) - debtTotal(D)) < 1e-5 * (1 + debtTotal(D)), bad: __sane(g) }; })()`);
  assert(r.mism === 0, r.mism + ' nations whose debt holders do not add up to their debt');
  assert(r.saversLent && r.crowded, 'savers should fund the deficit out of the investment pool');
  assert(r.lenderPaid, 'interest should reach the foreign lender');
  assert(r.refused && r.spendCut, 'with no lenders, bills go unpaid and spending is cut');
  assert(r.defOk && r.lower, 'default should write the debt down');
  assert(r.bankHit, 'default should hit bank capital');
  assert(r.soured, 'the foreign lender should resent the default');
  assert(r.ok2, 'holders should still add up after a default');
  assert(r.kept, 'debt holders lost on save/load');
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

test('healthcare: a funded health service lowers deaths and pays doctors', () => {
  const r = run(`(() => { const g = createGame('health1', { size: 'small', countries: 6 }); setPlayer(g, 0); const c = g.countries[0];
    for (let i = 0; i < 3; i++) { tick(g); g.pending.length = 0; }
    const p = g.world.provinces.find(x => x.owner === 0);
    c.policy.health = 0; const d0 = naturalGrowth(p, 1, c).death; tick(g); g.pending.length = 0; const pay0 = c.econ.govWagePC.clerks;
    c.policy.health = 6; const d1 = naturalGrowth(p, 1, c).death; tick(g); g.pending.length = 0; const pay1 = c.econ.govWagePC.clerks;
    return { fewer: d1 < d0, paid: pay1 > pay0, inBudget: SPEND_KEYS.includes('health') && projectBudget(c).spendPct > 0 }; })()`);
  assert(r.fewer, 'healthcare should lower deaths');
  assert(r.paid, 'healthcare should pay doctors (clerks)');
  assert(r.inBudget, 'healthcare should be in the budget');
});

test('ideas spread after a revolution; kin unite; universities speed research', () => {
  const r = run(`(() => { const g = createGame('ideas1', { size: 'small', countries: 8 }); setPlayer(g, 0); const c = g.countries[0];
    for (let i = 0; i < 3; i++) { tick(g); g.pending.length = 0; }
    const n = getNeighbors(g, 0)[0], t = g.countries[n];
    const before = c.currents.socialism;
    changeGovernment(g, t, 'communist', 'revolution');
    for (let i = 0; i < 12; i++) { tick(g); g.pending.length = 0; }
    const spread = c.currents.socialism > before + 0.02 && ideaBoost(c, 'labor') > 1;
    // Kinship and unification.
    ensureFamilies(g);
    const kin = g.countries.find(x => x.alive && x.id !== 0 && getNeighbors(g, 0).includes(x.id));
    g.cultures[kin.culture].family = g.cultures[c.culture].family;
    const alive0 = kin.alive; unite(g, c, kin);
    const united = alive0 && !kin.alive;
    // Universities.
    const r0 = researchRate(c); c.uni = 0.2; const r1 = researchRate(c);
    const h = deserializeGame(serializeGame(g));
    return { spread, united, research: r1 > r0, kept: !!h.families && h.countries[0].currents && h.countries[0].currents.socialism >= 0, bad: __sane(g) }; })()`);
  assert(r.spread, 'a revolution next door should spread its idea');
  assert(r.united, 'kin nations should be able to unite');
  assert(r.research, 'graduates should speed research');
  assert(r.kept, 'ideas and families lost on save/load');
  assert(r.bad.length === 0, r.bad.join('; '));
});

test('minorities interest group, secondary schools, and coup/revolution warning meters', () => {
  const r = run(`(() => { const g = createGame('m3end', { size: 'small', countries: 6 }); setPlayer(g, 0); const c = g.countries[0];
    for (let i = 0; i < 3; i++) { tick(g); g.pending.length = 0; }
    const ig = FACTION_KEYS.includes('minorities') && c.factions.minorities >= 0 && c.igLeaders.minorities && interestClout(c).minorities >= 0;
    const secOk = c.sec > 0 && c.sec < 1;
    const lawHurts = lawPreference(c, 'citizenship', 'persecution', 'minorities') < 0;
    const before = (UI_free => coupRisk(g, c).value)();
    c.generals[0].loyalty = 5; c.generals[0].ambition = 90; c.factions.military = 25; c.stability = 25;
    const after = coupRisk(g, c).value;
    c.unrest = 60; const rev = revolutionRisk(g, c).value;
    return { ig, secOk, lawHurts, coup: after > before && after >= 60, rev: rev >= 60, bad: __sane(g) }; })()`);
  assert(r.ig, 'minorities interest group missing');
  assert(r.secOk, 'secondary schooling not tracked');
  assert(r.lawHurts, 'persecution should anger the minorities group');
  assert(r.coup, 'coup risk should build with a disloyal, ambitious general');
  assert(r.rev, 'revolution risk should build with unrest and low stability');
  assert(r.bad.length === 0, r.bad.join('; '));
});

test('notable figures come from the pops, publish works, and inventors speed research', () => {
  const r = run(`(() => {
    const g = createGame('figs', { size: 'small', countries: 8 }); setPlayer(g, 0);
    for (let i = 0; i < 36; i++) { tick(g); g.pending.length = 0; }
    const all = g.countries.filter(c => c.alive).flatMap(c => c.figures || []);
    const kinds = new Set(all.map(f => f.kind));
    // A writer in a defeated nation writes about the defeat; the book moves the fascist current.
    const c = g.countries[1]; c.revanchism = 0.6; c.warExhaustion = 0;
    const w = makeFigure(g, c, 'writer'); w.ideo = { econ: 0.4, auth: 0.8 }; w.renown = 60; c.figures.push(w);
    const shock0 = c.ideaShock.fascism || 0;
    let grievance = 0; for (let i = 0; i < 20; i++) { publish(g, c, w); if (w.works[w.works.length - 1].theme === 'grievance') grievance++; }
    // An inventor in the field being researched adds research points.
    const P = g.countries[0]; ensureResearch(P); P.research.current = TECH_KEYS.find(id => techAvailable(P, id));
    P.figures = P.figures.filter(f => f.kind !== 'inventor');
    const r0 = researchRate(P);
    const inv = makeFigure(g, P, 'inventor'); inv.field = TECHS[P.research.current].cat; inv.renown = 80; P.figures.push(inv);
    const r1 = researchRate(P);
    // Patronage and bans (with a licensed press).
    P.pc = 100; P.laws.press = 'licensed';
    const wr = makeFigure(g, P, 'writer'); P.figures.push(wr);
    const pat = figureAction(g, wr.id, 'patronize'); const ban = figureAction(g, wr.id, 'ban');
    // Generals gain renown in battle.
    const gen = bestGeneral(P); const before = gen.renown || 0; for (let i = 0; i < 20; i++) battleFought(g, P.id, 1, true);
    return { n: all.length, kinds: kinds.size, grievance, shock: (c.ideaShock.fascism || 0) - shock0, r0, r1, pat: pat.ok, ban: ban.ok, banned: !!wr.banned, genGain: (gen.renown || 0) - before, won: gen.won,
      named: all.every(f => f.name && f.renown >= 0 && f.renown <= 100), hall: (g.hall || []).length >= 0, top: figuresOfTheAge(g, 5).length };
  })()`);
  assert(r.n > 0 && r.kinds >= 2, `figures: ${r.n} of ${r.kinds} kinds`);
  assert(r.named, 'figures need names and bounded renown');
  assert(r.grievance >= 10, `a nationalist writer in a defeated nation should write grievance books (${r.grievance}/20)`);
  assert(r.shock > 0.01, 'grievance literature should feed the fascist current');
  assert(r.r1 > r.r0 * 1.1, `a famous inventor should speed research (${r.r0.toFixed(2)} -> ${r.r1.toFixed(2)})`);
  assert(r.pat && r.ban && r.banned, 'patronage and bans should work under a licensed press');
  assert(r.genGain > 5 && r.won === 20, 'generals gain renown from battles');
  assert(r.top > 0, 'figures of the age');
});

test('a lost war leaves a wound: revanchism, the stab-in-the-back myth, a demagogue and an enabling act', () => {
  const r = run(`(() => {
    const g = createGame('wound', { size: 'small', countries: 8 }); setPlayer(g, 0);
    for (let i = 0; i < 3; i++) { tick(g); g.pending.length = 0; }
    const L = g.countries.find(c => c.id !== 0 && c.alive && getNeighbors(g, c.id).some(n => n !== 0));
    const W = g.countries[getNeighbors(g, L.id).find(n => n !== 0)];
    if (L.gov !== 'democracy') changeGovernment(g, L, 'democracy', 'reform', { keepLeader: true });
    const war = declareWar(g, W.id, L.id);
    const prov0 = L.provinceCount;
    applyPeaceTerms(g, W.id, L.id, { provinces: 2, reparations: true });
    endWar(g, war, 'peace');
    const wound = L.wound, myth0 = wound ? wound.myth : 0, intact0 = wound && wound.armyIntact;
    const scheduled = (g.scheduled || []).some(e => e.id === 'stabInBack' && e.cid === L.id);
    const mil0 = L.factions.military;
    for (let i = 0; i < 24; i++) { tick(g); g.pending.length = 0; }
    const rev = L.revanchism, parts = L._why && L._why.revanchism ? L._why.revanchism.parts.map(p => p[0]) : [];
    // Force the conditions for a demagogue and wait for one to rise.
    if (GOVS[L.gov].party !== 'multi') changeGovernment(g, L, 'democracy', 'reform', { keepLeader: true });
    L.revanchism = Math.max(L.revanchism, 0.5); L.movements.nationalist.support = 12;
    let dem = null; for (let i = 0; i < 400 && !dem; i++) { tickDemagogue(g, L); dem = demagogueOf(L); }
    const nat = L.parties.find(p => p.id === 'nat');
    // The demagogue's party takes power, and asks for rule by decree.
    let fascist = false;
    if (dem && nat) {
      setRulingParty(g, L, 'nat');
      const isDem = !!L.leader.demagogue;
      tickDemagogue(g, L);
      const ev = eventById('enablingAct');
      const ok = ev.cond(g, L, {});
      resolveEventFor(g, L, ev, 0, {});
      fascist = isDem && ok && L.gov === 'fascist';
    }
    // The myth as a crisis for the AI: every option resolves.
    const ev2 = eventById('stabInBack'); const errs = [];
    for (let i = 0; i < ev2.options.length; i++) { try { resolveEventFor(g, L, ev2, i, {}); } catch (e) { errs.push(e.message); } }
    return { lost: prov0 - L.provinceCount, wound: !!wound, myth: myth0, intact: intact0, scheduled, rev, parts, dem: !!dem, nat: !!(nat && nat.id), fascist, errs, mythArmy: mythOnArmy(Object.assign({}, L, { gov: 'democracy', wound: { myth: 0.5 } })) };
  })()`);
  assert(r.lost === 2 && r.wound, 'the loser should remember the defeat');
  assert(r.intact && r.myth > 0.3 && r.scheduled, `an undefeated army and a civilian peace should seed the myth (myth ${r.myth})`);
  assert(r.rev > 0.05, `revanchism should build after losing land and paying reparations (${r.rev})`);
  assert(r.parts.includes('Our lost provinces') && r.parts.includes('Reparations we pay'), 'revanchism has a breakdown');
  assert(r.dem && r.nat, 'a demagogue should rise and lead a nationalist party');
  assert(r.fascist, 'a demagogue in power can end the republic with an enabling act');
  assert(r.errs.length === 0, r.errs.join('; '));
  assert(r.mythArmy < 0, 'the myth turns the army against a civilian government');
});

test('wars draw nations in and become world wars that end at a peace conference', () => {
  const r = run(`(() => {
    const g = createGame('ww', { size: 'small', countries: 12 });
    for (let i = 0; i < 3; i++) { tick(g); g.pending.length = 0; }
    const gp = greatPowers(g);
    const A = g.countries[gp[0]];
    const B = g.countries[getNeighbors(g, A.id)[0] ?? gp[1]];
    for (const x of g.countries) { x.allies = []; }
    g.blocs = [];
    const war = declareWar(g, A.id, B.id);
    // Draw in other nations: great powers on both sides.
    const inWar = id => war.a.includes(id) || war.b.includes(id);
    for (const id of gp) if (!inWar(id)) { const na = war.a.filter(x => gp.includes(x)).length, nb = war.b.filter(x => gp.includes(x)).length; joinWar(g, war, id, na <= nb ? 'a' : 'b'); }
    for (const x of g.countries.filter(x => x.alive && !inWar(x.id)).slice(0, 3)) joinWar(g, war, x.id, 'b');
    // An ally of a losing side wants in.
    const outsider = g.countries.find(x => x.alive && !inWar(x.id));
    let wish = null;
    if (outsider) { outsider.allies.push(war.b[0]); g.countries[war.b[0]].allies.push(outsider.id); wish = entryWish(g, war, outsider, 'b'); }
    war.start -= 6; // a world war has to last a few months
    tickWorldWars(g);
    const isWorld = !!war.world, name = war.name;
    // Side b wins: it occupies most of side a's land.
    for (const p of g.world.provinces) if (war.a.includes(p.owner) && p.id !== g.countries[p.owner].capital && g.rng.chance(0.7)) p.occ = war.b[0];
    const losers = war.a.slice();
    endWar(g, war, 'peace');
    const rec = (g.worldWars || [])[0] || {};
    const treaties = losers.filter(id => g.countries[id].alive && g.countries[id].treaty).length;
    const wounded = losers.filter(id => g.countries[id].alive && g.countries[id].wound && g.countries[id].wound.since === g.month).length;
    const reps = (g.reparations || []).filter(x => losers.includes(x.from)).length;
    // Disarmament holds for AI nations that don't dare break it.
    const L = g.countries[losers.find(id => g.countries[id].alive && g.countries[id].treaty)];
    let capped = null;
    if (L) { L.revanchism = 0; L.policy.military = 8; tickTreaty(g, L); capped = L.policy.military; }
    const s = serializeGame(g), h = deserializeGame(s);
    return { isWorld, name, wish: wish && wish.w > 0, ended: rec.end === g.month, outcome: rec.outcome, treaty: rec.treaty, treaties, wounded, reps, capped, cap: L && L.treaty.milCap, saved: (h.worldWars || []).length === (g.worldWars || []).length && h.worldWarCount === g.worldWarCount, gone: !g.wars.includes(war) };
  })()`);
  assert(r.isWorld && r.name === 'Great War', `a war of great powers on both sides should become the Great War (${r.name})`);
  assert(r.wish, 'an ally of the losing side should want to enter the war');
  assert(r.ended && r.outcome === 'b' && /^Treaty of /.test(r.treaty || ''), `the peace conference should record the victors (${r.outcome}, ${r.treaty})`);
  assert(r.wounded >= 1, 'the losers should carry the wound');
  assert(r.treaties >= 1 && r.reps >= 1, `great powers that lose are disarmed and pay reparations (${r.treaties} treaties, ${r.reps} reparations)`);
  assert(r.capped === null || r.capped === r.cap, 'an AI that does not dare break the treaty stays under its limit');
  assert(r.saved && r.gone, 'world wars survive a save');
});

test('closed loop, phase 2: imports are paid for, capital is lent abroad, the broke cut imports', () => {
  const r = run(`(() => {
    const g = createGame('pay', { size: 'small', countries: 10 }); setPlayer(g, 0);
    for (let i = 0; i < 24; i++) { tick(g); g.pending.length = 0; }
    const alive = g.countries.filter(c => c.alive);
    const net = () => alive.reduce((s, c) => s + c.econ.reserves, 0);
    const gross = alive.reduce((s, c) => s + Math.abs(c.econ.tradeBalance), 0);
    // Reserves only move between nations: world trade balances, loans and interest are someone's payment.
    const r0 = net(); tickPayments(g); const drift = Math.abs(net() - r0 - alive.reduce((s, c) => s + c.econ.tradeBalance, 0));
    const tradeNet = Math.abs(alive.reduce((s, c) => s + c.econ.tradeBalance, 0));
    const debts = alive.reduce((s, c) => s + extDebtOf(c), 0), assets = alive.reduce((s, c) => s + extAssetsOf(g, c), 0);
    // A nation with no reserves and no credit has to cut its imports.
    const c = alive[1]; c.econ.reserves = -c.gdp * 0.3; c.debt = c.debt || {}; c.debt.crisis = 6;
    for (let i = 0; i < 4; i++) { tick(g); g.pending.length = 0; c.debt.crisis = 6; }
    return { drift, tradeNet, gross, debts, assets, squeeze: c.econ.importSqueeze, sane: __sane(g) };
  })()`);
  assert(r.tradeNet < r.gross * 0.05 + 1e-6, `world trade should balance (net ${r.tradeNet}, gross ${r.gross})`);
  assert(r.drift < 1e-6, `loans and interest should move reserves, not create them (${r.drift})`);
  assert(Math.abs(r.debts - r.assets) < 1e-6, 'every foreign debt is someone\'s asset');
  assert(r.squeeze > 0.2, `a nation out of reserves and credit should cut its imports (${r.squeeze})`);
  assert(r.sane.length === 0, r.sane.join('; '));
});

test('closed loop, phase 2: a strong currency never imports past the shortfall; defaulters and the dead lose their credit', () => {
  const r = run(`(() => {
    const g = createGame('pay2', { size: 'small', countries: 10 }); setPlayer(g, 0);
    for (let i = 0; i < 12; i++) { tick(g); g.pending.length = 0; }
    const alive = g.countries.filter(c => c.alive);
    // An open nation (many partners, no tariffs) with the strongest currency buys more abroad,
    // but never more of a good than it lacks at home.
    let over = 0;
    for (const c of alive) {
      c.econ.fx = PAY.FX_MAX; c.trade = alive.filter(o => o.id !== c.id).map(o => o.id);
      tickEconomy(g, false);
      for (const k of GOOD_KEYS) { const E = c.econ, gap = Math.max(0, E.D[k] - E.S[k]); if (E.imports[k] > gap * 1.0001 + 1e-6) over++; }
    }
    // A nation that defaults abroad gets no new loans for five years.
    const d = alive[1], L = alive[2];
    d.extDebt = { [L.id]: d.gdp * 1.5 }; d.econ.reserves = -d.gdp * 0.05;
    tickPayments(g);
    const defaulted = d.extDefaulted === g.month, lockedOut = d.econ.borrowed === 0;
    // A borrower that ceases to exist takes its debts with it.
    const b = alive[3]; b.extDebt = { [L.id]: 1 }; b.alive = false;
    tickPayments(g);
    const gone = b.extDebt === null && !foreignPositions(g, L).owed.some(([n]) => n === b.name);
    b.alive = true;
    return { over, defaulted, lockedOut, gone, sane: __sane(g) };
  })()`);
  assert(r.over === 0, `${r.over} goods imported beyond the shortfall at a strong currency`);
  assert(r.defaulted && r.lockedOut, 'a nation that defaults abroad should get no new foreign loans');
  assert(r.gone, 'debts of a nation that no longer exists should be written off');
  assert(r.sane.length === 0, r.sane.join('; '));
});

test('closed loop, phase 2, layer 2: a gold parity holds, is attacked when reserves run out, and can be left', () => {
  const r = run(`(() => {
    const g = createGame('peg', { size: 'small', countries: 10 }); setPlayer(g, 0);
    for (let i = 0; i < 6; i++) { tick(g); g.pending.length = 0; }
    const alive = g.countries.filter(c => c.alive);
    const c = g.countries[0];
    c.reform = null; c.laws.monetary = 'gold'; c.econ.parity = null; c.econ.leftGold = null; c.econ.reserves = c.gdp * 0.05;
    tick(g); g.pending.length = 0;
    const parity = c.econ.parity, nomHeld = c.econ.fxNom === parity;
    // Gold leaves with a deficit: the money supply follows it down.
    c.econ.res0 = c.econ.reserves + c.gdp * 0.01; c.econ.reserves = c.econ.res0 - c.gdp * 0.01;
    tickCurrency(g, c, 0, 1);
    const goldOut = c.econ.goldFlow < 0;
    // Reserves gone: speculators attack, capital flees to a haven, and nothing is created or lost.
    c.econ.reserves = -c.gdp * 0.12; c.econ.investPool = Math.max(c.econ.investPool, 1e9);
    const before = alive.reduce((s, o) => s + o.econ.reserves, 0), poolBefore = alive.reduce((s, o) => s + o.econ.investPool, 0);
    c.econ.res0 = c.econ.reserves;
    tickCurrency(g, c, -0.12, 1);
    const attacked = !!c.econ.attack, fled = c.econ.attack && c.econ.attack.flight > 0;
    const moved = Math.abs(alive.reduce((s, o) => s + o.econ.reserves, 0) - before) < 1e-9 && Math.abs(alive.reduce((s, o) => s + o.econ.investPool, 0) - poolBefore) < 1;
    // Defending costs a premium on the interest rate.
    tickMoney(g, c); const premium = c.econ.rate >= PAY.DEFEND_PREMIUM;
    // Leaving gold: the law changes, the currency floats and falls fast.
    const fx0 = c.econ.fx, res = playerLeaveGold(g);
    for (let i = 0; i < 3; i++) tickCurrency(g, c, -0.12, 1);
    const floated = res.ok && c.laws.monetary !== 'gold' && !c.econ.attack && c.econ.fx < fx0 - 0.05;
    // Going straight back on gold is refused.
    c.reform = null; const back = proposeLaw(g, c, 'monetary', 'gold', true);
    return { parity, nomHeld, goldOut, attacked, fled, moved, premium, floated, refused: !back.ok, sane: __sane(g) };
  })()`);
  assert(r.nomHeld, 'a gold currency is held at its parity');
  assert(r.goldOut, 'a deficit on gold should shrink the money supply');
  assert(r.attacked && r.fled, 'speculators should attack a parity with no reserves, and capital should flee');
  assert(r.moved, 'capital flight should move reserves and capital, not create them');
  assert(r.premium, 'defending a parity should raise interest rates');
  assert(r.floated, 'leaving gold should float the currency and let it fall');
  assert(r.refused, 'a nation that just left gold cannot go straight back');
  assert(r.sane.length === 0, r.sane.join('; '));
});

test('closed loop, phase 2, layer 2: a floating currency that collapses stops foreign lending', () => {
  const r = run(`(() => {
    const g = createGame('fxc', { size: 'small', countries: 10 }); setPlayer(g, 0);
    for (let i = 0; i < 6; i++) { tick(g); g.pending.length = 0; }
    const c = g.countries[1];
    c.reform = null; c.laws.monetary = 'centralBank'; c.econ.leftGold = null; c.econ.fxCrisisAt = null;
    c.econ.fxHist = Array(12).fill(1.2); c.econ.fx = 0.7;
    tickCurrency(g, c, -0.2, 1);
    const crisis = c.econ.fxCrisis > 0;
    c.econ.reserves = -c.gdp * 0.05; c.debt = c.debt || {}; c.debt.crisis = 0; c.extDefaulted = null;
    tickPayments(g);
    return { crisis, borrowed: c.econ.borrowed };
  })()`);
  assert(r.crisis, 'a currency down by a fifth in a year should be in crisis');
  assert(r.borrowed === 0, 'no one lends to a currency in crisis');
});

test('trade view: bilateral flows add up to every nation\'s trade and leave the economy unchanged', () => {
  const code = `(() => {
    const g = createGame('flows', { size: 'small', countries: 12 }); setPlayer(g, 0);
    for (let i = 0; i < 36; i++) { tick(g); g.pending.length = 0; }
    return { g, digest: JSON.stringify({ w: g.worldMarket.prices, c: g.countries.map(c => [c.alive, c.treasury, c.gdp, c.stability, c.unrest, c.econ.prices, c.econ.exports, c.econ.imports, c.econ.reserves == null ? null : c.econ.reserves]), m: g.month, rng: g.rng.getState() }) };
  })()`;
  const withFlows = run(code);
  const B = loadGame(); B.run('tickTradeFlows = null;');
  assert(B.run('typeof tickTradeFlows') !== 'function', 'the control world must run without the trade flows');
  const without = B.run(code);
  assert(withFlows.digest === without.digest, 'the economy must come out identical with and without the trade flows');
  const r = run(`(() => {
    const g = createGame('flows', { size: 'small', countries: 12 }); setPlayer(g, 0);
    for (let i = 0; i < 36; i++) { tick(g); g.pending.length = 0; }
    const M = g._flows.map; let worst = 0, checked = 0, traded = 0;
    for (const c of g.countries) {
      if (!c.alive) continue;
      GOOD_KEYS.forEach((k, gi) => {
        let out = 0, inn = 0;
        for (const key in M) { const [a, b, x] = key.split(':').map(Number); if (x !== gi) continue; if (a === c.id) out += M[key][0]; if (b === c.id) inn += M[key][0]; }
        const ex = c.econ.exports[k] || 0, im = c.econ.imports[k] || 0;
        worst = Math.max(worst, Math.abs(out - ex) / Math.max(1, ex), Math.abs(inn - im) / Math.max(1, im));
        checked++; if (ex > 0 || im > 0) traded++;
      });
    }
    const me = tradeOf(g, 0), gp = goodPartners(g, 0, 0);
    const shares = gp.buy.reduce((s, x) => s + x[2], 0);
    return { worst, checked, traded, pairs: tradePairs(g).length, avg: Object.keys(g._flowAvg || {}).length, meIn: me.in, shares, gpBuy: gp.buy.length };
  })()`);
  assert(r.traded > 10, `the test world should trade (${r.traded} nation-goods)`);
  assert(r.worst < 1e-6, `per-good flows must sum to each nation's exports and imports (worst relative error ${r.worst})`);
  assert(r.pairs > 0 && r.avg > 0, 'flows and their 12-month average are recorded');
  assert(r.gpBuy === 0 || Math.abs(r.shares - 1) < 1e-9, 'partner shares for a good sum to 1');
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
