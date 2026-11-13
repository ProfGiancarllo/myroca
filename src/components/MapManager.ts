import L from 'leaflet';
import { twinLook, ensurePattern } from '../utils/twinLook';
import { ensureSnapshot, farmBounds, Snap } from '../utils/farmSnapshot';
import { CAR_PROPERTY, CAR_RESERVA, CAR_NATIVA, CAR_APP, CAR_VIEW, CAR_FIT } from '../data/farmCar';
import { segmentField } from '../utils/segment';
import { Talhao, WaterPoint, WaterPointType, WATER_POINT_META } from '../types';
import { calculatePolygonAreaHectares, calculatePerimeterKm, calculatePolygonCenter, formatHectares } from '../utils/geo';
import { calculateTalhaoCropStatus, getCropColor } from '../utils/cropCalendar';
import { t, translateCropName, translateCropPhase, translateStructureType, formatNumber, formatDateI18n } from '../i18n';

export interface MapEvents {
  onDrawingProgress: (pointCount: number, currentAreaHa: number) => void;
  onDrawingComplete: (coords: [number, number][], areaHa: number, perimeterKm: number) => void;
  onWaterPointClick: (lat: number, lng: number) => void;
  onTalhaoEdit: (talhao: Talhao) => void;
  onTalhaoDelete: (talhaoId: string) => void;
  onWaterPointDelete: (waterPointId: string) => void;
  onTalhaoGeometry?: (talhao: Talhao) => void;
}

export class MapManager {
  private map: L.Map;
  private talhoesLayer: L.LayerGroup;
  private waterPointsLayer: L.LayerGroup;
  private drawingLayer: L.LayerGroup;
  private previewLayer: L.LayerGroup;

  // Drawing state
  private isDrawingTalhao = false;
  private drawingPoints: [number, number][] = [];
  private tempMarkers: L.CircleMarker[] = [];
  private tempPolygon: L.Polygon | null = null;
  private tempGuideLine: L.Polyline | null = null;

  // Water point placement state
  private isPlacingWaterPoint = false;
  private pendingWaterType: WaterPointType = 'nascente';

  private events: MapEvents;

