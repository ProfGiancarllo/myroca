/**
 * Avatar do produtor rural (gamificação).
 * Configuração, opções, persistência e desenho em canvas 2D (sem imagens externas).
 */

export type Sex = 'female' | 'male' | 'neutral';
export type Build = 'slim' | 'average' | 'athletic' | 'stocky' | 'large';
export type HeightKey = 'short' | 'medium' | 'tall';
export type Age = 'young' | 'adult' | 'mature' | 'senior';
export type FaceShape = 'oval' | 'round' | 'square' | 'long';
export type EyeShape = 'round' | 'almond' | 'narrow';
export type Nose = 'small' | 'medium' | 'wide' | 'pointed';
export type Mouth = 'smile' | 'neutral' | 'broad';
export type Beard = 'none' | 'stubble' | 'mustache' | 'goatee' | 'short' | 'full';
export type HairStyle =
  | 'bald' | 'buzz' | 'short' | 'side' | 'medium' | 'long' | 'ponytail' | 'braid' | 'bun' | 'afro' | 'curly';
export type Outfit = 'tshirt' | 'shirt' | 'checked' | 'overalls' | 'vest' | 'dress';
export type Headwear = 'none' | 'straw' | 'cowboy' | 'cap' | 'bucket' | 'scarf' | 'turban';
export type Accessory = 'none' | 'glasses' | 'sunglasses' | 'earrings' | 'bandana';

export interface AvatarConfig {
  name: string;
  sex: Sex;
  build: Build;
  height: HeightKey;
  age: Age;
  skin: number;
  face: FaceShape;
  eyeShape: EyeShape;
  eyeColor: number;
  nose: Nose;
  mouth: Mouth;
  beard: Beard;
  hairStyle: HairStyle;
  hairColor: number;
  outfit: Outfit;
  outfitColor: number;
  pantsColor: number;
  bootsColor: number;
  headwear: Headwear;
  hatColor: number;
  accessory: Accessory;
}

export const SKIN_COLORS = ['#fde4d0', '#f6cfae', '#eab98f', '#d9a273', '#c08457', '#a56a43', '#8a5232', '#6e3f26', '#523020', '#3b2417'];
export const HAIR_COLORS = ['#0f0a08', '#2b1a10', '#4a2c17', '#7a4a25', '#a8522a', '#c2571f', '#d9a441', '#ecd9a0', '#9a9a9a', '#f2f2f2'];
export const EYE_COLORS = ['#1a1a1a', '#2b1a10', '#5a3a1e', '#8a6a2b', '#3d7a4a', '#3a6ea5', '#7a8a99'];
export const OUTFIT_COLORS = ['#15803d', '#b45309', '#1d4ed8', '#b91c1c', '#7c3aed', '#0f766e', '#e5e7eb', '#facc15', '#334155', '#be185d'];
export const PANTS_COLORS = ['#2f5d8c', '#374151', '#78350f', '#1f2937', '#6b7280', '#14532d'];
export const BOOTS_COLORS = ['#5b3a1e', '#1f1f1f', '#a16207', '#7f1d1d', '#d4d4d4'];
export const HAT_COLORS = ['#e3c46b', '#8a5a2b', '#2f5d8c', '#b32d2d', '#2e7d4f', '#333333', '#e8e8e8', '#d98c2b'];

export const OPTIONS = {
  sex: ['female', 'male', 'neutral'] as Sex[],
  build: ['slim', 'average', 'athletic', 'stocky', 'large'] as Build[],
  height: ['short', 'medium', 'tall'] as HeightKey[],
  age: ['young', 'adult', 'mature', 'senior'] as Age[],
  face: ['oval', 'round', 'square', 'long'] as FaceShape[],
  eyeShape: ['round', 'almond', 'narrow'] as EyeShape[],
  nose: ['small', 'medium', 'wide', 'pointed'] as Nose[],
  mouth: ['smile', 'neutral', 'broad'] as Mouth[],
  beard: ['none', 'stubble', 'mustache', 'goatee', 'short', 'full'] as Beard[],
  hairStyle: ['bald', 'buzz', 'short', 'side', 'medium', 'long', 'ponytail', 'braid', 'bun', 'afro', 'curly'] as HairStyle[],
  outfit: ['tshirt', 'shirt', 'checked', 'overalls', 'vest', 'dress'] as Outfit[],
  headwear: ['none', 'straw', 'cowboy', 'cap', 'bucket', 'scarf', 'turban'] as Headwear[],
  accessory: ['none', 'glasses', 'sunglasses', 'earrings', 'bandana'] as Accessory[],
};

