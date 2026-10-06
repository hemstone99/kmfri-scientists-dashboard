/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * KMFRI Hydrographic & Spatial Telemetry Datasets (WGS84 / EPSG:4326)
 * Includes GeoJSON specifications for Stations, Research Areas, Kenya 200NM EEZ,
 * Sovereign Boundaries, and -200m / -1000m Bathymetric Depth Isobaths.
 */

export interface KmfriStation {
  id: string;
  code: string;
  name: string;
  category: 'Marine & Coastal' | 'Freshwater' | 'Aquaculture Center';
  water_body: string;
  county: string;
  latitude: number;
  longitude: number;
  elevation_or_depth: string;
  station_head: string;
  specialization: string;
  active_vessels?: string[];
  staff_count: number;
}

// 8 Primary KMFRI Reference Stations + Secondary Centers
export const KMFRI_STATIONS: KmfriStation[] = [
  {
    id: 'st-01',
    code: 'KMFRI-HQ',
    name: 'Mombasa Headquarters (English Point)',
    category: 'Marine & Coastal',
    water_body: 'Indian Ocean / Kilindini Channel',
    county: 'Mombasa',
    latitude: -4.0583,
    longitude: 39.6833,
    elevation_or_depth: '12m ASL / Coastal Shoreline',
    station_head: 'Prof. James Njiru, PhD',
    specialization: 'Director General HQ, Oceanography, Marine Geoscience, Hydrography & Research Fleet',
    active_vessels: ['RV Mtafiti (Offshore)', 'RV Utafiti II (Inshore)'],
    staff_count: 145,
  },
  {
    id: 'st-02',
    code: 'KMFRI-SHM',
    name: 'Shimoni Marine Research Station',
    category: 'Marine & Coastal',
    water_body: 'Wasini Channel / Pemba Channel',
    county: 'Kwale',
    latitude: -4.6472,
    longitude: 39.3811,
    elevation_or_depth: '6m ASL / Depth: 35m Channel',
    station_head: 'Dr. Joseph Kamau',
    specialization: 'Transboundary Coral Reefs, Cetaceans, Tuna Migration & Artisanal Fisheries',
    active_vessels: ['MV Wasini Scout'],
    staff_count: 28,
  },
  {
    id: 'st-03',
    code: 'KMFRI-GZI',
    name: 'Gazi Bay Mangrove Research Station',
    category: 'Marine & Coastal',
    water_body: 'Gazi Bay & Chale Lagoon',
    county: 'Kwale',
    latitude: -4.4239,
    longitude: 39.5103,
    elevation_or_depth: '2m ASL / Intertidal Mangrove Mudflat',
    station_head: 'Dr. James Kairo, OGW',
    specialization: 'Blue Carbon Sinks, Mangrove Restoration, Mikoko Pamoja Carbon Credits & Benthic Ecology',
    active_vessels: ['Zodiac Creek Rib'],
    staff_count: 22,
  },
  {
    id: 'st-04',
    code: 'KMFRI-KLF',
    name: 'Kilifi Creek Marine Station',
    category: 'Marine & Coastal',
    water_body: 'Kilifi Creek & Vuma Cliffs',
    county: 'Kilifi',
    latitude: -3.6333,
    longitude: 39.85,
    elevation_or_depth: '8m ASL / Depth: 40m Lagoon',
    station_head: 'Dr. Nina Wambui',
    specialization: 'Estuary Limnology, Mariculture (Mudcrab & Prawns), Plankton Biomass',
    active_vessels: ['Kilifi Explorer'],
    staff_count: 19,
  },
  {
    id: 'st-05',
    code: 'KMFRI-MLD',
    name: 'Malindi Marine Research Station',
    category: 'Marine & Coastal',
    water_body: 'Malindi Bay / Sabaki River Estuary',
    county: 'Kilifi',
    latitude: -3.2215,
    longitude: 40.1264,
    elevation_or_depth: '5m ASL / Shallow Marine Shelf',
    station_head: 'Dr. Edward Kimani',
    specialization: 'Semi-Industrial Prawn Trawl Monitoring, Sea Turtle Conservation & Sediment Discharge',
    active_vessels: ['MV Tewa'],
    staff_count: 31,
  },
  {
    id: 'st-06',
    code: 'KMFRI-LMU',
    name: 'Lamu Archipelago Marine Center',
    category: 'Marine & Coastal',
    water_body: 'Lamu Archipelago / Kiunga Waters',
    county: 'Lamu',
    latitude: -2.2686,
    longitude: 40.902,
    elevation_or_depth: '4m ASL / Archipelago Channels',
    station_head: 'Dr. Bernard Fulanda',
    specialization: 'North Coast Upwelling, Bajuni Archipelago Reefs, Mangrove Forests & Artisanal Crab Fisheries',
    active_vessels: ['Lamu Patrol Catamaran'],
    staff_count: 25,
  },
  {
    id: 'st-07',
    code: 'KMFRI-KSM',
    name: 'Kisumu Freshwater Research Center',
    category: 'Freshwater',
    water_body: 'Lake Victoria (Winam Gulf)',
    county: 'Kisumu',
    latitude: -0.1022,
    longitude: 34.7523,
    elevation_or_depth: '1,136m ASL / Depth: 12-65m',
    station_head: 'Dr. Christopher Aura',
    specialization: 'Lake Victoria Limnology, Nile Perch Biomass, Water Hyacinth Bio-control, Cage Aquaculture',
    active_vessels: ['RV Uvumbuzi', 'RV Clarotes'],
    staff_count: 85,
  },
  {
    id: 'st-08',
    code: 'KMFRI-TRK',
    name: 'Lake Turkana Research Center (Kalokol)',
    category: 'Freshwater',
    water_body: 'Lake Turkana (Jade Sea)',
    county: 'Turkana',
    latitude: 3.5333,
    longitude: 35.8833,
    elevation_or_depth: '360m ASL / Saline Desert Lake',
    station_head: 'Dr. Kevin Obiero',
    specialization: 'Arid Lakes Hydrobiology, Alcolapia Grahami, Nile Tilapia & River Omo Inflow Tracking',
    active_vessels: ['RV Jade Mariner'],
    staff_count: 24,
  },
  {
    id: 'st-09',
    code: 'KMFRI-NVS',
    name: 'Lake Naivasha Limnology Station',
    category: 'Freshwater',
    water_body: 'Lake Naivasha & Crescent Island',
    county: 'Nakuru',
    latitude: -0.7167,
    longitude: 36.4333,
    elevation_or_depth: '1,884m ASL / Ramsar Wetland',
    station_head: 'Dr. Silas Mwangi',
    specialization: 'Ramsar Wetland Health, Red Swamp Crayfish, Eutrophication & Agricultural Runoff',
    active_vessels: ['Naivasha Research Launch'],
    staff_count: 18,
  },
  {
    id: 'st-10',
    code: 'KMFRI-BAR',
    name: 'Lake Baringo Research Station',
    category: 'Freshwater',
    water_body: 'Lake Baringo Basin',
    county: 'Baringo',
    latitude: 0.6167,
    longitude: 36.0667,
    elevation_or_depth: '970m ASL / Turbid Rift Lake',
    station_head: 'Dr. Mary Opiyo',
    specialization: 'Endemic Oreochromis niloticus baringoensis, Water Level Dynamics & Climate Adaptation',
    active_vessels: ['Baringo Skiff'],
    staff_count: 14,
  },
  {
    id: 'st-11',
    code: 'KMFRI-KGT',
    name: 'Kegati Aquaculture Research Center',
    category: 'Aquaculture Center',
    water_body: 'Upper Kuja River Basin',
    county: 'Kisii',
    latitude: -0.6833,
    longitude: 34.8,
    elevation_or_depth: '1,540m ASL / Highlands',
    station_head: 'Dr. Jonathan Munguti',
    specialization: 'National Fish Seed Breeding, African Catfish Artificial Insemination, Pond Aeration',
    staff_count: 20,
  },
  {
    id: 'st-12',
    code: 'KMFRI-SGN',
    name: 'Sagana Aquaculture Center of Excellence',
    category: 'Aquaculture Center',
    water_body: 'Tana River Basin Ponds',
    county: 'Kirinyaga',
    latitude: -0.6667,
    longitude: 37.2,
    elevation_or_depth: '1,230m ASL / 100+ Experimental Ponds',
    station_head: 'Dr. Domitila Kyule',
    specialization: 'Selective Fish Genetics, Genetically Improved Farmed Tilapia (GIFT), Black Soldier Fly Feed',
    staff_count: 38,
  },
  {
    id: 'st-13',
    code: 'KMFRI-SNG',
    name: 'Sangoro Riverine Research Station',
    category: 'Freshwater',
    water_body: 'Sondu-Miriu River Basin',
    county: 'Kisumu',
    latitude: -0.35,
    longitude: 34.9833,
    elevation_or_depth: '1,160m ASL / River Rapids',
    station_head: 'Dr. George Onditi',
    specialization: 'Riverine Fish Migrations, Labeo victorianus (Ningu) Hatchery & Riparian Conservation',
    staff_count: 12,
  },
  {
    id: 'st-14',
    code: 'KMFRI-MRN',
    name: 'Marereni Mariculture Station',
    category: 'Marine & Coastal',
    water_body: 'Ungwana Bay & Salt Works Estuary',
    county: 'Kilifi',
    latitude: -3.0167,
    longitude: 40.15,
    elevation_or_depth: '3m ASL / High-salinity tidal flats',
    station_head: 'Dr. David Mirera',
    specialization: 'Artemia Cysts, Brackish Water Milkfish (Chanos chanos) & Mud Crab Fattening',
    active_vessels: ['Ungwana Skiff'],
    staff_count: 16,
  },
  {
    id: 'st-15',
    code: 'KMFRI-VNG',
    name: 'Vanga Transboundary Marine Base',
    category: 'Marine & Coastal',
    water_body: 'Umba River Estuary / Pemba Channel Border',
    county: 'Kwale',
    latitude: -4.6625,
    longitude: 39.2244,
    elevation_or_depth: '1m ASL / Transboundary Estuary',
    station_head: 'Dr. Lilian Daudi',
    specialization: 'Transboundary Fisheries Monitoring, Coral Health & Community Marine Conservation',
    active_vessels: ['MV Umba Patrol'],
    staff_count: 14,
  },
  {
    id: 'st-16',
    code: 'KMFRI-TKW',
    name: 'Turkwell Hydro-Dam Fisheries Center',
    category: 'Freshwater',
    water_body: 'Turkwell Gorge Dam Lake',
    county: 'Turkana',
    latitude: 1.9167,
    longitude: 35.3333,
    elevation_or_depth: '1,150m ASL / Deep Reservoir',
    station_head: 'Dr. Jacob Ochiewo',
    specialization: 'Hydro-electric Reservoir Fisheries, Riverine Upstream Migrations & Arid Fish Stock Assessment',
    staff_count: 11,
  },
];

