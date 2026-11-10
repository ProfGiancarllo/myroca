/**
 * Regras agronômicas do Eng. Tiago (motor determinístico, sem IA generativa).
 *
 * Todos os limiares ficam em RULES para que o agrônomo da equipe possa ajustá-los
 * sem mexer na lógica. Valores iniciais para soja no Cerrado (Rio Verde-GO).
 * Base de dados: série diária da NASA POWER (chuva, temperatura) dos dias recentes.
 * A série é histórica: mede a umidade e o calor que o talhão acabou de ter, não prevê o tempo.
 */
import { NasaSeries } from './nasaPower';
import { DiaryEntry } from '../types';

export const RULES = {
  /** Janela de semeadura da soja no Cerrado (mês*100+dia). */
  sowingWindow: {
    idealStart: 1001, // 1/out
    idealEnd: 1130,   // 30/nov
    toleratedStart: 920, // 20/set
    toleratedEnd: 1215,  // 15/dez
  },
  /** Chuva acumulada nos últimos 15 dias (mm) como indicador de umidade do solo. */
  rain15: { good: 60, minimum: 30 },
  /** Sequência de dias secos (< dryDayMm) até o último dia com dado. */
  dryDayMm: 1,
  dryStreak: { attention: 6, bad: 10 },
  /** Temperatura média dos últimos 7 dias (°C). */
  temp7: { idealMin: 20, idealMax: 30, tolMin: 18, tolMax: 32 },
  /** Alertas da lavoura em fases sensíveis (floração e enchimento de grãos). */
  crop: { rain10Min: 20, tmaxHeat: 35 },
  /** Pontuação total: >= high → alto; >= medium → moderado. */
  score: { medium: 2, high: 4 },
} as const;

export type RiskLevel = 'low' | 'medium' | 'high';
export type Severity = 0 | 1 | 2; // 0 ok, 1 atenção, 2 ruim

export interface RiskFactor {
  key: string; // chave de tradução (sem parâmetros embutidos)
  severity: Severity;
  params: Record<string, string | number>;
}

export interface PlantingAssessment {
  level: RiskLevel;
  score: number;
  factors: RiskFactor[];
  rain15: number;
  irrigation15: number;
}

export interface CropAlert {
  key: string;
  params: Record<string, string | number>;
}

function mmdd(iso: string): number {
  return Number(iso.slice(5, 7)) * 100 + Number(iso.slice(8, 10));
}

function lastDays<T extends { date: string }>(days: T[], n: number): T[] {
  return days.slice(-n);
}

/** Dias com dado de chuva, na ordem cronológica. */
function withRain(series: NasaSeries) {
  return series.days.filter((d) => d.rain !== null);
}

export function sumIrrigation(diary: DiaryEntry[] | undefined, endIso: string, days: number): number {
  if (!diary) return 0;
  const end = new Date(endIso + 'T12:00:00Z').getTime();
  return diary
    .filter((e) => e.type === 'irrigacao' && typeof e.amount === 'number')
    .filter((e) => {
      const diff = (end - new Date(e.date + 'T12:00:00Z').getTime()) / 86400000;
      return diff >= 0 && diff < days;
    })
    .reduce((s, e) => s + (e.amount as number), 0);
}

