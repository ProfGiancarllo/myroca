/**
 * Planejador de rotação: compara estratégias (safra de verão + safrinha) por talhão.
 * Motor determinístico e transparente. Todos os limiares ficam em ROTATION_RULES para o agrônomo
 * da equipe ajustar. Valores iniciais para o Sudoeste de Goiás (Rio Verde), A CONFIRMAR com o agrônomo:
 * as janelas vêm das descrições da Embrapa para a região e do ZARC; onde não há fonte, o valor é marcado como inicial.
 */
import { Talhao, RotationSlot, RotationStrategyData } from '../types';
import { addDaysToDate, diffDays } from './cropCalendar';
import { cropKey, parseSacksPerHa } from './forecast';

export type CropKey = 'soja' | 'milho' | 'sorgo' | 'feijao' | 'algodao' | 'trigo' | 'cana' | 'pasto' | 'cobertura' | 'pousio';
export const CROP_KEYS: CropKey[] = ['soja', 'milho', 'sorgo', 'feijao', 'algodao', 'trigo', 'cana', 'pasto', 'cobertura', 'pousio'];

/** Nome padrão (pt) usado pelo restante do aplicativo. */
export const CROP_STANDARD_NAME: Partial<Record<CropKey, string>> = {
  soja: 'Soja', milho: 'Milho', sorgo: 'Sorgo', feijao: 'Feijão', algodao: 'Algodão',
  trigo: 'Trigo', cana: 'Cana-de-açúcar', pasto: 'Pastagem',
};

export const DEFAULT_CYCLE: Record<CropKey, number> = {
  soja: 115, milho: 120, sorgo: 110, feijao: 90, algodao: 180, trigo: 100, cana: 365, pasto: 0, cobertura: 90, pousio: 0,
};

interface Win { idealStart: number; idealEnd: number; tolStart: number; tolEnd: number } // mês*100+dia

export const ROTATION_RULES = {
  /** Janelas de semeadura por cultura e época. */
  windows: {
    soja:      { summer: { idealStart: 1001, idealEnd: 1130, tolStart: 920, tolEnd: 1215 } },
    milho:     { summer: { idealStart: 1001, idealEnd: 1130, tolStart: 920, tolEnd: 1215 },
                 second: { idealStart: 115, idealEnd: 220, tolStart: 101, tolEnd: 305 } },      // após ~20/fev é arriscado (Embrapa)
    sorgo:     { summer: { idealStart: 1001, idealEnd: 1130, tolStart: 920, tolEnd: 1215 },
                 second: { idealStart: 120, idealEnd: 310, tolStart: 101, tolEnd: 331 } },      // abril rendeu 15 sc/ha contra 53 sc/ha na entrelinha (Embrapa)
    feijao:    { summer: { idealStart: 1001, idealEnd: 1130, tolStart: 920, tolEnd: 1215 },
                 second: { idealStart: 201, idealEnd: 310, tolStart: 120, tolEnd: 331 } },      // inicial, a confirmar
    algodao:   { summer: { idealStart: 1101, idealEnd: 1215, tolStart: 1020, tolEnd: 1231 },
                 second: { idealStart: 105, idealEnd: 215, tolStart: 1226, tolEnd: 228 } },     // inicial, a confirmar
    trigo:     { second: { idealStart: 215, idealEnd: 310, tolStart: 201, tolEnd: 331 } },      // sequeiro; altitude a confirmar
    cobertura: { second: { idealStart: 125, idealEnd: 220, tolStart: 120, tolEnd: 315 } },      // fim de janeiro a meados de fevereiro (Embrapa)
  } as Record<string, { summer?: Win; second?: Win }>,
  /** Culturas que ocupam o ano todo (sem safrinha). */
  perennial: ['cana', 'pasto'] as CropKey[],
  /** Folga entre a colheita da safrinha e a semeadura do verão seguinte (dias). */
  minGapDays: 10,
  /** Dias entre a colheita de uma cultura e a semeadura da seguinte. */
  turnaroundDays: 7,
  /** Altitude mínima usual para trigo de sequeiro (m) e altitude aproximada de Rio Verde: a confirmar no ZARC. */
  wheatMinAlt: 800,
  riverVerdeAlt: 715,
  score: { medium: 2, high: 4 },
};

