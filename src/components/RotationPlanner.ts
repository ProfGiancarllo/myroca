import { FarmData, Talhao, RotationStrategyData } from '../types';
import { translateCropName } from '../i18n';
import { rt } from '../i18n/rotationText';
import {
  CROP_KEYS, CROP_STANDARD_NAME, CropKey, DEFAULT_CYCLE, Evaluation, Finding, asCropKey,
  defaultStrategies, defaultSummerSow, evaluateStrategy, newCustomStrategy, ROTATION_RULES,
} from '../utils/rotation';
import { assessPlanting } from '../utils/agronomyRules';
import { fetchNasaSeries, polygonCentroid } from '../utils/nasaPower';
import { addDaysToDate, calculateTalhaoCropStatus } from '../utils/cropCalendar';
import { mt } from '../i18n/marketText';
import { getCurrentLanguage } from '../i18n';
import {
  clearOverrides, cropMarket, currentMarket, hasOverrides, loadMarket, setOverride, slotMargin, strategyMargin,
  Scenario, StrategyMargin,
} from '../utils/market';

export interface RotationPlannerOptions {
  getFarm: () => FarmData;
  getRefDate: () => string;
  /** Chamado quando algo deve ser salvo (estratégias editadas ou próxima safra adotada). */
  onChange: (talhao: Talhao, adopted: boolean) => void;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const fmtDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export class RotationPlanner {
  private root: HTMLElement | null = null;
  private talhaoId = '';
  private nasa: { level: 'low' | 'medium' | 'high'; rain15: number } | null = null;
  private nasaState: 'idle' | 'loading' | 'ok' | 'fail' = 'idle';
  private nasaToken = 0;
  private stress = 0;

  constructor(private opts: RotationPlannerOptions) {}

  open(talhaoId?: string): void {
    const farm = this.opts.getFarm();
    if (!farm.talhoes.length) {
      this.ensureRoot();
      this.root!.innerHTML = `<div class="rot-card"><div class="rot-head"><h2>${rt('title')}</h2><button class="rot-x" data-act="close">&times;</button></div><p>${rt('noTalhao')}</p></div>`;
      this.root!.style.display = 'flex';
      this.bindClose();
      return;
    }
    this.talhaoId = talhaoId && farm.talhoes.some((t) => t.id === talhaoId) ? talhaoId : farm.talhoes[0].id;
    this.ensureRoot();
    this.root!.style.display = 'flex';
    this.loadNasa();
    this.render();
    void loadMarket().then(() => { if (this.root && this.root.style.display !== 'none') this.render(); });
  }

  close(): void {
    if (this.root) this.root.style.display = 'none';
  }

  private ensureRoot(): void {
    if (this.root) return;
    this.root = document.createElement('div');
    this.root.className = 'rot-overlay';
    document.body.appendChild(this.root);
  }

  private bindClose(): void {
    this.root!.querySelector('[data-act=close]')?.addEventListener('click', () => this.close());
    this.root!.onclick = (e) => { if (e.target === this.root) this.close(); };
  }

  private talhao(): Talhao {
    return this.opts.getFarm().talhoes.find((t) => t.id === this.talhaoId)!;
  }

  private plan() {
    const t = this.talhao();
    if (!t.rotationPlan || !t.rotationPlan.strategies?.length) {
      t.rotationPlan = { summerSow: defaultSummerSow(t, this.opts.getRefDate()), strategies: defaultStrategies(t) };
    }
    if (!t.rotationPlan.summerSow) t.rotationPlan.summerSow = defaultSummerSow(t, this.opts.getRefDate());
    return t.rotationPlan;
  }

  private cropName = (c: CropKey): string => {
    if (c === 'cobertura') return rt('cover').split(' (')[0];
    if (c === 'pousio') return rt('fallow').split(' (')[0];
    return translateCropName(CROP_STANDARD_NAME[c]);
  };

  private loadNasa(): void {
    const t = this.talhao();
    const token = ++this.nasaToken;
    this.nasa = null;
    if (!t.coordinates || t.coordinates.length < 3) {
      this.nasaState = 'fail';
      return;
    }
    this.nasaState = 'loading';
    const ref = this.opts.getRefDate();
    const c = polygonCentroid(t.coordinates);
    fetchNasaSeries(c.lat, c.lng, ref, 30)
      .then((series) => {
        if (token !== this.nasaToken) return;
        const phase = calculateTalhaoCropStatus(t, ref).phase.key;
        const inCycle = !!t.plantingDate && phase !== 'preparo';
        const a = assessPlanting(series, ref, t.diary, inCycle);
        this.nasa = { level: a.level, rain15: a.rain15 };
        this.nasaState = 'ok';
        this.render();
      })
      .catch(() => {
        if (token !== this.nasaToken) return;
        this.nasaState = 'fail';
        this.render();
      });
  }

  private riskLabel(l: 'low' | 'medium' | 'high'): string {
    return rt(l === 'low' ? 'riskLow' : l === 'medium' ? 'riskMedium' : 'riskHigh');
  }

  private cropOptions(selected: string, season: 'summer' | 'second'): string {
    const keys = CROP_KEYS.filter((k) => (season === 'summer' ? k !== 'cobertura' : true));
    return keys.map((k) => `<option value="${k}" ${k === selected ? 'selected' : ''}>${esc(this.cropName(k))}</option>`).join('');
  }

  private findingHtml(f: Finding): string {
    const params: Record<string, string | number> = { ...f.params };
    const text = rt(f.key, params);
    const src = f.source === 'NASA POWER' ? `<span class="rot-nasa">🛰️ ${rt('nasaBadge')}</span>` : f.source === 'Embrapa' ? '<span class="rot-src">Embrapa</span>' : '';
    return `<li class="rot-f sev${f.sev}">${esc(text)} ${src}</li>`;
  }

  private evidenceChip(c: CropKey, ev: Evaluation['evidence']['summer']): string {
    if (!ev) return '';
    const label = rt(ev === 'model' ? 'evModel' : ev === 'trend' ? 'evTrend' : 'evRules');
    return `<span class="rot-ev ev-${ev}">${esc(this.cropName(c))}: ${esc(label)}</span>`;
  }

  private yieldLine(c: CropKey, y: Evaluation['yields']['summer']): string {
    if (c === 'pousio' || c === 'cobertura') return '';
    const txt = y ? rt('yieldVal', { v: y.value.toFixed(1).replace('.', ','), n: y.n }) : rt('yieldNone');
    return `<div class="rot-yield">${esc(this.cropName(c))} — ${rt('yieldRef')}: <strong>${esc(txt)}</strong></div>`;
  }


  private money(v: number): string {
    const loc = ({ pt: 'pt-BR', es: 'es', en: 'en-US', de: 'de-DE', zh: 'zh-CN', fr: 'fr-FR' } as Record<string, string>)[getCurrentLanguage()] || 'pt-BR';
    const sign = v < 0 ? '−' : '';
    return `${sign}R$ ${Math.abs(Math.round(v)).toLocaleString(loc)}`;
  }

  private strategyName(ev: Evaluation): string {
    const a = this.cropName(ev.summer.crop);
    return ev.second ? `${a} → ${this.cropName(ev.second.crop)}` : a;
  }

  /** Margem estimada da estratégia, com o risco agronômico/climático reduzindo a produtividade. */
  private marginOf(ev: Evaluation): StrategyMargin {
    const perennial = ROTATION_RULES.perennial.includes(ev.summer.crop);
    const slots = [slotMargin(ev.summer.crop, ev.level, ev.yields.summer?.value ?? null, this.stress)];
    if (ev.second && !perennial) slots.push(slotMargin(ev.second.crop, ev.level, ev.yields.second?.value ?? null, this.stress));
    return strategyMargin(slots);
  }

  private spark(series?: number[]): string {
    if (!series || series.length < 2) return '';
    const w = 70, h = 22, mn = Math.min(...series), mx = Math.max(...series), r = mx - mn || 1;
    const pts = series.map((v, i) => `${((i / (series.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - mn) / r) * (h - 4)).toFixed(1)}`).join(' ');
    const up = series[series.length - 1] >= series[0];
    return `<svg class="mk-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${up ? '#22c55e' : '#f87171'}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }

  private marketPanel(crops: CropKey[]): string {
    const md = currentMarket();
    const rows = crops.map((c) => {
      const cm = cropMarket(c);
      if (!cm || c === 'cobertura') return '';
      const { m, edited } = cm;
      const trendTxt = `${m.trend12m > 0 ? '+' : ''}${m.trend12m}%`;
      const arrow = m.trend12m >= 0 ? '▲' : '▼';
      return `<tr>
        <td>${esc(this.cropName(c))}</td>
        <td><input type="number" min="0" step="0.5" class="mk-in ${edited.price ? 'edited' : ''}" data-mk="price" data-crop="${c}" value="${m.price}" title="${esc(mt('yourValue'))}" aria-label="${esc(mt('price'))} ${esc(this.cropName(c))}" /> <span class="mk-unit">R$/${m.unit}</span></td>
        <td class="${m.trend12m >= 0 ? 'mk-up' : 'mk-down'}">${arrow} ${trendTxt} ${this.spark(m.series)}</td>
        <td><input type="number" min="0" step="50" class="mk-in ${edited.cost ? 'edited' : ''}" data-mk="cost" data-crop="${c}" value="${m.cost}" title="${esc(mt('yourValue'))}" aria-label="${esc(mt('cost'))} ${esc(this.cropName(c))}" /></td>
      </tr>`;
    }).join('');
    const badge = md.example ? `<span class="mk-badge example">${mt('exampleBadge')}</span>` : `<span class="mk-badge real">${mt('realBadge')}</span>`;
    const note = md.example ? mt('exampleNote') : mt('realNote', { src: md.source, date: md.asOf });
    const sv = this.stress;
    const stressTxt = sv === 0 ? '0%' : `${sv > 0 ? '+' : ''}${sv}%`;
    return `
      <div class="mk-panel">
        <div class="mk-head"><strong>💹 ${mt('title')}</strong> ${badge}${hasOverrides() ? `<button class="mk-reset" data-act="mk-reset">${mt('reset')}</button>` : ''}</div>
        <p class="mk-note">${esc(note)}</p>
        <div class="mk-tbl-wrap"><table class="mk-tbl"><thead><tr><th>${mt('crop')}</th><th>${mt('price')}</th><th>${mt('trend')}</th><th>${mt('cost')}</th></tr></thead><tbody>${rows}</tbody></table></div>
        <div class="mk-stress">
          <label for="mk-stress"><strong>${mt('stress')}</strong>: <span id="mk-stress-val">${mt('stressNow', { v: stressTxt })}</span></label>
          <input type="range" id="mk-stress" min="-40" max="40" step="5" value="${sv}" />
          <div class="mk-stress-help">${mt('stressHelp')}</div>
        </div>
      </div>`;
  }

  private marginBlock(mg: StrategyMargin, area: number, best: boolean, ev: Evaluation): string {
    if (!mg.slots.length) return `<div class="mk-margin"><div class="mk-none">${mt('noMarket')}</div></div>`;
    const sc: Scenario[] = ['pess', 'base', 'opt'];
    const label: Record<Scenario, string> = { pess: mt('pess'), base: mt('base'), opt: mt('opt') };
    const cells = sc.map((k) => {
      const v = mg.perHa[k];
      return `<div class="mk-cell ${k} ${v < 0 ? 'neg' : 'pos'}"><span>${label[k]}</span><strong>${this.money(v)}</strong><em>${this.money(v * area)}</em></div>`;
    }).join('');
    const adj = mg.slots.map((s) => `${this.cropName(s.crop)}: ${mt('yieldAdj', { v: s.yieldUsed.toFixed(s.yieldUsed < 20 ? 1 : 0).replace('.', ','), u: s.unit })}`).join(' • ');
    const cover = [ev.summer.crop, ev.second?.crop].includes('cobertura') ? `<div class="mk-cover">${mt('cover')}</div>` : '';
    return `
      <div class="mk-margin ${best ? 'best' : ''}">
        <div class="mk-m-head"><strong>💹 ${mt('margin')}</strong> <span>${mt('perHa')} • <em>${mt('total', { ha: area.toFixed(1).replace('.', ',') })}</em></span>${best ? `<span class="mk-best">🏆 ${mt('best')}</span>` : ''}</div>
        <div class="mk-cells">${cells}</div>
        ${mg.perHa.pess < 0 ? `<div class="mk-loss">⚠️ ${mt('loss')}</div>` : ''}
        <div class="mk-adj">${esc(adj)}</div>${cover}
      </div>`;
  }

  private decisionBanner(evals: Evaluation[], margins: StrategyMargin[], area: number): { html: string; bestIdx: number } {
    let bestIdx = -1;
    evals.forEach((ev, i) => {
      if (ev.level === 'high' || !margins[i].slots.length) return;
      if (bestIdx < 0 || margins[i].perHa.base > margins[bestIdx].perHa.base) bestIdx = i;
    });
    if (bestIdx < 0) return { html: `<div class="mk-decision none">⚠️ ${mt('decisionNone')}</div>`, bestIdx };
    const ev = evals[bestIdx];
    if (margins[bestIdx].perHa.base < 0) {
      return { html: `<div class="mk-decision none">⚠️ <strong>${mt('decision')}</strong><div>${esc(mt('decisionLoss', { name: this.strategyName(ev), m: this.money(margins[bestIdx].perHa.base) }))}</div></div>`, bestIdx };
    }
    const text = mt('decisionText', { name: this.strategyName(ev), m: this.money(margins[bestIdx].perHa.base), risk: this.riskLabel(ev.level), t: this.money(margins[bestIdx].perHa.base * area) });
    return { html: `<div class="mk-decision">🎯 <strong>${mt('decision')}</strong><div>${esc(text)}</div></div>`, bestIdx };
  }

  private card(s: RotationStrategyData, ev: Evaluation, idx: number, marketHtml = ''): string {
    const kindLabel = s.kind === 'current' ? rt('current') : s.kind === 'suggested' ? `${rt('suggested')} ${esc(s.name)}` : `${rt('custom')} ${esc(s.name)}`;
    const lvl = ev.level;
    const levelText = rt(lvl === 'low' ? 'levelLow' : lvl === 'medium' ? 'levelMedium' : 'levelHigh');
    const ben = ev.findings.filter((f) => f.kind === 'benefit');
    const risk = ev.findings.filter((f) => f.kind === 'risk');
    const gaps = ev.findings.filter((f) => f.kind === 'gap');
    const list = (arr: Finding[]) => (arr.length ? `<ul>${arr.map((f) => this.findingHtml(f)).join('')}</ul>` : `<div class="rot-none">${rt('none')}</div>`);
    const sec = ev.second;
    return `
      <div class="rot-strategy lvl-${lvl}" data-id="${esc(s.id)}">
        <div class="rot-s-head">
          <span class="rot-kind">${kindLabel}</span>
          <span class="rot-level lvl-${lvl}">${levelText}</span>
        </div>
        <div class="rot-slots">
          <label>${rt('summer')}
            <select data-f="summer" data-id="${esc(s.id)}">${this.cropOptions(s.summer.crop, 'summer')}</select>
          </label>
          <label class="rot-cyc">${rt('cycle')}
            <input type="number" min="0" max="400" value="${s.summer.cycle}" data-f="summerCycle" data-id="${esc(s.id)}" />
          </label>
          <label>${rt('second')}
            <select data-f="second" data-id="${esc(s.id)}">${this.cropOptions(s.second.crop, 'second')}</select>
          </label>
          <label class="rot-cyc">${rt('cycle')}
            <input type="number" min="0" max="400" value="${s.second.cycle}" data-f="secondCycle" data-id="${esc(s.id)}" />
          </label>
        </div>
        <div class="rot-timeline">
          ${ev.summer.crop !== 'pousio' ? `<div>🌱 ${esc(this.cropName(ev.summer.crop))}: ${rt('sow')} ${fmtDate(ev.summer.sow)} → ${rt('harvest')} ${fmtDate(ev.summer.harvest)}</div>` : ''}
          ${sec ? `<div>🌾 ${esc(this.cropName(sec.crop))}: ${rt('sow')} ${fmtDate(sec.sow)} → ${rt('harvest')} ${fmtDate(sec.harvest)}</div>` : ''}
        </div>
        ${this.yieldLine(ev.summer.crop, ev.yields.summer)}
        ${sec ? this.yieldLine(sec.crop, ev.yields.second) : ''}
        <div class="rot-evs">${this.evidenceChip(ev.summer.crop, ev.evidence.summer)}${sec ? this.evidenceChip(sec.crop, ev.evidence.second) : ''}</div>
        ${marketHtml}
        <div class="rot-sec ben"><h4>✅ ${rt('benefits')}</h4>${list(ben)}</div>
        <div class="rot-sec risk"><h4>⚠️ ${rt('risks')}</h4>${list(risk)}</div>
        <div class="rot-sec gap"><h4>ℹ️ ${rt('gaps')}</h4>${list(gaps)}</div>
        <div class="rot-actions">
          <button class="rot-adopt" data-act="adopt" data-id="${esc(s.id)}">${rt('adopt')}</button>
          ${s.kind === 'custom' || idx > 2 ? `<button class="rot-rm" data-act="remove" data-id="${esc(s.id)}">${rt('remove')}</button>` : ''}
        </div>
      </div>`;
  }

  private render(): void {
    if (!this.root) return;
    const farm = this.opts.getFarm();
    const t = this.talhao();
    const plan = this.plan();
    const ref = this.opts.getRefDate();
    const evals = plan.strategies.map((s) =>
      evaluateStrategy(s, t, plan.summerSow!, ref, this.cropName, this.nasa)
    );
    const area = Math.max(0, Number(t.areaHectares) || 0);
    const margins = evals.map((ev) => this.marginOf(ev));
    const dec = this.decisionBanner(evals, margins, area);
    const usedCrops = Array.from(new Set(evals.flatMap((ev) => [ev.summer.crop, ev.second?.crop].filter(Boolean) as CropKey[]))).filter((c) => c !== 'pousio');
    const nasaBox =
      this.nasaState === 'ok' && this.nasa
        ? `<div class="rot-nasa-box">🛰️ <strong>${rt('nasaTitle')}</strong> <span class="rot-nasa">${rt('nasaBadge')}</span><div>${rt('nasaLine', { mm: this.nasa.rain15, risk: this.riskLabel(this.nasa.level) })}</div></div>`
        : `<div class="rot-nasa-box">🛰️ <strong>${rt('nasaTitle')}</strong> <span class="rot-nasa">${rt('nasaBadge')}</span><div>${this.nasaState === 'loading' ? rt('nasaLoading') : rt('nasaFail')}</div></div>`;
    this.root.innerHTML = `
      <div class="rot-card" role="dialog" aria-label="${rt('title')}">
        <div class="rot-head">
          <div><h2>🔄 ${rt('title')}</h2><p class="rot-sub">${rt('subtitle')}</p></div>
          <button class="rot-x" data-act="close" aria-label="${rt('close')}">&times;</button>
        </div>
        <div class="rot-controls">
          <label>${rt('talhao')}
            <select id="rot-talhao">${farm.talhoes.map((x) => `<option value="${esc(x.id)}" ${x.id === this.talhaoId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
          </label>
          <label>${rt('sowDate')}
            <input type="date" id="rot-sow" value="${plan.summerSow}" />
          </label>
        </div>
        ${nasaBox}
        ${dec.html}
        ${this.marketPanel(usedCrops)}
        <div class="rot-grid">${plan.strategies.map((s, i) => this.card(s, evals[i], i, this.marginBlock(margins[i], area, i === dec.bestIdx, evals[i]))).join('')}</div>
        <div class="rot-bottom">
          <button class="rot-add" data-act="add">${rt('add')}</button>
          <p class="rot-foot">${rt('foot')}</p>
          <p class="rot-foot">${mt('foot')}</p>
        </div>
      </div>`;
    this.bind(plan.strategies);
  }

  private bind(strategies: RotationStrategyData[]): void {
    const root = this.root!;
    this.bindClose();
    const t = this.talhao();
    const plan = this.plan();
    const persist = () => this.opts.onChange(t, false);

    root.querySelector<HTMLSelectElement>('#rot-talhao')!.onchange = (e) => {
      this.talhaoId = (e.target as HTMLSelectElement).value;
      this.loadNasa();
      this.render();
    };
    root.querySelector<HTMLInputElement>('#rot-sow')!.onchange = (e) => {
      const v = (e.target as HTMLInputElement).value;
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { plan.summerSow = v; persist(); this.render(); }
    };
    root.querySelectorAll<HTMLSelectElement | HTMLInputElement>('[data-f]').forEach((el) => {
      el.onchange = () => {
        const s = strategies.find((x) => x.id === el.dataset.id);
        if (!s) return;
        const f = el.dataset.f!;
        if (f === 'summer') { s.summer.crop = el.value; s.summer.cycle = DEFAULT_CYCLE[el.value as CropKey]; if (ROTATION_RULES.perennial.includes(el.value as CropKey)) { s.second.crop = 'pousio'; s.second.cycle = 0; } }
        else if (f === 'second') { s.second.crop = el.value; s.second.cycle = DEFAULT_CYCLE[el.value as CropKey]; }
        else if (f === 'summerCycle') s.summer.cycle = Math.max(0, Number(el.value) || 0);
        else if (f === 'secondCycle') s.second.cycle = Math.max(0, Number(el.value) || 0);
        if (s.kind === 'suggested') s.kind = 'custom';
        persist();
        this.render();
      };
    });
    root.querySelectorAll<HTMLInputElement>('input[data-mk]').forEach((el) => {
      el.onchange = () => {
        const v = el.value.trim() === '' ? null : Number(el.value.replace(',', '.'));
        setOverride(el.dataset.crop as CropKey, el.dataset.mk as 'price' | 'cost', v);
        this.render();
      };
    });
    root.querySelector<HTMLButtonElement>('[data-act=mk-reset]')?.addEventListener('click', () => { clearOverrides(); this.render(); });
    const st = root.querySelector<HTMLInputElement>('#mk-stress');
    if (st) {
      st.oninput = () => {
        const v = Number(st.value);
        const lab = root.querySelector('#mk-stress-val');
        if (lab) lab.textContent = mt('stressNow', { v: v === 0 ? '0%' : `${v > 0 ? '+' : ''}${v}%` });
      };
      st.onchange = () => { this.stress = Number(st.value); this.render(); };
    }
    root.querySelector('[data-act=add]')!.addEventListener('click', () => {
      plan.strategies.push(newCustomStrategy(plan.strategies.filter((x) => x.kind === 'custom').length + 1));
      persist();
      this.render();
    });
    root.querySelectorAll<HTMLButtonElement>('[data-act=remove]').forEach((b) => {
      b.onclick = () => {
        if (plan.strategies.length <= 3) return;
        plan.strategies = plan.strategies.filter((x) => x.id !== b.dataset.id);
        persist();
        this.render();
      };
    });
    root.querySelectorAll<HTMLButtonElement>('[data-act=adopt]').forEach((b) => {
      b.onclick = () => this.adopt(strategies.find((x) => x.id === b.dataset.id)!);
    });
  }

  /** Define a próxima safra do talhão a partir da estratégia escolhida. */
  private adopt(s: RotationStrategyData): void {
    const t = this.talhao();
    const plan = this.plan();
    const ref = this.opts.getRefDate();
    const phase = calculateTalhaoCropStatus(t, ref).phase.key;
    const inCycle = !!t.plantingDate && phase !== 'preparo' && asCropKey(t.crop) !== 'pasto';
    const useSecond = inCycle && s.second.crop !== 'pousio';
    const slotData = useSecond ? s.second : s.summer;
    const crop = slotData.crop as CropKey;
    const std = CROP_STANDARD_NAME[crop];
    if (!std) {
      this.toast(rt('adoptNo'));
      return;
    }
    const ev = evaluateStrategy(s, t, plan.summerSow!, ref, this.cropName, this.nasa);
    const target = useSecond ? ev.second : ev.summer;
    if (!target) { this.toast(rt('adoptNo')); return; }
    t.nextCropPlan = {
      crop: std,
      plannedPlanting: target.sow,
      plannedHarvest: target.harvest,
      cycleDays: slotData.cycle || undefined,
    };
    this.opts.onChange(t, true);
    this.toast(rt('adopted'));
    this.render();
  }

  private toast(msg: string): void {
    const el = document.createElement('div');
    el.className = 'rot-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    window.setTimeout(() => el.remove(), 2600);
  }
}
void addDaysToDate;
