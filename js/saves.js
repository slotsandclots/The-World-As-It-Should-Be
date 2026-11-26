'use strict';
// Save slots. Games live in IndexedDB (plenty of room for many slots); if it
// is unavailable we fall back to localStorage. Each slot has a small metadata
// record (nation, date, flag) so the load screen does not have to open saves.

const SAVE_DB = 'twaisb', SAVE_LS_PREFIX = 'twaisb-slot-', SAVE_LS_INDEX = 'twaisb-slots';
const AUTOSAVE_ID = 'auto';

const Saves = {
  _db: null,

  open() {
    if (this._db) return this._db;
    this._db = new Promise((resolve) => {
      try {
        if (typeof indexedDB === 'undefined') return resolve(null);
        const req = indexedDB.open(SAVE_DB, 1);
        req.onupgradeneeded = () => { const db = req.result; db.createObjectStore('meta', { keyPath: 'id' }); db.createObjectStore('data'); };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch (e) { resolve(null); }
    });
    return this._db;
  },

  _tx(db, stores, mode, fn) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      const out = fn(tx);
      tx.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  },

  _lsIndex() { try { return JSON.parse(localStorage.getItem(SAVE_LS_INDEX) || '[]'); } catch (e) { return []; } },

  async list() {
    await this.migrateLegacy();
    const db = await this.open();
    let metas;
    if (db) metas = await this._tx(db, ['meta'], 'readonly', tx => tx.objectStore('meta').getAll());
    else metas = this._lsIndex();
    return (metas || []).sort((a, b) => b.savedAt - a.savedAt);
  },

  async put(meta, data) {
    meta.savedAt = Date.now();
    const db = await this.open();
    if (db) {
      await this._tx(db, ['meta', 'data'], 'readwrite', tx => { tx.objectStore('meta').put(meta); tx.objectStore('data').put(data, meta.id); });
      return;
    }
    localStorage.setItem(SAVE_LS_PREFIX + meta.id, data);
    const idx = this._lsIndex().filter(m => m.id !== meta.id);
    idx.push(meta);
    localStorage.setItem(SAVE_LS_INDEX, JSON.stringify(idx));
  },

  async get(id) {
    const db = await this.open();
    if (db) return this._tx(db, ['data'], 'readonly', tx => tx.objectStore('data').get(id));
    return localStorage.getItem(SAVE_LS_PREFIX + id);
  },

  async remove(id) {
    const db = await this.open();
    if (db) { await this._tx(db, ['meta', 'data'], 'readwrite', tx => { tx.objectStore('meta').delete(id); tx.objectStore('data').delete(id); }); return; }
    localStorage.removeItem(SAVE_LS_PREFIX + id);
    localStorage.setItem(SAVE_LS_INDEX, JSON.stringify(this._lsIndex().filter(m => m.id !== id)));
  },

  // Metadata shown on the load screen.
  metaFor(game, id, name) {
    const c = game.countries[game.player];
    return {
      id, name: name || (c ? c.name : 'Saved game'), auto: id === AUTOSAVE_ID, date: gameDate(game), month: game.month,
      nation: c ? c.name : '—', formal: c ? formalName(c) : '', color: c ? c.color : '#777', gov: c ? c.gov : 'democracy',
      model: game.world.model, seed: game.seed, campaign: !!game.campaign, v: SAVE_VERSION,
    };
  },

  // The single save slot from earlier versions becomes an ordinary slot.
  async migrateLegacy() {
    if (this._migrated) return;
    this._migrated = true;
    let str = null;
    try { str = localStorage.getItem('twaisb-save-v1'); } catch (e) { return; }
    if (!str) return;
    try {
      const d = JSON.parse(str);
      const c = d.countries && d.countries[d.player];
      const date = `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.month % 12]} ${d.startYear + Math.floor(d.month / 12)}`;
      await this.put({ id: 'legacy', name: c ? c.name : 'Saved game', auto: false, date, month: d.month, nation: c ? c.name : '—', formal: '', color: c ? c.color : '#777', gov: c ? c.gov : 'democracy', seed: d.seed, model: d.opts && d.opts.model, campaign: !!d.campaign, v: d.v }, str);
      localStorage.removeItem('twaisb-save-v1');
    } catch (e) { /* leave the old save alone */ }
  },
};
