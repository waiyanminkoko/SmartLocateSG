/**
 * Edge Function: score-demographic
 * -----------------------------------
 * Scores a location (0–100) based on how well the surrounding population's
 * age and income profile matches the target business profile.
 *
 * HTTP Method: POST
 *
 * Request Body (JSON):
 * {
 *   "lat": number,            // REQUIRED
 *   "lng": number,            // REQUIRED
 *   "age_groups": string[],   // REQUIRED — e.g. ["18-24", "25-34", "35-44"]
 *                             //   Valid values: "18-24" | "25-34" | "35-44"
 *                             //               | "45-54" | "55-64" | "65+"
 *   "income_bands": string[]  // REQUIRED — e.g. ["lower-middle", "middle"]
 *                             //   Valid values (case-insensitive prefix match):
 *                             //   "lower-middle" (S$3k–5k)
 *                             //   "middle"       (S$5k–8k)
 *                             //   "upper-middle" (S$8k–12k)
 * }
 *
 * Response Body (JSON):
 * {
 *   "score": number,           // 0–100
 *   "age_score": number,       // 0–100  share of population in target age groups
 *   "income_score": number,    // 0–100  share of households in target income bands
 *   "planning_area": string,
 *   "data_year": number
 * }
 *
 * Formula:
 *   age_score    = (sum of population in matched age columns / total population) * 100
 *   income_score = (sum of households in matched income columns / total households) * 100
 *   score        = age_score * 0.5 + income_score * 0.5
 */

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

// @ts-ignore Deno remote imports are resolved at deploy/runtime for Edge Functions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Maps profile age group labels → OneMap column names
const AGE_GROUP_COLUMNS: Record<string, string[]> = {
  "18-24": ["age_20_24"],                                                          // best approximation
  "25-34": ["age_25_29", "age_30_34"],
  "35-44": ["age_35_39", "age_40_44"],
  "45-54": ["age_45_49", "age_50_54"],
  "55-64": ["age_55_59", "age_60_64"],
  "65+":   ["age_65_69", "age_70_74", "age_75_79", "age_80_84", "age_85_over"],
};

// Maps income band key (lower-case prefix) → OneMap household_income column names
// Income band labels stored in profiles may be "lower-middle", "Lower-Middle",
// or the full label "Lower-Middle S$3,000-S$5,000" — we normalise below.
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

function sumColumns(row: Record<string, unknown>, columns: string[]): number {
  return columns.reduce((acc, col) => acc + (Number(row[col] ?? 0)), 0);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
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

async function scoreDemographic(params: {
  lat: number;
  lng: number;
  age_groups: string[];
  income_bands: string[];
}) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data, error } = await supabase.rpc("get_planning_area_demographics", {
    center_lat: params.lat,
    center_lng: params.lng,
  });

  if (error) {
    throw new Error(`get_planning_area_demographics RPC failed: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row || !row.planning_area) {
    // Point outside any known planning area (e.g. sea) — return neutral score
    return {
      score: 50,
      age_score: 50,
      income_score: 50,
      planning_area: null,
      data_year: null,
      note: "Location is outside all known planning areas.",
    };
  }

  // --- Age score ---
  const agTotal = Number(row.ag_total ?? 0);
  let ageMatched = 0;
  for (const group of params.age_groups) {
    const cols = AGE_GROUP_COLUMNS[group];
    if (cols) ageMatched += sumColumns(row as Record<string, unknown>, cols);
  }
  const ageScore = agTotal > 0 ? clamp((ageMatched / agTotal) * 100, 0, 100) : 50;

  // --- Income score ---
  const hiTotal = Number(row.hi_total ?? 0);
  let incomeMatched = 0;
  for (const rawBand of params.income_bands) {
    const key = normaliseIncomeBand(rawBand);
    if (!key) continue;
    const cols = INCOME_BAND_COLUMNS[key];
    if (cols) incomeMatched += sumColumns(row as Record<string, unknown>, cols);
  }
  const incomeScore = hiTotal > 0 ? clamp((incomeMatched / hiTotal) * 100, 0, 100) : 50;

  const score = Math.round(ageScore * 0.5 + incomeScore * 0.5);

  return {
    score,
    age_score:    Math.round(ageScore),
    income_score: Math.round(incomeScore),
    planning_area: row.planning_area as string,
    data_year: row.ag_year ?? row.hi_year ?? null,
  };
}

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

    const result = await scoreDemographic({
      lat: payload.lat,
      lng: payload.lng,
      age_groups: payload.age_groups,
      income_bands: payload.income_bands,
    });

    return jsonResponse(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
