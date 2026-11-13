import { getCurrentLanguage } from './index';

type D = Record<string, string>;

const pt: D = {
  chipHarvestToday: 'Colheita hoje: {name}',
  hub: 'Safra e decisões', tabCurrent: 'Safra atual', tabSwitch: 'Trocar de safra',
  curTitle: 'Como está a safra da fazenda', curSub: 'Cada barra vai do plantio à colheita. A linha escura é hoje. Toque em um talhão para decidir a próxima safra.',
  chipFields: '{n} talhões', chipArea: '{ha} ha', chipHarvest: 'Próxima colheita: {name}, em {d} dia(s)', chipNone: 'Nenhuma colheita à vista',
  today: 'Hoje', dayOf: 'dia {d} de {t}', harvestOn: 'colheita {date}', daysLeft: 'faltam {d} dia(s)', done: 'colhido', pasture: 'Pastagem contínua', noCrop: 'Sem safra cadastrada',
  next: 'Próxima: {crop}', forecast: 'previsão {v} sc/ha', decide: 'Decidir', noFields: 'Cadastre um talhão para ver a safra.',
  chartTitle: 'Qual estratégia rende mais neste talhão?', chartSub: 'A barra mostra a margem estimada por hectare no cenário base; o traço vai do pessimista ao otimista. Cor da etiqueta = risco.',
  details: 'Ver detalhes, ajustar preços e datas', adopt: 'Adotar', best: 'Melhor',
  heroCur: 'Safra atual', heroCurText: '{n} talhões em produção · {harvest}', heroCurNone: 'Nenhum talhão em produção agora',
  heroSwitch: 'Trocar de safra', heroSwitchText: '{field}: {name} rende cerca de {m} por hectare, risco {risk}', heroSwitchNone: 'Veja qual cultura rende mais no próximo ciclo', heroOpen: 'Abrir',
  fabCur: 'Safra atual', fabSwitch: 'Trocar de safra', exampleShort: 'com dados de exemplo',
};
const en: D = {
  chipHarvestToday: 'Harvest today: {name}',
  hub: 'Season and decisions', tabCurrent: 'Current season', tabSwitch: 'Switch crop',
  curTitle: 'How the farm season is going', curSub: 'Each bar runs from planting to harvest. The dark line is today. Tap a field to decide the next season.',
  chipFields: '{n} fields', chipArea: '{ha} ha', chipHarvest: 'Next harvest: {name}, in {d} day(s)', chipNone: 'No harvest ahead',
  today: 'Today', dayOf: 'day {d} of {t}', harvestOn: 'harvest {date}', daysLeft: '{d} day(s) left', done: 'harvested', pasture: 'Continuous pasture', noCrop: 'No season registered',
  next: 'Next: {crop}', forecast: 'forecast {v} sc/ha', decide: 'Decide', noFields: 'Add a field to see the season.',
  chartTitle: 'Which strategy pays more on this field?', chartSub: 'The bar is the estimated margin per hectare in the base scenario; the line runs from pessimistic to optimistic. Tag color = risk.',
  details: 'See details, adjust prices and dates', adopt: 'Adopt', best: 'Best',
  heroCur: 'Current season', heroCurText: '{n} fields in production · {harvest}', heroCurNone: 'No field in production right now',
  heroSwitch: 'Switch crop', heroSwitchText: '{field}: {name} yields about {m} per hectare, {risk} risk', heroSwitchNone: 'See which crop pays more next cycle', heroOpen: 'Open',
  fabCur: 'Current season', fabSwitch: 'Switch crop', exampleShort: 'with example data',
};
const es: D = {
  chipHarvestToday: 'Cosecha hoy: {name}',
  hub: 'Cosecha y decisiones', tabCurrent: 'Cosecha actual', tabSwitch: 'Cambiar de cultivo',
  curTitle: 'Cómo va la cosecha de la finca', curSub: 'Cada barra va de la siembra a la cosecha. La línea oscura es hoy. Toque un lote para decidir la próxima.',
  chipFields: '{n} lotes', chipArea: '{ha} ha', chipHarvest: 'Próxima cosecha: {name}, en {d} día(s)', chipNone: 'Ninguna cosecha a la vista',
  today: 'Hoy', dayOf: 'día {d} de {t}', harvestOn: 'cosecha {date}', daysLeft: 'faltan {d} día(s)', done: 'cosechado', pasture: 'Pastura continua', noCrop: 'Sin cosecha registrada',
  next: 'Próxima: {crop}', forecast: 'previsión {v} sc/ha', decide: 'Decidir', noFields: 'Registre un lote para ver la cosecha.',
  chartTitle: '¿Qué estrategia rinde más en este lote?', chartSub: 'La barra es el margen estimado por hectárea en el escenario base; el trazo va del pesimista al optimista. Color de la etiqueta = riesgo.',
  details: 'Ver detalles, ajustar precios y fechas', adopt: 'Adoptar', best: 'Mejor',
  heroCur: 'Cosecha actual', heroCurText: '{n} lotes en producción · {harvest}', heroCurNone: 'Ningún lote en producción ahora',
  heroSwitch: 'Cambiar de cultivo', heroSwitchText: '{field}: {name} rinde cerca de {m} por hectárea, riesgo {risk}', heroSwitchNone: 'Vea qué cultivo rinde más en el próximo ciclo', heroOpen: 'Abrir',
  fabCur: 'Cosecha actual', fabSwitch: 'Cambiar de cultivo', exampleShort: 'con datos de ejemplo',
};
const de: D = {
  chipHarvestToday: 'Ernte heute: {name}',
  hub: 'Saison und Entscheidungen', tabCurrent: 'Aktuelle Saison', tabSwitch: 'Kultur wechseln',
  curTitle: 'Wie die Saison der Farm läuft', curSub: 'Jeder Balken geht von der Aussaat bis zur Ernte. Die dunkle Linie ist heute. Tippen Sie auf einen Schlag, um die nächste Saison zu entscheiden.',
  chipFields: '{n} Schläge', chipArea: '{ha} ha', chipHarvest: 'Nächste Ernte: {name}, in {d} Tag(en)', chipNone: 'Keine Ernte in Sicht',
  today: 'Heute', dayOf: 'Tag {d} von {t}', harvestOn: 'Ernte {date}', daysLeft: 'noch {d} Tag(e)', done: 'geerntet', pasture: 'Dauerweide', noCrop: 'Keine Saison eingetragen',
  next: 'Nächste: {crop}', forecast: 'Prognose {v} sc/ha', decide: 'Entscheiden', noFields: 'Legen Sie einen Schlag an, um die Saison zu sehen.',
  chartTitle: 'Welche Strategie bringt auf diesem Schlag mehr?', chartSub: 'Der Balken zeigt die geschätzte Marge pro Hektar im Basisszenario; die Linie reicht von pessimistisch bis optimistisch. Farbe des Etiketts = Risiko.',
  details: 'Details ansehen, Preise und Daten anpassen', adopt: 'Übernehmen', best: 'Beste',
  heroCur: 'Aktuelle Saison', heroCurText: '{n} Schläge in Produktion · {harvest}', heroCurNone: 'Derzeit kein Schlag in Produktion',
  heroSwitch: 'Kultur wechseln', heroSwitchText: '{field}: {name} bringt etwa {m} pro Hektar, {risk} Risiko', heroSwitchNone: 'Sehen Sie, welche Kultur im nächsten Zyklus mehr bringt', heroOpen: 'Öffnen',
  fabCur: 'Aktuelle Saison', fabSwitch: 'Kultur wechseln', exampleShort: 'mit Beispieldaten',
};
const zh: D = {
  chipHarvestToday: '今天收获：{name}',
  hub: '季节与决策', tabCurrent: '当前季节', tabSwitch: '更换作物',
  curTitle: '农场当前季节进展', curSub: '每条横条从播种到收获。深色线表示今天。点按地块来决定下一季。',
  chipFields: '{n} 块地', chipArea: '{ha} 公顷', chipHarvest: '最近收获：{name}，{d} 天后', chipNone: '近期没有收获',
  today: '今天', dayOf: '第 {d} 天 / 共 {t} 天', harvestOn: '收获 {date}', daysLeft: '还剩 {d} 天', done: '已收获', pasture: '常年牧场', noCrop: '未登记季节',
  next: '下一季：{crop}', forecast: '预测 {v} sc/ha', decide: '决策', noFields: '添加地块后即可查看季节。',
  chartTitle: '这块地哪种方案收益更高？', chartSub: '横条为基准情景下每公顷预估利润；线段从悲观到乐观。标签颜色代表风险。',
  details: '查看详情、调整价格和日期', adopt: '采用', best: '最佳',
  heroCur: '当前季节', heroCurText: '{n} 块地在生产 · {harvest}', heroCurNone: '目前没有地块在生产',
  heroSwitch: '更换作物', heroSwitchText: '{field}：{name} 每公顷约 {m}，风险{risk}', heroSwitchNone: '看看下一周期哪种作物收益更高', heroOpen: '打开',
  fabCur: '当前季节', fabSwitch: '更换作物', exampleShort: '使用示例数据',
};
const fr: D = {
  chipHarvestToday: 'Récolte aujourd’hui : {name}',
  hub: 'Saison et décisions', tabCurrent: 'Saison en cours', tabSwitch: 'Changer de culture',
  curTitle: 'Où en est la saison de la ferme', curSub: 'Chaque barre va du semis à la récolte. La ligne foncée est aujourd’hui. Touchez une parcelle pour décider de la prochaine saison.',
  chipFields: '{n} parcelles', chipArea: '{ha} ha', chipHarvest: 'Prochaine récolte : {name}, dans {d} jour(s)', chipNone: 'Aucune récolte en vue',
  today: 'Aujourd’hui', dayOf: 'jour {d} sur {t}', harvestOn: 'récolte {date}', daysLeft: 'il reste {d} jour(s)', done: 'récolté', pasture: 'Pâturage continu', noCrop: 'Aucune saison enregistrée',
  next: 'Suivante : {crop}', forecast: 'prévision {v} sc/ha', decide: 'Décider', noFields: 'Ajoutez une parcelle pour voir la saison.',
  chartTitle: 'Quelle stratégie rapporte le plus sur cette parcelle ?', chartSub: 'La barre montre la marge estimée par hectare dans le scénario de base ; le trait va du pessimiste à l’optimiste. Couleur de l’étiquette = risque.',
  details: 'Voir les détails, ajuster prix et dates', adopt: 'Adopter', best: 'Meilleure',
  heroCur: 'Saison en cours', heroCurText: '{n} parcelles en production · {harvest}', heroCurNone: 'Aucune parcelle en production pour l’instant',
  heroSwitch: 'Changer de culture', heroSwitchText: '{field} : {name} rapporte environ {m} par hectare, risque {risk}', heroSwitchNone: 'Voyez quelle culture rapporte le plus au prochain cycle', heroOpen: 'Ouvrir',
  fabCur: 'Saison en cours', fabSwitch: 'Changer de culture', exampleShort: 'avec données d’exemple',
};
const ALL: Record<string, D> = { pt, en, es, de, zh, fr };

export function sf(key: string, params?: Record<string, string | number>): string {
  let s = (ALL[getCurrentLanguage()] || en)[key] ?? en[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
