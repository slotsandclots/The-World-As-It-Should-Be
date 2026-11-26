'use strict';
// Procedural art: line icons, national flags and illustrated scene banners
// for events. Everything is generated SVG, so it scales and needs no assets.

const ICON_PATHS = {
  nation: 'M5 21V4M5 4h11l-2 4 2 4H5',
  leader: 'M3 19h18M4 19L3 8l5 4 4-7 4 7 5-4-1 11',
  politics: 'M3 21h18M5 21v-9M9.7 21v-9M14.3 21v-9M19 21v-9M2.5 10L12 4l9.5 6z',
  economy: 'M12 4c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 7v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5',
  market: 'M12 3v18M7 21h10M4 7h16M4 7l-3 6c0 1.7 1.3 3 3 3s3-1.3 3-3zM20 7l-3 6c0 1.7 1.3 3 3 3s3-1.3 3-3z',
  pops: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16.5 11a2.5 2.5 0 100-5M18 14c2 .5 3.5 2.5 3.5 6',
  research: 'M9 3h6M10 3v6L4.5 19a1.5 1.5 0 001.3 2h12.4a1.5 1.5 0 001.3-2L14 9V3M7 15h10',
  military: 'M4 4l10 10M4 4v4M4 4h4M20 4L10 14M20 4v4M20 4h-4M7 17l-3 3M17 17l3 3M6 15l3 3M18 15l-3 3',
  diplomacy: 'M6 4h11a2 2 0 012 2v12a2 2 0 01-2 2H8M6 4a2 2 0 00-2 2v1h4V6a2 2 0 00-2-2zM8 7v13a2 2 0 01-4 0M11 9h5M11 13h5',
  blocs: 'M9 7a5 5 0 100 10 5 5 0 000-10zM15 7a5 5 0 100 10 5 5 0 000-10z',
  world: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9M12 3C9.5 5.5 8.2 8.5 8.2 12s1.3 6.5 3.8 9',
  news: 'M4 5h13v14a2 2 0 002 2H6a2 2 0 01-2-2zM17 9h3v10a2 2 0 01-2 2M7 9h7M7 13h7M7 17h4',
  ledger: 'M4 20h16M6 16l4-5 3 3 5-7M18 7h-3M18 7v3',
  coin: 'M12 3a9 9 0 100 18 9 9 0 000-18zM15 8.6c-.6-1-1.7-1.6-3-1.6-1.7 0-3 .9-3 2.2 0 3 6 1.6 6 4.6 0 1.3-1.3 2.2-3 2.2-1.4 0-2.6-.6-3.1-1.6M12 5v14',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  approval: 'M12 3a9 9 0 100 18 9 9 0 000-18zM8 14c1 1.5 2.4 2.2 4 2.2s3-.7 4-2.2M9 9.5h.01M15 9.5h.01',
  stability: 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6zM9 12l2 2 4-4',
  infamy: 'M12 3a8 8 0 00-8 8c0 3 1.6 4.8 3 5.6V20h10v-3.4c1.4-.8 3-2.6 3-5.6a8 8 0 00-8-8zM9 11.5h.01M15 11.5h.01M10.5 20v-2M13.5 20v-2',
  alert: 'M12 3L2 20h20zM12 9v5M12 17h.01',
  hourglass: 'M6 3h12M6 21h12M7 3c0 5 10 4 10 9s-10 4-10 9M17 3c0 5-10 4-10 9s10 4 10 9',
  save: 'M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-7h8v7',
};