export const DEFAULT_AVATAR: AvatarConfig = {
  name: '',
  sex: 'neutral',
  build: 'average',
  height: 'medium',
  age: 'adult',
  skin: 3,
  face: 'oval',
  eyeShape: 'almond',
  eyeColor: 2,
  nose: 'medium',
  mouth: 'smile',
  beard: 'none',
  hairStyle: 'short',
  hairColor: 1,
  outfit: 'checked',
  outfitColor: 0,
  pantsColor: 0,
  bootsColor: 0,
  headwear: 'straw',
  hatColor: 0,
  accessory: 'none',
};

const STORAGE_KEY = 'myroca_avatar_v1';
const PROMPTED_KEY = 'myroca_avatar_prompted_v1';

function isValid(cfg: unknown): cfg is AvatarConfig {
  if (!cfg || typeof cfg !== 'object') return false;
  const c = cfg as Record<string, unknown>;
  return (
    OPTIONS.sex.includes(c.sex as Sex) &&
    OPTIONS.build.includes(c.build as Build) &&
    OPTIONS.hairStyle.includes(c.hairStyle as HairStyle) &&
    OPTIONS.outfit.includes(c.outfit as Outfit) &&
    typeof c.skin === 'number'
  );
}

export function loadAvatar(): AvatarConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (isValid(parsed)) return { ...DEFAULT_AVATAR, ...parsed };
  } catch {
    // localStorage indisponível
  }
  return null;
}

export function saveAvatar(cfg: AvatarConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // ignora
  }
}

export function wasAvatarPrompted(): boolean {
  try {
    return localStorage.getItem(PROMPTED_KEY) === '1';
  } catch {
    return true;
  }
}

