/** Lavouras da fazenda de demonstração: contornos sobre a imagem aérea embutida (coordenadas em pixels de 900x503). */
export interface DemoField { crop: 'Soja' | 'Milho' | 'Pastagem de braquiária'; plant: string; poly: [number, number][] }

const circle = (cx: number, cy: number, r: number, n = 18): [number, number][] =>
  Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * 2 * Math.PI), Math.min(502, cy + r * Math.sin((i / n) * 2 * Math.PI))]);

export const DEMO_FIELDS: DemoField[] = [
  { crop: 'Soja', plant: '2026-10-12', poly: [[65, 35], [165, 15], [158, 145], [62, 148]] },
  { crop: 'Milho', plant: '2026-07-05', poly: [[166, 20], [245, 5], [236, 120], [160, 142]] },
  { crop: 'Pastagem de braquiária', plant: '', poly: [[1, 62], [70, 62], [62, 146], [1, 143]] },
  { crop: 'Milho', plant: '2026-10-05', poly: [[467, 3], [715, 3], [668, 138], [567, 138], [567, 72], [467, 72]] },
  { crop: 'Soja', plant: '2026-10-18', poly: [[354, 52], [372, 12], [458, 2], [460, 84], [382, 86]] },
  { crop: 'Milho', plant: '2026-10-02', poly: [[662, 30], [718, 2], [735, 120], [690, 138], [660, 100]] },
  { crop: 'Pastagem de braquiária', plant: '', poly: [[748, 5], [899, 1], [899, 140], [752, 148]] },
  { crop: 'Milho', plant: '2026-07-12', poly: [[40, 170], [140, 160], [135, 300], [60, 305], [30, 230]] },
  { crop: 'Soja', plant: '2026-10-08', poly: [[140, 165], [205, 175], [222, 235], [190, 285], [130, 293]] },
  { crop: 'Soja', plant: '2026-10-15', poly: [[250, 165], [400, 160], [398, 198], [250, 196]] },
  { crop: 'Milho', plant: '2026-07-08', poly: [[250, 200], [455, 198], [450, 252], [250, 250]] },
  { crop: 'Milho', plant: '2026-07-10', poly: [[232, 352], [452, 352], [452, 378], [232, 378]] },
  { crop: 'Milho', plant: '2026-07-15', poly: [[557, 158], [738, 156], [738, 196], [560, 196]] },
  { crop: 'Soja', plant: '2026-09-28', poly: circle(655, 280, 92) },
  { crop: 'Milho', plant: '2026-10-01', poly: [[780, 262], [868, 262], [868, 378], [780, 378]] },
  { crop: 'Soja', plant: '2026-10-14', poly: [[765, 165], [885, 160], [898, 250], [768, 258]] },
  { crop: 'Milho', plant: '2026-07-20', poly: [[862, 265], [899, 265], [899, 378], [865, 378]] },
  { crop: 'Soja', plant: '2026-10-20', poly: [[340, 385], [418, 385], [415, 502], [338, 502]] },
  { crop: 'Soja', plant: '2026-10-10', poly: [[470, 388], [556, 386], [558, 502], [462, 502]] },
  { crop: 'Soja', plant: '2026-09-25', poly: circle(672, 450, 98) },
  { crop: 'Soja', plant: '2026-10-16', poly: [[800, 385], [895, 385], [895, 440], [800, 440]] },
  { crop: 'Milho', plant: '2026-10-04', poly: [[800, 445], [899, 445], [899, 502], [800, 502]] },
  { crop: 'Soja', plant: '2026-10-22', poly: [[105, 395], [200, 385], [195, 502], [100, 502]] },
  { crop: 'Milho', plant: '2026-07-18', poly: [[20, 420], [100, 400], [95, 502], [15, 502]] },
];
