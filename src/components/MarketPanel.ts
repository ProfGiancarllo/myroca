/**
 * Painel de mercado do Gêmeo digital: cartão-resumo sobre o mapa e painel completo com preços, curva de futuros das bolsas,
 * margem estimada por cultura e a ligação com a decisão de troca de safra.
 */
import { FarmData } from '../types';
import { translateCropName } from '../i18n';
import { getCurrentLanguage } from '../i18n';
import { CROP_STANDARD_NAME, CropKey, asCropKey } from '../utils/rotation';
import { CropMarket, cropMarket, currentMarket, forwardFactor, loadMarket, slotMargin } from '../utils/market';
import { fmtMoney, switchHeadline } from './RotationPlanner';
import { mk2 } from '../i18n/mercadoText';

export interface MarketPanelOptions {
  getFarm: () => FarmData;
  getRefDate: () => string;
  openRotation: () => void;
}

const LOCALES: Record<string, string> = { pt: 'pt-BR', es: 'es', en: 'en-US', de: 'de-DE', zh: 'zh-CN', fr: 'fr-FR' };
const loc = () => LOCALES[getCurrentLanguage()] || 'pt-BR';
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const ICON: Record<string, string> = { soja: '🌱', milho: '🌽', sorgo: '🌾', feijao: '🫘', algodao: '☁️', trigo: '🌾', cana: '🎋', pasto: '🐄' };
const COLOR: Record<string, string> = { soja: '#22c55e', milho: '#eab308', sorgo: '#f97316', feijao: '#a78bfa', algodao: '#38bdf8', trigo: '#fb923c', cana: '#84cc16', pasto: '#10b981' };
const ALT: CropKey[] = ['soja', 'milho', 'sorgo', 'algodao', 'trigo', 'feijao'];
const HORIZON = 5; // meses até a colheita usados na comparação de margens

const cropLabel = (c: CropKey) => translateCropName(CROP_STANDARD_NAME[c]);
const num = (v: number, d = 2) => v.toLocaleString(loc(), { minimumFractionDigits: d, maximumFractionDigits: d });
const money2 = (v: number) => `R$ ${num(v, v >= 100 ? 0 : 2)}`;
const pct = (v: number) => `${v > 0 ? '+' : ''}${num(v, 1)}%`;
const unitName = (u: CropMarket['unit']) => (u === 'sc' ? mk2('unitSc') : u === '@' ? mk2('unitArr') : mk2('unitT'));
const monthLbl = (iso: string) => { const d = new Date(iso.slice(0, 10) + 'T12:00:00Z'); return `${d.toLocaleDateString(loc(), { month: 'short', timeZone: 'UTC' }).replace('.', '')}/${String(d.getUTCFullYear()).slice(2)}`; };

function spark(vals: number[] | undefined, up: boolean, w = 70, h = 22): string {
  if (!vals || vals.length < 2) return '';
  const mn = Math.min(...vals), mx = Math.max(...vals), r = mx - mn || 1;
  const pts = vals.map((v, i) => `${((i / (vals.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - mn) / r) * (h - 4)).toFixed(1)}`).join(' ');
  return `<svg class="mkp-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline fill="none" stroke="${up ? '#4ade80' : '#f87171'}" stroke-width="1.8" stroke-linejoin="round" points="${pts}"/></svg>`;
}

