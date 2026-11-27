// Browser smoke test: node tools/browser-test.js
// Opens the game in headless Chromium, plays a few years in a generated world
// and the start of the campaign, visits every tab and map mode, and fails on
// any page error. Needs Playwright (npm install; npx playwright install chromium).
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message + '\n' + e.stack));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const drain = async () => {
    for (let k = 0; k < 10; k++) {
      const b = await page.$('.backdrop:last-child .modal-foot button:not([disabled])');
      if (!b) return;
      await b.click();
    }
  };
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));

  // Sandbox: a generated world, two years of play, every tab and map mode.
  await page.fill('#setup-seed', 'smoke');
  await page.click('text=Generate world');
  await page.click('#tab-body tr.click >> nth=0');
  await page.click('[data-act=lead]');
  for (let i = 0; i < 24; i++) { await drain(); await page.click('#btn-next'); }
  await drain();
  const tabs = await page.$$eval('#tabs [data-tab]', els => els.map(e => e.dataset.tab));
  for (const t of tabs) { await page.click(`#tabs [data-tab="${t}"]`); await drain(); }
  // Put the history systems on screen: a lost war's wound, a treaty, notable people and a world war.
  await page.evaluate(() => {
    const g = App.game, c = g.countries[g.player];
    const others = g.countries.filter(x => x.alive && x.id !== c.id);
    const W = woundOf(c); W.since = g.month; W.by = [others[0].id]; W.myth = 0.5; W.humiliation = 0.3; W.armyIntact = true;
    c.revanchism = 0.45; c.treaty = { until: g.month + 100, milCap: 1.5, by: W.by.slice(), since: g.month };
    c.figures.push(makeFigure(g, c, 'writer'), makeFigure(g, c, 'inventor'));
    const war = declareWar(g, others[0].id, others[1].id);
    for (const x of others.slice(2, 6)) joinWar(g, war, x.id, 'b');
    becomeWorldWar(g, war, 3);
  });
  await drain();
  for (const t of ['leader', 'politics', 'military', 'world', 'research']) { await page.click(`#tabs [data-tab="${t}"]`); await drain(); }
  await page.click('#tabs [data-tab="politics"]');
  await page.hover('[data-tip="revanchism"]');
  await page.click('#tabs [data-tab="leader"]');
  const fig = await page.$('[data-act="figure"][data-a="patronize"]:not([disabled])');
  if (fig) { await fig.click(); await drain(); }
  for (let i = 0; i < 3; i++) { await drain(); await page.click('#btn-next'); }
  await drain();
  await page.click('#tabs [data-tab="world"]');
  const modes = await page.$$eval('#map-modes [data-mode]', els => els.map(e => e.dataset.mode));
  for (const m of modes) { await page.click(`[data-mode="${m}"]`); }
  await page.mouse.move(500, 400);
  await page.mouse.wheel(0, -500);
  await page.click('#btn-menu'); await page.click('text=Save game');
  await page.click('.backdrop button:has-text("Save as new")');
  await page.waitForTimeout(300);
  await page.click('#btn-menu'); await page.click('.backdrop button:has-text("Load game")');
  await page.click('.backdrop [data-slot]');
  await page.waitForFunction(() => !document.querySelector('.backdrop'));
  const loaded = await page.textContent('#toast-root');
  if (!/Loaded game/.test(loaded)) errors.push('Loading a save slot failed: ' + loaded);
  await drain();

  // Campaign: the first briefing and objective.
  await page.click('#btn-menu'); await page.click('.backdrop button:has-text("Play the campaign")');
  await drain();
  const objective = await page.textContent('#campaign-box .cb-obj');

  console.log(`Visited ${tabs.length} tabs and ${modes.length} map modes; campaign objective: ${objective.trim()}`);
  await browser.close();
  if (errors.length) { console.error('Page errors:\n' + errors.join('\n')); process.exit(1); }
  console.log('Browser smoke test passed.');
})().catch(e => { console.error(e); process.exit(1); });
