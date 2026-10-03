function req(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var ${name}`)
  return v
}
const opt = (name: string, fallback = '') => process.env[name] ?? fallback

export const env = {
  port: Number(opt('PORT', '8080')),
  appUrl: req('APP_URL').replace(/\/$/, ''),
  /** Extra comma-separated origins allowed by CORS (e.g. preview deployments). */
  extraOrigins: opt('CORS_ORIGINS').split(',').map((s) => s.trim()).filter(Boolean),
  supabaseUrl: req('SUPABASE_URL'),
  supabaseServiceKey: req('SUPABASE_SERVICE_ROLE_KEY'),
  redisUrl: req('UPSTASH_REDIS_REST_URL'),
  redisToken: req('UPSTASH_REDIS_REST_TOKEN'),
  encryptionSecret: req('ENCRYPTION_SECRET'),
  pinterestClientId: req('PINTEREST_CLIENT_ID'),
  pinterestClientSecret: req('PINTEREST_CLIENT_SECRET'),
  /** Use https://api-sandbox.pinterest.com/v5 while on Trial access. */
  pinterestApi: opt('PINTEREST_API_BASE', 'https://api.pinterest.com/v5').replace(/\/$/, ''),
  anthropicKey: opt('ANTHROPIC_API_KEY'),
  razorpayKeyId: opt('RAZORPAY_KEY_ID'),
  razorpayKeySecret: opt('RAZORPAY_KEY_SECRET'),
  razorpayWebhookSecret: opt('RAZORPAY_WEBHOOK_SECRET'),
  razorpayPlans: {
    starter_monthly: opt('RAZORPAY_PLAN_STARTER_MONTHLY'),
    starter_yearly: opt('RAZORPAY_PLAN_STARTER_YEARLY'),
    pro_monthly: opt('RAZORPAY_PLAN_PRO_MONTHLY'),
    pro_yearly: opt('RAZORPAY_PLAN_PRO_YEARLY'),
    growth_monthly: opt('RAZORPAY_PLAN_GROWTH_MONTHLY'),
    growth_yearly: opt('RAZORPAY_PLAN_GROWTH_YEARLY'),
  } as Record<string, string>,
  /** Set to "false" to run only the HTTP API (e.g. a second replica). */
  runJobs: opt('RUN_JOBS', 'true') !== 'false',
}
