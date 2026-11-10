import { FarmData, Talhao, WaterPoint, WaterPointType, TALHAO_COLORS, WATER_POINT_META, FARM_ELEMENT_META, CropPhaseKey, CROP_PHASE_META } from './types';
import { calculatePolygonAreaHectares, calculatePerimeterKm, formatHectares, parseGeoJSON, parseKML, exportToGeoJSON, exportToKML, getPaletteColor } from './utils/geo';
import { loadFarmData, saveFarmData, resetToDemoFarm, clearAllFarmData } from './utils/storage';
import { MapManager } from './components/MapManager';
import { CoordinateRow, parseCoordinatePair, parsePastedCoordinateText, validateCoordinate } from './utils/coordinateParser';
import { DEFAULT_REFERENCE_DATE, formatBrDateWithWeekday, formatBrDateShort, addDaysToDate, calculateTalhaoCropStatus, calculateExpectedHarvestDate, checkCropDatesOverlap, getCropColor, DEFAULT_CROP_CYCLES } from './utils/cropCalendar';
import { FarmGameView } from './components/FarmGameView';
import { requireAuth } from './auth/loginScreen';
import { currentUser, logout } from './auth/auth';
import { at } from './auth/authText';
import {
  getCurrentLanguage,
  setLanguage,
  onLanguageChange,
  t,
  formatNumber,
  formatHectaresI18n,
  formatKmI18n,
  formatDateI18n,
  formatDateShortI18n,
  formatDateWithWeekdayI18n,
  translateCropName,
  translateCropPhase,
  translateStructureType,
  LanguageCode,
} from './i18n';

class AgroApp {
  private farmData: FarmData;
  private mapManager!: MapManager;

  // View mode & Agricultural calendar
  private referenceDate = DEFAULT_REFERENCE_DATE;
  private activeViewMode: 'mapa' | 'fazenda' = 'mapa';
  private farmGameView: FarmGameView | null = null;
  private calendarModalTalhaoId: string | null = null;

  // Pending creation state
  private pendingTalhaoCoords: [number, number][] = [];
  private pendingTalhaoArea = 0;
  private pendingTalhaoPerimeter = 0;
  private editingTalhaoId: string | null = null;
  private selectedTalhaoColor = '#16a34a';

  // Queue for opening imported talhoes one by one
  private importedTalhoesQueue: Talhao[] = [];

  private pendingWaterCoords: [number, number] | null = null;
  private selectedWaterType: WaterPointType = 'nascente';

  // Coordinate Table Rows State
  private coordsTableRows: CoordinateRow[] = [];

  constructor() {
    this.farmData = loadFarmData();
    this.referenceDate = this.farmData.referenceDate || DEFAULT_REFERENCE_DATE;
    this.activeViewMode = this.farmData.activeViewMode || 'mapa';

    this.renderDOM();
    this.initMap();
    this.initGameMode();
    this.bindEvents();
    this.updateUI();

    window.addEventListener('resize', () => {
      if (this.activeViewMode === 'fazenda') {
        this.farmGameView?.resize();
      }
    });

    if (this.activeViewMode === 'fazenda') {
      this.switchViewMode('fazenda');
    }
  }

