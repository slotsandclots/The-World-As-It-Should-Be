'use strict';
// Government types, factions, party templates and leader traits.
//
// Every government sits on a political compass: econ (-1 left .. +1 right)
// and auth (-1 libertarian .. +1 authoritarian). The population has its own
// position; the further apart the two are, the more unrest builds up.
//
// base = the factions whose loyalty props the regime up (its power base).
// approvalWeight = how much stability depends on public approval vs. the power base.

const BASE_POLICY = { tax: 0.25, military: 2.5, welfare: 8, education: 4, police: 1.5, infrastructure: 3, investment: 1, tariff: 0.1 };

const GOVS = {
  democracy: {
    id: 'democracy', name: 'Liberal Democracy', short: 'Democracy', color: '#4c8dff',
    econ: 0, auth: -0.6, elections: 'free', term: 48, party: 'multi',
    freedom: 85, growth: 0.0004, milMult: 0.9, repression: 0.5, corruption: 15, legitimacy: 62,
    pcGain: 1.0, approvalWeight: 0.8, aggression: 0.03, clergyBonus: 0,
    base: { intelligentsia: 1, business: 0.8, workers: 0.8 },
    title: 'President',
    formal: n => `Republic of ${n}`,
    policy: { tax: 0.3, welfare: 11, police: 1, tariff: 0.05 },
    desc: 'Power flows from free and fair elections. Citizens enjoy broad liberties, but leaders must win votes every four years and answer to public opinion.',
    pros: ['High freedom and legitimacy', 'Strong long-term growth', 'Stability rests on approval'],
    cons: ['Must win elections', 'Wars of aggression are unpopular', 'Little political capital'],
  },
  constMonarchy: {
    id: 'constMonarchy', name: 'Constitutional Monarchy', short: 'Const. Monarchy', color: '#9b7bff',
    econ: 0.1, auth: -0.3, elections: 'free', term: 48, party: 'multi',
    freedom: 75, growth: 0.0003, milMult: 1.0, repression: 0.6, corruption: 20, legitimacy: 68,
    pcGain: 1.15, approvalWeight: 0.7, aggression: 0.05, clergyBonus: 8,
    base: { business: 1, clergy: 0.7, intelligentsia: 0.7 },
    title: 'Prime Minister',
    formal: n => `Kingdom of ${n}`,
    policy: { tax: 0.28, welfare: 9 },
    desc: 'A crowned head of state reigns while an elected parliament governs. The monarchy lends continuity and legitimacy; the prime minister must still face voters.',
    pros: ['Very high legitimacy', 'Free elections with a stabilizing crown', 'Good growth'],
    cons: ['Must win elections', 'Clergy and business expect deference'],
  },
  absMonarchy: {
    id: 'absMonarchy', name: 'Absolute Monarchy', short: 'Abs. Monarchy', color: '#e0a526',
    econ: 0.4, auth: 0.7, elections: null, party: 'single', partyName: 'the Royal Court',
    freedom: 30, growth: -0.0002, milMult: 1.05, repression: 1.0, corruption: 40, legitimacy: 62,
    pcGain: 1.5, approvalWeight: 0.3, aggression: 0.18, clergyBonus: 15,
    base: { clergy: 1, military: 0.9, business: 0.6 },
    title: 'King',
    formal: (n, size) => size >= 18 ? `Empire of ${n}` : size <= 6 ? `Grand Duchy of ${n}` : `Realm of ${n}`,
    policy: { tax: 0.2, welfare: 3, police: 2.5, military: 3.5, education: 2, tariff: 0.2 },
    desc: 'The monarch rules by hereditary right with no parliament to answer to. Succession passes through the royal house, for better or worse.',
    pros: ['Hereditary legitimacy', 'No elections to lose', 'Plenty of political capital'],
    cons: ['Low freedom and growth', 'Each succession is a gamble', 'Liberal publics resent it'],
  },
  junta: {
    id: 'junta', name: 'Military Junta', short: 'Junta', color: '#8a9a4a',
    econ: 0.3, auth: 0.85, elections: null, party: 'single', partyName: 'the Supreme Military Council',
    freedom: 18, growth: -0.0005, milMult: 1.3, repression: 1.3, corruption: 50, legitimacy: 35,
    pcGain: 1.8, approvalWeight: 0.2, aggression: 0.3, clergyBonus: 0,
    base: { military: 1 },
    title: 'General',
    formal: n => `State of ${n}`,
    policy: { military: 6, police: 3.5, tax: 0.22, welfare: 4, investment: 1.5, tariff: 0.15 },
    desc: 'The generals have seized power "temporarily". The regime lives and dies by the loyalty of the officer corps.',
    pros: ['Strong army', 'Heavy repression keeps unrest down', 'Lots of political capital'],
    cons: ['Very low legitimacy', 'Corruption and weak growth', 'Disloyal officers mean another coup'],
  },
  communist: {
    id: 'communist', name: 'Communist State', short: 'Communist', color: '#d64040',
    econ: -0.9, auth: 0.7, elections: 'sham', term: 60, party: 'single', partyName: 'the Communist Party',
    freedom: 18, growth: -0.0001, milMult: 1.15, repression: 1.3, corruption: 35, legitimacy: 48,
    pcGain: 1.7, approvalWeight: 0.35, aggression: 0.2, clergyBonus: -25,
    base: { workers: 1, military: 0.6 },
    title: 'Chairman',
    formal: n => `People's Republic of ${n}`,
    policy: { tax: 0.45, welfare: 14, police: 3.5, military: 4, investment: 7, tariff: 0.3 },
    desc: 'A single vanguard party directs a planned economy in the name of the working class. Elections are held, but there is only one name on the ballot.',
    pros: ['Workers loyal if welfare is high', 'Sham elections boost legitimacy', 'Strong state apparatus'],
    cons: ['Business and clergy hostile', 'Low freedom', 'Planned economy grows slowly'],
  },
  fascist: {
    id: 'fascist', name: 'Fascist State', short: 'Fascist', color: '#7a5a42',
    econ: 0.5, auth: 0.95, elections: null, party: 'single', partyName: 'the National Unity Movement',
    freedom: 8, growth: 0.0001, milMult: 1.4, repression: 1.5, corruption: 45, legitimacy: 45,
    pcGain: 2.0, approvalWeight: 0.4, aggression: 0.5, clergyBonus: 5,
    base: { military: 1, business: 0.7 },
    title: 'Supreme Leader',
    formal: n => `${n} National State`,
    policy: { tax: 0.3, military: 7, police: 4.5, welfare: 5, investment: 3, tariff: 0.3 },
    desc: 'An ultranationalist movement fuses party, state and military under one leader, and the nation is mobilized for struggle and expansion.',
    pros: ['Strongest military bonus', 'Wars rally the public', 'Maximum political capital'],
    cons: ['Almost no freedom', 'Intelligentsia and workers alienated', 'Neighbors grow hostile'],
  },
  theocracy: {
    id: 'theocracy', name: 'Theocracy', short: 'Theocracy', color: '#2fb39a',
    econ: 0.2, auth: 0.75, elections: null, party: 'single', partyName: 'the Council of the Faithful',
    freedom: 22, growth: -0.0004, milMult: 1.0, repression: 1.2, corruption: 35, legitimacy: 58,
    pcGain: 1.6, approvalWeight: 0.35, aggression: 0.2, clergyBonus: 35,
    base: { clergy: 1, workers: 0.3 },
    title: 'Grand Cleric',
    formal: n => `Holy State of ${n}`,
    policy: { police: 3, education: 2.5, welfare: 6 },
    desc: 'Religious authorities rule according to sacred law. Faith is the source of legitimacy, and the clergy are the guardians of the state.',
    pros: ['Devoted clergy', 'Solid legitimacy', 'Religious publics are content'],
    cons: ['Intelligentsia oppressed', 'Slow growth', 'Secular publics resent it'],
  },
};

