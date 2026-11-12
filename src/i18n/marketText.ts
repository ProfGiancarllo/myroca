import { getCurrentLanguage } from './index';

type D = Record<string, string>;

const pt: D = {
  decisionLoss: 'Com estes preços nenhuma estratégia cobre o custo. A menos negativa é {name}: margem base de {m} por hectare. Revise custos e culturas.',
  title: 'Mercado e margem estimada', exampleBadge: 'Dados de exemplo', realBadge: 'Dados de mercado',
  exampleNote: 'Preços, tendências e custos abaixo são ilustrativos até a série real ser carregada. Você pode digitar o seu preço e o seu custo.',
  realNote: 'Fonte: {src} ({date}).',
  crop: 'Cultura', price: 'Preço', trend: '12 meses', cost: 'Custo (R$/ha)', yourValue: 'edite com o seu valor', reset: 'Restaurar valores',
  stress: 'Teste de preço', stressHelp: 'Simule uma queda ou alta de preço em todas as culturas e veja a decisão mudar.', stressNow: 'Preços {v}',
  margin: 'Margem estimada', perHa: 'por hectare', total: 'no talhão ({ha} ha)', pess: 'Pessimista', base: 'Base', opt: 'Otimista',
  best: 'Melhor margem com o risco considerado', loss: 'No cenário pessimista esta estratégia dá prejuízo.', yieldAdj: 'Produtividade usada: {v} {u}/ha (ajustada pelo risco)',
  decision: 'Decisão combinada: clima, lavoura e mercado', decisionText: 'Melhor opção neste talhão: {name}, com margem base de {m} por hectare e risco {risk}. Margem no talhão: {t}.',
  decisionNone: 'Nenhuma estratégia tem risco aceitável com os dados atuais; revise as datas ou as culturas.',
  foot: 'Estimativa para planejamento, não é recomendação de compra ou venda. Margem = produtividade × preço − custo. O preço base aplica metade da variação dos últimos 12 meses; os cenários usam a volatilidade de cada cultura e produtividade de −15% a +10%. A produtividade cai com o risco da estratégia.',
  noMarket: 'Sem dado de mercado para esta cultura.', cover: 'Cobertura sem venda: só o custo entra na conta; o ganho vem do solo.',
  up: 'alta', down: 'queda', cmp: 'Comparar margens',
};

const en: D = {
  decisionLoss: 'At these prices no strategy covers its cost. The least negative is {name}: base margin of {m} per hectare. Review costs and crops.',
  title: 'Market and estimated margin', exampleBadge: 'Example data', realBadge: 'Market data',
  exampleNote: 'Prices, trends and costs below are illustrative until the real series is loaded. You can type your own price and cost.',
  realNote: 'Source: {src} ({date}).',
  crop: 'Crop', price: 'Price', trend: '12 months', cost: 'Cost (R$/ha)', yourValue: 'edit with your value', reset: 'Reset values',
  stress: 'Price test', stressHelp: 'Simulate a price drop or rise for all crops and watch the decision change.', stressNow: 'Prices {v}',
  margin: 'Estimated margin', perHa: 'per hectare', total: 'on the field ({ha} ha)', pess: 'Pessimistic', base: 'Base', opt: 'Optimistic',
  best: 'Best margin with risk considered', loss: 'In the pessimistic scenario this strategy loses money.', yieldAdj: 'Yield used: {v} {u}/ha (risk-adjusted)',
  decision: 'Combined decision: weather, crop and market', decisionText: 'Best option for this field: {name}, with a base margin of {m} per hectare and {risk} risk. Field margin: {t}.',
  decisionNone: 'No strategy has acceptable risk with the current data; review the dates or crops.',
  foot: 'Planning estimate, not a recommendation to buy or sell. Margin = yield × price − cost. The base price applies half of the last 12 months change; scenarios use each crop volatility and yield from −15% to +10%. Yield drops with the strategy risk.',
  noMarket: 'No market data for this crop.', cover: 'Cover crop with no sale: only the cost counts; the gain comes from the soil.',
  up: 'up', down: 'down', cmp: 'Compare margins',
};

