# The World As It Should Be

A political simulator in the browser. Generate a random world, take control of any nation, and steer it through elections, coups, revolutions, wars and diplomacy. Turn your nation into the system you think the world should have, and try to stay in power while you do it.

## Play

No install or build step. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000. It can also be hosted as-is on GitHub Pages.

**New to the game?** Choose **Play the campaign: The First Republic** on the start screen. It's a short story campaign that teaches every system as you go.

## What's in it

**The First Republic: a story campaign and tutorial.** Lead the young Republic of Velmora after its king abdicates, guided by your chief of staff through eight chapters:
- forming a cabinet
- balancing the budget, plus markets, construction and pops
- a first election against the opposition leader
- a general's ultimatum
- a hostile junta next door
- research and a dockyard strike
- a common market with a neighbor, and a special economic zone
- the constitution, interest groups and their radical wings, and how wars are fought on the map

Briefings are written as dialogue with portraits. Objectives are checked against the live simulation and highlight the part of the screen to use. The ending depends on what kind of state you built.

**Eight world models**, each with random nations, leaders and histories (4–40 nations, three map sizes, any seed):

| Model | What you get |
|---|---|
| Continents | A few large continents and scattered islands |
| Supercontinent | One vast landmass: long land borders and crowded neighborhoods |
| Archipelago | Countless islands and straits |
| Twin Continents | An Old World and a New World across a wide ocean |
| Inland Sea | A ring of lands around a great central sea |
| Shattered Lands | Continents cracked by long rifts into peninsulas and channels |
| Earth | Our planet's real coastlines and mountain ranges, carved into fictional nations |
| Earth: Historical Regions | Earth with nations founded at the heartlands of real regions, so borders loosely echo history |

Nations border each other by land or across narrow straits.

**Seven forms of government**, each with its own rules:

| Government | Elections | Power base | Flavor |
|---|---|---|---|
| Liberal Democracy | Free, every 4 years | Intelligentsia, business, workers | High freedom and growth; you must win votes |
| Constitutional Monarchy | Free, every 4 years | Business, clergy, intelligentsia | The crown lends legitimacy; the PM faces voters |
| Absolute Monarchy | None | Clergy, military, business | Hereditary rule; successions are a gamble |
| Military Junta | None | Military | Strong army; disloyal officers mean another coup |
| Communist State | Single-list | Workers, military | Planned economy, high welfare, one party |
| Fascist State | None | Military, business | Maximum mobilization and aggression |
| Theocracy | None | Clergy | Rule by sacred law |

**Characters.** Every nation has a cast with skills (administration, diplomacy, military, charisma), traits, loyalty, ambition and procedurally drawn portraits:
- **Leader:** their skills and traits shape approval, corruption, relations and the army.
- **Cabinet:** a chief of staff plus ministers of the interior, finance, foreign affairs and defense, each running a department and bringing their faction's goodwill.
- **Generals:** they lead the army, and disloyal, ambitious ones stage coups.
- **Opposition:** party leaders and dissidents campaign against you; election winners and coup leaders come from this cast.
- **Royals:** monarchies have heirs and successions.
- **Foreign leaders:** they have personalities that drive their diplomacy.
- **Notable people:** writers, political thinkers and inventors (see below), and generals who make their names in battle.

Characters are managed from the Leader tab: appoint and dismiss ministers, honor, retire, arrest, smear or co-opt.

**Politics.**
- Five factions (military, workers, business, clergy, intelligentsia) react to your policies. Each regime's power base keeps it standing.
- Public opinion moves on a two-axis political compass. The gap between people and regime breeds unrest.
- Multi-party elections use proportional seats, polling and incumbency effects.
- Actions: campaigns, snap elections, ballot rigging, states of emergency, crackdowns, propaganda, purges and reforms.
- Lose an election and you can concede, or refuse and gamble on the army.
- **Political movements** (labor, agrarian, liberal, nationalist, religious, monarchist) grow out of aggrieved pops. They make demands, radicalize when ignored, and can rise up behind their own leaders. Meet their demands, suppress them, or co-opt their leaders.
- **Events** come in chains: scandals that break months later, ultimatums with follow-ups, election debates decided by charisma, dissident manifestos leading to round-table talks, and summits with foreign leaders.
- Below 30 stability (or above 55 unrest), coups and revolutions can topple any regime. A starving workforce turns communist and a humiliated nationalist one turns fascist. You can also attempt your own regime change.

