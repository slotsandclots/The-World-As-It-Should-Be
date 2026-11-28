# Roadmap

Where the game is going. Sizes are rough: **S** = a session, **M** = a few, **L** = a major milestone.

**Priorities** (see the design philosophy below for how we build):
1. The economic and social simulation comes first.
2. Politics is just as central.
3. The military strategy layer is developed after those.

The order at the end of this file follows these priorities, with the economic foundation (money and credit) laid before the social layer that depends on it.

## Design philosophy

These rules apply to every milestone. A feature that breaks them should be redesigned before it's built.

1. **Emergence over scripting.** Stories should come out of the simulation, not out of events written in advance. That needs four ingredients:
   - *things that build up* (debt, money, grievances, clout, experience)
   - *delays* (construction, sticky wages, expectations, integration)
   - *tipping points* (defaults, bank runs, coups, secession, encirclement)
   - *coupling* between classes, politics and nations

   Every feature should add at least one of them.
2. **Real causes, not bonuses.** No "+5 approval" shortcuts. Every new quantity either *is* a pop or goods quantity (people, prices, wages, savings, jobs, goods, services) or changes one directly. Approval, stability and politics move because pops' living standards, jobs and beliefs change, through the existing pop → ideology → interest groups → politics chain.
3. **Everything goes through pops and goods.** Housing, healthcare and schooling are goods or services with workers and costs. Discrimination changes who gets which jobs. Armies are drawn from pops and fed by goods. War production competes for steel and workers.
4. **Fewer, clearer meters.** Each meter has one job: *legitimacy* (the right to rule), *support* (interest-group approval weighted by clout), *unrest* (pressure in the streets), and *stability* (derived from those three). New systems feed one of these instead of adding a parallel meter, and new features extend existing systems (separatism, movements, interest groups) instead of duplicating them.
5. **Emergent must also be interesting.** Avoid a dead steady state, constant noise and runaway collapse. Every layer is measured with balance runs across many seeds before the next layer goes on top, against stated targets (for example, business cycles every 7–10 years).
6. **The AI plays the same game.** Every system is used by AI nations as it is built (crises, laws, referendums, mobilization already work this way). AI mistakes should come from their politics, not from random noise.
7. **You have to be able to see why.** Every important number has a breakdown, every system has a chart or a map mode, and the news explains what happened. A crash the player can't explain feels random, not emergent.
8. **Build one layer at a time:** build, measure, play-test, then move on.

## How the systems connect

New features should plug into these quantities rather than add their own meters (philosophy rules 2–4). Before building something, check which rows it reads and which it changes; a feature that touches none of them doesn't mesh.

| System | Fed by | Feeds |
|---|---|---|
| **Pops** (classes per province: size, income, savings, literacy, culture, faith) | Jobs and wages, prices, welfare and health spending, schooling, housing, migration | Living standards → approval and contentment; class mix → public opinion; interest-group clout; movements; notable people; votes |
| **Goods and markets** (`economy.js`) | Buildings and their inputs, pops' needs, state purchases, world and bloc trade | Prices, profits and wages; shortages; arms for the army |
| **Money and credit** (`money.js`, `credit.js`) | Money growth, printing, bank lending, confidence | Price level and inflation, interest rates, construction, defaults, banking crises, unemployment |
| **State budget and debt** (`fiscal.js`) | Taxes on pop incomes, tariffs, state enterprises; lenders (savers, banks, foreign nations) | State spending into the economy, crowding out, interest to bondholders, debt crises |
| **Payments** (`payments.js`, draft) | Trade balances, reparations, owners' capital looking abroad, the monetary law (gold or floating), prices at home and abroad | Reserves, foreign debts and lenders, exchange rates, import prices and rationing; gold flows into the money supply; speculative attacks (capital flight, interest-rate premiums) and exits from gold that change the monetary law |
| **Trade flows** (`tradeflows.js`, accounting only) | Each month's bloc and world trade | Who trades with whom: the Trade map mode, trading partners per good, trade dependence between nations; read next by spheres of influence |
| **Society and peoples** (`society.js`, `peoples.js`) | Pops, laws (citizenship, immigration), wars and occupation | Housing and slums, births and aging, grievance, migration, nationalist claims |
| **Ideas and notable people** (`ideas.js`, `figures.js`) | Neighbors, trade and bloc ties, revolutions, the press, literacy and universities | Idea currents → public opinion and movements; research |
| **Politics** (interest groups, movements, laws, parties, characters) | Pops' living standards and beliefs, demands met or not, leaders | The four meters (legitimacy, support, unrest, stability) → elections, coups, revolutions, reforms |
| **Diplomacy, blocs and subjects** | Ideological distance, claims, kinship, trade, infamy, leaders' skills | Alliances, pacts, markets, tribute, wars of aggression and independence |
| **War** (`warfare.js`, `revanchism.js`, `worldwar.js`) | Army size (military spending, population), arms, technology, generals, alliances | Occupation, peace terms (land, reparations, regime change), the memory of defeat → movements and AI aims; mobilization and war production; war weariness |
| **Technology** (`tech.js`) | Education, literacy, universities, inventors | Productivity, army strength, tax collection, corruption |

**Known gaps where systems don't mesh yet:** wars are financed only by printing and borrowing (no war bonds); the war dead are not taken out of the pops; tariffs cut trade both ways; great-power status is a fixed ranking; government types still differ mostly by flat numbers (see "Governments that play differently"); foreign holdings of state bonds (fiscal.js) move capital but not reserves, so a state can borrow abroad and pay foreign bondholders without touching its balance of payments; AI bloc leaders invite nations without a member vote.

## Done

- World generation: seven procedural models, Earth, and Earth with historical regions
- Seven government types, factions, public opinion, elections, coups and revolutions
- Pops, goods, buildings, national markets and world trade
- Characters: leaders, cabinets, generals, opposition, heirs
- Political movements, technology, peace terms
- Event engine with chains and story flags
- Tutorial campaign "The First Republic"
- Map zoom and pan, test suites, CI
- Checks on runaway conquest (infamy, coalitions, occupation, core land, arms races) and four difficulty levels
- **Milestone 1:** subjects and empires, releases, blocs (pacts, free-trade zones, customs unions, confederations), province designations, separatism, federations, parliamentary coalitions. Still open from it: joint war goals for ordinary wars (world wars now end at a joint peace conference), and bloc councils voting on shared policy.
- **History makers (first pass):** notable people (writers, thinkers, inventors, famous generals), the memory of defeat (revanchism, the stab-in-the-back myth, demagogues, disarmament treaties), and world wars that grow out of ordinary wars and end at a peace conference. See the section below.

---

## Next: foundations (M)

Before the next big milestone:

- ✅ **Consolidation (second pass):**
  - **Movements are the radical wings of interest groups.** Labor goes with the workers, liberal with the intelligentsia, nationalist with the military, clerical with the clergy, monarchist with business. Growing movements are led by their group's leader, an angry group radicalizes its wing, and a radical wing drags the group's loyalty down.
  - **Support is now a visible meter** (public approval, power-base loyalty and clout-weighted interest groups), and the stability breakdown is grouped under the four meters.
  - **Still to do:** a peasant interest group (the agrarian league has none yet), and retiring separate meters that only feed one of the four (for example coalition satisfaction, which could become support from partner parties).
- ✅ **Balance report:** `npm run report` (and `--compare tools/baseline.json`) runs AI-only worlds and summarizes regime changes, wars, crises, elections, laws, growth, recessions, prices, living standards, inequality, unemployment and stability. Philosophy rule 5 depends on it.
- ✅ **Economy baseline and noise fix:** measured, then calmed (see Milestone 4).
- **Performance (deferred):** a month takes 14–36 ms today, so the UI doesn't stutter yet. Moving the simulation into a Web Worker means the interface can no longer read game state directly, a large refactor that pays off once weekly war turns (Milestone 5) or credit cycles (4b) make months more expensive. Revisit then; the balance report tracks ms/month.
- ✅ **Campaign:** chapter VIII, "The Constitution", teaches laws, bills and referendums, interest groups and their radical wings, and war on the map.
- **Play-test:** a real play session by a human. This is the one Foundations item only you can do.

## Milestone 1: Empires, blocs and coalitions (L) ✓

Done, except war coalitions with joint war goals and peace, and confederation councils voting on shared policy. Turns the map from a set of independent states into a web of hierarchies and blocs.