export function markAvatarPrompted(): void {
  try {
    localStorage.setItem(PROMPTED_KEY, '1');
  } catch {
    // ignora
  }
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomAvatar(name = ''): AvatarConfig {
  return {
    name,
    sex: pick(OPTIONS.sex),
    build: pick(OPTIONS.build),
    height: pick(OPTIONS.height),
    age: pick(OPTIONS.age),
    skin: Math.floor(Math.random() * SKIN_COLORS.length),
    face: pick(OPTIONS.face),
    eyeShape: pick(OPTIONS.eyeShape),
    eyeColor: Math.floor(Math.random() * EYE_COLORS.length),
    nose: pick(OPTIONS.nose),
    mouth: pick(OPTIONS.mouth),
    beard: pick(OPTIONS.beard),
    hairStyle: pick(OPTIONS.hairStyle),
    hairColor: Math.floor(Math.random() * HAIR_COLORS.length),
    outfit: pick(OPTIONS.outfit),
    outfitColor: Math.floor(Math.random() * OUTFIT_COLORS.length),
    pantsColor: Math.floor(Math.random() * PANTS_COLORS.length),
    bootsColor: Math.floor(Math.random() * BOOTS_COLORS.length),
    headwear: pick(OPTIONS.headwear),
    hatColor: Math.floor(Math.random() * HAT_COLORS.length),
    accessory: pick(OPTIONS.accessory),
  };
}

// ============================================================
// DESENHO
// ============================================================

export interface AvatarAnim {
  walking: boolean;
  tick: number;
  away: boolean; // true = de costas (andando para o norte da tela)
}

const BUILD_PARAMS: Record<Build, { sw: number; ww: number; hw: number; lw: number; aw: number }> = {
  slim: { sw: 11, ww: 8, hw: 9, lw: 4.2, aw: 3.2 },
  average: { sw: 12.5, ww: 10, hw: 11, lw: 5, aw: 3.8 },
  athletic: { sw: 14.5, ww: 10, hw: 11, lw: 5.4, aw: 4.6 },
  stocky: { sw: 14, ww: 13, hw: 13, lw: 6, aw: 4.4 },
  large: { sw: 16, ww: 17, hw: 16, lw: 7, aw: 5.2 },
};

const HEIGHT_SCALE: Record<HeightKey, number> = { short: 0.9, medium: 1, tall: 1.1 };

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

function ell(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

/**
 * Desenha o avatar. (cx, baseY) = centro dos pés na tela; px = altura em pixels.
 */
export function drawAvatar(
  ctx: CanvasRenderingContext2D,
  cfg: AvatarConfig,
  cx: number,
  baseY: number,
  px: number,
  anim: AvatarAnim
): void {
  const k = (px * HEIGHT_SCALE[cfg.height]) / 108;
  const skin = SKIN_COLORS[cfg.skin] ?? SKIN_COLORS[3];
  const skinDark = shade(skin, -28);
  const hair = HAIR_COLORS[cfg.hairColor] ?? HAIR_COLORS[1];
  const hairDark = shade(hair, -22);
  const outfitC = OUTFIT_COLORS[cfg.outfitColor] ?? OUTFIT_COLORS[0];
  const pantsC = PANTS_COLORS[cfg.pantsColor] ?? PANTS_COLORS[0];
  const bootsC = BOOTS_COLORS[cfg.bootsColor] ?? BOOTS_COLORS[0];
  const hatC = HAT_COLORS[cfg.hatColor] ?? HAT_COLORS[0];
  const eyeC = EYE_COLORS[cfg.eyeColor] ?? EYE_COLORS[1];

  const bp = { ...BUILD_PARAMS[cfg.build] };
  if (cfg.sex === 'female') {
    bp.sw *= 0.92;
    bp.ww *= 0.9;
    bp.hw *= 1.06;
  } else if (cfg.sex === 'male') {
    bp.sw *= 1.05;
    bp.ww *= 1.03;
    bp.hw *= 0.97;
  }

  const phase = anim.walking ? Math.sin(anim.tick * 0.3) : 0;
  const bob = anim.walking ? -Math.abs(Math.cos(anim.tick * 0.3)) * 1.8 : Math.sin(anim.tick * 0.05) * 0.5;
  const stoop = cfg.age === 'senior' ? 2.2 : cfg.age === 'mature' ? 0.8 : 0;

  const headR: Record<Age, number> = { young: 14.5, adult: 14, mature: 14, senior: 13.6 };
  const hy = -80 + bob; // centro da cabeça
  const hx = stoop;
  const faceRx = cfg.face === 'round' ? 14 : cfg.face === 'long' ? 11.5 : cfg.face === 'square' ? 13 : 12.5;
  const faceRy = cfg.face === 'long' ? 16.5 : cfg.face === 'round' ? 14 : cfg.face === 'square' ? 14 : 14.8;
  const hs = headR[cfg.age] / 14;

  ctx.save();
  ctx.translate(cx, baseY);
  ctx.scale(k, k);

  // sombra
  ell(ctx, 0, 1, 17, 4.6, 'rgba(0,0,0,0.28)');

  const isDress = cfg.outfit === 'dress';

  // ---------- cabelo traseiro ----------
  const drawBackHair = () => {
    ctx.fillStyle = hair;
    switch (cfg.hairStyle) {
      case 'long':
        ctx.beginPath();
        ctx.roundRect(hx - faceRx - 3, hy - 6, faceRx * 2 + 6, 38, 9);
        ctx.fill();
        break;
      case 'afro':
        ell(ctx, hx, hy - 4, faceRx + 8, faceRy + 5, hair);
        break;
      case 'curly':
        for (let a = 0; a < 9; a++) {
          const ang = Math.PI * 0.95 + (a / 8) * Math.PI * 1.1;
          ell(ctx, hx + Math.cos(ang) * (faceRx + 3), hy - 2 + Math.sin(ang) * (faceRy + 1) + (a > 6 || a < 2 ? 9 : 0), 6, 6, hair);
        }
        break;
      case 'ponytail':
        ctx.beginPath();
        ctx.ellipse(hx + faceRx + 4, hy + 6, 4.2, 12, -0.25, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'braid':
        for (let i = 0; i < 6; i++) ell(ctx, hx + faceRx - 1 + i * 0.2, hy + 8 + i * 5.2, 3.6, 3.4, i % 2 ? hair : hairDark);
        break;
      default:
        break;
    }
  };

  // ---------- corpo ----------
  const drawLegs = () => {
    const legTop = -38 + bob * 0.4;
    for (const side of [-1, 1]) {
      // vista frontal: o passo é mostrado levantando alternadamente cada perna
      const lift = anim.walking ? Math.max(0, phase * side) * 5 : 0;
      ctx.save();
      ctx.translate(side * (bp.hw * 0.5), legTop);
      const len = 34 - lift;
      // perna
      ctx.fillStyle = isDress ? skin : pantsC;
      ctx.beginPath();
      ctx.roundRect(-bp.lw, 0, bp.lw * 2, len, bp.lw * 0.8);
      ctx.fill();
      if (isDress) {
        ctx.fillStyle = skinDark;
        ctx.fillRect(-bp.lw, len - 14, bp.lw * 2, 0.8);
      }
      // bota
      ctx.fillStyle = bootsC;
      ctx.beginPath();
      ctx.roundRect(-bp.lw - 0.8, len - 8, bp.lw * 2 + 1.6, 9, 3);
      ctx.fill();
      ctx.fillStyle = shade(bootsC, -35);
      ctx.fillRect(-bp.lw - 1, len - 0.6, bp.lw * 2 + 2.4, 1.6);
      ctx.restore();
    }
  };

  const torsoPath = () => {
    ctx.beginPath();
    ctx.moveTo(-bp.sw + stoop * 0.3, -62 + bob);
    ctx.quadraticCurveTo(0, -66 + bob, bp.sw + stoop * 0.3, -62 + bob);
    ctx.lineTo(bp.ww, -46 + bob * 0.6);
    ctx.lineTo(bp.hw, -36 + bob * 0.4);
    ctx.lineTo(-bp.hw, -36 + bob * 0.4);
    ctx.lineTo(-bp.ww, -46 + bob * 0.6);
    ctx.closePath();
  };

  const drawArms = (front: boolean) => {
    // front=false: braço atrás do tronco (não usado); mantém simples: braços desenhados após o tronco
    void front;
    for (const side of [-1, 1]) {
      const a = side * 0.12;
      const x0 = side * (bp.sw - 1) + stoop * 0.3;
      const y0 = -61 + bob;
      const L = 24 - (anim.walking ? phase * side * 3 : 0);
      const x1 = x0 + Math.sin(a) * L;
      const y1 = y0 + Math.cos(a) * L;
      const long = cfg.outfit !== 'tshirt' && cfg.outfit !== 'dress' && cfg.outfit !== 'overalls';
      const sleeveFrac = long ? 0.82 : 0.42;
      ctx.lineCap = 'round';
      // braço (pele)
      ctx.strokeStyle = skin;
      ctx.lineWidth = bp.aw * 1.7;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      // manga
      const sleeveColor = cfg.outfit === 'vest' ? shade('#f1f5f9', -8) : outfitC;
      ctx.strokeStyle = sleeveColor;
      ctx.lineWidth = bp.aw * 2.1;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + (x1 - x0) * sleeveFrac, y0 + (y1 - y0) * sleeveFrac);
      ctx.stroke();
      // mão
      ell(ctx, x1, y1 + 1, bp.aw * 0.95, bp.aw * 0.95, skin);
    }
  };

  const drawTorso = () => {
    // base
    ctx.save();
    torsoPath();
    ctx.fillStyle = cfg.outfit === 'vest' ? '#f1f5f9' : cfg.outfit === 'overalls' ? shade(outfitC, 0) : outfitC;
    ctx.fill();
    ctx.clip();

    if (cfg.outfit === 'checked') {
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 1.4;
      for (let x = -22; x < 24; x += 5) {
        ctx.beginPath();
        ctx.moveTo(x, -68);
        ctx.lineTo(x, -34);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      for (let y = -66; y < -34; y += 5) {
        ctx.beginPath();
        ctx.moveTo(-24, y);
        ctx.lineTo(24, y);
        ctx.stroke();
      }
    }
    if (cfg.outfit === 'shirt' || cfg.outfit === 'checked') {
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(0, -64);
      ctx.lineTo(0, -36);
      ctx.stroke();
    }
    if (cfg.outfit === 'overalls') {
      // babador
      ctx.fillStyle = pantsC;
      ctx.fillRect(-bp.ww + 1, -56, bp.ww * 2 - 2, 22);
      ctx.fillStyle = shade(pantsC, 30);
      ctx.fillRect(-4, -52, 8, 6);
      ctx.fillStyle = shade(pantsC, -25);
      ctx.fillRect(-bp.ww + 1, -57, bp.ww * 2 - 2, 1.2);
    }
    if (cfg.outfit === 'vest') {
      ctx.fillStyle = outfitC;
      ctx.beginPath();
      ctx.moveTo(-bp.sw, -63);
      ctx.lineTo(-3, -63);
      ctx.lineTo(-1.6, -36);
      ctx.lineTo(-bp.hw, -36);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(bp.sw, -63);
      ctx.lineTo(3, -63);
      ctx.lineTo(1.6, -36);
      ctx.lineTo(bp.hw, -36);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    if (cfg.outfit === 'overalls') {
      ctx.strokeStyle = pantsC;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-bp.ww + 3, -56);
      ctx.lineTo(-bp.sw + 4, -63);
      ctx.moveTo(bp.ww - 3, -56);
      ctx.lineTo(bp.sw - 4, -63);
      ctx.stroke();
    }

    if (isDress) {
      // saia
      ctx.beginPath();
      ctx.moveTo(-bp.hw, -38 + bob * 0.4);
      ctx.lineTo(bp.hw, -38 + bob * 0.4);
      ctx.lineTo(bp.hw + 7 + phase * 1.5, -17);
      ctx.quadraticCurveTo(0, -13, -bp.hw - 7 + phase * 1.5, -17);
      ctx.closePath();
      ctx.fillStyle = outfitC;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 0.8;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 3.5, -37);
        ctx.lineTo(i * 5.5, -16);
        ctx.stroke();
      }
    } else {
      // cinto
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(-bp.hw + 0.5, -38.5 + bob * 0.4, bp.hw * 2 - 1, 2.2);
    }
  };

  const drawNeck = () => {
    ctx.fillStyle = skinDark;
    ctx.beginPath();
    ctx.roundRect(hx - 4.2, hy + 10, 8.4, 14, 3);
    ctx.fill();
    if (cfg.outfit === 'shirt' || cfg.outfit === 'checked') {
      ctx.fillStyle = shade(outfitC, 22);
      ctx.beginPath();
      ctx.moveTo(-6, -64 + bob);
      ctx.lineTo(0, -57 + bob);
      ctx.lineTo(6, -64 + bob);
      ctx.lineTo(3, -66 + bob);
      ctx.lineTo(0, -62 + bob);
      ctx.lineTo(-3, -66 + bob);
      ctx.closePath();
      ctx.fill();
    }
    if (cfg.accessory === 'bandana') {
      ctx.fillStyle = hatC;
      ctx.beginPath();
      ctx.moveTo(hx - 7.5, hy + 17);
      ctx.lineTo(hx + 7.5, hy + 17);
      ctx.lineTo(hx, hy + 29);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ell(ctx, hx - 2, hy + 21, 0.9, 0.9, 'rgba(255,255,255,0.7)');
      ell(ctx, hx + 2.5, hy + 22, 0.9, 0.9, 'rgba(255,255,255,0.7)');
    }
  };

  // ---------- cabeça ----------
  const facePath = () => {
    ctx.beginPath();
    if (cfg.face === 'square') {
      ctx.roundRect(hx - faceRx, hy - faceRy, faceRx * 2, faceRy * 2, 8);
    } else {
      ctx.ellipse(hx, hy, faceRx, faceRy, 0, 0, Math.PI * 2);
    }
  };

  const drawHead = () => {
    // orelhas
    ell(ctx, hx - faceRx, hy + 1, 2.6, 3.4, skinDark);
    ell(ctx, hx + faceRx, hy + 1, 2.6, 3.4, skinDark);
    // rosto
    facePath();
    ctx.fillStyle = skin;
    ctx.fill();
    // sombra leve no queixo
    ctx.save();
    facePath();
    ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    ctx.fillRect(hx - faceRx, hy + faceRy * 0.55, faceRx * 2, faceRy);
    ctx.restore();

    if (cfg.accessory === 'earrings') {
      ell(ctx, hx - faceRx, hy + 6, 1.5, 1.5, '#facc15');
      ell(ctx, hx + faceRx, hy + 6, 1.5, 1.5, '#facc15');
    }
  };

  const drawFace = () => {
    const ey = hy + 0.5;
    const ex = 5.2 * hs;
    // sobrancelhas
    ctx.strokeStyle = hairDark;
    ctx.lineWidth = cfg.sex === 'male' ? 1.5 : 1.1;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(hx + s * (ex - 3), ey - 5.2);
      ctx.lineTo(hx + s * (ex + 3), ey - 5.2 - (cfg.eyeShape === 'almond' ? 0.8 : 0.2));
      ctx.stroke();
    }
    // olhos
    for (const s of [-1, 1]) {
      const exx = hx + s * ex;
      if (cfg.eyeShape === 'round') {
        ell(ctx, exx, ey, 2.7, 2.8, '#ffffff');
        ell(ctx, exx, ey + 0.2, 1.75, 1.85, eyeC);
        ell(ctx, exx, ey + 0.2, 0.8, 0.9, '#0b0b0b');
        ell(ctx, exx + 0.6, ey - 0.6, 0.5, 0.5, '#ffffff');
      } else if (cfg.eyeShape === 'almond') {
        ell(ctx, exx, ey, 3, 2, '#ffffff', s * -0.18);
        ell(ctx, exx, ey + 0.1, 1.6, 1.6, eyeC);
        ell(ctx, exx, ey + 0.1, 0.75, 0.8, '#0b0b0b');
        ell(ctx, exx + 0.5, ey - 0.5, 0.45, 0.45, '#ffffff');
      } else {
        ell(ctx, exx, ey, 3, 1.25, '#ffffff', s * -0.1);
        ell(ctx, exx, ey, 1.5, 1.15, eyeC);
        ell(ctx, exx, ey, 0.7, 0.7, '#0b0b0b');
      }
      // pálpebra superior
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(exx - 3, ey - 0.2);
      ctx.quadraticCurveTo(exx, ey - 3.2, exx + 3, ey - 0.2);
      ctx.stroke();
    }
    // rugas por idade
    if (cfg.age === 'mature' || cfg.age === 'senior') {
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 0.6;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(hx + s * (ex + 4), ey + 0.5);
        ctx.lineTo(hx + s * (ex + 6.2), ey + 1.8);
        ctx.moveTo(hx + s * (ex + 4), ey + 2);
        ctx.lineTo(hx + s * (ex + 6), ey + 3.6);
        ctx.stroke();
      }
    }
    if (cfg.age === 'senior') {
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(hx - 5, ey - 9);
      ctx.lineTo(hx + 5, ey - 9);
      ctx.moveTo(hx - 4, ey - 7.6);
      ctx.lineTo(hx + 4, ey - 7.6);
      for (const s of [-1, 1]) {
        ctx.moveTo(hx + s * 3.6, ey + 5);
        ctx.quadraticCurveTo(hx + s * 5.4, ey + 8, hx + s * 4.6, ey + 11);
      }
      ctx.stroke();
    }
    // nariz
    ctx.strokeStyle = shade(skin, -45);
    ctx.fillStyle = shade(skin, -18);
    ctx.lineWidth = 0.9;
    const ny = ey + 6;
    ctx.beginPath();
    if (cfg.nose === 'small') {
      ctx.moveTo(hx - 1.4, ny);
      ctx.quadraticCurveTo(hx, ny + 1.6, hx + 1.4, ny);
    } else if (cfg.nose === 'wide') {
      ctx.moveTo(hx - 3.2, ny + 0.4);
      ctx.quadraticCurveTo(hx, ny + 2.4, hx + 3.2, ny + 0.4);
      ctx.moveTo(hx - 3.2, ny + 0.4);
      ctx.lineTo(hx - 2.4, ny - 0.8);
      ctx.moveTo(hx + 3.2, ny + 0.4);
      ctx.lineTo(hx + 2.4, ny - 0.8);
    } else if (cfg.nose === 'pointed') {
      ctx.moveTo(hx, ny - 5);
      ctx.lineTo(hx - 1.2, ny + 1.2);
      ctx.lineTo(hx + 1.6, ny + 1.2);
    } else {
      ctx.moveTo(hx - 2.2, ny);
      ctx.quadraticCurveTo(hx, ny + 2, hx + 2.2, ny);
      ctx.moveTo(hx, ny - 3.5);
      ctx.lineTo(hx - 0.6, ny);
    }
    ctx.stroke();

    // barba / bigode (antes da boca)
    const my = hy + 9.4;
    ctx.fillStyle = hair;
    if (cfg.beard === 'stubble') {
      ctx.save();
      facePath();
      ctx.clip();
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.moveTo(hx - faceRx, hy + 2);
      ctx.quadraticCurveTo(hx, hy + 8, hx + faceRx, hy + 2);
      ctx.lineTo(hx + faceRx, hy + faceRy + 2);
      ctx.lineTo(hx - faceRx, hy + faceRy + 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (cfg.beard === 'short' || cfg.beard === 'full') {
      const drop = cfg.beard === 'full' ? 13 : 6;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(hx - faceRx - 0.5, hy);
      ctx.quadraticCurveTo(hx - faceRx * 0.6, hy + 7, hx - 6, my - 2);
      ctx.quadraticCurveTo(hx, my - 4.2, hx + 6, my - 2);
      ctx.quadraticCurveTo(hx + faceRx * 0.6, hy + 7, hx + faceRx + 0.5, hy);
      ctx.lineTo(hx + faceRx * 0.8, hy + faceRy + drop * 0.5);
      ctx.quadraticCurveTo(hx, hy + faceRy + drop, hx - faceRx * 0.8, hy + faceRy + drop * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    if (cfg.beard === 'mustache' || cfg.beard === 'goatee') {
      ctx.beginPath();
      ctx.moveTo(hx, my - 3);
      ctx.quadraticCurveTo(hx - 4, my - 4.4, hx - 6.4, my - 1.2);
      ctx.quadraticCurveTo(hx - 3, my - 1.8, hx, my - 1.6);
      ctx.quadraticCurveTo(hx + 3, my - 1.8, hx + 6.4, my - 1.2);
      ctx.quadraticCurveTo(hx + 4, my - 4.4, hx, my - 3);
      ctx.fill();
    }
    if (cfg.beard === 'goatee') {
      ctx.beginPath();
      ctx.moveTo(hx - 3.2, my + 2.4);
      ctx.quadraticCurveTo(hx, my + 5, hx + 3.2, my + 2.4);
      ctx.lineTo(hx + 2.4, hy + faceRy + 3);
      ctx.quadraticCurveTo(hx, hy + faceRy + 5, hx - 2.4, hy + faceRy + 3);
      ctx.closePath();
      ctx.fill();
    }

    // boca
    ctx.lineCap = 'round';
    if (cfg.mouth === 'smile') {
      ctx.strokeStyle = '#7f1d1d';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(hx - 3.6, my);
      ctx.quadraticCurveTo(hx, my + 3.2, hx + 3.6, my);
      ctx.stroke();
    } else if (cfg.mouth === 'broad') {
      ctx.beginPath();
      ctx.moveTo(hx - 5, my - 0.4);
      ctx.quadraticCurveTo(hx, my + 5.4, hx + 5, my - 0.4);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#7f1d1d';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#7f1d1d';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(hx - 3, my + 0.4);
      ctx.lineTo(hx + 3, my + 0.4);
      ctx.stroke();
    }
    // bochechas
    ell(ctx, hx - 8.4, my - 2.6, 2.4, 1.5, 'rgba(240,100,100,0.16)');
    ell(ctx, hx + 8.4, my - 2.6, 2.4, 1.5, 'rgba(240,100,100,0.16)');

    // óculos
    if (cfg.accessory === 'glasses') {
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 1.1;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(hx + s * ex, ey, 4.4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(hx - ex + 4.4, ey);
      ctx.lineTo(hx + ex - 4.4, ey);
      ctx.stroke();
    } else if (cfg.accessory === 'sunglasses') {
      ctx.fillStyle = 'rgba(15,15,20,0.92)';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.roundRect(hx + s * ex - 4.6, ey - 3.2, 9.2, 6.6, 2.6);
        ctx.fill();
      }
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(hx - ex + 4.6, ey - 1);
      ctx.lineTo(hx + ex - 4.6, ey - 1);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(hx - ex - 2.6, ey - 2.4, 2, 1);
      ctx.fillRect(hx + ex - 2.6, ey - 2.4, 2, 1);
    }
  };

  const drawFrontHair = () => {
    const style = cfg.hairStyle;
    if (style === 'bald') return;
    ctx.fillStyle = hair;
    const top = hy - faceRy;
    if (style === 'afro') {
      // franja pequena na testa
      ctx.beginPath();
      ctx.ellipse(hx, top + 3.4, faceRx * 0.95, 5.2, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      return;
    }
    if (style === 'curly') {
      for (let a = 0; a < 7; a++) {
        ell(ctx, hx - faceRx + 2 + a * ((faceRx * 2 - 4) / 6), top + 4 + (a % 2) * 1.6, 4.6, 4.4, hair);
      }
      return;
    }
    // base de calota
    const dropSide = style === 'long' ? 20 : style === 'medium' ? 8 : style === 'short' ? 2 : 0;
    ctx.beginPath();
    ctx.moveTo(hx - faceRx - 1, hy - 1 + dropSide);
    ctx.lineTo(hx - faceRx - 1, hy - 3);
    ctx.bezierCurveTo(hx - faceRx - 2, top - 5, hx + faceRx + 2, top - 5, hx + faceRx + 1, hy - 3);
    ctx.lineTo(hx + faceRx + 1, hy - 1 + dropSide);
    // linha do cabelo (testa)
    if (style === 'buzz') {
      ctx.lineTo(hx + faceRx - 1, hy - 7);
      ctx.quadraticCurveTo(hx, top + 3, hx - faceRx + 1, hy - 7);
      ctx.closePath();
      ctx.globalAlpha = 0.88;
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }
    if (style === 'side') {
      ctx.lineTo(hx + faceRx - 2, hy - 8);
      ctx.quadraticCurveTo(hx + 2, top + 9, hx - faceRx * 0.6, hy - 4);
    } else if (style === 'long' || style === 'medium') {
      ctx.lineTo(hx + faceRx - 4, hy - 4);
      ctx.quadraticCurveTo(hx + 4, top + 7, hx, top + 6);
      ctx.quadraticCurveTo(hx - 4, top + 7, hx - faceRx + 4, hy - 4);
    } else {
      ctx.lineTo(hx + faceRx - 2, hy - 8);
      ctx.quadraticCurveTo(hx, top + 5, hx - faceRx + 2, hy - 8);
    }
    ctx.closePath();
    ctx.fill();
    // mecha de brilho
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(hx - 6, top + 2.4);
    ctx.quadraticCurveTo(hx - 1, top - 0.5, hx + 5, top + 2);
    ctx.stroke();
    if (style === 'bun') {
      ell(ctx, hx, top - 5.5, 6.8, 6.4, hair);
      ell(ctx, hx - 1.4, top - 6.8, 2.2, 1.6, 'rgba(255,255,255,0.14)');
    }
  };

  const drawAwayHair = () => {
    // visto de costas: cabelo cobre toda a cabeça
    if (cfg.hairStyle === 'bald') return;
    facePath();
    ctx.fillStyle = hair;
    ctx.fill();
    if (cfg.hairStyle === 'bun') ell(ctx, hx, hy - faceRy - 3, 6.8, 6.4, hair);
  };

  const drawHeadwear = () => {
    const top = hy - faceRy;
    switch (cfg.headwear) {
      case 'straw': {
        ell(ctx, hx, top + 5.2, 25, 6.2, hatC);
        ell(ctx, hx, top + 5.6, 25, 6.2, 'rgba(0,0,0,0.12)');
        ell(ctx, hx, top + 4.6, 24, 5.6, hatC);
        ctx.fillStyle = hatC;
        ctx.beginPath();
        ctx.ellipse(hx, top + 1.4, 12.5, 11, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#b91c1c';
        ctx.fillRect(hx - 12.2, top + 0.2, 24.4, 3.4);
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.lineWidth = 0.7;
        for (let i = -4; i <= 4; i++) {
          ctx.beginPath();
          ctx.moveTo(hx + i * 2.6, top - 8);
          ctx.lineTo(hx + i * 2.6, top);
          ctx.stroke();
        }
        break;
      }
      case 'cowboy': {
        ctx.fillStyle = hatC;
        ctx.beginPath();
        ctx.moveTo(hx - 27, top + 2);
        ctx.quadraticCurveTo(hx - 20, top + 9, hx, top + 8);
        ctx.quadraticCurveTo(hx + 20, top + 9, hx + 27, top + 2);
        ctx.quadraticCurveTo(hx + 20, top + 3.6, hx, top + 3.4);
        ctx.quadraticCurveTo(hx - 20, top + 3.6, hx - 27, top + 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(hx - 13, top + 5);
        ctx.quadraticCurveTo(hx - 13, top - 14, hx - 4, top - 14);
        ctx.quadraticCurveTo(hx, top - 10, hx + 4, top - 14);
        ctx.quadraticCurveTo(hx + 13, top - 14, hx + 13, top + 5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = shade(hatC, -40);
        ctx.fillRect(hx - 13, top + 0.8, 26, 3);
        break;
      }
      case 'cap': {
        ctx.fillStyle = hatC;
        ctx.beginPath();
        ctx.ellipse(hx, top + 4, faceRx + 1.4, 11.5, 0, Math.PI, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(hx - faceRx - 1.4, top + 3.4, (faceRx + 1.4) * 2, 2.6);
        ctx.fillStyle = shade(hatC, -30);
        ctx.beginPath();
        ctx.ellipse(hx, top + 6.4, faceRx + 4, 3.4, 0, 0, Math.PI);
        ctx.fill();
        ell(ctx, hx, top - 6.6, 1.4, 1.4, shade(hatC, -30));
        break;
      }
      case 'bucket': {
        ctx.fillStyle = hatC;
        ctx.beginPath();
        ctx.ellipse(hx, top + 5.4, faceRx + 8.6, 4.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(hx - faceRx - 1, top + 5);
        ctx.quadraticCurveTo(hx - faceRx + 1, top - 8, hx, top - 8);
        ctx.quadraticCurveTo(hx + faceRx - 1, top - 8, hx + faceRx + 1, top + 5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(hx - faceRx, top + 1, faceRx * 2, 2.2);
        break;
      }
      case 'scarf': {
        ctx.fillStyle = hatC;
        ctx.beginPath();
        ctx.ellipse(hx, top + 5.2, faceRx + 1.8, 13, 0, Math.PI, Math.PI * 2);
        ctx.lineTo(hx + faceRx + 1.8, top + 6.2);
        ctx.quadraticCurveTo(hx, top + 1.4, hx - faceRx - 1.8, top + 6.2);
        ctx.closePath();
        ctx.fill();
        ell(ctx, hx + faceRx + 1.6, top + 8.4, 3.2, 4, hatC);
        ell(ctx, hx + faceRx + 4.6, top + 12, 2.6, 3.6, shade(hatC, -20), 0.5);
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        for (const [dx, dy] of [[-7, -2], [-2, -5], [4, -2], [9, 1], [0, 1]]) ell(ctx, hx + dx, top + 4 + dy, 0.9, 0.9, 'rgba(255,255,255,0.65)');
        break;
      }
      case 'turban': {
        ctx.fillStyle = hatC;
        ctx.beginPath();
        ctx.ellipse(hx, top + 3.6, faceRx + 2.6, 12.5, 0, Math.PI, Math.PI * 2);
        ctx.lineTo(hx + faceRx + 2.6, top + 6);
        ctx.lineTo(hx - faceRx - 2.6, top + 6);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = shade(hatC, -35);
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(hx - faceRx - 2, top + 5 - i * 3.4);
          ctx.quadraticCurveTo(hx, top + 1 - i * 3.6, hx + faceRx + 2, top + 5 - i * 3.4 - 1.5);
          ctx.stroke();
        }
        break;
      }
      default:
        break;
    }
  };

  // ---------- ordem de desenho ----------
  drawBackHair();
  drawLegs();
  drawNeck();
  drawTorso();
  drawArms(true);
  drawHead();
  if (anim.away) {
    drawAwayHair();
  } else {
    drawFace();
    drawFrontHair();
  }
  drawHeadwear();

  ctx.restore();
}
