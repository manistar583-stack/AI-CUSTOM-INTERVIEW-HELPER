import { NextResponse } from "next/server";
import { getDefaultProviderId, getProviderStatuses } from "@/lib/ai";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export async function GET() {
  const providers = getProviderStatuses();
  const activeProvider = getDefaultProviderId();
  const active = providers.find((provider) => provider.id === activeProvider);
  return NextResponse.json({
    gemini: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    supabase: isSupabaseConfigured(),
    research: Boolean(process.env.TAVILY_API_KEY),
    image: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_IMAGE_MODEL),
    model: active?.model || null,
    activeProvider,
    providers,
    rateLimit: { requests: 20, windowMinutes: 10 },
  });
}