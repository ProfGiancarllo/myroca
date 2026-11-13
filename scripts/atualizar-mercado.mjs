// Baixa dados econômicos e grava public/data/mercado.json (roda no workflow de publicação, antes do build).
//  1) FRED (Banco Mundial/FMI): preço internacional mensal das commodities e dólar diário. Usa a chave FRED_API_KEY quando existe
//     (API oficial) e, sem chave ou se a API falhar, o CSV aberto.
//  2) Bolsas (CBOT/ICE via Yahoo Finance): contrato mais próximo (preço do dia), histórico semanal de 2 anos e a curva de
//     contratos futuros dos próximos ~14 meses, convertidos para R$ por unidade do app (paridade de exportação, sem prêmio/base local).
// Se algo falhar, a parte correspondente é ignorada e o app mantém os valores de exemplo.
import { mkdirSync, writeFileSync } from 'node:fs';

const KEY = process.env.FRED_API_KEY || '';
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; myroca-build)' };
const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 4).toISOString().slice(0, 10);
const round = (v, n = 2) => Math.round(v * 10 ** n) / 10 ** n;
const ym = (d) => d.slice(0, 7);

// Conversões para a unidade do app (sc = saca de 60 kg, @ = arroba de 15 kg)
const BU_PER_SC = { soja: 60 / 27.2155, milho: 60 / 25.4012, trigo: 60 / 27.2155 };
const toSc = (crop) => (centsPerBu, fx) => (centsPerBu / 100) * BU_PER_SC[crop] * fx;
const lbToArroba = (centsPerLb, fx) => (centsPerLb / 100) * 2.20462 * 15 * fx;

/** Cultura -> série FRED mensal (USD) + contrato futuro de referência. */
const CROPS = {
  soja:    { fred: 'PSOYBUSDM',    unit: 'sc', fredToUnit: (v, fx) => v * 0.06 * fx, fut: { root: 'ZS', ex: 'CBT', exName: 'CBOT', months: 'FHKNQUX', toUnit: toSc('soja'),  native: 'US¢/bu' } },
  milho:   { fred: 'PMAIZMTUSDM',  unit: 'sc', fredToUnit: (v, fx) => v * 0.06 * fx, fut: { root: 'ZC', ex: 'CBT', exName: 'CBOT', months: 'HKNUZ',   toUnit: toSc('milho'), native: 'US¢/bu' } },
  trigo:   { fred: 'PWHEAMTUSDM',  unit: 'sc', fredToUnit: (v, fx) => v * 0.06 * fx, fut: { root: 'ZW', ex: 'CBT', exName: 'CBOT', months: 'HKNUZ',   toUnit: toSc('trigo'), native: 'US¢/bu' } },
  algodao: { fred: 'PCOTTINDUSDM', unit: '@',  fredToUnit: lbToArroba,               fut: { root: 'CT', ex: 'NYB', exName: 'ICE',  months: 'HKNVZ',   toUnit: lbToArroba,    native: 'US¢/lb' } },
  sorgo:   { fred: 'PSORGUSDM',    unit: 'sc', fredToUnit: (v, fx) => v * 0.06 * fx },
};
const CODE = { F: 1, G: 2, H: 3, J: 4, K: 5, M: 6, N: 7, Q: 8, U: 9, V: 10, X: 11, Z: 12 };
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

async function getJson(url) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** Série FRED como [[data, valor]]. */
async function fred(id) {
  if (KEY) {
    try {
      const j = await getJson(`https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${KEY}&file_type=json&observation_start=${since}`);
      const rows = (j.observations || []).map((o) => [o.date, Number(o.value)]).filter(([, v]) => Number.isFinite(v) && v > 0);
      if (rows.length) return rows;
    } catch (e) { console.warn(`FRED API ${id}: ${e.message}; tentando CSV`); }
  }
  const r = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${since}`, { headers: UA });
  if (!r.ok) throw new Error(`${id}: HTTP ${r.status}`);
  return (await r.text()).trim().split(/\r?\n/).slice(1).map((l) => l.split(',')).map(([d, v]) => [d, Number(v)])
    .filter(([d, v]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(v) && v > 0);
}

function monthlyMean(daily) {
  const acc = new Map();
  for (const [d, v] of daily) { const k = ym(d); const a = acc.get(k) || [0, 0]; a[0] += v; a[1]++; acc.set(k, a); }
  return new Map([...acc].map(([k, [s, n]]) => [k, s / n]));
}

const stats = (vals, perYear) => {
  const rets = [];
  for (let i = 1; i < vals.length; i++) rets.push(Math.log(vals[i] / vals[i - 1]));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, rets.length - 1));
  return Math.min(30, Math.max(8, sd * Math.sqrt(perYear / 2) * 100)); // volatilidade para horizonte de ~6 meses
};

/** Yahoo Finance (gráfico): devolve {price, ts[], close[]}. */
async function yahoo(symbol, range, interval) {
  const q = `/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  let last;
  for (const host of ['query1', 'query2']) {
    try {
      const j = await getJson(`https://${host}.finance.yahoo.com${q}`);
      const res = j.chart?.result?.[0];
      if (!res) throw new Error('sem resultado');
      const ts = res.timestamp || [], close = res.indicators?.quote?.[0]?.close || [];
      const pts = ts.map((t, i) => [new Date(t * 1000).toISOString().slice(0, 10), close[i]]).filter(([, v]) => Number.isFinite(v) && v > 0);
      return { price: res.meta?.regularMarketPrice ?? pts[pts.length - 1]?.[1], pts };
    } catch (e) { last = e; }
  }
  throw last;
}

