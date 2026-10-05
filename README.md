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

## Accounts, formats and timing

- **Many Pinterest accounts, one dashboard.** A login is a workspace that owns Pinterest connections (plan limits in `shared/plans.ts`: Free 1, Starter 3, Pro 10, Business 100). The sidebar switcher picks the active account; the browser sends it as `X-Account-Id` and the worker checks it belongs to the login. Boards, queue, calendar, analytics, duplicate checks and best times are per account; the monthly pin allowance is pooled. The Accounts page lists every account with its queue numbers and flags the ones that need attention. Sign-in is decided only by the Pinterest account that created the login, so connecting a client's account to a workspace never lets that client into it.
- **Image, video and carousel pins.** Videos are uploaded to the `pin-videos` bucket, then the worker registers them with Pinterest, uploads the file, waits for processing and creates the pin; a video still processing is retried every ~90 seconds without re-uploading. Carousels send 2 to 5 images. Bulk upload and the assistant handle image pins only.
- **Pin designer.** Four canvas templates drawn in the browser (1000x1500), optional photo, optional AI background, and "design each pin automatically" when importing a web page (the page photo is fetched through the worker so the canvas stays clean).
- **Best times.** General evening and afternoon hours until an account has about 30 published pins with results, then hours are ranked from that account's own results with shrinkage (`shared/best-times.ts`). Pinterest only reports daily totals, so this is a cautious nudge, not hourly audience data.

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
Run `supabase-schema.sql` in the SQL editor (safe to re-run). **Run it before deploying a new version**: it adds the multi-account columns (existing pins and analytics are attached to the login's current account), the `account_stats` and `timing_samples` functions and the `pin-videos` bucket. The bucket allows 50 MB per video; to allow more, raise the limit there and in the project's Storage settings. Users are created by the OAuth callback using the service role, so no email provider setup is needed.

### 2. Railway
Create a service from this repo. `railway.json` points at `worker/Dockerfile` (build context is the repo root). Set the variables in `worker/.env.example`. Health check: `/health`. You can run several replicas; set `RUN_JOBS=false` on any replica that should only serve HTTP.

### 3. Vercel
Import the repo, set the variables in `.env.example` (`NEXT_PUBLIC_API_URL` = the Railway URL). `vercel.json` has no crons.

### 4. Pinterest app
Redirect URI: `https://<vercel-domain>/api/auth/pinterest/callback`. Scopes: `user_accounts:read, boards:read, boards:write, pins:read, pins:write`. Use `PINTEREST_API_BASE=https://api-sandbox.pinterest.com/v5` until Standard access is active.

### 5. Razorpay
Create six subscription plans (USD) matching `shared/plans.ts` (Starter 9/90, Pro 19/190, Business 39/390 monthly/yearly) and put their ids in the `RAZORPAY_PLAN_*` variables. Webhook URL: `https://<railway-domain>/webhooks/razorpay` with events `subscription.activated, charged, cancelled, completed, halted, pending, resumed`.

## Tests

```bash
npm test --prefix worker                 # unit tests, no services needed
npm run test:integration --prefix worker # real Postgres + PostgREST in Docker, fake Pinterest and Redis
```

The integration suite covers multi-account publishing, video upload and processing, carousels, account isolation, analytics, personalised timing and the schema.

## Local development

```bash
npm install && (cd worker && npm install)
cp .env.example .env.local            # frontend
cp worker/.env.example worker/.env    # worker
npm run dev                           # http://localhost:3000
npm run dev --prefix worker           # http://localhost:8080
```
