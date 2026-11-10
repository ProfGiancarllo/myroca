import { CropPhaseKey, CropPhaseInfo, CROP_PHASE_META, Talhao } from '../types';

/**
 * Standard crops supported in MyRoça with their predefined cycle days and thematic colors
 */
export const STANDARD_CROPS = [
  'Soja',
  'Milho',
  'Pastagem',
  'Feijão',
  'Sorgo',
  'Algodão',
  'Cana-de-açúcar',
  'Trigo',
  'Outra',
] as const;

export type StandardCropName = (typeof STANDARD_CROPS)[number];

export const DEFAULT_CROP_CYCLES: Record<string, number | null> = {
  Soja: 115,
  Milho: 120,
  Feijão: 90,
  Sorgo: 110,
  Algodão: 180,
  Trigo: 100,
  Pastagem: null, // perene (sem ciclo)
  'Cana-de-açúcar': 365,
};

/**
 * Colors based on crop according to prompt specification:
 * Soja: Verde (#16a34a)
 * Milho: Amarelo (#eab308)
 * Pastagem: Verde-oliva (#65a30d)
 * Feijão: Marrom-avermelhado (#9a3412)
 * Sorgo: Laranja-âmbar (#d97706)
 * Algodão: Azul-celeste claro (#0284c7)
 * Cana-de-açúcar: Verde-esmeralda (#059669)
 * Trigo: Dourado trigo (#ca8a04)
 * Sem cultura / Desconhecida: Cinza (#64748b)
 */
export const CROP_COLORS: Record<string, string> = {
  Soja: '#16a34a',
  Milho: '#eab308',
  Pastagem: '#65a30d',
  Feijão: '#9a3412',
  Sorgo: '#d97706',
  Algodão: '#0284c7',
  'Cana-de-açúcar': '#059669',
  Trigo: '#ca8a04',
  'Sem cultura': '#64748b',
};

/**
 * Returns the theme color for a talhão based on its crop
 */
export function getCropColor(cropName?: string): string {
  if (!cropName || !cropName.trim()) {
    return '#64748b'; // Cinza para talhão sem cultura
  }
  const clean = cropName.trim();
  const lower = clean.toLowerCase();

  if (lower.includes('soja')) return CROP_COLORS['Soja'];
  if (lower.includes('milho')) return CROP_COLORS['Milho'];
  if (lower.includes('pasto') || lower.includes('braquiária') || lower.includes('brachiaria')) return CROP_COLORS['Pastagem'];
  if (lower.includes('feij') || lower.includes('feijao')) return CROP_COLORS['Feijão'];
  if (lower.includes('sorgo')) return CROP_COLORS['Sorgo'];
  if (lower.includes('algod')) return CROP_COLORS['Algodão'];
  if (lower.includes('cana')) return CROP_COLORS['Cana-de-açúcar'];
  if (lower.includes('trigo')) return CROP_COLORS['Trigo'];

  // Check direct match
  if (CROP_COLORS[clean]) return CROP_COLORS[clean];

  // Specific custom crop color
  return '#8b5cf6'; // Roxo vibrante para "Outra" cultura
}

/**
 * Default reference date ("Hoje") specified in the prompt: 09/11/2026
 */
export const DEFAULT_REFERENCE_DATE = '2026-11-09';

import { formatDateWithWeekdayI18n, formatDateShortI18n } from '../i18n';

/**
 * Formats a YYYY-MM-DD date into localized formatted string with weekday
 */
export function formatBrDateWithWeekday(dateStr: string): string {
  return formatDateWithWeekdayI18n(dateStr);
}

/**
 * Formats a YYYY-MM-DD date into localized short format
 */
export function formatBrDateShort(dateStr: string): string {
  return formatDateShortI18n(dateStr);
}

/**
 * Parses Brazilian date (DD/MM/YYYY) or YYYY-MM-DD to standard YYYY-MM-DD
 */
export function normalizeDateToISO(input: string): string {
  if (!input) return '';
  input = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }
  const brMatch = input.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (brMatch) {
    const day = brMatch[1].padStart(2, '0');
    const month = brMatch[2].padStart(2, '0');
    const year = brMatch[3];
    return `${year}-${month}-${day}`;
  }
  return input;
}

/**
 * Adds a given number of days to a YYYY-MM-DD date
 */
export function addDaysToDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Computes difference in calendar days between dateB and dateA (dateB - dateA)
 */
export function diffDays(dateAStr: string, dateBStr: string): number {
  const [y1, m1, d1] = dateAStr.split('-').map(Number);
  const [y2, m2, d2] = dateBStr.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((t2 - t1) / msPerDay);
}