async function curve(cfg, fxLast) {
  const out = [];
  const now = new Date();
  for (let k = 0; k < 15; k++) {
    const d = new Date(now.getFullYear(), now.getMonth() + k, 1);
    const letter = Object.keys(CODE).find((c) => CODE[c] === d.getMonth() + 1);
    if (!cfg.months.includes(letter)) continue;
    const sym = `${cfg.root}${letter}${String(d.getFullYear()).slice(2)}.${cfg.ex}`;
    try {
      const y = await yahoo(sym, '5d', '1d');
      if (y.price > 0) out.push({ m: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${MES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, native: round(y.price, 2), brl: round(cfg.toUnit(y.price, fxLast)), symbol: sym });
    } catch (e) { console.warn('  contrato ignorado', sym, e.message); }
  }
  return out;
}

async function main() {
  console.log('Chave FRED:', KEY ? 'presente (API oficial)' : 'ausente (CSV aberto)');
  const fxDaily = await fred('DEXBZUS');
  const fxM = monthlyMean(fxDaily);
  const fxLast = fxDaily[fxDaily.length - 1][1];
  const fxAsOf = fxDaily[fxDaily.length - 1][0];
  console.log('Dólar (último):', fxLast, fxAsOf);

  const crops = {};
  let asOf = '';
  const sources = new Set(['FRED']);
  for (const [crop, cfg] of Object.entries(CROPS)) {
    try {
      // 1) série mensal FRED
      const raw = await fred(cfg.fred);
      if (raw.length < 14) throw new Error('série curta');
      const brl = raw.map(([d, v]) => [d, cfg.fredToUnit(v, fxM.get(ym(d)) ?? fxLast)]);
      const last = brl[brl.length - 1], prev = brl[brl.length - 13];
      let entry = {
        unit: cfg.unit, price: round(last[1]), trend12m: round((last[1] / prev[1] - 1) * 100, 1), vol: round(stats(brl.slice(-37).map((x) => x[1]), 12), 1),
        series: brl.slice(-12).map(([, v]) => round(v)), history: brl.slice(-24).map(([d, v]) => ({ d, p: round(v) })),
        example: false, source: `FRED ${cfg.fred} (mensal, defasagem ~2 meses)`, asOf: last[0],
      };
      // 2) bolsa: preço do dia, histórico semanal e curva de futuros
      if (cfg.fut) {
        try {
          const front = await yahoo(`${cfg.fut.root}=F`, '2y', '1wk');
          const hist = front.pts.map(([d, v]) => ({ d, p: round(cfg.fut.toUnit(v, fxM.get(ym(d)) ?? fxLast)) }));
          if (hist.length > 60) {
            const p0 = hist[hist.length - 1].p, p1 = hist[hist.length - 53]?.p ?? hist[0].p;
            const today = new Date().toISOString().slice(0, 10);
            entry = {
              ...entry, price: round(cfg.fut.toUnit(front.price, fxLast)), trend12m: round((p0 / p1 - 1) * 100, 1),
              vol: round(stats(hist.map((h) => h.p), 52), 1), series: hist.slice(-12).map((h) => h.p), history: hist,
              source: `${cfg.fut.exName} ${cfg.fut.root} (contrato mais próximo) × dólar`, asOf: today, native: { price: round(front.price, 2), unit: cfg.fut.native },
            };
            sources.add(cfg.fut.exName);
          }
          const fc = await curve(cfg.fut, fxLast);
          if (fc.length >= 2) entry.futures = fc;
        } catch (e) { console.warn(' bolsa ignorada', crop, '-', e.message); }
      }
      crops[crop] = entry;
      if (entry.asOf > asOf) asOf = entry.asOf;
      console.log(crop, entry.price, entry.unit, entry.trend12m + '%', 'vol', entry.vol, entry.asOf, '| futuros:', entry.futures ? entry.futures.map((f) => f.label + '=' + f.brl).join(' ') : '—', '|', entry.source);
    } catch (e) {
      console.warn('Ignorada', crop, '-', e.message);
    }
  }
  if (!Object.keys(crops).length) throw new Error('nenhuma série obtida');
  const fxMonthly = [...fxM].slice(-24).map(([d, v]) => ({ d: d + '-01', p: round(v, 3) }));
  mkdirSync('public/data', { recursive: true });
  writeFileSync('public/data/mercado.json', JSON.stringify({
    example: false,
    source: [...sources].join(' + ') + ': preço internacional convertido pelo dólar (paridade, sem prêmio/base local)',
    asOf, generatedAt: new Date().toISOString(), fx: { last: round(fxLast, 4), asOf: fxAsOf, history: fxMonthly }, crops,
  }, null, 1));
  console.log('mercado.json gravado com', Object.keys(crops).join(', '));
}

main().catch((e) => { console.error('Falha ao atualizar o mercado:', e.message); process.exit(1); });
