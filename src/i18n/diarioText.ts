import { getCurrentLanguage } from './index';

type D = Record<string, string>;

const pt: D = {
  btn: 'Diário de safra', title: 'Diário de safra', sub: 'Registre o que acontece em cada talhão. Quanto mais completo, melhor a decisão de safra.', close: 'Fechar',
  estela: 'Converse com a Estrela e ela atualiza para você',
  newRec: 'Novo registro', date: 'Data', where: 'Em quais talhões?', all: 'Todos ({n})', none: 'Limpar', byCrop: 'Só {c}', selN: '{n} talhão(ões) escolhido(s)',
  what: 'O que aconteceu?', product: 'Produto', cultivar: 'Cultivar', implement: 'Implemento ou método', dose: 'Quantidade', unit: 'Unidade',
  catL: 'Tipo de combate', target: 'Alvo (praga, doença ou planta daninha)', depth: 'Profundidade (cm)', rain: 'Chuva do dia (mm)',
  rainHint: 'Em branco: o MyRoça preenche com dados da NASA e do Open-Meteo.', note: 'Observações', save: 'Salvar registro',
  saved: 'Registro salvo em {n} talhão(ões).', pickField: 'Escolha pelo menos um talhão.', pickDate: 'Informe a data.',
  t_preparo: 'Preparo e descompactação', t_calagem: 'Calagem e gessagem', t_plantio: 'Plantio', t_adubacao: 'Adubação', t_foliar: 'Fertilização foliar',
  t_aplicacao: 'Combate (pragas, doenças, daninhas)', t_irrigacao: 'Irrigação', t_chuva: 'Chuva medida', t_monitoramento: 'Monitoramento da lavoura',
  t_colheita: 'Colheita', t_ocorrencia: 'Ocorrência (granizo, geada, veranico)', t_analise_solo: 'Análise de solo', t_observacao: 'Outra observação',
  c_herbicida: 'Herbicida', c_fungicida: 'Fungicida', c_inseticida: 'Inseticida', c_dessecacao: 'Dessecação', c_outro: 'Outro',
  timeline: 'Linha do tempo', fField: 'Talhão', fAll: 'Todos os talhões', fType: 'Tipo', fAllTypes: 'Todos os tipos',
  empty: 'Nenhum registro ainda. Use o formulário acima.', del: 'Apagar', delSure: 'Apagar?',
  complete: 'Preenchimento do diário', completeN: '{a} de {n} talhões com registro nos últimos 7 dias', missing: 'Sem registro há 7 dias ou mais', register: 'Registrar',
  fieldsN: '{n} talhões', fetching: 'Buscando clima…', noWx: 'Sem dado de clima para este dia.', wxAuto: 'Clima automático',
  wxFilled: 'Clima do dia preenchido sozinho por NASA POWER e Open-Meteo em {n} dia(s).', farmWx: 'Clima na fazenda', more: 'Mostrar mais', grp: 'Registrado junto em {n} talhões',
  fromProducer: 'Produtor',
};

const en: D = {
  btn: 'Crop diary', title: 'Crop diary', sub: 'Record what happens in each field. The more complete it is, the better the crop decision.', close: 'Close',
  estela: 'Talk to Estrela and she updates it for you',
  newRec: 'New entry', date: 'Date', where: 'Which fields?', all: 'All ({n})', none: 'Clear', byCrop: 'Only {c}', selN: '{n} field(s) selected',
  what: 'What happened?', product: 'Product', cultivar: 'Cultivar', implement: 'Implement or method', dose: 'Amount', unit: 'Unit',
  catL: 'Type of control', target: 'Target (pest, disease or weed)', depth: 'Depth (cm)', rain: 'Rain of the day (mm)',
  rainHint: 'Leave blank: MyRoça fills it in with NASA and Open-Meteo data.', note: 'Notes', save: 'Save entry',
  saved: 'Entry saved in {n} field(s).', pickField: 'Choose at least one field.', pickDate: 'Enter the date.',
  t_preparo: 'Tillage and decompaction', t_calagem: 'Liming and gypsum', t_plantio: 'Planting', t_adubacao: 'Fertilizing', t_foliar: 'Foliar fertilization',
  t_aplicacao: 'Control (pests, diseases, weeds)', t_irrigacao: 'Irrigation', t_chuva: 'Measured rain', t_monitoramento: 'Crop scouting',
  t_colheita: 'Harvest', t_ocorrencia: 'Event (hail, frost, dry spell)', t_analise_solo: 'Soil analysis', t_observacao: 'Other note',
  c_herbicida: 'Herbicide', c_fungicida: 'Fungicide', c_inseticida: 'Insecticide', c_dessecacao: 'Burndown', c_outro: 'Other',
  timeline: 'Timeline', fField: 'Field', fAll: 'All fields', fType: 'Type', fAllTypes: 'All types',
  empty: 'No entries yet. Use the form above.', del: 'Delete', delSure: 'Delete?',
  complete: 'Diary completeness', completeN: '{a} of {n} fields with an entry in the last 7 days', missing: 'No entry for 7 days or more', register: 'Record',
  fieldsN: '{n} fields', fetching: 'Fetching weather…', noWx: 'No weather data for this day.', wxAuto: 'Automatic weather',
  wxFilled: 'Daily weather filled in automatically by NASA POWER and Open-Meteo for {n} day(s).', farmWx: 'Weather on the farm', more: 'Show more', grp: 'Recorded together in {n} fields',
  fromProducer: 'Farmer',
};

