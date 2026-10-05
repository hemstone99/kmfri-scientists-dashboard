import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import {
  Anchor,
  Compass,
  Crosshair,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Grid,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  Radio,
  Ruler,
  Satellite,
  Waves,
  X,
  ChevronDown,
} from 'lucide-react';
import { GisLocation, Project } from '../types/kmfri.ts';
import {
  KmfriStation,
  KMFRI_STATIONS,
  KMFRI_STATIONS_GEOJSON,
  KENYA_EEZ_GEOJSON,
  RESEARCH_AREAS_GEOJSON,
  KENYA_NATIONAL_BOUNDARY_GEOJSON,
  BATHYMETRY_ISOBATHS_GEOJSON,
  formatCoordinateTelemetry,
} from '../data/gisGeoJson.ts';

export type { KmfriStation };
export { KMFRI_STATIONS };

// Fix default Leaflet icon assets
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// 8 Primary KMFRI Reference Stations
export const PRIMARY_8_REFERENCE_STATIONS = [
  'st-01', // Mombasa Headquarters (English Point)
  'st-02', // Shimoni Marine Research Station
  'st-03', // Gazi Bay Mangrove Research Station
  'st-04', // Kilifi Creek Marine Station
  'st-05', // Malindi Marine Research Station
  'st-06', // Lamu Archipelago Marine Center
  'st-07', // Kisumu Freshwater Research Center
  'st-08', // Lake Turkana Research Center (Kalokol)
];

export type BasemapMode = 'satellite' | 'ocean' | 'radar' | 'terrain';

interface GisMapCanvasProps {
  locations?: GisLocation[];
  projects?: Project[];
  heightClass?: string;
  onSelectLocation?: (loc: GisLocation) => void;
  onMapClickCoordinates?: (lat: number, lng: number) => void;
  selectedCoordinates?: { lat: number; lng: number } | null;
  interactive?: boolean;
}