// 1. GEOJSON STATIONS (RFC 7946 Standard: [longitude, latitude])
export const KMFRI_STATIONS_GEOJSON: GeoJSON.FeatureCollection<GeoJSON.Point> = {
  type: 'FeatureCollection',
  features: KMFRI_STATIONS.map((station) => ({
    type: 'Feature',
    id: station.id,
    geometry: {
      type: 'Point',
      coordinates: [station.longitude, station.latitude],
    },
    properties: {
      id: station.id,
      code: station.code,
      name: station.name,
      category: station.category,
      water_body: station.water_body,
      county: station.county,
      latitude: station.latitude,
      longitude: station.longitude,
      elevation_or_depth: station.elevation_or_depth,
      station_head: station.station_head,
      specialization: station.specialization,
      active_vessels: station.active_vessels || [],
      staff_count: station.staff_count,
    },
  })),
};

// 2. KENYAN 200NM EXCLUSIVE ECONOMIC ZONE (EEZ) VECTOR POLYGON (GEOJSON)
export const KENYA_EEZ_GEOJSON: GeoJSON.Feature<GeoJSON.Polygon> = {
  type: 'Feature',
  id: 'kenya-eez-200nm',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [39.2311, -4.6766], // Vanga Coast (Kenya-Tanzania maritime boundary start)
        [39.5, -4.75],
        [40.0, -4.85],
        [41.5, -4.9],
        [42.2, -3.8],
        [42.8, -2.5],
        [42.85, -1.6], // Seaward EEZ Tripoint
        [41.6, -1.6],
        [41.57, -1.64], // Kiunga / Ras Kamboni (Kenya-Somalia border)
        [40.902, -2.2686], // Lamu Archipelago
        [40.5, -2.7], // Tana Delta
        [40.1264, -3.2215], // Malindi
        [39.85, -3.6333], // Kilifi
        [39.6833, -4.0583], // Mombasa English Point
        [39.5103, -4.4239], // Gazi Bay
        [39.3811, -4.6472], // Shimoni
        [39.2311, -4.6766], // Close loop
      ],
    ],
  },
  properties: {
    name: 'Kenya 200nm Exclusive Economic Zone (EEZ)',
    code: 'KMFRI-EEZ',
    type: 'Offshore Marine Sovereignty',
    area_sq_km: 142000,
    nautical_miles: 200,
    color: '#0284c7',
    fillColor: '#0369a1',
    description:
      '142,000 sq km sovereign maritime jurisdiction extending 200 nautical miles seaward into the Western Indian Ocean under UNCLOS. Mandated for deep-sea fisheries, pelagic acoustic surveys (RV Mtafiti), and oceanographic research.',
  },
};

