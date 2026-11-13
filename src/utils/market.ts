/**
 * Camada de mercado do planejador de safra: preço, tendência, custo e margem estimada por cenário.
 *
 * Os valores de EXAMPLE_MARKET são ilustrativos e aparecem rotulados como "dados de exemplo".
 * Para usar dados reais, basta publicar o arquivo `data/mercado.json` (mesmo formato de MarketData,
 * com "example": false, "source" e "asOf"); o aplicativo o lê automaticamente.
 * O produtor também pode digitar o próprio preço e custo; isso fica salvo no navegador.
 */
import type { CropKey } from './rotation';

export interface CropMarket {
  /** Unidade de preço e produtividade: sc (saca de 60 kg), @ (arroba) ou t (tonelada). */
  unit: 'sc' | '@' | 't';
  /** Preço atual em R$ por unidade. */
  price: number;
  /** Variação do preço nos últimos 12 meses (%). */
  trend12m: number;
  /** Volatilidade usada nos cenários otimista e pessimista (%). */
  vol: number;
  /** Produtividade regional de referência (unidade/ha), usada quando o talhão não tem colheita registrada. */
  yieldRef: number;
  /** Custo de produção (R$/ha). */
  cost: number;
  /** Série de preços recente (opcional), para o minigráfico. */
  series?: number[];
  /** true quando os valores são ilustrativos; false quando vêm de uma fonte real. */
  example?: boolean;
  /** Fonte do preço (quando real). */
  source?: string;
  asOf?: string;
  /** Histórico de preços (R$/unidade), mensal ou semanal, para o gráfico do painel de mercado. */
  history?: Array<{ d: string; p: number }>;
  /** Curva de contratos futuros da bolsa, convertida para R$/unidade (contratos dos próximos ~14 meses). */
  futures?: Array<{ m: string; label: string; native: number; brl: number; symbol: string }>;
  /** Preço na unidade da bolsa (ex.: US¢/bu). */
  native?: { price: number; unit: string };
}

export interface MarketData {
  /** Dólar (R$ por US$): último valor e histórico mensal. */
  fx?: { last: number; asOf: string; history: Array<{ d: string; p: number }> };
  example: boolean;
  source: string;
  asOf: string;
  crops: Partial<Record<CropKey, CropMarket>>;
}

const mk = (unit: CropMarket['unit'], price: number, trend12m: number, vol: number, yieldRef: number, cost: number): CropMarket => {
  // série de exemplo determinística, terminando no preço atual
  const series: number[] = [];
  const start = price / (1 + trend12m / 100);
  for (let i = 0; i < 12; i++) {
    const k = i / 11;
    const wave = Math.sin(i * 1.7 + price) * (vol / 100) * 0.12;
    series.push(Math.round((start + (price - start) * k) * (1 + wave) * 100) / 100);
  }
  series[11] = price;
  return { unit, price, trend12m, vol, yieldRef, cost, series, example: true };
};

export const EXAMPLE_MARKET: MarketData = {
  example: true,
  source: 'exemplo',
  asOf: '2026-11-12',
  crops: {
    soja: mk('sc', 120, -8, 14, 62, 5000),
    milho: mk('sc', 55, 3, 18, 100, 3600),
    sorgo: mk('sc', 38, 1, 20, 70, 2200),
    feijao: mk('sc', 280, -5, 25, 38, 5200),
    algodao: mk('@', 150, -4, 16, 110, 11000),
    trigo: mk('sc', 75, 2, 15, 55, 3200),
    cana: mk('t', 140, 1, 10, 85, 9000),
    pasto: mk('@', 270, 6, 12, 8, 900),
    cobertura: { unit: 'sc', price: 0, trend12m: 0, vol: 0, yieldRef: 0, cost: 400 },
    pousio: { unit: 'sc', price: 0, trend12m: 0, vol: 0, yieldRef: 0, cost: 0 },
  },
};