**Pops and economy.**
- **Pops:** every province holds nine social classes: peasants, laborers, workers, soldiers, clerks, officials, clergy, capitalists and landowners. Each has a size, income, savings, standard of living and political lean. New jobs recruit from the peasantry; clerks and capitalists also need literacy.
- **Goods and production:** 16 goods made by 16 building types. Farms, ranches and plantations need arable land or pasture; mines, wells, logging camps and fishing fleets need the province's deposits. Factories chain together: iron + coal → steel → tools, arms and appliances; oil → fuel; fiber → clothes; timber → furniture.
- **Markets:** each nation has its own market. Prices follow supply and demand, shortages ration everyone, and surpluses and shortages are traded on a world market. Trade agreements open it up; tariffs, war and planned economies close it.
- **Needs:** pops buy basic needs, then everyday goods, then luxuries, and save the rest. Living standard against what each class expects drives approval and unrest. Poverty radicalizes, literacy liberalizes, and the class mix pulls public opinion.
- **Investment:** capitalists and landowners reinvest profits in the most profitable buildings. The state builds from its investment fund, automatically or on your orders. Communist states run everything as state enterprises.
- **The state is part of the economy:** taxes come from pop incomes; soldiers, officials and teachers draw state wages; the army buys arms (shortages weaken it); infrastructure spending buys steel, timber and tools.
- **Budget:** set taxes, tariffs and spending on the military, welfare, education, police, infrastructure and state investment. Deficits pile up debt, and at 150% of GDP the state defaults.

**Empires, blocs and federations.**
- **Subjects:** nations can be made protectorates, vassals, puppets or colonies through peace terms, protection offers or ultimatums. Subjects pay tribute and fight their overlord's wars. Their desire for independence grows with tribute, ideological distance and a weak overlord, and can end in a war of independence. Overlords can tighten or loosen control, invest, integrate peacefully, annex outright or set subjects free.
- **Releases:** conquered land can be returned to its people, or used to restore a fallen nation, independent or as a subject.
- **Blocs:** military pacts (collective defense), free-trade zones and customs unions (a shared market that trades tariff-free before the world market, with a common external tariff for customs unions) and confederations. Members vote on applicants; leaders invite, expel and set the tariff. A founding partner or invitee decides for itself, by relations, shared politics, threats and what the bloc offers, and the Blocs tab shows the chance it will accept. AI nations found and join blocs the same way, and turn each other down too.
- **Provinces:** click any province for its details. Your own can become special economic zones, autonomous regions or (if conquered) colonial administrations.
- **Separatism:** unintegrated conquests and federal states grow separatist movements, answered with autonomy, repression or a referendum. Large nations can federalize, and confederations can merge into one federation.
- **Coalitions:** with no majority (101 of 200 seats), parties form coalitions. Partners hold ministries and make policy demands; ignore them and they walk out, bringing the government down. Minority governments are possible but fragile.

**Technology.** 19 technologies across industry, land, society, military and statecraft. They're researched with points from education, literacy and the economy, and each gives specific bonuses: more productive buildings, a stronger army or defense, less corruption, better tax collection.

**War & diplomacy.**
- Relations follow ideological distance and leaders' diplomatic skill.
- Diplomatic actions: trade deals, defensive alliances (allies get called in), funding rebels to topple rival regimes, wars of conquest.
- Provinces change hands at the front. Take an enemy's capital (or most of its land) and it capitulates.
- **Conquest has costs:**
  - **Infamy:** wars of aggression and taking land raise infamy, which sours relations with everyone.
  - **Arms races:** threatened neighbors arm up and draw together.
  - **Coalitions:** high infamy can unite them in a coalition war against you.
  - **Occupation:** conquered land is occupied for five years (half output, unrest, possible revolts back to its old owner).
  - **Integration:** it then stays non-core for twenty years, with less tax, fewer soldiers, lower legitimacy and an overextension penalty to stability.
- **Difficulty:** Easy, Normal, Hard or Brutal. Higher levels make AI nations stronger, warier of you and quicker to fund insurgents.
- **Peace terms:** demand provinces, reparations or a change of regime. Each costs war score; a winning enemy will demand terms from you.

**Events.** Strikes, scandals, plotting colonels, student protests, booms, disasters, border incidents, opposition firebrands and more, each with choices.

