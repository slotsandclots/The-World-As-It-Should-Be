'use strict';
// Procedural world generation: heightmap -> land/sea -> provinces -> nations.
// Everything is deterministic for a given seed, so a save only needs the seed
// plus whatever has changed since (province owners and populations).

function makeValueNoise(rng) {
  const N = 256;
  const vals = new Float32Array(N * N);
  for (let i = 0; i < vals.length; i++) vals[i] = rng();
  const sample = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const x0 = xi & 255, y0 = yi & 255, x1 = (xi + 1) & 255, y1 = (yi + 1) & 255;
    const a = vals[y0 * N + x0], b = vals[y0 * N + x1], c = vals[y1 * N + x0], d = vals[y1 * N + x1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  sample.fbm = (x, y, oct) => {
    let amp = 1, f = 1, sum = 0, norm = 0;
    for (let o = 0; o < oct; o++) {
      sum += amp * sample(x * f + o * 17.3, y * f + o * 9.1);
      norm += amp; amp *= 0.5; f *= 2;
    }
    return sum / norm;
  };
  return sample;
}

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function rgbToHex(rgb) {
  return '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
}

// Label connected components of tiles where pred(i) is true. Returns {comp, sizes}.
function labelComponents(W, H, pred) {
  const N = W * H;
  const comp = new Int32Array(N).fill(-1);
  const sizes = [];
  const stack = [];
  for (let i = 0; i < N; i++) {
    if (comp[i] >= 0 || !pred(i)) continue;
    const id = sizes.length;
    let size = 0;
    comp[i] = id; stack.push(i);
    while (stack.length) {
      const t = stack.pop(); size++;
      const x = t % W, y = (t / W) | 0;
      if (x > 0 && comp[t - 1] < 0 && pred(t - 1)) { comp[t - 1] = id; stack.push(t - 1); }
      if (x < W - 1 && comp[t + 1] < 0 && pred(t + 1)) { comp[t + 1] = id; stack.push(t + 1); }
      if (y > 0 && comp[t - W] < 0 && pred(t - W)) { comp[t - W] = id; stack.push(t - W); }
      if (y < H - 1 && comp[t + W] < 0 && pred(t + W)) { comp[t + W] = id; stack.push(t + W); }
    }
    sizes.push(size);
  }
  return { comp, sizes };
}

// ------------------------------------------------------------------ world models
// Each model builds a raw heightmap. Most then pick a sea level so a set share
// of the map is land; Earth uses real coastlines instead.

const MAP_SIZES = { small: 16000, medium: 25000, large: 41600 }; // tiles

function worldDims(opts) {
  if (opts.width && opts.height) return [opts.width, opts.height];
  const m = WORLD_MODELS[opts.model] || WORLD_MODELS.continents;
  const n = (MAP_SIZES[opts.size] || MAP_SIZES.medium) * (m.tileScale || 1);
  const H = Math.round(Math.sqrt(n / m.aspect));
  return [Math.round(H * m.aspect), H];
}

// Shared machinery: domain-warped coordinates, gaussian blobs, sunken map edges.
function blobField(blobs, wx, wy, aspect) {
  let b = 0;
  for (const bl of blobs) {
    const dx = (wx - bl.x) * aspect / (bl.sx || 1), dy = (wy - bl.y) / (bl.sy || 1);
    const v = Math.exp(-(dx * dx + dy * dy) / (bl.r * bl.r)) * bl.s;
    if (v > b) b = v;
  }
  return b;
}

function fieldLoop(ctx, ox, oy, warp, fn) {
  const { W, H, noise } = ctx;
  const raw = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = x / W, ny = y / H;
      const wx = nx + (noise.fbm(nx * 3 + ox, ny * 3 + oy, 3) - 0.5) * warp;
      const wy = ny + (noise.fbm(nx * 3 + oy + 31, ny * 3 + ox + 17, 3) - 0.5) * warp;
      let h = fn(nx, ny, wx, wy);
      const e = Math.min(nx, 1 - nx, ny, 1 - ny);
      if (e < 0.08) h -= (0.08 - e) * 6;
      raw[y * W + x] = h;
    }
  }
  return raw;
}