function icon(name, size) {
  const d = ICON_PATHS[name];
  if (!d) return '';
  size = size || 18;
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

// ------------------------------------------------------------------ flags

const FLAG_TINCTURES = ['#efe6d2', '#1d2130', '#c9a03c', '#a3322c', '#23437c', '#2e6a3e', '#6b2b4d'];

function hexLum(hex) { const [r, g, b] = hexToRgb(hex); return (r * 0.3 + g * 0.59 + b * 0.11) / 255; }

function flagColors(c) {
  const h = hashString(c.name + '#flag');
  const primary = c.color;
  const lp = hexLum(primary);
  const pick = k => FLAG_TINCTURES.filter(t => Math.abs(hexLum(t) - lp) > 0.22)[k % 5] || '#efe6d2';
  const second = pick(h >>> 3);
  let third = pick((h >>> 7) + 2);
  if (third === second) third = pick((h >>> 7) + 3);
  return { h, primary, second, third };
}

function flagEmblem(gov, cx, cy, r, fill) {
  switch (gov) {
    case 'communist': {
      let pts = '';
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.42 : r; pts += `${(cx + Math.cos(a) * rr).toFixed(2)},${(cy + Math.sin(a) * rr).toFixed(2)} `; }
      return `<polygon points="${pts}" fill="#e8c34a"/>`;
    }
    case 'absMonarchy': case 'constMonarchy':
      return `<path d="M${cx - r} ${cy + r * 0.6}h${r * 2}l${r * 0.15} -${r * 1.4}l-${r * 0.6} ${r * 0.6}l-${r * 0.55} -${r * 0.9}l-${r * 0.55} ${r * 0.9}l-${r * 0.6} -${r * 0.6}z" fill="#e8c34a" stroke="#00000055" stroke-width="0.3"/>`;
    case 'theocracy': {
      let rays = '';
      for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; rays += `M${(cx + Math.cos(a) * r * 0.55).toFixed(2)} ${(cy + Math.sin(a) * r * 0.55).toFixed(2)}L${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`; }
      return `<circle cx="${cx}" cy="${cy}" r="${r * 0.45}" fill="#f0d27a"/><path d="${rays}" stroke="#f0d27a" stroke-width="${r * 0.14}"/>`;
    }
    case 'fascist':
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="#111" stroke-width="${r * 0.25}"/><path d="M${cx - r * 0.5} ${cy}h${r}M${cx} ${cy - r * 0.5}v${r}" stroke="#111" stroke-width="${r * 0.3}"/>`;
    case 'democracy':
      return `<circle cx="${cx}" cy="${cy}" r="${r * 0.5}" fill="none" stroke="${fill}" stroke-width="${r * 0.22}"/>`;
    default: return '';
  }
}

// A national flag, stable per nation; the emblem follows the regime.
function flagSVG(c, w, h) {
  w = w || 30; h = h || 20;
  const { h: hs, primary: P, second: S2, third: T } = flagColors(c);
  const pattern = hs % 8;
  const W = 30, H = 20;
  let body = '';
  let em = { x: 15, y: 10, r: 4.2, fill: S2 };
  switch (pattern) {
    case 0: body = `<rect width="10" height="20" fill="${P}"/><rect x="10" width="10" height="20" fill="${S2}"/><rect x="20" width="10" height="20" fill="${T}"/>`; em = { x: 15, y: 10, r: 3.6, fill: P }; break;
    case 1: body = `<rect width="30" height="7" fill="${P}"/><rect y="6.66" width="30" height="6.7" fill="${S2}"/><rect y="13.33" width="30" height="6.7" fill="${T}"/>`; em = { x: 6, y: 10, r: 3, fill: P }; break;
    case 2: body = `<rect width="30" height="10" fill="${P}"/><rect y="10" width="30" height="10" fill="${S2}"/>`; em = { x: 6, y: 5, r: 3, fill: S2 }; break;
    case 3: body = `<rect width="30" height="20" fill="${P}"/><rect x="8" width="4" height="20" fill="${S2}"/><rect y="8" width="30" height="4" fill="${S2}"/>`; em = { x: 22, y: 15, r: 0, fill: S2 }; break;
    case 4: body = `<rect width="30" height="20" fill="${P}"/><rect width="13" height="10" fill="${S2}"/><rect y="13.5" width="30" height="2.5" fill="${T}"/>`; em = { x: 6.5, y: 5, r: 3, fill: P }; break;
    case 5: body = `<rect width="30" height="20" fill="${P}"/><path d="M0 20L0 15 22 0 30 0 30 5 8 20z" fill="${S2}"/>`; em = { x: 24, y: 15, r: 3, fill: S2 }; break;
    case 6: body = `<rect width="30" height="20" fill="${P}"/><rect x="1.5" y="1.5" width="27" height="17" fill="none" stroke="${S2}" stroke-width="1.6"/><circle cx="15" cy="10" r="5.5" fill="${S2}"/>`; em = { x: 15, y: 10, r: 3.6, fill: P }; break;
    default: body = `<rect width="30" height="10" fill="${P}"/><rect y="10" width="30" height="10" fill="${T}"/><path d="M0 0L13 10 0 20z" fill="${S2}"/>`; em = { x: 4.5, y: 10, r: 2.8, fill: P }; break;
  }
  const emblem = em.r ? flagEmblem(c.gov, em.x, em.y, em.r, em.fill) : '';
  return `<svg class="flag" width="${w}" height="${h}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${body}${emblem}` +
    `<rect width="30" height="20" fill="url(#flag-sheen)"/><rect x=".25" y=".25" width="29.5" height="19.5" fill="none" stroke="#0008" stroke-width=".5"/></svg>`;
}

