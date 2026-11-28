'use strict';
// App controller: owns the game object, the clock and redraws.

// The daily clock (ROADMAP, "Time and pacing"): the calendar runs day by day at the
// player's speed. The simulation steps by the week (sim.js, SYSTEMS): the month's
// first week on the 1st, then the 8th, 15th and 22nd, so prices, reserves and money
// move within the month and each week's news comes in that week, on a day of its
// own. "Next month" (and the fastest speed) runs the whole month at once and shows
// all of it. Milliseconds per day, by speed: 1 slow (a year in about
// 2½ minutes), 2 normal (about a minute, the pace of a Victoria-style year),
// 3 fast, 4 very fast; 5 skips the days and steps a month at a time.
const DAY_MS = [0, 420, 165, 80, 30];
const MONTH_SKIP_MS = 220;
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function monthDays(m) { return MONTH_DAYS[((m % 12) + 12) % 12]; }
// The days the weekly steps fall on, and the week a day belongs to.
const WEEK_DAYS = [1, 8, 15, 22];
function weekOfDay(day) { return day >= 22 ? 3 : day >= 15 ? 2 : day >= 8 ? 1 : 0; }
// The calendar day for a game as it stands: the last day of the week it has reached
// (the 1st for a new game, which has not run a step yet).
function calendarDay(g) {
  if (!g || g.week == null) return 1;
  return g.week >= 3 ? monthDays(g.month) : WEEK_DAYS[g.week + 1] - 1;
}
// Does the game step by the week? (Every system monthly: one step a month.)
function weeklyGame() { return typeof SYSTEMS !== 'undefined' && baseStepMonths(SYSTEMS) < 1; }
// A day for a news line, spread evenly but fixed for each line: within its week
// when it carries one (sim.js, logNews), otherwise within the month.
function newsDay(l, days) {
  let h = 0;
  for (let i = 0; i < l.text.length; i++) h = (h * 31 + l.text.charCodeAt(i)) >>> 0;
  if (l.w == null) return 1 + (h % days);
  const start = WEEK_DAYS[l.w], end = l.w >= 3 ? days : WEEK_DAYS[l.w + 1] - 1;
  return start + (h % (end - start + 1));
}

