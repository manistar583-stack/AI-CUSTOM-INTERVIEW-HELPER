import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function createSupabaseServerClient() {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Route handlers can update auth cookies; server components cannot.
          }
        },
      },
    },
  );
}

export async function requireConfiguredUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { configured: false as const, supabase: null, user: null };

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { configured: true as const, supabase, user: null };
  return { configured: true as const, supabase, user: data.user };
}