export const GisMapCanvas: React.FC<GisMapCanvasProps> = ({
  locations = [],
  heightClass = 'h-[620px] sm:h-[720px] lg:h-[800px]',
  onSelectLocation,
  onMapClickCoordinates,
  selectedCoordinates,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Layer references for dynamic updates
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const labelOverlayLayerRef = useRef<L.TileLayer | null>(null);
  const stationsGeoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const researchAreasGeoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const boundaryGeoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const isobaths200mLayerRef = useRef<L.GeoJSON | null>(null);
  const isobaths1000mLayerRef = useRef<L.GeoJSON | null>(null);
  const graticuleLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const locationsGroupRef = useRef<L.LayerGroup | null>(null);
  const selectedCoordGroupRef = useRef<L.LayerGroup | null>(null);
  const measureLineRef = useRef<L.Polyline | null>(null);

  // Basemap & Layer Control States
  const [basemapMode, setBasemapMode] = useState<BasemapMode>('satellite');
  const [showStations, setShowStations] = useState(true);
  const [showResearchAreas, setShowResearchAreas] = useState(true);
  const [showEezOnly, setShowEezOnly] = useState(false);
  const [showCountryBoundary, setShowCountryBoundary] = useState(true);
  const [showIsobath200m, setShowIsobath200m] = useState(true);
  const [showIsobath1000m, setShowIsobath1000m] = useState(true);
  const [showGraticule, setShowGraticule] = useState(true);
  const [showSamplingSites, setShowSamplingSites] = useState(true);

  // Telemetry HUD States
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number }>({
    lat: -4.0583,
    lng: 39.6833,
  });
  const [zoomLevel, setZoomLevel] = useState<number>(7);
  const [selectedStation, setSelectedStation] = useState<KmfriStation | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobileHudOpen, setMobileHudOpen] = useState(false);

  // Nautical Measuring Tool
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<L.LatLng[]>([]);
  const [measureDistance, setMeasureDistance] = useState<{ km: number; nm: number } | null>(null);

  // Calculated Dual Coordinate Telemetry
  const telemetry = useMemo(
    () => formatCoordinateTelemetry(cursorCoords.lat, cursorCoords.lng),
    [cursorCoords.lat, cursorCoords.lng]
  );

  // Tile Layer Definitions for Interactive Basemap Modes
  const BASEMAP_TILES = {
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics &mdash; KMFRI GIS',
      maxZoom: 18,
      labelOverlay: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    },
    ocean: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Bathymetry &copy; Esri, GEBCO, NOAA, National Geographic &mdash; KMFRI Hydrography',
      maxZoom: 16,
      labelOverlay: null,
    },
    radar: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO &mdash; KMFRI Tactical Telemetry',
      maxZoom: 19,
      labelOverlay: null,
    },
    terrain: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors &mdash; KMFRI Marine Survey',
      maxZoom: 19,
      labelOverlay: null,
    },
  };

  // Initialize Map Instance
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [-3.2, 39.5],
      zoom: 7,
      zoomControl: false,
      scrollWheelZoom: true,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Initial Base Tile Layer (Satellite)
    const baseConfig = BASEMAP_TILES.satellite;
    const baseTile = L.tileLayer(baseConfig.url, {
      attribution: baseConfig.attribution,
      maxZoom: baseConfig.maxZoom,
    }).addTo(map);
    baseTileLayerRef.current = baseTile;

    // Hybrid Label Overlay
    if (baseConfig.labelOverlay) {
      const labelTile = L.tileLayer(baseConfig.labelOverlay, {
        maxZoom: baseConfig.maxZoom,
      }).addTo(map);
      labelOverlayLayerRef.current = labelTile;
    }

    // Initialize Layer Groups
    graticuleLayerGroupRef.current = L.layerGroup().addTo(map);
    boundaryGeoJsonLayerRef.current = L.geoJSON(undefined).addTo(map);
    researchAreasGeoJsonLayerRef.current = L.geoJSON(undefined).addTo(map);
    isobaths200mLayerRef.current = L.geoJSON(undefined).addTo(map);
    isobaths1000mLayerRef.current = L.geoJSON(undefined).addTo(map);
    stationsGeoJsonLayerRef.current = L.geoJSON(undefined).addTo(map);
    locationsGroupRef.current = L.layerGroup().addTo(map);
    selectedCoordGroupRef.current = L.layerGroup().addTo(map);

    // Coordinate Tracking
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      setCursorCoords({
        lat: Number(e.latlng.lat.toFixed(5)),
        lng: Number(e.latlng.lng.toFixed(5)),
      });
    });

    map.on('zoomend', () => {
      setZoomLevel(map.getZoom());
    });

    mapInstanceRef.current = map;

    // Immediately and progressively invalidate size to prevent gray/unrendered tiles
    requestAnimationFrame(() => {
      map.invalidateSize();
    });
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 400);
    const t3 = setTimeout(() => map.invalidateSize(), 1000);

    // Observe container resize to auto-recompute tile grid
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 1. One-Click Basemap Switching
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (baseTileLayerRef.current) {
      map.removeLayer(baseTileLayerRef.current);
      baseTileLayerRef.current = null;
    }
    if (labelOverlayLayerRef.current) {
      map.removeLayer(labelOverlayLayerRef.current);
      labelOverlayLayerRef.current = null;
    }

    const config = BASEMAP_TILES[basemapMode];
    const newBase = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
    }).addTo(map);
    baseTileLayerRef.current = newBase;
    newBase.bringToBack();

    if (config.labelOverlay) {
      const newLabel = L.tileLayer(config.labelOverlay, {
        maxZoom: config.maxZoom,
      }).addTo(map);
      labelOverlayLayerRef.current = newLabel;
    }

    map.invalidateSize();
  }, [basemapMode]);

  // Re-invalidate size when container height or fullscreen changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.invalidateSize();
    const timer = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(timer);
  }, [heightClass, isFullscreen]);

  // 2. Programmatically Overlay KMFRI Station Pins via GeoJSON
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (stationsGeoJsonLayerRef.current) {
      map.removeLayer(stationsGeoJsonLayerRef.current);
      stationsGeoJsonLayerRef.current = null;
    }

    if (!showStations) return;

    const layer = L.geoJSON(KMFRI_STATIONS_GEOJSON, {
      pointToLayer: (feature, latlng) => {
        const props = feature.properties;
        const isHQ = props.code === 'KMFRI-HQ';
        const isMarine = props.category === 'Marine & Coastal';
        const pinColor = isHQ ? '#e11d48' : isMarine ? '#0284c7' : '#059669';

        const customIcon = L.divIcon({
          className: 'kmfri-station-pin',
          html: `
            <div style="position:relative;display:flex;align-items:center;justify-content:center;width:34px;height:42px;cursor:pointer;">
              <svg width="34" height="42" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 4px 6px rgba(0,0,0,0.45));">
                <path d="M17 0C7.61116 0 0 7.61116 0 17C0 27.25 14.5 40.5 16.1 41.9C16.6 42.3 17.4 42.3 17.9 41.9C19.5 40.5 34 27.25 34 17C34 7.61116 26.3888 0 17 0Z" fill="${pinColor}"/>
                <circle cx="17" cy="17" r="13" fill="#ffffff"/>
                <circle cx="17" cy="17" r="10" fill="${pinColor}"/>
                <circle cx="17" cy="17" r="4.5" fill="#ffffff"/>
              </svg>
              ${isHQ ? `<span style="position:absolute;top:-4px;right:-4px;width:10px;height:10px;border-radius:50%;background:#e11d48;border:2px solid white;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></span>` : ''}
            </div>
          `,
          iconSize: [34, 42],
          iconAnchor: [17, 42],
          popupAnchor: [0, -38],
        });

        const marker = L.marker(latlng, {
          icon: customIcon,
          zIndexOffset: isHQ ? 1000 : 500,
        });

        marker.bindPopup(`
          <div style="font-family:'Inter',sans-serif;min-width:240px;max-width:280px;padding:4px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;">
              <span style="font-size:9px;font-family:monospace;font-weight:700;padding:2px 6px;border-radius:4px;background:${pinColor}22;color:${pinColor};border:1px solid ${pinColor}44;">
                ${props.code}
              </span>
              <span style="font-size:10px;color:#64748b;margin-left:auto;">${props.category}</span>
            </div>
            <div style="font-size:13px;font-weight:800;color:#0f172a;margin-top:4px;">${props.name}</div>
            <div style="font-size:11px;color:#0284c7;font-weight:600;margin-top:2px;">📍 ${props.county} County · ${props.water_body}</div>
            <div style="font-size:10px;font-family:monospace;color:#475569;margin-top:3px;background:#f1f5f9;padding:3px 6px;border-radius:4px;">
              WGS84: ${props.latitude.toFixed(4)}°, ${props.longitude.toFixed(4)}° · ${props.elevation_or_depth}
            </div>
            <div style="font-size:11px;color:#334155;margin-top:5px;line-height:1.4;">
              <strong>Specialization:</strong> ${props.specialization}
            </div>
            <div style="font-size:10px;color:#64748b;margin-top:4px;border-top:1px dashed #cbd5e1;padding-top:4px;">
              <strong>Station Head:</strong> ${props.station_head} · <strong>Staff:</strong> ${props.staff_count} personnel
              ${props.active_vessels && props.active_vessels.length > 0 ? `<br/><strong>Fleet:</strong> ${props.active_vessels.join(', ')}` : ''}
            </div>
          </div>
        `);

        marker.on('click', () => {
          const matched = KMFRI_STATIONS.find((s) => s.id === props.id);
          if (matched) setSelectedStation(matched);
        });

        return marker;
      },
    }).addTo(map);

    stationsGeoJsonLayerRef.current = layer;
  }, [showStations]);

  // 3. Programmatically Overlay Research Area Polygons & Kenya 200NM EEZ via GeoJSON
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (researchAreasGeoJsonLayerRef.current) {
      map.removeLayer(researchAreasGeoJsonLayerRef.current);
      researchAreasGeoJsonLayerRef.current = null;
    }

    if (!showResearchAreas) return;

    const dataToRender = showEezOnly
      ? { type: 'FeatureCollection', features: [KENYA_EEZ_GEOJSON] }
      : RESEARCH_AREAS_GEOJSON;

    const layer = L.geoJSON(dataToRender as any, {
      style: (feature) => {
        const props = feature?.properties || {};
        const isEez = props.code === 'KMFRI-EEZ';
        return {
          color: props.color || '#0284c7',
          weight: isEez ? 2.5 : 2,
          opacity: 0.9,
          fillColor: props.fillColor || props.color || '#0284c7',
          fillOpacity: isEez ? 0.12 : 0.22,
          dashArray: isEez ? '6, 6' : undefined,
        };
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties || {};
        layer.bindPopup(`
          <div style="font-family:'Inter',sans-serif;min-width:220px;padding:4px;">
            <div style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:9px;font-family:monospace;font-weight:700;background:${props.color}22;color:${props.color};border:1px solid ${props.color}44;">
              ${props.type}
            </div>
            <div style="font-size:13px;font-weight:800;color:#0f172a;margin-top:4px;">${props.name}</div>
            <div style="font-size:10px;font-family:monospace;color:#64748b;margin-top:2px;">Code: ${props.code}</div>
            <div style="font-size:11px;color:#334155;margin-top:6px;line-height:1.4;">${props.description}</div>
            ${props.area_sq_km ? `<div style="font-size:10px;font-mono;color:#0284c7;margin-top:4px;font-weight:bold;">Area: ${props.area_sq_km.toLocaleString()} km²</div>` : ''}
          </div>
        `);
      },
    }).addTo(map);

    researchAreasGeoJsonLayerRef.current = layer;
  }, [showResearchAreas, showEezOnly]);

  // 4. Programmatically Overlay Republic of Kenya Sovereign Boundaries via GeoJSON
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (boundaryGeoJsonLayerRef.current) {
      map.removeLayer(boundaryGeoJsonLayerRef.current);
      boundaryGeoJsonLayerRef.current = null;
    }

    if (!showCountryBoundary) return;

    const layer = L.geoJSON(KENYA_NATIONAL_BOUNDARY_GEOJSON as any, {
      style: {
        color: '#10b981',
        weight: 2.5,
        opacity: 0.95,
        fillColor: '#10b981',
        fillOpacity: 0.04,
        dashArray: '8, 6',
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties || {};
        layer.bindPopup(`
          <div style="font-family:'Inter',sans-serif;min-width:240px;padding:4px;">
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:18px;">🇰🇪</span>
              <div>
                <div style="font-size:13px;font-weight:800;color:#0f172a;">${props.name}</div>
                <div style="font-size:10px;font-family:monospace;color:#059669;font-weight:700;">WGS84 Sovereign Border &amp; Maritime Baseline</div>
              </div>
            </div>
            <div style="font-size:11px;color:#334155;margin-top:8px;line-height:1.5;">
              <strong>Total Territorial Area:</strong> ${props.total_area_sq_km?.toLocaleString()} km²<br/>
              <strong>Land Area:</strong> ${props.land_area_sq_km?.toLocaleString()} km² · <strong>Inland Waters:</strong> ${props.water_area_sq_km?.toLocaleString()} km²<br/>
              <strong>Coastline Length:</strong> ~${props.coastline_km} km shoreline<br/>
              <strong>UNCLOS Status:</strong> 200 NM Exclusive Economic Zone (142,000 km²)
            </div>
          </div>
        `);
      },
    }).addTo(map);

    boundaryGeoJsonLayerRef.current = layer;
  }, [showCountryBoundary]);

  // 5. Programmatically Overlay Bathymetric Isobaths (-200m Continental Shelf & -1000m Bathyal Trench)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (isobaths200mLayerRef.current) {
      map.removeLayer(isobaths200mLayerRef.current);
      isobaths200mLayerRef.current = null;
    }
    if (isobaths1000mLayerRef.current) {
      map.removeLayer(isobaths1000mLayerRef.current);
      isobaths1000mLayerRef.current = null;
    }

    // -200m Shelf Break
    if (showIsobath200m) {
      const feat200m = BATHYMETRY_ISOBATHS_GEOJSON.features.filter(
        (f) => f.properties && f.properties.depth_meters === -200
      );
      const layer200 = L.geoJSON(
        { type: 'FeatureCollection', features: feat200m } as any,
        {
          style: {
            color: '#06b6d4',
            weight: 2.5,
            dashArray: '6, 6',
            opacity: 0.95,
          },
          onEachFeature: (feature, l) => {
            const props = feature.properties || {};
            l.bindPopup(`
              <div style="font-family:'Inter',sans-serif;min-width:210px;">
                <div style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:9px;font-family:monospace;font-weight:700;background:#06b6d422;color:#0891b2;border:1px solid #06b6d466;">
                  Bathymetric Contour: -200m
                </div>
                <div style="font-size:12px;font-weight:800;color:#0f172a;margin-top:3px;">${props.name}</div>
                <div style="font-size:11px;color:#334155;margin-top:4px;">${props.description}</div>
              </div>
            `);
          },
        }
      ).addTo(map);
      isobaths200mLayerRef.current = layer200;
    }

    // -1000m Bathyal Trench
    if (showIsobath1000m) {
      const feat1000m = BATHYMETRY_ISOBATHS_GEOJSON.features.filter(
        (f) => f.properties && f.properties.depth_meters === -1000
      );
      const layer1000 = L.geoJSON(
        { type: 'FeatureCollection', features: feat1000m } as any,
        {
          style: {
            color: '#3b82f6',
            weight: 2.5,
            dashArray: '4, 8',
            opacity: 0.9,
          },
          onEachFeature: (feature, l) => {
            const props = feature.properties || {};
            l.bindPopup(`
              <div style="font-family:'Inter',sans-serif;min-width:210px;">
                <div style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:9px;font-family:monospace;font-weight:700;background:#3b82f622;color:#2563eb;border:1px solid #3b82f666;">
                  Bathymetric Contour: -1,000m
                </div>
                <div style="font-size:12px;font-weight:800;color:#0f172a;margin-top:3px;">${props.name}</div>
                <div style="font-size:11px;color:#334155;margin-top:4px;">${props.description}</div>
              </div>
            `);
          },
        }
      ).addTo(map);
      isobaths1000mLayerRef.current = layer1000;
    }
  }, [showIsobath200m, showIsobath1000m]);

  // 6. Tactical Digital WGS84 Graticule HUD Grid
  useEffect(() => {
    const group = graticuleLayerGroupRef.current;
    if (!group) return;

    group.clearLayers();
    if (!showGraticule) return;

    // Parallels (Latitudes: -5° to +5°)
    for (let lat = -5; lat <= 5; lat += 1) {
      const isEquator = lat === 0;
      const parallel = L.polyline(
        [
          [lat, 33.5],
          [lat, 43.5],
        ],
        {
          color: isEquator ? '#f59e0b' : '#38bdf8',
          weight: isEquator ? 1.8 : 0.9,
          opacity: isEquator ? 0.65 : 0.35,
          dashArray: isEquator ? '8, 6' : '3, 6',
        }
      );
      parallel.bindTooltip(isEquator ? '0°00\' Equator' : `${Math.abs(lat)}°00'${lat > 0 ? 'N' : 'S'}`, {
        permanent: true,
        direction: 'right',
        className: 'kmfri-graticule-label',
      });
      parallel.addTo(group);
    }

    // Meridians (Longitudes: 34°E to 43°E)
    for (let lng = 34; lng <= 43; lng += 1) {
      const meridian = L.polyline(
        [
          [-5.5, lng],
          [5.5, lng],
        ],
        {
          color: '#38bdf8',
          weight: 0.9,
          opacity: 0.35,
          dashArray: '3, 6',
        }
      );
      meridian.bindTooltip(`${lng}°00'E`, {
        permanent: true,
        direction: 'top',
        className: 'kmfri-graticule-label',
      });
      meridian.addTo(group);
    }
  }, [showGraticule]);

  // 7. Field Sampling Locations Overlay
  useEffect(() => {
    const group = locationsGroupRef.current;
    if (!group) return;

    group.clearLayers();
    if (!showSamplingSites) return;

    locations.forEach((loc) => {
      const marker = L.circleMarker([loc.latitude, loc.longitude], {
        radius: 6,
        fillColor: '#38bdf8',
        color: '#0369a1',
        weight: 1.5,
        opacity: 1,
        fillOpacity: 0.85,
      });

      marker.bindPopup(`
        <div style="font-family:'Inter',sans-serif;min-width:190px;">
          <div style="font-size:10px;font-weight:700;color:#0284c7;">${loc.marine_coastal_area}</div>
          <div style="font-size:12px;font-weight:800;color:#0f172a;">${loc.site_name}</div>
          <div style="font-size:11px;color:#475569;">${loc.county} · ${loc.sub_county}</div>
          <div style="font-size:10px;font-family:monospace;color:#0369a1;margin-top:2px;">
            ${loc.latitude.toFixed(4)}°, ${loc.longitude.toFixed(4)}°
          </div>
        </div>
      `);

      if (onSelectLocation) {
        marker.on('click', () => onSelectLocation(loc));
      }

      marker.addTo(group);
    });
  }, [locations, showSamplingSites, onSelectLocation]);

  // 8. User Coordinate Target Marker
  useEffect(() => {
    const group = selectedCoordGroupRef.current;
    if (!group) return;

    group.clearLayers();
    if (!selectedCoordinates) return;

    L.circleMarker([selectedCoordinates.lat, selectedCoordinates.lng], {
      radius: 9,
      fillColor: '#e11d48',
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.95,
    })
      .bindPopup(`
        <div style="font-family:monospace;font-size:11px;color:#0f172a;">
          <strong>Target GIS Coordinate:</strong><br/>
          Lat: ${selectedCoordinates.lat}°<br/>
          Lng: ${selectedCoordinates.lng}°
        </div>
      `)
      .addTo(group);
  }, [selectedCoordinates]);

  // Click handler (Coordinate capture or measurement)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      if (measureMode) {
        setMeasurePoints((prev) => {
          const next = [...prev, e.latlng];
          if (next.length >= 2) {
            const dMeters = next[0].distanceTo(next[1]);
            const km = Math.round((dMeters / 1000) * 100) / 100;
            const nm = Math.round(km * 0.539957 * 100) / 100;
            setMeasureDistance({ km, nm });
          }
          return next;
        });
        return;
      }

      if (onMapClickCoordinates) {
        const lat = Number(e.latlng.lat.toFixed(6));
        const lng = Number(e.latlng.lng.toFixed(6));
        onMapClickCoordinates(lat, lng);
      }
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [onMapClickCoordinates, measureMode]);

  // Measuring Line Render
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (measureLineRef.current) {
      map.removeLayer(measureLineRef.current);
      measureLineRef.current = null;
    }

    if (measurePoints.length >= 2) {
      const line = L.polyline(measurePoints.slice(0, 2), {
        color: '#f59e0b',
        weight: 3,
        dashArray: '6, 8',
      }).addTo(map);
      measureLineRef.current = line;
    }
  }, [measurePoints]);

  // Smooth flyTo Station Navigation
  const flyToStation = (station: KmfriStation, zoom: number = 13) => {
    if (!mapInstanceRef.current) return;
    setSelectedStation(station);
    mapInstanceRef.current.flyTo([station.latitude, station.longitude], zoom, {
      duration: 1.5,
      easeLinearity: 0.25,
    });
  };

  const flyToCoords = (lat: number, lng: number, zoom: number = 11) => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([lat, lng], zoom, {
      duration: 1.4,
      easeLinearity: 0.25,
    });
  };

  // Group stations into 8 Primary Reference vs Inland/Aquaculture
  const reference8Stations = useMemo(
    () => KMFRI_STATIONS.filter((s) => PRIMARY_8_REFERENCE_STATIONS.includes(s.id)),
    []
  );
  const otherStations = useMemo(
    () => KMFRI_STATIONS.filter((s) => !PRIMARY_8_REFERENCE_STATIONS.includes(s.id)),
    []
  );

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 shadow-xl ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
      }`}
    >
      {/* Map Viewport Canvas */}
      <div ref={mapContainerRef} className={`w-full ${isFullscreen ? 'h-full' : heightClass}`} />

      {/* Sovereign Basemap Readiness HUD Badge when database locations are not loaded yet */}
      {locations.length === 0 && (
        <div className="hidden sm:flex absolute top-14 left-3 z-[400] max-w-md bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-teal-500/40 text-[11px] text-teal-300 shadow-xl items-center gap-2 pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse shrink-0" />
          <span>
            <strong>National GIS Telemetry:</strong> 13 Reference Stations &amp; Kenyan EEZ Active &middot; Ready for Field Site Coordinates
          </span>
        </div>
      )}

      {/* Top Floating Controls: Basemap Modes & Digital Marine Overlays */}
      <div className="absolute top-3 left-3 z-[400] max-w-[calc(100%-80px)] sm:max-w-none flex flex-wrap items-center gap-1.5 bg-slate-950/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/80 shadow-2xl text-xs">
        {/* Basemap Mode Selector */}
        <div className="flex items-center gap-1 pr-1.5 border-r border-slate-700">
          <button
            type="button"
            onClick={() => setBasemapMode('satellite')}
            className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
              basemapMode === 'satellite'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Satellite: Esri World Imagery + Hybrid place labels"
          >
            <Satellite className="w-3.5 h-3.5 text-sky-300" />
            <span>Satellite</span>
          </button>

          <button
            type="button"
            onClick={() => setBasemapMode('ocean')}
            className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
              basemapMode === 'ocean'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Ocean Chart: Esri Hydrographic & Bathymetric Basemap"
          >
            <Waves className="w-3.5 h-3.5 text-teal-300" />
            <span className="hidden sm:inline">Ocean Chart</span>
            <span className="sm:hidden">Ocean</span>
          </button>

          <button
            type="button"
            onClick={() => setBasemapMode('radar')}
            className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
              basemapMode === 'radar'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Digital Radar: CARTO Dark Matter tactical telemetry"
          >
            <Radio className="w-3.5 h-3.5 text-indigo-300" />
            <span className="hidden sm:inline">Digital Radar</span>
            <span className="sm:hidden">Radar</span>
          </button>

          <button
            type="button"
            onClick={() => setBasemapMode('terrain')}
            className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
              basemapMode === 'terrain'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Terrain: OpenStreetMap coastal topography"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-300" />
            <span>Terrain</span>
          </button>
        </div>

        {/* Feature Overlays Toggles */}
        <div className="hidden sm:flex items-center gap-1">
          {/* Kenya 200nm EEZ */}
          <button
            type="button"
            onClick={() => {
              if (!showResearchAreas) {
                setShowResearchAreas(true);
                setShowEezOnly(true);
              } else if (showEezOnly) {
                setShowEezOnly(false);
              } else {
                setShowEezOnly(true);
              }
            }}
            className={`px-2 py-1 rounded-lg font-medium flex items-center gap-1 text-[11px] transition-colors ${
              showResearchAreas && showEezOnly
                ? 'bg-sky-500/25 text-sky-200 border border-sky-400'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Kenyan 200nm Exclusive Economic Zone (142,000 km²)"
          >
            <Compass className="w-3 h-3 text-sky-400" />
            <span>200nm EEZ</span>
          </button>

          {/* Depth Isobaths (-200m & -1000m) */}
          <button
            type="button"
            onClick={() => {
              const next = !(showIsobath200m && showIsobath1000m);
              setShowIsobath200m(next);
              setShowIsobath1000m(next);
            }}
            className={`px-2 py-1 rounded-lg font-medium flex items-center gap-1 text-[11px] transition-colors ${
              showIsobath200m || showIsobath1000m
                ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Toggle -200m and -1000m Bathymetric Depth Isobaths"
          >
            <Waves className="w-3 h-3 text-cyan-400" />
            <span>Isobaths (-200m/-1000m)</span>
          </button>

          {/* Graticule Grid */}
          <button
            type="button"
            onClick={() => setShowGraticule(!showGraticule)}
            className={`px-2 py-1 rounded-lg font-medium flex items-center gap-1 text-[11px] transition-colors ${
              showGraticule
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Toggle Digital WGS84 Graticule HUD Grid"
          >
            <Grid className="w-3 h-3 text-sky-400" />
            <span>Graticule Grid</span>
          </button>

          {/* Sovereign Boundary */}
          <button
            type="button"
            onClick={() => setShowCountryBoundary(!showCountryBoundary)}
            className={`px-2 py-1 rounded-lg font-medium flex items-center gap-1 text-[11px] transition-colors ${
              showCountryBoundary
                ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Republic of Kenya Sovereign Territorial & Baseline Boundary"
          >
            <span>🇰🇪</span>
            <span>Border</span>
          </button>

          {/* Station Pins */}
          <button
            type="button"
            onClick={() => setShowStations(!showStations)}
            className={`px-2 py-1 rounded-lg font-medium flex items-center gap-1 text-[11px] transition-colors ${
              showStations
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'text-slate-400 hover:text-white'
            }`}
            title="KMFRI Station Drop Pins (GeoJSON)"
          >
            <MapPin className="w-3 h-3 text-rose-400" />
            <span>Stations ({KMFRI_STATIONS.length})</span>
          </button>

          {/* Measure NM Tool */}
          <button
            type="button"
            onClick={() => {
              setMeasureMode(!measureMode);
              setMeasurePoints([]);
              setMeasureDistance(null);
            }}
            className={`px-2 py-1 rounded-lg font-medium flex items-center gap-1 text-[11px] transition-colors ${
              measureMode ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:bg-slate-800'
            }`}
            title="Measure Nautical Distance on WGS84 Canvas"
          >
            <Ruler className="w-3 h-3" />
            <span>{measureMode ? 'Measuring...' : 'Measure NM'}</span>
          </button>
        </div>

        {/* Mobile HUD Expand Trigger */}
        <button
          type="button"
          onClick={() => setMobileHudOpen(!mobileHudOpen)}
          className="sm:hidden px-2 py-1 rounded-lg text-slate-300 hover:text-white bg-slate-800 text-[11px] font-medium"
        >
          Overlays {mobileHudOpen ? '▲' : '▼'}
        </button>
      </div>

      {/* Fly-To Telemetry Navigation Menu (Top Right) */}
      <div className="absolute top-3 right-12 z-[400] flex items-center gap-1.5 bg-slate-950/90 backdrop-blur-md p-1 rounded-xl border border-slate-700/80 text-xs shadow-xl">
        <label className="text-[10px] text-sky-400 font-mono font-bold pl-1.5 flex items-center gap-1">
          <Crosshair className="w-3 h-3 text-teal-400" />
          <span className="hidden md:inline">Fly-To Station:</span>
        </label>
        <select
          onChange={(e) => {
            const val = e.target.value;
            if (!val) return;
            if (val === 'kenya-eez') {
              flyToCoords(-3.5, 40.5, 8);
              return;
            }
            if (val === 'kenya-all') {
              flyToCoords(-0.5, 37.8, 7);
              return;
            }
            // Check station
            const st = KMFRI_STATIONS.find((s) => s.id === val);
            if (st) {
              flyToStation(st, 13);
              return;
            }
            // Check operational site
            const loc = locations.find((l) => l.id === val);
            if (loc) {
              flyToCoords(loc.latitude, loc.longitude, 14);
            }
          }}
          defaultValue=""
          className="bg-slate-900 border border-slate-700 rounded-lg text-sky-200 text-xs py-1 px-2 focus:outline-none focus:border-sky-500 max-w-[150px] sm:max-w-[210px] truncate"
        >
          <option value="" disabled>Select Navigation Target...</option>
          <optgroup label="Sovereign Overview">
            <option value="kenya-all">🇰🇪 Republic of Kenya (Whole Country)</option>
            <option value="kenya-eez">🌊 200nm Marine EEZ (142,000 km²)</option>
          </optgroup>
          <optgroup label="8 Primary KMFRI Reference Stations">
            {reference8Stations.map((s) => (
              <option key={s.id} value={s.id}>
                📍 {s.code} · {s.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Inland & Aquaculture Research Centers">
            {otherStations.map((s) => (
              <option key={s.id} value={s.id}>
                📍 {s.code} · {s.name}
              </option>
            ))}
          </optgroup>
          {locations.length > 0 && (
            <optgroup label={`Field Sampling Sites (${locations.length})`}>
              {locations.slice(0, 15).map((l) => (
                <option key={l.id} value={l.id}>
                  🧪 {l.site_name} ({l.county})
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* Fullscreen Toggle Button */}
      <button
        type="button"
        onClick={() => setIsFullscreen(!isFullscreen)}
        className="absolute top-3 right-3 z-[400] p-1.5 rounded-xl bg-slate-950/90 border border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800 shadow-xl"
        title={isFullscreen ? 'Exit Fullscreen GIS' : 'Enter Fullscreen GIS Tactical Canvas'}
      >
        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>

      {/* Mobile Overlays Slide-Down Drawer */}
      {mobileHudOpen && (
        <div className="sm:hidden absolute top-14 left-3 right-3 z-[400] bg-slate-950/95 backdrop-blur-md p-3 rounded-xl border border-slate-700 text-xs shadow-2xl space-y-2">
          <div className="font-semibold text-sky-300 pb-1 border-b border-slate-800 flex items-center justify-between">
            <span>Digital Marine Overlays (GeoJSON)</span>
            <button type="button" onClick={() => setMobileHudOpen(false)}>
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => setShowResearchAreas(!showResearchAreas)}
              className={`p-1.5 rounded border text-left ${
                showResearchAreas ? 'bg-teal-900/60 border-teal-500 text-teal-200' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              🌊 200nm Marine EEZ
            </button>
            <button
              type="button"
              onClick={() => {
                const n = !showIsobath200m;
                setShowIsobath200m(n);
                setShowIsobath1000m(n);
              }}
              className={`p-1.5 rounded border text-left ${
                showIsobath200m ? 'bg-cyan-900/60 border-cyan-500 text-cyan-200' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              📉 Depth Isobaths
            </button>
            <button
              type="button"
              onClick={() => setShowGraticule(!showGraticule)}
              className={`p-1.5 rounded border text-left ${
                showGraticule ? 'bg-sky-900/60 border-sky-500 text-sky-200' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              🌐 WGS84 Graticule
            </button>
            <button
              type="button"
              onClick={() => setShowCountryBoundary(!showCountryBoundary)}
              className={`p-1.5 rounded border text-left ${
                showCountryBoundary ? 'bg-emerald-900/60 border-emerald-500 text-emerald-200' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              🇰🇪 Sovereign Border
            </button>
            <button
              type="button"
              onClick={() => setShowStations(!showStations)}
              className={`p-1.5 rounded border text-left ${
                showStations ? 'bg-rose-900/60 border-rose-500 text-rose-200' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              📍 Station Pins
            </button>
            <button
              type="button"
              onClick={() => setShowSamplingSites(!showSamplingSites)}
              className={`p-1.5 rounded border text-left ${
                showSamplingSites ? 'bg-indigo-900/60 border-indigo-500 text-indigo-200' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              🧪 Sampling Sites
            </button>
          </div>
        </div>
      )}

      {/* Measuring Distance Banner */}
      {measureMode && (
        <div className="absolute top-16 left-3 z-[400] bg-amber-950/90 border border-amber-600/80 rounded-xl px-3 py-2 text-amber-200 text-xs shadow-2xl flex items-center gap-3">
          <div>
            <strong>Nautical Distance Tool:</strong>{' '}
            {measureDistance ? (
              <span className="font-mono text-white font-bold text-sm">
                {measureDistance.nm} Nautical Miles ({measureDistance.km} km)
              </span>
            ) : (
              <span>Click two points on the map to calculate geodesic distance.</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setMeasurePoints([]);
              setMeasureDistance(null);
            }}
            className="text-xs text-amber-400 hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* Selected Station Quick Telemetry Card */}
      {selectedStation && (
        <div className="absolute top-16 right-3 z-[400] max-w-xs bg-slate-950/95 backdrop-blur-md p-3.5 rounded-xl border border-sky-800/80 text-white text-xs shadow-2xl space-y-2">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-950 text-sky-300 border border-sky-700">
              {selectedStation.code}
            </span>
            <button
              type="button"
              onClick={() => setSelectedStation(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div>
            <div className="font-bold text-sm text-white">{selectedStation.name}</div>
            <div className="text-[11px] text-teal-400 font-medium mt-0.5">
              {selectedStation.county} County · {selectedStation.water_body}
            </div>
            <div className="text-[10px] text-slate-300 mt-1 font-mono">
              WGS84: {selectedStation.latitude.toFixed(4)}°, {selectedStation.longitude.toFixed(4)}° · {selectedStation.elevation_or_depth}
            </div>
          </div>
          <div className="text-[11px] text-slate-300">
            <strong>Head:</strong> {selectedStation.station_head} · <strong>Staff:</strong> {selectedStation.staff_count}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => flyToStation(selectedStation, 14)}
              className="flex-1 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-semibold text-center"
            >
              Zoom Station (14x)
            </button>
          </div>
        </div>
      )}

      {/* Bottom Live Cursor Telemetry Bar (DD & DMS Readouts) */}
      <div className="absolute bottom-2 left-2 right-2 z-[400] bg-slate-950/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 text-[11px] text-slate-300 shadow-2xl flex flex-wrap items-center justify-between gap-2 font-mono">
        {/* Left: Dual Telemetry Readout */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-teal-300">
            <Crosshair className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="font-bold text-white">DD:</span>
            <span>{telemetry.dd}</span>
          </div>

          <div className="flex items-center gap-1 text-sky-300">
            <span className="font-bold text-white">DMS:</span>
            <span>{telemetry.dms}</span>
          </div>
        </div>

        {/* Right: Technical Spec & Projection */}
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <span>
            Mode: <strong className="text-sky-300 uppercase">{basemapMode}</strong>
          </span>
          <span>
            Zoom: <strong className="text-white">Z:{zoomLevel}</strong>
          </span>
          <span className="hidden sm:inline bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-bold">
            WGS84 / EPSG:4326
          </span>
        </div>
      </div>
    </div>
  );
};
