/**
 * Edge Function: getCompetitionCount
 * -----------------------------------
 * Description:
 * Fetches the number of nearby shops for a given category and radius.
 * Supports caching in Supabase to reduce Google Places API calls.
 *
 * HTTP Method: POST
 * URL: https://<your-project-ref>.functions.supabase.co/getCompetitionCount
 *
 * Request Body (JSON):
 * {
 *   "lat": number,             // REQUIRED: Latitude of the location
 *   "lng": number,             // REQUIRED: Longitude of the location
 *   "radius_meters": number,   // OPTIONAL: Search radius in meters (default: 100)
 *   "shop_category": string,   // OPTIONAL: Shop category. Default: "fnb"
 *                              // Valid options: fnb, clothing, electronics, beauty, supermarket, pharmacy, gym, bank, convenience, retail
 *   "use_cache": boolean,      // OPTIONAL: Whether to use cached results (default: true)
 *   "cache_ttl_hours": number  // OPTIONAL: Cache time-to-live in hours (default: 24)
 * }
 *
 * Response Body (JSON):
 * {
 *   "shop_category": string,
 *   "radius_meters": number,
 *   "count": number,               // Number of shops found
 *   "from_cache": boolean,         // True if result came from cache
 *   "api_calls": number,           // Number of Google API calls made
 *   "potentially_incomplete": boolean // True if result may be incomplete due to API result limits
 * }
 *
 * Example TypeScript Call:
 * const res = await fetch(
 *   "https://<your-project-ref>.functions.supabase.co/getCompetitionCount",
 *   {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify({ lat: 1.34405, lng: 103.68256, shop_category: "fnb" })
 *   }
 * );
 * const data = await res.json();
 * console.log(data);
 */

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

// @ts-ignore Deno remote imports are resolved at deploy/runtime for Edge Functions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = 
  Deno.env.get("VITE_SUPABASE_URL") ?? 
  Deno.env.get("SUPABASE_URL") ??
  "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const GOOGLE_API_KEY =
  Deno.env.get("GOOGLE_PLACES_API_KEY") ??
  Deno.env.get("VITE_GOOGLE_MAPS_API_KEY") ??
  "";

const NEARBY_SEARCH_URL = "https://places.googleapis.com/v1/places:searchNearby";
const MAX_RESULTS_PER_REQUEST = 20;
const EXHAUSTIVE_SUBSEARCH_RADIUS_METERS = 50;
const EXHAUSTIVE_GRID_STEP_METERS = 50;
const CACHE_BUCKET_METERS = 50;
const DEFAULT_CACHE_TTL_HOURS = 24;

const SHOP_CATEGORY_TO_PLACE_TYPES: Record<string, string[]> = {
  fnb: [
    "restaurant",
    "cafe",
    "bar",
    "bakery",
    "fast_food_restaurant",
    "coffee_shop",
    "dessert_shop",
    "ice_cream_shop",
    "juice_shop",
  ],
  clothing: ["clothing_store", "shoe_store"],
  electronics: ["electronics_store", "cell_phone_store", "computer_store"],
  beauty: ["beauty_salon", "hair_salon", "nail_salon", "spa", "barber_shop"],
  supermarket: ["supermarket", "grocery_store"],
  pharmacy: ["pharmacy", "drugstore"],
  gym: ["gym"],
  bank: ["bank"],
  convenience: ["convenience_store"],
  retail: ["store", "department_store"],
};

const VALID_CATEGORIES = Object.keys(SHOP_CATEGORY_TO_PLACE_TYPES);

type PlaceRecord = {
  place_id: string;
  name: string;
  shop_category: string;
  latitude: number | null;
  longitude: number | null;
  raw_types: string[];
};

type CompetitionResult = {
  shop_category: string;
  radius_meters: number;
  count: number;
  from_cache: boolean;
  api_calls: number;
  potentially_incomplete: boolean;
};

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function metersToLatDelta(meters: number): number {
  return meters / 111_320.0;
}

