/**
 * Clima do momento para a tela da fazenda.
 * Ordem de prioridade:
 *   1) correção manual do produtor (vale por 12 horas);
 *   2) condição atual da Open-Meteo (gratuita, sem chave): temperatura, chuva, nuvens, umidade e vento;
 *   3) último dia com dado da NASA POWER do talhão (chuva e radiação solar);
 *   4) estimativa pela época do ano (estação chuvosa de outubro a março no Cerrado).
 */
import { scopedKey } from '../auth/auth';
import { NasaSeries } from './nasaPower';

export type Condition = 'clear' | 'partly' | 'cloudy' | 'rain' | 'storm';
export type WeatherSource = 'manual' | 'openmeteo' | 'nasa' | 'estimate';

export interface WeatherState {
  cond: Condition;
  intensity: 0 | 1 | 2 | 3;   // 0 sem chuva, 1 fraca, 2 moderada, 3 forte
  tempC: number | null;
  humidity: number | null;
  windKmh: number | null;
  rainMm: number | null;
  source: WeatherSource;
  at: number;                  // quando o dado foi obtido (ms)
  note?: string;               // ex.: data do último dado da NASA (DD/MM)
}

const OVERRIDE_KEY = 'myroca_weather_override_v1';
const CACHE_KEY = 'myroca_weather_cache_v1';
const OVERRIDE_TTL = 12 * 3600 * 1000;
const CACHE_TTL = 30 * 60 * 1000;

const read = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const write = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignora */
  }
};

const INTENSITY_BY_COND: Record<Condition, 0 | 1 | 2 | 3> = { clear: 0, partly: 0, cloudy: 0, rain: 2, storm: 3 };

// ---- Correção do produtor
export function getOverride(): WeatherState | null {
  const o = read<{ cond: Condition; at: number }>(scopedKey(OVERRIDE_KEY));
  if (!o || Date.now() - o.at > OVERRIDE_TTL) return null;
  return { cond: o.cond, intensity: INTENSITY_BY_COND[o.cond], tempC: null, humidity: null, windKmh: null, rainMm: null, source: 'manual', at: o.at };
}
export function setOverride(cond: Condition): void {
  write(scopedKey(OVERRIDE_KEY), { cond, at: Date.now() });
}
export function clearOverride(): void {
  try {
    localStorage.removeItem(scopedKey(OVERRIDE_KEY));
  } catch {
    /* ignora */
  }
}

// ---- Open-Meteo
function fromWmo(code: number, cloud: number | null, rainMm: number): { cond: Condition; intensity: 0 | 1 | 2 | 3 } {
  if (code >= 95) return { cond: 'storm', intensity: 3 };
  const wet = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || rainMm > 0.1;
  if (wet) {
    const heavy = code === 65 || code === 67 || code === 82 || rainMm >= 4;
    const light = code <= 57 || code === 61 || code === 80 || rainMm < 0.5;
    return { cond: 'rain', intensity: heavy ? 3 : light ? 1 : 2 };
  }
  if (code === 3 || code === 45 || code === 48 || (cloud !== null && cloud >= 70)) return { cond: 'cloudy', intensity: 0 };
  if (code === 2 || (cloud !== null && cloud >= 30)) return { cond: 'partly', intensity: 0 };
  return { cond: 'clear', intensity: 0 };
}

export async function fetchCurrentWeather(lat: number, lng: number): Promise<WeatherState | null> {
  const key = `${CACHE_KEY}_${lat.toFixed(2)}_${lng.toFixed(2)}`;
  const cached = read<WeatherState>(key);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,cloud_cover,wind_speed_10m&timezone=auto`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return cached || null;
    const j = await res.json();
    const c = j?.current;
    if (!c || typeof c.weather_code !== 'number') return cached || null;
    const rainMm = Number(c.precipitation) || 0;
    const w = fromWmo(c.weather_code, typeof c.cloud_cover === 'number' ? c.cloud_cover : null, rainMm);
    const state: WeatherState = {
      ...w,
      tempC: typeof c.temperature_2m === 'number' ? c.temperature_2m : null,
      humidity: typeof c.relative_humidity_2m === 'number' ? c.relative_humidity_2m : null,
      windKmh: typeof c.wind_speed_10m === 'number' ? c.wind_speed_10m : null,
      rainMm,
      source: 'openmeteo',
      at: Date.now(),
    };
    write(key, state);
    return state;
  } catch {
    return cached || null;
  } finally {
    clearTimeout(timer);
  }
}

// ---- NASA POWER (último dia com dado)
export function weatherFromNasa(series: NasaSeries | undefined): WeatherState | null {
  if (!series) return null;
  const d = [...series.days].reverse().find((x) => x.rain !== null || x.rad !== null);
  if (!d) return null;
  const rain = d.rain ?? 0;
  let cond: Condition;
  let intensity: 0 | 1 | 2 | 3 = 0;
  if (rain >= 20) { cond = 'storm'; intensity = 3; }
  else if (rain >= 1) { cond = 'rain'; intensity = rain >= 8 ? 3 : rain >= 3 ? 2 : 1; }
  else if (d.rad !== null && d.rad < 12) cond = 'cloudy';
  else if (d.rad !== null && d.rad < 19) cond = 'partly';
  else cond = 'clear';
  return {
    cond, intensity, tempC: d.tavg, humidity: null, windKmh: null, rainMm: d.rain,
    source: 'nasa', at: Date.now(), note: `${d.date.slice(8, 10)}/${d.date.slice(5, 7)}`,
  };
}

// ---- Estimativa pela época do ano (Cerrado: chuvas de outubro a março)
export function estimateWeather(refIso: string): WeatherState {
  const m = Number(refIso.slice(5, 7));
  const wet = m >= 10 || m <= 3;
  const dry = m >= 6 && m <= 8;
  return {
    cond: wet ? 'partly' : 'clear', intensity: 0,
    tempC: null, humidity: null, windKmh: null, rainMm: null,
    source: 'estimate', at: Date.now(),
    note: dry ? 'dry' : wet ? 'wet' : 'transition',
  };
}

/** Escolhe a melhor fonte disponível. */
export async function resolveWeather(lat: number, lng: number, nasa: NasaSeries | undefined, refIso: string): Promise<WeatherState> {
  const manual = getOverride();
  if (manual) return manual;
  const live = await fetchCurrentWeather(lat, lng);
  if (live) return live;
  return weatherFromNasa(nasa) || estimateWeather(refIso);
}
