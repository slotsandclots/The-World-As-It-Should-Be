'use strict';
// Procedural character portraits as inline SVG. Everything is derived from the
// character's look seed, age, sex and role, so a portrait never changes unless
// the character does (they go gray, put on a crown, or swap a suit for a uniform).

const SKIN_TONES = ['#f6d7c3', '#eec3a3', '#e0ac85', '#c98d64', '#a8704a', '#8a5636', '#6b4128', '#4f2f1d'];
const HAIR_COLORS = ['#1c1410', '#2e1f16', '#4a3020', '#6b4528', '#8c5a2c', '#b07a3c', '#d1a35b', '#9a3a1f'];

// Outfit by role and regime: [main color, accent color, style].
function outfitFor(ch, gov) {
  if (ch.role === 'general' || (ch.role === 'leader' && gov === 'junta')) return ['#4d5a32', '#c9a640', 'uniform'];
  if (ch.role === 'leader' && gov === 'fascist') return ['#3b3530', '#b22', 'uniform'];
  if (ch.role === 'leader' && gov === 'communist') return ['#6b6e66', '#c33', 'tunic'];
  if ((ch.role === 'leader' && gov === 'theocracy') || ch.faction === 'clergy') return ['#2a2433', '#e8e2d0', 'robe'];
  if (ch.role === 'monarch' || ch.role === 'heir' || (ch.role === 'leader' && gov === 'absMonarchy')) return ['#5a1f3a', '#f1ead8', 'royal'];
  if (ch.faction === 'military') return ['#3e4a5c', '#c9a640', 'uniform'];
  if (ch.faction === 'workers') return ['#4a5566', '#8aa0b8', 'workwear'];
  return [['#232a3a', '#2f3340', '#3a2f2a', '#283a3a'][ch.look % 4], '#f4f4f4', 'suit'];
}

