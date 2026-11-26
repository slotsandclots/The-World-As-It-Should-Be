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

- **Company and ownership models:** private capitalists, state enterprises, cooperatives and foreign owners. The ownership mix shifts with laws, and nationalization and privatization become political decisions with winners and losers.
- **Production methods:** each building chooses how to work (e.g. labor-intensive or automated, coal or oil power), changing inputs, jobs and output. Technology unlocks new methods.
- **Finance:**
  - a central bank with interest rates, inflation and a currency
  - government bonds with a credit rating
  - banking crises
- **Foreign investment:** build in other nations' special economic zones, own foreign companies, and form multinationals.
- **Infrastructure per province:** roads, rail and ports limit how much a province can trade and produce. This replaces the single infrastructure slider.
- **Resource depletion, and an energy sector:** an electricity good with power plants that need fuel.
- **Sanctions, embargoes and trade routes:** shipping between markets, with chokepoints and straits.
- **Business cycles:** booms, recessions and depressions that emerge from investment, debt and prices instead of being scripted. Governments respond with stimulus or austerity.
- **Economic statistics:** GDP by sector, inflation, unemployment and trade balance in a ledger, and price history charts per good.

## Milestone 5: Military strategy (L)

- **Casus belli and claims:** you need a justification to declare war, which can be fabricated (by spies, or by inventing border incidents). Declaring war without one costs legitimacy and relations.
- **War goals and occupation:** declare war goals up front. Provinces are occupied during the war and transferred at peace, and a war score built from war goals replaces raw province counts.
- **Armies and fronts:** armies sit on fronts between nations, led by your generals (using their skill and traits). Mobilization draws soldiers from the pops and hurts the economy.
- **Navies:** fleets, naval invasions across straits and oceans, blockades that cut trade (plugging into the world market), and convoys.
- **Supply and attrition:** arms and fuel shortages already weaken armies, so this makes supply lines and front-line attrition explicit too.
- **War exhaustion politics:** casualty reports, anti-war movements, draft riots.
- **War economy:** converting factories to arms production, rationing, war bonds and price controls. These link the war to the economic and social model.
- **Military doctrine and branches:** army, air force and navy budgets; doctrines unlocked by technology; officer corps quality linked to education and the military interest group.
- **Strategic deterrence and proxy wars** for later eras: arming rebels and backing sides in other nations' civil wars.

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
5. **Milestone 4:** deeper economy.
6. **Milestone 5:** military strategy. It builds on everything above: war economy, mobilization from pops, war goals from nationalism.
7. **Milestones 6–8** as we go. Each big milestone ships with a new campaign chapter or campaign, and the AI improves alongside every system.