export type Sev = 0 | 1 | 2;
export type FindingKind = 'benefit' | 'risk' | 'gap';
export interface Finding {
  key: string;
  sev: Sev;
  kind: FindingKind;
  params: Record<string, string | number>;
  source?: 'Embrapa' | 'NASA POWER' | 'regra';
}
export type Evidence = 'model' | 'trend' | 'rules';

export interface Evaluation {
  level: 'low' | 'medium' | 'high';
  score: number;
  findings: Finding[];
  summer: { crop: CropKey; sow: string; harvest: string };
  second: { crop: CropKey; sow: string; harvest: string } | null;
  yields: { summer: YieldRef | null; second: YieldRef | null };
  evidence: { summer: Evidence | null; second: Evidence | null };
}
export interface YieldRef { value: number; n: number }

const GROUP: Record<CropKey, 'leg' | 'gram' | 'alg' | 'per' | 'cob' | 'none'> = {
  soja: 'leg', feijao: 'leg', milho: 'gram', sorgo: 'gram', trigo: 'gram', algodao: 'alg',
  cana: 'per', pasto: 'per', cobertura: 'cob', pousio: 'none',
};

const EVIDENCE: Record<CropKey, Evidence | null> = {
  soja: 'model', sorgo: 'model', milho: 'trend', feijao: 'trend',
  algodao: 'rules', trigo: 'rules', cana: 'rules', pasto: 'rules', cobertura: 'rules', pousio: null,
};

const mmdd = (iso: string) => Number(iso.slice(5, 7)) * 100 + Number(iso.slice(8, 10));
const inWin = (v: number, a: number, b: number) => (a <= b ? v >= a && v <= b : v >= a || v <= b);
const fmt = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Média de produtividade registrada no talhão para a cultura (sc/ha). */
export function yieldReference(talhao: Talhao, crop: CropKey): YieldRef | null {
  const vals: number[] = [];
  (talhao.harvestHistory || []).forEach((h) => {
    const v = parseSacksPerHa(h.yieldText);
    if (v !== null && cropKey(h.crop) === crop) vals.push(v);
  });
  if (cropKey(talhao.crop) === crop) {
    (talhao.diary || []).forEach((e) => {
      if (e.type === 'colheita' && typeof e.amount === 'number' && e.amount > 0) vals.push(e.amount);
    });
  }
  return vals.length ? { value: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length } : null;
}

export function asCropKey(c?: string): CropKey {
  const k = cropKey(c);
  return (CROP_KEYS as string[]).includes(k) ? (k as CropKey) : 'pousio';
}

function windowFinding(crop: CropKey, season: 'summer' | 'second', sowIso: string, nameParams: Record<string, string | number>): Finding {
  const w = ROTATION_RULES.windows[crop]?.[season];
  const date = fmt(sowIso);
  if (!w) return { key: 'notForSeason', sev: 2, kind: 'risk', params: { ...nameParams, date }, source: 'regra' };
  const v = mmdd(sowIso);
  if (inWin(v, w.idealStart, w.idealEnd)) return { key: 'windowOk', sev: 0, kind: 'benefit', params: { ...nameParams, date }, source: 'Embrapa' };
  if (inWin(v, w.tolStart, w.tolEnd)) {
    // cedo ou tarde? compara com o início ideal
    const early = season === 'summer' ? v < w.idealStart : (v >= 1000 || v < w.idealStart);
    return { key: early ? 'windowEarly' : 'windowLate', sev: 1, kind: 'risk', params: { ...nameParams, date }, source: 'Embrapa' };
  }
  return { key: 'windowOut', sev: 2, kind: 'risk', params: { ...nameParams, date }, source: 'Embrapa' };
}

function transition(a: CropKey, b: CropKey, nameA: string, nameB: string): Finding | null {
  if (a === 'pousio' || b === 'pousio') return null;
  const p = { a: nameA, b: nameB };
  if (a === 'cobertura' && b !== 'cobertura') return { key: 'coverBenefit', sev: 0, kind: 'benefit', params: p, source: 'Embrapa' };
  if (a === b) {
    if (a === 'soja') return { key: 'monoSoy', sev: 2, kind: 'risk', params: p, source: 'regra' };
    if (a === 'algodao') return { key: 'monoCotton', sev: 2, kind: 'risk', params: p, source: 'regra' };
    return { key: 'sameFamily', sev: 1, kind: 'risk', params: p, source: 'regra' };
  }
  const ga = GROUP[a], gb = GROUP[b];
  if ((ga === 'leg' && gb === 'gram') || (ga === 'gram' && gb === 'leg')) return { key: 'alternates', sev: 0, kind: 'benefit', params: p, source: 'regra' };
  if (ga === gb && ga !== 'none') return { key: 'sameFamily', sev: 1, kind: 'risk', params: p, source: 'regra' };
  return null;
}