  private renderDOM(): void {
    const app = document.getElementById('app');
    if (!app) return;

    app.innerHTML = `
      <!-- Single Vertical Top Container (Flex Column, in-flow, non-overlapping) -->
      <div class="top-nav-stack" id="top-nav-stack">
        <!-- Top Navigation Bar -->
        <header class="top-nav">
          <div class="brand-section">
            <div class="brand-logo-wrapper">
              <img src="/assets/aistudio/image_5d97730a.png" alt="MyRoça Logo" class="brand-logo-img" />
            </div>
            <div class="brand-text-group">
              <div class="brand-title">
                <span class="brand-my">My</span><span class="brand-roca">Roça</span>
              </div>
              <div class="brand-subtitle">Rio Verde • GO</div>
            </div>
          </div>

          <!-- Mode Switcher: Mapa Real vs Minha Fazenda -->
          <div class="mode-switcher-container">
            <button class="mode-switch-btn ${this.activeViewMode === 'mapa' ? 'active' : ''}" id="btn-mode-mapa" title="${t('realMap')}">
              <span>🗺️</span> <span class="btn-text" id="lbl-mode-mapa">${t('realMap')}</span>
            </button>
            <button class="mode-switch-btn fazenda-mode ${this.activeViewMode === 'fazenda' ? 'active' : ''}" id="btn-mode-fazenda" title="${t('myFarm')}">
              <span>🚜</span> <span class="btn-text" id="lbl-mode-fazenda">${t('myFarm')}</span>
            </button>
          </div>

          <!-- Metric Pills -->
          <div class="stats-group">
            <div class="stat-pill" title="${t('fields')}">
              <span id="lbl-stat-talhoes">${t('fields')}:</span>
              <strong id="stat-talhoes-count">0</strong>
            </div>
            <div class="stat-pill stat-area" title="${t('totalArea')}">
              <span id="lbl-stat-area">${t('totalArea')}:</span>
              <strong id="stat-total-hectares">0,00 ha</strong>
            </div>
            <div class="stat-pill stat-water" title="${t('structuresAndWater')}">
              <span id="lbl-stat-water">${t('structuresAndWater')}:</span>
              <strong id="stat-water-count">0</strong>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="nav-actions">
            <div class="dropdown-container">
              <button class="btn btn-primary" id="btn-talhao-dropdown" title="${t('newField')}">
                <span>🌱</span> <span class="btn-text" id="lbl-btn-new-field">${t('newField')} ▾</span>
              </button>
              <div class="dropdown-menu" id="talhao-menu">
                <button class="dropdown-item" id="opt-draw-talhao">
                  <span>✏️</span> <span id="lbl-opt-draw-talhao">${t('drawOnMap')}</span>
                </button>
                <button class="dropdown-item" id="opt-type-coords-talhao">
                  <span>🔢</span> <span id="lbl-opt-type-coords">${t('typeCoords')}</span>
                </button>
              </div>
            </div>

            <div class="dropdown-container">
              <button class="btn btn-water" id="btn-water-dropdown" title="${t('structures')}">
                <span>📍</span> <span class="btn-text" id="lbl-btn-structures">${t('structures')} ▾</span>
              </button>
              <div class="dropdown-menu" id="water-menu" style="min-width: 250px;">
                <div style="font-size: 11px; font-weight: 800; color: #94a3b8; padding: 6px 12px; text-transform: uppercase;" id="lbl-header-rural-struct">${t('ruralStructures')}</div>
                <button class="dropdown-item" data-type="sede"><span>🏠</span> <span class="water-menu-item-text">${t('markSede')}</span></button>
                <button class="dropdown-item" data-type="curral"><span>🐂</span> <span class="water-menu-item-text">${t('markCurral')}</span></button>
                <button class="dropdown-item" data-type="silo"><span>🏭</span> <span class="water-menu-item-text">${t('markSilo')}</span></button>
                <button class="dropdown-item" data-type="estrada"><span>🛣️</span> <span class="water-menu-item-text">${t('markEstrada')}</span></button>
                <button class="dropdown-item" data-type="reserva"><span>🌳</span> <span class="water-menu-item-text">${t('markReserva')}</span></button>
                <button class="dropdown-item" data-type="pivo"><span>🔄</span> <span class="water-menu-item-text">${t('markPivo')}</span></button>
                <button class="dropdown-item" data-type="estacao_meteo"><span>📡</span> <span class="water-menu-item-text">${t('markEstacao')}</span></button>
                <div style="font-size: 11px; font-weight: 800; color: #38bdf8; padding: 6px 12px; text-transform: uppercase; border-top: 1px solid var(--border-color); margin-top: 4px;" id="lbl-header-water-res">${t('waterResources')}</div>
                <button class="dropdown-item" data-type="nascente"><span>💧</span> <span class="water-menu-item-text">${t('markNascente')}</span></button>
                <button class="dropdown-item" data-type="acude"><span>🌊</span> <span class="water-menu-item-text">${t('markAcude')}</span></button>
                <button class="dropdown-item" data-type="poco"><span>🚰</span> <span class="water-menu-item-text">${t('markPoco')}</span></button>
                <button class="dropdown-item" data-type="rio"><span>🏞️</span> <span class="water-menu-item-text">${t('markRio')}</span></button>
                <div style="border-top: 1px solid var(--border-color); margin: 4px 0;"></div>
                <button class="dropdown-item" id="opt-type-coords-water"><span>🔢</span> <span id="lbl-opt-type-coords-water">${t('typePointCoords')}</span></button>
              </div>
            </div>

            <!-- Secondary Actions Grouped in 'Mais ▾' Dropdown -->
            <div class="dropdown-container">
              <button class="btn btn-outline" id="btn-more-dropdown" title="${t('more')}">
                <span>⚙️</span> <span class="btn-text" id="lbl-btn-more">${t('more')} ▾</span>
              </button>
              <div class="dropdown-menu dropdown-menu-right" id="more-menu" style="min-width: 220px;">
                <button class="dropdown-item" id="btn-open-import" title="${t('uploadMapFile')}">
                  <span>📂</span> <span id="lbl-opt-import">${t('uploadMapFile')}</span>
                </button>
                <button class="dropdown-item" id="btn-open-export" title="${t('exportData')}">
                  <span>💾</span> <span id="lbl-opt-export">${t('exportData')}</span>
                </button>
                <button class="dropdown-item" id="btn-toggle-drawer" title="${t('farmDashboard')}">
                  <span>📋</span> <span id="lbl-opt-drawer">${t('farmDashboard')}</span>
                </button>
                <button class="dropdown-item" id="btn-center-farm" title="${t('centerMap')}">
                  <span>🎯</span> <span id="lbl-opt-center">${t('centerMap')}</span>
                </button>
              </div>
            </div>

            <button class="btn btn-outline btn-logout-user" id="btn-logout" title="${at('logout')}">
              <span>👤</span> <span class="btn-text">${(currentUser()?.id === 'guest' ? at('guestName') : (currentUser()?.name || '')).split(' ')[0].replace(/[&<>"']/g, '')}</span> <span>⎋</span>
            </button>

            <!-- Language Selector Dropdown -->
            <div class="dropdown-container">
              <button class="btn btn-outline" id="btn-lang-dropdown" title="${t('language')}">
                <span>🌐</span> <span class="btn-text" id="current-lang-code">${getCurrentLanguage().toUpperCase()}</span> ▾
              </button>
              <div class="dropdown-menu dropdown-menu-right" id="lang-menu" style="min-width: 145px;">
                <button class="dropdown-item lang-item" data-lang="pt">🇧🇷 Português</button>
                <button class="dropdown-item lang-item" data-lang="es">🇪🇸 Español</button>
                <button class="dropdown-item lang-item" data-lang="en">🇺🇸 English</button>
                <button class="dropdown-item lang-item" data-lang="de">🇩🇪 Deutsch</button>
                <button class="dropdown-item lang-item" data-lang="zh">🇨🇳 简体中文</button>
                <button class="dropdown-item lang-item" data-lang="fr">🇫🇷 Français</button>
              </div>
            </div>
          </div>
        </header>

        <!-- Agricultural Calendar Bar (Reference Date: "Hoje") -->
        <div class="calendar-time-bar" id="calendar-time-bar">
          <div class="calendar-today-box">
            <div class="today-calendar-icon">📅</div>
            <div>
              <div class="today-title-label" id="lbl-calendar-title">${t('cropCalendar')} • ${t('referenceDate')}</div>
              <div class="today-date-value" id="lbl-calendar-today-row">
                ${t('today')}: <span id="calendar-today-display">${formatDateWithWeekdayI18n(this.referenceDate)}</span>
                <span class="badge-exemplo">${t('exampleBadge')}</span>
              </div>
            </div>
          </div>

          <div class="calendar-actions-group">
            <button class="btn-advance-time" id="btn-advance-time-main" title="${t('advanceTimeWeek')}">
              <span>⏩</span> <span class="cal-btn-text" id="lbl-btn-advance-time">${t('advanceTimeWeek')}</span>
            </button>
            <div class="dropdown-container">
              <button class="btn btn-outline" id="btn-calendar-more-options" title="${t('options')}">
                <span>⏱️</span> <span class="cal-btn-text" id="lbl-btn-calendar-options">${t('options')} ▾</span>
              </button>
              <div class="dropdown-menu" id="calendar-options-menu">
                <button class="dropdown-item" id="opt-advance-1w"><span>⏩</span> <span id="lbl-opt-adv-1w">${t('plus1Week')}</span></button>
                <button class="dropdown-item" id="opt-advance-2w"><span>⏩</span> <span id="lbl-opt-adv-2w">${t('plus2Weeks')}</span></button>
                <button class="dropdown-item" id="opt-advance-4w"><span>⏩</span> <span id="lbl-opt-adv-4w">${t('plus4Weeks')}</span></button>
                <div style="border-top: 1px solid var(--border-color); margin: 4px 0;"></div>
                <button class="dropdown-item" id="opt-rewind-1w"><span>⏪</span> <span id="lbl-opt-rewind-1w">${t('rewind1Week')}</span></button>
                <button class="dropdown-item" id="opt-reset-date"><span>🔄</span> <span id="lbl-opt-reset-date">${t('resetToDefaultDate')}</span></button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Viewport Area: Starts strictly below top-nav-stack, fills 100% remaining space -->
      <div class="main-viewport-container" id="main-viewport-container">
        <!-- Real Satellite Map View -->
        <div id="map"></div>

        <!-- Minha Fazenda (2D Management Game View Container) -->
        <div id="farm-game-container" style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 5;"></div>

        <!-- Prominent Farm Guidance Banner -->
        <div class="farm-guidance-banner" id="farm-guidance-banner">
        <span class="guidance-icon">🌾</span>
        <div class="guidance-text-content">
          <div class="guidance-headline" id="lbl-guidance-headline">${t('guidanceHeadline')}</div>
          <div class="guidance-subline" id="lbl-guidance-subline">${t('guidanceSubline')}</div>
        </div>
        <div class="guidance-actions">
          <button class="btn btn-primary" id="guidance-btn-talhao">
            <span>➕</span> <span id="lbl-guidance-btn-talhao">${t('newField')}</span>
          </button>
          <button class="btn btn-water" id="guidance-btn-elemento">
            <span>📍</span> <span id="lbl-guidance-btn-elemento">${t('farmElements')}</span>
          </button>
          <button class="btn btn-outline" id="guidance-btn-dismiss" title="${t('close')}" style="padding: 6px 12px;">
            ✕
          </button>
        </div>
      </div>

      <!-- Drawing HUD (shown while drawing a talhão) -->
      <div class="drawing-hud" id="drawing-hud" style="display: none;">
        <div class="drawing-info">
          <div class="drawing-title">
            <span>✏️</span> <span id="lbl-drawing-title">${t('drawingTitle')}</span>
          </div>
          <div class="drawing-instruction" id="lbl-drawing-instruction">
            ${t('drawingInstruction')}
          </div>
        </div>

        <div class="drawing-stats">
          <span style="font-size: 12px; color: #94a3b8;" id="lbl-hud-vertices">${t('vertices')}:</span>
          <span class="drawing-stat-val" id="hud-point-count">0</span>
          <span style="font-size: 12px; color: #94a3b8; margin-left: 8px;" id="lbl-hud-area">${t('area')}:</span>
          <span class="drawing-stat-val" id="hud-live-area" style="color: #34d399;">0,00 ha</span>
        </div>

        <button class="btn btn-secondary" id="btn-undo-point">
          <span>↩️</span> <span id="lbl-btn-undo">${t('undoPoint')}</span>
        </button>

        <button class="btn btn-primary" id="btn-finish-drawing" disabled>
          <span>✅</span> <span id="lbl-btn-finish-draw">${t('finishDrawing')}</span>
        </button>

        <button class="btn btn-outline" id="btn-cancel-drawing">
          <span>✕</span> <span id="lbl-btn-cancel-draw">${t('cancel')}</span>
        </button>
      </div>

      <!-- Water HUD (shown while placing a marker) -->
      <div class="water-hud" id="water-hud" style="display: none;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 24px;" id="water-hud-icon">📍</span>
          <div>
            <div style="font-size: 14px; font-weight: 700; color: #38bdf8;" id="water-hud-text">
              ${t('positioningElement')}
            </div>
            <div style="font-size: 12px; color: #94a3b8;" id="water-hud-subtext">
              ${t('positioningElementDesc')}
            </div>
          </div>
        </div>

        <button class="btn btn-outline" id="btn-cancel-water">
          <span>✕</span> <span id="lbl-btn-cancel-water">${t('cancel')}</span>
        </button>
      </div>
    </div> <!-- /main-viewport-container -->

      <!-- Modal: Digitar Coordenadas do Talhão -->
      <div class="modal-overlay" id="modal-coords-talhao">
        <div class="modal-card modal-card-lg">
          <div class="modal-header">
            <div>
              <h3 class="modal-title">
                <span>🔢</span> <span id="lbl-coords-modal-title">${t('typeCoordsModalTitle')}</span>
              </h3>
              <p style="font-size: 13px; color: #94a3b8; margin-top: 2px;" id="lbl-coords-modal-sub">
                ${t('typeCoordsModalSubtitle')}
              </p>
            </div>
            <button class="modal-close-btn" id="btn-close-coords-talhao">&times;</button>
          </div>

          <div class="modal-body" style="gap: 16px;">
            <!-- Realtime Metrics & Area Box -->
            <div class="area-hero-box" style="padding: 16px 20px;">
              <div>
                <div class="area-hero-label" id="lbl-coords-area-hero">${t('calculatedArea')}</div>
                <div class="area-hero-val" id="coords-live-area">0,00 ha</div>
              </div>
              <div style="display: flex; gap: 24px; text-align: right;">
                <div>
                  <div style="font-size: 12px; color: #94a3b8;" id="lbl-coords-perim-label">${t('perimeter')}</div>
                  <div style="font-family: 'JetBrains Mono', monospace; font-size: 16px; font-weight: 700; color: #e2e8f0;" id="coords-live-perim">0,00 km</div>
                </div>
                <div>
                  <div style="font-size: 12px; color: #94a3b8;" id="lbl-coords-points-label">${t('validPoints')}</div>
                  <div style="font-family: 'JetBrains Mono', monospace; font-size: 16px; font-weight: 700; color: #34d399;" id="coords-live-valid-count">0 / 0</div>
                </div>
              </div>
            </div>

            <!-- Brazil Missing Negative Banner -->
            <div class="alert-brazil-box" id="alert-brazil-negative" style="display: none;">
              <span class="alert-brazil-icon">⚠️</span>
              <div style="flex: 1;">
                <div class="alert-brazil-title" id="lbl-alert-brazil-title">${t('alertBrazilTitle')}</div>
                <div class="alert-brazil-desc" id="lbl-alert-brazil-desc">
                  ${t('alertBrazilDesc')}
                </div>
                <button type="button" class="btn-fix-negative" id="btn-fix-brazil-negatives">
                  <span>⚡</span> <span id="lbl-btn-fix-brazil">${t('fixBrazilNegative')}</span>
                </button>
              </div>
            </div>

            <!-- Batch Paste Accordion / Card -->
            <div class="paste-box-wrapper">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 13px; font-weight: 700; color: #e2e8f0; display: flex; align-items: center; gap: 6px;">
                  <span>📋</span> <span id="lbl-batch-paste-title">${t('batchPasteTitle')}</span>
                </span>
                <button type="button" class="btn btn-outline" id="btn-toggle-paste" style="padding: 4px 10px; font-size: 12px;">
                  <span id="lbl-btn-toggle-paste">${t('batchPasteBtn')} ▾</span>
                </button>
              </div>
              <div id="paste-box-content" style="display: none; flex-direction: column; gap: 8px; margin-top: 8px;">
                <textarea class="paste-textarea" id="textarea-paste-coords" placeholder="${t('pasteTextareaPlaceholder')}"></textarea>
                <div style="display: flex; justify-content: flex-end; gap: 8px;">
                  <button type="button" class="btn btn-primary" id="btn-apply-pasted-coords">
                    <span>📥</span> <span id="lbl-btn-apply-pasted">${t('processLines')}</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Coordinate Rows Table -->
            <div class="form-group">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <label class="form-label" style="font-size: 14px; color: #fff;" id="lbl-coords-table-header">
                  ${t('coordsTableInstructions')}
                </label>
                <button type="button" class="btn btn-outline" id="btn-clear-table" style="padding: 4px 10px; font-size: 12px; color: #f87171;">
                  <span id="lbl-btn-clear-table">${t('clearTable')}</span>
                </button>
              </div>

              <div class="coords-table-wrapper">
                <table class="coords-table">
                  <thead>
                    <tr>
                      <th style="width: 44px; text-align: center;">#</th>
                      <th id="th-latitude">${t('latitudeCol')}</th>
                      <th id="th-longitude">${t('longitudeCol')}</th>
                      <th style="width: 170px;" id="th-status">${t('statusCol')}</th>
                      <th style="width: 48px; text-align: center;" id="th-action">${t('actionCol')}</th>
                    </tr>
                  </thead>
                  <tbody id="coords-table-body">
                    <!-- Dynamic Rows Rendered by TypeScript -->
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Add Point Button -->
            <div style="display: flex; gap: 10px;">
              <button type="button" class="btn btn-secondary btn-lg" id="btn-add-coord-row" style="flex: 1; justify-content: center;">
                <span>➕</span> <span id="lbl-btn-add-coord-row">${t('addPoint')}</span>
              </button>
              <button type="button" class="btn btn-outline" id="btn-load-coords-sample" title="${t('rioVerdeSample')}">
                <span>📍</span> <span id="lbl-btn-load-sample">${t('rioVerdeSample')}</span>
              </button>
            </div>
          </div>

          <div class="modal-footer" style="padding: 16px 22px;">
            <button class="btn btn-outline btn-lg" id="btn-cancel-coords-talhao"><span id="lbl-btn-cancel-coords">${t('cancel')}</span></button>
            <button class="btn btn-primary btn-xl" id="btn-proceed-coords-talhao" disabled>
              <span id="lbl-btn-proceed-coords">${t('proceedAndSave')} →</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Talhão Modal (Creation & Editing) -->
      <div class="modal-overlay" id="modal-talhao">
        <div class="modal-card">
          <div class="modal-header">
            <h3 class="modal-title" id="modal-talhao-title">
              <span>🌾</span> <span id="lbl-talhao-modal-title">${t('saveFieldModalTitle')}</span>
            </h3>
            <button class="modal-close-btn" id="btn-close-talhao-modal">&times;</button>
          </div>
          <div class="modal-body">
            <!-- Area & Perimeter Highlight Box -->
            <div class="area-hero-box">
              <div>
                <div class="area-hero-label" id="lbl-talhao-area-hero">${t('calculatedArea')}</div>
                <div class="area-hero-val" id="modal-talhao-area">0,00 ha</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 12px; color: #94a3b8;" id="lbl-talhao-perim-label">${t('perimeter')}</div>
                <div style="font-family: 'JetBrains Mono', monospace; font-size: 15px; font-weight: 700; color: #e2e8f0;" id="modal-talhao-perimeter">0,00 km</div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" id="lbl-talhao-name-label">${t('fieldName')} *</label>
              <input type="text" class="form-input" id="input-talhao-name" placeholder="${t('fieldName')}..." />
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label" id="lbl-talhao-crop-label">${t('mainCrop')} *</label>
                <select class="form-select" id="select-talhao-crop" style="width: 100%; background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 10px 12px; color: #fff; font-size: 14px; font-weight: 600;">
                  <option value="">${t('selectCropPlaceholder')}</option>
                  <option value="Soja">${t('cropOptionSoja')}</option>
                  <option value="Milho">${t('cropOptionMilho')}</option>
                  <option value="Pastagem">${t('cropOptionPastagem')}</option>
                  <option value="Feijão">${t('cropOptionFeijao')}</option>
                  <option value="Sorgo">${t('cropOptionSorgo')}</option>
                  <option value="Algodão">${t('cropOptionAlgodao')}</option>
                  <option value="Cana-de-açúcar">${t('cropOptionCana')}</option>
                  <option value="Trigo">${t('cropOptionTrigo')}</option>
                  <option value="Outra">${t('cropOptionOutra')}</option>
                </select>
                <input type="text" class="form-input" id="input-talhao-crop-other" placeholder="${t('cropOptionOutra')}..." style="display: none; margin-top: 6px;" />
              </div>

              <div class="form-group">
                <label class="form-label" id="lbl-talhao-cultivar-label">${t('cultivarVariety')}</label>
                <input type="text" class="form-input" id="input-talhao-cultivar" placeholder="${t('exPrefix')} Brasmax Bônus, DM 54i52" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label" id="lbl-talhao-planting-label">${t('plantingDate')}</label>
                <input type="date" class="form-input" id="input-talhao-planting-date" />
              </div>

              <div class="form-group">
                <label class="form-label" id="lbl-talhao-cycle-label">${t('cropCycleDays')}</label>
                <input type="number" class="form-input" id="input-talhao-cycle-days" placeholder="${t('exPrefix')} 115 ${t('orWord')} 120" min="0" max="400" />
                <span id="cycle-days-hint" style="font-size: 11px; color: #94a3b8; margin-top: 3px; display: block;">${t('cycleAutoFilled')}</span>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" id="lbl-talhao-notes-label">${t('technicalNotes')}</label>
              <textarea class="form-textarea" id="input-talhao-notes" placeholder="${t('technicalNotes')}..."></textarea>
            </div>
          </div>
          <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center;">
            <button class="btn btn-outline" id="btn-cancel-talhao-modal"><span id="lbl-btn-cancel-talhao">${t('cancel')}</span></button>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary" id="btn-skip-import-step" style="display: none;"><span id="lbl-btn-skip-import">${t('fillLater')}</span></button>
              <button class="btn btn-primary" id="btn-save-talhao"><span id="lbl-btn-save-talhao">${t('saveField')}</span></button>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal: Calendário de Safras Completo & Validação de Sobreposição -->
      <div class="modal-overlay" id="modal-crop-calendar">
        <div class="modal-card modal-card-lg">
          <div class="modal-header">
            <div>
              <h3 class="modal-title">
                <span>📅</span> <span id="lbl-cal-modal-title">${t('cropCalendar')}</span>
              </h3>
              <p style="font-size: 13px; color: #94a3b8; margin-top: 2px;" id="calendar-modal-subtitle">
                ${t('calendarModalSubtitle')}
              </p>
            </div>
            <button class="modal-close-btn" id="btn-close-calendar-modal">&times;</button>
          </div>

          <div class="modal-body" style="gap: 16px;">
            <!-- Overlap Warning Banner -->
            <div class="overlap-warning-box" id="overlap-warning-banner" style="display: none;">
              <span class="overlap-warning-icon">⛔</span>
              <div>
                <div class="overlap-warning-title" id="lbl-overlap-title">${t('overlapWarningTitle')}</div>
                <div id="overlap-warning-text">
                  ${t('overlapWarningText')}
                </div>
              </div>
            </div>

            <!-- Current Crop Card -->
            <div class="calendar-cycle-box">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong style="font-size: 15px; color: #4ade80;" id="lbl-cal-current-crop-title">🌱 ${t('currentSeasonInField')}</strong>
                <span id="cal-current-phase-pill" class="coord-status-tag valid">Calculando...</span>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label class="form-label" id="lbl-cal-crop-input">${t('currentCrop')}</label>
                  <input type="text" class="form-input" id="cal-crop-input" placeholder="${t('exPrefix')} ${translateCropName('Soja')}" />
                </div>
                <div class="form-group">
                  <label class="form-label" id="lbl-cal-cultivar-input">${t('cultivarVariety')}</label>
                  <input type="text" class="form-input" id="cal-cultivar-input" placeholder="${t('exPrefix')} Brasmax Bônus IPRO" />
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label class="form-label" id="lbl-cal-planting-input">${t('plantingDate')}</label>
                  <input type="date" class="form-input" id="cal-planting-input" />
                </div>
                <div class="form-group">
                  <label class="form-label" id="lbl-cal-cycle-input">${t('cropCycleDays')}</label>
                  <input type="number" class="form-input" id="cal-cycle-input" min="0" max="365" placeholder="115" />
                </div>
                <div class="form-group">
                  <label class="form-label" id="lbl-cal-harvest-input">${t('harvestForecast')}</label>
                  <input type="text" class="form-input" id="cal-expected-harvest-display" readonly style="background: rgba(15,23,42,0.6); color: #a3e635; font-weight: 700;" />
                </div>
              </div>
            </div>

            <!-- Next Planned Crop Card -->
            <div class="calendar-cycle-box" style="border-color: #0284c7;">
              <strong style="font-size: 15px; color: #38bdf8;" id="lbl-cal-next-season-title">🌾 ${t('nextPlannedSeason')}</strong>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label class="form-label" id="lbl-cal-next-crop">${t('plannedCrop')}</label>
                  <input type="text" class="form-input" id="cal-next-crop-input" placeholder="${t('exPrefix')} ${t('demoCropMilhoSafrinha')}" />
                </div>
                <div class="form-group">
                  <label class="form-label" id="lbl-cal-next-planting">${t('plannedPlantingDate')}</label>
                  <input type="date" class="form-input" id="cal-next-planting-input" />
                </div>
              </div>
            </div>

            <!-- Past Harvests History -->
            <div class="calendar-cycle-box">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong style="font-size: 15px; color: #e2e8f0;" id="lbl-cal-history-box-title">📜 ${t('harvestHistoryTitle')}</strong>
                <button type="button" class="btn btn-outline" id="btn-add-history-item" style="padding: 4px 10px; font-size: 12px;">
                  <span id="lbl-btn-add-history">+ ${t('addToHistory')}</span>
                </button>
              </div>
              <div id="cal-history-items-container" style="display: flex; flex-direction: column; gap: 8px;">
                <!-- Rendered dynamically -->
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-outline" id="btn-cancel-calendar-modal"><span id="lbl-btn-cancel-cal">${t('cancel')}</span></button>
            <button class="btn btn-primary btn-lg" id="btn-save-calendar-modal"><span id="lbl-btn-save-cal">${t('saveCalendar')}</span></button>
          </div>
        </div>
      </div>

      <!-- Farm Element Modal (All 11 Types: Estruturas Rurais e Recursos Hídricos) -->
      <div class="modal-overlay" id="modal-water">
        <div class="modal-card modal-card-lg">
          <div class="modal-header">
            <h3 class="modal-title">
              <span>📍</span> <span id="lbl-water-modal-title">${t('registerFarmElement')}</span>
            </h3>
            <button class="modal-close-btn" id="btn-close-water-modal">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label" id="lbl-water-type-label">${t('selectElementType')}</label>

              <!-- Group 1: Estruturas e Infraestrutura -->
              <div style="font-size: 12px; font-weight: 800; color: #4ade80; text-transform: uppercase; margin: 6px 0 4px 0;" id="lbl-water-group1-title">
                ${t('ruralInfrastructure')}
              </div>
              <div class="water-type-grid" id="element-type-selector-estruturas">
                <div class="water-type-card" data-type="sede">
                  <span class="icon">🏠</span>
                  <div>
                    <div class="title">${translateStructureType('sede')}</div>
                    <div style="font-size: 11px; color: #94a3b8;">${t('markSede')}</div>
                  </div>
                </div>
                <div class="water-type-card" data-type="curral">
                  <span class="icon">🐂</span>
                  <div>
                    <div class="title">${translateStructureType('curral')}</div>
                    <div style="font-size: 11px; color: #94a3b8;">${t('markCurral')}</div>
                  </div>
                </div>
                <div class="water-type-card" data-type="silo">
                  <span class="icon">🏭</span>
                  <div>
                    <div class="title">${translateStructureType('silo')}</div>
                    <div style="font-size: 11px; color: #94a3b8;">${t('markSilo')}</div>
                  </div>
                </div>
                <div class="water-type-card" data-type="estrada">
                  <span class="icon">🛣️</span>
                  <div>
                    <div class="title">${translateStructureType('estrada')}</div>
                    <div style="font-size: 11px; color: #94a3b8;">${t('markEstrada')}</div>
                  </div>
                </div>
                <div class="water-type-card" data-type="reserva">
                  <span class="icon">🌳</span>
                  <div>
                    <div class="title">${translateStructureType('reserva')}</div>
                    <div style="font-size: 11px; color: #94a3b8;">${t('markReserva')}</div>
                  </div>
                </div>
                <div class="water-type-card" data-type="pivo">
                  <span class="icon">🔄</span>
                  <div>
                    <div class="title">${translateStructureType('pivo')}</div>
                    <div style="font-size: 11px; color: #94a3b8;">${t('markPivo')}</div>
                  </div>
                </div>
                <div class="water-type-card" data-type="estacao_meteo">
                  <span class="icon">📡</span>
                  <div>
                    <div class="title">${translateStructureType('estacao_meteo')}</div>
                    <div style="font-size: 11px; color: #94a3b8;">${t('markEstacao')}</div>
                  </div>
                </div>
              </div>

              <!-- Group 2: Recursos Hídricos -->
              <div style="font-size: 12px; font-weight: 800; color: #38bdf8; text-transform: uppercase; margin: 12px 0 4px 0;" id="lbl-water-group2-title">
                ${t('waterResources')}
              </div>
              <div class="water-type-grid" id="element-type-selector-agua">
                <div class="water-type-card selected" data-type="nascente">
                  <span class="icon">💧</span>
                  <div>
                    <div class="title">${translateStructureType('nascente')}</div>
                    <div style="font-size: 11px; color: #94a3b8;">${t('markNascente')}</div>
                  </div>
                </div>
                <div class="water-type-card" data-type="acude">
                  <span class="icon">🌊</span>
                  <div>
                    <div class="title">${translateStructureType('acude')}</div>
                    <div style="font-size: 11px; color: #94a3b8;">${t('markAcude')}</div>
                  </div>
                </div>
                <div class="water-type-card" data-type="poco">
                  <span class="icon">🚰</span>
                  <div>
                    <div class="title">${translateStructureType('poco')}</div>
                    <div style="font-size: 11px; color: #94a3b8;">${t('markPoco')}</div>
                  </div>
                </div>
                <div class="water-type-card" data-type="rio">
                  <span class="icon">🏞️</span>
                  <div>
                    <div class="title">${translateStructureType('rio')}</div>
                    <div style="font-size: 11px; color: #94a3b8;">${t('markRio')}</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" id="lbl-water-name-label">${t('elementName')} *</label>
              <input type="text" class="form-input" id="input-water-name" placeholder="${t('exPrefix')} ${t('phWaterNameEx')}" />
            </div>

            <!-- Coordenadas Geográficas -->
            <div class="form-group">
              <label class="form-label" style="display: flex; justify-content: space-between; align-items: baseline;">
                <span id="lbl-water-coords-label">${t('geoCoordinates')} *</span>
                <span style="font-size: 11px; font-weight: normal; color: #94a3b8;" id="lbl-water-coords-hint">${t('coordsFormatHint')}</span>
              </label>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div>
                  <label style="font-size: 12px; color: #94a3b8; display: block; margin-bottom: 4px;" id="lbl-water-lat">${t('latitude')}</label>
                  <input type="text" class="coord-input" id="input-water-lat" placeholder="${t('exPrefix')} -17.8050 ${t('orWord')} 17°48'18&quot;S" />
                </div>
                <div>
                  <label style="font-size: 12px; color: #94a3b8; display: block; margin-bottom: 4px;" id="lbl-water-lng">${t('longitude')}</label>
                  <input type="text" class="coord-input" id="input-water-lng" placeholder="${t('exPrefix')} -51.0850 ${t('orWord')} 51°05'06&quot;W" />
                </div>
              </div>

              <!-- Live coordinate validation message -->
              <div id="water-coord-status" style="font-size: 12px; margin-top: 5px;"></div>

              <!-- Brazil negative warning for water -->
              <div class="alert-brazil-box" id="alert-brazil-water-negative" style="display: none; margin-top: 8px; padding: 10px 14px;">
                <span class="alert-brazil-icon" style="font-size: 20px;">⚠️</span>
                <div style="flex: 1;">
                  <div class="alert-brazil-title" style="font-size: 13px;">${t('alertBrazilTitle')}</div>
                  <div class="alert-brazil-desc" style="font-size: 12px;">
                    ${t('alertBrazilDesc')}
                  </div>
                  <button type="button" class="btn-fix-negative" id="btn-fix-water-negative" style="margin-top: 6px; padding: 4px 10px; font-size: 11px;">
                    <span>⚡</span> <span>${t('fixBrazilNegative')}</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" id="lbl-water-notes-label">${t('observationsAndDetails')}</label>
              <textarea class="form-textarea" id="input-water-notes" placeholder="${t('observationsAndDetails')}..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" id="btn-cancel-water-modal"><span id="lbl-btn-cancel-water-modal">${t('cancel')}</span></button>
            <button class="btn btn-water" id="btn-save-water"><span id="lbl-btn-save-water">${t('saveElement')}</span></button>
          </div>
        </div>
      </div>

      <!-- Import Modal (KML & GeoJSON) -->
      <div class="modal-overlay" id="modal-import">
        <div class="modal-card">
          <div class="modal-header">
            <h3 class="modal-title">
              <span>📂</span> <span id="lbl-import-modal-title">${t('importFieldsTitle')}</span>
            </h3>
            <button class="modal-close-btn" id="btn-close-import-modal">&times;</button>
          </div>
          <div class="modal-body">
            <div class="dropzone" id="file-dropzone">
              <div class="dropzone-icon">🛰️</div>
              <div class="dropzone-text" id="lbl-dropzone-text">${t('dropzoneText')}</div>
              <div class="dropzone-subtext" id="lbl-dropzone-subtext">${t('dropzoneSubtext')}</div>
              <input type="file" id="file-input" accept=".kml,.geojson,.json" style="display: none;" />
            </div>

            <div style="background: rgba(15, 23, 42, 0.5); border: 1px solid var(--border-color); border-radius: 10px; padding: 12px; font-size: 12px; color: #cbd5e1; line-height: 1.5;">
              <strong style="color: #34d399;" id="lbl-import-tip-title">💡 ${t('compatibilityTip')}:</strong><br />
              <span id="lbl-import-tip-desc">${t('compatibilityDesc')}</span>
            </div>

            <div class="form-group" style="display: flex; flex-direction: row; align-items: center; gap: 8px;">
              <input type="checkbox" id="check-keep-existing" checked style="accent-color: #10b981; width: 16px; height: 16px; cursor: pointer;" />
              <label for="check-keep-existing" id="lbl-keep-existing" style="font-size: 13px; color: #e2e8f0; cursor: pointer;">
                ${t('keepExistingData')}
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" id="btn-cancel-import-modal"><span id="lbl-btn-cancel-import">${t('close')}</span></button>
            <button class="btn btn-primary" id="btn-trigger-file-select"><span id="lbl-btn-select-file">${t('selectFile')}</span></button>
          </div>
        </div>
      </div>

      <!-- Export Modal -->
      <div class="modal-overlay" id="modal-export">
        <div class="modal-card">
          <div class="modal-header">
            <h3 class="modal-title">
              <span>💾</span> <span id="lbl-export-modal-title">${t('exportMappingTitle')}</span>
            </h3>
            <button class="modal-close-btn" id="btn-close-export-modal">&times;</button>
          </div>
          <div class="modal-body">
            <p style="font-size: 13px; color: #cbd5e1;" id="lbl-export-desc">
              ${t('chooseExportFormat')}
            </p>

            <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 6px;">
              <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color); border-radius: 12px; padding: 14px 16px;">
                <div>
                  <div style="font-size: 15px; font-weight: 700; color: #fff;">GeoJSON (.geojson)</div>
                  <div style="font-size: 12px; color: #94a3b8;" id="lbl-export-geojson-desc">${t('geojsonDesc')}</div>
                </div>
                <button class="btn btn-primary" id="btn-export-geojson"><span id="lbl-btn-export-geojson">${t('downloadGeoJSON')}</span></button>
              </div>

              <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color); border-radius: 12px; padding: 14px 16px;">
                <div>
                  <div style="font-size: 15px; font-weight: 700; color: #fff;">KML (.kml)</div>
                  <div style="font-size: 12px; color: #94a3b8;" id="lbl-export-kml-desc">${t('kmlDesc')}</div>
                </div>
                <button class="btn btn-water" id="btn-export-kml"><span id="lbl-btn-export-kml">${t('downloadKML')}</span></button>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" id="btn-cancel-export-modal"><span id="lbl-btn-cancel-export">${t('close')}</span></button>
          </div>
        </div>
      </div>

      <!-- Sidebar Drawer (Farm Manager) -->
      <div class="sidebar-drawer" id="sidebar-drawer">
        <div class="drawer-header">
          <div class="drawer-title">
            <img src="/assets/aistudio/image_5d97730a.png" alt="MyRoça" class="drawer-logo-thumb" />
            <div>
              <span class="brand-my" style="font-size: 17px;">My</span><span class="brand-roca" style="font-size: 17px;">Roça</span>
              <span style="font-size: 13px; color: #94a3b8; font-weight: 500; margin-left: 6px;" id="lbl-drawer-title">| ${t('farmDashboard')}</span>
            </div>
          </div>
          <button class="modal-close-btn" id="btn-close-drawer">&times;</button>
        </div>

        <div class="drawer-tabs">
          <button class="drawer-tab active" id="tab-talhoes" data-tab="talhoes">
            <span id="lbl-tab-talhoes">${t('fields')}</span> (<span id="drawer-talhoes-count">0</span>)
          </button>
          <button class="drawer-tab" id="tab-water" data-tab="water">
            <span id="lbl-tab-water">${t('structuresAndWater')}</span> (<span id="drawer-water-count">0</span>)
          </button>
        </div>

        <div class="drawer-content" id="drawer-content-talhoes">
          <!-- Talhões list rendered dynamically -->
        </div>

        <div class="drawer-content" id="drawer-content-water" style="display: none;">
          <!-- Farm Elements list rendered dynamically -->
        </div>

        <div style="padding: 16px; border-top: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 8px; background: rgba(15, 23, 42, 0.9);">
          <button class="btn btn-outline" id="btn-load-demo" style="width: 100%; justify-content: center;">
            <span>🔄</span> <span id="lbl-btn-load-demo">${t('restoreDemo')}</span>
          </button>
          <button class="btn btn-outline" id="btn-clear-all" style="width: 100%; justify-content: center; color: #f87171; border-color: rgba(239, 68, 68, 0.3);">
            <span>🗑️</span> <span id="lbl-btn-clear-all">${t('clearAllData')}</span>
          </button>
        </div>
      </div>

      <!-- Toast Container -->
      <div class="toast-container" id="toast-container"></div>
    `;
  }

