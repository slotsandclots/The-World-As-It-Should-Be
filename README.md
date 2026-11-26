# The World As It Should Be

A political simulator in the browser. Generate a random world, take control of any nation, and steer it through elections, coups, revolutions, wars and diplomacy. Turn your nation into the system you think the world should have, and try to stay in power while you do it.

## Play

No install or build step. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000. It can also be hosted as-is on GitHub Pages.

## What's in it

**A randomly generated world.** Each seed builds its own continents, islands and provinces, plus 6–24 nations with procedural names, leaders and political histories. Nations border each other by land or across narrow straits.

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

**Politics.**
- Five factions (military, workers, business, clergy, intelligentsia) react to your policies. Each regime's power base keeps it standing.
- Public opinion moves on a two-axis political compass. The gap between people and regime breeds unrest.
- Multi-party elections use proportional seats, polling and incumbency effects.
- Actions: campaigns, snap elections, ballot rigging, states of emergency, crackdowns, propaganda, purges and reforms.
- Lose an election and you can concede, or refuse and gamble on the army.
- Below 30 stability (or above 55 unrest), coups and revolutions can topple any regime. A starving workforce turns communist and a humiliated nationalist one turns fascist. You can also attempt your own regime change.

**Pops and economy.**
- **Pops:** every province holds nine social classes: peasants, laborers, workers, soldiers, clerks, officials, clergy, capitalists and landowners. Each has a size, income, savings, standard of living and political lean. New jobs recruit from the peasantry; clerks and capitalists also need literacy.
- **Goods and production:** 16 goods made by 16 building types. Farms, ranches and plantations need arable land or pasture; mines, wells, logging camps and fishing fleets need the province's deposits. Factories chain together: iron + coal → steel → tools, arms and appliances; oil → fuel; fiber → clothes; timber → furniture.
- **Markets:** each nation has its own market. Prices follow supply and demand, shortages ration everyone, and surpluses and shortages are traded on a world market. Trade agreements open it up; tariffs, war and planned economies close it.
- **Needs:** pops buy basic needs, then everyday goods, then luxuries, and save the rest. Living standard against what each class expects drives approval and unrest. Poverty radicalizes, literacy liberalizes, and the class mix pulls public opinion.
- **Investment:** capitalists and landowners reinvest profits in the most profitable buildings. The state builds from its investment fund, automatically or on your orders. Communist states run everything as state enterprises.
- **The state is part of the economy:** taxes come from pop incomes; soldiers, officials and teachers draw state wages; the army buys arms (shortages weaken it); infrastructure spending buys steel, timber and tools.
- **Budget:** set taxes, tariffs and spending on the military, welfare, education, police, infrastructure and state investment. Deficits pile up debt, and at 150% of GDP the state defaults.

**War & diplomacy.**
- Relations follow ideological distance.
- Diplomatic actions: trade deals, defensive alliances (allies get called in), funding rebels to topple rival regimes, wars of conquest.
- Provinces change hands at the front. Take an enemy's capital (or most of its land) and it capitulates.

**Events.** Strikes, scandals, plotting colonels, student protests, booms, disasters, border incidents, opposition firebrands and more, each with choices.

**Map modes.** Political, government type, stability, public opinion, living standard, industrialization and your relations. Hover a province to see its classes, buildings and resources.

The game saves to your browser's local storage (Menu → Save game).

## Code layout

| File | Purpose |
|---|---|
| `js/rng.js` | Seeded random numbers |
| `js/names.js` | Procedural names for nations, people and provinces |
| `js/governments.js` | Government types, factions, parties, leader traits |
| `js/mapgen.js` | Heightmap → land/sea → provinces → nations |
| `js/economy.js` | Pops, goods, buildings, markets, world trade, investment |
| `js/sim.js` | The monthly simulation: economy, factions, elections, regime change, war, diplomacy, player actions, save/load |
| `js/events.js` | Player events and their choices |
| `js/render.js` | Canvas map renderer |
| `js/ui.js` | Panels, modals, tooltips |
| `js/main.js` | Game clock and wiring |
| `tools/simtest.js` | Headless politics/war balance test: `node tools/simtest.js <seed> <years>` |
| `tools/econtest.js` | Headless economy diagnostics (prices, living standards, jobs): `node tools/econtest.js <seed> <years>` |

The simulation has no DOM dependencies, so you can run it headless with Node for balancing:

```bash
node tools/simtest.js myseed 50
```
