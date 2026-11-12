/** Marcação automática de lavoura por cor ("varinha mágica"): região parecida com o ponto tocado -> polígono em pixels. */
export interface Seg { poly: [number, number][]; areaFrac: number }

export function segmentField(data: ImageData, sx: number, sy: number, tol: number): Seg | null {
  const w = data.width, h = data.height, px = data.data;
  // suaviza (caixa 5x5) para ignorar as linhas de plantio
  const sm = new Float32Array(w * h * 3), r = 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let R = 0, G = 0, B = 0, n = 0;
    for (let dy = -r; dy <= r; dy++) { const yy = y + dy; if (yy < 0 || yy >= h) continue; for (let dx = -r; dx <= r; dx++) { const xx = x + dx; if (xx < 0 || xx >= w) continue; const i = (yy * w + xx) * 4; R += px[i]; G += px[i + 1]; B += px[i + 2]; n++; } }
    const o = (y * w + x) * 3; sm[o] = R / n; sm[o + 1] = G / n; sm[o + 2] = B / n;
  }
  sx = Math.max(0, Math.min(w - 1, Math.round(sx))); sy = Math.max(0, Math.min(h - 1, Math.round(sy)));
  const so = (sy * w + sx) * 3, cr = sm[so], cg = sm[so + 1], cb = sm[so + 2];
  const t2 = tol * tol;
  let mask: Uint8Array = new Uint8Array(w * h);
  const stack = [sy * w + sx]; mask[sy * w + sx] = 1; let count = 1;
  while (stack.length) {
    const p = stack.pop()!, x = p % w, y = (p / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const q = ny * w + nx; if (mask[q]) continue;
      const o = q * 3, d = (sm[o] - cr) ** 2 + (sm[o + 1] - cg) ** 2 + (sm[o + 2] - cb) ** 2;
      if (d <= t2) { mask[q] = 1; count++; stack.push(q); }
    }
  }
  if (count < 40) return null;
  // fecha buracos e bordas serrilhadas (dilata 3 + erode 3), depois preenche buracos
  const morph = (m: Uint8Array, grow: boolean, k: number) => { for (let it = 0; it < k; it++) { const o = new Uint8Array(m); for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; const nb = m[i - 1] + m[i + 1] + m[i - w] + m[i + w]; if (grow ? (!m[i] && nb > 0) : (m[i] && nb < 4)) o[i] = grow ? 1 : 0; } m = o; } return m; };
  mask = morph(morph(mask, true, 3), false, 3);
  const outside = new Uint8Array(w * h), st2 = [0]; outside[0] = 1; // preenche buracos: o que não é alcançável de fora
  while (st2.length) { const p = st2.pop()!, x = p % w, y = (p / w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const q = ny * w + nx; if (outside[q] || mask[q]) continue; outside[q] = 1; st2.push(q); } }
  let total = 0; for (let i = 0; i < w * h; i++) { if (!outside[i]) { mask[i] = 1; total++; } }
  // contorno (Moore) a partir do ponto mais alto/esquerdo
  let start = -1; for (let i = 0; i < w * h; i++) if (mask[i]) { start = i; break; }
  if (start < 0) return null;
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  const sxp = start % w, syp = (start / w) | 0; let cx = sxp, cy = syp, d = 6; const pts: [number, number][] = [[cx, cy]];
  for (let guard = 0; guard < w * h * 2; guard++) {
    let found = false;
    for (let k = 0; k < 8; k++) { const nd = (d + 6 + k) % 8, nx = cx + dirs[nd][0], ny = cy + dirs[nd][1]; if (at(nx, ny)) { cx = nx; cy = ny; d = nd; found = true; break; } }
    if (!found) break;
    if (cx === sxp && cy === syp) break;
    pts.push([cx, cy]);
  }
  // simplifica (Douglas-Peucker)
  const dp = (a: [number, number][], eps: number): [number, number][] => {
    if (a.length < 3) return a;
    const [x1, y1] = a[0], [x2, y2] = a[a.length - 1], L = Math.hypot(x2 - x1, y2 - y1) || 1; let md = 0, mi = 0;
    for (let i = 1; i < a.length - 1; i++) { const dd = Math.abs((x2 - x1) * (y1 - a[i][1]) - (x1 - a[i][0]) * (y2 - y1)) / L; if (dd > md) { md = dd; mi = i; } }
    if (md > eps) { const l = dp(a.slice(0, mi + 1), eps), r2 = dp(a.slice(mi), eps); return [...l.slice(0, -1), ...r2]; }
    return [a[0], a[a.length - 1]];
  };
  // contorno fechado: divide no ponto mais distante do início e simplifica cada metade
  const far = pts.reduce((bi, p, i) => (Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) > Math.hypot(pts[bi][0] - pts[0][0], pts[bi][1] - pts[0][1]) ? i : bi), 0);
  const simp = (e: number): [number, number][] => { const a = dp(pts.slice(0, far + 1), e), b = dp([...pts.slice(far), pts[0]], e); return [...a.slice(0, -1), ...b.slice(0, -1)]; };
  let eps = Math.max(2.5, w / 260), poly = simp(eps);
  while (poly.length > 24) { eps *= 1.35; poly = simp(eps); }
  if (poly.length < 3) return null;
  return { poly, areaFrac: total / (w * h) };
}
