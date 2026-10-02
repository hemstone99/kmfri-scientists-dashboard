import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocationRecord, ProjectLocationRecord, ProjectRecord } from '../types.ts';
import {
  Compass,
  Layers,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Waves,
  Crosshair,
  Plus,
  Globe,
  Radio,
  Map as MapIcon,
  Grid,
} from 'lucide-react';

interface InteractiveMapProps {
  locations: LocationRecord[];
  projectLocations: ProjectLocationRecord[];
  projects: ProjectRecord[];
  selectedProjectId?: string;
  onSelectProject?: (projectId: string) => void;
  onPickCoordinates?: (
    lat: number,
    lng: number,
    suggestedRegion?: { county: string; marineArea: string; site: string }
  ) => void;
  heightClass?: string;
}

export type MapBasemapMode = 'SATELLITE' | 'OCEAN' | 'RADAR' | 'TERRAIN';

interface ReferenceStation {
  id: string;
  name: string;
  shortName: string;
  lat: number;
  lng: number;
  county: string;
  marineArea: string;
  depthOrElevation: string;
  focus: string;
}

const KENYA_REFERENCE_STATIONS: ReferenceStation[] = [
  {
    id: 'ref-mombasa',
    name: 'KMFRI HQ (English Point, Mombasa)',
    shortName: 'Mombasa HQ',
    lat: -4.0547,
    lng: 39.6836,
    county: 'Mombasa',
    marineArea: 'Tudor Creek & Mombasa Inshore Waters',
    depthOrElevation: '-18m Inshore Channel',
    focus: 'Oceanography, Hydrography & Marine Pollution Forensics',
  },
  {
    id: 'ref-gazi',
    name: 'Gazi Bay Blue Carbon Field Station',
    shortName: 'Gazi Bay',
    lat: -4.4239,
    lng: 39.5058,
    county: 'Kwale',
    marineArea: 'Gazi Bay Mangrove & Seagrass Ecosystem',
    depthOrElevation: 'Intertidal / -6m Lagoon',
    focus: 'Blue Carbon Sequestration, Mangrove Restoration & Seagrass',
  },
  {
    id: 'ref-shimoni',
    name: 'Shimoni-Vanga Transboundary Reef Station',
    shortName: 'Shimoni-Vanga',
    lat: -4.6476,
    lng: 39.3814,
    county: 'Kwale',
    marineArea: 'Kisite-Mpunguti Marine Protected Area',
    depthOrElevation: '-25m Coral Fore-Reef',
    focus: 'Coral Reef Resilience, Marine Biodiversity & Co-Management',
  },
  {
    id: 'ref-malindi',
    name: 'Malindi-Watamu Marine Biosphere Station',
    shortName: 'Malindi-Watamu',
    lat: -3.3521,
    lng: 40.0264,
    county: 'Kilifi',
    marineArea: 'Malindi-Watamu Biosphere Reserve',
    depthOrElevation: '-40m Continental Shelf',
    focus: 'Demersal & Pelagic Fisheries Stock Assessment',
  },
  {
    id: 'ref-lamu',
    name: 'Lamu Archipelago & North Kenya Banks Station',
    shortName: 'Lamu / NKB',
    lat: -2.2696,
    lng: 40.902,
    county: 'Lamu',
    marineArea: 'Lamu Seascape & North Kenya Banks EEZ',
    depthOrElevation: '-180m Upwelling Zone',
    focus: 'Deep-Water EEZ Upwelling, Tuna & Crustacean Stocks',
  },
  {
    id: 'ref-kisumu',
    name: 'Kisumu Freshwater Research Centre',
    shortName: 'Kisumu (L. Victoria)',
    lat: -0.0917,
    lng: 34.768,
    county: 'Kisumu',
    marineArea: 'Lake Victoria Winam Gulf Basin',
    depthOrElevation: '1,135m ASL (-12m Gulf)',
    focus: 'Nile Perch, Dagaa Stock Dynamics & Eutrophication',
  },
  {
    id: 'ref-turkana',
    name: 'Kalokol Research Station (Lake Turkana)',
    shortName: 'Kalokol (L. Turkana)',
    lat: 3.522,
    lng: 35.856,
    county: 'Turkana',
    marineArea: 'Lake Turkana Ferguson Gulf',
    depthOrElevation: '360m ASL (-30m Basin)',
    focus: 'Arid-Zone Limnology & Endemic Freshwater Fisheries',
  },
  {
    id: 'ref-naivasha',
    name: 'Naivasha Limnology & Aquaculture Station',
    shortName: 'Naivasha Station',
    lat: -0.7667,
    lng: 36.35,
    county: 'Nakuru',
    marineArea: 'Lake Naivasha Freshwater Basin',
    depthOrElevation: '1,884m ASL (-6m Lake)',
    focus: 'Inland Wetland Ecology, Cage Culture & Fish Health',
  },
];

