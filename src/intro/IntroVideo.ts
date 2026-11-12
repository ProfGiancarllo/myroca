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

const T = { c1: 0, c2: 2.5, c3: 4.5, c4: 7, c5: 9.5 }; // seconds (12 s total, last scene holds)
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (v: number) => { v = clamp(v); return v * v * (3 - 2 * v); };
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));

function rng(seed: number) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

interface Field { x: number; z: number; w: number; d: number; col: [number, number, number]; pivot: boolean; icon: string; hgt: number; }

export function playIntro(): Promise<void> {
  const q = new URLSearchParams(location.search);
  if (q.get('intro') === '0') return Promise.resolve();
  let seen = false;
  try { seen = sessionStorage.getItem('myroca_intro_seen') === '1'; sessionStorage.setItem('myroca_intro_seen', '1'); } catch { /* ignore */ }
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const speed = reduce ? 3 : seen ? 1.7 : 1;

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

    const r = rng(7);
    const stars = Array.from({ length: 160 }, () => ({ x: r(), y: r(), s: r() * 1.4 + 0.3, p: r() * 6 }));
    // farm layout (world units, field centre x,z)
    const fr = rng(21);
    const palette: [number, number, number][] = [[76, 140, 60], [122, 168, 70], [201, 170, 70], [96, 150, 84], [170, 160, 80], [60, 120, 70]];
    const icons = ['☀️', '🌧️', '⚠️', '💧', '🌱', '☀️'];
    const fields: Field[] = [];
    let n = 0;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      fields.push({ x: -1.5 + i * 1.0 + (fr() - 0.5) * 0.04, z: -0.95 + j * 0.95, w: 0.86, d: 0.8, col: palette[(n++ + (fr() * 3 | 0)) % palette.length], pivot: fr() > 0.7, icon: icons[n % icons.length], hgt: 0.12 + fr() * 0.18 });
    }

    // projection: k=0 top-down, k=1 isometric
    const proj = (x: number, z: number, y: number, k: number, s: number, cx: number, cy: number) => {
      const a = k * Math.PI / 4, e = (Math.PI / 2) - k * (55 * Math.PI / 180);
      const rx = x * Math.cos(a) - z * Math.sin(a), rz = x * Math.sin(a) + z * Math.cos(a);
      return [cx + rx * s, cy + rz * Math.sin(e) * s - y * Math.cos(e) * s];
    };
    const rgb = (c: [number, number, number], m = 1, a = 1) => `rgba(${c[0] * m | 0},${c[1] * m | 0},${c[2] * m | 0},${a})`;

    const drawStars = (t: number, alpha: number) => {
      ctx.fillStyle = '#02040c'; ctx.fillRect(0, 0, W, H);
      stars.forEach((s) => { ctx.globalAlpha = alpha * (0.45 + 0.55 * Math.sin(t * 2 + s.p)); ctx.fillStyle = '#fff'; ctx.fillRect(s.x * W, s.y * H, s.s, s.s); });
      ctx.globalAlpha = 1;
    };
    const drawEarth = (R: number, cx: number, cy: number) => {
      const g = ctx.createRadialGradient(cx, cy, R * 0.98, cx, cy, R * 1.06);
      g.addColorStop(0, 'rgba(90,170,255,0.9)'); g.addColorStop(1, 'rgba(90,170,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.06, 0, 7); ctx.fill();
      const e = ctx.createRadialGradient(cx - R * 0.2, cy - R * 0.3, R * 0.1, cx, cy, R);
      e.addColorStop(0, '#2f7fd0'); e.addColorStop(0.6, '#15508f'); e.addColorStop(1, '#08244a');
      ctx.fillStyle = e; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
      // continents blobs
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.clip();
      const cr = rng(3);
      for (let i = 0; i < 14; i++) { const a = cr() * 6.28, d = cr() * R * 0.9; ctx.fillStyle = `rgba(${70 + cr() * 40 | 0},${130 + cr() * 40 | 0},${70},0.85)`; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, R * (0.05 + cr() * 0.12), R * (0.03 + cr() * 0.08), cr() * 3, 0, 7); ctx.fill(); }
      ctx.restore();
    };
    const drawSat = (x: number, y: number, t: number, sc: number) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.25); ctx.scale(sc, sc);
      ctx.fillStyle = '#1d3b7a'; ctx.strokeStyle = '#7fb2ff'; ctx.lineWidth = 1;
      [-1, 1].forEach((sd) => { for (let i = 0; i < 3; i++) { ctx.fillRect(sd * (26 + i * 22) - (sd < 0 ? 20 : 0), -12, 20, 24); ctx.strokeRect(sd * (26 + i * 22) - (sd < 0 ? 20 : 0), -12, 20, 24); } });
      ctx.fillStyle = '#c9d4e6'; ctx.fillRect(-22, -16, 44, 32); ctx.fillStyle = '#6a7894'; ctx.fillRect(-22, 8, 44, 8);
      ctx.fillStyle = '#0b1530'; ctx.beginPath(); ctx.arc(0, -2, 8, 0, 7); ctx.fill();
      for (let i = 0; i < 4; i++) { const on = Math.sin(t * 9 - i * 1.3) > 0; ctx.fillStyle = on ? '#7dffb0' : '#1a3a2a'; ctx.shadowColor = '#7dffb0'; ctx.shadowBlur = on ? 10 : 0; ctx.beginPath(); ctx.arc(-15 + i * 10, 12, 2.4, 0, 7); ctx.fill(); }
      ctx.shadowBlur = 0; ctx.restore();
    };

    const drawFarm = (t: number, k: number, grow: number, s: number, alpha: number, gridGlow: number) => {
      const cx = W / 2, cy = H * 0.52;
      ctx.globalAlpha = alpha;
      // ground
      const gg = ctx.createLinearGradient(0, 0, 0, H); gg.addColorStop(0, '#0e1d12'); gg.addColorStop(1, '#16301c');
      ctx.fillStyle = k < 0.3 ? '#5a4a2c' : gg; ctx.fillRect(0, 0, W, H);
      const order = fields.map((f, i) => ({ f, i })).sort((a, b) => (a.f.x + a.f.z) - (b.f.x + b.f.z));
      order.forEach(({ f, i }) => {
        const h = f.hgt * grow;
        const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [f.x + sx * f.w / 2, f.z + sz * f.d / 2]);
        const top = c.map(([x, z]) => proj(x, z, h, k, s, cx, cy));
        const base = c.map(([x, z]) => proj(x, z, 0, k, s, cx, cy));
        if (h > 0.002) { // sides
          [[0, 1], [1, 2], [2, 3], [3, 0]].forEach(([a, b], si) => { ctx.fillStyle = rgb(f.col, 0.45 + si * 0.08); ctx.beginPath(); ctx.moveTo(base[a][0], base[a][1]); ctx.lineTo(base[b][0], base[b][1]); ctx.lineTo(top[b][0], top[b][1]); ctx.lineTo(top[a][0], top[a][1]); ctx.closePath(); ctx.fill(); });
        }
        ctx.fillStyle = rgb(f.col); ctx.beginPath(); top.forEach((p, pi) => pi ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill();
        // crop rows
        ctx.strokeStyle = rgb(f.col, 0.72, 0.8); ctx.lineWidth = Math.max(0.6, s * 0.006);
        for (let l = 1; l < 9; l++) { const u = l / 9; const a = proj(f.x - f.w / 2 + f.w * u, f.z - f.d / 2, h, k, s, cx, cy), b = proj(f.x - f.w / 2 + f.w * u, f.z + f.d / 2, h, k, s, cx, cy); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
        if (f.pivot) { const p = proj(f.x, f.z, h, k, s, cx, cy); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(p[0], p[1], s * 0.36, s * 0.36 * Math.sin((Math.PI / 2) - k * 0.96), 0, 0, 7); ctx.fill(); }
        if (gridGlow > 0) { ctx.strokeStyle = `rgba(110,200,255,${0.95 * gridGlow})`; ctx.lineWidth = 2; ctx.shadowColor = '#5ec8ff'; ctx.shadowBlur = 12 * gridGlow; ctx.beginPath(); top.forEach((p, pi) => pi ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.stroke(); ctx.shadowBlur = 0; }
        if (gridGlow > 0.8 && k > 0.8 && (i % 2 === 0)) { const p = proj(f.x, f.z, h + 0.18 + Math.sin(t * 3 + i) * 0.015, k, s, cx, cy); ctx.globalAlpha = alpha * (gridGlow - 0.8) * 5; ctx.font = `${Math.max(16, s * 0.18)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(f.icon, p[0], p[1]); ctx.globalAlpha = alpha; }
      });
      ctx.globalAlpha = 1;
    };

    const drawFarmer = (p: number, t: number) => {
      if (p <= 0) return;
      const sc = Math.min(W, H) / 520, x = W * 0.8 + (1 - p) * 120, y = H * 0.62;
      ctx.save(); ctx.globalAlpha = p; ctx.translate(x, y); ctx.scale(sc, sc);
      ctx.fillStyle = '#2f6fb0'; ctx.beginPath(); ctx.roundRect(-55, 40, 110, 150, 30); ctx.fill(); // shirt
      ctx.fillStyle = '#e0ac84'; ctx.beginPath(); ctx.arc(0, 0, 48, 0, 7); ctx.fill(); // head
      ctx.fillStyle = '#d9a441'; ctx.beginPath(); ctx.ellipse(0, -24, 78, 14, 0, 0, 7); ctx.fill(); // brim
      ctx.beginPath(); ctx.ellipse(0, -36, 46, 30, 0, Math.PI, 0); ctx.fill(); // crown
      ctx.fillStyle = '#8a5a1c'; ctx.fillRect(-46, -34, 92, 8);
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-17, -2, 4.5, 0, 7); ctx.arc(17, -2, 4.5, 0, 7); ctx.fill();
      ctx.strokeStyle = '#7a2e22'; ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 8, 24 + Math.sin(t * 3) * 1.2, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      ctx.fillStyle = 'rgba(224,120,110,0.35)'; ctx.beginPath(); ctx.arc(-30, 14, 8, 0, 7); ctx.arc(30, 14, 8, 0, 7); ctx.fill();
      ctx.restore();
    };

    let start = performance.now(), raf = 0, done = false;
    const finish = () => { if (done) return; done = true; cancelAnimationFrame(raf); removeEventListener('resize', resize); root.classList.add('iv-out'); setTimeout(() => { root.remove(); resolve(); }, 450); };
    (root.querySelector('#iv-skip') as HTMLElement).onclick = finish;
    (root.querySelector('#iv-enter') as HTMLElement).onclick = finish;
    (window as unknown as { __introDone?: () => void }).__introDone = finish;

    const frame = (now: number) => {
      const dbg = (window as unknown as { __introT?: number }).__introT;
      const t = dbg !== undefined ? dbg : ((now - start) / 1000) * speed;
      ctx.clearRect(0, 0, W, H);
      const earthR0 = H * 1.35, ecx = W / 2, ecy = H * 1.62;
      // scenes 1-3: space
      if (t < T.c3 + 3) {
        drawStars(t, 1 - ease(seg(t, 5.6, 6.6)));
        const zoom = ease(seg(t, T.c3 - 0.2, T.c3 + 1.8));
        const R = earthR0 * (1 + zoom * 7), cyy = ecy - zoom * (ecy - H * 0.55);
        if (t < 7) drawEarth(R, ecx, cyy);
        if (t < T.c3) {
          const sx = W * (0.15 + 0.55 * ease(seg(t, 0, 2.4))), sy = H * (0.3 - 0.05 * Math.sin(t));
          drawSat(sx, sy, t, Math.min(W, H) / 520 * 1.25);
          if (t > 0.9 && t < T.c2 + 0.6) { // scan beam
            ctx.fillStyle = 'rgba(120,210,255,0.16)'; ctx.beginPath(); ctx.moveTo(sx, sy + 10); ctx.lineTo(sx - 160, H * 0.95); ctx.lineTo(sx + 160, H * 0.95); ctx.closePath(); ctx.fill();
          }
          if (t > T.c2) { // data cloud
            ctx.globalCompositeOperation = 'lighter';
            const tx0 = W * 0.5, ty0 = H * 0.72, sx0 = sx, sy0 = sy + 14;
            for (let i = 0; i < 300; i++) {
              const dl = (i / 300) * 0.7, p = ease(seg(t, T.c2 + dl, T.c2 + dl + 1.1)); if (p <= 0 || p >= 1) continue;
              const hh = (n: number) => { const v = Math.sin(n * 127.1 + i * 311.7) * 43758.5453; return v - Math.floor(v); }; const spread = Math.sin(p * Math.PI) * 190, ox = (hh(1) - 0.5) * spread, oy = (hh(2) - 0.5) * spread * 0.8;
              const mx = (sx0 + tx0) / 2 + 120, my = (sy0 + ty0) / 2 - 40;
              const bx = (1 - p) * (1 - p) * sx0 + 2 * (1 - p) * p * mx + p * p * tx0 + ox, by = (1 - p) * (1 - p) * sy0 + 2 * (1 - p) * p * my + p * p * ty0 + oy;
              const g = ctx.createRadialGradient(bx, by, 0, bx, by, 20); g.addColorStop(0, 'rgba(140,220,255,0.55)'); g.addColorStop(1, 'rgba(40,120,255,0)');
              ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, 20, 0, 7); ctx.fill();
            }
            ctx.globalCompositeOperation = 'source-over';
          }
        }
        // cloud streaks during dive
        if (t > T.c3 && t < 6.6) { ctx.fillStyle = `rgba(255,255,255,${0.35 * Math.sin(seg(t, T.c3, 6.6) * Math.PI)})`; const cr = rng(9); for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(cr() * W, cr() * H, 120 + cr() * 160, 22 + cr() * 24, 0, 0, 7); ctx.fill(); } }
      }
      // scene 3-5: farm
      if (t >= 5.6) {
        const fa = ease(seg(t, 5.6, 6.6));
        const dive = 1 - ease(seg(t, 5.6, T.c4));
        const k = ease(seg(t, T.c4 + 0.1, T.c4 + 1.9));
        const grow = ease(seg(t, T.c4 + 1.0, T.c4 + 2.3));
        const s = Math.min(W, H) * (0.235 + 0.6 * dive) * 1.0 * (1 - 0.0 * k);
        const glow = ease(seg(t, T.c4 + 0.2, T.c4 + 1.1));
        drawFarm(t, k, grow, s, fa, glow);
      }
      // ending
      if (t >= T.c5) {
        const p = ease(seg(t, T.c5, T.c5 + 0.9));
        ctx.fillStyle = `rgba(2,8,20,${0.55 * p})`; ctx.fillRect(0, 0, W, H);
        drawFarmer(ease(seg(t, T.c5 + 0.1, T.c5 + 1.1)), t);
        end.classList.toggle('show', p > 0.2);
      }
      // captions
      const cur = t < T.c2 ? 'c1' : t < T.c3 ? 'c2' : t < T.c4 ? 'c3' : t < T.c5 ? 'c4' : '';
      const phase = t < T.c2 ? seg(t, 0.2, 0.8) : t < T.c3 ? seg(t, T.c2, T.c2 + 0.4) : t < T.c4 ? seg(t, T.c3, T.c3 + 0.4) : seg(t, T.c4, T.c4 + 0.4);
      cap.textContent = cur ? tx(cur) : '';
      cap.style.opacity = cur ? String(Math.min(phase, 1)) : '0';
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
}
