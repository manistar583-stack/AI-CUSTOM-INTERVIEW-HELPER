# NEXORA AI

NEXORA is a chat-first AI workspace built with Next.js App Router, React, TypeScript, and Tailwind CSS. The server-only Gemini adapter streams chat responses. Writing, coding, document Q&A, summarization, translation, web research, and image generation use separate tool modes. Missing integrations return setup errors rather than sample results.

## Run locally

Requirements: Node.js 20 or newer and npm.

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. The starter config selects `gemini-3.8-flash`, currently listed as free-tier eligible by Google; free usage has limits and is subject to Google's terms and data-use policy. Get an API key in Google AI Studio and set `GEMINI_API_KEY` in `.env.local`, then restart the server. Keep `GEMINI_MODEL` overrideable for models enabled on your project. The optional image tool also needs a currently supported `GEMINI_IMAGE_MODEL` available to the same API project and may not be free-tier eligible.

## Integrations

- **Gemini:** Keep `GEMINI_API_KEY` server-only. `GEMINI_MODEL` is required and configurable. Chat streams through the official `@google/genai` SDK.
- **OpenRouter free models:** Set `OPENROUTER_API_KEY` to enable the official OpenRouter SDK. `OPENROUTER_MODEL` defaults to `openrouter/free`, which routes to a currently available free model; override it with a catalog model ID if desired. OpenRouter currently documents 50 free-model requests/day without purchased credits (higher quotas require credits); provider availability, model limits, and terms may change. Free does not mean unlimited or guaranteed uptime. Add the key from OpenRouter's account settings and keep it server-only.
- **Web research:** Set `TAVILY_API_KEY` to enable the Research tool. Search results and source URLs are passed to Gemini and returned to the UI. No search results are fabricated.
- **Supabase:** Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then apply `supabase/schema.sql` in the Supabase SQL editor. Auth supports email signup, login, logout, and reset links. When Supabase is configured, chat requests require an authenticated user; without it, conversations remain local to the current browser profile.
- **Admin:** Set `ADMIN_EMAIL_ALLOWLIST` to comma-separated trusted account emails and set `SUPABASE_SERVICE_ROLE_KEY` only in the server environment. The admin API verifies the signed-in user and allowlist before using the service-role client. Never expose that key with a `NEXT_PUBLIC_` prefix.
- **Payments:** Payment processing is not configured. Pricing is informational and no purchase or subscription is implied. Subscription rows must be maintained by a provider webhook that verifies signatures before updating records.

## Data and security

Chat, prompt, and project data is saved in account-separated browser storage. Signed-in users also sync conversations, prompts, and projects through Supabase; row-level security policies restrict reads and writes to their owner. Uploaded `.txt`, `.md`, and `.csv` files are read in-browser, limited to 2 MB, and their text is sent with the next document question. Files are not retained in Supabase Storage. For durable file storage, add a private bucket with owner-scoped policies and short-lived signed URLs before enabling it.

The API validates message schemas and sizes, rate-limits by authenticated user or forwarded client IP, and logs only request tool/provider/status metadata for authenticated users. The in-memory limiter is per-process and resets on restart; upstream providers also enforce their own plan limits. Use a shared store (for example, Redis) and trusted proxy IP configuration before horizontal/serverless production deployment. Configure limits with `USAGE_LIMIT_FREE`, `USAGE_LIMIT_PRO`, and `USAGE_LIMIT_PREMIUM`; the protected admin settings table can override them. Admin tool-disable settings are enforced on requests. Prompts and API credentials are not written to usage logs.

## Checks

```powershell
npm run lint
npm run build
```

Without credentials, `/api/status` reports integrations as unavailable and `/api/chat` returns a setup error. With credentials, submit a chat prompt and verify streamed output plus saved conversation history. Apply the Supabase schema to test account isolation, cloud sync, and admin workflows.

## Deploy

Deploy the Next.js app to a Node.js hosting provider such as Vercel. Configure environment variables in the provider's server-side settings, apply the Supabase schema, and add the production callback URL to Supabase Auth's redirect allowlist. Use HTTPS, rotate credentials if exposed, configure a shared rate-limit store for multiple instances, and configure signed payment webhooks before offering paid plans. Build with `npm run build` and run with `npm start` when deploying to a Node server.
