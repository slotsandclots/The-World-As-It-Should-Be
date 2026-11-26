'use strict';
// App controller: owns the game object, the clock and redraws.

const SPEED_MS = [0, 1100, 550, 220];

const App = {
  game: null, renderer: null, speed: 0, timer: null,

  newWorld(seed, opts) {
    this.setSpeed(0);
    const key = JSON.stringify([seed, opts]);
    this.game = this.preview && this.preview.key === key ? this.preview.game : createGame(seed, opts);
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
    if (!this.stash && this.game && !this.preview) this.stash = { game: this.game, choosing: UI.choosing };
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
    if (s > 0) this.timer = setInterval(() => this.step(false), SPEED_MS[s]);
    UI.renderTopbar();
  },

  step(manual) {
    const g = this.game;
    if (!g || UI.choosing || g.player < 0 || UI.modalOpen() || UI.dragging) return;
    tick(g);
    if (g.month % 12 === 0 && g.player >= 0 && g.countries[g.player].alive) this.autosave();
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
