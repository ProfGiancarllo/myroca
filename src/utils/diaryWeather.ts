/**
 * Clima do dia para o diário de safra.
 * 1) NASA POWER (série diária, com alguns dias de atraso);
 * 2) Open-Meteo (dias recentes que a NASA ainda não publicou; também cobre falhas da NASA).
 * Os pontos são arredondados para 0,1° (~11 km) para repetir pedidos entre talhões vizinhos.
 */
import { DiaryWeather } from '../types';
import { addDaysIso, fetchNasaSeries } from './nasaPower';

type Day = { rain: number | null; tmax: number | null; tmin: number | null };
const mem = new Map<string, Record<string, DiaryWeather>>();

const num = (v: any): number | null => (typeof v === 'number' && isFinite(v) && v > -900 ? v : null);
const gridKey = (lat: number, lng: number) => `${lat.toFixed(1)}_${lng.toFixed(1)}`;
const diffDaysIso = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);

async function openMeteoDays(lat: number, lng: number, start: string, end: string): Promise<Record<string, Day>> {
  const today = new Date().toISOString().slice(0, 10);
  const recent = diffDaysIso(start, today) <= 90;
  const base = recent ? 'https://api.open-meteo.com/v1/forecast' : 'https://archive-api.open-meteo.com/v1/archive';
  const url = recent
    ? `${base}?latitude=${lat.toFixed(2)}&longitude=${lng.toFixed(2)}&daily=precipitation_sum,temperature_2m_max,temperature_2m_min&timezone=auto&past_days=${Math.min(92, diffDaysIso(start, today) + 1)}&forecast_days=1`
    : `${base}?latitude=${lat.toFixed(2)}&longitude=${lng.toFixed(2)}&start_date=${start}&end_date=${end}&daily=precipitation_sum,temperature_2m_max,temperature_2m_min&timezone=auto`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return {};
    const j = await res.json();
    const d = j?.daily;
    const out: Record<string, Day> = {};
    (d?.time || []).forEach((t: string, i: number) => {
      out[t] = { rain: num(d.precipitation_sum?.[i]), tmax: num(d.temperature_2m_max?.[i]), tmin: num(d.temperature_2m_min?.[i]) };
    });
    return out;
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

/** Clima de cada data pedida (as que não tiverem dado em nenhuma fonte ficam de fora). */
export async function weatherForDates(lat: number, lng: number, dates: string[]): Promise<Record<string, DiaryWeather>> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const wanted = Array.from(new Set(dates.filter((d) => d <= todayIso))).sort();
  if (!wanted.length) return {};
  const gk = gridKey(lat, lng);
  const have = mem.get(gk) || {};
  const missing = wanted.filter((d) => !have[d]);
  if (missing.length) {
    const start = missing[0];
    const end = missing[missing.length - 1];
    const span = Math.min(400, diffDaysIso(start, end) + 1);
    const got: Record<string, DiaryWeather> = {};
    try {
      const s = await fetchNasaSeries(Math.round(lat * 10) / 10, Math.round(lng * 10) / 10, end, span);
      s.days.forEach((x) => {
        if (x.rain !== null || x.tmax !== null) got[x.date] = { rain: x.rain, tmax: x.tmax, tmin: x.tmin, src: 'NASA POWER' };
      });
    } catch { /* sem NASA: tenta a segunda fonte */ }
    const still = missing.filter((d) => !got[d] || got[d].rain === null);
    if (still.length) {
      const om = await openMeteoDays(lat, lng, still[0], still[still.length - 1]);
      still.forEach((d) => {
        const o = om[d];
        if (!o || (o.rain === null && o.tmax === null)) return;
        const g = got[d];
        got[d] = { rain: g?.rain ?? o.rain, tmax: g?.tmax ?? o.tmax, tmin: g?.tmin ?? o.tmin, src: g ? 'NASA POWER + Open-Meteo' : 'Open-Meteo' };
      });
    }
    mem.set(gk, { ...have, ...got });
  }
  const all = mem.get(gk) || {};
  const out: Record<string, DiaryWeather> = {};
  wanted.forEach((d) => { if (all[d]) out[d] = all[d]; });
  return out;
}

export { addDaysIso };
