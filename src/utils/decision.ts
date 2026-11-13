/** Decisão combinada (clima + lavoura + mercado) e atalhos usados pelo planejador e pela tela Hoje. */
import { FarmData, Talhao } from '../types';
import { calculateExpectedHarvestDate, calculateTalhaoCropStatus, diffDays } from './cropCalendar';
import { CropKey, Evaluation, ROTATION_RULES, defaultStrategies, defaultSummerSow, evaluateStrategy } from './rotation';
import { slotMargin, strategyMargin, StrategyMargin } from './market';

const monthsUntil = (ref: string, iso: string) => (new Date(iso + 'T12:00:00Z').getTime() - new Date(ref + 'T12:00:00Z').getTime()) / (30.44 * 864e5);

export function ensurePlan(t: Talhao, ref: string) {
  if (!t.rotationPlan || !t.rotationPlan.strategies?.length) {
    t.rotationPlan = { summerSow: defaultSummerSow(t, ref), strategies: defaultStrategies(t) };
  }
  if (!t.rotationPlan.summerSow) t.rotationPlan.summerSow = defaultSummerSow(t, ref);
  return t.rotationPlan;
}

export interface Decision { evals: Evaluation[]; margins: StrategyMargin[]; bestIdx: number }

export function decide(
  t: Talhao, ref: string, names: (c: CropKey) => string,
  nasa: { level: 'low' | 'medium' | 'high'; rain15: number } | null, stress = 0
): Decision {
  const plan = ensurePlan(t, ref);
  const evals = plan.strategies.map((s) => evaluateStrategy(s, t, plan.summerSow!, ref, names, nasa));
  const margins = evals.map((ev) => {
    const perennial = ROTATION_RULES.perennial.includes(ev.summer.crop);
    const slots = [slotMargin(ev.summer.crop, ev.level, ev.yields.summer?.value ?? null, stress, 1, monthsUntil(ref, ev.summer.harvest))];
    if (ev.second && !perennial) slots.push(slotMargin(ev.second.crop, ev.level, ev.yields.second?.value ?? null, stress, 1, monthsUntil(ref, ev.second.harvest)));
    return strategyMargin(slots);
  });
  let bestIdx = -1;
  evals.forEach((ev, i) => {
    if (ev.level === 'high' || !margins[i].slots.length) return;
    if (bestIdx < 0 || margins[i].perHa.base > margins[bestIdx].perHa.base) bestIdx = i;
  });
  return { evals, margins, bestIdx };
}

/** Talhão em foco para os atalhos: o de colheita mais próxima; se não houver, o primeiro que não é pastagem. */
export function focusTalhao(farm: FarmData, ref: string): Talhao | null {
  let best: Talhao | null = null, bestD = Infinity;
  for (const t of farm.talhoes) {
    const st = calculateTalhaoCropStatus(t, ref);
    if (st.isPasture || !t.plantingDate || !t.cycleDays) continue;
    const h = t.harvestDateExpected || calculateExpectedHarvestDate(t.plantingDate, t.cycleDays);
    const d = diffDays(ref, h);
    if (d >= 0 && d < bestD) { best = t; bestD = d; }
  }
  return best || farm.talhoes.find((t) => !calculateTalhaoCropStatus(t, ref).isPasture) || farm.talhoes[0] || null;
}
