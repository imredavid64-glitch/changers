# Environment variables (names only)

`.env.example` is blocked for the AI's file tools on this Mac (a deny rule on `.env*`), so the names live here. Luke puts the values in `site/.env.local` himself; nothing here or in git ever holds a value.

| Name | Used for | Needed from |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | the Supabase project URL | R1b (foundation) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the RLS-bound client in the browser and server | R1b |
| `SUPABASE_SECRET_KEY` | server-only: upload, contact and report routes; tests; `dev:code` | R1b |
| `RESEND_API_KEY` | sign-in codes (custom SMTP) and digests | launch |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | rate limits | R4 |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | bot protection | R4 |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | error tracking | R5 |
| `APP_BASE_URL` | absolute URLs (sitemap, robots) | launch |
| `DEMO_MODE` | not a secret: `1` in review builds (set by `npm run dev` / `npm run preview`); unset in the launch build | now |
