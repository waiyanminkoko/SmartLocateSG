/**
 * Edge Function: score-accessibility
 * -----------------------------------
 * Scores a location (0–100) based on proximity to MRT exits and bus stops.
 *
 * HTTP Method: POST
 *
 * Request Body (JSON):
 * {
 *   "lat": number,           // REQUIRED
 *   "lng": number,           // REQUIRED
 *   "radius_meters": number  // OPTIONAL: default 500
 * }
 *
 * Response Body (JSON):
 * {
 *   "score": number,         // 0–100
 *   "mrt_count": number,
 *   "bus_count": number,
 *   "mrt_score": number,
 *   "bus_score": number,
 *   "radius_meters": number
 * }
 *
 * Formula:
 *   mrt_score = clamp(mrt_count / 5, 0, 1) * 100
 *   bus_score = clamp(bus_count / 10, 0, 1) * 100
 *   score     = mrt_score * 0.6 + bus_score * 0.4
 */

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

// @ts-ignore Deno remote imports are resolved at deploy/runtime for Edge Functions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const DEFAULT_RADIUS_METERS = 500;
const MRT_SATURATION  = 5;   // 5 MRT exits  → full MRT score
const BUS_SATURATION  = 10;  // 10 bus stops  → full bus score
const MRT_WEIGHT      = 0.6;
const BUS_WEIGHT      = 0.4;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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

async function scoreAccessibility(params: {
  lat: number;
  lng: number;
  radius_meters?: number;
}) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const radius = params.radius_meters ?? DEFAULT_RADIUS_METERS;

  const { data, error } = await supabase.rpc("count_nearby_transit", {
    center_lat: params.lat,
    center_lng: params.lng,
    radius_m: radius,
  });

  if (error) {
    throw new Error(`count_nearby_transit RPC failed: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  const mrtCount = Number(row?.mrt_count ?? 0);
  const busCount = Number(row?.bus_count ?? 0);

  const mrtScore = clamp(mrtCount / MRT_SATURATION, 0, 1) * 100;
  const busScore = clamp(busCount / BUS_SATURATION, 0, 1) * 100;
  const score    = Math.round(mrtScore * MRT_WEIGHT + busScore * BUS_WEIGHT);

  return {
    score,
    mrt_count: mrtCount,
    bus_count: busCount,
    mrt_score: Math.round(mrtScore),
    bus_score: Math.round(busScore),
    radius_meters: radius,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return jsonResponse({ ok: true });
  if (req.method !== "POST") return jsonResponse({ error: "Use POST." }, 405);

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return jsonResponse({ error: "Supabase credentials missing." }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }
  const token = authHeader.slice(7);
  const authClient = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  try {
    const payload = (await req.json()) as {
      lat?: number;
      lng?: number;
      radius_meters?: number;
    };

    if (typeof payload.lat !== "number" || typeof payload.lng !== "number") {
      return jsonResponse({ error: "'lat' and 'lng' must be numbers." }, 400);
    }

    const result = await scoreAccessibility({
      lat: payload.lat,
      lng: payload.lng,
      radius_meters: payload.radius_meters,
    });

    return jsonResponse(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