  private initMap(): void {
    this.mapManager = new MapManager('map', {
      onDrawingProgress: (pointCount, currentAreaHa) => {
        const hudPointCount = document.getElementById('hud-point-count');
        const hudLiveArea = document.getElementById('hud-live-area');
        const finishBtn = document.getElementById('btn-finish-drawing') as HTMLButtonElement | null;

        if (hudPointCount) hudPointCount.innerText = String(pointCount);
        if (hudLiveArea) hudLiveArea.innerText = formatHectares(currentAreaHa);
        if (finishBtn) finishBtn.disabled = pointCount < 3;
      },
      onDrawingComplete: (coords, areaHa, perimeterKm) => {
        this.pendingTalhaoCoords = coords;
        this.pendingTalhaoArea = areaHa;
        this.pendingTalhaoPerimeter = perimeterKm;
        this.editingTalhaoId = null;

        // Auto color based on count
        this.selectedTalhaoColor = getPaletteColor(this.farmData.talhoes.length);

        this.openTalhaoModal(
          t('defaultTalhaoName', { n: this.farmData.talhoes.length + 1 }),
          '',
          this.selectedTalhaoColor,
          areaHa,
          perimeterKm,
          ''
        );
      },
      onWaterPointClick: (lat, lng) => {
        this.pendingWaterCoords = [lat, lng];
        this.openWaterModal(lat, lng);
      },
      onTalhaoEdit: (talhao) => {
        this.editingTalhaoId = talhao.id;
        this.pendingTalhaoCoords = talhao.coordinates;
        this.pendingTalhaoArea = talhao.areaHectares;
        this.pendingTalhaoPerimeter = talhao.perimeterKm;
        this.selectedTalhaoColor = talhao.color;

        this.openTalhaoModal(
          talhao.name,
          talhao.crop || '',
          talhao.color,
          talhao.areaHectares,
          talhao.perimeterKm,
          talhao.notes || ''
        );
      },
      onTalhaoDelete: (talhaoId) => {
        this.deleteTalhao(talhaoId);
      },
      onWaterPointDelete: (waterPointId) => {
        this.deleteWaterPoint(waterPointId);
      },
    });

    this.renderColorSwatches();
    this.renderFarmOnMap();
  }

