/**
 * Edge Function: score-composite
 * -----------------------------------
 * Computes all four location scores in parallel and returns the weighted
 * composite score plus a full breakdown.
 *
 * HTTP Method: POST
 *
 * Request Body (JSON):
 * {
 *   "lat": number,                  // REQUIRED
 *   "lng": number,                  // REQUIRED
 *   "age_groups": string[],         // REQUIRED — from business profile
 *   "income_bands": string[],       // REQUIRED — from business profile
 *   "shop_category": string,        // REQUIRED — e.g. "fnb", "clothing" (see google-competition-count)
 *   "weights": {                    // OPTIONAL — must sum to 1.0 (default below)
 *     "demographic":   number,      //   default 0.30
 *     "accessibility": number,      //   default 0.30
 *     "rental":        number,      //   default 0.20
 *     "competition":   number       //   default 0.20
 *   },
 *   "radius_meters": number,        // OPTIONAL — radius for accessibility + competition (default 500)
 *   "rental_radius_meters": number  // OPTIONAL — radius for rental search (default 1000)
 * }
 *
 * Response Body (JSON):
 * {
 *   "composite": number,
 *   "demographic":   { "score": number, "age_score": number, "income_score": number, "planning_area": string, "data_year": number },
 *   "accessibility": { "score": number, "mrt_count": number, "bus_count": number },
 *   "rental":        { "score": number, "median_psf": number | null, "psf_band": string },
 *   "competition":   { "score": number, "count": number, "shop_category": string },
 *   "weights_used": { "demographic": number, "accessibility": number, "rental": number, "competition": number }
 * }
 */

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

// @ts-ignore Deno remote imports are resolved at deploy/runtime for Edge Functions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY      = Deno.env.get("ANON_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const DEFAULT_WEIGHTS = {
  demographic:   0.30,
  accessibility: 0.30,
  rental:        0.20,
  competition:   0.20,
};

const VALID_CATEGORIES = [
  "fnb", "clothing", "electronics", "beauty", "supermarket",
  "pharmacy", "gym", "bank", "convenience", "retail",
];

// ── Age / income helpers (duplicated from score-demographic for self-containment) ──

const AGE_GROUP_COLUMNS: Record<string, string[]> = {
  "18-24": ["age_20_24"],
  "25-34": ["age_25_29", "age_30_34"],
  "35-44": ["age_35_39", "age_40_44"],
  "45-54": ["age_45_49", "age_50_54"],
  "55-64": ["age_55_59", "age_60_64"],
  "65+":   ["age_65_69", "age_70_74", "age_75_79", "age_80_84", "age_85_over"],
};

const INCOME_BAND_COLUMNS: Record<string, string[]> = {
  "lower-middle": ["sgd_3000_to_3999", "sgd_4000_to_4999"],
  "middle":       ["sgd_5000_to_5999", "sgd_6000_to_6999", "sgd_7000_to_7999"],
  "upper-middle": ["sgd_8000_to_8999", "sgd_9000_to_9999", "sgd_10000_to_10999", "sgd_11000_to_11999"],
};

function normaliseIncomeBand(raw: string): string | null {
  const lower = raw.toLowerCase();
  if (lower.startsWith("upper-middle")) return "upper-middle";
  if (lower.startsWith("lower-middle")) return "lower-middle";
  if (lower.startsWith("middle"))       return "middle";
  return null;
}

