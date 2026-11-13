/**
 * Diário de safra: registro dos acontecimentos de cada talhão (um, vários ou todos de uma vez),
 * com campos próprios por tipo de evento e clima do dia preenchido por NASA POWER / Open-Meteo.
 */
import { DiaryEntry, DiaryEntryType, DiaryWeather, FarmData, Talhao } from '../types';
import { getCurrentLanguage, translateCropName } from '../i18n';
import { dj } from '../i18n/diarioText';
import { asCropKey, CROP_STANDARD_NAME } from '../utils/rotation';
import { polygonCentroid } from '../utils/nasaPower';
import { weatherForDates } from '../utils/diaryWeather';

export interface DiaryPanelOptions {
  getFarm: () => FarmData;
  getRefDate: () => string;
  onChange: () => void;
  openEstela: () => void;
}

interface TypeDef {
  key: DiaryEntryType;
  icon: string;
  prod?: 'product' | 'cultivar' | 'implement';
  sugg?: string[];
  units?: string[];
  cat?: boolean;
  target?: string[] | true;
  depth?: boolean;
}

const COMBATE_ALVOS = ['Lagarta-do-cartucho', 'Percevejo', 'Ferrugem-asiática', 'Mancha-alvo', 'Buva', 'Capim-amargoso', 'Mofo-branco', 'Cigarrinha'];
const TYPES: TypeDef[] = [
  { key: 'preparo', icon: '', prod: 'implement', sugg: ['Subsolagem', 'Escarificação', 'Gradagem', 'Aração', 'Sem preparo (plantio direto)'], depth: true },
  { key: 'calagem', icon: '', prod: 'product', sugg: ['Calcário dolomítico', 'Calcário calcítico', 'Gesso agrícola'], units: ['t/ha', 'kg/ha'] },
  { key: 'plantio', icon: '', prod: 'cultivar', units: ['kg/ha', 'sem/m'] },
  { key: 'adubacao', icon: '', prod: 'product', sugg: ['MAP', 'Ureia', 'Cloreto de potássio (KCl)', 'Superfosfato simples', 'Sulfato de amônio', 'NPK 04-30-10', 'NPK 08-28-16', 'NPK 20-05-20'], units: ['kg/ha'] },
  { key: 'foliar', icon: '', prod: 'product', sugg: ['Boro', 'Zinco', 'Manganês', 'Molibdênio', 'Cobalto + Molibdênio', 'Bioestimulante'], units: ['L/ha', 'kg/ha'] },
  { key: 'aplicacao', icon: '', prod: 'product', units: ['L/ha', 'kg/ha', 'g/ha', 'mL/ha'], cat: true, target: COMBATE_ALVOS },
  { key: 'irrigacao', icon: '', units: ['mm'] },
  { key: 'chuva', icon: '', units: ['mm'] },
  { key: 'monitoramento', icon: '', target: COMBATE_ALVOS },
  { key: 'colheita', icon: '', units: ['sc/ha'] },
  { key: 'ocorrencia', icon: '', target: ['Granizo', 'Geada', 'Veranico', 'Enchente', 'Vendaval', 'Incêndio'] },
  { key: 'analise_solo', icon: '' },
  { key: 'observacao', icon: '' },
];
const CATS = ['herbicida', 'fungicida', 'inseticida', 'dessecacao', 'outro'];
const NEEDS_DOSE = (d: TypeDef) => !!d.units;

