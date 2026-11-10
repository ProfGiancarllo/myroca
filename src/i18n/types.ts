export type LanguageCode = 'pt' | 'es' | 'en' | 'de' | 'zh' | 'fr';

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  flag: string;
  shortLabel: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'pt', label: 'Português', flag: '🇧🇷', shortLabel: 'PT' },
  { code: 'es', label: 'Español', flag: '🇪🇸', shortLabel: 'ES' },
  { code: 'en', label: 'English', flag: '🇺🇸', shortLabel: 'EN' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪', shortLabel: 'DE' },
  { code: 'zh', label: '简体中文', flag: '🇨🇳', shortLabel: 'ZH' },
  { code: 'fr', label: 'Français', flag: '🇫🇷', shortLabel: 'FR' },
];

export interface TranslationDictionary {
  // Brand & Nav
  brandSubtitle: string;
  modeRealMap: string;
  modeRealMapTitle: string;
  modeMyFarm: string;
  modeMyFarmTitle: string;
  statTalhoes: string;
  statTalhoesTitle: string;
  statTotalArea: string;
  statTotalAreaTitle: string;
  statWaterStructures: string;
  statWaterStructuresTitle: string;

  // Header buttons & menus
  btnNewTalhao: string;
  btnNewTalhaoTitle: string;
  optDrawTalhao: string;
  optTypeCoordsTalhao: string;
  btnStructures: string;
  btnStructuresTitle: string;
  hdrRuralStructures: string;
  hdrWaterResources: string;
  btnMore: string;
  btnMoreTitle: string;
  btnImportFile: string;
  btnImportFileTitle: string;
  btnExportData: string;
  btnExportDataTitle: string;
  btnFarmDrawer: string;
  btnFarmDrawerTitle: string;
  btnCenterMap: string;
  btnCenterMapTitle: string;

  // Calendar top bar
  calAgroCalendar: string;
  calTodayPrefix: string;
  calAdvanceTimeWeek: string;
  calAdvanceWeekTitle: string;
  calOptions: string;
  calOptionsTitle: string;
  calOptAdvance1w: string;
  calOptAdvance2w: string;
  calOptAdvance4w: string;
  calOptRewind1w: string;
  calOptResetDate: string;

  // Crop names
  cropSoja: string;
  cropMilho: string;
  cropPastagem: string;
  cropFeijao: string;
  cropSorgo: string;
  cropAlgodao: string;
  cropCana: string;
  cropTrigo: string;
  cropOutra: string;
  cropSemCultura: string;

  // Crop cycle phases
  phasePlanejamento: string;
  phasePreparo: string;
  phasePlantio: string;
  phaseEmergencia: string;
  phaseCrescimento: string;
  phaseFloracao: string;
  phaseEnchimento: string;
  phaseColheita: string;
  phaseColhido: string;
  phasePastagemPerene: string;

  // Crop operations (Diário de safra)
  opPlantio: string;
  opAdubacao: string;
  opPulverizacao: string;
  opIrrigacao: string;
  opColheita: string;
  opManejoPasto: string;

  // Rural structures and water
  elemSede: string;
  elemCurral: string;
  elemSilo: string;
  elemEstrada: string;
  elemReserva: string;
  elemPivo: string;
  elemEstacaoMeteo: string;
  elemNascente: string;
  elemAcude: string;
  elemPoco: string;
  elemRio: string;
  optTypeCoordsWater: string;

  // Weather widget
  weatherTitle: string;
  weatherCondition: string;
  weatherTemp: string;
  weatherRain: string;
  weatherHumidity: string;
  weatherWind: string;
  weatherSoilMoisture: string;
  weatherExampleBadge: string;
  weatherRainForecast: string;

  // Legend & Floating panels
  legendTitle: string;
  legendCropsTitle: string;
  legendStructuresTitle: string;
  legendBordersNote: string;
  legendBorderGreen: string;
  legendBorderYellow: string;
  legendBorderRed: string;
  btnCollapsePanel: string;
  btnExpandPanel: string;
  btnZoomIn: string;
  btnZoomOut: string;
  btnResetView: string;

  // Agronomist (Eng. Tiago)
  agronomistTitle: string;
  agronomistSpeechAllHealthy: string;
  agronomistSpeechFlowering: string; // params: {talhao, crop}
  agronomistSpeechHarvest: string;   // params: {talhao, crop}
  agronomistSpeechGrowth: string;    // params: {talhao, crop, days, totalDays}
  agronomistSpeechPasture: string;   // params: {talhao}
  agronomistSpeechAttention: string; // params: {talhao, reason}
  btnMinimizeAgronomist: string;

