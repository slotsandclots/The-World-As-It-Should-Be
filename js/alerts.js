'use strict';
// The alert bar: what needs attention, grouped by kind, with visible
// build-up before coups and revolutions. Each meter is built from the same
// quantities the simulation uses to trigger the real thing.

const ALERT_CATS = {
  politics: { name: 'Politics', icon: 'politics', tab: 'politics' },
  economy: { name: 'Economy', icon: 'coin', tab: 'economy' },
  society: { name: 'Society', icon: 'pops', tab: 'pops' },
  war: { name: 'War', icon: 'military', tab: 'military' },
  decisions: { name: 'Decisions', icon: 'star', tab: 'politics' },
};

// 0..100: how close the army is to moving against us.
function coupRisk(game, c) {
  let gen = 0, who = null;
  for (const g of c.generals || []) {
    const t = clamp((40 - g.loyalty) / 30, 0, 1) * clamp((g.ambition || 50) / 70, 0.3, 1.2);
    if (t > gen) { gen = t; who = g; }
  }
  const army = clamp((50 - c.factions.military) / 45, 0, 1) * (c.stability < 45 ? 1 : 0.5);
  const weak = clamp((CRISIS_LEVEL + 10 - c.stability) / 30, 0, 1) * clamp((55 - c.factions.military) / 40, 0, 1);
  return { value: Math.round(clamp(Math.max(gen, army, weak) * 100, 0, 100)), who };
}

// 0..100: how close the streets are to bringing the regime down.
function revolutionRisk(game, c) {
  const crisis = crisisRisk(c) / 0.06;
  const streets = clamp((c.unrest - 30) / 25, 0, 1) * 0.8;
  let mov = 0, which = null;
  for (const k of MOVEMENT_KEYS) {
    const m = c.movements && c.movements[k];
    if (!m) continue;
    // Movements act at 22% support and radicalism 72 (movements.js); one that
    // wants another regime is at its most dangerous while stability is below 45.
    const def = MOVEMENTS[k];
    const t = clamp(m.support / UPRISING.support, 0, 1) * clamp((m.radicalism - 45) / (UPRISING.radicalism - 45), 0, 1) * (def.gov && def.gov !== c.gov && c.stability < UPRISING.stability ? 1 : 0.5);
    if (t > mov) { mov = t; which = k; }
  }
  return { value: Math.round(clamp(Math.max(crisis, streets, mov) * 100, 0, 100)), which };
}