  // ==========================================
  // GAME MODE ("MINHA FAZENDA") & CALENDAR
  // ==========================================

  private initGameMode(): void {
    const container = document.getElementById('farm-game-container');
    if (!container) return;

    this.farmGameView = new FarmGameView({
      container,
      farmData: this.farmData,
      referenceDate: this.referenceDate,
      onTalhaoSelect: (talhao: Talhao) => {
        console.log('Talhão selecionado no jogo:', talhao.name);
      },
      onElementSelect: (elem: WaterPoint) => {
        console.log('Elemento selecionado no jogo:', elem.name);
      },
      onSwitchToRealMap: () => {
        this.switchViewMode('mapa');
      },
      onAdvanceTime: (days: number) => {
        this.advanceTime(days);
      },
      onOpenCalendarModal: (talhaoId: string) => {
        this.openCropCalendarModal(talhaoId);
      },
      onTalhaoUpdated: (talhao: Talhao) => {
        const mine = this.farmData.talhoes.find((x) => x.id === talhao.id);
        if (mine && mine !== talhao) mine.diary = talhao.diary;
        saveFarmData(this.farmData);
        this.showToast(`📒 ${t('diarySaved')}`);
      },
      onAvatarSaved: () => {
        this.showToast(`🧑‍🌾 ${t('avSaved')}`);
      },
      onElementMoved: (elem: WaterPoint) => {
        const mine = this.farmData.waterPoints.find((x) => x.id === elem.id);
        if (mine && mine !== elem) mine.coordinates = [elem.coordinates[0], elem.coordinates[1]];
        saveFarmData(this.farmData);
      },
    });
  }

  public switchViewMode(mode: 'mapa' | 'fazenda'): void {
    this.activeViewMode = mode;
    this.farmData.activeViewMode = mode;
    saveFarmData(this.farmData);

    const btnMapa = document.getElementById('btn-mode-mapa');
    const btnFazenda = document.getElementById('btn-mode-fazenda');
    const mapEl = document.getElementById('map');
    const gameContainer = document.getElementById('farm-game-container');

    if (mode === 'fazenda') {
      btnMapa?.classList.remove('active');
      btnFazenda?.classList.add('active');
      if (mapEl) mapEl.style.display = 'none';
      if (gameContainer) gameContainer.style.display = 'block';

      // Ensure canvas is properly sized after container is visible and fit to bounds with 8% margin
      requestAnimationFrame(() => {
        this.farmGameView?.resize();
        this.farmGameView?.updateFarmData(this.farmData, this.referenceDate);
        this.farmGameView?.fitToBounds(0.08);
      });
      setTimeout(() => {
        this.farmGameView?.resize();
        this.farmGameView?.fitToBounds(0.08);
      }, 60);

      this.showToast(`🚜 ${t('toastModeMyFarm')}`);
      setTimeout(() => this.farmGameView?.promptAvatarIfNeeded(), 700);
    } else {
      btnFazenda?.classList.remove('active');
      btnMapa?.classList.add('active');
      if (gameContainer) gameContainer.style.display = 'none';
      if (mapEl) mapEl.style.display = 'block';

      setTimeout(() => {
        this.mapManager.invalidateSize();
      }, 50);

      this.showToast(`🗺️ ${t('toastModeRealMap')}`);
    }
  }

  public advanceTime(days: number): void {
    this.referenceDate = addDaysToDate(this.referenceDate, days);
    this.farmData.referenceDate = this.referenceDate;
    saveFarmData(this.farmData);

    // Update display
    const todayDisplay = document.getElementById('calendar-today-display');
    if (todayDisplay) {
      todayDisplay.innerText = formatBrDateWithWeekday(this.referenceDate);
    }

    // Refresh map markers with updated crop status badges using active referenceDate!
    this.mapManager.renderTalhoes(this.farmData.talhoes, this.referenceDate);

    // Refresh 2D/2.5D game canvas
    this.farmGameView?.updateFarmData(this.farmData, this.referenceDate);

    // Refresh drawer list
    this.renderDrawerLists();

    const weeks = Math.abs(days / 7);
    this.showToast(
      `📅 ${t('toastDateAdvanced', {
        date: formatBrDateShort(this.referenceDate),
        days: days >= 0 ? `+${days}` : `${days}`,
        weeks: days >= 0 ? `+${weeks}` : `-${weeks}`,
      })}`
    );
  }

  public resetReferenceDate(): void {
    this.referenceDate = DEFAULT_REFERENCE_DATE;
    this.farmData.referenceDate = this.referenceDate;
    saveFarmData(this.farmData);

    const todayDisplay = document.getElementById('calendar-today-display');
    if (todayDisplay) {
      todayDisplay.innerText = formatBrDateWithWeekday(this.referenceDate);
    }

    this.mapManager.renderTalhoes(this.farmData.talhoes);
    this.farmGameView?.updateFarmData(this.farmData, this.referenceDate);
    this.renderDrawerLists();

    this.showToast(`📅 ${t('toastDateReset')}`);
  }

  // ==========================================
  // CROP CALENDAR MODAL & OVERLAP VALIDATION
  // ==========================================

  public openCropCalendarModal(talhaoId: string): void {
    const talhao = this.farmData.talhoes.find((t) => t.id === talhaoId);
    if (!talhao) return;

    this.calendarModalTalhaoId = talhaoId;
    this.hideHUDs();

    const subtitleEl = document.getElementById('calendar-modal-subtitle');
    const cropInput = document.getElementById('cal-crop-input') as HTMLInputElement | null;
    const cultivarInput = document.getElementById('cal-cultivar-input') as HTMLInputElement | null;
    const plantingInput = document.getElementById('cal-planting-input') as HTMLInputElement | null;
    const cycleInput = document.getElementById('cal-cycle-input') as HTMLInputElement | null;
    const nextCropInput = document.getElementById('cal-next-crop-input') as HTMLInputElement | null;
    const nextPlantingInput = document.getElementById('cal-next-planting-input') as HTMLInputElement | null;

    if (subtitleEl) {
      subtitleEl.innerHTML = `<strong>${talhao.name}</strong> • ${t('area')}: ${formatHectares(talhao.areaHectares)}${talhao.isExample ? ` <span class="badge-exemplo">${t('exampleBadge').toLowerCase()}</span>` : ''}`;
    }

    if (cropInput) cropInput.value = talhao.crop || '';
    if (cultivarInput) cultivarInput.value = talhao.cultivar || '';
    if (plantingInput) plantingInput.value = talhao.plantingDate || '';
    if (cycleInput) cycleInput.value = talhao.cycleDays !== undefined ? String(talhao.cycleDays) : '';
    if (nextCropInput) nextCropInput.value = talhao.nextCropPlan?.crop || '';
    if (nextPlantingInput) nextPlantingInput.value = talhao.nextCropPlan?.plannedPlanting || '';

    // Render past harvest history
    const history = talhao.harvestHistory || [];
    this.renderModalHistoryItems(history);

    // Run live calculation & overlap check
    this.checkCalendarOverlapLive();

    document.getElementById('modal-crop-calendar')?.classList.add('show');
    cropInput?.focus();
  }

