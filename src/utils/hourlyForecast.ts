/**
 * Previsão por hora da fazenda (Open-Meteo, horário local da fazenda): agora, próximas 48 h e dados do dia.
 * Também calcula a janela de pulverização a partir da previsão (regras de boa prática de aplicação).
 */
import { Condition, fromWmo } from './weather';

export interface HourPoint {
  time: string;          // 'AAAA-MM-DDTHH:00' no fuso da fazenda
  temp: number;
  pop: number | null;    // chance de chuva (%)
  cond: Condition;
  isDay: boolean;
  wind: number | null;   // km/h
  hum: number | null;    // %
  precip: number | null; // mm
}

export interface DayPoint { date: string; tmax: number | null; tmin: number | null; sunrise: string | null; sunset: string | null }

export interface FarmForecast {
  at: number;            // quando foi obtida (ms)
  now: { time: string; pop: number | null; temp: number | null; feels: number | null; hum: number | null; wind: number | null; precip: number | null; cond: Condition; isDay: boolean };
  hours: HourPoint[];    // a partir da hora seguinte a "agora", até 48 h
  days: DayPoint[];
}

const CACHE = 'myroca_hourly_cache_v1';
const TTL = 30 * 60 * 1000;
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export async function fetchFarmForecast(lat: number, lng: number): Promise<FarmForecast | null> {
  const key = `${CACHE}_${lat.toFixed(2)}_${lng.toFixed(2)}`;
  let cached: FarmForecast | null = null;
  try { cached = JSON.parse(localStorage.getItem(key) || 'null'); } catch { cached = null; }
  if (cached && Date.now() - cached.at < TTL) return cached;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,is_day` +
    `&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,cloud_cover,is_day,wind_speed_10m,relative_humidity_2m` +
    `&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&forecast_days=3&timezone=auto`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return cached;
    const j = await res.json();
    const c = j?.current, h = j?.hourly, d = j?.daily;
    if (!c || !h || !Array.isArray(h.time)) return cached;
    const nowHour = String(c.time).slice(0, 13);
    const hours: HourPoint[] = [];
    let nowPop: number | null = null;
    for (let i = 0; i < h.time.length && hours.length < 48; i++) {
      const t = String(h.time[i]);
      if (t.slice(0, 13) === nowHour) nowPop = num(h.precipitation_probability?.[i]);
      if (t.slice(0, 13) <= nowHour) continue;
      const temp = num(h.temperature_2m[i]);
      if (temp === null) continue;
      hours.push({
        time: t, temp,
        pop: num(h.precipitation_probability?.[i]),
        cond: fromWmo(Number(h.weather_code[i]) || 0, num(h.cloud_cover?.[i]), num(h.precipitation?.[i]) || 0).cond,
        isDay: h.is_day?.[i] !== 0,
        wind: num(h.wind_speed_10m?.[i]), hum: num(h.relative_humidity_2m?.[i]), precip: num(h.precipitation?.[i]),
      });
    }
    const days: DayPoint[] = (d?.time || []).map((date: string, i: number) => ({
      date, tmax: num(d.temperature_2m_max?.[i]), tmin: num(d.temperature_2m_min?.[i]),
      sunrise: d.sunrise?.[i] ? String(d.sunrise[i]) : null, sunset: d.sunset?.[i] ? String(d.sunset[i]) : null,
    }));
    const out: FarmForecast = {
      at: Date.now(),
      now: {
        time: String(c.time), pop: nowPop, temp: num(c.temperature_2m), feels: num(c.apparent_temperature), hum: num(c.relative_humidity_2m),
        wind: num(c.wind_speed_10m), precip: num(c.precipitation),
        cond: fromWmo(Number(c.weather_code) || 0, num(c.cloud_cover), num(c.precipitation) || 0).cond, isDay: c.is_day !== 0,
      },
      hours, days,
    };
    try { localStorage.setItem(key, JSON.stringify(out)); } catch { /* ignora */ }
    return out;
  } catch {
    return cached;
  } finally {
    clearTimeout(timer);
  }
}

/** Condição boa para aplicar defensivo numa hora: pouca chance de chuva, vento entre 3 e 10 km/h, abaixo de 30 °C e umidade a partir de 55%. */
export function goodSprayHour(p: HourPoint): boolean {
  return (p.pop ?? 100) < 30 && (p.precip ?? 0) < 0.1 && p.wind !== null && p.wind >= 3 && p.wind <= 10 && p.temp < 30 && (p.hum ?? 0) >= 55;
}

/** Primeira janela de pelo menos 2 horas seguidas boas para pulverizar nas próximas 24 h. */
export function sprayWindow(hours: HourPoint[]): { start: string; end: string } | null {
  const list = hours.slice(0, 24);
  for (let i = 0; i < list.length; i++) {
    if (!goodSprayHour(list[i])) continue;
    let j = i;
    while (j + 1 < list.length && goodSprayHour(list[j + 1])) j++;
    if (j - i + 1 >= 2) return { start: list[i].time, end: list[j].time };
    i = j;
  }
  return null;
}
