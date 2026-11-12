// Baixa preços internacionais de commodities (FRED, séries abertas em CSV, sem chave) e o dólar,
// converte para R$ por unidade usada no app e grava public/data/mercado.json.
// Roda no workflow de publicação. Se alguma série falhar, ela é ignorada e a cultura continua como "exemplo".
import { mkdirSync, writeFileSync } from 'node:fs';

const FRED = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=';
const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365 * 4).toISOString().slice(0, 10);

/** Séries mensais "Global price of ..." (Banco Mundial/FMI via FRED). Fator converte a unidade da série para a unidade do app. */
const SERIES = {
  soja:    { id: 'PSOYBUSDM',    unit: 'sc', toUnit: (usdPerT, fx) => usdPerT * 0.06 * fx },          // USD/t -> R$/saca 60 kg
  milho:   { id: 'PMAIZMTUSDM',  unit: 'sc', toUnit: (usdPerT, fx) => usdPerT * 0.06 * fx },
  sorgo:   { id: 'PSORGUSDM',    unit: 'sc', toUnit: (usdPerT, fx) => usdPerT * 0.06 * fx },
  trigo:   { id: 'PWHEAMTUSDM',  unit: 'sc', toUnit: (usdPerT, fx) => usdPerT * 0.06 * fx },
  algodao: { id: 'PCOTTINDUSDM', unit: '@',  toUnit: (centsPerLb, fx) => (centsPerLb / 100) * 2.20462 * 15 * fx }, // US$ cents/lb -> R$/@ (15 kg)
};

async function csv(id) {
  const r = await fetch(`${FRED}${id}&cosd=${since}`, { headers: { 'user-agent': 'myroca-build' } });
  if (!r.ok) throw new Error(`${id}: HTTP ${r.status}`);
  const rows = (await r.text()).trim().split(/\r?\n/).slice(1).map((l) => l.split(','));
  return rows.map(([d, v]) => [d, Number(v)]).filter(([d, v]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(v) && v > 0);
}

const ym = (d) => d.slice(0, 7);

function monthlyMean(daily) {
  const acc = new Map();
  for (const [d, v] of daily) { const k = ym(d); const a = acc.get(k) || [0, 0]; a[0] += v; a[1]++; acc.set(k, a); }
  return new Map([...acc].map(([k, [s, n]]) => [k, s / n]));
}

const round = (v, n = 2) => Math.round(v * 10 ** n) / 10 ** n;

async function main() {
  const fxDaily = await csv('DEXBZUS'); // reais por dólar
  const fxM = monthlyMean(fxDaily);
  const fxLast = fxDaily[fxDaily.length - 1][1];
  console.log('Dólar (último):', fxLast, fxDaily[fxDaily.length - 1][0]);

  const crops = {};
  let asOf = '';
  for (const [crop, cfg] of Object.entries(SERIES)) {
    try {
      const raw = await csv(cfg.id);
      if (raw.length < 14) throw new Error('série curta');
      const brl = raw.map(([d, v]) => [d, cfg.toUnit(v, fxM.get(ym(d)) ?? fxLast)]);
      const last = brl[brl.length - 1];
      const prev = brl[brl.length - 13];
      const trend = (last[1] / prev[1] - 1) * 100;
      const rets = [];
      for (let i = Math.max(1, brl.length - 36); i < brl.length; i++) rets.push(Math.log(brl[i][1] / brl[i - 1][1]));
      const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
      const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, rets.length - 1));
      const vol = Math.min(30, Math.max(8, sd * Math.sqrt(6) * 100));
      crops[crop] = {
        unit: cfg.unit, price: round(last[1]), trend12m: round(trend, 1), vol: round(vol, 1),
        series: brl.slice(-12).map(([, v]) => round(v)), example: false, source: `FRED ${cfg.id}`, asOf: last[0],
      };
      if (last[0] > asOf) asOf = last[0];
      console.log(crop, crops[crop].price, cfg.unit, crops[crop].trend12m + '%', 'vol', crops[crop].vol, last[0]);
    } catch (e) {
      console.warn('Ignorada', crop, '-', e.message);
    }
  }
  if (!Object.keys(crops).length) throw new Error('nenhuma série obtida');
  mkdirSync('public/data', { recursive: true });
  writeFileSync('public/data/mercado.json', JSON.stringify({
    example: false,
    source: 'FRED (Banco Mundial/FMI), preço internacional convertido pelo dólar',
    asOf, generatedAt: new Date().toISOString(), crops,
  }, null, 2));
  console.log('mercado.json gravado com', Object.keys(crops).join(', '));
}

main().catch((e) => { console.error('Falha ao atualizar o mercado:', e.message); process.exit(1); });
