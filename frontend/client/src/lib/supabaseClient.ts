import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function createMissingConfigError() {
  return {
    message: "Supabase auth is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable login and registration.",
  };
}

const fallbackSupabase = {
  auth: {
    async getSession() {
      return { data: { session: null }, error: null };
    },
    onAuthStateChange() {
      return {
        data: {
          subscription: {
            unsubscribe() {
              return undefined;
            },
          },
        },
      };
    },
    async signOut() {
      return { error: null };
    },
    async signInWithPassword() {
      return { data: { session: null, user: null }, error: createMissingConfigError() };
    },
    async signUp() {
      return { data: { session: null, user: null }, error: createMissingConfigError() };
    },
  },
};

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : (fallbackSupabase as any);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
