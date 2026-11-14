/**
 * Risco hídrico por talhão: balanço dos últimos 30 dias (chuva − evapotranspiração de referência)
 * e umidade do solo estimada pelo ERA5-Land (via Open-Meteo, reanálise com assimilação de satélite).
 */
import { fetchNasaSeries } from './nasaPower';

export type WaterLevel = 'low' | 'medium' | 'high';
export interface WaterInfo {
  rain30: number; et0: number; balance: number;
  soil: number | null;       // m³/m³, média 0–100 cm
  rainNext3: number;
  level: WaterLevel;
  src: string;
  rainSrc: 'NASA POWER' | 'Open-Meteo';
}

const mem = new Map<string, Promise<WaterInfo | null>>();
const num = (v: any): number | null => (typeof v === 'number' && isFinite(v) ? v : null);
const sum = (a: Array<number | null>) => a.reduce<number>((s, v) => s + (v ?? 0), 0);

export function classifyWater(balance: number, soil: number | null): WaterLevel {
  const s = (soil === null ? 0 : soil < 0.2 ? 2 : soil < 0.28 ? 1 : 0) + (balance < -60 ? 2 : balance < -20 ? 1 : 0);
  return s >= 3 ? 'high' : s >= 1 ? 'medium' : 'low';
}

async function load(lat: number, lng: number): Promise<WaterInfo | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lng.toFixed(2)}&daily=precipitation_sum,et0_fao_evapotranspiration&hourly=soil_moisture_0_to_7cm,soil_moisture_7_to_28cm,soil_moisture_28_to_100cm&past_days=30&forecast_days=4&timezone=auto`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const j = await res.json();
    const times: string[] = j?.daily?.time || [];
    if (!times.length) return null;
    const today = new Date().toISOString().slice(0, 10);
    const past = times.map((d, i) => ({ d, i })).filter((x) => x.d <= today);
    const next = times.map((d, i) => ({ d, i })).filter((x) => x.d > today).slice(0, 3);
    const rain = (x: { i: number }) => num(j.daily.precipitation_sum?.[x.i]);
    const et = (x: { i: number }) => num(j.daily.et0_fao_evapotranspiration?.[x.i]);
    const rain30 = sum(past.map(rain)), et0 = sum(past.map(et));
    const h = j?.hourly; let soil: number | null = null;
    if (h?.time) {
      const nowIso = new Date().toISOString().slice(0, 13);
      for (let i = h.time.length - 1; i >= 0; i--) {
        if (h.time[i].slice(0, 13) > nowIso) continue;
        const a = [num(h.soil_moisture_0_to_7cm?.[i]), num(h.soil_moisture_7_to_28cm?.[i]), num(h.soil_moisture_28_to_100cm?.[i])].filter((v): v is number => v !== null);
        if (a.length) { soil = a.reduce((s, v) => s + v, 0) / a.length; break; }
      }
    }
    // Chuva de 30 dias: NASA POWER quando há dados suficientes; senão, Open-Meteo.
    let rainFinal = rain30, rainSrc: WaterInfo['rainSrc'] = 'Open-Meteo';
    try {
      const sr = await fetchNasaSeries(Math.round(lat * 10) / 10, Math.round(lng * 10) / 10, today, 30);
      const valid = sr.days.filter((d) => d.rain !== null);
      if (valid.length >= 24) { rainFinal = valid.reduce((a, d) => a + (d.rain as number), 0) * (30 / valid.length); rainSrc = 'NASA POWER'; }
    } catch { /* sem NASA POWER: fica a chuva do Open-Meteo */ }
    const balance = rainFinal - et0;
    return { rain30: rainFinal, et0, balance, soil, rainNext3: sum(next.map(rain)), level: classifyWater(balance, soil), src: 'Open-Meteo (ERA5-Land)', rainSrc };
  } catch { return null; } finally { clearTimeout(timer); }
}

/** Resultado em cache por quadrícula de 0,1° (talhões vizinhos repetem o pedido). */
export function waterForPoint(lat: number, lng: number): Promise<WaterInfo | null> {
  const k = `${lat.toFixed(1)}_${lng.toFixed(1)}`;
  let p = mem.get(k);
  if (!p) { p = load(lat, lng); mem.set(k, p); void p.then((r) => { if (!r) mem.delete(k); }); }
  return p;
}

export const worse = (a: WaterLevel, b: WaterLevel): WaterLevel => (['low', 'medium', 'high'] as const)[Math.max(['low', 'medium', 'high'].indexOf(a), ['low', 'medium', 'high'].indexOf(b))];