const es: D = {
  btn: 'Diario de cosecha', title: 'Diario de cosecha', sub: 'Registre lo que ocurre en cada lote. Cuanto más completo, mejor la decisión de cultivo.', close: 'Cerrar',
  estela: 'Hable con Estrella y ella lo actualiza por usted',
  newRec: 'Nuevo registro', date: 'Fecha', where: '¿En qué lotes?', all: 'Todos ({n})', none: 'Limpiar', byCrop: 'Solo {c}', selN: '{n} lote(s) elegido(s)',
  what: '¿Qué ocurrió?', product: 'Producto', cultivar: 'Cultivar', implement: 'Implemento o método', dose: 'Cantidad', unit: 'Unidad',
  catL: 'Tipo de control', target: 'Objetivo (plaga, enfermedad o maleza)', depth: 'Profundidad (cm)', rain: 'Lluvia del día (mm)',
  rainHint: 'En blanco: MyRoça lo completa con datos de la NASA y de Open-Meteo.', note: 'Observaciones', save: 'Guardar registro',
  saved: 'Registro guardado en {n} lote(s).', pickField: 'Elija al menos un lote.', pickDate: 'Indique la fecha.',
  t_preparo: 'Preparación y descompactación', t_calagem: 'Encalado y yeso', t_plantio: 'Siembra', t_adubacao: 'Fertilización', t_foliar: 'Fertilización foliar',
  t_aplicacao: 'Control (plagas, enfermedades, malezas)', t_irrigacao: 'Riego', t_chuva: 'Lluvia medida', t_monitoramento: 'Monitoreo del cultivo',
  t_colheita: 'Cosecha', t_ocorrencia: 'Evento (granizo, helada, sequía corta)', t_analise_solo: 'Análisis de suelo', t_observacao: 'Otra observación',
  c_herbicida: 'Herbicida', c_fungicida: 'Fungicida', c_inseticida: 'Insecticida', c_dessecacao: 'Desecación', c_outro: 'Otro',
  timeline: 'Línea de tiempo', fField: 'Lote', fAll: 'Todos los lotes', fType: 'Tipo', fAllTypes: 'Todos los tipos',
  empty: 'Aún no hay registros. Use el formulario de arriba.', del: 'Borrar', delSure: '¿Borrar?',
  complete: 'Llenado del diario', completeN: '{a} de {n} lotes con registro en los últimos 7 días', missing: 'Sin registro hace 7 días o más', register: 'Registrar',
  fieldsN: '{n} lotes', fetching: 'Buscando clima…', noWx: 'Sin datos de clima para este día.', wxAuto: 'Clima automático',
  wxFilled: 'Clima del día completado solo por NASA POWER y Open-Meteo en {n} día(s).', farmWx: 'Clima en la finca', more: 'Mostrar más', grp: 'Registrado junto en {n} lotes',
  fromProducer: 'Productor',
};