const WORLD_MODELS = {
  continents: {
    name: 'Continents', desc: 'A few large continents and scattered islands.', land: 0.42, aspect: 1.6,
    build(ctx) {
      const { rng, noise, aspect } = ctx;
      const blobs = [];
      const nb = rng.int(3, 6);
      for (let i = 0; i < nb; i++) blobs.push({ x: rng.range(0.12, 0.88), y: rng.range(0.15, 0.85), r: rng.range(0.13, 0.28), s: rng.range(0.6, 1) });
      const ox = rng.range(0, 100), oy = rng.range(0, 100);
      return { raw: fieldLoop(ctx, ox, oy, 0.22, (nx, ny, wx, wy) => noise.fbm(wx * 5 * aspect + ox, wy * 5 + oy, 5) * 0.55 + blobField(blobs, wx, wy, aspect) * 0.65) };
    },
  },
  pangaea: {
    name: 'Supercontinent', desc: 'One vast landmass: long land borders, crowded neighbors and few safe coasts.', land: 0.5, aspect: 1.6,
    build(ctx) {
      const { rng, noise, aspect } = ctx;
      const ox = rng.range(0, 100), oy = rng.range(0, 100);
      const cx = rng.range(0.42, 0.58), cy = rng.range(0.42, 0.58);
      const blobs = [{ x: cx, y: cy, r: 0.3, s: 1 }];
      const nl = rng.int(3, 5);
      for (let i = 0; i < nl; i++) {
        const a = rng.range(0, Math.PI * 2), d = rng.range(0.15, 0.27);
        blobs.push({ x: cx + Math.cos(a) * d / aspect * 1.4, y: cy + Math.sin(a) * d, r: rng.range(0.14, 0.22), s: rng.range(0.75, 1) });
      }
      return { raw: fieldLoop(ctx, ox, oy, 0.3, (nx, ny, wx, wy) => noise.fbm(wx * 5 * aspect + ox, wy * 5 + oy, 5) * 0.5 + blobField(blobs, wx, wy, aspect) * 0.8) };
    },
  },
  archipelago: {
    name: 'Archipelago', desc: 'Countless islands divided by straits: a world of navies and island kingdoms.', land: 0.3, aspect: 1.6, minIsland: 20,
    build(ctx) {
      const { rng, noise, aspect } = ctx;
      const ox = rng.range(0, 100), oy = rng.range(0, 100);
      const blobs = [];
      const nb = rng.int(18, 30);
      for (let i = 0; i < nb; i++) blobs.push({ x: rng.range(0.08, 0.92), y: rng.range(0.1, 0.9), r: rng.range(0.04, 0.11), s: rng.range(0.6, 1) });
      return { raw: fieldLoop(ctx, ox, oy, 0.18, (nx, ny, wx, wy) => noise.fbm(wx * 8 * aspect + ox, wy * 8 + oy, 5) * 0.6 + blobField(blobs, wx, wy, aspect) * 0.55) };
    },
  },
  twin: {
    name: 'Twin Continents', desc: 'An Old World and a New World facing each other across a wide ocean.', land: 0.4, aspect: 1.6,
    build(ctx) {
      const { rng, noise, aspect } = ctx;
      const ox = rng.range(0, 100), oy = rng.range(0, 100);
      const blobs = [];
      for (const side of [[0.1, 0.38], [0.62, 0.9]]) {
        const n = rng.int(2, 4);
        for (let i = 0; i < n; i++) blobs.push({ x: rng.range(side[0], side[1]), y: rng.range(0.18, 0.82), r: rng.range(0.13, 0.2), sx: 0.75, sy: 1.5, s: rng.range(0.7, 1) });
      }
      return {
        raw: fieldLoop(ctx, ox, oy, 0.2, (nx, ny, wx, wy) => {
          const ocean = Math.exp(-(((nx - 0.5) / 0.07) ** 2)) * 0.6;
          return noise.fbm(wx * 5 * aspect + ox, wy * 5 + oy, 5) * 0.5 + blobField(blobs, wx, wy, aspect) * 0.7 - ocean;
        }),
      };
    },
  },
  inlandSea: {
    name: 'Inland Sea', desc: 'A ring of lands around a great central sea, its shores crowded with rivals.', land: 0.52, aspect: 1.6,
    build(ctx) {
      const { rng, noise, aspect } = ctx;
      const ox = rng.range(0, 100), oy = rng.range(0, 100);
      const ringR = rng.range(0.36, 0.44);
      const isles = [];
      const ni = rng.int(2, 5);
      for (let i = 0; i < ni; i++) isles.push({ x: rng.range(0.38, 0.62), y: rng.range(0.38, 0.62), r: rng.range(0.03, 0.06), s: rng.range(0.5, 0.8) });
      return {
        raw: fieldLoop(ctx, ox, oy, 0.25, (nx, ny, wx, wy) => {
          const d = Math.hypot((wx - 0.5) * aspect / 1.6, wy - 0.5);
          const ring = Math.exp(-(((d - ringR) / 0.2) ** 2));
          return noise.fbm(wx * 5 * aspect + ox, wy * 5 + oy, 5) * 0.5 + ring * 0.7 + blobField(isles, wx, wy, aspect) * 0.5;
        }),
      };
    },
  },
  shattered: {
    name: 'Shattered Lands', desc: 'Continents cracked apart by long rifts and channels into peninsulas and straits.', land: 0.46, aspect: 1.6,
    build(ctx) {
      const { rng, noise, aspect } = ctx;
      const ox = rng.range(0, 100), oy = rng.range(0, 100), rx = rng.range(0, 100), ry = rng.range(0, 100);
      const blobs = [];
      const nb = rng.int(4, 7);
      for (let i = 0; i < nb; i++) blobs.push({ x: rng.range(0.12, 0.88), y: rng.range(0.15, 0.85), r: rng.range(0.15, 0.28), s: rng.range(0.7, 1) });
      return {
        raw: fieldLoop(ctx, ox, oy, 0.2, (nx, ny, wx, wy) => {
          const ridge = 1 - Math.abs(2 * noise.fbm(wx * 3.5 * aspect + rx, wy * 3.5 + ry, 3) - 1);
          return noise.fbm(wx * 5 * aspect + ox, wy * 5 + oy, 5) * 0.5 + blobField(blobs, wx, wy, aspect) * 0.7 - Math.max(0, ridge - 0.84) * 4;
        }),
      };
    },
  },
  earth: {
    name: 'Earth', desc: 'Our planet\'s real coastlines and mountain ranges, divided among fictional nations.', aspect: 2.65,
    tileScale: 1.5, minIsland: 8, provinceSize: 60, countries: 30,
    build(ctx) { return buildEarth(ctx); },
  },
  earthRegions: {
    name: 'Earth: Historical Regions', desc: 'Earth, with fictional nations founded in the heartlands of real regions: borders that loosely echo history.', aspect: 2.65,
    tileScale: 1.5, minIsland: 8, provinceSize: 60, countries: 36,
    build(ctx) { return buildEarth(ctx); },
    // [lon, lat] of regional heartlands, most important first.
    regionSeeds: [
      [-98, 39], [10, 51], [37, 55], [105, 34], [78, 22], [-47, -15], [2, 47], [-2, 53], [138, 36], [-102, 22],
      [12, 43], [35, 39], [-64, -34], [135, -25], [30, 27], [44, 32], [53, 32], [8, 9], [24, -29], [-122, 45],
      [-75, 45], [101, 15], [113, 24], [-4, 40], [20, 52], [24, 45], [110, -7], [45, 24], [68, 47], [90, 58],
      [38, 9], [23, -3], [-74, 4], [-72, -36], [70, 30], [128, 37], [130, 62], [122, 12], [16, 62], [-77, -10],
      [36, -2], [-6, 13], [103, 47], [88, 24], [95, 20], [174, -41], [47, -19], [-66, 8], [17, -12], [-85, 14],
    ],
  },
};
const WORLD_MODEL_ORDER = ['continents', 'pangaea', 'archipelago', 'twin', 'inlandSea', 'shattered', 'earth', 'earthRegions'];

