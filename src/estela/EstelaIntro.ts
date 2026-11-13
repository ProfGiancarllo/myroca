/**
 * Apresentação da Estrela na primeira conversa de cada dia.
 * A estrela entra com um salto, a órbita se desenha girando em volta dela, as frases aparecem palavra por palavra
 * e o que ela faz entra item a item. "Começar conversa" expande e dissolve a apresentação, revelando o chat.
 * Com "reduzir movimento" ligado no aparelho, tudo aparece pronto, sem animação.
 */
import { it } from './introText';

const DAY_KEY = 'myroca_estela_intro_day_v1';
const ICON = './assets/brand/spaceagro-icon.svg';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** A apresentação aparece uma vez por dia (pela data real do aparelho). */
export function shouldShowIntro(): boolean {
  try { return localStorage.getItem(DAY_KEY) !== today(); } catch { return false; }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Divide a frase em palavras com atraso crescente, para aparecerem uma a uma. */
function words(text: string, start: number, step = 0.07): { html: string; end: number } {
  const parts = text.split(/(\s+)/);
  let i = 0;
  const html = parts.map((p) => (/^\s+$/.test(p) ? p : `<span class="ei-w" style="animation-delay:${(start + i++ * step).toFixed(2)}s">${esc(p)}</span>`)).join('');
  return { html, end: start + i * step };
}

const FEAT_ICONS = [
  // clima
  '<path d="M7 18h10a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 7.1 9.2 4.4 4.4 0 0 0 7 18z"/>',
  // risco de plantio (broto)
  '<path d="M12 20v-8"/><path d="M12 12c0-3 2-5 6-5 0 3-2 5-6 5z"/><path d="M12 14c0-2.5-1.7-4.2-5-4.2 0 2.5 1.7 4.2 5 4.2z"/>',
  // diário (microfone + linhas)
  '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  // mercado (gráfico)
  '<path d="M4 19h16"/><path d="M5 15l4-4 3 3 6-7"/><path d="M15 7h3v3"/>',
];

export interface IntroOptions {
  /** Fala a apresentação (voz natural), se estiver ligada. */
  speak?: (text: string) => void;
  /** Chamado quando a apresentação some (por "Começar" ou "Pular"). */
  onDone: () => void;
}

export function playEstelaIntro(panel: HTMLElement, opts: IntroOptions): void {
  try { localStorage.setItem(DAY_KEY, today()); } catch { /* ignora */ }
  panel.querySelector('.estela-intro')?.remove();
  const head = panel.querySelector<HTMLElement>('.estela-head');
  const hi = words(it('hi'), 1.0);
  const role = words(it('role'), hi.end + 0.15);
  const leadAt = role.end + 0.25;
  const featsAt = leadAt + 0.35;
  const feats = ['f1', 'f2', 'f3', 'f4'].map((k, i) => `<li class="ei-feat" style="animation-delay:${(featsAt + i * 0.14).toFixed(2)}s"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${FEAT_ICONS[i]}</svg><span>${esc(it(k))}</span></li>`).join('');
  const ctaAt = featsAt + 4 * 0.14 + 0.25;

  const el = document.createElement('div');
  el.className = 'estela-intro';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', it('hi'));
  el.style.top = `${head ? head.offsetHeight : 0}px`;
  el.innerHTML = `
    <div class="ei-stage" aria-hidden="true">
      <span class="ei-halo"></span>
      <svg class="ei-orbit" viewBox="0 0 200 200"><ellipse cx="100" cy="100" rx="88" ry="34" pathLength="100"/></svg>
      <img class="ei-star" src="${ICON}" alt="" />
      <span class="ei-spark s1"></span><span class="ei-spark s2"></span><span class="ei-spark s3"></span>
    </div>
    <h3 class="ei-hi">${hi.html}</h3>
    <p class="ei-role">${role.html}</p>
    <p class="ei-lead" style="animation-delay:${leadAt.toFixed(2)}s">${esc(it('lead'))}</p>
    <ul class="ei-feats">${feats}</ul>
    <div class="ei-actions" style="animation-delay:${ctaAt.toFixed(2)}s">
      <button type="button" class="ei-start">${esc(it('start'))}</button>
      <button type="button" class="ei-skip">${esc(it('skip'))}</button>
    </div>`;
  panel.appendChild(el);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    el.classList.add('ei-leave');
    const done = () => { el.remove(); opts.onDone(); };
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) done();
    else {
      el.addEventListener('animationend', (e) => { if (e.target === el && el.isConnected) done(); });
      window.setTimeout(() => { if (el.isConnected) done(); }, 900);
    }
  };
  el.querySelector<HTMLButtonElement>('.ei-start')!.onclick = close;
  el.querySelector<HTMLButtonElement>('.ei-skip')!.onclick = close;
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  window.setTimeout(() => el.querySelector<HTMLButtonElement>('.ei-start')?.focus({ preventScroll: true }), Math.round(ctaAt * 1000));
  opts.speak?.(`${it('hi')} ${it('role')} ${it('lead')} ${it('f1')}, ${it('f2')}, ${it('f3')}, ${it('f4')}.`);
}