  // Modal Save Talhão
  modalTalhaoTitleNew: string;
  modalTalhaoTitleEdit: string;
  modalTalhaoTitleImportQueue: string; // params: {remaining}
  lblTalhaoName: string;
  phTalhaoName: string;
  lblCrop: string;
  selChooseCrop: string;
  phCropOther: string;
  lblCultivar: string;
  phCultivar: string;
  lblPlantingDate: string;
  lblCycleDays: string;
  phCycleDays: string;
  hintPerennialPasture: string;
  hintCycleDefault: string; // params: {crop, days}
  lblNotes: string;
  phNotes: string;
  btnSkipImportStep: string;
  btnSaveTalhao: string;
  btnCancel: string;

  // Modal Coordinates
  modalCoordsTitle: string;
  modalCoordsSubtitle: string;
  thIndex: string;
  thLat: string;
  thLng: string;
  thStatus: string;
  thAction: string;
  statusValid: string;
  statusInvalid: string;
  btnAddRow: string;
  btnClearTable: string;
  btnLoadSample: string;
  btnFixNegatives: string;
  btnTogglePaste: string;
  phPasteCoords: string;
  btnApplyPaste: string;
  summaryValidPoints: string;
  summaryCalculatedArea: string;
  summaryPerimeter: string;
  btnProceedToTalhao: string;
  alertBrazilNegative: string;

  // Modal Water / Structure
  modalWaterTitleNew: string;
  modalWaterSubtitle: string;
  lblWaterName: string;
  phWaterName: string;
  lblWaterType: string;
  btnSaveWater: string;

  // Modal Import / Export
  modalImportTitle: string;
  modalImportDropzone: string;
  modalImportBtnSelect: string;
  modalImportFormats: string;
  chkKeepExisting: string;
  modalExportTitle: string;
  modalExportSubtitle: string;
  btnExportGeoJSON: string;
  btnExportKML: string;

  // Modal Crop Calendar
  modalCalendarTitle: string;
  lblCurrentCrop: string;
  lblCurrentCultivar: string;
  lblCurrentPlanting: string;
  lblCurrentCycle: string;
  lblExpectedHarvest: string;
  lblNextCropPlan: string;
  lblNextCrop: string;
  lblNextPlanting: string;
  lblHarvestHistory: string;
  btnAddHistoryItem: string;
  thSeason: string;
  thHarvestDate: string;
  thHistoryCrop: string;
  btnSaveCalendar: string;
  overlapWarning: string;

  // Drawer
  drawerTitle: string;
  tabTalhoes: string;
  tabWater: string;
  btnFocus: string;
  btnEdit: string;
  btnDelete: string;
  btnCalendar: string;
  badgeExample: string;
  badgeSemCultura: string;
  drawerEmptyTalhoes: string;
  drawerEmptyWater: string;
  drawerNextCrop: string;

  // Sheet (Minha Fazenda)
  sheetTalhaoTitle: string;
  sheetDaysPassed: string;
  sheetCycleProgress: string;
  sheetCycleDaysTotal: string;
  sheetExpectedHarvestDate: string;
  sheetNextCropPlanned: string;
  sheetHealthStatus: string;
  sheetHealthHealthy: string;
  sheetHealthAttention: string;
  sheetHealthAlert: string;
  sheetSoilMoistureGood: string;
  sheetAreaLabel: string;
  sheetPerimeterLabel: string;

  // HUDs
  drawingHudTitle: string;
  btnUndoPoint: string;
  btnFinishDrawing: string;
  btnCancelDrawing: string;
  waterHudTextPlacing: string;

  // Guidance Banner
  guidanceTitle: string;
  guidanceDesc: string;
  guidanceBtnTalhao: string;
  guidanceBtnElement: string;
  guidanceBtnDismiss: string;

  // Toasts & Messages
  toastDrawingStarted: string;
  toastDrawingPointAdded: string;
  toastDrawingPointUndone: string;
  toastDrawingFinished: string;
  toastTalhaoSaved: string; // params: {name, area}
  toastTalhaoUpdated: string; // params: {name}
  toastTalhaoRemoved: string; // params: {name}
  toastWaterSaved: string; // params: {name}
  toastWaterRemoved: string; // params: {name}
  toastImportSuccess: string; // params: {talhoes, area, water}
  toastImportQueueDone: string;
  toastImportQueueSkipped: string;
  toastDemoLoaded: string;
  toastAllCleared: string;
  toastDateAdvanced: string; // params: {date, days, weeks}
  toastDateReset: string;
  toastExportGeoJSON: string;
  toastExportKML: string;
  toastModeRealMap: string;
  toastModeMyFarm: string;
  confirmDeleteTalhao: string; // params: {name}
  confirmDeleteWater: string;  // params: {name}
  confirmClearAll: string;
  errNoPolygonDetected: string;
  errFileProcessing: string;
  errPasteEmpty: string;
  errCalendarOverlap: string;
}
