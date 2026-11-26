'use strict';
// DOM user interface: top bar, side panel tabs, modals, toasts, map tooltip.

const $ = (s, r) => (r || document).querySelector(s);
function esc(s) { return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }

function fmtMoney(b) {
  const a = Math.abs(b), s = b < 0 ? '−' : '';
  if (a >= 1000) return `${s}$${(a / 1000).toFixed(2)}T`;
  if (a >= 1) return `${s}$${a.toFixed(1)}B`;
  return `${s}$${(a * 1000).toFixed(0)}M`;
}
function fmtPop(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'k';
  return String(Math.round(n));
}
function fmtSigned(v, d) { const s = v.toFixed(d === undefined ? 1 : d); return v > 0 ? '+' + s : s.replace('-', '−'); }
function pct(v, d) { return (v * 100).toFixed(d === undefined ? 0 : d) + '%'; }
function statColor(v, invert) { const x = invert ? 100 - v : v; return `hsl(${clamp(x, 0, 100) * 1.2}, 62%, 50%)`; }

function bar(label, v, opts) {
  opts = opts || {};
  return `<div class="stat" title="${esc(opts.tip || '')}"><div class="stat-top"><span>${label}</span><span>${opts.text !== undefined ? opts.text : Math.round(v)}</span></div>` +
    `<div class="bar"><i style="width:${clamp(v, 0, 100)}%;background:${opts.color || statColor(v, opts.invert)}"></i></div></div>`;
}