// Shared SVG defs (the cloth sheen on flags), injected once into the page.
function injectArtDefs() {
  if (typeof document === 'undefined' || document.getElementById('art-defs')) return;
  const d = document.createElement('div');
  d.id = 'art-defs';
  d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  d.innerHTML = '<svg width="0" height="0"><defs><linearGradient id="flag-sheen" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#000" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity=".08"/></linearGradient></defs></svg>';
  document.body.appendChild(d);
}

// ------------------------------------------------------------------ scenes

const SCENE_SKIES = {
  dusk: ['#2a1d3a', '#7a3b4a', '#e0894f'], dawn: ['#1f2f52', '#6a6f9a', '#e8b27a'], night: ['#070b18', '#16224a', '#33416e'],
  storm: ['#101418', '#2c353d', '#56626a'], day: ['#3d6a9a', '#7fa6c4', '#d8d6c0'], fire: ['#1a0d0d', '#5a1c14', '#d8562a'],
  gold: ['#2a2238', '#7a5a4a', '#e8c27a'],
};

const EVENT_SCENES = {
  strike: 'crowd', students: 'crowd', agitation: 'crowd', march: 'crowd',
  scandal: 'parliament', ministerScandal: 'parliament', scandalBreaks: 'city', ministerResigns: 'parliament', opposition: 'parliament',
  debate: 'parliament', manifesto: 'city', dialogue: 'parliament',
  generals: 'army', plot: 'army', generalUltimatum: 'army', generalReturns: 'army', border: 'army', assassination: 'city',
  boom: 'factory', inflation: 'city', techBreakthrough: 'factory', disaster: 'storm', revival: 'temple',
  royalWedding: 'palace', heirTrouble: 'palace', summit: 'harbor', spy: 'city',
};