const es: D = {
  decisionLoss: 'Con estos precios ninguna estrategia cubre el costo. La menos negativa es {name}: margen base de {m} por hectárea. Revise costos y cultivos.',
  title: 'Mercado y margen estimado', exampleBadge: 'Datos de ejemplo', realBadge: 'Datos de mercado',
  exampleNote: 'Los precios, tendencias y costos de abajo son ilustrativos hasta cargar la serie real. Puede escribir su precio y su costo.',
  realNote: 'Fuente: {src} ({date}).',
  crop: 'Cultivo', price: 'Precio', trend: '12 meses', cost: 'Costo (R$/ha)', yourValue: 'edite con su valor', reset: 'Restaurar valores',
  stress: 'Prueba de precio', stressHelp: 'Simule una caída o alza de precio en todos los cultivos y vea cambiar la decisión.', stressNow: 'Precios {v}',
  margin: 'Margen estimado', perHa: 'por hectárea', total: 'en el lote ({ha} ha)', pess: 'Pesimista', base: 'Base', opt: 'Optimista',
  best: 'Mejor margen considerando el riesgo', loss: 'En el escenario pesimista esta estrategia da pérdida.', yieldAdj: 'Rendimiento usado: {v} {u}/ha (ajustado por riesgo)',
  decision: 'Decisión combinada: clima, cultivo y mercado', decisionText: 'Mejor opción para este lote: {name}, con margen base de {m} por hectárea y riesgo {risk}. Margen en el lote: {t}.',
  decisionNone: 'Ninguna estrategia tiene riesgo aceptable con los datos actuales; revise las fechas o los cultivos.',
  foot: 'Estimación para planificación, no es recomendación de compra o venta. Margen = rendimiento × precio − costo. El precio base aplica la mitad de la variación de los últimos 12 meses; los escenarios usan la volatilidad de cada cultivo y rendimiento de −15% a +10%. El rendimiento baja con el riesgo de la estrategia.',
  noMarket: 'Sin datos de mercado para este cultivo.', cover: 'Cobertura sin venta: solo cuenta el costo; la ganancia viene del suelo.',
  up: 'alza', down: 'caída', cmp: 'Comparar márgenes',
};

const de: D = {
  decisionLoss: 'Bei diesen Preisen deckt keine Strategie die Kosten. Am wenigsten negativ ist {name}: Basismarge von {m} pro Hektar. Prüfen Sie Kosten und Kulturen.',
  title: 'Markt und geschätzte Marge', exampleBadge: 'Beispieldaten', realBadge: 'Marktdaten',
  exampleNote: 'Preise, Trends und Kosten unten sind Beispiele, bis die echte Reihe geladen ist. Sie können Ihren eigenen Preis und Ihre Kosten eingeben.',
  realNote: 'Quelle: {src} ({date}).',
  crop: 'Kultur', price: 'Preis', trend: '12 Monate', cost: 'Kosten (R$/ha)', yourValue: 'mit Ihrem Wert bearbeiten', reset: 'Werte zurücksetzen',
  stress: 'Preistest', stressHelp: 'Simulieren Sie einen Preisrückgang oder -anstieg für alle Kulturen und sehen Sie, wie sich die Entscheidung ändert.', stressNow: 'Preise {v}',
  margin: 'Geschätzte Marge', perHa: 'pro Hektar', total: 'auf dem Schlag ({ha} ha)', pess: 'Pessimistisch', base: 'Basis', opt: 'Optimistisch',
  best: 'Beste Marge unter Berücksichtigung des Risikos', loss: 'Im pessimistischen Szenario macht diese Strategie Verlust.', yieldAdj: 'Verwendeter Ertrag: {v} {u}/ha (risikoangepasst)',
  decision: 'Gemeinsame Entscheidung: Wetter, Kultur und Markt', decisionText: 'Beste Option für diesen Schlag: {name}, mit Basismarge von {m} pro Hektar und {risk} Risiko. Marge auf dem Schlag: {t}.',
  decisionNone: 'Keine Strategie hat mit den aktuellen Daten ein akzeptables Risiko; prüfen Sie Daten oder Kulturen.',
  foot: 'Planungsschätzung, keine Kauf- oder Verkaufsempfehlung. Marge = Ertrag × Preis − Kosten. Der Basispreis berücksichtigt die Hälfte der Veränderung der letzten 12 Monate; die Szenarien nutzen die Volatilität jeder Kultur und Erträge von −15 % bis +10 %. Der Ertrag sinkt mit dem Risiko der Strategie.',
  noMarket: 'Keine Marktdaten für diese Kultur.', cover: 'Zwischenfrucht ohne Verkauf: nur die Kosten zählen; der Nutzen liegt im Boden.',
  up: 'Anstieg', down: 'Rückgang', cmp: 'Margen vergleichen',
};

