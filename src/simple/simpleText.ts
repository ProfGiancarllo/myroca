import { getCurrentLanguage } from '../i18n';
type D = Record<string, string>;
const pt: D = {
  full: 'Ver a fazenda', simple: 'Modo Simples', hello: 'Bom dia', todo: 'O que fazer hoje',
  allDone: 'Tudo em dia. Nenhuma pendência.', todoN: 'A Estela precisa saber {n} coisa(s) da sua fazenda.',
  voice: 'Responder falando', typed: 'Responder digitando', weather: 'Clima agora', fix: 'Corrigir',
  adv_ok: 'Bom dia para o trabalho no campo.', adv_rain: 'Evite aplicar defensivos agora.', adv_storm: 'Evite ficar no campo: risco de raios.',
  nasa: 'Risco de plantio (dados da NASA)', loading: 'Consultando a NASA…', nasaFail: 'Sem dados da NASA agora.',
  record: 'Registrar agora', talk: 'Falar com a Estela', plan: 'Planejar a próxima safra', noField: 'Você ainda não tem talhões. Abra a fazenda para desenhar o primeiro.',
  day: 'dia {d} de {t}', open: 'Abrir a fazenda',
};
const en: D = {
  full: 'View the farm', simple: 'Simple mode', hello: 'Good morning', todo: 'What to do today',
  allDone: 'All up to date. Nothing pending.', todoN: 'Estela needs {n} thing(s) about your farm.',
  voice: 'Answer by voice', typed: 'Answer by typing', weather: 'Weather now', fix: 'Correct',
  adv_ok: 'Good day for field work.', adv_rain: 'Avoid spraying right now.', adv_storm: 'Stay out of the field: lightning risk.',
  nasa: 'Planting risk (NASA data)', loading: 'Asking NASA…', nasaFail: 'No NASA data right now.',
  record: 'Record now', talk: 'Talk to Estela', plan: 'Plan the next season', noField: 'You have no fields yet. Open the farm to draw the first one.',
  day: 'day {d} of {t}', open: 'Open the farm',
};
const es: D = {
  full: 'Ver la finca', simple: 'Modo Simple', hello: 'Buenos días', todo: 'Qué hacer hoy',
  allDone: 'Todo al día. Nada pendiente.', todoN: 'Estela necesita saber {n} cosa(s) de su finca.',
  voice: 'Responder hablando', typed: 'Responder escribiendo', weather: 'Clima ahora', fix: 'Corregir',
  adv_ok: 'Buen día para el trabajo en el campo.', adv_rain: 'Evite aplicar productos ahora.', adv_storm: 'Evite estar en el campo: riesgo de rayos.',
  nasa: 'Riesgo de siembra (datos de la NASA)', loading: 'Consultando a la NASA…', nasaFail: 'Sin datos de la NASA ahora.',
  record: 'Registrar ahora', talk: 'Hablar con Estela', plan: 'Planificar la próxima zafra', noField: 'Aún no tiene lotes. Abra la finca para dibujar el primero.',
  day: 'día {d} de {t}', open: 'Abrir la finca',
};
const de: D = {
  full: 'Farm ansehen', simple: 'Einfacher Modus', hello: 'Guten Morgen', todo: 'Was heute zu tun ist',
  allDone: 'Alles aktuell. Nichts offen.', todoN: 'Estela braucht {n} Angabe(n) zu Ihrer Farm.',
  voice: 'Per Sprache antworten', typed: 'Per Tippen antworten', weather: 'Wetter jetzt', fix: 'Korrigieren',
  adv_ok: 'Guter Tag für die Feldarbeit.', adv_rain: 'Jetzt nicht spritzen.', adv_storm: 'Nicht aufs Feld: Blitzgefahr.',
  nasa: 'Aussaatrisiko (NASA-Daten)', loading: 'NASA wird abgefragt…', nasaFail: 'Derzeit keine NASA-Daten.',
  record: 'Jetzt erfassen', talk: 'Mit Estela sprechen', plan: 'Nächste Saison planen', noField: 'Noch keine Felder. Öffnen Sie die Farm, um das erste zu zeichnen.',
  day: 'Tag {d} von {t}', open: 'Farm öffnen',
};
const zh: D = {
  full: '查看农场', simple: '简易模式', hello: '早上好', todo: '今天要做什么',
  allDone: '一切就绪，没有待办。', todoN: 'Estela 需要了解农场的 {n} 项信息。',
  voice: '语音回答', typed: '打字回答', weather: '当前天气', fix: '更正',
  adv_ok: '适合下地干活的好天气。', adv_rain: '现在不要施药。', adv_storm: '不要下地：有雷击风险。',
  nasa: '播种风险（NASA 数据）', loading: '正在查询 NASA…', nasaFail: '暂无 NASA 数据。',
  record: '立即记录', talk: '和 Estela 对话', plan: '规划下一季', noField: '还没有地块。请打开农场绘制第一块。',
  day: '第 {d} 天 / 共 {t} 天', open: '打开农场',
};
const fr: D = {
  full: 'Voir la ferme', simple: 'Mode simple', hello: 'Bonjour', todo: 'Quoi faire aujourd’hui',
  allDone: 'Tout est à jour. Rien en attente.', todoN: 'Estela a besoin de {n} information(s) sur votre ferme.',
  voice: 'Répondre à la voix', typed: 'Répondre en écrivant', weather: 'Météo maintenant', fix: 'Corriger',
  adv_ok: 'Bonne journée pour travailler aux champs.', adv_rain: 'Évitez de traiter maintenant.', adv_storm: 'Évitez les champs : risque de foudre.',
  nasa: 'Risque de semis (données NASA)', loading: 'Interrogation de la NASA…', nasaFail: 'Pas de données NASA pour l’instant.',
  record: 'Enregistrer', talk: 'Parler à Estela', plan: 'Planifier la saison suivante', noField: 'Pas encore de parcelles. Ouvrez la ferme pour dessiner la première.',
  day: 'jour {d} sur {t}', open: 'Ouvrir la ferme',
};
const ALL: Record<string, D> = { pt, en, es, de, zh, fr };
export function sx(key: string, params?: Record<string, string | number>): string {
  let s = (ALL[getCurrentLanguage()] || en)[key] ?? en[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
