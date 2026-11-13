import { getCurrentLanguage } from '../i18n';

type D = Record<string, string>;

const pt: D = {
  hi: 'Olá! Eu sou a Estrela.',
  role: 'A inteligência artificial que ajuda o produtor a tomar decisões.',
  lead: 'Eu acompanho a sua fazenda e aviso na hora certa:',
  f1: 'Clima e previsão hora a hora', f2: 'Risco de plantio com dados da NASA', f3: 'Diário da lavoura por voz ou texto', f4: 'Mercado e melhor troca de safra',
  start: 'Começar conversa', skip: 'Pular apresentação',
};
const en: D = {
  hi: "Hi! I'm Estrela.",
  role: 'The artificial intelligence that helps farmers make decisions.',
  lead: 'I keep an eye on your farm and let you know at the right time:',
  f1: 'Hourly weather and forecast', f2: 'Planting risk with NASA data', f3: 'Field diary by voice or text', f4: 'Market and best crop switch',
  start: 'Start chatting', skip: 'Skip introduction',
};
const es: D = {
  hi: '¡Hola! Soy Estrela.',
  role: 'La inteligencia artificial que ayuda al productor a tomar decisiones.',
  lead: 'Sigo su finca y le aviso en el momento justo:',
  f1: 'Clima y pronóstico por hora', f2: 'Riesgo de siembra con datos de la NASA', f3: 'Diario del cultivo por voz o texto', f4: 'Mercado y mejor cambio de cultivo',
  start: 'Empezar conversación', skip: 'Saltar presentación',
};
const de: D = {
  hi: 'Hallo! Ich bin Estrela.',
  role: 'Die künstliche Intelligenz, die Landwirten bei Entscheidungen hilft.',
  lead: 'Ich behalte Ihren Betrieb im Blick und melde mich zur richtigen Zeit:',
  f1: 'Wetter und Stundenvorhersage', f2: 'Aussaatrisiko mit NASA-Daten', f3: 'Feldtagebuch per Sprache oder Text', f4: 'Markt und beste Fruchtfolge',
  start: 'Gespräch beginnen', skip: 'Vorstellung überspringen',
};
const zh: D = {
  hi: '你好！我是 Estrela。',
  role: '帮助农户做决策的人工智能。',
  lead: '我会关注你的农场，并在合适的时候提醒你：',
  f1: '天气与逐小时预报', f2: '基于 NASA 数据的播种风险', f3: '语音或文字记录田间日志', f4: '市场行情与最佳换茬',
  start: '开始对话', skip: '跳过介绍',
};
const fr: D = {
  hi: 'Bonjour ! Je suis Estrela.',
  role: "L'intelligence artificielle qui aide l'agriculteur à prendre ses décisions.",
  lead: 'Je suis votre exploitation et je vous préviens au bon moment :',
  f1: 'Météo et prévision heure par heure', f2: 'Risque de semis avec les données de la NASA', f3: 'Journal de culture à la voix ou par écrit', f4: 'Marché et meilleur changement de culture',
  start: 'Commencer la conversation', skip: 'Passer la présentation',
};
const ALL: Record<string, D> = { pt, en, es, de, zh, fr };

export function it(key: string): string {
  return (ALL[getCurrentLanguage()] || en)[key] ?? en[key] ?? key;
}