/**
 * Calculates expected harvest date from planting date and cycle days
 */
export function calculateExpectedHarvestDate(plantingDate: string, cycleDays: number): string {
  if (!plantingDate || !cycleDays || cycleDays <= 0) return '';
  return addDaysToDate(plantingDate, cycleDays);
}

export interface TalhaoCropStatus {
  phase: CropPhaseInfo;
  daysPassed: number;
  daysRemaining: number;
  progressPercent: number;
  expectedHarvest: string;
  isPasture: boolean;
  statusText: string;
  stageBadgeText: string;
}

/**
 * Computes the agricultural phase of a talhão relative to the reference date ("Hoje")
 */
export function calculateTalhaoCropStatus(talhao: Talhao, referenceDate: string): TalhaoCropStatus {
  const cropLower = (talhao.crop || '').toLowerCase();
  const isPasture = cropLower.includes('pastag') || cropLower.includes('brachiaria') || cropLower.includes('braquiária');

  // Pastagem contínua sem plantio recente
  if (isPasture && (!talhao.plantingDate || !talhao.cycleDays || talhao.cycleDays <= 0)) {
    return {
      phase: CROP_PHASE_META.pastagem,
      daysPassed: 0,
      daysRemaining: 0,
      progressPercent: 100,
      expectedHarvest: 'Contínua / Pastejo rotacionado',
      isPasture: true,
      statusText: 'Pastagem perene formada (em pastejo)',
      stageBadgeText: 'Pastagem Perene',
    };
  }

  // Talhão sem safra cadastrada
  if (!talhao.plantingDate || !talhao.cycleDays || talhao.cycleDays <= 0) {
    return {
      phase: CROP_PHASE_META.planejamento,
      daysPassed: 0,
      daysRemaining: 0,
      progressPercent: 0,
      expectedHarvest: 'Não definida',
      isPasture: false,
      statusText: 'Sem safra ativa cadastrada (em pousio)',
      stageBadgeText: 'Em Pousio',
    };
  }

  const plantingDate = normalizeDateToISO(talhao.plantingDate);
  const cycleDays = talhao.cycleDays;
  const expectedHarvest = talhao.harvestDateExpected || calculateExpectedHarvestDate(plantingDate, cycleDays);

  const daysSincePlanting = diffDays(plantingDate, referenceDate);
  const daysUntilHarvest = diffDays(referenceDate, expectedHarvest);

  // Antes do plantio
  if (daysSincePlanting < 0) {
    const daysUntilPlanting = Math.abs(daysSincePlanting);
    if (daysUntilPlanting <= 18) {
      return {
        phase: CROP_PHASE_META.preparo,
        daysPassed: 0,
        daysRemaining: daysUntilPlanting,
        progressPercent: 5,
        expectedHarvest: formatBrDateShort(expectedHarvest),
        isPasture: false,
        statusText: `Preparo do solo (plantio previsto em ${daysUntilPlanting} dias)`,
        stageBadgeText: `Preparo (${daysUntilPlanting}d para plantio)`,
      };
    } else {
      return {
        phase: CROP_PHASE_META.planejamento,
        daysPassed: 0,
        daysRemaining: daysUntilPlanting,
        progressPercent: 0,
        expectedHarvest: formatBrDateShort(expectedHarvest),
        isPasture: false,
        statusText: `Planejamento de safra (${daysUntilPlanting} dias até o plantio)`,
        stageBadgeText: 'Planejamento',
      };
    }
  }

  // Plantio recente (0 a 4 dias)
  if (daysSincePlanting <= 4) {
    return {
      phase: CROP_PHASE_META.plantio,
      daysPassed: daysSincePlanting,
      daysRemaining: cycleDays - daysSincePlanting,
      progressPercent: Math.round((daysSincePlanting / cycleDays) * 100),
      expectedHarvest: formatBrDateShort(expectedHarvest),
      isPasture: false,
      statusText: `Plantio recém-realizado (Dia ${daysSincePlanting} do ciclo)`,
      stageBadgeText: `Plantio (Dia ${daysSincePlanting})`,
    };
  }

  const progress = daysSincePlanting / cycleDays;
  const progressPercent = Math.min(100, Math.max(0, Math.round(progress * 100)));

  // Emergência (~5 a 14 dias ou progress < 0.12)
  if (progress < 0.12) {
    return {
      phase: CROP_PHASE_META.emergencia,
      daysPassed: daysSincePlanting,
      daysRemaining: cycleDays - daysSincePlanting,
      progressPercent,
      expectedHarvest: formatBrDateShort(expectedHarvest),
      isPasture: false,
      statusText: `Emergência e estabelecimento (${daysSincePlanting} dias de ${cycleDays} dias)`,
      stageBadgeText: `Emergência (${progressPercent}%)`,
    };
  }

  // Crescimento Vegetativo (V2 - Vn: ~12% a 40%)
  if (progress < 0.40) {
    return {
      phase: CROP_PHASE_META.crescimento,
      daysPassed: daysSincePlanting,
      daysRemaining: cycleDays - daysSincePlanting,
      progressPercent,
      expectedHarvest: formatBrDateShort(expectedHarvest),
      isPasture: false,
      statusText: `Crescimento vegetativo vigoroso (${daysSincePlanting} dias de ${cycleDays} dias)`,
      stageBadgeText: `Crescimento (${daysSincePlanting}d / ${progressPercent}%)`,
    };
  }

  // Floração (R1 - R2: ~40% a 58%)
  if (progress < 0.58) {
    return {
      phase: CROP_PHASE_META.floracao,
      daysPassed: daysSincePlanting,
      daysRemaining: cycleDays - daysSincePlanting,
      progressPercent,
      expectedHarvest: formatBrDateShort(expectedHarvest),
      isPasture: false,
      statusText: `Floração e fixação de vagens (${daysSincePlanting} dias de ${cycleDays} dias)`,
      stageBadgeText: `Floração (${daysSincePlanting}d / ${progressPercent}%)`,
    };
  }

  // Enchimento de grãos (R3 - R6: ~58% a 88%)
  if (progress < 0.88) {
    return {
      phase: CROP_PHASE_META.enchimento,
      daysPassed: daysSincePlanting,
      daysRemaining: cycleDays - daysSincePlanting,
      progressPercent,
      expectedHarvest: formatBrDateShort(expectedHarvest),
      isPasture: false,
      statusText: `Enchimento e granação (${daysSincePlanting} dias de ${cycleDays} dias - colheita em ${daysUntilHarvest} dias)`,
      stageBadgeText: `Enchimento (${daysUntilHarvest}d para colheita)`,
    };
  }

  // Maturação e Colheita (R7 - R8 / Colheita: 88% a 105%)
  if (progress <= 1.05) {
    return {
      phase: CROP_PHASE_META.colheita,
      daysPassed: daysSincePlanting,
      daysRemaining: Math.max(0, daysUntilHarvest),
      progressPercent: 100,
      expectedHarvest: formatBrDateShort(expectedHarvest),
      isPasture: false,
      statusText: `Maturação / Ponto de colheita (${daysSincePlanting} dias de ${cycleDays} dias)`,
      stageBadgeText: 'Ponto de Colheita 🌾',
    };
  }

  // Safra colhida / entressafra
  const daysSinceHarvest = daysSincePlanting - cycleDays;
  return {
    phase: CROP_PHASE_META.colhido,
    daysPassed: daysSincePlanting,
    daysRemaining: 0,
    progressPercent: 100,
    expectedHarvest: formatBrDateShort(expectedHarvest),
    isPasture: false,
    statusText: `Safra colhida há ${daysSinceHarvest} dias (Aguardando próxima safra)`,
    stageBadgeText: 'Colhido / Entressafra',
  };
}

