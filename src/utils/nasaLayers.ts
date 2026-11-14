/**
 * Camadas de satélite da NASA (GIBS / Worldview) para sobrepor ao mapa. Sem chave de acesso.
 * Padrão WMTS: gibs.earthdata.nasa.gov/wmts/epsg3857/best/{camada}/default/{matriz}/{z}/{y}/{x}.{ext}
 * "default" = data mais recente disponível da camada.
 */
export type NasaLayerId = 'ndvi' | 'rain' | 'smap' | 'lst';
export interface NasaLayerDef {
  id: NasaLayerId;
  layer: string;
  matrix: string;
  maxNative: number;
  ext: 'png' | 'jpg';
  gradient: string; // legenda: do valor baixo ao alto
  res: string;
}

export const NASA_LAYERS: NasaLayerDef[] = [
  { id: 'ndvi', layer: 'MODIS_Terra_NDVI_8Day', matrix: 'GoogleMapsCompatible_Level9', maxNative: 9, ext: 'png', gradient: 'linear-gradient(90deg,#8c510a,#d8b365,#f6e8c3,#a6d96a,#1a9850,#00441b)', res: '250 m · 8 dias' },
  { id: 'rain', layer: 'IMERG_Precipitation_Rate', matrix: 'GoogleMapsCompatible_Level6', maxNative: 6, ext: 'png', gradient: 'linear-gradient(90deg,#c6dbef,#6baed6,#2171b5,#6a51a3,#ae017e)', res: '10 km · 30 min' },
  { id: 'smap', layer: 'SMAP_L3_Passive_Enhanced_Day_Soil_Moisture', matrix: 'GoogleMapsCompatible_Level6', maxNative: 6, ext: 'png', gradient: 'linear-gradient(90deg,#fff5e6,#e6c27a,#7fcdbb,#2c7fb8,#08306b)', res: '9 km · 2 a 3 dias' },
  { id: 'lst', layer: 'MODIS_Terra_L3_Land_Surface_Temp_Daily_Day', matrix: 'GoogleMapsCompatible_Level7', maxNative: 7, ext: 'png', gradient: 'linear-gradient(90deg,#313695,#74add1,#ffffbf,#f46d43,#a50026)', res: '1 km · diário' },
];

export const nasaTileUrl = (d: NasaLayerDef): string =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${d.layer}/default/${d.matrix}/{z}/{y}/{x}.${d.ext}`;
