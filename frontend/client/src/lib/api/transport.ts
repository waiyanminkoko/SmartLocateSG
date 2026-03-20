import { createClient } from "@supabase/supabase-js";
import type { MrtExit, BusStop } from "@/lib/types/database";

// Supabase client (ensure environment variables are set)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) throw new Error("Supabase env vars not set");

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Count MRT exits within a radius of a given lat/lng
 */
export async function countMrtExits(lat: number, lng: number, radiusMeters: number): Promise<number> {
  const { data, error } = await supabase
    .rpc("count_nearby_mrt_exits", { center_lat: lat, center_lng: lng, radius_m: radiusMeters });

    console.log("RPC Result:", { data, error }); // Debug log
  if (error) throw error;
  return data ?? 0;
}

/**
 * Count bus stops within a radius of a given lat/lng
 */
export async function countBusStops(lat: number, lng: number, radiusMeters: number): Promise<number> {
  const { data, error } = await supabase
    .rpc("count_nearby_bus_stops", { center_lat: lat, center_lng: lng, radius_m: radiusMeters });

  if (error) throw error;
  return data ?? 0;
}

/**
 * Get list of nearby MRT exits
 */
export async function getMrtExitsNearby(lat: number, lng: number, radiusMeters: number): Promise<MrtExit[]> {
  const { data, error } = await supabase.rpc("get_nearby_mrt_exits", { center_lat: lat, center_lng: lng, radius_m: radiusMeters });
  if (error) throw error;
  return data ?? [];
}

/**
 * Get list of nearby bus stops
 */
export async function getBusStopsNearby(
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<BusStop[]> {
  const { data, error } = await supabase.rpc("get_nearby_bus_stops", { center_lat: lat, center_lng: lng, radius_m: radiusMeters });
  if (error) throw error;
  return data ?? [];
}

/**
 * Accessibility score
 */
export async function getAccessibilityScore(
    lat: number,
    lng: number,
    radiusMeters: number
): Promise<number> {
    const { data, error } = await supabase.rpc("get_accessibility_score", { center_lat: lat, center_lng: lng, radius_m: radiusMeters });
    if (error) throw error;
    return data ?? 0;   
}