/** Gráfico de linha em SVG (grade, eixos e último valor). */
function lineChart(pts: Array<{ x: string; y: number }>, color: string, opts: { ref?: number; dots?: boolean; every?: number } = {}): string {
  const W = 540, H = 210, L = 50, R = 14, T = 16, B = 30;
  if (pts.length < 2) return '';
  const ys = pts.map((p) => p.y).concat(opts.ref ? [opts.ref] : []);
  let mn = Math.min(...ys), mx = Math.max(...ys);
  const pad = (mx - mn || mx * 0.05) * 0.12; mn -= pad; mx += pad;
  const X = (i: number) => L + (i / (pts.length - 1)) * (W - L - R), Y = (v: number) => T + (1 - (v - mn) / (mx - mn)) * (H - T - B);
  const grid = [0, 1, 2, 3].map((k) => { const v = mn + ((mx - mn) * k) / 3; return `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="mkp-grid"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" class="mkp-ax">${num(v, v >= 100 ? 0 : 1)}</text>`; }).join('');
  const every = opts.every || Math.max(1, Math.ceil(pts.length / 5));
  const xl = pts.map((p, i) => (i % every === 0 || i === pts.length - 1 ? `<text x="${X(i)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}" class="mkp-ax">${esc(p.x)}</text>` : '')).join('');
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  const area = `${line}L${X(pts.length - 1)},${H - B}L${X(0)},${H - B}Z`;
  const dots = opts.dots ? pts.map((p, i) => `<circle cx="${X(i)}" cy="${Y(p.y)}" r="4" fill="${color}" stroke="#0b1220" stroke-width="1.5"><title>${esc(p.x)}: ${num(p.y, 2)}</title></circle>`).join('') : '';
  const lastI = pts.length - 1, ref = opts.ref ? `<line x1="${L}" x2="${W - R}" y1="${Y(opts.ref)}" y2="${Y(opts.ref)}" class="mkp-ref"/>` : '';
  return `<svg class="mkp-chart" viewBox="0 0 ${W} ${H}" role="img">${grid}${ref}<path d="${area}" fill="${color}" opacity=".14"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>${dots}<circle cx="${X(lastI)}" cy="${Y(pts[lastI].y)}" r="4.5" fill="${color}"/>${xl}</svg>`;
}

export class MarketPanel {
  private card: HTMLButtonElement;
  private overlay: HTMLElement | null = null;
  private sel: CropKey | null = null;

  constructor(private opts: MarketPanelOptions) {
    this.card = document.createElement('button');
    this.card.type = 'button'; this.card.id = 'mkt-card'; this.card.setAttribute('aria-haspopup', 'dialog');
    this.card.addEventListener('click', () => this.open());
    document.body.appendChild(this.card);
    this.refresh();
    void loadMarket().then(() => { this.refresh(); if (this.overlay) this.renderPanel(); });
  }

  /** Culturas do mapa (com mercado), com área e nº de talhões. */
  private farmCrops(): Array<{ crop: CropKey; ha: number; n: number }> {
    const m = new Map<CropKey, { ha: number; n: number }>();
    for (const t of this.opts.getFarm().talhoes) {
      const c = asCropKey(t.crop);
      if (c === 'pousio' || c === 'cobertura') continue;
      const e = m.get(c) || { ha: 0, n: 0 }; e.ha += t.areaHectares || 0; e.n++; m.set(c, e);
    }
    return [...m].map(([crop, v]) => ({ crop, ...v })).filter((x) => cropMarket(x.crop) && (cropMarket(x.crop)!.m.price > 0)).sort((a, b) => b.ha - a.ha);
  }

  private badge(): { txt: string; cls: string } {
    const md = currentMarket();
    const crops = this.farmCrops();
    const real = crops.filter((c) => cropMarket(c.crop)?.m.example === false).length;
    if (md.example || real === 0) return { txt: mk2('example'), cls: 'ex' };
    return real === crops.length ? { txt: mk2('real'), cls: 'real' } : { txt: mk2('partial'), cls: 'part' };
  }

  refresh(): void {
    const crops = this.farmCrops().slice(0, 3);
    const b = this.badge();
    const rows = crops.map(({ crop }) => {
      const m = cropMarket(crop)!.m;
      return `<div class="mkc-row"><span class="mkc-n">${ICON[crop] || '🌱'} ${esc(cropLabel(crop))}</span><span class="mkc-p">${money2(m.price)}<small>/${m.unit}</small></span><span class="mkc-t ${m.trend12m >= 0 ? 'up' : 'dn'}">${m.trend12m >= 0 ? '▲' : '▼'} ${pct(m.trend12m)}</span></div>`;
    }).join('');
    this.card.innerHTML = `<div class="mkc-head"><strong>📈 ${mk2('card')}</strong><span class="mkc-badge ${b.cls}">${esc(b.txt)}</span></div>${rows}<div class="mkc-hint">${mk2('cardHint')} ›</div>`;
    this.card.setAttribute('aria-label', `${mk2('title')}: ${mk2('cardHint')}`);
  }

