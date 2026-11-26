'use strict';
// Draws the world map onto a canvas. Each map tile is S×S pixels; borders are
// drawn per pixel so provinces get thin lines and nations get thick ones.

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function mixRgb(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

// Red → amber → green ramp for 0..100.
function rampRgb(v) {
  v = clamp(v, 0, 100) / 100;
  return v < 0.5 ? mixRgb([200, 55, 50], [225, 185, 60], v * 2) : mixRgb([225, 185, 60], [70, 170, 90], (v - 0.5) * 2);
}

const MAP_MODES = {
  political: { name: 'Political', legend: 'Nations' },
  government: { name: 'Government', legend: 'Form of government' },
  stability: { name: 'Stability', legend: 'Red = collapsing, green = stable' },
  ideology: { name: 'Public Opinion', legend: 'Red = left, blue = right; darker = authoritarian' },
  sol: { name: 'Living Standard', legend: 'Standard of living by province: red = destitute, green = prosperous', province: p => rampRgb((provinceSol(p) - 15) / 50 * 100) },
  industry: { name: 'Industry', legend: 'Share of each province working in factories: grey = rural, orange = industrial', province: p => mixRgb([75, 78, 92], [240, 130, 40], clamp(provinceIndustry(p) / 0.4, 0, 1)) },
  relations: { name: 'Relations', legend: 'Your relations: red = hostile, green = friendly' },
};

class MapRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = null;
  }

  setWorld(world) {
    this.world = world;
    this.S = world.W * world.H > 40000 ? 4 : 5;
    this.canvas.width = world.W * this.S;
    this.canvas.height = world.H * this.S;
    this.img = this.ctx.createImageData(this.canvas.width, this.canvas.height);
  }

  countryColor(game, c, mode, player) {
    switch (mode) {
      case 'government': return hexToRgb(GOVS[c.gov].color);
      case 'stability': return rampRgb(c.stability);
      case 'ideology': {
        const base = mixRgb([215, 60, 60], [60, 110, 220], (c.ideo.econ + 1) / 2);
        return mixRgb(base, [40, 30, 50], clamp(c.ideo.auth, 0, 1) * 0.55);
      }
      case 'relations': {
        if (c.id === player) return [235, 200, 90];
        if (player < 0) return [150, 150, 150];
        if (atWarWith(game, c.id, player)) return [230, 40, 40];
        const me = game.countries[player];
        if (me.allies.includes(c.id)) return [60, 150, 230];
        return rampRgb((relation(game, player, c.id) + 100) / 2);
      }
      default: return c.rgb;
    }
  }

  render(game, opts) {
    opts = opts || {};
    const mode = opts.mode || 'political';
    const selected = opts.selected == null ? -1 : opts.selected;
    const player = opts.player == null ? -1 : opts.player;
    const { W, H, height, provOf, provinces } = this.world;
    const S = this.S, cw = W * S;
    const data = this.img.data;
    const owner = provinces.map(p => p.owner);
    const ccol = game.countries.map(c => this.countryColor(game, c, mode, player));
    const pmode = MAP_MODES[mode] && MAP_MODES[mode].province;
    const pcol = provinces.map(pr => (pmode ? pmode(pr) : ccol[pr.owner]));

    const SEL = [255, 255, 255], PLY = [255, 214, 90], BORDER = [28, 24, 34];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = y * W + x;
        const p = provOf[t];
        let base;
        const nbr = [x > 0 ? t - 1 : -1, x < W - 1 ? t + 1 : -1, y > 0 ? t - W : -1, y < H - 1 ? t + W : -1];
        // edge types per side: 0 none, 1 province, 2 nation, 3 coast
        const et = [0, 0, 0, 0], ec = [null, null, null, null];
        if (p < 0) {
          const k = 1 + height[t];
          const kk = k * k;
          base = [18 + 52 * kk, 38 + 88 * kk, 70 + 95 * kk];
          for (let s = 0; s < 4; s++) if (nbr[s] >= 0 && provOf[nbr[s]] >= 0) et[s] = 4;
        } else {
          const o = owner[p];
          const col = pcol[p];
          const sh = 1.08 - height[t] * 0.32;
          const bright = o === selected ? 1.12 : 1;
          base = [col[0] * sh * bright, col[1] * sh * bright, col[2] * sh * bright];
          for (let s = 0; s < 4; s++) {
            const n = nbr[s];
            if (n < 0) continue;
            const q = provOf[n];
            if (q < 0) { et[s] = 3; continue; }
            const o2 = owner[q];
            if (o2 !== o) {
              et[s] = 2;
              ec[s] = (o === selected || o2 === selected) ? SEL : (o === player || o2 === player) ? PLY : BORDER;
            } else if (q !== p && (s === 0 || s === 2)) et[s] = 1;
          }
        }
        for (let py = 0; py < S; py++) {
          for (let px = 0; px < S; px++) {
            let r = base[0], g = base[1], b = base[2];
            const side = px === 0 ? 0 : px === S - 1 ? 1 : -1;
            const vside = py === 0 ? 2 : py === S - 1 ? 3 : -1;
            let best = 0, bc = null;
            for (const s of [side, vside]) {
              if (s < 0 || et[s] === 0) continue;
              if (et[s] === 2 && best < 3) { best = 3; bc = ec[s]; }
              else if (et[s] === 3 && best < 2) { best = 2; }
              else if (et[s] === 4 && best < 1) { best = 1; }
              else if (et[s] === 1 && best < 1) { best = 1; bc = 'prov'; }
            }
            if (best === 3) { r = bc[0]; g = bc[1]; b = bc[2]; }
            else if (best === 2) { r *= 0.55; g *= 0.55; b *= 0.55; }
            else if (best === 1 && bc === 'prov') { r *= 0.8; g *= 0.8; b *= 0.8; }
            else if (best === 1) { r = r * 0.7 + 160 * 0.3; g = g * 0.7 + 200 * 0.3; b = b * 0.7 + 230 * 0.3; }
            const i = ((y * S + py) * cw + (x * S + px)) * 4;
            data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
          }
        }
      }
    }
    const ctx = this.ctx;
    ctx.putImageData(this.img, 0, 0);
    this.drawWarFronts(game, player);
    this.drawLabels(game, selected, player);
  }

  // Diagonal hatching over provinces of nations at war with the player.
  drawWarFronts(game, player) {
    if (player < 0) return;
    const enemies = new Set();
    for (const w of warsOf(game, player)) for (const id of (w.a.includes(player) ? w.b : w.a)) enemies.add(id);
    if (!enemies.size) return;
    const { W, H, provOf, provinces } = this.world;
    const S = this.S, ctx = this.ctx;
    ctx.fillStyle = 'rgba(200,20,20,0.35)';
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = provOf[y * W + x];
        if (p < 0 || !enemies.has(provinces[p].owner)) continue;
        if ((x + y) % 3 === 0) ctx.fillRect(x * S, y * S, S, S);
      }
    }
  }

  drawLabels(game, selected, player) {
    const ctx = this.ctx, S = this.S;
    const provs = this.world.provinces;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const c of game.countries) {
      if (!c.alive) continue;
      let sx = 0, sy = 0, n = 0;
      for (const p of provs) if (p.owner === c.id) { sx += p.lx * p.tiles; sy += p.ly * p.tiles; n += p.tiles; }
      if (!n) continue;
      const cx = sx / n, cy = sy / n;
      let best = null, bd = Infinity;
      for (const p of provs) {
        if (p.owner !== c.id) continue;
        const d = (p.lx - cx) ** 2 + (p.ly - cy) ** 2 - p.tiles * 0.5;
        if (d < bd) { bd = d; best = p; }
      }
      const size = clamp(Math.sqrt(n) * 0.5, 9, 24) * S / 5;
      ctx.font = `${c.id === selected ? 'bold ' : '600 '}${size.toFixed(0)}px Georgia, 'Times New Roman', serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(10,10,20,0.75)';
      ctx.fillStyle = c.id === player ? '#ffe08a' : '#f4f1ea';
      const lx = (best.lx + 0.5) * S, ly = (best.ly + 0.5) * S;
      ctx.strokeText(c.name, lx, ly);
      ctx.fillText(c.name, lx, ly);
      // capital marker
      const cap = provs[c.capital];
      if (cap) {
        const x = (cap.lx + 0.5) * S, y = (cap.ly + 0.5) * S + (cap === best ? size * 0.85 : 0);
        ctx.beginPath();
        ctx.arc(x, y, S * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = c.id === player ? '#ffd24a' : '#fff';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#222';
        ctx.stroke();
      }
    }
  }

  provinceAt(clientX, clientY) {
    if (!this.world) return -1;
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left) / rect.width * this.world.W);
    const y = Math.floor((clientY - rect.top) / rect.height * this.world.H);
    if (x < 0 || y < 0 || x >= this.world.W || y >= this.world.H) return -1;
    return this.world.provOf[y * this.world.W + x];
  }
}
