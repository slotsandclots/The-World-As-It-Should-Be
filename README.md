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

**The First Republic: a story campaign and tutorial.** Lead the young Republic of Velmora after its king abdicates, guided by your chief of staff through seven chapters:
- forming a cabinet
- balancing the budget, plus markets, construction and pops
- a first election against the opposition leader
- a general's ultimatum
- a hostile junta next door
- research and a dockyard strike
- a common market with a neighbor, and a special economic zone

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
- **Blocs:** military pacts (collective defense), free-trade zones and customs unions (a shared market that trades tariff-free before the world market, with a common external tariff for customs unions) and confederations. Members vote on applicants; leaders invite, expel and set the tariff. AI nations found and join blocs too.
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

**Map.** Scroll to zoom and drag to pan; smaller nations' names appear as you zoom in. Modes: political, government, stability, public opinion, terrain, resources, living standard, industry and your relations. Hover a province to see its classes, buildings and resources.

The game saves to your browser's local storage (Menu → Save game).

**Laws and interest groups.** Nine law categories, from press freedom to the economic system. Bills take months, need votes in parliament (or the power base's backing), and stir up the interest groups they hurt. Each group's clout comes from the classes behind it, and each wants something changed. Drift far enough from tradition and your regime gets a new name: a Guided Democracy, a Plebiscitary Junta.

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
| `js/laws.js` | Laws, bills, interest-group clout and demands, hybrid regime labels |
| `js/sim.js` | The monthly simulation: politics, elections, regime change, war, peace, diplomacy, actions, save/load |
| `js/characters.js` | Leaders, cabinets, generals, opposition, heirs; loyalty and succession |
| `js/portrait.js` | Procedural SVG portraits |
| `js/art.js` | Icons, generated national flags and illustrated event scenes |
| `js/tech.js` | Technology tree and research |
| `js/movements.js` | Political movements, demands and uprisings |
| `js/events.js` | Event engine (chains, flags, scheduled follow-ups) and the events themselves |
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