// Kenyan 200nm Exclusive Economic Zone (EEZ) Polygon Coordinates (WGS84)
const KENYA_EEZ_COORDS: [number, number][] = [
  [-4.67, 39.22],
  [-4.05, 39.68],
  [-3.22, 40.12],
  [-2.27, 40.9],
  [-1.66, 41.56],
  [-2.95, 44.5],
  [-6.25, 42.35],
  [-4.67, 39.22],
];

// -200m Continental Shelf & North Kenya Banks Isobath
const SHELF_200M_COORDS: [number, number][] = [
  [-4.68, 39.42],
  [-4.12, 39.82],
  [-3.35, 40.32],
  [-2.55, 41.15],
  [-1.78, 41.85],
];

// -1000m Deep Pemba Trough & Somali Basin Slope Isobath
const SLOPE_1000M_COORDS: [number, number][] = [
  [-4.85, 39.85],
  [-4.18, 40.35],
  [-3.38, 40.95],
  [-2.52, 41.78],
  [-1.88, 42.45],
];

function isValidLatLng(lat: unknown, lng: unknown): boolean {
  const nLat = Number(lat);
  const nLng = Number(lng);
  return (
    Number.isFinite(nLat) &&
    Number.isFinite(nLng) &&
    nLat >= -90 &&
    nLat <= 90 &&
    nLng >= -180 &&
    nLng <= 180
  );
}

function safeNavigateMap(
  map: L.Map | null,
  lat: unknown,
  lng: unknown,
  zoom: unknown
) {
  if (!map || !isValidLatLng(lat, lng)) return;
  const targetLat = Number(lat);
  const targetLng = Number(lng);
  let currentZoom = 6;
  try {
    const z = map.getZoom();
    if (Number.isFinite(z)) currentZoom = z;
  } catch {
    // fallback to 6
  }
  const safeZoom = Number.isFinite(Number(zoom)) ? Number(zoom) : currentZoom;

  try {
    const size = map.getSize();
    const hasValidSize = Boolean(size && size.x > 0 && size.y > 0);
    if (hasValidSize) {
      map.invalidateSize({ pan: false });
    }
    map.setView([targetLat, targetLng], safeZoom, { animate: hasValidSize });
  } catch {
    try {
      map.setView([targetLat, targetLng], safeZoom, { animate: false });
    } catch {
      // Ignore if map container is not mounted
    }
  }
}

