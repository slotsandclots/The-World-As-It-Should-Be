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
  terrain: { name: 'Terrain', legend: 'Lowlands green, highlands brown, peaks white', tile: true },
  resources: { name: 'Resources', legend: 'Each province\'s richest resource', province: p => resourceColor(p), key: true },
  sol: { name: 'Living Standard', legend: 'Standard of living by province: red = destitute, green = prosperous', province: p => rampRgb((provinceSol(p) - 15) / 50 * 100) },
  blocs: { name: 'Blocs', legend: '', blocMode: true },
  admin: { name: 'Administration', legend: 'Gold = special economic zone · teal = autonomous · brown = colonial · orange = non-core · stripes of color = federal states', province: (p, game) => adminColor(p, game) },
  industry: { name: 'Industry', legend: 'Share of each province working in factories: grey = rural, orange = industrial', province: p => mixRgb([75, 78, 92], [240, 130, 40], clamp(provinceIndustry(p) / 0.4, 0, 1)) },
  relations: { name: 'Relations', legend: 'Your relations: red = hostile, green = friendly' },
};

// Smooth value noise in [0,1], used for paper texture and wobbly borders.
function hash2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Chamfer distance (in pixels, capped) from every pixel to the nearest seed pixel.
function chamferDist(FW, FH, seed, cap, within) {
  const BIG = 65535, d = new Uint16Array(FW * FH);
  for (let i = 0; i < d.length; i++) d[i] = seed[i] ? 0 : BIG;
  const c = cap * 3;
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    const i = y * FW + x;
    if (!d[i] || (within && !within[i])) continue;
    let m = d[i];
    if (x > 0 && d[i - 1] + 3 < m) m = d[i - 1] + 3;
    if (y > 0) {
      const j = i - FW;
      if (d[j] + 3 < m) m = d[j] + 3;
      if (x > 0 && d[j - 1] + 4 < m) m = d[j - 1] + 4;
      if (x < FW - 1 && d[j + 1] + 4 < m) m = d[j + 1] + 4;
    }
    d[i] = m > c ? BIG : m;
  }
  for (let y = FH - 1; y >= 0; y--) for (let x = FW - 1; x >= 0; x--) {
    const i = y * FW + x;
    if (!d[i] || (within && !within[i])) continue;
    let m = d[i];
    if (x < FW - 1 && d[i + 1] + 3 < m) m = d[i + 1] + 3;
    if (y < FH - 1) {
      const j = i + FW;
      if (d[j] + 3 < m) m = d[j] + 3;
      if (x < FW - 1 && d[j + 1] + 4 < m) m = d[j + 1] + 4;
      if (x > 0 && d[j - 1] + 4 < m) m = d[j - 1] + 4;
    }
    d[i] = m > c ? BIG : m;
  }
  return d; // units of 1/3 px; BIG = beyond cap
}