function gatherAlerts(game, c) {
  const A = [];
  const add = (cat, level, text) => A.push({ cat, level, text });
  const E = c.econ || {};
  // Politics
  if (c.stability < 40) add('politics', c.stability < CRISIS_LEVEL ? 'bad' : 'warn', `Stability ${Math.round(c.stability)}${c.stability < CRISIS_LEVEL ? ': the regime can fall at any moment' : ''}`);
  if (c.legitimacy < 30) add('politics', 'warn', `Legitimacy ${Math.round(c.legitimacy)}`);
  for (const f of FACTION_KEYS) {
    const ld = c.igLeaders && c.igLeaders[f];
    if (c.factions[f] < 25) add('politics', ld && ld.stance === 'radical' ? 'bad' : 'warn', `${FACTIONS[f].name} loyalty ${Math.round(c.factions[f])}${ld && ld.stance === 'radical' ? ` under a radical leader (${ld.name})` : ''}`);
  }
  if (c.reform && c.reform.support != null && c.reform.support < 0.5) add('politics', 'warn', `Bill stalled: ${LAW_CATS[c.reform.cat].opts[c.reform.opt].name} (${Math.round(c.reform.support * 100)}% support)`);
  if (c.coalition) for (const pt of c.coalition.partners) if (pt.satisfaction < 35) { const p = c.parties.find(x => x.id === pt.id); add('politics', pt.satisfaction < 28 ? 'bad' : 'warn', `Coalition partner unhappy: ${p ? p.name : '?'} (${Math.round(pt.satisfaction)})`); }
  if (GOVS[c.gov].elections === 'free' && c.nextElection - game.month <= 6 && c.nextElection >= game.month) {
    const polls = computePolls(c), i = c.parties.findIndex(p => p.id === c.rulingParty);
    if (i >= 0 && polls[i] < Math.max(...polls)) add('politics', 'warn', `Election in ${c.nextElection - game.month} months, and we trail in the polls`);
  }
  // Economy
  const debt = Math.max(0, -c.treasury) / Math.max(1e-6, c.gdpNom || c.gdp);
  if (debt > 0.6) add('economy', debt > 1.1 ? 'bad' : 'warn', `Debt ${Math.round(debt * 100)}% of GDP${debt > 1.1 ? ': default looms at 150%' : ''}`);
  if (c.budget && c.budget.net < 0 && c.treasury < 0) add('economy', 'warn', `Deficit of ${fmtMoney(-c.budget.net)} a month`);
  const inf = typeof inflationYoY === 'function' ? inflationYoY(c) : 0;
  if (inf > 0.08) add('economy', inf > 0.3 ? 'bad' : 'warn', `Inflation ${Math.round(inf * 100)}% a year`);
  if (inf < -0.02) add('economy', 'warn', `Deflation ${Math.round(-inf * 100)}% a year`);
  if (E.bankCrisis > 0) add('economy', 'bad', `Banking crisis: lending frozen for ${E.bankCrisis} months`);
  if (E.dsr > 0.4) add('economy', 'warn', `Firms' debts outrun profits (${Math.round(E.dsr * 100)}%): bankruptcies ahead`);
  if ((E.unemployment || 0) > 0.06) add('economy', 'warn', `Unemployment ${Math.round(E.unemployment * 100)}%`);
  if (E.conf != null && E.conf < 0.75) add('economy', 'warn', `Business confidence ${Math.round(E.conf * 100)}`);
  // Society
  if ((c._grievance || 0) > 0.08) add('society', 'warn', `Minority grievance ${Math.round(c._grievance * 100)}`);
  if ((c.slumShare || 0) > 0.04) add('society', 'warn', `${Math.round(c.slumShare * 100)}% of people live in slums`);
  for (const k in c.separatists || {}) { const s = c.separatists[k]; if (s.support > 45) add('society', s.radicalism > 60 ? 'bad' : 'warn', `Separatists at ${Math.round(s.support)}% support${s.radicalism > 60 ? ', and radical' : ''}`); }
  if ((E.strataSol && E.strataSol.lower) < 25) add('society', 'warn', `The poor are going hungry (living standard ${Math.round(E.strataSol.lower)})`);
  // War
  for (const w of warsOf(game, c.id)) {
    const sc = warScore(game, w, c.id);
    add('war', sc < -30 ? 'bad' : 'warn', `${w.name}: war score ${fmtSigned(sc, 0)}`);
  }
  if (c.warExhaustion > 50) add('war', 'bad', `War exhaustion ${Math.round(c.warExhaustion)}`);
  // World wars, the memory of defeat and treaty limits (worldwar.js, revanchism.js).
  if (typeof worldWarRaging === 'function' && worldWarRaging(game) && !worldWarOf(game, c.id)) for (const w of game.wars.filter(x => x.world)) add('war', 'warn', `The ${w.name} rages: ${w.a.length + w.b.length} nations at war, and shipping is disrupted`);
  if ((c.revanchism || 0) > 0.35) add('politics', c.revanchism > 0.55 ? 'bad' : 'warn', `Revanchism ${Math.round(c.revanchism * 100)}: nationalists feed on the defeat`);
  const dem = typeof demagogueOf === 'function' ? demagogueOf(c) : null;
  if (dem && dem !== c.leader) add('politics', 'bad', `Demagogue ${dem.name} leads the nationalists (${Math.round(c.movements.nationalist.support)}% support)`);
  if (c.treaty && c.treaty.until > game.month && !c.treaty.broken && c.policy.military > c.treaty.milCap) add('war', 'bad', `Military spending breaks the treaty limit (${c.treaty.milCap}% of GDP)`);
  if ((c.infamy || 0) > INFAMY.coalitionAt * 0.8) add('war', 'warn', `Infamy ${Math.round(c.infamy)}: neighbors may unite against us`);
  // Decisions waiting
  const vacant = POST_KEYS.filter(p => !c.cabinet[p]);
  if (vacant.length) add('decisions', 'warn', `Cabinet posts empty: ${vacant.map(p => CABINET_POSTS[p].name).join(', ')}`);
  if (c.research && !c.research.current && typeof TECH_KEYS !== 'undefined' && TECH_KEYS.some(id => techAvailable(c, id))) add('decisions', 'warn', 'No research project chosen');
  if (c.pc >= 99) add('decisions', 'warn', 'Political capital is full: spend it or lose it');
  if (E.bankCrisis > 0 && typeof bailoutBanks === 'function') add('decisions', 'warn', 'The banks could be bailed out (Economy tab)');
  if (c.debt && c.debt.crisis > 0) { add('economy', 'bad', `Sovereign debt crisis: paying ${Math.round(c.debt.payFrac * 100)}% of spending`); add('decisions', 'warn', 'Cut, tax, print or default (Economy tab)'); }
  else if (c.debt && c.debt.trust < 0.7 && c.treasury < 0) add('economy', 'warn', `Lenders are wary: debt yields ${(c.debt.yield * 100).toFixed(1)}%`);
  return A;
}