// 3. RESEARCH AREA OVERLAY POLYGONS (GEOJSON)
export const RESEARCH_AREAS_GEOJSON: GeoJSON.FeatureCollection<GeoJSON.Polygon> = {
  type: 'FeatureCollection',
  features: [
    KENYA_EEZ_GEOJSON,
    {
      type: 'Feature',
      id: 'mw-mpa',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [40.11, -3.21],
            [40.17, -3.21],
            [40.05, -3.42],
            [39.98, -3.42],
            [40.11, -3.21],
          ],
        ],
      },
      properties: {
        name: 'Malindi-Watamu Marine National Park & Biosphere Reserve',
        code: 'MW-MPA',
        type: 'Marine Protected Area',
        color: '#0d9488',
        fillColor: '#14b8a6',
        description:
          'UNESCO Biosphere Reserve featuring fringing coral reefs, Mida Creek mangrove forests, and sea turtle nesting rookeries.',
      },
    },
    {
      type: 'Feature',
      id: 'gz-carb',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [39.48, -4.38],
            [39.54, -4.38],
            [39.26, -4.72],
            [39.2, -4.72],
            [39.48, -4.38],
          ],
        ],
      },
      properties: {
        name: 'Gazi & Vanga Mangrove Blue Carbon Corridor',
        code: 'GZ-CARB',
        type: 'Mangrove Carbon Sink',
        color: '#15803d',
        fillColor: '#22c55e',
        description:
          '6,000+ hectares of mangrove ecosystem. Groundbreaking KMFRI Mikoko Pamoja blue carbon project sequestering up to 1,000 tCO2e/ha.',
      },
    },
    {
      type: 'Feature',
      id: 'mba-reef',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [39.72, -3.98],
            [39.79, -3.98],
            [39.73, -4.1],
            [39.67, -4.1],
            [39.72, -3.98],
          ],
        ],
      },
      properties: {
        name: 'Mombasa Marine Park & Inshore Reefs',
        code: 'MBA-REEF',
        type: 'Coral Reef Ecosystem',
        color: '#0284c7',
        fillColor: '#38bdf8',
        description:
          'Urban coral reef monitoring zone tracking bleaching resilience, sea urchin biomass, seagrass meadows, and recreational fisheries.',
      },
    },
    {
      type: 'Feature',
      id: 'lmu-arch',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [40.85, -2.15],
            [41.15, -2.15],
            [41.6, -1.75],
            [41.35, -1.75],
            [40.85, -2.15],
          ],
        ],
      },
      properties: {
        name: 'Lamu Archipelago & Kiunga Biosphere Reserve',
        code: 'LMU-ARCH',
        type: 'Archipelago Marine Reserve',
        color: '#7c3aed',
        fillColor: '#a855f7',
        description:
          'Northern reef system influenced by seasonal Somali Current upwelling, pristine dugong seagrass beds, and mangrove creek channels.',
      },
    },
    {
      type: 'Feature',
      id: 'lv-winam',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [34.65, -0.05],
            [34.85, -0.05],
            [34.85, -0.45],
            [34.25, -0.55],
            [34.2, -0.35],
            [34.65, -0.05],
          ],
        ],
      },
      properties: {
        name: 'Lake Victoria Winam Gulf Limnology Zone',
        code: 'LV-WINAM',
        type: 'Freshwater Limnology Basin',
        color: '#2563eb',
        fillColor: '#60a5fa',
        description:
          'Semi-enclosed freshwater gulf supporting commercial Nile perch, Rastrineobola argentea (Omena), cage aquaculture, and water hyacinth control.',
      },
    },
    {
      type: 'Feature',
      id: 'ks-mpa',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [39.33, -4.69],
            [39.42, -4.69],
            [39.42, -4.76],
            [39.33, -4.76],
            [39.33, -4.69],
          ],
        ],
      },
      properties: {
        name: 'Kisite-Mpunguti Marine Reserve & Cetacean Sanctuary',
        code: 'KS-MPA',
        type: 'Coral Reef & Cetacean Sanctuary',
        color: '#06b6d4',
        fillColor: '#22d3ee',
        description:
          'Premier marine park home to Indo-Pacific bottlenose dolphins, humpback whale nursing corridors, and coral gardens.',
      },
    },
    {
      type: 'Feature',
      id: 'dc-mnr',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [39.56, -4.26],
            [39.63, -4.26],
            [39.55, -4.46],
            [39.49, -4.46],
            [39.56, -4.26],
          ],
        ],
      },
      properties: {
        name: 'Diani-Chale Marine National Reserve',
        code: 'DC-MNR',
        type: 'Marine National Reserve',
        color: '#3b82f6',
        fillColor: '#93c5fd',
        description:
          'Shallow lagoonal reef system with vibrant seagrass beds supporting green sea turtle foraging and artisanal Beach Management Units (BMUs).',
      },
    },
    {
      type: 'Feature',
      id: 'tna-delta',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [40.2, -2.5],
            [40.65, -2.5],
            [40.4, -3.0],
            [40.1, -3.0],
            [40.2, -2.5],
          ],
        ],
      },
      properties: {
        name: 'Tana River Delta & Ungwana Bay Marine Corridor',
        code: 'TNA-DELTA',
        type: 'Estuarine Ramsar Wetland',
        color: '#eab308',
        fillColor: '#fde047',
        description:
          'Kenya’s largest delta estuary, essential nursery grounds for penaeid prawns, mangrove snappers, and coastal nutrient transport.',
      },
    },
    {
      type: 'Feature',
      id: 'lt-basin',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [36.1, 2.5],
            [35.9, 4.4],
            [36.3, 4.4],
            [36.8, 2.5],
            [36.1, 2.5],
          ],
        ],
      },
      properties: {
        name: 'Lake Turkana Northern & Southern Limnology Basin',
        code: 'LT-BASIN',
        type: 'Arid Rift Lake Basin',
        color: '#14b8a6',
        fillColor: '#5eead4',
        description:
          'Largest permanent desert lake in the world (6,405 sq km). Tracks endemic Alcolapia, Nile tilapia, and seasonal River Omo hydrological inflows.',
      },
    },
  ],
};

