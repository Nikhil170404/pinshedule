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

## AI and vector search

- **Model:** OpenAI `gpt-4o-mini` for writing, `text-embedding-3-small` for vectors (`OPENAI_API_KEY` on Railway).
- **Focused prompts, not one big context:** titles, description and alt text are three small parallel calls with strict JSON schemas; scraped page text is fenced as data so injected instructions are ignored. Page copy is cached in Redis for a day.
- **Vectors (pgvector):** each scheduled pin is embedded and stored in `pin_embeddings` (HNSW index). The New pin screen warns about near-duplicates (`/v1/ai/similar`) and suggests the best-matching boards (`/v1/ai/suggest-board`). Embeddings are cached in Redis, so identical text is never embedded twice.

## Assistant (chat that operates the app)

Open it from any dashboard page (button or Ctrl/Cmd+K) or at `/dashboard/assistant`. It uses OpenAI tool calling (`gpt-4o-mini`) over 18 tools in `worker/src/lib/assistant-tools.ts`.

- **Read tools run immediately:** account and usage, boards, pins, queue stats, analytics, trending keywords, page import, copywriting, similar-pin search, board suggestions, best times.
- **Write tools only propose.** Scheduling (single or bulk, fixed interval or best times), editing, deleting, retrying, creating boards and changing the timezone each produce a confirmation card. Nothing executes until the user clicks Confirm, which calls `POST /v1/assistant/execute` with a single-use, user-bound, 15-minute proposal id. Injected text on a scraped page therefore cannot change anything.
- **Same rules as the UI:** the assistant calls the same service layer (`pin-service.ts`) as the REST API, so plan limits, quotas, validation and the atomic quota RPC all apply.
- **Cost control:** one user message = one AI action, however many tools it uses. The system prompt and tool list are byte-identical on every call so OpenAI's prompt cache discounts them; per-turn context is only the last 12 messages plus a one-line account summary; tool outputs are capped; at most 5 model steps and 10 tool calls per message.

## Deploy

### 1. Supabase
Run `supabase-schema.sql` in the SQL editor (safe to re-run; it is the files in `supabase/migrations/` joined in order, and existing projects only need the migrations they have not run). Users are created by the OAuth callback using the service role, so no email provider setup is needed.

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
