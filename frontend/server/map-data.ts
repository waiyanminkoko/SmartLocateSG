import { createClient } from "@supabase/supabase-js";

import { pool } from "./db";

type OverlayMetricKey = "composite" | "demographics" | "accessibility" | "vacancy";

type PlanningAreaMetricRow = {
  planningAreaId: string;
  planningAreaName: string;
  areaCode: string;
  regionName: string | null;
  geometryGeojson: string;
  populationTotal: number | null;
  effectiveYear: number | null;
  busStopCount: number;
  mrtExitCount: number;
  avgUnitPricePsf: number | null;
  retailTransactionCount: number;
  demographicScore: number | null;
  accessibilityScore: number | null;
  vacancyScore: number | null;
  compositeScore: number | null;
};

type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: unknown;
    properties: Record<string, unknown>;
  }>;
  metadata: {
    availableMetrics: Record<OverlayMetricKey, boolean>;
    requestedMetric: OverlayMetricKey;
    featureCount: number;
  };
};

type SiteScoreResult = {
  lat: number;
  lng: number;
  planningArea: PlanningAreaMetricRow | null;
  scores: {
    composite: number | null;
    demographic: number | null;
    accessibility: number | null;
    rental: number | null;
    competition: number | null;
  };
  breakdownDetails: {
    analysisRadiusMeters: number;
    busStopsWithinRadius: number;
    mrtExitsWithinRadius: number;
    competitionCountWithinRadius: number | null;
    competitionCategory: string;
    populationTotal: number | null;
    avgUnitPricePsf: number | null;
    retailTransactionCount: number;
  };
};

type LayerKey = "bus-stops" | "mrt-exits" | "mrt-stations";

type PointLayerCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: Record<string, unknown>;
  }>;
  metadata: {
    layer: LayerKey;
    featureCount: number;
  };
};

type RadiusFilter = {
  lat: number;
  lng: number;
  radiusMeters: number;
};

type RawOverlayRow = {
  planning_area_id: string;
  planning_area_name: string;
  area_code: string;
  region_name: string | null;
  geometry_geojson: string;
  population_total: number | string | null;
  effective_year: number | string | null;
  bus_stop_count: number | string | null;
  mrt_exit_count: number | string | null;
  avg_unit_price_psf: number | string | null;
  retail_transaction_count: number | string | null;
};

type RawLayerRow = Record<string, unknown>;

type RawSiteAreaRow = {
  planning_area_id: string;
};

type RawCompetitionRow = {
  count: number | string;
};

type SupabasePlanningAreaRow = {
  planning_area: string;
  geojson: unknown;
};

type SupabaseAgeGroupRow = {
  id: number;
  planning_area: string;
  year: number | null;
  total: number | null;
};

type SupabaseBusStopRow = {
  bus_stop_number: string;
  latitude: number | string;
  longitude: number | string;
};

type SupabaseMrtExitRow = {
  station_name: string;
  exit_number: string;
  latitude: number | string;
  longitude: number | string;
};

type SupabaseRetailRow = {
  unit_price_psf: number | string | null;
  latitude: number | string;
  longitude: number | string;
};

type SupabasePlaceRow = {
  shop_category: string | null;
  latitude: number | string;
  longitude: number | string;
};

type SupabaseBusinessProfileRow = {
  sector: string | null;
};

type NormalizedBusStop = {
  id: string;
  lat: number;
  lng: number;
};

type ParsedAreaGeometry = {
  planningAreaId: string;
  planningAreaName: string;
  areaCode: string;
  regionName: string | null;
  geometryGeojson: string;
  geometry: GeoJsonGeometry;
  bbox: BoundingBox;
};

type GeoJsonGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

type BoundingBox = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
};

const HTTP_CACHE_TTL_MS = 60_000;
let planningAreaMetricRowsCache: { expiresAt: number; rows: PlanningAreaMetricRow[] } | null = null;
const pointLayerCollectionCache = new Map<LayerKey, { expiresAt: number; collection: PointLayerCollection }>();