// ------------------------------------------------------------------ Earth

const EARTH_VIEW = { lon0: -169, latTop: 80, latSpan: 136 }; // cut at the Bering Strait; no Antarctica

// Mountain ranges as lon/lat polylines: [points, width in degrees, strength].
const EARTH_MOUNTAINS = [
  [[[68, 37], [74, 35], [80, 32], [86, 28], [92, 28], [97, 28]], 4, 1.0], // Himalaya / Hindu Kush
  [[[80, 35], [88, 33], [96, 33]], 7, 0.65], // Tibetan plateau
  [[[70, 41], [80, 42], [88, 44], [96, 47], [102, 49]], 3, 0.55], // Tian Shan / Altai
  [[[-75, 10], [-77, 0], [-77, -10], [-70, -18], [-69, -28], [-71, -38], [-72, -48], [-73, -54]], 2.5, 0.9], // Andes
  [[[-150, 62], [-135, 58], [-122, 50], [-112, 43], [-107, 37], [-105, 30], [-100, 20], [-97, 17]], 4, 0.7], // Rockies / Sierra Madre
  [[[-84, 34], [-78, 39], [-72, 43], [-68, 46]], 2.5, 0.35], // Appalachians
  [[[6, 45], [11, 47], [15, 47]], 2, 0.6], // Alps
  [[[-1, 43], [2, 42.5]], 1.5, 0.45], // Pyrenees
  [[[22, 47], [26, 46], [24, 45]], 1.5, 0.35], // Carpathians
  [[[40, 43], [47, 42]], 2, 0.6], // Caucasus
  [[[45, 36], [52, 31], [58, 28]], 3, 0.5], // Zagros
  [[[59, 48], [60, 55], [60, 62], [63, 67]], 2, 0.35], // Urals
  [[[-8, 31], [0, 34], [8, 36]], 2.5, 0.5], // Atlas
  [[[38, 13], [39, 8], [37, 2], [35, -4], [34, -9]], 4, 0.55], // East African highlands
  [[[6, 59], [12, 63], [17, 68], [22, 70]], 2.5, 0.4], // Scandinavian mountains
  [[[146, -38], [150, -30], [147, -20], [145, -15]], 2, 0.3], // Great Dividing Range
  [[[135, 36], [139, 37], [142, 41]], 1.5, 0.45], // Japanese Alps
  [[[-48, -12], [-45, -18], [-43, -21]], 5, 0.25], // Brazilian highlands
];

