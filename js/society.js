'use strict';
// Milestone 3b: cities, housing and demographics.
//
// Housing is a stock in each province, measured in people it can house. When
// the urban population outgrows it, rents rise: that money moves from
// tenants (laborers, workers, clerks, officials) to landlords and owners, so
// overcrowding lowers city dwellers' living standards and raises owners'.
// Past full occupancy, people crowd into slums, which feed unrest. Builders
// add housing when rents pay, spending real construction money (steel,
// timber, laborers); generous welfare states build public housing too.
//
// Demographics follow the demographic transition: birth rates fall as living
// standards and literacy rise, death rates fall as basic needs are met, and
// societies age as they develop.
//
// p.housing people housed · p.rentExcess extra share of urban incomes paid as rent · p.slum share of city dwellers in slums

const URBAN = ['laborers', 'workers', 'clerks', 'officials', 'capitalists', 'clergy'];
const TENANTS = { laborers: 1, workers: 1, clerks: 0.8, officials: 0.6 };

function urbanPop(p) { let u = 0; for (const t of URBAN) u += (p.pops && p.pops[t]) || 0; return u; }

function tickSociety(game) {
  const provs = game.world.provinces;
  for (const c of game.countries) {
    c._slum = 0; c._urban = 0; c._rentBurden = 0; c._dev = 0;
    const E = c.econ;
    if (E) E.housingBudget = ownersAllowed(c) ? (E.privateSavings || 0) * 0.25 : (E.statePool || 0) * 0.02;
  }
  for (const p of provs) {
    if (p.owner < 0 || !p.pops) continue;
    const c = game.countries[p.owner], E = c.econ;
    const U = urbanPop(p);
    if (p.housing == null) p.housing = U * 1.08 + 1;
    p.housing = Math.max(1, p.housing * 0.9994); // wear and tear
    const o = U / p.housing;
    p.occupancy = o;
    p.rentExcess = clamp(0.2 * (o - 1) + 0.12 * Math.max(0, o - 1.15), 0, 0.3);
    p.slum = o > 1 ? 1 - 1 / o : 0;
    // Builders: private when rents pay, public when welfare is generous.
    let units = 0;
    if (o > 0.96) units += U * 0.0035 * clamp((o - 0.96) * 6, 0, 2) * clamp(E.conf || 1, 0.3, 1.5) * (E.bankCrisis > 0 ? 0.3 : 1);
    if (c.policy.welfare > 11 && o > 0.9) units += U * 0.0008 * (c.policy.welfare - 10) / 10;
    if (units > 0) {
      const unitCost = (E.gdpRealM || E.gdpM) / Math.max(1, c.pop) * 4;
      const pool = ownersAllowed(c) ? 'investPool' : 'statePool';
      const afford = Math.min(units, Math.min(E.housingBudget || 0, E[pool] || 0) / Math.max(1e-9, unitCost));
      if (afford > 0) {
        E[pool] -= afford * unitCost;
        E.housingBudget -= afford * unitCost;
        E.housingSpend = (E.housingSpend || 0) + afford * unitCost;
        p.housing += afford;
      }
    }
    c._slum += p.slum * U; c._urban += U; c._rentBurden += p.rentExcess * U;
    c._dev += developmentOf(p) * p.pop;
  }
  for (const c of game.countries) {
    if (c.pop > 0) { c._dev /= c.pop; c.urbanShare = c._urban / c.pop; c.slumShare = c._slum / c.pop; c.rentBurden = c._urban > 0 ? c._rentBurden / c._urban : 0; }
    // Societies age as they develop.
    c.elderly = (c.elderly == null ? 0.06 : c.elderly) + ((0.05 + 0.13 * (c._dev || 0)) - (c.elderly == null ? 0.06 : c.elderly)) / 240;
    if (game.month % 12 === 0 && c.alive) c.cities = topCities(game, c);
  }
}

// How far along the demographic transition a province is (0..1).
function developmentOf(p) { return clamp((provinceSol(p) - 30) / 45 + (p.lit || 0) * 0.5 - 0.2, 0, 1); }

// Monthly natural growth for a class in a province: births minus deaths.
function naturalGrowth(p, fb) {
  const dev = developmentOf(p);
  const birth = 0.00235 * (1 - 0.5 * dev);
  const death = 0.0017 - 0.0006 * fb - 0.0002 * dev;
  return { birth, death, net: birth - death };
}

function topCities(game, c) {
  return game.world.provinces.filter(p => p.owner === c.id && p.pops).map(p => ({ id: p.id, name: p.name, size: urbanPop(p) }))
    .sort((a, b) => b.size - a.size).slice(0, 6);
}

// Rent is paid by tenants and received by owners (economy.js calls these).
function rentPaid(p, t, net) { return TENANTS[t] && p.rentExcess ? Math.max(0, net) * p.rentExcess * TENANTS[t] : 0; }
