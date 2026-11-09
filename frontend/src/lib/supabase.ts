import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://hqtnzmisjjfqsdwclcak.supabase.co";

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxdG56bWlzampmcXNkd2NsY2FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyMzQ2OTQsImV4cCI6MjEwNzgxMDY5NH0.35N10RAtI1lKi5g-MAKZzDQAXm21VRyhiQiQ6ZTCaKA";

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith("https://") &&
  supabaseUrl.includes(".supabase.co")
);

// If configured, use real Supabase client; otherwise create an uninitialized client
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : (null as unknown as SupabaseClient);

export const ADMIN_EMAIL = "arnavraut4567@gmail.com";

