import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getClientAddress, takeRateLimit } from "@/lib/rate-limit";
import { requireConfiguredUser } from "@/lib/supabase/server";
import { getRequestLimit, isToolEnabled } from "@/lib/usage-limits";

const imageRequestSchema = z.object({ prompt: z.string().trim().min(5).max(1500) });

export async function POST(request: Request) {
  const identity = await requireConfiguredUser();
  if (identity.configured && !identity.user) {
    return NextResponse.json({ error: "Sign in to use your connected NEXORA workspace." }, { status: 401 });
  }

  const limit = takeRateLimit(identity.user?.id || getClientAddress(request), await getRequestLimit(identity));
  if (!limit.allowed) return NextResponse.json({ error: "This session has reached the image request limit. Try again later." }, { status: 429 });

  const input = imageRequestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Enter an image prompt between 5 and 1,500 characters." }, { status: 400 });
  if (!(await isToolEnabled("image"))) {
    return NextResponse.json({ error: "Image generation is currently unavailable. Contact your workspace administrator." }, { status: 503 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_IMAGE_MODEL;
  if (!apiKey || !model) {
    return NextResponse.json({ error: "Image generation is not configured. Add GEMINI_API_KEY and a supported GEMINI_IMAGE_MODEL to .env.local." }, { status: 503 });
  }

  try {
    const client = new GoogleGenAI({ apiKey });
    const result = await client.models.generateImages({ model, prompt: input.data.prompt, config: { numberOfImages: 1 } });
    const image = result.generatedImages?.[0]?.image;
    if (!image?.imageBytes) return NextResponse.json({ error: "The image provider did not return an image." }, { status: 502 });
    return NextResponse.json({ image: `data:${image.mimeType || "image/png"};base64,${image.imageBytes}` });
  } catch {
    return NextResponse.json({ error: "Image generation failed. Verify that GEMINI_IMAGE_MODEL is available to your API project." }, { status: 502 });
  }
}