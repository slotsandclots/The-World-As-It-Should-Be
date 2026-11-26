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
  assert(r.size < 4e6, 'save is too large for local storage: ' + r.size);
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
      // Resolve whatever the simulation asks of the player, then let a month pass.
      for (const p of g.pending.splice(0)) {
        if (p.type === 'event') resolveEvent(g, p, eventOptions(g, c, p)[0].i);
        if (p.type === 'election' && !p.won) resolveElectionLoss(g, 'concede');
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