const de: D = {
  btn: 'Anbautagebuch', title: 'Anbautagebuch', sub: 'Erfassen Sie, was auf jedem Feld passiert. Je vollständiger, desto besser die Anbauentscheidung.', close: 'Schließen',
  estela: 'Sprechen Sie mit Estrela, sie trägt es für Sie ein',
  newRec: 'Neuer Eintrag', date: 'Datum', where: 'Welche Felder?', all: 'Alle ({n})', none: 'Leeren', byCrop: 'Nur {c}', selN: '{n} Feld(er) gewählt',
  what: 'Was ist passiert?', product: 'Produkt', cultivar: 'Sorte', implement: 'Gerät oder Methode', dose: 'Menge', unit: 'Einheit',
  catL: 'Art der Bekämpfung', target: 'Ziel (Schädling, Krankheit oder Unkraut)', depth: 'Tiefe (cm)', rain: 'Regen des Tages (mm)',
  rainHint: 'Leer lassen: MyRoça ergänzt Daten von NASA und Open-Meteo.', note: 'Notizen', save: 'Eintrag speichern',
  saved: 'Eintrag in {n} Feld(ern) gespeichert.', pickField: 'Wählen Sie mindestens ein Feld.', pickDate: 'Datum angeben.',
  t_preparo: 'Bodenbearbeitung und Lockerung', t_calagem: 'Kalkung und Gips', t_plantio: 'Aussaat', t_adubacao: 'Düngung', t_foliar: 'Blattdüngung',
  t_aplicacao: 'Bekämpfung (Schädlinge, Krankheiten, Unkraut)', t_irrigacao: 'Bewässerung', t_chuva: 'Gemessener Regen', t_monitoramento: 'Bestandskontrolle',
  t_colheita: 'Ernte', t_ocorrencia: 'Ereignis (Hagel, Frost, Trockenphase)', t_analise_solo: 'Bodenanalyse', t_observacao: 'Weitere Notiz',
  c_herbicida: 'Herbizid', c_fungicida: 'Fungizid', c_inseticida: 'Insektizid', c_dessecacao: 'Abtrocknung', c_outro: 'Andere',
  timeline: 'Zeitverlauf', fField: 'Feld', fAll: 'Alle Felder', fType: 'Art', fAllTypes: 'Alle Arten',
  empty: 'Noch keine Einträge. Nutzen Sie das Formular oben.', del: 'Löschen', delSure: 'Löschen?',
  complete: 'Vollständigkeit des Tagebuchs', completeN: '{a} von {n} Feldern mit Eintrag in den letzten 7 Tagen', missing: 'Seit 7 Tagen oder länger ohne Eintrag', register: 'Eintragen',
  fieldsN: '{n} Felder', fetching: 'Wetter wird abgerufen…', noWx: 'Keine Wetterdaten für diesen Tag.', wxAuto: 'Automatisches Wetter',
  wxFilled: 'Tageswetter wurde für {n} Tag(e) automatisch von NASA POWER und Open-Meteo ergänzt.', farmWx: 'Wetter auf dem Betrieb', more: 'Mehr anzeigen', grp: 'Gemeinsam in {n} Feldern erfasst',
  fromProducer: 'Landwirt',
};

const zh: D = {
  btn: '农事日记', title: '农事日记', sub: '记录每个地块发生的事情。记录越完整，换茬决策越准确。', close: '关闭',
  estela: '和 Estrela 聊聊，她帮你更新',
  newRec: '新记录', date: '日期', where: '哪些地块？', all: '全部（{n}）', none: '清除', byCrop: '仅{c}', selN: '已选 {n} 个地块',
  what: '发生了什么？', product: '产品', cultivar: '品种', implement: '农具或方法', dose: '数量', unit: '单位',
  catL: '防治类型', target: '对象（害虫、病害或杂草）', depth: '深度（厘米）', rain: '当天降雨（毫米）',
  rainHint: '留空：MyRoça 会用 NASA 和 Open-Meteo 的数据自动填写。', note: '备注', save: '保存记录',
  saved: '已在 {n} 个地块保存记录。', pickField: '请至少选择一个地块。', pickDate: '请填写日期。',
  t_preparo: '整地与松土', t_calagem: '施石灰与石膏', t_plantio: '播种', t_adubacao: '施肥', t_foliar: '叶面施肥',
  t_aplicacao: '防治（虫、病、草）', t_irrigacao: '灌溉', t_chuva: '实测降雨', t_monitoramento: '田间巡查',
  t_colheita: '收获', t_ocorrencia: '事件（冰雹、霜冻、干旱）', t_analise_solo: '土壤分析', t_observacao: '其他备注',
  c_herbicida: '除草剂', c_fungicida: '杀菌剂', c_inseticida: '杀虫剂', c_dessecacao: '催枯', c_outro: '其他',
  timeline: '时间线', fField: '地块', fAll: '全部地块', fType: '类型', fAllTypes: '全部类型',
  empty: '还没有记录。请使用上面的表单。', del: '删除', delSure: '确认删除？',
  complete: '日记完整度', completeN: '{n} 个地块中有 {a} 个在最近 7 天有记录', missing: '7 天或更久没有记录', register: '记录',
  fieldsN: '{n} 个地块', fetching: '正在获取天气…', noWx: '当天没有天气数据。', wxAuto: '自动天气',
  wxFilled: '已由 NASA POWER 和 Open-Meteo 自动补全 {n} 天的天气。', farmWx: '农场天气', more: '显示更多', grp: '在 {n} 个地块一起记录',
  fromProducer: '农户',
};