/**
 * Avalia uma estratégia.
 * @param names nome traduzido de cada cultura (para os textos)
 * @param nasaLevel nível de risco de semeadura com o clima recente da NASA POWER (null se indisponível)
 */
export function evaluateStrategy(
  s: RotationStrategyData,
  talhao: Talhao,
  summerSow: string,
  refIso: string,
  names: (c: CropKey) => string,
  nasa: { level: 'low' | 'medium' | 'high'; rain15: number } | null
): Evaluation {
  const R = ROTATION_RULES;
  const f: Finding[] = [];
  const sc = s.summer.crop as CropKey;
  const nc = s.second.crop as CropKey;
  const summerCycle = Math.max(0, s.summer.cycle || DEFAULT_CYCLE[sc]);
  const secondCycle = Math.max(0, s.second.cycle || DEFAULT_CYCLE[nc]);
  const perennialSummer = R.perennial.includes(sc);

  // --- Safra de verão
  const sHarvest = summerCycle > 0 ? addDaysToDate(summerSow, summerCycle) : summerSow;
  if (sc !== 'pousio' && !perennialSummer) f.push(windowFinding(sc, 'summer', summerSow, { crop: names(sc) }));
  if (perennialSummer) f.push({ key: 'perennial', sev: 0, kind: 'gap', params: { crop: names(sc) }, source: 'regra' });

  // --- Safrinha
  let second: Evaluation['second'] = null;
  if (perennialSummer) {
    if (nc !== 'pousio') f.push({ key: 'perennialConflict', sev: 2, kind: 'risk', params: { crop: names(sc) }, source: 'regra' });
  } else if (nc !== 'pousio') {
    const sow2 = addDaysToDate(sHarvest, R.turnaroundDays);
    const h2 = secondCycle > 0 ? addDaysToDate(sow2, secondCycle) : sow2;
    second = { crop: nc, sow: sow2, harvest: h2 };
    f.push(windowFinding(nc, 'second', sow2, { crop: names(nc) }));
    if (nc === 'trigo') f.push({ key: 'wheatAltitude', sev: R.riverVerdeAlt < R.wheatMinAlt ? 1 : 0, kind: 'gap', params: { alt: R.riverVerdeAlt, min: R.wheatMinAlt }, source: 'regra' });
    // folga até o próximo verão
    const next = addDaysToDate(summerSow, 365);
    const gap = diffDays(h2, next); // dias entre a colheita da safrinha e o próximo verão
    if (gap < R.minGapDays) f.push({ key: 'overlapNext', sev: 1, kind: 'risk', params: { days: Math.max(0, R.minGapDays - gap) }, source: 'regra' });
  } else if (!perennialSummer && sc !== 'pousio') {
    f.push({ key: 'noSecondIncome', sev: 0, kind: 'gap', params: {}, source: 'regra' });
  }

  // --- Rotação (verão→safrinha e safrinha→verão seguinte)
  const t1 = transition(sc, nc, names(sc), names(nc));
  if (t1) f.push(t1);
  const t2 = nc !== 'pousio' ? transition(nc, sc, names(nc), names(sc)) : transition(sc, sc, names(sc), names(sc));
  if (t2 && (!t1 || t2.key !== t1.key)) f.push(t2);

  // --- Conhecimento da região (Embrapa)
  const pair = `${sc}>${nc}`;
  if (pair === 'soja>milho') {
    f.push({ key: 'pairSojaMilhoBenefit', sev: 0, kind: 'benefit', params: {}, source: 'Embrapa' });
    f.push({ key: 'pairSojaMilhoRisk', sev: 1, kind: 'risk', params: {}, source: 'Embrapa' });
  } else if (pair === 'soja>sorgo') {
    f.push({ key: 'pairSojaSorgoRisk', sev: 1, kind: 'risk', params: {}, source: 'Embrapa' });
  } else if (pair === 'soja>cobertura') {
    f.push({ key: 'pairSojaCoverBenefit', sev: 0, kind: 'benefit', params: {}, source: 'Embrapa' });
    f.push({ key: 'pairSojaCoverRisk', sev: 1, kind: 'gap', params: {}, source: 'Embrapa' });
  }

  // --- Evidência por cultura
  const ev = (c: CropKey) => EVIDENCE[c];
  const evFindings = new Set<string>();
  [sc, nc].forEach((c) => {
    if (c === 'soja') evFindings.add('evModelSoja');
    else if (c === 'sorgo') evFindings.add('evModelSorgo');
    else if (ev(c) === 'trend') evFindings.add('fEvTrend:' + names(c));
    else if (ev(c) === 'rules') evFindings.add('fEvRules:' + names(c));
  });
  evFindings.forEach((k) => {
    const [key, crop] = k.split(':');
    f.push({ key, sev: 1, kind: 'gap', params: crop ? { crop } : {}, source: 'regra' });
  });

  // --- Clima recente do talhão (NASA POWER), comum à semeadura do verão
  if (nasa && !perennialSummer && sc !== 'pousio' && Math.abs(diffDays(summerSow, refIso)) <= 21) {
    f.push({ key: 'nasaSowing', sev: nasa.level === 'low' ? 0 : nasa.level === 'medium' ? 1 : 2, kind: nasa.level === 'low' ? 'benefit' : 'risk', params: { mm: nasa.rain15 }, source: 'NASA POWER' });
  }
  f.push({ key: 'noClimatology', sev: 0, kind: 'gap', params: {}, source: 'regra' });

  const score = f.reduce((a, x) => a + (x.kind === 'gap' ? 0 : x.sev), 0);
  const level = score >= R.score.high ? 'high' : score >= R.score.medium ? 'medium' : 'low';
  return {
    level, score, findings: f,
    summer: { crop: sc, sow: summerSow, harvest: sHarvest },
    second,
    yields: { summer: sc === 'pousio' ? null : yieldReference(talhao, sc), second: nc === 'pousio' ? null : yieldReference(talhao, nc) },
    evidence: { summer: ev(sc), second: ev(nc) },
  };
}

