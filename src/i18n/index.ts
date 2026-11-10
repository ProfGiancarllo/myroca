import { LanguageCode, LanguageOption, SUPPORTED_LANGUAGES, TranslationDictionary } from './types';
import { translations } from './translations';

const STORAGE_KEY = 'myroca_language';

type Listener = (lang: LanguageCode) => void;
const listeners: Listener[] = [];

/**
 * Detect user's preferred language from browser or stored preference
 */
function detectInitialLanguage(): LanguageCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (saved === 'pt' || saved === 'es' || saved === 'en' || saved === 'de' || saved === 'zh' || saved === 'fr')) {
      return saved as LanguageCode;
    }

    const browserLang = (navigator.language || (navigator as { userLanguage?: string }).userLanguage || '').toLowerCase();
    if (browserLang.startsWith('pt')) return 'pt';
    if (browserLang.startsWith('es')) return 'es';
    if (browserLang.startsWith('de')) return 'de';
    if (browserLang.startsWith('zh')) return 'zh';
    if (browserLang.startsWith('fr')) return 'fr';
    if (browserLang.startsWith('en')) return 'en';
  } catch {
    // ignore localStorage errors in sandboxed iframes
  }

  return 'pt'; // Default: Português (pt-BR)
}

let currentLanguage: LanguageCode = detectInitialLanguage();

export function getCurrentLanguage(): LanguageCode {
  return currentLanguage;
}

export function setLanguage(lang: LanguageCode): void {
  if (currentLanguage === lang) return;
  currentLanguage = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore
  }

  // Update HTML lang attribute
  if (typeof document !== 'undefined') {
    const htmlLang = lang === 'pt' ? 'pt-BR' : lang === 'zh' ? 'zh-CN' : lang;
    document.documentElement.lang = htmlLang;
  }

  for (const listener of listeners) {
    try {
      listener(lang);
    } catch (err) {
      console.error('Error in language listener:', err);
    }
  }
}

export function onLanguageChange(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

export function getAvailableLanguages(): LanguageOption[] {
  return SUPPORTED_LANGUAGES;
}

export function getDictionary(lang = currentLanguage): TranslationDictionary {
  return translations[lang] || translations.pt;
}

/**
 * Returns translated string for given key, replacing {param} placeholders if provided
 */
export function t(key: keyof TranslationDictionary, params?: Record<string, string | number>): string {
  const dict = getDictionary();
  let str: string = dict[key] || translations.pt[key] || key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }

  return str;
}

/**
 * Format numbers according to B5:
 * pt, es, de, fr: comma as decimal separator (12,34)
 * en, zh: point as decimal separator (12.34)
 */
export function formatNumber(val: number, decimals = 2): string {
  const fixed = val.toFixed(decimals);
  const lang = currentLanguage;

  if (lang === 'en' || lang === 'zh') {
    return fixed;
  }

  return fixed.replace('.', ',');
}

/**
 * Format area strictly in hectares (ha) in all languages (no acres conversion)
 */
export function formatHectaresI18n(val: number): string {
  return `${formatNumber(val, 2)} ha`;
}

/**
 * Format distance in kilometers
 */
export function formatKmI18n(val: number): string {
  return `${formatNumber(val, 2)} km`;
}

/**
 * Format date string (YYYY-MM-DD) according to local language standard:
 * pt, es, fr: DD/MM/AAAA
 * de: DD.MM.AAAA
 * en: MM/DD/YYYY
 * zh: YYYY年MM月DD日
 */
export function formatDateI18n(dateStr?: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;

  const [year, month, day] = parts;
  const lang = currentLanguage;

  switch (lang) {
    case 'en':
      return `${month}/${day}/${year}`;
    case 'de':
      return `${day}.${month}.${year}`;
    case 'zh':
      return `${year}年${month}月${day}日`;
    case 'pt':
    case 'es':
    case 'fr':
    default:
      return `${day}/${month}/${year}`;
  }
}

/**
 * Short formatted date (e.g. DD/MM, DD.MM., MM/DD, or MM月DD日)
 */