**Map.** Scroll to zoom and drag to pan; smaller nations' names appear as you zoom in. Modes: political, government, stability, public opinion, terrain, resources, living standard, industry, your relations and trade. Hover a province to see its classes, buildings and resources.

The game saves to your browser's local storage (Menu → Save game).

**Laws and interest groups.** Nine law categories, from press freedom to the economic system. Bills take months, need votes in parliament (or the power base's backing), and stir up the interest groups they hurt. Each group's clout comes from the classes behind it, and each wants something changed. Drift far enough from tradition and your regime gets a new name: a Guided Democracy, a Plebiscitary Junta. Every group has a leader, moderate or radical, whom you can court, co-opt or discredit. Constitutional crises (a third term, impeachment, a disputed succession, an emergency that never ends) can remake the state, and AI nations go through them too. Elections are fought province by province, under proportional or winner-takes-all rules. Put a law to a referendum, and court, buy or censor the press barons who shape opinion.

**War on the map.** Battles are fought province by province along the front. Captured land is occupied, not annexed, until the peace. Hills and mountains favor defenders, encircled provinces fall faster, and overseas landings are hard to supply. Choose an offensive, balanced or defensive posture, and mobilize the reserves at the cost of your factories.

**Money and inflation.** Each nation has a currency, a price level and a monetary system: a gold standard, an independent central bank, or money the government controls and can print. Inflation follows money growth with the inertia of expectations; wages lag prices, so inflation squeezes workers and pensioners, erodes savings, and quietly shrinks the national debt. Print too much and you get hyperinflation.

**Booms and busts.** Businesses borrow to build when confidence is high and money is cheap. Debts pile up through a boom; when they outrun profits, firms default, real factories close and workers lose their jobs. Defaults eat into bank capital, and a banking crisis freezes lending (and, without deposit insurance, wipes out savings). Choose free banking, regulated banks or state banks, and decide whether to bail them out.

**Peoples and faiths.** Every province has its own mix of cultures and faiths. Citizenship laws decide whether minorities may vote and work for the state; exclusion breeds grievance, unrest and separatism, while coercion speeds assimilation at a price. People migrate toward work and away from war, carrying their culture with them, and nationalists claim the provinces abroad where their people live.

**Cities and people.** Cities grow with industry. When they outgrow their housing, rents rise (paid by working people to landlords) and slums spread, breeding unrest; builders and public housing respond. Families have fewer children as living standards and literacy rise, and societies age.

**Ideas and kin.** Liberalism, socialism, fascism and traditionalism spread between nations through borders, trade and alliances; a revolution next door inspires your own radicals. Related peoples can unite peacefully, and universities speed research and staff the state.

**Every import is paid for.** Exports earn foreign reserves and imports spend them; reparations are paid out of them too. Capital that finds no use at home, and banks with reserves to spare, lend to nations short of them at market rates: the more a nation owes, the more it pays. A default abroad costs the lending banks, and can start a banking crisis there. A currency falls as its reserves drain: imports grow dearer and the nation buys less abroad, while exporters earn more. A nation that can neither pay nor borrow has to ration its imports. On the gold standard the currency is held at a parity instead: deficits are paid in gold, so money shrinks and prices fall, and when the reserves run out speculators attack. Defend the parity with high interest rates while capital flees, or leave gold and let the currency fall. A floating currency that collapses scares foreign lenders away for a while. See the Balance of payments card in the Economy tab.

**Every debt is someone's asset.** The state pays from cash. Deficits are lent by savers (crowding out private investment), banks or foreign nations, who earn the interest. When lenders lose trust, yields climb, and if they refuse, bills go unpaid and spending is cut: a sovereign debt crisis. Defaulting hits the bondholders, the banks and your foreign creditors.

**Slumps hurt like real ones.** Wages are slow to fall, so a drop in demand becomes layoffs, and unemployment insurance cushions the jobless. AI governments spend, cut or bail out banks through the cycle, according to their politics.

**Notable people.** Every nation produces writers, political thinkers and inventors out of its pops: writers from a literate public (more with secondary schools and a free press), thinkers and inventors from the universities. Each has a talent, a renown that grows with every work and fades slowly, and politics of their own.
- **Writers'** books move public opinion and the idea currents at home, and famous ones are translated by trade partners and neighbors with a free press. Their themes follow the times: a lost war breeds grievance literature or anti-war novels, a slump breeds social novels, censorship breeds dissidents.
- **Thinkers'** treatises found schools of liberalism, socialism, fascism or traditionalism that travel further than any novel, and give the matching movement a doctrine.
- **Inventors** speed research in their field (up to about a third faster for a famous one), and breakthroughs jump-start a project.
- **Generals** gain renown and experience from every battle won. Famous ones learn to command (Blitz Commander, Defensive Genius), grow ambitious, and after a war may take off the uniform and lead a party.
- **Your options:** patronize them (a state prize: renown, and politics closer to the regime's; a laboratory for inventors) or, without a free press, ban their works, which may send them into exile, where they write on. AI governments do the same.
- **The World tab** lists the figures of the age everywhere, and the most renowned of the dead are remembered.

**The memory of defeat.** A nation that loses a war remembers it: the provinces it lost and the people living there, the terms it was made to sign, the reparations it still pays, and its war dead. Together they make **revanchism**, which rises quickly after a defeat and fades over a generation (faster in good times and as relations with the victors warm; it festers in hard times). It feeds the nationalist movement and fascist ideas, and makes AI governments rearm, look for revisionist allies and plan a war of revenge. Hover it in the Politics tab for every cause.
- **The stab in the back.** When the army comes home undefeated in the field (still mostly intact, the homeland mostly unoccupied), veterans insist it was never beaten, and more so if the peace was signed by elected politicians or a government that took over during the war. Tell the truth, honor the army and blame the traitors at home, or seek reconciliation with the victors. The myth turns the officers against a civilian government and drains its legitimacy, and nationalist writers, agitators and an angry army keep it alive.
- **Demagogues.** Once the grievance runs high, a demagogue rises at the head of the nationalist movement: a famous general who says the army was never beaten, the author of a grievance bestseller, or a decorated veteran with a gift for oratory. Their charisma draws crowds, and in a democracy they lead a nationalist party into elections, where a mass movement brings votes. They come to power by winning, by the movement's uprising, or by a coup, and in a republic they then ask parliament for the power to rule by decree.

**World wars.** Wars grow while they are fought. Each month, nations outside a war weigh joining it: allies whose friend is losing, pact members (pacts now close ranks against their leader's great-power rival), neighbors with claims or a grudge who see a chance, ideological crusaders, and great powers alarmed that one side is about to dominate. The great powers (the strongest quarter of the world by army and economy) build alliance systems against hostile rivals, and nations nursing a defeat sign revisionist pacts ("Axis") with each other.
- **When three great powers are drawn in** (with great powers on both sides, and the weaker side holding at least a third of the other's strength), the war becomes the Great War, then the Second World War, and so on. AI powers mobilize and turn their factories to arms, shipping is disrupted for every nation, exhausted belligerents are ripe for revolution, and a new revolutionary government may sign a separate peace, which its army will remember.
- **It ends at a peace conference.** The victors keep the occupied land where their people live, free the peoples the losers had conquered, and impose ten years of reparations and fifteen years of disarmament (a cap on military spending) on the great powers that lost. A beaten aggressor regime is replaced by the victors' system. The victors draw together in an alliance to guard the peace.
- **The next war grows out of the last peace.** The losers carry the wound, revanchist governments tear up the disarmament clauses once the victors look beatable, and a nation that has bled is slow to fight again. In balance runs, about half of the worlds see a world war within 40 years, and some see a second one.

**Who trades with whom.** Trade clears through each bloc's shared market and then the world market. The game splits it into flows between nations each month. The Trade map mode draws a line between trading partners, thicker for more trade, with a filter by good; hover a line to see what each side sells the other and what share of its imports it gets from the other. The Market tab lists who we buy each good from and sell it to, and the Diplomacy tab shows our trade with the selected nation and where either side depends on the other.

**Warnings before it's too late.** An alert bar under the top bar shows coup and revolution risk building up, and flags trouble in politics, the economy, society and war, plus decisions waiting for you.

**Seeing why.** Hover approval, stability, unrest, political capital or the treasury for a breakdown of what drives it. The Ledger tab charts your nation over time, compares you with your rivals, and tracks world market prices.

**Saves.** As many save slots as you like, plus an autosave every January. The title screen offers to continue your latest game.

## Code layout

| File | Purpose |
|---|---|
| `js/rng.js` | Seeded random numbers |
| `js/names.js` | Procedural names for nations, people and provinces |
| `js/governments.js` | Government types, factions, parties, traits |
| `js/earth-data.js` | Earth's land mask at 0.5° resolution (run-length encoded) |
| `js/mapgen.js` | World models (heightmaps) → land/sea → provinces → nations |
| `js/economy.js` | Pops, goods, buildings, markets, world trade, investment |
| `js/balance.js` | Infamy, coalitions, occupation, core land, arms races, difficulty |
| `js/empire.js` | Subjects, integration, annexation, releasing and restoring nations |
| `js/blocs.js` | Military pacts, free-trade zones, customs unions, confederations |
| `js/federal.js` | Province designations, separatism, federations |
| `js/coalitions.js` | Hung parliaments, coalition governments, partner demands |
| `js/laws.js` | Laws, bills, interest groups and their leaders, hybrid regime labels |
| `js/warfare.js` | Fronts, occupation, terrain and supply, posture, mobilization |
| `js/money.js` | Currency, price level, inflation, wages, interest rates, monetary systems |
| `js/fiscal.js` | State budget and debt: lenders, holders, debt crises, default |
| `js/time.js` | Time constants: the length of a step and the helpers that convert per-month rates, smoothing, chances and durations |
| `js/payments.js` | Balance of payments: reserves, foreign lending and debt, exchange rates, import rationing |
| `js/credit.js` | Private credit, confidence, defaults and bankruptcies, banking crises |
| `js/peoples.js` | Cultures, faiths, assimilation, grievance, migration, nationalist claims |
| `js/society.js` | Cities, housing and rents, slums, births and deaths, aging |
| `js/tradeflows.js` | Bilateral trade flows split from the pooled markets (accounting only), with a 12-month average |
| `js/ideas.js` | Universities, kinship and unification, ideas spreading between nations |
| `js/alerts.js` | Alert bar: coup and revolution risk, alerts by category |
| `js/arena.js` | Crises for AI nations, regional elections, referendums, press barons |
| `js/sim.js` | The monthly simulation: politics, elections, regime change, war, peace, diplomacy, actions, save/load |
| `js/characters.js` | Leaders, cabinets, generals, opposition, heirs; loyalty and succession |
| `js/portrait.js` | Procedural SVG portraits |
| `js/art.js` | Icons, generated national flags and illustrated event scenes |
| `js/tech.js` | Technology tree and research |
| `js/movements.js` | Political movements, demands and uprisings |
| `js/figures.js` | Notable people: writers, thinkers and inventors from the pops; generals' renown and command traits |
| `js/events.js` | Event engine (chains, flags, scheduled follow-ups) and the events themselves |
| `js/revanchism.js` | The memory of defeat: revanchism, the stab-in-the-back myth, demagogues, disarmament treaties |
| `js/worldwar.js` | Great powers, nations joining wars in progress, rival and revisionist pacts, world wars, peace conferences |
| `js/campaign.js` | The First Republic campaign: setup, story steps, endings |
| `js/render.js` | Painted map renderer (relief, smooth borders, ocean depth) and label overlay |
| `js/ui.js`, `js/ui-views.js`, `js/ui-dialogs.js` | Interface core and map interaction, tab views, dialogs |
| `js/saves.js` | Save slots in IndexedDB, autosave |
| `js/main.js` | Game clock, world previews and wiring |

## Tests and tools

```bash
npm test
```

`npm test` runs the headless test suite (`tools/test.js`) with no dependencies. It checks:
- every world model, and that generation is deterministic
- 25-year simulations for NaNs, bounded prices and non-negative populations
- save/load round-trips
- every event option and peace terms
- notable figures, the memory of defeat (myth, demagogue, enabling act) and a world war through its peace conference
- a full campaign playthrough

```bash
npm install
```

```bash
npx playwright install chromium
```

```bash
npm run test:browser
```

The browser smoke test (`tools/browser-test.js`) plays in headless Chromium and fails on any page error. GitHub Actions runs both suites on every push.

For balancing, `node tools/simtest.js <seed> <years>` reports politics and war, and `node tools/econtest.js <seed> <years>` reports prices, living standards and jobs.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for what's planned next.

## Credits

The Earth model's coastlines come from [Natural Earth](https://www.naturalearthdata.com/) 1:50m land data (public domain), via the [world-atlas](https://github.com/topojson/world-atlas) package (ISC). The polygons are rasterized into a 0.5° land mask in `js/earth-data.js`. Mountain ranges are hand-placed approximations.
