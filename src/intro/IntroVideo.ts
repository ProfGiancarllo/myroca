import { getCurrentLanguage } from '../i18n';

type L = 'pt' | 'es' | 'en' | 'de' | 'zh' | 'fr';
const TXT: Record<string, Record<L, string>> = {
  c1: { pt: 'Lá de cima, o planeta inteiro é observado.', en: 'From above, the whole planet is observed.', es: 'Desde arriba, se observa todo el planeta.', de: 'Von oben wird der ganze Planet beobachtet.', zh: '从太空俯瞰，整个地球尽收眼底。', fr: 'Vue d’en haut, toute la planète est observée.' },
  c2: { pt: 'Chuva, temperatura, umidade do solo: dados que chegam até a lavoura.', en: 'Rain, temperature, soil moisture: data that reaches the field.', es: 'Lluvia, temperatura, humedad del suelo: datos que llegan al cultivo.', de: 'Regen, Temperatur, Bodenfeuchte: Daten, die das Feld erreichen.', zh: '降雨、温度、土壤湿度：数据直达农田。', fr: 'Pluie, température, humidité du sol : des données jusqu’à la parcelle.' },
  c3: { pt: 'De todo o planeta, até a sua terra.', en: 'From the whole planet, down to your land.', es: 'De todo el planeta, hasta tu tierra.', de: 'Vom ganzen Planeten bis zu Ihrem Land.', zh: '从整个星球，到你的土地。', fr: 'De toute la planète jusqu’à votre terre.' },
  c4: { pt: 'A fazenda ganha um gêmeo digital.', en: 'The farm gets a digital twin.', es: 'La finca tiene un gemelo digital.', de: 'Der Hof bekommt einen digitalen Zwilling.', zh: '农场拥有了数字孪生。', fr: 'La ferme a désormais un jumeau numérique.' },
  cta: { pt: 'Olhando de cima, a gente te ajuda.', en: 'Looking from above, we help you.', es: 'Mirando desde arriba, te ayudamos.', de: 'Von oben betrachtet, helfen wir Ihnen.', zh: '从高处俯瞰，我们助你一臂之力。', fr: 'En regardant d’en haut, nous vous aidons.' },
  enter: { pt: 'Entrar', en: 'Enter', es: 'Entrar', de: 'Starten', zh: '进入', fr: 'Entrer' },
  skip: { pt: 'Pular', en: 'Skip', es: 'Saltar', de: 'Überspringen', zh: '跳过', fr: 'Passer' },
};
const tx = (k: string): string => TXT[k][(getCurrentLanguage() as L)] || TXT[k].en;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (v: number) => { v = clamp(v); return v * v * (3 - 2 * v); };
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
// timeline (seconds): satélite 0-2.6 | dados 2.6-5 | mergulho 5-7.2 | gêmeo digital 7.2-9.4 | produtor 9.4+
const T = { c1: 0, c2: 2.6, c3: 5, c4: 7.2, c5: 9.4 };
const FILES = ['sat', 'earth', 'farm', 'twin', 'farmer'];

