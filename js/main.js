'use strict';
// App controller: owns the game object, the clock and redraws.

const SPEED_MS = [0, 1100, 550, 220];

const App = {
  game: null, renderer: null, speed: 0, timer: null,

  newWorld(seed, opts) {
    this.setSpeed(0);
    this.game = createGame(seed, opts);
    this.renderer.setWorld(this.game.world);
    UI.choosing = true;
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
    if (s > 0) this.timer = setInterval(() => this.step(false), SPEED_MS[s]);
    UI.renderTopbar();
  },

  step(manual) {
    const g = this.game;
    if (!g || UI.choosing || g.player < 0 || UI.modalOpen() || UI.dragging) return;
    tick(g);
    if (g.mapDirty || UI.mapMode !== 'political') this.redraw();
    UI.refresh();
    UI.processPending();
    if (manual) UI.renderTopbar();
  },

  afterAction() {
    const g = this.game;
    if (!g) return;
    this.redraw();
    UI.refresh();
    UI.processPending();
  },

  save() {
    try {
      localStorage.setItem(SAVE_KEY, serializeGame(this.game));
      UI.toast(`Game saved (${gameDate(this.game)}).`, 'good');
    } catch (e) {
      UI.toast('Could not save: browser storage is unavailable.', 'bad');
    }
  },

  load() {
    let str = null;
    try { str = localStorage.getItem(SAVE_KEY); } catch (e) { /* storage unavailable */ }
    if (!str) { UI.toast('No saved game found.', 'bad'); return; }
    try {
      this.setSpeed(0);
      this.game = deserializeGame(str);
      this.renderer.setWorld(this.game.world);
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
