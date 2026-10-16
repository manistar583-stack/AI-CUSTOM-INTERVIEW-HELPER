import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireConfiguredUser } from "@/lib/supabase/server";

function isAllowlistedAdmin(email?: string) {
  const allowlist = (process.env.ADMIN_EMAIL_ALLOWLIST || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(email && allowlist.includes(email.toLowerCase()));
}

async function getAdminService() {
  const identity = await requireConfiguredUser();
  if (!identity.configured || !identity.supabase) {
    return { response: NextResponse.json({ error: "Authentication is not configured." }, { status: 503 }) };
  }
  if (!identity.user) {
    return { response: NextResponse.json({ error: "Sign in to continue." }, { status: 401 }) };
  }
  if (!isAllowlistedAdmin(identity.user.email)) {
    return { response: NextResponse.json({ error: "Administrator access is not enabled for this account." }, { status: 403 }) };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return { response: NextResponse.json({ error: "Admin operations require server-side SUPABASE_SERVICE_ROLE_KEY configuration." }, { status: 503 }) };
  }

  return { service: createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) };
}

export async function GET() {
  const access = await getAdminService();
  if (access.response) return access.response;
  const service = access.service!;

  const [usersResult, conversations, prompts, projects, usage, recentErrors, subscriptions, settings] = await Promise.all([
    service.auth.admin.listUsers({ page: 1, perPage: 50 }),
    service.from("conversations").select("id", { count: "exact", head: true }),
    service.from("saved_prompts").select("id", { count: "exact", head: true }),
    service.from("projects").select("id", { count: "exact", head: true }),
    service.from("usage_records").select("id", { count: "exact", head: true }),
    service.from("usage_records").select("id,tool,created_at").eq("status", "error").order("created_at", { ascending: false }).limit(20),
    service.from("subscriptions").select("id,status,plan,owner_id,updated_at").order("updated_at", { ascending: false }).limit(100),
    service.from("platform_settings").select("key,value,updated_at").order("key"),
  ]);

  if (usersResult.error) return NextResponse.json({ error: "Could not load users from Supabase Auth." }, { status: 502 });
  if (subscriptions.error || settings.error || recentErrors.error) {
    return NextResponse.json({ error: "Apply supabase/schema.sql before loading administrative data." }, { status: 503 });
  }

  return NextResponse.json({
    users: usersResult.data.users.map((user) => ({
      id: user.id,
      email: user.email || "No email",
      createdAt: user.created_at,
      disabled: Boolean(user.banned_until && new Date(user.banned_until) > new Date()),
    })),
    usage: {
      conversations: conversations.count || 0,
      prompts: prompts.count || 0,
      projects: projects.count || 0,
      requests: usage.count || 0,
      errors: recentErrors.data.length,
    },
    recentErrors: recentErrors.data,
    subscriptions: subscriptions.data,
    settings: settings.data,
  });
}

const adminActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("user_status"), userId: z.string().uuid(), disabled: z.boolean() }),
  z.object({ action: z.literal("usage_limit"), plan: z.enum(["free", "pro", "premium"]), limit: z.number().int().min(1).max(100000) }),
  z.object({ action: z.literal("tool_status"), tool: z.enum(["chat", "writing", "coding", "documents", "summarizer", "translation", "research", "image"]), enabled: z.boolean() }),
]);

export async function PATCH(request: Request) {
  const access = await getAdminService();
  if (access.response) return access.response;
  const input = adminActionSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Invalid administrative action." }, { status: 400 });
  const service = access.service!;

  if (input.data.action === "user_status") {
    const { error } = await service.auth.admin.updateUserById(input.data.userId, {
      ban_duration: input.data.disabled ? "876000h" : "none",
    });
    if (error) return NextResponse.json({ error: "Supabase could not update this account." }, { status: 502 });
  } else {
    const key = input.data.action === "usage_limit"
      ? `usage_limit_${input.data.plan}`
      : `tool_enabled_${input.data.tool}`;
    const value = input.data.action === "usage_limit" ? input.data.limit : input.data.enabled;
    const { error } = await service.from("platform_settings").upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: "Could not save this setting. Apply supabase/schema.sql first." }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}