function sumCols(row: Record<string, unknown>, cols: string[]): number {
  return cols.reduce((acc, c) => acc + Number(row[c] ?? 0), 0);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function psfToScore(psf: number | null): { score: number; band: string } {
  if (psf === null) return { score: 50, band: "no_data" };
  if (psf < 2000)   return { score: 100, band: "<$2k PSF" };
  if (psf < 4000)   return { score: 75,  band: "$2k–$4k PSF" };
  if (psf < 7000)   return { score: 40,  band: "$4k–$7k PSF" };
  return               { score: 10,  band: ">$7k PSF" };
}

function competitionCountToScore(count: number): number {
  // Logarithmic scale: 0 → 100, ~500 → 0
  // score = 100 * (1 - log(count + 1) / log(501))
  if (count <= 0) return 100;
  const score = 100 * (1 - Math.log(count + 1) / Math.log(501));
  return Math.round(clamp(score, 0, 100));
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

// ── Individual scoring functions ──────────────────────────────────────────────

async function fetchAccessibility(
  supabase: ReturnType<typeof createClient>,
  lat: number,
  lng: number,
  radiusM: number,
) {
  const { data, error } = await supabase.rpc("count_nearby_transit", {
    center_lat: lat,
    center_lng: lng,
    radius_m: radiusM,
  });
  if (error) throw new Error(`count_nearby_transit: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : data;
  const mrtCount = Number(row?.mrt_count ?? 0);
  const busCount = Number(row?.bus_count ?? 0);
  const mrtScore = clamp(mrtCount / 5,  0, 1) * 100;
  const busScore = clamp(busCount / 10, 0, 1) * 100;
  const score    = Math.round(mrtScore * 0.6 + busScore * 0.4);

  return { score, mrt_count: mrtCount, bus_count: busCount, mrt_score: Math.round(mrtScore), bus_score: Math.round(busScore) };
}

async function fetchRental(
  supabase: ReturnType<typeof createClient>,
  lat: number,
  lng: number,
  radiusM: number,
) {
  const { data, error } = await supabase.rpc("median_psf_nearby", {
    center_lat: lat,
    center_lng: lng,
    radius_m: radiusM,
    years_back: 3,
  });
  if (error) throw new Error(`median_psf_nearby: ${error.message}`);

  const medianPsf = data !== null && data !== undefined ? Number(data) : null;
  const { score, band } = psfToScore(medianPsf);
  return { score, median_psf: medianPsf, psf_band: band };
}

async function fetchDemographic(
  supabase: ReturnType<typeof createClient>,
  lat: number,
  lng: number,
  ageGroups: string[],
  incomeBands: string[],
) {
  const { data, error } = await supabase.rpc("get_planning_area_demographics", {
    center_lat: lat,
    center_lng: lng,
  });
  if (error) throw new Error(`get_planning_area_demographics: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : data;

  if (!row?.planning_area) {
    return { score: 50, age_score: 50, income_score: 50, planning_area: null, data_year: null };
  }

  const agTotal = Number(row.ag_total ?? 0);
  let ageMatched = 0;
  for (const g of ageGroups) {
    const cols = AGE_GROUP_COLUMNS[g];
    if (cols) ageMatched += sumCols(row as Record<string, unknown>, cols);
  }
  const ageScore = agTotal > 0 ? clamp((ageMatched / agTotal) * 100, 0, 100) : 50;

  const hiTotal = Number(row.hi_total ?? 0);
  let incomeMatched = 0;
  for (const raw of incomeBands) {
    const key = normaliseIncomeBand(raw);
    if (!key) continue;
    const cols = INCOME_BAND_COLUMNS[key];
    if (cols) incomeMatched += sumCols(row as Record<string, unknown>, cols);
  }
  const incomeScore = hiTotal > 0 ? clamp((incomeMatched / hiTotal) * 100, 0, 100) : 50;

  return {
    score:         Math.round(ageScore * 0.5 + incomeScore * 0.5),
    age_score:     Math.round(ageScore),
    income_score:  Math.round(incomeScore),
    planning_area: row.planning_area as string,
    data_year:     row.ag_year ?? row.hi_year ?? null,
  };
}

async function fetchCompetition(
  lat: number,
  lng: number,
  radiusM: number,
  shopCategory: string,
) {
  // Call the existing google-competition-count edge function
  const url = `${SUPABASE_URL}/functions/v1/google-competition-count`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ANON_KEY || SUPABASE_KEY}`,
    },
    body: JSON.stringify({ lat, lng, radius_meters: radiusM, shop_category: shopCategory }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`google-competition-count failed (${res.status}): ${text}`);
  }

  const result = await res.json() as { count: number; shop_category: string; from_cache: boolean };
  const score = competitionCountToScore(result.count);
  return { score, count: result.count, shop_category: result.shop_category, from_cache: result.from_cache };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return jsonResponse({ ok: true });
  if (req.method !== "POST") return jsonResponse({ error: "Use POST." }, 405);

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return jsonResponse({ error: "Supabase credentials missing." }, 500);
  }

  try {
    const payload = (await req.json()) as {
      lat?: number;
      lng?: number;
      age_groups?: string[];
      income_bands?: string[];
      shop_category?: string;
      weights?: Partial<typeof DEFAULT_WEIGHTS>;
      radius_meters?: number;
      rental_radius_meters?: number;
    };

    if (typeof payload.lat !== "number" || typeof payload.lng !== "number") {
      return jsonResponse({ error: "'lat' and 'lng' must be numbers." }, 400);
    }
    if (!Array.isArray(payload.age_groups) || payload.age_groups.length === 0) {
      return jsonResponse({ error: "'age_groups' must be a non-empty array." }, 400);
    }
    if (!Array.isArray(payload.income_bands) || payload.income_bands.length === 0) {
      return jsonResponse({ error: "'income_bands' must be a non-empty array." }, 400);
    }
    if (!payload.shop_category || !VALID_CATEGORIES.includes(payload.shop_category)) {
      return jsonResponse({
        error: `'shop_category' must be one of: ${VALID_CATEGORIES.join(", ")}`,
      }, 400);
    }

    const weights = {
      demographic:   payload.weights?.demographic   ?? DEFAULT_WEIGHTS.demographic,
      accessibility: payload.weights?.accessibility ?? DEFAULT_WEIGHTS.accessibility,
      rental:        payload.weights?.rental        ?? DEFAULT_WEIGHTS.rental,
      competition:   payload.weights?.competition   ?? DEFAULT_WEIGHTS.competition,
    };

    // Normalise weights so they always sum to 1
    const weightTotal = weights.demographic + weights.accessibility + weights.rental + weights.competition;
    if (weightTotal > 0) {
      weights.demographic   /= weightTotal;
      weights.accessibility /= weightTotal;
      weights.rental        /= weightTotal;
      weights.competition   /= weightTotal;
    }

    const supabase    = createClient(SUPABASE_URL, SUPABASE_KEY);
    const radius      = payload.radius_meters        ?? 500;
    const rentalRadius = payload.rental_radius_meters ?? 1000;

    // Run all four scores in parallel
    const [demographic, accessibility, rental, competition] = await Promise.all([
      fetchDemographic(supabase, payload.lat, payload.lng, payload.age_groups, payload.income_bands),
      fetchAccessibility(supabase, payload.lat, payload.lng, radius),
      fetchRental(supabase, payload.lat, payload.lng, rentalRadius),
      fetchCompetition(payload.lat, payload.lng, radius, payload.shop_category),
    ]);

    const composite = Math.round(
      demographic.score   * weights.demographic   +
      accessibility.score * weights.accessibility +
      rental.score        * weights.rental        +
      competition.score   * weights.competition,
    );

    return jsonResponse({
      composite,
      demographic,
      accessibility,
      rental,
      competition,
      weights_used: {
        demographic:   Math.round(weights.demographic   * 100) / 100,
        accessibility: Math.round(weights.accessibility * 100) / 100,
        rental:        Math.round(weights.rental        * 100) / 100,
        competition:   Math.round(weights.competition   * 100) / 100,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
