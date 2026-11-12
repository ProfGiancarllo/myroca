import { FarmData, Talhao, WaterPoint, FARM_ELEMENT_META, DiaryEntry, DiaryEntryType } from '../types';
import { calculateTalhaoCropStatus } from '../utils/cropCalendar';
import { formatHectares } from '../utils/geo';
import {
  t,
  translateCropName,
  translateCropPhase,
  translateStructureType,
  formatHectaresI18n,
  formatNumber,
  formatDateI18n,
  onLanguageChange,
} from '../i18n';
import type { TranslationDictionary } from '../i18n';
import { currentForecast, compareResults, fetchModelForecast } from '../utils/forecast';
import { assessPlanting, assessCrop, RiskLevel, Severity } from '../utils/agronomyRules';
import { fetchNasaSeries, summarizeNasa, polygonCentroid, NasaSeries } from '../utils/nasaPower';
import {
  AvatarConfig,
  loadAvatar,
  saveAvatar,
  drawAvatar,
  wasAvatarPrompted,
  markAvatarPrompted,
} from '../avatar/avatar';
import { openAvatarCreator } from '../avatar/avatarCreator';
import { rt } from '../i18n/rotationText';
import { wt } from '../i18n/weatherText';
import { WeatherState, Condition, resolveWeather, setOverride, clearOverride, getOverride, estimateWeather } from '../utils/weather';

export interface FarmGameViewCallbacks {
  onTalhaoSelect: (talhao: Talhao) => void;
  onElementSelect: (elem: WaterPoint) => void;
  onSwitchToRealMap: () => void;
  onAdvanceTime: (days: number) => void;
  onOpenCalendarModal?: (talhao: Talhao) => void;
  onAvatarSaved?: () => void;
  onTalhaoUpdated?: (talhao: Talhao) => void;
  onElementMoved?: (elem: WaterPoint) => void;
  onOpenRotation?: (talhaoId: string) => void;
}

export interface FarmGameViewOptions {
  container: HTMLElement;
  farmData: FarmData;
  referenceDate?: string;
  onTalhaoSelect?: (talhao: Talhao) => void;
  onElementSelect?: (elem: WaterPoint) => void;
  onSwitchToRealMap?: () => void;
  onAdvanceTime?: (days: number) => void;
  onOpenCalendarModal?: (talhaoId: string) => void;
  onAvatarSaved?: () => void;
  onTalhaoUpdated?: (talhao: Talhao) => void;
  onElementMoved?: (elem: WaterPoint) => void;
  onOpenRotation?: (talhaoId: string) => void;
}

interface WeatherCloud {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
}

interface RainParticle {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
}

export class FarmGameView {
  private container: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private farmData: FarmData;
  private callbacks: FarmGameViewCallbacks;

  // Viewport transforms (Pan & Zoom)
  private offsetX = 0;
  private offsetY = 0;
  private scale = 1.0;
  private minScale = 0.35;
  private maxScale = 3.5;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private hasMovedWhileDragging = false;

  // Geographic bounds & center
  private centerLat = -17.805;
  private centerLng = -51.077;
  private minLat = -17.825;
  private maxLat = -17.785;
  private minLng = -51.105;
  private maxLng = -51.055;

  // Hover & selection state
  private hoveredTalhao: Talhao | null = null;
  private hoveredElement: WaterPoint | null = null;
  private mouseCanvasPos = { x: 0, y: 0 };
  private mouseScreenPos = { x: 0, y: 0 };

  // Animation / Render loop
  private animationFrameId: number | null = null;
  private animTick = 0;

  // Weather effects state
  private clouds: WeatherCloud[] = [];
  private rainDrops: RainParticle[] = [];
  private isRaining = false;
  private rainIntensity = 0;            // 0 a 3
  private cloudLevel = 0.5;             // 0 (céu limpo) a 1.2 (tempestade)
  private skyDim = 0;                   // escurecimento do céu, 0 a 0.35
  private weather: WeatherState | null = null;
  private weatherTimer: number | null = null;

  // Collapsible UI state
  private isLeftPanelCollapsed = false;
  private isAgronomistCollapsed = false;
  private currentSpeechIndex = 0;

  // Avatar do produtor
  private avatarCfg: AvatarConfig | null = null;
  private avatarPos: { lat: number; lng: number } | null = null;
  private avatarTarget: { lat: number; lng: number } | null = null;
  private avatarArrival: (() => void) | null = null;
  private avatarAway = false;
  private avatarWalking = false;
  private nasaToken = 0;
  private modelForecast: Record<string, number> = {};
  private nasaSeries: Record<string, NasaSeries> = {};

  // Mover componentes (silos, nascentes...)
  private moveMode = false;
  private draggingElement: WaterPoint | null = null;
  private draggingMoved = false;
  private elementCard: HTMLElement | null = null;

  // Diário de safra (ficha do talhão)
  private sheetTalhaoId = '';
  private diaryFormOpen = false;

  constructor(
    containerOrOptions: HTMLElement | FarmGameViewOptions,
    farmData?: FarmData,
    callbacks?: FarmGameViewCallbacks
  ) {
    if (containerOrOptions instanceof HTMLElement) {
      this.container = containerOrOptions;
      this.farmData = farmData!;
      this.callbacks = callbacks || {
        onTalhaoSelect: () => {},
        onElementSelect: () => {},
        onSwitchToRealMap: () => {},
        onAdvanceTime: () => {},
      };
    } else {
      this.container = containerOrOptions.container;
      this.farmData = containerOrOptions.farmData;
      if (containerOrOptions.referenceDate) {
        this.farmData.referenceDate = containerOrOptions.referenceDate;
      }
      this.callbacks = {
        onTalhaoSelect: containerOrOptions.onTalhaoSelect || (() => {}),
        onElementSelect: containerOrOptions.onElementSelect || (() => {}),
        onSwitchToRealMap: containerOrOptions.onSwitchToRealMap || (() => {}),
        onAdvanceTime: containerOrOptions.onAdvanceTime || (() => {}),
        onOpenCalendarModal: containerOrOptions.onOpenCalendarModal
          ? (t: Talhao) => containerOrOptions.onOpenCalendarModal!(t.id)
          : undefined,
        onAvatarSaved: containerOrOptions.onAvatarSaved,
        onTalhaoUpdated: containerOrOptions.onTalhaoUpdated,
        onElementMoved: containerOrOptions.onElementMoved,
        onOpenRotation: containerOrOptions.onOpenRotation,
      };
    }

    this.initWeather();
    this.renderDOM();
    this.setupCanvasSize();
    this.computeFarmBounds();
    this.resetCameraView();
    this.bindEvents();
    this.initAvatar();
    this.preloadNasaForAll();
    this.applyWeather(getOverride() || estimateWeather(this.farmData.referenceDate || new Date().toISOString().slice(0, 10)));
    void this.refreshWeather();
    this.weatherTimer = window.setInterval(() => void this.refreshWeather(), 30 * 60 * 1000);
    this.startAnimationLoop();
    onLanguageChange(() => this.updateLanguage());
  }

  private initWeather(): void {
    // 5 drifting translucent clouds
    this.clouds = [
      { x: -300, y: -150, size: 140, speed: 0.25, opacity: 0.35 },
      { x: 100, y: -280, size: 210, speed: 0.18, opacity: 0.4 },
      { x: 500, y: 50, size: 170, speed: 0.22, opacity: 0.3 },
      { x: -600, y: 200, size: 190, speed: 0.3, opacity: 0.35 },
      { x: 300, y: 350, size: 150, speed: 0.2, opacity: 0.25 },
    ];

    // Light rain particles
    this.rainDrops = [];
    for (let i = 0; i < 180; i++) {
      this.rainDrops.push({
        x: Math.random() * 2000 - 500,
        y: Math.random() * 1400 - 200,
        length: 12 + Math.random() * 8,
        speed: 7 + Math.random() * 5,
        opacity: 0.25 + Math.random() * 0.3,
      });
    }
  }