// Draws the world as a painted map: smooth coasts and borders, hill shading,
// ocean depth, paper grain and soft inner glows along national borders. The
// world is rendered at S pixels per tile; everything that never changes
// (province shapes, relief, the sea) is computed once per world.
class MapRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = null;
  }

  setWorld(world) {
    this.world = world;
    this._sig = null;
    const { W, H, height, provOf } = world;
    const N = W * H;
    const S = this.S = clamp(Math.floor(Math.sqrt(2.6e6 / N)), 4, 10);
    const FW = this.FW = W * S, FH = this.FH = H * S;
    this.canvas.width = FW;
    this.canvas.height = FH;
    this.img = this.ctx.createImageData(FW, FH);
    const seed = hashString(String(world.seed)) & 0xffff;

    // Tile fields: land height, its gradient, and distance from land at sea.
    const hl = new Float32Array(N), gx = new Float32Array(N), gy = new Float32Array(N);
    for (let i = 0; i < N; i++) hl[i] = Math.max(0, height[i]);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      gx[i] = (hl[y * W + Math.min(W - 1, x + 1)] - hl[y * W + Math.max(0, x - 1)]) / 2;
      gy[i] = (hl[Math.min(H - 1, y + 1) * W + x] - hl[Math.max(0, y - 1) * W + x]) / 2;
    }
    const seaD = new Float32Array(N).fill(99);
    const q = [];
    for (let i = 0; i < N; i++) if (provOf[i] >= 0) { seaD[i] = 0; q.push(i); }
    for (let k = 0; k < q.length; k++) {
      const t = q[k], x = t % W, y = (t / W) | 0;
      for (const n of [x > 0 ? t - 1 : -1, x < W - 1 ? t + 1 : -1, y > 0 ? t - W : -1, y < H - 1 ? t + W : -1]) {
        if (n >= 0 && seaD[n] > seaD[t] + 1) { seaD[n] = seaD[t] + 1; q.push(n); }
      }
    }

    const pix = this.pix = new Int32Array(FW * FH);
    const shade = this.shade = new Float32Array(FW * FH);
    const hgt = this.hgt = new Float32Array(FW * FH);
    const sea = this.sea = new Uint8ClampedArray(FW * FH * 3);
    const terr = this.terr = new Uint8ClampedArray(FW * FH * 3);
    const lab = [0, 0, 0, 0], wt = [0, 0, 0, 0];
    const L = [-0.62, -0.62, 0.48];
    for (let py = 0; py < FH; py++) {
      for (let px = 0; px < FW; px++) {
        const i = py * FW + px;
        // Domain-warped sample position gives borders and coasts a hand-drawn wobble.
        const nx = px / S, ny = py / S;
        const u = nx - 0.5 + (vnoise(nx * 1.3, ny * 1.3, seed) - 0.5) * 0.55;
        const v = ny - 0.5 + (vnoise(nx * 1.3 + 31.7, ny * 1.3 + 17.3, seed) - 0.5) * 0.55;
        let x0 = Math.floor(u), y0 = Math.floor(v);
        const fu = u - x0, fv = v - y0;
        const xa = clamp(x0, 0, W - 1), xb = clamp(x0 + 1, 0, W - 1), ya = clamp(y0, 0, H - 1), yb = clamp(y0 + 1, 0, H - 1);
        const t00 = ya * W + xa, t10 = ya * W + xb, t01 = yb * W + xa, t11 = yb * W + xb;
        const w00 = (1 - fu) * (1 - fv), w10 = fu * (1 - fv), w01 = (1 - fu) * fv, w11 = fu * fv;
        // Weighted vote between the four surrounding tiles' provinces.
        let n = 0;
        const add = (l, w) => { for (let k = 0; k < n; k++) if (lab[k] === l) { wt[k] += w; return; } lab[n] = l; wt[n] = w; n++; };
        add(provOf[t00], w00); add(provOf[t10], w10); add(provOf[t01], w01); add(provOf[t11], w11);
        let best = 0;
        for (let k = 1; k < n; k++) if (wt[k] > wt[best]) best = k;
        const p = lab[best];
        pix[i] = p;
        const h = hl[t00] * w00 + hl[t10] * w10 + hl[t01] * w01 + hl[t11] * w11;
        const grain = vnoise(px * 0.35, py * 0.35, seed + 7) * 0.6 + vnoise(px * 0.08, py * 0.08, seed + 9) * 0.4;
        if (p >= 0) {
          const ggx = (gx[t00] * w00 + gx[t10] * w10 + gx[t01] * w01 + gx[t11] * w11) * 9;
          const ggy = (gy[t00] * w00 + gy[t10] * w10 + gy[t01] * w01 + gy[t11] * w11) * 9;
          const len = Math.sqrt(ggx * ggx + ggy * ggy + 1);
          const dot = (-ggx * L[0] - ggy * L[1] + L[2]) / len;
          let s = 0.6 + 0.42 * dot / L[2] + h * 0.1;
          // Mountains get a craggy texture.
          if (h > 0.55) s += (vnoise(px * 0.5, py * 0.5, seed + 3) - 0.5) * (h - 0.55) * 0.9;
          shade[i] = s * (0.86 + grain * 0.12);
          hgt[i] = h;
          const tc = terrainRgb(h);
          terr[i * 3] = tc[0]; terr[i * 3 + 1] = tc[1]; terr[i * 3 + 2] = tc[2];
        } else {
          const d = seaD[t00] * w00 + seaD[t10] * w10 + seaD[t01] * w01 + seaD[t11] * w11;
          const depth = clamp(d / 9, 0, 1) ** 0.6;
          let r = 52 + (13 - 52) * depth, g = 96 + (31 - 96) * depth, b = 118 + (58 - 118) * depth;
          const wave = 0.9 + grain * 0.18;
          // Vignette towards the edge of the world.
          const ex = Math.min(px, FW - 1 - px) / FW, ey = Math.min(py, FH - 1 - py) / FH;
          const vig = clamp(Math.min(ex, ey) * 9, 0.55, 1);
          r *= wave * vig; g *= wave * vig; b *= wave * vig;
          // Faint graticule, like an old chart.
          const gs = S * 24;
          if (px % gs === 0 || py % gs === 0) { r += 14; g += 18; b += 22; }
          sea[i * 3] = r; sea[i * 3 + 1] = g; sea[i * 3 + 2] = b;
        }
      }
    }
    // Coastlines: a dark edge on land and a pale rim in the shallows.
    const land = new Uint8Array(FW * FH), seaMask = new Uint8Array(FW * FH);
    for (let i = 0; i < pix.length; i++) { land[i] = pix[i] >= 0 ? 1 : 0; seaMask[i] = 1 - land[i]; }
    const cd = chamferDist(FW, FH, land, 10, seaMask);
    for (let i = 0; i < pix.length; i++) {
      if (land[i]) continue;
      const d = cd[i] / 3;
      if (d > 10) continue;
      const k = d < 1.6 ? 0.38 : (1 - d / 10) * 0.16;
      sea[i * 3] += (150 - sea[i * 3]) * k; sea[i * 3 + 1] += (178 - sea[i * 3 + 1]) * k; sea[i * 3 + 2] += (176 - sea[i * 3 + 2]) * k;
    }
    this.coast = new Uint8Array(FW * FH);
    for (let py = 0; py < FH; py++) for (let px = 0; px < FW; px++) {
      const i = py * FW + px;
      if (!land[i]) continue;
      if ((px > 0 && !land[i - 1]) || (px < FW - 1 && !land[i + 1]) || (py > 0 && !land[i - FW]) || (py < FH - 1 && !land[i + FW])) this.coast[i] = 1;
    }
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
      case 'blocs': {
        const eb = economicBloc(game, c.id), mb = militaryBloc(game, c.id);
        if (eb) return eb.color;
        if (mb) return mixRgb([95, 98, 110], mb.color, 0.45);
        return [95, 98, 110];
      }
      default: return c.overlord != null && game.countries[c.overlord] ? mixRgb(c.rgb, game.countries[c.overlord].rgb, 0.45) : c.rgb;
    }
  }

  render(game, opts) {
    opts = opts || {};
    const mode = opts.mode || 'political';
    const selected = opts.selected == null ? -1 : opts.selected;
    const player = opts.player == null ? -1 : opts.player;
    const { provinces } = this.world;
    const { FW, FH, pix, shade, hgt, sea, coast, terr } = this;
    const data = this.img.data;
    const owner = provinces.map(p => p.owner);
    const PAPER = [232, 222, 196];
    const ccol = game.countries.map(c => mixRgb(this.countryColor(game, c, mode, player), PAPER, 0.24));
    const pmode = MAP_MODES[mode] && MAP_MODES[mode].province;
    const pcol = provinces.map(pr => (pmode ? mixRgb(pmode(pr, game), PAPER, 0.1) : ccol[pr.owner]));
    const tileMode = !!(MAP_MODES[mode] && MAP_MODES[mode].tile);
    const enemies = new Set();
    if (player >= 0) for (const w of warsOf(game, player)) for (const id of (w.a.includes(player) ? w.b : w.a)) enemies.add(id);

    // National borders and the soft glow inside them depend only on who owns what.
    const sig = owner.join(',');
    if (this._sig !== sig) {
      this._sig = sig;
      const own = this._own = new Int32Array(FW * FH);
      for (let i = 0; i < own.length; i++) own[i] = pix[i] >= 0 ? owner[pix[i]] : -1;
      const nb = this._nb = new Uint8Array(FW * FH), landM = new Uint8Array(FW * FH);
      for (let py = 0; py < FH; py++) for (let px = 0; px < FW; px++) {
        const i = py * FW + px, o = own[i];
        if (o < 0) continue;
        landM[i] = 1;
        if (px < FW - 1 && own[i + 1] >= 0 && own[i + 1] !== o) { nb[i] = 1; nb[i + 1] = 1; }
        if (py < FH - 1 && own[i + FW] >= 0 && own[i + FW] !== o) { nb[i] = 1; nb[i + FW] = 1; }
      }
      this._glowR = Math.max(6, this.S * 1.6);
      this._gd = chamferDist(FW, FH, nb, this._glowR, landM);
    }
    const own = this._own, nb = this._nb, gd = this._gd, glowR = this._glowR;

    const SEL = [255, 250, 235], PLY = [255, 206, 84], BORDER = [34, 26, 30];
    for (let py = 0; py < FH; py++) {
      for (let px = 0; px < FW; px++) {
        const i = py * FW + px, o4 = i * 4, p = pix[i];
        if (p < 0) { data[o4] = sea[i * 3]; data[o4 + 1] = sea[i * 3 + 1]; data[o4 + 2] = sea[i * 3 + 2]; data[o4 + 3] = 255; continue; }
        const o = own[i];
        const hh = hgt[i], t3 = i * 3;
        let r, g, b;
        if (tileMode) { r = terr[t3]; g = terr[t3 + 1]; b = terr[t3 + 2]; }
        else {
          const col = pcol[p];
          r = col[0]; g = col[1]; b = col[2];
          // Let the land show through: highlands tint the political color.
          if (hh > 0.45) { const k = (hh - 0.45) * 0.55; r += (terr[t3] - r) * k; g += (terr[t3 + 1] - g) * k; b += (terr[t3 + 2] - b) * k; }
        }
        let s = shade[i];
        if (o === selected) s *= 1.12;
        r *= s; g *= s; b *= s;
        // Inner glow: darker, richer color near the border.
        const d = gd[i];
        if (d !== 65535 && !tileMode) {
          const k = (1 - d / 3 / glowR) ** 2 * 0.42;
          r *= 1 - k; g *= 1 - k; b *= 1 - k * 0.7;
        }
        // Province borders: a faint line.
        if ((px < FW - 1 && pix[i + 1] !== p && pix[i + 1] >= 0 && own[i + 1] === o) || (py < FH - 1 && pix[i + FW] !== p && pix[i + FW] >= 0 && own[i + FW] === o)) {
          r *= 0.8; g *= 0.8; b *= 0.8;
        }
        if (enemies.has(o) && (px + py) % 9 < 3) { r = r * 0.55 + 200 * 0.45; g *= 0.55; b *= 0.55; }
        if (nb[i]) {
          let o2 = -1;
          if (px > 0 && own[i - 1] >= 0 && own[i - 1] !== o) o2 = own[i - 1];
          else if (px < FW - 1 && own[i + 1] >= 0 && own[i + 1] !== o) o2 = own[i + 1];
          else if (py > 0 && own[i - FW] >= 0 && own[i - FW] !== o) o2 = own[i - FW];
          else if (py < FH - 1 && own[i + FW] >= 0 && own[i + FW] !== o) o2 = own[i + FW];
          const bc = (o === selected || o2 === selected) ? SEL : (o === player || o2 === player) ? PLY : BORDER;
          const a = bc === BORDER ? 0.78 : 0.95;
          r = r * (1 - a) + bc[0] * a; g = g * (1 - a) + bc[1] * a; b = b * (1 - a) + bc[2] * a;
        } else if (coast[i]) { r *= 0.42; g *= 0.4; b *= 0.4; }
        data[o4] = r; data[o4 + 1] = g; data[o4 + 2] = b; data[o4 + 3] = 255;
      }
    }
    this.ctx.putImageData(this.img, 0, 0);
    if (this.onRender) this.onRender();
  }

  // Where each nation's name goes, in map tile coordinates, and how big its land is.
  labelAnchors(game) {
    const provs = this.world.provinces;
    const out = [];
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
      out.push({ c, x: best.lx + 0.5, y: best.ly + 0.5, tiles: n });
    }
    return out.sort((a, b) => b.tiles - a.tiles);
  }

  provinceAt(clientX, clientY) {
    if (!this.world) return -1;
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left) / rect.width * this.FW);
    const y = Math.floor((clientY - rect.top) / rect.height * this.FH);
    if (x < 0 || y < 0 || x >= this.FW || y >= this.FH) return -1;
    return this.pix[y * this.FW + x];
  }
}