const zh: D = {
  decisionLoss: '按这些价格，没有任何方案能覆盖成本。亏损最小的是 {name}：基准利润每公顷 {m}。请检查成本和作物。',
  title: '市场与预估利润', exampleBadge: '示例数据', realBadge: '市场数据',
  exampleNote: '下方价格、趋势和成本仅为示例，待真实数据序列加载后替换。您也可以输入自己的价格和成本。',
  realNote: '来源：{src}（{date}）。',
  crop: '作物', price: '价格', trend: '12个月', cost: '成本（R$/公顷）', yourValue: '填入您的数值', reset: '恢复默认值',
  stress: '价格压力测试', stressHelp: '模拟所有作物价格下跌或上涨，观察决策如何变化。', stressNow: '价格 {v}',
  margin: '预估利润', perHa: '每公顷', total: '整块地（{ha} 公顷）', pess: '悲观', base: '基准', opt: '乐观',
  best: '考虑风险后的最佳利润', loss: '在悲观情景下，该方案会亏损。', yieldAdj: '采用产量：{v} {u}/公顷（已按风险调整）',
  decision: '综合决策：气候、作物与市场', decisionText: '该地块的最佳方案：{name}，基准利润每公顷 {m}，风险{risk}。整块地利润：{t}。',
  decisionNone: '按当前数据没有风险可接受的方案；请检查日期或作物。',
  foot: '仅为规划估算，不构成买卖建议。利润 = 产量 × 价格 − 成本。基准价格采用近12个月变动的一半；情景采用各作物的波动率以及 −15% 至 +10% 的产量。产量随方案风险下降。',
  noMarket: '该作物暂无市场数据。', cover: '覆盖作物不出售：只计成本，收益来自土壤。',
  up: '上涨', down: '下跌', cmp: '比较利润',
};

const fr: D = {
  decisionLoss: 'À ces prix, aucune stratégie ne couvre son coût. La moins négative est {name} : marge de base de {m} par hectare. Revoyez coûts et cultures.',
  title: 'Marché et marge estimée', exampleBadge: 'Données d’exemple', realBadge: 'Données de marché',
  exampleNote: 'Les prix, tendances et coûts ci-dessous sont illustratifs jusqu’au chargement de la série réelle. Vous pouvez saisir votre prix et votre coût.',
  realNote: 'Source : {src} ({date}).',
  crop: 'Culture', price: 'Prix', trend: '12 mois', cost: 'Coût (R$/ha)', yourValue: 'modifiez avec votre valeur', reset: 'Rétablir les valeurs',
  stress: 'Test de prix', stressHelp: 'Simulez une baisse ou une hausse de prix pour toutes les cultures et voyez la décision changer.', stressNow: 'Prix {v}',
  margin: 'Marge estimée', perHa: 'par hectare', total: 'sur la parcelle ({ha} ha)', pess: 'Pessimiste', base: 'Base', opt: 'Optimiste',
  best: 'Meilleure marge en tenant compte du risque', loss: 'Dans le scénario pessimiste, cette stratégie est déficitaire.', yieldAdj: 'Rendement utilisé : {v} {u}/ha (ajusté au risque)',
  decision: 'Décision combinée : climat, culture et marché', decisionText: 'Meilleure option pour cette parcelle : {name}, avec une marge de base de {m} par hectare et un risque {risk}. Marge sur la parcelle : {t}.',
  decisionNone: 'Aucune stratégie n’a un risque acceptable avec les données actuelles ; revoyez les dates ou les cultures.',
  foot: 'Estimation de planification, pas une recommandation d’achat ou de vente. Marge = rendement × prix − coût. Le prix de base applique la moitié de la variation des 12 derniers mois ; les scénarios utilisent la volatilité de chaque culture et un rendement de −15 % à +10 %. Le rendement baisse avec le risque de la stratégie.',
  noMarket: 'Pas de données de marché pour cette culture.', cover: 'Couvert sans vente : seul le coût compte ; le gain vient du sol.',
  up: 'hausse', down: 'baisse', cmp: 'Comparer les marges',
};

const ALL: Record<string, D> = { pt, en, es, de, zh, fr };

export function mt(key: string, params?: Record<string, string | number>): string {
  let s = (ALL[getCurrentLanguage()] || en)[key] ?? en[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
