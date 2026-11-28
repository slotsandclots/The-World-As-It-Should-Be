'use strict';
// Exposure to crises (ROADMAP, "Playing tall": seeing it). How exposed a nation
// is to each kind of crisis, read from the real numbers the simulation already
// keeps: bank capital, reserves, state debt and trust, firms' debts, import
// dependence, and neighbours in turmoil. Not a new meter: it changes nothing,
// it only shows the player where the storms can get in, and what lowers each risk.
//
// Each line: { key, name, level (0 low · 1 moderate · 2 high), value (the number
// behind it), why (what drives it), fix (what a prudent government does) }.

function crisisExposure(game, c) {
  const E = c.econ;
  if (!E) return [];
  const out = [];
  const add = (key, name, level, value, why, fix) => out.push({ key, name, level, value, why, fix });
  const lvl = (v, mid, high) => (v >= high ? 2 : v >= mid ? 1 : 0);
  const G = Math.max(0.01, c.gdp);

  // Banks: capital against loans, how much firms owe, and whether deposits are insured.
  if (E.credit != null && typeof CREDIT !== 'undefined') {
    const cap = E.bankCap / Math.max(1, E.credit);
    const thin = clamp((CREDIT.CAP_TARGET - cap) / (CREDIT.CAP_TARGET - CREDIT.CAP_MIN), 0, 1);
    const law = c.laws && c.laws.banking;
    const v = E.bankCrisis > 0 ? 1 : thin * (law === 'unregulated' ? 1 : 0.7);
    add('banks', 'Banking crisis', E.bankCrisis > 0 ? 2 : lvl(v, 0.45, 0.8), cap,
      E.bankCrisis > 0 ? 'The banks are in crisis now.' : `Bank capital is ${(cap * 100).toFixed(1)}% of loans (a crisis comes below ${(CREDIT.CAP_MIN * 100).toFixed(0)}%)${law === 'unregulated' ? '; deposits are not insured' : ''}.`,
      'Regulated banking (smaller booms, insured deposits); cool credit booms with higher interest rates.');
  }
  // Firms' debts: when debt service outruns profits, bankruptcies follow.
  if (E.dsr != null) {
    add('firms', 'Bankruptcy wave', lvl(E.dsr, 0.3, 0.4), E.dsr,
      `Firms pay ${Math.round(E.dsr * 100)}% of their profits in debt service (bankruptcies start above 40%).`,
      'Let a credit boom cool before it peaks; a central bank leans against booms.');
  }
  // The currency: reserves against the target, foreign debt, and a gold parity.
  if (E.reserves != null && typeof reserveTarget === 'function') {
    const res = E.reserves / G, gold = typeof onGold === 'function' && onGold(c);
    const ext = typeof extDebtOf === 'function' ? extDebtOf(c) / G : 0;
    const short = Math.max(0, (reserveTarget(c) - E.reserves) / G);
    const v = E.attack || E.fxCrisis > 0 ? 1 : clamp(short * 8 + ext * 1.5 + (gold && res < 0 ? 0.3 : 0), 0, 1);
    const level = E.attack || E.fxCrisis > 0 ? 2 : lvl(v, 0.35, 0.7);
    add('currency', gold ? 'Run on the gold parity' : 'Currency crisis', level, res,
      `${E.attack ? 'Speculators are attacking the parity now. ' : E.fxCrisis > 0 ? 'The currency is in crisis now. ' : ''}Reserves are ${(res * 100).toFixed(1)}% of GDP${short > 0 && level > 0 ? ', below the safe level' : ''}; foreign debt ${(ext * 100).toFixed(0)}% of GDP${gold ? `; on gold, speculators attack below ${(-PAY.ATTACK_AT * 100).toFixed(0)}% of GDP` : ''}.`,
      'Run a trade surplus, borrow little abroad, and keep reserves of a few months of imports.');
  }
  // State debt: how much, and how far lenders trust it.
  if (c.debt) {
    const debt = Math.max(0, -c.treasury) / Math.max(1e-6, c.gdpNom || c.gdp), T = c.debt.trust == null ? 1 : c.debt.trust;
    const v = c.debt.crisis > 0 ? 1 : clamp(debt / 1.2 + (1 - T) * 0.8, 0, 1);
    add('debt', 'State debt crisis', c.debt.crisis > 0 ? 2 : lvl(v, 0.4, 0.7), debt,
      c.debt.crisis > 0 ? 'Lenders are refusing the state credit now.' : `State debt is ${Math.round(debt * 100)}% of GDP, and lenders' trust is ${Math.round(T * 100)}%.`,
      'Balance the budget in good years, keep inflation down, and stay out of long wars.');
  }
  // Imports: the share of what the nation uses that it must buy abroad.
  if (E.imports && E.D) {
    let im = 0, dm = 0;
    for (const g of GOOD_KEYS) { im += (E.imports[g] || 0) * (game.worldMarket.prices[g] || 1); dm += (E.D[g] || 0) * (game.worldMarket.prices[g] || 1); }
    const dep = dm > 0 ? im / dm : 0;
    add('imports', 'Shortages from imports', (E.importSqueeze || 0) > 0.05 ? 2 : lvl(dep, 0.12, 0.25), dep,
      `${(E.importSqueeze || 0) > 0.05 ? `Imports are being cut by ${Math.round(E.importSqueeze * 100)}% now. ` : ''}${Math.round(dep * 100)}% of what we use is bought abroad.`,
      'Trade with many partners, keep reserves to pay for imports, and build industries for what we lack.');
  }
  // Neighbours: turmoil and war next door spill over (ideas, refugees, wars that widen).
  if (typeof getNeighbors === 'function') {
    const ns = getNeighbors(game, c.id).map(id => game.countries[id]).filter(o => o && o.alive);
    const bad = ns.filter(o => o.stability < CRISIS_LEVEL || (typeof isAtWar === 'function' && isAtWar(game, o.id)));
    const share = ns.length ? bad.length / ns.length : 0;
    add('neighbours', 'Trouble next door', lvl(share, 0.25, 0.5), share,
      ns.length ? (bad.length ? `${bad.length} of ${ns.length} neighbours are at war or near collapse: ${bad.slice(0, 3).map(o => o.name).join(', ')}${bad.length > 3 ? '…' : ''}.` : `All ${ns.length} neighbours are at peace and stable.`) : 'We have no neighbours by land.',
      'Alliances and good relations; a strong army deters wars that would spread.');
  }
  return out;
}