  private checkCalendarOverlapLive(): { hasOverlap: boolean; message?: string } {
    const cropInput = document.getElementById('cal-crop-input') as HTMLInputElement | null;
    const cultivarInput = document.getElementById('cal-cultivar-input') as HTMLInputElement | null;
    const plantingInput = document.getElementById('cal-planting-input') as HTMLInputElement | null;
    const cycleInput = document.getElementById('cal-cycle-input') as HTMLInputElement | null;
    const expectedHarvestDisplay = document.getElementById('cal-expected-harvest-display') as HTMLInputElement | null;
    const currentPhasePill = document.getElementById('cal-current-phase-pill');
    const nextCropInput = document.getElementById('cal-next-crop-input') as HTMLInputElement | null;
    const nextPlantingInput = document.getElementById('cal-next-planting-input') as HTMLInputElement | null;
    const overlapBanner = document.getElementById('overlap-warning-banner');
    const overlapText = document.getElementById('overlap-warning-text');
    const saveBtn = document.getElementById('btn-save-calendar-modal') as HTMLButtonElement | null;

    const plantingDate = plantingInput?.value || undefined;
    const cycleDays = cycleInput && cycleInput.value.trim() !== '' ? parseInt(cycleInput.value, 10) : undefined;
    const nextCrop = nextCropInput?.value.trim() || undefined;
    const nextPlantingDate = nextPlantingInput?.value || undefined;

    // Calculate expected harvest
    let expectedHarvest: string | undefined = undefined;
    if (plantingDate && cycleDays && cycleDays > 0) {
      expectedHarvest = calculateExpectedHarvestDate(plantingDate, cycleDays);
      if (expectedHarvestDisplay) {
        expectedHarvestDisplay.value = `${formatBrDateShort(expectedHarvest)} (${cycleDays} dias)`;
      }
    } else {
      if (expectedHarvestDisplay) expectedHarvestDisplay.value = 'Informe plantio e ciclo';
    }

    // Calculate crop phase badge
    const dummyTalhao: Talhao = {
      id: 'temp',
      name: 'Temp',
      coordinates: [],
      areaHectares: 0,
      perimeterKm: 0,
      color: '#fff',
      createdAt: '',
      crop: cropInput?.value.trim() || '',
      cultivar: cultivarInput?.value.trim() || '',
      plantingDate,
      cycleDays,
      harvestDateExpected: expectedHarvest,
    };
    const status = calculateTalhaoCropStatus(dummyTalhao, this.referenceDate);
    if (currentPhasePill) {
      currentPhasePill.innerText = `${status.phase.icon} ${status.stageBadgeText}`;
    }

    // Check overlap
    const overlap = checkCropDatesOverlap(
      plantingDate || '',
      cycleDays || 0,
      nextPlantingDate || ''
    );

    if (overlap.hasOverlap) {
      if (overlapBanner) overlapBanner.style.display = 'flex';
      if (overlapText) overlapText.innerText = overlap.message || t('msgOverlapDefault');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.title = t('tipFixDatesFirst');
      }
    } else {
      if (overlapBanner) overlapBanner.style.display = 'none';
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.title = t('tipSaveCalendar');
      }
    }

    return overlap;
  }

  private renderModalHistoryItems(items: { id: string; season: string; crop: string; harvestDate: string; yieldText?: string; notes?: string }[]): void {
    const container = document.getElementById('cal-history-items-container');
    if (!container) return;

    if (items.length === 0) {
      container.innerHTML = `
        <div style="font-size: 13px; color: #94a3b8; padding: 8px 12px; background: rgba(15,23,42,0.4); border-radius: 8px;">
          Nenhuma safra anterior registrada ainda. Clique em <strong>+ Adicionar ao Histórico</strong> para incluir colheitas passadas.
        </div>
      `;
      return;
    }

    container.innerHTML = items
      .map(
        (item, idx) => `
        <div class="history-item-row" data-index="${idx}" style="display: flex; gap: 8px; align-items: center; background: rgba(15,23,42,0.5); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color);">
          <div style="flex: 1; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
            <input type="text" class="form-input form-input-sm history-season" value="${item.season}" placeholder="${t('exPrefix')} 2025/26" />
            <input type="text" class="form-input form-input-sm history-crop" value="${item.crop}" placeholder="${t('exPrefix')} ${t('phHistCropEx')}" />
            <input type="text" class="form-input form-input-sm history-date" value="${item.harvestDate || ''}" placeholder="${t('exPrefix')} ${t('phHistDateEx')}" />
          </div>
          <button type="button" class="btn-remove-row btn-remove-history" data-index="${idx}" title="${t('tipRemoveItem')}" style="padding: 4px 8px;">
            🗑️
          </button>
        </div>
      `
      )
      .join('');

    container.querySelectorAll('.btn-remove-history').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt((e.currentTarget as HTMLElement).getAttribute('data-index') || '-1', 10);
        if (idx >= 0) {
          items.splice(idx, 1);
          this.renderModalHistoryItems(items);
        }
      });
    });
  }

  private addHistoryItemInModal(): void {
    const container = document.getElementById('cal-history-items-container');
    if (!container) return;

    const items = this.getModalHistoryItems();
    items.push({
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      season: '2025/26',
      crop: 'Soja',
      harvestDate: 'Fevereiro/2026',
    });
    this.renderModalHistoryItems(items);
  }

  private getModalHistoryItems(): { id: string; season: string; crop: string; harvestDate: string; yieldText?: string; notes?: string }[] {
    const container = document.getElementById('cal-history-items-container');
    if (!container) return [];

    const rows = container.querySelectorAll('.history-item-row');
    const items: { id: string; season: string; crop: string; harvestDate: string }[] = [];

    rows.forEach((row) => {
      const seasonInput = row.querySelector('.history-season') as HTMLInputElement | null;
      const cropInput = row.querySelector('.history-crop') as HTMLInputElement | null;
      const dateInput = row.querySelector('.history-date') as HTMLInputElement | null;

      if (seasonInput && cropInput && (seasonInput.value.trim() || cropInput.value.trim())) {
        items.push({
          id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          season: seasonInput.value.trim(),
          crop: cropInput.value.trim(),
          harvestDate: dateInput?.value.trim() || '',
        });
      }
    });

    return items;
  }

  private saveCropCalendarFromModal(): void {
    if (!this.calendarModalTalhaoId) return;

    const talhao = this.farmData.talhoes.find((t) => t.id === this.calendarModalTalhaoId);
    if (!talhao) return;

    const overlap = this.checkCalendarOverlapLive();
    if (overlap.hasOverlap) {
      alert(t('alertCropOverlap', { message: overlap.message || '' }));
      return;
    }

    const cropInput = document.getElementById('cal-crop-input') as HTMLInputElement | null;
    const cultivarInput = document.getElementById('cal-cultivar-input') as HTMLInputElement | null;
    const plantingInput = document.getElementById('cal-planting-input') as HTMLInputElement | null;
    const cycleInput = document.getElementById('cal-cycle-input') as HTMLInputElement | null;
    const nextCropInput = document.getElementById('cal-next-crop-input') as HTMLInputElement | null;
    const nextPlantingInput = document.getElementById('cal-next-planting-input') as HTMLInputElement | null;

    talhao.crop = cropInput?.value.trim() || '';
    talhao.cultivar = cultivarInput?.value.trim() || '';
    talhao.plantingDate = plantingInput?.value || undefined;
    talhao.cycleDays = cycleInput && cycleInput.value.trim() !== '' ? parseInt(cycleInput.value, 10) : undefined;

    if (talhao.plantingDate && talhao.cycleDays && talhao.cycleDays > 0) {
      talhao.harvestDateExpected = calculateExpectedHarvestDate(talhao.plantingDate, talhao.cycleDays);
    } else {
      talhao.harvestDateExpected = undefined;
    }

    if (nextCropInput?.value.trim() || nextPlantingInput?.value) {
      talhao.nextCropPlan = {
        crop: nextCropInput?.value.trim() || '',
        plannedPlanting: nextPlantingInput?.value || '',
      };
    } else {
      talhao.nextCropPlan = undefined;
    }

    talhao.harvestHistory = this.getModalHistoryItems();

    saveFarmData(this.farmData);
    this.closeModals();
    this.updateUI();
    this.mapManager.renderTalhoes(this.farmData.talhoes);
    this.farmGameView?.updateFarmData(this.farmData, this.referenceDate);
    this.showToast(t('toastCalendarUpdated', { name: talhao.name }));
  }

  private renderColorSwatches(): void {
    const grid = document.getElementById('talhao-color-grid');
    if (!grid) return;

    grid.innerHTML = '';
    TALHAO_COLORS.forEach((c) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `color-swatch-btn ${c.hex === this.selectedTalhaoColor ? 'selected' : ''}`;
      btn.style.backgroundColor = c.hex;
      btn.title = c.name;
      btn.innerHTML = c.hex === this.selectedTalhaoColor ? '✓' : '';

      btn.onclick = () => {
        this.selectedTalhaoColor = c.hex;
        document.querySelectorAll('.color-swatch-btn').forEach((b) => {
          b.classList.remove('selected');
          b.innerHTML = '';
        });
        btn.classList.add('selected');
        btn.innerHTML = '✓';
      };

      grid.appendChild(btn);
    });
  }

  private bindEvents(): void {
    // Mode Switcher: Mapa Real vs Minha Fazenda
    document.getElementById('btn-mode-mapa')?.addEventListener('click', () => {
      this.switchViewMode('mapa');
    });
    document.getElementById('btn-mode-fazenda')?.addEventListener('click', () => {
      this.switchViewMode('fazenda');
    });

    // Agricultural Calendar Bar Events
    document.getElementById('btn-advance-time-main')?.addEventListener('click', () => {
      this.advanceTime(7);
    });

    const calMoreBtn = document.getElementById('btn-calendar-more-options');
    const calMenu = document.getElementById('calendar-options-menu');
    calMoreBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      calMenu?.classList.toggle('show');
    });
    document.addEventListener('click', () => {
      calMenu?.classList.remove('show');
    });

    document.getElementById('opt-advance-1w')?.addEventListener('click', () => {
      calMenu?.classList.remove('show');
      this.advanceTime(7);
    });
    document.getElementById('opt-advance-2w')?.addEventListener('click', () => {
      calMenu?.classList.remove('show');
      this.advanceTime(14);
    });
    document.getElementById('opt-advance-4w')?.addEventListener('click', () => {
      calMenu?.classList.remove('show');
      this.advanceTime(28);
    });
    document.getElementById('opt-rewind-1w')?.addEventListener('click', () => {
      calMenu?.classList.remove('show');
      this.advanceTime(-7);
    });
    document.getElementById('opt-reset-date')?.addEventListener('click', () => {
      calMenu?.classList.remove('show');
      this.resetReferenceDate();
    });

    // Farm Guidance Banner
    document.getElementById('guidance-btn-talhao')?.addEventListener('click', () => {
      this.startDrawingTalhao();
    });
    document.getElementById('guidance-btn-elemento')?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('water-menu')?.classList.toggle('show');
    });
    document.getElementById('guidance-btn-dismiss')?.addEventListener('click', () => {
      const banner = document.getElementById('farm-guidance-banner');
      if (banner) banner.style.display = 'none';
    });

    // Crop Calendar Modal Events
    document.getElementById('btn-close-calendar-modal')?.addEventListener('click', () => this.closeModals());
    document.getElementById('btn-cancel-calendar-modal')?.addEventListener('click', () => this.closeModals());
    document.getElementById('btn-save-calendar-modal')?.addEventListener('click', () => this.saveCropCalendarFromModal());
    document.getElementById('btn-add-history-item')?.addEventListener('click', () => this.addHistoryItemInModal());

    ['cal-crop-input', 'cal-cultivar-input', 'cal-planting-input', 'cal-cycle-input', 'cal-next-crop-input', 'cal-next-planting-input'].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', () => {
        this.checkCalendarOverlapLive();
      });
      document.getElementById(id)?.addEventListener('change', () => {
        this.checkCalendarOverlapLive();
      });
    });

    document.getElementById('btn-logout')?.addEventListener('click', () => {
      logout();
      window.location.reload();
    });

    // Language selector: grava o idioma e recarrega a página (os dados da fazenda ficam no localStorage)
    const langMenu = document.getElementById('lang-menu');
    document.getElementById('btn-lang-dropdown')?.addEventListener('click', (e) => {
      e.stopPropagation();
      langMenu?.classList.toggle('show');
    });
    langMenu?.querySelectorAll('.lang-item').forEach((item) => {
      item.addEventListener('click', () => {
        const code = (item as HTMLElement).getAttribute('data-lang') as LanguageCode | null;
        if (!code || code === getCurrentLanguage()) {
          langMenu.classList.remove('show');
          return;
        }
        setLanguage(code);
        window.location.reload();
      });
    });
    document.addEventListener('click', () => langMenu?.classList.remove('show'));

    // Talhão Dropdown
    const talhaoBtn = document.getElementById('btn-talhao-dropdown');
    const talhaoMenu = document.getElementById('talhao-menu');
    talhaoBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('water-menu')?.classList.remove('show');
      talhaoMenu?.classList.toggle('show');
    });

    document.getElementById('opt-draw-talhao')?.addEventListener('click', () => {
      talhaoMenu?.classList.remove('show');
      this.startDrawingTalhao();
    });

    document.getElementById('opt-type-coords-talhao')?.addEventListener('click', () => {
      talhaoMenu?.classList.remove('show');
      this.openCoordsTalhaoModal();
    });

    // Water Dropdown
    const waterBtn = document.getElementById('btn-water-dropdown');
    const waterMenu = document.getElementById('water-menu');
    waterBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      talhaoMenu?.classList.remove('show');
      moreMenu?.classList.remove('show');
      waterMenu?.classList.toggle('show');
    });

    // More Dropdown (Secondary Actions)
    const moreBtn = document.getElementById('btn-more-dropdown');
    const moreMenu = document.getElementById('more-menu');
    moreBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      talhaoMenu?.classList.remove('show');
      waterMenu?.classList.remove('show');
      moreMenu?.classList.toggle('show');
    });

    document.addEventListener('click', () => {
      talhaoMenu?.classList.remove('show');
      waterMenu?.classList.remove('show');
      moreMenu?.classList.remove('show');
    });

    // Close moreMenu when any item inside it is clicked
    document.querySelectorAll('#more-menu .dropdown-item').forEach((item) => {
      item.addEventListener('click', () => {
        moreMenu?.classList.remove('show');
      });
    });

    // Close modals on clicking overlay backdrop
    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.closeModals();
        }
      });
    });

    document.querySelectorAll('#water-menu .dropdown-item[data-type]').forEach((item) => {
      item.addEventListener('click', (e) => {
        const type = (e.currentTarget as HTMLElement).getAttribute('data-type') as WaterPointType;
        if (type) {
          this.startPlacingWater(type);
        }
      });
    });

    document.getElementById('opt-type-coords-water')?.addEventListener('click', () => {
      waterMenu?.classList.remove('show');
      this.openWaterModalManual();
    });

    // Coordinate Talhão Modal Events
    document.getElementById('btn-close-coords-talhao')?.addEventListener('click', () => this.closeModals());
    document.getElementById('btn-cancel-coords-talhao')?.addEventListener('click', () => this.closeModals());

    document.getElementById('btn-add-coord-row')?.addEventListener('click', () => {
      this.addCoordRow();
    });

    document.getElementById('btn-clear-table')?.addEventListener('click', () => {
      this.coordsTableRows = [];
      this.renderCoordsTable();
    });

    document.getElementById('btn-load-coords-sample')?.addEventListener('click', () => {
      this.loadCoordsSample();
    });

    document.getElementById('btn-fix-brazil-negatives')?.addEventListener('click', () => {
      this.fixAllBrazilNegatives();
    });

    // Toggle paste area
    document.getElementById('btn-toggle-paste')?.addEventListener('click', () => {
      const box = document.getElementById('paste-box-content');
      if (box) {
        const isHidden = box.style.display === 'none';
        box.style.display = isHidden ? 'flex' : 'none';
      }
    });

    document.getElementById('btn-apply-pasted-coords')?.addEventListener('click', () => {
      const textarea = document.getElementById('textarea-paste-coords') as HTMLTextAreaElement | null;
      if (textarea && textarea.value.trim()) {
        this.applyPastedCoordinates(textarea.value);
        textarea.value = '';
        const box = document.getElementById('paste-box-content');
        if (box) box.style.display = 'none';
      } else {
        alert('Por favor, cole um texto com coordenadas antes de processar.');
      }
    });

    document.getElementById('btn-proceed-coords-talhao')?.addEventListener('click', () => {
      this.proceedFromCoordsToTalhao();
    });

    // Water Point Coordinate Input Events
    document.getElementById('input-water-lat')?.addEventListener('input', () => {
      this.validateWaterInputs();
    });

    document.getElementById('input-water-lng')?.addEventListener('input', () => {
      this.validateWaterInputs();
    });

    document.getElementById('btn-fix-water-negative')?.addEventListener('click', () => {
      this.fixWaterNegativeCoordinates();
    });

    // Drawing HUD buttons
    document.getElementById('btn-undo-point')?.addEventListener('click', () => {
      this.mapManager.undoLastDrawingPoint();
    });

    document.getElementById('btn-finish-drawing')?.addEventListener('click', () => {
      this.mapManager.finishDrawingTalhao();
    });

    document.getElementById('btn-cancel-drawing')?.addEventListener('click', () => {
      this.mapManager.cancelDrawing();
      this.hideHUDs();
    });

    // Water HUD
    document.getElementById('btn-cancel-water')?.addEventListener('click', () => {
      this.mapManager.endPlacingWaterPoint();
      this.hideHUDs();
    });

    // Modals buttons
    document.getElementById('btn-close-talhao-modal')?.addEventListener('click', () => this.cancelOrSkipTalhaoModal());
    document.getElementById('btn-cancel-talhao-modal')?.addEventListener('click', () => this.cancelOrSkipTalhaoModal());
    document.getElementById('btn-skip-import-step')?.addEventListener('click', () => this.skipCurrentImportTalhao());
    document.getElementById('btn-save-talhao')?.addEventListener('click', () => this.saveTalhaoFromModal());

    // Crop Selector listener: auto-fill default cycle days and handle "Outra"
    const cropSelect = document.getElementById('select-talhao-crop') as HTMLSelectElement | null;
    const cropOtherInput = document.getElementById('input-talhao-crop-other') as HTMLInputElement | null;
    const cycleInput = document.getElementById('input-talhao-cycle-days') as HTMLInputElement | null;
    const cycleHint = document.getElementById('cycle-days-hint');

    cropSelect?.addEventListener('change', () => {
      const selected = cropSelect.value;
      if (selected === 'Outra') {
        if (cropOtherInput) {
          cropOtherInput.style.display = 'block';
          cropOtherInput.focus();
        }
      } else {
        if (cropOtherInput) {
          cropOtherInput.style.display = 'none';
          cropOtherInput.value = '';
        }
      }

      if (selected && DEFAULT_CROP_CYCLES[selected] !== undefined) {
        const defaultCycle = DEFAULT_CROP_CYCLES[selected];
        if (cycleInput) {
          cycleInput.value = defaultCycle !== null ? String(defaultCycle) : '';
        }
        if (cycleHint) {
          if (defaultCycle === null) {
            cycleHint.textContent = t('cycleHintPasture');
          } else {
            cycleHint.textContent = t('cycleHintDefault', { crop: translateCropName(selected), days: defaultCycle });
          }
        }
      }
    });

    document.getElementById('btn-close-water-modal')?.addEventListener('click', () => this.closeModals());
    document.getElementById('btn-cancel-water-modal')?.addEventListener('click', () => this.closeModals());
    document.getElementById('btn-save-water')?.addEventListener('click', () => this.saveWaterFromModal());

    // Water Type Selector in Modal
    document.querySelectorAll('.water-type-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        document.querySelectorAll('.water-type-card').forEach((c) => c.classList.remove('selected'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('selected');
        this.selectedWaterType = target.getAttribute('data-type') as WaterPointType;
      });
    });

    // Import / Export Modals
    document.getElementById('btn-open-import')?.addEventListener('click', () => {
      document.getElementById('modal-import')?.classList.add('show');
    });

    document.getElementById('btn-close-import-modal')?.addEventListener('click', () => this.closeModals());
    document.getElementById('btn-cancel-import-modal')?.addEventListener('click', () => this.closeModals());

    document.getElementById('btn-open-export')?.addEventListener('click', () => {
      document.getElementById('modal-export')?.classList.add('show');
    });

    document.getElementById('btn-close-export-modal')?.addEventListener('click', () => this.closeModals());
    document.getElementById('btn-cancel-export-modal')?.addEventListener('click', () => this.closeModals());

    // File Upload (Drag & Drop & Input)
    const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
    const dropzone = document.getElementById('file-dropzone');
    const triggerFileBtn = document.getElementById('btn-trigger-file-select');

    triggerFileBtn?.addEventListener('click', () => fileInput?.click());
    dropzone?.addEventListener('click', () => fileInput?.click());

    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone?.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        this.handleFileUpload(e.dataTransfer.files[0]);
      }
    });

    fileInput?.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        this.handleFileUpload(fileInput.files[0]);
      }
    });

    // Export Actions
    document.getElementById('btn-export-geojson')?.addEventListener('click', () => {
      const geojson = exportToGeoJSON(this.farmData);
      this.downloadFile(geojson, 'myroca_fazenda_rio_verde.geojson', 'application/geo+json');
      this.showToast(t('toastExportGeoJSON'));
      this.closeModals();
    });

    document.getElementById('btn-export-kml')?.addEventListener('click', () => {
      const kml = exportToKML(this.farmData);
      this.downloadFile(kml, 'myroca_fazenda_rio_verde.kml', 'application/vnd.google-earth.kml+xml');
      this.showToast(t('toastExportKML'));
      this.closeModals();
    });

    // Sidebar Drawer
    const drawer = document.getElementById('sidebar-drawer');
    document.getElementById('btn-toggle-drawer')?.addEventListener('click', () => {
      drawer?.classList.toggle('open');
      this.renderDrawerLists();
    });

    document.getElementById('btn-close-drawer')?.addEventListener('click', () => {
      drawer?.classList.remove('open');
    });

    // Drawer Tabs
    const tabTalhoes = document.getElementById('tab-talhoes');
    const tabWater = document.getElementById('tab-water');
    const contentTalhoes = document.getElementById('drawer-content-talhoes');
    const contentWater = document.getElementById('drawer-content-water');

    tabTalhoes?.addEventListener('click', () => {
      tabTalhoes.classList.add('active');
      tabWater?.classList.remove('active');
      if (contentTalhoes) contentTalhoes.style.display = 'flex';
      if (contentWater) contentWater.style.display = 'none';
    });

    tabWater?.addEventListener('click', () => {
      tabWater.classList.add('active');
      tabTalhoes?.classList.remove('active');
      if (contentTalhoes) contentTalhoes.style.display = 'none';
      if (contentWater) contentWater.style.display = 'flex';
    });

    // Demo Data / Reset
    document.getElementById('btn-load-demo')?.addEventListener('click', () => {
      this.farmData = resetToDemoFarm();
      this.updateUI();
      this.renderFarmOnMap();
      this.mapManager.fitBoundsToFarm(this.farmData.talhoes, this.farmData.waterPoints);
      this.farmGameView?.updateFarmData(this.farmData, this.referenceDate);
      this.farmGameView?.fitToBounds(0.08);
      this.showToast(t('toastDemoLoaded'));
    });

    document.getElementById('btn-clear-all')?.addEventListener('click', () => {
      if (confirm(t('confirmClearAll'))) {
        this.farmData = clearAllFarmData();
        this.updateUI();
        this.renderFarmOnMap();
        this.farmGameView?.updateFarmData(this.farmData, this.referenceDate);
        this.farmGameView?.fitToBounds(0.08);
        this.showToast(t('toastAllCleared'));
      }
    });

    // Center Farm on Map / Game
    document.getElementById('btn-center-farm')?.addEventListener('click', () => {
      if (this.activeViewMode === 'fazenda') {
        this.farmGameView?.fitToBounds(0.08);
      } else {
        this.mapManager.fitBoundsToFarm(this.farmData.talhoes, this.farmData.waterPoints);
      }
    });

    // Keyboard Shortcuts (Esc to cancel, Ctrl+Z to undo drawing)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.mapManager.cancelDrawing();
        this.mapManager.endPlacingWaterPoint();
        this.hideHUDs();
        this.closeModals();
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        this.mapManager.undoLastDrawingPoint();
      }
    });
  }

  // ==========================================
  // MODALS & HUD WORKFLOW
  // ==========================================

  private startDrawingTalhao(): void {
    this.hideHUDs();
    const hud = document.getElementById('drawing-hud');
    if (hud) hud.style.display = 'flex';
    this.mapManager.startDrawingTalhao();
    this.showToast(t('toastDrawingStarted'));
  }

  private startPlacingWater(type: WaterPointType): void {
    this.hideHUDs();
    this.selectedWaterType = type;
    const hud = document.getElementById('water-hud');
    const iconEl = document.getElementById('water-hud-icon');
    const textEl = document.getElementById('water-hud-text');
    const meta = WATER_POINT_META[type];

    if (iconEl) iconEl.innerText = meta.icon;
    if (textEl) textEl.innerText = t('hudMarking', { label: translateStructureType(type) });
    if (hud) hud.style.display = 'flex';

    this.mapManager.startPlacingWaterPoint(type);
    this.showToast(t('toastPlaceOnMap', { label: translateStructureType(type) }));
  }

  private hideHUDs(): void {
    const drawingHud = document.getElementById('drawing-hud');
    const waterHud = document.getElementById('water-hud');
    if (drawingHud) drawingHud.style.display = 'none';
    if (waterHud) waterHud.style.display = 'none';
  }

  private openTalhaoModal(
    name: string,
    crop: string,
    color: string,
    areaHa: number,
    perimeterKm: number,
    notes: string,
    cultivar = '',
    plantingDate = '',
    cycleDays?: number
  ): void {
    this.hideHUDs();

    const titleEl = document.getElementById('modal-talhao-title');
    const areaEl = document.getElementById('modal-talhao-area');
    const perimEl = document.getElementById('modal-talhao-perimeter');
    const nameInput = document.getElementById('input-talhao-name') as HTMLInputElement | null;
    const cropSelect = document.getElementById('select-talhao-crop') as HTMLSelectElement | null;
    const cropOtherInput = document.getElementById('input-talhao-crop-other') as HTMLInputElement | null;
    const cultivarInput = document.getElementById('input-talhao-cultivar') as HTMLInputElement | null;
    const plantingInput = document.getElementById('input-talhao-planting-date') as HTMLInputElement | null;
    const cycleInput = document.getElementById('input-talhao-cycle-days') as HTMLInputElement | null;
    const notesInput = document.getElementById('input-talhao-notes') as HTMLTextAreaElement | null;
    const btnSkip = document.getElementById('btn-skip-import-step');

    if (titleEl) {
      if (this.importedTalhoesQueue.length > 0) {
        titleEl.innerHTML = `<span>📂</span> ${t('modalTitleImported', { n: this.importedTalhoesQueue.length })}`;
      } else {
        titleEl.innerHTML = this.editingTalhaoId ? `<span>✏️</span> ${t('modalTitleEdit')}` : `<span>🌾</span> ${t('modalTitleNew')}`;
      }
    }

    if (btnSkip) {
      btnSkip.style.display = this.importedTalhoesQueue.length > 0 ? 'inline-flex' : 'none';
    }

    if (areaEl) areaEl.innerText = formatHectares(areaHa);
    if (perimEl) perimEl.innerText = `${perimeterKm.toFixed(2)} km`;
    if (nameInput) nameInput.value = name;

    // Handle crop select and custom other crop input
    if (cropSelect) {
      const standardList = ['Soja', 'Milho', 'Pastagem', 'Feijão', 'Sorgo', 'Algodão', 'Cana-de-açúcar', 'Trigo'];
      if (!crop || !crop.trim()) {
        cropSelect.value = '';
        if (cropOtherInput) {
          cropOtherInput.style.display = 'none';
          cropOtherInput.value = '';
        }
      } else if (standardList.includes(crop)) {
        cropSelect.value = crop;
        if (cropOtherInput) {
          cropOtherInput.style.display = 'none';
          cropOtherInput.value = '';
        }
      } else {
        cropSelect.value = 'Outra';
        if (cropOtherInput) {
          cropOtherInput.style.display = 'block';
          cropOtherInput.value = crop;
        }
      }
    }

    if (cultivarInput) cultivarInput.value = cultivar;
    if (plantingInput) plantingInput.value = plantingDate;

    // Cycle days: use provided or auto-fill from standard crop
    if (cycleInput) {
      if (cycleDays !== undefined && cycleDays !== null) {
        cycleInput.value = String(cycleDays);
      } else if (crop && DEFAULT_CROP_CYCLES[crop] !== undefined && DEFAULT_CROP_CYCLES[crop] !== null) {
        cycleInput.value = String(DEFAULT_CROP_CYCLES[crop]);
      } else {
        cycleInput.value = '';
      }
    }

    if (notesInput) notesInput.value = notes;

    document.getElementById('modal-talhao')?.classList.add('show');
    nameInput?.focus();
  }

  private cancelOrSkipTalhaoModal(): void {
    if (this.importedTalhoesQueue.length > 0) {
      this.skipCurrentImportTalhao();
    } else {
      this.closeModals();
    }
  }

  private skipCurrentImportTalhao(): void {
    if (this.importedTalhoesQueue.length > 0) {
      const skipped = this.importedTalhoesQueue.shift();
      if (skipped) {
        if (!skipped.crop || !skipped.crop.trim()) {
          skipped.crop = '';
          skipped.color = getCropColor('');
        }
      }
      this.showToast(t('toastImportQueueSkipped'));
      this.processNextImportedTalhao();
    } else {
      this.closeModals();
    }
  }

  private processNextImportedTalhao(): void {
    if (this.importedTalhoesQueue.length === 0) {
      saveFarmData(this.farmData);
      this.closeModals();
      this.updateUI();
      this.renderFarmOnMap();
      this.farmGameView?.updateFarmData(this.farmData, this.referenceDate);
      this.farmGameView?.fitToBounds(0.08);
      this.showToast(t('toastImportQueueDone'));
      return;
    }

    const nextTalhao = this.importedTalhoesQueue[0];
    this.editingTalhaoId = nextTalhao.id;
    this.pendingTalhaoCoords = nextTalhao.coordinates;
    this.pendingTalhaoArea = nextTalhao.areaHectares;
    this.pendingTalhaoPerimeter = nextTalhao.perimeterKm;

    this.openTalhaoModal(
      nextTalhao.name,
      nextTalhao.crop || '',
      nextTalhao.color || getCropColor(nextTalhao.crop),
      nextTalhao.areaHectares,
      nextTalhao.perimeterKm,
      nextTalhao.notes || '',
      nextTalhao.cultivar || '',
      nextTalhao.plantingDate || '',
      nextTalhao.cycleDays
    );
  }

  private saveTalhaoFromModal(): void {
    const nameInput = document.getElementById('input-talhao-name') as HTMLInputElement | null;
    const cropSelect = document.getElementById('select-talhao-crop') as HTMLSelectElement | null;
    const cropOtherInput = document.getElementById('input-talhao-crop-other') as HTMLInputElement | null;
    const cultivarInput = document.getElementById('input-talhao-cultivar') as HTMLInputElement | null;
    const plantingInput = document.getElementById('input-talhao-planting-date') as HTMLInputElement | null;
    const cycleInput = document.getElementById('input-talhao-cycle-days') as HTMLInputElement | null;
    const notesInput = document.getElementById('input-talhao-notes') as HTMLTextAreaElement | null;

    const name = nameInput?.value.trim() || t('defaultTalhaoName', { n: this.farmData.talhoes.length + 1 });

    let crop = cropSelect?.value || '';
    if (crop === 'Outra') {
      crop = cropOtherInput?.value.trim() || 'Outra';
    }

    // Color is derived strictly from crop according to prompt specification
    const color = getCropColor(crop);

    const cultivar = cultivarInput?.value.trim() || '';
    const plantingDate = plantingInput?.value || undefined;
    const cycleDays = cycleInput && cycleInput.value.trim() !== '' ? parseInt(cycleInput.value, 10) : undefined;
    const notes = notesInput?.value.trim() || '';

    let harvestDateExpected: string | undefined = undefined;
    if (plantingDate && cycleDays && cycleDays > 0) {
      harvestDateExpected = calculateExpectedHarvestDate(plantingDate, cycleDays);
    }

    if (this.editingTalhaoId) {
      // Edit existing
      const talhao = this.farmData.talhoes.find((t) => t.id === this.editingTalhaoId);
      if (talhao) {
        talhao.name = name;
        talhao.crop = crop;
        talhao.cultivar = cultivar;
        talhao.plantingDate = plantingDate;
        talhao.cycleDays = cycleDays;
        talhao.harvestDateExpected = harvestDateExpected;
        talhao.color = color;
        talhao.notes = notes;
      }
      this.showToast(t('toastTalhaoUpdated', { name }));
    } else {
      // Create new
      const newTalhao: Talhao = {
        id: `talhao_${Date.now()}`,
        name,
        color,
        crop,
        cultivar,
        plantingDate,
        cycleDays,
        harvestDateExpected,
        areaHectares: this.pendingTalhaoArea,
        perimeterKm: this.pendingTalhaoPerimeter,
        coordinates: this.pendingTalhaoCoords,
        createdAt: new Date().toISOString(),
        notes,
      };

      this.farmData.talhoes.push(newTalhao);
      this.showToast(t('toastTalhaoSaved', { name, area: formatHectares(newTalhao.areaHectares) }));
    }

    saveFarmData(this.farmData);

    // If we're processing an imported talhoes queue, advance to next
    if (this.importedTalhoesQueue.length > 0) {
      this.importedTalhoesQueue.shift();
      this.processNextImportedTalhao();
    } else {
      this.closeModals();
      this.updateUI();
      this.renderFarmOnMap();
      this.farmGameView?.updateFarmData(this.farmData, this.referenceDate);
      this.farmGameView?.fitToBounds(0.08);
    }
  }

  // ==========================================
  // COORDINATE TABLE METHODS (TALHÃO)
  // ==========================================

  private openCoordsTalhaoModal(): void {
    this.hideHUDs();

    if (this.coordsTableRows.length === 0) {
      this.loadCoordsSample();
    } else {
      this.renderCoordsTable();
    }

    document.getElementById('modal-coords-talhao')?.classList.add('show');
  }

  private loadCoordsSample(): void {
    // 4 sample vertex coordinates in western rural grain belt of Rio Verde, Goiás
    const samplePoints = [
      { lat: '-17,8010', lng: '-51,0890' },
      { lat: '-17,8005', lng: '-51,0770' },
      { lat: '-17,8100', lng: '-51,0760' },
      { lat: '-17,8110', lng: '-51,0880' },
    ];

    this.coordsTableRows = samplePoints.map((pt) => parseCoordinatePair(pt.lat, pt.lng));
    this.renderCoordsTable();
    this.showToast(t('toastDemoCoordsLoaded'));
  }

  private addCoordRow(latStr = '', lngStr = ''): void {
    const newRow = parseCoordinatePair(latStr, lngStr);
    this.coordsTableRows.push(newRow);
    this.renderCoordsTable();

    // Auto-focus on new lat input
    setTimeout(() => {
      const inputs = document.querySelectorAll('.coord-input-lat');
      const lastInput = inputs[inputs.length - 1] as HTMLInputElement | null;
      lastInput?.focus();
    }, 50);
  }

  private removeCoordRow(id: string): void {
    this.coordsTableRows = this.coordsTableRows.filter((r) => r.id !== id);
    this.renderCoordsTable();
  }

  private fixAllBrazilNegatives(): void {
    this.coordsTableRows.forEach((row) => {
      if (row.isBrazilMissingNegative) {
        if (row.parsedLat && row.parsedLat > 0 && !row.latStr.trim().startsWith('-')) {
          row.latStr = `-${row.latStr.trim().replace(/^\+/, '')}`;
        }
        if (row.parsedLng && row.parsedLng > 0 && !row.lngStr.trim().startsWith('-')) {
          row.lngStr = `-${row.lngStr.trim().replace(/^\+/, '')}`;
        }
        const updated = parseCoordinatePair(row.latStr, row.lngStr);
        row.parsedLat = updated.parsedLat;
        row.parsedLng = updated.parsedLng;
        row.isValid = updated.isValid;
        row.error = updated.error;
        row.isBrazilMissingNegative = updated.isBrazilMissingNegative;
      }
    });

    this.renderCoordsTable();
    this.showToast(t('toastCoordsFixedNegative'));
  }

  private applyPastedCoordinates(rawText: string): void {
    const parsedRows = parsePastedCoordinateText(rawText);
    if (parsedRows.length === 0) {
      alert('Nenhuma coordenada válida foi identificada no texto colado. Verifique os valores.');
      return;
    }

    this.coordsTableRows = [...this.coordsTableRows, ...parsedRows];
    this.renderCoordsTable();
    this.showToast(t('toastCoordsProcessed', { count: parsedRows.length }));
  }

  private getCoordRowStatusHtml(row: CoordinateRow): string {
    if (row.isValid && row.parsedLat !== undefined && row.parsedLng !== undefined) {
      if (row.isBrazilMissingNegative) {
        return `<span class="coord-status-tag warning" title="${t('coordNoSignTip')}">⚠️ ${t('coordNoSign')}</span>`;
      }
      return `<span class="coord-status-tag valid">✓ ${row.parsedLat.toFixed(4)}, ${row.parsedLng.toFixed(4)}</span>`;
    }
    if (row.error && (row.latStr.trim() || row.lngStr.trim())) {
      return `<span class="coord-status-tag invalid" title="${row.error}">✕ ${row.error}</span>`;
    }
    return `<span style="font-size: 11px; color: #64748b;">${t('coordWaiting')}</span>`;
  }

  private updateCoordRowFromInput(rowId: string): void {
    const row = this.coordsTableRows.find((r) => r.id === rowId);
    if (!row) return;

    const updated = parseCoordinatePair(row.latStr, row.lngStr);
    row.parsedLat = updated.parsedLat;
    row.parsedLng = updated.parsedLng;
    row.isValid = updated.isValid;
    row.error = updated.error;
    row.isBrazilMissingNegative = updated.isBrazilMissingNegative;

    // Update specific DOM row elements in place without rebuilding inputs!
    const tr = document.getElementById(`coord-row-${rowId}`);
    if (tr) {
      tr.classList.toggle('row-invalid', !row.isValid && Boolean(row.latStr.trim() || row.lngStr.trim()));
      const statusCell = tr.querySelector('.coord-status-cell');
      if (statusCell) {
        statusCell.innerHTML = this.getCoordRowStatusHtml(row);
      }
      const latInput = tr.querySelector<HTMLInputElement>('.coord-input-lat');
      if (latInput) {
        latInput.classList.toggle('input-error', Boolean(row.error && !row.parsedLat));
      }
      const lngInput = tr.querySelector<HTMLInputElement>('.coord-input-lng');
      if (lngInput) {
        lngInput.classList.toggle('input-error', Boolean(row.error && !row.parsedLng));
      }
    }

    this.updateCoordsLiveSummary();
  }

  private updateCoordsLiveSummary(): void {
    const validCoords: [number, number][] = [];
    let hasAnyBrazilMissingNegative = false;

    this.coordsTableRows.forEach((row) => {
      if (row.isValid && row.parsedLat !== undefined && row.parsedLng !== undefined) {
        validCoords.push([row.parsedLat, row.parsedLng]);
      }
      if (row.isBrazilMissingNegative) {
        hasAnyBrazilMissingNegative = true;
      }
    });

    const liveAreaEl = document.getElementById('coords-live-area');
    const livePerimEl = document.getElementById('coords-live-perim');
    const liveCountEl = document.getElementById('coords-live-valid-count');
    const proceedBtn = document.getElementById('btn-proceed-coords-talhao') as HTMLButtonElement | null;
    const brazilAlert = document.getElementById('alert-brazil-negative');

    if (liveCountEl) {
      liveCountEl.innerText = `${validCoords.length} / ${this.coordsTableRows.length}`;
      liveCountEl.style.color = validCoords.length >= 3 ? '#34d399' : '#f59e0b';
    }

    if (brazilAlert) {
      brazilAlert.style.display = hasAnyBrazilMissingNegative ? 'flex' : 'none';
    }

    if (validCoords.length >= 3) {
      const areaHa = calculatePolygonAreaHectares(validCoords);
      const perimKm = calculatePerimeterKm(validCoords);

      if (liveAreaEl) liveAreaEl.innerText = formatHectares(areaHa);
      if (livePerimEl) livePerimEl.innerText = `${perimKm.toFixed(2)} km`;
      if (proceedBtn) {
        proceedBtn.disabled = false;
        proceedBtn.title = t('tipProceedNaming');
      }

      // Live satellite map preview!
      this.mapManager.previewTypedCoordinates(validCoords);
    } else {
      if (liveAreaEl) liveAreaEl.innerText = t('liveAreaMin', { area: formatHectaresI18n(0) });
      if (livePerimEl) livePerimEl.innerText = '0,00 km';
      if (proceedBtn) {
        proceedBtn.disabled = true;
        proceedBtn.title = t('tipNeedThreePoints');
      }

      if (validCoords.length > 0) {
        this.mapManager.previewTypedCoordinates(validCoords);
      } else {
        this.mapManager.clearTypedPreview();
      }
    }
  }

  private renderCoordsTable(): void {
    const tbody = document.getElementById('coords-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    this.coordsTableRows.forEach((row, index) => {
      const tr = document.createElement('tr');
      tr.id = `coord-row-${row.id}`;
      if (!row.isValid && (row.latStr.trim() || row.lngStr.trim())) {
        tr.classList.add('row-invalid');
      }

      const statusHtml = this.getCoordRowStatusHtml(row);

      tr.innerHTML = `
        <td class="coord-row-num">${index + 1}</td>
        <td>
          <input
            type="text"
            class="coord-input coord-input-lat ${row.error && !row.parsedLat ? 'input-error' : ''}"
            value="${row.latStr}"
            placeholder="${t('exPrefix')} -17,7924 ${t('orWord')} 17°47'32&quot;S"
            data-id="${row.id}"
          />
        </td>
        <td>
          <input
            type="text"
            class="coord-input coord-input-lng ${row.error && !row.parsedLng ? 'input-error' : ''}"
            value="${row.lngStr}"
            placeholder="${t('exPrefix')} -50,9192 ${t('orWord')} 50°55'09&quot;W"
            data-id="${row.id}"
          />
        </td>
        <td class="coord-status-cell">${statusHtml}</td>
        <td style="text-align: center;">
          <button type="button" class="btn-remove-row" data-id="${row.id}" title="${t('tipRemovePoint')}">
            🗑️
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    // Wire live input listeners for lat/lng changes
    tbody.querySelectorAll<HTMLInputElement>('.coord-input-lat').forEach((input) => {
      input.addEventListener('input', (e) => {
        const id = (e.target as HTMLElement).getAttribute('data-id');
        const val = (e.target as HTMLInputElement).value;
        const row = this.coordsTableRows.find((r) => r.id === id);
        if (row) {
          row.latStr = val; // Store value without redrawing DOM while typing!
        }
      });

      input.addEventListener('blur', (e) => {
        const id = (e.target as HTMLElement).getAttribute('data-id');
        if (id) this.updateCoordRowFromInput(id);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const id = (e.target as HTMLElement).getAttribute('data-id');
          if (id) {
            this.updateCoordRowFromInput(id);
            const tr = document.getElementById(`coord-row-${id}`);
            tr?.querySelector<HTMLInputElement>('.coord-input-lng')?.focus();
          }
        }
      });
    });

    tbody.querySelectorAll<HTMLInputElement>('.coord-input-lng').forEach((input) => {
      input.addEventListener('input', (e) => {
        const id = (e.target as HTMLElement).getAttribute('data-id');
        const val = (e.target as HTMLInputElement).value;
        const row = this.coordsTableRows.find((r) => r.id === id);
        if (row) {
          row.lngStr = val; // Store value without redrawing DOM while typing!
        }
      });

      input.addEventListener('blur', (e) => {
        const id = (e.target as HTMLElement).getAttribute('data-id');
        if (id) this.updateCoordRowFromInput(id);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const id = (e.target as HTMLElement).getAttribute('data-id');
          if (id) {
            this.updateCoordRowFromInput(id);
            const currIdx = this.coordsTableRows.findIndex((r) => r.id === id);
            if (currIdx >= 0 && currIdx < this.coordsTableRows.length - 1) {
              const nextId = this.coordsTableRows[currIdx + 1].id;
              const nextTr = document.getElementById(`coord-row-${nextId}`);
              nextTr?.querySelector<HTMLInputElement>('.coord-input-lat')?.focus();
            } else if (currIdx === this.coordsTableRows.length - 1) {
              this.addCoordRow();
            }
          }
        }
      });
    });

    tbody.querySelectorAll('.btn-remove-row').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).getAttribute('data-id');
        if (id) this.removeCoordRow(id);
      });
    });

    this.updateCoordsLiveSummary();
  }

  private proceedFromCoordsToTalhao(): void {
    const validCoords: [number, number][] = [];
    this.coordsTableRows.forEach((r) => {
      if (r.isValid && r.parsedLat !== undefined && r.parsedLng !== undefined) {
        validCoords.push([r.parsedLat, r.parsedLng]);
      }
    });

    if (validCoords.length < 3) {
      alert('É necessário ter pelo menos 3 pontos válidos para criar o contorno do talhão.');
      return;
    }

    const areaHa = calculatePolygonAreaHectares(validCoords);
    const perimeterKm = calculatePerimeterKm(validCoords);

    this.pendingTalhaoCoords = validCoords;
    this.pendingTalhaoArea = areaHa;
    this.pendingTalhaoPerimeter = perimeterKm;
    this.editingTalhaoId = null;

    this.selectedTalhaoColor = getPaletteColor(this.farmData.talhoes.length);

    this.closeModals();

    // Open Step 2: Name, crop, and block color selection
    this.openTalhaoModal(
      t('defaultTalhaoName', { n: this.farmData.talhoes.length + 1 }),
      '',
      this.selectedTalhaoColor,
      areaHa,
      perimeterKm,
      t('noteCreatedByCoords', { count: validCoords.length })
    );
  }

  // ==========================================
  // WATER POINT METHODS (COORDINATES & MAP)
  // ==========================================

  private openWaterModalManual(): void {
    this.hideHUDs();

    const nameInput = document.getElementById('input-water-name') as HTMLInputElement | null;
    const latInput = document.getElementById('input-water-lat') as HTMLInputElement | null;
    const lngInput = document.getElementById('input-water-lng') as HTMLInputElement | null;
    const notesInput = document.getElementById('input-water-notes') as HTMLTextAreaElement | null;

    const meta = WATER_POINT_META[this.selectedWaterType];
    const defaultName = `${meta.label} ${this.farmData.waterPoints.length + 1}`;

    if (nameInput) nameInput.value = defaultName;
    if (latInput) latInput.value = '-17.8050';
    if (lngInput) lngInput.value = '-51.0850';
    if (notesInput) notesInput.value = '';

    this.validateWaterInputs();

    document.getElementById('modal-water')?.classList.add('show');
    latInput?.focus();
  }

  private openWaterModal(lat: number, lng: number): void {
    this.hideHUDs();

    const nameInput = document.getElementById('input-water-name') as HTMLInputElement | null;
    const latInput = document.getElementById('input-water-lat') as HTMLInputElement | null;
    const lngInput = document.getElementById('input-water-lng') as HTMLInputElement | null;
    const notesInput = document.getElementById('input-water-notes') as HTMLTextAreaElement | null;

    const meta = WATER_POINT_META[this.selectedWaterType];
    const defaultName = `${meta.label} ${this.farmData.waterPoints.length + 1}`;

    if (nameInput) nameInput.value = defaultName;
    if (latInput) latInput.value = lat.toFixed(5);
    if (lngInput) lngInput.value = lng.toFixed(5);
    if (notesInput) notesInput.value = '';

    // Set selected type card
    document.querySelectorAll('.water-type-card').forEach((c) => {
      if (c.getAttribute('data-type') === this.selectedWaterType) {
        c.classList.add('selected');
      } else {
        c.classList.remove('selected');
      }
    });

    this.validateWaterInputs();

    document.getElementById('modal-water')?.classList.add('show');
    nameInput?.focus();
  }

  private validateWaterInputs(): boolean {
    const latInput = document.getElementById('input-water-lat') as HTMLInputElement | null;
    const lngInput = document.getElementById('input-water-lng') as HTMLInputElement | null;
    const statusEl = document.getElementById('water-coord-status');
    const brazilAlert = document.getElementById('alert-brazil-water-negative');

    const latStr = latInput?.value.trim() || '';
    const lngStr = lngInput?.value.trim() || '';

    if (!latStr && !lngStr) {
      if (statusEl) statusEl.innerHTML = '';
      if (brazilAlert) brazilAlert.style.display = 'none';
      return false;
    }

    const parsed = parseCoordinatePair(latStr, lngStr);

    if (brazilAlert) {
      brazilAlert.style.display = parsed.isBrazilMissingNegative ? 'flex' : 'none';
    }

    if (parsed.isValid && parsed.parsedLat !== undefined && parsed.parsedLng !== undefined) {
      this.pendingWaterCoords = [parsed.parsedLat, parsed.parsedLng];
      if (statusEl) {
        statusEl.innerHTML = `<span style="color: #4ade80; font-weight: 600;">✓ ${t('coordValid')}: ${parsed.parsedLat.toFixed(5)}, ${parsed.parsedLng.toFixed(5)}</span>`;
      }
      // Live map preview for the water point!
      this.mapManager.previewTypedWaterPoint(parsed.parsedLat, parsed.parsedLng, this.selectedWaterType);
      return true;
    } else {
      this.pendingWaterCoords = null;
      if (statusEl) {
        statusEl.innerHTML = `<span style="color: #f87171; font-weight: 600;">✕ ${parsed.error || 'Coordenada incompleta ou fora dos limites.'}</span>`;
      }
      return false;
    }
  }

  private fixWaterNegativeCoordinates(): void {
    const latInput = document.getElementById('input-water-lat') as HTMLInputElement | null;
    const lngInput = document.getElementById('input-water-lng') as HTMLInputElement | null;

    if (latInput && !latInput.value.trim().startsWith('-')) {
      latInput.value = `-${latInput.value.trim().replace(/^\+/, '')}`;
    }
    if (lngInput && !lngInput.value.trim().startsWith('-')) {
      lngInput.value = `-${lngInput.value.trim().replace(/^\+/, '')}`;
    }

    this.validateWaterInputs();
    this.showToast(t('toastCoordsFixedNegative'));
  }

  private saveWaterFromModal(): void {
    const isValid = this.validateWaterInputs();
    if (!isValid || !this.pendingWaterCoords) {
      alert('Por favor, informe coordenadas de latitude e longitude válidas antes de salvar.');
      return;
    }

    const nameInput = document.getElementById('input-water-name') as HTMLInputElement | null;
    const notesInput = document.getElementById('input-water-notes') as HTMLTextAreaElement | null;

    const name = nameInput?.value.trim() || `${WATER_POINT_META[this.selectedWaterType].label} ${this.farmData.waterPoints.length + 1}`;
    const notes = notesInput?.value.trim() || '';

    const newWp: WaterPoint = {
      id: `water_${Date.now()}`,
      name,
      type: this.selectedWaterType,
      coordinates: this.pendingWaterCoords,
      createdAt: new Date().toISOString(),
      notes,
    };

    this.farmData.waterPoints.push(newWp);
    saveFarmData(this.farmData);
    this.closeModals();
    this.updateUI();
    this.renderFarmOnMap();
    this.farmGameView?.updateFarmData(this.farmData, this.referenceDate);
    this.showToast(t('toastWaterSaved', { name }));
  }

  private deleteTalhao(talhaoId: string): void {
    const talhao = this.farmData.talhoes.find((t) => t.id === talhaoId);
    const name = talhao ? talhao.name : t('fallbackTalhao');

    if (confirm(t('confirmDeleteTalhao', { name }))) {
      this.farmData.talhoes = this.farmData.talhoes.filter((t) => t.id !== talhaoId);
      saveFarmData(this.farmData);
      this.updateUI();
      this.renderFarmOnMap();
      this.farmGameView?.updateFarmData(this.farmData, this.referenceDate);
      this.farmGameView?.fitToBounds(0.08);
      this.showToast(t('toastTalhaoRemoved', { name }));
    }
  }

  private deleteWaterPoint(waterPointId: string): void {
    const wp = this.farmData.waterPoints.find((w) => w.id === waterPointId);
    const name = wp ? wp.name : t('fallbackWaterPoint');

    if (confirm(t('confirmDeleteWater', { name }))) {
      this.farmData.waterPoints = this.farmData.waterPoints.filter((w) => w.id !== waterPointId);
      saveFarmData(this.farmData);
      this.updateUI();
      this.renderFarmOnMap();
      this.farmGameView?.updateFarmData(this.farmData, this.referenceDate);
      this.farmGameView?.fitToBounds(0.08);
      this.showToast(t('toastWaterRemoved', { name }));
    }
  }

  private closeModals(): void {
    document.querySelectorAll('.modal-overlay').forEach((m) => m.classList.remove('show'));
    this.editingTalhaoId = null;
    this.pendingWaterCoords = null;
    this.mapManager.clearTypedPreview();
    this.coordsTableRows = [];

    const tbody = document.getElementById('coords-table-body');
    if (tbody) tbody.innerHTML = '';
    const liveArea = document.getElementById('coords-live-area');
    if (liveArea) liveArea.textContent = '0,00 ha';
    const livePerim = document.getElementById('coords-live-perim');
    if (livePerim) livePerim.textContent = '0,00 km';
    const liveCount = document.getElementById('coords-live-valid-count');
    if (liveCount) {
      liveCount.textContent = '0 / 0';
      liveCount.style.color = '#34d399';
    }
    const btnProceed = document.getElementById('btn-proceed-coords-talhao') as HTMLButtonElement | null;
    if (btnProceed) btnProceed.disabled = true;
    const alertBox = document.getElementById('alert-brazil-negative');
    if (alertBox) alertBox.style.display = 'none';
  }

  // ==========================================
  // FILE IMPORT / EXPORT
  // ==========================================

  private handleFileUpload(file: File): void {
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) return;

      try {
        let imported: { talhoes: Talhao[]; waterPoints: WaterPoint[] };

        const isKML = file.name.toLowerCase().endsWith('.kml') || content.includes('<kml');

        if (isKML) {
          imported = parseKML(content);
        } else {
          imported = parseGeoJSON(content);
        }

        if (imported.talhoes.length === 0 && imported.waterPoints.length === 0) {
          alert('Nenhum polígono de talhão ou ponto de água foi detectado no arquivo.');
          return;
        }

        const keepExisting = (document.getElementById('check-keep-existing') as HTMLInputElement | null)?.checked ?? true;

        // Ensure proper crop colors
        imported.talhoes.forEach((t) => {
          if (!t.crop || !t.crop.trim()) {
            t.crop = '';
            t.color = getCropColor('');
          } else {
            t.color = getCropColor(t.crop);
          }
        });

        if (keepExisting) {
          this.farmData.talhoes = [...this.farmData.talhoes, ...imported.talhoes];
          this.farmData.waterPoints = [...this.farmData.waterPoints, ...imported.waterPoints];
        } else {
          this.farmData.talhoes = imported.talhoes;
          this.farmData.waterPoints = imported.waterPoints;
        }

        saveFarmData(this.farmData);
        this.closeModals();
        this.updateUI();
        this.renderFarmOnMap();
        this.mapManager.fitBoundsToFarm(this.farmData.talhoes, this.farmData.waterPoints);
        this.farmGameView?.updateFarmData(this.farmData, this.referenceDate);
        this.farmGameView?.fitToBounds(0.08);

        const totalHa = imported.talhoes.reduce((acc, t) => acc + t.areaHectares, 0);
        this.showToast(
          t('toastImportSuccess', {
            talhoes: imported.talhoes.length,
            area: formatHectares(totalHa),
            water: imported.waterPoints.length,
          })
        );

        // Requirement 4: automatically open modal form for each newly imported talhão, one by one
        if (imported.talhoes.length > 0) {
          this.importedTalhoesQueue = [...imported.talhoes];
          setTimeout(() => {
            this.processNextImportedTalhao();
          }, 400);
        }
      } catch (err) {
        console.error('Erro na importação:', err);
        alert('Erro ao processar o arquivo. Verifique se é um arquivo KML ou GeoJSON válido.');
      }
    };

    reader.readAsText(file);
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ==========================================
  // UI SYNC & DRAWER
  // ==========================================

  private updateUI(): void {
    const totalTalhoes = this.farmData.talhoes.length;
    const totalHectares = this.farmData.talhoes.reduce((sum, t) => sum + t.areaHectares, 0);
    const totalWater = this.farmData.waterPoints.length;

    const statCountEl = document.getElementById('stat-talhoes-count');
    const statAreaEl = document.getElementById('stat-total-hectares');
    const statWaterEl = document.getElementById('stat-water-count');
    const drawerTalhoesCountEl = document.getElementById('drawer-talhoes-count');
    const drawerWaterCountEl = document.getElementById('drawer-water-count');

    if (statCountEl) statCountEl.innerText = String(totalTalhoes);
    if (statAreaEl) statAreaEl.innerText = formatHectares(totalHectares);
    if (statWaterEl) statWaterEl.innerText = String(totalWater);
    if (drawerTalhoesCountEl) drawerTalhoesCountEl.innerText = String(totalTalhoes);
    if (drawerWaterCountEl) drawerWaterCountEl.innerText = String(totalWater);

    // Usabilidade 6: Mostre o painel "Marque aqui as áreas da sua fazenda" só quando não houver talhões cadastrados
    const banner = document.getElementById('farm-guidance-banner');
    if (banner) {
      banner.style.display = totalTalhoes === 0 ? 'flex' : 'none';
    }

    this.renderDrawerLists();
  }

  private renderFarmOnMap(): void {
    this.mapManager.renderTalhoes(this.farmData.talhoes, this.referenceDate);
    this.mapManager.renderWaterPoints(this.farmData.waterPoints);
  }

  private renderDrawerLists(): void {
    const exampleTag = t('exampleBadge').toLowerCase();
    const nextCropText = (crop: string, date: string) => t('nextCropShort', { crop, date });
    // 1. Talhões
    const talhoesContent = document.getElementById('drawer-content-talhoes');
    if (talhoesContent) {
      if (this.farmData.talhoes.length === 0) {
        talhoesContent.innerHTML = `
          <div style="text-align: center; padding: 32px 16px; color: #94a3b8; font-size: 13px;">
            Nenhum talhão cadastrado ainda.<br />
            Clique em <strong>+ Novo Talhão</strong> para desenhar ou digitar coordenadas.
          </div>
        `;
      } else {
        talhoesContent.innerHTML = this.farmData.talhoes
          .map((t) => {
            const cropStatus = calculateTalhaoCropStatus(t, this.referenceDate);
            return `
          <div class="drawer-card" data-id="${t.id}">
            <div class="drawer-card-header">
              <div class="drawer-card-title-group">
                <div class="drawer-color-block" style="background-color: ${t.color}"></div>
                <div>
                  <div class="drawer-card-title">
                    ${t.name}
                    ${t.isExample ? `<span class="badge-exemplo">${exampleTag}</span>` : ''}
                  </div>
                  <div style="display: flex; gap: 6px; align-items: center; margin-top: 3px;">
                    <span style="background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.3); color: #4ade80; padding: 1px 7px; border-radius: 9999px; font-size: 11px; font-weight: 700;">
                      ${cropStatus.phase.icon} ${cropStatus.stageBadgeText}
                    </span>
                  </div>
                </div>
              </div>
              <div class="drawer-card-ha">${formatHectares(t.areaHectares)}</div>
            </div>
            <div class="drawer-card-meta">
              <span>🌾 ${translateCropName(t.crop)} ${t.cultivar ? `(${t.cultivar})` : ''}</span>
              <span>📏 ${t.perimeterKm.toFixed(2)} km</span>
            </div>
            ${t.nextCropPlan ? `<div style="font-size: 11px; color: #38bdf8; margin: 4px 0;">🔜 ${nextCropText(t.nextCropPlan.crop, t.nextCropPlan.plannedPlanting)}</div>` : ''}
            <div class="drawer-card-actions">
              <button class="drawer-btn btn-calendar" data-id="${t.id}" style="color: #38bdf8; font-weight: 700;">📅 Calendário</button>
              <button class="drawer-btn btn-focus" data-id="${t.id}">🎯 Focar</button>
              <button class="drawer-btn btn-edit" data-id="${t.id}">✏️ Editar</button>
              <button class="drawer-btn btn-delete" data-id="${t.id}" style="color: #f87171;">🗑️</button>
            </div>
          </div>
        `;
          })
          .join('');

        // Wire actions
        talhoesContent.querySelectorAll('.btn-calendar').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = (btn as HTMLElement).getAttribute('data-id');
            if (id) this.openCropCalendarModal(id);
          });
        });

        talhoesContent.querySelectorAll('.btn-focus').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = (btn as HTMLElement).getAttribute('data-id');
            const talhao = this.farmData.talhoes.find((t) => t.id === id);
            if (talhao) {
              if (this.activeViewMode === 'fazenda') {
                this.switchViewMode('mapa');
              }
              this.mapManager.fitBoundsToTalhao(talhao);
              document.getElementById('sidebar-drawer')?.classList.remove('open');
            }
          });
        });

        talhoesContent.querySelectorAll('.btn-edit').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = (btn as HTMLElement).getAttribute('data-id');
            const talhao = this.farmData.talhoes.find((t) => t.id === id);
            if (talhao) {
              this.editingTalhaoId = talhao.id;
              this.pendingTalhaoCoords = talhao.coordinates;
              this.pendingTalhaoArea = talhao.areaHectares;
              this.pendingTalhaoPerimeter = talhao.perimeterKm;
              this.selectedTalhaoColor = talhao.color;
              this.openTalhaoModal(
                talhao.name,
                talhao.crop || '',
                talhao.color,
                talhao.areaHectares,
                talhao.perimeterKm,
                talhao.notes || '',
                talhao.cultivar || '',
                talhao.plantingDate || '',
                talhao.cycleDays
              );
            }
          });
        });

        talhoesContent.querySelectorAll('.btn-delete').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = (btn as HTMLElement).getAttribute('data-id');
            if (id) this.deleteTalhao(id);
          });
        });
      }
    }

    // 2. Rural Elements and Water Points
    const waterContent = document.getElementById('drawer-content-water');
    if (waterContent) {
      if (this.farmData.waterPoints.length === 0) {
        waterContent.innerHTML = `
          <div style="text-align: center; padding: 32px 16px; color: #94a3b8; font-size: 13px;">
            Nenhum elemento cadastrado.<br />
            Clique em <strong>📍 Estruturas e Água</strong> para marcar.
          </div>
        `;
      } else {
        waterContent.innerHTML = this.farmData.waterPoints
          .map((wp) => {
            const meta = FARM_ELEMENT_META[wp.type] || WATER_POINT_META[wp.type] || {
              icon: '📍',
              label: 'Elemento',
              color: '#38bdf8',
              badgeBg: 'rgba(56, 189, 248, 0.2)',
            };
            return `
            <div class="drawer-card" data-id="${wp.id}">
              <div class="drawer-card-header">
                <div class="drawer-card-title-group">
                  <span style="font-size: 20px;">${meta.icon}</span>
                  <div>
                    <div class="drawer-card-title">
                      ${wp.name}
                      ${wp.isExample ? `<span class="badge-exemplo">${exampleTag}</span>` : ''}
                    </div>
                    <span class="water-type-pill" style="background-color: ${meta.badgeBg}; color: ${meta.color}">
                      ${meta.label}
                    </span>
                  </div>
                </div>
              </div>
              <div class="drawer-card-meta">
                <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px;">
                  ${wp.coordinates[0].toFixed(4)}, ${wp.coordinates[1].toFixed(4)}
                </span>
                ${wp.notes ? `<span title="${wp.notes}">📝 ${t('drawerNote')}</span>` : ''}
              </div>
              <div class="drawer-card-actions">
                <button class="drawer-btn btn-focus-water" data-id="${wp.id}">🎯 ${t('drawerLocate')}</button>
                <button class="drawer-btn btn-delete-water" data-id="${wp.id}" style="color: #f87171;">🗑️ ${t('drawerDelete')}</button>
              </div>
            </div>
          `;
          })
          .join('');

        waterContent.querySelectorAll('.btn-focus-water').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = (btn as HTMLElement).getAttribute('data-id');
            const wp = this.farmData.waterPoints.find((w) => w.id === id);
            if (wp) {
              if (this.activeViewMode === 'fazenda') {
                this.switchViewMode('mapa');
              }
              this.mapManager.panTo(wp.coordinates[0], wp.coordinates[1], 16);
              document.getElementById('sidebar-drawer')?.classList.remove('open');
            }
          });
        });

        waterContent.querySelectorAll('.btn-delete-water').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = (btn as HTMLElement).getAttribute('data-id');
            if (id) this.deleteWaterPoint(id);
          });
        });
      }
    }
  }

  private showToast(message: string): void {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }
}

// Initialise application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  requireAuth().then(() => new AgroApp());
});
