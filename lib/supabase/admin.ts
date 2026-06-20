import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client (bypasses RLS). Returns null when
 * SUPABASE_SERVICE_ROLE_KEY is not configured, so callers can fall back to the
 * authenticated cookie client.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
