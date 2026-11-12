import type { CropPhaseKey } from '../types';

/** Aparência "realista" de cada talhão no gêmeo digital: cor e textura mudam com a cultura e a fase da safra. */
export interface TwinLook { base: string; row: string; kind: 'rows' | 'dots' | 'bare' }

const SOIL = '#6b4a2e', SOIL_DARK = '#54381f', STUBBLE = '#a28b5c';
// [verde de crescimento, cor de maturação, tipo de textura]
const CROPS: Record<string, [string, string, 'rows' | 'dots']> = {
  soja: ['#1f6b2e', '#b8892c', 'rows'],
  milho: ['#7fae35', '#d4b95a', 'rows'],
  feij: ['#4f9a45', '#b79a45', 'rows'],
  sorgo: ['#6c9a3a', '#b0562f', 'rows'],
  algod: ['#5f9a4a', '#e8e4d2', 'rows'],
  cana: ['#6fa83a', '#a9b34a', 'rows'],
  trigo: ['#a8c050', '#d9b94f', 'rows'],
  pasto: ['#8fbf5a', '#9cae5a', 'dots'],
};
const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a: string, b: string, k: number) => {
  const A = hex(a), B = hex(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * Math.min(1, Math.max(0, k))).toString(16).padStart(2, '0')).join('');
};
const shade = (c: string, k: number) => mix(c, k < 0 ? '#000000' : '#ffffff', Math.abs(k));

export function twinLook(crop: string | undefined, phase: CropPhaseKey): TwinLook {
  const name = (crop || '').toLowerCase();
  const key = Object.keys(CROPS).find((k) => name.includes(k)) || (name.includes('brach') || name.includes('braqui') ? 'pasto' : '');
  if (!key) return { base: '#64748b', row: '#475569', kind: 'bare' };
  const [green, mature, kind] = CROPS[key];
  if (key === 'pasto' || phase === 'pastagem') return { base: green, row: shade(green, -0.25), kind: 'dots' };
  let base = SOIL, k: TwinLook['kind'] = 'bare';
  switch (phase) {
    case 'planejamento': base = mix(SOIL, STUBBLE, 0.4); break;
    case 'preparo': base = SOIL_DARK; break;
    case 'plantio': base = SOIL; k = 'rows'; break;
    case 'emergencia': base = mix(SOIL, green, 0.4); k = 'rows'; break;
    case 'crescimento': base = mix(SOIL, green, 0.85); k = 'rows'; break;
    case 'floracao': base = shade(green, 0.05); k = 'rows'; break;
    case 'enchimento': base = mix(green, mature, 0.5); k = 'rows'; break;
    case 'colheita': base = mature; k = 'rows'; break;
    case 'colhido': base = STUBBLE; k = 'rows'; break;
    default: base = green; k = kind;
  }
  return { base, row: shade(base, -0.28), kind: k };
}

/** Cria (uma vez) o padrão SVG de linhas de plantio/pontos dentro do SVG do Leaflet e devolve o `fill`. */
export function ensurePattern(svg: SVGSVGElement | null, look: TwinLook): string {
  if (!svg) return look.base;
  const id = `twin-${look.kind}-${look.base.slice(1)}`;
  if (!svg.querySelector('#' + id)) {
    const ns = 'http://www.w3.org/2000/svg';
    let defs = svg.querySelector('defs');
    if (!defs) { defs = document.createElementNS(ns, 'defs'); svg.insertBefore(defs, svg.firstChild); }
    const pat = document.createElementNS(ns, 'pattern');
    pat.setAttribute('id', id); pat.setAttribute('patternUnits', 'userSpaceOnUse'); pat.setAttribute('width', '9'); pat.setAttribute('height', '9');
    pat.setAttribute('patternTransform', 'rotate(35)');
    const r = document.createElementNS(ns, 'rect'); r.setAttribute('width', '9'); r.setAttribute('height', '9'); r.setAttribute('fill', look.base); pat.appendChild(r);
    if (look.kind === 'rows') { const l = document.createElementNS(ns, 'rect'); l.setAttribute('width', '1.6'); l.setAttribute('height', '9'); l.setAttribute('fill', look.row); l.setAttribute('opacity', '0.75'); pat.appendChild(l); }
    if (look.kind === 'dots') { [[2, 2], [6.5, 5], [3, 7]].forEach(([x, y]) => { const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', String(x)); c.setAttribute('cy', String(y)); c.setAttribute('r', '0.9'); c.setAttribute('fill', look.row); pat.appendChild(c); }); }
    defs.appendChild(pat);
  }
  return `url(#${id})`;
}
