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
- **Milestone 1:** subjects and empires, releases, blocs (pacts, free-trade zones, customs unions, confederations), province designations, separatism, federations, parliamentary coalitions. Still open from it: war coalitions with joint war goals and joint peace deals, and bloc councils voting on shared policy.

---

## Next: foundations (M)

Before the next big milestone:

- ✅ **Consolidation (second pass):**
  - **Movements are the radical wings of interest groups.** Labor goes with the workers, liberal with the intelligentsia, nationalist with the military, clerical with the clergy, monarchist with business. Growing movements are led by their group's leader, an angry group radicalizes its wing, and a radical wing drags the group's loyalty down.
  - **Support is now a visible meter** (public approval, power-base loyalty and clout-weighted interest groups), and the stability breakdown is grouped under the four meters.
  - **Still to do:** a peasant interest group (the agrarian league has none yet), and retiring separate meters that only feed one of the four (for example coalition satisfaction, which could become support from partner parties).
- ✅ **Balance report:** `npm run report` (and `--compare tools/baseline.json`) runs AI-only worlds and summarizes regime changes, wars, crises, elections, laws, growth, recessions, prices, living standards, inequality, unemployment and stability. Philosophy rule 5 depends on it.
- ✅ **Economy baseline:** measured (see Milestone 4). Still to do: calm the remaining GDP noise before 4b.
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

- **Cultures and religions on pops:** each pop has a culture and a faith.
  - *Discrimination and acceptance laws* decide which jobs and classes a minority can hold, and whether it can vote. Exclusion shows up as unemployment, lower living standards and grievances in that group, not as an unrest modifier.
  - *Assimilation and conversion* are slow drifts driven by schooling, cities and the law.
- **Nationalism (extends separatism and movements, not a parallel system):**
  - *irredentism:* our people across the border, which becomes war goals in Milestone 5
  - *pan-national unification*
  - *minority separatism:* grows from discrimination and living standards
- **Migration:** pops move between provinces and nations toward higher wages, jobs and safety, out of famines and wars. Refugees are pops, with costs and politics. Migration laws decide who can enter.
- **Cities and housing:**
  - Housing is a good, built by construction and consumed by pops.
  - Cities grow where jobs are.
  - Housing shortages raise rents (eating into pop incomes), create slums, and concentrate urban unrest.
- **Demographics:** birth and death rates by class and living standard. Births fall as living standards rise. Age structure creates pensioners, who are a cost and a voting bloc.
- **Social mobility and inequality:** children move between classes through schooling and family wealth, not just through job vacancies. Inequality is measured (a Gini-style figure) and feeds interest groups and movements.
- **Public services as goods:** healthcare, pensions and housing support replace the single welfare slider. Each is a service with workers (doctors, teachers, clerks), costs and the classes it serves. Unemployment insurance belongs to 4c.
- **Education system:** primary, secondary and university schooling, staffed by teachers. It produces literacy, clerks, engineers and an intelligentsia. Research and political liberalization depend on it.
- **Interest groups from culture and faith:** a religious minority or a national movement can become an interest group with its own clout and demands, folded into the existing interest-group system.

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

### 4a. Money, inflation and the central bank
- **A currency per nation:** a money supply and a price level. Today's goods prices become relative prices, multiplied by the national price level.
- **What drives inflation:** money growth beyond real output (especially printing to cover deficits), expectations (people who expect rising prices raise them now), import prices and the exchange rate, and a wage-price spiral when unions are strong and labor is scarce.
- **Debts in your own currency:** the treasury and national debt are in your currency, so inflation erodes debt. That's the temptation; printing to cover a war or a deficit can spiral into hyperinflation.
- **Monetary-system law:**
  - *gold standard*: stable prices and trade, but deflation in a slump and no stimulus
  - *independent central bank*: interest rates set by a rule
  - *government-controlled money*: you set rates and can print
- **Interest rates:** they drive investment, consumer credit, the exchange rate and what debt costs to service.

### 4b. Credit, confidence and the business cycle
- **Private credit:** businesses borrow to invest when rates are low and confidence is high, so private debt builds up through the boom.
- **Overshooting:** construction takes time, so new capacity opens after demand has peaked. Prices and profits fall just as the debts come due.
- **The bust:** defaults lead to a credit crunch, cancelled projects, layoffs and falling demand. High debt plus falling prices can turn a recession into a depression (debt deflation).
- **Business confidence:** a visible index, moved by profits, the news, the press barons and events, that drives investment and hiring.
- **Banking crises:** bank runs, deposit insurance (a law), lender of last resort, bailouts or nationalization.
- **Optional asset market:** a stock or land index with bubbles in the boom and crashes at the turn.

### 4c. Labor, unemployment and fiscal policy
- **Labor relations:** unions as organizations with membership, strikes and collective bargaining. Minimum-wage laws change how buildings split value between wages and profits.
- **Sticky wages:** wages are slow to fall, so a drop in demand becomes layoffs rather than pay cuts. That's what turns a slump into mass unemployment.
- **Automatic stabilizers:** unemployment insurance and welfare cushion downturns.
- **The fiscal multiplier:** government spending moves output much more in a slump than in a boom, so stimulus versus austerity is a real choice.

