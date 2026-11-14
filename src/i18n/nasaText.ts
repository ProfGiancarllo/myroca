import { getCurrentLanguage } from './index';
type D = Record<string, string>;

const pt: D = {
  btn: 'Dados NASA', title: 'Dados NASA', sub: 'Camadas de satélite no mapa, água nos talhões e de onde vêm os números.', close: 'Fechar',
  tabMap: 'Camadas no mapa', tabWater: 'Água nos talhões', tabSrc: 'Fontes e método',
  mapIntro: 'Marque as camadas que quer ver sobre o mapa. Os dados são da NASA (GIBS/Worldview), na data mais recente disponível.',
  ndvi: 'Vigor da vegetação (NDVI, MODIS)', rain: 'Chuva (GPM IMERG)', smap: 'Umidade do solo (SMAP)', lst: 'Temperatura da superfície (MODIS)',
  ndviD: 'Verde escuro indica lavoura vigorosa; tons marrons indicam solo exposto ou planta em estresse.',
  rainD: 'Taxa de chuva estimada por satélite, em mm/h.', smapD: 'Umidade da camada superficial do solo (cerca de 5 cm), em m³/m³.', lstD: 'Temperatura da superfície no período diurno, em °C.',
  lo: 'menor', hi: 'maior', unavail: 'Camada indisponível agora', coarse: 'Resolução grosseira: mostra a região da fazenda, não um talhão isolado.',
  waterIntro: 'Balanço dos últimos 30 dias e umidade do solo em cada talhão. Risco hídrico alto aumenta em um nível o risco do planejador de safra.',
  field: 'Talhão', rain30: 'Chuva 30 d (mm)', et0: 'Evapotransp. 30 d (mm)', bal: 'Balanço (mm)', soil: 'Umidade do solo', next3: 'Chuva prevista 3 d (mm)', risk: 'Risco hídrico',
  low: 'Baixo', medium: 'Médio', high: 'Alto', loadingW: 'Buscando dados…', failW: 'Sem dados no momento.', noFields: 'Mapeie talhões para calcular o risco hídrico.',
  waterNote: 'Balanço = chuva (NASA POWER, 30 dias) − evapotranspiração de referência (FAO-56, ERA5-Land). Umidade do solo: média de 0 a 100 cm do ERA5-Land. Limiares indicativos para solos de Cerrado; ajuste com análise de solo e manejo.',
  s1: 'Dados usados hoje', s2: 'Bases dos EUA que não se aplicam ao Brasil', s3: 'Equivalentes brasileiros previstos', s4: 'Limites do método',
  usedList: 'NASA POWER: chuva, temperatura e radiação diária por ponto (diário e planejador).|NASA GIBS (Worldview): NDVI MODIS, chuva GPM IMERG, umidade SMAP e temperatura MODIS no mapa.|ERA5-Land via Open-Meteo: umidade do solo e evapotranspiração por talhão.|Open-Meteo: previsão e clima recente, quando a NASA ainda não publicou o dia.|Preços: FRED, CBOT e ICE (soja, milho, trigo, algodão), convertidos pelo dólar/real.',
  usList: 'CDL e NASS (USDA): cultivos e estatísticas só dos EUA; no Brasil, MapBiomas e Conab.|NLCD, SSURGO e Web Soil Survey: solo e cobertura dos EUA; no Brasil, Embrapa e SoilGrids.|PRISM, CoCoRaHS e USGS NWIS: chuva e vazão dos EUA; no Brasil, INMET, CEMADEN e ANA.|OpenET, LANDFIRE e USDA AMS: evapotranspiração, combustível e preços dos EUA; aqui entram ERA5-Land e Cepea.',
  brList: 'MapBiomas: histórico de uso da terra por talhão.|INMET e CEMADEN: estações meteorológicas para o diário.|Embrapa e SoilGrids: classe e textura do solo.|Conab e Cepea: preços e custos regionais.|SRTM: declividade e risco de erosão.',
  limits: 'SMAP e IMERG têm 9 a 10 km de resolução: descrevem a região da fazenda, não um talhão. O risco por talhão usa o ERA5-Land (cerca de 9 km) no ponto central. Dados de satélite chegam com atraso de horas a dias. Estimativa de apoio ao planejamento; não substitui a medição no campo.',
};
const en: D = {
  btn: 'NASA data', title: 'NASA data', sub: 'Satellite map layers, field water and where the numbers come from.', close: 'Close',
  tabMap: 'Map layers', tabWater: 'Field water', tabSrc: 'Sources and method',
  mapIntro: 'Tick the layers to show over the map. Data from NASA (GIBS/Worldview), latest date available.',
  ndvi: 'Vegetation vigor (NDVI, MODIS)', rain: 'Rainfall (GPM IMERG)', smap: 'Soil moisture (SMAP)', lst: 'Surface temperature (MODIS)',
  ndviD: 'Dark green means vigorous crop; browns mean bare soil or stressed plants.',
  rainD: 'Satellite rain rate estimate, in mm/h.', smapD: 'Topsoil moisture (about 5 cm), in m³/m³.', lstD: 'Daytime land surface temperature, in °C.',
  lo: 'lower', hi: 'higher', unavail: 'Layer unavailable right now', coarse: 'Coarse resolution: shows the farm region, not a single field.',
  waterIntro: '30-day balance and soil moisture per field. High water risk raises the crop planner risk by one level.',
  field: 'Field', rain30: 'Rain 30 d (mm)', et0: 'Evapotransp. 30 d (mm)', bal: 'Balance (mm)', soil: 'Soil moisture', next3: 'Forecast rain 3 d (mm)', risk: 'Water risk',
  low: 'Low', medium: 'Medium', high: 'High', loadingW: 'Fetching data…', failW: 'No data right now.', noFields: 'Map fields to compute water risk.',
  waterNote: 'Balance = rain (NASA POWER, 30 days) − reference evapotranspiration (FAO-56). Soil moisture: 0–100 cm mean from ERA5-Land. Indicative thresholds for Cerrado soils.',
  s1: 'Data used today', s2: 'US datasets that do not apply to Brazil', s3: 'Planned Brazilian equivalents', s4: 'Method limits',
  usedList: 'NASA POWER: daily rain, temperature and radiation per point.|NASA GIBS (Worldview): MODIS NDVI, GPM IMERG rain, SMAP soil moisture and MODIS temperature on the map.|ERA5-Land via Open-Meteo: soil moisture and evapotranspiration per field.|Open-Meteo: forecast and recent weather when NASA has not published the day yet.|Prices: FRED, CBOT and ICE (soybean, corn, wheat, cotton), converted by the USD/BRL rate.',
  usList: 'CDL and NASS (USDA): US-only crops and statistics; in Brazil, MapBiomas and Conab.|NLCD, SSURGO and Web Soil Survey: US soil and cover; in Brazil, Embrapa and SoilGrids.|PRISM, CoCoRaHS and USGS NWIS: US rain and streamflow; in Brazil, INMET, CEMADEN and ANA.|OpenET, LANDFIRE and USDA AMS: US evapotranspiration, fuels and prices; here ERA5-Land and Cepea are used.',
  brList: 'MapBiomas: land-use history per field.|INMET and CEMADEN: weather stations for the diary.|Embrapa and SoilGrids: soil class and texture.|Conab and Cepea: regional prices and costs.|SRTM: slope and erosion risk.',
  limits: 'SMAP and IMERG are 9–10 km: they describe the farm region, not one field. Per-field risk uses ERA5-Land (about 9 km) at the field centre. Satellite data lag by hours to days. Planning aid; it does not replace field measurements.',
};
const es: D = {
  btn: 'Datos NASA', title: 'Datos NASA', sub: 'Capas de satélite en el mapa, agua en las parcelas y origen de los números.', close: 'Cerrar',
  tabMap: 'Capas en el mapa', tabWater: 'Agua en parcelas', tabSrc: 'Fuentes y método',
  mapIntro: 'Marque las capas que quiere ver sobre el mapa. Datos de la NASA (GIBS/Worldview), fecha más reciente.',
  ndvi: 'Vigor de la vegetación (NDVI, MODIS)', rain: 'Lluvia (GPM IMERG)', smap: 'Humedad del suelo (SMAP)', lst: 'Temperatura de superficie (MODIS)',
  ndviD: 'Verde oscuro indica cultivo vigoroso; marrones, suelo expuesto o plantas con estrés.',
  rainD: 'Tasa de lluvia estimada por satélite, en mm/h.', smapD: 'Humedad superficial del suelo (unos 5 cm), en m³/m³.', lstD: 'Temperatura de superficie diurna, en °C.',
  lo: 'menor', hi: 'mayor', unavail: 'Capa no disponible ahora', coarse: 'Resolución gruesa: muestra la región, no una parcela.',
  waterIntro: 'Balance de 30 días y humedad del suelo por parcela. Riesgo hídrico alto sube un nivel el riesgo del planificador.',
  field: 'Parcela', rain30: 'Lluvia 30 d (mm)', et0: 'Evapotransp. 30 d (mm)', bal: 'Balance (mm)', soil: 'Humedad del suelo', next3: 'Lluvia prevista 3 d (mm)', risk: 'Riesgo hídrico',
  low: 'Bajo', medium: 'Medio', high: 'Alto', loadingW: 'Buscando datos…', failW: 'Sin datos por ahora.', noFields: 'Mapee parcelas para calcular el riesgo hídrico.',
  waterNote: 'Balance = lluvia − evapotranspiración de referencia (FAO-56). Humedad del suelo: media 0–100 cm de ERA5-Land. Umbrales indicativos para suelos del Cerrado.',
  s1: 'Datos usados hoy', s2: 'Bases de EE. UU. que no aplican a Brasil', s3: 'Equivalentes brasileños previstos', s4: 'Límites del método',
  usedList: 'NASA POWER: lluvia, temperatura y radiación diaria por punto.|NASA GIBS (Worldview): NDVI MODIS, lluvia GPM IMERG, humedad SMAP y temperatura MODIS.|ERA5-Land vía Open-Meteo: humedad del suelo y evapotranspiración por parcela.|Open-Meteo: pronóstico y clima reciente.|Precios: FRED, CBOT e ICE, convertidos por USD/BRL.',
  usList: 'CDL y NASS (USDA): solo EE. UU.; en Brasil, MapBiomas y Conab.|NLCD, SSURGO y Web Soil Survey: en Brasil, Embrapa y SoilGrids.|PRISM, CoCoRaHS y USGS NWIS: en Brasil, INMET, CEMADEN y ANA.|OpenET, LANDFIRE y USDA AMS: aquí se usan ERA5-Land y Cepea.',
  brList: 'MapBiomas: historial de uso de la tierra.|INMET y CEMADEN: estaciones meteorológicas.|Embrapa y SoilGrids: suelo.|Conab y Cepea: precios y costos.|SRTM: pendiente y erosión.',
  limits: 'SMAP e IMERG tienen 9–10 km: describen la región, no una parcela. El riesgo por parcela usa ERA5-Land (≈9 km). Apoyo a la planificación; no sustituye la medición en campo.',
};
const de: D = { btn: 'NASA-Daten', title: 'NASA-Daten', close: 'Schließen', tabMap: 'Kartenebenen', tabWater: 'Wasser je Schlag', tabSrc: 'Quellen und Methode', ndvi: 'Vegetationsvitalität (NDVI, MODIS)', rain: 'Niederschlag (GPM IMERG)', smap: 'Bodenfeuchte (SMAP)', lst: 'Oberflächentemperatur (MODIS)', lo: 'niedriger', hi: 'höher', unavail: 'Ebene derzeit nicht verfügbar', field: 'Schlag', low: 'Niedrig', medium: 'Mittel', high: 'Hoch', risk: 'Wasserrisiko' };
const zh: D = { btn: 'NASA 数据', title: 'NASA 数据', close: '关闭', tabMap: '地图图层', tabWater: '地块水分', tabSrc: '来源与方法', ndvi: '植被活力 (NDVI, MODIS)', rain: '降水 (GPM IMERG)', smap: '土壤湿度 (SMAP)', lst: '地表温度 (MODIS)', lo: '较低', hi: '较高', unavail: '图层暂不可用', field: '地块', low: '低', medium: '中', high: '高', risk: '水分风险' };
const fr: D = { btn: 'Données NASA', title: 'Données NASA', close: 'Fermer', tabMap: 'Couches de la carte', tabWater: 'Eau par parcelle', tabSrc: 'Sources et méthode', ndvi: 'Vigueur de la végétation (NDVI, MODIS)', rain: 'Pluie (GPM IMERG)', smap: 'Humidité du sol (SMAP)', lst: 'Température de surface (MODIS)', lo: 'plus faible', hi: 'plus élevé', unavail: 'Couche indisponible', field: 'Parcelle', low: 'Faible', medium: 'Moyen', high: 'Élevé', risk: 'Risque hydrique' };

const ALL: Record<string, D> = { pt, en, es, de, zh, fr };
export function nn(key: string, params?: Record<string, string | number>): string {
  let s = (ALL[getCurrentLanguage()] || en)[key] ?? en[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
