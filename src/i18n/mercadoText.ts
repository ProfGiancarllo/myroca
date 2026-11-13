import { getCurrentLanguage } from './index';

type D = Record<string, string>;

const pt: D = {
  card: 'Mercado', cardHint: 'Toque para abrir o painel', title: 'Painel de mercado', sub: 'Preços, bolsas e projeções das culturas da sua fazenda', close: 'Fechar',
  real: 'Dados reais', example: 'Dados de exemplo', partial: 'Parte exemplo',
  updated: 'Atualizado em {d}', fx: 'Dólar', today: 'Preço hoje', trend: '12 meses', proj: 'Projeção em {m} meses', vol: 'Risco de preço', margin: 'Margem base/ha',
  farmCrops: 'Culturas da sua fazenda', fields: '{n} talhão(ões) · {ha} ha', pick: 'Toque numa cultura para ver o detalhe',
  histTitle: 'Preço nos últimos 2 anos', futTitle: 'Curva de futuros da bolsa', futHelp: 'Cada ponto é um contrato futuro: o preço que o mercado paga hoje pela entrega naquele mês. Curva subindo = o mercado espera preços maiores; descendo = menores.',
  noFut: 'Sem curva de futuros para esta cultura. A decisão usa a tendência dos últimos 12 meses.', exampleCrop: 'Esta cultura ainda usa valores de exemplo (sem série real).',
  rankTitle: 'Qual cultura rende mais por hectare', rankHelp: 'Margem = produtividade × preço esperado na colheita − custo. A barra é o cenário base; o traço vai do pessimista ao otimista.',
  impactTitle: 'Como isso entra na decisão de trocar de safra', impactText: 'O planejador usa estes mesmos preços. Para cada opção de troca, o preço esperado na colheita segue a curva de futuros da bolsa (quando existe; senão, a tendência de 12 meses) e a margem usa a produtividade do talhão, já reduzida pelo risco do clima e da rotação. A "Decisão combinada" escolhe a maior margem sem risco alto.',
  impactNow: 'Decisão agora: {t}', impactBtn: 'Abrir decisão de troca de safra', basisFut: 'Preço da colheita pelos futuros ({c}): {p}', basisTrend: 'Preço da colheita pela tendência: {p}',
  fxTitle: 'Dólar (R$ por US$)', parity: 'Preço internacional convertido pelo dólar (paridade de exportação). O preço da praça de Rio Verde costuma ser menor, por frete e prêmio. Digite o seu preço no planejador de safra.',
  exch: 'Bolsas usadas: CBOT (Chicago) e ICE (Nova York) para soja, milho, trigo e algodão; dólar e histórico mensal pelo FRED. A B3 não oferece dados abertos gratuitos.',
  footer: 'Estimativa para planejamento, não é recomendação de compra ou venda.', noData: 'Sem dados de mercado carregados; mostrando valores de exemplo.', perUnit: 'R$/{u}', months: 'meses',
  unitSc: 'saca 60 kg', unitArr: 'arroba', unitT: 'tonelada', up: 'alta', down: 'queda', pess: 'Pessimista', base: 'Base', opt: 'Otimista',
};
const en: D = {
  card: 'Market', cardHint: 'Tap to open the panel', title: 'Market panel', sub: 'Prices, exchanges and projections for your farm’s crops', close: 'Close',
  real: 'Real data', example: 'Example data', partial: 'Partly example',
  updated: 'Updated {d}', fx: 'Dollar', today: 'Price today', trend: '12 months', proj: 'Projection in {m} months', vol: 'Price risk', margin: 'Base margin/ha',
  farmCrops: 'Crops on your farm', fields: '{n} field(s) · {ha} ha', pick: 'Tap a crop to see the details',
  histTitle: 'Price over the last 2 years', futTitle: 'Exchange futures curve', futHelp: 'Each point is a futures contract: the price the market pays today for delivery in that month. Rising curve = the market expects higher prices; falling = lower.',
  noFut: 'No futures curve for this crop. The decision uses the 12-month trend.', exampleCrop: 'This crop still uses example values (no real series).',
  rankTitle: 'Which crop pays most per hectare', rankHelp: 'Margin = yield × expected harvest price − cost. The bar is the base scenario; the whisker goes from pessimistic to optimistic.',
  impactTitle: 'How this feeds the crop-switch decision', impactText: 'The planner uses these same prices. For each switch option, the expected harvest price follows the exchange futures curve (when available; otherwise the 12-month trend) and the margin uses the field’s yield, already reduced by climate and rotation risk. The “Combined decision” picks the highest margin without high risk.',
  impactNow: 'Decision now: {t}', impactBtn: 'Open crop-switch decision', basisFut: 'Harvest price from futures ({c}): {p}', basisTrend: 'Harvest price from trend: {p}',
  fxTitle: 'Dollar (R$ per US$)', parity: 'International price converted by the dollar (export parity). The Rio Verde local price is usually lower because of freight and premium. Type your price in the crop planner.',
  exch: 'Exchanges used: CBOT (Chicago) and ICE (New York) for soybeans, corn, wheat and cotton; dollar and monthly history from FRED. B3 has no free open data.',
  footer: 'Planning estimate, not a buy or sell recommendation.', noData: 'No market data loaded; showing example values.', perUnit: 'R$/{u}', months: 'months',
  unitSc: '60 kg bag', unitArr: 'arroba', unitT: 'tonne', up: 'up', down: 'down', pess: 'Pessimistic', base: 'Base', opt: 'Optimistic',
};
const es: D = {
  card: 'Mercado', cardHint: 'Toque para abrir el panel', title: 'Panel de mercado', sub: 'Precios, bolsas y proyecciones de los cultivos de su finca', close: 'Cerrar',
  real: 'Datos reales', example: 'Datos de ejemplo', partial: 'Parte ejemplo',
  updated: 'Actualizado el {d}', fx: 'Dólar', today: 'Precio hoy', trend: '12 meses', proj: 'Proyección a {m} meses', vol: 'Riesgo de precio', margin: 'Margen base/ha',
  farmCrops: 'Cultivos de su finca', fields: '{n} lote(s) · {ha} ha', pick: 'Toque un cultivo para ver el detalle',
  histTitle: 'Precio en los últimos 2 años', futTitle: 'Curva de futuros de la bolsa', futHelp: 'Cada punto es un contrato futuro: el precio que el mercado paga hoy por la entrega en ese mes. Curva subiendo = se esperan precios mayores; bajando = menores.',
  noFut: 'Sin curva de futuros para este cultivo. La decisión usa la tendencia de 12 meses.', exampleCrop: 'Este cultivo aún usa valores de ejemplo (sin serie real).',
  rankTitle: 'Qué cultivo rinde más por hectárea', rankHelp: 'Margen = rendimiento × precio esperado en la cosecha − costo. La barra es el escenario base; la línea va del pesimista al optimista.',
  impactTitle: 'Cómo entra en la decisión de cambiar de cultivo', impactText: 'El planificador usa estos mismos precios. Para cada opción de cambio, el precio esperado en la cosecha sigue la curva de futuros de la bolsa (si existe; si no, la tendencia de 12 meses) y el margen usa el rendimiento del lote, ya reducido por el riesgo climático y de rotación. La “Decisión combinada” elige el mayor margen sin riesgo alto.',
  impactNow: 'Decisión ahora: {t}', impactBtn: 'Abrir decisión de cambio de cultivo', basisFut: 'Precio de cosecha por futuros ({c}): {p}', basisTrend: 'Precio de cosecha por tendencia: {p}',
  fxTitle: 'Dólar (R$ por US$)', parity: 'Precio internacional convertido por el dólar (paridad de exportación). El precio local de Rio Verde suele ser menor por flete y prima. Escriba su precio en el planificador.',
  exch: 'Bolsas usadas: CBOT (Chicago) e ICE (Nueva York) para soja, maíz, trigo y algodón; dólar e historial mensual por FRED. B3 no ofrece datos abiertos gratuitos.',
  footer: 'Estimación para planificación, no es recomendación de compra o venta.', noData: 'Sin datos de mercado cargados; mostrando valores de ejemplo.', perUnit: 'R$/{u}', months: 'meses',
  unitSc: 'saca 60 kg', unitArr: 'arroba', unitT: 'tonelada', up: 'alza', down: 'baja', pess: 'Pesimista', base: 'Base', opt: 'Optimista',
};
const de: D = {
  card: 'Markt', cardHint: 'Zum Öffnen tippen', title: 'Marktübersicht', sub: 'Preise, Börsen und Prognosen für die Kulturen Ihres Betriebs', close: 'Schließen',
  real: 'Echtdaten', example: 'Beispieldaten', partial: 'Teils Beispiel',
  updated: 'Stand {d}', fx: 'Dollar', today: 'Preis heute', trend: '12 Monate', proj: 'Prognose in {m} Monaten', vol: 'Preisrisiko', margin: 'Basismarge/ha',
  farmCrops: 'Kulturen Ihres Betriebs', fields: '{n} Schlag/Schläge · {ha} ha', pick: 'Kultur antippen für Details',
  histTitle: 'Preis der letzten 2 Jahre', futTitle: 'Terminkurve der Börse', futHelp: 'Jeder Punkt ist ein Terminkontrakt: der Preis, den der Markt heute für die Lieferung in diesem Monat zahlt. Steigende Kurve = höhere Preise erwartet; fallende = niedrigere.',
  noFut: 'Keine Terminkurve für diese Kultur. Die Entscheidung nutzt den 12-Monats-Trend.', exampleCrop: 'Diese Kultur nutzt noch Beispielwerte (keine echte Reihe).',
  rankTitle: 'Welche Kultur bringt pro Hektar am meisten', rankHelp: 'Marge = Ertrag × erwarteter Erntepreis − Kosten. Der Balken ist das Basisszenario; der Strich reicht von pessimistisch bis optimistisch.',
  impactTitle: 'Wie das in die Entscheidung zum Kulturwechsel einfließt', impactText: 'Der Planer nutzt dieselben Preise. Für jede Wechseloption folgt der erwartete Erntepreis der Terminkurve der Börse (falls vorhanden, sonst dem 12-Monats-Trend); die Marge nutzt den Schlagertrag, bereits um Klima- und Fruchtfolgerisiko gekürzt. Die „Kombinierte Entscheidung“ wählt die höchste Marge ohne hohes Risiko.',
  impactNow: 'Entscheidung jetzt: {t}', impactBtn: 'Entscheidung zum Kulturwechsel öffnen', basisFut: 'Erntepreis aus Terminkurs ({c}): {p}', basisTrend: 'Erntepreis aus Trend: {p}',
  fxTitle: 'Dollar (R$ pro US$)', parity: 'Internationaler Preis, per Dollar umgerechnet (Exportparität). Der lokale Preis in Rio Verde ist meist niedriger (Fracht, Aufschlag). Tragen Sie Ihren Preis im Planer ein.',
  exch: 'Genutzte Börsen: CBOT (Chicago) und ICE (New York) für Soja, Mais, Weizen und Baumwolle; Dollar und Monatsverlauf über FRED. Die B3 bietet keine kostenlosen offenen Daten.',
  footer: 'Planungsschätzung, keine Kauf- oder Verkaufsempfehlung.', noData: 'Keine Marktdaten geladen; Beispielwerte werden gezeigt.', perUnit: 'R$/{u}', months: 'Monate',
  unitSc: '60-kg-Sack', unitArr: 'Arroba', unitT: 'Tonne', up: 'steigend', down: 'fallend', pess: 'Pessimistisch', base: 'Basis', opt: 'Optimistisch',
};
const zh: D = {
  card: '市场', cardHint: '点击打开面板', title: '市场面板', sub: '您农场作物的价格、交易所与预测', close: '关闭',
  real: '真实数据', example: '示例数据', partial: '部分为示例',
  updated: '更新于 {d}', fx: '美元', today: '今日价格', trend: '12个月', proj: '{m}个月后预测', vol: '价格风险', margin: '基准利润/公顷',
  farmCrops: '您农场的作物', fields: '{n}块地 · {ha} 公顷', pick: '点击作物查看详情',
  histTitle: '近2年价格', futTitle: '交易所期货曲线', futHelp: '每个点是一份期货合约：市场今天为该月交割支付的价格。曲线上升=预期价格更高；下降=更低。',
  noFut: '该作物没有期货曲线，决策使用近12个月趋势。', exampleCrop: '该作物仍使用示例数值（无真实数据序列）。',
  rankTitle: '每公顷哪种作物收益最高', rankHelp: '利润=产量×预期收获价格−成本。柱为基准情景；细线从悲观到乐观。',
  impactTitle: '这些数据如何进入换茬决策', impactText: '规划器使用同样的价格。对每个换茬方案，收获时的预期价格跟随交易所期货曲线（若有；否则用12个月趋势），利润使用地块产量，并已按气候与轮作风险折减。“综合决策”选择无高风险的最高利润方案。',
  impactNow: '当前决策：{t}', impactBtn: '打开换茬决策', basisFut: '按期货的收获价格（{c}）：{p}', basisTrend: '按趋势的收获价格：{p}',
  fxTitle: '美元（雷亚尔/美元）', parity: '按美元换算的国际价格（出口平价）。里奥韦尔迪本地价格通常更低（运费与升贴水）。请在规划器中输入您的价格。',
  exch: '使用的交易所：CBOT（芝加哥）与 ICE（纽约），涵盖大豆、玉米、小麦、棉花；美元和月度历史来自 FRED。B3 无免费开放数据。',
  footer: '规划估算，不构成买卖建议。', noData: '未加载市场数据；显示示例数值。', perUnit: 'R$/{u}', months: '个月',
  unitSc: '60公斤袋', unitArr: '阿罗巴', unitT: '吨', up: '上涨', down: '下跌', pess: '悲观', base: '基准', opt: '乐观',
};
const fr: D = {
  card: 'Marché', cardHint: 'Touchez pour ouvrir le panneau', title: 'Panneau de marché', sub: 'Prix, bourses et projections des cultures de votre exploitation', close: 'Fermer',
  real: 'Données réelles', example: 'Données d’exemple', partial: 'En partie exemple',
  updated: 'Mis à jour le {d}', fx: 'Dollar', today: 'Prix aujourd’hui', trend: '12 mois', proj: 'Projection à {m} mois', vol: 'Risque de prix', margin: 'Marge de base/ha',
  farmCrops: 'Cultures de votre exploitation', fields: '{n} parcelle(s) · {ha} ha', pick: 'Touchez une culture pour le détail',
  histTitle: 'Prix des 2 dernières années', futTitle: 'Courbe des contrats à terme', futHelp: 'Chaque point est un contrat à terme : le prix que le marché paie aujourd’hui pour une livraison ce mois-là. Courbe montante = prix plus élevés attendus ; descendante = plus bas.',
  noFut: 'Pas de courbe à terme pour cette culture. La décision utilise la tendance sur 12 mois.', exampleCrop: 'Cette culture utilise encore des valeurs d’exemple (pas de série réelle).',
  rankTitle: 'Quelle culture rapporte le plus par hectare', rankHelp: 'Marge = rendement × prix attendu à la récolte − coût. La barre est le scénario de base ; le trait va du pessimiste à l’optimiste.',
  impactTitle: 'Comment cela entre dans la décision de changer de culture', impactText: 'Le planificateur utilise ces mêmes prix. Pour chaque option, le prix attendu à la récolte suit la courbe à terme de la bourse (si elle existe ; sinon la tendance sur 12 mois) et la marge utilise le rendement de la parcelle, déjà réduit par le risque climatique et de rotation. La « Décision combinée » choisit la meilleure marge sans risque élevé.',
  impactNow: 'Décision actuelle : {t}', impactBtn: 'Ouvrir la décision de changement de culture', basisFut: 'Prix à la récolte selon les contrats ({c}) : {p}', basisTrend: 'Prix à la récolte selon la tendance : {p}',
  fxTitle: 'Dollar (R$ par US$)', parity: 'Prix international converti par le dollar (parité export). Le prix local à Rio Verde est souvent plus bas (fret, prime). Saisissez votre prix dans le planificateur.',
  exch: 'Bourses utilisées : CBOT (Chicago) et ICE (New York) pour soja, maïs, blé et coton ; dollar et historique mensuel via FRED. La B3 n’offre pas de données ouvertes gratuites.',
  footer: 'Estimation de planification, pas une recommandation d’achat ou de vente.', noData: 'Aucune donnée de marché chargée ; valeurs d’exemple affichées.', perUnit: 'R$/{u}', months: 'mois',
  unitSc: 'sac de 60 kg', unitArr: 'arroba', unitT: 'tonne', up: 'hausse', down: 'baisse', pess: 'Pessimiste', base: 'Base', opt: 'Optimiste',
};

const ALL: Record<string, D> = { pt, en, es, de, zh, fr };
export function mk2(key: string, params?: Record<string, string | number>): string {
  let s = (ALL[getCurrentLanguage()] || en)[key] ?? en[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
