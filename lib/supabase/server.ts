import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { createRestReadRetryFetch } from "@/lib/supabase/rest-read-retry";
import type { Database } from "@/types/database";

// Mission 204 — leituras do PostgREST com repetição única e registrada em
// caso de 401 transitório (ver lib/supabase/rest-read-retry.ts).
const restReadRetryFetch = createRestReadRetryFetch();

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: restReadRetryFetch },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Chamado a partir de um Server Component sem Server Action/Route
            // Handler na sequência. Pode ser ignorado pois o proxy.ts (raiz)
            // já é responsável por renovar a sessão em toda requisição.
          }
        },
      },
    }
  );
}