### 4d. The world economy
- **Contagion:** a recession in a big economy cuts world-market demand, and its trading partners feel it.
- **Exchange rates and capital flows:** money moves toward high interest rates and strong currencies. Devaluation helps exports, makes imports pricier and adds inflation.
- **Sovereign debt and currency crises:** lenders stop lending, a currency peg breaks, and a forced devaluation or default follows. Bailouts come with conditions, a lever for blocs and empires.
- **Protectionism:** raising tariffs in a depression protects jobs at home and deepens the global slump.

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

## AI ambitions and personalities (M)

Most AI work happens inside each milestone, because the AI uses every system as it's built. This milestone adds what's left: long-term direction. It must come before the war layer, because a war AI needs aims.

- **Long-term goals per nation:** expand, industrialize, unify our people, dominate the market, form a bloc, seek revenge. Goals are shaped by the leader's personality, the ruling interest groups and the nation's situation.
- **Diplomatic memory:** grudges, trust and broken promises.
- **Recognizable national personalities,** so each world's history feels different.

## Milestone 5: Military strategy, an operational layer (L)

**Design principle:** war should be an economic and political act, not a separate game. We take the parts of Hearts of Iron that make war about places and timing (fronts, breakthroughs, supply, encirclement) and skip the parts that demand constant micromanagement (division templates, combat width, daily ticks). The war layer runs itself; the player steps in for the big decisions and goes back to running the country.

Already in place (first pass): occupation until peace, fighting along the front by province, terrain, encirclement and sea supply, postures, general mobilization.

**Build:**

- **Armies on the map:** a few army counters per nation (roughly one per front), not dozens of divisions. Each has strength (men and equipment) and organization (cohesion that battles drain first; at zero it retreats). Armies hold their front and follow their last order until told otherwise.
- **Orders:** *hold* (dig in, entrenchment builds over weeks), *advance* (push the whole line), and *spearhead* (draw an arrow to a target: the army concentrates, breaks through and drives deep). Optional: move an army yourself to plug a gap.
- **Supply and encirclement:** supply flows from the capital and ports along held provinces and fades with distance and poor infrastructure. Out-of-supply armies lose organization; encircled ones surrender. Overseas fronts depend on controlling the sea route.
- **Generals lead armies:** the existing general characters command, gain experience and traits ("Defensive Genius", "Blitz Commander"), and win popularity. A victorious, ambitious general is a coup risk.
- **Armies come from the economy and the pops:** manpower is drawn from soldier and peasant pops (and leaves the workforce); equipment from arms, steel and fuel bought on the market. Shortages at home become shortages at the front; a blockade starves both.
- **War economy:** converting factories to arms, rationing, war bonds and price controls, each with its own interest-group winners and losers.
- **The home front:** casualty reports, anti-war movements, draft riots, a hostile press. Losing a war can bring down the government.
- **Casus belli and war goals:** a justification is needed to declare war, which can be fabricated. War goals come from politics (reconquest, nationalism from Milestone 3, interest-group demands) and drive war score.
- **The seas and the skies, abstracted:** fleets contest control of sea routes (landings, blockades that cut world-market trade, convoy raiding); air power is a regional superiority modifier, not units.
- **Time:** the game runs in weekly steps while a war is on, and monthly in peace. On the map: army counters, battle markers, the front line between the sides, plan arrows, and highlighted encircled pockets.
- **AI:** fights with the same fronts and orders, so it can spearhead and encircle too.

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
- **Map modes:** gradient legends with values on hover, and new modes as systems arrive (culture, religion, migration, inflation, unemployment, supply).
- **Optional:** fog of war, plus lighting and seasons for atmosphere.

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

## Order

1. ✅ **Milestone 1:** empires, blocs, coalitions.
2. ✅ **Quick wins:** number breakdowns, the ledger, the province panel, save slots, the visual overhaul.
3. ✅ **Milestone 2:** laws, interest groups and their leaders, constitutional crises, regional elections, referendums, the press.
4. ✅ **Consolidation and war on the map (first pass).**
5. **Foundations:** finish the consolidation (fewer meters, movements folded into interest groups), balance report, economy baseline, Web Worker, play-test and campaign chapters.
6. **Milestone 4a–4b:** money, inflation, credit and the business cycle. The economic foundation the social layer builds on.
7. **Milestone 3:** society, peoples and culture, built on wages, savings and debt.
8. **Milestone 4c–4d:** labor relations and fiscal policy, then the world economy.
9. **AI ambitions and personalities.**
10. **Milestone 5:** military strategy as an operational layer.
11. **Milestones 6 and 8:** eras and scenarios, intrigue and dynasties. National goals from Milestone 6 can be pulled forward for pacing.

Throughout: each milestone follows the design philosophy, the AI uses every new system as it's built, and each big milestone ships with a campaign chapter and its share of the visuals track (cities with Milestone 3, infrastructure and economy screens with Milestone 4, war on the map with Milestone 5, era styling with Milestone 6).
