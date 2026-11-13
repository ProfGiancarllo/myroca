/**
 * Tela inicial (visão geral): título da página com o resumo da fazenda e o cartão "Clima na fazenda".
 * O clima usa a previsão por hora do Open-Meteo; sem conexão, cai para o clima atual do app (NASA POWER ou estimativa).
 * A correção manual do produtor continua valendo para o "agora".
 */
import { FarmData } from '../types';
import { formatDateI18n, formatHectaresI18n, getCurrentLanguage } from '../i18n';
import { ht } from '../i18n/homeText';
import { wt } from '../i18n/weatherText';
import { polygonCentroid } from '../utils/nasaPower';
import { Condition, WeatherState, clearOverride, resolveWeather, setOverride } from '../utils/weather';
import { FarmForecast, HourPoint, fetchFarmForecast, sprayWindow } from '../utils/hourlyForecast';

export interface HomeSideOptions {
  getFarm: () => FarmData;
  getRefDate: () => string;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const CONDS: Condition[] = ['clear', 'partly', 'cloudy', 'rain', 'storm'];
const LOCALES: Record<string, string> = { pt: 'pt-BR', es: 'es', en: 'en-US', de: 'de-DE', zh: 'zh-CN', fr: 'fr-FR' };
const COL = 56; // largura de cada coluna de hora (px)

/** Ícones de traço, uma cor (herdam a cor do texto). */
function wxIcon(cond: Condition, isDay: boolean, size = 26): string {
  const cloud = 'M7 18h10a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 7.1 9.2 4.4 4.4 0 0 0 7 18z';
  const sun = '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>';
  const moon = '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>';
  let body = '';
  if (cond === 'clear') body = isDay ? sun : moon;
  else if (cond === 'partly') body = isDay
    ? '<path d="M8.5 6.2a3.6 3.6 0 0 1 5.9 2.3"/><path d="M8.5 2.5v1.3M3.4 7.6h1.3M4.9 4l.9.9"/><path d="M8 20h9a3.5 3.5 0 0 0 .5-6.96A4.8 4.8 0 0 0 8.2 12.4 3.8 3.8 0 0 0 8 20z"/>'
    : '<path d="M13 3.5a5 5 0 0 0 5.5 6.6"/><path d="M13 3.5a5.5 5.5 0 0 0-4.4 7"/><path d="M8 20h9a3.5 3.5 0 0 0 .5-6.96A4.8 4.8 0 0 0 8.2 12.4 3.8 3.8 0 0 0 8 20z"/>';
  else if (cond === 'cloudy') body = `<path d="${cloud}"/>`;
  else if (cond === 'rain') body = '<path d="M7 15h10a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 7.1 6.2 4.4 4.4 0 0 0 7 15z"/><path d="M8.5 18l-1 2.5M12.5 18l-1 2.5M16.5 18l-1 2.5"/>';
  else body = '<path d="M7 15h10a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 7.1 6.2 4.4 4.4 0 0 0 7 15z"/><path d="M12.5 15.5l-2 3.5h3l-2 3.5"/>';
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
const DROP = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>';

export class HomeSide {
  private wxKey = '';
  private wx: WeatherState | null = null;
  private fc: FarmForecast | null = null;
  private loading = true;
  private picking = false;
  private show48 = false;
  private seq = 0;

  constructor(private opts: HomeSideOptions) {
    this.refresh();
  }

  /** Atualiza o cabeçalho da página e, se a fazenda ou a data mudaram, o clima. */
  refresh(): void {
    const farm = this.opts.getFarm();
    const ref = this.opts.getRefDate();
    const ha = farm.talhoes.reduce((s, t) => s + (t.areaHectares || 0), 0);
    const set = (id: string, v: string) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('home-title', ht('title'));
    set('home-sub', ht('subShort', { farm: farm.farmName || 'SpaceAgro', n: farm.talhoes.length, ha: formatHectaresI18n(ha) }));
    set('home-map-title', ht('mapTitle'));
    set('home-btn-center', ht('center'));
    const c = this.center(farm);
    const key = `${c.lat.toFixed(3)},${c.lng.toFixed(3)},${ref}`;
    if (key !== this.wxKey) { this.wxKey = key; void this.loadWeather(); } else this.renderWeather();
  }

  private center(farm: FarmData): { lat: number; lng: number } {
    const t = farm.talhoes.find((x) => x.coordinates && x.coordinates.length >= 3);
    return t ? polygonCentroid(t.coordinates) : { lat: -17.8, lng: -51.07 };
  }

  private async loadWeather(): Promise<void> {
    const my = ++this.seq;
    this.loading = true;
    this.renderWeather();
    const c = this.center(this.opts.getFarm());
    const [w, fc] = await Promise.all([
      resolveWeather(c.lat, c.lng, undefined, this.opts.getRefDate()).catch(() => null),
      fetchFarmForecast(c.lat, c.lng).catch(() => null),
    ]);
    if (my !== this.seq) return;
    this.wx = w; this.fc = fc; this.loading = false;
    this.renderWeather();
  }

  private loc(): string { return LOCALES[getCurrentLanguage()] || 'pt-BR'; }
  private hhmm(iso: string | null | undefined): string { return iso ? iso.slice(11, 16) : '—'; }

  private dialog: HTMLElement | null = null;

  /** Cartão compacto na lateral e, se estiver aberta, a janela com a previsão completa. */
  private renderWeather(): void {
    this.renderCompact();
    if (this.dialog && this.dialog.style.display !== 'none') this.renderFull(this.dialog.querySelector<HTMLElement>('.wx-dialog')!);
  }

  /** Resumo pequeno (abaixo das commodities); clicar abre a previsão completa. */
  private renderCompact(): void {
    const box = document.getElementById('home-weather');
    if (!box) return;
    const fc = this.fc, w = this.wx;
    if (this.loading && !fc && !w) { box.innerHTML = `<div class="wxc"><div class="wxc-head"><h2>${esc(ht('wxTitle'))}</h2></div><p class="home-empty">${esc(ht('wxLoading'))}</p></div>`; return; }
    const manual = w?.source === 'manual';
    const cond: Condition = manual ? w!.cond : fc ? fc.now.cond : (w?.cond || 'partly');
    const isDay = fc ? fc.now.isDay : true;
    const temp = fc?.now.temp ?? w?.tempC ?? null;
    const time = fc ? new Date(fc.at).toLocaleTimeString(this.loc(), { hour: '2-digit', minute: '2-digit' }) : '';
    const hum = fc?.now.hum ?? w?.humidity ?? null;
    const wind = fc?.now.wind ?? w?.windKmh ?? null;
    const pop = fc?.now.pop ?? null;
    const win = fc ? sprayWindow(fc.hours) : null;
    const spray = fc
      ? `<div class="wxc-spray" title="${esc(ht('sprayRule'))}"><i class="wx-spray-key" aria-hidden="true"></i>${esc(ht('spray'))}: <b>${win ? `${esc(win.start.slice(0, 10) === fc.now.time.slice(0, 10) ? ht('today') : ht('tomorrowLc'))} ${win.start.slice(11, 16)} – ${this.endHour(win.end)}` : esc(ht('sprayNone'))}</b></div>`
      : '';
    box.innerHTML = `<button type="button" class="wxc" id="home-wx-open" aria-haspopup="dialog">
        <span class="wxc-head"><span class="wxc-title">${esc(ht('wxTitle'))}</span><span class="sub">${esc(manual ? wt('srcManual') : time)}</span></span>
        <span class="wxc-main"><span class="wxc-ic">${wxIcon(cond, isDay, 34)}</span><span><span class="wxc-temp">${temp === null ? '—' : Math.round(temp) + '°'}</span><span class="wxc-cond">${esc(wt(cond))}</span></span></span>
        <span class="wxc-sum">${esc(this.summary(cond))}</span>
        <span class="wxc-metrics"><span>${esc(ht('pop'))}<b>${pop === null ? '—' : Math.round(pop) + '%'}</b></span><span>${esc(ht('wind'))}<b>${wind === null ? '—' : Math.round(wind) + ' km/h'}</b></span><span>${esc(ht('hum'))}<b>${hum === null ? '—' : Math.round(hum) + '%'}</b></span></span>
        ${spray}
        <span class="wxc-more">${esc(ht('wxMore'))} ›</span>
      </button>`;
    box.querySelector<HTMLButtonElement>('#home-wx-open')!.onclick = () => this.openDetails();
  }

  /** Janela com a previsão completa (horas, temperatura, dados do dia, 48 h e correção manual). */
  private openDetails(): void {
    if (!this.dialog) {
      this.dialog = document.createElement('div');
      this.dialog.className = 'wx-overlay';
      this.dialog.setAttribute('role', 'dialog');
      this.dialog.setAttribute('aria-modal', 'true');
      this.dialog.setAttribute('aria-label', ht('wxTitle'));
      this.dialog.innerHTML = '<section class="panel home-weather wx-dialog"></section>';
      this.dialog.addEventListener('click', (e) => {
        const el = e.target as HTMLElement;
        if (el === this.dialog || el.closest('[data-wx-close]')) this.closeDetails();
      });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.dialog?.style.display === 'flex') this.closeDetails(); });
      document.body.appendChild(this.dialog);
    }
    this.dialog.style.display = 'flex';
    this.renderFull(this.dialog.querySelector<HTMLElement>('.wx-dialog')!);
    this.dialog.querySelector<HTMLElement>('[data-wx-close]')?.focus();
  }

  private closeDetails(): void {
    if (!this.dialog) return;
    this.dialog.style.display = 'none';
    this.picking = false;
    document.getElementById('home-wx-open')?.focus();
  }

  private renderFull(box: HTMLElement): void {
    const title = `<h2>${esc(ht('wxTitle'))}</h2>`;
    if (this.loading && !this.fc && !this.wx) { box.innerHTML = `<div class="panelhead">${title}</div><div class="panelbody"><p class="home-empty">${esc(ht('wxLoading'))}</p></div>`; return; }
    const fc = this.fc, w = this.wx;
    const manual = w?.source === 'manual';
    const cond: Condition = manual ? w!.cond : fc ? fc.now.cond : (w?.cond || 'partly');
    const isDay = fc ? fc.now.isDay : true;
    const temp = fc?.now.temp ?? w?.tempC ?? null;
    const farm = this.opts.getFarm();
    const updated = fc ? ht('updated', { t: new Date(fc.at).toLocaleTimeString(this.loc(), { hour: '2-digit', minute: '2-digit' }) }) : (w ? this.source(w) : '');

    const head = `<div class="panelhead">${title}<div class="wx-headr"><span class="sub">${esc(manual ? wt('srcManual') : updated)}</span><button type="button" class="wx-link" id="home-wx-fix" aria-expanded="${this.picking}">${esc(ht('wxFix'))}</button><button type="button" class="wx-close" data-wx-close aria-label="${esc(ht('close'))}">&times;</button></div></div>`;
    const pick = this.picking
      ? `<div class="home-wx-pick"><span class="sub">${esc(ht('wxPick'))}</span><div class="home-wx-opts">${CONDS.map((k) => `<button type="button" class="btn btn-secondary${manual && w!.cond === k ? ' on' : ''}" data-wx="${k}">${esc(wt(k))}</button>`).join('')}<button type="button" class="btn btn-secondary" data-wx="auto">${esc(ht('wxAuto'))}</button></div></div>`
      : '';

    const realToday = new Date().toISOString().slice(0, 10);
    const simNote = fc && this.opts.getRefDate() !== realToday ? `<span class="wx-note">${esc(ht('simNote'))}</span>` : '';
    const now = `<div class="wx-now">
        <div class="wx-now-main"><span class="wx-now-ic">${wxIcon(cond, isDay, 44)}</span><div><div class="wx-temp">${temp === null ? '—' : Math.round(temp) + '°'}</div><div class="wx-cond">${esc(wt(cond))}</div></div></div>
        <div class="wx-now-text"><span class="sub">${esc(farm.farmName || 'SpaceAgro')}</span><strong>${esc(this.summary(cond))}</strong>${simNote}</div>
      </div>`;

    let hours = '', tiles = '', foot = '';
    if (fc && fc.hours.length) {
      const list = fc.hours.slice(0, this.show48 ? 48 : 11);
      const win = sprayWindow(fc.hours);
      const inWin = (t: string) => !!win && t >= win.start && t <= win.end;
      type Col = { label: string; ic: string; pop: number | null; temp: number; dayStart: boolean; spray: boolean; now: boolean };
      const cols: Col[] = [{ label: ht('now'), ic: wxIcon(cond, isDay, 22), pop: fc.now.pop, temp: temp ?? list[0].temp, dayStart: false, spray: false, now: true }];
      let midnights = 0;
      list.forEach((p: HourPoint) => {
        const midnight = p.time.slice(11, 13) === '00';
        if (midnight) midnights++;
        const label = midnight ? (midnights === 1 ? ht('tomorrow') : this.weekday(p.time)) : p.time.slice(11, 16);
        cols.push({ label, ic: wxIcon(p.cond, p.isDay, 22), pop: p.pop, temp: p.temp, dayStart: midnight, spray: inWin(p.time), now: false });
      });
      const temps = cols.map((c) => c.temp);
      const mn = Math.min(...temps), mx = Math.max(...temps), rng = mx - mn || 1;
      const W = cols.length * COL, H = 64;
      const xy = cols.map((c, i) => [i * COL + COL / 2, 18 + (1 - (c.temp - mn) / rng) * (H - 30)]);
      const svg = `<svg class="wx-tline" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(ht('tempLine'))}">
        <polyline points="${xy.map(([x, y]) => `${x},${y.toFixed(1)}`).join(' ')}" fill="none" stroke="#3d5249" stroke-width="1.6" stroke-linejoin="round"/>
        ${xy.map(([x, y], i) => `<circle cx="${x}" cy="${y.toFixed(1)}" r="2.6" fill="#182b25"/><text x="${x}" y="${(y - 7).toFixed(1)}" text-anchor="middle" class="wx-tl">${Math.round(cols[i].temp)}°</text>`).join('')}</svg>`;
      hours = `<div class="wx-hours-scroll" tabindex="0" aria-label="${esc(ht('hoursAria'))}"><div class="wx-hours" style="width:${W}px">
          <div class="wx-cols">${cols.map((c) => `<div class="wx-col${c.dayStart ? ' day' : ''}${c.spray ? ' spray' : ''}${c.now ? ' now' : ''}"${c.spray ? ` title="${esc(ht('sprayOk'))}"` : ''}><span class="wx-hl">${esc(c.label)}</span><span class="wx-ic">${c.ic}</span><span class="wx-pop${(c.pop ?? 0) >= 50 ? ' hi' : ''}" title="${esc(ht('pop'))}">${DROP}${c.pop === null ? '—' : Math.round(c.pop) + '%'}</span></div>`).join('')}</div>
          ${svg}</div></div>`;
      const d0 = fc.days.find((d) => d.date === fc.now.time.slice(0, 10)) || fc.days[0];
      const dash = (v: number | null | undefined, u: string) => (v === null || v === undefined ? '—' : `${Math.round(v * 10) / 10} ${u}`);
      const tile = (k: string, v: string) => `<div class="wx-tile"><span>${esc(ht(k))}</span><b>${v}</b></div>`;
      tiles = `<div class="wx-tiles">${tile('feels', fc.now.feels === null ? '—' : Math.round(fc.now.feels) + '°')}${tile('hum', fc.now.hum === null ? '—' : Math.round(fc.now.hum) + '%')}${tile('wind', dash(fc.now.wind, 'km/h'))}${tile('rain', dash(fc.now.precip, 'mm'))}${tile('sunrise', this.hhmm(d0?.sunrise))}${tile('sunset', this.hhmm(d0?.sunset))}</div>`;
      const sprayTxt = win
        ? `<b>${esc(win.start.slice(0, 10) === fc.now.time.slice(0, 10) ? ht('today') : ht('tomorrowLc'))} ${win.start.slice(11, 16)} – ${this.endHour(win.end)}</b>`
        : `<span>${esc(ht('sprayNone'))}</span>`;
      foot = `<div class="wx-foot"><span class="wx-spray" title="${esc(ht('sprayRule'))}">${esc(ht('spray'))}: ${sprayTxt} <i class="wx-spray-key" aria-hidden="true"></i></span>
        <button type="button" class="wx-link" id="home-wx-48" aria-expanded="${this.show48}">${esc(this.show48 ? ht('h12') : ht('h48'))} ›</button></div>`;
    } else {
      const dash = (v: number | null | undefined, u: string) => (v === null || v === undefined ? '—' : `${Math.round(v * 10) / 10} ${u}`);
      tiles = `<div class="wx-tiles">${w ? `<div class="wx-tile"><span>${esc(ht('hum'))}</span><b>${w.humidity === null ? '—' : Math.round(w.humidity) + '%'}</b></div><div class="wx-tile"><span>${esc(ht('wind'))}</span><b>${dash(w.windKmh, 'km/h')}</b></div><div class="wx-tile"><span>${esc(ht('rain'))}</span><b>${dash(w.rainMm, 'mm')}</b></div>` : ''}</div>`;
      foot = `<div class="wx-foot"><span class="sub">${esc(ht('noHourly'))}${w ? ' · ' + esc(this.source(w)) : ''}</span></div>`;
    }

    box.innerHTML = `${head}<div class="wx-body">${now}${pick}${hours}${tiles}${foot}</div>`;
    box.querySelector<HTMLButtonElement>('#home-wx-fix')!.onclick = () => { this.picking = !this.picking; this.renderWeather(); };
    const b48 = box.querySelector<HTMLButtonElement>('#home-wx-48');
    if (b48) b48.onclick = () => { this.show48 = !this.show48; this.renderWeather(); };
    box.querySelectorAll<HTMLButtonElement>('[data-wx]').forEach((b) => (b.onclick = () => {
      const v = b.dataset.wx!;
      if (v === 'auto') clearOverride(); else setOverride(v as Condition);
      this.picking = false;
      void this.loadWeather();
    }));
  }

  /** Frase do dia: período com chance de chuva (≥ 50%) hoje, ou a condição atual; e máxima/mínima do dia. */
  private summary(cond: Condition): string {
    const fc = this.fc;
    if (!fc) return wt(cond);
    const today = fc.now.time.slice(0, 10);
    const wet = fc.hours.find((h) => h.time.slice(0, 10) === today && (h.pop ?? 0) >= 50);
    let first = wt(cond) + '.';
    if (wet) {
      const hr = Number(wet.time.slice(11, 13));
      first = ht('rainAt', { p: ht(hr < 12 ? 'morning' : hr < 18 ? 'afternoon' : 'night') });
    }
    const d0 = fc.days.find((d) => d.date === today);
    const mm = d0 && d0.tmax !== null && d0.tmin !== null ? ' ' + ht('maxmin', { max: Math.round(d0.tmax), min: Math.round(d0.tmin) }) : '';
    return first + mm;
  }

  private weekday(iso: string): string {
    const d = new Date(iso.slice(0, 10) + 'T12:00:00Z');
    const s = d.toLocaleDateString(this.loc(), { weekday: 'short', timeZone: 'UTC' }).replace('.', '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /** Fim da janela = fim da última hora boa. */
  private endHour(iso: string): string {
    const h = (Number(iso.slice(11, 13)) + 1) % 24;
    return `${String(h).padStart(2, '0')}:00`;
  }

  private source(w: WeatherState): string {
    return w.source === 'openmeteo' ? wt('srcOpenMeteo') : w.source === 'nasa' ? wt('srcNasa', { d: w.note || '' }) : w.source === 'manual' ? wt('srcManual') : wt('srcEstimate');
  }
}
