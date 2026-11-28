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
  let yearPaper = null;
  for (let i = 0; i < 24; i++) {
    await drain(); await page.click('#btn-next');
    // The newspaper's year in review opens on the first of January.
    if (!yearPaper) yearPaper = await page.evaluate(() => { const m = document.querySelector('.backdrop .modal.paper'); return m ? m.textContent.slice(0, 200) : null; });
  }
  await drain();
  if (!yearPaper || !/The year in review/.test(yearPaper)) errors.push('The year in review did not open in January: ' + yearPaper);
  // ... and it can be opened again from the News tab.
  await page.click('#tabs [data-tab="news"]');
  const yb = await page.$('[data-act="yearpaper"]');
  if (!yb) errors.push('The News tab has no button for the year in review');
  else { await yb.click(); if (!(await page.$('.backdrop .modal.paper'))) errors.push('The year in review did not open from the News tab'); await drain(); }
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
  // The trade map mode: filter by a good, then hover a trade line.
  await page.click('[data-mode="trade"]');
  await page.selectOption('#trade-good', '0');
  await page.selectOption('#trade-good', '-1');
  const seg = await page.evaluate(() => { const s = (UI._tradeSegs || [])[0]; if (!s) return null; const wr = document.querySelector('#map-wrap').getBoundingClientRect(); const t = 0.5; return { x: wr.left + (1 - t) * (1 - t) * s.x1 + 2 * (1 - t) * t * s.cx + t * t * s.x2, y: wr.top + (1 - t) * (1 - t) * s.y1 + 2 * (1 - t) * t * s.cy + t * t * s.y2 }; });
  if (seg) { await page.mouse.move(seg.x, seg.y); const tipText = await page.textContent('#map-tooltip'); if (!/Trade:/.test(tipText)) errors.push('Hovering a trade line shows no trade tooltip: ' + tipText.slice(0, 80)); }
  else errors.push('The trade map mode drew no trade lines.');
  // The daily clock runs the weekly steps on their days, and each week's news comes in its week.
  const clock = await page.evaluate(() => {
    const g = App.game, keep = UI.modalOpen;
    UI.modalOpen = () => false;
    try {
      App.setSpeed(0);
      UI.tab = 'economy'; UI.renderTab();
      App.step(false, true);
      const m = g.month, days = monthDays(m), weeks = [], grain = [];
      weeks.push([App.day, g.week]);
      grain.push(g.countries[g.player].econ.prices.grain);
      // Numbers that slide: the top bar's approval, stability and treasury between the monthly updates.
      const bar = () => ['approval', 'stability', 'treasury'].map(k => { const el = document.querySelector(`#tb-stats [data-tip="${k}"] b`); return el ? el.textContent : ''; }).join('|');
      const shownBars = [bar()], tabFigures = [], tabFigure = () => { const el = document.querySelector('#tab-body [data-slide="reserves"]'), sl = UI.slides && UI.slides['tab:reserves']; if (!el || !sl) return ''; const v = UI.slideAt(sl, App.calIndex()); return el.textContent === UI.slideFmt.reserves(v) ? String(v) : 'text not redrawn'; };
      while (App.day < days) { App.nextDay(); weeks.push([App.day, g.week]); shownBars.push(bar()); if (![8, 15, 22].includes(App.day)) tabFigures.push(tabFigure()); if ([8, 15, 22].includes(App.day)) grain.push(g.countries[g.player].econ.prices.grain); }
      const c = g.countries[g.player];
      var slid = new Set(shownBars).size, settled = Math.round(c.approval) + '|' + Math.round(c.stability);
      const lines = g.log.filter(l => l.m === m);
      const misplaced = lines.filter(l => l.w != null && l.d != null && (l.d < [1, 8, 15, 22][l.w] || (l.w < 3 && l.d >= [1, 8, 15, 22][l.w + 1]))).length;
      return { m, month: g.month, weeks, grain, lines: lines.length, weekly: lines.filter(l => l.w > 0).length, misplaced, text: App.dateText(), slid, tabSlid: new Set(tabFigures).size, tabText: tabFigures.includes('text not redrawn'), tabHas: tabFigures.some(Boolean), last: shownBars[shownBars.length - 1], settled };
    } finally { UI.modalOpen = keep; }
  });
  const wk = Object.fromEntries(clock.weeks);
  if (clock.month !== clock.m) errors.push('The daily clock left the month early: ' + JSON.stringify(clock.weeks));
  if (!(wk[1] === 0 && wk[7] === 0 && wk[8] === 1 && wk[14] === 1 && wk[15] === 2 && wk[22] === 3 && wk[28] === 3)) errors.push('Weekly steps should fall on the 1st, 8th, 15th and 22nd: ' + JSON.stringify(clock.weeks));
  if (new Set(clock.grain).size < 3) errors.push('Prices should move from week to week: ' + clock.grain.join(', '));
  if (clock.misplaced) errors.push(clock.misplaced + ' news lines were shown outside their week');
  if (clock.tabText) errors.push('The Economy tab\'s sliding figures were not redrawn day by day');
  if (!clock.tabHas || clock.tabSlid < 2) errors.push('The Economy tab\'s weekly figures (reserves) should slide between updates: ' + clock.tabSlid + ' different values');
  if (clock.slid < 2) errors.push('The top bar should move between updates: ' + clock.slid + ' different readings in a month');
  if (!clock.last.startsWith(clock.settled + '|')) errors.push('By the end of the month the top bar should show the real values: ' + clock.last + ' vs ' + clock.settled);
  console.log(`Sliding top bar: ${clock.slid} different readings over the month, ending at ${clock.last}.`);
  console.log(`Daily clock: ${clock.lines} news lines in ${clock.text.replace(/^\d+ /, '')}, ${clock.weekly} of them from weeks 2–4; grain price by week ${clock.grain.map(x => x.toFixed(3)).join(' → ')}.`);
  await page.click('#tabs [data-tab="market"]');
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