  open(): void {
    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.className = 'mkp-overlay';
      this.overlay.setAttribute('role', 'dialog'); this.overlay.setAttribute('aria-modal', 'true');
      this.overlay.addEventListener('click', (e) => {
        const el = e.target as HTMLElement;
        if (el === this.overlay || el.closest('[data-act=close]')) return this.close();
        const pick = el.closest('[data-crop]') as HTMLElement | null;
        if (pick) { this.sel = pick.dataset.crop as CropKey; this.renderPanel(); }
        if (el.closest('[data-act=rotation]')) { this.close(); this.opts.openRotation(); }
      });
      document.body.appendChild(this.overlay);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.overlay?.style.display !== 'none') this.close(); });
    }
    this.overlay.style.display = 'flex';
    document.body.classList.add('mkp-open');
    this.renderPanel();
  }

  close(): void { if (this.overlay) this.overlay.style.display = 'none'; document.body.classList.remove('mkp-open'); }

  private renderPanel(): void {
    if (!this.overlay) return;
    const md = currentMarket();
    const farm = this.farmCrops();
    const inFarm = new Set(farm.map((f) => f.crop));
    const list: CropKey[] = [...farm.map((f) => f.crop), ...ALT.filter((c) => !inFarm.has(c) && cropMarket(c))];
    if (!this.sel || !list.includes(this.sel)) this.sel = list[0] || null;
    const b = this.badge();

    const cards = farm.map(({ crop, ha, n }) => {
      const m = cropMarket(crop)!.m;
      const real = m.example === false;
      return `<button type="button" class="mkp-crop ${this.sel === crop ? 'on' : ''}" data-crop="${crop}" style="--c:${COLOR[crop] || '#22c55e'}">
        <div class="mkp-crop-h"><span>${ICON[crop] || '🌱'} <strong>${esc(cropLabel(crop))}</strong></span><i class="mkc-badge ${real ? 'real' : 'ex'}">${real ? mk2('real') : mk2('example')}</i></div>
        <div class="mkp-crop-p">${money2(m.price)} <small>${mk2('perUnit', { u: m.unit })}</small></div>
        <div class="mkp-crop-t ${m.trend12m >= 0 ? 'up' : 'dn'}">${m.trend12m >= 0 ? '▲' : '▼'} ${pct(m.trend12m)} <em>${mk2('trend')}</em> ${spark(m.series, m.trend12m >= 0)}</div>
        <div class="mkp-crop-f">${mk2('fields', { n, ha: num(ha, 0) })}</div></button>`;
    }).join('');

    const detail = this.sel ? this.detail(this.sel) : `<p class="mkp-note">${mk2('noData')}</p>`;
    const alts = list.filter((c) => !inFarm.has(c)).map((c) => `<button type="button" class="mkp-alt ${this.sel === c ? 'on' : ''}" data-crop="${c}">${ICON[c] || '🌱'} ${esc(cropLabel(c))}</button>`).join('');
    const fx = md.fx ? `<div class="mkp-fx"><div class="mkp-fx-h"><strong>💵 ${mk2('fxTitle')}</strong><span>R$ ${num(md.fx.last, 2)}</span></div>${lineChart(md.fx.history.map((h) => ({ x: monthLbl(h.d), y: h.p })), '#60a5fa', { every: 6 })}</div>` : '';

    this.overlay.innerHTML = `<div class="mkp-card">
      <div class="mkp-head"><div><h2>📈 ${mk2('title')}</h2><p>${mk2('sub')}</p></div>
        <div class="mkp-meta"><span class="mkc-badge ${b.cls}">${esc(b.txt)}</span>${md.asOf ? `<span>${mk2('updated', { d: new Date(md.asOf.slice(0, 10) + 'T12:00:00Z').toLocaleDateString(loc(), { timeZone: 'UTC' }) })}</span>` : ''}${md.fx ? `<span>💵 R$ ${num(md.fx.last, 2)}</span>` : ''}</div>
        <button type="button" class="mkp-x" data-act="close" aria-label="${esc(mk2('close'))}">&times;</button></div>
      <div class="mkp-body">
        <h3>${mk2('farmCrops')}</h3><div class="mkp-crops">${cards || `<p class="mkp-note">${mk2('noData')}</p>`}</div>
        ${alts ? `<div class="mkp-alts"><span>${mk2('pick')}:</span>${alts}</div>` : `<p class="mkp-note">${mk2('pick')}</p>`}
        ${detail}
        ${this.ranking(list, inFarm)}
        ${this.impact()}
        <div class="mkp-two">${fx}<div class="mkp-notes"><p>${esc(mk2('parity'))}</p><p>${esc(mk2('exch'))}</p>${md.source ? `<p class="mkp-src">${esc(md.source)}</p>` : ''}<p class="mkp-foot">${mk2('footer')}</p></div></div>
      </div></div>`;
  }

  /** Detalhe da cultura escolhida: indicadores, histórico e curva de futuros. */
  private detail(c: CropKey): string {
    const cm = cropMarket(c); if (!cm) return '';
    const m = cm.m, color = COLOR[c] || '#22c55e';
    const fw = forwardFactor(c, HORIZON);
    const proj = m.price * (fw ? fw.factor : 1 + Math.max(-10, Math.min(10, m.trend12m / 2)) / 100);
    const sm = slotMargin(c, 'low', null, 0, 1, HORIZON);
    const kpi = (l: string, v: string, cls = '') => `<div class="mkp-kpi ${cls}"><span>${l}</span><strong>${v}</strong></div>`;
    const kpis = [
      kpi(mk2('today'), `${money2(m.price)}<small>/${m.unit}</small>`),
      kpi(mk2('trend'), pct(m.trend12m), m.trend12m >= 0 ? 'up' : 'dn'),
      kpi(mk2('proj', { m: HORIZON }), `${money2(proj)}<small>${fw ? ` · ${esc(fw.label)}` : ''}</small>`, proj >= m.price ? 'up' : 'dn'),
      kpi(mk2('vol'), `±${num(m.vol, 0)}%`),
      sm ? kpi(mk2('margin'), fmtMoney(sm.margin.base), sm.margin.base >= 0 ? 'up' : 'dn') : '',
    ].join('');
    const hist = (m.history && m.history.length >= 4) ? m.history.map((h) => ({ x: monthLbl(h.d), y: h.p })) : (m.series || []).map((v, i, a) => ({ x: `${i - a.length + 1}`, y: v }));
    const hist2 = hist.length > 60 ? hist.filter((_, i) => i % 2 === 0 || i === hist.length - 1) : hist;
    const fut = m.futures && m.futures.length >= 2 ? lineChart(m.futures.map((f) => ({ x: f.label, y: f.brl })), color, { ref: m.price, dots: true, every: 1 }) : `<p class="mkp-note">${mk2('noFut')}</p>`;
    const ex = m.example !== false ? `<p class="mkp-warn">⚠️ ${mk2('exampleCrop')}</p>` : '';
    return `<div class="mkp-detail"><h3 style="--c:${color}">${ICON[c] || '🌱'} ${esc(cropLabel(c))} <small>${esc(unitName(m.unit))}${m.native ? ` · ${num(m.native.price, 1)} ${esc(m.native.unit)}` : ''}</small></h3>${ex}
      <div class="mkp-kpis">${kpis}</div>
      <div class="mkp-charts"><div class="mkp-chartbox"><h4>${mk2('histTitle')}</h4>${lineChart(hist2, color)}</div>
      <div class="mkp-chartbox"><h4>${mk2('futTitle')}</h4>${fut}<p class="mkp-help">${mk2('futHelp')}</p></div></div></div>`;
  }

  /** Comparação de margem por hectare entre as culturas (barra = base; traço = pessimista a otimista). */
  private ranking(list: CropKey[], inFarm: Set<CropKey>): string {
    const items = list.map((c) => ({ c, s: slotMargin(c, 'low', null, 0, 1, HORIZON) })).filter((x): x is { c: CropKey; s: NonNullable<ReturnType<typeof slotMargin>> } => !!x.s && x.s.revenue.base > 0)
      .sort((a, b) => b.s.margin.base - a.s.margin.base);
    if (!items.length) return '';
    const vals = items.flatMap((x) => [x.s.margin.pess, x.s.margin.opt, 0]);
    const mn = Math.min(...vals), mx = Math.max(...vals);
    const W = 540, L = 118, R = 70, rowH = 34, H = items.length * rowH + 26;
    const X = (v: number) => L + ((v - mn) / (mx - mn || 1)) * (W - L - R);
    const zero = X(0);
    const rows = items.map(({ c, s }, i) => {
      const y = 12 + i * rowH, base = s.margin.base, col = COLOR[c] || '#22c55e';
      const x1 = Math.min(zero, X(base)), w = Math.abs(X(base) - zero);
      return `<g opacity="${inFarm.has(c) ? 1 : 0.6}"><text x="${L - 8}" y="${y + 15}" text-anchor="end" class="mkp-ax lbl">${esc(cropLabel(c))}${cropMarket(c)?.m.example !== false ? ' *' : ''}</text>
        <rect x="${x1}" y="${y + 3}" width="${Math.max(2, w)}" height="18" rx="4" fill="${base >= 0 ? col : '#f87171'}"/>
        <line x1="${X(s.margin.pess)}" x2="${X(s.margin.opt)}" y1="${y + 12}" y2="${y + 12}" stroke="#e2e8f0" stroke-width="2"/>
        <line x1="${X(s.margin.pess)}" x2="${X(s.margin.pess)}" y1="${y + 7}" y2="${y + 17}" stroke="#e2e8f0" stroke-width="2"/><line x1="${X(s.margin.opt)}" x2="${X(s.margin.opt)}" y1="${y + 7}" y2="${y + 17}" stroke="#e2e8f0" stroke-width="2"/>
        <text x="${W - R + 6}" y="${y + 16}" class="mkp-ax val">${fmtMoney(base)}</text><title>${esc(cropLabel(c))}: ${mk2('pess')} ${fmtMoney(s.margin.pess)} · ${mk2('base')} ${fmtMoney(base)} · ${mk2('opt')} ${fmtMoney(s.margin.opt)}</title></g>`;
    }).join('');
    return `<div class="mkp-rank"><h3>💹 ${mk2('rankTitle')}</h3><p class="mkp-help">${mk2('rankHelp')}</p>
      <svg class="mkp-chart" viewBox="0 0 ${W} ${H}" role="img"><line x1="${zero}" x2="${zero}" y1="4" y2="${H - 22}" class="mkp-zero"/>${rows}</svg><p class="mkp-help">* ${mk2('example')}</p></div>`;
  }

  private impact(): string {
    const farm = this.opts.getFarm();
    let now = '';
    try { const h = switchHeadline(farm, this.opts.getRefDate()); if (h) now = `<p class="mkp-now">🎯 ${esc(mk2('impactNow', { t: h.text }))}</p>`; } catch { /* sem decisão */ }
    let basis = '';
    if (this.sel) {
      const cm = cropMarket(this.sel);
      if (cm) {
        const fw = forwardFactor(this.sel, HORIZON);
        basis = fw ? `<p class="mkp-basis">📅 ${esc(mk2('basisFut', { c: fw.label, p: money2(cm.m.price * fw.factor) }))}</p>`
          : `<p class="mkp-basis">📅 ${esc(mk2('basisTrend', { p: money2(cm.m.price * (1 + Math.max(-10, Math.min(10, cm.m.trend12m / 2)) / 100)) }))}</p>`;
      }
    }
    return `<div class="mkp-impact"><h3>🔗 ${mk2('impactTitle')}</h3><p>${esc(mk2('impactText'))}</p>${basis}${now}<button type="button" class="mkp-go" data-act="rotation">🔄 ${mk2('impactBtn')}</button></div>`;
  }
}
