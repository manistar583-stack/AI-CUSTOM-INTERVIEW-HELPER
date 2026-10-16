import { createClient } from "@supabase/supabase-js";
import type { requireConfiguredUser } from "@/lib/supabase/server";

type Identity = Awaited<ReturnType<typeof requireConfiguredUser>>;
type Plan = "free" | "pro" | "premium";

const fallbackLimits: Record<Plan, number> = {
  free: Number(process.env.USAGE_LIMIT_FREE || 20),
  pro: Number(process.env.USAGE_LIMIT_PRO || 500),
  premium: Number(process.env.USAGE_LIMIT_PREMIUM || 2500),
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
}

export async function getRequestLimit(identity: Identity) {
  let plan: Plan = "free";
  if (identity.user && identity.supabase) {
    const { data } = await identity.supabase
      .from("subscriptions")
      .select("plan")
      .eq("owner_id", identity.user.id)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.plan === "pro" || data?.plan === "premium") plan = data.plan;
  }

  const fallback = fallbackLimits[plan];
  const service = adminClient();
  if (!service) return Number.isInteger(fallback) && fallback > 0 ? fallback : 20;

  const { data } = await service.from("platform_settings").select("value").eq("key", `usage_limit_${plan}`).maybeSingle();
  const configured = Number(data?.value);
  return Number.isInteger(configured) && configured > 0 ? configured : fallback;
}

export async function isToolEnabled(tool: string) {
  const service = adminClient();
  if (!service) return true;
  const { data, error } = await service.from("platform_settings").select("value").eq("key", `tool_enabled_${tool}`).maybeSingle();
  return !error && data?.value !== false;
}