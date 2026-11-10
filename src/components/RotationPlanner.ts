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

  private card(s: RotationStrategyData, ev: Evaluation, idx: number): string {
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
        <div class="rot-grid">${plan.strategies.map((s, i) => this.card(s, evals[i], i)).join('')}</div>
        <div class="rot-bottom">
          <button class="rot-add" data-act="add">${rt('add')}</button>
          <p class="rot-foot">${rt('foot')}</p>
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