function alertBarHtml(game, c) {
  const coup = coupRisk(game, c), rev = revolutionRisk(game, c);
  const A = gatherAlerts(game, c);
  const meter = (key, label, v, tab) => v < 20 ? '' : `<button class="alert-chip ${v > 60 ? 'bad' : 'warn'}" data-tip="${key}" data-alert-tab="${tab}"><span>${label}</span><span class="alert-meter"><i style="width:${v}%"></i></span><b>${v}</b></button>`;
  let h = meter('alert:coup', 'Coup risk', coup.value, 'leader') + meter('alert:revolution', 'Revolution risk', rev.value, 'politics');
  for (const k in ALERT_CATS) {
    const list = A.filter(a => a.cat === k);
    if (!list.length) continue;
    const bad = list.some(a => a.level === 'bad');
    h += `<button class="alert-chip ${bad ? 'bad' : 'warn'}" data-tip="alert:${k}" data-alert-tab="${ALERT_CATS[k].tab}">${icon(ALERT_CATS[k].icon, 13)}<span>${ALERT_CATS[k].name}</span><b>${list.length}</b></button>`;
  }
  return h;
}

function alertTipHtml(game, c, key) {
  const title = t => `<div class="tt-title"><span>${t}</span></div>`;
  if (key === 'coup') {
    const r = coupRisk(game, c);
    return title(`Coup risk ${r.value}`) + (r.who ? `<div class="tt-row"><span>Most dangerous general</span><span>${esc(r.who.name)}</span></div><div class="tt-row"><span>Their loyalty / ambition</span><span>${Math.round(r.who.loyalty)} / ${Math.round(r.who.ambition || 0)}</span></div>` : '') +
      `<div class="tt-row"><span>Military loyalty</span><span>${Math.round(c.factions.military)}</span></div><div class="tt-row"><span>Stability</span><span>${Math.round(c.stability)}</span></div>` +
      '<div class="tt-note">Generals with low loyalty and high ambition plot, more so when the army is unhappy and the regime is weak. Honor, promote or retire them (Leader tab), or win the army back (Politics tab).</div>';
  }
  if (key === 'revolution') {
    const r = revolutionRisk(game, c);
    const m = r.which && c.movements[r.which];
    const streets = m && m.streets != null && game.month - m.streets <= UPRISING.warn;
    return title(`Revolution risk ${r.value}`) + `<div class="tt-row"><span>Stability</span><span>${Math.round(c.stability)} (crisis below ${CRISIS_LEVEL}; movements can seize power below ${UPRISING.stability})</span></div><div class="tt-row"><span>Unrest</span><span>${Math.round(c.unrest)} (revolt above 55)</span></div>` +
      (m ? `<div class="tt-row"><span>${esc(MOVEMENTS[r.which].name)}</span><span>${Math.round(m.support)}% · radicalism ${Math.round(m.radicalism)}</span></div><div class="tt-row"><span></span><span class="${streets ? 'bad' : 'muted'}">${streets ? `took to the streets ${game.month - m.streets} months ago` : 'has not taken to the streets'}</span></div>` : '') +
      `<div class="tt-note">Below stability ${CRISIS_LEVEL}, or with unrest above 55, the regime can fall at any time. A movement with ${UPRISING.support}% support and radicalism above ${UPRISING.radicalism} first takes to the streets; after that, for two years, it can seize power while stability is below ${UPRISING.stability}. Meet demands, appease the power base, or crack down.</div>`;
  }
  const list = gatherAlerts(game, c).filter(a => a.cat === key);
  return title(ALERT_CATS[key] ? ALERT_CATS[key].name : key) + list.map(a => `<div class="tt-row"><span class="${a.level}">● ${esc(a.text)}</span></div>`).join('') + '<div class="tt-note">Click to open the relevant tab.</div>';
}