// An illustrated banner: a sky, distant hills and a silhouetted scene.
function sceneSVG(kind, seed) {
  const rng = makeRng(String(seed || kind));
  const W = 720, H = 200;
  const skyKey = { crowd: 'dusk', parliament: 'dawn', army: 'fire', factory: 'gold', city: 'night', storm: 'storm', temple: 'gold', palace: 'dusk', harbor: 'dawn', war: 'fire', election: 'dawn', peace: 'day', revolution: 'fire' }[kind] || 'dusk';
  const [s0, s1, s2] = SCENE_SKIES[skyKey];
  const id = 'sc' + Math.floor(rng() * 1e9);
  const ink = '#0d0f17';
  let g = `<defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s0}"/><stop offset=".62" stop-color="${s1}"/><stop offset="1" stop-color="${s2}"/></linearGradient>` +
    `<radialGradient id="${id}g" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${s2}" stop-opacity=".9"/><stop offset="1" stop-color="${s2}" stop-opacity="0"/></radialGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#${id}s)"/>`;
  // Sun or moon, with a halo.
  const sx = 120 + rng() * 480, sy = skyKey === 'night' ? 50 : 120 + rng() * 20;
  if (skyKey !== 'storm') g += `<circle cx="${sx}" cy="${sy}" r="90" fill="url(#${id}g)"/><circle cx="${sx}" cy="${sy}" r="${skyKey === 'night' ? 14 : 26}" fill="${skyKey === 'night' ? '#e8e4d0' : '#f6dca0'}" opacity=".9"/>`;
  if (skyKey === 'night') for (let k = 0; k < 40; k++) g += `<circle cx="${rng() * W}" cy="${rng() * 110}" r="${rng() * 1.2 + 0.3}" fill="#fff" opacity="${0.3 + rng() * 0.6}"/>`;
  // Clouds.
  for (let k = 0; k < 4; k++) {
    const cx = rng() * W, cy = 25 + rng() * 60, cw = 80 + rng() * 140;
    g += `<ellipse cx="${cx}" cy="${cy}" rx="${cw}" ry="${6 + rng() * 6}" fill="${s1}" opacity="${skyKey === 'storm' ? 0.8 : 0.35}"/>`;
  }
  // Two layers of hills.
  const hills = (base, amp, col, op) => {
    let d = `M0 ${H}L0 ${base}`;
    for (let x = 0; x <= W; x += 40) d += `L${x} ${(base - Math.sin(x / 90 + rng() * 0.6) * amp - rng() * amp * 0.5).toFixed(1)}`;
    return `<path d="${d}L${W} ${H}z" fill="${col}" opacity="${op}"/>`;
  };
  g += hills(150, 18, ink, 0.35) + hills(165, 10, ink, 0.55);
  const ground = 178;
  const rect = (x, y, w, h) => `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"/>`;
  const windows = (x, y, w, h, p) => {
    let o = '';
    for (let yy = y + 6; yy < y + h - 4; yy += 9) for (let xx = x + 4; xx < x + w - 4; xx += 7) if (rng() < p) o += `<rect x="${xx}" y="${yy}" width="2.5" height="4" fill="#f3c66a" opacity="${0.5 + rng() * 0.5}"/>`;
    return o;
  };
  const skyline = (x0, x1, minH, maxH, lit, op) => {
    let o = '', lights = '';
    for (let x = x0; x < x1;) {
      const w = 18 + rng() * 34, h = minH + rng() * (maxH - minH);
      o += rect(x, ground - h, w, h);
      if (rng() < 0.25) o += rect(x + w / 2 - 1.5, ground - h - 14, 3, 14);
      if (lit) lights += windows(x, ground - h, w, h, lit);
      x += w + rng() * 4;
    }
    return `<g fill="${ink}" opacity="${op || 0.85}">${o}</g>${lights}`;
  };
  const dome = (cx, base, w, h) => `<path d="M${cx - w / 2} ${base}a${w / 2} ${h} 0 0 1 ${w} 0z"/>` + rect(cx - 2, base - h - 16, 4, 16);
  const columns = (x, y, w, h, n) => {
    let o = rect(x - 6, y - 8, w + 12, 8) + `<path d="M${x - 8} ${y - 8}L${x + w / 2} ${y - 30}L${x + w + 8} ${y - 8}z"/>` + rect(x - 8, y + h, w + 16, 6);
    for (let k = 0; k < n; k++) o += rect(x + k * (w / (n - 1)) - 2.5, y, 5, h);
    return o;
  };
  const flag = (x, y, col) => `<path d="M${x} ${y}v-44" stroke="${ink}" stroke-width="2"/><path d="M${x} ${y - 44}q14 -5 26 2t26 -2v16q-14 5 -26 -2t-26 2z" fill="${col}"/>`;
  const banner = ['#a8322d', '#c9a03c', '#efe6d2', '#23437c'][Math.floor(rng() * 4)];
  let fg = '';
  switch (kind) {
    case 'crowd': case 'revolution': {
      fg += skyline(0, W, 30, 90, 0.12, 0.42);
      let people = '';
      for (let row = 0; row < 3; row++) for (let x = -10 + row * 6; x < W + 10; x += 15 + rng() * 8) {
        const y = 206 + row * 6, r = 7 + rng() * 2 - row;
        people += `<circle cx="${x.toFixed(1)}" cy="${(y - r * 3.6).toFixed(1)}" r="${r.toFixed(1)}"/><path d="M${(x - r * 1.8).toFixed(1)} ${H}q0 -${(r * 3.2).toFixed(1)} ${(r * 1.8).toFixed(1)} -${(r * 3.2).toFixed(1)}t${(r * 1.8).toFixed(1)} ${(r * 3.2).toFixed(1)}z"/>`;
        if (rng() < 0.08) people += `<path d="M${x + r} ${y - r * 3.4}l${8 + rng() * 6} -${22 + rng() * 8}" stroke="${ink}" stroke-width="${r * 0.6}" stroke-linecap="round"/>`;
      }
      for (let k = 0; k < 5; k++) fg += flag(40 + k * 140 + rng() * 60, 150 + rng() * 10, k % 2 ? banner : '#a8322d');
      fg += `<g fill="${ink}">${people}</g>`;
      break;
    }
    case 'parliament': case 'election': {
      fg += skyline(0, 230, 20, 60, 0.08) + skyline(490, W, 20, 60, 0.08);
      fg += `<g fill="${ink}">${dome(360, 110, 120, 52)}${columns(270, 110, 180, 62, 9)}${rect(230, 120, 40, 58)}${rect(450, 120, 40, 58)}</g>`;
      if (kind === 'election') for (let k = 0; k < 3; k++) fg += flag(250 + k * 110, 112, k === 1 ? banner : '#efe6d2');
      break;
    }
    case 'army': case 'war': {
      fg += hills(172, 6, ink, 0.7);
      for (let k = 0; k < 3; k++) fg += flag(140 + k * 220 + rng() * 40, 160, k === 1 ? '#a8322d' : banner);
      let men = '';
      for (let row = 0; row < 2; row++) for (let x = 6 + row * 11; x < W; x += 22) {
        const y = 184 + row * 10, hh = 30 - row * 3;
        men += `<path d="M${x - 6} ${y - hh}a6 4.5 0 0 1 12 0z"/><circle cx="${x}" cy="${y - hh + 2}" r="4"/>${rect(x - 5, y - hh + 5, 10, hh - 5)}<path d="M${x + 6} ${y - 8}l4 -${hh + 6}" stroke="${ink}" stroke-width="2"/>`;
      }
      // A field gun on the ridge.
      const gx = 520 + rng() * 120;
      men += `<circle cx="${gx}" cy="170" r="9"/><path d="M${gx - 4} 166l46 -14 2 6 -44 14z"/>`;
      if (kind === 'war') for (let k = 0; k < 5; k++) fg += `<circle cx="${rng() * W}" cy="${100 + rng() * 50}" r="${10 + rng() * 22}" fill="#3a2a2a" opacity=".55"/>`;
      fg += `<g fill="${ink}">${men}</g>`;
      break;
    }
    case 'factory': {
      let o = '', smoke = '';
      for (let x = 20; x < W; x += 70 + rng() * 40) {
        const w = 60 + rng() * 40, h = 30 + rng() * 25;
        o += rect(x, ground - h, w, h);
        for (let k = 0; k < 3; k++) o += `<path d="M${x + k * w / 3} ${ground - h}l${w / 3} -14v14z"/>`;
        if (rng() < 0.7) {
          const cx = x + w * 0.7, ch = 50 + rng() * 40;
          o += rect(cx, ground - h - ch, 7, ch);
          for (let k = 0; k < 6; k++) smoke += `<circle cx="${cx + 4 + k * 9 + rng() * 6}" cy="${ground - h - ch - 6 - k * 7}" r="${5 + k * 2.4}" fill="#5a5048" opacity="${0.5 - k * 0.07}"/>`;
        }
      }
      fg += smoke + `<g fill="${ink}">${o}</g>` + windows(0, ground - 30, W, 28, 0.04);
      break;
    }
    case 'city': fg += skyline(0, W, 40, 120, 0.22); break;
    case 'storm': {
      let rain = '';
      for (let k = 0; k < 120; k++) { const x = rng() * W, y = rng() * H; rain += `M${x} ${y}l-6 16`; }
      fg += `<path d="${rain}" stroke="#9fb0bc" stroke-width="1" opacity=".35"/>`;
      fg += `<path d="M${300 + rng() * 100} 0l-14 50 12 0-18 60" stroke="#f4f0d0" stroke-width="2.5" fill="none" opacity=".9"/>`;
      fg += skyline(0, W, 15, 45, 0.04);
      let waves = '';
      for (let k = 0; k < 3; k++) { let d = `M0 ${182 + k * 7}`; for (let x = 0; x <= W; x += 30) d += `q15 -6 30 0`; waves += `<path d="${d}" stroke="#7d8e99" stroke-width="2" fill="none" opacity="${0.6 - k * 0.15}"/>`; }
      fg += waves;
      break;
    }
    case 'temple': {
      for (let k = 0; k < 10; k++) { const a = -Math.PI + k * Math.PI / 9; fg += `<path d="M360 100L${360 + Math.cos(a) * 400} ${100 + Math.sin(a) * 400}" stroke="#f6dca0" stroke-width="10" opacity=".07"/>`; }
      fg += skyline(0, 250, 20, 50, 0.05) + skyline(470, W, 20, 50, 0.05);
      fg += `<g fill="${ink}">${dome(360, 115, 90, 60)}${rect(300, 115, 120, 63)}${rect(280, 70, 12, 108)}${rect(428, 70, 12, 108)}<path d="M280 70l6 -22 6 22zM428 70l6 -22 6 22z"/></g>`;
      break;
    }
    case 'palace': {
      fg += `<g fill="${ink}">${rect(180, 120, 360, 58)}`;
      for (const x of [180, 300, 420, 525]) fg += rect(x - 10, 92, 30, 86) + `<path d="M${x - 12} 92l17 -26 17 26z"/>`;
      fg += `${dome(360, 120, 70, 34)}</g>` + windows(180, 124, 360, 50, 0.35) + flag(365, 72, banner);
      break;
    }
    case 'harbor': case 'peace': {
      fg += skyline(380, W, 25, 70, 0.12);
      let ships = '';
      for (let k = 0; k < 3; k++) {
        const x = 40 + k * 110 + rng() * 30, y = 180;
        ships += `<path d="M${x} ${y}h60l-8 10h-44z"/>${rect(x + 26, y - 46, 2.5, 46)}<path d="M${x + 29} ${y - 44}l22 34h-22zM${x + 25} ${y - 40}l-18 30h18z" opacity=".85"/>`;
      }
      fg += `<g fill="${ink}">${ships}</g>`;
      let waves = '';
      for (let k = 0; k < 3; k++) { let d = `M0 ${186 + k * 6}`; for (let x = 0; x <= W; x += 24) d += `q12 -4 24 0`; waves += `<path d="${d}" stroke="${s2}" stroke-width="1.2" fill="none" opacity="${0.5 - k * 0.12}"/>`; }
      fg += waves;
      break;
    }
    default: fg += skyline(0, W, 30, 90, 0.1);
  }
  // Ground strip behind the figures, then a vignette that fades into the dialog.
  if (!['crowd', 'revolution'].includes(kind)) g += `<rect y="${ground}" width="${W}" height="${H - ground}" fill="${ink}" opacity=".6"/>`;
  g += fg;
  g += `<linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1"><stop offset=".8" stop-color="#121a26" stop-opacity="0"/><stop offset="1" stop-color="#121a26" stop-opacity=".9"/></linearGradient><rect width="${W}" height="${H}" fill="url(#${id}v)"/>`;
  return `<svg class="scene" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${g}</svg>`;
}

function sceneForEvent(id) { return EVENT_SCENES[id] || 'city'; }