### 1a. Subjects, annexation and releases
- **Overlord–subject relations:** puppet, vassal, protectorate and colony, each with its own autonomy, obligations (tribute, troops, following the overlord's foreign policy) and liberty desire.
- **Ways to gain subjects:** peace terms ("become our subject"), diplomatic offers to weak or threatened nations, and releasing land as a subject.
- **Liberty desire** rises with heavy tribute, cultural or ideological distance and an overlord's weakness, and falls with protection, shared government and investment. High liberty desire leads to independence demands, liberation movements and wars of independence. Rivals can back them.
- **Annexation as a choice:** gradually integrate a loyal subject (costs political capital and time; unrest in the absorbed land), outright annexation (fast, angry), and peaceful union by treaty or referendum.
- **Releasing nations:** release conquered or rebellious land as a new nation, independent or as a subject. The game generates its government, characters and parties. Dead nations can be restored.
- **Empire:** an overlord with subjects gets imperial titles and the "Empire" name, plus imperial prestige. A metropole/periphery split shows how much land is core and how much colonial.

### 1b. Blocs: alliances, trade zones and confederations
- **Multi-member organizations:** each has a name, a founder or leader, a charter, membership votes and a headquarters.
- **Military alliances:** collective defense with a mutual-defense clause, optionally offensive.
- **Customs unions and free-trade zones:** internal free trade (no tariffs, more trade openness), plus a common external tariff in customs unions. These plug into the existing market code; free trade within a bloc means a partial shared market.
- **Confederations:** a loose league with a council that votes on shared defense, trade and admitting members. Can deepen into a federation.
- **Bloc politics:** the leader sets direction; members can leave, be expelled or be sanctioned; blocs compete.
- **Economic agreements:** investment treaties, resource deals and development aid, alongside the existing trade agreements.
- ✅ **Every founding partner decides (fix of a known gap):** all founding paths (the player, AI pacts and trade zones, revisionist axes, alliances against a rival) now go through one function, `proposeBloc` (`blocs.js`). The partner weighs the offer with the same appeal a joining nation uses (relations, ideological distance, threat, the market on offer, giving up tariff policy), plus the founder's case: a shared grievance and regime for an axis, distrust of the common rival for an alliance against it. A refusal costs the founder a little goodwill (−3 relations). The Blocs tab shows each candidate's chance to accept a founding offer or an invitation (or that the members would vote it down).
  - **Measured** (24 worlds × 40 years against main): growth, calm-year falling GDP, inflation, stability, crisis share, unemployment, regime changes and world wars are within noise. Wars per world fell from 5.9 to 4.8 and revenge wars from 1.4 to 0.7 (about 1 and 1.8 standard errors), since fewer axes form when partners can say no. Watch that revisionist alignments still happen often enough to make world wars.
  - **Still open:** the victors' alliance after a peace conference still signs up the winning great powers as part of the treaty, without their own decision. The AI never offers the player a founding partnership.

### 1c. Federations and internal structure
- **Federation:** unify willing nations, or federalize your own state. Federal states have member regions with autonomy, local leaders and their own grievances.
- **Province designations:**
  - **special economic zones:** lower taxes, foreign investment, faster construction, but inequality and resentment elsewhere
  - **autonomous regions:** calm separatists at the cost of central control
  - **colonies:** extraction now, revolt later
  - **capital district**
- **Separatist movements:** a new movement type, growing in neglected or culturally distinct regions. Peaceful resolutions include autonomy, federalization and independence referendums.

### 1d. Parliamentary coalitions
- **Hung parliaments:** with no majority, parties negotiate. Partners demand cabinet posts (plugging into the cabinet system) and policy concessions, with confidence-and-supply as an alternative.
- **Coalition stability:** coalitions can split over policy, leading to votes of no confidence and early elections.
- **War coalitions:** joint war goals and joint peace deals among allies.
- **Teaching it:** new campaign chapters or tutorial steps for subjects, blocs and coalitions.

---

## Milestone 2: Laws and interest groups (L)

The biggest multiplier for political depth. Governments become combinations of laws instead of fixed types.

**Done (first pass):** nine law categories (head of state, suffrage, press, assembly, church and state, labor, economic system, policing, conscription) with each regime's traditional preset; bills that take months, need parliamentary seats or the power base, can stall or be voted down, and can be decreed in autocracies; interest groups with clout drawn from the pops and a law each one demands; petitions; hybrid regime names ("Guided Democracy", "Confessional Constitutional Monarchy"). Also done: interest-group leaders (moderate or radical, with portraits and traits; meet, co-opt or discredit them; radicals lead angry groups into the streets) and constitutional crises (term limits, impeachment, disputed successions, a state of exception that can end the republic). Also done: AI nations go through the same crises and choose by weighing their situation (an ambitious leader with a loyal army amends the constitution; a legitimate one steps aside); elections are counted province by province from each region's classes, with a new electoral-system law (proportional or winner-takes-all constituencies) and an Elections map mode; referendums decided by the public's views and the press; press barons who sway opinion, back parties, and can be courted, bought out or censored. Still to do: media in elections beyond party coverage, regional campaign spending.

- **Law categories:** head of state, legislature, suffrage, elections, press freedom, assembly, church and state, labor rights, economic system (laissez-faire, interventionist, planned), land ownership, citizenship, policing, conscription and term limits.
- **Government names follow the laws:** the current seven types become presets, and hybrids appear naturally (an elected monarchy, a one-party technocracy, a guided democracy).
- **Passing laws:** a law has to get through the legislature (or the power base, in autocracies). Each attempt takes months, can stall, and can provoke a backlash.
- **Interest groups:** the current factions grow into political actors drawn from the pops. Each has a leader character, approval, demands and clout.
- **Political arena:** media and press barons, polling broken down by class and region, regional constituencies so elections are fought province by province, referendums, and lobbying by interest groups with money.
- **Ideologies inside interest groups:** for example, a reformist or a reactionary clergy, and a moderate or radical labor wing. They shift as the pops underneath them change.
- **Constitutional crises:** term limits, failed impeachments, succession disputes and states of exception, each with its own event chain.

## Consolidation and war on the map (done, first pass)

- **Interest groups rest on their pops:** loyalty now also follows the living standard of their own classes (soldiers, clergy, workers, the middle and upper classes) and falls while their demanded law is unmet. Stability counts interest-group support weighted by clout, not an equal average.
- **Regimes inherit institutions:** coups and reforms keep the church, economic system, labor and electoral laws; only revolutions remake everything.
- **War on the map:** provinces are occupied during a war and change hands only at the peace (or a capitulation). Battles are fought sector by sector along the front: terrain favors the defender, half-surrounded provinces fall more easily, land reached only by sea is poorly supplied. War score comes from occupation. Postures (offensive, balanced, defensive) and general mobilization (bigger army, less industrial output, faster exhaustion) are the player's levers; AI nations choose both. Occupation is drawn on the map in the occupier's colors.
- **Still to do:** movements folded into radicalized interest groups, fewer meters overall, armies as units you can move, war goals from nationalism, AI long-term ambitions, a balance report across many seeds.

## Milestone 3: Society, peoples and culture (L)

Built on top of 4a–4b, so it can use wages, savings and debt. Every item states its mechanism.

**3a. Peoples ✅ (first pass):**
- **Cultures and faiths on every province:** a culture per nation, plus a handful of regional faiths. Border regions are mixed, and there are scattered communities further away.
- **New laws:**
  - *Citizenship* (equal / restricted / persecution) decides whether minorities can hold clerk and official jobs and vote. Exclusion lowers output and removes them from the electorate (fewer seats in regional elections).
  - *Immigration* (open / limited / closed).
- **The church law** now decides how religious minorities fare.
- **Assimilation and conversion** drift the mix, faster with literacy and under coercion.
- **Grievance** (exclusion plus a state faith not their own, worse when poor) feeds unrest (a new line in the breakdown) and separatism.
- **Migration:** every quarter people move toward better-off provinces, flee occupation, and emigrate to richer neighbors whose borders are open. They carry their culture and faith, building diasporas.
- **Nationalism:** provinces abroad where our people are a large share become claims. Claims sour relations and make AI governments far more willing to go to war "to bring our people home".
- **Interface:** Culture and Religion map modes, peoples and faiths in the province panel, a Peoples card in the Pops tab, and claims in diplomacy.
- **Measured (6 worlds × 40 years):**
  - minorities: about 19% of people, assimilating slowly
  - about 11 provinces claimed by nationalists per world
  - nations with open or limited borders take in roughly 0.1–0.2% of their population a year
  - economic metrics unchanged

**3b. Cities, housing and demographics ✅ (first pass):**
- **Housing is a stock in every province.** When the urban population outgrows it, rents rise: laborers, workers, clerks and officials pay, and landlords and owners receive (the state, under communism).
- **Slums** come from overcrowding and feed unrest (a new line in the breakdown).
- **Builders add housing** when rents pay, out of a share of national savings. Welfare above 11% of GDP adds public housing. Housing construction is real construction, buying steel and timber and employing laborers.
- **Housing services count in real GDP,** as in national accounts.
- **The demographic transition:** births fall as living standards and literacy rise, death rates fall as basic needs are met, and societies age.
- **Interface:** a Cities and people card (city dwellers, slums, rent burden, births and deaths, the largest cities), housing in the province panel, and city markers on the map with names when zoomed in.
- **Measured:**
  - 24% of people live in cities and 2.6% in slums
  - world population grows 1.1% a year, births about 22 per 1,000
  - growth per person is about 11% below the pre-housing baseline, because housing now takes part of investment, as in real economies
  - living standards and inequality are essentially unchanged

**3c. Aging, inequality and minority movements ✅ (first pass):**
- **Retirees leave the workforce,** so an aging society has fewer hands.
- **Pensions are paid first** from the welfare budget (about three times the elderly share of the population), so as a society ages, the same welfare spending buys less relief for the poor.
- **The aging electorate** shifts each province toward pensions and order.
- **Income inequality** is measured as a Gini figure from class incomes. It strengthens the labor movement and appears in the Pops tab and the Ledger.
- **A Minority Rights League** grows from excluded, aggrieved minorities and demands equal citizenship. Its radicalism feeds separatism, and its riots feed unrest.
- **Social mobility through schooling already exists:** literate jobs (clerks, officials) can only be filled as fast as literacy allows.
- **Measured:**
  - Gini about 0.50, typical of a largely agrarian world
  - pensions about 28% of welfare by year 40
  - minority grievance down 25% as governments concede equal citizenship
  - economic and political metrics unchanged

**3d. Universities, kinship and ideas ✅ (first pass):**
- **Universities:** education spending above the basics builds higher education. Graduates speed research (up to about +100%), staff the state (officials need graduates) and give the intelligentsia clout.
- **Kinship:** cultures belong to families of related peoples.
  - Kin count toward nationalist claims at 0.3 weight, but only where some of our own people live.
  - Kin nations get on better.
  - Strong, like-minded kin neighbors can unite peacefully (about once every three worlds), and the player can propose unification to a smaller kin nation.
- **Ideas spreading through the world** (the priority from Beyond the milestones, first pass):
  - **The currents:** liberalism, socialism, fascism and traditionalism, in each nation.
  - **How they spread:** from neighbors, trade partners and bloc allies, weighted by how prosperous and stable those regimes are, and stronger with a free press.
  - **Revolution shocks:** a revolution sends a shock wave through its neighbors.
  - **Where they land:** currents strengthen the matching movement and pull public opinion.
- **Measured:**
  - the strongest current averages about 0.2
  - regime changes rose to about 16 per world, within the range earlier versions produced, but worth watching
  - claims are back to about 12 provinces per world
  - the economy is unchanged

**3e. Finishing touches ✅ (first pass):**
- **Secondary schooling** is its own level, between literacy and universities. Clerks (the literate middle class) can only be hired as fast as people finish secondary school, and officials as fast as universities produce graduates.
- **Minorities are an interest group:**
  - clout from the minority population
  - loyalty falls with grievance and poverty
  - citizenship and church laws matter to them
  - the Minority Rights League is their radical wing, led by their leader once it grows
- **Unification by force:** a decisive victory by a kin nation over a much smaller one ends with the loser annexed.
- **Measured:** the economy and stability are back on baseline after calibrating the schooling limit.

**Milestone 3 is complete (first pass).** Later passes: teachers as a separate profession, faith-based interest groups beyond minorities, emigrant remittances, and the age pyramid in the Pops tab.

## Milestone 4: Deeper economy (L)

**Goal:** inflation, booms, recessions and depressions that come out of the simulation (money, credit, confidence and wages) rather than from scripted events, and that feed straight into politics.

### Starting point: what the economy does today
The economy is already dynamic: goods prices move with supply and demand every month, buildings run or go idle on profitability, investors build where it pays, pop incomes and living standards follow what each class can afford, and markets trade nationally, in blocs and with the world. But it settles back to normal: after a shock it drifts back toward a stable state. Nothing accumulates (no private debt or credit), there is no money or price level (prices are relative to fixed bases and capped at 0.25–4× base, so economy-wide inflation is impossible), and there are few delays and no expectations. Milestone 4 adds the missing ingredients.

**Measured baseline** (`npm run report`, 6 worlds × 40 years, saved in `tools/baseline.json`):
- **Prices:** world prices are calm (coefficient of variation 0.055; max/min ratio 1.24) and unemployment is low (mean 1.1%, worst 8%).
- **GDP is noisy rather than cyclical:** GDP per person moves ±4.5 points a year (±4.0 even in peaceful years with no regime change), and falls in 41% of nation-years. Year-on-year growth has no memory beyond one year (autocorrelation ≈ 0), so there are no cycles to speak of.
- **Causes found and fixed:**
  - Buildings were capped each month by their scarcest input, so supply-chain shortages rippled month to month. Firms now hold input stocks, which halved building-output jitter.
  - Productivity responded instantly to the noisy stability meter and to the infrastructure slider. Both are now stocks that build up and fade.
- **Causes still open:**
  - swings in trade openness (about ±2.5 points a year)
  - AI spending changes counted directly in GDP

**Implication:** before 4b adds credit cycles, the real economy needs to be calm enough that a genuine boom or bust stands out from the noise. Target: GDP per person falling in fewer than 20% of peaceful years, with any cycles showing as positive autocorrelation over 1–3 years.

**Noise fixed (with 4a):**
- **Real GDP:** growth is now measured on real GDP at base prices, from annual totals the way statistics offices measure it, so price swings no longer look like output swings.
- **Budgets on a year's average:** government budgets are set on a 12-month average economy instead of last month's.
- **Higher trend growth:** underlying technology growth was raised to give about 1.5% a year per person, as fits the postwar era.
- **Results:**
  - calm years with falling GDP per person: 21% (was 41%)
  - growth persists year to year (autocorrelation about 0.3)
  - depressions: −77%
- **Side effects to watch:**
  - living standards end about 19% higher
  - stability is 6% higher
  - months in crisis halved

### Design rules (the game-wide philosophy, applied to the economy)
1. **Emergence comes from four ingredients:**
   - *accumulating quantities* (debt, money, confidence)
   - *delays* (construction time, sticky wages, lagging expectations)
   - *tipping points* (defaults, bank runs, broken pegs, hyperinflation)
   - *coupling* (across classes, politics and nations)

   Every feature in this milestone should add at least one of them.
2. **Real causes, not bonuses.** No "inflation: −5 approval". Every new quantity either *is* a pop or goods quantity (prices, wages, savings, jobs, orders) or changes one directly. Approval, stability and the political systems move only because pops' living standards and employment change, through the existing pop → ideology → politics chain.
3. **Everything goes through pops and goods:**
   - **Inflation is measured from what pops buy.** The price level is built from goods weighted by each class's consumption, so each class has its own inflation rate.
   - **Incomes lag prices.** Wages adjust slowly, so inflation pushes pops down the needs tiers (luxury, then everyday, then basic).
   - **Savings are money.** Pops' wealth is held in money: inflation erodes savers (clerks, officials), and deflation makes debtors' burdens heavier (peasants, landowners).
   - **Credit funds real buildings.** Capitalist and landowner pops and the state borrow to build, so a boom is a wave of real construction projects in real provinces.
   - **Busts close real buildings.** Plants whose profits fall below their debt payments go idle or bankrupt, their workers become unemployed pops, and the lending classes lose wealth.
   - **Interest is income.** It goes to the wealthy classes, so rate decisions shift who can afford luxury goods.
   - **Confidence decides expansion, hiring and orders.** Falling orders for steel, tools and construction goods drop their prices and lay off their producers, which is how a slump spreads from sector to sector.
   - **Sticky wages mean layoffs.** Each building keeps its pay and sheds jobs when revenue falls, so unemployment lands in specific classes and provinces and feeds unrest and movements there.
   - **The world economy works through the world market.** Import prices follow exchange rates, and foreign recessions show up as falling demand for your exports.
   - **War uses the same chain.** Arms production bids up steel and fuel, mobilization takes workers out of buildings, and the resulting inflation and shortages hit specific classes. No war-only modifiers.
4. **Emergent must also be interesting.** Avoid a dead steady state, constant noise and runaway collapse. Each layer is tuned with balance runs across many seeds before the next one is added. Targets: cycles every 7–10 years, depressions rare but possible, hyperinflation only under reckless policy.
5. **The AI plays the same economy.** AI central banks and governments respond plausibly (raise rates against inflation, stimulate in a slump) and make mistakes for political reasons: a populist government that won't raise rates before an election. Different nations should end up with different economic stories.
6. **You have to be able to see why.**
   - breakdowns for inflation (money growth, expectations, wages, imports)
   - a confidence index
   - a cycle marker
   - Ledger charts

   A crash the player can't explain feels random, not emergent.
7. **Build one layer at a time:** 4a, measure, then 4b, measure, and so on. Never all at once.

### 4a. Money, inflation and the central bank ✅ (first pass)

**Done:**
- **The basics:** a price level, money supply and inflation expectations per nation, plus real and nominal GDP.
- **Debt and the treasury are in currency,** so inflation erodes debt. Interest rates set by the monetary system feed debt interest and investment.
- **Wages and salaries lag prices:** they're sticky, with the lag set by the labor law, so inflation squeezes workers and fixed incomes and moves value to profits.
- **Savings** lose real value to inflation and earn interest.
- **Monetary-system law:** gold standard, independent central bank, or government-controlled money with a money-growth slider and an option to print money to cover deficits.
- **AI governments with control of the money supply print more** at war, in debt or under populists, and don't tighten before elections.
- **Visible to the player:** a Money and prices card, an inflation breakdown, a top-bar warning, and Ledger charts for inflation, interest rates and real wages.
- **Measured results:** central banks hold about 2%, the gold standard about 0.5% with deflation in growth years, and government money about 5% with occasional hyperinflation.

**Still open:** import prices and exchange rates (with 4d), and inflation broken down by class (each class's own basket).

- **A currency per nation:** a money supply and a price level. Today's goods prices become relative prices, multiplied by the national price level.
- **What drives inflation:** money growth beyond real output (especially printing to cover deficits), expectations (people who expect rising prices raise them now), import prices and the exchange rate, and a wage-price spiral when unions are strong and labor is scarce.
- **Debts in your own currency:** the treasury and national debt are in your currency, so inflation erodes debt. That's the temptation; printing to cover a war or a deficit can spiral into hyperinflation.
- **Monetary-system law:**
  - *gold standard*: stable prices and trade, but deflation in a slump and no stimulus
  - *independent central bank*: interest rates set by a rule
  - *government-controlled money*: you set rates and can print
- **Interest rates:** they drive investment, consumer credit, the exchange rate and what debt costs to service.

### 4b. Credit, confidence and the business cycle ✅ (first pass)

**Done:**
- **Credit:** private debt that pays for real construction projects, driven by confidence, the real interest rate and existing leverage.
- **Debt service** comes out of owners' profits. When it exceeds about 40%, firms default and real buildings close, least profitable first, so workers lose their jobs.
- **Banks:** defaults eat bank capital, and below 4% a banking crisis freezes lending for 18 months.
  - Under free banking, a bank run wipes out a fifth of savings.
  - With insured deposits, the treasury pays to recapitalize.
  - The player can bail out the banks to restart lending sooner, which angers workers and pleases business.
- **Confidence** rises with growth above trend and falls with defaults, crises and unrest.
- **Credit affects prices:** credit above trend adds to broad money (booms inflate), and credit contraction deflates.
- **Central banks lean against booms and slumps.**
- **New banking law:** free banking, regulated banks with insured deposits, or state banks.
- **Interface:** a credit card with the cycle phase, confidence, debt burden, bank capital and defaults; a confidence breakdown; a top-bar warning during a banking crisis; Ledger charts.
- **Measured (6 worlds × 40 years):**
  - growth unchanged at about 1.6% a year per person
  - calm years with falling output: 21%
  - depressions: 4.5 per world
  - banking crises: about 3 per world
  - worst unemployment: 18%
  - growth persists year to year (autocorrelation 0.38)

**Still open:**
- **No regular cycle yet:** growth carries over from year to year but doesn't swing back at 3–5 years (no negative autocorrelation), so these are booms and busts rather than a regular cycle. Stronger construction delays and inventory cycles in 4c should help.
- **The stock and land markets** now have their own phase, 4e.

- **Private credit:** businesses borrow to invest when rates are low and confidence is high, so private debt builds up through the boom.
- **Overshooting:** construction takes time, so new capacity opens after demand has peaked. Prices and profits fall just as the debts come due.
- **The bust:** defaults lead to a credit crunch, cancelled projects, layoffs and falling demand. High debt plus falling prices can turn a recession into a depression (debt deflation).
- **Business confidence:** a visible index, moved by profits, the news, the press barons and events, that drives investment and hiring.
- **Banking crises:** bank runs, deposit insurance (a law), lender of last resort, bailouts or nationalization.
- **Optional asset market:** a stock or land index with bubbles in the boom and crashes at the turn.

### 4c. Labor, unemployment and fiscal policy
- **Economic systems as mechanisms, not modifiers:** today the economic-system law mostly shifts growth and interest-group loyalty, and a democracy with a "planned economy" still has private owners investing.
  - *Laissez-faire:* private owners decide all investment; no state building; low tariffs.
  - *Interventionist:* the state directs part of investment and protects chosen industries.
  - *Planned:* tied to the law rather than to communism. No private owners; the state sets output targets and prices, and price controls cause real shortages and queues.
- **Different tools for different regimes:**
  - *Democracies:* campaigning, negotiating bills, managing the press.
  - *Autocracies:* purges, rigged elections, secret police operations, buying off generals.
  - *Monarchies:* marriages, the succession, the court.
- **Fewer flat base numbers per government:** growth, corruption, repression and similar bonuses should come from the mechanisms underneath wherever possible. This is step 1 of "Governments that play differently" below.
- ✅ **AI fiscal response to the cycle** (first pass): each AI government takes a stance from the output gap, its debt and its politics (the ruling party's in a democracy). In a slump, the left and anyone with room to borrow stimulate, raising infrastructure and welfare toward a temporary target. Orthodox governments in debt impose austerity. In a boom, prudent ones cool things down. AI governments also bail out their banks in a crisis, centrists most readily.
- **Labor relations:** unions as organizations with membership, strikes and collective bargaining. Minimum-wage laws change how buildings split value between wages and profits.
- ✅ **Sticky wages** (first pass): each building's wage bill follows a smoothed value added, rising within months but falling slowly, slowest under free unions. When demand drops, pay eats the margin; when it eats all of it, private owners lay workers off. A planned economy, or one without private owners, keeps its plants running instead (the first economic-system difference that works through a mechanism).
- ✅ **Automatic stabilizers** (first pass): unemployment insurance pays laid-off laborers, workers and clerks a share of their class's income. The share is set by the labor law and the welfare budget. It's funded by contributions equal to its long-run cost, so the fund runs a deficit in slumps and a surplus in booms. Shown in the Economy tab with the share of squeezed businesses.
  - *Measured* (16 worlds × 30 years against main): growth per person 1.42 → 1.35%/yr, worst unemployment 15 → 18%, inflation 1.9 → 3.0%, stability 48.5 → 47.6. Bankruptcy waves roughly double (21 → 44 per world), because squeezed profits can't service debts. Debt deflation is real, but it could be toned down in a later pass.
- **The fiscal multiplier:** government spending moves output much more in a slump than in a boom, so stimulus versus austerity is a real choice. Partly emergent now: state demand restarts idle, squeezed capacity in a slump, but only bids up prices in a boom. It still needs measuring, and showing to the player.

### Closed-loop economy (runs across 4c–4e)

The rule: no goods or money created from nothing. Every unit of money has a source and an owner, and every debt is someone's asset. This is how Victoria-style economies stay honest: when the numbers balance, the interesting things (crowding out, debt crises, contagion, inflation that robs savers) fall out on their own instead of being scripted.

**Audit (3 worlds × 20 years, before phase 1).** Where money or goods appeared from nothing or vanished:

| Leak | Size | Realistic if modeled? |
|---|---|---|
| State spending set from GDP, not paid from cash: the economy got the spending whatever the treasury held | ~27% of GDP | Yes. Fixed in phase 1: spending is cut to what can be funded |
| Deficits as a negative number with no lender | deficits ~4.3% of GDP; debt ~25% | Yes. Phase 1: savers, banks and foreign lenders hold it |
| Interest on state debt paid to nobody | ~1.5% of GDP | Yes. Phase 1: it's income for the holders |
| Money printing for deficits | ~0.5% of GDP | Already explicit (money.js). Now listed as a funding source |
| Bailouts | episodic | Already treasury to bank capital; now funded like any other spending |
| Output paid for but unsold (firms are paid for all their output at the clearing price, even goods nobody bought) | ~18% of GDP, ¾ of it peasants' subsistence grain | Partly. Subsistence is self-consumption, imputed like national accounts do; the rest should become inventories or price cuts. Later pass |
| Pop wealth capped at 24 months of income (savings above the cap vanish) | ~8% of people at the cap | No. Should flow to the investment pool or assets (4e) |
| Corruption: a share of taxes disappears | ~3.7% of GDP | Should become income for officials and the connected. Later pass |
| Idle investment capital leaking abroad (0.5% a month) | ~0.3% of GDP | Should become foreign lending and assets (phase 2) |
| World market: imports and exports by good, valued at world prices, never paid for | net 0, gross imbalances ~1.5% of GDP | Phase 2: every import is someone's export, paid in reserves, debt or currency |

**Phase 1 ✅ (first pass): the state's budget and debt.** New `js/fiscal.js`.
- **The state pays from cash.** A deficit is lent by:
  - domestic savers, out of the owners' investment pool, so it crowds out private investment (most in a boom, when firms want that money; little in a slump, when it sits idle)
  - banks, up to a share of their deposits; buying bonds creates deposits, so bank-funded deficits add to inflation
  - foreign lenders, out of other nations' investment pools, more readily from friendly nations
  - or the printing press, if the monetary law allows it
- **Bondholders are real:**
  - savers' interest is income for capitalists and landowners
  - banks' interest becomes bank capital
  - foreign interest goes to the lending nation's investment pool
  - inflation erodes them all, since bonds are nominal
- **Lenders can refuse.**
  - Trust falls with debt, a recent default, war, inflation and unpaid bills.
  - The yield rises as trust falls.
  - When lenders won't cover the deficit, the state runs up arrears (unpaid wages and suppliers are also creditors), and next month it can only spend what it can fund. That is a **sovereign debt crisis**.
- **Default** writes holdings down by half:
  - savers lose wealth and business is furious
  - banks lose capital, which can tip them into a banking crisis (the doom loop)
  - foreign lenders' relations sour
  - trust stays low for years
- **The AI plays under the same limits.**
  - It closes deficits beyond what lenders will fund (about 4% of GDP, 6% in a slump stimulus, less as trust falls) with taxes and cuts, sparing education and state investment.
  - In a crisis it imposes austerity.
  - It defaults when interest eats its revenue.
- **Interface:**
  - a State debt card in the Economy tab: debt, yield, lenders' trust with its causes, a bar of who holds the debt, and last month's funding by source
  - a default button in a crisis
  - alert-bar entries
  - budget lines showing interest paid to bondholders
- **Measured** (16 worlds × 30 years against main):

  | Measure | Main | Phase 1 |
  |---|---|---|
  | Growth per person (%/yr) | 1.35 | 1.34 |
  | Inflation (%/yr) | 3.0 | 3.7 |
  | Stability | 47.6 | 47.3 |
  | Share of nation-months in crisis | 0.063 | 0.068 |
  | Banking crises per world | 2.4 | 2.1 |
  | Depressions per world | 5.1 | 4.5 |

  New: about 9 sovereign debt crises and 0.9 defaults per world; state debt ends near 17% of GDP. Inflation is higher because bank-bought bonds create money.
- **Later in phase 1:**
  - bondholders as an interest-group demand: rentiers oppose default and inflation, and their clout grows with their holdings
  - war bonds
  - a central bank that buys bonds (quantitative easing) as a distinct tool
  - IMF-style bailouts with conditions, from blocs and great powers (lending as diplomatic leverage)

**Phase 2, layer 1 ✅ (first pass): payments, lending and exchange rates** (`js/payments.js`).
- **Reserves:** earned by exports, spent on imports (world trade balances, so they only move between nations); reparations are paid out of them.
- **Foreign lending:** the owners' capital that used to leak abroad (0.5% of the investment pool a month) is lent to nations short of reserves, from nations with reserves to spare, and funds investment there. Interest and repayment flow back to the lenders' owners; debts past 120% of GDP are defaulted on (halved), and no one lends to the defaulter for five years. When a borrower ceases to exist, its lenders lose what it owed. Every foreign debt is someone's asset.
- **Exchange rates:** a currency falls as reserves drain and rises as they pile up (0.3× to 1.6×). A weak currency makes the nation buy less abroad (world and bloc trade), a strong one more, though never more of a good than it lacks at home, raises import prices at home (half the fall passes through) and pays exporters more at home.
- **Rationing:** a nation in arrears (reserves below −10% of GDP, no one left to lend) must cut imports outright.
- **Interface:** a Balance of payments card in the Economy tab (reserves, trade, debts and lenders, interest, exchange rate, rationing) and alerts.
- **What we learned tuning it:**
  - the persistent deficits were in world trade, in goods a nation lacks (oil, timber, fiber, meat, clothes), so a currency floor forced hard rationing
  - letting a weak currency win export share took sales from every other nation's firms and multiplied bankruptcies (+40%), so the adjustment now runs through imports only
  - recycling surplus reserves as official loans piled up foreign debt and cut living standards, so it was left out
- **Measured** (48 worlds × 40 years each, against main; ± is the standard error):

  | Measure | Main | Phase 2 layer 1 |
  |---|---|---|
  | Regime changes per world | 15.1 ± 1.2 | 16.9 ± 1.3 |
  | Stability | 47.7 | 47.5 |
  | Share of nation-months in crisis | 0.065 | 0.068 |
  | Growth per person (%/yr) | 1.27 | 1.30 |
  | Depressions per world | 6.2 | 6.4 |
  | Living standard | 42.4 | 42.4 |
  | Bankruptcy waves per world | 122 | 112 |
  | Sovereign defaults per world | 3.3 | 2.1 |
  | Banking crises per world | 6.2 | 5.2 |

  New: about 5 balance-of-payments crises per world; imports rationed (by more than 10%) in 18% of nation-months, mostly resource-poor nations that now pay for their imports; foreign debt about 0.5% of GDP.
- **Review fixes** (re-measured on 24 worlds × 40 years; every measure within the noise of the first pass): a strong currency could import up to twice a nation's shortfall in open economies; a foreign default's mark on credit was erased the next month; debts of annexed nations stayed on their lenders' books forever.
- **Side effects to watch:** frequent rationing in import-dependent nations; no foreign default happened in the layer-1 worlds (new borrowing then stopped at 60% of GDP; 25% since layer 3); foreign lending is small because only 0.5% of private capital looks abroad each month.
- **Still to do in phase 2:** recycling surpluses without the debt pile-up (lending at market rates by banks), tariffs that cut imports without cutting exports (with 4d), currency crises and pegs, foreign ownership (with phase 3).

**Phase 2, layer 2 ✅ (first pass): pegs and currency crises** (`js/payments.js`, `js/money.js`).
- **The real exchange rate:** trade now responds to the currency's value times prices at home over prices abroad. A floating rate behaves as in layer 1; on a peg, only prices can move it.
- **The gold standard as a peg:** the currency is held at its parity (fixed when a nation goes on gold). Deficits are paid in gold, and the money supply follows the gold out, so prices fall and the real rate with them (price-specie flow).
- **Speculative attacks:** when a gold nation's reserves fall below −8% of GDP, speculators attack. Owners send 2% of their capital a month to the nation with the most reserves to spare (it moves, nothing is lost), interest rates carry a 4% premium, and owners abroad lend up to three times as much, but only as much more as the defenders need; defenders are served first. The attack is beaten off when reserves are back above −3% of GDP or have risen four months running; speculators then wait two years unless reserves hit a new low.
- **Leaving gold:** the AI holds on by its politics (monarchies and theocracies longest, democracies with unemployment and dictatorships shortest); the player decides with a button on the card. The monetary law changes (to a central bank where elections are free, state money otherwise), interest groups react, and the currency falls fast for six months. Going back on gold needs reserves to back the parity and ten years since the exit.
- **Currency crises (floating):** a currency down a fifth in a year (not a devaluation after leaving gold) scares foreign lenders away for six months while capital flees; not called again within three years.
- **Interface:** the card shows the regime, parity, real rate and gold flow, warns before an attack, and explains a run while it lasts; alerts and news for attacks, defences, exits and collapses.
- **What we learned tuning it:** on a peg, deflation barely closes a deficit in goods a nation lacks, and foreign lending is small (only 0.5% of capital looks abroad), so most gold nations with structural deficits are forced off within a few decades, as the interwar gold standard was. Beaten-off attacks needed a cooling-off period or they restarted every month.
- **Measured** (24 worlds × 40 years, against layer 1; z is the difference in standard errors): growth 1.31 → 1.26 (−0.8), inflation 3.8% → 4.3% (+1.5, more nations leave gold), stability 47.3 → 47.6, crisis share 0.070 → 0.069, unemployment 1.53% → 1.54%, regime changes 17.6 → 16.8, wars 5.8 → 5.6, sovereign defaults 1.9 → 3.0 (+1.2), debt crises 11.5 → 14.6 (+1.0), imports rationed in 19% → 21% of nation-months. New per world: 5.6 attacks on gold parities, 1.0 defended, 4.5 exits from gold, 0.3 currency crises.
- **Side effects to watch:** most gold nations leave gold within 40 years; slightly more inflation, sovereign defaults and debt crises (all within noise so far).
- **Still to do:** bank lending abroad at market rates (it would let pegs be defended and ease rationing), pegs to another nation's currency (with spheres of influence), the player choosing the parity on returning to gold.

**Phase 2, layer 3 ✅ (first pass): banks lend abroad at market rates** (`js/payments.js`).
- **Bank lending:** banks in nations with reserves to spare lend 1% of the surplus a month abroad, as far as their capital allows (none in a banking crisis; state banks half as much, unregulated banks more). Together with the owners' capital, it goes to nations short of reserves.
- **Market rates:** borrowers pay a base of 6% plus premiums for debt abroad (0.2 points per point of GDP), war and empty reserves, and borrow less when the rate is high. Borrowing stops at 25% of GDP (was 60%).
- **Paid down:** foreign loans are repaid over about ten years, out of reserves when there are any.
- **Contagion:** a foreign default costs the lending banks their share of the loss in capital, which can bring on a banking crisis at home (credit.js); news and a notice when it hits the player's banks.
- **Interface:** the card shows the rate we pay abroad with its parts, and our banks' loans abroad.
- **What we learned tuning it:** at 3% of surplus reserves a month and a 60% cap, structural deficits were rolled over until foreign debt reached 36% of GDP; banking crises doubled and sovereign defaults rose 2.6×. A third of the lending, a 25% cap and a steeper premium brought debt to 14% of GDP with every other measure in the noise.
- **Measured** (24 worlds × 40 years, against layer 2; z in standard errors): growth 1.26 → 1.28, stability 47.6 → 47.4, crisis share 0.069 → 0.066, banking crises 5.9 → 5.8, sovereign defaults 3.0 → 3.1, debt crises 14.6 → 16.0, living standard 42.1 → 42.0, rationing 21% → 22% of nation-months; foreign debt 1% → 14% of GDP. Gold: attacks 5.6 → 10.8 per world (more nations stay on gold to be attacked), defended 1.0 → 7.3, exits 4.5 → 3.4 (−2.1). Balance-of-payments crises 5.3 → 6.4 (+1.9).
- **Fixed on the way:** reparations and the treasury's share of foreign debt service moved the treasury after the budget was financed, so the state's debt briefly did not match what its holders owned. Both are now charged with the next month's budget.
- **Side effects to watch:** rationing did not ease (the deficits are in goods some nations cannot make, and lending only postpones paying for them); more balance-of-payments crises.
- **Still to do:** lending with conditions (bailouts by blocs and great powers), pegs to another nation's currency (with spheres of influence), foreign ownership (phase 3).
- **Review fixes (after layers 1–3 merged):** a nation defaults abroad at most once in five years (it used to default again every month while its debt stayed above 120% of GDP). A reborn nation starts its payments afresh. Leaving gold no longer cancels an unrelated bill. A currency crisis runs out on gold too. Gold flow counts capital flight, which leaves after the trade settlement. Hot money no longer triples lending to nations that are not under attack. The rules for going back on gold (reserves, ten years) now also hold when a bill passes late, when a bill is decreed, and when a new regime brings in gold with its laws. Bloc recruitment and invitations skip nations at war with a member. Measured (24 worlds × 40 years against main): growth 1.25 → 1.26, calm-year falling-GDP share 0.264 → 0.251, inflation 4.2 → 4.4, stability 47.3 → 47.2, crisis share 0.073 → 0.075, unemployment 1.59 → 1.59, regime changes 19.0 → 17.6, wars 5.5 → 5.2; gold attacks 11.8 → 8.8 and exits from gold 4.1 → 2.2 per world, because revolutions no longer put nations back on gold they cannot back.

**Phase 2 (folds into 4d): balanced trade.** Every import is someone's export. A trade deficit is paid with reserves, foreign borrowing or a falling currency. This is the base for contagion, exchange rates, capital flows and currency crises. The investment pool's leak abroad becomes real foreign lending and ownership.

**Phase 3 (folds into 4e): owning assets.** Shares, land and mortgages are held by specific pops and banks, so the wealth cap goes away (savings become assets), crashes destroy real wealth, and foreclosures move land between classes.

**Politics and gameplay that fall out of it:**
- Debt becomes a political issue: bondholders oppose default and inflation, debtors (farmers, the indebted state) want inflation.
- Lending is diplomatic leverage: a creditor nation can demand terms, refuse rollovers, or seize collateral.
- **A sources-and-uses panel in the Ledger:** where every unit of money comes from (taxes, borrowing by lender, printing) and where it goes (spending by category, interest by holder), plus who holds the debt over time. The Economy tab's debt card is the first piece of it.

### 4d. The world economy
- **Contagion:** a recession in a big economy cuts world-market demand, and its trading partners feel it.
- **Exchange rates and capital flows:** money moves toward high interest rates and strong currencies. Devaluation helps exports, makes imports pricier and adds inflation.
- **Sovereign debt and currency crises:** lenders stop lending, a currency peg breaks, and a forced devaluation or default follows. Bailouts come with conditions, a lever for blocs and empires.
- **Protectionism:** raising tariffs in a depression protects jobs at home and deepens the global slump.
- **The trade view** (in the style of Victoria 3):
  - **Step 1 ✅ (first pass): bilateral flows and the interface.**
    - `js/tradeflows.js` splits the pooled bloc and world markets into flows between nations each month: bloc partners first, then the world market, shared out by each exporter's share of world sales. Flows are valued at world prices and kept as a 12-month average.
    - It is accounting only. 24 worlds × 40 years come out identical to main in every measure but speed (about 2 ms more a month), and a test checks that the flows add up to each nation's exports and imports and that the economy is unchanged with them.
    - Interface: a Trade map mode (lines thick by value, filter by good, hover for what flows each way and how much each side depends on the other), trading partners per good in the Market tab, and trade with the selected nation in the Diplomacy tab.
  - **Step 2:** routes with distance and shipping costs, chokepoints and straits, blockades of specific routes (with Milestone 5's navies), and animated trade flows on the map, so trade follows routes rather than shares of world sales.
  - Spheres of influence can now read trade dependence from these flows.

### 4e. The stock market and the land market

The asset side of the cycle. Through pops and goods: asset prices change what the owning and middle classes are worth, which changes what they spend, save and invest.

- **A stock market in each nation:**
  - **The price:** an index set by expected profits divided by the real interest rate plus a risk premium.
  - **Investors extrapolate recent gains,** so booms inflate bubbles above fundamentals.
  - **Crashes:** when prices run far above what profits justify, a shock (a default wave, a banking crisis, a war, a bad election) can crash them.
  - **Who holds shares:** capitalists, clerks and officials. Their wealth rises and falls with the index, and so does their consumption (the wealth effect).
  - **Firms invest more when shares are dear** (cheap to raise equity) and less when they're cheap.
  - **Buying on credit:** margin lending ties the stock market to 4b's credit.
- **A land market in each province:**
  - **Farmland** is priced from farm rents.
  - **Urban land** is priced from housing rents (3b), so city booms raise land values.
  - **Mortgages:** credit for housing links land, housing construction and banks. A housing bubble can burst, leaving mortgages unpaid and banks hurt.
  - **Deflation forecloses on indebted farmers.** Landowners and peasants with debts lose land, which feeds the agrarian league and land-reform demands.
- **Policy and law:**
  - financial regulation (margin limits, mortgage rules)
  - capital-gains and land taxes
  - land reform (redistributing large estates, which hurts landowners and pleases peasants)
  - nationalizing or privatizing listed companies
- **The AI plays it too:**
  - Investors in every nation react to share prices: they put in more when shares are dear.
  - AI governments respond to crashes with stimulus, bailouts or austerity (with 4c), shaped by their politics.
- **Interface:** an index chart and land prices in the Ledger, a "market overheating" warning on the alert bar, and crash news in the newspaper.
- **Measured:** bubbles and crashes should be rare and visible: a major crash about once a generation per nation, and land booms that follow urbanization.

### Player toolkit
- interest rates (where the law allows)
- money printing
- stimulus or austerity
- bank bailouts or nationalization
- price controls (shortages and black markets) and wage controls
- capital controls
- tariffs
- devaluation, or leaving the gold standard

### Ties to politics
- **Who wins and loses:**
  - inflation hurts fixed incomes and savers (clerks, officials, pensioners) and helps debtors
  - deflation crushes farmers and anyone in debt
- **Interest groups take sides on money:** business and banking want sound money, workers want full employment, landowners want cheap credit.
- **Downturns hit governments:** recessions cost incumbents elections, and depressions feed radical movements, so a 1930s-style slump can produce fascism or communism on its own.
- **War is paid for by printing or borrowing,** and pays the bill in inflation afterwards.

### Seeing it
- **New Ledger charts:** inflation, real versus nominal GDP, unemployment, interest rates, private debt, business confidence, and a marker for where you are in the cycle.
- **Breakdowns:** inflation broken into its causes (money growth, expectations, wages, imports).
- **Balance runs across many seeds,** aiming for cycles every 7–10 years, depressions rare but possible, and hyperinflation only under reckless policy.

### Also in this milestone (from the earlier plan)
- **Company and ownership models:** private capitalists, state enterprises, cooperatives and foreign owners. The ownership mix shifts with laws, and nationalization and privatization become political decisions.
- **Production methods:** each building chooses how to work (labor-intensive or automated, coal or oil power), changing inputs, jobs and output. Technology unlocks new methods.
- **Government bonds** with a credit rating.
- **Foreign investment:** build in other nations' special economic zones, own foreign companies, form multinationals.
- **Infrastructure per province:** roads, rail and ports limit how much a province can trade and produce, replacing the single infrastructure slider. This also feeds military supply in Milestone 5.
- **Resource depletion and an energy sector:** an electricity good, with power plants that need fuel.
- **Sanctions, embargoes and trade routes:** shipping between markets, with chokepoints and straits.
- **Economic statistics:** GDP by sector and the trade balance.

**Order inside the milestone:** 4a, then 4b (most of the gain is in these two), then 4c, then 4d. The remaining items slot in as they become relevant.

## History makers: notable people, the memory of defeat, world wars ✅ (first pass)

Asked for by the player: the people who shape an age, a lost war that a demagogue turns into a grievance and a grievance into a world war, and world wars themselves. Everything goes through systems that already existed (pops, idea currents, movements, interest groups, research, alliances and blocs, the war on the map), so the story is not scripted: each link happens only when its causes are there.

**Notable people** (`js/figures.js`):
- **Where they come from:** writers from the literate public (more with secondary schools and a free press), thinkers and inventors from university graduates. Each has a talent, politics of their own drawn from the public around them, and a renown that grows with every work and fades slowly.
- **Writers** publish books whose theme follows the times: grievance after a defeat, national epics where our people live abroad, anti-war novels after heavy losses, social novels in a slump, dissident writing under censorship, faith, or modernism in good times. A book is an idea shock to its current and a nudge to public opinion at home; famous books are translated by trade partners and neighbors with a free press. Grievance and anti-war books sharpen or soften the memory of defeat.
- **Thinkers** found schools (liberalism, socialism, fascism, traditionalism) chosen by their politics and pulled by the times. A treatise is a larger idea shock at home and abroad, worldwide for famous ones, and radicalizes the matching movement.
- **Inventors** add research in their field (up to about +30% for a famous one, more with a funded laboratory). Breakthroughs add progress to the current project, and AI research leans toward their fields.
- **Generals** gain renown and experience from battles won, learn command traits (Blitz Commander +15% attack, Defensive Genius +15% defense), grow less loyal as they grow famous, and after a war a hero may lead an opposition party.
- **Censorship and exile:** without a free press, a government can ban a writer or thinker; banned works circulate underground, and about a third of the banned flee abroad and write from exile. AI governments patronize those in tune with the regime and ban the rest.

**The memory of defeat** (`js/revanchism.js`):
- **The wound:** every losing peace (terms, a capitulation, a peace conference) records the victors, the humiliation of the terms and the war dead. *Revanchism* is a stock built from our former core land still ruled by others (weighted by our people there), the terms, the reparations still paid, the war dead and a disarmament treaty, amplified by hard times and the myth, sharpened by nationalist writers and demagogues, and softened by prosperity and warm relations with the victors. It rises quickly and fades over a generation, with a breakdown in the Politics tab.
- **Where it goes:** the nationalist movement's support (replacing the old permanent "lost land" flag), the fascist current, AI rearmament and revenge.
- **The stab in the back:** if the army comes home undefeated in the field (at least 55% of its prewar strength, under a quarter of the homeland occupied, no capitulation), veterans say it was never beaten. The myth is stronger when elected politicians, or a government or leader that took over during the war, signed the peace, and when a famous general says so. A crisis (player and AI) asks whether to tell the truth, honor the army and blame traitors at home, or seek reconciliation. The myth turns the military interest group against a civilian government and drains its legitimacy.
- **Demagogues:** when revanchism is high and the nationalist movement has a following, a demagogue takes its lead: a famous general, a grievance writer or a decorated veteran. Their charisma and renown draw crowds, and in a democracy they lead a nationalist party (founded if needed) whose vote grows with the movement. In power in a republic, they ask for an enabling act (player and AI).
- **Disarmament treaties** cap military spending for fifteen years. AI governments break them only when the victors look beatable (weakened, or matched by revisionist partners); breaking one costs infamy and the victors' goodwill.

**World wars** (`js/worldwar.js`):
- **Great powers:** the strongest quarter of the world by army and economy.
- **Wars grow:** each month, nations outside a war weigh joining it: allies whose friend is losing, pact members (defensive pacts defend; revisionist pacts attack together; pacts close ranks against their leader's great-power rival), neighbors with claims or a grudge, ideological crusaders, and great powers alarmed that one side will dominate. The player is asked when an ally is losing.
- **Alliance systems:** great powers facing a hostile rival of similar weight found pacts and recruit friends; nations nursing a defeat sign revisionist pacts ("Axis").
- **A world war:** great powers on both sides, three in all (or seven nations and half the world's output), the weaker side holding at least a third of the other's strength (half, for one nation against the world), for at least four months. Then AI belligerents mobilize and switch to war production, every nation's trade openness falls (shipping), exhaustion feeds communist revolutions in hungry nations, and new governments sign separate peaces.
- **The peace conference:** decided by the war score when the great powers are exhausted. The victors keep occupied land where their people live, free peoples the losers had conquered (new states take the victors' system), impose ten years of reparations and fifteen years of disarmament on the great powers that lost, and replace a beaten aggressor regime (always after its second world war lost). Nations that capitulated along the way come to the conference too. The victors draw together in an alliance.
- **War weariness:** every belligerent remembers its war dead (as a share of its people) for a generation, which lowers its appetite for war and for joining others' wars.
- **Interface:** the Notable people card (Leader tab), the Memory of defeat card with a breakdown (Politics tab), world-war badges, great-power standing and treaty limits (Military tab, and the military slider), great powers, world wars, figures of the age and the remembered dead (World tab), alerts, crises and news.

**Measured** (24 worlds × 40 years, the same seeds before and after; counts now come from every news item):

| Measure | Before | After |
|---|---|---|
| Regime changes per world | 15.5 | 15.6 |
| Wars per world | 6.4 | 5.9 |
| War length (months) | 15.3 | 17.8 |
| Stability, mean | 47.6 | 47.7 |
| Share of nation-months in crisis | 0.066 | 0.066 |
| Growth per person (%/yr) | 1.19 | 1.25 |
| Inflation (%/yr) | 3.7 | 4.0 |
| Nation-years above 50% inflation | 3.5 | 4.4 |
| Sovereign defaults per world | 2.8 | 3.8 |
| Strongest idea current, mean | 0.19 | 0.23 |

New: world wars in 12 of 24 worlds (0.67 per world, about 28 months each), and a second one in 4 of them. Per world: about 3 nations joining wars already under way, 1.4 wars of revenge, 4 demagogues rising and 0.8 coming to power, 0.5 stab-in-the-back crises, 0.5 separate peaces. About 2.3 notable people per nation, of whom 0.18 famous (renown 50+). Revanchism above 0.4 in 7% of nation-years. A month takes about 6% longer. In a search of 24 worlds × 50 years, most of the chain (at least four of its steps: the myth, a demagogue rising and coming to power, a war of revenge, a world war in its wake) appeared in a quarter of them, and all of it in two.

**Side effects to watch:** world wars are paid for by printing and borrowing, so hyperinflation (+25%) and sovereign defaults (+36%) rise afterwards. That fits "war pays the bill in inflation afterwards", but it should be checked once war bonds exist. War-weary nations fight about 7% fewer wars overall.

**Fixed along the way:**
- the balance report counted events only in the last 600 news items, so long-run counts were too low (all counts above are from complete logs, before and after)
- the report's immigration figure divided by zero for nations that no longer exist
- movement leaders aged two years a year
- a nation that capitulated in a war of many nations stayed occupied until the whole war ended

**Later passes:**
- the player negotiating at the peace conference (today the victors' terms follow the war score)
- war guilt and reparations paid in goods
- the war dead taken out of the soldier pops
- war bonds
- a League of Nations
- a revanchism map mode
- artists and industrialists among the notable people
- inventions that spread to other nations
- a campaign chapter

## Governments that play differently (M each)

Today the seven government types differ mostly in numbers: freedom, repression, growth, corruption, army size, political capital and their power base. Only a few have systems of their own (elections and coalitions in democracies, heirs and successions in absolute monarchies, no private owners under communism). Each type should play differently because of how it works, not because of its modifiers.

**What each type needs:**

| Type | Has now | Needs |
|---|---|---|
| Communist state | No private owners, high welfare, sham elections | A real planned economy: production quotas, fixed prices that cause shortages, queues and black markets, five-year plans as the gameplay loop. Party factions, purges, a succession decided by the leadership. |
| Military junta | A big army; disloyal generals stage coups | The officer corps as the electorate: commanders kept loyal with posts and budgets, a presidency that may rotate among them, a promised "return to civilian rule" as a legitimacy clock, coup-proofing that trades a weaker army for a safer regime. |
| Theocracy | A clergy loyalty bonus | Faith as legitimacy that literacy erodes, a clerical council that chooses the successor, religious law that shapes the economy (limits on lending), religious police, holy sites tied to the faiths, spreading the faith abroad. |
| Fascist state | Aggression and military bonuses | A leader cult fed by victories and spectacle (building on demagogue renown), corporatism (the state sets wages and prices with unions and business cartels), party militias competing with the army, a push for self-sufficiency. |
| Constitutional monarchy | A decorative monarch | Reserve powers: appointing a prime minister in a hung parliament, dismissing a government in a crisis, abdication crises, the monarch's popularity as a source of legitimacy. |
| Absolute monarchy | Heirs and disputed successions | The court: nobles and landowners as power holders, royal marriages that make alliances and claims to thrones, regencies, the crown's own income (with Milestone 8). |
| Liberal democracy | Elections, coalitions, polls, press, referendums | The parliament screen, bargaining over bills party by party, courts that can strike down laws, lobbying with money. This is where lawmaker play would live. |

**New types, emerging from combinations of laws** (as the hybrid names already do) rather than new presets:
- **Technocracy:** a merit-based civil service with parties sidelined. Ministers chosen by skill; legitimacy from performance (growth, prices, living standards) rather than votes.
- **Corporate state:** the largest companies govern, with influence weighted by ownership. Needs corporations as actors, after phase 3 of the closed-loop economy.
- **Competitive authoritarian:** real but tilted elections, through media control, electoral rules and a captured election commission. Partly possible already through the laws.
- **Also possible:** worker-council republics, and merchant oligarchies where the vote depends on wealth.

**Order:**
1. Replace the flat per-type numbers with mechanisms (with 4c).
2. Communist planning (ties into the economy milestone), junta officer politics, and the crown's reserve powers.
3. Technocracy as a law-based hybrid.
4. The corporate state, after corporations exist.
5. The monarchies' court and dynasties, with Milestone 8.

**Kept in mind, not scheduled:** playing as a lawmaker (second to the grand-strategy layer; the parliament screen is its first step) and playing as a corporation or a church.

## Spheres of influence (M)

Formal control exists (puppets, vassals, protectorates, colonies), and so do blocs and a simple great-power ranking. A sphere is informal control, and it should come out of real ties rather than be declared.

- **Influence over a nation** is the sum of real ties to a great power:
  - the foreign debt it holds (payments.js already records every loan by lender)
  - the share of its trade that goes through that power or its bloc, read from the bilateral trade flows (`tradeflows.js`)
  - the factories its investors own (with phase 3, owning assets)
  - pacts and guarantees
  - shared ideas and kinship
- **A sphere** is the set of nations where one power's influence clearly leads.
- **Effects, through existing systems:**
  - clients lean toward their patron when choosing wars and blocs (`entryWish`, bloc appeal)
  - the patron's idea currents and press reach them more strongly
  - loans can come with conditions (lending as leverage, from the closed-loop plan)
  - a patron backs coups or rebels when a client drifts away (the existing "fund rebels" action, used by the AI)
- **Great-power status is earned:** from economy, military and the size of a power's sphere, replacing the fixed "strongest quarter" ranking in `worldwar.js`.
- **Why it matters:** two great powers competing for the same nations makes rivalries and crises emerge on their own, feeding the alliance systems, so world wars grow from competition between powers, not mainly from old defeats.
- **The player:** lend, invest, offer protection, sponsor parties and newspapers abroad, and defend clients.
- **Interface:** a spheres map mode, and each nation's influences in the Diplomacy tab.
- **Order:** after phase 2 of the closed-loop economy lands, alongside phase 3 (foreign ownership) and 4d (the world economy), and before AI ambitions, so AI goals like "dominate the market" have something to aim at.

## AI ambitions and personalities (M)

Most AI work happens inside each milestone, because the AI uses every system as it's built. This milestone adds what's left: long-term direction. It must come before the war layer, because a war AI needs aims.

Already in place from History makers: revenge as an aim (a grudge against the victors lowers the odds an AI needs before attacking them and makes it rearm), revisionist pacts among the defeated, great powers building alliance systems against their rivals, and war weariness from the war dead.

- **Long-term goals per nation:** expand, industrialize, unify our people, dominate the market, form a bloc, seek revenge. Goals are shaped by the leader's personality, the ruling interest groups and the nation's situation.
- **Diplomatic memory:** grudges, trust and broken promises.
- **Recognizable national personalities,** so each world's history feels different.

## Time and pacing (M)

The world moves in monthly jumps: every nation updates at once, news arrives in batches, and numbers change in steps. The goal is a world that feels continuous, and eventually a simulation that runs in weeks, so wars, crises and markets can move faster than a month.

**Stage 1: a daily clock on the monthly simulation.** The simulation still steps once a month; only how it is shown changes.
- **The calendar runs day by day,** at speeds the player picks (pause, 1–5), with the date in the top bar.
- **Staggered nations:** each nation updates on its own fixed day of the month, so the work and the changes are spread out. World-level steps (market clearing, payments, trade flows) still run once a month, on day 1. Anything that assumes every nation has updated in the same instant has to be found and fixed first.
- **News on its day:** each event gets a day within the month and appears when the clock reaches it, not in a batch.
- **Smoothly moving numbers:** values shown in the interface (treasury, prices, exchange rate, army strength) slide between last month's and this month's values.
- **Unchanged:** the economy, politics, tests and balance report. A 40-year run must give the same numbers, apart from the nation-order effects of staggering, which are measured and explained.

**Stage 2: weekly ticks.** The simulation steps four times as often (or 52 times a year, with months as calendar labels).
- **One time constant per rate:** every per-month rate, smoothing factor and duration goes into a single table of time constants (`js/time.js`) and is converted with `perStep(monthlyRate)` / `smooth(monthlyFactor)` helpers instead of `/ 12` and fixed factors scattered through the code. This can be done first, on the monthly tick, with no change in behaviour: a pure refactor that the balance report checks.
- **Durations in time, not ticks:** crises, memories, elections, reforms, wars and cooldowns are counted in months (or days) of game time, whatever the step.
- **What runs weekly and what stays monthly:** war, markets and payments benefit most. Slow systems (demographics, ideas, figures, research) may stay monthly to save time.
- **Speed:** about 4× the work per game year. It needs the Web Worker (deferred from Foundations) and profiling, so a 40-year run stays playable and the 24-world balance report stays under about 20 minutes.
- **Re-tuning:** compare 24 worlds × 40 years against the monthly baseline (growth, calm-year falling-GDP share, inflation, stability, crisis share, unemployment, regime changes, wars, banking and debt crises, payments, speed) and tune until they match, or explain the changes kept. Shocks and random events must be rescaled so their yearly frequency stays the same.
- **The player:** weekly turns for war (fronts, supply, battles) arrive with Milestone 5; the daily clock from stage 1 stays the pacing layer on top.

**Order:**
1. Stage 1 (the daily clock), any time; it touches only the clock and the interface.
2. The time-constant refactor, on the monthly tick, measured to change nothing.
3. Weekly ticks for war, with Milestone 5 and the Web Worker.
4. Weekly ticks for markets and payments, then the rest as speed allows.

## Milestone 5: Military strategy, an operational layer (L)

**Design principle:** war should be an economic and political act, not a separate game. We take the parts of Hearts of Iron that make war about places and timing (fronts, breakthroughs, supply, encirclement) and skip the parts that demand constant micromanagement (division templates, combat width, daily ticks). The war layer runs itself; the player steps in for the big decisions and goes back to running the country.

Already in place (first pass): occupation until peace, fighting along the front by province, terrain, encirclement and sea supply, postures, general mobilization.

**Build:**

- **Armies on the map:** a few army counters per nation (roughly one per front), not dozens of divisions. Each has strength (men and equipment) and organization (cohesion that battles drain first; at zero it retreats). Armies hold their front and follow their last order until told otherwise.
- **Orders:** *hold* (dig in, entrenchment builds over weeks), *advance* (push the whole line), and *spearhead* (draw an arrow to a target: the army concentrates, breaks through and drives deep). Optional: move an army yourself to plug a gap.
- **Supply and encirclement:** supply flows from the capital and ports along held provinces and fades with distance and poor infrastructure. Out-of-supply armies lose organization; encircled ones surrender. Overseas fronts depend on controlling the sea route.
- **Generals lead armies:** the existing general characters command, gain experience and traits ("Defensive Genius", "Blitz Commander"), and win popularity. A victorious, ambitious general is a coup risk. *First pass done in History makers:* renown and experience from battles, the two command traits, ambition from fame, war heroes entering politics. Still to do: one general per army counter.
- **Armies come from the economy and the pops:** manpower is drawn from soldier and peasant pops (and leaves the workforce); equipment from arms, steel and fuel bought on the market. Shortages at home become shortages at the front; a blockade starves both.
- **War economy:** converting factories to arms, rationing, war bonds and price controls, each with its own interest-group winners and losers.
- **The home front:** casualty reports, anti-war movements, draft riots, a hostile press. Losing a war can bring down the government.
- **Casus belli and war goals:** a justification is needed to declare war, which can be fabricated. War goals come from politics (reconquest, nationalism from Milestone 3, interest-group demands) and drive war score.
- **The seas and the skies, abstracted:** fleets contest control of sea routes (landings, blockades that cut world-market trade, convoy raiding); air power is a regional superiority modifier, not units.
- **Time:** the game runs in weekly steps while a war is on, and monthly in peace (stage 2 of Time and pacing). On the map: army counters, battle markers, the front line between the sides, plan arrows, and highlighted encircled pockets.
- **AI:** fights with the same fronts and orders, so it can spearhead and encircle too.

**Retune world wars** (built early in History makers, on the first-pass war layer):
- **Pacing:** their length, the exhaustion limit for seeking peace, and the four-month test before a war counts as a world war, all tuned to monthly fronts.
- **Total war:** replace the stand-ins with the war economy (rationing, converted factories, war bonds) and naval blockades. Today AI powers simply mobilize, and every nation's trade openness drops.
- **Peace terms:** decided by war goals, not war score.
- **War dead:** taken out of the soldier pops, not only counted.
- **The memory of defeat:** "army intact" should come from the armies on the map, not from a strength ratio.
- **Measure again:** world wars per world, their length, and war finance side effects (hyperinflation, defaults).

**Skip on purpose:** division templates, combat width, daily ticks, unit-level air and naval combat, a production line for every weapon.

**Later:** military doctrines in the tech tree, officer quality tied to education and the military interest group, proxy wars and arming rebels for later eras.

## Milestone 6: Eras and scenarios (M each)

- **Start dates:** 1836, 1914, 1950 (the current one) and 2000. Each has era-appropriate goods, technologies, ideologies and governments.
- **Era transitions:** industrialization, decolonization, a cold war of blocs, the digital age, and new ideologies (environmentalism, theocratic revival, technocracy).
- **More campaigns** in the style of "The First Republic":
  - an autocrat's story ("The General's Dilemma")
  - a monarch's ("The Last Crown")
  - a revolutionary's ("Year Zero")
  - an imperial collapse ("The Long Retreat")
- **Journal / national goals:** objectives that come from the simulation, like "Survive the depression" when one actually hits, "Integrate the new provinces" after a conquest, or "Industrialize" for an agrarian nation. They give the sandbox direction without scripting its history, and could be pulled forward because they help pacing.
- **A history book:** a generated chronicle of your reign, and a "verdict of history" score at an optional end date.

## Milestone 8: Intrigue and dynasties (M)

The furthest from the pop-and-goods core, so it comes last, and every item ties into an existing system.


- **Relationships between characters:** friends, rivals, lovers, mentors. Opinions between characters affect loyalty and plots.
- **Secrets and schemes:** blackmail, smear campaigns and assassination plots against you or by you. These build on the existing character actions.
- **Dynasties and family trees:** marriage alliances between royal houses, contested successions, regencies for child monarchs, and education of heirs.
- **Espionage:** spy networks, stealing technology (through the research system), sabotage (of real buildings and supply), election interference abroad (through the press and regional elections).
- **Play as a character:** optionally play a person instead of a state, so losing power doesn't end your game. You could be the opposition leader or an exiled general.

---

## Visuals and presentation (a track that runs alongside the milestones)

Visuals serve philosophy rule 7: the best graphics are the ones that show *why* something is happening. Two timing rules:
- **Do now:** the shared look (theme, map, top bar, tooltips).
- **Do after:** redesign a screen only once the systems behind it have settled. The Politics, Pops and Military tabs will change again in Foundations, Milestone 3 and Milestone 5.

**The graphics-card map (scheduled with AI ambitions, before Milestone 5)**

The map moves to WebGL 2, which works in every current browser, including when the game is opened as a file. The province layout, height and terrain are uploaded once per world; each month only a small color-per-province table changes; a shader does relief, borders, glows, stripes and the coastline for every pixel.
- **What it gives:** smooth 60-fps zoom and pan, instant map modes, and a base for rivers, roads, railways, city icons, animated fronts, plan arrows and trade routes. The current renderer stays as a fallback.
- **Expected quality:**
  - *procedural textures only:* about 70% of Victoria 3's zoomed-out political map
  - *with a handful of artist textures* (terrain set, surface relief, paper, ocean): about 85%
  - *true 3D close-ups* (city models, forests, trains) would need 3D assets and a 3D scene, decided later
- **Known limit:** world resolution (about 300×150 cells on a large map) makes close zoom blocky, so the shader adds generated fine detail.
- **Prototype first:** build it behind a toggle, compare screenshots side by side, then decide on textures.

**Engines:** no engine change is needed for a stylized 2D map plus ornate panels. If we ever want true 3D close-ups, Godot (or three.js in the browser) is the option. The simulation is already separate from rendering (it runs headless), so a later move would mean a port, not a rewrite. A desktop release can wrap the web game with Tauri or Electron.

**Art is the real gap, not technology:** consistent icon sets, panel and frame artwork, layered 2D portraits, and an event art library. Sources: commissioned artists, licensed or open asset packs (check licenses, especially for a commercial release), and our own generated art.

**The map**
- **Natural features:**
  - rivers (generated with the terrain; also defensive lines for Milestone 5)
  - forests, deserts and snow as textures
  - nicer coastlines and shallow seas
- **Cities on the map:** they grow visibly with urbanization (Milestone 3), with icons by size and capitals that stand out.
- **Infrastructure drawn on the map:** roads, railways and ports, appearing as provinces build them (Milestone 4). This also shows supply routes for Milestone 5.
- **Trade made visible:** animated trade flows between markets and blocs, blockaded routes, chokepoints.
- **War on the map** (with Milestone 5):
  - army counters
  - front lines drawn between the sides
  - plan arrows
  - battle markers
  - encircled pockets highlighted
- **Detail that follows the zoom:**
  - nation names that curve along the shape of the country
  - province names and city labels when zoomed in
  - smoother rendering when zoomed far in
- **Map modes:** gradient legends with values on hover, and new modes as systems arrive (culture, religion, inflation, unemployment, supply). Migration is a flow view (see Flow views).
- **Optional:** fog of war, plus lighting and seasons for atmosphere.

**Flow views**

Views that show what moves between nations, all built the same way as the trade view.

- **Shared method:**
  - **Accounting only:** each view records source-to-destination tables in a sim file, so the economy and politics come out unchanged. A test checks that, as the trade view's does.
  - **One shared line style** on the map: thickness by size, an arrow for direction, a filter, and a hover that says what moves and why.
  - **A "who and why" breakdown for each nation,** following the "tell the player why" rule.
  - **They read the systems and change none of them:** the trade, migration, payments and ideas rows of "How the systems connect".
- **The views, in order:**
  1. **Trade.** Step 1 is done (bilateral flows, the Trade map mode, trading partners and dependence); step 2, routes, is under 4d.
  2. **Migration.** People already move every quarter (peoples.js), but only yearly totals per nation are kept today; the view records who moves where. Arrows between nations sized by migrants and colorable by culture, and a card showing who arrives, who leaves, and why (work, war, open borders). This is the migration map mode listed under the map.
  3. **Capital and debt,** after phase 2 of the closed-loop economy: who lends to whom and who is owed. It shares its data with spheres of influence.
  4. **Ideas:** a map mode for each current's strength, and a "where this current came from" breakdown. This needs the sources of each current (neighbors, trade, blocs, revolutions, writers and thinkers) to be stored, which they are not today.
  5. **The diplomatic web:** pacts, rivalry pacts, revisionist pacts and world-war sides drawn as a network.
  6. **Later:** spheres of influence (once built), and arms and war supply (with Milestone 5).
- **Technology:** nothing spreads between nations today, so there is nothing to draw yet. A "where each technology came from" view follows once technology spreads (see "Technology as diffusion" under Deeper simulation).

**Screens (redesigned once their systems settle)**
- **Politics:** a parliament seating chart (semicircle) with coalition blocs, an interest-group overview, and the constitution as a visual chart.
- **Economy:** a flow diagram of where goods go and where money comes from, the price level and the business cycle at a glance, and a per-province economy panel.
- **Pops:** class and culture breakdowns, an age pyramid (Milestone 3), and living standard by class over time.
- **Military:** an army and general roster, front overviews, and supply status.
- **An outliner:** a side panel of wars, crises, bills, movements and elections coming up.

**Characters, flags and art**
- **Portraits:** more variety, aging over a career, clothing by role and era, expressions under stress.
- **Flags and arms:** coats of arms, and flags that change with revolutions and new regimes.
- **More event illustrations:** a distinct scene for each major event type and crisis, plus era variants for Milestone 6.
- **Newspapers and history:** a monthly front-page newspaper, and an illustrated history book of your reign.

**Polish**
- **Motion:** smooth panel and modal transitions, animated numbers and bars, map pulses for battles, coups and elections.
- **Sound and music:** optional and toggleable: interface sounds, ambient tracks by era and mood.
- **Settings:** interface scale, colorblind-friendly palettes, reduced motion, a high-contrast mode.
- **Mobile:** a proper touch layout for phones and tablets.
- **Title and loading screens:** era-specific backgrounds once Milestone 6 adds start dates.

## Quality of life (S each, can be slotted in anywhere)

- ✅ **Explain everything (first pass):** hover approval, stability, unrest, political capital, the treasury, infamy and wars for a breakdown of every part. Next: faction loyalty, growth, prices and pop needs.
- ✅ **Ledger:** graphs over time for your nation, comparisons between nations, and world market price history.
- ✅ **Alert bar:** under the top bar, coup and revolution risk meters that show the build-up before they happen (built from the same quantities that trigger them), plus alerts grouped by politics, economy, society, war and decisions waiting. Hover for the list; click to open the tab.
- **Outliner:** a side list of wars, movements, plots, constructions and upcoming elections.
- ✅ **Province panel:** click a province for its pops, buildings and resources.
- ✅ **Saves:** multiple save slots and a yearly autosave. Still to do: exporting and importing a save file.
- **Monthly newspaper:** a front page summing up the month in your nation and the world.
- **Settings:** colorblind-friendly map palettes, hotkeys, UI scale, and a lighter mobile layout.
- **Sound and music** (optional, toggleable).
- ✅ **Map polish:** a painted map with relief, ocean depth, hand-drawn borders and generated national flags. More in the visuals track.
- ✅ **Visual overhaul:** brass-and-midnight theme, illustrated event scenes, a title screen with a live world preview.

## Platform (M each)

- **Save compression.** (The Web Worker moved to the foundations.)
- **Data-driven content:** governments, goods, buildings, events, techs and campaigns defined in JSON so they're easy to extend.
- **Modding:** a mod loader for custom events, campaigns, governments and world models.
- **Editors:** a scenario and map editor to paint borders, place nations and write starting conditions.
- **Multiplayer:** hotseat first (the simulation is deterministic, which makes it feasible), later asynchronous online play.

---

## Beyond the milestones

Ideas for after (or alongside) the milestones. They follow the same design philosophy: real causes through pops and goods, emergence over scripting, and the AI playing the same game. ★ marks priorities that are scheduled in the Order below.

### Priorities

- ★ **The world newspaper and a generated history book.** This brings together the monthly newspaper (quality of life), the history book (Milestone 6) and the newspapers in the visuals track.
  - **The newspaper:** a front page every month, with foreign headlines alongside our own: wars far away, great-power rivalries, revolutions, crashes, elections. It's built from the game's event log and statistics, with headlines chosen by importance, so the world feels alive rather than revolving around the player.
  - **The history book:** a world-history view, a chronicle of your reign, and a "verdict of history" at an optional end date.
- ★ **Ideas spreading through the world.** (First pass done in Milestone 3d.)
  - **The mechanism:** ideologies (liberalism, socialism, fascism, nationalism, later environmentalism) are currents with a strength in each nation. They travel along trade links, migrant flows, the press barons and bloc ties.
  - **Revolutions inspire neighbors:** a revolution or a striking success in one country boosts the matching current next door.
  - **Where it lands:** currents feed movements, party polls and interest-group radicalism, so 1848-style waves and domino effects emerge from the simulation.
- ★ **A desktop release:** the web game wrapped with Tauri or Electron, saves to disk, bundled fonts for offline play, and a store-ready package later. Planned together with eras, toward a public release.

### Deeper simulation

- **Environment and climate:**
  - pollution from industry
  - resource depletion
  - droughts and famines
  - later, climate change as a slow global crisis that needs international cooperation
- **Technology as diffusion, not a tree:** inventions spread from where they're made, through trade, students abroad, spies and foreign investment, seeded by the notable inventors (figures.js), whose breakthroughs are where an invention starts. Rich nations pull ahead, and catch-up growth becomes a strategy. Once technology spreads, a "where each technology came from" flow view follows (see Flow views).
- **Corporations as actors:** large companies with owners and leaders that lobby, bribe, buy newspapers, move factories abroad and get nationalized.
- **Organized crime and the black economy:** smuggling under tariffs and price controls, black markets in shortages, and corruption as a network rather than a meter.

### Deeper politics

- **Global institutions:**
  - a League of Nations or UN-style body
  - world courts
  - sanctions votes
  - a global reserve currency
  - development banks with strings attached
- **Spheres of influence and a hierarchy of powers:** now a section of its own (Spheres of influence), with ranks in World scale.

### World scale

**Why the world feels small:**
- **Few actors:** 14 nations by default (40 at most) and a few hundred provinces, against hundreds of countries and thousands of provinces in Victoria, and thousands of counties and characters in CK.
- **One flat level of geography:** no named states, regions, subcontinents, seas, mountain ranges or rivers.
- **Everything fits on one screen,** so there's nothing beyond the horizon.
- **Nations are all one size class.**
- **Distance barely matters.**
- **The news is mostly about you.**

**What would make it feel bigger:**
1. **More nations and provinces:** a larger default world, with hundreds of nations and thousands of provinces on large maps. *Depends on the graphics-card map and the Web Worker.*
2. **A hierarchy of geography:** named states, regions and subcontinents; named seas, straits, mountain ranges and rivers on the map; labels that change with zoom level. *Independent; could come any time.*
3. **A hierarchy of powers:** great power, major and minor ranks with different diplomatic weight; spheres of influence; microstates and unclaimed land at the edges. *Independent.*
4. **Distance that matters:** trade costs and routes, slower migration and influence across oceans, supply and power projection that weaken with distance, regional markets before a single world market. *Fits Milestone 4d.*
5. **Far-off places worth noticing:** distant continents you rarely deal with until you do, and regional crises and wars that ripple to you through trade and ideas. *Fits idea spread.*
6. **A living world feed:** the world newspaper above. *Fits the newspaper.*
7. **Density at close zoom:** cities, roads, railways, rivers and province names appearing as you zoom in. *Depends on the graphics-card map.*

### Ways to play

- **Play as a character** (from Milestone 8): an opposition leader, an exiled general or a press baron, so losing power doesn't end the game.
- **Story campaigns** (from Milestone 6), and national goals that come from the simulation.

### Living histories

- **The newspaper and history book** (priority above).
- **The past stays alive:** in the news, in nationalist claims, and in the memory of old wars and revolutions, which feeds diplomacy and movements. *First pass done:* revanchism and the war dead remember wars for a generation; the World tab keeps world wars, the figures of the age and the most renowned of the dead.

### Community and release

- **The desktop release** (priority above).
- **Modding and editors** (from Platform): a mod loader for events, campaigns, governments and world models; a scenario and map editor.
- **Multiplayer:** hotseat first (the simulation is deterministic), later asynchronous online play.
- **Art direction and commissions:** an art direction document, map textures, an icon set, then panels, portraits and event art (see the visuals track).

### Under the hood

- ✅ **Time constants (first pass, `js/time.js`):** the length of a step (`TIME.STEP_MONTHS`, 1 today) and helpers (`perStep`, `perYear`, `annualize`, `smooth`, `decay`, `perStepChance`, `lagMonths`, `countdown`). Converted: markets and production (`economy.js`), money, credit, the budget and its financing (`fiscal.js`, the budget in `sim.js`), payments, trade flows, war (fronts, exhaustion, mobilization, peace chances, reparations) and the army. On the monthly step each helper returns exactly what the old code computed, so 24 worlds × 40 years give identical reports. New code uses the helpers.
  - **Still monthly, by design:** politics (meters, elections, laws, movements), society and demographics, ideas, figures, research, diplomacy and events. When the step shrinks they run only at the start of each month.
  - **Before weekly ticks can run:** flows (production, consumption, wages, the budget) are computed as a month's amount each step and must be scaled at their sources; per-step histories (`c.hist`) assume months; and the "still monthly" systems need their month-start gate. A test steps the helpers at a quarter-month and checks that a year adds up the same.
- **The Web Worker:** the simulation runs in a background thread. Needed for world scale and weekly war turns.
- **Data-driven content:** goods, buildings, laws, events and campaigns defined in JSON.
- **Save compression and versioning,** so saves keep loading across updates.
- **Balance reports for every change** (exists: `npm run report`), widened as systems are added.

---

## Order

1. ✅ **Milestone 1:** empires, blocs, coalitions.
2. ✅ **Quick wins:** number breakdowns, the ledger, the province panel, save slots, the visual overhaul.
3. ✅ **Milestone 2:** laws, interest groups and their leaders, constitutional crises, regional elections, referendums, the press.
4. ✅ **Consolidation and war on the map (first pass).**
5. ✅ **Foundations:** consolidation, balance report, economy baseline and noise fix, campaign chapter VIII. Still to do: a play-test by a human. The Web Worker is deferred until weekly war turns arrive.
6. ✅ **Milestone 4a–4b:** money, inflation, credit and the business cycle (first pass).
7. ✅ **Milestone 3** (first pass), with ideas spreading through the world folded in: 3a peoples, 3b cities and demographics, 3c aging, inequality, minority movements and healthcare, 3d universities, kinship and unification, idea spread, 3e secondary schools, the minorities interest group, unification by force. Also done: **the alert bar** (see Quality of life).
8. ✅ **History makers (first pass):** notable people, the memory of defeat and its demagogues, world wars and peace conferences. Pulled forward at the player's request; it uses the existing war layer and leaves the operational war layer to Milestone 5.
9. **The time-constant refactor** (stage 2, step 1 of Time and pacing): every per-month rate, smoothing factor and duration into `js/time.js`, converted with `perStep()` / `smooth()`, on the monthly tick, measured on 24 worlds × 40 years to change nothing. Start it only once the open closed-loop payments PRs (layers 1–3) have merged: it touches nearly every simulation file and would conflict with them. From then on, new code uses the helpers instead of `/ 12` and fixed factors.
10. **Milestone 4c–4e,** with step 1 of "Governments that play differently" (mechanisms instead of flat per-type numbers) in 4c: labor relations and fiscal policy (including AI governments responding to the cycle), the world economy (with distance that matters, from World scale), and the stock and land markets, with the **closed-loop economy** running through all three (phase 1, the state's budget and debt, is done; phase 2's payments layers 1–3 are in review).
11. **Spheres of influence,** once payments and foreign ownership exist (bilateral trade flows already do).
12. **AI ambitions and personalities, with the graphics-card map**, plus the first art commissions: an art direction document, map textures and an icon set. The war layer needs the new map for army counters, fronts, plan arrows and supply routes.
13. **Milestone 5:** the war layer, an operational layer.
14. **The world newspaper and history book.** This can move earlier. World wars, treaties and the figures of the age are natural headlines and chapters.
15. **Eras and scenarios (Milestone 6) and the desktop release,** together toward a public release.

Later: Milestone 8 (intrigue and dynasties), world scale (as the map and Web Worker allow), and the rest of Beyond the milestones.

Time and pacing: the time-constant refactor comes next (item 9), once the payments PRs have merged. The daily clock (stage 1) slots in later, between features, whenever there is room: the calendar day by day at the player's speed, news on its day, numbers that slide between months, and staggered nation updates after that as their own measured step. Weekly ticks wait for Milestone 5 and the Web Worker.

Flow views (visuals track) slot in as their data arrives: migration right after the trade view, capital and debt after phase 2 of the closed-loop economy, and ideas after that.

If we want to show the game to other people sooner (screenshots, a playable link, recruiting an artist), the graphics-card map can move earlier, because the map is most of the first impression.

Throughout: each milestone follows the design philosophy, the AI uses every new system as it's built, and each big milestone ships with a campaign chapter and its share of the visuals track (cities with Milestone 3, infrastructure and economy screens with Milestone 4, war on the map with Milestone 5, era styling with Milestone 6).