const LS_KEY = 'myroca_market_overrides_v1';
type Overrides = Partial<Record<CropKey, { price?: number; cost?: number }>>;

let loaded: MarketData | null = null;
let loading: Promise<MarketData> | null = null;

/** Carrega `data/mercado.json` se existir e for válido; senão usa os dados de exemplo. */
export function loadMarket(): Promise<MarketData> {
  if (loaded) return Promise.resolve(loaded);
  if (!loading) {
    loading = fetch('./data/mercado.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const ok = j && typeof j === 'object' && j.crops && typeof j.crops === 'object' && j.crops.soja && typeof j.crops.soja.price === 'number';
        if (ok) {
          // por cultura: o que veio da fonte real substitui o exemplo; produtividade e custo continuam os do exemplo se faltarem
          const crops: MarketData['crops'] = { ...EXAMPLE_MARKET.crops };
          for (const [k, v] of Object.entries(j.crops as Record<string, Partial<CropMarket>>)) {
            const base = EXAMPLE_MARKET.crops[k as CropKey];
            if (base && v && typeof v.price === 'number') crops[k as CropKey] = { ...base, ...v, example: v.example === true };
          }
          loaded = { example: j.example === true, source: String(j.source || ''), asOf: String(j.asOf || ''), crops, fx: j.fx && typeof j.fx.last === 'number' ? j.fx : undefined };
        } else loaded = EXAMPLE_MARKET;
        return loaded;
      })
      .catch(() => (loaded = EXAMPLE_MARKET));
  }
  return loading;
}

export function currentMarket(): MarketData {
  return loaded || EXAMPLE_MARKET;
}

