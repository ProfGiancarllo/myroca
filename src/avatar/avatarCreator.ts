import { t, TranslationDictionary } from '../i18n';
import {
  AvatarConfig,
  DEFAULT_AVATAR,
  OPTIONS,
  SKIN_COLORS,
  HAIR_COLORS,
  EYE_COLORS,
  OUTFIT_COLORS,
  PANTS_COLORS,
  BOOTS_COLORS,
  HAT_COLORS,
  drawAvatar,
  randomAvatar,
} from './avatar';

type OptionGroup = keyof typeof OPTIONS;
type ColorField = 'skin' | 'eyeColor' | 'hairColor' | 'outfitColor' | 'pantsColor' | 'bootsColor' | 'hatColor';

interface CreatorOptions {
  initial: AvatarConfig | null;
  onSave: (cfg: AvatarConfig) => void;
  onCancel?: () => void;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const tk = (k: string) => t(k as keyof TranslationDictionary);

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/**
 * Abre o criador de avatar (modal) com pré-visualização ao vivo.
 */
export function openAvatarCreator(opts: CreatorOptions): void {
  document.getElementById('av-overlay')?.remove();

  const cfg: AvatarConfig = { ...(opts.initial || DEFAULT_AVATAR) };

  const chips = (group: OptionGroup, labelKey: string): string => `
    <div class="av-field">
      <div class="av-label">${tk(labelKey)}</div>
      <div class="av-chips">
        ${(OPTIONS[group] as readonly string[])
          .map(
            (v) =>
              `<button type="button" class="av-chip" data-group="${group}" data-value="${v}">${tk('avOpt' + cap(group) + cap(v))}</button>`
          )
          .join('')}
      </div>
    </div>`;

  const swatches = (field: ColorField, labelKey: string, colors: string[]): string => `
    <div class="av-field">
      <div class="av-label">${tk(labelKey)}</div>
      <div class="av-swatches">
        ${colors
          .map(
            (c, i) =>
              `<button type="button" class="av-swatch" data-color-field="${field}" data-index="${i}" style="background:${c}" aria-label="${c}"></button>`
          )
          .join('')}
      </div>
    </div>`;

  const overlay = document.createElement('div');
  overlay.id = 'av-overlay';
  overlay.className = 'av-overlay';
  overlay.innerHTML = `
    <div class="av-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(t('avTitle'))}">
      <div class="av-header">
        <div>
          <div class="av-title">🧑‍🌾 ${t('avTitle')}</div>
          <div class="av-subtitle">${t('avSubtitle')}</div>
        </div>
      </div>
      <div class="av-body">
        <div class="av-preview-col">
          <div class="av-preview-stage"><canvas id="av-preview" width="240" height="300"></canvas></div>
          <label class="av-label" for="av-name-input">${t('avName')}</label>
          <input id="av-name-input" class="av-name-input" type="text" maxlength="16" placeholder="${escapeHtml(t('avNamePh'))}" value="${escapeHtml(cfg.name)}" />
          <button type="button" class="av-btn av-btn-secondary" id="av-random">🎲 ${t('avRandom')}</button>
        </div>
        <div class="av-controls-col">
          <div class="av-section-title">${t('avSecBody')}</div>
          ${chips('sex', 'avLblSex')}
          ${chips('build', 'avLblBuild')}
          ${chips('height', 'avLblHeight')}
          ${chips('age', 'avLblAge')}
          ${swatches('skin', 'avLblSkin', SKIN_COLORS)}

          <div class="av-section-title">${t('avSecFace')}</div>
          ${chips('face', 'avLblFace')}
          ${chips('eyeShape', 'avLblEyeShape')}
          ${swatches('eyeColor', 'avLblEyeColor', EYE_COLORS)}
          ${chips('nose', 'avLblNose')}
          ${chips('mouth', 'avLblMouth')}
          ${chips('beard', 'avLblBeard')}

          <div class="av-section-title">${t('avSecHair')}</div>
          ${chips('hairStyle', 'avLblHairStyle')}
          ${swatches('hairColor', 'avLblHairColor', HAIR_COLORS)}

          <div class="av-section-title">${t('avSecClothes')}</div>
          ${chips('outfit', 'avLblOutfit')}
          ${swatches('outfitColor', 'avLblOutfitColor', OUTFIT_COLORS)}
          ${swatches('pantsColor', 'avLblPants', PANTS_COLORS)}
          ${swatches('bootsColor', 'avLblBoots', BOOTS_COLORS)}

          <div class="av-section-title">${t('avSecHead')}</div>
          ${chips('headwear', 'avLblHeadwear')}
          ${swatches('hatColor', 'avLblHatColor', HAT_COLORS)}
          ${chips('accessory', 'avLblAccessory')}
        </div>
      </div>
      <div class="av-footer">
        <button type="button" class="av-btn av-btn-ghost" id="av-cancel">${t('avCancel')}</button>
        <button type="button" class="av-btn av-btn-primary" id="av-save">✅ ${t('avSave')}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const canvas = overlay.querySelector('#av-preview') as HTMLCanvasElement;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = 240 * dpr;
  canvas.height = 300 * dpr;
  canvas.style.width = '240px';
  canvas.style.height = '300px';
  const ctx = canvas.getContext('2d')!;

  let tick = 0;
  let walking = false;
  let raf = 0;
  let closed = false;

  const frame = () => {
    if (closed) return;
    tick++;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, 240, 300);
    drawAvatar(ctx, cfg, 120, 282, 262, { walking, tick, away: false });
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  const refresh = () => {
    overlay.querySelectorAll<HTMLElement>('.av-chip').forEach((el) => {
      const g = el.dataset.group as OptionGroup;
      el.classList.toggle('active', (cfg as unknown as Record<string, string>)[g] === el.dataset.value);
    });
    overlay.querySelectorAll<HTMLElement>('.av-swatch').forEach((el) => {
      const f = el.dataset.colorField as ColorField;
      el.classList.toggle('active', cfg[f] === Number(el.dataset.index));
    });
    (overlay.querySelector('#av-name-input') as HTMLInputElement).value = cfg.name;
  };
  refresh();

  const close = () => {
    closed = true;
    cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKey);
    overlay.remove();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      opts.onCancel?.();
    }
  };
  document.addEventListener('keydown', onKey);

  overlay.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const chip = target.closest('.av-chip') as HTMLElement | null;
    if (chip) {
      (cfg as unknown as Record<string, string>)[chip.dataset.group as string] = chip.dataset.value as string;
      refresh();
      return;
    }
    const sw = target.closest('.av-swatch') as HTMLElement | null;
    if (sw) {
      cfg[sw.dataset.colorField as ColorField] = Number(sw.dataset.index);
      refresh();
      return;
    }
    if (target.closest('#av-preview')) {
      walking = !walking;
      return;
    }
    if (target.closest('#av-random')) {
      Object.assign(cfg, randomAvatar(cfg.name));
      refresh();
      return;
    }
    if (target.closest('#av-cancel')) {
      close();
      opts.onCancel?.();
      return;
    }
    if (target.closest('#av-save')) {
      cfg.name = (overlay.querySelector('#av-name-input') as HTMLInputElement).value.trim().slice(0, 16);
      const result = { ...cfg };
      close();
      opts.onSave(result);
    }
  });

  overlay.querySelector('#av-name-input')?.addEventListener('input', (e) => {
    cfg.name = (e.target as HTMLInputElement).value.slice(0, 16);
  });
}
