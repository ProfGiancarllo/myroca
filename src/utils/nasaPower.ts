/**
 * Cliente da API NASA POWER (série diária, ponto).
 * Documentação: https://power.larc.nasa.gov/docs/services/api/temporal/daily/
 * Parâmetros (comunidade AG):
 *   PRECTOTCORR       precipitação corrigida (mm/dia)
 *   T2M, T2M_MAX, T2M_MIN  temperatura do ar a 2 m (°C)
 *   ALLSKY_SFC_SW_DWN radiação solar incidente na superfície, céu real (MJ/m²/dia)
 * Valor de preenchimento da API para dado ausente: -999.
 */

export interface NasaDay {
  date: string; // YYYY-MM-DD
  rain: number | null;
  tavg: number | null;
  tmax: number | null;
  tmin: number | null;
  rad: number | null;
}

export interface NasaSeries {
  lat: number;
  lng: number;
  start: string;
  end: string;
  days: NasaDay[];
  fetchedAt: number;
}

export interface NasaSummary {
  daysWithData: number;
  rainTotal: number;
  rainLast7: number;
  dryDays: number;
  tavg: number | null;
  tmaxPeak: number | null;
  tminLow: number | null;
  radAvg: number | null;
}

const BASE = 'https://power.larc.nasa.gov/api/temporal/daily/point';
const PARAMS = 'PRECTOTCORR,T2M,T2M_MAX,T2M_MIN,ALLSKY_SFC_SW_DWN';
const CACHE_PREFIX = 'myroca_nasa_v1_';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const isoToCompact = (iso: string) => iso.replace(/-/g, '');
const compactToIso = (c: string) => `${c.slice(0, 4)}-${c.slice(4, 6)}-${c.slice(6, 8)}`;

export function addDaysIso(iso: string, delta: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Centroide simples de um polígono [lat, lng][]. */
export function polygonCentroid(coords: [number, number][]): { lat: number; lng: number } {
  const n = coords.length || 1;
  return {
    lat: coords.reduce((s, c) => s + c[0], 0) / n,
    lng: coords.reduce((s, c) => s + c[1], 0) / n,
  };
}

function clean(v: unknown): number | null {
  return typeof v === 'number' && isFinite(v) && v > -900 ? v : null;
}

/** Converte a resposta JSON da API em série diária. */
export function parseNasaResponse(json: any, lat: number, lng: number, start: string, end: string): NasaSeries {
  const p = json?.properties?.parameter;
  if (!p || !p.PRECTOTCORR) throw new Error('Resposta inesperada da NASA POWER');
  const dates = Object.keys(p.PRECTOTCORR).sort();
  const days: NasaDay[] = dates.map((c) => ({
    date: compactToIso(c),
    rain: clean(p.PRECTOTCORR?.[c]),
    tavg: clean(p.T2M?.[c]),
    tmax: clean(p.T2M_MAX?.[c]),
    tmin: clean(p.T2M_MIN?.[c]),
    rad: clean(p.ALLSKY_SFC_SW_DWN?.[c]),
  }));
  return { lat, lng, start, end, days, fetchedAt: Date.now() };
}

export function summarizeNasa(series: NasaSeries): NasaSummary {
  const withRain = series.days.filter((d) => d.rain !== null);
  const last7 = withRain.slice(-7);
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const tmax = series.days.map((d) => d.tmax).filter((x): x is number => x !== null);
  const tmin = series.days.map((d) => d.tmin).filter((x): x is number => x !== null);
  return {
    daysWithData: withRain.length,
    rainTotal: withRain.reduce((s, d) => s + (d.rain as number), 0),
    rainLast7: last7.reduce((s, d) => s + (d.rain as number), 0),
    dryDays: withRain.filter((d) => (d.rain as number) < 1).length,
    tavg: avg(series.days.map((d) => d.tavg)),
    tmaxPeak: tmax.length ? Math.max(...tmax) : null,
    tminLow: tmin.length ? Math.min(...tmin) : null,
    radAvg: avg(series.days.map((d) => d.rad)),
  };
}

function cacheKey(lat: number, lng: number, start: string, end: string): string {
  // a grade da NASA é de 0,5°: arredondar evita pedidos repetidos para a mesma célula
  return `${CACHE_PREFIX}${lat.toFixed(2)}_${lng.toFixed(2)}_${start}_${end}`;
}

export function readNasaCache(lat: number, lng: number, start: string, end: string): NasaSeries | null {
  try {
    const raw = localStorage.getItem(cacheKey(lat, lng, start, end));
    if (!raw) return null;
    const s = JSON.parse(raw) as NasaSeries;
    return Date.now() - s.fetchedAt < CACHE_TTL_MS ? s : null;
  } catch {
    return null;
  }
}

function writeNasaCache(s: NasaSeries): void {
  try {
    localStorage.setItem(cacheKey(s.lat, s.lng, s.start, s.end), JSON.stringify(s));
  } catch {
    /* sem armazenamento: segue sem cache */
  }
}

/**
 * Busca (ou lê do cache) a série diária dos últimos `windowDays` dias terminando em `endIso`.
 * O fim é limitado a ontem (a NASA publica com alguns dias de atraso; dias sem dado vêm como -999).
 */
export async function fetchNasaSeries(
  lat: number,
  lng: number,
  endIso: string,
  windowDays = 30,
  force = false
): Promise<NasaSeries> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const end = endIso > todayIso ? addDaysIso(todayIso, -1) : endIso;
  const start = addDaysIso(end, -(windowDays - 1));
  if (!force) {
    const cached = readNasaCache(lat, lng, start, end);
    if (cached) return cached;
  }
  const url =
    `${BASE}?parameters=${PARAMS}&community=AG&longitude=${lng.toFixed(4)}&latitude=${lat.toFixed(4)}` +
    `&start=${isoToCompact(start)}&end=${isoToCompact(end)}&format=JSON`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`NASA POWER HTTP ${res.status}`);
    const series = parseNasaResponse(await res.json(), lat, lng, start, end);
    writeNasaCache(series);
    return series;
  } finally {
    clearTimeout(timer);
  }
}
