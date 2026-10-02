"use client";

import { useMemo } from "react";
import { useSession } from "@clerk/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/**
 * Client Supabase da usare nei Client Component.
 * Passa ad ogni richiesta il token della sessione Clerk attiva, cosi'
 * `auth.jwt() ->> 'org_id'` nelle policy RLS vede l'organizzazione corrente
 * (integrazione Clerk configurata come Third-Party Auth su Supabase).
 */
export function useSupabaseClient(): SupabaseClient {
  const { session } = useSession();

  return useMemo(
    () =>
      createClient(supabaseUrl, supabasePublishableKey, {
        async accessToken() {
          return (await session?.getToken()) ?? null;
        },
      }),
    [session],
  );
}
