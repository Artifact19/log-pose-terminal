import { createClient, SupabaseClient } from "@supabase/supabase-js";

let rawUrl = (
  import.meta.env.VITE_SUPABASE_URL ||
  "https://hqtnzmisjjfqsdwclcak.supabase.co"
).trim();

// Defensive check: If user accidentally pasted postgresql:// connection pooler
if (rawUrl.startsWith("postgresql://") || rawUrl.startsWith("postgres://")) {
  console.warn(
    "[Log Pose] VITE_SUPABASE_URL was configured with a postgresql:// pooler URL. Supabase JS SDK requires an HTTPS API URL. Falling back to default project URL."
  );
  rawUrl = "https://hqtnzmisjjfqsdwclcak.supabase.co";
}

const supabaseUrl = rawUrl;
const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxdG56bWlzampmcXNkd2NsY2FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyMzQ2OTQsImV4cCI6MjEwNzgxMDY5NH0.35N10RAtI1lKi5g-MAKZzDQAXm21VRyhiQiQ6ZTCaKA"
).trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith("https://") &&
  supabaseUrl.includes(".supabase.co")
);

// Safely initialize Supabase client with try/catch to prevent module-level crash
function initSupabase(): SupabaseClient {
  if (isSupabaseConfigured) {
    try {
      return createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
    } catch (err) {
      console.error("[Log Pose] Failed to initialize Supabase client:", err);
    }
  }
  return null as unknown as SupabaseClient;
}

export const supabase: SupabaseClient = initSupabase();

export const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || "").trim();

