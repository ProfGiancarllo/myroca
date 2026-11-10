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

  // Textos fixos adicionais (fases, operações, avisos, exemplos)
  statusPasture: string;
  statusFallow: string;
  statusPrep: string;
  statusPlanning: string;
  statusPlanted: string;
  statusEmergence: string;
  statusGrowth: string;
  statusFlowering: string;
  statusFilling: string;
  statusMaturity: string;
  statusHarvested: string;
  unitDayShort: string;
  badgeFallow: string;
  badgePrep: string;
  badgePlanting: string;
  badgeFilling: string;
  badgeHarvestPoint: string;
  badgeHarvested: string;
  msgCropOverlap: string;
  msgOverlapDefault: string;
  tipFixDatesFirst: string;
  tipSaveCalendar: string;
  alertCropOverlap: string;
  labelPerennial: string;
  labelDayOf: string;
  cropFieldDefault: string;
  cropSojaPrecoce: string;
  cropPastagemBraquiaria: string;
  opNextPasture: string;
  opNextHarvest: string;
  opNextFilling: string;
  opNextFlowering: string;
  opNextGrowth: string;
  opNextEmergence: string;
  opNextPrep: string;
  opNextPlanning: string;
  toastCalendarUpdated: string;
  toastPlaceOnMap: string;
  toastDemoCoordsLoaded: string;
  toastCoordsFixedNegative: string;
  toastCoordsProcessed: string;
  demoNameTalhao01: string;
  demoNameTalhao02: string;
  demoNameTalhao03: string;
  demoNameSede: string;
  demoNameSilo: string;
  demoNameCurral: string;
  demoNamePivo: string;
  demoNameEstacao: string;
  demoNameEstrada: string;
  demoNameReserva: string;
  demoNameAcude: string;
  demoNameNascente: string;
  demoNamePoco: string;
  demoNameRio: string;
  confirmDeleteTalhao: string; // params: {name}
  confirmDeleteWater: string;  // params: {name}
  confirmClearAll: string;
  errNoPolygonDetected: string;
  errFileProcessing: string;
  errPasteEmpty: string;
  errCalendarOverlap: string;

  // chaves completadas
  markSede: string;
  markCurral: string;
  markSilo: string;
  markEstrada: string;
  markReserva: string;
  markPivo: string;
  markEstacao: string;
  markNascente: string;
  markAcude: string;
  markPoco: string;
  markRio: string;
  typePointCoords: string;
  drawOnMap: string;
  typeCoords: string;
  ruralStructures: string;
  waterResources: string;
  uploadMapFile: string;
  farmDashboard: string;
  advanceTimeWeek: string;
  cropOptionSoja: string;
  cropOptionMilho: string;
  cropOptionPastagem: string;
  cropOptionFeijao: string;
  cropOptionSorgo: string;
  cropOptionAlgodao: string;
  cropOptionCana: string;
  cropOptionTrigo: string;
  cropOptionOutra: string;
  fillLater: string;
  saveField: string;
  cancel: string;
  saveFieldModalTitle: string;
  selectCropPlaceholder: string;
  cultivarVariety: string;
  plantingDate: string;
  cropCycleDays: string;
  technicalNotes: string;
  selectFile: string;
  keepExistingData: string;
  importFieldsTitle: string;
  exportMappingTitle: string;
  chooseExportFormat: string;
  downloadGeoJSON: string;
  downloadKML: string;
  latitudeCol: string;
  longitudeCol: string;
  statusCol: string;
  actionCol: string;
  clearTable: string;
  processLines: string;
  saveCalendar: string;
  minimize: string;
  saveElement: string;
  zoomIn: string;
  zoomOut: string;
  centerFarm: string;
  collapseExpand: string;
  dropzoneText: string;
  dropzoneSubtext: string;
  guidanceHeadline: string;
  guidanceSubline: string;
  drawingTitle: string;
  drawingInstruction: string;
  undoPoint: string;
  finishDrawing: string;
  positioningElementDesc: string;
  typeCoordsModalTitle: string;
  typeCoordsModalSubtitle: string;
  calculatedArea: string;
  perimeter: string;
  validPoints: string;
  alertBrazilDesc: string;
  pasteTextareaPlaceholder: string;
  overlapWarningText: string;
  currentCrop: string;
  harvestForecast: string;
  plannedCrop: string;
  plannedPlantingDate: string;
  harvestHistoryTitle: string;
  registerFarmElement: string;
  selectElementType: string;
  latitude: string;
  longitude: string;
  withoutCrop: string;
  realMap: string;
  myFarm: string;
  fields: string;
  totalArea: string;
  structuresAndWater: string;
  newField: string;
  structures: string;
  more: string;
  exportData: string;
  centerMap: string;
  language: string;
  cropCalendar: string;
  referenceDate: string;
  today: string;
  exampleBadge: string;
  options: string;
  plus1Week: string;
  plus2Weeks: string;
  plus4Weeks: string;
  rewind1Week: string;
  resetToDefaultDate: string;
  farmElements: string;
  close: string;
  vertices: string;
  area: string;
  positioningElement: string;
  alertBrazilTitle: string;
  fixBrazilNegative: string;
  batchPasteTitle: string;
  batchPasteBtn: string;
  coordsTableInstructions: string;
  addPoint: string;
  rioVerdeSample: string;
  proceedAndSave: string;
  fieldName: string;
  mainCrop: string;
  cycleAutoFilled: string;
  calendarModalSubtitle: string;
  overlapWarningTitle: string;
  currentSeasonInField: string;
  nextPlannedSeason: string;
  addToHistory: string;
  ruralInfrastructure: string;
  elementName: string;
  geoCoordinates: string;
  coordsFormatHint: string;
  observationsAndDetails: string;
  compatibilityTip: string;
  compatibilityDesc: string;
  geojsonDesc: string;
  kmlDesc: string;
  restoreDemo: string;
  clearAllData: string;
  weatherAndLegend: string;
  weatherDesc: string;
  rain: string;
  humidity: string;
  wind: string;
  cropColors: string;
  legendStatusNote: string;
  tapForMoreAdvice: string;
  tapForDetails: string;
  sheetFieldArea: string;
  sheetCropPhase: string;
  sheetCropState: string;
  healthy: string;
  seasonTrackTitle: string;
  cropCycle: string;
  nextCrop: string;
  viewOnRealMap: string;
  agronomistSpeechNoTalhoes: string;
  defaultCultivar: string;
  notInformed: string;
  days: string;
  perennialNoCycle: string;
  toPlan: string;
  noHistoryYet: string;
  continuousPasture: string;
  dayProgress: string;
}