function formatDMS(deg: number, isLat: boolean): string {
  const safeDeg = Number.isFinite(Number(deg)) ? Number(deg) : 0;
  const dir = isLat ? (safeDeg >= 0 ? 'N' : 'S') : safeDeg >= 0 ? 'E' : 'W';
  const abs = Math.abs(safeDeg);
  const d = Math.floor(abs);
  const mFloat = (abs - d) * 60;
  const m = Math.floor(mFloat);
  const s = Math.round((mFloat - m) * 60);
  return `${String(d).padStart(2, '0')}°${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}"${dir}`;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  locations,
  projectLocations,
  projects,
  selectedProjectId,
  onSelectProject,
  onPickCoordinates,
  heightClass = 'h-[500px]',
}) => {
  const [selectedLocId, setSelectedLocId] = useState<string | null>(
    locations[0]?.id || null
  );
  const [selectedRefId, setSelectedRefId] = useState<string>('ref-mombasa');
  const [basemapMode, setBasemapMode] = useState<MapBasemapMode>('SATELLITE');
  const [viewZone, setViewZone] = useState<'ALL' | 'COAST' | 'INLAND'>('ALL');
  const [countyFilter, setCountyFilter] = useState<string>('ALL');
  const [showBathymetry, setShowBathymetry] = useState(true);
  const [showReferenceStations, setShowReferenceStations] = useState(true);
  const [showDigitalHudGrid, setShowDigitalHudGrid] = useState(true);
  const [zoomLevel, setZoomLevel] = useState<number>(6);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number }>({
    lat: -4.0547,
    lng: 39.6836,
  });

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayersRef = useRef<L.LayerGroup | null>(null);
  const vectorLayersRef = useRef<L.LayerGroup | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const isFirstZoneRenderRef = useRef<boolean>(true);

  const counties = Array.from(new Set(locations.map((l) => l.county))).sort();

  const filteredLocations = locations.filter((loc) => {
    if (!isValidLatLng(loc.latitude, loc.longitude)) return false;
    if (countyFilter !== 'ALL' && loc.county !== countyFilter) return false;
    if (selectedProjectId) {
      const linked = projectLocations.some(
        (pl) => pl.locationId === loc.id && pl.projectId === selectedProjectId
      );
      if (!linked) return false;
    }
    if (viewZone === 'COAST') return Number(loc.longitude) >= 38.5;
    if (viewZone === 'INLAND') return Number(loc.longitude) < 38.5;
    return true;
  });

  const activeLocation =
    filteredLocations.find((l) => l.id === selectedLocId) ||
    filteredLocations[0] ||
    null;

  const activeReference =
    KENYA_REFERENCE_STATIONS.find((r) => r.id === selectedRefId) ||
    KENYA_REFERENCE_STATIONS[0];

  const activeLinkedProjects = activeLocation
    ? projectLocations
        .filter((pl) => pl.locationId === activeLocation.id)
        .map((pl) => ({
          ...pl,
          project: projects.find((p) => p.id === pl.projectId),
        }))
        .filter((item) => Boolean(item.project))
    : [];

  // Initialize Leaflet Map Instance
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [-1.85, 38.45],
      zoom: 6,
      zoomControl: false,
      attributionControl: true,
    });

    tileLayersRef.current = L.layerGroup().addTo(map);
    vectorLayersRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);

    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      if (e?.latlng && isValidLatLng(e.latlng.lat, e.latlng.lng)) {
        setCursorCoords({
          lat: Number(e.latlng.lat.toFixed(4)),
          lng: Number(e.latlng.lng.toFixed(4)),
        });
      }
    });

    map.on('zoomend', () => {
      const z = map.getZoom();
      if (Number.isFinite(z)) {
        setZoomLevel(z);
      }
    });

    mapInstanceRef.current = map;

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        try {
          if (mapInstanceRef.current) {
            const sz = mapInstanceRef.current.getSize();
            if (sz && sz.x > 0 && sz.y > 0) {
              mapInstanceRef.current.invalidateSize({ pan: false });
            }
          }
        } catch {
          // ignore resize errors
        }
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver?.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle Map Click for Coordinate Picking
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (!onPickCoordinates) return;
      if (!e?.latlng || !isValidLatLng(e.latlng.lat, e.latlng.lng)) return;
      const lat = Number(e.latlng.lat.toFixed(4));
      const lng = Number(e.latlng.lng.toFixed(4));
      onPickCoordinates(lat, lng);
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [onPickCoordinates]);

  // Synchronize Satellite / Oceanographic / Digital Radar Tile Layers
  useEffect(() => {
    const group = tileLayersRef.current;
    if (!group) return;
    group.clearLayers();

    if (basemapMode === 'SATELLITE') {
      // Esri High-Resolution World Imagery Satellite + Hybrid Reference Overlay
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, KMFRI GIS',
        }
      ).addTo(group);

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          opacity: 0.85,
        }
      ).addTo(group);
    } else if (basemapMode === 'OCEAN') {
      // Esri Hydrographic & Bathymetric Ocean Basemap
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 16,
          attribution: 'Tiles &copy; Esri &mdash; GEBCO, NOAA, National Geographic, KMFRI Hydrography',
        }
      ).addTo(group);

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 16,
          opacity: 0.9,
        }
      ).addTo(group);
    } else if (basemapMode === 'RADAR') {
      // CARTO Dark Matter Digital Telemetry Basemap
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
          maxZoom: 19,
          subdomains: 'abcd',
          attribution: '&copy; OpenStreetMap &copy; CARTO Digital Telemetry',
        }
      ).addTo(group);
    } else {
      // Standard Terrain & Coastal Topographic Street Map
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(group);
    }
  }, [basemapMode]);

  // Synchronize View Zone (All Basins / Marine & EEZ / Freshwater Lakes)
  useEffect(() => {
    if (isFirstZoneRenderRef.current) {
      isFirstZoneRenderRef.current = false;
      return;
    }
    const map = mapInstanceRef.current;
    if (!map) return;

    if (viewZone === 'COAST') {
      safeNavigateMap(map, -3.65, 40.35, 7);
    } else if (viewZone === 'INLAND') {
      safeNavigateMap(map, 0.65, 35.65, 7);
    } else {
      safeNavigateMap(map, -1.85, 38.45, 6);
    }
  }, [viewZone]);

  // Render Bathymetry Contours & Kenyan EEZ Vector Overlays
  useEffect(() => {
    const group = vectorLayersRef.current;
    if (!group) return;
    group.clearLayers();

    // Kenyan 200nm EEZ Polygon
    const eezPolygon = L.polygon(KENYA_EEZ_COORDS, {
      color: '#38bdf8',
      weight: 2,
      dashArray: '8, 6',
      fillColor: '#0284c7',
      fillOpacity: basemapMode === 'SATELLITE' ? 0.12 : 0.16,
    });
    eezPolygon.bindTooltip(
      '<div style="font-family: JetBrains Mono, monospace; font-size: 11px;"><strong>KENYA 200nm EEZ</strong><br/>142,400 km² Marine Jurisdiction</div>',
      { sticky: true }
    );
    eezPolygon.addTo(group);

    // Equator Line (0.0000° Lat)
    L.polyline(
      [
        [0, 33.5],
        [0, 44.5],
      ],
      {
        color: '#94a3b8',
        weight: 1,
        dashArray: '4, 6',
        opacity: 0.6,
      }
    ).addTo(group);

    if (showBathymetry) {
      // -200m Continental Shelf & North Kenya Banks
      const shelfLine = L.polyline(SHELF_200M_COORDS, {
        color: '#2dd4bf',
        weight: 2.2,
        opacity: 0.9,
      });
      shelfLine.bindTooltip(
        '<span style="font-family: JetBrains Mono, monospace; font-size: 10px;">-200m Continental Shelf & North Kenya Banks</span>'
      );
      shelfLine.addTo(group);

      // -1000m Deep Slope & Pemba Trough
      const slopeLine = L.polyline(SLOPE_1000M_COORDS, {
        color: '#38bdf8',
        weight: 1.8,
        dashArray: '5, 5',
        opacity: 0.8,
      });
      slopeLine.bindTooltip(
        '<span style="font-family: JetBrains Mono, monospace; font-size: 10px;">-1000m Pemba Trough & Somali Basin Isobath</span>'
      );
      slopeLine.addTo(group);
    }
  }, [showBathymetry, basemapMode]);

  // Render Reference Station Beacons & Operational Database Project Markers
  useEffect(() => {
    const group = markersLayerRef.current;
    if (!group) return;
    group.clearLayers();

    // 1. KMFRI Reference Stations Layer
    if (showReferenceStations) {
      KENYA_REFERENCE_STATIONS.forEach((ref) => {
        if (!isValidLatLng(ref.lat, ref.lng)) return;
        const isSelected = !activeLocation && activeReference.id === ref.id;
        const iconHtml = `
          <div style="position: relative; display: flex; align-items: center; justify-content: center;">
            <span style="
              position: absolute;
              width: ${isSelected ? '32px' : '22px'};
              height: ${isSelected ? '32px' : '22px'};
              border-radius: 9999px;
              background: rgba(56, 189, 248, ${isSelected ? '0.35' : '0.2'});
              border: 1.5px solid #38bdf8;
              box-shadow: 0 0 12px rgba(56, 189, 248, 0.8);
            "></span>
            <span style="
              position: relative;
              width: ${isSelected ? '13px' : '10px'};
              height: ${isSelected ? '13px' : '10px'};
              border-radius: 9999px;
              background: ${isSelected ? '#38bdf8' : '#0284c7'};
              border: 2px solid #ffffff;
            "></span>
            <span style="
              position: absolute;
              left: 16px;
              white-space: nowrap;
              background: rgba(8, 34, 56, 0.9);
              color: #e0f2fe;
              border: 1px solid rgba(56, 189, 248, 0.45);
              padding: 1px 6px;
              border-radius: 6px;
              font-family: 'Plus Jakarta Sans', sans-serif;
              font-size: 10px;
              font-weight: 700;
              box-shadow: 0 2px 6px rgba(0,0,0,0.45);
            ">${ref.shortName}</span>
          </div>
        `;

        const divIcon = L.divIcon({
          html: iconHtml,
          className: 'kmfri-ref-station-icon',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        const marker = L.marker([ref.lat, ref.lng], { icon: divIcon });
        marker.on('click', (ev) => {
          L.DomEvent.stopPropagation(ev);
          setSelectedLocId(null);
          setSelectedRefId(ref.id);
          const currentZ = mapInstanceRef.current?.getZoom() ?? 6;
          safeNavigateMap(
            mapInstanceRef.current,
            ref.lat,
            ref.lng,
            Math.max(Number.isFinite(currentZ) ? currentZ : 6, 9)
          );
        });
        marker.addTo(group);
      });
    }

    // 2. Operational Database Project Sites Layer
    filteredLocations.forEach((loc) => {
      const latNum = Number(loc.latitude);
      const lngNum = Number(loc.longitude);
      if (!isValidLatLng(latNum, lngNum)) return;

      const isSelected = activeLocation?.id === loc.id;
      const linkedCount = projectLocations.filter(
        (pl) => pl.locationId === loc.id
      ).length;

      const iconHtml = `
        <div style="position: relative; display: flex; align-items: center; justify-content: center;">
          <span style="
            position: absolute;
            width: ${isSelected ? '36px' : '26px'};
            height: ${isSelected ? '36px' : '26px'};
            border-radius: 9999px;
            background: rgba(20, 184, 166, 0.32);
            border: 1.5px solid #2dd4bf;
            box-shadow: 0 0 14px rgba(20, 184, 166, 0.9);
          "></span>
          <span style="
            position: relative;
            width: ${isSelected ? '15px' : '12px'};
            height: ${isSelected ? '15px' : '12px'};
            border-radius: 9999px;
            background: #14b8a6;
            border: 2.5px solid #ffffff;
          "></span>
          <span style="
            position: absolute;
            left: 18px;
            white-space: nowrap;
            background: rgba(4, 47, 46, 0.94);
            color: #5eead4;
            border: 1px solid #14b8a6;
            padding: 2px 7px;
            border-radius: 6px;
            font-family: 'Plus Jakarta Sans', sans-serif;
            font-size: 10.5px;
            font-weight: 700;
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
          ">${loc.name}${linkedCount > 0 ? ` [${linkedCount}]` : ''}</span>
        </div>
      `;

      const divIcon = L.divIcon({
        html: iconHtml,
        className: 'kmfri-operational-site-icon',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      const marker = L.marker([latNum, lngNum], { icon: divIcon });
      marker.on('click', (ev) => {
        L.DomEvent.stopPropagation(ev);
        setSelectedLocId(loc.id);
        const currentZ = mapInstanceRef.current?.getZoom() ?? 6;
        safeNavigateMap(
          mapInstanceRef.current,
          latNum,
          lngNum,
          Math.max(Number.isFinite(currentZ) ? currentZ : 6, 10)
        );
      });
      marker.addTo(group);
    });
  }, [
    showReferenceStations,
    filteredLocations,
    activeLocation,
    activeReference,
    projectLocations,
  ]);

  const handleSelectReferenceStation = (st: ReferenceStation) => {
    setSelectedLocId(null);
    setSelectedRefId(st.id);
    safeNavigateMap(mapInstanceRef.current, st.lat, st.lng, 10);
  };

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
      {/* Modern Top Digital & Satellite GIS Command Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-600/10 dark:bg-sky-400/10 border border-sky-500/20 flex items-center justify-center">
            <Compass className="w-4 h-4 text-sky-700 dark:text-sky-400" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                KMFRI Hydrographic & Station GIS Canvas (WGS84)
              </span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="text-xs font-mono font-semibold tabular-nums text-sky-700 dark:text-sky-400">
                {filteredLocations.length} Mapped Site
                {filteredLocations.length === 1 ? '' : 's'}
              </span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="text-xs font-mono tabular-nums text-teal-700 dark:text-teal-400">
                {KENYA_REFERENCE_STATIONS.length} Reference Stations
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              High-Resolution Satellite Imagery, Bathymetric Ocean Chart, Digital Telemetry & 200nm EEZ
            </div>
          </div>
        </div>

        {/* Basemap Mode Switcher (Satellite / Ocean Chart / Digital Radar / Terrain) + Basin & Layer Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Basemap Layer Selector */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/80 dark:bg-slate-800 rounded-lg border border-slate-300/60 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setBasemapMode('SATELLITE')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                basemapMode === 'SATELLITE'
                  ? 'bg-sky-700 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Satellite</span>
            </button>
            <button
              type="button"
              onClick={() => setBasemapMode('OCEAN')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                basemapMode === 'OCEAN'
                  ? 'bg-sky-700 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Waves className="w-3.5 h-3.5" />
              <span>Ocean Chart</span>
            </button>
            <button
              type="button"
              onClick={() => setBasemapMode('RADAR')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                basemapMode === 'RADAR'
                  ? 'bg-sky-700 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Digital Radar</span>
            </button>
            <button
              type="button"
              onClick={() => setBasemapMode('TERRAIN')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                basemapMode === 'TERRAIN'
                  ? 'bg-sky-700 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Terrain</span>
            </button>
          </div>

          {/* Basin Extent Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/75 dark:bg-slate-800 rounded-lg">
            {(['ALL', 'COAST', 'INLAND'] as const).map((zone) => (
              <button
                key={zone}
                type="button"
                onClick={() => setViewZone(zone)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  viewZone === zone
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {zone === 'ALL'
                  ? 'All Basins'
                  : zone === 'COAST'
                    ? 'Marine & EEZ'
                    : 'Freshwater Lakes'}
              </button>
            ))}
          </div>

          {/* Vector Overlays Toggles */}
          <button
            type="button"
            onClick={() => setShowBathymetry(!showBathymetry)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 ${
              showBathymetry
                ? 'border-sky-500/40 bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            }`}
            title="Toggle -200m & -1000m Bathymetric Contours"
          >
            <Waves className="w-3.5 h-3.5" />
            <span>Isobaths</span>
          </button>

          <button
            type="button"
            onClick={() => setShowReferenceStations(!showReferenceStations)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 ${
              showReferenceStations
                ? 'border-teal-500/40 bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            }`}
            title="Toggle KMFRI Reference Stations"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>KMFRI Stations</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDigitalHudGrid(!showDigitalHudGrid)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 ${
              showDigitalHudGrid
                ? 'border-sky-500/40 bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            }`}
            title="Toggle Digital WGS84 Graticule Overlay"
          >
            <Grid className="w-3.5 h-3.5" />
            <span>HUD Grid</span>
          </button>

          {counties.length > 0 && (
            <select
              value={countyFilter}
              onChange={(e) => setCountyFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              <option value="ALL">All Counties ({counties.length})</option>
              {counties.map((c) => (
                <option key={c} value={c}>
                  {c} County
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Main Split GIS Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left 8-Column Interactive Satellite & Digital Hydrographic Map */}
        <div
          className={`lg:col-span-8 relative ${heightClass} bg-[#041424] overflow-hidden select-none`}
        >
          {/* Leaflet Map Container */}
          <div
            ref={mapContainerRef}
            className={`w-full h-full z-0 ${
              onPickCoordinates ? 'cursor-crosshair' : 'cursor-grab'
            }`}
          />

          {/* Digital Tactical WGS84 Graticule Overlay */}
          {showDigitalHudGrid && (
            <div
              className="pointer-events-none absolute inset-0 z-[400]"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(56, 189, 248, 0.09) 1px, transparent 1px), linear-gradient(to bottom, rgba(56, 189, 248, 0.09) 1px, transparent 1px)',
                backgroundSize: '64px 64px',
              }}
            />
          )}

          {/* Floating Zoom & Reset Extent Controls */}
          <div className="absolute top-3.5 right-3.5 z-[500] flex flex-col gap-1 bg-slate-950/85 backdrop-blur-xs border border-sky-500/30 p-1 rounded-xl shadow-lg">
            <button
              type="button"
              onClick={() => {
                try {
                  mapInstanceRef.current?.zoomIn();
                } catch {
                  // ignore zoom error
                }
              }}
              className="p-1.5 rounded-lg text-slate-200 hover:text-white hover:bg-sky-900/60 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  mapInstanceRef.current?.zoomOut();
                } catch {
                  // ignore zoom error
                }
              }}
              className="p-1.5 rounded-lg text-slate-200 hover:text-white hover:bg-sky-900/60 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setViewZone('ALL');
                safeNavigateMap(mapInstanceRef.current, -1.85, 38.45, 6);
              }}
              className="p-1.5 rounded-lg text-slate-200 hover:text-white hover:bg-sky-900/60 transition-colors"
              title="Reset Full Kenya & EEZ Extent"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Floating Digital Legend & Active Sensor Readout */}
          <div className="absolute top-3.5 left-3.5 z-[500] px-3.5 py-2.5 rounded-xl bg-slate-950/85 backdrop-blur-xs border border-sky-500/30 text-[11px] text-slate-200 space-y-1.5 shadow-lg">
            <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-1 font-mono text-[10px] text-sky-400">
              <span>SENSOR: {basemapMode}</span>
              <span>ZOOM: {zoomLevel}x</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-400 inline-block ring-2 ring-teal-400/30" />
              <span>Operational Project Site ({filteredLocations.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />
              <span>KMFRI Reference Station ({KENYA_REFERENCE_STATIONS.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-0.5 border-b border-dashed border-sky-400 inline-block" />
              <span>200nm Exclusive Economic Zone (EEZ)</span>
            </div>
          </div>

          {/* Bottom Live Digital Telemetry Readout Bar */}
          <div className="absolute bottom-3 left-3 right-3 z-[500] flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-slate-950/90 backdrop-blur-xs border border-sky-500/30 text-[11px] font-mono text-sky-200 shadow-lg">
            <div className="flex flex-wrap items-center gap-2">
              <Crosshair className="w-3.5 h-3.5 text-teal-400" />
              <span>
                WGS84: {Number(cursorCoords.lat || 0).toFixed(4)}°, {Number(cursorCoords.lng || 0).toFixed(4)}°
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-teal-300">
                {formatDMS(cursorCoords.lat, true)} {formatDMS(cursorCoords.lng, false)}
              </span>
            </div>
            {onPickCoordinates ? (
              <span className="text-teal-300">
                Click anywhere on satellite map to register station coordinates →
              </span>
            ) : (
              <span className="text-slate-400">
                Click any station marker to fly to &amp; inspect telemetry
              </span>
            )}
          </div>
        </div>

        {/* Right 4-Column Station Telemetry & Project Inspector */}
        <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between bg-white dark:bg-slate-900">
          {activeLocation ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/60">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-400">
                    OPERATIONAL DATABASE SITE · {activeLocation.county.toUpperCase()}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                    {Number(activeLocation.latitude || 0).toFixed(4)}°,{' '}
                    {Number(activeLocation.longitude || 0).toFixed(4)}°
                  </span>
                </div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                  {activeLocation.name}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Site: {activeLocation.site} · Basin: {activeLocation.marineArea}
                </p>
              </div>

              {activeLocation.description && (
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {activeLocation.description}
                </p>
              )}

              <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
                <div className="text-xs font-semibold text-slate-900 dark:text-white mb-2">
                  Linked Research Projects ({activeLinkedProjects.length})
                </div>
                {activeLinkedProjects.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No projects linked to this site yet.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {activeLinkedProjects.map(({ project, activityDescription }) =>
                      project ? (
                        <div
                          key={project.id}
                          className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-sky-500/50 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-mono font-semibold text-sky-700 dark:text-sky-400">
                              {project.projectCode}
                            </span>
                            {onSelectProject && (
                              <button
                                type="button"
                                onClick={() => onSelectProject(project.id)}
                                className="text-xs text-sky-700 dark:text-sky-400 hover:underline flex items-center gap-1"
                              >
                                <span>Open</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <div className="text-xs font-medium text-slate-900 dark:text-white mt-0.5 line-clamp-1">
                            {project.title}
                          </div>
                          {activityDescription && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {activityDescription}
                            </div>
                          )}
                        </div>
                      ) : null
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Reference Station Telemetry Inspector when 0 custom sites or when inspecting a Reference Station */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-sky-50/70 dark:bg-slate-800/70 border border-sky-200/80 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-semibold text-sky-700 dark:text-sky-400">
                    KMFRI REFERENCE STATION
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {activeReference.lat.toFixed(4)}°,{' '}
                    {activeReference.lng.toFixed(4)}°
                  </span>
                </div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  {activeReference.name}
                </h4>
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  {activeReference.county} County · {activeReference.marineArea}
                </div>
                <div className="pt-2 border-t border-sky-200/60 dark:border-slate-700 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Bathymetry / Elev.</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {activeReference.depthOrElevation}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Mapped DB Sites</span>
                    <span className="font-mono font-semibold text-teal-700 dark:text-teal-400">
                      {filteredLocations.length} Registered
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Primary Scientific Mandate
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {activeReference.focus}
                </p>
              </div>

              {onPickCoordinates && (
                <button
                  type="button"
                  onClick={() =>
                    onPickCoordinates(activeReference.lat, activeReference.lng, {
                      county: activeReference.county,
                      marineArea: activeReference.marineArea,
                      site: activeReference.name,
                    })
                  }
                  className="w-full py-2 px-3 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register {activeReference.shortName} as Project Site</span>
                </button>
              )}
            </div>
          )}

          {/* Quick Reference Station Selector Grid (with Satellite Fly-To) */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-3.5 mt-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              <span>KMFRI Hydrographic Stations</span>
              <span className="text-[11px] font-normal text-slate-400">
                Click to fly to station
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {KENYA_REFERENCE_STATIONS.map((st) => {
                const isSelected =
                  !activeLocation && activeReference.id === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => handleSelectReferenceStation(st)}
                    className={`text-left text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors truncate ${
                      isSelected
                        ? 'border-sky-600 bg-sky-50 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-sky-400'
                    }`}
                  >
                    {st.shortName}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