/** Risco de semear nos próximos 7 dias, com base nas condições recentes do talhão. */
export function assessPlanting(
  series: NasaSeries,
  refIso: string,
  diary?: DiaryEntry[],
  inCycle = false
): PlantingAssessment {
  const factors: RiskFactor[] = [];
  const rained = withRain(series);

  // 1) Janela de semeadura (data de referência + 3 dias, meio da semana); não se aplica a lavoura já plantada
  const mid = mmdd(new Date(new Date(refIso + 'T12:00:00Z').getTime() + 3 * 86400000).toISOString().slice(0, 10));
  const w = RULES.sowingWindow;
  if (inCycle) {
    /* talhão já plantado: sem avaliação de janela */
  } else if (mid >= w.idealStart && mid <= w.idealEnd) {
    factors.push({ key: 'agWindowOk', severity: 0, params: {} });
  } else if (mid >= w.toleratedStart && mid <= w.toleratedEnd) {
    factors.push({ key: mid < w.idealStart ? 'agWindowEarly' : 'agWindowLate', severity: 1, params: {} });
  } else {
    factors.push({ key: 'agWindowOut', severity: 2, params: {} });
  }

  // 2) Umidade: chuva em 15 dias + irrigação registrada no diário
  const rain15 = lastDays(rained, 15).reduce((s, d) => s + (d.rain as number), 0);
  const irrigation15 = sumIrrigation(diary, refIso, 15);
  const water = rain15 + irrigation15;
  if (water >= RULES.rain15.good) factors.push({ key: 'agRainGood', severity: 0, params: { mm: Math.round(water) } });
  else if (water >= RULES.rain15.minimum) factors.push({ key: 'agRainMid', severity: 1, params: { mm: Math.round(water) } });
  else factors.push({ key: 'agRainLow', severity: 2, params: { mm: Math.round(water) } });

  // 3) Sequência de dias secos até o último dia com dado
  let streak = 0;
  for (let i = rained.length - 1; i >= 0; i--) {
    if ((rained[i].rain as number) < RULES.dryDayMm) streak++;
    else break;
  }
  if (streak >= RULES.dryStreak.bad) factors.push({ key: 'agDryBad', severity: 2, params: { days: streak } });
  else if (streak >= RULES.dryStreak.attention) factors.push({ key: 'agDryMid', severity: 1, params: { days: streak } });
  else factors.push({ key: 'agDryOk', severity: 0, params: { days: streak } });

  // 4) Temperatura média dos últimos 7 dias
  const temps = lastDays(series.days.filter((d) => d.tavg !== null), 7).map((d) => d.tavg as number);
  if (temps.length > 0) {
    const t = temps.reduce((a, b) => a + b, 0) / temps.length;
    const T = RULES.temp7;
    const key = t >= T.idealMin && t <= T.idealMax ? 'agTempOk' : t < T.tolMin ? 'agTempCold' : t > T.tolMax ? 'agTempHot' : 'agTempEdge';
    const sev: Severity = key === 'agTempOk' ? 0 : key === 'agTempEdge' ? 1 : 2;
    factors.push({ key, severity: sev, params: { t: t.toFixed(1) } });
  }

  const score = factors.reduce((s, f) => s + f.severity, 0);
  const level: RiskLevel = score >= RULES.score.high ? 'high' : score >= RULES.score.medium ? 'medium' : 'low';
  return { level, score, factors, rain15: Math.round(rain15), irrigation15: Math.round(irrigation15) };
}

/** Alertas da lavoura em andamento, conforme a fase da cultura. */
export function assessCrop(series: NasaSeries, phaseKey: string, diary?: DiaryEntry[], refIso?: string): CropAlert[] {
  const alerts: CropAlert[] = [];
  const sensitive = phaseKey === 'floracao' || phaseKey === 'enchimento';
  if (!sensitive) return alerts;
  const rained = withRain(series);
  const rain10 = lastDays(rained, 10).reduce((s, d) => s + (d.rain as number), 0);
  const irrig10 = refIso ? sumIrrigation(diary, refIso, 10) : 0;
  const water = rain10 + irrig10;
  if (rained.length > 0 && water < RULES.crop.rain10Min) {
    alerts.push({ key: 'agCropWater', params: { mm: Math.round(water) } });
  }
  const tmaxes = lastDays(series.days.filter((d) => d.tmax !== null), 7).map((d) => d.tmax as number);
  if (tmaxes.length > 0 && Math.max(...tmaxes) >= RULES.crop.tmaxHeat) {
    alerts.push({ key: 'agCropHeat', params: { t: Math.max(...tmaxes).toFixed(1) } });
  }
  return alerts;
}