export function playIntro(): Promise<void> {
  const q = new URLSearchParams(location.search);
  if (q.get('intro') === '0') return Promise.resolve();
  let seen = false;
  try { seen = sessionStorage.getItem('myroca_intro_seen') === '1'; sessionStorage.setItem('myroca_intro_seen', '1'); } catch { /* ignore */ }
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const speed = reduce ? 3 : seen ? 1.6 : 1;

  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.id = 'intro-video';
    root.innerHTML = `<canvas></canvas><div class="iv-cap" id="iv-cap"></div>
      <div class="iv-end" id="iv-end"><div class="iv-title">${tx('cta')}</div><div class="iv-sub">MyRoça · NASA Space Apps Challenge 2026</div><button type="button" id="iv-enter">${tx('enter')} ➜</button></div>
      <button type="button" class="iv-skip" id="iv-skip">${tx('skip')} ⏭</button>`;
    document.body.appendChild(root);
    const cv = root.querySelector('canvas') as HTMLCanvasElement;
    const ctx = cv.getContext('2d')!;
    const cap = root.querySelector('#iv-cap') as HTMLElement;
    const end = root.querySelector('#iv-end') as HTMLElement;
    let W = 0, H = 0, dpr = 1;
    const resize = () => { dpr = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize(); addEventListener('resize', resize);

    let done = false, raf = 0;
    const finish = () => { if (done) return; done = true; cancelAnimationFrame(raf); removeEventListener('resize', resize); root.classList.add('iv-out'); setTimeout(() => { root.remove(); resolve(); }, 450); };
    (root.querySelector('#iv-skip') as HTMLElement).onclick = finish;
    (root.querySelector('#iv-enter') as HTMLElement).onclick = finish;
    (window as unknown as { __introDone?: () => void }).__introDone = finish;

    const imgs: Record<string, HTMLImageElement> = {};
    let loaded = 0;
    const base = (import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL || './';
    const begin = () => { if (done || started) return; started = true; start = performance.now(); raf = requestAnimationFrame(frame); };
    let started = false, start = 0;
    FILES.forEach((f) => {
      const im = new Image(); im.onload = im.onerror = () => { if (++loaded === FILES.length) begin(); };
      im.src = base + 'intro/' + f + '.jpg'; imgs[f] = im;
    });
    setTimeout(begin, 4000); // não trava se a rede estiver lenta

    // desenha imagem "cover" com zoom ancorado em (fx,fy) normalizados
    const place = (name: string, alpha: number, zoom: number, fx: number, fy: number, drift = 0) => {
      const im = imgs[name]; if (!im || !im.naturalWidth || alpha <= 0) return;
      const iw = im.naturalWidth, ih = im.naturalHeight, b = Math.max(W / iw, H / ih), sc = b * zoom;
      const ax = (W - iw * b) / 2 + fx * iw * b, ay = (H - ih * b) / 2 + fy * ih * b;
      ctx.globalAlpha = alpha;
      ctx.drawImage(im, ax - fx * iw * sc + drift, ay - fy * ih * sc, iw * sc, ih * sc);
      ctx.globalAlpha = 1;
      return { ax, ay, sc, iw, ih, fx, fy, drift };
    };

    const frame = (now: number) => {
      const dbg = (window as unknown as { __introT?: number }).__introT;
      const t = dbg !== undefined ? dbg : ((now - start) / 1000) * speed;
      ctx.fillStyle = '#02040c'; ctx.fillRect(0, 0, W, H);

      // 1) satélite (zoom lento) + luzinhas piscando
      const aSat = 1 - ease(seg(t, T.c2 - 0.3, T.c2 + 0.5));
      if (aSat > 0) {
        const z = 1 + 0.16 * seg(t, 0, T.c2 + 0.5);
        const g = place('sat', aSat, z, 0.4, 0.35, -t * 6);
        if (g) {
          const leds = [[415, 255], [480, 315], [450, 380], [545, 375], [345, 280], [400, 340]];
          ctx.globalCompositeOperation = 'lighter';
          leds.forEach(([lx, ly], i) => {
            const on = 0.35 + 0.65 * Math.max(0, Math.sin(t * 7 - i * 1.1));
            const k = 1376 / g.iw; // coordenadas de referência 1376x768
            const x = g.ax - g.fx * g.iw * g.sc + g.drift + (lx / k) * g.sc, y = g.ay - g.fy * g.ih * g.sc + (ly / k) * g.sc;
            const rad = 26 * g.sc * k;
            const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
            gr.addColorStop(0, `rgba(120,255,170,${0.85 * on * aSat})`); gr.addColorStop(1, 'rgba(60,255,140,0)');
            ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill();
          });
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      // 2) dados descendo + 3) mergulho até a Terra
      const aEarth = ease(seg(t, T.c2 - 0.3, T.c2 + 0.5)) * (1 - ease(seg(t, T.c3 + 1.0, T.c3 + 1.9)));
      if (aEarth > 0) {
        const dive = seg(t, T.c2, T.c3 + 2.0);
        const z = Math.exp(Math.log(5.5) * dive * dive) * (1 + 0.05 * seg(t, T.c2, T.c3));
        place('earth', aEarth, z, 0.56, 0.6);
        // brilho de nuvens perto do fim do mergulho
        ctx.fillStyle = `rgba(255,255,255,${0.55 * Math.sin(clamp(seg(t, T.c3 + 0.7, T.c3 + 2.1)) * Math.PI)})`; ctx.fillRect(0, 0, W, H);
      }
      // fazenda do alto (descendo) -> gêmeo digital (varredura holográfica)
      const aFarm = ease(seg(t, T.c3 + 1.2, T.c3 + 2.1));
      if (aFarm > 0) {
        const z = 1 + 1.1 * (1 - ease(seg(t, T.c3 + 1.2, T.c4 + 0.4))) + 0.05 * seg(t, T.c4, T.c5 + 1);
        place('farm', aFarm, z, 0.5, 0.5);
        const sweep = ease(seg(t, T.c4 + 0.2, T.c4 + 1.9));
        if (sweep > 0) {
          ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W * sweep, H); ctx.clip();
          place('twin', 1, z, 0.5, 0.5); ctx.restore();
          if (sweep < 1) { const x = W * sweep; const lg = ctx.createLinearGradient(x - 60, 0, x + 6, 0); lg.addColorStop(0, 'rgba(90,220,255,0)'); lg.addColorStop(1, 'rgba(160,240,255,0.9)'); ctx.fillStyle = lg; ctx.fillRect(x - 60, 0, 66, H); }
        }
      }
      // 5) produtor sorrindo + chamada
      if (t >= T.c5 - 0.2) {
        const p = ease(seg(t, T.c5 - 0.2, T.c5 + 0.9));
        place('farmer', p, 1.0 + 0.04 * seg(t, T.c5, T.c5 + 4), 0.8, 0.4);
        const sh = ctx.createLinearGradient(0, 0, W * 0.75, 0); sh.addColorStop(0, `rgba(2,10,24,${0.82 * p})`); sh.addColorStop(1, 'rgba(2,10,24,0)');
        ctx.fillStyle = sh; ctx.fillRect(0, 0, W, H);
        end.classList.toggle('show', p > 0.5);
      }
      // legendas
      const cur = t < T.c2 ? 'c1' : t < T.c3 ? 'c2' : t < T.c4 ? 'c3' : t < T.c5 ? 'c4' : '';
      const st = [T.c1 + 0.2, T.c2, T.c3, T.c4][['c1', 'c2', 'c3', 'c4'].indexOf(cur)] ?? 0;
      cap.textContent = cur ? tx(cur) : '';
      cap.style.opacity = cur ? String(clamp((t - st) / 0.4)) : '0';
      raf = requestAnimationFrame(frame);
    };
  });
}