  constructor(containerId: string, events: MapEvents) {
    this.events = events;

    // Rio Verde, Goiás rural cropland coordinates (west of the city, pure grain fields)
    const RIO_VERDE_RURAL_LAT = -17.8050;
    const RIO_VERDE_RURAL_LNG = -51.0850;

    this.map = L.map(containerId, {
      center: [RIO_VERDE_RURAL_LAT, RIO_VERDE_RURAL_LNG],
      zoom: 13,
      zoomControl: false,
      zoomSnap: 0.1,
    });

    // Custom Zoom control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    // High Resolution Satellite Tiles (Esri World Imagery)
    const esriSatellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: `Tiles &copy; Esri &mdash; ${t('attribSatellite')}`,
      }
    );

    // Hybrid Reference Overlay (Roads, boundaries, cities, labels)
    const esriLabels = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Labels &copy; Esri',
      }
    );

    // OpenStreetMap as alternative
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    });

    // Satélite Híbrido como padrão (Satélite + Estradas e Nomes)
    esriSatellite.addTo(this.map);
    esriLabels.addTo(this.map);
    this.liveTiles = [esriSatellite, esriLabels];

    const baseMaps = {
      [t('layerSatellite')]: esriSatellite,
      [t('layerRoads')]: osmLayer,
    };

    const overlayMaps = {
      [t('layerLabels')]: esriLabels,
    };

    L.control.layers(baseMaps, overlayMaps, { position: 'topright' }).addTo(this.map);

    // Escala métrica gráfica no canto inferior esquerdo
    L.control.scale({ imperial: false, metric: true, position: 'bottomleft' }).addTo(this.map);

    this.talhoesLayer = L.layerGroup().addTo(this.map);
    this.waterPointsLayer = L.layerGroup().addTo(this.map);
    this.drawingLayer = L.layerGroup().addTo(this.map);
    this.previewLayer = L.layerGroup().addTo(this.map);

    // Zoom threshold listener: below zoom 15, hide structure labels; below zoom 14, compact talhões
    const updateZoomClass = () => {
      const container = this.map.getContainer();
      const currentZoom = this.map.getZoom();
      if (currentZoom < 15) {
        container.classList.add('map-zoom-low');
      } else {
        container.classList.remove('map-zoom-low');
      }

      if (currentZoom < 14) {
        container.classList.add('map-zoom-below-14');
      } else {
        container.classList.remove('map-zoom-below-14');
      }
    };
    this.map.on('zoomend', () => {
      updateZoomClass();
      if (this.lastTalhoes.length > 0) {
        this.renderTalhoes(this.lastTalhoes);
      }
    });
    updateZoomClass();

    this.setupMapListeners();
    this.addAdjustControl();
    this.addWandControl();
  }

  private setupMapListeners(): void {
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;

      if (this.isPlacingWaterPoint) {
        this.endPlacingWaterPoint();
        this.events.onWaterPointClick(lat, lng);
        return;
      }

      if (this.isDrawingTalhao) {
        this.addDrawingPoint(lat, lng);
      }
    });

    this.map.on('mousemove', (e: L.LeafletMouseEvent) => {
      if (this.isDrawingTalhao && this.drawingPoints.length > 0) {
        const lastPoint = this.drawingPoints[this.drawingPoints.length - 1];
        const currentCoord: [number, number] = [e.latlng.lat, e.latlng.lng];

        if (!this.tempGuideLine) {
          this.tempGuideLine = L.polyline([lastPoint, currentCoord], {
            color: '#22c55e',
            dashArray: '6, 6',
            weight: 2,
          }).addTo(this.drawingLayer);
        } else {
          this.tempGuideLine.setLatLngs([lastPoint, currentCoord]);
        }
      }
    });
  }

  // ==========================================
  private currentReferenceDate = '2026-11-09';
  private lastTalhoes: Talhao[] = [];
  private expandedTalhaoIds: Set<string> = new Set();

  // ==========================================
  // TALHÕES RENDERING
  // ==========================================

  public renderTalhoes(talhoes: Talhao[], referenceDate?: string): void {
    if (referenceDate) {
      this.currentReferenceDate = referenceDate;
    }
    this.lastTalhoes = talhoes;
    this.talhoesLayer.clearLayers();

    const placedScreenCenters: { pt: L.Point; latlng: [number, number] }[] = [];
    const isBelowZoom14 = this.map.getZoom() < 14 || (talhoes.length > 8 && this.map.getZoom() < 15.3);
    this.map.getContainer().classList.toggle('map-zoom-below-14', isBelowZoom14);

    talhoes.forEach((talhao, index) => {
      // Color strictly based on crop
      const cropColor = getCropColor(talhao.crop);
      const talhaoColor = talhao.color || cropColor;

      // Polygon
      // Gêmeo digital: halo luminoso + contorno ciano holográfico por cima da imagem de satélite
      L.polygon(talhao.coordinates, { color: '#5ec8ff', weight: 9, opacity: 0.22, fill: false, interactive: false, className: 'holo-glow' }).addTo(this.talhoesLayer);
      const polygon = L.polygon(talhao.coordinates, {
        color: '#8fe3ff',
        weight: 2.5,
        fillColor: cropColor,
        fillOpacity: 0.6,
        className: 'holo-poly',
      });

      const cropStatus = calculateTalhaoCropStatus(talhao, this.currentReferenceDate);

      // True polygon center
      const trueCenter = calculatePolygonCenter(talhao.coordinates);
      let badgeCenter: [number, number] = [trueCenter[0], trueCenter[1]];

      // Check collision in screen coordinates to avoid card overlapping
      let badgeScreenPt = this.map.latLngToLayerPoint(L.latLng(trueCenter[0], trueCenter[1]));
      const minDistance = isBelowZoom14 ? 40 : 80;
      let hasOffset = false;

      for (const placed of placedScreenCenters) {
        const dx = badgeScreenPt.x - placed.pt.x;
        const dy = badgeScreenPt.y - placed.pt.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < minDistance) {
          hasOffset = true;
          // Offset towards free side
          const angle = dist > 0.001 ? Math.atan2(dy, dx) : (Math.PI / 2);
          const pushDistance = minDistance - dist + 24;
          const newScreenX = badgeScreenPt.x + Math.cos(angle) * pushDistance;
          const newScreenY = badgeScreenPt.y + Math.sin(angle) * pushDistance;
          badgeScreenPt = L.point(newScreenX, newScreenY);
          const newLatLng = this.map.layerPointToLatLng(badgeScreenPt);
          badgeCenter = [newLatLng.lat, newLatLng.lng];
        }
      }

      placedScreenCenters.push({ pt: badgeScreenPt, latlng: badgeCenter });

      // If card was moved due to collision, draw a thin leader line connecting back to the talhão center
      if (hasOffset) {
        L.polyline([trueCenter, badgeCenter], {
          color: cropColor,
          weight: 1.5,
          dashArray: '3, 4',
          opacity: 0.85,
          interactive: false,
        }).addTo(this.talhoesLayer);

        L.circleMarker(trueCenter, {
          radius: 3,
          color: cropColor,
          fillColor: '#ffffff',
          fillOpacity: 1,
          weight: 1.5,
          interactive: false,
        }).addTo(this.talhoesLayer);
      }

      const isExpanded = this.expandedTalhaoIds.has(talhao.id);

      // Strict short label format: "T" + 2-digit order of talhão in list (T01, T02, T03...)
      const shortName = `T${String(index + 1).padStart(2, '0')}`;
      const displayName = isBelowZoom14 && !isExpanded ? shortName : talhao.name;
      const cropLabel = translateCropName(talhao.crop);
      const phaseLabel = translateCropPhase(cropStatus.phase.key);

      const badgeIcon = L.divIcon({
        className: 'custom-talhao-label-container',
        html: `
          <div class="talhao-label-badge ${isExpanded ? 'user-expanded' : ''}" data-talhaoid="${talhao.id}" style="border-left: 4px solid ${cropColor}">
            <div class="talhao-label-header">
              <span class="talhao-crop-dot" style="background-color: ${cropColor}; color: ${cropColor}"></span>
              <span class="talhao-label-name">${displayName}</span>
              ${talhao.isExample && (!isBelowZoom14 || isExpanded) ? `<span class="badge-exemplo">${t('badgeExample')}</span>` : ''}
            </div>
            <div class="talhao-badge-details">
              <div class="talhao-label-ha">${formatHectares(talhao.areaHectares)} • ${cropLabel}</div>
              <div class="talhao-label-phase" style="color: ${cropStatus.phase.badgeColor}">
                ${cropStatus.phase.icon} ${phaseLabel} (${cropStatus.daysPassed}d • ${cropStatus.progressPercent}%)
              </div>
            </div>
          </div>
        `,
        iconSize: isBelowZoom14 && !isExpanded ? [64, 26] : [170, 56],
        iconAnchor: isBelowZoom14 && !isExpanded ? [32, 13] : [85, 28],
      });

      const labelMarker = L.marker(badgeCenter, {
        icon: badgeIcon,
        interactive: true,
        zIndexOffset: 1000,
      });

      // ícone holográfico flutuando sobre o talhão
      L.marker(trueCenter, {
        icon: L.divIcon({
          className: 'holo-float-wrap',
          html: `<div class="holo-float" style="animation-delay:${(index % 5) * 0.4}s"><span>${cropStatus.phase.icon}</span></div>`,
          iconSize: [44, 44], iconAnchor: [22, 74],
        }),
        interactive: false,
        zIndexOffset: 900,
      }).addTo(this.talhoesLayer);

      // Tapping badge or polygon toggles expansion / details below zoom 14
      labelMarker.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        if (this.expandedTalhaoIds.has(talhao.id)) {
          this.expandedTalhaoIds.delete(talhao.id);
        } else {
          this.expandedTalhaoIds.add(talhao.id);
        }
        this.renderTalhoes(this.lastTalhoes);
      });

      polygon.on('click', () => {
        this.expandedTalhaoIds.add(talhao.id);
        const container = this.map.getContainer();
        const badgeEl = container.querySelector(`.talhao-label-badge[data-talhaoid="${talhao.id}"]`);
        if (badgeEl) {
          badgeEl.classList.add('user-expanded');
        }
      });

      // Popup with talhão info
      const popupContent = document.createElement('div');
      popupContent.className = 'talhao-popup';
      popupContent.innerHTML = `
        <div class="popup-header" style="border-bottom: 3px solid ${talhao.color}">
          <span class="color-dot" style="background-color: ${talhao.color}"></span>
          <div>
            <h3 class="popup-title">${talhao.name}</h3>
            ${talhao.isExample ? `<span class="badge-exemplo">${t('badgeExample')}</span>` : ''}
          </div>
        </div>
        <div class="popup-body">
          <div class="popup-row">
            <span class="popup-label">${t('sheetAreaLabel')}</span>
            <span class="popup-value highlight">${formatHectares(talhao.areaHectares)}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">${t('sheetPerimeterLabel')}</span>
            <span class="popup-value">${formatNumber(talhao.perimeterKm, 2)} km</span>
          </div>
          ${
            talhao.crop
              ? `
          <div class="popup-row">
            <span class="popup-label">${t('lblCrop')}:</span>
            <span class="popup-value crop-badge">${cropLabel} ${talhao.cultivar ? `(${talhao.cultivar})` : ''}</span>
          </div>`
              : ''
          }
          <div class="popup-row">
            <span class="popup-label">${t('legendCropsTitle')}:</span>
            <span class="popup-value" style="color: ${cropStatus.phase.badgeColor}; font-weight: 700;">
              ${cropStatus.phase.icon} ${phaseLabel}
            </span>
          </div>
          ${
            talhao.plantingDate
              ? `
          <div class="popup-row">
            <span class="popup-label">${t('lblPlantingDate')} / ${t('lblExpectedHarvest')}:</span>
            <span class="popup-value" style="font-size: 12px;">
              ${formatDateI18n(talhao.plantingDate)} • ${cropStatus.expectedHarvest ? formatDateI18n(cropStatus.expectedHarvest) : ''} (${talhao.cycleDays || ''}d)
            </span>
          </div>`
              : ''
          }
          ${
            talhao.nextCropPlan
              ? `
          <div class="popup-row">
            <span class="popup-label">${t('drawerNextCrop')}:</span>
            <span class="popup-value" style="font-size: 12px; color: #38bdf8;">
              ${translateCropName(talhao.nextCropPlan.crop)} (${talhao.nextCropPlan.plannedPlanting})
            </span>
          </div>`
              : ''
          }
          ${
            talhao.notes
              ? `
          <div class="popup-row notes">
            <span class="popup-label">${t('lblNotes')}:</span>
            <p class="popup-notes-text">${talhao.notes}</p>
          </div>`
              : ''
          }
        </div>
        <div class="popup-actions">
          <button class="popup-btn edit-btn" id="edit-talhao-${talhao.id}">
            ${t('btnEdit')}
          </button>
          <button class="popup-btn delete-btn" id="delete-talhao-${talhao.id}">
            ${t('btnDelete')}
          </button>
        </div>
      `;

      polygon.bindPopup(popupContent, { maxWidth: 300 });

      polygon.on('popupopen', () => {
        const editBtn = document.getElementById(`edit-talhao-${talhao.id}`);
        const deleteBtn = document.getElementById(`delete-talhao-${talhao.id}`);

        if (editBtn) {
          editBtn.onclick = (e) => {
            e.stopPropagation();
            this.map.closePopup();
            this.events.onTalhaoEdit(talhao);
          };
        }

        if (deleteBtn) {
          deleteBtn.onclick = (e) => {
            e.stopPropagation();
            this.map.closePopup();
            this.events.onTalhaoDelete(talhao.id);
          };
        }
      });

      // Hover highlights
      polygon.on('mouseover', () => {
        polygon.setStyle({
          weight: 4,
          fillOpacity: 0.78,
        });
      });

      polygon.on('mouseout', () => {
        polygon.setStyle({
          weight: 2.5,
          fillOpacity: 0.6,
        });
      });

      this.talhoesLayer.addLayer(polygon);
      // cor/textura realista conforme cultura e fase da safra (soja escura, milho claro, pasto, solo exposto...)
      try {
        const svg = (polygon as unknown as { _path?: SVGElement })._path?.ownerSVGElement ?? null;
        polygon.setStyle({ fillColor: ensurePattern(svg, twinLook(talhao.crop, cropStatus.phase.key)) });
      } catch { /* mantém a cor simples */ }
      this.talhoesLayer.addLayer(labelMarker);
    });
  }

  // ==========================================
  // WATER POINTS RENDERING
  // ==========================================

  public renderWaterPoints(waterPoints: WaterPoint[]): void {
    this.waterPointsLayer.clearLayers();

    waterPoints.forEach((wp) => {
      const meta = WATER_POINT_META[wp.type];

      const icon = L.divIcon({
        className: 'water-point-container',
        html: `
          <div class="water-point-pin" style="background-color: ${meta.color}; box-shadow: 0 0 14px ${meta.color}99" title="${wp.name}">
            <span class="water-point-emoji">${meta.icon}</span>
          </div>
          <div class="water-point-tag water-point-hover-tag">${wp.name}</div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const marker = L.marker(wp.coordinates, { icon, zIndexOffset: 100 });
      marker.setZIndexOffset(100);
      marker.bindTooltip(`${meta.icon} ${wp.name}`, {
        direction: 'top',
        offset: [0, -18],
        className: 'element-hover-tooltip',
      });

      const popupContent = document.createElement('div');
      popupContent.className = 'water-popup';
      popupContent.innerHTML = `
        <div class="popup-header" style="border-bottom: 3px solid ${meta.color}">
          <span class="water-icon">${meta.icon}</span>
          <div>
            <h3 class="popup-title">${wp.name}</h3>
            ${wp.isExample ? `<span class="badge-exemplo">${t('badgeExample')}</span>` : ''}
            <span class="water-type-pill" style="background-color: ${meta.badgeBg}; color: ${meta.color}">${translateStructureType(wp.type)}</span>
          </div>
        </div>
        <div class="popup-body">
          <div class="popup-row">
            <span class="popup-label">${t('thLat')} / ${t('thLng')}:</span>
            <span class="popup-value coords">${formatNumber(wp.coordinates[0], 5)}, ${formatNumber(wp.coordinates[1], 5)}</span>
          </div>
          ${
            wp.notes
              ? `
          <div class="popup-row notes">
            <span class="popup-label">${t('lblNotes')}:</span>
            <p class="popup-notes-text">${wp.notes}</p>
          </div>`
              : ''
          }
        </div>
        <div class="popup-actions">
          <button class="popup-btn delete-btn" id="delete-water-${wp.id}">
            ${t('btnDelete')}
          </button>
        </div>
      `;

      marker.bindPopup(popupContent, { maxWidth: 280 });

      marker.on('popupopen', () => {
        const deleteBtn = document.getElementById(`delete-water-${wp.id}`);
        if (deleteBtn) {
          deleteBtn.onclick = (e) => {
            e.stopPropagation();
            this.map.closePopup();
            this.events.onWaterPointDelete(wp.id);
          };
        }
      });

      this.waterPointsLayer.addLayer(marker);
    });
  }

  // ==========================================
  // DRAWING TALHÃO MODE
  // ==========================================

  public startDrawingTalhao(): void {
    this.cancelDrawing();
    this.endPlacingWaterPoint();

    this.isDrawingTalhao = true;
    this.map.getContainer().classList.add('drawing-mode-active');
    this.events.onDrawingProgress(0, 0);
  }

  private addDrawingPoint(lat: number, lng: number): void {
    const coord: [number, number] = [lat, lng];

    // If clicking close to the first point with at least 3 points, auto-finish!
    if (this.drawingPoints.length >= 3) {
      const first = this.drawingPoints[0];
      const dist = this.map.distance(L.latLng(lat, lng), L.latLng(first[0], first[1]));
      if (dist < 30) {
        // Less than 30 meters from start point, close polygon!
        this.finishDrawingTalhao();
        return;
      }
    }

    this.drawingPoints.push(coord);

    // Marker for this vertex
    const isFirstPoint = this.drawingPoints.length === 1;
    const vertexMarker = L.circleMarker(coord, {
      radius: isFirstPoint ? 8 : 6,
      color: '#ffffff',
      weight: 2,
      fillColor: isFirstPoint ? '#22c55e' : '#3b82f6',
      fillOpacity: 1,
    });

    if (isFirstPoint) {
      vertexMarker.bindTooltip(t('tipCloseTalhao'), {
        permanent: false,
        direction: 'top',
        className: 'first-vertex-tooltip',
      });
      vertexMarker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (this.drawingPoints.length >= 3) {
          this.finishDrawingTalhao();
        }
      });
    }

    vertexMarker.addTo(this.drawingLayer);
    this.tempMarkers.push(vertexMarker);

    this.updateDrawingVisuals();
  }

  private updateDrawingVisuals(): void {
    if (this.tempPolygon) {
      this.drawingLayer.removeLayer(this.tempPolygon);
      this.tempPolygon = null;
    }

    if (this.drawingPoints.length >= 2) {
      this.tempPolygon = L.polygon(this.drawingPoints, {
        color: '#22c55e',
        weight: 3,
        dashArray: '6, 6',
        fillColor: '#22c55e',
        fillOpacity: 0.25,
      }).addTo(this.drawingLayer);
    }

    const areaHa = this.drawingPoints.length >= 3
      ? calculatePolygonAreaHectares(this.drawingPoints)
      : 0;

    this.events.onDrawingProgress(this.drawingPoints.length, areaHa);
  }

  public undoLastDrawingPoint(): void {
    if (!this.isDrawingTalhao || this.drawingPoints.length === 0) return;

    this.drawingPoints.pop();
    const lastMarker = this.tempMarkers.pop();
    if (lastMarker) {
      this.drawingLayer.removeLayer(lastMarker);
    }

    if (this.tempGuideLine) {
      if (this.drawingPoints.length > 0) {
        // Leave guide line to follow next mouse move
      } else {
        this.drawingLayer.removeLayer(this.tempGuideLine);
        this.tempGuideLine = null;
      }
    }

    this.updateDrawingVisuals();
  }

  public finishDrawingTalhao(): void {
    if (this.drawingPoints.length < 3) return;

    const coords = [...this.drawingPoints];
    const areaHa = calculatePolygonAreaHectares(coords);
    const perimeterKm = calculatePerimeterKm(coords);

    this.cancelDrawing();
    this.events.onDrawingComplete(coords, areaHa, perimeterKm);
  }

  public cancelDrawing(): void {
    this.isDrawingTalhao = false;
    this.drawingPoints = [];
    this.drawingLayer.clearLayers();
    this.tempMarkers = [];
    this.tempPolygon = null;
    this.tempGuideLine = null;
    this.map.getContainer().classList.remove('drawing-mode-active');
  }

  // ==========================================
  // WATER POINT PLACEMENT
  // ==========================================

  public startPlacingWaterPoint(type: WaterPointType): void {
    this.cancelDrawing();
    this.isPlacingWaterPoint = true;
    this.pendingWaterType = type;
    this.map.getContainer().classList.add('water-placing-active');
  }

  public endPlacingWaterPoint(): void {
    this.isPlacingWaterPoint = false;
    this.map.getContainer().classList.remove('water-placing-active');
  }

  // ==========================================
  // CAMERA HELPERS
  // ==========================================

  public fitBoundsToTalhao(talhao: Talhao): void {
    if (talhao.coordinates.length === 0) return;
    const bounds = L.latLngBounds(talhao.coordinates.map((c) => L.latLng(c[0], c[1])));
    this.map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
  }

  public fitBoundsToFarm(talhoes: Talhao[], waterPoints: WaterPoint[]): void {
    const allCoords: L.LatLng[] = [];

    talhoes.forEach((t) => {
      t.coordinates.forEach((c) => allCoords.push(L.latLng(c[0], c[1])));
    });

    waterPoints.forEach((wp) => {
      allCoords.push(L.latLng(wp.coordinates[0], wp.coordinates[1]));
    });

    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords);
      this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else {
      // Return to rural Rio Verde default (west grain belt)
      this.map.setView([-17.8050, -51.0850], 13);
    }
  }

  public panTo(lat: number, lng: number, zoom = 15): void {
    this.map.setView([lat, lng], zoom);
  }

  // ==========================================
  // TYPED COORDINATES LIVE PREVIEW
  // ==========================================

  public previewTypedCoordinates(coords: [number, number][]): void {
    this.previewLayer.clearLayers();

    if (coords.length === 0) return;

    // Draw vertex markers with point indices
    coords.forEach(([lat, lng], index) => {
      const isFirst = index === 0;
      const marker = L.circleMarker([lat, lng], {
        radius: isFirst ? 9 : 7,
        color: '#ffffff',
        weight: 2,
        fillColor: isFirst ? '#16a34a' : '#0284c7',
        fillOpacity: 1,
      });

      marker.bindTooltip(`Ponto ${index + 1}: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, {
        permanent: false,
        direction: 'top',
        className: 'preview-vertex-tooltip',
      });

      this.previewLayer.addLayer(marker);
    });

    // If 2 points: draw line
    if (coords.length === 2) {
      const line = L.polyline(coords, {
        color: '#22c55e',
        weight: 3,
        dashArray: '6, 6',
      });
      this.previewLayer.addLayer(line);
    }

    // If 3 or more points: draw closed polygon with area badge!
    if (coords.length >= 3) {
      const polygon = L.polygon(coords, {
        color: '#22c55e',
        weight: 3,
        dashArray: '6, 6',
        fillColor: '#22c55e',
        fillOpacity: 0.28,
      });
      this.previewLayer.addLayer(polygon);

      const areaHa = calculatePolygonAreaHectares(coords);
      const center = calculatePolygonCenter(coords);

      const badgeIcon = L.divIcon({
        className: 'custom-talhao-label-container',
        html: `
          <div class="talhao-label-badge" style="border-left: 5px solid #22c55e; border-style: dashed;">
            <div class="talhao-label-name">Prévia do Talhão</div>
            <div class="talhao-label-ha">${formatHectares(areaHa)}</div>
          </div>
        `,
        iconSize: [140, 40],
        iconAnchor: [70, 20],
      });

      const labelMarker = L.marker(center, { icon: badgeIcon, interactive: false });
      this.previewLayer.addLayer(labelMarker);
    }

    // Pan map to fit all preview points
    const bounds = L.latLngBounds(coords.map((c) => L.latLng(c[0], c[1])));
    this.map.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 });
  }

  public clearTypedPreview(): void {
    this.previewLayer.clearLayers();
  }

  public previewTypedWaterPoint(lat: number, lng: number, type: WaterPointType): void {
    this.previewLayer.clearLayers();

    const meta = WATER_POINT_META[type];
    const icon = L.divIcon({
      className: 'water-point-container',
      html: `
        <div class="water-point-pin" style="background-color: ${meta.color}; box-shadow: 0 0 18px ${meta.color}">
          <span class="water-point-emoji">${meta.icon}</span>
        </div>
        <div class="water-point-tag">Prévia: ${meta.label}</div>
      `,
      iconSize: [40, 48],
      iconAnchor: [20, 24],
    });

    const marker = L.marker([lat, lng], { icon });
    this.previewLayer.addLayer(marker);
    this.map.setView([lat, lng], 15);
  }

  private liveTiles: L.TileLayer[] = [];
  private snapZoomFn: (() => void) | null = null;
  private snapLayer: L.ImageOverlay | null = null;
  private snapCtl: HTMLElement | null = null;
  private snapUrl = '';

  /** Gêmeo digital: foto de satélite fixa da fazenda como fundo (offline após a 1ª vez), vista travada na fazenda. */
  public async useFarmSnapshot(talhoes: Talhao[], waterPoints: WaterPoint[], force = false): Promise<void> {
    const pts: [number, number][] = [];
    talhoes.forEach((tl) => tl.coordinates.forEach((c) => pts.push([c[0], c[1]])));
    waterPoints.forEach((w) => pts.push([w.coordinates[0], w.coordinates[1]]));
    // fazenda de exemplo (real, do CAR): fundo de satélite bem mais largo que a fazenda, para o mapa preencher a tela
    const demo = talhoes.length > 0 && talhoes.every((tl) => tl.isExample);
    const b = demo ? CAR_VIEW : farmBounds(pts);
    if (!b) return;
    let snap: Snap | null = null;
    snap = await ensureSnapshot(b, force);
    if (!snap) return; // sem foto e sem internet: mantém fundo escuro/ladrilhos ao vivo
    if (!this.map.getPane('snapshot')) { const pn = this.map.createPane('snapshot'); pn.style.zIndex = '250'; }
    if (this.snapUrl) URL.revokeObjectURL(this.snapUrl);
    this.snapUrl = URL.createObjectURL(snap.blob);
    this.snapBounds = snap.bounds as [[number, number], [number, number]];
    this.snapData = null;
    void this.loadSnapData();
    this.snapLayer?.remove();
    const lb = L.latLngBounds(snap.bounds as [[number, number], [number, number]]);
    this.snapLayer = L.imageOverlay(this.snapUrl, lb, { pane: 'snapshot', interactive: false }).addTo(this.map);
    this.liveTiles.forEach((tl) => tl.remove());
    // em zoom alto, com internet, usa a imagem ao vivo (mais nítida) no lugar da foto fixa
    if (this.snapZoomFn) this.map.off('zoomend', this.snapZoomFn);
    this.snapZoomFn = () => { const hi = this.map.getZoom() >= 15 && navigator.onLine; this.liveTiles.forEach((tl) => (hi ? tl.addTo(this.map) : tl.remove())); this.snapLayer?.setOpacity(hi ? 0 : 1); };
    this.map.on('zoomend', this.snapZoomFn);
    // o menor zoom é aquele em que a imagem ainda preenche toda a tela: sem margens pretas
    const minZ = this.map.getBoundsZoom(lb, true);
    this.map.setMinZoom(minZ); this.map.setMaxZoom(17.5);
    this.map.setMaxBounds(lb); (this.map.options as { maxBoundsViscosity?: number }).maxBoundsViscosity = 1;
    if (demo) this.drawCarLayers(); else this.carLayer?.remove();
    if (!this.snapCtl) {
      const Ctl = L.Control.extend({ onAdd: () => { const d = L.DomUtil.create('div', 'snap-ctl'); L.DomEvent.disableClickPropagation(d); this.snapCtl = d; return d; } });
      new Ctl({ position: 'bottomleft' }).addTo(this.map);
    }
    if (this.snapCtl) {
      const dt = new Date(snap.date).toLocaleDateString(document.documentElement.lang || undefined);
      this.snapCtl.innerHTML = `🛰️ ${dt} <button type="button" title="↻">↻</button>`;
      const rb = this.snapCtl.querySelector('button') as HTMLButtonElement | null;
      if (rb) rb.onclick = () => { this.snapCtl!.textContent = '🛰️ …'; void this.useFarmSnapshot(talhoes, waterPoints, true); };
    }
    this.map.invalidateSize();
    if (demo) { this.map.fitBounds(L.latLngBounds(CAR_FIT), { padding: [24, 24] }); }
    else this.map.fitBounds(L.latLngBounds(pts.map((p) => L.latLng(p[0], p[1]))), { padding: [60, 60], maxZoom: 16 });
  }

  // ---- Fazenda real de exemplo: limite do imóvel, Reserva Legal (mata nativa) e APP, do CAR ----
  private carLayer: L.LayerGroup | null = null;
  private static CARTXT: Record<string, [string, string, string]> = {
    pt: ['Reserva Legal', 'APP (área de preservação)', 'Limite do imóvel'],
    en: ['Legal Reserve', 'APP (protected area)', 'Property boundary'],
    es: ['Reserva Legal', 'APP (área protegida)', 'Límite del inmueble'],
    de: ['Gesetzliches Schutzgebiet', 'APP (Schutzzone)', 'Grundstücksgrenze'],
    zh: ['法定保护区', 'APP（保护区）', '地产边界'],
    fr: ['Réserve légale', 'APP (zone protégée)', 'Limite de la propriété'],
  };
  private drawCarLayers(): void {
    this.carLayer?.remove();
    if (!this.map.getPane('car')) { const pn = this.map.createPane('car'); pn.style.zIndex = '380'; pn.style.pointerEvents = 'none'; }
    const l = (document.documentElement.lang || 'pt').slice(0, 2), tx = MapManager.CARTXT[l] || MapManager.CARTXT.pt;
    const g = L.layerGroup();
    CAR_NATIVA.forEach((r) => L.polygon(r, { pane: 'car', interactive: false, color: '#4d7c0f', weight: 0.8, fillColor: '#84cc16', fillOpacity: 0.22 }).addTo(g));
    CAR_RESERVA.forEach((r) => L.polygon(r, { pane: 'car', interactive: false, color: '#14532d', weight: 1.4, fillColor: '#15803d', fillOpacity: 0.42 }).addTo(g));
    CAR_APP.forEach((r) => L.polygon(r, { pane: 'car', interactive: false, color: '#1d4ed8', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.4 }).addTo(g));
    L.polygon(CAR_PROPERTY, { pane: 'car', interactive: false, color: '#f59e0b', weight: 3, dashArray: '8 6', fill: false }).addTo(g);
    // rótulos "Reserva Legal" nas maiores matas
    const box = (r: [number, number][]) => { const b = L.latLngBounds(r.map((c) => L.latLng(c[0], c[1]))); return { b, a: (b.getNorth() - b.getSouth()) * (b.getEast() - b.getWest()) }; };
    CAR_RESERVA.map((r) => ({ r, ...box(r) })).sort((x, y) => y.a - x.a).slice(0, 6).forEach(({ r }) => {
      let sy = 0, sx = 0; r.forEach((c) => { sy += c[0]; sx += c[1]; });
      L.marker([sy / r.length, sx / r.length], { pane: 'car', interactive: false, keyboard: false, icon: L.divIcon({ className: 'car-label', html: `<span>🌳 ${tx[0]}</span>`, iconSize: [0, 0] }) }).addTo(g);
    });
    g.addTo(this.map);
    this.carLayer = g;
  }

  // ---- Ajustar talhões: arrastar os cantos até a borda da lavoura na imagem ----
  private adjustLayer: L.LayerGroup | null = null;
  private adjusting = false;
  private adjustBtn: HTMLButtonElement | null = null;
  private static ADJ: Record<string, [string, string, string]> = {
    pt: ['✏️ Ajustar talhões', '✔ Concluir ajuste', 'Arraste os cantos até a borda da lavoura'],
    en: ['✏️ Adjust fields', '✔ Done adjusting', 'Drag the corners to the field edge'],
    es: ['✏️ Ajustar lotes', '✔ Terminar ajuste', 'Arrastre las esquinas al borde del lote'],
    de: ['✏️ Felder anpassen', '✔ Fertig', 'Ecken an den Feldrand ziehen'],
    zh: ['✏️ 调整地块', '✔ 完成调整', '拖动角点到地块边缘'],
    fr: ['✏️ Ajuster les parcelles', '✔ Terminer', 'Faites glisser les coins au bord de la parcelle'],
  };
  private adjText(i: number): string { const l = (document.documentElement.lang || 'pt').slice(0, 2); return (MapManager.ADJ[l] || MapManager.ADJ.pt)[i]; }

  public addAdjustControl(): void {
    const self = this;
    const Ctl = L.Control.extend({ onAdd() { const b = L.DomUtil.create('button', 'adjust-btn') as HTMLButtonElement; b.type = 'button'; L.DomEvent.disableClickPropagation(b); b.onclick = () => self.setAdjustMode(!self.adjusting); self.adjustBtn = b; b.textContent = self.adjText(0); return b; } });
    new Ctl({ position: 'topleft' }).addTo(this.map);
  }

  // ---- Marcar lavoura por cor (varinha mágica) ----
  private snapBounds: [[number, number], [number, number]] | null = null;
  private snapData: ImageData | null = null;
  private wandOn = false;
  private wandBtn: HTMLButtonElement | null = null;
  private wandPanel: HTMLElement | null = null;
  private wandLayer: L.LayerGroup | null = null;
  private wandSeed: L.LatLng | null = null;
  private wandTol = 20;
  private wandCoords: [number, number][] | null = null;
  private static WAND: Record<string, string[]> = {
    pt: ['🪄 Marcar lavoura (toque)', '✖ Cancelar marcação', 'Toque dentro de uma lavoura na imagem', 'Mais área', 'Menos área', '✔ Usar este talhão', 'Não consegui identificar. Toque em outro ponto.'],
    en: ['🪄 Mark field (tap)', '✖ Cancel marking', 'Tap inside a field on the image', 'More area', 'Less area', '✔ Use this field', 'Could not detect it. Tap another spot.'],
    es: ['🪄 Marcar lote (toque)', '✖ Cancelar marcado', 'Toque dentro de un lote en la imagen', 'Más área', 'Menos área', '✔ Usar este lote', 'No se pudo identificar. Toque otro punto.'],
    de: ['🪄 Feld markieren (tippen)', '✖ Abbrechen', 'Tippen Sie in ein Feld im Bild', 'Mehr Fläche', 'Weniger Fläche', '✔ Dieses Feld verwenden', 'Nicht erkannt. Anderen Punkt antippen.'],
    zh: ['🪄 点选地块', '✖ 取消标记', '在图像中点击一块农田', '扩大', '缩小', '✔ 使用此地块', '未能识别，请点击其他位置。'],
    fr: ['🪄 Marquer la parcelle (toucher)', '✖ Annuler', 'Touchez l’intérieur d’une parcelle sur l’image', 'Plus de surface', 'Moins de surface', '✔ Utiliser cette parcelle', 'Non détectée. Touchez un autre point.'],
  };
  private wt(i: number): string { const l = (document.documentElement.lang || 'pt').slice(0, 2); return (MapManager.WAND[l] || MapManager.WAND.pt)[i]; }

  private async loadSnapData(): Promise<void> {
    if (!this.snapUrl) return;
    const im = new Image(); im.src = this.snapUrl;
    try { await im.decode(); } catch { return; }
    const sc = Math.min(1, 1800 / im.naturalWidth), c = document.createElement('canvas');
    c.width = Math.round(im.naturalWidth * sc); c.height = Math.round(im.naturalHeight * sc);
    const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(im, 0, 0, c.width, c.height);
    try { this.snapData = g.getImageData(0, 0, c.width, c.height); } catch { this.snapData = null; }
  }
  private static R = 6378137;
  private mx(lng: number) { return (lng * Math.PI * MapManager.R) / 180; }
  private my(lat: number) { return Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * MapManager.R; }
  private toPx(ll: L.LatLng): [number, number] | null {
    if (!this.snapBounds || !this.snapData) return null;
    const [[s, w], [n, e]] = this.snapBounds, W = this.snapData.width, H = this.snapData.height;
    const x = ((this.mx(ll.lng) - this.mx(w)) / (this.mx(e) - this.mx(w))) * W, y = ((this.my(n) - this.my(ll.lat)) / (this.my(n) - this.my(s))) * H;
    return x < 0 || y < 0 || x >= W || y >= H ? null : [x, y];
  }
  private toLatLng(x: number, y: number): [number, number] {
    const [[s, w], [n, e]] = this.snapBounds!, W = this.snapData!.width, H = this.snapData!.height;
    const X = this.mx(w) + (x / W) * (this.mx(e) - this.mx(w)), Y = this.my(n) - (y / H) * (this.my(n) - this.my(s));
    return [((2 * Math.atan(Math.exp(Y / MapManager.R)) - Math.PI / 2) * 180) / Math.PI, (X * 180) / (Math.PI * MapManager.R)];
  }

  public addWandControl(): void {
    const self = this;
    const Ctl = L.Control.extend({ onAdd() {
      const box = L.DomUtil.create('div', 'wand-box'); L.DomEvent.disableClickPropagation(box);
      const b = L.DomUtil.create('button', 'adjust-btn wand-btn', box) as HTMLButtonElement; b.type = 'button'; b.textContent = self.wt(0); b.onclick = () => self.setWandMode(!self.wandOn); self.wandBtn = b;
      const pn = L.DomUtil.create('div', 'wand-panel', box); pn.style.display = 'none'; self.wandPanel = pn; return box; } });
    new Ctl({ position: 'topleft' }).addTo(this.map);
    this.map.on('click', (e: L.LeafletMouseEvent) => { if (this.wandOn) this.wandAt(e.latlng); });
  }

  public setWandMode(on: boolean): void {
    this.wandOn = on; this.wandLayer?.remove(); this.wandLayer = null; this.wandCoords = null; this.wandSeed = null;
    if (on) { this.setAdjustMode(false); this.wandLayer = L.layerGroup().addTo(this.map); }
    if (this.wandBtn) { this.wandBtn.textContent = this.wt(on ? 1 : 0); this.wandBtn.classList.toggle('on', on); }
    if (this.wandPanel) { this.wandPanel.style.display = on ? 'block' : 'none'; this.wandPanel.textContent = on ? this.wt(2) : ''; }
    this.map.getContainer().classList.toggle('wand-active', on);
  }

  private wandAt(ll: L.LatLng, tol?: number): void {
    if (tol !== undefined) this.wandTol = tol;
    const pt = this.toPx(ll);
    if (!pt || !this.snapData) { if (this.wandPanel) this.wandPanel.textContent = this.wt(6); return; }
    this.wandSeed = ll;
    const seg = segmentField(this.snapData, pt[0], pt[1], this.wandTol);
    this.wandLayer?.clearLayers();
    if (!seg || seg.areaFrac > 0.7) { this.wandCoords = null; if (this.wandPanel) this.wandPanel.textContent = this.wt(6); return; }
    const coords = seg.poly.map(([x, y]) => this.toLatLng(x, y));
    this.wandCoords = coords;
    L.polygon(coords, { color: '#ffd84d', weight: 3, fillColor: '#ffd84d', fillOpacity: 0.25, dashArray: '6 4', interactive: false }).addTo(this.wandLayer!);
    const ha = calculatePolygonAreaHectares(coords);
    const pn = this.wandPanel!; pn.innerHTML = '';
    const info = document.createElement('div'); info.textContent = `${formatHectares(ha)}`; info.style.fontWeight = '700'; pn.appendChild(info);
    const mk = (txt: string, fn: () => void, cls = '') => { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.className = 'wand-mini ' + cls; b.onclick = fn; pn.appendChild(b); };
    mk('➖ ' + this.wt(4), () => this.wandAt(this.wandSeed!, Math.max(8, this.wandTol - 8)));
    mk('➕ ' + this.wt(3), () => this.wandAt(this.wandSeed!, Math.min(90, this.wandTol + 8)));
    mk(this.wt(5), () => { const c = this.wandCoords!; this.setWandMode(false); this.events.onDrawingComplete(c, calculatePolygonAreaHectares(c), calculatePerimeterKm(c)); }, 'ok');
  }

  public setAdjustMode(on: boolean): void {
    this.adjusting = on;
    this.adjustLayer?.remove(); this.adjustLayer = null;
    if (this.adjustBtn) { this.adjustBtn.textContent = this.adjText(on ? 1 : 0); this.adjustBtn.classList.toggle('on', on); }
    this.map.getContainer().classList.toggle('adjusting', on);
    if (!on) return;
    this.adjustLayer = L.layerGroup().addTo(this.map);
    this.lastTalhoes.forEach((tl) => {
      const temp = L.polygon(tl.coordinates, { color: '#ffd84d', weight: 2, fill: false, dashArray: '4 4', interactive: false }).addTo(this.adjustLayer!);
      tl.coordinates.forEach((c, i) => {
        const m = L.marker(c, { draggable: true, zIndexOffset: 2000, icon: L.divIcon({ className: 'adj-handle-wrap', html: '<div class="adj-handle"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }) }).addTo(this.adjustLayer!);
        m.on('drag', () => { const ll = m.getLatLng(); tl.coordinates[i] = [ll.lat, ll.lng]; temp.setLatLngs(tl.coordinates); });
        m.on('dragend', () => {
          tl.areaHectares = calculatePolygonAreaHectares(tl.coordinates);
          tl.perimeterKm = calculatePerimeterKm(tl.coordinates);
          this.events.onTalhaoGeometry?.(tl);
          const keep = this.adjusting; this.renderTalhoes(this.lastTalhoes); if (keep) this.setAdjustMode(true);
        });
      });
    });
    const tip = this.adjText(2); const c = this.map.getContainer(); c.setAttribute('data-adjust-tip', tip);
  }

  public invalidateSize(): void {
    this.map.invalidateSize();
  }
}
