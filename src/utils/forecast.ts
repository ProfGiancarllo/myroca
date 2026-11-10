/**
 * Previsão de produtividade x resultado (aprendizado).
 *
 * Fonte da previsão, por ordem:
 *  1) modelo do MyRoça (serviço externo, configurado em VITE_FORECAST_URL);
 *  2) linha de base: média das safras anteriores da mesma cultura no talhão
 *     (histórico de safras + colheitas registradas no diário).
 * Cada colheita registrada no diário é comparada com a previsão que existia antes dela
 * e passa a fazer parte da média seguinte (recalibração).
 */
import { Talhao, DiaryEntry } from '../types';
import { NasaSummary } from './nasaPower';

export interface YieldPoint {
  date: string;      // YYYY-MM-DD (aproximada no histórico)
  crop: string;
  value: number;     // sc/ha
  fromDiary: boolean;
  diaryId?: string;
}

export interface ResultComparison {
  point: YieldPoint;
  forecastBefore: number | null; // previsão (média das safras anteriores) vigente antes desta colheita
  errorPct: number | null;       // (real - previsão) / previsão * 100
  baselineAfter: number;         // média incluindo esta colheita
}

export interface ForecastInfo {
  value: number | null;          // sc/ha
  source: 'model' | 'baseline' | 'none';
  basedOn: number;               // nº de safras usadas na linha de base
  totalSacks: number | null;
}

const MONTHS: Record<string, string> = {
  janeiro: '01', fevereiro: '02', 'março': '03', marco: '03', abril: '04', maio: '05', junho: '06',
  julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12',
};

/** '72 sc/ha' → 72; '3,2 UA/ha' → null (só sacas por hectare entram). */
export function parseSacksPerHa(text?: string): number | null {
  if (!text) return null;
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*sc\s*\/\s*ha/i);
  if (!m) return null;
  const v = Number(m[1].replace(',', '.'));
  return isFinite(v) && v > 0 ? v : null;
}

/** 'Fevereiro de 2026' → '2026-02-15'; '2026-02-10' fica igual. */
function approxDate(text: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const m = text.toLowerCase().match(/([a-zçã]+)\s+de\s+(\d{4})/);
  if (m && MONTHS[m[1]]) return `${m[2]}-${MONTHS[m[1]]}-15`;
  const y = text.match(/(\d{4})/);
  return y ? `${y[1]}-06-15` : '1970-01-01';
}

/** Família da cultura, independente do idioma (os itens de exemplo têm nomes traduzidos). */
const CROP_FAMILIES: [string, string[]][] = [
  ['soja', ['soja', 'soy', '大豆']],
  ['milho', ['milho', 'corn', 'maíz', 'maiz', 'mais', 'maïs', '玉米']],
  ['feijao', ['feijão', 'feijao', 'bean', 'frijol', 'haricot', '菜豆']],
  ['sorgo', ['sorgo', 'sorghum', 'sorgho', '高粱']],
  ['algodao', ['algodão', 'algodao', 'cotton', 'algodón', 'coton', 'baumwolle', '棉花']],
  ['trigo', ['trigo', 'wheat', 'weizen', 'blé', '小麦']],
];
const cropKey = (c?: string): string => {
  const n = (c || '').trim().toLowerCase();
  for (const [family, words] of CROP_FAMILIES) {
    if (words.some((w) => n.includes(w))) return family;
  }
  return n.split(/\s+/)[0] || '';
};

/** Colheitas conhecidas da mesma cultura, em ordem cronológica. */
export function yieldSeries(talhao: Talhao): YieldPoint[] {
  const key = cropKey(talhao.crop);
  const out: YieldPoint[] = [];
  (talhao.harvestHistory || []).forEach((h) => {
    const v = parseSacksPerHa(h.yieldText);
    if (v !== null && cropKey(h.crop) === key) {
      out.push({ date: approxDate(h.harvestDate), crop: h.crop, value: v, fromDiary: false });
    }
  });
  (talhao.diary || []).forEach((e: DiaryEntry) => {
    if (e.type === 'colheita' && typeof e.amount === 'number' && e.amount > 0) {
      out.push({ date: e.date, crop: talhao.crop || '', value: e.amount, fromDiary: true, diaryId: e.id });
    }
  });
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Compara cada colheita do diário com a média das safras anteriores. */
export function compareResults(talhao: Talhao): ResultComparison[] {
  const series = yieldSeries(talhao);
  const out: ResultComparison[] = [];
  series.forEach((p, i) => {
    if (!p.fromDiary) return;
    const before = series.slice(0, i).map((x) => x.value);
    const forecastBefore = before.length ? mean(before) : null;
    out.push({
      point: p,
      forecastBefore,
      errorPct: forecastBefore ? ((p.value - forecastBefore) / forecastBefore) * 100 : null,
      baselineAfter: mean(series.slice(0, i + 1).map((x) => x.value)),
    });
  });
  return out;
}

/** Previsão vigente para a próxima colheita do talhão. */
export function currentForecast(talhao: Talhao, modelValue?: number | null): ForecastInfo {
  const series = yieldSeries(talhao);
  const base = series.length ? mean(series.map((x) => x.value)) : null;
  const value = modelValue ?? base;
  const source: ForecastInfo['source'] = modelValue != null ? 'model' : base !== null ? 'baseline' : 'none';
  return {
    value,
    source,
    basedOn: series.length,
    totalSacks: value !== null ? value * talhao.areaHectares : null,
  };
}

/**
 * Consulta o serviço de modelo (se configurado). Contrato:
 *  POST VITE_FORECAST_URL  { talhao_id, crop, cultivar, planting_date, area_ha, nasa: {...}, yields_sc_ha: [...] }
 *  → { sc_ha: number }
 */
export async function fetchModelForecast(talhao: Talhao, nasa: NasaSummary): Promise<number | null> {
  const url = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_FORECAST_URL;
  if (!url) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        talhao_id: talhao.id,
        crop: talhao.crop,
        cultivar: talhao.cultivar,
        planting_date: talhao.plantingDate,
        area_ha: talhao.areaHectares,
        nasa,
        yields_sc_ha: yieldSeries(talhao).map((p) => p.value),
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return typeof j?.sc_ha === 'number' && isFinite(j.sc_ha) ? j.sc_ha : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
