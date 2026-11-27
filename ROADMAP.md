# Roadmap

Where the game is going. Sizes are rough: **S** = a session, **M** = a few, **L** = a major milestone.

**Priorities:**
1. The economic and social simulation comes first.
2. Politics is just as central.
3. The military strategy layer is developed after those.

The milestones below are ordered that way.

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

- **Cultures and religions on pops:** majority and minority groups, with discrimination or acceptance laws, assimilation and religious conversion.
- **Migration:** pops move between provinces and nations toward jobs and safety, and refugees flee wars.
- **Nationalism:** irredentist claims ("our people across the border"), pan-national unification movements and separatism. These feed 1c and Milestone 3.
- **Cities and urbanization:** cities on the map that grow with industry; housing shortages, slums and urban unrest.
- **Demographics:** age structure, birth rates falling as living standards rise, and pensions and an aging society as an expense and an electorate.
- **Social mobility:** pops move between classes through education and wealth (a worker's child becomes a clerk), not just through job vacancies. Inequality is measured explicitly (a Gini-style figure) and feeds movements.
- **Designing the welfare state:** separate policies for healthcare, pensions, unemployment insurance and housing instead of one welfare slider. Each has its own costs, constituencies and effects on living standards.
- **Education system:** primary, secondary and university levels, which produce literacy, clerks, engineers and an intelligentsia. Research depends on it, and so does political liberalization.
- **Labor relations:** unions as organizations with membership, strikes, collective bargaining and minimum wages that change how buildings split value between wages and profits.

## Milestone 4: Deeper economy (L)

**Goal:** inflation, booms, recessions and depressions that come out of the simulation (money, credit, confidence and wages) rather than from scripted events, and that feed straight into politics.

### Starting point: what the economy does today
The economy is already dynamic: goods prices move with supply and demand every month, buildings run or go idle on profitability, investors build where it pays, pop incomes and living standards follow what each class can afford, and markets trade nationally, in blocs and with the world. But it settles back to normal: after a shock it drifts back toward a stable state. Nothing accumulates (no private debt or credit), there is no money or price level (prices are relative to fixed bases and capped at 0.25–4× base, so economy-wide inflation is impossible), and there are few delays and no expectations. Milestone 4 adds the missing ingredients. Before starting, measure today's behavior (GDP and price swings over 50 years across many seeds) as a baseline to compare against.

### Design rules
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
- **Journal / national goals:** objectives like "Industrialize", "Unify our people" or "Survive the crisis", with rewards. These make the sandbox feel directed.
- **A history book:** a generated chronicle of your reign, and a "verdict of history" score at an optional end date.

## Milestone 7: Smarter AI (M, ongoing)

- **Strategic goals per nation** shaped by the leader's personality: expand, industrialize, form a bloc, or seek revenge.
- **AI that uses every system the player can:** blocs, subjects, laws, research.
- **Diplomatic memory:** grudges, trust and broken promises.
- **Difficulty levels.**

## Milestone 8: Intrigue and dynasties (M)

- **Relationships between characters:** friends, rivals, lovers, mentors. Opinions between characters affect loyalty and plots.
- **Secrets and schemes:** blackmail, smear campaigns and assassination plots against you or by you. These build on the existing character actions.
- **Dynasties and family trees:** marriage alliances between royal houses, contested successions, regencies for child monarchs, and education of heirs.
- **Espionage:** spy networks, stealing technology, sabotage, election interference abroad.
- **Play as a character:** optionally play a person instead of a state, so losing power doesn't end your game. You could be the opposition leader or an exiled general.

---

## Quality of life (S each, can be slotted in anywhere)

- ✅ **Explain everything (first pass):** hover approval, stability, unrest, political capital, the treasury, infamy and wars for a breakdown of every part. Next: faction loyalty, growth, prices and pop needs.
- ✅ **Ledger:** graphs over time for your nation, comparisons between nations, and world market price history.
- **Outliner:** a side list of wars, movements, plots, constructions and upcoming elections.
- ✅ **Province panel:** click a province for its pops, buildings and resources.
- ✅ **Saves:** multiple save slots and a yearly autosave. Still to do: exporting and importing a save file.
- **Monthly newspaper:** a front page summing up the month in your nation and the world.
- **Settings:** colorblind-friendly map palettes, hotkeys, UI scale, and a lighter mobile layout.
- **Sound and music** (optional, toggleable).
- ✅ **Map polish:** a painted map with relief, ocean depth, hand-drawn borders and generated national flags. Still to do: rivers and city icons.
- ✅ **Visual overhaul:** brass-and-midnight theme, illustrated event scenes, a title screen with a live world preview.

## Platform (M each)

- **Performance:** run the simulation in a Web Worker so the UI never stutters on large Earth maps. Compress saves.
- **Data-driven content:** governments, goods, buildings, events, techs and campaigns defined in JSON so they're easy to extend.
- **Modding:** a mod loader for custom events, campaigns, governments and world models.
- **Editors:** a scenario and map editor to paint borders, place nations and write starting conditions.
- **Multiplayer:** hotseat first (the simulation is deterministic, which makes it feasible), later asynchronous online play.
- **Balance reports:** headless runs across hundreds of seeds, giving statistics on regime changes, wars, growth and living standards per version.

---

## Order

1. **Milestone 1:** empires, blocs, coalitions. It leans on the economy (customs unions, free-trade zones, special economic zones, investment treaties) as much as on politics.
2. ✅ **Quick wins:** number breakdowns, the ledger, the province panel and save slots, plus a visual overhaul. A deep economic simulation is only fun if you can see why things happen.
3. **Milestone 2:** laws and interest groups (first pass done).
4. **Milestone 3:** society, peoples and culture.
5. **Milestone 4:** deeper economy: money and inflation, credit and the business cycle, sticky wages and fiscal policy, then the world economy.
6. **Milestone 5:** military strategy as an operational layer (armies, orders, supply, encirclement, generals), built on everything above: war economy, mobilization from pops, war goals from nationalism.
7. **Milestones 6–8** as we go. Each big milestone ships with a new campaign chapter or campaign, and the AI improves alongside every system.
