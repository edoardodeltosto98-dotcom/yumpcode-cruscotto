import "server-only";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/**
 * Client Supabase da usare in Server Component, Server Action e Route Handler.
 * Legge il token della sessione Clerk lato server e lo inoltra a Supabase,
 * cosi' le policy RLS restano scoped alla organizzazione (org_id) corrente.
 */
export async function createServerSupabaseClient() {
  const { getToken } = await auth();

  return createClient(supabaseUrl, supabasePublishableKey, {
    async accessToken() {
      return (await getToken()) ?? null;
    },
  });
}