const GOV_ORDER = ['democracy', 'constMonarchy', 'absMonarchy', 'junta', 'communist', 'fascist', 'theocracy'];
const GOV_START_WEIGHTS = { democracy: 3, constMonarchy: 2, absMonarchy: 2, junta: 1.5, communist: 1.5, fascist: 1, theocracy: 1 };

const FACTIONS = {
  military: { name: 'Military', icon: '⚔', desc: 'Generals and officers. Want a large budget, discipline and victories.' },
  workers: { name: 'Workers', icon: '⚒', desc: 'Labor unions and the working class. Want welfare, jobs and fair taxes.' },
  business: { name: 'Business', icon: '⚖', desc: 'Industrialists and financiers. Want low taxes, infrastructure and growth.' },
  clergy: { name: 'Clergy', icon: '☩', desc: 'Religious institutions. Want tradition, order and influence over the state.' },
  intelligentsia: { name: 'Intelligentsia', icon: '✎', desc: 'Academics, students and journalists. Want freedom and education.' },
};
const FACTION_KEYS = Object.keys(FACTIONS);

const PARTY_TEMPLATES = [
  { key: 'soc', name: "Workers' Party", econ: -0.85, auth: 0.25, color: '#c62828' },
  { key: 'socdem', name: 'Social Democratic Party', econ: -0.45, auth: -0.3, color: '#ef6c6c' },
  { key: 'green', name: 'Green Alliance', econ: -0.35, auth: -0.7, color: '#43a047' },
  { key: 'lib', name: 'Liberal Party', econ: 0.35, auth: -0.6, color: '#f5c518' },
  { key: 'centre', name: 'Centre Party', econ: 0.05, auth: -0.1, color: '#90a4ae' },
  { key: 'cons', name: 'Conservative Union', econ: 0.55, auth: 0.25, color: '#1e88e5' },
  { key: 'agr', name: 'Agrarian League', econ: 0.1, auth: 0.3, color: '#a1887f' },
  { key: 'rel', name: 'Faith and Family Party', econ: 0.3, auth: 0.6, color: '#7e57c2' },
  { key: 'nat', name: 'National Front', econ: 0.6, auth: 0.85, color: '#546e7a' },
  { key: 'roy', name: 'Royalist Party', econ: 0.4, auth: 0.65, color: '#ffb300' },
];

const TRAITS = {
  charismatic: { name: 'Charismatic', desc: '+5 approval', approval: 5 },
  cunning: { name: 'Cunning', desc: '+0.5 political capital per month', pc: 0.5 },
  militarist: { name: 'Militarist', desc: '+10 military loyalty', military: 10 },
  reformer: { name: 'Reformer', desc: '+10 intelligentsia loyalty', intelligentsia: 10 },
  pious: { name: 'Pious', desc: '+10 clergy loyalty', clergy: 10 },
  populist: { name: 'Populist', desc: '+8 worker loyalty, +2 approval', workers: 8, approval: 2 },
  technocrat: { name: 'Technocrat', desc: '+0.5% annual growth, +5 business loyalty', growth: 0.0004, business: 5 },
  corrupt: { name: 'Corrupt', desc: '+8 corruption', corruption: 8 },
  paranoid: { name: 'Paranoid', desc: '+5 stability, -8 intelligentsia loyalty', stability: 5, intelligentsia: -8 },
  incompetent: { name: 'Incompetent', desc: '-0.6% annual growth, -3 approval', growth: -0.0005, approval: -3 },
};

function defaultPolicy(govId) {
  return Object.assign({}, BASE_POLICY, GOVS[govId].policy || {});
}