function terrainRgb(h) {
  if (h < 0.15) return mixRgb([92, 150, 78], [128, 165, 88], h / 0.15);
  if (h < 0.45) return mixRgb([128, 165, 88], [168, 150, 96], (h - 0.15) / 0.3);
  if (h < 0.75) return mixRgb([168, 150, 96], [128, 98, 72], (h - 0.45) / 0.3);
  return mixRgb([128, 98, 72], [235, 235, 240], clamp((h - 0.75) / 0.25, 0, 1));
}

const RESOURCE_COLORS = {
  arable: [214, 196, 82], pasture: [140, 200, 110], forest: [40, 120, 60], coal: [70, 70, 78], iron: [178, 90, 60], oil: [120, 60, 150], fish: [70, 150, 210],
};
const RESOURCE_TYPICAL = { arable: 22, pasture: 8, forest: 12, coal: 24, iron: 20, oil: 30, fish: 16 };
function resourceColor(p) {
  if (!p.res) return [120, 120, 120];
  let best = null, bv = 0;
  for (const k in RESOURCE_COLORS) { const v = (p.res[k] || 0) / RESOURCE_TYPICAL[k]; if (v > bv) { bv = v; best = k; } }
  if (!best) return [110, 110, 115];
  return mixRgb([110, 110, 115], RESOURCE_COLORS[best], clamp(0.45 + bv * 0.4, 0, 1));
}