const GEOMETRY_TYPES = new Set([
  "Point",
  "MultiPoint",
  "LineString",
  "MultiLineString",
  "Polygon",
  "MultiPolygon",
  "GeometryCollection",
]);

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function normalizeBusStopId(value: unknown) {
  const raw = typeof value === "string" ? value : value !== null && value !== undefined ? String(value) : "";
  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeBusStops(rows: Array<{ bus_stop_number: unknown; latitude: unknown; longitude: unknown }>): NormalizedBusStop[] {
  const grouped = new Map<string, { latSum: number; lngSum: number; count: number }>();

  rows.forEach((row) => {
    const id = normalizeBusStopId(row.bus_stop_number);
    const lat = toNumber(row.latitude);
    const lng = toNumber(row.longitude);
    if (!id || lat === null || lng === null) {
      return;
    }

    const current = grouped.get(id) ?? { latSum: 0, lngSum: 0, count: 0 };
    current.latSum += lat;
    current.lngSum += lng;
    current.count += 1;
    grouped.set(id, current);
  });

  return Array.from(grouped.entries()).map(([id, value]) => ({
    id,
    lat: value.latSum / value.count,
    lng: value.lngSum / value.count,
  }));
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function average(values: Array<number | null>): number | null {
  const filtered = values.filter((value): value is number => typeof value === "number");
  if (!filtered.length) {
    return null;
  }

  return Number((filtered.reduce((sum, value) => sum + value, 0) / filtered.length).toFixed(1));
}

function normalizeRows(
  values: Array<number | null>,
  options?: { invert?: boolean },
): Array<number | null> {
  const filtered = values.filter((value): value is number => typeof value === "number");
  if (!filtered.length) {
    return values.map(() => null);
  }

  const min = Math.min(...filtered);
  const max = Math.max(...filtered);
  const invert = options?.invert ?? false;

  return values.map((value) => {
    if (typeof value !== "number") {
      return null;
    }

    if (max === min) {
      return 100;
    }

    const ratio = (value - min) / (max - min);
    const normalized = invert ? (1 - ratio) * 100 : ratio * 100;
    return Math.round(clamp(normalized));
  });
}

function parseGeometry(geometryGeojson: string): unknown | null {
  try {
    const parsed = JSON.parse(geometryGeojson) as {
      type?: string;
      geometry?: unknown;
      features?: Array<{ geometry?: unknown }>;
    };

    if (parsed.type && GEOMETRY_TYPES.has(parsed.type)) {
      return parsed;
    }

    if (parsed.type === "Feature") {
      return parsed.geometry ?? null;
    }

    if (parsed.type === "FeatureCollection") {
      return parsed.features?.[0]?.geometry ?? null;
    }
  } catch {
    return null;
  }

  return null;
}

function createSupabaseHttpClient() {
  const url = process.env.VITE_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

const supabaseHttpClient = createSupabaseHttpClient();

function requireSupabaseHttpClient() {
  if (!supabaseHttpClient) {
    throw new Error(
      "Supabase HTTP fallback is unavailable. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return supabaseHttpClient;
}

function psfToRentalScore(psf: number | null): number {
  if (psf === null) return 50;
  if (psf < 2000)   return 100;
  if (psf < 4000)   return 75;
  if (psf < 7000)   return 40;
  return 10;
}

async function fetchRentalScore(lat: number, lng: number): Promise<number | null> {
  try {
    const supabase = requireSupabaseHttpClient();
    for (const radius of [1000, 2000, 3000]) {
      const { data, error } = await supabase.rpc("median_psf_nearby", {
        center_lat: lat,
        center_lng: lng,
        radius_m: radius,
        years_back: 3,
      });
      if (error) continue;
      const medianPsf = data !== null && data !== undefined ? Number(data) : null;
      if (medianPsf !== null) return psfToRentalScore(medianPsf);
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchAllSupabaseRows<T extends Record<string, unknown>>(
  table: string,
  selectClause: string,
  orderColumn: string,
) {
  const supabase = requireSupabaseHttpClient();
  const pageSize = 1000;
  const rows: T[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(selectClause)
      .order(orderColumn, { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw error;
    }

    const batch = ((data ?? []) as unknown) as T[];
    rows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return rows;
}

function toAreaIdentifier(name: string) {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

function toAreaDisplayName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isGeoJsonGeometry(value: unknown): value is GeoJsonGeometry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const type = (value as { type?: string }).type;
  return type === "Polygon" || type === "MultiPolygon";
}

function getGeometryRings(geometry: GeoJsonGeometry): number[][][][] {
  return geometry.type === "Polygon"
    ? [geometry.coordinates]
    : geometry.coordinates;
}

function computeBoundingBox(geometry: GeoJsonGeometry): BoundingBox {
  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  getGeometryRings(geometry).forEach((polygon) => {
    polygon.forEach((ring) => {
      ring.forEach(([lng, lat]) => {
        minLng = Math.min(minLng, lng);
        minLat = Math.min(minLat, lat);
        maxLng = Math.max(maxLng, lng);
        maxLat = Math.max(maxLat, lat);
      });
    });
  });

  return { minLng, minLat, maxLng, maxLat };
}

function pointInRing(pointLng: number, pointLat: number, ring: number[][]) {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    const intersects =
      yi > pointLat !== yj > pointLat &&
      pointLng < ((xj - xi) * (pointLat - yi)) / ((yj - yi) || Number.EPSILON) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function pointInGeometry(pointLng: number, pointLat: number, geometry: GeoJsonGeometry, bbox?: BoundingBox) {
  const bounds = bbox ?? computeBoundingBox(geometry);
  if (
    pointLng < bounds.minLng ||
    pointLng > bounds.maxLng ||
    pointLat < bounds.minLat ||
    pointLat > bounds.maxLat
  ) {
    return false;
  }

  return getGeometryRings(geometry).some((polygon) => {
    const [outerRing, ...holes] = polygon;
    if (!outerRing || !pointInRing(pointLng, pointLat, outerRing)) {
      return false;
    }

    return !holes.some((hole) => pointInRing(pointLng, pointLat, hole));
  });
}

function haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function clampRadiusMeters(radiusMeters?: number) {
  const fallback = 1_000;
  if (typeof radiusMeters !== "number" || !Number.isFinite(radiusMeters)) {
    return fallback;
  }

  return Math.max(500, Math.min(2_000, Math.round(radiusMeters)));
}

function filterPointLayerCollectionByRadius(
  collection: PointLayerCollection,
  focus?: RadiusFilter,
): PointLayerCollection {
  if (!focus) {
    return collection;
  }

  const filteredFeatures = collection.features.filter((feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    return haversineDistanceMeters(focus.lat, focus.lng, lat, lng) <= focus.radiusMeters;
  });

  return {
    ...collection,
    features: filteredFeatures,
    metadata: {
      ...collection.metadata,
      featureCount: filteredFeatures.length,
    },
  };
}

function getParsedAreaGeometries(rows: PlanningAreaMetricRow[]): ParsedAreaGeometry[] {
  return rows
    .map((row) => {
      const geometry = parseGeometry(row.geometryGeojson);
      if (!isGeoJsonGeometry(geometry)) {
        return null;
      }

      return {
        planningAreaId: row.planningAreaId,
        planningAreaName: row.planningAreaName,
        areaCode: row.areaCode,
        regionName: row.regionName,
        geometryGeojson: row.geometryGeojson,
        geometry,
        bbox: computeBoundingBox(geometry),
      };
    })
    .filter((row): row is ParsedAreaGeometry => row !== null);
}

function getDbGeometryExpression(alias: string) {
  return `CASE
    WHEN ${alias}.geometry_geojson IS NULL THEN NULL
    WHEN jsonb_typeof(${alias}.geometry_geojson::jsonb) = 'object' AND (${alias}.geometry_geojson::jsonb ? 'geometry')
      THEN ST_SetSRID(ST_GeomFromGeoJSON((${alias}.geometry_geojson::jsonb -> 'geometry')::text), 4326)
    ELSE ST_SetSRID(ST_GeomFromGeoJSON(${alias}.geometry_geojson), 4326)
  END`;
}

function roughCentroid(geometryGeojson: string | null): { lat: number; lng: number } | null {
  if (!geometryGeojson) return null;
  try {
    const geom = JSON.parse(geometryGeojson) as {
      type?: string;
      coordinates?: unknown;
      geometry?: { type?: string; coordinates?: unknown };
    };
    const resolved = geom.type === "Feature" ? geom.geometry : geom;
    if (!resolved) return null;

    let ring: number[][] = [];
    if (resolved.type === "Polygon") {
      ring = (resolved.coordinates as number[][][])[0] ?? [];
    } else if (resolved.type === "MultiPolygon") {
      ring = ((resolved.coordinates as number[][][][])[0]?.[0]) ?? [];
    }

    if (!ring.length) return null;
    const avgLng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
    const avgLat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
    return { lat: avgLat, lng: avgLng };
  } catch {
    return null;
  }
}

function mapPlanningAreaRows(rows: RawOverlayRow[]): PlanningAreaMetricRow[] {
  const baseRows = rows.map((row) => ({
    planningAreaId: row.planning_area_id,
    planningAreaName: row.planning_area_name,
    areaCode: row.area_code,
    regionName: row.region_name,
    geometryGeojson: row.geometry_geojson,
    populationTotal: toNumber(row.population_total),
    effectiveYear: toNumber(row.effective_year),
    busStopCount: Math.round(toNumber(row.bus_stop_count) ?? 0),
    mrtExitCount: Math.round(toNumber(row.mrt_exit_count) ?? 0),
    avgUnitPricePsf: toNumber(row.avg_unit_price_psf),
    retailTransactionCount: Math.round(toNumber(row.retail_transaction_count) ?? 0),
  }));

  // For areas with no population data, substitute the average of the 3 nearest
  // neighbours that do have data, so the demographic score is never silently null.
  const NEIGHBOUR_K = 3;
  const centroids = baseRows.map((row) => roughCentroid(row.geometryGeojson ?? null));
  const filledPopulations = baseRows.map((row, i) => {
    if (row.populationTotal !== null) return row.populationTotal;
    const origin = centroids[i];
    if (!origin) return null;
    const neighbours = baseRows
      .map((r, j) => {
        if (r.populationTotal === null) return null;
        const c = centroids[j];
        if (!c) return null;
        const dist = Math.hypot(c.lat - origin.lat, c.lng - origin.lng);
        return { pop: r.populationTotal as number, dist };
      })
      .filter((x): x is { pop: number; dist: number } => x !== null)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, NEIGHBOUR_K);
    if (!neighbours.length) return null;
    return Math.round(neighbours.reduce((s, n) => s + n.pop, 0) / neighbours.length);
  });

  const demographicScores = normalizeRows(filledPopulations);
  const accessibilityScores = normalizeRows(
    baseRows.map((row) => row.busStopCount + row.mrtExitCount * 4),
  );
  const vacancyScores = normalizeRows(
    baseRows.map((row) => row.avgUnitPricePsf),
    { invert: true },
  );

  return baseRows.map((row, index) => {
    const demographicScore = demographicScores[index];
    const accessibilityScore = accessibilityScores[index];
    const vacancyScore = vacancyScores[index];
    const compositeScore = average([demographicScore, accessibilityScore, vacancyScore]);

    return {
      ...row,
      demographicScore,
      accessibilityScore,
      vacancyScore,
      compositeScore,
    };
  });
}

async function getPlanningAreaMetricRowsViaSupabase(): Promise<PlanningAreaMetricRow[]> {
  const now = Date.now();
  if (planningAreaMetricRowsCache && planningAreaMetricRowsCache.expiresAt > now) {
    return planningAreaMetricRowsCache.rows;
  }

  const [areas, ageGroups, busStops, mrtExits, retailRows] = await Promise.all([
    fetchAllSupabaseRows<SupabasePlanningAreaRow>("onemap_planning_area", "planning_area, geojson", "planning_area"),
    fetchAllSupabaseRows<SupabaseAgeGroupRow>("onemap_age_group", "id, planning_area, year, total", "id"),
    fetchAllSupabaseRows<SupabaseBusStopRow>("datagov_bus_stops", "bus_stop_number, latitude, longitude", "bus_stop_number"),
    fetchAllSupabaseRows<SupabaseMrtExitRow>(
      "datagov_mrt_exits",
      "station_name, exit_number, latitude, longitude",
      "station_name",
    ),
    fetchAllSupabaseRows<SupabaseRetailRow>(
      "ura_retail_transactions",
      "unit_price_psf, latitude, longitude",
      "id",
    ),
  ]);

  const latestPopulationByArea = new Map<string, { effectiveYear: number | null; populationTotal: number | null }>();
  ageGroups.forEach((row) => {
    const key = toAreaIdentifier(row.planning_area ?? "");
    const current = latestPopulationByArea.get(key);
    const year = toNumber(row.year);
    if (!current || (year ?? -1) >= (current.effectiveYear ?? -1)) {
      latestPopulationByArea.set(key, {
        effectiveYear: year,
        populationTotal: toNumber(row.total),
      });
    }
  });

  const preparedAreas = areas
    .map((row) => {
      const geometry = typeof row.geojson === "string" ? parseGeometry(row.geojson) : row.geojson;
      if (!isGeoJsonGeometry(geometry)) {
        return null;
      }

      const planningAreaName = toAreaDisplayName(row.planning_area ?? "");
      return {
        planningAreaId: toAreaIdentifier(row.planning_area ?? ""),
        planningAreaName,
        areaCode: toAreaIdentifier(row.planning_area ?? ""),
        regionName: null,
        geometryGeojson: JSON.stringify(geometry),
        geometry,
        bbox: computeBoundingBox(geometry),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const busStopIdsByArea = new Map<string, Set<string>>();
  const mrtExitCounts = new Map<string, number>();
  const retailCounts = new Map<string, number>();
  const retailPsfSums = new Map<string, number>();

  preparedAreas.forEach((area) => {
    busStopIdsByArea.set(area.planningAreaId, new Set<string>());
    mrtExitCounts.set(area.planningAreaId, 0);
    retailCounts.set(area.planningAreaId, 0);
    retailPsfSums.set(area.planningAreaId, 0);
  });

  const assignPointToArea = (lat: number | null, lng: number | null) => {
    if (lat === null || lng === null) {
      return null;
    }

    return (
      preparedAreas.find((area) => pointInGeometry(lng, lat, area.geometry, area.bbox)) ?? null
    );
  };

  normalizeBusStops(busStops).forEach((busStop) => {
    const lat = busStop.lat;
    const lng = busStop.lng;
    const area = assignPointToArea(lat, lng);
    if (area) {
      busStopIdsByArea.get(area.planningAreaId)?.add(busStop.id);
    }
  });

  mrtExits.forEach((row) => {
    const lat = toNumber(row.latitude);
    const lng = toNumber(row.longitude);
    const area = assignPointToArea(lat, lng);
    if (area) {
      mrtExitCounts.set(area.planningAreaId, (mrtExitCounts.get(area.planningAreaId) ?? 0) + 1);
    }
  });

  retailRows.forEach((row) => {
    const lat = toNumber(row.latitude);
    const lng = toNumber(row.longitude);
    const area = assignPointToArea(lat, lng);
    if (!area) {
      return;
    }

    retailCounts.set(area.planningAreaId, (retailCounts.get(area.planningAreaId) ?? 0) + 1);
    retailPsfSums.set(
      area.planningAreaId,
      (retailPsfSums.get(area.planningAreaId) ?? 0) + (toNumber(row.unit_price_psf) ?? 0),
    );
  });

  const rows = mapPlanningAreaRows(
    preparedAreas.map((area) => {
      const population = latestPopulationByArea.get(area.planningAreaId);
      const retailTransactionCount = retailCounts.get(area.planningAreaId) ?? 0;
      const retailPsfSum = retailPsfSums.get(area.planningAreaId) ?? 0;
      return {
        planning_area_id: area.planningAreaId,
        planning_area_name: area.planningAreaName,
        area_code: area.areaCode,
        region_name: area.regionName,
        geometry_geojson: area.geometryGeojson,
        population_total: population?.populationTotal ?? null,
        effective_year: population?.effectiveYear ?? null,
        bus_stop_count: busStopIdsByArea.get(area.planningAreaId)?.size ?? 0,
        mrt_exit_count: mrtExitCounts.get(area.planningAreaId) ?? 0,
        avg_unit_price_psf:
          retailTransactionCount > 0 ? retailPsfSum / retailTransactionCount : null,
        retail_transaction_count: retailTransactionCount,
      };
    }),
  );

  planningAreaMetricRowsCache = {
    expiresAt: now + HTTP_CACHE_TTL_MS,
    rows,
  };

  return rows;
}

async function getPlanningAreaMetricRows(): Promise<PlanningAreaMetricRow[]> {
  if (!pool) {
    return getPlanningAreaMetricRowsViaSupabase();
  }

  const geometryExpression = getDbGeometryExpression("pa");
  const sql = `
    WITH canonical_areas AS (
      SELECT
        pa.id::text AS planning_area_id,
        pa.area_name AS planning_area_name,
        pa.area_code,
        pa.region_name,
        pa.geometry_geojson,
        ${geometryExpression} AS geom
      FROM planning_areas pa
      WHERE pa.geometry_geojson IS NOT NULL
    ),
    fallback_areas AS (
      SELECT
        regexp_replace(upper(opa.planning_area), '[^A-Z0-9]+', '_', 'g') AS planning_area_id,
        initcap(lower(opa.planning_area)) AS planning_area_name,
        regexp_replace(upper(opa.planning_area), '[^A-Z0-9]+', '_', 'g') AS area_code,
        NULL::text AS region_name,
        opa.geojson::text AS geometry_geojson,
        opa.geom
      FROM onemap_planning_area opa
      WHERE opa.geojson IS NOT NULL
    ),
    planning_geoms AS (
      SELECT * FROM canonical_areas
      UNION ALL
      SELECT * FROM fallback_areas
      WHERE NOT EXISTS (SELECT 1 FROM canonical_areas)
    ),
    canonical_demographics AS (
      SELECT DISTINCT ON (ad.planning_area_id)
        ad.planning_area_id::text AS planning_area_id,
        ad.effective_year,
        ad.population_total
      FROM area_demographics ad
      WHERE ad.planning_area_id IS NOT NULL
      ORDER BY ad.planning_area_id, ad.effective_year DESC, ad.ingested_at DESC NULLS LAST, ad.id DESC
    ),
    fallback_demographics AS (
      SELECT DISTINCT ON (upper(oag.planning_area))
        regexp_replace(upper(oag.planning_area), '[^A-Z0-9]+', '_', 'g') AS planning_area_id,
        oag.year AS effective_year,
        oag.total AS population_total
      FROM onemap_age_group oag
      ORDER BY upper(oag.planning_area), oag.year DESC, oag.id DESC
    ),
    demographics AS (
      SELECT * FROM canonical_demographics
      UNION ALL
      SELECT * FROM fallback_demographics
      WHERE NOT EXISTS (SELECT 1 FROM canonical_demographics)
    )
    SELECT
      pg.planning_area_id,
      pg.planning_area_name,
      pg.area_code,
      pg.region_name,
      pg.geometry_geojson,
      demo.population_total,
      demo.effective_year,
      COALESCE(bus.bus_stop_count, 0) AS bus_stop_count,
      COALESCE(mrt.mrt_exit_count, 0) AS mrt_exit_count,
      retail.avg_unit_price_psf,
      COALESCE(retail.retail_transaction_count, 0) AS retail_transaction_count
    FROM planning_geoms pg
    LEFT JOIN demographics demo
      ON demo.planning_area_id = pg.planning_area_id
    LEFT JOIN LATERAL (
      SELECT COUNT(DISTINCT bs.bus_stop_number)::int AS bus_stop_count
      FROM datagov_bus_stops bs
      WHERE pg.geom IS NOT NULL AND ST_Covers(pg.geom, bs.geom)
    ) bus ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS mrt_exit_count
      FROM datagov_mrt_exits me
      WHERE pg.geom IS NOT NULL AND ST_Covers(pg.geom, me.geom)
    ) mrt ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        AVG(urt.unit_price_psf)::float AS avg_unit_price_psf,
        COUNT(*)::int AS retail_transaction_count
      FROM ura_retail_transactions urt
      WHERE pg.geom IS NOT NULL AND ST_Covers(pg.geom, urt.geom)
    ) retail ON TRUE
    ORDER BY pg.planning_area_name ASC
  `;

  try {
    const { rows } = await pool.query<RawOverlayRow>(sql);
    return mapPlanningAreaRows(rows);
  } catch (error) {
    // If the direct DB path fails (timeout, transient network issues),
    // degrade to Supabase HTTP reads so map overlays can still render.
    return getPlanningAreaMetricRowsViaSupabase().catch(() => {
      throw error;
    });
  }
}

export async function getPlanningAreaOverlayCollection(
  requestedMetric: OverlayMetricKey,
): Promise<GeoJsonFeatureCollection> {
  const rows = await getPlanningAreaMetricRows();

  const features = rows
    .map((row) => {
      const geometry = parseGeometry(row.geometryGeojson);
      if (!geometry) {
        return null;
      }

      return {
        type: "Feature" as const,
        geometry,
        properties: {
          planningAreaId: row.planningAreaId,
          planningAreaName: row.planningAreaName,
          areaCode: row.areaCode,
          regionName: row.regionName,
          composite: row.compositeScore,
          demographics: row.demographicScore,
          accessibility: row.accessibilityScore,
          vacancy: row.vacancyScore,
          populationTotal: row.populationTotal,
          effectiveYear: row.effectiveYear,
          busStopCount: row.busStopCount,
          mrtExitCount: row.mrtExitCount,
          avgUnitPricePsf: row.avgUnitPricePsf,
          retailTransactionCount: row.retailTransactionCount,
        },
      };
    })
    .filter((feature): feature is NonNullable<typeof feature> => feature !== null);

  const availableMetrics = {
    composite: features.some((feature) => typeof feature.properties.composite === "number"),
    demographics: features.some((feature) => typeof feature.properties.demographics === "number"),
    accessibility: features.some((feature) => typeof feature.properties.accessibility === "number"),
    vacancy: features.some((feature) => typeof feature.properties.vacancy === "number"),
  };

  return {
    type: "FeatureCollection",
    features,
    metadata: {
      availableMetrics,
      requestedMetric,
      featureCount: features.length,
    },
  };
}

export async function getPointLayerCollection(
  layer: LayerKey,
  focus?: RadiusFilter,
): Promise<PointLayerCollection> {
  const cached = pointLayerCollectionCache.get(layer);
  if (cached && cached.expiresAt > Date.now()) {
    return filterPointLayerCollectionByRadius(cached.collection, focus);
  }

  const layerConfig = {
    "mrt-stations": {
      sql: `
        SELECT
          station_name,
          AVG(latitude)::float AS latitude,
          AVG(longitude)::float AS longitude,
          COUNT(*)::int AS exit_count
        FROM datagov_mrt_exits
        GROUP BY station_name
        ORDER BY station_name ASC
      `,
      buildProperties: (row: RawLayerRow) => ({
        stationName: row.station_name,
        exitCount: Math.round(toNumber(row.exit_count) ?? 0),
        label: `${String(row.station_name ?? "Station")} station`,
      }),
    },
    "bus-stops": {
      sql: `
        SELECT
          bus_stop_number,
          AVG(latitude)::float AS latitude,
          AVG(longitude)::float AS longitude
        FROM datagov_bus_stops
        GROUP BY bus_stop_number
        ORDER BY bus_stop_number ASC
      `,
      buildProperties: (row: RawLayerRow) => ({
        busStopNumber: row.bus_stop_number,
        label: `Bus stop ${String(row.bus_stop_number ?? "")}`,
      }),
    },
    "mrt-exits": {
      sql: `
        SELECT station_name, exit_number, latitude, longitude
        FROM datagov_mrt_exits
        ORDER BY station_name ASC, exit_number ASC
      `,
      buildProperties: (row: RawLayerRow) => ({
        stationName: row.station_name,
        exitNumber: row.exit_number,
        label: `${String(row.station_name ?? "Station")} Exit ${String(row.exit_number ?? "")}`,
      }),
    },
  } as const;

  const config = layerConfig[layer];
  const getRowsViaSupabase = async (): Promise<RawLayerRow[]> => {
    if (layer === "bus-stops") {
      const busStops = await fetchAllSupabaseRows<SupabaseBusStopRow>(
        "datagov_bus_stops",
        "bus_stop_number, latitude, longitude",
        "bus_stop_number",
      );

      return normalizeBusStops(busStops).map((busStop) => ({
        bus_stop_number: busStop.id,
        latitude: busStop.lat,
        longitude: busStop.lng,
      }));
    }

    if (layer === "mrt-exits") {
      return fetchAllSupabaseRows<RawLayerRow>(
        "datagov_mrt_exits",
        "station_name, exit_number, latitude, longitude",
        "station_name",
      );
    }

    const exitRows = await fetchAllSupabaseRows<SupabaseMrtExitRow>(
      "datagov_mrt_exits",
      "station_name, exit_number, latitude, longitude",
      "station_name",
    );

    const grouped = new Map<string, { station_name: string; latitudeSum: number; longitudeSum: number; exit_count: number }>();
    exitRows.forEach((row) => {
      const lat = toNumber(row.latitude);
      const lng = toNumber(row.longitude);
      if (lat === null || lng === null) {
        return;
      }

      const key = row.station_name;
      const current = grouped.get(key) ?? {
        station_name: row.station_name,
        latitudeSum: 0,
        longitudeSum: 0,
        exit_count: 0,
      };

      current.latitudeSum += lat;
      current.longitudeSum += lng;
      current.exit_count += 1;
      grouped.set(key, current);
    });

    return Array.from(grouped.values()).map((row) => ({
      station_name: row.station_name,
      latitude: row.latitudeSum / row.exit_count,
      longitude: row.longitudeSum / row.exit_count,
      exit_count: row.exit_count,
    }));
  };

  const rows = await (async () => {
    if (!pool) {
      return getRowsViaSupabase();
    }

    try {
      return (await pool.query<RawLayerRow>(config.sql)).rows;
    } catch {
      return getRowsViaSupabase();
    }
  })();

  const features = rows
    .map((row) => {
      const lat = toNumber(row.latitude);
      const lng = toNumber(row.longitude);
      if (lat === null || lng === null) {
        return null;
      }

      return {
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [lng, lat] as [number, number],
        },
        properties: config.buildProperties(row),
      };
    })
    .filter((feature): feature is NonNullable<typeof feature> => feature !== null);

  const collection: PointLayerCollection = {
    type: "FeatureCollection",
    features,
    metadata: {
      layer,
      featureCount: features.length,
    },
  };

  pointLayerCollectionCache.set(layer, {
    expiresAt: Date.now() + HTTP_CACHE_TTL_MS,
    collection,
  });

  return filterPointLayerCollectionByRadius(collection, focus);
}

async function getCompetitionCategoryForProfile(profileId?: string) {
  if (!profileId) {
    return "retail";
  }

  try {
    const sector = pool
      ? (
          await pool.query<{ sector: string | null }>(
            `SELECT sector FROM business_profiles WHERE id = $1 LIMIT 1`,
            [profileId],
          )
        ).rows[0]?.sector?.toLowerCase() ?? ""
      : (
          await requireSupabaseHttpClient()
            .from("business_profiles")
            .select("sector")
            .eq("id", profileId)
            .maybeSingle()
        ).data?.sector?.toLowerCase() ?? "";

    if (/(f&b|food|beverage|restaurant|cafe|bakery)/.test(sector)) return "fnb";
  } catch {
    return "retail";
  }

  return "retail";
}

function localAccessibilityScore(busStopsWithinRadius: number, mrtExitsWithinRadius: number) {
  const raw = busStopsWithinRadius + mrtExitsWithinRadius * 4;
  return Math.round(clamp(raw * 8));
}

function competitionScoreFromCount(count: number | null) {
  if (count === null) {
    return null;
  }

  if (count <= 0) {
    return 100;
  }

  // Match the edge-function scoring curve so competition degrades gradually
  // instead of hitting zero too early for dense urban areas.
  const maxReferenceCount = 500;
  const score = 100 * (1 - Math.log(count + 1) / Math.log(maxReferenceCount + 1));
  return Math.round(clamp(score));
}

export async function scoreSiteLocation(input: {
  lat: number;
  lng: number;
  profileId?: string;
  radiusMeters?: number;
}): Promise<SiteScoreResult> {
  const radiusMeters = clampRadiusMeters(input.radiusMeters);
  const planningAreas = await getPlanningAreaMetricRows();

  const scoreViaSupabase = async (): Promise<SiteScoreResult> => {
    const parsedAreas = getParsedAreaGeometries(planningAreas);
    const planningAreaId =
      parsedAreas.find((area) => pointInGeometry(input.lng, input.lat, area.geometry, area.bbox))?.planningAreaId ??
      null;
    const planningArea = planningAreas.find((row) => row.planningAreaId === planningAreaId) ?? null;

    const [busStops, mrtExits, places] = await Promise.all([
      fetchAllSupabaseRows<SupabaseBusStopRow>(
        "datagov_bus_stops",
        "bus_stop_number, latitude, longitude",
        "bus_stop_number",
      ),
      fetchAllSupabaseRows<SupabaseMrtExitRow>(
        "datagov_mrt_exits",
        "station_name, exit_number, latitude, longitude",
        "station_name",
      ),
      fetchAllSupabaseRows<SupabasePlaceRow>(
        "google_places",
        "shop_category, latitude, longitude",
        "id",
      ),
    ]);

    const busStopsWithinRadius = normalizeBusStops(busStops).reduce((count, busStop) => {
      return count + (haversineDistanceMeters(input.lat, input.lng, busStop.lat, busStop.lng) <= radiusMeters ? 1 : 0);
    }, 0);

    const mrtExitsWithinRadius = mrtExits.reduce((count, row) => {
      const lat = toNumber(row.latitude);
      const lng = toNumber(row.longitude);
      if (lat === null || lng === null) {
        return count;
      }
      return count + (haversineDistanceMeters(input.lat, input.lng, lat, lng) <= radiusMeters ? 1 : 0);
    }, 0);

    const accessibility = localAccessibilityScore(busStopsWithinRadius, mrtExitsWithinRadius);
    const competitionCategory = await getCompetitionCategoryForProfile(input.profileId);
    const competitionCountWithinRadius = places.reduce((count, row) => {
      if ((row.shop_category ?? "").toLowerCase() !== competitionCategory) {
        return count;
      }

      const lat = toNumber(row.latitude);
      const lng = toNumber(row.longitude);
      if (lat === null || lng === null) {
        return count;
      }

      return count + (haversineDistanceMeters(input.lat, input.lng, lat, lng) <= radiusMeters ? 1 : 0);
    }, 0);

    const demographic = planningArea?.demographicScore ?? null;
    const rental = await fetchRentalScore(input.lat, input.lng);
    const competition = competitionScoreFromCount(competitionCountWithinRadius);
    const composite = average([demographic, accessibility, rental, competition]);

    return {
      lat: input.lat,
      lng: input.lng,
      planningArea,
      scores: {
        composite,
        demographic,
        accessibility,
        rental,
        competition,
      },
      breakdownDetails: {
        analysisRadiusMeters: radiusMeters,
        busStopsWithinRadius,
        mrtExitsWithinRadius,
        competitionCountWithinRadius,
        competitionCategory,
        populationTotal: planningArea?.populationTotal ?? null,
        avgUnitPricePsf: planningArea?.avgUnitPricePsf ?? null,
        retailTransactionCount: planningArea?.retailTransactionCount ?? 0,
      },
    };
  };

  if (!pool) {
    return scoreViaSupabase();
  }

  try {
    const geometryExpression = getDbGeometryExpression("pa");

  const areaLookupSql = `
    WITH canonical_areas AS (
      SELECT
        pa.id::text AS planning_area_id,
        ${geometryExpression} AS geom
      FROM planning_areas pa
      WHERE pa.geometry_geojson IS NOT NULL
    ),
    fallback_areas AS (
      SELECT
        regexp_replace(upper(opa.planning_area), '[^A-Z0-9]+', '_', 'g') AS planning_area_id,
        opa.geom
      FROM onemap_planning_area opa
      WHERE opa.geojson IS NOT NULL
    ),
    source_areas AS (
      SELECT * FROM canonical_areas
      UNION ALL
      SELECT * FROM fallback_areas
      WHERE NOT EXISTS (SELECT 1 FROM canonical_areas)
    ),
    point AS (
      SELECT ST_SetSRID(ST_MakePoint($2, $1), 4326) AS geom
    )
    SELECT sa.planning_area_id
    FROM source_areas sa, point p
    WHERE sa.geom IS NOT NULL
      AND ST_Covers(sa.geom, p.geom)
    LIMIT 1
  `;

  const { rows: areaRows } = await pool.query<RawSiteAreaRow>(areaLookupSql, [input.lat, input.lng]);
  const planningAreaId = areaRows[0]?.planning_area_id ?? null;
  const planningArea = planningAreas.find((row) => row.planningAreaId === planningAreaId) ?? null;

  const nearbyTransportSql = `
    WITH point AS (
      SELECT ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography AS geom
    )
    SELECT
      (
        SELECT COUNT(DISTINCT bs.bus_stop_number)::int
        FROM datagov_bus_stops bs, point p
        WHERE ST_DWithin(bs.geom::geography, p.geom, $3)
      ) AS bus_stops_within_radius,
      (
        SELECT COUNT(*)::int
        FROM datagov_mrt_exits me, point p
        WHERE ST_DWithin(me.geom::geography, p.geom, $3)
      ) AS mrt_exits_within_radius
  `;

  const { rows: nearbyRows } = await pool.query<{
    bus_stops_within_radius: number | string;
    mrt_exits_within_radius: number | string;
  }>(nearbyTransportSql, [input.lat, input.lng, radiusMeters]);

  const busStopsWithinRadius = Math.round(toNumber(nearbyRows[0]?.bus_stops_within_radius) ?? 0);
  const mrtExitsWithinRadius = Math.round(toNumber(nearbyRows[0]?.mrt_exits_within_radius) ?? 0);
  const accessibility = localAccessibilityScore(busStopsWithinRadius, mrtExitsWithinRadius);

  const competitionCategory = await getCompetitionCategoryForProfile(input.profileId);
  let competitionCountWithinRadius: number | null = null;

  try {
    const competitionSql = `
      WITH point AS (
        SELECT ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography AS geom
      )
      SELECT COUNT(*)::int AS count
      FROM google_places gp, point p
      WHERE gp.shop_category = $3
        AND ST_DWithin(gp.geom::geography, p.geom, $4)
    `;
    const { rows: competitionRows } = await pool.query<RawCompetitionRow>(competitionSql, [
      input.lat,
      input.lng,
      competitionCategory,
      radiusMeters,
    ]);
    competitionCountWithinRadius = Math.round(toNumber(competitionRows[0]?.count) ?? 0);
  } catch {
    competitionCountWithinRadius = null;
  }

  const demographic = planningArea?.demographicScore ?? null;
  const rental = await fetchRentalScore(input.lat, input.lng);
  const competition = competitionScoreFromCount(competitionCountWithinRadius);
  const composite = average([demographic, accessibility, rental, competition]);

    return {
      lat: input.lat,
      lng: input.lng,
      planningArea,
      scores: {
        composite,
        demographic,
        accessibility,
        rental,
        competition,
      },
      breakdownDetails: {
        analysisRadiusMeters: radiusMeters,
        busStopsWithinRadius,
        mrtExitsWithinRadius,
        competitionCountWithinRadius,
        competitionCategory,
        populationTotal: planningArea?.populationTotal ?? null,
        avgUnitPricePsf: planningArea?.avgUnitPricePsf ?? null,
        retailTransactionCount: planningArea?.retailTransactionCount ?? 0,
      },
    };
  } catch {
    return scoreViaSupabase();
  }
}
