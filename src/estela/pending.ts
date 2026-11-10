import { FarmData, Talhao } from '../types';
import { calculateTalhaoCropStatus, diffDays } from '../utils/cropCalendar';
import { cropKey } from '../utils/forecast';

export type PendKind = 'crop' | 'planting' | 'harvest' | 'cultivar' | 'diary';
export interface Pending { kind: PendKind; talhaoId: string; days?: number }

const ORDER: Record<PendKind, number> = { crop: 0, planting: 1, harvest: 2, cultivar: 3, diary: 4 };
export const DIARY_STALE_DAYS = 7;

/** Lista, de forma determinística, o que falta informar em cada talhão. */
export function computePending(farm: FarmData, ref: string, skipped: Set<string> = new Set()): Pending[] {
  const out: Pending[] = [];
  for (const tl of farm.talhoes) {
    const add = (p: Pending) => { if (!skipped.has(`${p.kind}:${p.talhaoId}`)) out.push(p); };
    if (!tl.crop) { add({ kind: 'crop', talhaoId: tl.id }); continue; }
    const k = cropKey(tl.crop);
    if (k === 'pasto') continue; // perene, sem plantio/colheita
    if (!tl.plantingDate) { add({ kind: 'planting', talhaoId: tl.id }); continue; }
    const st = calculateTalhaoCropStatus(tl, ref);
    const diary = tl.diary || [];
    const harvested = diary.some((d) => d.type === 'colheita' && d.date >= tl.plantingDate!);
    if (tl.cycleDays && st.daysPassed >= tl.cycleDays && !harvested) { add({ kind: 'harvest', talhaoId: tl.id, days: st.daysPassed - tl.cycleDays }); continue; }
    if (!tl.cultivar) add({ kind: 'cultivar', talhaoId: tl.id });
    if (!harvested && st.daysPassed >= 0) {
      const last = diary.filter((d) => d.date <= ref).map((d) => d.date).sort().pop();
      const gap = last ? diffDays(last, ref) : 9999;
      if (gap >= DIARY_STALE_DAYS) add({ kind: 'diary', talhaoId: tl.id, days: gap === 9999 ? undefined : gap });
    }
  }
  return out.sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
}
export type { Talhao };