// Crisp nation names drawn on an overlay at screen resolution, so they stay
// sharp at any zoom. Smaller nations' names appear as you zoom in; names that
// would overlap a bigger nation's are skipped.
class LabelLayer {
  constructor(canvas, wrap, renderer) {
    this.canvas = canvas; this.wrap = wrap; this.r = renderer;
    this.ctx = canvas.getContext('2d');
  }

  draw(game, selected, player) {
    const dpr = window.devicePixelRatio || 1;
    const wr = this.wrap.getBoundingClientRect();
    if (this.canvas.width !== Math.round(wr.width * dpr) || this.canvas.height !== Math.round(wr.height * dpr)) {
      this.canvas.width = Math.round(wr.width * dpr); this.canvas.height = Math.round(wr.height * dpr);
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, wr.width, wr.height);
    if (!game || !this.r.world) return;
    const mr = this.r.canvas.getBoundingClientRect();
    const sx = mr.width / this.r.world.W, sy = mr.height / this.r.world.H;
    const placed = [];
    // Capitals: small crisp dots at any zoom.
    const provs = this.r.world.provinces;
    for (const c of game.countries) {
      if (!c.alive || !provs[c.capital]) continue;
      const p = provs[c.capital];
      const x = mr.left - wr.left + (p.lx + 0.5) * sx, y = mr.top - wr.top + (p.ly + 0.5) * sy;
      ctx.beginPath(); ctx.arc(x, y, c.id === player ? 4 : 3, 0, Math.PI * 2);
      ctx.fillStyle = c.id === player ? '#ffd24a' : '#fff'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#1a1a22'; ctx.stroke();
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const a of this.r.labelAnchors(game)) {
      const size = clamp(Math.sqrt(a.tiles) * 0.16 * sx * Math.min(1, 9 / Math.max(5, a.c.name.length)), 0, 26);
      if (size < 8.5 && a.c.id !== selected && a.c.id !== player) continue;
      const fs = Math.max(size, 9);
      ctx.font = `${a.c.id === selected ? '700 ' : '600 '}${fs.toFixed(1)}px Cinzel, Georgia, 'Times New Roman', serif`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${(fs * 0.12).toFixed(1)}px`;
      const x = mr.left - wr.left + a.x * sx, y = mr.top - wr.top + a.y * sy;
      const name = a.c.name.toUpperCase();
      const w = ctx.measureText(name).width;
      const box = [x - w / 2 - 2, y - fs / 2 - 1, x + w / 2 + 2, y + fs / 2 + 1];
      if (box[2] < 0 || box[0] > wr.width || box[3] < 0 || box[1] > wr.height) continue;
      if (placed.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
      placed.push(box);
      ctx.lineWidth = Math.max(2.5, fs * 0.22);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(12,10,16,0.72)';
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 6;
      ctx.strokeText(name, x, y);
      ctx.shadowBlur = 0;
      ctx.fillStyle = a.c.id === player ? '#ffd877' : a.c.id === selected ? '#ffffff' : 'rgba(246,240,226,0.94)';
      ctx.fillText(name, x, y);
    }
  }
}

function adminColor(p, game) {
  if (p.designation === 'sez') return [235, 190, 60];
  if (p.designation === 'autonomous') return [60, 190, 175];
  if (p.designation === 'colonial') return [150, 100, 60];
  if (p.core !== undefined && p.core !== p.owner) return [220, 130, 60];
  const c = game && game.countries[p.owner];
  if (c && c.federal && p.state != null) { const h = (p.state * 137.5) % 360; return hslToRgb(h, 35, 45); }
  return [90, 94, 108];
}
