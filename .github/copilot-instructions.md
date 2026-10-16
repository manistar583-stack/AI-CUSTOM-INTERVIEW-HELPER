# NEXORA AI Workspace

- Keep Gemini and Supabase service-role credentials server-only. Never use `NEXT_PUBLIC_` for secrets.
- Keep provider-specific implementation under `src/lib/ai`; UI components should call the app API routes rather than provider SDKs.
- Validate every API input server-side with Zod. Do not log prompts, document text, credentials, or auth tokens.
- Preserve Supabase row-level security and never derive administrator access from client-controlled profile data.
- Keep unconfigured integrations visibly unavailable; do not add mock results or fake billing.
- Run `npm run lint` and `npm run build` after application changes.
