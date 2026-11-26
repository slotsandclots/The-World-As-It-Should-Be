'use strict';
// Procedural names for nations, people and provinces.

const NAME_PARTS = {
  start: ['Ar', 'Bal', 'Cor', 'Dra', 'El', 'Fen', 'Gal', 'Hal', 'Ist', 'Kar', 'Lor', 'Mar', 'Nor', 'Ost',
    'Pra', 'Quel', 'Ros', 'Sar', 'Tor', 'Ul', 'Val', 'Ves', 'Zan', 'Kel', 'Bran', 'Thal', 'Mer', 'Aur',
    'Ced', 'Dun', 'Ery', 'Gor', 'Hes', 'Ith', 'Jor', 'Kav', 'Lys', 'Myr', 'Nav', 'Pel', 'Rha', 'Sel',
    'Tav', 'Vor', 'Wes', 'Yar', 'Zel', 'Bor', 'Cal', 'Del', 'Fal', 'Grem', 'Lum', 'Ser', 'Tir'],
  mid: ['a', 'e', 'i', 'o', 'u', 'an', 'en', 'ar', 'or', 'el', 'al', 'ir', 'un', 'ov', 'es', 'at', 'ur', 'ol', 'im'],
  end: ['ia', 'land', 'stan', 'mark', 'or', 'heim', 'avia', 'ova', 'eth', 'ara', 'une', 'is', 'gard', 'mor',
    'dor', 'ica', 'esh', 'ania', 'ur', 'oth', 'ena', 'ary', 'ora', 'on', 'ithia', 'enia'],
  provEnd: ['burg', 'ford', 'vale', 'holm', 'port', 'grad', 'shire', 'moor', 'fell', 'ton', 'ville', 'wick',
    'mouth', 'reach', 'haven', 'field', 'crest', 'dale', 'gate', 'by'],
  male: ['Aldric', 'Casimir', 'Edvin', 'Gustav', 'Ivo', 'Konrad', 'Mirko', 'Otto', 'Radan', 'Tomas', 'Viktor',
    'Yuri', 'Anton', 'Emil', 'Lazar', 'Oskar', 'Stefan', 'Leopold', 'Matthias', 'Bogdan', 'Henrik', 'Dario',
    'Feliks', 'Joaquin', 'Teodor', 'Arvid', 'Milos', 'Rafael', 'Soren', 'Cyprian', 'Lucan', 'Benedek'],
  female: ['Bera', 'Dalia', 'Freya', 'Helena', 'Jana', 'Lena', 'Nadia', 'Petra', 'Sofia', 'Ursa', 'Wilma',
    'Zora', 'Brigit', 'Ilse', 'Marta', 'Rosa', 'Tilda', 'Vera', 'Ines', 'Elena', 'Agnieszka', 'Carmen',
    'Liv', 'Mirela', 'Ottilie', 'Svetla', 'Yara', 'Annika', 'Dorota', 'Imke'],
  surnameEnd: ['ov', 'ski', 'berg', 'ard', 'ez', 'enko', 'escu', 'sson', 'ani', 'ell', 'ford', 'mann', 'ic',
    'as', 'ström', 'oni', 'ley', 'stein', 'avic', 'ides'],
};

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function tidyName(n) {
  return capitalize(n.toLowerCase().replace(/([aeiou])\1+/g, '$1').replace(/([^aeiou])\1\1+/g, '$1$1'));
}

function makeCountryName(rng) {
  const s = rng.pick(NAME_PARTS.start);
  const m = rng.chance(0.45) ? rng.pick(NAME_PARTS.mid) : '';
  return tidyName(s + m + rng.pick(NAME_PARTS.end));
}

function adjectiveOf(name) {
  if (/ia$/.test(name)) return name + 'n';
  if (/land$/.test(name)) return name + 'ic';
  if (/stan$/.test(name)) return name + 'i';
  if (/a$/.test(name)) return name + 'n';
  if (/[eiouy]$/.test(name)) return name.replace(/[eiouy]$/, '') + 'ian';
  if (/(mark|gard|heim)$/.test(name)) return name + 'ish';
  return name + 'ian';
}

function makeFirstName(rng, female) {
  return rng.pick(female ? NAME_PARTS.female : NAME_PARTS.male);
}

function makeSurname(rng) {
  return tidyName(rng.pick(NAME_PARTS.start) + (rng.chance(0.3) ? rng.pick(NAME_PARTS.mid) : '') + rng.pick(NAME_PARTS.surnameEnd));
}

function makeProvinceName(rng) {
  return tidyName(rng.pick(NAME_PARTS.start) + (rng.chance(0.4) ? rng.pick(NAME_PARTS.mid) : '') + rng.pick(NAME_PARTS.provEnd));
}

function romanNumeral(n) {
  const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
}
