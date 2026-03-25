/**
 * Edge Function: score-rental
 * -----------------------------------
 * Scores a location (0–100) based on rental pressure using URA retail
 * transaction data as a proxy (lower median PSF = lower pressure = higher score).
 *
 * HTTP Method: POST
 *
 * Request Body (JSON):
 * {
 *   "lat": number,           // REQUIRED
 *   "lng": number,           // REQUIRED
 *   "radius_meters": number, // OPTIONAL: search radius in meters (default 1000)
 *   "years_back": number     // OPTIONAL: how many years of history to use (default 3)
 * }
 *
 * Response Body (JSON):
 * {
 *   "score": number,         // 0–100
 *   "median_psf": number | null,
 *   "psf_band": string,
 *   "radius_meters": number,
 *   "years_back": number,
 *   "transaction_area": string  // "nearby" or "no_data"
 * }
 *
 * Formula:
 *   median PSF → score
 *   no data     → 50  (neutral)
 *   < $2,000    → 100
 *   $2,000–4,000 → 75
 *   $4,000–7,000 → 40
 *   > $7,000    → 10
 */

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

// @ts-ignore Deno remote imports are resolved at deploy/runtime for Edge Functions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const DEFAULT_RADIUS_METERS = 1000;
const DEFAULT_YEARS_BACK    = 3;

function psfToScore(psf: number | null): { score: number; band: string } {
  if (psf === null) return { score: 50, band: "no_data" };
  if (psf < 2000)   return { score: 100, band: "<$2k PSF" };
  if (psf < 4000)   return { score: 75,  band: "$2k–$4k PSF" };
  if (psf < 7000)   return { score: 40,  band: "$4k–$7k PSF" };
  return               { score: 10,  band: ">$7k PSF" };
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

async function scoreRental(params: {
  lat: number;
  lng: number;
  radius_meters?: number;
  years_back?: number;
}) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const radius    = params.radius_meters ?? DEFAULT_RADIUS_METERS;
  const yearsBack = params.years_back    ?? DEFAULT_YEARS_BACK;

  const { data, error } = await supabase.rpc("median_psf_nearby", {
    center_lat: params.lat,
    center_lng: params.lng,
    radius_m:   radius,
    years_back: yearsBack,
  });

  if (error) {
    throw new Error(`median_psf_nearby RPC failed: ${error.message}`);
  }

  const medianPsf = data !== null && data !== undefined ? Number(data) : null;
  const { score, band } = psfToScore(medianPsf);

  return {
    score,
    median_psf: medianPsf,
    psf_band: band,
    radius_meters: radius,
    years_back: yearsBack,
    transaction_area: medianPsf !== null ? "nearby" : "no_data",
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
      years_back?: number;
    };

    if (typeof payload.lat !== "number" || typeof payload.lng !== "number") {
      return jsonResponse({ error: "'lat' and 'lng' must be numbers." }, 400);
    }

    const result = await scoreRental({
      lat: payload.lat,
      lng: payload.lng,
      radius_meters: payload.radius_meters,
      years_back: payload.years_back,
    });

    return jsonResponse(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
