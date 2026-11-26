'use strict';
// Modal dialogs: pending events and decisions, setup, menu, help, campaign briefings.

Object.assign(UI, {
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

  showReleaseModal(coreId) {
    const g = App.game, c = this.player(), N = g.countries[coreId];
    const gr = releasableGroups(g, c).find(x => x.core === coreId);
    if (!gr) return;
    const done = r => { this.toast(r.msg, r.ok ? 'good' : 'bad'); this.track('release', r.ok); };
    if (N.alive) {
      this.openModal({ title: `Return Land to ${esc(N.name)}?`, dismiss: true, row: true,
        body: `<p>Hand ${gr.provs.length} province${gr.provs.length > 1 ? 's' : ''} (${gr.provs.map(p => esc(p.name)).join(', ')}) back to the ${esc(formalName(N))}. Our infamy falls and relations improve.</p>`,
        buttons: [{ label: 'Cancel' }, { label: 'Return the land', cls: 'primary', fn: () => done(releaseNation(g, c.id, coreId)) }] });
      return;
    }
    this.openModal({ title: `Restore ${esc(N.name)}?`, dismiss: true,
      body: `<p>Revive the fallen nation of ${esc(N.name)} in ${gr.provs.length} province${gr.provs.length > 1 ? 's' : ''} we hold: ${gr.provs.map(p => esc(p.name)).join(', ')}. It gets a new government and leaders. As our subject it pays tribute and fights in our wars; as an independent nation it will simply remember our generosity.</p>`,
      buttons: [
        { label: `Restore as an independent ${GOVS[c.gov].name}`, cls: 'primary', fn: () => done(releaseNation(g, c.id, coreId, { gov: c.gov })) },
        { label: 'Restore as our protectorate', fn: () => done(releaseNation(g, c.id, coreId, { gov: c.gov, subject: 'protectorate' })) },
        { label: 'Restore as our puppet', fn: () => done(releaseNation(g, c.id, coreId, { gov: c.gov, subject: 'puppet' })) },
        { label: 'Cancel' },
      ] });
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
      ${canRegime ? `<label class="small"><input type="checkbox" id="pt-reg"> Impose our system: make them a ${GOVS[c.gov].name}</label><br>` : ''}
      ${enemy.overlord == null && c.overlord == null ? `<label class="small"><input type="checkbox" id="pt-sub"> Make them our vassal (our puppet, if we also impose our system)</label>` : ''}
      <p style="margin-top:12px">Chance they accept: <b id="pt-chance"></b></p><p class="small muted">Sending an offer costs 10 PC. If they refuse, they won't hear new terms for six months. Infamy: +${INFAMY.peaceProvince} per province, +${INFAMY.reparations} for reparations, +${INFAMY.regime} for imposing our system (current: ${Math.round(c.infamy || 0)}).</p>`;
    const terms = () => ({ provinces: +$('#pt-prov').value, reparations: $('#pt-rep').checked, regime: !!($('#pt-reg') && $('#pt-reg').checked), subjugate: !!($('#pt-sub') && $('#pt-sub').checked) });
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
      case 'blocInvite': {
        const b = blocById(g, it.bloc);
        if (!b) { this.processPending(); return; }
        const T = BLOC_TYPES[b.type];
        this.openModal({
          title: `Invitation: ${esc(b.name)}`,
          body: this.withPortrait(g.countries[b.leader].leader.id, `<p>The ${esc(formalName(g.countries[b.leader]))} invites us to join the <b>${esc(b.name)}</b>, a ${T.name.toLowerCase()} with ${b.members.map(m => esc(g.countries[m].name)).join(', ')}.</p><p class="small muted">${T.desc}</p>`),
          buttons: [
            { label: 'Join', cls: 'primary', fn: () => done(resolveBlocInvite(g, it, true)) },
            { label: 'Decline', fn: () => done(resolveBlocInvite(g, it, false)) },
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
        <p class="small muted">Capture their capital once a third of their land is gone, or take 60% of it, and they must capitulate.</p>
        ${(t.infamy || 0) < INFAMY.coalitionAt ? `<p class="warn small">A war of aggression adds ${Math.round(INFAMY.war * (g.player === c.id ? difficulty(g).playerInfamy : 1))} infamy (now ${Math.round(c.infamy || 0)}; coalitions become possible at ${INFAMY.coalitionAt}). Every province taken adds more.</p>` : `<p class="small good">${esc(t.name)} is infamous: no one will blame us for attacking it.</p>`}`,
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
      <div class="form-row"><label>Difficulty</label><select id="setup-diff" style="flex:1">${DIFFICULTY_ORDER.map(k => `<option value="${k}" ${k === 'normal' ? 'selected' : ''} title="${esc(DIFFICULTY[k].desc)}">${DIFFICULTY[k].name}: ${esc(DIFFICULTY[k].desc)}</option>`).join('')}</select></div>
      <div class="form-row"><label>Map size</label><select id="setup-size"><option value="small">Small</option><option value="medium" selected>Medium</option><option value="large">Large</option></select></div>`;
    const buttons = [{ label: '▶ Play the campaign: The First Republic', cls: 'gold', title: 'A story campaign that teaches you the game', fn: () => { App.startCampaign(); } }, {
      label: 'Generate world', cls: 'primary', fn: () => {
        App.newWorld($('#setup-seed').value || 'world', { model: $('#setup-model').value, size: $('#setup-size').value, countries: +$('#setup-n').value, difficulty: $('#setup-diff').value });
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
      body: g ? `<p class="small muted">World: <b>${esc(WORLD_MODELS[g.world.model].name)}</b> · ${difficulty(g).name} · seed <b>${esc(g.seed)}</b> · ${gameDate(g)}</p>` : '',
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
      <h4>Conquest and its costs</h4>
      <p class="small">Wars of aggression, conquered provinces, reparations and imposed regimes raise <b>infamy</b>. It fades over time, faster at peace. Infamy sours relations with everyone, drives threatened neighbors into arms races and toward each other, and above ${INFAMY.coalitionAt} can trigger a <b>coalition</b> war against you. Conquered land is <b>occupied</b> for five years (half output, unrest, revolts back to its former owner) and <b>non-core</b> for twenty: it pays less tax, supplies fewer soldiers, lowers legitimacy, and every non-core province weighs on stability. On Hard and Brutal, AI nations are also stronger and warier of you.</p>
      <h4>Empires and subjects</h4>
      <p class="small">Nations can become subjects of others: <b>protectorates</b> (defended, free foreign policy), <b>vassals</b> (10% tribute, fight their overlord's wars), <b>puppets</b> (15%) and <b>colonies</b> (25%, deep resentment). Make subjects through peace terms, by offering protection to threatened weak nations, or by ultimatum. A subject's desire for independence grows with tribute, ideological distance and its overlord's weakness; above 72 it may fight a war of independence. Overlords can integrate loyal subjects peacefully, annex them outright, or set them free. Conquered land that belongs to others can be returned, and fallen nations restored, from the Diplomacy tab.</p>
      <h4>Blocs</h4>
      <p class="small">From the Blocs tab, found or join <b>military pacts</b> (collective defense), <b>free-trade zones</b> (tariff-free trade inside a shared market), <b>customs unions</b> (free trade plus a common external tariff) and <b>confederations</b> (all of it, plus a council). Members vote on new applicants; leaders invite, expel and set the common tariff. Abandoning a pact ally in their hour of need gets you expelled.</p>
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
});