// 4. REPUBLIC OF KENYA NATIONAL SOVEREIGN BOUNDARY (GEOJSON)
export const KENYA_NATIONAL_BOUNDARY_GEOJSON: GeoJSON.Feature<GeoJSON.Polygon> = {
  type: 'Feature',
  id: 'kenya-sovereign-boundary',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [39.2311, -4.6766], // Vanga Coast (Tanzania border)
        [38.9, -4.45],
        [38.0, -3.8],
        [37.6, -3.4],
        [37.5, -3.0],
        [37.2, -2.8],
        [36.8, -2.4],
        [36.4, -2.0],
        [35.5, -1.5],
        [34.6, -1.2],
        [34.1, -1.0],
        [33.95, -1.0], // Lake Victoria tripoint (TZ/UG)
        [33.95, -0.5],
        [34.0, 0.0],
        [34.2, 0.5], // Uganda border
        [34.7, 1.0], // Mt Elgon
        [34.9, 1.5],
        [34.95, 2.0],
        [35.0, 2.5],
        [34.8, 3.0],
        [34.5, 3.5],
        [34.34, 4.2], // Lokichogio tripoint
        [35.5, 4.62], // South Sudan border
        [36.0, 4.5], // North shore Lake Turkana (Ethiopia border)
        [36.5, 4.4],
        [37.0, 4.3],
        [37.7, 4.1],
        [38.7, 3.6],
        [39.05, 3.53], // Moyale
        [40.0, 3.8],
        [41.87, 3.93], // Mandera tripoint (Ethiopia & Somalia)
        [41.5, 3.2], // Somalia border
        [41.2, 2.0],
        [41.1, 1.0],
        [41.3, 0.0],
        [41.5, -1.0],
        [41.57, -1.64], // Kiunga / Ras Kamboni (Indian Ocean coast)
        [41.2, -2.0], // Lamu maritime shoreline
        [40.902, -2.2686],
        [40.5, -2.7],
        [40.15, -3.0167],
        [40.1264, -3.2215],
        [39.85, -3.6333],
        [39.6833, -4.0583],
        [39.58, -4.28],
        [39.5103, -4.4239],
        [39.3811, -4.6472],
        [39.2311, -4.6766], // Return to Vanga
      ],
    ],
  },
  properties: {
    name: 'Republic of Kenya Sovereign Territory',
    total_area_sq_km: 580367,
    land_area_sq_km: 569140,
    water_area_sq_km: 11227,
    coastline_km: 600,
    color: '#10b981',
  },
};

