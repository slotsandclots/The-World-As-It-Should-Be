# Roadmap

Where the game is going. Sizes are rough: **S** = a session, **M** = a few, **L** = a major milestone.

## Done

- World generation: seven procedural models, Earth, and Earth with historical regions
- Seven government types, factions, public opinion, elections, coups and revolutions
- Pops, goods, buildings, national markets and world trade
- Characters: leaders, cabinets, generals, opposition, heirs
- Political movements, technology, peace terms
- Event engine with chains and story flags
- Tutorial campaign "The First Republic"
- Map zoom and pan, test suites, CI

---

## Milestone 1: Empires, blocs and coalitions (L)

The next build. Turns the map from a set of independent states into a web of hierarchies and blocs.

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

- **Law categories:** head of state, legislature, suffrage, elections, press freedom, assembly, church and state, labor rights, economic system (laissez-faire, interventionist, planned), land ownership, citizenship, policing, conscription and term limits.
- **Government names follow the laws:** the current seven types become presets, and hybrids appear naturally (an elected monarchy, a one-party technocracy, a guided democracy).
- **Passing laws:** a law has to get through the legislature (or the power base, in autocracies). Each attempt takes months, can stall, and can provoke a backlash.
- **Interest groups:** the current factions grow into political actors drawn from the pops. Each has a leader character, approval, demands and clout.
- **Constitutional crises:** term limits, failed impeachments, succession disputes and states of exception, each with its own event chain.

## Milestone 3: Military 2.0 (L)

- **Casus belli and claims:** you need a justification to declare war, which can be fabricated (by spies, or by inventing border incidents). Declaring war without one costs legitimacy and relations.
- **War goals and occupation:** declare war goals up front. Provinces are occupied during the war and transferred at peace, and a war score built from war goals replaces raw province counts.
- **Armies and fronts:** armies sit on fronts between nations, led by your generals (using their skill and traits). Mobilization draws soldiers from the pops and hurts the economy.
- **Navies:** fleets, naval invasions across straits and oceans, blockades that cut trade (plugging into the world market), and convoys.
- **Supply and attrition:** arms and fuel shortages already weaken armies, so this makes supply lines and front-line attrition explicit too.
- **War exhaustion politics:** casualty reports, anti-war movements, draft riots.

## Milestone 4: Peoples, culture and religion (L)

- **Cultures and religions on pops:** majority and minority groups, with discrimination or acceptance laws, assimilation and religious conversion.
- **Migration:** pops move between provinces and nations toward jobs and safety, and refugees flee wars.
- **Nationalism:** irredentist claims ("our people across the border"), pan-national unification movements and separatism. These feed 1c and Milestone 3.
- **Cities and urbanization:** cities on the map that grow with industry, plus urban unrest.

## Milestone 5: Deeper economy (M–L)

- **Production methods:** each building chooses how to work (e.g. labor-intensive or automated, coal or oil power), changing inputs, jobs and output. Technology unlocks new methods.
- **Finance:**
  - a central bank with interest rates, inflation and a currency
  - government bonds with a credit rating
  - banking crises
- **Foreign investment:** build in other nations' special economic zones, own foreign companies, and form multinationals.
- **Infrastructure per province:** roads, rail and ports limit how much a province can trade and produce. This replaces the single infrastructure slider.
- **Resource depletion, and an energy sector:** an electricity good with power plants that need fuel.
- **Sanctions, embargoes and trade routes:** shipping between markets, with chokepoints and straits.

## Milestone 6: Intrigue and dynasties (M)

- **Relationships between characters:** friends, rivals, lovers, mentors. Opinions between characters affect loyalty and plots.
- **Secrets and schemes:** blackmail, smear campaigns and assassination plots against you or by you. These build on the existing character actions.
- **Dynasties and family trees:** marriage alliances between royal houses, contested successions, regencies for child monarchs, and education of heirs.
- **Espionage:** spy networks, stealing technology, sabotage, election interference abroad.
- **Play as a character:** optionally play a person instead of a state, so losing power doesn't end your game. You could be the opposition leader or an exiled general.

## Milestone 7: Eras and scenarios (M each)

- **Start dates:** 1836, 1914, 1950 (the current one) and 2000. Each has era-appropriate goods, technologies, ideologies and governments.
- **Era transitions:** industrialization, decolonization, a cold war of blocs, the digital age, and new ideologies (environmentalism, theocratic revival, technocracy).
- **More campaigns** in the style of "The First Republic":
  - an autocrat's story ("The General's Dilemma")
  - a monarch's ("The Last Crown")
  - a revolutionary's ("Year Zero")
  - an imperial collapse ("The Long Retreat")
- **Journal / national goals:** objectives like "Industrialize", "Unify our people" or "Survive the crisis", with rewards. These make the sandbox feel directed.
- **A history book:** a generated chronicle of your reign, and a "verdict of history" score at an optional end date.

## Milestone 8: Smarter AI (M, ongoing)

- **Strategic goals per nation** shaped by the leader's personality: expand, industrialize, form a bloc, or seek revenge.
- **AI that uses every system the player can:** blocs, subjects, laws, research.
- **Diplomatic memory:** grudges, trust and broken promises.
- **Difficulty levels.**

---

## Quality of life (S each, can be slotted in anywhere)

- **Explain everything:** a tooltip breakdown for every number ("Approval 54 = base 50 + contentment +6 − taxes −4 …"). This is the most-asked-for feature in games like this.
- **Ledger:** graphs over time for every nation, with comparisons.
- **Outliner:** a side list of wars, movements, plots, constructions and upcoming elections.
- **Province panel:** click a province for its pops, buildings, resources and history.
- **Saves:** multiple save slots, autosave, and exporting/importing a save file.
- **Monthly newspaper:** a front page summing up the month in your nation and the world.
- **Settings:** colorblind-friendly map palettes, hotkeys, UI scale, and a lighter mobile layout.
- **Sound and music** (optional, toggleable).
- **Map polish:** rivers, city icons, a prettier ocean and borders, and nation flags generated from colors and symbols.

## Platform (M each)

- **Performance:** run the simulation in a Web Worker so the UI never stutters on large Earth maps. Compress saves.
- **Data-driven content:** governments, goods, buildings, events, techs and campaigns defined in JSON so they're easy to extend.
- **Modding:** a mod loader for custom events, campaigns, governments and world models.
- **Editors:** a scenario and map editor to paint borders, place nations and write starting conditions.
- **Multiplayer:** hotseat first (the simulation is deterministic, which makes it feasible), later asynchronous online play.
- **Balance reports:** headless runs across hundreds of seeds, giving statistics on regime changes, wars, growth and living standards per version.

---

## Suggested order

1. **Milestone 1** (empires, blocs, coalitions): agreed.
2. **Quick wins:** number breakdowns, the province panel and save slots. They're cheap and make every other system easier to understand.
3. **Milestone 2** (laws and interest groups): the biggest increase in political depth.
4. **Milestone 3** (Military 2.0).
5. **Milestone 4** (peoples and culture): it feeds federations, separatism and war claims.
6. **The rest** as interest dictates, with a new campaign shipped alongside each major milestone.
