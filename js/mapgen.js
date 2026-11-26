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

function generateWorld(seed, opts) {
  opts = opts || {};
  const W = opts.width || 200, H = opts.height || 125, N = W * H;
  const landFrac = opts.land || 0.42;
  const rng = makeRng(String(seed) + '|map');
  const noise = makeValueNoise(rng);
  const aspect = W / H;

  // ---- 1. Heightmap: fractal noise + a few continental blobs, sunk at the edges.
  const raw = new Float32Array(N);
  const blobs = [];
  const nb = rng.int(3, 6);
  for (let i = 0; i < nb; i++) {
    blobs.push({ x: rng.range(0.12, 0.88), y: rng.range(0.15, 0.85), r: rng.range(0.13, 0.28), s: rng.range(0.6, 1) });
  }
  const ox = rng.range(0, 100), oy = rng.range(0, 100);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = x / W, ny = y / H;
      const wx = nx + (noise.fbm(nx * 3 + ox, ny * 3 + oy, 3) - 0.5) * 0.22;
      const wy = ny + (noise.fbm(nx * 3 + oy + 31, ny * 3 + ox + 17, 3) - 0.5) * 0.22;
      let b = 0;
      for (const bl of blobs) {
        const dx = (wx - bl.x) * aspect, dy = wy - bl.y;
        const v = Math.exp(-(dx * dx + dy * dy) / (bl.r * bl.r)) * bl.s;
        if (v > b) b = v;
      }
      let h = noise.fbm(wx * 5 * aspect + ox, wy * 5 + oy, 5) * 0.55 + b * 0.65;
      const e = Math.min(nx, 1 - nx, ny, 1 - ny);
      if (e < 0.08) h -= (0.08 - e) * 6;
      raw[y * W + x] = h;
    }
  }

  // ---- 2. Sea level chosen so that a fixed fraction of the map is land.
  const sorted = Float32Array.from(raw).sort();
  const sea = sorted[Math.floor(N * (1 - landFrac))];
  const minH = sorted[0], maxH = sorted[N - 1];
  const land = new Uint8Array(N);
  for (let i = 0; i < N; i++) land[i] = raw[i] > sea ? 1 : 0;

  // Remove specks of land and fill tiny lakes.
  {
    const { comp, sizes } = labelComponents(W, H, i => land[i] === 1);
    for (let i = 0; i < N; i++) if (comp[i] >= 0 && sizes[comp[i]] < 35) land[i] = 0;
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
  const targetProv = opts.provinces || Math.round(clamp(landTiles.length / 72, 30, 500));
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
  caps.push(rng.weighted(provinces, P => P.tiles * (provCompSize[P.id] > 300 ? 1 : 0.2)).id);
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

  const rates = caps.map(() => rng.range(0.5, 1.7));
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

  return { seed: String(seed), W, H, height, land, provOf, provinces, seaLinks, countrySeeds };
}
