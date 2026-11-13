import { CAR_TALHOES, CAR_NASCENTE } from '../data/farmCar';
import { FarmData, Talhao, WaterPoint, WaterPointType, TALHAO_COLORS } from '../types';
import { getCropColor } from './cropCalendar';
import { t, translateCropName, TranslationDictionary } from '../i18n';

/**
 * Radius of the Earth in meters according to WGS84
 */
const EARTH_RADIUS = 6378137;

/**
 * Calculates the geodesic area of a polygon in hectares using the spherical excess formula.
 * @param coords Array of [lat, lng] coordinates
 * @returns Area in hectares (ha), formatted to 2 decimal places
 */
export function calculatePolygonAreaHectares(coords: [number, number][]): number {
  if (coords.length < 3) return 0;

  let total = 0;
  const len = coords.length;

  for (let i = 0; i < len; i++) {
    const p1 = coords[i];
    const p2 = coords[(i + 1) % len];

    const lat1 = (p1[0] * Math.PI) / 180;
    const lat2 = (p2[0] * Math.PI) / 180;
    const dLng = ((p2[1] - p1[1]) * Math.PI) / 180;

    total += dLng * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  const areaSqMeters = Math.abs((total * EARTH_RADIUS * EARTH_RADIUS) / 2);
  const hectares = areaSqMeters / 10000;
  return Number(hectares.toFixed(2));
}

/**
 * Calculates the perimeter of a polygon in kilometers using Haversine formula.
 */
export function calculatePerimeterKm(coords: [number, number][]): number {
  if (coords.length < 2) return 0;

  let totalMeters = 0;
  const len = coords.length;

  for (let i = 0; i < len; i++) {
    const p1 = coords[i];
    const p2 = coords[(i + 1) % len];
    totalMeters += haversineDistanceMeters(p1, p2);
  }

  return Number((totalMeters / 1000).toFixed(2));
}

/**
 * Haversine distance between two points in meters
 */
function haversineDistanceMeters(p1: [number, number], p2: [number, number]): number {
  const lat1 = (p1[0] * Math.PI) / 180;
  const lat2 = (p2[0] * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLng = ((p2[1] - p1[1]) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS * c;
}

/**
 * Formats a number to Brazilian hectare string representation
 * Example: 145.2 -> "145,20 ha"
 */
import { formatHectaresI18n } from '../i18n';

export function formatHectares(ha: number): string {
  return formatHectaresI18n(ha);
}

/**
 * Computes the center [lat, lng] of a polygon
 */
export function calculatePolygonCenter(coords: [number, number][]): [number, number] {
  if (coords.length === 0) return [-17.7924, -50.9192];

  let latSum = 0;
  let lngSum = 0;
  coords.forEach(([lat, lng]) => {
    latSum += lat;
    lngSum += lng;
  });

  return [latSum / coords.length, lngSum / coords.length];
}

/**
 * Pick a color from predefined list based on index
 */
export function getPaletteColor(index: number): string {
  return TALHAO_COLORS[index % TALHAO_COLORS.length].hex;
}

/**
 * Parses GeoJSON text and extracts talhões and water points
 */
export function parseGeoJSON(content: string): { talhoes: Talhao[]; waterPoints: WaterPoint[] } {
  const data = JSON.parse(content);
  const talhoes: Talhao[] = [];
  const waterPoints: WaterPoint[] = [];

  const features = data.type === 'FeatureCollection'
    ? data.features
    : data.type === 'Feature'
    ? [data]
    : [];

  let colorIdx = 0;

  for (const feature of features) {
    if (!feature || !feature.geometry) continue;

    const geom = feature.geometry;
    const props = feature.properties || {};
    const name = props.name || props.NOME || props.title || props.id || `Talhão Importado ${talhoes.length + 1}`;

    if (geom.type === 'Polygon') {
      const ring = geom.coordinates[0]; // exterior ring
      if (Array.isArray(ring) && ring.length >= 3) {
        // GeoJSON is [lng, lat] -> convert to [lat, lng]
        const coords: [number, number][] = ring.map((pt: number[]) => [pt[1], pt[0]]);
        const areaHectares = calculatePolygonAreaHectares(coords);
        const perimeterKm = calculatePerimeterKm(coords);

        const crop = props.crop || props.cultura || '';
        talhoes.push({
          id: `talhao_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: String(name),
          color: getCropColor(crop),
          crop,
          areaHectares,
          perimeterKm,
          coordinates: coords,
          createdAt: new Date().toISOString(),
          notes: props.notes || props.observacao || 'Importado via GeoJSON',
        });
      }
    } else if (geom.type === 'MultiPolygon') {
      for (let pIdx = 0; pIdx < geom.coordinates.length; pIdx++) {
        const ring = geom.coordinates[pIdx][0];
        if (Array.isArray(ring) && ring.length >= 3) {
          const coords: [number, number][] = ring.map((pt: number[]) => [pt[1], pt[0]]);
          const areaHectares = calculatePolygonAreaHectares(coords);
          const perimeterKm = calculatePerimeterKm(coords);
          const crop = props.crop || props.cultura || '';

          talhoes.push({
            id: `talhao_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: `${name} (Parte ${pIdx + 1})`,
            color: getCropColor(crop),
            crop,
            areaHectares,
            perimeterKm,
            coordinates: coords,
            createdAt: new Date().toISOString(),
            notes: props.notes || props.observacao || 'Importado via GeoJSON',
          });
        }
      }
    } else if (geom.type === 'Point') {
      const [lng, lat] = geom.coordinates;
      let type: WaterPointType = 'nascente';
      const typeStr = (props.type || props.tipo || name || '').toLowerCase();
      if (typeStr.includes('acude') || typeStr.includes('açude') || typeStr.includes('represa')) {
        type = 'acude';
      } else if (typeStr.includes('poco') || typeStr.includes('poço')) {
        type = 'poco';
      } else if (typeStr.includes('rio') || typeStr.includes('corrego') || typeStr.includes('córrego')) {
        type = 'rio';
      }

      waterPoints.push({
        id: `water_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: String(name),
        type,
        coordinates: [lat, lng],
        createdAt: new Date().toISOString(),
        notes: props.notes || props.observacao || 'Importado via GeoJSON',
      });
    }
  }

  return { talhoes, waterPoints };
}

/**
 * Parses KML text (XML) and extracts talhões and water points
 */
export function parseKML(content: string): { talhoes: Talhao[]; waterPoints: WaterPoint[] } {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(content, 'text/xml');
  const talhoes: Talhao[] = [];
  const waterPoints: WaterPoint[] = [];

  const placemarks = xmlDoc.getElementsByTagName('Placemark');
  let colorIdx = 0;

  for (let i = 0; i < placemarks.length; i++) {
    const pm = placemarks[i];
    const nameEl = pm.getElementsByTagName('name')[0];
    const descEl = pm.getElementsByTagName('description')[0];
    const name = nameEl ? nameEl.textContent?.trim() : `Talhão KML ${talhoes.length + 1}`;
    const desc = descEl ? descEl.textContent?.trim() : '';

    // Check for Polygon
    const polygons = pm.getElementsByTagName('Polygon');
    if (polygons.length > 0) {
      for (let j = 0; j < polygons.length; j++) {
        const poly = polygons[j];
        const coordEls = poly.getElementsByTagName('coordinates');
        if (coordEls.length > 0) {
          const rawText = coordEls[0].textContent || '';
          const coords = parseKMLCoordinateString(rawText);
          if (coords.length >= 3) {
            const areaHectares = calculatePolygonAreaHectares(coords);
            const perimeterKm = calculatePerimeterKm(coords);

            talhoes.push({
              id: `talhao_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              name: String(name || `Talhão ${talhoes.length + 1}`),
              color: getCropColor(''),
              crop: '',
              areaHectares,
              perimeterKm,
              coordinates: coords,
              createdAt: new Date().toISOString(),
              notes: desc || 'Importado via KML',
            });
          }
        }
      }
    } else {
      // Check for Point
      const points = pm.getElementsByTagName('Point');
      if (points.length > 0) {
        const coordEls = points[0].getElementsByTagName('coordinates');
        if (coordEls.length > 0) {
          const rawText = coordEls[0].textContent || '';
          const coords = parseKMLCoordinateString(rawText);
          if (coords.length > 0) {
            const [lat, lng] = coords[0];
            let type: WaterPointType = 'nascente';
            const nameLower = (name || '').toLowerCase();
            if (nameLower.includes('acude') || nameLower.includes('açude') || nameLower.includes('represa')) {
              type = 'acude';
            } else if (nameLower.includes('poco') || nameLower.includes('poço')) {
              type = 'poco';
            } else if (nameLower.includes('rio') || nameLower.includes('corrego') || nameLower.includes('córrego')) {
              type = 'rio';
            }

            waterPoints.push({
              id: `water_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              name: String(name || 'Ponto de Água'),
              type,
              coordinates: [lat, lng],
              createdAt: new Date().toISOString(),
              notes: desc || 'Importado via KML',
            });
          }
        }
      }
    }
  }

  return { talhoes, waterPoints };
}

/**
 * Parses KML coordinate string format: "lng,lat,alt lng,lat,alt ..."
 * Returns array of [lat, lng]
 */
function parseKMLCoordinateString(coordStr: string): [number, number][] {
  const result: [number, number][] = [];
  const tuples = coordStr.trim().split(/\s+/);

  for (const tuple of tuples) {
    if (!tuple) continue;
    const parts = tuple.split(',');
    if (parts.length >= 2) {
      const lng = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) {
        result.push([lat, lng]);
      }
    }
  }

  return result;
}

/**
 * Exports farm data to GeoJSON
 */
export function exportToGeoJSON(farmData: FarmData): string {
  const features = [];

  for (const t of farmData.talhoes) {
    // GeoJSON coordinates are [lng, lat]
    const closedCoords = [...t.coordinates];
    if (
      closedCoords.length > 0 &&
      (closedCoords[0][0] !== closedCoords[closedCoords.length - 1][0] ||
        closedCoords[0][1] !== closedCoords[closedCoords.length - 1][1])
    ) {
      closedCoords.push(closedCoords[0]);
    }

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [closedCoords.map(([lat, lng]) => [lng, lat])],
      },
      properties: {
        id: t.id,
        name: t.name,
        color: t.color,
        crop: t.crop,
        areaHectares: t.areaHectares,
        perimeterKm: t.perimeterKm,
        notes: t.notes,
        createdAt: t.createdAt,
      },
    });
  }

  for (const wp of farmData.waterPoints) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [wp.coordinates[1], wp.coordinates[0]],
      },
      properties: {
        id: wp.id,
        name: wp.name,
        type: wp.type,
        notes: wp.notes,
        createdAt: wp.createdAt,
      },
    });
  }

  const geoJson = {
    type: 'FeatureCollection',
    name: farmData.farmName || 'Fazenda Rio Verde',
    features,
  };

  return JSON.stringify(geoJson, null, 2);
}

/**
 * Exports farm data to KML
 */
export function exportToKML(farmData: FarmData): string {
  const safeName = (farmData.farmName || 'Fazenda Rio Verde').replace(/[<>&]/g, '');

  let placemarks = '';

  for (const t of farmData.talhoes) {
    const kmlCoords = t.coordinates.map(([lat, lng]) => `${lng},${lat},0`).join(' ');
    placemarks += `
    <Placemark>
      <name>${t.name.replace(/[<>&]/g, '')}</name>
      <description>Área: ${t.areaHectares} ha | Cultura: ${t.crop || 'Não informada'}</description>
      <Polygon>
        <extrude>1</extrude>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${kmlCoords}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>`;
  }

  for (const wp of farmData.waterPoints) {
    placemarks += `
    <Placemark>
      <name>${wp.name.replace(/[<>&]/g, '')} (${wp.type.toUpperCase()})</name>
      <description>Tipo: ${wp.type}</description>
      <Point>
        <coordinates>${wp.coordinates[1]},${wp.coordinates[0]},0</coordinates>
      </Point>
    </Placemark>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${safeName}</name>
    ${placemarks}
  </Document>
</kml>`;
}

/**
 * Realistic initial demo farm in Rio Verde, Goiás
 * Rio Verde is a major agricultural hub in Brazil renowned for soybean, corn and cattle farming.
 */
export function getRioVerdeDemoFarm(): FarmData {
  // Fazenda real (CAR GO-5218805): talhões = divisão da área consolidada pelas estradas internas visíveis na imagem
  const talhao1Coords: [number, number][] = CAR_TALHOES[0];
  const talhao2Coords: [number, number][] = CAR_TALHOES[1];
  const talhao3Coords: [number, number][] = CAR_TALHOES[2];

  const demoFarm: FarmData = {
    farmName: 'Fazenda MyRoça - Rio Verde (GO)',
    referenceDate: '2026-11-09',
    activeViewMode: 'mapa',
    talhoes: [
      {
        id: 'talhao_demo_01',
        name: t('demoNameTalhao01'),
        color: '#16a34a', // Verde Soja
        crop: 'Soja',
        cultivar: 'Brasmax Bônus IPRO',
        plantingDate: '2026-10-10',
        cycleDays: 115,
        harvestDateExpected: '2027-02-02',
        isExample: true,
        diary: [
          { id: 'talhao_demo_01_d1', date: '2026-10-10', type: 'plantio' },
          { id: 'talhao_demo_01_d2', date: '2026-10-28', type: 'adubacao', amount: 250 },
          { id: 'talhao_demo_01_d3', date: '2026-11-04', type: 'chuva', amount: 22 },
          { id: 'talhao_demo_01_d4', date: '2026-11-07', type: 'monitoramento' },
        ],
        healthStatus: 'verde',
        harvestHistory: [
          {
            id: 'h1_1',
            season: 'Safra 2025/26',
            crop: 'Soja',
            harvestDate: 'Fevereiro de 2026',
            yieldText: '72 sc/ha',
            notes: 'Soja safra 2025/26 com ótima produtividade.',
          },
          {
            id: 'h1_2',
            season: 'Safrinha 2026',
            crop: 'Milho safrinha',
            harvestDate: 'Julho de 2026',
            yieldText: '118 sc/ha',
            notes: 'Milho safrinha colhido em julho de 2026 com sucesso.',
          },
        ],
        nextCropPlan: {
          crop: 'Milho safrinha',
          plannedPlanting: '2027-02-15',
          plannedHarvest: '2027-06-30',
          cycleDays: 135,
          notes: 'Milho safrinha planejado para fevereiro de 2027 logo após a colheita da soja.',
        },
        areaHectares: calculatePolygonAreaHectares(talhao1Coords),
        perimeterKm: calculatePerimeterKm(talhao1Coords),
        coordinates: talhao1Coords,
        createdAt: new Date().toISOString(),
        notes: '[Exemplo] Soja plantada em 10/10/2026 com ciclo de 115 dias. Histórico de soja 2025/26 e milho safrinha colhido em julho de 2026. Próxima safra: milho safrinha planejado para fevereiro de 2027.',
      },
      {
        id: 'talhao_demo_02',
        name: t('demoNameTalhao02'),
        color: '#eab308', // Amarelo Dourado
        crop: 'Soja precoce',
        cultivar: 'DM 54i52 RSF',
        plantingDate: '2026-09-20',
        cycleDays: 105,
        harvestDateExpected: '2027-01-03',
        isExample: true,
        diary: [
          { id: 'talhao_demo_02_d1', date: '2026-09-20', type: 'plantio' },
          { id: 'talhao_demo_02_d2', date: '2026-10-25', type: 'adubacao', amount: 300 },
          { id: 'talhao_demo_02_d3', date: '2026-11-02', type: 'aplicacao', amount: 0.8 },
          { id: 'talhao_demo_02_d4', date: '2026-11-06', type: 'chuva', amount: 14 },
        ],
        healthStatus: 'verde',
        harvestHistory: [
          {
            id: 'h2_1',
            season: 'Safra 2025/26',
            crop: 'Soja',
            harvestDate: 'Fevereiro de 2026',
            yieldText: '70 sc/ha',
            notes: 'Mesmo histórico de soja safra 2025/26.',
          },
          {
            id: 'h2_2',
            season: 'Safrinha 2026',
            crop: 'Milho safrinha',
            harvestDate: 'Julho de 2026',
            yieldText: '114 sc/ha',
            notes: 'Milho safrinha colhido em julho de 2026.',
          },
        ],
        nextCropPlan: {
          crop: 'Milho safrinha',
          plannedPlanting: '2027-01-15',
          plannedHarvest: '2027-05-30',
          cycleDays: 135,
          notes: 'Milho safrinha planejado para janeiro de 2027 antecipando a semeadura.',
        },
        areaHectares: calculatePolygonAreaHectares(talhao2Coords),
        perimeterKm: calculatePerimeterKm(talhao2Coords),
        coordinates: talhao2Coords,
        createdAt: new Date().toISOString(),
        notes: '[Exemplo] Soja precoce plantada em 20/09/2026 com ciclo de 105 dias. Mesmo histórico de safra anterior. Próxima safra: milho safrinha planejado para janeiro de 2027.',
      },
      {
        id: 'talhao_demo_03',
        name: t('demoNameTalhao03'),
        color: '#059669', // Esmeralda Pastagem
        crop: 'Pastagem de braquiária',
        cultivar: 'Brachiaria brizantha (Marandu / Piatã)',
        plantingDate: '',
        cycleDays: 0,
        isExample: true,
        healthStatus: 'verde',
        harvestHistory: [
          {
            id: 'h3_1',
            season: 'Safra 2024/25',
            crop: 'Pastagem perene',
            harvestDate: 'Pastejo contínuo',
            yieldText: '3,2 UA/ha',
            notes: 'Área com manejo rotacionado e piquetes bem estabelecidos.',
          },
        ],
        nextCropPlan: {
          crop: 'Pastagem perene / Manutenção',
          plannedPlanting: 'Contínua',
          notes: 'Sem plantio recente; manutenção com roçagem e adubação nitrogenada.',
        },
        areaHectares: calculatePolygonAreaHectares(talhao3Coords),
        perimeterKm: calculatePerimeterKm(talhao3Coords),
        coordinates: talhao3Coords,
        createdAt: new Date().toISOString(),
        notes: '[Exemplo] Pastagem de braquiária perene sem plantio recente, mantida para pastejo rotacionado.',
      },
    ],
    waterPoints: [
      // Estruturas e Infraestrutura da Fazenda
      {
        id: 'elem_demo_sede',
        name: t('demoNameSede'),
        type: 'sede',
        coordinates: [-17.75215, -51.14415],
        createdAt: new Date().toISOString(),
        notes: '[Exemplo] Casa principal, alojamento e escritório de gestão rural.',
        isExample: true,
      },
      {
        id: 'elem_demo_silo',
        name: t('demoNameSilo'),
        type: 'silo',
        coordinates: [-17.75125, -51.14385],
        createdAt: new Date().toISOString(),
        notes: '[Exemplo] Capacidade estática de 120.000 sacas com secador a lenha.',
        isExample: true,
      },
      {
        id: 'elem_demo_curral',
        name: t('demoNameCurral'),
        type: 'curral',
        coordinates: [-17.75335, -51.1459],
        createdAt: new Date().toISOString(),
        notes: '[Exemplo] Brete com balança eletrônica e tronco de contenção.',
        isExample: true,
      },
      {
        id: 'elem_demo_estacao',
        name: t('demoNameEstacao'),
        type: 'estacao_meteo',
        coordinates: [-17.75185, -51.1469],
        createdAt: new Date().toISOString(),
        notes: '[Exemplo] Monitoramento em tempo real de chuva, vento e umidade.',
        isExample: true,
      },
      {
        id: 'elem_demo_pista',
        name: t('demoNamePista'),
        type: 'estrada',
        coordinates: [-17.7517, -51.1522],
        createdAt: new Date().toISOString(),
        notes: '[Exemplo] Pista de pouso de aviões agrícolas no centro da fazenda.',
        isExample: true,
      },
      {
        id: 'elem_demo_estrada',
        name: t('demoNameEstrada'),
        type: 'estrada',
        coordinates: [-17.7531, -51.1432],
        createdAt: new Date().toISOString(),
        notes: '[Exemplo] Via cascalhada para escoamento de carretas bitrem e colheitadeiras.',
        isExample: true,
      },
      {
        id: 'elem_demo_reserva',
        name: t('demoNameReserva'),
        type: 'reserva',
        coordinates: [-17.7494, -51.1526],
        createdAt: new Date().toISOString(),
        notes: '[Exemplo] Área de Preservação Permanente (APP) averbada no CAR.',
        isExample: true,
      },

      // Recursos Hídricos
      {
        id: 'elem_demo_nascente',
        name: t('demoNameNascente'),
        type: 'nascente',
        coordinates: CAR_NASCENTE,
        createdAt: new Date().toISOString(),
        notes: '[Exemplo] Mina protegida com raio de 50 metros preservado.',
        isExample: true,
      },
      {
        id: 'elem_demo_poco',
        name: t('demoNamePoco'),
        type: 'poco',
        coordinates: [-17.7523, -51.1451],
        createdAt: new Date().toISOString(),
        notes: '[Exemplo] Profundidade 140 m, vazão 25.000 L/h para uso da sede.',
        isExample: true,
      },
      {
        id: 'elem_demo_rio',
        name: t('demoNameRio'),
        type: 'rio',
        coordinates: [-17.7568, -51.138],
        createdAt: new Date().toISOString(),
        notes: '[Exemplo] Corpo hídrico na divisa sul da propriedade rural.',
        isExample: true,
      },
    ],
  };
  localizeExampleNames(demoFarm);
  // Demais talhões da fazenda real (culturas e datas ilustrativas), em rodízio
  const SPEC: Array<{ crop: 'Soja' | 'Milho' | 'Pastagem de braquiária'; plant: string }> = [
    { crop: 'Soja', plant: '2026-10-12' }, { crop: 'Milho', plant: '2026-07-12' }, { crop: 'Soja', plant: '2026-10-05' },
    { crop: 'Milho', plant: '2026-10-02' }, { crop: 'Soja', plant: '2026-10-18' }, { crop: 'Pastagem de braquiária', plant: '' },
    { crop: 'Soja', plant: '2026-09-28' }, { crop: 'Milho', plant: '2026-07-20' },
  ];
  for (let i = 3; i < CAR_TALHOES.length; i++) {
    const f = SPEC[(i - 3) % SPEC.length], n = i + 1, id = `talhao_demo_${String(n).padStart(2, '0')}`;
    const coords = CAR_TALHOES[i], pasto = f.crop.startsWith('Pastagem');
    const cycle = pasto ? 0 : f.crop === 'Soja' ? 115 : 120;
    const harvest = f.plant && cycle ? new Date(new Date(f.plant + 'T12:00:00Z').getTime() + cycle * 864e5).toISOString().slice(0, 10) : undefined;
    demoFarm.talhoes.push({
      id, name: t('defaultTalhaoName', { n }), color: pasto ? '#059669' : f.crop === 'Soja' ? '#16a34a' : '#eab308',
      crop: f.crop, cultivar: pasto ? 'Brachiaria brizantha (Marandu / Piatã)' : f.crop === 'Soja' ? 'Brasmax Bônus IPRO' : 'DKB 390 PRO3',
      plantingDate: f.plant, cycleDays: cycle, harvestDateExpected: harvest, isExample: true, healthStatus: 'verde',
      diary: [...(f.plant ? [{ id: id + '_d1', date: f.plant, type: 'plantio' as const }] : []), { id: id + '_d2', date: '2026-11-09', type: 'monitoramento' as const }, ...(harvest && f.plant < '2026-08-01' ? [{ id: id + '_d3', date: harvest < '2026-11-09' ? harvest : '2026-11-09', type: 'colheita' as const }] : [])], harvestHistory: [],
      areaHectares: calculatePolygonAreaHectares(coords), perimeterKm: calculatePerimeterKm(coords), coordinates: coords,
      createdAt: new Date().toISOString(), notes: '[Exemplo]',
    });
  }
  demoFarm.demoVersion = 3;
  return demoFarm;
}

/**
 * Chaves de tradução dos nomes dos itens de exemplo (fazenda modelo), por id.
 */
const EXAMPLE_NAME_KEYS: Record<string, keyof TranslationDictionary> = {
  talhao_demo_01: 'demoNameTalhao01',
  talhao_demo_02: 'demoNameTalhao02',
  talhao_demo_03: 'demoNameTalhao03',
  elem_demo_sede: 'demoNameSede',
  elem_demo_silo: 'demoNameSilo',
  elem_demo_curral: 'demoNameCurral',
  elem_demo_pivo: 'demoNamePivo',
  elem_demo_estacao: 'demoNameEstacao',
  elem_demo_estrada: 'demoNameEstrada',
  elem_demo_pista: 'demoNamePista',
  elem_demo_reserva: 'demoNameReserva',
  elem_demo_acude: 'demoNameAcude',
  elem_demo_nascente: 'demoNameNascente',
  elem_demo_poco: 'demoNamePoco',
  elem_demo_rio: 'demoNameRio',
};

/**
 * Reaplica o idioma atual aos nomes dos itens de exemplo (isExample) já salvos.
 * Itens cadastrados pelo usuário não são alterados. Retorna true se algo mudou.
 */
export function localizeExampleNames(farm: FarmData): boolean {
  let changed = false;
  const apply = (item: { id: string; name: string; isExample?: boolean }) => {
    const key = EXAMPLE_NAME_KEYS[item.id];
    if (!item.isExample || !key) return;
    const translated = t(key);
    if (item.name !== translated) {
      item.name = translated;
      changed = true;
    }
  };
  const setIf = <T extends object, K extends keyof T>(obj: T | undefined, field: K, value: string) => {
    if (obj && obj[field] !== value) {
      (obj[field] as unknown as string) = value;
      changed = true;
    }
  };

  farm.talhoes.forEach(apply);
  farm.waterPoints.forEach(apply);

  // Notas dos itens de exemplo
  const noteKeys: Record<string, keyof TranslationDictionary> = {
    talhao_demo_01: 'demoNoteTalhao01', talhao_demo_02: 'demoNoteTalhao02', talhao_demo_03: 'demoNoteTalhao03',
    elem_demo_sede: 'demoNoteSede', elem_demo_silo: 'demoNoteSilo', elem_demo_curral: 'demoNoteCurral',
    elem_demo_pivo: 'demoNotePivo', elem_demo_estacao: 'demoNoteEstacao', elem_demo_estrada: 'demoNoteEstrada', elem_demo_pista: 'demoNotePista',
    elem_demo_reserva: 'demoNoteReserva', elem_demo_acude: 'demoNoteAcude', elem_demo_nascente: 'demoNoteNascente',
    elem_demo_poco: 'demoNotePoco', elem_demo_rio: 'demoNoteRio',
  };
  [...farm.talhoes, ...farm.waterPoints].forEach((item) => {
    const key = noteKeys[item.id];
    if (item.isExample && key) setIf(item, 'notes', t(key));
  });

  // Histórico de safras e plano da próxima safra dos talhões de exemplo
  const hist: Record<string, { season: keyof TranslationDictionary; crop: () => string; date: keyof TranslationDictionary; note: keyof TranslationDictionary }> = {
    h1_1: { season: 'demoSeason2526', crop: () => translateCropName('Soja'), date: 'demoDateFeb2026', note: 'demoHistNote11' },
    h1_2: { season: 'demoSeasonSafrinha', crop: () => t('demoCropMilhoSafrinha'), date: 'demoDateJul2026', note: 'demoHistNote12' },
    h2_1: { season: 'demoSeason2526', crop: () => translateCropName('Soja'), date: 'demoDateFeb2026', note: 'demoHistNote21' },
    h2_2: { season: 'demoSeasonSafrinha', crop: () => t('demoCropMilhoSafrinha'), date: 'demoDateJul2026', note: 'demoHistNote22' },
    h3_1: { season: 'demoSeason2425', crop: () => t('phasePastagemPerene'), date: 'demoGrazingContinuous', note: 'demoHistNote31' },
  };
  const planNotes: Record<string, keyof TranslationDictionary> = {
    talhao_demo_01: 'demoPlanNote1', talhao_demo_02: 'demoPlanNote2', talhao_demo_03: 'demoPlanNote3',
  };
  farm.talhoes.forEach((tl) => {
    if (!tl.isExample || !planNotes[tl.id]) return;
    (tl.harvestHistory || []).forEach((h) => {
      const m = hist[h.id];
      if (!m) return;
      setIf(h, 'season', t(m.season));
      setIf(h, 'crop', m.crop());
      setIf(h, 'harvestDate', t(m.date));
      setIf(h, 'notes', t(m.note));
    });
    const plan = tl.nextCropPlan;
    if (plan) {
      setIf(plan, 'notes', t(planNotes[tl.id]));
      if (tl.id === 'talhao_demo_03') {
        setIf(plan, 'crop', t('demoCropPastagemManut'));
        setIf(plan, 'plannedPlanting', t('demoPlanContinuous'));
      } else {
        setIf(plan, 'crop', t('demoCropMilhoSafrinha'));
      }
    }
  });
  return changed;
}