// 5. BATHYMETRIC DEPTH ISOBATHS (-200M AND -1000M) GEOJSON
export const BATHYMETRY_ISOBATHS_GEOJSON: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'isobath-200m',
      geometry: {
        type: 'LineString',
        coordinates: [
          [39.42, -4.75], // Pemba Channel deep break
          [39.58, -4.5],
          [39.75, -4.2],
          [39.85, -4.0], // Mombasa outer shelf
          [40.0, -3.6], // Kilifi drop-off
          [40.22, -3.2], // Malindi bank break
          [40.35, -2.8], // Ungwana Bay shelf edge
          [41.0, -2.3], // Lamu shelf break
          [41.4, -1.8], // Kiunga outer edge
          [41.65, -1.6],
        ],
      },
      properties: {
        depth_meters: -200,
        name: '-200m Continental Shelf Break',
        description:
          'Critical bathymetric transition boundary where the shallow East African continental shelf terminates into oceanic deep waters. Key pelagic tuna and billfish feeding zone.',
        color: '#06b6d4',
        weight: 2.5,
        dashArray: '6, 6',
      },
    },
    {
      type: 'Feature',
      id: 'isobath-1000m',
      geometry: {
        type: 'LineString',
        coordinates: [
          [39.7, -4.8], // Deep Pemba Channel axis
          [39.9, -4.5],
          [40.15, -4.1],
          [40.35, -3.7],
          [40.6, -3.2],
          [40.85, -2.7],
          [41.35, -2.2],
          [41.8, -1.7],
          [42.0, -1.5],
        ],
      },
      properties: {
        depth_meters: -1000,
        name: '-1,000m Bathyal Continental Slope',
        description:
          'Deep bathyal contour delineating oceanic abyssal waters off the Kenyan coast. Crucial for bottom trawl benthic surveys and RV Mtafiti acoustic deep-sea biomass mapping.',
        color: '#3b82f6',
        weight: 2,
        dashArray: '4, 8',
      },
    },
  ],
};

// 6. HELPER: CONVERT DECIMAL DEGREES TO DEGREE-MINUTE-SECOND (DMS) FORMAT
export function formatToDMS(coord: number, isLat: boolean): string {
  const absolute = Math.abs(coord);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(1);
  const direction = isLat ? (coord >= 0 ? 'N' : 'S') : coord >= 0 ? 'E' : 'W';
  return `${degrees}°${minutes.toString().padStart(2, '0')}'${seconds.padStart(4, '0')}"${direction}`;
}

export function formatCoordinateTelemetry(lat: number, lng: number): {
  dd: string;
  dms: string;
  latDms: string;
  lngDms: string;
} {
  const latDms = formatToDMS(lat, true);
  const lngDms = formatToDMS(lng, false);
  return {
    dd: `${lat >= 0 ? '+' : ''}${lat.toFixed(5)}°, ${lng >= 0 ? '+' : ''}${lng.toFixed(5)}°`,
    dms: `${latDms}, ${lngDms}`,
    latDms,
    lngDms,
  };
}