function spark(values, color) {
  if (!values || values.length < 2) return '<svg class="spark"></svg>';
  const vs = values.slice(-120);
  const min = Math.min(...vs), max = Math.max(...vs);
  const span = max - min || 1;
  const pts = vs.map((v, i) => `${(i / (vs.length - 1) * 100).toFixed(2)},${(34 - (v - min) / span * 30).toFixed(2)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 100 36" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
}

function govBadge(id) { return `<span class="badge" style="background:${GOVS[id].color}">${GOVS[id].short}</span>`; }
function swatch(c) { return `<span class="swatch" style="background:${c.color}"></span>`; }

function ideologyText(ideo) {
  const e = ideo.econ, a = ideo.auth;
  const et = e < -0.5 ? 'strongly left-wing' : e < -0.15 ? 'left-leaning' : e < 0.15 ? 'economically centrist' : e < 0.5 ? 'right-leaning' : 'strongly right-wing';
  const at = a < -0.5 ? 'strongly libertarian' : a < -0.15 ? 'liberal' : a < 0.15 ? 'moderate on authority' : a < 0.5 ? 'authoritarian-leaning' : 'strongly authoritarian';
  return `${et}, ${at}`;
}

function compassSVG(c, size) {
  size = size || 220;
  const m = 12, s = size - m * 2;
  const X = e => m + (e + 1) / 2 * s, Y = a => m + (1 - (a + 1) / 2) * s;
  const g = GOVS[c.gov];
  let out = `<svg class="compass" viewBox="0 0 ${size} ${size}">` +
    `<rect x="${m}" y="${m}" width="${s / 2}" height="${s / 2}" fill="#5a2a2a"/>` +
    `<rect x="${m + s / 2}" y="${m}" width="${s / 2}" height="${s / 2}" fill="#2a3a5a"/>` +
    `<rect x="${m}" y="${m + s / 2}" width="${s / 2}" height="${s / 2}" fill="#2a4a32"/>` +
    `<rect x="${m + s / 2}" y="${m + s / 2}" width="${s / 2}" height="${s / 2}" fill="#4a4426"/>` +
    `<line x1="${m}" y1="${m + s / 2}" x2="${m + s}" y2="${m + s / 2}" stroke="#ffffff40"/>` +
    `<line x1="${m + s / 2}" y1="${m}" x2="${m + s / 2}" y2="${m + s}" stroke="#ffffff40"/>` +
    `<text x="${size / 2}" y="9" fill="#aab" font-size="9" text-anchor="middle">Authoritarian</text>` +
    `<text x="${size / 2}" y="${size - 2}" fill="#aab" font-size="9" text-anchor="middle">Libertarian</text>` +
    `<text x="3" y="${size / 2 - 4}" fill="#aab" font-size="9">Left</text>` +
    `<text x="${size - 3}" y="${size / 2 - 4}" fill="#aab" font-size="9" text-anchor="end">Right</text>`;
  if (g.party === 'multi') {
    for (const p of c.parties) out += `<circle cx="${X(p.econ)}" cy="${Y(p.auth)}" r="4.5" fill="${p.color}" stroke="#000" stroke-width="0.8"><title>${esc(p.name)}</title></circle>`;
  }
  out += `<rect x="${X(g.econ) - 6}" y="${Y(g.auth) - 6}" width="12" height="12" fill="${g.color}" stroke="#fff" stroke-width="1.5"><title>${g.name} (the regime)</title></rect>`;
  out += `<circle cx="${X(c.ideo.econ)}" cy="${Y(c.ideo.auth)}" r="7" fill="#fff" stroke="#000" stroke-width="1.5"><title>The public</title></circle>`;
  out += `<circle cx="${X(c.ideo.econ)}" cy="${Y(c.ideo.auth)}" r="2.5" fill="#000"/>`;
  return out + '</svg>';
}

const FX_LABELS = {
  approval: 'Approval', stability: 'Stability', unrest: 'Unrest', freedom: 'Freedom', corruption: 'Corruption',
  legitimacy: 'Legitimacy', pc: 'Political capital', military: 'Military', workers: 'Workers', business: 'Business',
  clergy: 'Clergy', intelligentsia: 'Intelligentsia',
};
function describeEffects(fx) {
  return Object.entries(fx || {}).map(([k, v]) => {
    let txt, good;
    if (k === 'money') { txt = `${v > 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)}% of GDP`; good = v > 0; }
    else if (k === 'econ') { txt = v < 0 ? 'Public shifts left' : 'Public shifts right'; good = null; }
    else if (k === 'auth') { txt = v > 0 ? 'Public grows authoritarian' : 'Public grows liberal'; good = null; }
    else { txt = `${v > 0 ? '+' : '−'}${Math.abs(v)} ${FX_LABELS[k] || k}`; good = (k === 'unrest' || k === 'corruption') ? v < 0 : v > 0; }
    return `<span class="fx ${good === null ? '' : good ? 'good' : 'bad'}">${txt}</span>`;
  }).join('');
}

const TABS = [['overview', 'Nation'], ['leader', 'Leader'], ['politics', 'Politics'], ['economy', 'Economy'], ['market', 'Market'], ['pops', 'Pops'], ['research', 'Research'], ['military', 'Military'], ['diplomacy', 'Diplomacy'], ['blocs', 'Blocs'], ['world', 'World'], ['news', 'News']];
const SAVE_KEY = 'twaisb-save-v1';

const UI = {
  tab: 'overview', selected: null, mapMode: 'political', choosing: false, dragging: false,
  modals: [], worldSort: 'gdp', newsMine: false,

  get game() { return App.game; },
  player() { const g = App.game; return g && g.player >= 0 && g.countries[g.player].alive ? g.countries[g.player] : null; },

  init() {
    $('#tabs').innerHTML = TABS.map(([id, label]) => `<button data-tab="${id}">${label}</button>`).join('');
    $('#tabs').addEventListener('click', e => {
      const b = e.target.closest('[data-tab]');
      if (!b || this.choosing) return;
      this.tab = b.dataset.tab;
      $('#tab-body').scrollTop = 0;
      this.renderTab();
    });
    const body = $('#tab-body');
    body.addEventListener('click', e => {
      const el = e.target.closest('[data-act]');
      if (!el || el.disabled) return;
      if (el.tagName === 'A') e.preventDefault();
      this.handleAct(el.dataset.act, el.dataset);
    });
    body.addEventListener('input', e => {
      const el = e.target;
      if (el.dataset.bloctariff) { setBlocTariff(App.game, +el.dataset.bloctariff, parseFloat(el.value)); const lb = $('#bt-' + el.dataset.bloctariff); if (lb) lb.textContent = pct(+el.value); return; }
      if (!el.dataset.policy) return;
      const c = this.player();
      if (!c) return;
      c.policy[el.dataset.policy] = parseFloat(el.value);
      this.updatePolicyLabels();
    });
    body.addEventListener('pointerdown', e => { if (e.target.matches('input[type=range]')) this.dragging = true; });
    window.addEventListener('pointerup', () => { if (this.dragging) { this.dragging = false; this.renderTopbar(); } });

    document.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => App.setSpeed(+b.dataset.speed)));
    $('#btn-next').addEventListener('click', () => App.step(true));
    $('#btn-menu').addEventListener('click', () => this.showMenu());

    const canvas = $('#map');
    canvas.addEventListener('mousemove', e => this.onMapMove(e));
    canvas.addEventListener('mouseleave', () => $('#map-tooltip').classList.add('hidden'));
    canvas.addEventListener('click', e => this.onMapClick(e));

    const modes = $('#map-modes');
    modes.innerHTML = Object.entries(MAP_MODES).map(([k, m]) => `<button data-mode="${k}">${m.name}</button>`).join('');
    modes.addEventListener('click', e => {
      const b = e.target.closest('[data-mode]');
      if (!b) return;
      this.mapMode = b.dataset.mode;
      App.redraw();
      this.renderMapModes();
    });
    this.initZoom();
    const legend = document.createElement('div');
    legend.id = 'map-legend';
    $('#map-wrap').appendChild(legend);

    window.addEventListener('keydown', e => {
      if (e.target.matches('input, select, textarea') || this.modalOpen()) return;
      if (e.code === 'Space') { e.preventDefault(); App.setSpeed(App.speed ? 0 : 1); }
      else if (e.key === '1' || e.key === '2' || e.key === '3') App.setSpeed(+e.key);
      else if (e.key === 'n' || e.key === 'N') App.step(true);
    });
  },


  view: { z: 1, x: 0, y: 0 },

  initZoom() {
    const wrap = $('#map-wrap'), inner = $('#map-inner');
    this.labels = new LabelLayer($('#labels'), wrap, App.renderer);
    App.renderer.onRender = () => this.drawLabels();
    const apply = () => { inner.style.transform = `translate(${this.view.x}px, ${this.view.y}px) scale(${this.view.z})`; this.drawLabels(); };
    this.applyView = apply;
    const zoomAt = (px, py, factor) => {
      const z = clamp(this.view.z * factor, 1, 10);
      const k = z / this.view.z;
      this.view.x = px - (px - this.view.x) * k;
      this.view.y = py - (py - this.view.y) * k;
      this.view.z = z;
      if (z === 1) { this.view.x = 0; this.view.y = 0; }
      apply();
    };
    wrap.addEventListener('wheel', e => {
      if (!App.game) return;
      e.preventDefault();
      const r = wrap.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
    let drag = null;
    wrap.addEventListener('pointerdown', e => {
      if (e.button !== 0 || !e.target.closest('#map')) return;
      drag = { x: e.clientX, y: e.clientY, vx: this.view.x, vy: this.view.y, moved: false };
    });
    window.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      drag.moved = true;
      wrap.classList.add('panning');
      this.view.x = drag.vx + dx; this.view.y = drag.vy + dy;
      apply();
    });
    window.addEventListener('pointerup', () => {
      if (drag && drag.moved) { this.suppressClick = true; setTimeout(() => { this.suppressClick = false; }, 0); }
      drag = null;
      wrap.classList.remove('panning');
    });
    document.querySelectorAll('[data-zoom]').forEach(b => b.addEventListener('click', () => {
      const r = wrap.getBoundingClientRect();
      if (b.dataset.zoom === 'reset') { this.view = { z: 1, x: 0, y: 0 }; apply(); }
      else zoomAt(r.width / 2, r.height / 2, b.dataset.zoom === 'in' ? 1.5 : 1 / 1.5);
    }));
    window.addEventListener('resize', () => this.drawLabels());
  },

  drawLabels() {
    const g = App.game;
    if (!this.labels) return;
    this.labels.draw(g, this.selected, g && !this.choosing ? g.player : -1);
  },

  resetView() { this.view = { z: 1, x: 0, y: 0 }; if (this.applyView) this.applyView(); },


  refresh() {
    this.renderTopbar();
    if (!this.dragging) this.renderTab();
    this.renderMapModes();
    this.campaignCheck();
  },

  renderTopbar() {
    const g = App.game, c = this.player();
    $('#tb-date').textContent = g ? gameDate(g) : '';
    $('#tb-nation').innerHTML = c ? `${swatch(c)}<span>${esc(c.name)}</span>${govBadge(c.gov)}` : (this.choosing ? '<span class="muted">Choose your nation</span>' : '');
    if (c) {
      const atWar = isAtWar(g, c.id);
      const net = c.budget ? c.budget.net : 0;
      $('#tb-stats').innerHTML =
        `<span class="chip" title="Treasury (monthly balance ${fmtMoney(net)})">💰 <b class="${c.treasury < 0 ? 'bad' : ''}">${fmtMoney(c.treasury)}</b> <span class="${net < 0 ? 'bad' : 'good'}">${net >= 0 ? '▲' : '▼'}</span></span>` +
        `<span class="chip" title="Political capital: spent on actions">★ <b>${Math.floor(c.pc)}</b> PC</span>` +
        `<span class="chip" title="Public approval">Approval <b style="color:${statColor(c.approval)}">${Math.round(c.approval)}</b></span>` +
        `<span class="chip" title="Stability: below ${CRISIS_LEVEL} risks coups and revolutions">Stability <b style="color:${statColor(c.stability)}">${Math.round(c.stability)}</b></span>` +
        (atWar ? '<span class="chip bad" title="At war">⚔ At war</span>' : '') +
        (c.emergency ? '<span class="chip warn">State of emergency</span>' : '');
    } else $('#tb-stats').innerHTML = '';
    document.querySelectorAll('[data-speed]').forEach(b => {
      b.classList.toggle('active', +b.dataset.speed === App.speed);
      b.disabled = !c;
    });
    $('#btn-next').disabled = !c;
    document.querySelectorAll('#tabs button').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === this.tab && !this.choosing);
      b.disabled = this.choosing;
    });
    $('#choose-banner').classList.toggle('hidden', !this.choosing);
  },

  renderMapModes() {
    document.querySelectorAll('#map-modes [data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === this.mapMode));
    const lg = $('#map-legend');
    if (!lg) return;
    if (this.mapMode === 'government') {
      lg.innerHTML = GOV_ORDER.map(k => `<div class="row"><span class="swatch" style="background:${GOVS[k].color}"></span>${GOVS[k].name}</div>`).join('');
    } else if (this.mapMode === 'blocs') {
      const bl = (App.game && App.game.blocs) || [];
      lg.innerHTML = bl.length ? bl.map(b => `<div class="row"><span class="swatch" style="background:rgb(${b.color.join(',')})"></span>${BLOC_TYPES[b.type].icon} ${esc(b.name)}</div>`).join('') + '<div class="muted small">Economic blocs fill provinces; nations in only a military pact are tinted.</div>' : '<span class="muted">No blocs yet.</span>';
    } else if (this.mapMode === 'resources') {
      lg.innerHTML = Object.entries(RESOURCE_COLORS).map(([k, c]) => `<div class="row"><span class="swatch" style="background:rgb(${c.join(',')})"></span>${RES_INFO[k]}</div>`).join('');
    } else if (this.mapMode === 'political') {
      lg.innerHTML = '<span class="muted">Click a nation for details · ● capital</span>';
    } else lg.innerHTML = MAP_MODES[this.mapMode].legend;
  },

  renderTab() {
    const body = $('#tab-body');
    const g = App.game;
    if (!g) { body.innerHTML = ''; return; }
    const st = body.scrollTop;
    if (this.choosing) body.innerHTML = this.viewChoose();
    else {
      const c = this.player();
      if (!c) { body.innerHTML = '<p class="muted">No nation selected.</p>'; return; }
      const views = { overview: this.viewOverview, leader: this.viewLeader, politics: this.viewPolitics, economy: this.viewEconomy, market: this.viewMarket, pops: this.viewPops, research: this.viewResearch, military: this.viewMilitary, diplomacy: this.viewDiplomacy, blocs: this.viewBlocs, world: this.viewWorld, news: this.viewNews };
      body.innerHTML = views[this.tab].call(this, c, g);
    }
    body.scrollTop = st;
    this.renderTopbar();
    const g2 = App.game;
    if (g2 && g2.campaign && !this.choosing && !g2.campaign.tabsSeen.includes(this.tab)) g2.campaign.tabsSeen.push(this.tab);
    if (g2 && g2.campaign) setTimeout(() => this.campaignCheck(), 0);
  },


  select(id) {
    this.selected = id == null || id < 0 ? null : id;
    App.redraw();
    this.renderTab();
  },

  handleAct(act, ds) {
    const g = App.game;
    switch (act) {
      case 'tab': this.tab = ds.tab; $('#tab-body').scrollTop = 0; this.renderTab(); return;
      case 'select': {
        const id = +ds.id;
        if (!this.choosing && id >= 0 && id !== g.player) this.tab = 'diplomacy';
        this.select(id);
        return;
      }
      case 'lead': App.startAs(+ds.id); return;
      case 'random': { const alive = g.countries.filter(x => x.alive); this.select(alive[Math.floor(Math.random() * alive.length)].id); return; }
      case 'regen': this.showSetup(false); return;
      case 'sort': this.worldSort = ds.k; this.renderTab(); return;
      case 'newsmine': this.newsMine = !this.newsMine; this.renderTab(); return;
      case 'dom': { const r = performDomestic(g, ds.id); this.track('dom:' + ds.id, r.ok); this.toast(r.msg, r.ok ? 'good' : 'bad'); App.afterAction(); return; }
      case 'appease': { const r = appeaseFaction(g, ds.f); this.track('appease:' + ds.f, r.ok); this.toast(r.msg, r.ok ? 'good' : 'bad'); App.afterAction(); return; }
      case 'regime': this.showRegimeModal(); return;
      case 'appoint': this.showAppointModal(ds.post); return;
      case 'move': { const r = movementAction(g, ds.k, ds.a); this.track('move:' + ds.a, r.ok); this.toast(r.msg, r.ok ? 'good' : 'bad'); App.afterAction(); return; }
      case 'research': { const r = setResearch(g, ds.id); this.track('research:' + ds.id, r.ok); this.toast(r.msg, r.ok ? 'good' : 'bad'); App.afterAction(); return; }
      case 'peace': this.showPeaceModal(+ds.war); return;
      case 'dismiss': { const r = dismissMinister(g, ds.post); this.toast(r.msg, r.ok ? 'info' : 'bad'); App.afterAction(); return; }
      case 'char': { const r = characterAction(g, ds.a, +ds.id); this.toast(r.msg, r.ok ? 'good' : 'bad'); App.afterAction(); return; }
      case 'build': { const r = orderBuilding(g, ds.t); this.track('build:' + ds.t, r.ok); this.toast(r.msg, r.ok ? 'good' : 'bad'); App.afterAction(); return; }
      case 'autoinvest': { const c = this.player(); c.econ.autoInvest = !c.econ.autoInvest; this.renderTab(); return; }
      case 'empire': { const r = performEmpire(g, ds.id, +ds.target); this.track('empire:' + ds.id, r.ok); this.toast(r.msg, r.ok ? 'good' : 'bad'); App.afterAction(); return; }
      case 'release': this.showReleaseModal(+ds.core); return;
      case 'coalition': { const r = coalitionAction(g, ds.p, ds.a); this.track('coalition:' + ds.a, r.ok); this.toast(r.msg, r.ok ? 'good' : 'bad'); App.afterAction(); return; }
      case 'designate': { const r = setDesignation(g, +ds.prov, ds.key || null); this.track('designate:' + (ds.key || 'none'), r.ok); this.toast(r.msg, r.ok ? 'good' : 'bad'); App.afterAction(); return; }
      case 'closeprov': this.selProv = null; this.renderTab(); return;
      case 'separatism': { const r = separatismAction(g, ds.key, ds.a); this.track('separatism:' + ds.a, r.ok); this.toast(r.msg, r.ok ? 'good' : 'bad'); App.afterAction(); return; }
      case 'federal': { const r = ds.a === 'federate' ? playerFederate(g, +ds.bloc) : federalAction(g, ds.a); this.track('federal:' + ds.a, r.ok); this.toast(r.msg, r.ok ? 'good' : 'bad'); App.afterAction(); return; }
      case 'bloc': {
        let r;
        if (ds.a === 'found') { const sel = document.querySelector(`#found-partner-${ds.type}`); r = playerFoundBloc(g, ds.type, sel ? +sel.value : -1); }
        else if (ds.a === 'invite') { const sel = document.querySelector(`#invite-${ds.bloc}`); r = playerInvite(g, +ds.bloc, sel ? +sel.value : -1); }
        else if (ds.a === 'apply') r = playerApply(g, +ds.bloc);
        else if (ds.a === 'leave') r = playerLeave(g, +ds.bloc);
        else if (ds.a === 'expel') r = playerExpel(g, +ds.bloc, +ds.target);
        this.track('bloc:' + ds.a, r && r.ok);
        if (r) this.toast(r.msg, r.ok ? 'good' : 'bad');
        App.afterAction();
        return;
      }
      case 'diplo': {
        if (ds.id === 'war') { this.confirmWar(+ds.target); return; }
        if (ds.id === 'peace') { const w = warBetween(g, g.player, +ds.target); if (w) this.showPeaceModal(w.id); return; }
        const r = performDiplo(g, ds.id, +ds.target);
        this.track('diplo:' + ds.id, r.ok);
        this.toast(r.msg, r.ok ? 'good' : 'bad');
        App.afterAction();
        return;
      }
      default:
    }
  },

  onMapMove(e) {
    const g = App.game;
    const tip = $('#map-tooltip');
    if (!g) return;
    const p = App.renderer.provinceAt(e.clientX, e.clientY);
    if (p < 0) { tip.classList.add('hidden'); return; }
    const pr = g.world.provinces[p], c = g.countries[pr.owner];
    const me = this.player();
    let rel = '';
    if (me && c.id !== me.id) {
      const r = relation(g, me.id, c.id);
      rel = `<br>Relations: <span class="${r < 0 ? 'bad' : 'good'}">${Math.round(r)}</span>${atWarWith(g, me.id, c.id) ? ' <span class="bad">· AT WAR</span>' : ''}`;
    }
    const occ = occupationFactor(g, pr);
    const coreNote = occ > 0 ? ` <span class="bad">· occupied (${Math.round(occ * 60)} mo left)</span>` : pr.core !== undefined && pr.core !== pr.owner ? ' <span class="warn">· non-core</span>' : '';
    const subjNote = c.overlord != null ? `<br><span class="warn">${SUBJECT_TYPES[c.subjectType].name} of ${esc(g.countries[c.overlord].name)}</span>` : '';
    tip.innerHTML = `<b>${esc(pr.name)}</b>${pr.id === c.capital ? ' <span class="warn">★ capital</span>' : ''} <span class="muted">· ${fmtPop(pr.pop)}</span>${coreNote}<br>
      ${swatch(c)} ${esc(formalName(c))}${subjNote}<br><span class="muted">${GOVS[c.gov].name} · ${esc(leaderLine(c))}</span><br>
      Stability <b style="color:${statColor(c.stability)}">${Math.round(c.stability)}</b> · Approval ${Math.round(c.approval)}${rel}
      <br><span class="muted">Living standard ${provinceSol(pr).toFixed(0)} · literacy ${pct(pr.lit)} · peasants ${pct(pr.pops.peasants / Math.max(1, pr.pop))}</span>
      ${pr.buildings.length ? '<br><span class="muted">' + pr.buildings.slice().sort((a, b) => b.level - a.level).slice(0, 3).map(b => esc(BUILDINGS[b.t].name) + ' ' + b.level).join(', ') + '</span>' : ''}
      ${Object.entries(pr.res).filter(([, v]) => v > 0 && v !== undefined).length ? '<br><span class="muted small">Resources: ' + Object.entries(pr.res).filter(([, v]) => v > 0).map(([k, v]) => RES_INFO[k] + ' ' + v).join(', ') + '</span>' : ''}`;
    const wrap = $('#map-wrap').getBoundingClientRect();
    let x = e.clientX - wrap.left + 14, y = e.clientY - wrap.top + 14;
    tip.classList.remove('hidden');
    if (x + tip.offsetWidth > wrap.width - 8) x = e.clientX - wrap.left - tip.offsetWidth - 14;
    if (y + tip.offsetHeight > wrap.height - 8) y = e.clientY - wrap.top - tip.offsetHeight - 14;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  },

  onMapClick(e) {
    const g = App.game;
    if (!g || this.suppressClick) return;
    const p = App.renderer.provinceAt(e.clientX, e.clientY);
    if (p < 0) { this.selProv = null; this.select(null); return; }
    this.selProv = p;
    const owner = g.world.provinces[p].owner;
    if (!this.choosing) this.tab = owner === g.player ? 'overview' : 'diplomacy';
    this.select(owner === g.player && !this.choosing ? null : owner);
  },



  modalOpen() { return this.modals.length > 0; },

  openModal(o) {
    const back = document.createElement('div');
    back.className = 'backdrop';
    back.innerHTML = `<div class="modal ${o.wide ? 'wide' : ''}"><div class="modal-head"><h2>${o.title}</h2></div><div class="modal-body">${o.body || ''}</div><div class="modal-foot ${o.row ? 'row' : ''}"></div></div>`;
    const foot = back.querySelector('.modal-foot');
    for (const b of o.buttons || [{ label: 'Close' }]) {
      const el = document.createElement('button');
      el.className = b.cls || '';
      el.innerHTML = b.label;
      el.disabled = !!b.disabled;
      if (b.title) el.title = b.title;
      el.addEventListener('click', () => {
        const keep = b.fn ? b.fn() : false;
        if (keep !== true) this.closeModal(back);
      });
      foot.appendChild(el);
    }
    if (o.dismiss) back.addEventListener('click', e => { if (e.target === back) this.closeModal(back); });
    $('#modal-root').appendChild(back);
    this.modals.push(back);
    if (o.onOpen) o.onOpen(back);
    return back;
  },

  closeModal(el) {
    el.remove();
    this.modals = this.modals.filter(m => m !== el);
    if (!this.modals.length && App.game) App.afterAction();
  },

  toast(text, kind) {
    if (!text) return;
    const root = $('#toast-root');
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = text;
    root.appendChild(el);
    while (root.children.length > 5) root.firstChild.remove();
    setTimeout(() => el.remove(), 5000);
  },

  processPending() {
    const g = App.game;
    if (!g || this.modalOpen()) return;
    const rest = [];
    for (const it of g.pending) { if (it.type === 'toast') this.toast(it.text, it.kind); else rest.push(it); }
    g.pending = rest;
    if (!rest.length) return;
    this.showPending(g.pending.shift());
  },
};
