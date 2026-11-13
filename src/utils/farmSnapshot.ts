/** Foto de satélite fixa da fazenda ("fundo do gêmeo digital"): capturada uma vez, guardada no aparelho e renovada periodicamente. */
export interface Snap { key: string; date: number; blob: Blob; bounds: [[number, number], [number, number]] }

const DB = 'myroca_snapshot_v1', STORE = 's', MAX_AGE_DAYS = 30;
const merc = (lat: number, lng: number): [number, number] => {
  const R = 6378137, x = (lng * Math.PI * R) / 180, y = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * R;
  return [x, y];
};
const open = (): Promise<IDBDatabase> => new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const get = async (k: string): Promise<Snap | undefined> => { try { const d = await open(); return await new Promise((res) => { const q = d.transaction(STORE).objectStore(STORE).get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); }); } catch { return undefined; } };
const put = async (k: string, v: Snap): Promise<void> => { try { const d = await open(); await new Promise<void>((res) => { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(v, k); tx.oncomplete = () => res(); tx.onerror = () => res(); }); } catch { /* ignore */ } };

/** Limites da fazenda com folga (90% de cada lado, para a imagem ser bem mais larga que a fazenda), em [sul,oeste],[norte,leste]. */
export function farmBounds(points: [number, number][]): [[number, number], [number, number]] | null {
  if (!points.length) return null;
  const lats = points.map((p) => p[0]), lngs = points.map((p) => p[1]);
  let s = Math.min(...lats), n = Math.max(...lats), w = Math.min(...lngs), e = Math.max(...lngs);
  const dy = Math.max(n - s, 0.006) * 0.9, dx = Math.max(e - w, 0.006) * 0.9;
  s -= dy; n += dy; w -= dx; e += dx;
  return [[s, w], [n, e]];
}

async function download(b: [[number, number], [number, number]]): Promise<Blob> {
  const [x1, y1] = merc(b[0][0], b[0][1]), [x2, y2] = merc(b[1][0], b[1][1]);
  let lastErr: unknown = null;
  // tenta a maior resolução e, se o servidor recusar, resoluções menores
  for (const wpx of [4000, 2400, 1600]) {
    try {
      const hpx = Math.max(400, Math.min(wpx, Math.round(wpx * (y2 - y1) / (x2 - x1))));
      const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${x1},${y1},${x2},${y2}&bboxSR=3857&imageSR=3857&size=${wpx},${hpx}&format=jpg&f=image`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('snapshot ' + r.status);
      const blob = await r.blob();
      if (!blob.type.startsWith('image')) throw new Error('snapshot tipo ' + blob.type);
      return blob;
    } catch (e) { lastErr = e; }
  }
  throw lastErr instanceof Error ? lastErr : new Error('snapshot');
}

/** Devolve a foto guardada (e renova em segundo plano se tiver mais de 30 dias, ou se `force`). */
export async function ensureSnapshot(bounds: [[number, number], [number, number]], force = false): Promise<Snap | null> {
  const key = bounds.flat().map((v) => v.toFixed(3)).join('_');
  const cached = await get(key);
  const old = !cached || Date.now() - cached.date > MAX_AGE_DAYS * 864e5;
  if (cached && !old && !force) return cached;
  try {
    const blob = await download(bounds);
    const snap: Snap = { key, date: Date.now(), blob, bounds };
    await put(key, snap);
    return snap;
  } catch {
    return cached ?? null; // offline: usa a última foto guardada
  }
}
