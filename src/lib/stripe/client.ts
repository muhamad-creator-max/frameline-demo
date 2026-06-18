import "server-only";
import Stripe from "stripe";

// Plan catalog lives in a client-safe module; re-exported here so existing
// server-side imports from "@/lib/stripe/client" keep working unchanged.
export { PLANS, planFromPriceId, type PlanTier } from "./plans";

let _stripe: Stripe | null = null;

export function getStripe() {
  if (_stripe) return _stripe;
  _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2024-12-18.acacia",
    typescript: true,
  });
  return _stripe;
}
