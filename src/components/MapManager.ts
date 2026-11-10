import L from 'leaflet';
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
    const isBelowZoom14 = this.map.getZoom() < 14;

    talhoes.forEach((talhao, index) => {
      // Color strictly based on crop
      const cropColor = getCropColor(talhao.crop);
      const talhaoColor = talhao.color || cropColor;

      // Polygon
      const polygon = L.polygon(talhao.coordinates, {
        color: cropColor,
        weight: 3,
        fillColor: cropColor,
        fillOpacity: 0.38,
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
          fillOpacity: 0.55,
        });
      });

      polygon.on('mouseout', () => {
        polygon.setStyle({
          weight: 3,
          fillOpacity: 0.38,
        });
      });

      this.talhoesLayer.addLayer(polygon);
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

  public invalidateSize(): void {
    this.map.invalidateSize();
  }
}
