import { createClient } from "@supabase/supabase-js";
import type { MrtExit, BusStop } from "@/lib/types/database";

// Supabase client (ensure environment variables are set)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) throw new Error("Supabase env vars not set");

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Get demographic score
 */
export async function getDemographicScore(
  planningArea: string,
  selectedAgeGroups: string[],
  selectedIncomeBands: string[]
): Promise<number> {
  const { data, error } = await supabase.rpc("get_demographic_score", {
    target_area: planningArea,
    selected_age_groups: selectedAgeGroups,
    selected_income_bands: selectedIncomeBands,
  });

  if (error) throw error;
  return data ?? 0;
}