const LOCALES: Record<string, string> = { pt: 'pt-BR', es: 'es', en: 'en-US', de: 'de-DE', zh: 'zh-CN', fr: 'fr-FR' };
const loc = () => LOCALES[getCurrentLanguage()] || 'pt-BR';
const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const nf = (v: number, d = 1) => v.toLocaleString(loc(), { minimumFractionDigits: 0, maximumFractionDigits: d });
const dayLbl = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString(loc(), { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const diffDays = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
const todayIso = () => new Date().toISOString().slice(0, 10);

interface FormState { date: string; type: DiaryEntryType; product: string; amount: string; unit: string; category: string; target: string; depth: string; rain: string; note: string }

export class DiaryPanel {
  private overlay: HTMLDivElement | null = null;
  private sel = new Set<string>();
  private f: FormState;
  private filterTl = '';
  private filterType = '';
  private shown = 30;
  private msg = '';
  private busy = false;
  private again = false;

  constructor(private opts: DiaryPanelOptions) {
    this.f = this.blank('plantio');
  }

  private blank(type: DiaryEntryType): FormState {
    const def = TYPES.find((x) => x.key === type)!;
    return { date: this.opts.getRefDate(), type, product: '', amount: '', unit: def.units?.[0] || '', category: 'herbicida', target: '', depth: '', rain: '', note: '' };
  }

  open(preselect?: string): void {
    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.className = 'mkp-overlay dj-overlay';
      this.overlay.setAttribute('role', 'dialog'); this.overlay.setAttribute('aria-modal', 'true');
      this.overlay.addEventListener('click', (e) => this.onClick(e));
      this.overlay.addEventListener('input', (e) => this.onInput(e));
      this.overlay.addEventListener('change', (e) => this.onInput(e));
      document.body.appendChild(this.overlay);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.overlay?.style.display !== 'none') this.close(); });
    }
    this.f.date = this.opts.getRefDate();
    if (preselect) { this.sel = new Set([preselect]); }
    this.msg = '';
    this.overlay.style.display = 'flex';
    document.body.classList.add('mkp-open');
    this.render();
    void this.enrichAll();
  }

  close(): void { if (this.overlay) this.overlay.style.display = 'none'; document.body.classList.remove('mkp-open'); }
  isOpen(): boolean { return !!this.overlay && this.overlay.style.display !== 'none'; }

  /* ---------- eventos ---------- */
  private onInput(e: Event): void {
    const el = e.target as HTMLElement & { value?: string; dataset: DOMStringMap };
    const k = el.dataset?.f;
    if (k && k in this.f) {
      (this.f as any)[k] = (el as HTMLInputElement).value;
      return;
    }
    if (el.dataset?.flt === 'tl') { this.filterTl = (el as HTMLSelectElement).value; this.shown = 30; this.renderTimeline(); void this.fillDayWeather(); }
    if (el.dataset?.flt === 'type') { this.filterType = (el as HTMLSelectElement).value; this.shown = 30; this.renderTimeline(); void this.fillDayWeather(); }
  }

  private onClick(e: MouseEvent): void {
    const el = e.target as HTMLElement;
    if (el === this.overlay || el.closest('[data-act=close]')) return this.close();
    const farm = this.opts.getFarm();
    const tl = el.closest('[data-tl]') as HTMLElement | null;
    if (tl) { this.toggleSel(tl.dataset.tl!); return; }
    if (el.closest('[data-all]')) { farm.talhoes.forEach((x) => this.sel.add(x.id)); this.paintSel(); return; }
    if (el.closest('[data-none]')) { this.sel.clear(); this.paintSel(); return; }
    const byc = el.closest('[data-bycrop]') as HTMLElement | null;
    if (byc) { farm.talhoes.filter((x) => this.cropOf(x) === byc.dataset.bycrop).forEach((x) => this.sel.add(x.id)); this.paintSel(); return; }
    const ty = el.closest('[data-type]') as HTMLElement | null;
    if (ty) {
      const keep = { ...this.f };
      this.f = this.blank(ty.dataset.type as DiaryEntryType);
      this.f.date = keep.date; this.f.note = keep.note; this.f.rain = keep.rain;
      this.msg = '';
      this.renderForm();
      return;
    }
    if (el.closest('[data-act=save]')) { this.save(); return; }
    if (el.closest('[data-act=estela]')) { this.close(); this.opts.openEstela(); return; }
    if (el.closest('[data-act=more]')) { this.shown += 30; this.renderTimeline(); void this.fillDayWeather(); return; }
    const reg = el.closest('[data-reg]') as HTMLElement | null;
    if (reg) { this.sel = new Set([reg.dataset.reg!]); this.paintSel(); this.overlay?.querySelector('#dj-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const del = el.closest('[data-del]') as HTMLElement | null;
    if (del) { this.del(del); }
  }

  private toggleSel(id: string): void { if (this.sel.has(id)) this.sel.delete(id); else this.sel.add(id); this.paintSel(); }

  private paintSel(): void {
    if (!this.overlay) return;
    this.overlay.querySelectorAll<HTMLElement>('[data-tl]').forEach((b) => b.classList.toggle('on', this.sel.has(b.dataset.tl!)));
    const c = this.overlay.querySelector('#dj-selN');
    if (c) c.textContent = dj('selN', { n: this.sel.size });
  }

  /* ---------- dados ---------- */
  private cropOf(t: Talhao): string { return t.crop ? (asCropKey(t.crop) || t.crop) : ''; }
  private cropName(t: Talhao): string {
    const k = asCropKey(t.crop || '');
    return k && CROP_STANDARD_NAME[k] ? translateCropName(CROP_STANDARD_NAME[k]!) : (t.crop || '');
  }
  private center(t: Talhao): { lat: number; lng: number } { return polygonCentroid(t.coordinates); }
  private farmCenter(): { lat: number; lng: number } {
    const ts = this.opts.getFarm().talhoes.filter((x) => x.coordinates?.length);
    if (!ts.length) return { lat: -17.75, lng: -51.15 };
    const cs = ts.map((x) => this.center(x));
    return { lat: cs.reduce((a, c) => a + c.lat, 0) / cs.length, lng: cs.reduce((a, c) => a + c.lng, 0) / cs.length };
  }

  private save(): void {
    const farm = this.opts.getFarm();
    const def = TYPES.find((x) => x.key === this.f.type)!;
    if (!this.sel.size) { this.msg = '' + dj('pickField'); this.paintMsg(); return; }
    if (!this.f.date) { this.msg = '' + dj('pickDate'); this.paintMsg(); return; }
    const gid = `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const amt = this.f.amount.trim() ? Number(this.f.amount.replace(',', '.')) : NaN;
    const rain = this.f.rain.trim() ? Number(this.f.rain.replace(',', '.')) : NaN;
    const dep = this.f.depth.trim() ? Number(this.f.depth.replace(',', '.')) : NaN;
    let n = 0;
    farm.talhoes.filter((t) => this.sel.has(t.id)).forEach((t, i) => {
      const e: DiaryEntry = { id: `dj_${Date.now().toString(36)}${i}${Math.random().toString(36).slice(2, 5)}`, date: this.f.date, type: def.key, groupId: gid };
      if (isFinite(amt) && NEEDS_DOSE(def)) { e.amount = amt; e.unit = this.f.unit || def.units![0]; }
      if (this.f.product.trim() && def.prod) e.product = this.f.product.trim();
      if (def.cat) e.category = this.f.category;
      if (this.f.target.trim() && def.target) e.target = this.f.target.trim();
      if (isFinite(dep) && def.depth) e.depth = dep;
      if (this.f.note.trim()) e.note = this.f.note.trim();
      if (def.key === 'chuva' && isFinite(amt)) e.weather = { rain: amt, tmax: null, tmin: null, src: dj('fromProducer') };
      else if (isFinite(rain)) e.weather = { rain, tmax: null, tmin: null, src: dj('fromProducer') };
      (t.diary = t.diary || []).push(e);
      if (def.key === 'plantio') {
        if (!t.plantingDate) t.plantingDate = this.f.date;
        if (!t.cultivar && e.product) t.cultivar = e.product;
      }
      n++;
    });
    this.opts.onChange();
    this.msg = '' + dj('saved', { n });
    this.f.amount = ''; this.f.product = ''; this.f.target = ''; this.f.depth = ''; this.f.rain = ''; this.f.note = '';
    this.render();
    void this.enrichAll();
  }

  private del(btn: HTMLElement): void {
    if (btn.dataset.armed !== '1') {
      btn.dataset.armed = '1'; btn.classList.add('armed'); btn.textContent = dj('delSure');
      window.setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.classList.remove('armed'); btn.textContent = '×'; } }, 3000);
      return;
    }
    const ids = new Set((btn.dataset.del || '').split(','));
    this.opts.getFarm().talhoes.forEach((t) => { if (t.diary) t.diary = t.diary.filter((x) => !ids.has(x.id)); });
    this.opts.onChange();
    this.renderTimeline(); this.renderComplete(); void this.fillDayWeather();
  }

  /** Clima: grava em cada registro sem clima os dados do dia (NASA POWER, depois Open-Meteo). */
  private async enrichAll(): Promise<void> {
    if (this.busy) { this.again = true; return; }
    this.busy = true;
    try {
      const farm = this.opts.getFarm();
      const today = todayIso();
      let filled = 0;
      for (const t of farm.talhoes) {
        const need = (t.diary || []).filter((e) => e.date <= today && (!e.weather || e.weather.tmax === null));
        if (!need.length || !t.coordinates?.length) continue;
        const c = this.center(t);
        const w = await weatherForDates(c.lat, c.lng, need.map((e) => e.date));
        need.forEach((e) => {
          const a = w[e.date];
          if (!a) return;
          if (!e.weather) { e.weather = { rain: a.rain, tmax: a.tmax, tmin: a.tmin, src: a.src }; filled++; }
          else if (e.weather.rain !== null) { e.weather = { rain: e.weather.rain, tmax: a.tmax, tmin: a.tmin, src: `${dj('fromProducer')} + ${a.src}` }; }
        });
      }
      if (filled) { this.opts.onChange(); this.paintFilled(filled); }
      if (this.isOpen()) { this.renderTimeline(); void this.fillDayWeather(); }
    } finally { this.busy = false; if (this.again) { this.again = false; void this.enrichAll(); } }
  }

  private paintFilled(n: number): void {
    const el = this.overlay?.querySelector('#dj-filled');
    if (el) el.textContent = '' + dj('wxFilled', { n });
  }

  /* ---------- tela ---------- */
  private render(): void {
    if (!this.overlay) return;
    this.overlay.innerHTML = `
      <div class="mkp-card dj-card">
        <div class="mkp-head"><div><h2>${esc(dj('title'))}</h2><p>${esc(dj('sub'))}</p></div>
          <button type="button" class="mkp-x" data-act="close" aria-label="${esc(dj('close'))}">×</button></div>
        <div class="mkp-body">
          <button type="button" class="dj-estela" data-act="estela">${esc(dj('estela'))}</button>
          <section id="dj-form"></section>
          <section id="dj-complete"></section>
          <section id="dj-timeline"></section>
        </div>
      </div>`;
    this.renderForm();
    this.renderComplete();
    this.renderTimeline();
    void this.fillDayWeather();
  }

  private renderForm(): void {
    const box = this.overlay?.querySelector('#dj-form');
    if (!box) return;
    const farm = this.opts.getFarm();
    const def = TYPES.find((x) => x.key === this.f.type)!;
    const crops = Array.from(new Set(farm.talhoes.map((t) => this.cropOf(t)).filter(Boolean)));
    const cropBtns = crops.map((c) => { const t = farm.talhoes.find((x) => this.cropOf(x) === c)!; return `<button type="button" class="dj-mini" data-bycrop="${esc(c)}">${esc(dj('byCrop', { c: this.cropName(t) }))}</button>`; }).join('');
    const chips = farm.talhoes.map((t) => `<button type="button" class="dj-chip ${this.sel.has(t.id) ? 'on' : ''}" data-tl="${t.id}" title="${esc(this.cropName(t))}">${esc(t.name)}</button>`).join('');
    const types = TYPES.map((x) => `<button type="button" class="dj-type ${x.key === this.f.type ? 'on' : ''}" data-type="${x.key}"><span>${x.icon}</span>${esc(dj('t_' + x.key))}</button>`).join('');
    const lbl = def.prod === 'cultivar' ? dj('cultivar') : def.prod === 'implement' ? dj('implement') : dj('product');
    const dl = def.sugg ? `<datalist id="dj-sugg">${def.sugg.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>` : '';
    const tl = def.target ? `<datalist id="dj-tgt">${(Array.isArray(def.target) ? def.target : []).map((s) => `<option value="${esc(s)}">`).join('')}</datalist>` : '';
    const fields: string[] = [];
    if (def.cat) fields.push(`<label class="dj-f"><span>${esc(dj('catL'))}</span><select data-f="category">${CATS.map((c) => `<option value="${c}" ${this.f.category === c ? 'selected' : ''}>${esc(dj('c_' + c))}</option>`).join('')}</select></label>`);
    if (def.prod) fields.push(`<label class="dj-f dj-w2"><span>${esc(lbl)}</span><input type="text" data-f="product" value="${esc(this.f.product)}" ${def.sugg ? 'list="dj-sugg"' : ''} autocomplete="off"></label>`);
    if (def.units) {
      fields.push(`<label class="dj-f"><span>${esc(dj('dose'))}</span><input type="text" inputmode="decimal" data-f="amount" value="${esc(this.f.amount)}"></label>`);
      fields.push(`<label class="dj-f"><span>${esc(dj('unit'))}</span><select data-f="unit">${def.units.map((u) => `<option ${this.f.unit === u ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></label>`);
    }
    if (def.target) fields.push(`<label class="dj-f dj-w2"><span>${esc(dj('target'))}</span><input type="text" data-f="target" value="${esc(this.f.target)}" list="dj-tgt" autocomplete="off"></label>`);
    if (def.depth) fields.push(`<label class="dj-f"><span>${esc(dj('depth'))}</span><input type="text" inputmode="decimal" data-f="depth" value="${esc(this.f.depth)}"></label>`);
    if (def.key !== 'chuva') fields.push(`<label class="dj-f"><span>${esc(dj('rain'))}</span><input type="text" inputmode="decimal" data-f="rain" value="${esc(this.f.rain)}"></label>`);
    fields.push(`<label class="dj-f dj-w3"><span>${esc(dj('note'))}</span><input type="text" data-f="note" value="${esc(this.f.note)}"></label>`);
    const max = [todayIso(), this.opts.getRefDate()].sort().pop()!;
    box.innerHTML = `
      <h3>${esc(dj('newRec'))}</h3>
      <div class="dj-row">
        <label class="dj-f"><span>${esc(dj('date'))}</span><input type="date" data-f="date" value="${esc(this.f.date)}" max="${max}"></label>
      </div>
      <div class="dj-lab">${esc(dj('where'))} <b id="dj-selN">${esc(dj('selN', { n: this.sel.size }))}</b></div>
      <div class="dj-quick"><button type="button" class="dj-mini" data-all>${esc(dj('all', { n: farm.talhoes.length }))}</button>${cropBtns}<button type="button" class="dj-mini ghost" data-none>${esc(dj('none'))}</button></div>
      <div class="dj-chips">${chips}</div>
      <div class="dj-lab">${esc(dj('what'))}</div>
      <div class="dj-types">${types}</div>
      <div class="dj-fields">${fields.join('')}</div>
      ${def.key !== 'chuva' ? `<p class="dj-hint">${esc(dj('rainHint'))}</p>` : ''}
      ${dl}${tl}
      <div class="dj-save"><button type="button" class="dj-primary" data-act="save">${esc(dj('save'))}</button><span id="dj-msg" class="dj-msg">${esc(this.msg)}</span></div>`;
  }

  private paintMsg(): void { const m = this.overlay?.querySelector('#dj-msg'); if (m) m.textContent = this.msg; }

  private renderComplete(): void {
    const box = this.overlay?.querySelector('#dj-complete');
    if (!box) return;
    const farm = this.opts.getFarm();
    const ref = this.opts.getRefDate();
    const act = farm.talhoes.filter((t) => t.crop);
    const stale = act.filter((t) => {
      const last = (t.diary || []).filter((d) => d.date <= ref).map((d) => d.date).sort().pop();
      return !last || diffDays(last, ref) >= 7;
    });
    const ok = act.length - stale.length;
    const pct = act.length ? Math.round((ok / act.length) * 100) : 0;
    const names = stale.slice(0, 12).map((t) => `<button type="button" class="dj-mini warn" data-reg="${t.id}" title="${esc(dj('register'))}">${esc(t.name)} ＋</button>`).join('');
    const extra = stale.length > 12 ? `<span class="dj-more-n">+${stale.length - 12}</span>` : '';
    box.innerHTML = `
      <h3>${esc(dj('complete'))}</h3>
      <div class="dj-bar" role="img" aria-label="${pct}%"><i style="width:${pct}%"></i></div>
      <p class="dj-sum"><b>${pct}%</b> · ${esc(dj('completeN', { a: ok, n: act.length }))}</p>
      ${stale.length ? `<div class="dj-lab">${esc(dj('missing'))}</div><div class="dj-quick">${names}${extra}</div>` : ''}
      <p class="dj-hint" id="dj-filled"></p>`;
  }

  private entriesView(): { date: string; type: DiaryEntryType; items: { t: Talhao; e: DiaryEntry }[] }[] {
    const farm = this.opts.getFarm();
    const flat: { t: Talhao; e: DiaryEntry }[] = [];
    farm.talhoes.forEach((t) => (t.diary || []).forEach((e) => {
      if (this.filterTl && t.id !== this.filterTl) return;
      if (this.filterType && e.type !== this.filterType) return;
      flat.push({ t, e });
    }));
    flat.sort((a, b) => (a.e.date < b.e.date ? 1 : a.e.date > b.e.date ? -1 : 0));
    const groups = new Map<string, { date: string; type: DiaryEntryType; items: { t: Talhao; e: DiaryEntry }[] }>();
    flat.forEach((x) => {
      const key = x.e.groupId ? `${x.e.groupId}` : x.e.id;
      let g = groups.get(key);
      if (!g) { g = { date: x.e.date, type: x.e.type, items: [] }; groups.set(key, g); }
      g.items.push(x);
    });
    return Array.from(groups.values());
  }

  private renderTimeline(): void {
    const box = this.overlay?.querySelector('#dj-timeline');
    if (!box) return;
    const farm = this.opts.getFarm();
    const groups = this.entriesView();
    const view = groups.slice(0, this.shown);
    let lastDay = '';
    const rows = view.map((g) => {
      const e0 = g.items[0].e;
      const def = TYPES.find((x) => x.key === g.type);
      const head = g.date !== lastDay ? `<div class="dj-day"><b>${esc(dayLbl(g.date))}</b><span class="dj-wx" data-wx="${g.date}">…</span></div>` : '';
      lastDay = g.date;
      const bits: string[] = [];
      if (e0.category) bits.push(esc(dj('c_' + e0.category)));
      if (e0.product) bits.push(esc(e0.product));
      if (e0.target) bits.push('' + esc(e0.target));
      if (typeof e0.amount === 'number') bits.push(`${esc(nf(e0.amount, 2))} ${esc(e0.unit || '')}`);
      if (typeof e0.depth === 'number') bits.push(`${esc(nf(e0.depth, 1))} cm`);
      const who = g.items.length > 1 ? `${esc(dj('fieldsN', { n: g.items.length }))}` : esc(g.items[0].t.name);
      const title = g.items.length > 1 ? ` title="${esc(g.items.map((x) => x.t.name).join(', '))}"` : '';
      const ids = g.items.map((x) => x.e.id).join(',');
      return `${head}<div class="dj-ent"><span class="dj-ic">${def?.icon || ''}</span><div class="dj-et"><b>${esc(dj('t_' + g.type))}</b> <span class="dj-who"${title}>· ${who}</span>${bits.length ? `<div class="dj-bits">${bits.join(' · ')}</div>` : ''}${e0.note ? `<div class="dj-note">${esc(e0.note)}</div>` : ''}</div><button type="button" class="dj-del" data-del="${ids}" aria-label="${esc(dj('del'))}">×</button></div>`;
    }).join('');
    const tOpts = `<option value="">${esc(dj('fAll'))}</option>` + farm.talhoes.map((t) => `<option value="${t.id}" ${this.filterTl === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
    const yOpts = `<option value="">${esc(dj('fAllTypes'))}</option>` + TYPES.map((x) => `<option value="${x.key}" ${this.filterType === x.key ? 'selected' : ''}>${esc(dj('t_' + x.key))}</option>`).join('');
    box.innerHTML = `
      <h3>${esc(dj('timeline'))}</h3>
      <div class="dj-filters"><label class="dj-f"><span>${esc(dj('fField'))}</span><select data-flt="tl">${tOpts}</select></label><label class="dj-f"><span>${esc(dj('fType'))}</span><select data-flt="type">${yOpts}</select></label></div>
      ${rows || `<p class="dj-empty">${esc(dj('empty'))}</p>`}
      ${groups.length > this.shown ? `<button type="button" class="dj-mini" data-act="more">${esc(dj('more'))}</button>` : ''}`;
  }

  /** Clima do dia no cabeçalho de cada dia da linha do tempo (talhão filtrado ou centro da fazenda). */
  private async fillDayWeather(): Promise<void> {
    const box = this.overlay?.querySelector('#dj-timeline');
    if (!box) return;
    const els = Array.from(box.querySelectorAll<HTMLElement>('[data-wx]'));
    if (!els.length) return;
    const farm = this.opts.getFarm();
    const t = this.filterTl ? farm.talhoes.find((x) => x.id === this.filterTl) : undefined;
    const c = t && t.coordinates?.length ? this.center(t) : this.farmCenter();
    const dates = els.map((x) => x.dataset.wx!);
    els.forEach((x) => { x.textContent = '…'; });
    let w: Record<string, DiaryWeather> = {};
    try { w = await weatherForDates(c.lat, c.lng, dates); } catch { /* segue sem clima */ }
    els.forEach((x) => {
      if (!x.isConnected) return;
      const a = w[x.dataset.wx!];
      if (!a) { x.textContent = dj('noWx'); return; }
      const parts: string[] = [];
      if (a.rain !== null) parts.push(`${nf(a.rain, 1)} mm`);
      if (a.tmax !== null && a.tmin !== null) parts.push(`${nf(a.tmin, 0)}°–${nf(a.tmax, 0)}°`);
      x.textContent = parts.length ? `${parts.join(' · ')} · ${a.src}` : dj('noWx');
    });
  }
}