function portraitSVG(ch, opts) {
  opts = opts || {};
  const size = opts.size || 72;
  const gov = opts.gov || null;
  const rng = makeRng(ch.look || ch.id || 1);
  const skin = SKIN_TONES[rng.int(0, SKIN_TONES.length - 1)];
  const age = ch.age || 40;
  let hair = HAIR_COLORS[rng.int(0, HAIR_COLORS.length - 1)];
  const grayness = clamp((age - 45) / 30, 0, 1) * rng.range(0.5, 1);
  if (grayness > 0.15) hair = mixHex(hair, '#d8d8d8', grayness);
  const female = ch.female;
  const faceW = rng.range(26, 31), faceH = rng.range(33, 38), jaw = rng.range(0.82, 0.98);
  const eyeY = 52 + rng.range(-1.5, 1.5), eyeGap = rng.range(10.5, 13);
  const eyeColor = ['#3b2a1a', '#4a6b8a', '#5a6b3a', '#2a1a10'][rng.int(0, 3)];
  const [cloth, accent, style] = outfitFor(ch, gov);
  const bg = opts.bg || '#1c2438';
  const id = 'p' + (ch.id || 0) + '_' + size;
  const dark = mixHex(skin, '#000000', 0.25);
  let s = `<svg class="portrait" width="${size}" height="${Math.round(size * 1.2)}" viewBox="0 0 100 120" role="img" aria-label="${esc(ch.name || '')}">`;
  s += `<defs><clipPath id="${id}"><rect x="0" y="0" width="100" height="120" rx="10"/></clipPath>
    <radialGradient id="${id}g" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="${mixHex(bg, '#ffffff', 0.12)}"/><stop offset="1" stop-color="${bg}"/></radialGradient></defs>`;
  s += `<g clip-path="url(#${id})"><rect width="100" height="120" fill="url(#${id}g)"/>`;

  // Long hair falls behind the shoulders.
  const hairStyle = female ? rng.pick(['long', 'bob', 'bun', 'short', 'long']) : (age > 55 && rng.chance(0.4) ? 'bald' : rng.pick(['short', 'side', 'slick', 'curly', 'short']));
  if (hairStyle === 'long') s += `<path d="M${50 - faceW - 3} 50 Q${50 - faceW - 6} 92 ${50 - faceW + 2} 100 L${50 + faceW - 2} 100 Q${50 + faceW + 6} 92 ${50 + faceW + 3} 50 Z" fill="${hair}"/>`;

  // Shoulders and clothing.
  s += `<path d="M8 120 Q10 96 34 90 L66 90 Q90 96 92 120 Z" fill="${cloth}"/>`;
  s += `<rect x="${50 - 8}" y="${80}" width="16" height="14" fill="${dark}"/>`;
  if (style === 'suit') {
    s += `<path d="M40 90 L50 106 L60 90 Z" fill="${accent}"/>`;
    s += `<path d="M48 94 L52 94 L53 112 L50 116 L47 112 Z" fill="${['#8b1e2a', '#1e3a8b', '#2a5a3a', '#5a4a1e'][rng.int(0, 3)]}"/>`;
    s += `<path d="M34 90 L46 112 L40 92 Z M66 90 L54 112 L60 92 Z" fill="${mixHex(cloth, '#000000', 0.3)}"/>`;
  } else if (style === 'uniform') {
    s += `<path d="M40 90 L50 100 L60 90 Z" fill="${mixHex(cloth, '#000000', 0.25)}"/>`;
    s += `<rect x="14" y="94" width="18" height="5" rx="2" fill="${accent}"/><rect x="68" y="94" width="18" height="5" rx="2" fill="${accent}"/>`;
    for (let i = 0; i < rng.int(1, 4); i++) s += `<rect x="${28 + i * 5}" y="104" width="4" height="6" fill="${['#c33', '#36c', '#ec3', '#3a3'][i % 4]}"/>`;
    for (let i = 0; i < 3; i++) s += `<circle cx="50" cy="${104 + i * 6}" r="1.4" fill="${accent}"/>`;
  } else if (style === 'tunic') {
    s += `<rect x="42" y="88" width="16" height="6" fill="${mixHex(cloth, '#000000', 0.2)}"/>`;
    for (let i = 0; i < 4; i++) s += `<circle cx="50" cy="${98 + i * 6}" r="1.4" fill="#2a2a2a"/>`;
    s += `<rect x="30" y="100" width="10" height="7" fill="${mixHex(cloth, '#000000', 0.15)}"/><rect x="60" y="100" width="10" height="7" fill="${mixHex(cloth, '#000000', 0.15)}"/>`;
  } else if (style === 'robe') {
    s += `<path d="M38 90 Q50 100 62 90 L60 96 Q50 104 40 96 Z" fill="${accent}"/>`;
    s += `<path d="M47 98 L53 98 L52 120 L48 120 Z" fill="${accent}" opacity="0.6"/>`;
  } else if (style === 'royal') {
    s += `<path d="M30 92 Q50 102 70 92 L74 100 Q50 112 26 100 Z" fill="${accent}"/>`;
    for (let i = 0; i < 6; i++) s += `<circle cx="${32 + i * 7.2}" cy="${100 + Math.sin(i) * 1.5}" r="0.9" fill="#222"/>`;
    s += `<path d="M46 108 L50 104 L54 108 L50 112 Z" fill="#d4af37"/>`;
  } else {
    s += `<path d="M40 90 L50 98 L60 90 Z" fill="${mixHex(cloth, '#ffffff', 0.15)}"/>`;
  }

  // Ears, head, neck shading.
  s += `<ellipse cx="${50 - faceW + 1}" cy="${eyeY + 4}" rx="4" ry="6.5" fill="${skin}"/><ellipse cx="${50 + faceW - 1}" cy="${eyeY + 4}" rx="4" ry="6.5" fill="${skin}"/>`;
  s += `<path d="M${50 - faceW} 48 Q${50 - faceW} ${48 + faceH * 0.95} 50 ${48 + faceH * jaw + 4} Q${50 + faceW} ${48 + faceH * 0.95} ${50 + faceW} 48 Q${50 + faceW} ${48 - faceH * 0.75} 50 ${48 - faceH * 0.75} Q${50 - faceW} ${48 - faceH * 0.75} ${50 - faceW} 48 Z" fill="${skin}"/>`;

  // Hair on top.
  const top = 48 - faceH * 0.75;
  if (hairStyle === 'bald') {
    s += `<path d="M${50 - faceW} 50 Q${50 - faceW - 1} 40 ${50 - faceW + 5} 38 L${50 - faceW + 4} 54 Z M${50 + faceW} 50 Q${50 + faceW + 1} 40 ${50 + faceW - 5} 38 L${50 + faceW - 4} 54 Z" fill="${hair}"/>`;
  } else if (hairStyle === 'curly') {
    for (let i = 0; i < 9; i++) { const a = Math.PI * (0.05 + i / 8 * 0.9); s += `<circle cx="${50 - Math.cos(a) * (faceW - 2)}" cy="${48 - Math.sin(a) * (faceH * 0.72)}" r="${rng.range(6, 8)}" fill="${hair}"/>`; }
  } else if (hairStyle === 'bun') {
    s += `<circle cx="50" cy="${top - 4}" r="9" fill="${hair}"/>`;
    s += `<path d="M${50 - faceW - 1} 52 Q${50 - faceW - 2} ${top - 2} 50 ${top - 2} Q${50 + faceW + 2} ${top - 2} ${50 + faceW + 1} 52 Q${50 + faceW - 6} 36 50 38 Q${50 - faceW + 6} 36 ${50 - faceW - 1} 52 Z" fill="${hair}"/>`;
  } else {
    const sideLen = hairStyle === 'bob' ? 74 : hairStyle === 'long' ? 70 : 54;
    // Cap of hair over the crown and down the sides, open over the face.
    s += `<path d="M${50 - faceW - 1.5} ${sideLen} Q${50 - faceW - 4} ${top - 2} 50 ${top - 3} Q${50 + faceW + 4} ${top - 2} ${50 + faceW + 1.5} ${sideLen} L${50 + faceW - 1.5} ${sideLen} Q${50 + faceW - 1} ${top + 14} ${50 + faceW - 7} ${top + 11} L${50 - faceW + 7} ${top + 11} Q${50 - faceW + 1} ${top + 14} ${50 - faceW + 1.5} ${sideLen} Z" fill="${hair}"/>`;
    const f = hairStyle === 'side' ? `M${50 - faceW + 1} ${top + 16} Q${46} ${top + 4} ${50 + faceW - 1} ${top + 19} Q${54} ${top + 9} ${50 - faceW + 1} ${top + 16} Z`
      : hairStyle === 'slick' ? `M${50 - faceW + 2} ${top + 12} Q50 ${top + 6} ${50 + faceW - 2} ${top + 12} Q50 ${top + 10} ${50 - faceW + 2} ${top + 12} Z`
      : `M${50 - faceW + 1} ${top + 15} Q50 ${top + 20} ${50 + faceW - 1} ${top + 15} Q50 ${top + 7} ${50 - faceW + 1} ${top + 15} Z`;
    s += `<path d="${f}" fill="${hair}"/>`;
  }

  // Brows, eyes, wrinkles.
  const browTilt = ch.traits && ch.traits.includes('paranoid') ? 2.5 : ch.traits && ch.traits.includes('charismatic') ? -1 : rng.range(-1, 1.5);
  const browColor = mixHex(hair, '#000000', 0.2);
  for (const side of [-1, 1]) {
    const ex = 50 + side * eyeGap;
    s += `<path d="M${ex - 5} ${eyeY - 5 + (side < 0 ? browTilt : 0)} Q${ex} ${eyeY - 8} ${ex + 5} ${eyeY - 5 + (side > 0 ? browTilt : 0)}" stroke="${browColor}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    s += `<ellipse cx="${ex}" cy="${eyeY}" rx="4.2" ry="2.6" fill="#fbfaf5"/><circle cx="${ex}" cy="${eyeY}" r="2" fill="${eyeColor}"/><circle cx="${ex + 0.6}" cy="${eyeY - 0.6}" r="0.6" fill="#fff"/>`;
    if (age > 50) s += `<path d="M${ex + side * 5} ${eyeY + 1} l${side * 2.5} 1.5 M${ex + side * 5} ${eyeY + 3} l${side * 2} 1" stroke="${dark}" stroke-width="0.6" fill="none"/>`;
  }
  if (age > 58) s += `<path d="M42 ${eyeY - 11} Q50 ${eyeY - 12.5} 58 ${eyeY - 11}" stroke="${dark}" stroke-width="0.6" fill="none"/>`;

  // Nose and mouth.
  const noseLen = rng.range(9, 13);
  s += `<path d="M50 ${eyeY + 2} Q${48 - rng.range(0, 2)} ${eyeY + noseLen * 0.7} 46.5 ${eyeY + noseLen} Q50 ${eyeY + noseLen + 2} 53.5 ${eyeY + noseLen}" stroke="${dark}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
  const mouthY = eyeY + noseLen + 8;
  const curve = ch.traits && (ch.traits.includes('charismatic') || ch.traits.includes('populist')) ? 3 : ch.traits && (ch.traits.includes('paranoid') || ch.traits.includes('cruel')) ? -2 : rng.range(-1, 2);
  s += `<path d="M44 ${mouthY} Q50 ${mouthY + curve} 56 ${mouthY}" stroke="${female ? '#a04a4a' : mixHex(skin, '#5a2020', 0.6)}" stroke-width="${female ? 2.2 : 1.6}" fill="none" stroke-linecap="round"/>`;
  if (age > 62) s += `<path d="M41 ${mouthY - 3} q-1 3 0 5 M59 ${mouthY - 3} q1 3 0 5" stroke="${dark}" stroke-width="0.6" fill="none"/>`;

  // Facial hair.
  if (!female) {
    const fh = rng.int(0, 9);
    if (fh <= 1) s += `<path d="M42 ${mouthY - 2} Q50 ${mouthY - 6} 58 ${mouthY - 2} Q50 ${mouthY - 3} 42 ${mouthY - 2} Z" fill="${hair}"/>`;
    else if (fh === 2) s += `<path d="M${50 - faceW + 3} ${mouthY - 8} Q${50 - faceW + 4} ${mouthY + 14} 50 ${mouthY + 15} Q${50 + faceW - 4} ${mouthY + 14} ${50 + faceW - 3} ${mouthY - 8} Q${50 + faceW - 6} ${mouthY + 4} 50 ${mouthY + 3} Q${50 - faceW + 6} ${mouthY + 4} ${50 - faceW + 3} ${mouthY - 8} Z M42 ${mouthY - 2} Q50 ${mouthY - 6} 58 ${mouthY - 2} Q50 ${mouthY - 3} 42 ${mouthY - 2} Z" fill="${hair}"/>`;
    else if (fh === 3) s += `<path d="M45 ${mouthY + 4} Q50 ${mouthY + 12} 55 ${mouthY + 4} Q50 ${mouthY + 7} 45 ${mouthY + 4} Z" fill="${hair}"/>`;
  }

  // Glasses.
  if (rng.chance(0.25 + (age > 55 ? 0.2 : 0))) {
    s += `<g stroke="#222" stroke-width="1.3" fill="rgba(200,220,255,0.15)"><circle cx="${50 - eyeGap}" cy="${eyeY}" r="6"/><circle cx="${50 + eyeGap}" cy="${eyeY}" r="6"/><path d="M${50 - eyeGap + 6} ${eyeY} L${50 + eyeGap - 6} ${eyeY}" fill="none"/></g>`;
  }

  // Headwear.
  const crowned = (ch.role === 'leader' && gov === 'absMonarchy') || ch.role === 'monarch';
  if (crowned) {
    s += `<path d="M${50 - faceW + 3} ${top + 6} L${50 - faceW + 2} ${top - 10} L${50 - 10} ${top - 2} L50 ${top - 14} L${50 + 10} ${top - 2} L${50 + faceW - 2} ${top - 10} L${50 + faceW - 3} ${top + 6} Z" fill="#d4af37" stroke="#8a6d1e" stroke-width="1"/>`;
    s += `<circle cx="50" cy="${top - 2}" r="2.2" fill="#b0203a"/><circle cx="${50 - 12}" cy="${top + 1}" r="1.6" fill="#2050b0"/><circle cx="${50 + 12}" cy="${top + 1}" r="1.6" fill="#2050b0"/>`;
  } else if (ch.role === 'heir' && rng.chance(0.7)) {
    s += `<path d="M${50 - faceW + 4} ${top + 5} Q50 ${top} ${50 + faceW - 4} ${top + 5}" stroke="#d4af37" stroke-width="2.5" fill="none"/>`;
  } else if (style === 'uniform' && (ch.role === 'general' || rng.chance(0.5))) {
    s += `<path d="M${50 - faceW - 3} ${top + 10} Q50 ${top - 16} ${50 + faceW + 3} ${top + 10} Z" fill="${cloth}"/>`;
    s += `<path d="M${50 - faceW - 6} ${top + 12} Q50 ${top + 6} ${50 + faceW + 6} ${top + 12} Q50 ${top + 16} ${50 - faceW - 6} ${top + 12} Z" fill="#1a1a1a"/>`;
    s += `<rect x="${50 - faceW - 1}" y="${top + 6}" width="${faceW * 2 + 2}" height="3" fill="${accent}"/><circle cx="50" cy="${top}" r="3" fill="${accent}"/>`;
  } else if (style === 'robe' && rng.chance(0.6)) {
    s += `<path d="M${50 - faceW - 2} ${top + 10} Q50 ${top - 14} ${50 + faceW + 2} ${top + 10} Q50 ${top + 4} ${50 - faceW - 2} ${top + 10} Z" fill="${accent}"/>`;
  }
  s += '</g></svg>';
  return s;
}

function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (p, sh) => (p >> sh) & 255;
  const m = sh => Math.round(ch(pa, sh) + (ch(pb, sh) - ch(pa, sh)) * t);
  return '#' + ((m(16) << 16) | (m(8) << 8) | m(0)).toString(16).padStart(6, '0');
}