/**
 * Validates crop date overlap for a talhão:
 * Ensures two crops do not run at the same time in the same talhão!
 */
export function checkCropDatesOverlap(
  currentPlantingDate: string,
  currentCycleDays: number,
  nextCropPlantingDate: string
): { hasOverlap: boolean; message: string } {
  if (!currentPlantingDate || !currentCycleDays || !nextCropPlantingDate) {
    return { hasOverlap: false, message: '' };
  }

  const currentPlant = normalizeDateToISO(currentPlantingDate);
  const nextPlant = normalizeDateToISO(nextCropPlantingDate);
  const currentHarvest = calculateExpectedHarvestDate(currentPlant, currentCycleDays);

  const diff = diffDays(nextPlant, currentHarvest);
  // If nextPlant is earlier than currentHarvest, there's an overlap!
  if (diff > 0) {
    const overlapDays = diff;
    return {
      hasOverlap: true,
      message: `Atenção: A próxima safra está planejada para iniciar em ${formatBrDateShort(nextPlant)}, mas a colheita da safra atual só acontece em ${formatBrDateShort(currentHarvest)} (${overlapDays} dias de sobreposição). Não é permitido ter duas culturas simultâneas no mesmo talhão!`,
    };
  }

  return { hasOverlap: false, message: '' };
}
