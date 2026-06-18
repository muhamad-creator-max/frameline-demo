/**
 * Plan catalog — plain data, safe to import from client OR server components.
 * (Kept separate from `stripe/client.ts`, which is `server-only` because it
 * instantiates the Stripe SDK. A client component importing PLANS from there
 * tripped Next's "server-only in the browser" guard.)
 */
export const PLANS = {
  free: { tier: "free" as const, name: "Free", limits: { guidelines: 1, monthlyResponses: 10 } },
  pro: {
    tier: "pro" as const,
    name: "Pro",
    priceMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    priceYearly: process.env.STRIPE_PRICE_PRO_YEARLY,
    limits: { guidelines: 25, monthlyResponses: 500 },
  },
  studio: {
    tier: "studio" as const,
    name: "Studio",
    priceMonthly: process.env.STRIPE_PRICE_STUDIO_MONTHLY,
    priceYearly: process.env.STRIPE_PRICE_STUDIO_YEARLY,
    limits: { guidelines: -1, monthlyResponses: -1 }, // -1 = unlimited
  },
} as const;

export type PlanTier = keyof typeof PLANS;

export function planFromPriceId(priceId: string | null | undefined): PlanTier {
  if (!priceId) return "free";
  if (priceId === PLANS.pro.priceMonthly || priceId === PLANS.pro.priceYearly) return "pro";
  if (priceId === PLANS.studio.priceMonthly || priceId === PLANS.studio.priceYearly) return "studio";
  return "free";
}