let EARTH_MASK = null;
function earthMask() {
  if (EARTH_MASK) return EARTH_MASK;
  const MW = 720, MH = 360;
  const m = new Uint8Array(MW * MH);
  EARTH_MASK_RLE.split(';').forEach((row, y) => {
    let x = 0, v = 0;
    for (const r of row.split(',')) { const n = parseInt(r, 36); if (v) m.fill(1, y * MW + x, y * MW + x + n); x += n; v ^= 1; }
  });
  EARTH_MASK = { m, MW, MH };
  return EARTH_MASK;
}

function distToPolyline(lon, lat, pts) {
  let best = Infinity;
  const k = Math.cos(lat * Math.PI / 180);
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const dx = (bx - ax) * k, dy = by - ay;
    const px = (lon - ax) * k, py = lat - ay;
    const t = clamp((px * dx + py * dy) / (dx * dx + dy * dy || 1), 0, 1);
    const d = Math.hypot(px - t * dx, py - t * dy);
    if (d < best) best = d;
  }
  return best;
}

function buildEarth(ctx) {
  const { W, H, N, rng, noise, aspect } = ctx;
  const { m, MW, MH } = earthMask();
  const ox = rng.range(0, 100), oy = rng.range(0, 100);
  const V = EARTH_VIEW;
  const sample = (lon, lat) => {
    const fx = ((lon + 180) / 360 * MW - 0.5 + MW) % MW, fy = clamp((90 - lat) / 180 * MH - 0.5, 0, MH - 1.001);
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = (x0 + 1) % MW, tx = fx - x0, ty = fy - y0;
    const a = m[y0 * MW + x0], b = m[y0 * MW + x1], c = m[(y0 + 1) * MW + x0], d = m[(y0 + 1) * MW + x1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
  const landness = new Float32Array(N), elev = new Float32Array(N);
  for (let y = 0; y < H; y++) {
    const lat = V.latTop - (y + 0.5) / H * V.latSpan;
    for (let x = 0; x < W; x++) {
      let lon = V.lon0 + (x + 0.5) / W * 360;
      if (lon > 180) lon -= 360;
      const nx = x / W, ny = y / H;
      const i = y * W + x;
      landness[i] = sample(lon, lat) + (noise.fbm(nx * 14 * aspect + ox, ny * 14 + oy, 3) - 0.5) * 0.3;
      let mtn = 0;
      for (const [pts, w, s] of EARTH_MOUNTAINS) {
        const d = distToPolyline(lon, lat, pts);
        if (d < w * 3) mtn = Math.max(mtn, Math.exp(-(d * d) / (w * w)) * s);
      }
      elev[i] = clamp(0.06 + noise.fbm(nx * 6 * aspect + ox, ny * 6 + oy, 4) * 0.3 + mtn * 0.7 + Math.abs(lat) / 400, 0, 1);
    }
  }
  // Water depth: shallow shelves near land, deep ocean far away (box blur of the land mask).
  let blur = Float32Array.from(landness, v => (v > 0.5 ? 1 : 0));
  const tmp = new Float32Array(N), R = 4;
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let s = 0, n = 0;
      for (let k = -R; k <= R; k++) { const xx = (x + k + W) % W; s += blur[y * W + xx]; n++; }
      tmp[y * W + x] = s / n;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let s = 0, n = 0;
      for (let k = -R; k <= R; k++) { const yy = y + k; if (yy < 0 || yy >= H) continue; s += tmp[yy * W + x]; n++; }
      blur[y * W + x] = s / n;
    }
  }
  const raw = new Float32Array(N);
  for (let i = 0; i < N; i++) raw[i] = landness[i] > 0.5 ? 0.501 + elev[i] * 0.5 : clamp(blur[i] * 1.6, 0, 0.98) * 0.5;
  return { raw, sea: 0.5 };
}

