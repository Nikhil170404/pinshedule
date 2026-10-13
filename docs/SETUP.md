# Setup: what the owner must add

Everything below is outside the code. Nothing here is done for you, and several features do nothing until it is.

## 1. Database (Supabase)
Run the whole of `supabase-schema.sql` in the Supabase SQL editor. It is safe to re-run. This session added:

| New objects | Needed by |
|---|---|
| `rss_feeds`, `feed_drafts` | Autopilot |
| `notifications` | Notifications page, failed-pin and expiry alerts |
| `loops`, `loop_items`, `loop_runs`, `scheduled_pins.loop_id` | SmartLoop |

Until it runs, those pages show an error and the polling jobs log warnings. Existing features are not affected.

## 2. Worker environment (Railway)
| Variable | Needed for | Required? |
|---|---|---|
| `OPENAI_API_KEY` | AI writing, Pin variations, SmartLoop rewording, assistant, embeddings | Needed for those features |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email copies of notifications. Verify your sending domain in Resend first | Optional. Without it, notifications are in-app only |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Payments | Needed to take money |
| `RAZORPAY_PLAN_STARTER_MONTHLY`, `_PRO_MONTHLY`, `_GROWTH_MONTHLY` | Monthly checkout | Create three Razorpay plans at $9, $19 and $39 per month, then paste the ids |
| `RAZORPAY_PLAN_*_YEARLY` | Annual billing | Create plans at $90, $190 and $390 per year, paste the ids, then set `YEARLY_BILLING = true` in `shared/plans.ts` |
| `RUN_JOBS=true` on exactly the service that should run background jobs | Publishing, feeds, loops, analytics | Already in use |

The existing variables (Supabase, Redis, Pinterest, `ENCRYPTION_SECRET`) are unchanged.

## 3. Pinterest
- The Pinterest app needs production ("Standard") API access before real customers can publish. While on Trial access, set `PINTEREST_API_BASE=https://api-sandbox.pinterest.com/v5`.
- Re-check Pinterest's current API terms and rate limits before promising any feature in marketing copy. This session did not test against the live API.

## 4. Check before you launch
Run through this once on a real account. None of it has been run end to end.
1. Sign in, connect Pinterest, schedule a pin two minutes ahead, and confirm it publishes.
2. Autopilot: paste your blog address, confirm drafts appear, approve one, confirm it lands on the Calendar.
3. Pin variations: paste a blog post, make 8 pins, confirm they look different and schedule.
4. SmartLoop: add 3 published pins, set 14 days, confirm nothing is proposed early; temporarily lower the interval in the database to test the approval flow.
5. Notifications: disconnect the app in Pinterest settings and confirm a reconnect notice (and email if configured).
6. Analytics: refresh, then download both CSVs.
7. Payments: complete a test-mode subscription, cancel it, and let a charge fail.

## 5. Costs to validate against the plan limits
Plans allow up to 6,000 AI text generations and 200 AI images a month on Business ($39). Work out the worst case before launch:
- AI text uses `gpt-4o-mini`. Token ceilings in code: caption options 700, page copy about 700 across three calls, variations up to 4,000 for 20 concepts.
- AI images use `gpt-image-1-mini` at low quality, 1024 x 1536.
- Look up current OpenAI prices, multiply by the limits above, and compare with each plan's price. Do this before changing any limit.

## 6. Still not built
Team seats and roles, client workspaces and approvals, branded PDF reports, the browser extension, Shopify and WordPress API connections (feeds and sitemaps work), a saved-templates library, a drag-and-drop calendar, brand kits (colors, fonts, logos), SEO Studio beyond the Pinterest Trends keyword page, AI insights on analytics, a 30-day content planner, production alerting and uptime monitoring, and landing-page screenshots.