function readOverrides(): Overrides {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch { return {}; }
}
export function setOverride(crop: CropKey, field: 'price' | 'cost', value: number | null): void {
  const o = readOverrides();
  const cur = { ...(o[crop] || {}) };
  if (value === null || !isFinite(value) || value < 0) delete cur[field]; else cur[field] = value;
  if (Object.keys(cur).length) o[crop] = cur; else delete o[crop];
  try { localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch { /* sem armazenamento */ }
}
export function clearOverrides(): void {
  try { localStorage.removeItem(LS_KEY); } catch { /* sem armazenamento */ }
}
export function hasOverrides(): boolean {
  return Object.keys(readOverrides()).length > 0;
}

/** Dados de mercado de uma cultura com os valores digitados pelo produtor aplicados. */
export function cropMarket(crop: CropKey): { m: CropMarket; edited: { price: boolean; cost: boolean } } | null {
  const base = currentMarket().crops[crop];
  if (!base) return null;
  const o = readOverrides()[crop] || {};
  return {
    m: { ...base, price: o.price ?? base.price, cost: o.cost ?? base.cost },
    edited: { price: o.price !== undefined, cost: o.cost !== undefined },
  };
}

/**
 * Fator de preço esperado até daqui a `monthsAhead` meses, pela curva de contratos futuros da bolsa (limitado a ±15%).
 * Devolve null quando a cultura não tem curva (nesse caso usa-se a tendência de 12 meses).
 */
export function forwardFactor(crop: CropKey, monthsAhead: number): { factor: number; label: string } | null {
  const f = currentMarket().crops[crop]?.futures;
  if (!f || f.length < 2 || !isFinite(monthsAhead)) return null;
  const now = new Date();
  const idx = (m: string) => (Number(m.slice(0, 4)) - now.getFullYear()) * 12 + (Number(m.slice(5, 7)) - 1 - now.getMonth());
  const pts = f.map((x) => ({ k: idx(x.m), v: x.brl, label: x.label })).sort((a, b) => a.k - b.k);
  const t = Math.max(pts[0].k, Math.min(pts[pts.length - 1].k, monthsAhead));
  let lo = pts[0], hi = pts[pts.length - 1];
  for (let i = 0; i < pts.length - 1; i++) if (t >= pts[i].k && t <= pts[i + 1].k) { lo = pts[i]; hi = pts[i + 1]; break; }
  const v = hi.k === lo.k ? lo.v : lo.v + ((hi.v - lo.v) * (t - lo.k)) / (hi.k - lo.k);
  const factor = Math.max(0.85, Math.min(1.15, v / pts[0].v));
  return { factor, label: (Math.abs(hi.k - t) < Math.abs(lo.k - t) ? hi : lo).label };
}

export type Scenario = 'pess' | 'base' | 'opt';
export interface SlotMargin {
  crop: CropKey;
  yieldUsed: number;
  yieldFromHistory: boolean;
  unit: CropMarket['unit'];
  price: Record<Scenario, number>;
  revenue: Record<Scenario, number>;
  cost: number;
  margin: Record<Scenario, number>;
  /** Base do preço projetado: curva de futuros da bolsa ou tendência de 12 meses. */
  basis: 'futures' | 'trend';
  /** Variação do preço projetada até a colheita (%) e contrato usado. */
  driftPct: number;
  contract?: string;
}

export const RISK_YIELD_FACTOR = { low: 1, medium: 0.93, high: 0.85 } as const;
const YIELD_SCEN: Record<Scenario, number> = { pess: 0.85, base: 1, opt: 1.1 };

/**
 * Margem de uma cultura em uma safra.
 * Preço base = preço atual ajustado até a colheita (pela curva de futuros da bolsa, quando existe; senão, metade da tendência de 12 meses, limitada a ±10%) e pelo teste de estresse.
 * Produtividade = referência do talhão (se houver) ou regional, reduzida pelo risco agronômico/climático da estratégia.
 */
export function slotMargin(
  crop: CropKey,
  level: 'low' | 'medium' | 'high',
  talhaoYield: number | null,
  stressPct: number,
  seasons = 1,
  monthsAhead?: number
): SlotMargin | null {
  const cm = cropMarket(crop);
  if (!cm) return null;
  const { m } = cm;
  const y0 = talhaoYield !== null && talhaoYield > 0 ? talhaoYield : m.yieldRef;
  const rf = RISK_YIELD_FACTOR[level];
  // Com curva de futuros: o preço esperado na colheita segue a curva da bolsa. Sem curva: metade da tendência de 12 meses, limitada a ±10%.
  const fw = monthsAhead !== undefined ? forwardFactor(crop, monthsAhead) : null;
  const drift = fw ? (fw.factor - 1) * 100 : Math.max(-10, Math.min(10, m.trend12m / 2));
  const basePrice = m.price * (1 + drift / 100) * (1 + stressPct / 100);
  const price: Record<Scenario, number> = {
    pess: basePrice * (1 - m.vol / 100),
    base: basePrice,
    opt: basePrice * (1 + m.vol / 100),
  };
  const out: SlotMargin = {
    crop, yieldUsed: y0 * rf, yieldFromHistory: talhaoYield !== null && talhaoYield > 0, unit: m.unit,
    price, revenue: { pess: 0, base: 0, opt: 0 }, cost: m.cost * seasons, margin: { pess: 0, base: 0, opt: 0 },
    basis: fw ? 'futures' : 'trend', driftPct: drift, contract: fw?.label,
  };
  (['pess', 'base', 'opt'] as Scenario[]).forEach((s) => {
    out.revenue[s] = y0 * rf * YIELD_SCEN[s] * price[s] * seasons;
    out.margin[s] = out.revenue[s] - out.cost;
  });
  return out;
}

export interface StrategyMargin {
  slots: SlotMargin[];
  perHa: Record<Scenario, number>;
}

export function strategyMargin(slots: Array<SlotMargin | null>): StrategyMargin {
  const real = slots.filter((s): s is SlotMargin => !!s);
  const sum = (k: Scenario) => real.reduce((a, s) => a + s.margin[k], 0);
  return { slots: real, perHa: { pess: sum('pess'), base: sum('base'), opt: sum('opt') } };
}