function generateWorld(seed, opts) {
  opts = opts || {};
  const modelId = WORLD_MODELS[opts.model] ? opts.model : 'continents';
  const model = WORLD_MODELS[modelId];
  const [W, H] = worldDims(opts);
  const N = W * H;
  const landFrac = opts.land || model.land || 0.42;
  const rng = makeRng(String(seed) + '|map');
  const noise = makeValueNoise(rng);
  const aspect = W / H;

  // ---- 1. Heightmap from the chosen world model.
  const { raw, sea: fixedSea } = model.build({ W, H, N, rng, noise, aspect });

  // ---- 2. Sea level: fixed by the model, or chosen so a set fraction is land.
  const sorted = Float32Array.from(raw).sort();
  const sea = fixedSea !== undefined ? fixedSea : sorted[Math.floor(N * (1 - landFrac))];
  const minH = sorted[0], maxH = sorted[N - 1];
  const land = new Uint8Array(N);
  for (let i = 0; i < N; i++) land[i] = raw[i] > sea ? 1 : 0;

  // Remove specks of land and fill tiny lakes.
  {
    const minIsland = model.minIsland || 35;
    const { comp, sizes } = labelComponents(W, H, i => land[i] === 1);
    for (let i = 0; i < N; i++) if (comp[i] >= 0 && sizes[comp[i]] < minIsland) land[i] = 0;
    const water = labelComponents(W, H, i => land[i] === 0);
    for (let i = 0; i < N; i++) if (water.comp[i] >= 0 && water.sizes[water.comp[i]] < 25) land[i] = 1;
  }

  const height = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    height[i] = land[i] ? clamp((raw[i] - sea) / (maxH - sea), 0, 1) : -clamp((sea - raw[i]) / (sea - minH), 0, 1);
  }

  // ---- 3. Provinces: scatter seeds over land and grow them with a randomized flood fill.
  const landTiles = [];
  for (let i = 0; i < N; i++) if (land[i]) landTiles.push(i);
  const targetProv = opts.provinces || Math.round(clamp(landTiles.length / (model.provinceSize || 72), 30, 500));
  const minD = Math.sqrt(landTiles.length / targetProv) * 0.85;
  const seeds = [];
  for (let a = 0; a < targetProv * 40 && seeds.length < targetProv; a++) {
    const t = landTiles[rng.int(0, landTiles.length - 1)];
    const tx = t % W, ty = (t / W) | 0;
    let ok = true;
    for (const s of seeds) {
      const dx = (s % W) - tx, dy = ((s / W) | 0) - ty;
      if (dx * dx + dy * dy < minD * minD) { ok = false; break; }
    }
    if (ok) seeds.push(t);
  }

  let provOf = new Int32Array(N).fill(-1);
  let nProv = 0;
  const frontier = [];
  const flood = () => {
    while (frontier.length) {
      const k = rng.int(0, frontier.length - 1);
      const t = frontier[k];
      frontier[k] = frontier[frontier.length - 1];
      frontier.pop();
      const x = t % W, y = (t / W) | 0;
      const p = provOf[t];
      if (x > 0 && land[t - 1] && provOf[t - 1] < 0) { provOf[t - 1] = p; frontier.push(t - 1); }
      if (x < W - 1 && land[t + 1] && provOf[t + 1] < 0) { provOf[t + 1] = p; frontier.push(t + 1); }
      if (y > 0 && land[t - W] && provOf[t - W] < 0) { provOf[t - W] = p; frontier.push(t - W); }
      if (y < H - 1 && land[t + W] && provOf[t + W] < 0) { provOf[t + W] = p; frontier.push(t + W); }
    }
  };
  for (const s of seeds) { provOf[s] = nProv++; frontier.push(s); }
  flood();
  for (const t of landTiles) {
    if (provOf[t] < 0) { provOf[t] = nProv++; frontier.push(t); flood(); }
  }

  // Merge slivers into their largest-border neighbor, then compact ids.
  {
    const sizes = new Int32Array(nProv);
    for (const t of landTiles) sizes[provOf[t]]++;
    const remap = new Int32Array(nProv);
    for (let i = 0; i < nProv; i++) remap[i] = i;
    for (let p = 0; p < nProv; p++) {
      if (sizes[p] >= 14) continue;
      const border = new Map();
      for (const t of landTiles) {
        if (provOf[t] !== p) continue;
        const x = t % W, y = (t / W) | 0;
        for (const n of [x > 0 ? t - 1 : -1, x < W - 1 ? t + 1 : -1, y > 0 ? t - W : -1, y < H - 1 ? t + W : -1]) {
          if (n >= 0 && land[n] && provOf[n] !== p) border.set(provOf[n], (border.get(provOf[n]) || 0) + 1);
        }
      }
      let best = -1, bc = 0;
      for (const [q, cnt] of border) if (cnt > bc) { bc = cnt; best = q; }
      if (best >= 0) {
        for (const t of landTiles) if (provOf[t] === p) provOf[t] = best;
        sizes[best] += sizes[p]; sizes[p] = 0;
      }
    }
    const newId = new Int32Array(nProv).fill(-1);
    let next = 0;
    for (const t of landTiles) {
      const p = provOf[t];
      if (newId[p] < 0) newId[p] = next++;
      provOf[t] = newId[p];
    }
    nProv = next;
  }

  // ---- 4. Province records: size, centroid, adjacency (land + short sea crossings).
  const provinces = [];
  const nbSets = [];
  for (let i = 0; i < nProv; i++) {
    provinces.push({ id: i, name: '', tiles: 0, sx: 0, sy: 0, hsum: 0, coastal: false, lx: 0, ly: 0, pop: 0, owner: -1, neighbors: [] });
    nbSets.push(new Set());
  }
  const coastalTiles = [];
  for (const t of landTiles) {
    const p = provOf[t], P = provinces[p];
    const x = t % W, y = (t / W) | 0;
    P.tiles++; P.sx += x; P.sy += y; P.hsum += height[t];
    let coast = false;
    for (const n of [x > 0 ? t - 1 : -1, x < W - 1 ? t + 1 : -1, y > 0 ? t - W : -1, y < H - 1 ? t + W : -1]) {
      if (n < 0) continue;
      if (!land[n]) coast = true;
      else if (provOf[n] !== p) nbSets[p].add(provOf[n]);
    }
    if (coast) { P.coastal = true; coastalTiles.push(t); }
  }
  const seaLinks = [];
  const R = 5;
  for (const t of coastalTiles) {
    const p = provOf[t];
    const x = t % W, y = (t / W) | 0;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > R) continue;
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const n = yy * W + xx;
        if (!land[n]) continue;
        const q = provOf[n];
        if (q === p || nbSets[p].has(q)) continue;
        nbSets[p].add(q); nbSets[q].add(p);
        seaLinks.push([p, q]);
      }
    }
  }
  // Label point = the province's own tile nearest its centroid.
  const bestD = new Float32Array(nProv).fill(Infinity);
  for (const t of landTiles) {
    const p = provOf[t], P = provinces[p];
    const x = t % W, y = (t / W) | 0;
    const dx = x - P.sx / P.tiles, dy = y - P.sy / P.tiles;
    const d = dx * dx + dy * dy;
    if (d < bestD[p]) { bestD[p] = d; P.lx = x; P.ly = y; }
  }
  const usedNames = new Set();
  for (const P of provinces) {
    P.neighbors = Array.from(nbSets[P.id]);
    const hAvg = P.hsum / P.tiles;
    P.rough = Math.round(hAvg * 100) / 100;
    const fertility = 1.25 - hAvg * 0.8 + (P.coastal ? 0.2 : 0);
    P.pop = Math.round(P.tiles * fertility * rng.range(0.6, 1.4) * 9000);
    let name;
    do { name = makeProvinceName(rng); } while (usedNames.has(name));
    usedNames.add(name);
    P.name = name;
    delete P.sx; delete P.sy; delete P.hsum;
  }

  // Land-mass size for each province (to prefer capitals on real continents).
  const landComp = labelComponents(W, H, i => land[i] === 1);
  const provCompSize = provinces.map(P => landComp.sizes[landComp.comp[P.ly * W + P.lx]]);

  // ---- 5. Nations: spread-out capitals, then grow outward over province adjacency.
  const nCountries = clamp(opts.countries || 14, 2, Math.max(2, Math.floor(nProv / 3)));
  const caps = [];
  if (model.regionSeeds) {
    // Seed nations at real-world regional centers, in priority order.
    const V = EARTH_VIEW;
    for (const [lon, lat] of model.regionSeeds) {
      if (caps.length >= nCountries) break;
      const x = ((lon - V.lon0 + 720) % 360) / 360 * W, y = (V.latTop - lat) / V.latSpan * H;
      let best = -1, bd = Infinity;
      for (const P of provinces) {
        if (caps.includes(P.id)) continue;
        const d = Math.hypot(P.lx - x, P.ly - y);
        if (d < bd) { bd = d; best = P.id; }
      }
      if (best >= 0 && bd < 12) caps.push(best);
    }
  }
  if (!caps.length) caps.push(rng.weighted(provinces, P => P.tiles * (provCompSize[P.id] > 300 ? 1 : 0.2)).id);
  while (caps.length < nCountries) {
    let best = -1, bs = -1;
    for (const P of provinces) {
      if (caps.includes(P.id)) continue;
      let md = Infinity;
      for (const c of caps) {
        const C = provinces[c];
        const d = Math.hypot(P.lx - C.lx, P.ly - C.ly);
        if (d < md) md = d;
      }
      const score = md * rng.range(0.55, 1) * (provCompSize[P.id] > 300 ? 1 : 0.4) * (P.tiles > 20 ? 1 : 0.6);
      if (score > bs) { bs = score; best = P.id; }
    }
    caps.push(best);
  }

  const rates = caps.map(() => (model.regionSeeds ? rng.range(0.85, 1.15) : rng.range(0.5, 1.7)));
  const fronts = caps.map(c => [c]);
  caps.forEach((c, i) => { provinces[c].owner = i; });
  const active = () => fronts.map((f, i) => i).filter(i => fronts[i].length > 0);
  let act = active();
  while (act.length) {
    const ci = rng.weighted(act, i => rates[i]);
    const f = fronts[ci];
    const k = rng.int(0, f.length - 1);
    const p = f[k];
    f[k] = f[f.length - 1]; f.pop();
    for (const q of provinces[p].neighbors) {
      if (provinces[q].owner < 0) { provinces[q].owner = ci; f.push(q); }
    }
    if (f.length === 0) act = active();
  }
  // Anything unreachable (remote islands) goes to the nearest nation.
  for (const P of provinces) {
    if (P.owner >= 0) continue;
    let best = 0, bd = Infinity;
    for (const Q of provinces) {
      if (Q.owner < 0) continue;
      const d = Math.hypot(P.lx - Q.lx, P.ly - Q.ly);
      if (d < bd) { bd = d; best = Q.owner; }
    }
    P.owner = best;
  }

  const usedCountry = new Set();
  const hueBase = rng.range(0, 360);
  const countrySeeds = caps.map((cap, i) => {
    let name;
    do { name = makeCountryName(rng); } while (usedCountry.has(name));
    usedCountry.add(name);
    const hue = (hueBase + i * 137.508 + rng.range(-12, 12)) % 360;
    const rgb = hslToRgb(hue, rng.range(42, 62), rng.range(50, 62));
    return { name, adj: adjectiveOf(name), rgb, color: rgbToHex(rgb), capital: cap };
  });

  return { seed: String(seed), model: modelId, W, H, height, land, provOf, provinces, seaLinks, countrySeeds };
}