export function formatDateShortI18n(dateStr?: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;

  const [, month, day] = parts;
  const lang = currentLanguage;

  switch (lang) {
    case 'en':
      return `${month}/${day}`;
    case 'de':
      return `${day}.${month}.`;
    case 'zh':
      return `${month}月${day}日`;
    case 'pt':
    case 'es':
    case 'fr':
    default:
      return `${day}/${month}`;
  }
}

/**
 * Formats date with weekday name in current language
 */
export function formatDateWithWeekdayI18n(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const dateObj = new Date(year, month, day, 12, 0, 0);

  const lang = currentLanguage;
  const formattedDate = formatDateI18n(dateStr);

  const weekdays: Record<LanguageCode, string[]> = {
    pt: ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'],
    es: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    de: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
    zh: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
    fr: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
  };

  const dayOfWeek = weekdays[lang][dateObj.getDay()];

  if (lang === 'zh') {
    return `${formattedDate} ${dayOfWeek}`;
  }

  return `${formattedDate} (${dayOfWeek})`;
}

/**
 * Translate standard crop name into current language
 */
export function translateCropName(cropName: string | undefined): string {
  if (!cropName || !cropName.trim()) {
    return t('cropSemCultura');
  }

  const normalized = cropName.trim().toLowerCase();
  if (normalized === 'soja' || normalized === 'soybean' || normalized === '大豆') return t('cropSoja');
  if (normalized === 'milho' || normalized === 'corn' || normalized === 'maíz' || normalized === 'mais' || normalized === '玉米') return t('cropMilho');
  if (normalized === 'pastagem' || normalized === 'pasture' || normalized === 'pastura' || normalized === 'dauerweide' || normalized === '牧草') return t('cropPastagem');
  if (normalized === 'feijão' || normalized === 'feijao' || normalized === 'bean' || normalized === 'frijol' || normalized === '菜豆') return t('cropFeijao');
  if (normalized === 'sorgo' || normalized === 'sorghum' || normalized === '高粱') return t('cropSorgo');
  if (normalized === 'algodão' || normalized === 'algodao' || normalized === 'cotton' || normalized === 'algodón' || normalized === '棉花') return t('cropAlgodao');
  if (normalized === 'cana-de-açúcar' || normalized === 'cana de acucar' || normalized === 'cana' || normalized === 'sugarcane' || normalized === '甘蔗') return t('cropCana');
  if (normalized === 'trigo' || normalized === 'wheat' || normalized === 'weizen' || normalized === '小麦') return t('cropTrigo');

  return cropName; // Return customized name as is
}

/**
 * Translate crop phase into current language
 */
export function translateCropPhase(phaseKey: string): string {
  switch (phaseKey) {
    case 'planejamento': return t('phasePlanejamento');
    case 'preparo': return t('phasePreparo');
    case 'plantio': return t('phasePlantio');
    case 'emergencia': return t('phaseEmergencia');
    case 'crescimento': return t('phaseCrescimento');
    case 'floracao': return t('phaseFloracao');
    case 'enchimento': return t('phaseEnchimento');
    case 'colheita': return t('phaseColheita');
    case 'colhido': return t('phaseColhido');
    case 'pastagem': return t('phasePastagemPerene');
    default: return phaseKey;
  }
}

/**
 * Translate farm structure type into current language
 */
export function translateStructureType(type: string): string {
  switch (type) {
    case 'sede': return t('elemSede').replace(/^Marcar\s+/, '');
    case 'curral': return t('elemCurral').replace(/^Marcar\s+/, '');
    case 'silo': return t('elemSilo').replace(/^Marcar\s+/, '');
    case 'estrada': return t('elemEstrada').replace(/^Marcar\s+/, '');
    case 'reserva': return t('elemReserva').replace(/^Marcar\s+/, '');
    case 'pivo': return t('elemPivo').replace(/^Marcar\s+/, '');
    case 'estacao_meteo': return t('elemEstacaoMeteo').replace(/^Marcar\s+/, '');
    case 'nascente': return t('elemNascente').replace(/^Marcar\s+/, '');
    case 'acude': return t('elemAcude').replace(/^Marcar\s+/, '');
    case 'poco': return t('elemPoco').replace(/^Marcar\s+/, '');
    case 'rio': return t('elemRio').replace(/^Marcar\s+/, '');
    default: return type;
  }
}

export * from './types';
export * from './translations';
