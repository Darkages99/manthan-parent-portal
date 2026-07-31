import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

// Requires NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
// (see .env.example). Supabase holds all relational data, auth and row-level
// security keyed to the guardian<->student link — see supabase/migrations/0001_init.sql.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