const fr: D = {
  btn: 'Journal de culture', title: 'Journal de culture', sub: 'Notez ce qui se passe sur chaque parcelle. Plus il est complet, meilleure est la décision de culture.', close: 'Fermer',
  estela: 'Parlez à Estrela, elle le met à jour pour vous',
  newRec: 'Nouvelle entrée', date: 'Date', where: 'Quelles parcelles ?', all: 'Toutes ({n})', none: 'Effacer', byCrop: 'Seulement {c}', selN: '{n} parcelle(s) choisie(s)',
  what: 'Que s’est-il passé ?', product: 'Produit', cultivar: 'Variété', implement: 'Outil ou méthode', dose: 'Quantité', unit: 'Unité',
  catL: 'Type de lutte', target: 'Cible (ravageur, maladie ou adventice)', depth: 'Profondeur (cm)', rain: 'Pluie du jour (mm)',
  rainHint: 'Vide : MyRoça le remplit avec les données de la NASA et d’Open-Meteo.', note: 'Remarques', save: 'Enregistrer',
  saved: 'Entrée enregistrée sur {n} parcelle(s).', pickField: 'Choisissez au moins une parcelle.', pickDate: 'Indiquez la date.',
  t_preparo: 'Travail du sol et décompactage', t_calagem: 'Chaulage et gypse', t_plantio: 'Semis', t_adubacao: 'Fertilisation', t_foliar: 'Fertilisation foliaire',
  t_aplicacao: 'Lutte (ravageurs, maladies, adventices)', t_irrigacao: 'Irrigation', t_chuva: 'Pluie mesurée', t_monitoramento: 'Suivi de la culture',
  t_colheita: 'Récolte', t_ocorrencia: 'Événement (grêle, gel, sécheresse)', t_analise_solo: 'Analyse de sol', t_observacao: 'Autre remarque',
  c_herbicida: 'Herbicide', c_fungicida: 'Fongicide', c_inseticida: 'Insecticide', c_dessecacao: 'Dessiccation', c_outro: 'Autre',
  timeline: 'Chronologie', fField: 'Parcelle', fAll: 'Toutes les parcelles', fType: 'Type', fAllTypes: 'Tous les types',
  empty: 'Aucune entrée pour l’instant. Utilisez le formulaire ci-dessus.', del: 'Supprimer', delSure: 'Supprimer ?',
  complete: 'Complétude du journal', completeN: '{a} parcelles sur {n} avec une entrée ces 7 derniers jours', missing: 'Sans entrée depuis 7 jours ou plus', register: 'Noter',
  fieldsN: '{n} parcelles', fetching: 'Recherche de la météo…', noWx: 'Pas de données météo pour ce jour.', wxAuto: 'Météo automatique',
  wxFilled: 'Météo du jour complétée automatiquement par NASA POWER et Open-Meteo pour {n} jour(s).', farmWx: 'Météo sur l’exploitation', more: 'Afficher plus', grp: 'Enregistré ensemble sur {n} parcelles',
  fromProducer: 'Exploitant',
};

const ALL: Record<string, D> = { pt, en, es, de, zh, fr };
export function dj(key: string, params?: Record<string, string | number>): string {
  let s = (ALL[getCurrentLanguage()] || en)[key] ?? en[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