const App = {
  game: null, renderer: null, speed: 0, timer: null, day: 1,

  newWorld(seed, opts) {
    this.setSpeed(0);
    const key = JSON.stringify([seed, opts]);
    this.game = this.preview && this.preview.key === key ? this.preview.game : createGame(seed, opts);
    this.day = calendarDay(this.game);
    this.preview = null;
    this.stash = null;
    if (this.renderer.world !== this.game.world) this.renderer.setWorld(this.game.world);
    UI.resetView();
    UI.choosing = true;
    UI.selected = null;
    UI.tab = 'overview';
    this.redraw();
    UI.refresh();
  },

  // Generate a world behind the title screen so the player can see it first.
  showPreview(seed, opts) {
    const key = JSON.stringify([seed, opts]);
    if (this.preview && this.preview.key === key) return;
    if (!this.stash && this.game && !this.preview) this.stash = { game: this.game, choosing: UI.choosing, day: this.day };
    const game = createGame(seed, opts);
    this.preview = { key, game };
    this.game = game;
    this.renderer.setWorld(game.world);
    UI.resetView();
    UI.choosing = true;
    UI.selected = null;
    this.redraw();
    UI.refresh();
  },

  // Put back the game that was running before the title screen opened.
  cancelPreview() {
    if (!this.stash) return;
    this.game = this.stash.game;
    this.day = this.stash.day || calendarDay(this.game);
    UI.choosing = this.stash.choosing;
    this.stash = null;
    this.preview = null;
    this.renderer.setWorld(this.game.world);
    UI.resetView();
    this.redraw();
    UI.refresh();
  },

  startCampaign() {
    this.setSpeed(0);
    this.preview = null;
    this.stash = null;
    this.game = startCampaign();
    this.day = calendarDay(this.game);
    this.renderer.setWorld(this.game.world);
    UI.resetView();
    UI.choosing = false;
    UI.selected = null;
    UI.tab = 'overview';
    this.redraw();
    UI.refresh();
  },

  startAs(id) {
    setPlayer(this.game, id);
    UI.choosing = false;
    UI.selected = null;
    UI.tab = 'overview';
    this.redraw();
    UI.refresh();
    UI.showIntro(this.game.countries[id]);
  },

  redraw() {
    const g = this.game;
    if (!g) return;
    this.renderer.render(g, { mode: UI.mapMode, selected: UI.selected, player: UI.choosing ? -1 : g.player });
    g.mapDirty = false;
  },

  setSpeed(s) {
    this.speed = s;
    clearInterval(this.timer);
    this.timer = null;
    if (s >= 5) this.timer = setInterval(() => this.step(false), MONTH_SKIP_MS);
    else if (s > 0) this.timer = setInterval(() => this.nextDay(), DAY_MS[s]);
    UI.renderTopbar();
  },

  // One day on the calendar; past the end of the month, the simulation steps.
  nextDay() {
    const g = this.game;
    if (!g || UI.choosing || g.player < 0 || UI.modalOpen() || UI.dragging) return;
    if (this.day >= monthDays(g.month)) { this.step(false, true); return; }
    this.day++;
    // A new week: the weekly systems run today, and the numbers on screen move with them.
    if (weeklyGame() && weekOfDay(this.day) > (g.week || 0)) { this.weekStep(); return; }
    const shown = this.datedNews();
    $('#tb-date').textContent = this.dateText();
    // New news today: redraw the open tab so it appears.
    if (shown && (UI.tab === 'news' || UI.tab === 'overview')) UI.renderTab();
  },

  dateText() {
    const g = this.game;
    return g ? `${this.day} ${gameDate(g)}` : '';
  },

  // Give each new line of news its day in the month (lines from the player's own actions: today).
  // Returns true if any line of this month became visible today.
  datedNews(today) {
    const g = this.game;
    if (!g) return false;
    const days = monthDays(g.month);
    let shown = false;
    for (let i = g.log.length - 1; i >= 0; i--) {
      const l = g.log[i];
      if (l.m < g.month) break;
      if (l.d == null) l.d = today ? this.day : newsDay(l, days);
      if (l.d === this.day) shown = true;
    }
    return shown;
  },

  // Has the calendar reached this line of news yet?
  newsVisible(l) {
    const g = this.game;
    return !g || l.m < g.month || l.d == null || l.d <= this.day;
  },

  // The week's step, on its first day (the 8th, 15th or 22nd).
  weekStep() {
    const g = this.game;
    while (!g.over && (g.week || 0) < weekOfDay(this.day)) { stepGame(g); if (!g.week) break; }
    this.datedNews();
    $('#tb-date').textContent = this.dateText();
    if (g.mapDirty || UI.mapMode !== 'political') this.redraw();
    UI.refresh();
    UI.processPending();
  },

  step(manual, daily) {
    const g = this.game;
    if (!g || UI.choosing || g.player < 0 || UI.modalOpen() || UI.dragging) return;
    tick(g);
    // A step by hand (or at the fastest speed) runs the rest of the new month's weeks too, so the month shown is complete.
    if (!daily && weeklyGame()) while (!g.over && (g.week || 0) < 3) stepGame(g);
    // Running day by day, the new month starts on the 1st and its news comes over its days.
    // A step by hand (or at the fastest speed) shows the whole month at once.
    this.datedNews();
    this.day = daily ? 1 : monthDays(g.month);
    if (g.month % 12 === 0 && g.player >= 0 && g.countries[g.player].alive) this.autosave();
    if (g.mapDirty || UI.mapMode !== 'political') this.redraw();
    UI.refresh();
    UI.processPending();
    if (manual) UI.renderTopbar();
  },

  afterAction() {
    const g = this.game;
    if (!g) return;
    this.datedNews(true);
    this.redraw();
    UI.refresh();
    UI.processPending();
  },

  async save(name, id) {
    const g = this.game;
    id = id || 'slot-' + Date.now().toString(36);
    try {
      await Saves.put(Saves.metaFor(g, id, name), serializeGame(g));
      UI.toast(`Game saved: ${name || g.countries[g.player].name}, ${gameDate(g)}.`, 'good');
    } catch (e) {
      console.error(e);
      UI.toast('Could not save: browser storage is unavailable or full.', 'bad');
    }
  },

  async autosave() {
    try { await Saves.put(Saves.metaFor(this.game, AUTOSAVE_ID, 'Autosave'), serializeGame(this.game)); } catch (e) { /* best effort */ }
  },

  async load(id) {
    let str = null;
    try { str = await Saves.get(id); } catch (e) { /* storage unavailable */ }
    if (!str) { UI.toast('That saved game could not be found.', 'bad'); return; }
    try {
      this.setSpeed(0);
      this.game = deserializeGame(str);
      // A game saved mid-month opens on the last day of the week it reached.
      this.day = calendarDay(this.game);
      this.preview = null;
      this.stash = null;
      UI.closeAllModals();
      this.renderer.setWorld(this.game.world);
      UI.resetView();
      UI.choosing = this.game.player < 0 || !this.game.countries[this.game.player].alive;
      UI.selected = null;
      UI.tab = 'overview';
      this.redraw();
      UI.refresh();
      UI.toast(`Loaded game from ${gameDate(this.game)}.`, 'good');
    } catch (e) {
      console.error(e);
      UI.toast(e.message && e.message.includes('older version') ? e.message : 'The saved game could not be loaded.', 'bad');
    }
  },
};

window.addEventListener('DOMContentLoaded', () => {
  App.renderer = new MapRenderer(document.getElementById('map'));
  UI.init();
  UI.showSetup(true);
});
