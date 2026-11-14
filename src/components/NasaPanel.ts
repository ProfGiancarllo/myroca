/**
 * Dados NASA: camadas de satélite no mapa (liga/desliga), água por talhão (balanço de 30 dias e umidade do solo)
 * e a tela "Fontes e método".
 */
import { FarmData } from '../types';
import { nn } from '../i18n/nasaText';
import { NASA_LAYERS, NasaLayerId } from '../utils/nasaLayers';
import { polygonCentroid } from '../utils/nasaPower';
import { waterForPoint, WaterInfo } from '../utils/waterRisk';

export interface NasaPanelOptions {
  getFarm: () => FarmData;
  isLayerOn: (id: NasaLayerId) => boolean;
  layerFailed: (id: NasaLayerId) => boolean;
  setLayer: (id: NasaLayerId, on: boolean) => void;
}
type Tab = 'map' | 'water' | 'src';
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const fx = (v: number, d = 0) => v.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });

export class NasaPanel {
  private overlay: HTMLElement | null = null;
  private tab: Tab = 'map';
  private water = new Map<string, WaterInfo | null | 'loading'>();

  constructor(private opts: NasaPanelOptions) {}

  open(tab: Tab = 'map'): void {
    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.className = 'mkp-overlay nx-overlay';
      this.overlay.setAttribute('role', 'dialog'); this.overlay.setAttribute('aria-modal', 'true');
      this.overlay.addEventListener('click', (e) => this.onClick(e));
      this.overlay.addEventListener('change', (e) => this.onChange(e));
      document.body.appendChild(this.overlay);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.isOpen()) this.close(); });
    }
    this.tab = tab;
    this.overlay.style.display = 'flex';
    document.body.classList.add('mkp-open');
    this.render();
    if (tab === 'water') void this.loadWater();
  }
  close(): void { if (this.overlay) this.overlay.style.display = 'none'; document.body.classList.remove('mkp-open'); }
  isOpen(): boolean { return !!this.overlay && this.overlay.style.display !== 'none'; }

  private onChange(e: Event): void {
    const el = e.target as HTMLInputElement;
    const id = el.dataset?.layer as NasaLayerId | undefined;
    if (!id) return;
    this.opts.setLayer(id, el.checked);
    // a falha de tiles só aparece depois que o mapa tenta carregar
    window.setTimeout(() => { if (this.isOpen() && this.tab === 'map') this.render(); }, 4000);
  }

  private onClick(e: MouseEvent): void {
    const el = e.target as HTMLElement;
    if (el === this.overlay || el.closest('[data-act=close]')) return this.close();
    const tb = el.closest('[data-nxtab]') as HTMLElement | null;
    if (tb) { this.tab = tb.dataset.nxtab as Tab; this.render(); if (this.tab === 'water') void this.loadWater(); }
  }

  private async loadWater(): Promise<void> {
    const farm = this.opts.getFarm();
    const jobs = farm.talhoes.filter((t) => t.coordinates && t.coordinates.length >= 3).map(async (t) => {
      if (this.water.has(t.id) && this.water.get(t.id) !== null) return;
      this.water.set(t.id, 'loading');
      const c = polygonCentroid(t.coordinates);
      this.water.set(t.id, await waterForPoint(c.lat, c.lng));
    });
    this.render();
    await Promise.all(jobs);
    if (this.isOpen() && this.tab === 'water') this.render();
  }

  private render(): void {
    if (!this.overlay) return;
    const tabs: Array<[Tab, string]> = [['map', nn('tabMap')], ['water', nn('tabWater')], ['src', nn('tabSrc')]];
    const nav = `<div class="nx-tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" aria-selected="${this.tab === k}" class="nx-tab ${this.tab === k ? 'on' : ''}" data-nxtab="${k}">${esc(l)}</button>`).join('')}</div>`;
    const body = this.tab === 'map' ? this.mapTab() : this.tab === 'water' ? this.waterTab() : this.srcTab();
    this.overlay.innerHTML = `<div class="mkp-card nx-card"><div class="mkp-head"><div><h2>${esc(nn('title'))}</h2><p>${esc(nn('sub'))}</p></div><button type="button" class="mkp-x" data-act="close" aria-label="${esc(nn('close'))}">×</button></div><div class="mkp-body">${nav}${body}</div></div>`;
  }

  private mapTab(): string {
    const rows = NASA_LAYERS.map((d) => {
      const on = this.opts.isLayerOn(d.id);
      const failed = on && this.opts.layerFailed(d.id);
      const coarse = d.id === 'rain' || d.id === 'smap';
      return `<label class="nx-layer"><input type="checkbox" data-layer="${d.id}" ${on ? 'checked' : ''}><span class="nx-lt"><b>${esc(nn(d.id))}</b><small>${esc(nn(d.id + 'D'))}${coarse ? ' ' + esc(nn('coarse')) : ''} (${esc(d.res)})</small>
        <span class="nx-leg"><i style="background:${d.gradient}"></i><em>${esc(nn('lo'))}</em><em>${esc(nn('hi'))}</em></span>${failed ? `<span class="nx-warn">${esc(nn('unavail'))}</span>` : ''}</span></label>`;
    }).join('');
    return `<p class="nx-intro">${esc(nn('mapIntro'))}</p><div class="nx-layers">${rows}</div>`;
  }

  private waterTab(): string {
    const ts = this.opts.getFarm().talhoes.filter((t) => t.coordinates && t.coordinates.length >= 3);
    if (!ts.length) return `<p class="nx-intro">${esc(nn('noFields'))}</p>`;
    const order = { high: 0, medium: 1, low: 2 } as const;
    const val = (t: typeof ts[number]) => this.water.get(t.id);
    const sorted = [...ts].sort((a, b) => {
      const x = val(a), y = val(b);
      const ox = x && x !== 'loading' ? order[x.level] : 3, oy = y && y !== 'loading' ? order[y.level] : 3;
      return ox - oy;
    });
    const rows = sorted.map((t) => {
      const w = val(t);
      if (w === 'loading' || w === undefined) return `<tr><td>${esc(t.name)}</td><td colspan="6">${esc(nn('loadingW'))}</td></tr>`;
      if (!w) return `<tr><td>${esc(t.name)}</td><td colspan="6">${esc(nn('failW'))}</td></tr>`;
      return `<tr><td>${esc(t.name)}</td><td title="${esc(w.rainSrc)}">${fx(w.rain30)}</td><td>${fx(w.et0)}</td><td>${fx(w.balance)}</td><td>${w.soil === null ? '–' : fx(w.soil * 100) + '%'}</td><td>${fx(w.rainNext3)}</td><td class="nx-risk ${w.level}">${esc(nn(w.level))}</td></tr>`;
    }).join('');
    return `<p class="nx-intro">${esc(nn('waterIntro'))}</p><div class="nx-scroll"><table class="nx-table"><thead><tr><th>${esc(nn('field'))}</th><th>${esc(nn('rain30'))}</th><th>${esc(nn('et0'))}</th><th>${esc(nn('bal'))}</th><th>${esc(nn('soil'))}</th><th>${esc(nn('next3'))}</th><th>${esc(nn('risk'))}</th></tr></thead><tbody>${rows}</tbody></table></div><p class="nx-note">${esc(nn('waterNote'))}</p>`;
  }

  private srcTab(): string {
    const list = (k: string) => `<ul>${nn(k).split('|').map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    return `<h3>${esc(nn('s1'))}</h3>${list('usedList')}<h3>${esc(nn('s2'))}</h3>${list('usList')}<h3>${esc(nn('s3'))}</h3>${list('brList')}<h3>${esc(nn('s4'))}</h3><p class="nx-note">${esc(nn('limits'))}</p>`;
  }
}