  private renderDOM(): void {
    this.container.innerHTML = `
      <div class="farm-game-wrapper" id="farm-game-wrapper">
        <!-- 2.5D Isometric Fullscreen Canvas -->
        <canvas id="farm-game-canvas" class="farm-game-canvas-fullscreen"></canvas>

        <!-- LEFT FLOATING PANEL: Weather & Legend (Collapsible, <=25% screen) -->
        <div class="game-floating-left-panel" id="game-left-panel">
          <div class="panel-header-row">
            <div class="panel-title-group">
              <span class="panel-header-icon">⛅</span>
              <span class="panel-title-text" id="game-panel-title-text">${t('weatherAndLegend')}</span>
              <span class="badge-exemplo" id="game-panel-badge-exemplo">${t('exampleBadge')}</span>
            </div>
            <button class="btn-panel-toggle" id="btn-toggle-left-panel" title="${t('collapseExpand')}">
              ◀
            </button>
          </div>

          <div class="left-panel-content" id="left-panel-content">
            <!-- Weather Card -->
            <div class="game-weather-compact">
              <div class="weather-temp-row">
                <span class="weather-art-icon" id="game-weather-icon">⛅</span>
                <span class="weather-temp" id="game-weather-temp">--°C</span>
                <div class="weather-desc" id="game-weather-desc"></div>
                <button type="button" class="weather-fix-btn" id="btn-weather-fix" title="${wt('fix')}">✏️</button>
              </div>
              <div class="weather-metrics-row" id="game-weather-metrics"></div>
              <div class="weather-src" id="game-weather-src"></div>
              <div class="weather-fix-pop" id="game-weather-fix" style="display:none"></div>
            </div>

            <!-- Mini Legend -->
            <div class="game-legend-compact" id="game-legend-compact">
              <div class="legend-section-title">${t('cropColors')}</div>
              <div class="legend-pills-grid" style="grid-template-columns: repeat(2, 1fr);">
                <div class="legend-pill"><span class="legend-color-dot" style="background: #16a34a;"></span> ${translateCropName('Soja')}</div>
                <div class="legend-pill"><span class="legend-color-dot" style="background: #eab308;"></span> ${translateCropName('Milho')}</div>
                <div class="legend-pill"><span class="legend-color-dot" style="background: #65a30d;"></span> ${translateCropName('Pastagem')}</div>
                <div class="legend-pill"><span class="legend-color-dot" style="background: #9a3412;"></span> ${translateCropName('Feijão')}</div>
                <div class="legend-pill"><span class="legend-color-dot" style="background: #d97706;"></span> ${translateCropName('Sorgo')}</div>
                <div class="legend-pill"><span class="legend-color-dot" style="background: #0284c7;"></span> ${translateCropName('Algodão')}</div>
                <div class="legend-pill"><span class="legend-color-dot" style="background: #059669;"></span> ${translateCropName('Cana-de-açúcar')}</div>
                <div class="legend-pill"><span class="legend-color-dot" style="background: #ca8a04;"></span> ${translateCropName('Trigo')}</div>
                <div class="legend-pill"><span class="legend-color-dot" style="background: #64748b;"></span> ${t('withoutCrop')}</div>
              </div>

              <div class="legend-section-title" style="margin-top: 8px;">${t('ruralStructures')}</div>
              <div class="legend-pills-grid">
                <div class="legend-pill"><span>🏠</span> ${translateStructureType('sede')}</div>
                <div class="legend-pill"><span>🏭</span> ${translateStructureType('silo')}</div>
                <div class="legend-pill"><span>🐂</span> ${translateStructureType('curral')}</div>
                <div class="legend-pill"><span>📡</span> ${translateStructureType('estacao_meteo')}</div>
                <div class="legend-pill"><span>🌊</span> ${translateStructureType('acude')}</div>
                <div class="legend-pill"><span>🌳</span> ${translateStructureType('reserva')}</div>
              </div>

              <div class="legend-status-note" id="game-legend-status-note">
                <span class="status-glow-dot">●</span> ${t('legendStatusNote')}
              </div>
            </div>
          </div>
        </div>

        <!-- WEATHER CHIP (sempre visível) -->
        <div class="weather-chip-wrap" id="weather-chip-wrap">
          <button type="button" class="weather-chip" id="weather-chip" title="${wt('fix')}">
            <span id="chip-weather-icon">⛅</span>
            <strong id="chip-weather-temp">--°C</strong>
            <span id="chip-weather-desc"></span>
          </button>
          <div class="weather-chip-pop" id="weather-chip-pop" style="display:none">
            <div class="weather-metrics-row" id="chip-weather-metrics"></div>
            <div class="weather-src" id="chip-weather-src"></div>
            <div id="chip-weather-fix"></div>
          </div>
        </div>

        <!-- RIGHT FLOATING CONTROLS: Zoom & Center Farm -->
        <div class="game-floating-right-controls">
          <button class="btn-game-hud-control" id="btn-game-zoom-in" title="${t('zoomIn')}">+</button>
          <button class="btn-game-hud-control" id="btn-game-zoom-out" title="${t('zoomOut')}">&minus;</button>
          <button class="btn-game-hud-control" id="btn-game-reset-view" title="${t('centerFarm')}">🎯</button>
          <button class="btn-game-hud-control" id="btn-game-more" title="Mais">⋯</button>
          <div class="game-more-menu" id="game-more-menu" style="display:none">
            <button class="btn-game-hud-control" id="btn-game-move-mode" title="${t('moveModeBtn')}">✋</button>
            <button class="btn-game-hud-control" id="btn-game-avatar" title="${t('avBtn')}">🧑‍🌾</button>
          </div>
        </div>

        <!-- BOTTOM-RIGHT FLOATING AGRONOMIST CARD (Engª. Estela) -->
        <div class="game-agronomist-floating-wrapper" id="game-agronomist-card">
          <div class="agronomist-speech-bubble" id="agronomist-speech-bubble">
            <div class="bubble-header">
              <span class="bubble-speaker" id="game-agronomist-speaker-title">${t('agronomistTitle')}</span>
              <button class="btn-bubble-minimize" id="btn-minimize-agronomist" title="${t('minimize')}">✕</button>
            </div>
            <div class="bubble-text" id="agronomist-quote-text">
              “${this.getDynamicAgronomistSpeech()}”
            </div>
            <div class="bubble-arrow-down"></div>
          </div>

          <div class="agronomist-avatar-button" id="btn-agronomist-avatar" title="${t('tapForMoreAdvice')}">
            <svg viewBox="0 0 100 100" class="agronomist-avatar-svg">
              <!-- Shadow -->
              <ellipse cx="50" cy="92" rx="34" ry="6" fill="rgba(0,0,0,0.35)" />
              <!-- Body / Checked Shirt -->
              <path d="M 28 85 L 32 55 Q 50 50 68 55 L 72 85 Z" fill="#15803d" />
              <!-- Overalls / Suspenders -->
              <path d="M 40 55 L 43 85 M 60 55 L 57 85" stroke="#78350f" stroke-width="3" />
              <polygon points="46,55 54,55 50,65" fill="#fef08a" />
              <!-- Clipboard in Hand -->
              <rect x="65" y="62" width="22" height="28" rx="2" fill="#78350f" transform="rotate(-10 65 62)" />
              <rect x="67" y="65" width="18" height="22" rx="1" fill="#fff" transform="rotate(-10 65 62)" />
              <line x1="70" y1="70" x2="82" y2="68" stroke="#15803d" stroke-width="1.5" />
              <line x1="70" y1="74" x2="80" y2="72" stroke="#15803d" stroke-width="1.5" />
              <line x1="70" y1="78" x2="78" y2="76" stroke="#15803d" stroke-width="1.5" />
              <!-- Arms / Hands -->
              <circle cx="28" cy="72" r="6" fill="#fcd34d" />
              <circle cx="68" cy="72" r="6" fill="#fcd34d" />
              <!-- Neck & Head -->
              <rect x="44" y="44" width="12" height="12" fill="#fcd34d" rx="2" />
              <ellipse cx="50" cy="38" rx="15" ry="16" fill="#fcd34d" />
              <!-- Eyes & Smile -->
              <circle cx="44" cy="36" r="2.2" fill="#1e293b" />
              <circle cx="56" cy="36" r="2.2" fill="#1e293b" />
              <circle cx="45" cy="35" r="0.8" fill="#fff" />
              <circle cx="57" cy="35" r="0.8" fill="#fff" />
              <path d="M 44 43 Q 50 49 56 43" stroke="#991b1b" stroke-width="2" fill="none" stroke-linecap="round" />
              <circle cx="40" cy="40" r="2.5" fill="#f87171" opacity="0.6" />
              <circle cx="60" cy="40" r="2.5" fill="#f87171" opacity="0.6" />
              <!-- Straw Hat -->
              <ellipse cx="50" cy="22" rx="16" ry="10" fill="#eab308" />
              <path d="M 34 22 Q 50 12 66 22 Z" fill="#ca8a04" />
              <path d="M 34 23 Q 50 27 66 23" stroke="#16a34a" stroke-width="3" fill="none" />
              <ellipse cx="50" cy="25" rx="30" ry="8" fill="#fef08a" stroke="#ca8a04" stroke-width="1.5" />
            </svg>
          </div>
        </div>

        <!-- TALHÃO DETAIL SHEET (Modal Bottom Sheet ao clicar no Talhão) -->
        <div class="game-talhao-sheet-overlay" id="game-talhao-sheet" style="display: none;">
          <div class="game-talhao-sheet-card">
            <div class="sheet-header">
              <div class="sheet-title-group">
                <span class="sheet-crop-icon" id="sheet-crop-icon">🌱</span>
                <div>
                  <h3 class="sheet-title" id="sheet-talhao-name">Talhão 01</h3>
                  <div class="sheet-subtitle">
                    <span id="sheet-crop-name">Soja</span> • 
                    <span id="sheet-cultivar-name">Cultivar Brasmax</span> • 
                    <span class="badge-exemplo">${t('exampleBadge')}</span>
                  </div>
                </div>
              </div>
              <button class="sheet-close-btn" id="btn-close-talhao-sheet">&times;</button>
            </div>

            <div class="sheet-body">
              <div class="sheet-hero-row">
                <div class="sheet-hero-box">
                  <div class="hero-label" id="lbl-sheet-area">${t('sheetFieldArea')}</div>
                  <div class="hero-val" id="sheet-area-ha">0,00 ha</div>
                </div>
                <div class="sheet-hero-box">
                  <div class="hero-label" id="lbl-sheet-phase">${t('sheetCropPhase')}</div>
                  <div class="hero-val-phase" id="sheet-phase-text">Crescimento Vegetativo</div>
                </div>
                <div class="sheet-hero-box">
                  <div class="hero-label" id="lbl-sheet-state">${t('sheetCropState')}</div>
                  <div class="hero-status-green" id="sheet-status-box">
                    <span class="status-dot-green">●</span> ${t('healthy')}
                  </div>
                </div>
              </div>

              <!-- Trilha de Fases da Safra dentro da Ficha do Talhão -->
              <div class="sheet-phases-track-box">
                <div class="track-box-header">
                  <span class="track-box-title" id="lbl-sheet-track-title">${t('seasonTrackTitle')}</span>
                  <span class="track-box-progress" id="sheet-track-progress-text">Dia 30 de 115 (26%)</span>
                </div>
                <div class="sheet-phases-track" id="sheet-phases-track">
                  <div class="sheet-track-step" data-phase="preparo">
                    <span class="sheet-track-icon">🚜</span>
                    <span class="sheet-track-label">${translateCropPhase('preparo')}</span>
                  </div>
                  <div class="sheet-track-arrow">➔</div>
                  <div class="sheet-track-step" data-phase="plantio">
                    <span class="sheet-track-icon">🌱</span>
                    <span class="sheet-track-label">${translateCropPhase('plantio')}</span>
                  </div>
                  <div class="sheet-track-arrow">➔</div>
                  <div class="sheet-track-step" data-phase="crescimento">
                    <span class="sheet-track-icon">🌿</span>
                    <span class="sheet-track-label">${translateCropPhase('crescimento')}</span>
                  </div>
                  <div class="sheet-track-arrow">➔</div>
                  <div class="sheet-track-step" data-phase="floracao">
                    <span class="sheet-track-icon">🌸</span>
                    <span class="sheet-track-label">${translateCropPhase('floracao')}</span>
                  </div>
                  <div class="sheet-track-arrow">➔</div>
                  <div class="sheet-track-step" data-phase="enchimento">
                    <span class="sheet-track-icon">🌾</span>
                    <span class="sheet-track-label">${translateCropPhase('enchimento')}</span>
                  </div>
                  <div class="sheet-track-arrow">➔</div>
                  <div class="sheet-track-step" data-phase="colheita">
                    <span class="sheet-track-icon">🚜</span>
                    <span class="sheet-track-label">${translateCropPhase('colheita')}</span>
                  </div>
                </div>
              </div>

              <div class="sheet-details-grid">
                <div class="detail-cell">
                  <span class="detail-label" id="lbl-sheet-planting">${t('plantingDate')}:</span>
                  <strong class="detail-val" id="sheet-planting-date">10/10/2026</strong>
                </div>
                <div class="detail-cell">
                  <span class="detail-label" id="lbl-sheet-cycle">${t('cropCycle')}:</span>
                  <strong class="detail-val" id="sheet-cycle-days">115 dias</strong>
                </div>
                <div class="detail-cell">
                  <span class="detail-label" id="lbl-sheet-harvest">${t('harvestForecast')}:</span>
                  <strong class="detail-val" id="sheet-harvest-date">02/02/2027</strong>
                </div>
                <div class="detail-cell">
                  <span class="detail-label" id="lbl-sheet-next">${t('nextCrop')}:</span>
                  <strong class="detail-val" id="sheet-next-crop"></strong>
                </div>
              </div>

              <div class="sheet-history-box" id="sheet-history-box">
                <div class="history-title" id="lbl-sheet-history-title">📜 ${t('harvestHistoryTitle')}</div>
                <div id="sheet-history-list" class="history-items-list"></div>
              </div>

              <div class="sheet-nasa-box" id="sheet-nasa-box">
                <div class="diary-head">
                  <div>
                    <div class="history-title" id="lbl-sheet-nasa-title" style="margin:0">🛰️ ${t('nasaTitle')}</div>
                    <div class="nasa-period" id="sheet-nasa-period"></div>
                  </div>
                  <button type="button" class="nasa-refresh-btn" id="btn-nasa-refresh">⟳ ${t('nasaRefresh')}</button>
                </div>
                <div id="sheet-nasa-body"></div>
              </div>

              <div class="sheet-tiago-box" id="sheet-tiago-box" style="display:none"></div>

              <div class="sheet-forecast-box" id="sheet-forecast-box" style="display:none"></div>
              <button type="button" class="diary-btn-ghost" id="btn-sheet-rotation" style="margin-top:10px;width:100%">🔄 ${rt('open')}</button>

              <div class="sheet-diary-box" id="sheet-diary-box">
                <div class="diary-head">
                  <div class="history-title" id="lbl-sheet-diary-title" style="margin:0">📒 ${t('diaryTitle')}</div>
                  <button type="button" class="diary-add-btn" id="btn-diary-add">＋ ${t('diaryAdd')}</button>
                </div>
                <div id="sheet-diary-form" class="diary-form" style="display:none"></div>
                <div id="sheet-diary-list" class="history-items-list"></div>
              </div>

              <div class="sheet-simple-notice" id="sheet-simple-notice"></div>
            </div>

            <div class="sheet-footer">
              <button class="btn btn-outline btn-lg" id="btn-sheet-view-real-map">
                <span>🗺️</span> <span id="lbl-btn-view-map">${t('viewOnRealMap')}</span>
              </button>
              <button class="btn btn-primary btn-xl" id="btn-sheet-open-calendar">
                <span>📅</span> <span id="lbl-btn-crop-cal">${t('cropCalendar')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.canvas = document.getElementById('farm-game-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
  }

  public resize(): void {
    this.setupCanvasSize();
    this.fitToBounds(0.08);
  }

  private setupCanvasSize(): void {
    if (!this.canvas) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;

    if (w <= 0 || h <= 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
  }

  public updateData(farmData: FarmData, referenceDate?: string): void {
    this.farmData = farmData;
    if (referenceDate) {
      this.farmData.referenceDate = referenceDate;
    }
    this.computeFarmBounds();
    this.updateTopBar();
    this.preloadNasaForAll();
    this.updateAgronomistSpeech();
    this.render();
  }

  public updateFarmData(farmData: FarmData, referenceDate?: string): void {
    this.updateData(farmData, referenceDate);
  }

  private updateTopBar(): void {
    const dateDisplay = document.getElementById('game-topbar-date-display');
    if (dateDisplay && this.farmData.referenceDate) {
      const parts = this.farmData.referenceDate.split('-');
      if (parts.length === 3) {
        dateDisplay.innerText = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
  }

  private updateAgronomistSpeech(): void {
    const bubble = document.getElementById('agronomist-quote-text');
    if (!bubble) return;

    const speech = this.getDynamicAgronomistSpeech();
    bubble.innerText = `“${speech}”`;
  }

  private getDynamicAgronomistSpeech(): string {
    const talhoes = this.farmData.talhoes;
    if (!talhoes || talhoes.length === 0) {
      return t('agronomistSpeechNoTalhoes');
    }

    const refDate = this.farmData.referenceDate || '2026-11-09';
    const statuses = talhoes.map((t) => ({
      talhao: t,
      status: calculateTalhaoCropStatus(t, refDate),
    }));

    // Generate speech options derived directly from the real status of the talhões
    const speeches: string[] = [];

    // Falas com dados reais da NASA (quando já carregados)
    statuses.forEach(({ talhao, status }) => {
      const series = this.nasaSeries[talhao.id];
      if (!series) return;
      const alerts = assessCrop(series, status.phase.key, talhao.diary, refDate);
      alerts.forEach((al) => {
        speeches.push(
          t('agSpeechCrop', { name: talhao.name, alert: t(al.key as keyof TranslationDictionary, al.params) })
        );
      });
      if (!status.isPasture && (!talhao.plantingDate || status.phase.key === 'preparo')) {
        const a = assessPlanting(series, refDate, talhao.diary);
        speeches.push(
          t('agSpeechPlanting', { name: talhao.name, risk: this.riskLevelLabel(a.level), mm: a.rain15 })
        );
      }
    });

    // Critical phase 1: Floração
    const flowering = statuses.find((s) => s.status.phase.key === 'floracao');
    if (flowering) {
      speeches.push(
        t('agronomistSpeechFlowering', {
          name: flowering.talhao.name,
          crop: translateCropName(flowering.talhao.crop),
        })
      );
    }

    // Critical phase 2: Colheita
    const harvest = statuses.find((s) => s.status.phase.key === 'colheita');
    if (harvest) {
      speeches.push(
        t('agronomistSpeechHarvest', {
          name: harvest.talhao.name,
          crop: translateCropName(harvest.talhao.crop),
        })
      );
    }

    // Vegetative growth
    const growth = statuses.find((s) => s.status.phase.key === 'crescimento');
    if (growth) {
      speeches.push(
        t('agronomistSpeechGrowth', {
          name: growth.talhao.name,
          crop: translateCropName(growth.talhao.crop),
          days: formatNumber(growth.status.daysPassed, 0),
          totalDays: formatNumber(growth.talhao.cycleDays || 115, 0),
        })
      );
    }

    // General health
    speeches.push(t('agronomistSpeechAllHealthy'));

    // Pasture check
    const pasture = statuses.find((s) => (s.talhao.crop || '').toLowerCase().includes('pasto'));
    if (pasture) {
      speeches.push(
        t('agronomistSpeechPasture', {
          name: pasture.talhao.name,
        })
      );
    }

    const index = this.currentSpeechIndex % speeches.length;
    return speeches[index];
  }

  private computeFarmBounds(): void {
    let minLat = 90;
    let maxLat = -90;
    let minLng = 180;
    let maxLng = -180;
    let hasPoints = false;

    this.farmData.talhoes.forEach((t) => {
      t.coordinates.forEach(([lat, lng]) => {
        hasPoints = true;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      });
    });

    this.farmData.waterPoints.forEach((wp) => {
      hasPoints = true;
      const [lat, lng] = wp.coordinates;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    });

    if (!hasPoints) {
      minLat = -17.825;
      maxLat = -17.785;
      minLng = -51.105;
      maxLng = -51.055;
    }

    const latSpan = Math.max(0.005, maxLat - minLat);
    const lngSpan = Math.max(0.005, maxLng - minLng);

    this.minLat = minLat - latSpan * 0.15;
    this.maxLat = maxLat + latSpan * 0.15;
    this.minLng = minLng - lngSpan * 0.15;
    this.maxLng = maxLng + lngSpan * 0.15;

    this.centerLat = (this.minLat + this.maxLat) / 2;
    this.centerLng = (this.minLng + this.maxLng) / 2;
  }

  public fitToBounds(marginPercent: number = 0.08): void {
    if (!this.canvas) return;
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    if (w <= 0 || h <= 0) return;

    let minIsoX = Infinity;
    let maxIsoX = -Infinity;
    let minIsoY = Infinity;
    let maxIsoY = -Infinity;
    let hasPoints = false;

    // Project all talhões vertices into isometric space
    this.farmData.talhoes.forEach((t) => {
      t.coordinates.forEach(([lat, lng]) => {
        hasPoints = true;
        const { x, y } = this.latLngToMeters(lat, lng);
        const { isoX, isoY } = this.metersToIso(x, y);
        if (isoX < minIsoX) minIsoX = isoX;
        if (isoX > maxIsoX) maxIsoX = isoX;
        if (isoY < minIsoY) minIsoY = isoY;
        if (isoY > maxIsoY) maxIsoY = isoY;
      });
    });

    // Project all water points and structures with structural padding
    this.farmData.waterPoints.forEach((wp) => {
      hasPoints = true;
      const [lat, lng] = wp.coordinates;
      const { x, y } = this.latLngToMeters(lat, lng);
      const { isoX, isoY } = this.metersToIso(x, y);
      if (isoX - 30 < minIsoX) minIsoX = isoX - 30;
      if (isoX + 30 > maxIsoX) maxIsoX = isoX + 30;
      if (isoY - 45 < minIsoY) minIsoY = isoY - 45;
      if (isoY + 20 > maxIsoY) maxIsoY = isoY + 20;
    });

    if (!hasPoints) {
      this.offsetX = w / 2;
      this.offsetY = h / 2;
      this.scale = 0.85;
      this.render();
      return;
    }

    const isoWidth = Math.max(30, maxIsoX - minIsoX);
    const isoHeight = Math.max(30, maxIsoY - minIsoY);
    const isoCenterX = (minIsoX + maxIsoX) / 2;
    const isoCenterY = (minIsoY + maxIsoY) / 2;

    const availW = w * (1 - 2 * marginPercent);
    const availH = h * (1 - 2 * marginPercent);

    const targetScale = Math.min(availW / isoWidth, availH / isoHeight);
    this.scale = Math.max(0.12, Math.min(targetScale, 3.5));

    this.offsetX = w / 2 - isoCenterX * this.scale;
    this.offsetY = h / 2 - isoCenterY * this.scale;

    this.render();
  }

  public resetCameraView(): void {
    this.fitToBounds(0.08);
  }

  // ========================================================
  // ISOMETRIC 2.5D MATH & TRANSFORMATIONS (Fixed 30 Degrees)
  // ========================================================
  private latLngToMeters(lat: number, lng: number): { x: number; y: number } {
    const R = 6378137;
    const latRad = (this.centerLat * Math.PI) / 180;
    // East-West meters
    const x = (lng - this.centerLng) * (Math.PI / 180) * R * Math.cos(latRad);
    // North-South meters
    const y = (lat - this.centerLat) * (Math.PI / 180) * R;
    return { x, y };
  }

  private metersToIso(xMeters: number, yMeters: number): { isoX: number; isoY: number } {
    // Fixed 30° standard isometric projection (Math.PI / 6)
    // u = East (meters), v = North (meters)
    const u = xMeters;
    const v = -yMeters; // Inverted so North points up
    const cos30 = 0.86602540378; // Math.cos(Math.PI / 6)
    const sin30 = 0.5; // Math.sin(Math.PI / 6)

    const isoX = (u - v) * cos30;
    const isoY = (u + v) * sin30;
    return { isoX, isoY };
  }

  private worldToScreen(lat: number, lng: number): { x: number; y: number } {
    const { x, y } = this.latLngToMeters(lat, lng);
    const { isoX, isoY } = this.metersToIso(x, y);
    return {
      x: this.offsetX + isoX * this.scale,
      y: this.offsetY + isoY * this.scale,
    };
  }

  private screenToLatLng(screenX: number, screenY: number): { lat: number; lng: number } {
    const isoX = (screenX - this.offsetX) / this.scale;
    const isoY = (screenY - this.offsetY) / this.scale;
    const cos30 = 0.86602540378;
    const sin30 = 0.5;

    const sum = isoY / sin30;
    const diff = isoX / cos30;
    const u = (sum + diff) / 2;
    const v = (sum - diff) / 2;
    const xMeters = u;
    const yMeters = -v;

    const R = 6378137;
    const latRad = (this.centerLat * Math.PI) / 180;
    const lng = this.centerLng + xMeters / ((Math.PI / 180) * R * Math.cos(latRad));
    const lat = this.centerLat + yMeters / ((Math.PI / 180) * R);
    return { lat, lng };
  }

  private pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
    const [x, y] = point;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][1];
      const yi = polygon[i][0];
      const xj = polygon[j][1];
      const yj = polygon[j][0];
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // ========================================================
  // EVENT LISTENERS & GESTURES (Pan, Zoom, Hover, Click)
  // ========================================================
  private bindEvents(): void {
    // Canvas Pan & Zoom
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.hasMovedWhileDragging = false;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.tryStartElementDrag(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.draggingElement) {
        if (Math.hypot(e.clientX - this.dragStartX, e.clientY - this.dragStartY) > 3) {
          this.hasMovedWhileDragging = true;
        }
        this.dragElementTo(e.clientX, e.clientY);
      } else if (this.isDragging) {
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          this.hasMovedWhileDragging = true;
        }
        this.offsetX += dx;
        this.offsetY += dy;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
      }

      const rect = this.canvas.getBoundingClientRect();
      this.mouseCanvasPos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      this.mouseScreenPos = { x: e.clientX, y: e.clientY };
      this.updateHoverState();
    });

    window.addEventListener('mouseup', (e) => {
      if (this.draggingElement) {
        this.finishElementDrag();
        this.isDragging = false;
        return;
      }
      if (this.isDragging && !this.hasMovedWhileDragging) {
        this.handleCanvasClick(e.clientX, e.clientY);
      }
      this.isDragging = false;
    });

    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
        this.zoomAtPoint(e.clientX, e.clientY, zoomFactor);
      },
      { passive: false }
    );

    // Touch support for mobile devices
    let touchStartDist = 0;
    this.canvas.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 1) {
          this.isDragging = true;
          this.hasMovedWhileDragging = false;
          this.dragStartX = e.touches[0].clientX;
          this.dragStartY = e.touches[0].clientY;
          this.tryStartElementDrag(e.touches[0].clientX, e.touches[0].clientY);
        } else if (e.touches.length === 2) {
          this.isDragging = false;
          this.draggingElement = null;
          touchStartDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
        }
      },
      { passive: true }
    );

    this.canvas.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length === 1 && this.draggingElement) {
          if (Math.hypot(e.touches[0].clientX - this.dragStartX, e.touches[0].clientY - this.dragStartY) > 4) {
            this.hasMovedWhileDragging = true;
          }
          this.dragElementTo(e.touches[0].clientX, e.touches[0].clientY);
        } else if (e.touches.length === 1 && this.isDragging) {
          const dx = e.touches[0].clientX - this.dragStartX;
          const dy = e.touches[0].clientY - this.dragStartY;
          if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
            this.hasMovedWhileDragging = true;
          }
          this.offsetX += dx;
          this.offsetY += dy;
          this.dragStartX = e.touches[0].clientX;
          this.dragStartY = e.touches[0].clientY;
        } else if (e.touches.length === 2 && touchStartDist > 0) {
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          const factor = dist / touchStartDist;
          const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          this.zoomAtPoint(midX, midY, factor);
          touchStartDist = dist;
        }
      },
      { passive: true }
    );

    this.canvas.addEventListener('touchend', (e) => {
      if (this.draggingElement) {
        this.finishElementDrag();
        this.isDragging = false;
        touchStartDist = 0;
        return;
      }
      if (!this.hasMovedWhileDragging && e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        this.handleCanvasClick(touch.clientX, touch.clientY);
      }
      this.isDragging = false;
      touchStartDist = 0;
    });

    // HUD Buttons Wiring
    document.getElementById('btn-game-zoom-in')?.addEventListener('click', () => {
      this.zoomCenter(1.25);
    });

    document.getElementById('btn-game-zoom-out')?.addEventListener('click', () => {
      this.zoomCenter(0.8);
    });

    document.getElementById('btn-game-reset-view')?.addEventListener('click', () => {
      this.resetCameraView();
    });

    document.getElementById('btn-weather-fix')?.addEventListener('click', (e) => { e.stopPropagation(); this.openWeatherFix(); });

    document.getElementById('btn-sheet-rotation')?.addEventListener('click', () => {
      if (this.sheetTalhaoId) this.callbacks.onOpenRotation?.(this.sheetTalhaoId);
    });

    document.getElementById('weather-chip')?.addEventListener('click', () => this.toggleWeatherChip());
    document.getElementById('btn-game-more')?.addEventListener('click', () => {
      const m = document.getElementById('game-more-menu');
      if (m) m.style.display = m.style.display === 'none' ? 'flex' : 'none';
    });
    document.getElementById('btn-game-move-mode')?.addEventListener('click', () => {
      this.setMoveMode(!this.moveMode);
    });

    document.getElementById('btn-game-advance-week')?.addEventListener('click', () => {
      this.callbacks.onAdvanceTime(7);
    });

    // Left Panel Toggle
    const toggleBtn = document.getElementById('btn-toggle-left-panel');
    const leftContent = document.getElementById('left-panel-content');
    const applyPanel = () => {
      if (leftContent) leftContent.style.display = this.isLeftPanelCollapsed ? 'none' : 'block';
      if (toggleBtn) {
        toggleBtn.innerText = this.isLeftPanelCollapsed ? '▶' : '◀';
        toggleBtn.title = this.isLeftPanelCollapsed ? 'Expandir painel' : 'Recolher painel';
      }
    };
    try { this.isLeftPanelCollapsed = localStorage.getItem('myroca_legend_open_v1') !== '1'; } catch { this.isLeftPanelCollapsed = true; }
    applyPanel();
    toggleBtn?.addEventListener('click', () => {
      this.isLeftPanelCollapsed = !this.isLeftPanelCollapsed;
      try { localStorage.setItem('myroca_legend_open_v1', this.isLeftPanelCollapsed ? '0' : '1'); } catch { /* ignora */ }
      if (leftContent) {
        leftContent.style.display = this.isLeftPanelCollapsed ? 'none' : 'block';
      }
      if (toggleBtn) {
        toggleBtn.innerText = this.isLeftPanelCollapsed ? '▶' : '◀';
        toggleBtn.title = this.isLeftPanelCollapsed ? 'Expandir painel' : 'Recolher painel';
      }
    });

    // Agronomist Interaction
    const agronomistBubble = document.getElementById('agronomist-speech-bubble');
    const agronomistAvatar = document.getElementById('btn-agronomist-avatar');
    const minimizeBtn = document.getElementById('btn-minimize-agronomist');

    minimizeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isAgronomistCollapsed = true;
      if (agronomistBubble) agronomistBubble.style.display = 'none';
    });

    agronomistAvatar?.addEventListener('click', () => {
      if (this.isAgronomistCollapsed) {
        this.isAgronomistCollapsed = false;
        if (agronomistBubble) agronomistBubble.style.display = 'block';
      }
      this.currentSpeechIndex++;
      this.updateAgronomistSpeech();
    });

    // Sheet Modal Close & Actions
    document.getElementById('btn-close-talhao-sheet')?.addEventListener('click', () => {
      this.closeTalhaoSheet();
    });

    document.getElementById('btn-sheet-view-real-map')?.addEventListener('click', () => {
      this.closeTalhaoSheet();
      this.callbacks.onSwitchToRealMap();
    });

    document.getElementById('btn-sheet-open-calendar')?.addEventListener('click', () => {
      if (this.hoveredTalhao) {
        const t = this.hoveredTalhao;
        this.closeTalhaoSheet();
        this.callbacks.onOpenCalendarModal?.(t);
      }
    });
  }

  private zoomCenter(factor: number): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.zoomAtPoint(w / 2, h / 2, factor);
  }

  private zoomAtPoint(clientX: number, clientY: number, factor: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;

    const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * factor));
    if (newScale === this.scale) return;

    // Zoom towards point
    this.offsetX = px - (px - this.offsetX) * (newScale / this.scale);
    this.offsetY = py - (py - this.offsetY) * (newScale / this.scale);
    this.scale = newScale;
  }

  private updateHoverState(): void {
    const rect = this.canvas.getBoundingClientRect();
    const mx = this.mouseScreenPos.x - rect.left;
    const my = this.mouseScreenPos.y - rect.top;

    // Check structures first (hit radius 28px)
    let foundElem: WaterPoint | null = null;
    for (const wp of this.farmData.waterPoints) {
      const sp = this.worldToScreen(wp.coordinates[0], wp.coordinates[1]);
      const dist = Math.hypot(mx - sp.x, my - sp.y);
      if (dist <= 26) {
        foundElem = wp;
        break;
      }
    }
    this.hoveredElement = foundElem;

    // Check talhões
    if (!foundElem) {
      const geo = this.screenToLatLng(mx, my);
      const clickedPt: [number, number] = [geo.lng, geo.lat];
      let foundTalhao: Talhao | null = null;

      for (const t of this.farmData.talhoes) {
        if (this.pointInPolygon(clickedPt, t.coordinates)) {
          foundTalhao = t;
          break;
        }
      }
      this.hoveredTalhao = foundTalhao;
    } else {
      this.hoveredTalhao = null;
    }

    this.canvas.style.cursor = this.moveMode
      ? this.hoveredElement || this.draggingElement ? 'grabbing' : 'move'
      : this.hoveredElement || this.hoveredTalhao ? 'pointer' : 'grab';
  }

  private handleCanvasClick(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    // Componente (silo, nascente...): abre o cartão na hora, sem o avatar andar
    const hit = this.hitStructure(mx, my, 28);
    if (hit) {
      this.callbacks.onElementSelect(hit);
      this.openElementCard(hit);
      return;
    }
    this.closeElementCard();

    // Talhão: abre a ficha na hora
    const geo = this.screenToLatLng(mx, my);
    const clickedPt: [number, number] = [geo.lng, geo.lat];
    for (const t of this.farmData.talhoes) {
      if (this.pointInPolygon(clickedPt, t.coordinates)) {
        this.callbacks.onTalhaoSelect(t);
        this.openTalhaoSheet(t);
        return;
      }
    }

    // Chão livre: o avatar caminha até o ponto
    this.walkAvatarTo(geo.lat, geo.lng, null);
  }

  // ========================================================
  // COMPONENTES: cartão de informações e modo "mover"
  // ========================================================
  private hitStructure(mx: number, my: number, radius: number): WaterPoint | null {
    let best: WaterPoint | null = null;
    let bestDist = radius;
    for (const wp of this.farmData.waterPoints) {
      const sp = this.worldToScreen(wp.coordinates[0], wp.coordinates[1]);
      const d = Math.hypot(mx - sp.x, my - sp.y);
      if (d <= bestDist) {
        best = wp;
        bestDist = d;
      }
    }
    return best;
  }

  private setMoveMode(on: boolean): void {
    this.moveMode = on;
    document.getElementById('btn-game-move-mode')?.classList.toggle('active', on);
    this.canvas.style.cursor = on ? 'move' : 'grab';
    this.showHint(on ? t('moveModeOn') : t('moveModeOff'));
  }

  private showHint(text: string): void {
    let el = this.container.querySelector<HTMLElement>('.game-move-hint');
    if (!el) {
      el = document.createElement('div');
      el.className = 'game-move-hint';
      this.container.appendChild(el);
    }
    el.textContent = text;
    el.classList.add('show');
    window.setTimeout(() => el!.classList.remove('show'), 2600);
  }

  private tryStartElementDrag(clientX: number, clientY: number): void {
    if (!this.moveMode) return;
    const rect = this.canvas.getBoundingClientRect();
    const hit = this.hitStructure(clientX - rect.left, clientY - rect.top, 32);
    if (hit) {
      this.draggingElement = hit;
      this.draggingMoved = false;
    }
  }

  private dragElementTo(clientX: number, clientY: number): void {
    if (!this.draggingElement) return;
    const rect = this.canvas.getBoundingClientRect();
    const geo = this.screenToLatLng(clientX - rect.left, clientY - rect.top);
    this.draggingElement.coordinates = [geo.lat, geo.lng];
    this.draggingMoved = true;
    this.canvas.style.cursor = 'grabbing';
  }

  private finishElementDrag(): void {
    const el = this.draggingElement;
    this.draggingElement = null;
    if (!el) return;
    if (this.draggingMoved) {
      this.callbacks.onElementMoved?.(el);
      this.showHint(`✅ ${t('elemMoved')}`);
    } else {
      // toque sem arrastar no modo mover: abre o cartão
      this.callbacks.onElementSelect(el);
      this.openElementCard(el);
    }
    this.draggingMoved = false;
    this.canvas.style.cursor = this.moveMode ? 'move' : 'grab';
  }

  private openElementCard(wp: WaterPoint): void {
    const meta = FARM_ELEMENT_META[wp.type];
    if (!this.elementCard) {
      this.elementCard = document.createElement('div');
      this.elementCard.className = 'game-element-card';
      this.container.appendChild(this.elementCard);
    }
    const card = this.elementCard;
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
    card.innerHTML = `
      <div class="elem-card-head">
        <span class="elem-card-icon">${meta?.icon || '📍'}</span>
        <div class="elem-card-titles">
          <strong>${esc(wp.name)}</strong>
          <small>${esc(meta?.label || wp.type)}</small>
        </div>
        <button class="elem-card-x" data-act="close" aria-label="${t('elemClose')}">&times;</button>
      </div>
      ${meta?.description ? `<p class="elem-card-desc">${esc(meta.description)}</p>` : ''}
      ${wp.notes ? `<p class="elem-card-notes">${esc(wp.notes)}</p>` : ''}
      <div class="elem-card-actions">
        <button data-act="move">✋ ${t('elemMove')}</button>
        <button data-act="walk">🚶 ${t('elemGoThere')}</button>
      </div>`;
    card.style.display = 'block';
    card.onclick = (ev) => {
      const act = (ev.target as HTMLElement).closest('button')?.getAttribute('data-act');
      if (act === 'close') this.closeElementCard();
      else if (act === 'move') {
        this.closeElementCard();
        if (!this.moveMode) this.setMoveMode(true);
      } else if (act === 'walk') {
        this.closeElementCard();
        this.walkAvatarTo(wp.coordinates[0], wp.coordinates[1], null);
      }
    };
  }

  private closeElementCard(): void {
    if (this.elementCard) this.elementCard.style.display = 'none';
  }

  // ========================================================
  // AVATAR DO PRODUTOR
  // ========================================================
  private initAvatar(): void {
    this.avatarCfg = loadAvatar();
    const sede = this.farmData.waterPoints.find((w) => w.type === 'sede');
    this.avatarPos = sede
      ? { lat: sede.coordinates[0] - 0.0003, lng: sede.coordinates[1] }
      : { lat: this.centerLat, lng: this.centerLng };
    document.getElementById('btn-game-avatar')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openAvatarEditor();
    });
    this.refreshAvatarButton();
  }

  private refreshAvatarButton(): void {
    document.getElementById('btn-game-avatar')?.classList.toggle('av-pulse', !this.avatarCfg);
  }

  public openAvatarEditor(): void {
    markAvatarPrompted();
    openAvatarCreator({
      initial: this.avatarCfg,
      onSave: (cfg) => {
        this.avatarCfg = cfg;
        saveAvatar(cfg);
        this.refreshAvatarButton();
        this.callbacks.onAvatarSaved?.();
      },
    });
  }

  /** Chamado quando a visão "Minha Fazenda" é exibida: oferece criar o avatar uma única vez. */
  public promptAvatarIfNeeded(): void {
    if (this.avatarCfg || wasAvatarPrompted()) return;
    this.openAvatarEditor();
  }

  private walkAvatarTo(lat: number, lng: number, onArrive: (() => void) | null): void {
    if (!this.avatarCfg || !this.avatarPos) {
      // sem avatar: comportamento direto (abre a ficha na hora)
      onArrive?.();
      return;
    }
    this.avatarTarget = { lat, lng };
    this.avatarArrival = onArrive;
  }

  private updateAvatar(): void {
    this.avatarWalking = false;
    if (!this.avatarCfg || !this.avatarPos || !this.avatarTarget) return;
    const a = this.latLngToMeters(this.avatarPos.lat, this.avatarPos.lng);
    const b = this.latLngToMeters(this.avatarTarget.lat, this.avatarTarget.lng);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    // velocidade de jogo: ~9 m por quadro (≈ 540 m/s), um pouco mais rápido em trajetos longos
    const step = Math.max(9, dist / 220);
    if (dist <= step) {
      this.avatarPos = { lat: this.avatarTarget.lat, lng: this.avatarTarget.lng };
      this.avatarTarget = null;
      const done = this.avatarArrival;
      this.avatarArrival = null;
      done?.();
      return;
    }
    const nx = a.x + (dx / dist) * step;
    const ny = a.y + (dy / dist) * step;
    const R = 6378137;
    const latRad = (this.centerLat * Math.PI) / 180;
    this.avatarPos = {
      lat: this.centerLat + ny / ((Math.PI / 180) * R),
      lng: this.centerLng + nx / ((Math.PI / 180) * R * Math.cos(latRad)),
    };
    this.avatarWalking = true;
    // norte (dy > 0) aparece "para cima" na tela: mostra de costas
    this.avatarAway = dy > 0 && Math.abs(dy) > Math.abs(dx) * 0.4;
  }

  private renderAvatar(): void {
    if (!this.avatarCfg || !this.avatarPos) return;
    const ctx = this.ctx;
    const p = this.worldToScreen(this.avatarPos.lat, this.avatarPos.lng);
    const px = 64 * Math.min(1.9, Math.max(0.75, this.scale));
    drawAvatar(ctx, this.avatarCfg, p.x, p.y, px, {
      walking: this.avatarWalking,
      tick: this.animTick,
      away: this.avatarWalking ? this.avatarAway : false,
    });
    if (this.avatarCfg.name) {
      ctx.save();
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const w = ctx.measureText(this.avatarCfg.name).width + 14;
      const y = p.y - px * 1.18;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      ctx.roundRect(p.x - w / 2, y - 9, w, 18, 9);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(this.avatarCfg.name, p.x, y);
      ctx.restore();
    }
  }

  // ========================================================
  // ANIMATION LOOP & RENDERING
  // ========================================================
  private startAnimationLoop(): void {
    const loop = () => {
      this.animTick++;
      this.updateAvatar();
      this.updateWeatherAnimation();
      this.render();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  private updateWeatherAnimation(): void {
    // Drifting clouds
    const w = this.canvas ? this.canvas.clientWidth : 1200;
    for (const cloud of this.clouds) {
      cloud.x += cloud.speed;
      if (cloud.x > w + 250) {
        cloud.x = -cloud.size - 200;
      }
    }

    // Falling rain
    if (this.isRaining) {
      const h = this.canvas ? this.canvas.clientHeight : 800;
      const slant = this.weather?.windKmh ? Math.min(0.6, 0.15 + this.weather.windKmh / 80) : 0.28;
      const active = Math.floor(this.rainDrops.length * [0, 0.3, 0.65, 1][this.rainIntensity]);
      for (let i = 0; i < active; i++) {
        const drop = this.rainDrops[i];
        drop.y += drop.speed * (this.rainIntensity === 3 ? 1.25 : 1);
        drop.x -= drop.speed * slant; // inclinação pelo vento
        if (drop.y > h + 50) {
          drop.y = -drop.length - 20;
          drop.x = Math.random() * (w + 400) - 200;
        }
      }
    }
  }

  public render(): void {
    if (!this.ctx || !this.canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;

    this.ctx.save();
    this.ctx.scale(dpr, dpr);

    // 1. Background Ground Terrain (Rich Cerrado Rural Landscape)
    this.renderGroundBackground(width, height);

    // 2. Subtle Discrete Isometric Grid on the Ground
    this.renderIsometricGroundGrid();

    // 3. Internal Dirt Roads (Estradas Rurais)
    this.renderRoads();

    // 4. Talhões as 2.5D Platforms (Slabs, Lateral Soil Cuts & Crop Planting Rows)
    this.renderTalhoes();

    // 5. Water Bodies (Açude, Represa, Rio)
    this.renderWaterBodies();

    // 6. 2.5D Isometric Vector Structures (Sede, Silos, Curral, Estação, Poço, Mata)
    this.renderStructures();

    // 6b. Avatar do produtor
    this.renderAvatar();

    // 7. Ambient Weather Effects (Gentle Drifting Clouds & Light Rain)
    this.renderWeather(width, height);

    // 8. Hover / Touch Interactive Floating Labels with Clear Outline
    this.renderHoverTooltips();

    this.ctx.restore();
  }

  // ========================================================
  // RENDER STAGES
  // ========================================================
  private renderGroundBackground(w: number, h: number): void {
    const grad = this.ctx.createRadialGradient(
      w / 2,
      h / 2,
      100,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.8
    );
    // Deep healthy rural grass palette
    grad.addColorStop(0, '#1c341b');
    grad.addColorStop(0.6, '#142713');
    grad.addColorStop(1, '#0c1a0c');

    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, w, h);
  }

  private renderIsometricGroundGrid(): void {
    // Subtle discrete grid spaced ~60m in farm space
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.055)';
    ctx.lineWidth = 1;

    const gridStep = 75; // meters
    const steps = 14;

    for (let i = -steps; i <= steps; i++) {
      const u = i * gridStep;
      // Line along v axis
      const p1 = this.metersToScreen(u, -steps * gridStep);
      const p2 = this.metersToScreen(u, steps * gridStep);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Line along u axis
      const q1 = this.metersToScreen(-steps * gridStep, u);
      const q2 = this.metersToScreen(steps * gridStep, u);
      ctx.beginPath();
      ctx.moveTo(q1.x, q1.y);
      ctx.lineTo(q2.x, q2.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  private metersToScreen(xMeters: number, yMeters: number): { x: number; y: number } {
    const { isoX, isoY } = this.metersToIso(xMeters, yMeters);
    return {
      x: this.offsetX + isoX * this.scale,
      y: this.offsetY + isoY * this.scale,
    };
  }

  private renderRoads(): void {
    // Draw internal farm dirt roads connecting elements
    const ctx = this.ctx;
    const roadPoints = this.farmData.waterPoints.filter((wp) => wp.type === 'estrada');
    if (roadPoints.length === 0) return;

    ctx.save();
    ctx.strokeStyle = '#92400e'; // Warm reddish soil
    ctx.lineWidth = Math.max(6, 10 * this.scale * 0.1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    roadPoints.forEach((r) => {
      const sp = this.worldToScreen(r.coordinates[0], r.coordinates[1]);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 16 * this.scale * 0.1, 0, Math.PI * 2);
      ctx.fillStyle = '#b45309';
      ctx.fill();
    });

    ctx.restore();
  }

  // ========================================================
  // TALHÕES AS 2.5D PLATFORMS WITH VISIBLE SOIL CUT & ROWS
  // ========================================================
  private renderTalhoes(): void {
    const ctx = this.ctx;
    const refDate = this.farmData.referenceDate || '2026-11-09';

    this.farmData.talhoes.forEach((talhao) => {
      if (talhao.coordinates.length < 3) return;

      const screenPts = talhao.coordinates.map(([lat, lng]) => this.worldToScreen(lat, lng));
      const cropStatus = calculateTalhaoCropStatus(talhao, refDate);
      const isHovered = this.hoveredTalhao === talhao;

      // Height of low platform slab (corte de solo fértil)
      const hSlab = Math.max(8, Math.min(18, 11 * this.scale));

      // 1. Draw Lateral Soil Cut Walls (Extrusion downwards)
      for (let i = 0; i < screenPts.length; i++) {
        const p1 = screenPts[i];
        const p2 = screenPts[(i + 1) % screenPts.length];

        // Determine if edge faces forward/down in isometric space
        if (p2.x >= p1.x - 2) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(p2.x, p2.y + hSlab);
          ctx.lineTo(p1.x, p1.y + hSlab);
          ctx.closePath();

          // Dark fertile Cerrado latosol gradient
          const wallGrad = ctx.createLinearGradient(0, p1.y, 0, p1.y + hSlab);
          wallGrad.addColorStop(0, '#3f2113');
          wallGrad.addColorStop(0.5, '#2b1509');
          wallGrad.addColorStop(1, '#1b0c05');
          ctx.fillStyle = wallGrad;
          ctx.fill();

          ctx.strokeStyle = '#1e0e06';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Subtle horizontal soil stratum lines
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y + hSlab * 0.45);
          ctx.lineTo(p2.x, p2.y + hSlab * 0.45);
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.15)'; // mineral stratum
          ctx.stroke();
        }
      }

      // 2. Top Surface Fill with Specific Crop Texture & Planting Rows
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(screenPts[0].x, screenPts[0].y);
      for (let i = 1; i < screenPts.length; i++) {
        ctx.lineTo(screenPts[i].x, screenPts[i].y);
      }
      ctx.closePath();

      // Base background color according to phase
      const phaseKey = cropStatus.phase.key;
      let baseGroundColor = '#166534';
      if (phaseKey === 'preparo') baseGroundColor = '#451a03';
      else if (phaseKey === 'plantio') baseGroundColor = '#3e2010';
      else if (phaseKey === 'crescimento') baseGroundColor = '#14532d';
      else if (phaseKey === 'floracao') baseGroundColor = '#166534';
      else if (phaseKey === 'enchimento') baseGroundColor = '#365314';
      else if (phaseKey === 'colheita') baseGroundColor = '#78350f';
      else if (phaseKey === 'pastagem') baseGroundColor = '#4d7c0f';

      ctx.fillStyle = baseGroundColor;
      ctx.fill();

      // Clip to polygon to draw planting rows inside
      ctx.clip();
      this.drawPlantingRows(screenPts, phaseKey, talhao.crop);
      ctx.restore();

      // 3. Glowing Border (Health status: verde saudável, amarelo atenção, vermelho alerta)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(screenPts[0].x, screenPts[0].y);
      for (let i = 1; i < screenPts.length; i++) {
        ctx.lineTo(screenPts[i].x, screenPts[i].y);
      }
      ctx.closePath();

      const health = talhao.healthStatus || 'verde';
      let healthColor = '#22c55e'; // verde
      let healthShadow = 'rgba(34, 197, 94, 0.8)';
      if (health === 'amarelo') {
        healthColor = '#eab308'; // amarelo atenção
        healthShadow = 'rgba(234, 179, 8, 0.85)';
      } else if (health === 'vermelho') {
        healthColor = '#ef4444'; // vermelho alerta
        healthShadow = 'rgba(239, 68, 68, 0.9)';
      }

      ctx.strokeStyle = healthColor;
      ctx.lineWidth = isHovered ? 4.5 : 2.5;
      ctx.shadowColor = healthShadow;
      ctx.shadowBlur = isHovered ? 18 : 10;
      ctx.stroke();
      ctx.restore();

      // 4. Field Operation Badge over Talhão (e.g. Tractor 🚜)
      this.renderOperationBadge(screenPts, cropStatus, talhao);
    });
  }

  private drawPlantingRows(
    screenPts: { x: number; y: number }[],
    phaseKey: string,
    cropName?: string
  ): void {
    const ctx = this.ctx;

    // Pasture: continuous braquiária grass prairie
    if (phaseKey === 'pastagem' || (cropName || '').toLowerCase().includes('pasto')) {
      ctx.fillStyle = '#65a30d';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      // Subtle grass tufts
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.25)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 40; i++) {
        const pt = screenPts[i % screenPts.length];
        const gx = pt.x + (Math.sin(i * 99) * 80);
        const gy = pt.y + (Math.cos(i * 33) * 60);
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx - 2, gy - 6);
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + 2, gy - 7);
        ctx.stroke();
      }
      return;
    }

    // Find longest edge direction to orient the crop rows
    let maxDist = 0;
    let rowAngle = Math.PI / 6; // default 30°
    for (let i = 0; i < screenPts.length; i++) {
      const p1 = screenPts[i];
      const p2 = screenPts[(i + 1) % screenPts.length];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (dist > maxDist) {
        maxDist = dist;
        rowAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      }
    }

    // Centroid
    let cX = 0;
    let cY = 0;
    screenPts.forEach((p) => {
      cX += p.x;
      cY += p.y;
    });
    cX /= screenPts.length;
    cY /= screenPts.length;

    ctx.save();
    ctx.translate(cX, cY);
    ctx.rotate(rowAngle);

    const radius = Math.max(300, maxDist * 1.5);
    const rowSpacing = Math.max(8, Math.min(22, 14 * this.scale));

    for (let y = -radius; y <= radius; y += rowSpacing) {
      if (phaseKey === 'preparo') {
        // Dark brown soil furrows
        ctx.strokeStyle = '#2b1204';
        ctx.lineWidth = rowSpacing * 0.45;
        ctx.beginPath();
        ctx.moveTo(-radius, y);
        ctx.lineTo(radius, y);
        ctx.stroke();

        ctx.strokeStyle = '#5c270b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-radius, y - 2);
        ctx.lineTo(radius, y - 2);
        ctx.stroke();
      } else if (phaseKey === 'plantio') {
        // Tilled soil with tiny sprout seedling dots
        ctx.strokeStyle = '#271206';
        ctx.lineWidth = rowSpacing * 0.35;
        ctx.beginPath();
        ctx.moveTo(-radius, y);
        ctx.lineTo(radius, y);
        ctx.stroke();

        // Green seedling dots along the row
        ctx.fillStyle = '#4ade80';
        for (let x = -radius; x <= radius; x += rowSpacing * 1.4) {
          ctx.beginPath();
          ctx.arc(x, y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (phaseKey === 'crescimento') {
        // Lush vibrant emerald green rows
        ctx.strokeStyle = '#15803d';
        ctx.lineWidth = rowSpacing * 0.6;
        ctx.beginPath();
        ctx.moveTo(-radius, y);
        ctx.lineTo(radius, y);
        ctx.stroke();

        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = rowSpacing * 0.28;
        ctx.beginPath();
        ctx.moveTo(-radius, y);
        ctx.lineTo(radius, y);
        ctx.stroke();
      } else if (phaseKey === 'floracao') {
        // Green rows decorated with bright colorful flower dots
        ctx.strokeStyle = '#166534';
        ctx.lineWidth = rowSpacing * 0.65;
        ctx.beginPath();
        ctx.moveTo(-radius, y);
        ctx.lineTo(radius, y);
        ctx.stroke();

        // Blossoming flower dots
        for (let x = -radius; x <= radius; x += rowSpacing * 1.1) {
          ctx.fillStyle = (x % 3 === 0) ? '#fef08a' : '#ffffff';
          ctx.beginPath();
          ctx.arc(x + Math.sin(y) * 3, y - 1, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (phaseKey === 'enchimento') {
        // Golden-green dense grain filling rows
        ctx.strokeStyle = '#3f6212';
        ctx.lineWidth = rowSpacing * 0.65;
        ctx.beginPath();
        ctx.moveTo(-radius, y);
        ctx.lineTo(radius, y);
        ctx.stroke();

        ctx.strokeStyle = '#a3e635';
        ctx.lineWidth = rowSpacing * 0.3;
        ctx.beginPath();
        ctx.moveTo(-radius, y);
        ctx.lineTo(radius, y);
        ctx.stroke();
      } else if (phaseKey === 'colheita') {
        // Rich golden amber harvest rows
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = rowSpacing * 0.7;
        ctx.beginPath();
        ctx.moveTo(-radius, y);
        ctx.lineTo(radius, y);
        ctx.stroke();

        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = rowSpacing * 0.25;
        ctx.beginPath();
        ctx.moveTo(-radius, y);
        ctx.lineTo(radius, y);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private renderOperationBadge(
    screenPts: { x: number; y: number }[],
    cropStatus: any,
    talhao: Talhao
  ): void {
    let cX = 0;
    let cY = 0;
    screenPts.forEach((p) => {
      cX += p.x;
      cY += p.y;
    });
    cX /= screenPts.length;
    cY /= screenPts.length;

    const ctx = this.ctx;
    ctx.save();
    // Gentle bobbing animation
    const bob = Math.sin((this.animTick + talhao.name.length * 10) * 0.06) * 4;
    ctx.translate(cX, cY - 32 + bob);

    const isPasture = cropStatus.isPasture || (talhao.crop || '').toLowerCase().includes('pasto');
    const cropName = talhao.crop ? translateCropName(talhao.crop) : t('cropFieldDefault');

    // Primary line: Real crop phase calculated from reference date and cycle
    let primaryText = '';
    if (isPasture) {
      primaryText = `${cropName} • ${t('labelPerennial')}`;
    } else if (talhao.cycleDays && cropStatus.daysPassed > 0) {
      primaryText = `${cropName} • ${translateCropPhase(cropStatus.phase.key)} • ${t('labelDayOf', { day: cropStatus.daysPassed, cycle: talhao.cycleDays })}`;
    } else {
      primaryText = `${cropName} • ${translateCropPhase(cropStatus.phase.key)}`;
    }

    // Secondary line: Next operation with representative icon
    let secondaryText = '';
    if (isPasture) {
      secondaryText = `🐂 ${t('opNextPasture')}`;
    } else if (cropStatus.phase.key === 'colheita') {
      secondaryText = `🌾 ${t('opNextHarvest')}`;
    } else if (cropStatus.phase.key === 'enchimento') {
      secondaryText = `🚜 ${t('opNextFilling')}`;
    } else if (cropStatus.phase.key === 'floracao') {
      secondaryText = `🚜 ${t('opNextFlowering')}`;
    } else if (cropStatus.phase.key === 'crescimento') {
      secondaryText = `🚜 ${t('opNextGrowth')}`;
    } else if (cropStatus.phase.key === 'emergencia' || cropStatus.phase.key === 'plantio') {
      secondaryText = `🚜 ${t('opNextEmergence')}`;
    } else if (cropStatus.phase.key === 'preparo') {
      secondaryText = `🚜 ${t('opNextPrep')}`;
    } else {
      secondaryText = `🚜 ${t('opNextPlanning')}`;
    }

    ctx.font = 'bold 12px sans-serif';
    const primaryW = ctx.measureText(primaryText).width;
    ctx.font = '10px sans-serif';
    const secondaryW = ctx.measureText(secondaryText).width;

    const maxTextW = Math.max(primaryW, secondaryW);
    const badgeW = maxTextW + 28;
    const badgeH = 38;

    // Badge Card Pill
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.strokeStyle = cropStatus.phase.badgeColor || '#22c55e';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH, 10);
    ctx.fill();
    ctx.stroke();

    ctx.shadowColor = 'transparent';

    // Primary Text (Crop & Real Phase)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(primaryText, 0, -7);

    // Secondary Text (Next operation)
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '9.5px sans-serif';
    ctx.fillText(secondaryText, 0, 9);

    ctx.restore();
  }

  // ========================================================
  // PROCEDURAL 2.5D ISOMETRIC VECTOR STRUCTURES
  // ========================================================
  private renderWaterBodies(): void {
    const ctx = this.ctx;
    const waters = this.farmData.waterPoints.filter((wp) =>
      ['acude', 'rio', 'nascente'].includes(wp.type)
    );

    waters.forEach((w) => {
      const sp = this.worldToScreen(w.coordinates[0], w.coordinates[1]);
      ctx.save();
      ctx.translate(sp.x, sp.y);

      // Shimmering translucent blue water
      const pulse = Math.sin(this.animTick * 0.05) * 2;
      const rx = 34 * this.scale * 0.12 + 18 + pulse;
      const ry = 18 * this.scale * 0.12 + 10 + pulse * 0.5;

      // Shore
      ctx.beginPath();
      ctx.ellipse(0, 2, rx + 4, ry + 3, Math.PI / 12, 0, Math.PI * 2);
      ctx.fillStyle = '#92400e';
      ctx.fill();

      // Water body
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, Math.PI / 12, 0, Math.PI * 2);
      const waterGrad = ctx.createRadialGradient(0, -3, 4, 0, 0, rx);
      waterGrad.addColorStop(0, '#38bdf8');
      waterGrad.addColorStop(0.7, '#0284c7');
      waterGrad.addColorStop(1, '#0369a1');
      ctx.fillStyle = waterGrad;
      ctx.fill();

      // Light shimmer waves
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(-6, -2, rx * 0.45, ry * 0.35, 0, 0, Math.PI);
      ctx.stroke();

      ctx.restore();
    });
  }

  private renderStructures(): void {
    const structures = this.farmData.waterPoints;
    // Sort from back to front in screen space for isometric depth ordering
    const sorted = [...structures].sort((a, b) => {
      const spA = this.worldToScreen(a.coordinates[0], a.coordinates[1]);
      const spB = this.worldToScreen(b.coordinates[0], b.coordinates[1]);
      return spA.y - spB.y;
    });

    sorted.forEach((wp) => {
      const sp = this.worldToScreen(wp.coordinates[0], wp.coordinates[1]);
      this.drawStructure25D(wp.type, sp.x, sp.y);
    });
  }

  private drawStructure25D(type: string, x: number, y: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);

    const s = Math.max(0.75, Math.min(1.4, this.scale));
    ctx.scale(s, s);

    switch (type) {
      case 'sede':
        this.drawSede(ctx);
        break;
      case 'silo':
        this.drawSilo(ctx);
        break;
      case 'curral':
        this.drawCurral(ctx);
        break;
      case 'estacao_meteo':
        this.drawEstacao(ctx);
        break;
      case 'poco':
        this.drawPoco(ctx);
        break;
      case 'reserva':
        this.drawReservaTrees(ctx);
        break;
      case 'pivo':
        this.drawPivo(ctx);
        break;
      default:
        // Default marker pin
        this.drawGenericPin(ctx, type);
    }

    ctx.restore();
  }

  private drawSede(ctx: CanvasRenderingContext2D): void {
    // 2.5D Colonial Farmhouse with Terracotta Tiled Roof
    // Ground Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 6, 26, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Left wall (shaded)
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(0, 10);
    ctx.lineTo(0, -12);
    ctx.lineTo(-18, -20);
    ctx.closePath();
    ctx.fill();

    // Right wall (light)
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(20, 0);
    ctx.lineTo(20, -20);
    ctx.lineTo(0, -12);
    ctx.closePath();
    ctx.fill();

    // Front Door & Porch
    ctx.fillStyle = '#78350f';
    ctx.fillRect(5, -6, 7, 10);

    // Terracotta Pitched Roof
    // Left roof slope
    ctx.fillStyle = '#c2410c';
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.lineTo(-24, -20);
    ctx.lineTo(0, -12);
    ctx.closePath();
    ctx.fill();

    // Right roof slope
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.lineTo(0, -12);
    ctx.lineTo(24, -20);
    ctx.closePath();
    ctx.fill();

    // Chimney
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(-10, -32, 4, 10);
  }

  private drawSilo(ctx: CanvasRenderingContext2D): void {
    // Metallic Cylindrical Grain Silos with Conical Cap & Moega
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 8, 28, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Two twin silos side by side
    [-10, 10].forEach((offset) => {
      // Cylinder body
      const grad = ctx.createLinearGradient(offset - 10, 0, offset + 10, 0);
      grad.addColorStop(0, '#94a3b8');
      grad.addColorStop(0.5, '#f1f5f9');
      grad.addColorStop(1, '#64748b');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(offset - 10, -28, 20, 32, 2);
      ctx.fill();

      // Vertical corrugated ribbing
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      for (let rx = -7; rx <= 7; rx += 4) {
        ctx.beginPath();
        ctx.moveTo(offset + rx, -28);
        ctx.lineTo(offset + rx, 4);
        ctx.stroke();
      }

      // Conical roof cap
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(offset - 11, -28);
      ctx.lineTo(offset, -42);
      ctx.lineTo(offset + 11, -28);
      ctx.closePath();
      ctx.fill();

      // Top vent ball
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(offset, -43, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  private drawCurral(ctx: CanvasRenderingContext2D): void {
    // Wooden corral with fence posts and cattle
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 26, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Corral enclosure fences in 2.5D
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-20, -12, 40, 20);

    // Cross rails
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-18, -10, 36, 16);

    // Fence Posts
    ctx.fillStyle = '#451a03';
    [-20, 0, 20].forEach((px) => {
      ctx.fillRect(px - 1.5, -16, 3, 24);
    });

    // Little cattle inside
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.ellipse(-6, -2, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawEstacao(ctx: CanvasRenderingContext2D): void {
    // Meteorological Weather Station Tower with Spinning Anemometer
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Lattice steel mast
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(0, -38);
    ctx.stroke();

    // Cross bracings
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(0, -20);
    ctx.lineTo(5, 0);
    ctx.moveTo(-4, -15);
    ctx.lineTo(0, -32);
    ctx.lineTo(4, -15);
    ctx.stroke();

    // Solar panel
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(-8, -26, 6, 8);

    // Spinning 3-Cup Anemometer on Top
    const angle = this.animTick * 0.15;
    ctx.save();
    ctx.translate(0, -40);
    ctx.rotate(angle);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      const cx = Math.cos(a) * 7;
      const cy = Math.sin(a) * 7;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(cx, cy);
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawPoco(ctx: CanvasRenderingContext2D): void {
    // Circular stone well with timber roof
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 14, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stone rim
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Deep blue water
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Timber posts & canopy
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-7, -18, 2, 18);
    ctx.fillRect(5, -18, 2, 18);

    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.moveTo(-9, -18);
    ctx.lineTo(0, -26);
    ctx.lineTo(9, -18);
    ctx.closePath();
    ctx.fill();
  }

  private drawReservaTrees(ctx: CanvasRenderingContext2D): void {
    // Cluster of lush 2.5D Cerrado native trees
    const treePositions = [
      { x: -12, y: -6, r: 12 },
      { x: 10, y: -4, r: 14 },
      { x: 0, y: -16, r: 16 },
    ];

    treePositions.forEach((tp) => {
      // Trunk
      ctx.fillStyle = '#78350f';
      ctx.fillRect(tp.x - 2, tp.y, 4, 14);

      // Layered rounded canopy
      ctx.fillStyle = '#14532d';
      ctx.beginPath();
      ctx.arc(tp.x, tp.y - 6, tp.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.arc(tp.x - 2, tp.y - 8, tp.r * 0.75, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  private drawPivo(ctx: CanvasRenderingContext2D): void {
    // Center pivot irrigation system
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    // Arm
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(24, 0);
    ctx.stroke();
  }

  private drawGenericPin(ctx: CanvasRenderingContext2D, type: string): void {
    const meta = FARM_ELEMENT_META[type as keyof typeof FARM_ELEMENT_META];
    const icon = meta ? meta.icon : '📍';

    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, 0, -12);
  }

  // ========================================================
  // AMBIENT WEATHER EFFECTS (Clouds & Rain)
  // ========================================================
  private renderWeather(w: number, h: number): void {
    const ctx = this.ctx;

    // Céu mais escuro quando nublado, chuvoso ou com tempestade
    if (this.skyDim > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(15, 23, 42, ${this.skyDim})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // Nuvens: quantidade e densidade seguem a condição do tempo
    if (this.cloudLevel > 0) {
      const visible = Math.max(1, Math.round(this.clouds.length * Math.min(1, this.cloudLevel)));
      for (let i = 0; i < visible; i++) {
        const cloud = this.clouds[i];
        ctx.save();
        const gray = this.cloudLevel > 1 ? 150 : this.cloudLevel > 0.9 ? 215 : 255;
        ctx.fillStyle = `rgba(${gray}, ${gray}, ${gray}, ${Math.min(0.75, cloud.opacity * (0.6 + this.cloudLevel))})`;
        ctx.beginPath();
        const cx = cloud.x;
        const cy = cloud.y;
        const s = cloud.size;
        ctx.arc(cx, cy, s * 0.28, 0, Math.PI * 2);
        ctx.arc(cx + s * 0.22, cy - s * 0.08, s * 0.32, 0, Math.PI * 2);
        ctx.arc(cx + s * 0.45, cy, s * 0.24, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // Chuva: intensidade fraca, moderada ou forte
    if (this.isRaining) {
      ctx.save();
      const alpha = [0, 0.28, 0.38, 0.5][this.rainIntensity];
      ctx.strokeStyle = `rgba(186, 230, 253, ${alpha})`;
      ctx.lineWidth = this.rainIntensity === 3 ? 1.6 : 1.2;
      const slant = this.weather?.windKmh ? Math.min(0.6, 0.15 + this.weather.windKmh / 80) : 0.28;
      const active = Math.floor(this.rainDrops.length * [0, 0.3, 0.65, 1][this.rainIntensity]);
      for (let i = 0; i < active; i++) {
        const drop = this.rainDrops[i];
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - drop.length * slant, drop.y + drop.length);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ========================================================
  // CLIMA DO MOMENTO (real, com correção do produtor)
  // ========================================================
  private weatherLatLng(): { lat: number; lng: number } {
    return { lat: this.centerLat, lng: this.centerLng };
  }

  /** Atualiza o clima: usa a melhor fonte disponível e redesenha a cena. */
  public async refreshWeather(): Promise<void> {
    const { lat, lng } = this.weatherLatLng();
    const firstNasa = Object.values(this.nasaSeries)[0];
    const w = await resolveWeather(lat, lng, firstNasa, this.farmData.referenceDate || new Date().toISOString().slice(0, 10));
    this.applyWeather(w);
  }

  private applyWeather(w: WeatherState): void {
    this.weather = w;
    const c = w.cond;
    this.isRaining = c === 'rain' || c === 'storm';
    this.rainIntensity = this.isRaining ? Math.max(1, w.intensity) : 0;
    this.cloudLevel = c === 'clear' ? 0.2 : c === 'partly' ? 0.5 : c === 'cloudy' ? 1 : c === 'rain' ? 1 : 1.2;
    this.skyDim = c === 'clear' ? 0 : c === 'partly' ? 0.03 : c === 'cloudy' ? 0.12 : c === 'rain' ? 0.2 : 0.32;
    this.renderWeatherPanel();
    this.render();
  }

  private renderWeatherPanel(): void {
    const w = this.weather;
    if (!w) return;
    const icon: Record<Condition, string> = { clear: '☀️', partly: '⛅', cloudy: '☁️', rain: '🌧️', storm: '⛈️' };
    const setText = (id: string, v: string) => { const el = document.getElementById(id); if (el) el.innerText = v; };
    setText('game-weather-icon', icon[w.cond]);
    setText('game-weather-temp', w.tempC !== null ? `${Math.round(w.tempC)}°C` : '--°C');
    const inten = w.cond === 'rain' || w.cond === 'storm' ? ` (${wt(['', 'light', 'moderate', 'heavy'][Math.max(1, w.intensity)])})` : '';
    setText('game-weather-desc', wt(w.cond) + (w.cond === 'rain' ? inten : ''));
    const dash = (v: number | null, unit: string) => (v === null ? '—' : `${Math.round(v * 10) / 10} ${unit}`);
    const metrics = document.getElementById('game-weather-metrics');
    if (metrics) {
      metrics.innerHTML = `<span>${wt('rainLbl')}: <strong>${dash(w.rainMm, 'mm')}</strong></span> • <span>${wt('humLbl')}: <strong>${w.humidity === null ? '—' : Math.round(w.humidity) + '%'}</strong></span> • <span>${wt('windLbl')}: <strong>${dash(w.windKmh, 'km/h')}</strong></span>`;
    }
    const src = w.source === 'openmeteo' ? wt('srcOpenMeteo') : w.source === 'nasa' ? wt('srcNasa', { d: w.note || '' }) : w.source === 'manual' ? wt('srcManual') : wt('srcEstimate');
    setText('game-weather-src', (w.source === 'nasa' ? '🛰️ ' : '') + src);
    const fixBtn = document.getElementById('btn-weather-fix');
    if (fixBtn) fixBtn.title = wt('fix');
    // chip sempre visível
    setText('chip-weather-icon', icon[w.cond]);
    setText('chip-weather-temp', w.tempC !== null ? `${Math.round(w.tempC)}°C` : '--°C');
    setText('chip-weather-desc', wt(w.cond));
    const cm = document.getElementById('chip-weather-metrics');
    if (cm && metrics) cm.innerHTML = metrics.innerHTML;
    setText('chip-weather-src', (w.source === 'nasa' ? '🛰️ ' : '') + src);
  }

  private toggleWeatherChip(): void {
    const pop = document.getElementById('weather-chip-pop');
    if (!pop) return;
    const open = pop.style.display === 'none';
    pop.style.display = open ? 'block' : 'none';
    if (open) {
      const fx = document.getElementById('chip-weather-fix');
      if (fx) {
        fx.innerHTML = '<div class="weather-fix-pop" id="chip-fix-inner" style="display:none;position:static;box-shadow:none;margin-top:6px"></div><button type="button" class="wfix-open" id="chip-fix-open">✏️ ' + wt('fix') + '</button>';
        document.getElementById('chip-fix-open')?.addEventListener('click', () => this.openWeatherFix('chip-fix-inner'));
      }
    }
  }

  private openWeatherFix(popId = 'game-weather-fix'): void {
    const pop = document.getElementById(popId);
    if (!pop) return;
    if (pop.style.display !== 'none') { pop.style.display = 'none'; return; }
    const opts: [Condition, string][] = [['clear', '☀️'], ['partly', '⛅'], ['cloudy', '☁️'], ['rain', '🌧️'], ['storm', '⛈️']];
    pop.innerHTML = `<div class="wfix-title">${wt('fixTitle')}</div>
      <div class="wfix-row">${opts.map(([c, i]) => `<button type="button" data-wx="${c}" title="${wt(c)}">${i}<span>${wt(c)}</span></button>`).join('')}</div>
      <button type="button" class="wfix-auto" data-wx="auto">↺ ${wt('auto')}</button>`;
    pop.style.display = 'block';
    pop.querySelectorAll<HTMLButtonElement>('[data-wx]').forEach((b) => {
      b.onclick = () => {
        const v = b.dataset.wx!;
        if (v === 'auto') { clearOverride(); void this.refreshWeather(); }
        else {
          setOverride(v as Condition);
          this.applyWeather({ cond: v as Condition, intensity: v === 'storm' ? 3 : v === 'rain' ? 2 : 0, tempC: null, humidity: null, windKmh: null, rainMm: null, source: 'manual', at: Date.now() });
        }
        pop.style.display = 'none';
      };
    });
  }

  // ========================================================
  // HOVER / TOUCH INTERACTIVE TOOLTIPS WITH CLEAR OUTLINE
  // ========================================================
  private renderHoverTooltips(): void {
    const ctx = this.ctx;

    // Structure hover tooltip
    if (this.hoveredElement) {
      const wp = this.hoveredElement;
      const sp = this.worldToScreen(wp.coordinates[0], wp.coordinates[1]);
      const meta = FARM_ELEMENT_META[wp.type as keyof typeof FARM_ELEMENT_META];
      const icon = meta ? meta.icon : '📍';
      const label = `${icon} ${wp.name.replace(' [Exemplo]', '')}`;

      this.drawHighContrastTooltip(ctx, sp.x, sp.y - 36, label, t('tapForDetails'));
      return;
    }

    // Talhão hover tooltip
    if (this.hoveredTalhao) {
      const tObj = this.hoveredTalhao;
      const refDate = this.farmData.referenceDate || '2026-11-09';
      const cropStatus = calculateTalhaoCropStatus(tObj, refDate);

      // Centroid
      const screenPts = tObj.coordinates.map(([lat, lng]) => this.worldToScreen(lat, lng));
      let cX = 0;
      let cY = 0;
      screenPts.forEach((p) => {
        cX += p.x;
        cY += p.y;
      });
      cX /= screenPts.length;
      cY /= screenPts.length;

      const title = `${tObj.name.replace(' [Exemplo]', '')} • ${formatHectares(tObj.areaHectares)}`;
      const cropName = translateCropName(tObj.crop);
      const phaseName = translateCropPhase(cropStatus.phase.key);
      const sub = `${cropName} • ${phaseName} (${cropStatus.progressPercent}%)`;
      this.drawHighContrastTooltip(ctx, cX, cY - 32, title, sub);
    }
  }

  private drawHighContrastTooltip(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    title: string,
    subtitle: string
  ): void {
    ctx.save();
    ctx.font = 'bold 13px sans-serif';
    const w1 = ctx.measureText(title).width;
    ctx.font = '11px sans-serif';
    const w2 = ctx.measureText(subtitle).width;
    const boxW = Math.max(w1, w2) + 24;
    const boxH = 44;

    ctx.translate(x, y);

    // Dark pill with green outline
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.shadowColor = 'transparent';

    // Clear stroke for absolute readability over ground
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 13px sans-serif';
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 3;
    ctx.strokeText(title, 0, -8);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, 0, -8);

    ctx.font = '11px sans-serif';
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 2.5;
    ctx.strokeText(subtitle, 0, 9);
    ctx.fillStyle = '#86efac'; // soft lime
    ctx.fillText(subtitle, 0, 9);

    ctx.restore();
  }

  // ========================================================
  // TALHÃO DETAIL SHEET (MODAL DE GESTÃO)
  // ========================================================
  public openTalhaoSheet(talhao: Talhao): void {
    const sheet = document.getElementById('game-talhao-sheet');
    if (!sheet) return;

    const refDate = this.farmData.referenceDate || '2026-11-09';
    const cropStatus = calculateTalhaoCropStatus(talhao, refDate);

    // Title & Crop info
    const nameEl = document.getElementById('sheet-talhao-name');
    const cropEl = document.getElementById('sheet-crop-name');
    const cultivarEl = document.getElementById('sheet-cultivar-name');
    const iconEl = document.getElementById('sheet-crop-icon');

    if (nameEl) nameEl.innerText = talhao.name;
    if (cropEl) cropEl.innerText = translateCropName(talhao.crop);
    if (cultivarEl) cultivarEl.innerText = talhao.cultivar ? `Cultivar: ${talhao.cultivar}` : t('defaultCultivar');

    if (iconEl) {
      const lower = (talhao.crop || '').toLowerCase();
      if (lower.includes('soja')) iconEl.innerText = '🌿';
      else if (lower.includes('milho')) iconEl.innerText = '🌽';
      else if (lower.includes('pasto')) iconEl.innerText = '🐂';
      else iconEl.innerText = '🌱';
    }

    // Hero highlights
    const areaEl = document.getElementById('sheet-area-ha');
    const phaseEl = document.getElementById('sheet-phase-text');
    if (areaEl) areaEl.innerText = formatHectaresI18n(talhao.areaHectares);
    if (phaseEl) phaseEl.innerText = `${cropStatus.phase.icon} ${translateCropPhase(cropStatus.phase.key)}`;

    // Dates & Cycle
    const plantEl = document.getElementById('sheet-planting-date');
    const cycleEl = document.getElementById('sheet-cycle-days');
    const harvestEl = document.getElementById('sheet-harvest-date');
    const nextEl = document.getElementById('sheet-next-crop');

    if (plantEl) plantEl.innerText = talhao.plantingDate ? formatDateI18n(talhao.plantingDate) : t('notInformed');
    if (cycleEl) cycleEl.innerText = talhao.cycleDays ? `${formatNumber(talhao.cycleDays, 0)} ${t('days')}` : t('perennialNoCycle');
    if (harvestEl) harvestEl.innerText = cropStatus.expectedHarvest ? formatDateI18n(cropStatus.expectedHarvest) : t('notInformed');
    if (nextEl) {
      if (talhao.nextCropPlan) {
        const nextCropTranslated = translateCropName(talhao.nextCropPlan.crop);
        nextEl.innerText = `${nextCropTranslated} (${formatDateI18n(talhao.nextCropPlan.plannedPlanting)})`;
      } else {
        nextEl.innerText = t('toPlan');
      }
    }

    // History list
    const historyListEl = document.getElementById('sheet-history-list');
    if (historyListEl) {
      if (talhao.harvestHistory && talhao.harvestHistory.length > 0) {
        historyListEl.innerHTML = talhao.harvestHistory
          .map(
            (h) => `
          <div class="history-item-row">
            <div style="font-weight: 700; color: #fff;">${h.season} • ${translateCropName(h.crop)}</div>
            <div style="color: #94a3b8; font-size: 13px;">${t('harvestHistoryTitle')}: ${h.harvestDate} ${h.yieldText ? `• <strong>${h.yieldText}</strong>` : ''}</div>
            ${h.notes ? `<div style="font-size: 12px; color: #cbd5e1; margin-top: 2px;">${h.notes}</div>` : ''}
          </div>
        `
          )
          .join('');
      } else {
        historyListEl.innerHTML = `<div style="color: #94a3b8; font-size: 13px;">${t('noHistoryYet')}</div>`;
      }
    }

    this.sheetTalhaoId = talhao.id;
    this.diaryFormOpen = false;
    this.renderDiary();
    this.loadNasaPanel(talhao, false);

    // Notice
    const noticeEl = document.getElementById('sheet-simple-notice');
    if (noticeEl) {
      noticeEl.innerText = `💡 ${cropStatus.statusText}`;
    }

    // Phases Track in Sheet
    const progressTextEl = document.getElementById('sheet-track-progress-text');
    if (progressTextEl) {
      if (cropStatus.isPasture) {
        progressTextEl.innerText = t('continuousPasture');
      } else if (talhao.cycleDays && cropStatus.daysPassed > 0) {
        progressTextEl.innerText = `${t('dayProgress', { day: formatNumber(cropStatus.daysPassed, 0), total: formatNumber(talhao.cycleDays, 0) })} (${formatNumber(cropStatus.progressPercent, 0)}%)`;
      } else {
        progressTextEl.innerText = cropStatus.statusText;
      }
    }

    const currentPhaseKey = cropStatus.phase.key;
    const phaseOrder = ['preparo', 'plantio', 'crescimento', 'floracao', 'enchimento', 'colheita'];
    const currentPhaseIndex = phaseOrder.indexOf(currentPhaseKey);

    const stepElements = sheet.querySelectorAll('.sheet-track-step');
    stepElements.forEach((el) => {
      const stepPhase = el.getAttribute('data-phase');
      const stepIndex = phaseOrder.indexOf(stepPhase || '');
      el.classList.remove('active', 'passed', 'future');

      if (cropStatus.isPasture) {
        el.classList.add(stepPhase === 'crescimento' ? 'active' : 'passed');
      } else if (currentPhaseIndex >= 0 && stepIndex >= 0) {
        if (stepIndex < currentPhaseIndex) {
          el.classList.add('passed');
        } else if (stepIndex === currentPhaseIndex) {
          el.classList.add('active');
        } else {
          el.classList.add('future');
        }
      }
    });

    sheet.style.display = 'flex';
  }

  // ========================================================
  // DADOS DA NASA (POWER)
  // ========================================================
  /** Série NASA já carregada para o talhão (usada pelo agrônomo e pela previsão). */
  public getNasaSeries(talhaoId: string): NasaSeries | undefined {
    return this.nasaSeries[talhaoId];
  }

  private loadNasaPanel(talhao: Talhao, force: boolean): void {
    const body = document.getElementById('sheet-nasa-body');
    const periodEl = document.getElementById('sheet-nasa-period');
    const refreshBtn = document.getElementById('btn-nasa-refresh');
    if (!body || !periodEl || !refreshBtn) return;
    const token = ++this.nasaToken;
    refreshBtn.onclick = () => this.loadNasaPanel(talhao, true);
    periodEl.textContent = '';
    const tiagoBox = document.getElementById('sheet-tiago-box');
    if (tiagoBox) tiagoBox.style.display = 'none';
    body.innerHTML = `<div class="nasa-msg">⏳ ${t('nasaLoading')}</div>`;

    const c = polygonCentroid(talhao.coordinates);
    const ref = this.farmData.referenceDate || '2026-11-09';
    fetchNasaSeries(c.lat, c.lng, ref, 30, force)
      .then((series) => {
        if (token !== this.nasaToken) return;
        this.nasaSeries[talhao.id] = series;
        this.renderNasaPanel(series);
        this.renderEstelaBox(talhao);
        this.updateAgronomistSpeech();
        fetchModelForecast(talhao, summarizeNasa(series)).then((v) => {
          if (v !== null && token === this.nasaToken) {
            this.modelForecast[talhao.id] = v;
            this.renderForecastBox(talhao);
          }
        });
      })
      .catch(() => {
        if (token !== this.nasaToken) return;
        body.innerHTML = `
          <div class="nasa-msg nasa-msg-error">${t('nasaError')}</div>
          <button type="button" class="diary-btn-ghost" id="btn-nasa-retry">${t('nasaRetry')}</button>`;
        (document.getElementById('btn-nasa-retry') as HTMLElement).onclick = () => this.loadNasaPanel(talhao, true);
      });
  }

  /** Previsão de produtividade e comparação com as colheitas registradas no diário. */
  private renderForecastBox(talhao: Talhao): void {
    const box = document.getElementById('sheet-forecast-box');
    if (!box) return;
    const ref = this.farmData.referenceDate || '2026-11-09';
    if (calculateTalhaoCropStatus(talhao, ref).isPasture) {
      box.style.display = 'none';
      return;
    }
    const f = currentForecast(talhao, this.modelForecast[talhao.id] ?? null);
    const results = compareResults(talhao);
    const tk = (k: string, p?: Record<string, string | number>) => t(k as keyof TranslationDictionary, p);

    const forecastHtml =
      f.value === null
        ? `<div class="nasa-msg">${t('fcNoBase')}</div>`
        : `<div class="fc-main">
             <div class="fc-value">${formatNumber(f.value, 1)} <span class="fc-unit">sc/ha</span></div>
             <div class="fc-total">${t('fcTotal', { sacks: formatNumber(f.totalSacks || 0, 0), ha: formatHectaresI18n(talhao.areaHectares) })}</div>
           </div>
           <div class="fc-source">${f.source === 'model' ? t('fcSourceModel') : t('fcSourceBaseline', { n: f.basedOn })}</div>`;

    const resultsHtml =
      results.length === 0
        ? `<div class="nasa-msg">${t('fcNoResult')}</div>`
        : [...results]
            .reverse()
            .map((r) => {
              const err =
                r.errorPct === null
                  ? `<span class="fc-err">${t('fcNoCompare')}</span>`
                  : `<span class="fc-err ${r.errorPct >= 0 ? 'fc-up' : 'fc-down'}">${tk(r.errorPct >= 0 ? 'fcErrorUp' : 'fcErrorDown', { pct: formatNumber(Math.abs(r.errorPct), 1) })}</span>`;
              const learned =
                r.forecastBefore !== null
                  ? `<div class="fc-learned">🔁 ${t('fcLearned', { from: formatNumber(r.forecastBefore, 1), to: formatNumber(r.baselineAfter, 1) })}</div>`
                  : '';
              return `<div class="fc-row">
                <div class="fc-row-top"><strong>${formatDateI18n(r.point.date)}</strong> • ${t('fcActual')}: <strong>${formatNumber(r.point.value, 1)} sc/ha</strong>${r.forecastBefore !== null ? ` • ${t('fcPredicted')}: ${formatNumber(r.forecastBefore, 1)} sc/ha` : ''}</div>
                ${err}${learned}
              </div>`;
            })
            .join('');

    box.style.display = 'block';
    box.innerHTML = `
      <div class="history-title">🎯 ${t('fcTitle')}</div>
      <div class="diary-field-label" style="margin-top:0">${t('fcForecast')}</div>
      ${forecastHtml}
      <div class="diary-field-label">${t('fcResults')}</div>
      ${resultsHtml}`;
  }

  private riskLevelLabel(l: RiskLevel): string {
    return t(l === 'low' ? 'agLevelLow' : l === 'medium' ? 'agLevelMedium' : 'agLevelHigh');
  }

  /** Recomendação do Engª. Estela no talhão: risco de plantio (7 dias) e alertas da lavoura. */
  private renderEstelaBox(talhao: Talhao): void {
    const box = document.getElementById('sheet-tiago-box');
    const series = this.nasaSeries[talhao.id];
    if (!box) return;
    if (!series || calculateTalhaoCropStatus(talhao, this.farmData.referenceDate || '2026-11-09').isPasture) {
      box.style.display = 'none';
      return;
    }
    const ref = this.farmData.referenceDate || '2026-11-09';
    const phase = calculateTalhaoCropStatus(talhao, ref).phase.key;
    const inCycle = !!talhao.plantingDate && phase !== 'preparo';
    const a = assessPlanting(series, ref, talhao.diary, inCycle);
    const alerts = assessCrop(series, phase, talhao.diary, ref);
    const icon = (s: Severity) => (s === 0 ? '✅' : s === 1 ? '⚠️' : '⛔');
    const adviceKey = inCycle
      ? a.level === 'low' ? 'agCropAdviceLow' : a.level === 'medium' ? 'agCropAdviceMedium' : 'agCropAdviceHigh'
      : a.level === 'low' ? 'agAdviceLow' : a.level === 'medium' ? 'agAdviceMedium' : 'agAdviceHigh';
    const tk = (k: string, p?: Record<string, string | number>) => t(k as keyof TranslationDictionary, p);
    box.style.display = 'block';
    box.innerHTML = `
      <div class="tiago-head">
        <div class="history-title" style="margin:0">🧑‍🌾 ${t(inCycle ? 'agTitleCrop' : 'agTitle')}</div>
        <span class="tiago-badge tiago-${a.level}">${this.riskLevelLabel(a.level)}</span>
      </div>
      <div class="tiago-advice">${t(adviceKey)}</div>
      <ul class="tiago-factors">
        ${a.factors.map((f) => `<li>${icon(f.severity)} ${tk(f.key, f.params)}</li>`).join('')}
      </ul>
      ${alerts.map((al) => `<div class="tiago-alert">🚨 ${tk(al.key, al.params)}</div>`).join('')}
      <div class="nasa-source">${t('agBasis')}</div>`;
  }

  /** Carrega em segundo plano a série NASA de todos os talhões (para as falas do agrônomo). */
  private preloadNasaForAll(): void {
    const ref = this.farmData.referenceDate || '2026-11-09';
    this.farmData.talhoes.forEach((tl) => {
      if (this.nasaSeries[tl.id] || !tl.coordinates || tl.coordinates.length < 3) return;
      const c = polygonCentroid(tl.coordinates);
      fetchNasaSeries(c.lat, c.lng, ref, 30)
        .then((s) => {
          this.nasaSeries[tl.id] = s;
          this.updateAgronomistSpeech();
        })
        .catch(() => {
          /* sem internet: o agrônomo segue com as falas padrão */
        });
    });
  }

  private renderNasaPanel(series: NasaSeries): void {
    const body = document.getElementById('sheet-nasa-body');
    const periodEl = document.getElementById('sheet-nasa-period');
    if (!body || !periodEl) return;
    periodEl.textContent = t('nasaPeriod', { end: formatDateI18n(series.end) });
    const s = summarizeNasa(series);
    if (s.daysWithData === 0) {
      body.innerHTML = `<div class="nasa-msg">${t('nasaNoData')}</div>`;
      return;
    }
    const f1 = (v: number | null, suffix: string) => (v === null ? '—' : `${formatNumber(v, 1)}${suffix}`);
    const tile = (label: string, value: string) =>
      `<div class="nasa-tile"><span class="nasa-tile-label">${label}</span><strong class="nasa-tile-val">${value}</strong></div>`;

    // Gráfico de barras: chuva diária
    const days = series.days;
    const maxRain = Math.max(10, ...days.map((d) => d.rain ?? 0));
    const W = 300;
    const H = 70;
    const bw = W / days.length;
    const bars = days
      .map((d, i) => {
        const h = d.rain === null ? 0 : Math.max(d.rain > 0 ? 1.5 : 0, (d.rain / maxRain) * (H - 6));
        const label = `${formatDateI18n(d.date)}: ${d.rain === null ? '—' : formatNumber(d.rain, 1) + ' mm'}`;
        return `<rect x="${(i * bw + 0.6).toFixed(2)}" y="${(H - h).toFixed(2)}" width="${Math.max(1, bw - 1.2).toFixed(2)}" height="${h.toFixed(2)}" rx="1" fill="${d.rain === null ? '#475569' : '#38bdf8'}"><title>${label}</title></rect>`;
      })
      .join('');

    body.innerHTML = `
      <div class="nasa-tiles">
        ${tile(t('nasaRain30'), f1(s.rainTotal, ' mm'))}
        ${tile(t('nasaRain7'), f1(s.rainLast7, ' mm'))}
        ${tile(t('nasaDryDays'), `${formatNumber(s.dryDays, 0)}`)}
        ${tile(t('nasaTempAvg'), f1(s.tavg, ' °C'))}
        ${tile(t('nasaTempRange'), `${f1(s.tminLow, '')} – ${f1(s.tmaxPeak, ' °C')}`)}
        ${tile(t('nasaRadiation'), f1(s.radAvg, ' MJ/m²'))}
      </div>
      <div class="nasa-chart-title">${t('nasaChartTitle')} • ${t('nasaDaysOfData', { n: formatNumber(s.daysWithData, 0) })}</div>
      <svg class="nasa-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${this.escapeHtmlText(t('nasaChartTitle'))}">
        <line x1="0" y1="${H - 0.5}" x2="${W}" y2="${H - 0.5}" stroke="#334155" stroke-width="1"/>
        ${bars}
      </svg>
      <div class="nasa-source">${t('nasaSource')}</div>`;
  }

  // ========================================================
  // DIÁRIO DE SAFRA
  // ========================================================
  private static readonly DIARY_TYPES: { key: DiaryEntryType; icon: string; unit?: string }[] = [
    { key: 'plantio', icon: '🌱' },
    { key: 'adubacao', icon: '🧪', unit: 'kg/ha' },
    { key: 'aplicacao', icon: '💧', unit: 'L/ha' },
    { key: 'irrigacao', icon: '🚿', unit: 'mm' },
    { key: 'chuva', icon: '🌧️', unit: 'mm' },
    { key: 'monitoramento', icon: '🔍' },
    { key: 'colheita', icon: '🚜', unit: 'sc/ha' },
    { key: 'observacao', icon: '📝' },
  ];

  private diaryTypeLabel(key: DiaryEntryType): string {
    const cap = key.charAt(0).toUpperCase() + key.slice(1);
    return t(('diaryType' + cap) as keyof TranslationDictionary);
  }

  private escapeHtmlText(s: string): string {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
  }

  private getSheetTalhao(): Talhao | undefined {
    return this.farmData.talhoes.find((x) => x.id === this.sheetTalhaoId);
  }

  private renderDiary(): void {
    const talhao = this.getSheetTalhao();
    const listEl = document.getElementById('sheet-diary-list');
    const formEl = document.getElementById('sheet-diary-form');
    const addBtn = document.getElementById('btn-diary-add');
    if (!talhao || !listEl || !formEl || !addBtn) return;

    this.renderForecastBox(talhao);

    addBtn.onclick = () => {
      this.diaryFormOpen = !this.diaryFormOpen;
      this.renderDiary();
    };

    // Lista (mais recente primeiro)
    const entries = [...(talhao.diary || [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    if (entries.length === 0) {
      listEl.innerHTML = `<div style="color:#94a3b8;font-size:13px;">${t('diaryEmpty')}</div>`;
    } else {
      listEl.innerHTML = entries
        .map((e) => {
          const meta = FarmGameView.DIARY_TYPES.find((x) => x.key === e.type);
          const amount =
            e.amount !== undefined && meta?.unit ? ` • <strong>${formatNumber(e.amount, 1)} ${meta.unit}</strong>` : '';
          const note = e.note ? `<div class="diary-note">${this.escapeHtmlText(e.note)}</div>` : '';
          return `
          <div class="diary-row">
            <div class="diary-row-main">
              <div class="diary-row-title">${meta?.icon || '📝'} ${this.diaryTypeLabel(e.type)}${amount}</div>
              <div class="diary-row-date">${formatDateI18n(e.date)}</div>
              ${note}
            </div>
            <button type="button" class="diary-del-btn" data-diary-del="${e.id}" title="${this.escapeHtmlText(t('diaryDelete'))}">🗑️</button>
          </div>`;
        })
        .join('');
    }

    listEl.querySelectorAll<HTMLButtonElement>('[data-diary-del]').forEach((btn) => {
      btn.onclick = () => {
        if (btn.dataset.armed !== '1') {
          btn.dataset.armed = '1';
          btn.classList.add('armed');
          btn.textContent = t('diaryDeleteSure');
          setTimeout(() => {
            if (btn.isConnected) {
              btn.dataset.armed = '';
              btn.classList.remove('armed');
              btn.textContent = '🗑️';
            }
          }, 3000);
          return;
        }
        talhao.diary = (talhao.diary || []).filter((x) => x.id !== btn.dataset.diaryDel);
        this.callbacks.onTalhaoUpdated?.(talhao);
        this.renderDiary();
      };
    });

    // Formulário
    if (!this.diaryFormOpen) {
      formEl.style.display = 'none';
      formEl.innerHTML = '';
      return;
    }
    const today = this.farmData.referenceDate || '2026-11-09';
    formEl.style.display = 'block';
    formEl.innerHTML = `
      <div class="diary-field-label">${t('diaryType')}</div>
      <div class="diary-chips">
        ${FarmGameView.DIARY_TYPES.map(
          (x, i) =>
            `<button type="button" class="diary-chip${i === 0 ? ' active' : ''}" data-diary-type="${x.key}">${x.icon} ${this.diaryTypeLabel(x.key)}</button>`
        ).join('')}
      </div>
      <div class="diary-inline">
        <div class="diary-col">
          <label class="diary-field-label" for="diary-date">${t('diaryDate')}</label>
          <input id="diary-date" class="diary-input" type="date" value="${today}" />
        </div>
        <div class="diary-col" id="diary-amount-col" style="display:none">
          <label class="diary-field-label" for="diary-amount">${t('diaryAmount')} <span id="diary-unit"></span></label>
          <input id="diary-amount" class="diary-input" type="number" inputmode="decimal" min="0" step="any" />
        </div>
      </div>
      <label class="diary-field-label" for="diary-note">${t('diaryNote')}</label>
      <input id="diary-note" class="diary-input" type="text" maxlength="160" placeholder="${this.escapeHtmlText(t('diaryNotePh'))}" />
      <div class="diary-actions">
        <button type="button" class="diary-btn-ghost" id="diary-cancel">${t('diaryCancel')}</button>
        <button type="button" class="diary-btn-save" id="diary-save">✅ ${t('diarySave')}</button>
      </div>`;

    let selected: DiaryEntryType = 'plantio';
    const amountCol = formEl.querySelector('#diary-amount-col') as HTMLElement;
    const unitEl = formEl.querySelector('#diary-unit') as HTMLElement;
    const syncType = () => {
      const meta = FarmGameView.DIARY_TYPES.find((x) => x.key === selected);
      formEl.querySelectorAll<HTMLElement>('.diary-chip').forEach((c) => c.classList.toggle('active', c.dataset.diaryType === selected));
      amountCol.style.display = meta?.unit ? 'block' : 'none';
      unitEl.textContent = meta?.unit ? `(${meta.unit})` : '';
    };
    formEl.querySelectorAll<HTMLButtonElement>('.diary-chip').forEach((c) => {
      c.onclick = () => {
        selected = c.dataset.diaryType as DiaryEntryType;
        syncType();
      };
    });
    syncType();

    (formEl.querySelector('#diary-cancel') as HTMLElement).onclick = () => {
      this.diaryFormOpen = false;
      this.renderDiary();
    };
    (formEl.querySelector('#diary-save') as HTMLElement).onclick = () => {
      const date = (formEl.querySelector('#diary-date') as HTMLInputElement).value || today;
      const rawAmount = (formEl.querySelector('#diary-amount') as HTMLInputElement).value;
      const meta = FarmGameView.DIARY_TYPES.find((x) => x.key === selected);
      const amount = meta?.unit && rawAmount !== '' && isFinite(Number(rawAmount)) ? Number(rawAmount) : undefined;
      const note = (formEl.querySelector('#diary-note') as HTMLInputElement).value.trim();
      const entry: DiaryEntry = {
        id: 'diary_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        date,
        type: selected,
      };
      if (amount !== undefined) entry.amount = amount;
      if (note) entry.note = note;
      talhao.diary = [...(talhao.diary || []), entry];
      this.diaryFormOpen = false;
      this.callbacks.onTalhaoUpdated?.(talhao);
      this.renderDiary();
    };
  }

  public closeTalhaoSheet(): void {
    const sheet = document.getElementById('game-talhao-sheet');
    if (sheet) sheet.style.display = 'none';
  }

  public updateLanguage(): void {
    // 1. Left floating panel
    const panelTitle = document.getElementById('game-panel-title-text');
    const badgeExemplo = document.getElementById('game-panel-badge-exemplo');
    const btnToggle = document.getElementById('btn-toggle-left-panel');
    const weatherDesc = document.getElementById('game-weather-desc');
    const weatherMetrics = document.getElementById('game-weather-metrics');
    const legendCompact = document.getElementById('game-legend-compact');
    const legendStatusNote = document.getElementById('game-legend-status-note');

    if (panelTitle) panelTitle.innerText = t('weatherAndLegend');
    if (badgeExemplo) badgeExemplo.innerText = t('exampleBadge');
    if (btnToggle) btnToggle.title = t('collapseExpand');
    void weatherDesc; void weatherMetrics;
    this.renderWeatherPanel();

    if (legendCompact) {
      legendCompact.innerHTML = `
        <div class="legend-section-title">${t('cropColors')}</div>
        <div class="legend-pills-grid" style="grid-template-columns: repeat(2, 1fr);">
          <div class="legend-pill"><span class="legend-color-dot" style="background: #16a34a;"></span> ${translateCropName('Soja')}</div>
          <div class="legend-pill"><span class="legend-color-dot" style="background: #eab308;"></span> ${translateCropName('Milho')}</div>
          <div class="legend-pill"><span class="legend-color-dot" style="background: #65a30d;"></span> ${translateCropName('Pastagem')}</div>
          <div class="legend-pill"><span class="legend-color-dot" style="background: #9a3412;"></span> ${translateCropName('Feijão')}</div>
          <div class="legend-pill"><span class="legend-color-dot" style="background: #d97706;"></span> ${translateCropName('Sorgo')}</div>
          <div class="legend-pill"><span class="legend-color-dot" style="background: #0284c7;"></span> ${translateCropName('Algodão')}</div>
          <div class="legend-pill"><span class="legend-color-dot" style="background: #059669;"></span> ${translateCropName('Cana-de-açúcar')}</div>
          <div class="legend-pill"><span class="legend-color-dot" style="background: #ca8a04;"></span> ${translateCropName('Trigo')}</div>
          <div class="legend-pill"><span class="legend-color-dot" style="background: #64748b;"></span> ${t('withoutCrop')}</div>
        </div>

        <div class="legend-section-title" style="margin-top: 8px;">${t('ruralStructures')}</div>
        <div class="legend-pills-grid">
          <div class="legend-pill"><span>🏠</span> ${translateStructureType('sede')}</div>
          <div class="legend-pill"><span>🏭</span> ${translateStructureType('silo')}</div>
          <div class="legend-pill"><span>🐂</span> ${translateStructureType('curral')}</div>
          <div class="legend-pill"><span>📡</span> ${translateStructureType('estacao_meteo')}</div>
          <div class="legend-pill"><span>🌊</span> ${translateStructureType('acude')}</div>
          <div class="legend-pill"><span>🌳</span> ${translateStructureType('reserva')}</div>
        </div>

        <div class="legend-status-note" id="game-legend-status-note">
          <span class="status-glow-dot">●</span> ${t('legendStatusNote')}
        </div>
      `;
    } else if (legendStatusNote) {
      legendStatusNote.innerHTML = `<span class="status-glow-dot">●</span> ${t('legendStatusNote')}`;
    }

    // 2. Right HUD controls
    const btnZoomIn = document.getElementById('btn-game-zoom-in');
    const btnZoomOut = document.getElementById('btn-game-zoom-out');
    const btnResetView = document.getElementById('btn-game-reset-view');
    if (btnZoomIn) btnZoomIn.title = t('zoomIn');
    if (btnZoomOut) btnZoomOut.title = t('zoomOut');
    if (btnResetView) btnResetView.title = t('centerFarm');
    const btnMove = document.getElementById('btn-game-move-mode');
    if (btnMove) btnMove.title = t('moveModeBtn');

    // 3. Agronomist Card
    const speakerTitle = document.getElementById('game-agronomist-speaker-title');
    const btnMinAgronomist = document.getElementById('btn-minimize-agronomist');
    const btnAvatar = document.getElementById('btn-agronomist-avatar');
    if (speakerTitle) speakerTitle.innerText = t('agronomistTitle');
    if (btnMinAgronomist) btnMinAgronomist.title = t('minimize');
    if (btnAvatar) btnAvatar.title = t('tapForMoreAdvice');
    this.updateAgronomistSpeech();

    // 4. Talhão Sheet labels
    const lblArea = document.getElementById('lbl-sheet-area');
    const lblPhase = document.getElementById('lbl-sheet-phase');
    const lblState = document.getElementById('lbl-sheet-state');
    const lblTrackTitle = document.getElementById('lbl-sheet-track-title');
    const lblPlanting = document.getElementById('lbl-sheet-planting');
    const lblCycle = document.getElementById('lbl-sheet-cycle');
    const lblHarvest = document.getElementById('lbl-sheet-harvest');
    const lblNext = document.getElementById('lbl-sheet-next');
    const lblHistory = document.getElementById('lbl-sheet-history-title');
    const lblBtnMap = document.getElementById('lbl-btn-view-map');
    const lblBtnCal = document.getElementById('lbl-btn-crop-cal');

    if (lblArea) lblArea.innerText = t('sheetFieldArea');
    if (lblPhase) lblPhase.innerText = t('sheetCropPhase');
    if (lblState) lblState.innerText = t('sheetCropState');
    if (lblTrackTitle) lblTrackTitle.innerText = t('seasonTrackTitle');
    if (lblPlanting) lblPlanting.innerText = `${t('plantingDate')}:`;
    if (lblCycle) lblCycle.innerText = `${t('cropCycle')}:`;
    if (lblHarvest) lblHarvest.innerText = `${t('harvestForecast')}:`;
    if (lblNext) lblNext.innerText = `${t('nextCrop')}:`;
    if (lblHistory) lblHistory.innerText = `📜 ${t('harvestHistoryTitle')}`;
    if (lblBtnMap) lblBtnMap.innerText = t('viewOnRealMap');
    if (lblBtnCal) lblBtnCal.innerText = t('cropCalendar');

    // Track steps labels
    const phaseOrder = ['preparo', 'plantio', 'crescimento', 'floracao', 'enchimento', 'colheita'];
    document.querySelectorAll('.sheet-track-step').forEach((el) => {
      const stepPhase = el.getAttribute('data-phase');
      const labelEl = el.querySelector('.sheet-track-label');
      if (stepPhase && labelEl) {
        labelEl.textContent = translateCropPhase(stepPhase);
      }
    });

    // Re-render canvas for hover tooltips
    this.render();
  }

  public dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}
