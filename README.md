# Pinshedule

Pinterest scheduler. Two deployables:

| Part | Where | What it does |
|---|---|---|
| `src/` Next.js 16 app | **Vercel** | UI only, plus the Pinterest OAuth redirect/callback |
| `worker/` Hono + Node service | **Railway** | REST API, publishing queue, token refresh, analytics sync, Razorpay webhook |
| Supabase | managed | Postgres (auth, data, Realtime), Storage |
| Upstash Redis | managed | Due-pin queue (sorted set), caching, rate limits, locks |

`shared/` holds code used by both (plan limits, token encryption, slot generation).

## How scheduling works (no cron)

1. The browser calls `POST /v1/pins/schedule` on Railway. One Postgres function inserts all pins and checks the monthly quota atomically.
2. Each pin id is added to the Redis sorted set `pins:due` with its publish time as the score.
3. The worker polls that set every 3 seconds, pops due ids (`ZREM` makes the pop exclusive across replicas), claims rows with a single `UPDATE ... RETURNING`, and publishes through the Pinterest API.
4. Temporary failures (429, 5xx, network) retry with backoff; permanent ones are marked failed with the reason.
5. A reconciler (every 30s, leader-locked) re-queues anything Redis lost and recovers pins stuck in `processing`, so Postgres stays the source of truth.
6. Status changes reach the dashboard instantly through Supabase Realtime.

## Deploy

### 1. Supabase
Run `supabase-schema.sql` in the SQL editor (safe to re-run). Users are created by the OAuth callback using the service role, so no email provider setup is needed.

### 2. Railway
Create a service from this repo. `railway.json` points at `worker/Dockerfile` (build context is the repo root). Set the variables in `worker/.env.example`. Health check: `/health`. You can run several replicas; set `RUN_JOBS=false` on any replica that should only serve HTTP.

### 3. Vercel
Import the repo, set the variables in `.env.example` (`NEXT_PUBLIC_API_URL` = the Railway URL). `vercel.json` has no crons.

### 4. Pinterest app
Redirect URI: `https://<vercel-domain>/api/auth/pinterest/callback`. Scopes: `user_accounts:read, boards:read, boards:write, pins:read, pins:write`. Use `PINTEREST_API_BASE=https://api-sandbox.pinterest.com/v5` until Standard access is active.

### 5. Razorpay
Create six subscription plans (USD) matching `shared/plans.ts` (Starter 9/90, Pro 19/190, Business 39/390 monthly/yearly) and put their ids in the `RAZORPAY_PLAN_*` variables. Webhook URL: `https://<railway-domain>/webhooks/razorpay` with events `subscription.activated, charged, cancelled, completed, halted, pending, resumed`.

## Local development

```bash
npm install && (cd worker && npm install)
cp .env.example .env.local            # frontend
cp worker/.env.example worker/.env    # worker
npm run dev                           # http://localhost:3000
npm run dev --prefix worker           # http://localhost:8080
```
