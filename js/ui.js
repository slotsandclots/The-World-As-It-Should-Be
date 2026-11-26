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

const TABS = [['overview', 'Nation'], ['leader', 'Leader'], ['politics', 'Politics'], ['economy', 'Economy'], ['market', 'Market'], ['pops', 'Pops'], ['research', 'Research'], ['military', 'Military'], ['diplomacy', 'Diplomacy'], ['world', 'World'], ['news', 'News']];
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

  // ------------------------------------------------------------ map zoom & pan

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

  // ------------------------------------------------------------ rendering

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
      const views = { overview: this.viewOverview, leader: this.viewLeader, politics: this.viewPolitics, economy: this.viewEconomy, market: this.viewMarket, pops: this.viewPops, research: this.viewResearch, military: this.viewMilitary, diplomacy: this.viewDiplomacy, world: this.viewWorld, news: this.viewNews };
      body.innerHTML = views[this.tab].call(this, c, g);
    }
    body.scrollTop = st;
    this.renderTopbar();
    const g2 = App.game;
    if (g2 && g2.campaign && !this.choosing && !g2.campaign.tabsSeen.includes(this.tab)) g2.campaign.tabsSeen.push(this.tab);
    if (g2 && g2.campaign) setTimeout(() => this.campaignCheck(), 0);
  },

  nationHeader(c) {
    const g = App.game;
    const party = GOVS[c.gov].party === 'multi' ? `<div class="small muted">Governing party: ${esc(rulingPartyObj(c).name)}</div>` : '';
    return `<div class="nation-head"><div class="nh-portrait">${portraitSVG(c.leader, { size: 52, gov: c.gov })}<span class="swatch nh-flag" style="background:${c.color}"></span></div><div><div class="formal">${esc(formalName(c))}</div>
      <div style="margin:4px 0">${govBadge(c.gov)} <span class="small muted">since ${gameDate(g, Math.max(0, g.month - c.monthsInRegime))}</span></div>
      <div class="small">${esc(leaderLine(c))}, ${c.leader.age}</div><div>${this.traitChips(c.leader)}</div>${party}</div></div>`;
  },

  viewOverview(c, g) {
    const gv = GOVS[c.gov];
    let h = '';
    const risk = crisisRisk(c);
    if (risk > 0) h += `<div class="alert bad"><b>Crisis!</b> ${pct(risk, 1)} chance each month of a coup or revolution. Raise stability above ${CRISIS_LEVEL} and calm the unrest.</div>`;
    const wars = warsOf(g, c.id);
    if (wars.length) h += `<div class="alert warn">⚔ At war: ${wars.map(w => esc(w.name)).join(', ')}. <a href="#" data-act="tab" data-tab="military" class="warn">Military →</a></div>`;
    if (c.emergency) h += '<div class="alert warn">A state of emergency is in force. Elections are suspended.</div>';
    h += `<div class="card">${this.nationHeader(c)}</div>`;
    h += `<div class="card">
      ${bar('Stability', c.stability, { tip: `Below ${CRISIS_LEVEL}, coups and revolutions become possible.` })}
      ${bar('Approval', c.approval, { tip: 'How the public feels about the government.' })}
      ${bar('Unrest', c.unrest, { invert: true, tip: 'Protests and agitation. Above 55, it can spark revolution on its own.' })}
      ${bar('Freedom', c.freedom, { color: '#5b8cff', tip: 'Civil liberties. Intelligentsia value it highly.' })}
      ${bar('Corruption', c.corruption, { invert: true, tip: 'Drains revenue and growth.' })}
      ${bar('Legitimacy', c.legitimacy, { tip: 'The accepted right to rule. Won through elections, tradition or faith.' })}
    </div>`;
    const debt = -c.treasury / c.gdp;
    h += `<div class="card grid2">
      <div class="kv"><span>Population</span><span>${fmtPop(c.pop)}</span></div>
      <div class="kv"><span>Provinces</span><span>${c.provinceCount}</span></div>
      <div class="kv"><span>GDP</span><span>${fmtMoney(c.gdp)}</span></div>
      <div class="kv"><span>Per capita</span><span>$${(c.gdpPerCap * 1000).toFixed(0)}</span></div>
      <div class="kv"><span>Growth</span><span class="${c.growthAvg < 0 ? 'bad' : 'good'}">${fmtSigned(c.growthAvg * 1200)}%/yr</span></div>
      <div class="kv"><span>Treasury</span><span class="${c.treasury < 0 ? 'bad' : ''}">${fmtMoney(c.treasury)}${debt > 0 ? ` (${pct(debt)} debt)` : ''}</span></div>
      <div class="kv"><span>Army</span><span>${fmtPop(c.army)}</span></div>
      <div class="kv"><span>Strength</span><span>${strength(c).toFixed(0)}</span></div>
      <div class="kv"><span>Political capital</span><span>${Math.floor(c.pc)} (+${(gv.pcGain * (0.6 + c.stability / 120)).toFixed(1)}/mo)</span></div>
      <div class="kv"><span>Living standard</span><span style="color:${statColor(c.econ.avgSol * 1.4)}">${c.econ.avgSol.toFixed(0)}</span></div>
      <div class="kv"><span>Unemployment</span><span class="${c.econ.unemployment > 0.08 ? 'bad' : ''}">${pct(c.econ.unemployment, 1)}</span></div>
      <div class="kv"><span>In power</span><span>${Math.floor((g.playerMonths || 0) / 12)}y ${(g.playerMonths || 0) % 12}m</span></div>
    </div>`;
    h += `<div class="card sparks">
      <div><div class="lbl">Approval</div>${spark(c.hist.approval, '#5cc98a')}</div>
      <div><div class="lbl">Stability</div>${spark(c.hist.stability, '#e8b84a')}</div>
      <div><div class="lbl">GDP</div>${spark(c.hist.gdp, '#5b8cff')}</div>
    </div>`;
    h += `<div class="card"><h3>Public opinion</h3><p class="small">The public is <b>${ideologyText(c.ideo)}</b>. The further it sits from the regime (■), the more unrest builds.</p>${compassSVG(c)}</div>`;
    if (c.mods.length) {
      h += `<div class="card"><h3>Active effects</h3><div class="mods">${c.mods.filter(m => FX_LABELS[m.key] || m.key === 'growth').map(m => `${esc(m.label)}: ${m.key === 'growth' ? fmtSigned(m.v * 1200) + '% growth' : fmtSigned(m.v, 0) + ' ' + FX_LABELS[m.key]} (${m.months} mo)`).join('<br>') || 'Propaganda campaign running'}</div></div>`;
    }
    return h;
  },

  traitChips(ch) {
    return (ch.traits || []).map(t => `<span class="trait" title="${esc(TRAITS[t].desc)}">${TRAITS[t].name}</span>`).join('');
  },

  skillBars(ch, highlight) {
    return SKILL_KEYS.map(k => `<div class="skill${k === highlight ? ' hl' : ''}"><span>${SKILLS[k]}</span><div class="pips">${'<i class="on"></i>'.repeat(ch.skills[k])}${'<i></i>'.repeat(10 - ch.skills[k])}</div><b>${ch.skills[k]}</b></div>`).join('');
  },

  factionTag(ch) {
    return ch.faction && FACTIONS[ch.faction] ? `<span class="ftag" title="${esc(FACTIONS[ch.faction].desc)}">${FACTIONS[ch.faction].icon} ${FACTIONS[ch.faction].name}</span>` : '';
  },

  viewLeader(c, g) {
    const L = c.leader;
    const T = traitFx(L);
    const fx = [];
    const d = k => L.skills[k] - 5;
    if (d('cha')) fx.push(`${fmtSigned(d('cha') * 0.8)} approval (charisma)`);
    if (d('admin')) fx.push(`${fmtSigned(-d('admin') * 1.5)} corruption (administration)`);
    if (d('diplo')) fx.push(`${fmtSigned(d('diplo') * 1.2)} relations (diplomacy)`);
    if (d('mil')) fx.push(`${fmtSigned(d('mil'))}% army strength (military)`);
    for (const k of ['approval', 'stability', 'corruption', 'pc']) if (T[k]) fx.push(`${fmtSigned(T[k])} ${k === 'pc' ? 'PC/month' : k} (traits)`);
    let h = `<div class="card leader-card"><div class="lc-portrait">${portraitSVG(L, { size: 108, gov: c.gov })}</div><div>
      <div class="small muted">${esc(leaderTitle(c))} of the ${esc(formalName(c))}</div>
      <div class="formal">${esc(L.name)}</div>
      <div class="small">Age ${L.age} · in office since ${gameDate(g, Math.min(L.since, g.month))} ${this.factionTag(L)}</div>
      <div style="margin:6px 0">${this.traitChips(L)}</div>
      ${bar('Health', L.health)}</div></div>
      <div class="card"><h3>Skills</h3>${this.skillBars(L)}
      <p class="small muted" style="margin-top:8px">${fx.join(' · ') || 'An unremarkable administrator.'}</p>
      <p class="small">Personal politics: <b>${ideologyText(L.ideo)}</b>.</p></div>`;
    if (c.heir) h += this.personRow(c, c.heir, `<div class="small muted">Next in line to the throne. If the ${c.leader.female ? 'Queen' : 'King'} dies, ${c.heir.female ? 'she' : 'he'} takes the crown.</div>`);
    if (c.monarch) h += this.personRow(c, c.monarch, `<div class="small muted">The crowned head of state reigns above politics and lends the government legitimacy.</div>`);

    h += `<div class="card"><h3>Cabinet</h3><p class="small muted">Each minister's key skill drives their department. Ministers bring their faction's goodwill (+4 loyalty) while they're loyal; disloyal ones (below 25) work at half effort. Appointing costs ${APPOINT_PC} PC.</p>`;
    for (const post of POST_KEYS) {
      const P = CABINET_POSTS[post], ch = c.cabinet[post];
      const eff = P.text(effectiveSkill(ch, post) - 5);
      if (!ch) {
        h += `<div class="person vacant"><div class="pp empty">?</div><div class="pinfo"><div class="ptitle">${P.name}</div><div class="bad small">Vacant: ${eff}</div><div class="small muted">${P.desc}</div></div>
          <div class="pact"><button class="primary small" data-act="appoint" data-post="${post}">Appoint…</button></div></div>`;
        continue;
      }
      h += `<div class="person"><div class="pp">${portraitSVG(ch, { size: 54, gov: c.gov })}</div><div class="pinfo">
        <div class="ptitle">${P.name}</div><div><b>${esc(ch.name)}</b>, ${ch.age} ${this.factionTag(ch)}</div>
        <div class="small">${SKILLS[P.skill]} <b>${ch.skills[P.skill]}</b> · <span class="${effectiveSkill(ch, post) >= 5 ? 'good' : 'bad'}">${eff}</span></div>
        <div>${this.traitChips(ch)}</div>${bar('Loyalty', ch.loyalty, { tip: 'Below 25, ministers sabotage their department and may plot or leak.' })}</div>
        <div class="pact"><button class="small" data-act="appoint" data-post="${post}">Replace…</button><button class="small" data-act="dismiss" data-post="${post}">Dismiss</button>
        <button class="small" data-act="char" data-a="honor" data-id="${ch.id}" title="${esc(CHAR_ACTIONS.honor.desc)}" ${c.pc < CHAR_ACTIONS.honor.pc ? 'disabled' : ''}>Honor</button></div></div>`;
    }
    h += '</div>';

    h += `<div class="card"><h3>High command</h3><p class="small muted">The best general's skill sets the army's leadership. A disloyal, ambitious general is a coup waiting to happen.</p>`;
    for (const ch of c.generals) {
      const danger = ch.loyalty < 25 ? `<div class="small bad">⚠ Disloyal${ch.ambition > 45 ? ' and ambitious: may attempt a coup' : ''}</div>` : '';
      h += `<div class="person"><div class="pp">${portraitSVG(ch, { size: 54, gov: c.gov })}</div><div class="pinfo">
        <div class="ptitle">General</div><div><b>${esc(ch.name)}</b>, ${ch.age}</div><div class="small">Military <b>${ch.skills.mil}</b> · ambition ${Math.round(ch.ambition)}</div>
        <div>${this.traitChips(ch)}</div>${bar('Loyalty', ch.loyalty)}${danger}</div>
        <div class="pact">${['honor', 'retire', 'arrest'].map(a => `<button class="small" data-act="char" data-a="${a}" data-id="${ch.id}" title="${esc(CHAR_ACTIONS[a].desc)} (${CHAR_ACTIONS[a].pc} PC)" ${c.pc < CHAR_ACTIONS[a].pc ? 'disabled' : ''}>${CHAR_ACTIONS[a].name}</button>`).join('')}</div></div>`;
    }
    h += '</div>';

    const opp = c.parties.filter(p => p.leader).map(p => p.leader).concat(c.dissidents || []);
    h += `<div class="card"><h3>${GOVS[c.gov].party === 'multi' ? 'Opposition' : 'Dissidents'}</h3>`;
    if (!opp.length) h += '<p class="small muted">No organized opposition.</p>';
    for (const ch of opp) {
      const acts = ch.role === 'dissident' ? ['arrest', 'coopt'] : ['smear', 'coopt'];
      const party = c.parties.find(p => p.id === ch.party);
      h += `<div class="person"><div class="pp">${portraitSVG(ch, { size: 54, gov: c.gov })}</div><div class="pinfo">
        <div class="ptitle">${esc(roleTitle(c, ch))}</div><div>${party ? `<span class="swatch" style="background:${party.color};width:10px;height:10px"></span> ` : ''}<b>${esc(ch.name)}</b>, ${ch.age}</div>
        <div class="small">Charisma <b>${ch.skills.cha}</b> · ${ideologyText(ch.ideo)}</div><div>${this.traitChips(ch)}</div>
        ${ch.role === 'dissident' ? bar('Following', ch.popularity, { invert: true, tip: 'A popular dissident fuels unrest and may lead a revolution.' }) : ''}</div>
        <div class="pact">${acts.map(a => `<button class="small" data-act="char" data-a="${a}" data-id="${ch.id}" title="${esc(CHAR_ACTIONS[a].desc)} (${CHAR_ACTIONS[a].pc} PC)" ${c.pc < CHAR_ACTIONS[a].pc ? 'disabled' : ''}>${CHAR_ACTIONS[a].name}</button>`).join('')}</div></div>`;
    }
    return h + '</div>';
  },

  personRow(c, ch, extra) {
    return `<div class="card person"><div class="pp">${portraitSVG(ch, { size: 54, gov: c.gov })}</div><div class="pinfo">
      <div class="ptitle">${esc(roleTitle(c, ch))}</div><div><b>${esc(ch.name)}</b>, ${ch.age}</div><div>${this.traitChips(ch)}</div>${extra || ''}</div></div>`;
  },

  showAppointModal(post) {
    const g = App.game, c = this.player();
    const P = CABINET_POSTS[post];
    const list = candidatesFor(g, c, post);
    const cur = c.cabinet[post];
    this.openModal({
      title: `Appoint ${P.name}`, wide: true, dismiss: true,
      body: `<p class="small">${P.desc} The key skill is <b>${SKILLS[P.skill]}</b>.${cur ? ` Replacing ${esc(cur.name)} will upset the ${FACTIONS[cur.faction] ? FACTIONS[cur.faction].name.toLowerCase() : 'public'} (−4).` : ''} New candidates come forward every year.</p>`,
      buttons: list.map(ch => ({
        cls: 'cand',
        label: `<div class="pp">${portraitSVG(ch, { size: 64, gov: c.gov })}</div><div class="pinfo"><div><b>${esc(ch.name)}</b>, ${ch.age} ${this.factionTag(ch)}</div>
          <div>${this.traitChips(ch)}</div>${this.skillBars(ch, P.skill)}
          <div class="small">Loyalty ${Math.round(ch.loyalty)} · <span class="${ch.skills[P.skill] >= 5 ? 'good' : 'bad'}">${P.text(ch.skills[P.skill] - 5)}</span></div></div>`,
        disabled: c.pc < APPOINT_PC,
        fn: () => { const r = appointMinister(g, post, ch.id); this.toast(r.msg, r.ok ? 'good' : 'bad'); },
      })).concat([{ label: 'Cancel' }]),
    });
  },

  withPortrait(charId, html) {
    const g = App.game;
    if (!charId || !g) return html;
    let ch = null, owner = null;
    for (const c of g.countries) { const x = c.alive && findCharacter(c, charId); if (x) { ch = x; owner = c; break; } }
    if (!ch) return html;
    return `<div class="speaker"><div>${portraitSVG(ch, { size: 84, gov: owner.gov })}<div class="small muted" style="text-align:center;max-width:90px">${esc(ch.name)}<br>${esc(roleTitle(owner, ch))}</div></div><div>${html}</div></div>`;
  },

  costText(c, a) {
    const parts = [];
    if (a.pc) parts.push(`${a.pc} PC`);
    if (a.money) parts.push(fmtMoney(a.money * c.gdp));
    return parts.join(' · ') || 'Free';
  },

  actionBtn(c, act, a, reason, extra) {
    return `<button class="action" data-act="${act}" data-id="${a.id}" ${extra || ''} ${reason ? 'disabled' : ''} title="${esc(a.desc)}">
      <span class="name">${esc(a.name)}</span><span class="cost">${this.costText(c, a)}</span>
      <span class="small muted">${esc(a.desc)}</span>${reason ? `<span class="why">${esc(reason)}</span>` : ''}</button>`;
  },

  viewPolitics(c, g) {
    const gv = GOVS[c.gov];
    let h = `<div class="card"><h3>${govBadge(c.gov)} ${gv.name}</h3><p class="small">${gv.desc}</p>
      <div class="grid2 small"><div class="good">${gv.pros.map(x => '+ ' + x).join('<br>')}</div><div class="bad">${gv.cons.map(x => '− ' + x).join('<br>')}</div></div>`;
    if (gv.elections === 'free') {
      if (c.emergency) h += '<p class="warn small">Elections suspended under the state of emergency.</p>';
      else h += `<p class="small">Next election: <b>${gameDate(g, c.nextElection)}</b> (${Math.max(0, c.nextElection - g.month)} months)${c.flags.fraud ? ' · <span class="warn">ballot rigging arranged</span>' : ''}</p>`;
    } else if (gv.elections === 'sham') {
      h += `<p class="small">Single-list "elections" every ${gv.term / 12} years. Next: ${gameDate(g, c.nextElection)}</p>`;
    } else h += '<p class="small muted">No elections. Power rests on the loyalty of the regime\'s backers.</p>';
    h += `<button class="gold" data-act="regime" style="width:100%;margin-top:6px">Change form of government…</button></div>`;

    h += `<div class="card"><h3>Factions</h3><p class="small muted">★ marks the regime's power base: their loyalty matters most for stability. Concessions cost ${APPEASE_COST.pc} PC and ${fmtMoney(APPEASE_COST.money * c.gdp)}.</p>`;
    for (const f of FACTION_KEYS) {
      const F = FACTIONS[f];
      const star = gv.base[f] ? '★ ' : '';
      h += `<div class="faction"><span class="icon">${F.icon}</span><div title="${esc(F.desc)}">${bar(star + F.name, c.factions[f])}</div>
        <button data-act="appease" data-f="${f}" ${costOk(c, APPEASE_COST) ? 'disabled' : ''} title="Make concessions to the ${F.name}">Appease</button></div>`;
    }
    h += '</div>';

    if (gv.party === 'multi') {
      const polls = computePolls(c);
      h += `<div class="card"><h3>Parties & polls</h3>`;
      c.parties.forEach((p, i) => {
        h += `<div class="party-row"><span class="dot" style="background:${p.color}"></span><span>${esc(p.name)}${p.id === c.rulingParty ? ' <span class="badge" style="background:#444">governing</span>' : ''}</span><span style="text-align:right">${pct(polls[i], 1)}</span></div>`;
      });
      if (c.lastElection && !c.lastElection.sham) {
        h += `<h4>Last election · ${gameDate(g, c.lastElection.month)}</h4>${this.seatBar(c.lastElection)}`;
      }
      h += '</div>';
    } else {
      h += `<div class="card"><h3>Ruling body</h3><p class="small">${esc(c.parties[0].name)} holds all power. No opposition is permitted.</p></div>`;
    }
    h += `<div class="card"><h3>Political compass</h3>${compassSVG(c)}<p class="small muted" style="text-align:center">● public · ■ regime${gv.party === 'multi' ? ' · small dots: parties' : ''}</p></div>`;
    h += this.movementsHtml(c);
    h += `<div class="card"><h3>Domestic actions</h3><p class="small muted">You have <b>${Math.floor(c.pc)}</b> political capital.</p><div class="actions">`;
    for (const { a, reason } of domesticActionList(g, c)) h += this.actionBtn(c, 'dom', a, reason);
    h += '</div></div>';
    return h;
  },

  seatBar(res) {
    const seated = res.results.filter(r => r.seats > 0);
    return `<div class="seatbar">${seated.map(r => `<div style="width:${r.seats / 2}%;background:${r.color}" title="${esc(r.name)}: ${r.seats} seats"></div>`).join('')}</div>` +
      `<table class="list"><tr><th>Party</th><th>Vote</th><th>Seats</th></tr>${res.results.slice().sort((a, b) => b.seats - a.seats || b.vote - a.vote).map(r =>
        `<tr${r.id === res.winner ? ' class="me"' : ''}><td><span class="swatch" style="background:${r.color};width:10px;height:10px"></span> ${esc(r.name)}</td><td>${pct(r.vote, 1)}</td><td>${r.seats}</td></tr>`).join('')}</table>`;
  },

  viewEconomy(c, g) {
    const E = c.econ;
    let h = `<div class="card grid2">
      <div class="kv"><span>GDP</span><span>${fmtMoney(c.gdp)}</span></div>
      <div class="kv"><span>Per capita</span><span>$${(c.gdpPerCap * 1000).toFixed(0)}</span></div>
      <div class="kv"><span>Growth</span><span class="${c.growthAvg < 0 ? 'bad' : 'good'}">${fmtSigned(c.growthAvg * 1200)}%/yr</span></div>
      <div class="kv"><span>Productivity</span><span>${E.tech.toFixed(2)}×</span></div>
      <div class="kv"><span>Unemployment</span><span class="${E.unemployment > 0.08 ? 'bad' : ''}">${pct(E.unemployment, 1)}</span></div>
      <div class="kv"><span>Treasury</span><span class="${c.treasury < 0 ? 'bad' : ''}">${fmtMoney(c.treasury)}</span></div>
    </div>`;
    h += `<div class="card" id="budget-preview">${this.budgetHtml(c)}</div>`;
    h += this.industryHtml(c, g);
    h += `<div class="card"><h3>Policy</h3><p class="small muted">Spending is a share of GDP. Government spending flows into the economy: soldiers, officials and teachers are paid wages, and the state buys arms, fuel, steel, timber and tools on the market.</p>`;
    for (const k of Object.keys(POLICY_LIMITS)) {
      const L = POLICY_LIMITS[k];
      h += `<div class="slider-row"><label><span>${L.label}</span><b id="pv-${k}">${this.policyValue(c, k)}</b></label>
        <input type="range" data-policy="${k}" min="${L.min}" max="${L.max}" step="${L.step}" value="${c.policy[k]}"><small>${L.hint}</small></div>`;
    }
    h += '</div>';
    h += `<div class="card"><h3>History</h3><div class="lbl small muted">GDP over the last 10 years</div>${spark(c.hist.gdp, '#5b8cff')}</div>`;
    return h;
  },

  industryHtml(c, g) {
    const E = c.econ;
    const ind = nationalIndustry(g, c);
    const pros = buildingProspects(g, c);
    const communist = !ownersAllowed(c);
    let h = `<div class="card"><h3>Industry & construction</h3>
      <p class="small muted">${communist ? 'All enterprises belong to the state: their profits go straight to the treasury, and only the state builds.' : 'Capitalists and landowners reinvest their savings in whatever pays best. The state can build too, from the state investment fund (or the treasury once the fund is empty).'}</p>
      <div class="grid2 small">
        <div class="kv"><span>State fund</span><span>${fmtMoney(E.statePool / 1e6)}</span></div>
        <div class="kv"><span>Private capital</span><span>${communist ? '—' : fmtMoney(E.investPool / 1e6)}</span></div>
      </div>
      <label class="small"><input type="checkbox" data-act="autoinvest" ${E.autoInvest ? 'checked' : ''}> Let ministries spend the state fund automatically on whatever is scarcest</label>
      <table class="list" style="margin-top:8px"><tr><th>Building</th><th>Lvl</th><th>Run</th><th title="Value added per level per month">VA/lvl</th><th title="Expected annual return on a new level">ROI</th><th></th></tr>`;
    let kind = '';
    for (const t of BUILDING_KEYS) {
      const def = BUILDINGS[t], o = ind[t], p = pros.find(x => x.t === t);
      if (def.kind !== kind) { kind = def.kind; h += `<tr><td colspan="6" class="small muted" style="padding-top:8px">${kind}</td></tr>`; }
      const ins = Object.keys(def.in).map(x => GOODS[x].name).join(', ');
      const tip = `${def.name}: makes ${GOODS[Object.keys(def.out)[0]].name} from ${ins}${def.res ? ' · needs ' + RES_INFO[def.res].toLowerCase() : ''}`;
      h += `<tr title="${esc(tip)}"><td>${esc(def.name)}</td><td>${o.levels || '<span class="muted">0</span>'}</td>
        <td>${o.levels ? pct(o.active) : ''}</td><td class="${o.va < 0 ? 'bad' : ''}">${o.levels ? fmtMoney(o.va / 1e6) : ''}</td>
        <td class="${p.roi < 0.1 ? 'bad' : p.roi > 0.3 ? 'good' : ''}">${p.prov ? pct(p.roi) : ''}</td>
        <td><button class="small" data-act="build" data-t="${t}" ${p.prov ? '' : 'disabled'} title="${esc(p.prov ? 'Build in ' + p.prov.name : p.reason)}">+ ${fmtMoney(p.cost / 1e6)}</button></td></tr>`;
    }
    h += '</table>';
    if (E.projects.length) {
      h += `<h4>Under construction</h4>`;
      for (const pr of E.projects.slice().sort((a, b) => a.done - b.done)) {
        h += `<div class="kv small"><span>${esc(BUILDINGS[pr.t].name)} · ${esc(g.world.provinces[pr.prov].name)} <span class="muted">(${pr.funder})</span></span><span>${Math.max(0, pr.done - g.month)} mo</span></div>`;
      }
    }
    return h + '</div>';
  },

  viewMarket(c, g) {
    const E = c.econ, W = g.worldMarket;
    const fmtQ = q => q >= 10000 ? (q / 1000).toFixed(0) + 'k' : q >= 1000 ? (q / 1000).toFixed(1) + 'k' : q.toFixed(0);
    let h = `<div class="card small"><p>Every nation has its own market. Prices rise when demand outstrips supply and fall when goods pile up. Surpluses and shortages are traded on the world market: trade openness is <b>${pct(E.tau)}</b> (raised by trade agreements; lowered by tariffs, war and planned economies).</p>
      <div class="grid2"><div class="kv"><span>Trade balance</span><span class="${E.tradeBalance < 0 ? 'bad' : 'good'}">${fmtMoney(E.tradeBalance)}/mo</span></div>
      <div class="kv"><span>Tariff income</span><span>${fmtMoney(E.tariffRev)}/mo</span></div></div></div>
      <table class="list"><tr><th>Good</th><th title="Local price vs. base price">Price</th><th title="World price vs. base">World</th><th>Supply</th><th>Demand</th><th>Trade</th><th title="Share of demand actually met">Met</th></tr>`;
    let cat = '';
    for (const gk of GOOD_KEYS) {
      const G = GOODS[gk];
      if (G.cat !== cat) { cat = G.cat; h += `<tr><td colspan="7" class="small muted" style="padding-top:8px">${cat}</td></tr>`; }
      const r = E.prices[gk] / G.base, wr = W.prices[gk] / G.base;
      const tr = E.exports[gk] > E.imports[gk] ? `<span class="good">+${fmtQ(E.exports[gk])}</span>` : E.imports[gk] > 0.5 ? `<span class="warn">−${fmtQ(E.imports[gk])}</span>` : '';
      const f = E.fulfill[gk];
      h += `<tr><td>${G.name}</td><td style="color:${r > 1.4 ? 'var(--bad)' : r < 0.75 ? 'var(--good)' : 'inherit'}">${pct(r)}</td><td class="muted">${pct(wr)}</td>
        <td>${fmtQ(E.S[gk])}</td><td>${fmtQ(E.D[gk])}</td><td>${tr}</td><td class="${f < 0.95 ? 'bad' : ''}">${pct(f)}</td></tr>`;
    }
    h += '</table><p class="small muted">Price 100% = base price. Shortages ("Met" below 100%) ration goods for everyone: pops go without, factories stall, and the army runs short of arms.</p>';
    return h;
  },

  viewPops(c, g) {
    const E = c.econ;
    let h = `<div class="card">
      ${bar('Average standard of living', E.avgSol, { tip: 'How well pops meet their basic, everyday and luxury needs.' })}
      ${bar('Contentment', 50 + E.contentment, { text: fmtSigned(E.contentment, 0), tip: 'Standard of living compared with what each class expects. Drives approval.' })}
      <div class="grid2" style="margin-top:6px">
        <div class="kv"><span>Population</span><span>${fmtPop(c.pop)}</span></div>
        <div class="kv"><span>Literacy</span><span>${pct(E.literacy)}</span></div>
        <div class="kv"><span>Unemployment</span><span class="${E.unemployment > 0.08 ? 'bad' : ''}">${pct(E.unemployment, 1)}</span></div>
        <div class="kv"><span>Peasantry</span><span>${pct(E.popType.peasants / Math.max(1, c.pop))}</span></div>
      </div></div>`;
    h += `<div class="card"><h3>Social classes</h3><table class="list"><tr><th>Class</th><th>Pop</th><th>Share</th><th title="Standard of living (0-100)">SoL</th><th title="Net income per person per month">Income</th><th>Jobless</th></tr>`;
    for (const t of POP_KEYS) {
      const n = E.popType[t];
      if (n < 1) continue;
      const exp = SOL_EXPECT[POP_TYPES[t].strata];
      const sol = E.solType[t];
      h += `<tr title="${esc(POP_TYPES[t].desc)} Expected standard of living: ${exp}."><td>${POP_TYPES[t].name}</td><td>${fmtPop(n)}</td><td>${pct(n / c.pop, 1)}</td>
        <td style="color:${sol >= exp ? 'var(--good)' : sol < exp - 15 ? 'var(--bad)' : 'var(--warn)'}">${sol.toFixed(0)}</td>
        <td>$${(E.incType[t] * 1000).toFixed(0)}</td><td>${t === 'peasants' ? '' : n > 0 ? pct(E.unempType[t] / n) : ''}</td></tr>`;
    }
    h += `</table><p class="small muted">Green: living as well as the class expects (lower ${SOL_EXPECT.lower}, middle ${SOL_EXPECT.middle}, upper ${SOL_EXPECT.upper}). Workers come from the peasantry as new jobs open; clerks and capitalists also need literacy.</p></div>`;
    h += `<div class="card"><h3>By stratum</h3>${bar('Lower classes', E.strataSol.lower)}${bar('Middle classes', E.strataSol.middle)}${bar('Upper classes', E.strataSol.upper)}</div>`;
    h += `<div class="card"><h3>Needs</h3><p class="small">Pops spend their income in order: <b>basic needs</b> (grain, fish or meat, clothes, coal or fuel), then <b>everyday goods</b> (more food and clothes, furniture, appliances, fuel), then <b>luxuries</b>. Whatever is left is saved; capitalists and landowners invest their savings. Hunger shrinks the population; comfort grows it.</p></div>`;
    h += `<div class="card"><h3>Class politics</h3><p class="small">Weighted by wealth and influence, the classes pull public opinion toward <b>${ideologyText(E.popIdeo)}</b>. Poverty radicalizes: miserable pops drift left and toward strongmen, while literacy makes people more liberal.</p></div>`;
    return h;
  },

  policyValue(c, k) { return k === 'tax' || k === 'tariff' ? pct(c.policy[k]) : c.policy[k].toFixed(1) + '% GDP'; },

  budgetHtml(c) {
    const b = projectBudget(c);
    const debt = -c.treasury / c.gdp;
    return `<h3>Monthly budget</h3>
      <div class="kv"><span>Income tax</span><span class="good">${fmtMoney(b.taxes)}</span></div>
      ${b.tariffs > 0.0001 ? `<div class="kv"><span>Tariffs</span><span class="good">${fmtMoney(b.tariffs)}</span></div>` : ''}
      ${Math.abs(b.stateProfit) > 0.0001 ? `<div class="kv"><span>State enterprises</span><span class="${b.stateProfit < 0 ? 'bad' : 'good'}">${fmtMoney(b.stateProfit)}</span></div>` : ''}
      <div class="kv"><span>Spending (${b.spendPct.toFixed(1)}% of GDP incl. ${ADMIN_COST}% administration)</span><span class="bad">−${fmtMoney(b.spend)}</span></div>
      ${b.interest ? `<div class="kv"><span>Debt interest</span><span class="bad">−${fmtMoney(b.interest)}</span></div>` : ''}
      <div class="kv" style="border-top:1px solid var(--line);margin-top:4px;padding-top:4px"><span><b>Balance</b></span><span class="${b.net < 0 ? 'bad' : 'good'}"><b>${b.net >= 0 ? '+' : ''}${fmtMoney(b.net)}</b></span></div>
      ${debt > 0.6 ? `<p class="small bad">Debt is ${pct(debt)} of GDP. Above 60% it hurts approval; above 150% the state defaults.</p>` : ''}`;
  },

  updatePolicyLabels() {
    const c = this.player();
    for (const k of Object.keys(POLICY_LIMITS)) { const el = $('#pv-' + k); if (el) el.textContent = this.policyValue(c, k); }
    const bp = $('#budget-preview');
    if (bp) bp.innerHTML = this.budgetHtml(c);
  },

  viewMilitary(c, g) {
    const all = g.countries.filter(x => x.alive).sort((a, b) => strength(b) - strength(a));
    let h = `<div class="card grid2">
      <div class="kv"><span>Soldiers</span><span>${fmtPop(c.army)}</span></div>
      <div class="kv"><span>Target size</span><span>${fmtPop(armyTarget(c))}</span></div>
      <div class="kv"><span>Strength</span><span>${strength(c).toFixed(0)}</span></div>
      <div class="kv"><span>World rank</span><span>#${all.indexOf(c) + 1} of ${all.length}</span></div>
      <div class="kv"><span>War exhaustion</span><span class="${c.warExhaustion > 40 ? 'bad' : ''}">${Math.round(c.warExhaustion)}</span></div>
      <div class="kv"><span>Allies</span><span>${c.allies.length}</span></div>
    </div>
    <div class="card">${bar('Military loyalty', c.factions.military)}<p class="small muted">Strength depends on army size (set by military spending and population), wealth, stability and the loyalty of the officers. Defenders fight with a 30% bonus.</p>
      <button data-act="tab" data-tab="economy">Adjust military spending →</button></div>`;
    const wars = warsOf(g, c.id);
    h += `<h4>Wars</h4>`;
    if (!wars.length) h += '<p class="muted small">We are at peace.</p>';
    for (const w of wars) {
      const mine = w.a.includes(c.id) ? 'a' : 'b', theirs = mine === 'a' ? 'b' : 'a';
      const us = w[mine].map(id => g.countries[id]), them = w[theirs].map(id => g.countries[id]);
      const sU = sideStrength(g, w[mine]) * (mine === 'b' ? 1.3 : 1), sT = sideStrength(g, w[theirs]) * (theirs === 'b' ? 1.3 : 1);
      h += `<div class="card war-card"><h3>⚔ ${esc(w.name)}</h3>
        <div class="small muted">Since ${gameDate(g, w.start)} · ${g.month - w.start} months</div>
        <div class="kv"><span>Our side</span><span>${us.map(x => swatch(x) + ' ' + esc(x.name)).join(', ')}</span></div>
        <div class="kv"><span>Enemy</span><span>${them.map(x => swatch(x) + ' ' + esc(x.name)).join(', ')}</span></div>
        <div class="kv"><span>Provinces taken</span><span><span class="good">${w['gains' + mine.toUpperCase()]}</span> vs <span class="bad">${w['gains' + theirs.toUpperCase()]}</span></span></div>
        <div class="kv"><span>Strength</span><span>${sU.toFixed(0)} vs ${sT.toFixed(0)}</span></div>
        <div class="kv"><span>Exhaustion</span><span>${Math.round(w['ex' + mine.toUpperCase()])} vs ${Math.round(w['ex' + theirs.toUpperCase()])}</span></div>
        <div class="kv"><span>War score</span><span class="${warScore(g, w, c.id) >= 0 ? 'good' : 'bad'}">${fmtSigned(warScore(g, w, c.id), 0)}</span></div>
        <button data-act="peace" data-war="${w.id}" ${c.pc < 10 ? 'disabled' : ''}>Negotiate peace…</button></div>`;
    }
    const ns = getNeighbors(g, c.id).map(id => g.countries[id]);
    h += `<h4>Neighbors</h4><table class="list"><tr><th>Nation</th><th>Gov</th><th>Strength</th><th>Rel.</th></tr>`;
    for (const n of ns.sort((a, b) => strength(b) - strength(a))) {
      const rel = relation(g, c.id, n.id);
      h += `<tr class="click" data-act="select" data-id="${n.id}"><td>${swatch(n)} ${esc(n.name)}${atWarWith(g, c.id, n.id) ? ' ⚔' : c.allies.includes(n.id) ? ' 🤝' : ''}</td><td>${govBadge(n.gov)}</td><td>${strength(n).toFixed(0)}</td><td class="${rel < 0 ? 'bad' : 'good'}">${Math.round(rel)}</td></tr>`;
    }
    return h + '</table>';
  },

  viewDiplomacy(c, g) {
    const t = this.selected != null ? g.countries[this.selected] : null;
    if (!t || t.id === c.id) {
      let h = '<div class="alert info">Click a nation on the map (or below) to open relations with it.</div><table class="list"><tr><th>Nation</th><th>Gov</th><th>Relations</th><th></th></tr>';
      const others = g.countries.filter(x => x.alive && x.id !== c.id).sort((a, b) => relation(g, c.id, b.id) - relation(g, c.id, a.id));
      for (const o of others) {
        const rel = relation(g, c.id, o.id);
        const tag = atWarWith(g, c.id, o.id) ? '⚔ war' : c.allies.includes(o.id) ? '🤝 ally' : c.trade.includes(o.id) ? '⇄ trade' : '';
        h += `<tr class="click" data-act="select" data-id="${o.id}"><td>${swatch(o)} ${esc(o.name)}</td><td>${govBadge(o.gov)}</td><td class="${rel < 0 ? 'bad' : 'good'}">${Math.round(rel)}</td><td class="small">${tag}</td></tr>`;
      }
      return h + '</table>';
    }
    if (!t.alive) return `<div class="alert bad">The ${esc(t.name)} no longer exists.</div><button data-act="select" data-id="-1">Back</button>`;
    const rel = relation(g, c.id, t.id);
    const status = [];
    if (atWarWith(g, c.id, t.id)) status.push('<span class="bad">⚔ At war</span>');
    if (c.allies.includes(t.id)) status.push('<span class="good">🤝 Allied</span>');
    if (c.trade.includes(t.id)) status.push('<span class="good">⇄ Trade agreement</span>');
    if (hasTruce(g, c.id, t.id)) status.push(`<span class="muted">Truce until ${gameDate(g, truceUntil(g, c.id, t.id))}</span>`);
    if (getNeighbors(g, c.id).includes(t.id)) status.push('<span class="muted">Neighbor</span>');
    let h = `<button data-act="select" data-id="-1" class="small" style="margin-bottom:8px">← All nations</button><div class="card">${this.nationHeader(t)}</div>`;
    h += `<div class="card">${bar('Relations with us', (rel + 100) / 2, { text: Math.round(rel), color: rel < -30 ? 'var(--bad)' : rel > 30 ? 'var(--good)' : 'var(--warn)' })}
      <div class="small">${status.join(' · ') || '<span class="muted">No agreements</span>'}</div></div>`;
    const ratio = strength(c) / Math.max(0.01, strength(t));
    h += `<div class="card grid2">
      <div class="kv"><span>Population</span><span>${fmtPop(t.pop)}</span></div>
      <div class="kv"><span>GDP</span><span>${fmtMoney(t.gdp)}</span></div>
      <div class="kv"><span>Stability</span><span style="color:${statColor(t.stability)}">${Math.round(t.stability)}</span></div>
      <div class="kv"><span>Approval</span><span>${Math.round(t.approval)}</span></div>
      <div class="kv"><span>Strength</span><span>${strength(t).toFixed(0)}</span></div>
      <div class="kv"><span>vs. ours</span><span class="${ratio >= 1 ? 'good' : 'bad'}">${ratio >= 1 ? 'We are ' + ratio.toFixed(1) + '× stronger' : 'They are ' + (1 / ratio).toFixed(1) + '× stronger'}</span></div>
      <div class="kv"><span>Allies</span><span>${t.allies.length ? t.allies.map(id => esc(g.countries[id].name)).join(', ') : 'none'}</span></div>
      <div class="kv"><span>Provinces</span><span>${t.provinceCount}</span></div>
    </div>
    <div class="card small">Their public is ${ideologyText(t.ideo)}.</div>`;
    h += `<div class="card"><h3>Actions</h3><div class="actions">`;
    for (const { a, reason } of diploActionList(g, c, t)) h += this.actionBtn(c, 'diplo', a, reason, `data-target="${t.id}"`);
    return h + '</div></div>';
  },

  viewWorld(c, g) {
    const keys = {
      name: x => x.name, gov: x => x.gov, pop: x => -x.pop, gdp: x => -x.gdp, str: x => -strength(x), stab: x => -x.stability,
    };
    const k = keys[this.worldSort];
    const rows = g.countries.filter(x => x.alive).sort((a, b) => { const va = k(a), vb = k(b); return va < vb ? -1 : va > vb ? 1 : 0; });
    let h = `<p class="small muted">${rows.length} nations remain · ${g.wars.length} wars raging · ${g.stats.regimeChanges} regime changes so far.</p>
      <table class="list"><tr><th data-act="sort" data-k="name">Nation</th><th data-act="sort" data-k="gov">Gov</th><th data-act="sort" data-k="pop">Pop</th><th data-act="sort" data-k="gdp">GDP</th><th data-act="sort" data-k="str">Mil.</th><th data-act="sort" data-k="stab">Stab.</th></tr>`;
    for (const x of rows) {
      h += `<tr class="click${x.id === c.id ? ' me' : ''}" data-act="select" data-id="${x.id}"><td>${swatch(x)} ${esc(x.name)}${isAtWar(g, x.id) ? ' ⚔' : ''}</td><td>${govBadge(x.gov)}</td><td>${fmtPop(x.pop)}</td><td>${fmtMoney(x.gdp)}</td><td>${strength(x).toFixed(0)}</td><td style="color:${statColor(x.stability)}">${Math.round(x.stability)}</td></tr>`;
    }
    h += '</table>';
    const fallen = g.countries.filter(x => !x.alive);
    if (fallen.length) h += `<h4>Fallen nations</h4><p class="small muted">${fallen.map(x => esc(x.name)).join(', ')}</p>`;
    const counts = {};
    for (const x of rows) counts[x.gov] = (counts[x.gov] || 0) + 1;
    h += `<h4>Systems of the world</h4>${GOV_ORDER.filter(k2 => counts[k2]).map(k2 => `<div class="kv"><span>${govBadge(k2)} ${GOVS[k2].name}</span><span>${counts[k2]}</span></div>`).join('')}`;
    return h;
  },

  viewNews(c, g) {
    let items = g.log.slice().reverse();
    if (this.newsMine) items = items.filter(l => l.ids.includes(c.id));
    let h = `<label class="small"><input type="checkbox" data-act="newsmine" ${this.newsMine ? 'checked' : ''}> Only news about ${esc(c.name)}</label><ul class="news">`;
    for (const l of items.slice(0, 200)) h += `<li class="${l.kind}${l.ids.includes(c.id) ? ' mine' : ''}"><span class="d">${gameDate(g, l.m)}</span>${esc(l.text)}</li>`;
    return h + '</ul>';
  },

  viewChoose() {
    const g = App.game;
    let h = '<h3>Choose your nation</h3><p class="small muted">Click a nation on the map (or in the list) to inspect it. Small, unstable nations are a harder start.</p>';
    const t = this.selected != null ? g.countries[this.selected] : null;
    if (t) {
      const gv = GOVS[t.gov];
      h += `<div class="card">${this.nationHeader(t)}<p class="small">${gv.desc}</p>
        ${bar('Stability', t.stability)}${bar('Approval', t.approval)}
        <div class="grid2" style="margin-top:6px">
          <div class="kv"><span>Population</span><span>${fmtPop(t.pop)}</span></div>
          <div class="kv"><span>GDP</span><span>${fmtMoney(t.gdp)}</span></div>
          <div class="kv"><span>Provinces</span><span>${t.provinceCount}</span></div>
          <div class="kv"><span>Neighbors</span><span>${getNeighbors(g, t.id).length}</span></div>
        </div>
        <p class="small">The public is ${ideologyText(t.ideo)}.</p>
        <button class="primary" data-act="lead" data-id="${t.id}" style="width:100%;padding:10px">Lead the ${esc(formalName(t))}</button></div>`;
    }
    h += '<table class="list"><tr><th>Nation</th><th>Gov</th><th>Pop</th><th>GDP</th><th>Stab.</th></tr>';
    for (const x of g.countries.filter(x => x.alive).sort((a, b) => b.gdp - a.gdp)) {
      h += `<tr class="click${t && x.id === t.id ? ' me' : ''}" data-act="select" data-id="${x.id}"><td>${swatch(x)} ${esc(x.name)}</td><td>${govBadge(x.gov)}</td><td>${fmtPop(x.pop)}</td><td>${fmtMoney(x.gdp)}</td><td style="color:${statColor(x.stability)}">${Math.round(x.stability)}</td></tr>`;
    }
    h += '</table><div style="display:flex;gap:6px;margin-top:12px"><button data-act="regen">Generate a different world</button><button data-act="random">Random nation</button></div>';
    return h;
  },

  // ------------------------------------------------------------ interaction

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
    tip.innerHTML = `<b>${esc(pr.name)}</b>${pr.id === c.capital ? ' <span class="warn">★ capital</span>' : ''} <span class="muted">· ${fmtPop(pr.pop)}</span><br>
      ${swatch(c)} ${esc(formalName(c))}<br><span class="muted">${GOVS[c.gov].name} · ${esc(leaderLine(c))}</span><br>
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
    if (p < 0) { this.select(null); return; }
    const owner = g.world.provinces[p].owner;
    if (!this.choosing) this.tab = owner === g.player ? 'overview' : 'diplomacy';
    this.select(owner === g.player && !this.choosing ? null : owner);
  },

  movementsHtml(c) {
    const M = ensureMovements(c);
    const active = MOVEMENT_KEYS.filter(k => M[k].support >= 2).sort((a, b) => M[b].support - M[a].support);
    let h = `<div class="card"><h3>Political movements</h3><p class="small muted">Movements grow out of the pops when a class has a grievance. Each makes a demand, and grows more radical while it goes unmet. Radical mass movements fuel unrest and can try to seize power.</p>`;
    if (!active.length) return h + '<p class="small muted">No significant movements.</p></div>';
    for (const k of active) {
      const def = MOVEMENTS[k], m = M[k], met = def.demand.met(c);
      h += `<div class="person">${m.leader ? `<div class="pp">${portraitSVG(m.leader, { size: 48, gov: c.gov })}</div>` : `<div class="pp empty" style="width:48px;height:58px">${def.icon}</div>`}<div class="pinfo">
        <div><b>${def.icon} ${def.name}</b> <span class="small muted">${pct(m.support / 100)} of the population${def.gov ? ' · wants a ' + GOVS[def.gov].name : ''}</span></div>
        <div class="small">${m.leader ? 'Led by ' + esc(m.leader.name) + ' · ' : ''}Demand: <span class="${met ? 'good' : 'warn'}">${esc(demandText(c, k))}${met ? ' ✓' : ''}</span></div>
        ${bar('Radicalism', m.radicalism, { invert: true, tip: 'Above 72, a movement with over 22% support may rise up.' })}</div>
        <div class="pact">${Object.entries(MOVEMENT_ACTIONS).map(([a, A]) => `<button class="small" data-act="move" data-k="${k}" data-a="${a}" ${c.pc < A.pc || (a === 'enact' && met) || (a === 'coopt' && !m.leader) ? 'disabled' : ''} title="${A.pc} PC">${A.name}</button>`).join('')}</div></div>`;
    }
    return h + '</div>';
  },

  viewResearch(c, g) {
    const R = ensureResearch(c);
    const rate = researchRate(c);
    const cur = R.current ? TECHS[R.current] : null;
    let h = `<div class="card"><h3>Research</h3>
      ${cur ? `<div class="kv"><span>Researching <b>${cur.name}</b></span><span>${Math.floor(R.progress)} / ${cur.cost}</span></div>${bar('', R.progress / cur.cost * 100, { text: `~${Math.ceil((cur.cost - R.progress) / rate)} months`, color: 'var(--accent2)' })}`
        : '<div class="alert warn">No research project selected. Pick one below; our scientists are idle.</div>'}
      <p class="small muted">${rate.toFixed(1)} research points per month, from education spending, literacy (${pct(c.econ.literacy)}) and the size of the economy. Switching projects loses half the progress. ${R.done.length} of ${TECH_KEYS.length} technologies discovered.</p></div>`;
    for (const cat of TECH_CATS) {
      h += `<div class="card"><h3>${cat}</h3>`;
      for (const id of TECH_KEYS.filter(k => TECHS[k].cat === cat)) {
        const T = TECHS[id], done = R.done.includes(id), avail = techAvailable(c, id);
        const reqs = T.req.filter(r => !R.done.includes(r)).map(r => TECHS[r].name);
        h += `<div class="tech ${done ? 'done' : avail ? 'avail' : 'locked'}${R.current === id ? ' cur' : ''}"><div><b>${done ? '✓ ' : ''}${T.name}</b> <span class="small muted">${T.cost} pts</span><div class="small">${T.desc}</div>
          ${reqs.length ? `<div class="small muted">Requires ${reqs.join(', ')}</div>` : ''}</div>
          ${avail ? `<button class="small ${R.current === id ? 'active' : ''}" data-act="research" data-id="${id}" ${R.current === id ? 'disabled' : ''}>${R.current === id ? 'In progress' : 'Research'}</button>` : ''}</div>`;
      }
      h += '</div>';
    }
    return h;
  },

  showPeaceModal(warId) {
    const g = App.game, c = this.player();
    const war = g.wars.find(w => w.id === warId);
    if (!war) return;
    const enemy = g.countries[(war.a.includes(c.id) ? war.b : war.a)[0]];
    const score = warScore(g, war, c.id);
    const canRegime = enemy.gov !== c.gov;
    const body = `<p>War score: <b class="${score >= 0 ? 'good' : 'bad'}">${fmtSigned(score, 0)}</b> (provinces taken and enemy exhaustion). The more you demand, the less likely ${esc(enemy.name)} is to accept.</p>
      <div class="form-row"><label>Provinces</label><input type="range" id="pt-prov" min="0" max="3" value="0" style="flex:1"><b id="pt-prov-v" style="width:20px">0</b></div>
      <label class="small"><input type="checkbox" id="pt-rep"> Reparations: 3% of their GDP a year for five years</label><br>
      ${canRegime ? `<label class="small"><input type="checkbox" id="pt-reg"> Impose our system: make them a ${GOVS[c.gov].name}</label>` : ''}
      <p style="margin-top:12px">Chance they accept: <b id="pt-chance"></b></p><p class="small muted">Sending an offer costs 10 PC.</p>`;
    const terms = () => ({ provinces: +$('#pt-prov').value, reparations: $('#pt-rep').checked, regime: !!($('#pt-reg') && $('#pt-reg').checked) });
    this.openModal({
      title: `Negotiate Peace with ${esc(enemy.name)}`, body, dismiss: true, row: true,
      buttons: [{ label: 'Cancel' }, {
        label: 'Send offer', cls: 'primary', disabled: c.pc < 10, fn: () => {
          c.pc -= 10;
          const r = offerPeaceTerms(g, warId, terms());
          this.track('diplo:peace', r.ok);
          this.toast(r.msg, r.ok ? 'good' : 'bad');
        },
      }],
      onOpen: el => {
        const upd = () => { el.querySelector('#pt-prov-v').textContent = el.querySelector('#pt-prov').value; el.querySelector('#pt-chance').textContent = pct(peaceChance(g, war, c.id, terms())); };
        el.querySelectorAll('input').forEach(i => i.addEventListener('input', upd));
        upd();
      },
    });
  },

  // ------------------------------------------------------------ campaign

  campaignCheck() {
    const g = App.game;
    if (!g || !g.campaign || this.choosing) return;
    const cs = g.campaign;
    if (cs.ended) { if (!cs.endingShown && !this.modalOpen()) this.showEnding(); return; }
    if (this.modalOpen()) return;
    const r = campaignUpdate(g, { tab: this.tab, selected: this.selected });
    this.renderCampaign();
    if (!r) return;
    if (r.completed) this.toast(`✔ ${r.completed}${r.msg ? ': ' + r.msg : ''}`, 'good');
    if (r.ending) { this.showEnding(); return; }
    if (r.brief !== undefined && g.campaign.briefed !== g.campaign.step) this.showBriefing();
  },

  track(key, ok) {
    const g = App.game;
    if (ok && g && g.campaign && !g.campaign.ended) g.campaign.actions[key] = true;
  },

  showBriefing() {
    const g = App.game, cs = g.campaign, step = CAMPAIGN_STEPS[cs.step];
    App.setSpeed(0);
    const c = g.countries[g.player];
    const lines = step.brief.map(([who, text]) => {
      const ch = campaignChar(g, who);
      let owner = c;
      for (const o of g.countries) if (ch && findCharacter(o, ch.id)) owner = o;
      const t = typeof text === 'function' ? text(g, c) : text;
      return `<div class="line">${ch ? portraitSVG(ch, { size: 56, gov: owner.gov }) : ''}<div><div class="who">${ch ? esc(ch.name) : ''} <span class="muted">${ch ? esc(roleTitle(owner, ch)) : ''}</span></div><div>${esc(t)}</div></div></div>`;
    }).join('');
    this.openModal({
      title: `<span class="chapter">${esc(step.chapter)}</span><br>${esc(step.title)}`, wide: true,
      body: `<div class="dialogue">${lines}</div><div class="objective">🎯 ${esc(campaignObjective(g))}</div>`,
      buttons: [{ label: 'Understood', cls: 'primary', fn: () => { campaignBriefed(g); } }],
    });
  },

  showEnding() {
    const g = App.game, cs = g.campaign;
    cs.endingShown = true;
    App.setSpeed(0);
    const e = cs.ending;
    this.openModal({
      title: `<span class="chapter">The First Republic · Ending</span><br>${esc(e.title)}`, wide: true,
      body: e.text.map(p => `<p>${esc(p)}</p>`).join('') + '<p class="small muted">The campaign is over, but the world goes on. Keep playing as long as you like.</p>',
      buttons: [{ label: 'Keep playing', cls: 'primary' }, { label: 'Start a new world', fn: () => { this.showSetup(false); } }],
      row: true,
    });
    this.renderCampaign();
  },

  renderCampaign() {
    const box = $('#campaign-box');
    const g = App.game;
    if (!box) return;
    if (!g || !g.campaign || g.campaign.ended || this.choosing) { box.classList.add('hidden'); this.applyHighlight(null); return; }
    const cs = g.campaign, step = CAMPAIGN_STEPS[cs.step];
    box.classList.remove('hidden');
    box.innerHTML = `<div class="cb-head"><span>${esc(step.chapter)}</span><span>${cs.step + 1}/${CAMPAIGN_STEPS.length}</span></div>
      <div class="cb-title">${esc(step.title)}</div><div class="cb-obj">🎯 ${esc(campaignObjective(g))}</div>
      ${step.hint ? `<details><summary>Hint</summary><div class="small">${esc(step.hint)}</div></details>` : ''}
      <button class="small" id="cb-brief">Briefing</button>`;
    $('#cb-brief').onclick = () => this.showBriefing();
    this.applyHighlight(cs.briefed === cs.step ? step.highlight : null);
  },

  applyHighlight(hl) {
    document.querySelectorAll('.pulse').forEach(el => el.classList.remove('pulse'));
    if (!hl) return;
    if (hl.tab && this.tab !== hl.tab) { const t = document.querySelector(`#tabs [data-tab="${hl.tab}"]`); if (t) t.classList.add('pulse'); return; }
    if (hl.sel) document.querySelectorAll(hl.sel).forEach((el, i) => { if (i < 6) el.classList.add('pulse'); });
  },

  // ------------------------------------------------------------ modals & toasts

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

  showPending(it) {
    const g = App.game;
    const c = g.countries[g.player];
    const done = msg => { if (msg) this.toast(msg, 'info'); };
    switch (it.type) {
      case 'notice':
        this.openModal({ title: esc(it.title), body: this.withPortrait(it.charId, `<p>${esc(it.text)}</p>`), buttons: [{ label: 'Continue', cls: 'primary' }] });
        break;
      case 'event': {
        const ev = eventById(it.id);
        this.openModal({
          title: esc(ev.title), body: this.withPortrait(it.charId, `<p>${esc(it.text)}</p>`),
          buttons: eventOptions(g, c, it).map(({ o, i }) => ({
            label: `<div class="lbl">${esc(o.label)}</div><div>${describeEffects(o.fx)}</div>`, cls: 'opt',
            disabled: !!(o.fx && o.fx.pc && c.pc < -o.fx.pc),
            fn: () => { const extra = resolveEvent(g, it, i); if (extra) this.toast(`${ev.title}: ${extra}`, 'info'); },
          })),
        });
        break;
      }
      case 'election': {
        const res = it.result;
        const winner = res.results.find(r => r.id === res.winner);
        let body = `<p>Turnout: ${pct(res.turnout)}. ${res.fraud ? '<span class="warn">The ballot boxes were stuffed in our favor.</span>' : ''}</p>${this.seatBar(res)}`;
        if (res.exposed) body += '<div class="alert bad" style="margin-top:10px">The fraud has been exposed! Stability −15, legitimacy −25.</div>';
        if (it.won) {
          body += `<p class="good">The <b>${esc(winner.name)}</b> is returned to power. Legitimacy is renewed.</p>`;
          this.openModal({ title: 'Election Victory', body, buttons: [{ label: 'Continue', cls: 'primary' }] });
        } else {
          const chance = clamp(c.factions.military / 100 * 0.9 - 0.05, 0.05, 0.9);
          body += `<p>The <b>${esc(winner.name)}</b> has won. Will you accept the people's verdict?</p>
            <p class="small muted">If you concede, you keep guiding the nation under the new government. If you refuse, you need the army behind you (military loyalty ${Math.round(c.factions.military)}).</p>`;
          this.openModal({
            title: 'Election Defeat', body, buttons: [
              { label: 'Concede gracefully', cls: 'primary', fn: () => { const r = resolveElectionLoss(g, 'concede'); this.toast(r.msg, 'info'); } },
              { label: `Refuse to step down (${pct(chance)} chance the army backs you)`, cls: 'danger', fn: () => { const r = resolveElectionLoss(g, 'refuse'); this.openModal({ title: r.ok ? 'The Republic Is Dead' : 'Coup Failed', body: `<p>${esc(r.msg)}</p>`, buttons: [{ label: 'Continue', cls: 'primary' }] }); } },
            ],
          });
        }
        break;
      }
      case 'deposed': {
        if (g.campaign && !g.campaign.ended) setFlag(g, 'cDeposed');
        const how = it.how === 'coup' ? 'a military coup' : 'a revolution';
        this.openModal({
          title: 'You Have Been Overthrown',
          body: `<p>The ${esc(it.oldFormal)} has fallen to ${how}. The <b>${esc(formalName(c))}</b> now rules under ${esc(leaderLine(c))}.</p>
            <p>You lasted ${Math.floor((g.playerMonths || 0) / 12)} years and ${(g.playerMonths || 0) % 12} months.</p>
            <p class="small muted">You can carry on guiding the nation under its new regime, or start over.</p>`,
          buttons: [
            { label: 'Continue under the new regime', cls: 'primary', fn: () => { g.playerMonths = 0; } },
            { label: 'Choose another nation', fn: () => { this.choosing = true; g.player = -1; this.selected = null; App.setSpeed(0); } },
            { label: 'Start a new world', fn: () => { this.showSetup(false); } },
          ],
        });
        break;
      }
      case 'gameover':
        App.setSpeed(0);
        this.openModal({
          title: 'Your Nation Has Fallen', body: `<p>${esc(it.reason)}</p>`,
          buttons: [
            { label: 'Choose another nation in this world', cls: 'primary', fn: () => { this.choosing = true; g.player = -1; this.selected = null; } },
            { label: 'Start a new world', fn: () => { this.showSetup(false); } },
          ],
        });
        break;
      case 'allyCall': {
        const ally = g.countries[it.ally], enemy = g.countries[it.enemy];
        this.openModal({
          title: 'Our Ally Calls for Aid',
          body: `<p>${esc(formalName(enemy))} has attacked our ally, the ${esc(formalName(ally))}. They invoke our alliance and ask us to join the war.</p>
            <p class="small muted">Enemy strength ${strength(enemy).toFixed(0)} · ours ${strength(c).toFixed(0)}. Refusing dissolves the alliance.</p>`,
          buttons: [
            { label: 'Honor the alliance: join the war', cls: 'danger', fn: () => done(resolveAllyCall(g, it, true)) },
            { label: 'Stay out of it', fn: () => done(resolveAllyCall(g, it, false)) },
          ],
        });
        break;
      }
      case 'peaceOffer': {
        const from = g.countries[it.from];
        const war = g.wars.find(w => w.id === it.warId);
        if (!war) { this.processPending(); return; }
        this.openModal({
          title: it.terms && peaceTermsCost(it.terms) > 0 ? 'Peace Terms Demanded' : 'Peace Offer',
          body: this.withPortrait(from.leader.id, it.terms && peaceTermsCost(it.terms) > 0 ? `<p>${esc(formalName(from))} offers to end the ${esc(war.name)}, but on its terms: we must cede <b>${it.terms.provinces} province${it.terms.provinces > 1 ? 's' : ''}</b>${it.terms.reparations ? ' and pay <b>reparations</b> (3% of our GDP a year for five years)' : ''}.</p><p class="small muted">War score: ${fmtSigned(warScore(g, war, c.id), 0)} in their favor.</p>` : `<p>${esc(formalName(from))} proposes a white peace to end the ${esc(war.name)}. Both sides would keep what they hold now.</p>`),
          buttons: [
            { label: 'Accept peace', cls: 'primary', fn: () => done(resolvePeaceOffer(g, it, true)) },
            { label: 'Fight on', fn: () => done(resolvePeaceOffer(g, it, false)) },
          ],
        });
        break;
      }
      case 'diploOffer': {
        const from = g.countries[it.from];
        if (!from.alive) { this.processPending(); return; }
        const what = it.kind === 'alliance' ? 'a defensive alliance' : 'a trade agreement';
        this.openModal({
          title: it.kind === 'alliance' ? 'Alliance Proposal' : 'Trade Proposal',
          body: `<p>The ${esc(formalName(from))} (${GOVS[from.gov].name}) proposes ${what}.</p>${it.kind === 'alliance' ? '<p class="small muted">Allies are called upon when either is attacked.</p>' : '<p class="small muted">Trade boosts growth for both.</p>'}`,
          buttons: [
            { label: 'Accept', cls: 'primary', fn: () => done(resolveDiploOffer(g, it, true)) },
            { label: 'Decline', fn: () => done(resolveDiploOffer(g, it, false)) },
          ],
        });
        break;
      }
      default:
        this.processPending();
    }
  },

  confirmWar(targetId) {
    const g = App.game, c = this.player(), t = g.countries[targetId];
    const theirAllies = t.allies.filter(id => g.countries[id].alive).map(id => g.countries[id]);
    const pen = free(c) ? (relation(g, c.id, t.id) < -50 ? -2 : -8) : 0;
    this.openModal({
      title: `Declare War on ${esc(t.name)}?`,
      body: `<p>Our strength: <b>${strength(c).toFixed(0)}</b> · theirs: <b>${strength(t).toFixed(0)}</b> (defenders get +30%).</p>
        ${theirAllies.length ? `<p class="warn">Their allies may join: ${theirAllies.map(a => esc(a.name) + ' (' + strength(a).toFixed(0) + ')').join(', ')}.</p>` : '<p class="small muted">They have no allies.</p>'}
        ${pen ? `<p class="bad small">Our public dislikes wars of aggression: approval ${pen}.</p>` : ''}
        <p class="small muted">Capture their capital once a third of their land is gone, or take 60% of it, and they must capitulate.</p>`,
      row: true,
      buttons: [
        { label: 'Cancel' },
        { label: 'Declare war (20 PC)', cls: 'danger', fn: () => { const r = performDiplo(g, 'war', targetId); this.toast(r.msg, r.ok ? 'bad' : 'bad'); } },
      ],
    });
  },

  showRegimeModal() {
    const g = App.game, c = this.player();
    const opts = regimeOptions(g, c);
    const body = `<p class="small">Remaking the state costs <b>${REGIME_PC} political capital</b>. Success depends on the new regime's power base and how well it fits public opinion. <span class="bad">Failure costs 20 stability, and there is a 35% chance the backlash topples you.</span></p>`;
    this.openModal({
      title: 'Change Form of Government', wide: true, dismiss: true, body,
      buttons: opts.map(o => {
        const gv = GOVS[o.gov];
        const base = Object.keys(gv.base).map(f => FACTIONS[f].name).join(', ');
        return {
          cls: 'gov-option', disabled: !!o.reason,
          label: `<div>${govBadge(o.gov)} <b>${gv.name}</b> <span class="meth">· ${o.method} · backed by ${base}</span><div class="small muted">${gv.desc}</div>${o.reason ? `<div class="small bad">${o.reason}</div>` : ''}</div>
            <div class="chance" style="color:${statColor(o.chance * 100)}">${pct(o.chance)}</div>`,
          fn: () => {
            const r = attemptRegimeChange(g, o.gov);
            if (!g.pending.some(p => p.type === 'deposed')) this.openModal({ title: r.ok ? 'A New Order' : 'The Attempt Fails', body: `<p>${esc(r.msg)}</p>`, buttons: [{ label: 'Continue', cls: 'primary' }] });
          },
        };
      }).concat([{ label: 'Cancel' }]),
    });
  },

  showSetup(first) {
    App.setSpeed(0);
    let hasSave = false;
    try { hasSave = !!localStorage.getItem(SAVE_KEY); } catch (e) { /* storage unavailable */ }
    const seed = Math.random().toString(36).slice(2, 8);
    const body = `<p class="setup-title">The World As It Should Be</p>
      <p class="muted">New here? Start with the campaign: it's a short story that teaches you the game.</p>
      <p class="muted">A political simulator. Generate a world, take the helm of any nation, and steer it through elections, coups, revolutions and wars. Turn it into a democracy, a monarchy, a junta, a communist or fascist state, or a theocracy, and try to survive.</p>
      <div class="form-row"><label>World seed</label><input type="text" id="setup-seed" value="${seed}"><button id="setup-dice" title="Random seed">🎲</button></div>
      <div class="form-row"><label>World</label><select id="setup-model" style="flex:1">${WORLD_MODEL_ORDER.map(k => `<option value="${k}">${WORLD_MODELS[k].name}</option>`).join('')}</select></div>
      <p class="small muted" id="setup-model-desc" style="margin:-4px 0 6px 140px">${WORLD_MODELS.continents.desc}</p>
      <div class="form-row"><label>Nations</label><input type="range" id="setup-n" min="4" max="40" value="14" style="flex:1"><b id="setup-n-v" style="width:24px">14</b></div>
      <div class="form-row"><label>Map size</label><select id="setup-size"><option value="small">Small</option><option value="medium" selected>Medium</option><option value="large">Large</option></select></div>`;
    const buttons = [{ label: '▶ Play the campaign: The First Republic', cls: 'gold', title: 'A story campaign that teaches you the game', fn: () => { App.startCampaign(); } }, {
      label: 'Generate world', cls: 'primary', fn: () => {
        App.newWorld($('#setup-seed').value || 'world', { model: $('#setup-model').value, size: $('#setup-size').value, countries: +$('#setup-n').value });
      },
    }];
    if (hasSave) buttons.push({ label: 'Load saved game', fn: () => { App.load(); } });
    if (!first) buttons.push({ label: 'Cancel' });
    this.openModal({
      title: '', body, buttons, row: true,
      onOpen: el => {
        el.querySelector('#setup-n').addEventListener('input', e => { el.querySelector('#setup-n-v').textContent = e.target.value; });
        el.querySelector('#setup-model').addEventListener('change', e => {
          const m = WORLD_MODELS[e.target.value];
          el.querySelector('#setup-model-desc').textContent = m.desc;
          const n = m.countries || 14;
          el.querySelector('#setup-n').value = n;
          el.querySelector('#setup-n-v').textContent = n;
        });
        el.querySelector('#setup-dice').addEventListener('click', () => { el.querySelector('#setup-seed').value = Math.random().toString(36).slice(2, 8); });
      },
    });
  },

  showMenu() {
    const g = App.game;
    const playing = !!this.player();
    App.setSpeed(0);
    this.openModal({
      title: 'Menu', dismiss: true,
      body: g ? `<p class="small muted">World: <b>${esc(WORLD_MODELS[g.world.model].name)}</b> · seed <b>${esc(g.seed)}</b> · ${gameDate(g)}</p>` : '',
      buttons: [
        { label: 'Save game', disabled: !playing, fn: () => { App.save(); } },
        { label: 'Load saved game', fn: () => { App.load(); } },
        { label: 'New world…', fn: () => { this.showSetup(false); } },
        { label: 'How to play', fn: () => { this.showHelp(); } },
        { label: 'Play the campaign', fn: () => { App.startCampaign(); } },
        { label: 'Close' },
      ],
    });
  },

  showHelp() {
    this.openModal({
      title: 'How to Play', wide: true, dismiss: true,
      body: `<p>Each turn is one month. Press <b>Next month</b> or use the speed controls (Space to pause, 1–3 for speed). Your goal is to stay in power and shape the world as you think it should be.</p>
      <h4>Stability is everything</h4>
      <p class="small">Stability comes from <b>approval</b> (most important in democracies), the loyalty of the regime's <b>power base</b> (★ factions, most important in autocracies), <b>legitimacy</b>, and low <b>unrest</b>. Below ${CRISIS_LEVEL} stability, or above 55 unrest, the regime can fall to a coup or revolution.</p>
      <h4>Governments</h4>
      <p class="small">${GOV_ORDER.map(k => `${govBadge(k)} ${GOVS[k].desc}`).join('<br><br>')}</p>
      <h4>Elections</h4>
      <p class="small">Democracies and constitutional monarchies vote every 4 years. Parties poll according to how close they are to public opinion, and the governing party gains or loses votes with approval. Lose, and you can concede or refuse to leave (if the army backs you). Campaigns, snap elections, ballot rigging and states of emergency are all on the table.</p>
      <h4>Pops & the economy</h4>
      <p class="small">Every province is home to nine social classes (peasants, laborers, workers, soldiers, clerks, officials, clergy, capitalists, landowners), each with its own income, savings, standard of living and politics. Farms, mines and factories employ them and turn inputs into goods: iron and coal into steel, steel into tools, arms and appliances, fiber into clothes, and so on. Raw producers need the right land or deposits, so resources are scarce.</p>
      <p class="small">Each nation has a market where prices follow supply and demand, and shortages and surpluses are traded on the world market. Pops buy basic needs first, then everyday goods, then luxuries. Their standard of living against what their class expects drives approval, unrest and which way they vote, and the poor radicalize. Capitalists invest profits in whatever pays best; the state builds from its investment fund. Watch the <b>Market</b> and <b>Pops</b> tabs, and build in the <b>Economy</b> tab.</p>
      <h4>Budget</h4>
      <p class="small">Set taxes, tariffs and spending in the Economy tab. Spending flows back into the economy as wages and purchases. Deficits build debt; above 150% of GDP the state defaults. Education raises literacy and productivity; infrastructure makes every building more productive; welfare supports the poor; police suppress unrest at the cost of freedom.</p>
      <h4>War & diplomacy</h4>
      <p class="small">Click any nation to improve relations, trade, ally, fund rebels or declare war. You can only invade nations that share a border or a narrow strait. Battles capture provinces; take the enemy capital after a third of their land is gone, or take 60%, and they capitulate. Lose all your provinces and the game is over.</p>
      <h4>Political capital (★ PC)</h4>
      <p class="small">Earned every month, faster in autocracies and when stable. Spend it on actions, concessions to factions, diplomacy and regime change.</p>`,
      buttons: [{ label: 'Got it', cls: 'primary' }],
    });
  },

  showIntro(c) {
    const g = App.game;
    const gv = GOVS[c.gov];
    this.openModal({
      title: `You Lead the ${esc(formalName(c))}`,
      body: `<p>${esc(leaderLine(c))} takes office in ${gameDate(g)}. Your nation is a <b>${gv.name}</b>: ${gv.desc}</p>
        <p class="small">The public is <b>${ideologyText(c.ideo)}</b>. ${gv.elections === 'free' ? `The next election is in ${c.nextElection - g.month} months.` : `Your power rests on the ${Object.keys(gv.base).map(f => FACTIONS[f].name).join(' and ')}.`}</p>
        <p class="small muted">Tip: check the Politics tab for factions and actions, and the Economy tab to set taxes and spending. Press Next month when ready.</p>`,
      buttons: [{ label: 'Begin', cls: 'primary' }, { label: 'How to play', fn: () => { this.showHelp(); } }],
      row: true,
    });
  },
};
