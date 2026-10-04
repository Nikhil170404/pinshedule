# GoPinKaro operations runbook

How the system fits together, how to deploy it, and what to do when something breaks. Everything here was learned from running it, not guessed.

## Architecture

| Part | Where | Job |
|---|---|---|
| Web app (`src/`) | Vercel | UI and the Pinterest sign-in redirect/callback only |
| Worker (`worker/`) | Railway | REST API, publishing queue, token refresh, analytics sync, Razorpay webhook |
| Database, auth, storage, realtime | Supabase | Source of truth |
| Queue, caches, locks, rate limits | Upstash Redis | Fast trigger for due pins; Postgres stays the truth |
| AI | OpenAI | Writing (`gpt-4o-mini`) and embeddings |
| Payments | Razorpay | Subscriptions and webhooks |

Publishing flow: pins are inserted by the database function `schedule_pins` (quota checked atomically), their ids go into the Redis set `pins:due`, the worker pops due ids every 3 seconds, claims rows with `claim_pins`, publishes through the Pinterest API, retries temporary errors, and a reconciler runs every 30 seconds to repair anything Redis lost.

## Deploy order

1. Run `supabase-schema.sql` in the Supabase SQL editor (safe to re-run).
2. Railway: set variables from `worker/.env.example`. The service must show healthy at `/health` (`{"ok":true,"redis":true,"database":true}`).
3. Vercel: set variables from `.env.example`, including `NEXT_PUBLIC_API_URL` (type **Config**, not Secret). Redeploy with the build cache off whenever a `NEXT_PUBLIC_*` value changes.
4. Pinterest app: redirect URI `https://<domain>/api/auth/pinterest/callback`.
5. Razorpay: six USD plans matching `shared/plans.ts` (amounts in cents: 900/9000, 1900/19000, 3900/39000), webhook `https://<railway-domain>/webhooks/razorpay`.

`ENCRYPTION_SECRET` must be identical on Vercel and Railway.

## Finding what happened

Every API response carries `X-Request-Id`. The worker writes one JSON log line per request (`id`, `method`, `path`, `status`, `ms`, `user`), so copy the id from the failing request in the browser DevTools and search the Railway logs for it. Errors from Pinterest, token decryption and payments are logged with their cause.

## Incidents

| Symptom | Likely cause | Fix |
|---|---|---|
| Worker crashes on start with a list of missing variables | Railway variables absent or not deployed | Add them (empty values count as missing), then deploy the staged changes |
| Dashboard errors mentioning `localhost:8080` | `NEXT_PUBLIC_API_URL` was not set at build time | Set it on Vercel, redeploy without build cache |
| "Cannot reach the server" in the dashboard | `APP_URL` on Railway does not exactly match the site origin (CORS) | Fix `APP_URL` (no trailing slash); add other origins to `CORS_ORIGINS` |
| `/v1/boards` fails, log says "token decrypt failed" | `ENCRYPTION_SECRET` differs between Vercel and Railway | Make them identical; users sign in with Pinterest again |
| Pins stay "Scheduled" past their time | Worker jobs not running, or Redis down | Check `/health`; make sure `RUN_JOBS` is not `false` on every replica; the reconciler re-queues within about 30 seconds |
| Pin "Failed" with a Pinterest message | Image not fetchable, board deleted, permission revoked | The reason is shown on the pin; fix and use Retry |
| Checkout says "not available for purchase" | The Razorpay plan does not match the price list (logged as `razorpay plan does not match price list`) | Correct amount, currency or period in Razorpay |
| Customer paid but is still on Free | Webhook failed or was not configured | Check Razorpay webhook deliveries (retries are safe); or fix by hand, below |

Fix a plan by hand (the profile cache lasts 60 seconds):

```sql
update public.user_profiles
   set plan = 'pro', plan_status = 'active', plan_expires_at = now() + interval '1 month'
 where id = '<user uuid>';
```

## Secrets

- Rotate `ENCRYPTION_SECRET`: every stored Pinterest token becomes unreadable; users reconnect once. Do it in both services at the same time.
- Rotate the Pinterest app secret in both services together.
- Never put a service-role key, Razorpay key or OpenAI key in a `NEXT_PUBLIC_*` variable.

## Data requests

- **Export:** users can download their data in Settings, under Your data.
- **Deletion:** users delete their own account in Settings. It removes pins, uploaded images, analytics, usage and the Pinterest connection, and cancels the subscription at the end of the period.

## Costs and limits to watch

- Railway and Supabase compute, Upstash commands, OpenAI usage.
- OpenAI cost is bounded by the per-plan AI allowance and by per-message caps (5 model steps, 10 tool calls).
- Pinterest API rate limits: temporary 429 responses are retried with backoff.

## Before announcing a change that touches money or publishing

1. Make a real test purchase of the cheapest plan and cancel it.
2. Schedule a pin two minutes ahead and watch it publish.
3. Watch the Railway logs for the first day.
