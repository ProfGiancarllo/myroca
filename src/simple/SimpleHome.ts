import { FarmData, Talhao, DiaryEntryType } from '../types';
import { dj } from '../i18n/diarioText';
import { EstelaChat } from '../estela/EstelaChat';
import { sx } from './simpleText';
import { et } from '../estela/estelaText';
import { wt } from '../i18n/weatherText';
import { translateCropName, getCurrentLanguage } from '../i18n';
import { calculateTalhaoCropStatus } from '../utils/cropCalendar';
import { fetchNasaSeries, polygonCentroid } from '../utils/nasaPower';
import { assessPlanting } from '../utils/agronomyRules';
import { resolveWeather, setOverride, clearOverride, Condition } from '../utils/weather';
import { cropKey } from '../utils/forecast';
import { sf } from '../i18n/safraText';
import { switchHeadline } from '../components/RotationPlanner';
import { calculateExpectedHarvestDate, diffDays } from '../utils/cropCalendar';

export interface SimpleHomeOptions {
  getFarm: () => FarmData;
  getRefDate: () => string;
  getEstela: () => EstelaChat;
  openRotation: (tab?: 'current' | 'switch') => void;
  openDiary: () => void;
  onShowFull: () => void;
}

const MODE_KEY = 'myroca_ui_mode_v1';
const ICON: Record<string, string> = { clear: '☀️', partly: '⛅', cloudy: '☁️', rain: '🌧️', storm: '⛈️' };
const RECORDS: [DiaryEntryType, string][] = [['chuva', '🌧️'], ['irrigacao', '💧'], ['adubacao', '🌱'], ['aplicacao', '🧪'], ['plantio', '🌾'], ['colheita', '🚜']];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export class SimpleHome {
  private root: HTMLElement;
  private pill: HTMLButtonElement;
  private timer: number | undefined;
  private nasaCache = new Map<string, { at: number; level: 'low' | 'medium' | 'high' | null }>();

  constructor(private opts: SimpleHomeOptions) {
    this.root = document.createElement('div');
    this.root.id = 'simple-home';
    this.root.style.display = 'none';
    document.body.appendChild(this.root);
    this.pill = document.createElement('button');
    this.pill.id = 'simple-pill';
    this.pill.type = 'button';
    this.pill.style.display = 'none';
    this.pill.onclick = () => this.setMode('simple');
    document.body.appendChild(this.pill);
    this.setMode(SimpleHome.savedMode(), false);
  }

  static savedMode(): 'simple' | 'full' {
    try { return localStorage.getItem(MODE_KEY) === 'full' ? 'full' : 'simple'; } catch { return 'simple'; }
  }

  public isSimple(): boolean { return this.root.style.display !== 'none'; }

  public setMode(mode: 'simple' | 'full', save = true): void {
    if (save) { try { localStorage.setItem(MODE_KEY, mode); } catch { /* ignora */ } }
    const simple = mode === 'simple';
    this.root.style.display = simple ? 'block' : 'none';
    this.pill.style.display = simple ? 'none' : 'block';
    this.pill.textContent = '🏠 ' + sx('simple');
    document.body.classList.toggle('mode-simple', simple);
    window.clearInterval(this.timer);
    if (simple) { this.render(); this.timer = window.setInterval(() => this.refresh(), 5 * 60 * 1000); }
  }

  public refresh(): void { if (this.isSimple()) this.render(); }

  private tName = (tl: Talhao) => tl.name.replace(/\s*\[(Exemplo|Example|Ejemplo|Beispiel|Exemple|示例)\]\s*/i, '').trim();

  private render(): void {
    const farm = this.opts.getFarm();
    const ref = this.opts.getRefDate();
    const estela = this.opts.getEstela();
    const n = estela.pendingCount();
    const d = new Date();
    const lang = ({ pt: 'pt-BR', es: 'es-ES', en: 'en-US', de: 'de-DE', zh: 'zh-CN', fr: 'fr-FR' } as Record<string, string>)[getCurrentLanguage()] || 'pt-BR';
    let dateTxt = '';
    try { dateTxt = d.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' }); dateTxt = dateTxt.charAt(0).toUpperCase() + dateTxt.slice(1); } catch { dateTxt = ref; }

    this.root.innerHTML = `
      <div class="sh-wrap">
        <header class="sh-top">
          <div class="sh-brand">🌱 MyRoça <small>${esc(farm.farmName || '')}</small></div>
          <button type="button" class="sh-link" id="sh-full">🗺️ ${sx('full')}</button>
        </header>
        <div class="sh-date">${esc(dateTxt)}</div>
        ${this.hero(farm, ref)}
        <div class="sh-grid">
          <section class="sh-card sh-todo">
            <h2>📋 ${sx('todo')}</h2>
            <p class="sh-big">${n ? esc(sx('todoN', { n })) : '✅ ' + esc(sx('allDone'))}</p>
            ${n ? `<div class="sh-row"><button type="button" class="sh-btn sh-primary" id="sh-voice">🎤 ${sx('voice')}</button><button type="button" class="sh-btn" id="sh-typed">✍️ ${sx('typed')}</button></div>` : ''}
          </section>
          <section class="sh-card" id="sh-weather"><h2>⛅ ${sx('weather')}</h2><p class="sh-big">…</p></section>
          <section class="sh-card sh-wide" id="sh-nasa"><h2>🛰️ ${sx('nasa')}</h2><p class="sh-muted">${sx('loading')}</p></section>
          <section class="sh-card sh-wide sh-diary">
            <button type="button" class="sh-btn sh-primary sh-xl" id="sh-diary">📓 ${esc(dj('btn'))}</button>
          </section>
          <section class="sh-card sh-wide">
            <h2>📒 ${sx('record')}</h2>
            <div class="sh-rec">
              ${RECORDS.map(([t, ic]) => `<button type="button" class="sh-btn sh-rbtn" data-rec="${t}"><span>${ic}</span>${esc(et('diary_' + t))}</button>`).join('')}
            </div>
          </section>
        </div>
        <div class="sh-bottom">
          <button type="button" class="sh-btn sh-primary sh-xl" id="sh-talk">🎤 ${sx('talk')}</button>
          <button type="button" class="sh-btn sh-xl" id="sh-plan">🌾 ${sx('plan')}</button>
        </div>
      </div>`;

    const $ = (id: string) => this.root.querySelector<HTMLElement>(id)!;
    $('#sh-full').onclick = () => this.opts.onShowFull();
    $('#sh-talk').onclick = () => estela.listen();
    $('#sh-plan').onclick = () => this.opts.openRotation('switch');
    $('#sh-diary').onclick = () => this.opts.openDiary();
    $('#sh-h-cur').onclick = () => this.opts.openRotation('current');
    $('#sh-h-sw').onclick = () => this.opts.openRotation('switch');
    const v = this.root.querySelector<HTMLElement>('#sh-voice');
    if (v) v.onclick = () => { estela.askPending(); estela.listen(); };
    const ty = this.root.querySelector<HTMLElement>('#sh-typed');
    if (ty) ty.onclick = () => estela.askPending();
    this.root.querySelectorAll<HTMLButtonElement>('[data-rec]').forEach((b) => (b.onclick = () => estela.quickRecord(b.dataset.rec as DiaryEntryType)));

    void this.renderWeather(farm, ref);
    void this.renderNasa(farm, ref);
  }

  private hero(farm: FarmData, ref: string): string {
    const live = farm.talhoes.filter((tl) => {
      const st = calculateTalhaoCropStatus(tl, ref);
      return !st.isPasture && !!tl.plantingDate && !!tl.cycleDays && tl.plantingDate <= ref && diffDays(ref, tl.harvestDateExpected || calculateExpectedHarvestDate(tl.plantingDate!, tl.cycleDays!)) >= 0;
    });
    let curText = sf('heroCurNone');
    if (live.length) {
      const nxt = live.map((tl) => ({ tl, d: diffDays(ref, tl.harvestDateExpected || calculateExpectedHarvestDate(tl.plantingDate!, tl.cycleDays!)) })).sort((a, b) => a.d - b.d)[0];
      curText = sf('heroCurText', { n: live.length, harvest: sf(nxt.d === 0 ? 'chipHarvestToday' : 'chipHarvest', { name: this.tName(nxt.tl), d: nxt.d }) });
    }
    const hl = switchHeadline(farm, ref);
    const swText = hl ? hl.text + (hl.example ? ` (${sf('exampleShort')})` : '') : sf('heroSwitchNone');
    return `
      <div class="sh-hero">
        <button type="button" class="sh-hcard cur" id="sh-h-cur"><span class="sh-hic">🌾</span><div class="sh-htx"><h2>${sf('heroCur')}</h2><p>${esc(curText)}</p></div><span class="sh-hgo">${sf('heroOpen')} ➜</span></button>
        <button type="button" class="sh-hcard sw" id="sh-h-sw"><span class="sh-hic">🔄</span><div class="sh-htx"><h2>${sf('heroSwitch')}</h2><p>${esc(swText)}</p></div><span class="sh-hgo">${sf('heroOpen')} ➜</span></button>
      </div>`;
  }

  private center(farm: FarmData): { lat: number; lng: number } {
    const t = farm.talhoes.find((x) => x.coordinates && x.coordinates.length >= 3);
    return t ? polygonCentroid(t.coordinates) : { lat: -17.8, lng: -51.07 };
  }

  private async renderWeather(farm: FarmData, ref: string): Promise<void> {
    const box = this.root.querySelector<HTMLElement>('#sh-weather');
    if (!box) return;
    const c = this.center(farm);
    const w = await resolveWeather(c.lat, c.lng, undefined, ref);
    if (!box.isConnected) return;
    const adv = w.cond === 'storm' ? 'adv_storm' : w.cond === 'rain' ? 'adv_rain' : 'adv_ok';
    box.innerHTML = `
      <h2>${ICON[w.cond]} ${sx('weather')}</h2>
      <p class="sh-temp">${w.tempC !== null ? Math.round(w.tempC) + '°C' : ''} <span>${esc(wt(w.cond))}</span></p>
      <p class="sh-big">${esc(sx(adv))}</p>
      <button type="button" class="sh-link" id="sh-fix">✏️ ${sx('fix')}</button>
      <div class="sh-fixrow" id="sh-fixrow" style="display:none">
        ${(['clear', 'partly', 'cloudy', 'rain', 'storm'] as Condition[]).map((k) => `<button type="button" class="sh-btn" data-wx="${k}">${ICON[k]}<small>${esc(wt(k))}</small></button>`).join('')}
        <button type="button" class="sh-link" id="sh-auto">↺ ${esc(wt('auto'))}</button>
      </div>`;
    box.querySelector<HTMLElement>('#sh-fix')!.onclick = () => { const r = box.querySelector<HTMLElement>('#sh-fixrow')!; r.style.display = r.style.display === 'none' ? 'flex' : 'none'; };
    box.querySelectorAll<HTMLButtonElement>('[data-wx]').forEach((b) => (b.onclick = () => { setOverride(b.dataset.wx as Condition); void this.renderWeather(farm, ref); }));
    box.querySelector<HTMLElement>('#sh-auto')!.onclick = () => { clearOverride(); void this.renderWeather(farm, ref); };
  }

  private async renderNasa(farm: FarmData, ref: string): Promise<void> {
    const box = this.root.querySelector<HTMLElement>('#sh-nasa');
    if (!box) return;
    const list = farm.talhoes.filter((t) => t.coordinates && t.coordinates.length >= 3).slice(0, 5);
    if (!list.length) { box.innerHTML = `<h2>🛰️ ${sx('nasa')}</h2><p class="sh-muted">${esc(sx('noField'))}</p><button type="button" class="sh-btn" id="sh-open">🗺️ ${sx('open')}</button>`; box.querySelector<HTMLElement>('#sh-open')!.onclick = () => this.opts.onShowFull(); return; }
    const rows: string[] = [];
    for (const tl of list) {
      const st = calculateTalhaoCropStatus(tl, ref);
      let level: 'low' | 'medium' | 'high' | null = null;
      if (!st.isPasture) {
        const key = tl.id + ref;
        const hit = this.nasaCache.get(key);
        if (hit && Date.now() - hit.at < 30 * 60 * 1000) level = hit.level;
        else {
          try {
            const c = polygonCentroid(tl.coordinates);
            const series = await fetchNasaSeries(c.lat, c.lng, ref, 30);
            const inCycle = !!tl.plantingDate && st.phase.key !== 'preparo';
            level = assessPlanting(series, ref, tl.diary, inCycle).level;
          } catch { level = null; }
          this.nasaCache.set(key, { at: Date.now(), level });
        }
      }
      const dot = level === 'low' ? '🟢' : level === 'medium' ? '🟡' : level === 'high' ? '🔴' : '⚪';
      const word = level === 'low' ? et('riskLow') : level === 'medium' ? et('riskMedium') : level === 'high' ? et('riskHigh') : (st.isPasture ? '' : sx('nasaFail'));
      const days = tl.plantingDate && tl.cycleDays ? ' · ' + sx('day', { d: st.daysPassed, t: tl.cycleDays }) : '';
      rows.push(`<li><span class="sh-dot">${dot}</span><div><strong>${esc(this.tName(tl))}</strong> — ${esc(translateCropName(tl.crop) || '')}${esc(days)}<br><span class="sh-muted">${esc(word)}</span></div></li>`);
    }
    if (!box.isConnected) return;
    void cropKey;
    box.innerHTML = `<h2>🛰️ ${sx('nasa')}</h2><ul class="sh-list">${rows.join('')}</ul>`;
  }
}