const slot = (crop: CropKey, cycle?: number): RotationSlot => ({ crop, cycle: cycle ?? DEFAULT_CYCLE[crop] });
const uid = () => 'rot_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

/** Estratégias iniciais: a atual do talhão + sugestões da Embrapa para a região (sem repetir a atual). */
export function defaultStrategies(talhao: Talhao): RotationStrategyData[] {
  const cur = asCropKey(talhao.crop);
  const nextKey = talhao.nextCropPlan?.crop ? asCropKey(talhao.nextCropPlan.crop) : null;
  const summer = cur === 'pousio' ? 'soja' : cur;
  const second: CropKey = nextKey && nextKey !== 'pousio' ? nextKey : summer === 'soja' ? 'milho' : 'pousio';
  const current: RotationStrategyData = {
    id: uid(), name: 'current', kind: 'current',
    summer: slot(summer, talhao.cycleDays && talhao.cycleDays > 0 && cur === summer ? talhao.cycleDays : undefined),
    second: slot(second),
  };
  const suggestions: RotationStrategyData[] = [
    { id: uid(), name: 'A', kind: 'suggested', summer: slot('soja', 105), second: slot('milho') },
    { id: uid(), name: 'B', kind: 'suggested', summer: slot('soja', 105), second: slot('sorgo') },
    { id: uid(), name: 'C', kind: 'suggested', summer: slot('soja', 105), second: slot('cobertura') },
  ];
  const same = (a: RotationStrategyData, b: RotationStrategyData) => a.summer.crop === b.summer.crop && a.second.crop === b.second.crop;
  const out = [current];
  for (const s of suggestions) if (!same(s, current) && out.length < 3) out.push(s);
  return out;
}

export function newCustomStrategy(index: number): RotationStrategyData {
  return { id: uid(), name: String(index), kind: 'custom', summer: slot('soja'), second: slot('pousio') };
}

/** Semeadura padrão do verão: a do talhão, se houver; senão 20/out do ano agrícola corrente ou do próximo. */
export function defaultSummerSow(talhao: Talhao, refIso: string): string {
  if (talhao.plantingDate && /^\d{4}-\d{2}-\d{2}$/.test(talhao.plantingDate) && asCropKey(talhao.crop) !== 'pousio' && asCropKey(talhao.crop) !== 'pasto') {
    return talhao.plantingDate;
  }
  const y = Number(refIso.slice(0, 4));
  const thisYear = `${y}-10-20`;
  return refIso <= thisYear ? thisYear : `${y + 1}-10-20`;
}
