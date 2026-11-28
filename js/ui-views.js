'use strict';
// Side-panel tab views. Each view returns HTML for the tab body.

Object.assign(UI, {
  // ------------------------------------------------------------------ peoples

  peoplesHtml(c, g) {
    ensurePeoples(g);
    const cu = nationComposition(g, c, 'cult'), fa = nationComposition(g, c, 'rel');
    const row = (name, v, mine) => `<div class="kv"><span>${esc(name)}${mine ? ' <span class="ftag">majority</span>' : ''}</span><span>${pct(v, v < 0.1 ? 1 : 0)}</span></div>`;
    const L = c.laws;
    let h = `<div class="card"><h3>${icon('pops', 16)} Peoples and faiths</h3>
      <p class="small muted" style="margin-top:0">${esc(LAW_CATS.citizenship.opts[L.citizenship].name)} · ${esc(LAW_CATS.church.opts[L.church].name)} · ${esc(LAW_CATS.migration.opts[L.migration].name)}. Minorities assimilate slowly; exclusion keeps them out of state jobs and the vote, and breeds grievance that feeds unrest and separatism.</p>
      <div class="grid2"><div><h4 style="margin-top:0">Cultures</h4>${cu.slice(0, 5).map(([k, v]) => row(cultureName(g, k), v, k === c.culture)).join('')}</div>
      <div><h4 style="margin-top:0">Faiths</h4>${fa.slice(0, 5).map(([k, v]) => row(faithName(g, k), v, k === c.faith)).join('')}</div></div>
      <div class="grid2" style="margin-top:6px">
        <div class="kv"><span>Minorities</span><span>${pct(c._minority || 0)}</span></div>
        <div class="kv"><span>Grievance</span><span class="${(c._grievance || 0) > 0.08 ? 'bad' : ''}">${Math.round((c._grievance || 0) * 100)}</span></div>
        <div class="kv"><span>Immigrants last year</span><span>${fmtPop((c.migYear && c.migYear.in) || 0)}</span></div>
        <div class="kv"><span>Emigrants last year</span><span>${fmtPop((c.migYear && c.migYear.out) || 0)}</span></div>
      </div>`;
    const claims = (c.claims || []).map(pid => g.world.provinces[pid]).filter(p => p.owner !== c.id);
    if (claims.length) h += `<p class="small" style="margin-bottom:0"><b>Our people abroad:</b> ${claims.slice(0, 6).map(p => `${esc(p.name)} (${esc(g.countries[p.owner].name)})`).join(', ')}${claims.length > 6 ? '…' : ''}. Nationalists want them brought home.</p>`;
    return h + '</div>';
  },

  // ------------------------------------------------------------------ cities and demographics

  societyHtml(c, g) {
    const cities = c.cities || topCities(g, c);
    const any = g.world.provinces.find(p => p.owner === c.id && p.pops);
    const ng = any ? naturalGrowth(any, 1) : null;
    let births = 0, deaths = 0, pop = 0;
    for (const p of g.world.provinces) if (p.owner === c.id && p.pops) { const n = naturalGrowth(p, (p.fb && p.fb.peasants) || 1, c); births += n.birth * p.pop; deaths += n.death * p.pop; pop += p.pop; }
    const yr = v => ((Math.pow(1 + v / Math.max(1, pop), 12) - 1) * 1000).toFixed(1);
    let h = `<div class="card"><h3>${icon('world', 16)} Cities and people</h3>
      <p class="small muted" style="margin-top:0">When cities outgrow their housing, rents rise (paid by laborers, workers, clerks and officials to landlords and owners) and people crowd into slums, which breed unrest. Builders add housing when rents pay; generous welfare (above 11% of GDP) adds public housing. As living standards and literacy rise, families have fewer children and the society ages.</p>
      <div class="grid2">
        <div class="kv"><span>City dwellers</span><span>${pct(c.urbanShare || 0)}</span></div>
        <div class="kv"><span>In slums</span><span class="${(c.slumShare || 0) > 0.03 ? 'bad' : ''}">${pct(c.slumShare || 0, 1)}</span></div>
        <div class="kv" title="Extra share of urban incomes paid as rent because of housing shortages"><span>Rent burden</span><span class="${(c.rentBurden || 0) > 0.05 ? 'bad' : ''}">${pct(c.rentBurden || 0, 1)}</span></div>
        <div class="kv" title="Retirees leave the workforce; an aging society has fewer hands"><span>Elderly</span><span>${pct(c.elderly || 0.06)}</span></div>
        <div class="kv" title="Pensions are paid first from the welfare budget; the rest is relief for the poor. As the society ages, the same welfare spending buys less relief."><span>Pensions</span><span>${pct((c.econ.pensionShare || 0.18))} of welfare</span></div>
        <div class="kv" title="Education spending above the basics builds universities. Graduates speed research, staff the state and give the intelligentsia clout."><span>University-educated</span><span>${pct(c.uni || 0, 1)}</span></div>
        <div class="kv" title="0 = everyone earns the same, 1 = one person has everything. High inequality strengthens the labor movement."><span>Inequality (Gini)</span><span class="${(c.gini || 0) > 0.5 ? 'bad' : ''}">${(c.gini || 0).toFixed(2)}</span></div>
        <div class="kv"><span>Births</span><span>${yr(births)} per 1,000 a year</span></div>
        <div class="kv"><span>Deaths</span><span>${yr(deaths)} per 1,000 a year</span></div>
      </div>
      <h4>Largest cities</h4>${cities.map(x => `<div class="kv"><span>${esc(x.name)}${x.id === c.capital ? ' ★' : ''}</span><span>${fmtPop(x.size)}${(() => { const p = g.world.provinces[x.id]; return p && p.occupancy > 1.02 ? ` <span class="bad small">· ${pct(p.slum)} in slums</span>` : ''; })()}</span></div>`).join('')}</div>`;
    return h;
  },

  // ------------------------------------------------------------------ credit

  creditHtml(c, g) {
    const E = ensureCredit(c), law = c.laws.banking || 'regulated';
    const phase = cyclePhase(c), lev = E.credit / Math.max(1, (E.gdpRealM || E.gdpM) * 12);
    const capR = E.bankCap / Math.max(1, E.credit);
    let h = `<div class="card"><h3>${icon('ledger', 16)} Credit and the business cycle</h3>
      <p class="small muted" style="margin-top:0"><b>${esc(LAW_CATS.banking.opts[law].name)}</b>: ${BANKING_INFO[law]} Businesses borrow to build when confidence is high and money is cheap; new capacity arrives later, often after demand has peaked, and debts that outrun profits end in bankruptcies.</p>`;
    if (E.bankCrisis > 0) h += `<div class="alert bad"><b>Banking crisis:</b> lending is frozen for about ${Math.ceil(E.bankCrisis)} more months. <button class="danger" data-act="bailout" ${c.pc < BAILOUT_PC ? 'disabled' : ''} style="margin-left:6px">Bail out the banks (${BAILOUT_PC} PC, ${fmtMoney(Math.max(0, E.credit * CREDIT.CAP_TARGET - E.bankCap) / 1e6 * (E.pl || 1))})</button></div>`;
    h += `<div class="grid2">
        <div class="kv"><span>Cycle</span><span class="${['recession', 'crisis', 'slowdown'].includes(phase) ? 'bad' : ['boom', 'peak'].includes(phase) ? 'warn' : 'good'}">${CYCLE_NAMES[phase]}</span></div>
        <div class="kv"><span>Output vs trend</span><span>${fmtSigned(E.gap * 100)}%</span></div>
        <div class="kv" data-tip="confidence"><span>Business confidence</span><span class="${E.conf < 0.8 ? 'bad' : E.conf > 1.2 ? 'warn' : ''}">${Math.round(E.conf * 100)}</span></div>
        <div class="kv"><span>Private debt</span><span>${pct(lev)} of GDP</span></div>
        <div class="kv" title="Debt service as a share of owners' profits. Above 40%, firms start to default."><span>Debt burden</span><span class="${E.dsr > 0.4 ? 'bad' : E.dsr > 0.3 ? 'warn' : ''}">${pct(E.dsr)} of profits</span></div>
        <div class="kv" title="Bank capital as a share of loans. Below 4%, a banking crisis breaks out."><span>Bank capital</span><span class="${capR < 0.05 ? 'bad' : ''}">${pct(capR, 1)}</span></div>
        <div class="kv"><span>New lending</span><span>${pct(E.lending / Math.max(1, E.gdpRealM || E.gdpM), 1)} of output</span></div>
        <div class="kv"><span>Defaults</span><span class="${E.defaults > 0.003 ? 'bad' : ''}">${pct(E.defaults * 12, 1)} a year</span></div>
      </div>`;
    // 4c: sticky wages and unemployment insurance.
    let nb = 0, sq = 0;
    for (const p of c._provs || []) for (const b of p.buildings) { nb++; if ((b.sq || 0) > 0.9) sq++; }
    const rr = E.uiRate || 0, uiS = E.uiShare || 0, uiA = E.uiAvg || 0;
    h += `<h4 style="margin:10px 0 4px">Wages and the jobless</h4>
      <p class="small muted" style="margin-top:0">Wages are slow to fall, and slowest where unions bargain. When demand drops, pay eats the margin and owners lay workers off instead${c.laws.economy === 'planned' || !ownersAllowed(c) ? ' (a planned economy keeps its plants running instead)' : ''}. Unemployment insurance pays the jobless a share of their class's income. It is funded by contributions set at its long-run cost, so it runs a deficit in slumps and a surplus in booms.</p>
      <div class="grid2">
        <div class="kv" title="Businesses where wages take over 90% of value added. Above 100%, owners lay workers off."><span>Businesses with squeezed margins</span><span class="${nb && sq / nb > 0.1 ? 'bad' : ''}">${nb ? pct(sq / nb) : '—'}</span></div>
        <div class="kv" title="Set by the labor law and the welfare budget."><span>Benefit, share of lost income</span><span>${pct(rr)}</span></div>
        <div class="kv"><span>Benefits paid</span><span>${pct(uiS, 2)} of output</span></div>
        <div class="kv"><span>Fund balance</span><span class="${uiA - uiS < -0.002 ? 'warn' : 'good'}">${fmtSigned((uiA - uiS) * 100)}% of output</span></div>
      </div></div>`;
    return h;
  },

  // ------------------------------------------------------------------ money

  // Closed-loop economy, phase 2: reserves, foreign debts and the exchange rate (payments.js).
  paymentsHtml(c, g) {
    const E = c.econ;
    if (E.reserves == null) return '';
    const months = Math.max(0, E.reserves) / Math.max(1e-6, E.avgBill || 0);
    const P = foreignPositions(g, c);
    const list = arr => arr.slice(0, 3).map(([n, v]) => `${esc(n)} ${fmtMoney(v)}`).join(', ');
    return `<div class="card"><h3>Balance of payments</h3>
      <p class="small muted">Every import is paid for in foreign currency, earned by exports or borrowed from abroad. Owners' capital that finds no use at home is lent to nations short of reserves, and earns interest. A nation that can neither pay nor borrow must cut its imports. ${onGold(c) ? 'On the gold standard the currency is held at its parity: deficits are paid in gold, so money shrinks and prices fall, and if the reserves run out speculators attack the parity.' : 'The currency floats: it falls as reserves drain.'}</p>
      <div class="grid2 small">
        <div class="kv"><span>Foreign reserves</span><span class="${E.reserves < 0 ? 'bad' : E.reserves < reserveTarget(c) ? 'warn' : ''}">${fmtMoney(E.reserves)} (${pct(E.reserves / Math.max(0.01, c.gdp))} of GDP, ${months.toFixed(0)} months of imports)</span></div>
        <div class="kv"><span>Trade balance</span><span class="${E.tradeBalance < 0 ? 'bad' : 'good'}">${fmtMoney(E.tradeBalance)}/mo</span></div>
        <div class="kv"><span>Owed abroad</span><span>${fmtMoney(extDebtOf(c))} (${pct(extDebtOf(c) / Math.max(0.01, c.gdp))} of GDP)</span></div>
        ${c.debt && c.debt.foreign && Object.keys(c.debt.foreign).length ? `<div class="kv" title="State bonds bought by lenders abroad. They paid for them in foreign currency, and their interest and repayments are paid out of our reserves."><span>State bonds held abroad</span><span>${fmtMoney(Object.values(c.debt.foreign).reduce((a, v) => a + v, 0))}</span></div>` : ''}
        <div class="kv"><span>Lent abroad</span><span>${fmtMoney(extAssetsOf(g, c))}</span></div>
        <div class="kv" title="${extRateParts(g, c).filter(p => p[1] > 0).map(([n, v]) => `${n}: ${(v * 100).toFixed(1)}%`).join(' · ')}. Borrowing falls as the rate rises."><span>Interest paid abroad</span><span>${fmtMoney(E.interestOut || 0)}/mo at ${(extRate(c, g) * 100).toFixed(1)}%</span></div>
        <div class="kv" title="Banks lend part of the reserves we have to spare abroad, as far as their capital allows. If a borrower defaults, our banks lose capital."><span>Our banks' loans abroad</span><span>${fmtMoney(E.bankAbroad || 0)}</span></div>
        <div class="kv"><span>Borrowed this month</span><span>${fmtMoney(E.borrowed || 0)}</span></div>
        ${c.extDefaulted != null && g.month - c.extDefaulted < PAY.DEFAULT_MEMORY ? `<div class="kv" title="Lenders abroad remember a default for five years."><span>Credit abroad</span><span class="bad">None for ${Math.ceil((PAY.DEFAULT_MEMORY - (g.month - c.extDefaulted)) / 12)} more year(s): we defaulted</span></div>` : ''}
        <div class="kv" title="${onGold(c) ? 'On the gold standard the currency is held at its parity. Deficits are paid in gold, so the money supply shrinks and prices fall instead of the currency.' : 'A floating currency: it falls as reserves run short: imports cost more at home and exporters earn more at home.'}"><span>Exchange rate</span><span class="${(E.fx || 1) < 0.9 ? 'warn' : ''}">${(E.fx || 1).toFixed(2)}× real, ${onGold(c) ? `gold parity ${(E.parity || 1).toFixed(2)}` : 'floating'}</span></div>
        ${onGold(c) ? `<div class="kv" title="Speculators attack the parity when reserves fall below ${pct(-PAY.ATTACK_AT)} of GDP."><span>Gold flow</span><span class="${(E.goldFlow || 0) < 0 ? 'warn' : ''}">${fmtSigned((E.goldFlow || 0) * 1200)}% of money a year</span></div>` : ''}
      </div>
      ${P.owe.length ? `<div class="small">We owe: ${list(P.owe)}</div>` : ''}${P.owed.length ? `<div class="small">Owe us: ${list(P.owed)}</div>` : ''}
      ${E.attack ? `<div class="alert bad small"><b>Run on the currency</b> for ${g.month - E.attack.since} month(s): owners are sending ${fmtMoney(E.attack.flight)} a month abroad and interest rates carry a ${pct(PAY.DEFEND_PREMIUM)} premium to defend the parity. The attack ends when reserves are back above ${pct(PAY.ATTACK_OVER)} of GDP, or once they have risen four months running. <button class="danger" data-act="leavegold" style="margin-left:6px">Leave the gold standard</button></div>` : onGold(c) && E.reserves / Math.max(0.01, c.gdp) < PAY.ATTACK_AT / 2 ? `<div class="alert warn small">Reserves are running low: speculators will attack the parity if they fall below ${pct(-PAY.ATTACK_AT)} of GDP.</div>` : ''}
      ${E.fxCrisis > 0 ? `<div class="alert bad small"><b>Currency crisis:</b> foreign lenders have pulled out for ${Math.ceil(E.fxCrisis)} more month(s), and owners are moving capital abroad.</div>` : ''}
      ${E.importSqueeze > 0.02 ? `<div class="alert bad small">Out of foreign currency: imports are cut by ${pct(E.importSqueeze)}.</div>` : ''}</div>`;
  },

  // Closed-loop economy, phase 1: who funds the state, and who holds its debt (fiscal.js).
  debtHtml(c, g) {
    const D = ensureDebt(c), tr = debtTrust(g, c);
    const owed = Math.max(0, -c.treasury), gN = c.gdpNom || c.gdp, YN = gN / 12;
    const rows = debtHolders(g, c);
    const L = D.last || {};
    const COL = { 'Domestic savers': '#d9b45a', Banks: '#8fb0dc', 'Unpaid wages and suppliers': '#e2705f' };
    let h = `<div class="card"><h3>${icon('coin', 16)} State debt</h3>
      <p class="small muted" style="margin-top:0">The state pays from cash. A deficit has to be lent by someone: domestic savers (money that would otherwise build factories), banks (which create deposits, so it adds to inflation), or foreign lenders, unless the law lets us print money. Interest goes to whoever holds the debt. If lenders won't cover the deficit, bills go unpaid and spending is cut to what we can fund.</p>`;
    if (D.crisis > 0) h += `<div class="alert bad"><b>Sovereign debt crisis:</b> lenders won't cover our deficit. We are paying ${pct(D.payFrac)} of planned spending and owe ${fmtMoney(D.arrears)} in unpaid bills. Cut spending, raise taxes, print money if the law allows it, or default. <button class="danger" data-act="default" ${c.pc < DEFAULT_PC ? 'disabled' : ''} style="margin-left:6px">Default on the debt (${DEFAULT_PC} PC)</button></div>`;
    h += `<div class="grid2">
        <div class="kv"><span>Debt</span><span class="${owed / gN > 0.9 ? 'bad' : owed / gN > 0.6 ? 'warn' : ''}">${fmtMoney(owed)} (${pct(owed / gN)} of GDP)</span></div>
        <div class="kv"><span>Yield lenders demand</span><span class="${D.yield > 0.1 ? 'bad' : ''}">${(D.yield * 100).toFixed(1)}%</span></div>
        <div class="kv" title="${tr.parts.map(p => `${p[0]}: ${p[1] >= 0 ? '+' : ''}${p[1].toFixed(2)}`).join(' · ')}"><span>Lenders' trust</span><span class="${tr.value < 0.6 ? 'bad' : tr.value < 0.9 ? 'warn' : 'good'}">${Math.round(tr.value * 100)}</span></div>
        <div class="kv"><span>Interest a year</span><span>${pct(debtInterest(c) * 12 / gN, 1)} of GDP</span></div>
      </div>`;
    if (owed > 0) {
      h += `<h4 style="margin:10px 0 4px">Who holds it</h4><div class="bar-stack" style="display:flex;height:10px;border-radius:3px;overflow:hidden;margin-bottom:4px">`;
      for (const r of rows) h += `<div title="${esc(r[0])}: ${fmtMoney(r[1])}" style="width:${(r[1] / owed * 100).toFixed(2)}%;background:${COL[r[0]] || (r[2] != null && g.countries[r[2]] ? g.countries[r[2]].color : '#9a8f7a')}"></div>`;
      h += `</div><div class="grid2">${rows.slice(0, 6).map(r => `<div class="kv"><span>${esc(r[0])}</span><span>${pct(r[1] / owed)}</span></div>`).join('')}</div>`;
    }
    const src = [['Savers lent', L.savers], ['Banks lent', L.banks], ['Foreign lenders lent', L.foreign], ['Printed', L.printed], ['Left unpaid', L.shortfall], ['Repaid to lenders', -(L.repaid || 0)]].filter(x => Math.abs(x[1] || 0) > 1e-7);
    if (src.length) h += `<h4 style="margin:10px 0 4px">Last month's funding</h4><div class="grid2">${src.map(x => `<div class="kv"><span>${x[0]}</span><span class="${x[0] === 'Left unpaid' ? 'bad' : ''}">${fmtMoney(Math.abs(x[1]))} (${pct(Math.abs(x[1]) / YN, 1)} of a month's GDP)</span></div>`).join('')}</div>`;
    return h + `</div>`;
  },

  moneyHtml(c, g) {
    const E = ensureMoney(c), law = c.laws.monetary, inf = inflationYoY(c);
    let h = `<div class="card"><h3>${icon('coin', 16)} Money and prices</h3><p class="small muted" style="margin-top:0"><b>${esc(LAW_CATS.monetary.opts[law].name)}</b>: ${MONETARY_INFO[law]} (Change it in the Constitution, Politics tab.)</p>
      <div class="grid2">
        <div class="kv" data-tip="inflation"><span>Inflation</span><span class="${inf > 0.08 ? 'bad' : inf < -0.01 ? 'warn' : ''}">${fmtSigned(inf * 100)}%/yr</span></div>
        <div class="kv" data-tip="inflation"><span>Expected</span><span>${fmtSigned(moneyAnnual(E, E.piE) * 100)}%/yr</span></div>
        <div class="kv"><span>Price level</span><span>${(E.pl * 100).toFixed(0)} <small class="muted">(1950 = 100)</small></span></div>
        <div class="kv"><span>Interest rate</span><span>${(E.rate * 100).toFixed(1)}%</span></div>
        <div class="kv"><span>Money growth</span><span>${fmtSigned(moneyAnnual(E, E.moneyGrowth) * 100)}%/yr</span></div>
        <div class="kv" title="Nominal wages relative to prices: below 100, pay is lagging behind prices"><span>Real wages</span><span class="${E.realWage < 0.98 ? 'bad' : E.realWage > 1.02 ? 'good' : ''}">${Math.round(E.realWage * 100)}</span></div>
      </div>`;
    if (law === 'state') {
      const mg = c.policy.moneyGrowth == null ? 4 : c.policy.moneyGrowth;
      h += `<div class="slider-row"><label><span>Money growth</span><span id="pv-moneyGrowth">${mg.toFixed(0)}%/yr</span></label><input type="range" data-policy="moneyGrowth" min="0" max="40" step="1" value="${mg}"><small>Faster than the economy grows means inflation. Inflation erodes the national debt, savings and wages.</small></div>
        <label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-act="monetize" ${c.policy.monetize ? 'checked' : ''}> Print money to cover the budget deficit${E.printed > 0 ? ` <span class="warn">(printing ${fmtMoney(E.printed)} a month)</span>` : ''}</label>`;
    }
    return h + '</div>';
  },

  // ------------------------------------------------------------------ press

  pressHtml(c, g) {
    const k = pressStrength(c);
    let h = `<div class="card"><h3>${icon('news', 16)} The Press</h3>`;
    if (!k) return h + '<p class="small muted" style="margin:0">All newspapers belong to the state. There are no press barons, and no criticism.</p></div>';
    h += `<p class="small muted" style="margin-top:0">Press barons pull public opinion toward their views, give their favorite party coverage, and sway approval and referendums. ${k < 1 ? 'Under a licensed press their influence is halved, and papers can be censored.' : ''} Press effect on approval: <b class="${pressApproval(c) >= 0 ? 'good' : 'bad'}">${fmtSigned(pressApproval(c))}</b>.</p>`;
    if (!(c.barons || []).length) return h + '<p class="small muted">No major papers yet. They appear as literacy grows.</p></div>';
    c.barons.forEach((b, i) => {
      const att = b.attitude > 0.25 ? ['friendly', 'good'] : b.attitude < -0.25 ? ['hostile', 'bad'] : ['neutral', 'muted'];
      h += `<div class="person"><div>${portraitSVG(b.ch, { size: 46, gov: c.gov })}</div><div class="pinfo"><div><b>${esc(b.paper)}</b></div><div class="small">${esc(b.ch.name)}, ${b.ch.age} · <span class="${att[1]}">${att[0]}</span> · ${ideologyText(b.slant)}</div>${bar('Readership', b.reach * 100, { color: '#8fb0dc', text: pct(b.reach) })}</div>
        <div class="pact">${Object.entries(PRESS_ACTIONS).map(([a, A]) => `<button data-act="press" data-i="${i}" data-a="${a}" title="${esc(A.desc)}" ${(A.pc && c.pc < A.pc) || (a === 'censor' && c.laws.press !== 'licensed') ? 'disabled' : ''}>${A.name}${A.pc ? ` (${A.pc})` : ''}</button>`).join('')}</div></div>`;
    });
    return h + '</div>';
  },

  // ------------------------------------------------------------------ laws

  lawsHtml(c, g) {
    ensureLaws(c);
    const gv = GOVS[c.gov], P = LAW_PRESETS[c.gov], R = c.reform;
    const label = constitutionLabel(c);
    let h = `<div class="card"><h3>${icon('politics', 16)} The Constitution</h3><p class="small" style="margin-top:0">${label !== gv.name ? `Our laws make us a <b>${esc(label)}</b>. ` : ''}${gv.elections === 'free' ? 'Bills need a majority in parliament.' : 'Reforms need the backing of the regime\'s power base.'} A bill costs ${LAW_PC} PC and takes months; opponents grow restless while it is debated. Laws that break with the regime's tradition (◇) carry their full effects.</p>`;
    if (R) {
      const O = LAW_CATS[R.cat].opts[R.opt], sup = R.support != null ? R.support : lawSupport(g, c, R.cat, R.opt);
      h += `<div class="alert info"><b>Bill under debate:</b> ${esc(LAW_CATS[R.cat].name)}: ${esc(O.name)}${bar('Progress', R.progress)}
        <div class="small">Support: <b class="${sup >= 0.5 ? 'good' : 'bad'}">${pct(sup)}</b> ${sup >= 0.5 ? '(passing)' : '(stalled: it may be voted down)'} · ${R.months} months</div>
        <div style="display:flex;gap:6px;margin-top:6px"><button data-act="lawact" data-a="abandon">Withdraw</button>${gv.elections === 'free' ? '' : `<button class="danger" data-act="lawact" data-a="decree" ${c.pc < LAW_ACTIONS.decree.pc ? 'disabled' : ''}>Decree it (${LAW_ACTIONS.decree.pc} PC, −8 legitimacy)</button>`}</div></div>`;
    }
    const pick = this.lawPick || {}, clout = interestClout(c);
    for (const cat of LAW_KEYS) {
      const C = LAW_CATS[cat], cur = c.laws[cat];
      h += `<div class="kv"><span>${C.name}</span><span><b title="${esc(C.opts[cur].desc)}">${esc(C.opts[cur].name)}</b>${cur !== P[cat] ? ' ◇' : ''} <a href="#" data-act="lawpick" data-cat="${cat}" data-opt="">${pick.cat === cat ? '▴' : 'change'}</a></span></div>`;
      if (pick.cat === cat) {
        for (const opt in C.opts) {
          if (opt === cur) continue;
          const O = C.opts[opt], sup = lawSupport(g, c, cat, opt);
          const fx = Object.fromEntries(Object.entries(O.fx).map(([k, v]) => [k, v - (C.opts[cur].fx[k] || 0)]).concat(Object.entries(C.opts[cur].fx).filter(([k]) => !(k in O.fx)).map(([k, v]) => [k, -v])).filter(([k, v]) => v && !['growth', 'pc', 'army'].includes(k) && !FACTION_KEYS.includes(k)));
          h += `<div class="opt" style="margin:6px 0;cursor:default;border:1px solid var(--line);border-radius:5px;${pick.opt === opt ? 'border-color:var(--gold)' : ''}"><div class="lbl">${esc(O.name)}${opt === P[cat] ? ' <span class="ftag">tradition</span>' : ''}</div><div class="small muted">${esc(O.desc)}</div><div>${describeEffects(fx)}</div>${this.winnersHtml(c, g, cat, opt, clout)}
            <div class="small" style="display:flex;justify-content:space-between;align-items:center;margin-top:4px"><span>Support: <b class="${sup >= 0.5 ? 'good' : 'bad'}">${pct(sup)}</b></span>
            <span><button class="primary" data-act="propose" data-cat="${cat}" data-opt="${opt}" ${R || c.pc < LAW_PC ? 'disabled' : ''}>Propose (${LAW_PC} PC)</button>
            ${canReferendum(c) ? `<button data-act="referendum" data-cat="${cat}" data-opt="${opt}" ${c.pc < REFERENDUM_PC ? 'disabled' : ''} title="Put it to the people: decided at once by the public's views, class by class. Win: +5 legitimacy. Lose: −6 legitimacy, −3 approval.">Referendum (${REFERENDUM_PC} PC) · public ${pct(publicSupport(g, c, cat, opt))}</button>` : ''}</span></div></div>`;
        }
      }
    }
    return h + '</div>';
  },

  // Who gains and who loses from a reform (winners.js), before it is proposed.
  winnersHtml(c, g, cat, opt, clout) {
    const W = lawWinners(g, c, cat, opt, clout);
    if (!W.groups.length) return '';
    const r = Math.round, sgn = v => (v >= 0 ? '+' : '') + v.toFixed(1);
    const row = x => {
      const up = (x.delta || x.later - x.now) > 0;
      const later = Math.abs(x.later - x.after) >= 0.5 ? ` · in time → ${r(x.later)}` : '';
      return `<div class="kv small" title="${esc(x.name)}: clout ${pct(x.clout)} of the interest groups' weight. Loyalty ${r(x.now)} now; ${r(x.after)} the day the law passes (its reaction to the change); its target then moves ${sgn(x.shift)}, so loyalty drifts toward about ${r(x.later)} over the following months. Below ${WINNERS.HOSTILE} the group counts as disloyal."><span>${x.icon} ${esc(x.name)} <span class="muted">(clout ${pct(x.clout)})</span></span><span class="${up ? 'good' : 'bad'}">${up ? '▲' : '▼'} ${r(x.now)} → ${r(x.after)}${later}${x.turns === 'against' ? ' · turns disloyal' : x.turns === 'back' ? ' · won back' : ''}</span></div>`;
    };
    const up = x => (x.delta || x.later - x.now) > 0;
    const gain = W.groups.filter(up), lose = W.groups.filter(x => !up(x));
    return `<div class="winners" style="margin-top:6px;padding-top:4px;border-top:1px dashed var(--line-soft)"><div class="small"><b>Who gains, who loses</b> <span class="muted" title="The change in the support meter the day the law passes, through the power base and the interest groups weighted by clout.">· support at once ${sgn(W.support)}</span></div>${gain.map(row).join('')}${lose.map(row).join('')}</div>`;
  },

  // ------------------------------------------------------------------ ledger

  viewLedger(c, g) {
    const L = Object.assign({ view: 'nation', range: '20y', metric: 'gdp' }, this.ledger || {});
    const seg = (k, opts) => `<div class="ledger-tabs">${opts.map(([v, label]) => `<button class="${L[k] === v ? 'active' : ''}" data-act="ledger" data-k="${k}" data-v="${v}">${label}</button>`).join('')}</div>`;
    const monthly = (arr) => {
      if (!arr) return [];
      const pts = arr.map((v, i) => [g.month - (arr.length - 1 - i), v]);
      return L.range === '5y' ? pts.slice(-60) : pts;
    };
    // Long-run (yearly) series where they exist; monthly otherwise.
    const series = (x, key) => {
      if (L.range === 'all' && x.histY && x.histY[key] && x.histY[key].length >= 2) return x.histY[key].map((v, i) => [x.histY.month[i], v]);
      return monthly(x.hist[key]);
    };
    let h = `<div class="card"><h3>${icon('ledger', 16)} The Ledger</h3>${seg('view', [['nation', 'Our nation'], ['compare', 'Compare nations'], ['prices', 'World prices']])}${seg('range', [['5y', '5 years'], ['20y', '20 years'], ['all', 'All time']])}</div>`;
    if (L.view === 'nation') {
      const chart = (title, s, opts) => `<div class="card"><h4 style="margin-top:0">${title}</h4>${lineChart(s, opts)}</div>`;
      h += chart('Gross domestic product', [{ pts: series(c, 'gdp'), color: '#d8b66a', label: 'Real GDP' }, { pts: monthly(c.hist.gdp).map((p, i, a) => { const pl = c.hist.pl, k = pl ? pl.length - a.length + i : -1; return [p[0], k >= 0 && pl[k] ? p[1] * pl[k] : null]; }), color: '#8fb0dc', label: 'GDP in currency', dash: true }], { fmt: v => fmtMoney(v), zero: true });
      h += chart('Politics', [
        { pts: series(c, 'approval'), color: '#7fc98f', label: 'Approval' }, { pts: series(c, 'stability'), color: '#e3a64e', label: 'Stability' },
        { pts: monthly(c.hist.unrest), color: '#e2705f', label: 'Unrest' },
      ], { min: 0, max: 100, fmt: v => v.toFixed(0) });
      h += chart('Prices and money', [{ pts: monthly(c.hist.infl), color: '#e2705f', label: 'Inflation %/yr' }, { pts: monthly(c.hist.rate), color: '#8fb0dc', label: 'Interest rate %' }], { fmt: v => v.toFixed(1) + '%', zero: true });
      h += chart('Credit and confidence', [{ pts: monthly(c.hist.credit), color: '#e3a64e', label: 'Private debt, % of GDP' }, { pts: monthly(c.hist.conf), color: '#8fb0dc', label: 'Business confidence' }], { fmt: v => v.toFixed(0), zero: true });
      h += chart('Income inequality (Gini × 100)', [{ pts: monthly(c.hist.gini), color: '#e3a64e', label: 'Gini' }], { fmt: v => v.toFixed(0) });
      h += chart('Real wages (100 = keeping up with prices)', [{ pts: monthly(c.hist.rwage), color: '#7fc98f', label: 'Real wages' }], { fmt: v => v.toFixed(0) });
      h += chart('Living standard', [{ pts: series(c, 'sol'), color: '#8fb0dc', label: 'Average standard of living' }], { fmt: v => v.toFixed(0) });
      h += chart('Population (millions)', [{ pts: series(c, 'pop'), color: '#c9a0dc', label: 'Population' }], { fmt: v => v.toFixed(1) + 'M' });
      h += chart('Treasury', [{ pts: monthly(c.hist.treasury), color: '#d8b66a', label: 'Treasury' }], { fmt: v => fmtMoney(v), zero: true });
      h += chart('State budget (per month)', [{ pts: monthly(c.hist.revenue), color: '#7fc98f', label: 'Revenue' }, { pts: monthly(c.hist.spend), color: '#e2705f', label: 'Spending and interest' }], { fmt: v => fmtMoney(v), zero: true });
      h += chart('Unemployment', [{ pts: monthly(c.hist.unemp), color: '#e2705f', label: 'Unemployment' }], { fmt: v => v.toFixed(1) + '%', zero: true });
      h += chart('Army (thousands)', [{ pts: monthly(c.hist.army), color: '#a3a3a3', label: 'Soldiers' }], { fmt: v => v.toFixed(0) + 'k', zero: true });
      h += '<p class="small muted">Some series begin when you take office. Monthly records cover the last 20 years; "All time" uses yearly records where they exist.</p>';
    } else if (L.view === 'compare') {
      const M = { gdp: ['GDP', x => x.gdp, v => fmtMoney(v)], gdppc: ['GDP per person', x => x.gdp / Math.max(1, x.pop) * 1e9, v => '$' + Math.round(v)], pop: ['Population', x => x.pop / 1e6, v => v.toFixed(1) + 'M'],
        sol: ['Living standard', x => x.econ.avgSol, v => v.toFixed(0)], stability: ['Stability', x => x.stability, v => v.toFixed(0)], approval: ['Approval', x => x.approval, v => v.toFixed(0)] };
      const [mname, cur, fmt] = M[L.metric] || M.gdp;
      h += `<div class="card">${seg('metric', Object.entries(M).map(([k, v]) => [k, v[0]]))}`;
      const top = g.countries.filter(x => x.alive).sort((a, b) => cur(b) - cur(a)).slice(0, 7);
      if (!top.includes(c)) top.push(c);
      const mk = x => {
        if (L.metric === 'gdppc') {
          const gd = series(x, 'gdp'), pp = series(x, 'pop');
          return gd.map((p, i) => [p[0], pp[i] && pp[i][1] ? p[1] / pp[i][1] * 1000 : null]);
        }
        return series(x, L.metric);
      };
      h += lineChart(top.map(x => ({ pts: mk(x), color: x.color, label: x.name, width: x === c ? 3 : 1.6 })), { fmt, zero: ['gdp', 'pop'].includes(L.metric) });
      h += `<table class="list" style="margin-top:10px"><tr><th>Nation</th><th>${mname}</th><th>Rank</th></tr>${top.map((x, i) => `<tr class="click ${x === c ? 'me' : ''}" data-act="select" data-id="${x.id}"><td>${swatch(x)} ${esc(x.name)}</td><td>${fmt(cur(x))}</td><td>${g.countries.filter(y => y.alive && cur(y) > cur(x)).length + 1}</td></tr>`).join('')}</table></div>`;
    } else {
      const P = g.priceHist || {};
      h += '<div class="card"><p class="small muted" style="margin-top:0">World market prices. The dashed line is each good\'s base price.</p><div class="grid2">';
      for (const k in GOODS) {
        const arr = P[k] || [];
        const pts = monthly(arr);
        const now = g.worldMarket && g.worldMarket.prices[k] || GOODS[k].base;
        const rel = now / GOODS[k].base - 1;
        h += `<div><div class="kv" style="border:0"><span>${GOODS[k].name}</span><span class="${rel > 0.15 ? 'bad' : rel < -0.15 ? 'good' : ''}">${now.toFixed(1)} <small>${fmtSigned(rel * 100, 0)}%</small></span></div>${lineChart([{ pts, color: rel > 0.15 ? '#e2705f' : rel < -0.15 ? '#7fc98f' : '#d8b66a', label: GOODS[k].name }, { pts: pts.length ? [[pts[0][0], GOODS[k].base], [pts[pts.length - 1][0], GOODS[k].base]] : [], color: '#ffffff55', label: 'Base', dash: true, width: 1 }], { h: 120, mini: true, fmt: v => v.toFixed(0) }).replace(/<div class="chart-legend">.*<\/div>$/, '')}</div>`;
      }
      h += '</div><p class="small muted">Prices rise when goods are scarce and fall when they are plentiful: between a quarter and four times the base price.</p></div>';
    }
    return h;
  },

  nationHeader(c) {
    const g = App.game;
    const party = GOVS[c.gov].party === 'multi' ? `<div class="small muted">Governing party: ${esc(rulingPartyObj(c).name)}</div>` : '';
    return `<div class="nation-head"><div class="nh-portrait">${portraitSVG(c.leader, { size: 52, gov: c.gov })}<span class="nh-flag">${flagSVG(c, 24, 16)}</span></div><div><div class="formal">${esc(formalName(c))}</div>${constitutionLabel(c) !== GOVS[c.gov].name ? `<div class="small" style="color:var(--gold)">${esc(constitutionLabel(c))}</div>` : ''}
      <div style="margin:4px 0">${govBadge(c.gov)} <span class="small muted">since ${gameDate(g, Math.max(0, g.month - c.monthsInRegime))}</span></div>
      <div class="small">${esc(leaderLine(c))}, ${c.leader.age}</div><div>${this.traitChips(c.leader)}</div>${party}</div></div>`;
  },

  viewOverview(c, g) {
    const gv = GOVS[c.gov];
    let h = '';
    const risk = crisisRisk(c);
    if (risk > 0) h += `<div class="alert bad"><b>Crisis!</b> ${pct(risk, 1)} chance each month of a coup or revolution. Raise stability above ${CRISIS_LEVEL} and calm the unrest.</div>`;
    const wars = warsOf(g, c.id);
    if (wars.length) h += `<div class="alert warn">⚔ At war: ${wars.map(w => esc(w.name)).join(', ')}. <a href="#" data-act="tab" data-tab="military" class="warn">Military →</a></div>`;
    if (c.emergency) h += '<div class="alert warn">A state of emergency is in force. Elections are suspended.</div>';
    if (this.selProv != null && g.world.provinces[this.selProv] && g.world.provinces[this.selProv].owner === c.id) h += this.provinceCard(g.world.provinces[this.selProv], true);
    h += `<div class="card">${this.nationHeader(c)}</div>`;
    h += `<div class="card">
      ${bar('Stability', c.stability, { why: 'stability' })}
      ${bar('Support', c.support != null ? c.support : c.approval, { why: 'support', color: '#c9a45a' })}
      ${bar('Approval', c.approval, { why: 'approval' })}
      ${bar('Unrest', c.unrest, { invert: true, why: 'unrest' })}
      ${bar('Freedom', c.freedom, { color: '#5b8cff', tip: 'Civil liberties. Intelligentsia value it highly.' })}
      ${bar('Corruption', c.corruption, { invert: true, tip: 'Drains revenue and growth.' })}
      ${bar('Legitimacy', c.legitimacy, { tip: 'The accepted right to rule. Won through elections, tradition or faith.' })}
    </div>`;
    const debt = -c.treasury / (c.gdpNom || c.gdp);
    h += `<div class="card grid2">
      <div class="kv"><span>Population</span><span>${fmtPop(c.pop)}</span></div>
      <div class="kv"><span>Provinces</span><span>${c.provinceCount}</span></div>
      <div class="kv"><span>GDP (real)</span><span>${fmtMoney(c.gdp)}</span></div>
      <div class="kv"><span>GDP (in currency)</span><span>${fmtMoney(c.gdpNom || c.gdp)}</span></div>
      <div class="kv"><span>Per capita</span><span>$${(c.gdpPerCap * 1000).toFixed(0)}</span></div>
      <div class="kv"><span>Growth</span><span class="${c.growthAvg < 0 ? 'bad' : 'good'}">${fmtSigned(c.growthAvg * 1200)}%/yr</span></div>
      <div class="kv" data-tip="treasury"><span>Treasury</span><span class="${c.treasury < 0 ? 'bad' : ''}">${fmtMoney(c.treasury)}${debt > 0 ? ` (${pct(debt)} debt)` : ''}</span></div>
      <div class="kv"><span>Army</span><span>${fmtPop(c.army)}</span></div>
      <div class="kv"><span>Strength</span><span>${strength(c).toFixed(0)}</span></div>
      <div class="kv" data-tip="pc"><span>Political capital</span><span>${Math.floor(c.pc)} (+${pcIncome(c).toFixed(1)}/mo)</span></div>
      ${c.overlord != null ? `<div class="kv"><span>Overlord</span><span class="warn">${esc(g.countries[c.overlord].name)} (${SUBJECT_TYPES[c.subjectType].name})</span></div>` : subjectsOf(g, c.id).length ? `<div class="kv"><span>Subjects</span><span>${subjectsOf(g, c.id).length}</span></div>` : ''}
      <div class="kv" data-tip="infamy"><span>Infamy</span><span class="${(c.infamy || 0) >= INFAMY.coalitionAt ? 'bad' : (c.infamy || 0) > 15 ? 'warn' : ''}">${Math.round(c.infamy || 0)}</span></div>
      <div class="kv" title="Conquered land that has not yet been integrated (20 years): pays less tax, supplies fewer soldiers, and breeds unrest."><span>Non-core land</span><span class="${(c.nonCoreShare || 0) > 0.2 ? 'warn' : ''}">${c.nonCoreCount || 0} prov · ${pct(c.nonCoreShare || 0)} of pop</span></div>
      <div class="kv"><span>Living standard</span><span style="color:${statColor(c.econ.avgSol * 1.4)}">${c.econ.avgSol.toFixed(0)}</span></div>
      <div class="kv"><span>Unemployment</span><span class="${c.econ.unemployment > 0.08 ? 'bad' : ''}">${pct(c.econ.unemployment, 1)}</span></div>
      <div class="kv"><span>In power</span><span>${Math.floor((g.playerMonths || 0) / 12)}y ${(g.playerMonths || 0) % 12}m</span></div>
    </div>`;
    h += `<div class="card sparks">
      <div><div class="lbl">Approval</div>${spark(c.hist.approval, '#5cc98a')}</div>
      <div><div class="lbl">Stability</div>${spark(c.hist.stability, '#e8b84a')}</div>
      <div><div class="lbl">GDP</div>${spark(c.hist.gdp, '#5b8cff')}</div>
    </div>`;
    h += `<div class="card"><h3>Public opinion</h3><p class="small">The public is <b>${ideologyText(c.ideo)}</b>. The further it sits from the regime (■), the more unrest builds.</p>${compassSVG(c)}</div>`;
    if (c.mods.length) {
      h += `<div class="card"><h3>Active effects</h3><div class="mods">${c.mods.filter(m => FX_LABELS[m.key] || m.key === 'growth').map(m => `${esc(m.label)}: ${m.key === 'growth' ? fmtSigned(m.v * 1200) + '% growth' : fmtSigned(m.v, 0) + ' ' + FX_LABELS[m.key]} (${m.months} mo)`).join('<br>') || 'Propaganda campaign running'}</div></div>`;
    }
    return h;
  },

  traitChips(ch) {
    return (ch.traits || []).map(t => `<span class="trait" title="${esc(TRAITS[t].desc)}">${TRAITS[t].name}</span>`).join('');
  },

  skillBars(ch, highlight) {
    return SKILL_KEYS.map(k => `<div class="skill${k === highlight ? ' hl' : ''}"><span>${SKILLS[k]}</span><div class="pips">${'<i class="on"></i>'.repeat(ch.skills[k])}${'<i></i>'.repeat(10 - ch.skills[k])}</div><b>${ch.skills[k]}</b></div>`).join('');
  },

  factionTag(ch) {
    return ch.faction && FACTIONS[ch.faction] ? `<span class="ftag" title="${esc(FACTIONS[ch.faction].desc)}">${FACTIONS[ch.faction].icon} ${FACTIONS[ch.faction].name}</span>` : '';
  },

  viewLeader(c, g) {
    const L = c.leader;
    const T = traitFx(L);
    const fx = [];
    const d = k => L.skills[k] - 5;
    if (d('cha')) fx.push(`${fmtSigned(d('cha') * 0.8)} approval (charisma)`);
    if (d('admin')) fx.push(`${fmtSigned(-d('admin') * 1.5)} corruption (administration)`);
    if (d('diplo')) fx.push(`${fmtSigned(d('diplo') * 1.2)} relations (diplomacy)`);
    if (d('mil')) fx.push(`${fmtSigned(d('mil'))}% army strength (military)`);
    for (const k of ['approval', 'stability', 'corruption', 'pc']) if (T[k]) fx.push(`${fmtSigned(T[k])} ${k === 'pc' ? 'PC/month' : k} (traits)`);
    let h = `<div class="card leader-card"><div class="lc-portrait">${portraitSVG(L, { size: 108, gov: c.gov })}</div><div>
      <div class="small muted">${esc(leaderTitle(c))} of the ${esc(formalName(c))}</div>
      <div class="formal">${esc(L.name)}</div>
      <div class="small">Age ${L.age} · in office since ${gameDate(g, Math.min(L.since, g.month))} ${this.factionTag(L)}</div>
      <div style="margin:6px 0">${this.traitChips(L)}</div>
      ${bar('Health', L.health)}</div></div>
      <div class="card"><h3>Skills</h3>${this.skillBars(L)}
      <p class="small muted" style="margin-top:8px">${fx.join(' · ') || 'An unremarkable administrator.'}</p>
      <p class="small">Personal politics: <b>${ideologyText(L.ideo)}</b>.</p></div>`;
    if (c.heir) h += this.personRow(c, c.heir, `<div class="small muted">Next in line to the throne. If the ${c.leader.female ? 'Queen' : 'King'} dies, ${c.heir.female ? 'she' : 'he'} takes the crown.</div>`);
    if (c.monarch) h += this.personRow(c, c.monarch, `<div class="small muted">The crowned head of state reigns above politics and lends the government legitimacy.</div>`);

    h += `<div class="card"><h3>Cabinet</h3><p class="small muted">Each minister's key skill drives their department. Ministers bring their faction's goodwill (+4 loyalty) while they're loyal; disloyal ones (below 25) work at half effort. Appointing costs ${APPOINT_PC} PC.</p>`;
    for (const post of POST_KEYS) {
      const P = CABINET_POSTS[post], ch = c.cabinet[post];
      const eff = P.text(effectiveSkill(ch, post) - 5);
      if (!ch) {
        h += `<div class="person vacant"><div class="pp empty">?</div><div class="pinfo"><div class="ptitle">${P.name}</div><div class="bad small">Vacant: ${eff}</div><div class="small muted">${P.desc}</div></div>
          <div class="pact"><button class="primary small" data-act="appoint" data-post="${post}">Appoint…</button></div></div>`;
        continue;
      }
      h += `<div class="person"><div class="pp">${portraitSVG(ch, { size: 54, gov: c.gov })}</div><div class="pinfo">
        <div class="ptitle">${P.name}</div><div><b>${esc(ch.name)}</b>, ${ch.age} ${this.factionTag(ch)}</div>
        <div class="small">${SKILLS[P.skill]} <b>${ch.skills[P.skill]}</b> · <span class="${effectiveSkill(ch, post) >= 5 ? 'good' : 'bad'}">${eff}</span></div>
        <div>${this.traitChips(ch)}</div>${bar('Loyalty', ch.loyalty, { tip: 'Below 25, ministers sabotage their department and may plot or leak.' })}</div>
        <div class="pact"><button class="small" data-act="appoint" data-post="${post}">Replace…</button><button class="small" data-act="dismiss" data-post="${post}">Dismiss</button>
        <button class="small" data-act="char" data-a="honor" data-id="${ch.id}" title="${esc(CHAR_ACTIONS.honor.desc)}" ${c.pc < CHAR_ACTIONS.honor.pc ? 'disabled' : ''}>Honor</button></div></div>`;
    }
    h += '</div>';

    h += `<div class="card"><h3>High command</h3><p class="small muted">The best general's skill sets the army's leadership. A disloyal, ambitious general is a coup waiting to happen.</p>`;
    for (const ch of c.generals) {
      const danger = ch.loyalty < 25 ? `<div class="small bad">⚠ Disloyal${ch.ambition > 45 ? ' and ambitious: may attempt a coup' : ''}</div>` : '';
      h += `<div class="person"><div class="pp">${portraitSVG(ch, { size: 54, gov: c.gov })}</div><div class="pinfo">
        <div class="ptitle">General</div><div><b>${esc(ch.name)}</b>, ${ch.age}</div><div class="small">Military <b>${ch.skills.mil}</b> · ambition ${Math.round(ch.ambition)}${ch.won || ch.lost ? ` · battles won ${ch.won || 0}, lost ${ch.lost || 0}` : ''}</div>
        <div>${this.traitChips(ch)}</div>${bar('Loyalty', ch.loyalty)}${(ch.renown || 0) >= 1 ? bar('Renown', ch.renown, { color: 'var(--gold)', tip: 'Won in battle. Famous generals learn to command, but grow ambitious; after a war they may enter politics.' }) : ''}${danger}</div>
        <div class="pact">${['honor', 'retire', 'arrest'].map(a => `<button class="small" data-act="char" data-a="${a}" data-id="${ch.id}" title="${esc(CHAR_ACTIONS[a].desc)} (${CHAR_ACTIONS[a].pc} PC)" ${c.pc < CHAR_ACTIONS[a].pc ? 'disabled' : ''}>${CHAR_ACTIONS[a].name}</button>`).join('')}</div></div>`;
    }
    h += '</div>';

    h += this.figuresHtml(c, g);

    const opp = c.parties.filter(p => p.leader).map(p => p.leader).concat(c.dissidents || []);
    h += `<div class="card"><h3>${GOVS[c.gov].party === 'multi' ? 'Opposition' : 'Dissidents'}</h3>`;
    if (!opp.length) h += '<p class="small muted">No organized opposition.</p>';
    for (const ch of opp) {
      const acts = ch.role === 'dissident' ? ['arrest', 'coopt'] : ['smear', 'coopt'];
      const party = c.parties.find(p => p.id === ch.party);
      h += `<div class="person"><div class="pp">${portraitSVG(ch, { size: 54, gov: c.gov })}</div><div class="pinfo">
        <div class="ptitle">${esc(roleTitle(c, ch))}</div><div>${party ? `<span class="swatch" style="background:${party.color};width:10px;height:10px"></span> ` : ''}<b>${esc(ch.name)}</b>, ${ch.age}</div>
        <div class="small">Charisma <b>${ch.skills.cha}</b> · ${ideologyText(ch.ideo)}</div><div>${this.traitChips(ch)}</div>
        ${ch.role === 'dissident' ? bar('Following', ch.popularity, { invert: true, tip: 'A popular dissident fuels unrest and may lead a revolution.' }) : ''}</div>
        <div class="pact">${acts.map(a => `<button class="small" data-act="char" data-a="${a}" data-id="${ch.id}" title="${esc(CHAR_ACTIONS[a].desc)} (${CHAR_ACTIONS[a].pc} PC)" ${c.pc < CHAR_ACTIONS[a].pc ? 'disabled' : ''}>${CHAR_ACTIONS[a].name}</button>`).join('')}</div></div>`;
    }
    return h + '</div>';
  },

  personRow(c, ch, extra) {
    return `<div class="card person"><div class="pp">${portraitSVG(ch, { size: 54, gov: c.gov })}</div><div class="pinfo">
      <div class="ptitle">${esc(roleTitle(c, ch))}</div><div><b>${esc(ch.name)}</b>, ${ch.age}</div><div>${this.traitChips(ch)}</div>${extra || ''}</div></div>`;
  },

  costText(c, a) {
    const parts = [];
    if (a.pc) parts.push(`${a.pc} PC`);
    if (a.money) parts.push(fmtMoney(a.money * c.gdp));
    return parts.join(' · ') || 'Free';
  },

  actionBtn(c, act, a, reason, extra) {
    return `<button class="action" data-act="${act}" data-id="${a.id}" ${extra || ''} ${reason ? 'disabled' : ''} title="${esc(a.desc)}">
      <span class="name">${esc(a.name)}</span><span class="cost">${this.costText(c, a)}</span>
      <span class="small muted">${esc(a.desc)}</span>${reason ? `<span class="why">${esc(reason)}</span>` : ''}</button>`;
  },

  viewPolitics(c, g) {
    const gv = GOVS[c.gov];
    let h = `<div class="card"><h3>${govBadge(c.gov)} ${gv.name}</h3><p class="small">${gv.desc}</p>
      <div class="grid2 small"><div class="good">${gv.pros.map(x => '+ ' + x).join('<br>')}</div><div class="bad">${gv.cons.map(x => '− ' + x).join('<br>')}</div></div>`;
    if (gv.elections === 'free') {
      if (c.emergency) h += '<p class="warn small">Elections suspended under the state of emergency.</p>';
      else h += `<p class="small">Next election: <b>${gameDate(g, c.nextElection)}</b> (${Math.max(0, c.nextElection - g.month)} months)${c.flags.fraud ? ' · <span class="warn">ballot rigging arranged</span>' : ''}</p>`;
    } else if (gv.elections === 'sham') {
      h += `<p class="small">Single-list "elections" every ${gv.term / 12} years. Next: ${gameDate(g, c.nextElection)}</p>`;
    } else h += '<p class="small muted">No elections. Power rests on the loyalty of the regime\'s backers.</p>';
    h += `<button class="gold" data-act="regime" style="width:100%;margin-top:6px">Change form of government…</button></div>`;

    h += this.lawsHtml(c, g);
    h += this.pressHtml(c, g);
    const clout = interestClout(c);
    h += `<div class="card"><h3>Interest groups</h3><p class="small muted">★ marks the regime's power base: their loyalty matters most for stability. Clout comes from the classes behind each group. Concessions cost ${APPEASE_COST.pc} PC and ${fmtMoney(APPEASE_COST.money * c.gdp)}.</p>`;
    for (const f of FACTION_KEYS) {
      const F = FACTIONS[f];
      const star = gv.base[f] ? '★ ' : '';
      const dem = interestDemand(c, f);
      const ld = c.igLeaders && c.igLeaders[f];
      h += `<div class="person"><div title="${ld ? esc(ld.name) : ''}">${ld ? portraitSVG(ld, { size: 46, gov: c.gov }) : `<span class="icon">${F.icon}</span>`}</div><div class="pinfo" title="${esc(F.desc)}">${bar(`${F.icon} ${star}${F.name} <span class="ftag">clout ${pct(clout[f])}</span>`, c.factions[f])}
        ${ld ? `<div class="small">${esc(ld.name)}, ${ld.age} · <span class="${ld.stance === 'radical' ? 'bad' : 'good'}">${ld.stance}</span>${ld.traits.map(t => ` <span class="trait" title="${esc(TRAITS[t].desc || '')}">${TRAITS[t].name}</span>`).join('')}</div>` : ''}
        ${(() => { const k = MOVEMENT_KEYS.find(x => MOVEMENT_IG[x] === f); const m = k && c.movements && c.movements[k]; return m && m.support > 2 ? `<div class="small">Radical wing: <b>${MOVEMENTS[k].name}</b>, ${m.support.toFixed(0)}% of the people, radicalism <span class="${m.radicalism > 60 ? 'bad' : m.radicalism > 40 ? 'warn' : 'muted'}">${Math.round(m.radicalism)}</span></div>` : ''; })()}
        ${dem ? `<div class="small muted">Wants: <a href="#" data-act="lawpick" data-cat="${dem.cat}" data-opt="${dem.opt}">${esc(LAW_CATS[dem.cat].opts[dem.opt].name)}</a></div>` : ''}</div>
        <div class="pact"><button data-act="appease" data-f="${f}" ${costOk(c, APPEASE_COST) ? 'disabled' : ''} title="Make concessions to the ${F.name}">Appease</button>
        ${ld ? Object.entries(IG_ACTIONS).map(([k, A]) => `<button data-act="ig" data-f="${f}" data-a="${k}" ${c.pc < A.pc ? 'disabled' : ''} title="${esc(A.desc)}">${A.name} (${A.pc})</button>`).join('') : ''}</div></div>`;
    }
    h += '</div>';

    if (gv.party === 'multi') {
      const polls = computePolls(c);
      h += `<div class="card"><h3>Parties & polls</h3>`;
      c.parties.forEach((p, i) => {
        h += `<div class="party-row"><span class="dot" style="background:${p.color}"></span><span>${esc(p.name)}${p.id === c.rulingParty ? ' <span class="badge" style="background:#444">governing</span>' : ''}</span><span style="text-align:right">${pct(polls[i], 1)}</span></div>`;
      });
      if (c.lastElection && !c.lastElection.sham) {
        h += `<h4>Last election · ${gameDate(g, c.lastElection.month)}</h4>${this.seatBar(c.lastElection)}`;
      }
      h += '</div>';
    } else {
      h += `<div class="card"><h3>Ruling body</h3><p class="small">${esc(c.parties[0].name)} holds all power. No opposition is permitted.</p></div>`;
    }
    h += `<div class="card"><h3>Political compass</h3>${compassSVG(c)}<p class="small muted" style="text-align:center">● public · ■ regime${gv.party === 'multi' ? ' · small dots: parties' : ''}</p></div>`;
    h += this.coalitionHtml(c, g);
    h += this.woundHtml(c, g);
    h += this.movementsHtml(c);
    h += this.regionsHtml(c, g);
    h += `<div class="card"><h3>Domestic actions</h3><p class="small muted">You have <b>${Math.floor(c.pc)}</b> political capital.</p><div class="actions">`;
    for (const { a, reason } of domesticActionList(g, c)) h += this.actionBtn(c, 'dom', a, reason);
    h += '</div></div>';
    return h;
  },

  seatBar(res) {
    const seated = res.results.filter(r => r.seats > 0);
    return `<div class="seatbar">${seated.map(r => `<div style="width:${r.seats / 2}%;background:${r.color}" title="${esc(r.name)}: ${r.seats} seats"></div>`).join('')}</div>` +
      `<table class="list"><tr><th>Party</th><th>Vote</th><th>Seats</th></tr>${res.results.slice().sort((a, b) => b.seats - a.seats || b.vote - a.vote).map(r =>
        `<tr${r.id === res.winner ? ' class="me"' : ''}><td><span class="swatch" style="background:${r.color};width:10px;height:10px"></span> ${esc(r.name)}</td><td>${pct(r.vote, 1)}</td><td>${r.seats}</td></tr>`).join('')}</table>`;
  },

  // Where crises could hit us (exposure.js), from the real numbers; the prudent remedy on hover.
  exposureHtml(c, g) {
    const X = crisisExposure(g, c);
    if (!X.length) return '';
    const word = ['Low', 'Moderate', 'High'], cls = ['good', 'warn', 'bad'];
    const high = X.filter(x => x.level === 2).length, mid = X.filter(x => x.level === 1).length;
    return `<div class="card"><h3>Exposure to crises</h3>
      <p class="small muted">${high ? `${high} high risk${high > 1 ? 's' : ''}` : mid ? 'No high risks' : 'Well protected'}${mid ? `, ${mid} moderate` : ''}. Hover a line for what a prudent government does about it. Prudence costs something: smaller booms, less to invest, less to spend in a slump.</p>
      ${X.map(x => `<div class="kv" title="${esc(x.fix)}"><span>${esc(x.name)}</span><span class="${cls[x.level]}">${word[x.level]}</span></div><div class="small muted" style="margin:-2px 0 6px">${esc(x.why)}</div>`).join('')}</div>`;
  },

  viewEconomy(c, g) {
    const E = c.econ;
    let h = this.exposureHtml(c, g) + this.moneyHtml(c, g) + this.creditHtml(c, g) + this.debtHtml(c, g) + this.paymentsHtml(c, g) + `<div class="card grid2">
      <div class="kv"><span>GDP</span><span>${fmtMoney(c.gdp)}</span></div>
      <div class="kv"><span>Per capita</span><span>$${(c.gdpPerCap * 1000).toFixed(0)}</span></div>
      <div class="kv"><span>Growth</span><span class="${c.growthAvg < 0 ? 'bad' : 'good'}">${fmtSigned(c.growthAvg * 1200)}%/yr</span></div>
      <div class="kv"><span>Productivity</span><span>${E.tech.toFixed(2)}×</span></div>
      <div class="kv"><span>Unemployment</span><span class="${E.unemployment > 0.08 ? 'bad' : ''}">${pct(E.unemployment, 1)}</span></div>
      <div class="kv"><span>Treasury</span><span class="${c.treasury < 0 ? 'bad' : ''}">${fmtMoney(c.treasury)}</span></div>
    </div>`;
    h += `<div class="card" id="budget-preview">${this.budgetHtml(c)}</div>`;
    h += this.industryHtml(c, g);
    h += `<div class="card"><h3>Policy</h3><p class="small muted">Spending is a share of GDP. Government spending flows into the economy: soldiers, officials and teachers are paid wages, and the state buys arms, fuel, steel, timber and tools on the market.</p>`;
    for (const k of Object.keys(POLICY_LIMITS)) {
      const L = POLICY_LIMITS[k];
      h += `<div class="slider-row"><label><span>${L.label}</span><b id="pv-${k}">${this.policyValue(c, k)}</b></label>
        <input type="range" data-policy="${k}" min="${L.min}" max="${L.max}" step="${L.step}" value="${c.policy[k]}" ${k === 'tariff' && effectiveTariff(g, c) !== c.policy.tariff ? 'disabled' : ''}><small>${k === 'military' && c.treaty && c.treaty.until > g.month && !c.treaty.broken ? `<b class="warn">Treaty limit: ${c.treaty.milCap}% of GDP until ${gameDate(g, c.treaty.until)}. Going over it breaks the treaty.</b> ` : ''}${k === 'tariff' && effectiveTariff(g, c) !== c.policy.tariff ? `Set by the ${esc(economicBloc(g, c.id).name)}: ${pct(effectiveTariff(g, c))} on imports from outside the bloc.` : L.hint}</small></div>`;
    }
    h += '</div>';
    h += `<div class="card"><h3>History</h3><div class="lbl small muted">GDP over the last 10 years</div>${spark(c.hist.gdp, '#5b8cff')}</div>`;
    return h;
  },

  industryHtml(c, g) {
    const E = c.econ;
    const ind = nationalIndustry(g, c);
    const pros = buildingProspects(g, c);
    const communist = !ownersAllowed(c);
    let h = `<div class="card"><h3>Industry & construction</h3>
      <p class="small muted">${communist ? 'All enterprises belong to the state: their profits go straight to the treasury, and only the state builds.' : 'Capitalists and landowners reinvest their savings in whatever pays best. The state can build too, from the state investment fund (or the treasury once the fund is empty).'}</p>
      <div class="grid2 small">
        <div class="kv"><span>State fund</span><span>${fmtMoney(E.statePool / 1e6)}</span></div>
        <div class="kv"><span>Private capital</span><span>${communist ? '—' : fmtMoney(E.investPool / 1e6)}</span></div>
      </div>
      <label class="small"><input type="checkbox" data-act="autoinvest" ${E.autoInvest ? 'checked' : ''}> Let ministries spend the state fund automatically on whatever is scarcest</label>
      <table class="list" style="margin-top:8px"><tr><th>Building</th><th>Lvl</th><th>Run</th><th title="Value added per level per month">VA/lvl</th><th title="Expected annual return on a new level">ROI</th><th></th></tr>`;
    let kind = '';
    for (const t of BUILDING_KEYS) {
      const def = BUILDINGS[t], o = ind[t], p = pros.find(x => x.t === t);
      if (def.kind !== kind) { kind = def.kind; h += `<tr><td colspan="6" class="small muted" style="padding-top:8px">${kind}</td></tr>`; }
      const ins = Object.keys(def.in).map(x => GOODS[x].name).join(', ');
      const tip = `${def.name}: makes ${GOODS[Object.keys(def.out)[0]].name} from ${ins}${def.res ? ' · needs ' + RES_INFO[def.res].toLowerCase() : ''}`;
      h += `<tr title="${esc(tip)}"><td>${esc(def.name)}</td><td>${o.levels || '<span class="muted">0</span>'}</td>
        <td>${o.levels ? pct(o.active) : ''}</td><td class="${o.va < 0 ? 'bad' : ''}">${o.levels ? fmtMoney(o.va / 1e6) : ''}</td>
        <td class="${p.roi < 0.1 ? 'bad' : p.roi > 0.3 ? 'good' : ''}">${p.prov ? pct(p.roi) : ''}</td>
        <td><button class="small" data-act="build" data-t="${t}" ${p.prov ? '' : 'disabled'} title="${esc(p.prov ? 'Build in ' + p.prov.name : p.reason)}">+ ${fmtMoney(p.cost / 1e6)}</button></td></tr>`;
    }
    h += '</table>';
    if (E.projects.length) {
      h += `<h4>Under construction</h4>`;
      for (const pr of E.projects.slice().sort((a, b) => a.done - b.done)) {
        h += `<div class="kv small"><span>${esc(BUILDINGS[pr.t].name)} · ${esc(g.world.provinces[pr.prov].name)} <span class="muted">(${pr.funder})</span></span><span>${Math.max(0, pr.done - g.month)} mo</span></div>`;
      }
    }
    return h + '</div>';
  },

  // Our trade with one nation, both ways, and how much each side depends on the other (tradeflows.js).
  tradeWithHtml(c, g, t) {
    if (typeof tradeOf !== 'function') return '';
    const me = tradeOf(g, c.id), them = tradeOf(g, t.id);
    const out = me.to[t.id] || { v: 0, goods: {} }, inn = me.from[t.id] || { v: 0, goods: {} };
    const top = gs => goodsShares(gs) || '—';
    if (!out.v && !inn.v) return `<div class="card small"><h3>Trade</h3><p class="muted">We do not trade with ${esc(t.name)}${t.trade.includes(c.id) ? '' : ': there is no trade agreement, and neither of us sells what the other buys on the world market'}.</p></div>`;
    // Goods where one side relies on the other for a large share of its imports.
    const dep = (who, from) => Object.entries(from.goods).map(([k, v]) => [k, v / Math.max(1e-9, who.goodsIn[k] || 0)]).filter(x => x[1] >= 0.25).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, s]) => `${pct(s)} of ${esc(GOODS[GOOD_KEYS[k]].name.toLowerCase())}`).join(', ');
    const ours = dep(me, inn), theirs = dep(them, out);
    return `<div class="card"><h3>Trade with ${esc(t.name)}</h3>
      <div class="kv small"><span>We sell them</span><span>${fmtFlow(out.v)}/mo · ${pct(out.v / Math.max(1e-9, me.out))} of our exports</span></div>
      <div class="small muted" style="margin:-2px 0 4px">${top(out.goods)}</div>
      <div class="kv small"><span>We buy from them</span><span>${fmtFlow(inn.v)}/mo · ${pct(inn.v / Math.max(1e-9, me.in))} of our imports</span></div>
      <div class="small muted" style="margin:-2px 0 4px">${top(inn.goods)}</div>
      <div class="kv small"><span>They get from us</span><span>${pct(out.v / Math.max(1e-9, them.in))} of their imports</span></div>
      ${ours ? `<p class="small warn" style="margin:4px 0 0">We depend on them for ${ours} we import.</p>` : ''}${theirs ? `<p class="small" style="margin:4px 0 0">They depend on us for ${theirs} they import.</p>` : ''}
      <p class="small muted" style="margin-top:6px">12-month averages at world prices. Trade inside a bloc comes first; the rest goes through the world market, shared out by each exporter's share of world sales. See the Trade map mode.</p></div>`;
  },

  viewMarket(c, g) {
    const E = c.econ, W = g.worldMarket;
    const fmtQ = q => q >= 10000 ? (q / 1000).toFixed(0) + 'k' : q >= 1000 ? (q / 1000).toFixed(1) + 'k' : q.toFixed(0);
    let h = `<div class="card small"><p>Every nation has its own market. Prices rise when demand outstrips supply and fall when goods pile up. Surpluses and shortages are traded on the world market: trade openness is <b>${pct(E.tau)}</b> (raised by trade agreements; lowered by tariffs, war and planned economies).</p>
      <div class="grid2"><div class="kv"><span>Trade balance</span><span class="${E.tradeBalance < 0 ? 'bad' : 'good'}">${fmtMoney(E.tradeBalance)}/mo</span></div>
      <div class="kv"><span>Tariff income</span><span>${fmtMoney(E.tariffRev)}/mo</span></div></div></div>
      <table class="list"><tr><th>Good</th><th title="Local price vs. base price">Price</th><th title="World price vs. base">World</th><th>Supply</th><th>Demand</th><th>Trade</th><th title="Share of demand actually met">Met</th></tr>`;
    let cat = '';
    for (const gk of GOOD_KEYS) {
      const G = GOODS[gk];
      if (G.cat !== cat) { cat = G.cat; h += `<tr><td colspan="7" class="small muted" style="padding-top:8px">${cat}</td></tr>`; }
      const r = E.prices[gk] / G.base, wr = W.prices[gk] / G.base;
      const tr = E.exports[gk] > E.imports[gk] ? `<span class="good">+${fmtQ(E.exports[gk])}</span>` : E.imports[gk] > 0.5 ? `<span class="warn">−${fmtQ(E.imports[gk])}</span>` : '';
      const f = E.fulfill[gk];
      h += `<tr><td>${G.name}</td><td style="color:${r > 1.4 ? 'var(--bad)' : r < 0.75 ? 'var(--good)' : 'inherit'}">${pct(r)}</td><td class="muted">${pct(wr)}</td>
        <td>${fmtQ(E.S[gk])}</td><td>${fmtQ(E.D[gk])}</td><td>${tr}</td><td class="${f < 0.95 ? 'bad' : ''}">${pct(f)}</td></tr>`;
    }
    h += '</table><p class="small muted">Price 100% = base price. Shortages ("Met" below 100%) ration goods for everyone: pops go without, factories stall, and the army runs short of arms.</p>';
    if (typeof goodPartners === 'function') {
      const fmtP = all => { const list = all.filter(x => x[2] >= 0.01), more = all.length - Math.min(3, list.length); return list.slice(0, 3).map(([id, , s]) => `${swatch(g.countries[id])} ${esc(g.countries[id].name)} ${pct(s)}`).join(', ') + (more > 0 ? ` <span class="muted">+${more} more</span>` : ''); };
      let rows = '';
      GOOD_KEYS.forEach((k, gi) => {
        const gp = goodPartners(g, c.id, gi);
        if (!gp.buy.length && !gp.sell.length) return;
        rows += `<tr><td>${GOODS[k].name}</td><td class="small">${gp.buy.length ? fmtP(gp.buy) : '<span class="muted">—</span>'}</td><td class="small">${gp.sell.length ? fmtP(gp.sell) : '<span class="muted">—</span>'}</td></tr>`;
      });
      h += `<div class="card"><h3>Trading partners</h3><p class="small muted">Who we buy each good from and sell it to, as shares of our imports and exports of that good (12-month average). Bloc partners trade first; the rest is shared out on the world market by each exporter's share of world sales. A large share means we depend on that partner, or it on us.</p>
        ${rows ? `<table class="list"><tr><th>Good</th><th>We buy from…</th><th>We sell to…</th></tr>${rows}</table>` : '<p class="small muted">We have not traded with anyone yet.</p>'}</div>`;
    }
    return h;
  },

  viewPops(c, g) {
    const E = c.econ;
    let h = this.peoplesHtml(c, g) + this.societyHtml(c, g) + `<div class="card">
      ${bar('Average standard of living', E.avgSol, { tip: 'How well pops meet their basic, everyday and luxury needs.' })}
      ${bar('Contentment', 50 + E.contentment, { text: fmtSigned(E.contentment, 0), tip: 'Standard of living compared with what each class expects. Drives approval.' })}
      <div class="grid2" style="margin-top:6px">
        <div class="kv"><span>Population</span><span>${fmtPop(c.pop)}</span></div>
        <div class="kv"><span>Literacy</span><span>${pct(E.literacy)}</span></div>
        <div class="kv"><span>Unemployment</span><span class="${E.unemployment > 0.08 ? 'bad' : ''}">${pct(E.unemployment, 1)}</span></div>
        <div class="kv"><span>Peasantry</span><span>${pct(E.popType.peasants / Math.max(1, c.pop))}</span></div>
      </div></div>`;
    h += `<div class="card"><h3>Social classes</h3><table class="list"><tr><th>Class</th><th>Pop</th><th>Share</th><th title="Standard of living (0-100)">SoL</th><th title="Net income per person per month">Income</th><th>Jobless</th></tr>`;
    for (const t of POP_KEYS) {
      const n = E.popType[t];
      if (n < 1) continue;
      const exp = SOL_EXPECT[POP_TYPES[t].strata];
      const sol = E.solType[t];
      h += `<tr title="${esc(POP_TYPES[t].desc)} Expected standard of living: ${exp}."><td>${POP_TYPES[t].name}</td><td>${fmtPop(n)}</td><td>${pct(n / c.pop, 1)}</td>
        <td style="color:${sol >= exp ? 'var(--good)' : sol < exp - 15 ? 'var(--bad)' : 'var(--warn)'}">${sol.toFixed(0)}</td>
        <td>$${(E.incType[t] * 1000).toFixed(0)}</td><td>${t === 'peasants' ? '' : n > 0 ? pct(E.unempType[t] / n) : ''}</td></tr>`;
    }
    h += `</table><p class="small muted">Green: living as well as the class expects (lower ${SOL_EXPECT.lower}, middle ${SOL_EXPECT.middle}, upper ${SOL_EXPECT.upper}). Workers come from the peasantry as new jobs open; clerks and capitalists also need literacy.</p></div>`;
    h += `<div class="card"><h3>By stratum</h3>${bar('Lower classes', E.strataSol.lower)}${bar('Middle classes', E.strataSol.middle)}${bar('Upper classes', E.strataSol.upper)}</div>`;
    h += `<div class="card"><h3>Needs</h3><p class="small">Pops spend their income in order: <b>basic needs</b> (grain, fish or meat, clothes, coal or fuel), then <b>everyday goods</b> (more food and clothes, furniture, appliances, fuel), then <b>luxuries</b>. Whatever is left is saved; capitalists and landowners invest their savings. Hunger shrinks the population; comfort grows it.</p></div>`;
    h += `<div class="card"><h3>Class politics</h3><p class="small">Weighted by wealth and influence, the classes pull public opinion toward <b>${ideologyText(E.popIdeo)}</b>. Poverty radicalizes: miserable pops drift left and toward strongmen, while literacy makes people more liberal.</p></div>`;
    return h;
  },

  policyValue(c, k) { return k === 'tax' || k === 'tariff' ? pct(c.policy[k]) : c.policy[k].toFixed(1) + '% GDP'; },

  budgetHtml(c) {
    const b = projectBudget(c);
    const debt = -c.treasury / (c.gdpNom || c.gdp);
    return `<h3>Monthly budget</h3>
      <div class="kv"><span>Income tax</span><span class="good">${fmtMoney(b.taxes)}</span></div>
      ${b.tariffs > 0.0001 ? `<div class="kv"><span>Tariffs</span><span class="good">${fmtMoney(b.tariffs)}</span></div>` : ''}
      ${Math.abs(b.stateProfit) > 0.0001 ? `<div class="kv"><span>State enterprises</span><span class="${b.stateProfit < 0 ? 'bad' : 'good'}">${fmtMoney(b.stateProfit)}</span></div>` : ''}
      <div class="kv"><span>Spending (${b.spendPct.toFixed(1)}% of GDP incl. ${ADMIN_COST}% administration)</span><span class="bad">−${fmtMoney(b.spend)}</span></div>
      ${b.interest ? `<div class="kv"><span>Debt interest (${((c.debt ? c.debt.yield : 0) * 100).toFixed(1)}%, paid to the holders)</span><span class="bad">−${fmtMoney(b.interest)}</span></div>` : ''}
      ${b.payFrac < 0.999 ? `<p class="small bad">Lenders won't cover the deficit: only ${pct(b.payFrac)} of planned spending can be paid.</p>` : ''}
      <div class="kv" style="border-top:1px solid var(--line);margin-top:4px;padding-top:4px"><span><b>Balance</b></span><span class="${b.net < 0 ? 'bad' : 'good'}"><b>${b.net >= 0 ? '+' : ''}${fmtMoney(b.net)}</b></span></div>
      ${debt > 0.6 ? `<p class="small bad">Debt is ${pct(debt)} of GDP. Lenders grow wary and demand more interest; above 150% the state defaults.</p>` : ''}`;
  },

  updatePolicyLabels() {
    const c = this.player();
    for (const k of Object.keys(POLICY_LIMITS)) { const el = $('#pv-' + k); if (el) el.textContent = this.policyValue(c, k); }
    const mg = $('#pv-moneyGrowth'); if (mg) mg.textContent = (c.policy.moneyGrowth || 0).toFixed(0) + '%/yr';
    const bp = $('#budget-preview');
    if (bp) bp.innerHTML = this.budgetHtml(c);
  },

  viewMilitary(c, g) {
    const all = g.countries.filter(x => x.alive).sort((a, b) => strength(b) - strength(a));
    let h = `<div class="card grid2">
      <div class="kv"><span>Soldiers</span><span>${fmtPop(c.army)}</span></div>
      <div class="kv"><span>Target size</span><span>${fmtPop(armyTarget(c))}</span></div>
      <div class="kv"><span>Strength</span><span>${strength(c).toFixed(0)}</span></div>
      <div class="kv"><span>World rank</span><span>#${all.indexOf(c) + 1} of ${all.length}</span></div>
      <div class="kv"><span>War exhaustion</span><span class="${c.warExhaustion > 40 ? 'bad' : ''}">${Math.round(c.warExhaustion)}</span></div>
      <div class="kv"><span>Infamy</span><span class="${(c.infamy || 0) >= INFAMY.coalitionAt ? 'bad' : ''}">${Math.round(c.infamy || 0)} / ${INFAMY.coalitionAt}</span></div>
      <div class="kv"><span>Occupied land</span><span>${pct(occupiedShare(g, c))} of pop</span></div>
      <div class="kv"><span>Allies</span><span>${c.allies.length}</span></div>
      <div class="kv"><span>Standing</span><span>${isGreatPower(g, c.id) ? '<b style="color:var(--gold)">Great power</b>' : 'Minor power'}</span></div>
    </div>
    ${c.treaty && c.treaty.until > g.month ? `<div class="alert ${c.treaty.broken ? 'bad' : 'warn'} small">${c.treaty.broken ? `We repudiated the disarmament clauses in ${gameDate(g, c.treaty.broken)}. The victors (${c.treaty.by.map(id => esc(g.countries[id].name)).join(', ')}) watch us closely.` : `Disarmed by treaty until ${gameDate(g, c.treaty.until)}: military spending may not exceed ${c.treaty.milCap}% of GDP. Going over it breaks the treaty (infamy, and the victors' anger).`}</div>` : ''}
    <div class="card">${bar('Military loyalty', c.factions.military)}<p class="small muted">Conquest has a price: every war of aggression and every province taken adds <b>infamy</b>, which sours relations and, above ${INFAMY.coalitionAt}, can unite your neighbors in a coalition against you. In war, captured land is <b>occupied</b> (half output, unrest) and only changes hands at the peace. Annexed land stays unsettled for five years.</p><p class="small muted">Strength depends on army size (set by military spending and population), wealth, stability and the loyalty of the officers. Defenders fight with a 30% bonus.</p>
      <button data-act="tab" data-tab="economy">Adjust military spending →</button></div>`;
    const wars = warsOf(g, c.id);
    h += `<h4>Wars</h4>`;
    if (!wars.length) h += '<p class="muted small">We are at peace.</p>';
    if (isAtWar(g, c.id) || c.mobilized) h += `<div class="card"><h3>${icon('military', 16)} Mobilization</h3><p class="small" style="margin-top:0">${c.mobilized ? `<b class="warn">The nation is mobilized</b> since ${gameDate(g, c.mobilized - 1)}: the army grows toward 160% of its peacetime size, but factories lose 10% of their output, approval suffers and war exhaustion builds faster.` : 'Call up the reserves: the army grows toward 160% of its peacetime size, at the cost of 10% of industrial output, approval and faster war exhaustion.'}</p>
      <button class="${c.mobilized ? '' : 'danger'}" data-act="mobilize" data-on="${c.mobilized ? 0 : 1}">${c.mobilized ? 'Demobilize' : `General mobilization (${MOBILIZE_PC} PC)`}</button></div>`;
    for (const w of wars) {
      const mine = w.a.includes(c.id) ? 'a' : 'b', theirs = mine === 'a' ? 'b' : 'a';
      const us = w[mine].map(id => g.countries[id]), them = w[theirs].map(id => g.countries[id]);
      const sU = sideStrength(g, w[mine]) * (mine === 'b' ? 1.3 : 1), sT = sideStrength(g, w[theirs]) * (theirs === 'b' ? 1.3 : 1);
      h += `<div class="card war-card${w.world ? ' world-war' : ''}"><h3>⚔ ${esc(w.name)}${w.world ? ' <span class="badge" style="background:#8a2b2b">World war</span>' : ''}</h3>
        <div class="small muted">Since ${gameDate(g, w.start)} · ${g.month - w.start} months${w.world ? ` · began as the ${esc(w.oldName)}. The great powers will settle it at a peace conference.` : ''}</div>
        <div class="kv"><span>Our side</span><span>${us.map(x => swatch(x) + ' ' + esc(x.name)).join(', ')}</span></div>
        <div class="kv"><span>Enemy</span><span>${them.map(x => swatch(x) + ' ' + esc(x.name)).join(', ')}</span></div>
        <div class="kv"><span>Occupied</span><span><span class="good">${g.world.provinces.filter(p => them.some(x => x.id === p.owner) && p.occ != null && us.some(x => x.id === p.occ)).length} enemy provinces</span> · <span class="bad">${g.world.provinces.filter(p => us.some(x => x.id === p.owner) && p.occ != null).length} of ours</span></span></div>
        <div class="kv"><span>Front</span><span>${frontSectors(g, w, w[mine]).length} sectors we can attack · ${frontSectors(g, w, w[theirs]).length} exposed</span></div>
        <div class="small" style="margin:6px 0 2px">Posture: ${Object.entries(POSTURES).map(([k, P]) => `<button class="${((w.posture && w.posture[c.id]) || 'balanced') === k ? 'active' : ''}" data-act="posture" data-war="${w.id}" data-p="${k}" title="${esc(P.desc)}">${P.name}</button>`).join(' ')}</div>
        <p class="small muted" style="margin:2px 0">Battles are fought province by province along the front. Hills and mountains favor the defender, half-surrounded provinces fall more easily, and land reached only by sea is hard to supply. Occupied land changes hands only at the peace.</p>
        <div class="kv"><span>Strength</span><span>${sU.toFixed(0)} vs ${sT.toFixed(0)}</span></div>
        <div class="kv"><span>Exhaustion</span><span>${Math.round(w['ex' + mine.toUpperCase()])} vs ${Math.round(w['ex' + theirs.toUpperCase()])}</span></div>
        <div class="kv"><span>War score</span><span class="${warScore(g, w, c.id) >= 0 ? 'good' : 'bad'}">${fmtSigned(warScore(g, w, c.id), 0)}</span></div>
        <button data-act="peace" data-war="${w.id}" ${c.pc < 10 ? 'disabled' : ''}>Negotiate peace…</button></div>`;
    }
    const ns = getNeighbors(g, c.id).map(id => g.countries[id]);
    h += `<h4>Neighbors</h4><table class="list"><tr><th>Nation</th><th>Gov</th><th>Strength</th><th>Rel.</th></tr>`;
    for (const n of ns.sort((a, b) => strength(b) - strength(a))) {
      const rel = relation(g, c.id, n.id);
      h += `<tr class="click" data-act="select" data-id="${n.id}"><td>${swatch(n)} ${esc(n.name)}${atWarWith(g, c.id, n.id) ? ' ⚔' : c.allies.includes(n.id) ? ' 🤝' : ''}</td><td>${govBadge(n.gov)}</td><td>${strength(n).toFixed(0)}</td><td class="${rel < 0 ? 'bad' : 'good'}">${Math.round(rel)}</td></tr>`;
    }
    return h + '</table>';
  },

  viewDiplomacy(c, g) {
    const t = this.selected != null ? g.countries[this.selected] : null;
    if (!t || t.id === c.id) {
      let h = this.realmHtml(c, g) + '<div class="alert info">Click a nation on the map (or below) to open relations with it.</div><table class="list"><tr><th>Nation</th><th>Gov</th><th>Relations</th><th></th></tr>';
      const others = g.countries.filter(x => x.alive && x.id !== c.id).sort((a, b) => relation(g, c.id, b.id) - relation(g, c.id, a.id));
      for (const o of others) {
        const rel = relation(g, c.id, o.id);
        const tag = atWarWith(g, c.id, o.id) ? '⚔ war' : o.overlord === c.id ? '♜ our ' + SUBJECT_TYPES[o.subjectType].name.toLowerCase() : c.overlord === o.id ? '♜ our overlord' : c.allies.includes(o.id) ? '🤝 ally' : c.trade.includes(o.id) ? '⇄ trade' : o.overlord != null ? `<span class="muted">${SUBJECT_TYPES[o.subjectType].name.toLowerCase()} of ${esc(g.countries[o.overlord].name)}</span>` : '';
        h += `<tr class="click" data-act="select" data-id="${o.id}"><td>${swatch(o)} ${esc(o.name)}</td><td>${govBadge(o.gov)}</td><td class="${rel < 0 ? 'bad' : 'good'}">${Math.round(rel)}</td><td class="small">${tag}</td></tr>`;
      }
      return h + '</table>';
    }
    if (!t.alive) return `<div class="alert bad">The ${esc(t.name)} no longer exists.</div><button data-act="select" data-id="-1">Back</button>`;
    const rel = relation(g, c.id, t.id);
    const status = [];
    if (atWarWith(g, c.id, t.id)) status.push('<span class="bad">⚔ At war</span>');
    if (c.allies.includes(t.id)) status.push('<span class="good">🤝 Allied</span>');
    if (c.trade.includes(t.id)) status.push('<span class="good">⇄ Trade agreement</span>');
    if (hasTruce(g, c.id, t.id)) status.push(`<span class="muted">Truce until ${gameDate(g, truceUntil(g, c.id, t.id))}</span>`);
    if (getNeighbors(g, c.id).includes(t.id)) status.push('<span class="muted">Neighbor</span>');
    if (t.overlord === c.id) status.push(`<span class="good">♜ Our ${SUBJECT_TYPES[t.subjectType].name.toLowerCase()}</span>`);
    else if (t.overlord != null) status.push(`<span class="warn">${SUBJECT_TYPES[t.subjectType].name} of ${esc(g.countries[t.overlord].name)}</span>`);
    if (c.overlord === t.id) status.push('<span class="warn">♜ Our overlord</span>');
    const tSubs = subjectsOf(g, t.id);
    if (tSubs.length) status.push(`<span class="muted">Overlord of ${tSubs.map(x => esc(x.name)).join(', ')}</span>`);
    let h = `<button data-act="select" data-id="-1" class="small" style="margin-bottom:8px">← All nations</button>`;
    if (this.selProv != null && g.world.provinces[this.selProv] && g.world.provinces[this.selProv].owner === t.id) h += this.provinceCard(g.world.provinces[this.selProv], false);
    h += `<div class="card">${this.nationHeader(t)}${typeof kinNations === 'function' && g.families && kinNations(g, c, t) ? `<div class="small good" style="margin-top:4px">Kin: our peoples are both of the ${esc(g.families[g.cultures[c.culture].family].name)}.</div>` : ''}${(() => { const a = claimsOn(g, c, t.id), b = claimsOn(g, t, c.id); return a || b ? `<div class="alert warn small" style="margin-top:6px">${a ? `${a} province${a > 1 ? 's' : ''} of theirs are home to our people. ` : ''}${b ? `${b} of ours are home to theirs. ` : ''}Nationalists on both sides want borders redrawn.</div>` : ''; })()}</div>`;
    h += `<div class="card">${bar('Relations with us', (rel + 100) / 2, { text: Math.round(rel), color: rel < -30 ? 'var(--bad)' : rel > 30 ? 'var(--good)' : 'var(--warn)' })}
      <div class="small">${status.join(' · ') || '<span class="muted">No agreements</span>'}</div></div>`;
    const ratio = strength(c) / Math.max(0.01, strength(t));
    h += `<div class="card grid2">
      <div class="kv"><span>Population</span><span>${fmtPop(t.pop)}</span></div>
      <div class="kv"><span>GDP</span><span>${fmtMoney(t.gdp)}</span></div>
      <div class="kv"><span>Stability</span><span style="color:${statColor(t.stability)}">${Math.round(t.stability)}</span></div>
      <div class="kv"><span>Approval</span><span>${Math.round(t.approval)}</span></div>
      <div class="kv"><span>Strength</span><span>${strength(t).toFixed(0)}</span></div>
      <div class="kv"><span>vs. ours</span><span class="${ratio >= 1 ? 'good' : 'bad'}">${ratio >= 1 ? 'We are ' + ratio.toFixed(1) + '× stronger' : 'They are ' + (1 / ratio).toFixed(1) + '× stronger'}</span></div>
      <div class="kv"><span>Allies</span><span>${t.allies.length ? t.allies.map(id => esc(g.countries[id].name)).join(', ') : 'none'}</span></div>
      <div class="kv"><span>Infamy</span><span class="${(t.infamy || 0) >= INFAMY.coalitionAt ? 'bad' : ''}">${Math.round(t.infamy || 0)}</span></div>
      <div class="kv"><span>Provinces</span><span>${t.provinceCount}</span></div>
    </div>
    <div class="card small">Their public is ${ideologyText(t.ideo)}.</div>`;
    h += this.tradeWithHtml(c, g, t);
    if (t.overlord === c.id) {
      const T = SUBJECT_TYPES[t.subjectType];
      h += `<div class="card"><h3>♜ Our ${T.name}</h3><p class="small muted">${T.desc}</p>
        ${bar('Desire for independence', t.liberty, { invert: true, tip: 'Above 72, a subject may declare independence if it thinks it can win.' })}
        <div class="kv small"><span>Tribute to us</span><span>${fmtMoney(t.tributePaid || 0)}/mo</span></div>
        ${t.integration ? `<div class="kv small"><span>Integration</span><span>${Math.max(0, INTEGRATION_TIME - (g.month - t.integration.start))} months left</span></div>` : ''}</div>`;
    }
    h += `<div class="card"><h3>Actions</h3><div class="actions">`;
    for (const { a, reason } of diploActionList(g, c, t)) h += this.actionBtn(c, 'diplo', a, reason, `data-target="${t.id}"`);
    for (const { a, reason } of empireActionList(g, c, t)) h += this.actionBtn(c, 'empire', a, reason, `data-target="${t.id}"`);
    return h + '</div></div>';
  },

  realmHtml(c, g) {
    let h = '';
    const O = overlordOf(g, c);
    if (O) {
      const T = SUBJECT_TYPES[c.subjectType];
      h += `<div class="card"><h3>♜ We are a ${T.name.toLowerCase()} of the ${esc(formalName(O))}</h3><p class="small muted">${T.desc}</p>
        ${bar('Our desire for independence', c.liberty, { color: 'var(--accent2)' })}
        <div class="kv small"><span>Tribute we pay</span><span class="bad">${fmtMoney(c.tributePaid || 0)}/mo</span></div>
        ${c.integration ? `<div class="alert bad small">Our overlord is integrating us: ${Math.max(0, INTEGRATION_TIME - (g.month - c.integration.start))} months until we cease to exist. Raise our desire for independence above 75 to stop it, or declare independence.</div>` : ''}
        <button data-act="select" data-id="${O.id}">Open relations with ${esc(O.name)} →</button></div>`;
    }
    const subs = subjectsOf(g, c.id);
    const groups = releasableGroups(g, c);
    if (!subs.length && !groups.length) return h;
    h += `<div class="card"><h3>♜ Our realm</h3>`;
    if (subs.length) {
      h += `<table class="list"><tr><th>Subject</th><th>Type</th><th>Liberty</th><th>Tribute</th></tr>`;
      for (const s of subs) h += `<tr class="click" data-act="select" data-id="${s.id}"><td>${swatch(s)} ${esc(s.name)}${s.integration ? ' <span class="small muted">(integrating)</span>' : ''}</td><td>${SUBJECT_TYPES[s.subjectType].name}</td><td class="${s.liberty > 60 ? 'bad' : s.liberty > 40 ? 'warn' : 'good'}">${Math.round(s.liberty)}</td><td>${fmtMoney(s.tributePaid || 0)}</td></tr>`;
      h += '</table>';
    }
    if (groups.length) {
      h += `<h4>Land that belongs to others</h4><p class="small muted">Conquered provinces whose people look to another nation. Releasing them lowers our infamy and ends their unrest; fallen nations can be restored, as independents or as our subjects.</p>`;
      for (const gr of groups) {
        const N = gr.owner;
        h += `<div class="kv small" style="align-items:center"><span>${swatch(N)} ${gr.provs.length} province${gr.provs.length > 1 ? 's' : ''} of ${esc(N.name)}${N.alive ? '' : ' <span class="muted">(fallen)</span>'}</span>
          <span><button class="small" data-act="release" data-core="${N.id}">${N.alive ? 'Return' : 'Restore…'}</button></span></div>`;
      }
    }
    return h + '</div>';
  },

  viewBlocs(c, g) {
    const blocs = g.blocs || [];
    const mine = blocs.filter(b => b.members.includes(c.id));
    const others = blocs.filter(b => !b.members.includes(c.id));
    let h = `<div class="card small"><p>Blocs bind nations together. <b>Military pacts</b> defend every member. <b>Free-trade zones</b> and <b>customs unions</b> form a shared market that trades tariff-free before the world market; customs unions also share one external tariff set by the leader. <b>Confederations</b> do both, with a council. A nation can belong to one military and one economic bloc.</p></div>`;
    for (const b of mine) {
      const T = BLOC_TYPES[b.type], lead = b.leader === c.id;
      const candidates = g.countries.filter(o => o.alive && !b.members.includes(o.id) && !canJoin(g, o, b.type)).sort((x, y) => relation(g, c.id, y.id) - relation(g, c.id, x.id));
      h += `<div class="card bloc" style="border-left:4px solid rgb(${b.color.join(',')})"><h3>${T.icon} ${esc(b.name)}</h3>
        <div class="small muted">${T.name} · founded ${gameDate(g, b.founded)} · led by ${esc(g.countries[b.leader].name)}${lead ? ' (us)' : ''}</div>
        <p class="small">${T.desc}</p>
        <table class="list"><tr><th>Member</th><th>Gov</th><th>Strength</th><th>Rel.</th><th></th></tr>${b.members.map(m => { const o = g.countries[m]; return `<tr><td>${swatch(o)} ${esc(o.name)}${m === b.leader ? ' ★' : ''}</td><td>${govBadge(o.gov)}</td><td>${strength(o).toFixed(0)}</td><td>${m === c.id ? '' : Math.round(relation(g, c.id, m))}</td><td>${lead && m !== c.id ? `<button class="small" data-act="bloc" data-a="expel" data-bloc="${b.id}" data-target="${m}" title="10 PC">Expel</button>` : ''}</td></tr>`; }).join('')}</table>`;
      if (T.economic) {
        let ex = 0, im = 0;
        for (const k of GOOD_KEYS) { ex += (c.econ.blocEx ? c.econ.blocEx[k] : 0) * c.econ.prices[k]; im += (c.econ.blocIm ? c.econ.blocIm[k] : 0) * c.econ.prices[k]; }
        h += `<div class="kv small" style="margin-top:6px"><span>Our trade inside the bloc</span><span>exports ${fmtMoney(ex / 1e6)} · imports ${fmtMoney(im / 1e6)} /mo</span></div>`;
      }
      if (b.type === 'customs' || b.type === 'confederation') {
        h += lead ? `<div class="slider-row"><label><span>Common external tariff</span><b id="bt-${b.id}">${pct(b.tariff)}</b></label><input type="range" data-bloctariff="${b.id}" min="0" max="0.5" step="0.01" value="${b.tariff}"><small>Applies to every member's imports from outside the bloc.</small></div>`
          : `<div class="kv small"><span>Common external tariff</span><span>${pct(b.tariff)} (set by ${esc(g.countries[b.leader].name)})</span></div>`;
      }
      h += `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;align-items:center">`;
      if (lead && candidates.length) h += `<select id="invite-${b.id}">${candidates.map(o => { const v = memberVote(g, b, o.id); return `<option value="${o.id}">${esc(o.name)} (rel ${Math.round(relation(g, c.id, o.id))}, ${v.passed ? `${pct(inviteChance(g, b, o.id))} to join` : `members vote no, ${v.yes} of ${v.total}`})</option>`; }).join('')}</select><button class="small" data-act="bloc" data-a="invite" data-bloc="${b.id}" ${c.pc < 10 ? 'disabled' : ''} title="Members vote; then they decide. 10 PC">Invite</button>`;
      if (b.type === 'confederation' && lead) { const why = federateCheck(g, b); h += `<button class="small gold" data-act="federal" data-a="federate" data-bloc="${b.id}" ${why || c.pc < 50 ? 'disabled' : ''} title="${esc(why || 'Merge every member into one federal state led by us. 50 PC')}">Propose federation</button>`; }
      h += `<button class="small" data-act="bloc" data-a="leave" data-bloc="${b.id}">Leave</button></div></div>`;
    }
    if (others.length) {
      h += `<div class="card"><h3>Other blocs</h3><table class="list"><tr><th>Bloc</th><th>Members</th><th></th></tr>`;
      for (const b of others) {
        const why = canJoin(g, c, b.type);
        h += `<tr><td><span class="swatch" style="background:rgb(${b.color.join(',')})"></span> ${BLOC_TYPES[b.type].icon} ${esc(b.name)}<div class="small muted">${BLOC_TYPES[b.type].name}, led by ${esc(g.countries[b.leader].name)}</div></td><td class="small">${b.members.map(m => esc(g.countries[m].name)).join(', ')}</td>
          <td><button class="small" data-act="bloc" data-a="apply" data-bloc="${b.id}" ${why || c.pc < 15 ? 'disabled' : ''} title="${esc(why || 'Members vote on our application. 15 PC')}">Apply</button></td></tr>`;
      }
      h += '</table></div>';
    }
    h += `<div class="card"><h3>Found a bloc</h3><p class="small muted">Choose a founding partner; they decide based on relations, shared politics, the threats they face and what the bloc offers them. Every nation founds blocs this way, so AI partners turn each other down too. The chance each would accept is shown beside its name.</p>`;
    const partners = g.countries.filter(o => o.alive && o.id !== c.id && o.overlord == null).sort((x, y) => relation(g, c.id, y.id) - relation(g, c.id, x.id));
    for (const k of BLOC_KEYS) {
      const T = BLOC_TYPES[k], why = canJoin(g, c, k);
      h += `<div class="person" style="align-items:center"><div class="pinfo"><b>${T.icon} ${T.name}</b><div class="small muted">${T.desc}</div>${why ? `<div class="small bad">${why}</div>` : ''}</div>
        <div class="pact">${why ? '' : `<select id="found-partner-${k}">${partners.filter(o => !canJoin(g, o, k)).map(o => `<option value="${o.id}">${esc(o.name)} (rel ${Math.round(relation(g, c.id, o.id))}, ${pct(foundingChance(g, o, c.id, k))} to accept)</option>`).join('')}</select>`}
        <button class="small" data-act="bloc" data-a="found" data-type="${k}" ${why || c.pc < T.foundPc ? 'disabled' : ''}>Found (${T.foundPc} PC)</button></div></div>`;
    }
    return h + '</div>';
  },

  provinceCard(p, own) {
    const g = App.game, c = g.countries[p.owner];
    const occ = occupationFactor(g, p);
    const status = [];
    if (p.id === c.capital) status.push('<span class="warn">★ capital</span>');
    if (occ > 0) status.push(`<span class="bad">occupied (${Math.round(occ * OCCUPATION_MONTHS)} months left)</span>`);
    else if (p.core !== undefined && p.core !== p.owner) status.push(`<span class="warn">non-core: belongs to ${esc(g.countries[p.core].name)}</span>`);
    if (p.state != null && c.federal) status.push('<span class="muted">federal state</span>');
    const D = designationOf(p);
    if (D) status.push(`<span class="good">${D.name}</span>`);
    const classes = POP_KEYS.filter(t => p.pops[t] >= 1).sort((a, b) => p.pops[b] - p.pops[a]).slice(0, 5)
      .map(t => `${POP_TYPES[t].name} ${pct(p.pops[t] / Math.max(1, p.pop))} <span class="muted">(SoL ${Math.round(p.sol[t] || 0)})</span>`).join(' · ');
    let h = `<div class="card prov-card"><div style="display:flex;justify-content:space-between;align-items:baseline"><h3>📍 ${esc(p.name)}</h3><button class="small" data-act="closeprov">✕</button></div>
      <div class="small">${status.join(' · ') || '<span class="muted">Core province</span>'}</div>
      <div class="grid2 small" style="margin-top:6px">
        <div class="kv"><span>Population</span><span>${fmtPop(p.pop)}</span></div>
        <div class="kv"><span>Living standard</span><span>${provinceSol(p).toFixed(0)}</span></div>
        <div class="kv"><span>Literacy</span><span>${pct(p.lit)}</span></div>
        <div class="kv"><span>Factory workforce</span><span>${pct(provinceIndustry(p))}</span></div>
      </div>
      <div class="small" style="margin-top:4px">${classes}</div>
      ${p.housing ? `<div class="small" style="margin-top:4px"><span class="muted">City:</span> ${fmtPop(urbanPop(p))} · housing ${pct(Math.min(9.99, p.occupancy || 0))} full${(p.rentExcess || 0) > 0.005 ? ` · <span class="warn">rents +${pct(p.rentExcess, 1)}</span>` : ''}${(p.slum || 0) > 0.01 ? ` · <span class="bad">${pct(p.slum)} in slums</span>` : ''}</div>` : ''}
      ${p.cult ? `<div class="small" style="margin-top:4px"><span class="muted">Peoples:</span> ${Object.entries(p.cult).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${esc(cultureName(g, +k))} ${pct(v)}`).join(' · ')}<br><span class="muted">Faiths:</span> ${Object.entries(p.rel || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${esc(faithName(g, +k))} ${pct(v)}`).join(' · ')}${(p.grievance || 0) > 0.05 ? ` · <span class="bad">grievance ${Math.round(p.grievance * 100)}</span>` : ''}</div>` : ''}
      <div class="small muted" style="margin-top:4px">${p.buildings.length ? p.buildings.slice().sort((a, b) => b.level - a.level).map(b => `${esc(BUILDINGS[b.t].name)} ${b.level}`).join(', ') : 'No buildings'}</div>
      <div class="small muted">Resources: ${Object.entries(p.res || {}).filter(([, v]) => v > 0).map(([k, v]) => `${RES_INFO[k]} ${v}`).join(', ') || 'none'}</div>`;
    if (own) {
      h += `<h4>Administration</h4><div class="actions">`;
      for (const k of DESIGNATION_KEYS) {
        const A = DESIGNATIONS[k];
        let why = null;
        if (p.designation === k) why = 'Current designation.';
        else if (A.onlyNonCore && p.core === p.owner) why = 'Only for conquered land.';
        else if (k === 'sez' && sezCount(g, c) >= A.max) why = `At most ${A.max} SEZs.`;
        else if (c.pc < A.pc) why = `Needs ${A.pc} PC.`;
        h += `<button class="action" data-act="designate" data-prov="${p.id}" data-key="${k}" ${why ? 'disabled' : ''} title="${esc(A.desc)}"><span class="name">${A.name}</span><span class="cost">${A.pc} PC</span><span class="small muted">${esc(A.desc)}</span>${why && p.designation !== k ? `<span class="why">${why}</span>` : ''}</button>`;
      }
      h += '</div>';
      if (p.designation) h += `<button class="small" data-act="designate" data-prov="${p.id}" style="margin-top:6px">Return to ordinary administration</button>`;
    }
    return h + '</div>';
  },

  regionsHtml(c, g) {
    const regions = separatistRegions(g, c);
    let h = `<div class="card"><h3>Regions and separatism</h3>`;
    h += `<p class="small muted">Conquered land not yet integrated, and the states of a federation, can grow separatist movements. Above 55% support and 65 radicalism, a region may break away.</p>`;
    if (!regions.length) h += '<p class="small muted">No separatist regions.</p>';
    for (const r of regions) {
      const s = (c.separatists || {})[r.key];
      if (!s) continue;
      const pop = r.provs.reduce((a, p) => a + p.pop, 0);
      h += `<div class="person"><div class="pinfo"><b>${esc(regionName(g, c, r))}</b> <span class="small muted">${r.provs.length} province${r.provs.length > 1 ? 's' : ''} · ${fmtPop(pop)}${r.provs.every(p => p.designation === 'autonomous') ? ' · autonomous' : ''}</span>
        ${bar('Support for independence', s.support, { invert: true })}${bar('Radicalism', s.radicalism, { invert: true })}</div>
        <div class="pact">${Object.entries(SEPARATISM_ACTIONS).map(([a, A]) => `<button class="small" data-act="separatism" data-key="${r.key}" data-a="${a}" ${c.pc < A.pc || (a === 'referendum' && r.core == null) ? 'disabled' : ''} title="${esc(A.desc)} (${A.pc} PC)">${A.name}</button>`).join('')}</div></div>`;
    }
    const fa = c.federal ? 'centralize' : 'federalize';
    const FA = FEDERAL_ACTIONS[fa];
    h += `<h4>${c.federal ? 'Federation' : 'Unitary state'}</h4><p class="small muted">${FA.desc}</p>
      <button class="small" data-act="federal" data-a="${fa}" ${c.pc < FA.pc || (fa === 'federalize' && c.provinceCount < 6) ? 'disabled' : ''}>${FA.name} (${FA.pc} PC)</button>`;
    return h + '</div>';
  },

  coalitionHtml(c, g) {
    const C = c.coalition;
    if (!C || GOVS[c.gov].elections !== 'free') return '';
    if (C.minority) return `<div class="card"><h3>Minority government</h3><p class="small">${esc(rulingPartyObj(c).name)} governs without a majority. Political capital comes 25% slower, and the government can lose a confidence vote at any time.</p></div>`;
    let h = `<div class="card"><h3>Coalition government</h3><p class="small muted">Partners hold cabinet posts and expect their demands met. Below 20 satisfaction they may walk out; if we lose our majority, the government falls and snap elections follow.</p>`;
    for (const pt of C.partners) {
      const party = c.parties.find(p => p.id === pt.id);
      if (!party) continue;
      const met = demandMet(c, pt.demand);
      h += `<div class="person"><div class="pinfo"><div><span class="swatch" style="background:${party.color};width:10px;height:10px"></span> <b>${esc(party.name)}</b> <span class="small muted">· ${CABINET_POSTS[pt.post].name}</span></div>
        <div class="small">Demand: <span class="${met ? 'good' : 'warn'}">${esc(coalitionDemandText(pt.demand))}${met ? ' ✓' : ''}</span></div>${bar('Satisfaction', pt.satisfaction)}</div>
        <div class="pact"><button class="small" data-act="coalition" data-p="${pt.id}" data-a="meet" ${met || c.pc < 5 ? 'disabled' : ''}>Meet demand (5 PC)</button><button class="small" data-act="coalition" data-p="${pt.id}" data-a="concede" ${c.pc < 12 ? 'disabled' : ''}>Concessions (12 PC)</button></div></div>`;
    }
    return h + '</div>';
  },

  viewWorld(c, g) {
    const keys = {
      name: x => x.name, gov: x => x.gov, pop: x => -x.pop, gdp: x => -x.gdp, str: x => -strength(x), stab: x => -x.stability,
    };
    const k = keys[this.worldSort];
    const rows = g.countries.filter(x => x.alive).sort((a, b) => { const va = k(a), vb = k(b); return va < vb ? -1 : va > vb ? 1 : 0; });
    let h = `<p class="small muted">${rows.length} nations remain · ${g.wars.length} wars raging · ${g.stats.regimeChanges} regime changes so far.</p>
      <table class="list"><tr><th data-act="sort" data-k="name">Nation</th><th data-act="sort" data-k="gov">Gov</th><th data-act="sort" data-k="pop">Pop</th><th data-act="sort" data-k="gdp">GDP</th><th data-act="sort" data-k="str">Mil.</th><th data-act="sort" data-k="stab">Stab.</th></tr>`;
    for (const x of rows) {
      h += `<tr class="click${x.id === c.id ? ' me' : ''}" data-act="select" data-id="${x.id}"><td>${swatch(x)} ${esc(x.name)}${isAtWar(g, x.id) ? ' ⚔' : ''}</td><td>${govBadge(x.gov)}</td><td>${fmtPop(x.pop)}</td><td>${fmtMoney(x.gdp)}</td><td>${strength(x).toFixed(0)}</td><td style="color:${statColor(x.stability)}">${Math.round(x.stability)}</td></tr>`;
    }
    h += '</table>';
    const fallen = g.countries.filter(x => !x.alive);
    if (fallen.length) h += `<h4>Fallen nations</h4><p class="small muted">${fallen.map(x => esc(x.name)).join(', ')}</p>`;
    const counts = {};
    for (const x of rows) counts[x.gov] = (counts[x.gov] || 0) + 1;
    h += `<h4>Systems of the world</h4>${GOV_ORDER.filter(k2 => counts[k2]).map(k2 => `<div class="kv"><span>${govBadge(k2)} ${GOVS[k2].name}</span><span>${counts[k2]}</span></div>`).join('')}`;
    h += this.worldHistoryHtml(c, g);
    return h;
  },

  // The front page of the month (newspaper.js): the most important news, at home and abroad.
  paperHtml(c, g) {
    const months = paperMonths(g);
    if (!months.length) return '';
    const i = clamp(this.paperIdx || 0, 0, months.length - 1);
    const P = frontPage(g, c.id, months[i], l => App.newsVisible(l));
    if (!P.lead) return '';
    const tag = s => (s.home || s.m !== P.month) ? `<span class="paper-tag">${[s.home ? 'At home' : '', s.m !== P.month ? gameDate(g, s.m) : ''].filter(Boolean).join(' · ')}</span>` : '';
    const fmt = ([n, v, u]) => `<div class="kv"><span>${n}</span><span>${u ? (Math.round(v * 10) / 10).toFixed(1) + u : Math.round(v)}</span></div>`;
    return `<div class="card paper">
      <div class="paper-mast"><button class="small" data-act="paper" data-d="1" ${i >= months.length - 1 ? 'disabled' : ''} title="An earlier edition">◀</button>
        <div><div class="paper-title">${esc(P.title)}</div><div class="paper-date">${gameDate(g, P.month)}${i === 0 ? ' · latest edition' : ''}</div></div>
        <button class="small" data-act="paper" data-d="-1" ${i === 0 ? 'disabled' : ''} title="A later edition">▶</button></div>
      <div class="paper-lead ${P.lead.kind}">${tag(P.lead)}<h2>${esc(P.lead.head)}</h2>${P.lead.deck ? `<p>${esc(P.lead.deck)}</p>` : ''}</div>
      <div class="paper-body"><div class="paper-stories">${P.stories.map(s => `<div class="paper-story ${s.kind}">${tag(s)}<h4>${esc(s.head)}</h4>${s.deck ? `<p>${esc(s.deck)}</p>` : ''}</div>`).join('')}</div>
        ${P.numbers.length ? `<div class="paper-numbers"><h4>${esc(c.name)} this month</h4><div class="grid2">${P.numbers.map(fmt).join('')}</div></div>` : ''}</div>
      <p class="small muted">The month's most important news, chosen by what it is, who it involves and how big they are. Each edition covers the last three months. ${P.count > P.stories.length + 1 ? `${P.count - P.stories.length - 1} more items below.` : ''}</p></div>`;
  },

  viewNews(c, g) {
    let items = g.log.filter(l => App.newsVisible(l)).reverse();
    if (this.newsMine) items = items.filter(l => l.ids.includes(c.id));
    let h = this.paperHtml(c, g) + `<label class="small"><input type="checkbox" data-act="newsmine" ${this.newsMine ? 'checked' : ''}> Only news about ${esc(c.name)}</label><ul class="news">`;
    for (const l of items.slice(0, 200)) h += `<li class="${l.kind}${l.ids.includes(c.id) ? ' mine' : ''}"><span class="d">${gameDate(g, l.m)}</span>${esc(l.text)}</li>`;
    return h + '</ul>';
  },

  viewChoose() {
    const g = App.game;
    let h = '<h3>Choose your nation</h3><p class="small muted">Click a nation on the map (or in the list) to inspect it. Small, unstable nations are a harder start.</p>';
    const t = this.selected != null ? g.countries[this.selected] : null;
    if (t) {
      const gv = GOVS[t.gov];
      h += `<div class="card">${this.nationHeader(t)}<p class="small">${gv.desc}</p>
        ${bar('Stability', t.stability)}${bar('Approval', t.approval)}
        <div class="grid2" style="margin-top:6px">
          <div class="kv"><span>Population</span><span>${fmtPop(t.pop)}</span></div>
          <div class="kv"><span>GDP</span><span>${fmtMoney(t.gdp)}</span></div>
          <div class="kv"><span>Provinces</span><span>${t.provinceCount}</span></div>
          <div class="kv"><span>Neighbors</span><span>${getNeighbors(g, t.id).length}</span></div>
        </div>
        <p class="small">The public is ${ideologyText(t.ideo)}.</p>
        <button class="primary" data-act="lead" data-id="${t.id}" style="width:100%;padding:10px">Lead the ${esc(formalName(t))}</button></div>`;
    }
    h += '<table class="list"><tr><th>Nation</th><th>Gov</th><th>Pop</th><th>GDP</th><th>Stab.</th></tr>';
    for (const x of g.countries.filter(x => x.alive).sort((a, b) => b.gdp - a.gdp)) {
      h += `<tr class="click${t && x.id === t.id ? ' me' : ''}" data-act="select" data-id="${x.id}"><td>${swatch(x)} ${esc(x.name)}</td><td>${govBadge(x.gov)}</td><td>${fmtPop(x.pop)}</td><td>${fmtMoney(x.gdp)}</td><td style="color:${statColor(x.stability)}">${Math.round(x.stability)}</td></tr>`;
    }
    h += '</table><div style="display:flex;gap:6px;margin-top:12px"><button data-act="regen">Generate a different world</button><button data-act="random">Random nation</button></div>';
    return h;
  },

  movementsHtml(c) {
    const M = ensureMovements(c);
    const active = MOVEMENT_KEYS.filter(k => M[k].support >= 2).sort((a, b) => M[b].support - M[a].support);
    let h = `<div class="card"><h3>Political movements</h3><p class="small muted">Movements are the radical wings of the interest groups (the agrarian league speaks for peasants). They grow out of the pops when a class has a grievance, make a demand, and radicalize while it goes unmet or while their interest group is angry. A large movement is led by its group's leader, and a radical wing drags the group's loyalty down. Radical mass movements fuel unrest and can try to seize power.</p>`;
    if (c.currents) h += `<div class="small" style="margin:-4px 0 8px"><span class="muted">Ideas from abroad:</span> ${CURRENT_KEYS.map(k => `${CURRENTS[k].name} <b>${Math.round(c.currents[k] * 100)}</b>`).join(' · ')}<br><span class="muted">They spread from prosperous, stable neighbors, trade partners and allies, and surge after a revolution next door; each strengthens its movement.</span></div>`;
    if (!active.length) return h + '<p class="small muted">No significant movements.</p></div>';
    for (const k of active) {
      const def = MOVEMENTS[k], m = M[k], met = def.demand.met(c);
      h += `<div class="person">${m.leader ? `<div class="pp">${portraitSVG(m.leader, { size: 48, gov: c.gov })}</div>` : `<div class="pp empty" style="width:48px;height:58px">${def.icon}</div>`}<div class="pinfo">
        <div><b>${def.icon} ${def.name}</b> <span class="small muted">${pct(m.support / 100)} of the population${def.gov ? ' · wants a ' + GOVS[def.gov].name : ''}</span></div>
        <div class="small">${m.leader ? 'Led by ' + esc(m.leader.name) + ' · ' : ''}Demand: <span class="${met ? 'good' : 'warn'}">${esc(demandText(c, k))}${met ? ' ✓' : ''}</span></div>
        ${bar('Radicalism', m.radicalism, { invert: true, tip: 'Above 72, a movement with over 22% support may rise up.' })}</div>
        <div class="pact">${Object.entries(MOVEMENT_ACTIONS).map(([a, A]) => `<button class="small" data-act="move" data-k="${k}" data-a="${a}" ${c.pc < A.pc || (a === 'enact' && met) || (a === 'coopt' && !m.leader) ? 'disabled' : ''} title="${A.pc} PC">${A.name}</button>`).join('')}</div></div>`;
    }
    return h + '</div>';
  },

  figureRow(c, f, own) {
    const K = FIGURE_KINDS[f.kind], last = f.works[f.works.length - 1];
    const what = f.kind === 'inventor' ? `${f.field} · ${f.lab > 0 ? '<span class="good">laboratory funded</span> · ' : ''}+${Math.round(((c.research && c.research.current && TECHS[c.research.current].cat === f.field ? 0.3 : 0.06) * f.renown) * (f.lab > 0 ? 1.5 : 1))}% research`
      : f.kind === 'thinker' ? `School: ${CURRENTS[f.field].name}` : last && last.theme ? `${THEMES[last.theme].name} writing` : 'Writer';
    const status = f.exile != null ? `<span class="warn">in exile in ${esc(App.game.countries[f.exile].name)}</span>` : f.banned ? '<span class="bad">banned</span>' : f.patron > App.game.month ? '<span class="good">state patronage</span>' : '';
    const acts = own && f.exile == null ? Object.entries(FIGURE_ACTIONS).filter(([k]) => !(k === 'ban' && (f.kind === 'inventor' || f.banned))).map(([k, A]) => { const why = costOk(c, A) || (k === 'ban' && pressStrength(c) === 1 ? 'Not possible with a free press.' : ''); return `<button class="small" data-act="figure" data-a="${k}" data-id="${f.id}" title="${esc(A.desc)}${why ? ' — ' + esc(why) : ''}" ${why ? 'disabled' : ''}>${A.name} (${A.pc} PC)</button>`; }).join('') : '';
    return `<div class="person"><div class="pp">${portraitSVG(f, { size: 48, gov: c.gov })}</div><div class="pinfo">
      <div class="ptitle">${K.icon} ${K.name}${own ? '' : ` · ${esc(c.name)}`}</div><div><b>${esc(f.name)}</b>, ${f.age} ${status}</div>
      <div class="small">${what} · talent ${f.talent} · ${ideologyText(f.ideo)}</div>
      ${last ? `<div class="small muted">Latest: <i>${f.kind === 'inventor' ? esc(last.title) : '“' + esc(last.title) + '”'}</i> (${gameDate(App.game, last.m).split(' ')[1]})</div>` : ''}
      ${bar('Renown', f.renown, { color: 'var(--gold)', tip: 'How widely their work is read or used. Renown grows with each work and fades slowly; famous writers and thinkers are translated abroad.' })}</div>
      ${acts ? `<div class="pact">${acts}</div>` : ''}</div>`;
  },

  figuresHtml(c, g) {
    const F = (c.figures || []).slice().sort((a, b) => b.renown - a.renown);
    let h = `<div class="card"><h3>Notable people</h3><p class="small muted">Writers come from a literate public, thinkers and inventors from the universities. A writer's books move public opinion, and their themes follow the times: defeat breeds grievance or anti-war novels, slumps breed social novels, censorship breeds dissidents. Thinkers found schools of thought that travel abroad and give movements a doctrine. Inventors speed research in their field.</p>`;
    if (!F.length) return h + '<p class="small muted">No one of note yet. Literacy, secondary schools and universities produce them.</p></div>';
    for (const f of F) h += this.figureRow(c, f, true);
    return h + '</div>';
  },

  woundHtml(c, g) {
    const W = c.wound, rev = c.revanchism || 0;
    if ((!W || W.since < 0) && rev < 0.02) return '';
    const victors = W ? W.by.map(id => g.countries[id]).filter(x => x && x.alive) : [];
    const dem = demagogueOf(c);
    let h = `<div class="card"><h3>The memory of defeat</h3>
      ${bar('Revanchism', rev * 100, { invert: true, why: 'revanchism', tip: 'The grievance of defeat: lost provinces, harsh terms, reparations and the war dead. It feeds the nationalist movement and fascist ideas, and makes revenge thinkable.' })}`;
    if (W && W.myth > 0.05) h += bar('The stab-in-the-back myth', W.myth * 100, { invert: true, tip: 'The belief that the army was never beaten but betrayed at home. It turns the officers against a civilian government and drains its legitimacy.' });
    h += `<p class="small">${W && W.since >= 0 ? `Last defeat: ${gameDate(g, W.since)}${victors.length ? `, by ${victors.map(x => esc(x.name)).join(', ')}` : ''}. ` : ''}${W && W.armyIntact ? 'Our army came home undefeated in the field, and many believe it was betrayed. ' : ''}${dem ? `<b>${esc(dem.name)}</b> ${dem === c.leader ? 'rules the nation on the promise of revenge.' : 'leads the nationalists, a demagogue who promises revenge.'}` : ''}</p>
      <p class="small muted">Revanchism fades as the generation that lived through the defeat passes on, faster in good times and when relations with the victors warm; it festers in hard times. Anti-war writers soften it, nationalist writers and agitators sharpen it.</p></div>`;
    return h;
  },

  worldHistoryHtml(c, g) {
    let h = `<h4>Great powers</h4><p class="small muted">The strongest quarter of the world by army and economy. When three of them are drawn into one war, it becomes a world war.</p>`;
    h += greatPowers(g).map(id => { const x = g.countries[id]; return `<div class="kv click" data-act="select" data-id="${id}"><span>${swatch(x)} ${esc(x.name)}${id === c.id ? ' <span class="muted">(us)</span>' : ''}</span><span>${govBadge(x.gov)} ${strength(x).toFixed(0)}</span></div>`; }).join('');
    const WW = g.worldWars || [];
    if (WW.length) {
      h += '<h4>World wars</h4>';
      for (const r of WW) {
        const names = ids => ids.map(id => esc(g.countries[id].name)).join(', ');
        const out = r.end == null ? '<span class="bad">raging</span>' : r.outcome === 'stalemate' ? 'ended in an armistice' : `won by ${names(r.victors || [])}${r.treaty ? ` · ${esc(r.treaty)}` : ''}`;
        h += `<div class="card small"><b>The ${esc(r.name)}</b> <span class="muted">${gameDate(g, r.start).split(' ')[1]}–${r.end != null ? gameDate(g, r.end).split(' ')[1] : ''}</span><br>Began as the ${esc(r.origin)} · ${out}<br><span class="muted">${names(r.a)} against ${names(r.b)}</span></div>`;
      }
    }
    const top = figuresOfTheAge(g, 8);
    if (top.length) {
      h += '<h4>Figures of the age</h4><div class="card">';
      for (const { f, c: x } of top) {
        if (f.role === 'figure') h += this.figureRow(x, f, x.id === c.id);
        else h += `<div class="person"><div class="pp">${portraitSVG(f, { size: 48, gov: x.gov })}</div><div class="pinfo"><div class="ptitle">⚔ General · ${esc(x.name)}</div><div><b>${esc(f.name)}</b>, ${f.age}</div><div class="small">Battles won ${f.won || 0} · lost ${f.lost || 0}</div><div>${this.traitChips(f)}</div>${bar('Renown', f.renown, { color: 'var(--gold)' })}</div></div>`;
      }
      h += '</div>';
    }
    if ((g.hall || []).length) h += `<h4>Remembered</h4><table class="list"><tr><th>Name</th><th>Nation</th><th>Known for</th></tr>${g.hall.slice(0, 12).map(e => `<tr><td>${FIGURE_KINDS[e.kind] ? FIGURE_KINDS[e.kind].icon : ''} ${esc(e.name)} <span class="muted small">${e.born}–${e.died}</span></td><td>${esc(e.nation)}</td><td class="small"><i>${esc(e.work)}</i></td></tr>`).join('')}</table>`;
    return h;
  },

  viewResearch(c, g) {
    const R = ensureResearch(c);
    const rate = researchRate(c);
    const cur = R.current ? TECHS[R.current] : null;
    let h = `<div class="card"><h3>Research</h3>
      ${cur ? `<div class="kv"><span>Researching <b>${cur.name}</b></span><span>${Math.floor(R.progress)} / ${cur.cost}</span></div>${bar('', R.progress / cur.cost * 100, { text: `~${Math.ceil((cur.cost - R.progress) / rate)} months`, color: 'var(--accent2)' })}`
        : '<div class="alert warn">No research project selected. Pick one below; our scientists are idle.</div>'}
      <p class="small muted">${rate.toFixed(1)} research points per month, from education spending, literacy (${pct(c.econ.literacy)}), the size of the economy${inventorBonus(c) > 0.005 ? ` and our inventors (+${pct(inventorBonus(c))}, see the Leader tab)` : ''}. Switching projects loses half the progress. ${R.done.length} of ${TECH_KEYS.length} technologies discovered.</p></div>`;
    for (const cat of TECH_CATS) {
      h += `<div class="card"><h3>${cat}</h3>`;
      for (const id of TECH_KEYS.filter(k => TECHS[k].cat === cat)) {
        const T = TECHS[id], done = R.done.includes(id), avail = techAvailable(c, id);
        const reqs = T.req.filter(r => !R.done.includes(r)).map(r => TECHS[r].name);
        h += `<div class="tech ${done ? 'done' : avail ? 'avail' : 'locked'}${R.current === id ? ' cur' : ''}"><div><b>${done ? '✓ ' : ''}${T.name}</b> <span class="small muted">${T.cost} pts</span><div class="small">${T.desc}</div>
          ${reqs.length ? `<div class="small muted">Requires ${reqs.join(', ')}</div>` : ''}</div>
          ${avail ? `<button class="small ${R.current === id ? 'active' : ''}" data-act="research" data-id="${id}" ${R.current === id ? 'disabled' : ''}>${R.current === id ? 'In progress' : 'Research'}</button>` : ''}</div>`;
      }
      h += '</div>';
    }
    return h;
  },
});