function metersToLngDelta(meters: number, latitudeDeg: number): number {
  const cosLat = Math.max(Math.cos((latitudeDeg * Math.PI) / 180), 1e-6);
  return meters / (111_320.0 * cosLat);
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6_371_000.0;
  const lat1r = (lat1 * Math.PI) / 180;
  const lng1r = (lng1 * Math.PI) / 180;
  const lat2r = (lat2 * Math.PI) / 180;
  const lng2r = (lng2 * Math.PI) / 180;
  const dlat = lat2r - lat1r;
  const dlng = lng2r - lng1r;
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(lat1r) * Math.cos(lat2r) * Math.sin(dlng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

function bucketizeCenter(lat: number, lng: number, bucketMeters: number): [number, number] {
  const latStep = metersToLatDelta(bucketMeters);
  const lngStep = metersToLngDelta(bucketMeters, lat);
  const bucketLat = Number((Math.round(lat / latStep) * latStep).toFixed(6));
  const bucketLng = Number((Math.round(lng / lngStep) * lngStep).toFixed(6));
  return [bucketLat, bucketLng];
}

async function getRecentFetchCache(
  lat: number,
  lng: number,
  radiusMeters: number,
  shopCategory: string,
  cacheTtlHours: number,
): Promise<Record<string, unknown> | null> {
  const [bucketLat, bucketLng] = bucketizeCenter(lat, lng, CACHE_BUCKET_METERS);
  const cutoffIso = new Date(Date.now() - cacheTtlHours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("google_places_fetch_cache")
    .select("*")
    .eq("bucket_lat", bucketLat)
    .eq("bucket_lng", bucketLng)
    .eq("radius_meters", radiusMeters)
    .eq("shop_category", shopCategory)
    .gte("last_fetched_at", cutoffIso)
    .limit(1);

  if (error) {
    throw new Error(`Failed to read fetch cache: ${error.message}`);
  }

  return data && data.length > 0 ? data[0] : null;
}

async function upsertFetchCache(
  lat: number,
  lng: number,
  radiusMeters: number,
  shopCategory: string,
  apiCalls: number,
  potentiallyIncomplete: boolean,
): Promise<void> {
  const [bucketLat, bucketLng] = bucketizeCenter(lat, lng, CACHE_BUCKET_METERS);

  const record = {
    bucket_lat: bucketLat,
    bucket_lng: bucketLng,
    radius_meters: radiusMeters,
    shop_category: shopCategory,
    last_fetched_at: new Date().toISOString(),
    api_calls: apiCalls,
    potentially_incomplete: potentiallyIncomplete,
  };

  const { error } = await supabase
    .from("google_places_fetch_cache")
    .upsert(record, { onConflict: "bucket_lat,bucket_lng,radius_meters,shop_category" });

  if (error) {
    throw new Error(`Failed to upsert fetch cache: ${error.message}`);
  }
}

function buildSubsearchCenters(
  centerLat: number,
  centerLng: number,
  targetRadiusMeters: number,
  subRadiusMeters: number,
  gridStepMeters: number,
): Array<[number, number]> {
  const coverRadius = targetRadiusMeters + subRadiusMeters;
  const centers: Array<[number, number]> = [];

  let y = -coverRadius;
  while (y <= coverRadius) {
    let x = -coverRadius;
    while (x <= coverRadius) {
      if (Math.hypot(x, y) <= coverRadius) {
        const lat = centerLat + metersToLatDelta(y);
        const lng = centerLng + metersToLngDelta(x, centerLat);
        centers.push([lat, lng]);
      }
      x += gridStepMeters;
    }
    y += gridStepMeters;
  }

  return centers;
}

async function fetchNearbyPlacesFromGoogle(
  lat: number,
  lng: number,
  radiusMeters: number,
  shopCategory: string,
): Promise<PlaceRecord[]> {
  if (!SHOP_CATEGORY_TO_PLACE_TYPES[shopCategory]) {
    throw new Error(
      `Unknown shop_category '${shopCategory}'. Valid options: ${JSON.stringify(VALID_CATEGORIES)}`,
    );
  }

  if (!GOOGLE_API_KEY) {
    throw new Error(
      "Google API key not set. Add GOOGLE_PLACES_API_KEY or VITE_GOOGLE_MAPS_API_KEY to your environment.",
    );
  }

  const payload = {
    includedTypes: SHOP_CATEGORY_TO_PLACE_TYPES[shopCategory],
    maxResultCount: MAX_RESULTS_PER_REQUEST,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: Number(radiusMeters),
      },
    },
  };

  const response = await fetch(NEARBY_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_API_KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.types",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const details = (await response.text()).trim();
    throw new Error(
      `Google Places request failed (HTTP ${response.status}). Response: ${details}. Common causes: API key restrictions, Places API (New) not enabled, or billing not enabled on the Google Cloud project.`,
    );
  }

  const data = await response.json();
  const places = (data.places ?? []) as Array<Record<string, unknown>>;

  return places.map((place) => {
    const location = (place.location ?? {}) as Record<string, unknown>;
    const displayName = (place.displayName ?? {}) as Record<string, unknown>;

    return {
      place_id: String(place.id ?? ""),
      name: String(displayName.text ?? "Unknown"),
      shop_category: shopCategory,
      latitude: typeof location.latitude === "number" ? location.latitude : null,
      longitude: typeof location.longitude === "number" ? location.longitude : null,
      raw_types: Array.isArray(place.types) ? (place.types as string[]) : [],
    };
  });
}

async function fetchExhaustivePlacesWithinRadius(
  lat: number,
  lng: number,
  targetRadiusMeters: number,
  shopCategory: string,
): Promise<[PlaceRecord[], number, number]> {
  const centers = buildSubsearchCenters(
    lat,
    lng,
    targetRadiusMeters,
    EXHAUSTIVE_SUBSEARCH_RADIUS_METERS,
    EXHAUSTIVE_GRID_STEP_METERS,
  );

  const dedup: Record<string, PlaceRecord> = {};
  let apiCalls = 0;
  let cappedCalls = 0;

  for (const [subLat, subLng] of centers) {
    const places = await fetchNearbyPlacesFromGoogle(
      subLat,
      subLng,
      EXHAUSTIVE_SUBSEARCH_RADIUS_METERS,
      shopCategory,
    );

    apiCalls += 1;
    if (places.length >= MAX_RESULTS_PER_REQUEST) {
      cappedCalls += 1;
    }

    for (const place of places) {
      if (place.place_id) {
        dedup[place.place_id] = place;
      }
    }
  }

  const uniquePlacesInRadius: PlaceRecord[] = [];
  for (const place of Object.values(dedup)) {
    if (place.latitude === null || place.longitude === null) {
      continue;
    }

    if (distanceMeters(lat, lng, place.latitude, place.longitude) <= targetRadiusMeters) {
      uniquePlacesInRadius.push(place);
    }
  }

  console.log(
    `[Google Places] Exhaustive scan complete: ${apiCalls} API calls, ${Object.keys(dedup).length} unique fetched, ${uniquePlacesInRadius.length} within ${targetRadiusMeters} m.`,
  );

  return [uniquePlacesInRadius, apiCalls, cappedCalls];
}

async function savePlacesToDb(places: PlaceRecord[]): Promise<number> {
  if (!places.length) {
    return 0;
  }

  const records = places
    .filter((p) => p.latitude !== null && p.longitude !== null)
    .map((p) => ({
      place_id: p.place_id,
      name: p.name,
      shop_category: p.shop_category,
      latitude: p.latitude,
      longitude: p.longitude,
      raw_types: p.raw_types,
      updated_at: new Date().toISOString(),
    }));

  if (!records.length) {
    return 0;
  }

  const { data, error } = await supabase
    .from("google_places")
    .upsert(records, { onConflict: "place_id" })
    .select("place_id");

  if (error) {
    throw new Error(`Failed to upsert places: ${error.message}`);
  }

  const count = data?.length ?? records.length;
  console.log(`[Supabase] Upserted ${count} places into google_places.`);
  return count;
}

async function countPlacesInDb(
  lat: number,
  lng: number,
  radiusMeters: number,
  shopCategory: string,
): Promise<number> {
  const { data, error } = await supabase.rpc("count_nearby_google_places", {
    center_lat: lat,
    center_lng: lng,
    radius_m: radiusMeters,
    p_shop_category: shopCategory,
  });

  if (error) {
    throw new Error(`Failed to count nearby places: ${error.message}`);
  }

  return data !== null && data !== undefined ? Number(data) : 0;
}

async function getCompetitionCount(params: {
  lat: number;
  lng: number;
  radius_meters?: number;
  shop_category?: string;
  use_cache?: boolean;
  cache_ttl_hours?: number;
}): Promise<CompetitionResult> {
  const lat = params.lat;
  const lng = params.lng;
  const radiusMeters = params.radius_meters ?? 100;
  const shopCategory = params.shop_category ?? "fnb";
  const useCache = params.use_cache ?? true;
  const cacheTtlHours = params.cache_ttl_hours ?? DEFAULT_CACHE_TTL_HOURS;

  if (!SHOP_CATEGORY_TO_PLACE_TYPES[shopCategory]) {
    throw new Error(
      `Unknown shop_category '${shopCategory}'. Valid options: ${JSON.stringify(VALID_CATEGORIES)}`,
    );
  }

  let cacheHit: Record<string, unknown> | null = null;
  if (useCache) {
    cacheHit = await getRecentFetchCache(lat, lng, radiusMeters, shopCategory, cacheTtlHours);
  }

  if (cacheHit) {
    console.log(
      `[Google Places] Cache hit for category='${shopCategory}', radius=${radiusMeters} m. Skipping Google fetch.`,
    );

    const dbCount = await countPlacesInDb(lat, lng, radiusMeters, shopCategory);

    return {
      shop_category: shopCategory,
      radius_meters: radiusMeters,
      count: dbCount,
      from_cache: true,
      api_calls: 0,
      potentially_incomplete: Boolean(cacheHit.potentially_incomplete ?? false),
    };
  }

  console.log(
    `[Google Places] Exhaustive fetch for (${lat}, ${lng}) r=${radiusMeters} m category='${shopCategory}'`,
  );

  const [places, apiCalls, cappedCalls] = await fetchExhaustivePlacesWithinRadius(
    lat,
    lng,
    radiusMeters,
    shopCategory,
  );

  await savePlacesToDb(places);
  await upsertFetchCache(lat, lng, radiusMeters, shopCategory, apiCalls, cappedCalls > 0);
  const dbCount = await countPlacesInDb(lat, lng, radiusMeters, shopCategory);

  return {
    shop_category: shopCategory,
    radius_meters: radiusMeters,
    count: dbCount,
    from_cache: false,
    api_calls: apiCalls,
    potentially_incomplete: cappedCalls > 0,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return jsonResponse({ ok: true }, 200);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return jsonResponse(
      {
        error:
          "Supabase credentials are missing. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY).",
      },
      500,
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }
  const token = authHeader.slice(7);
  // Allow internal service-to-service calls using the service role key
  if (token !== SUPABASE_KEY) {
    const authClient = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized." }, 401);
    }
  }

  try {
    const payload = (await req.json()) as {
      lat?: number;
      lng?: number;
      radius_meters?: number;
      shop_category?: string;
      use_cache?: boolean;
      cache_ttl_hours?: number;
    };

    if (typeof payload.lat !== "number" || typeof payload.lng !== "number") {
      return jsonResponse(
        {
          error: "Invalid request body. 'lat' and 'lng' must be numbers.",
          valid_categories: VALID_CATEGORIES,
        },
        400,
      );
    }

    const result = await getCompetitionCount({
      lat: payload.lat,
      lng: payload.lng,
      radius_meters: payload.radius_meters,
      shop_category: payload.shop_category,
      use_cache: payload.use_cache,
      cache_ttl_hours: payload.cache_ttl_hours,
    });

    return jsonResponse(result, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return jsonResponse(
      {
        error: message,
        valid_categories: VALID_CATEGORIES,
      },
      500,
    );
  }
});
