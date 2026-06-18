import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, planFromPriceId } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET!;
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "no signature" }, { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    return NextResponse.json(
      { error: `Bad signature: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // idempotency
  const { data: existing } = await admin
    .from("webhook_events" as never)
    .select("id")
    .eq("id", event.id)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, dedup: true });
  await admin.from("webhook_events" as never).insert({
    id: event.id,
    provider: "stripe",
    type: event.type,
    payload: event as never,
  });

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId =
        (sub.metadata?.supabase_user_id as string | undefined) ??
        (await resolveUserByCustomer(admin, sub.customer as string));
      if (!userId) break;

      const priceId = sub.items.data[0]?.price.id ?? null;
      const plan = sub.status === "canceled" ? "free" : planFromPriceId(priceId);

      await admin.from("subscriptions").upsert(
        {
          user_id: userId,
          stripe_customer_id: sub.customer as string,
          stripe_subscription_id: sub.id,
          stripe_price_id: priceId,
          plan,
          status: sub.status as never,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          cancel_at_period_end: sub.cancel_at_period_end,
        },
        { onConflict: "user_id" },
      );

      await admin.from("profiles").update({ plan }).eq("id", userId);
      break;
    }
    case "checkout.session.completed": {
      // No-op — the subscription.created event handles plan assignment.
      break;
    }
  }

  return NextResponse.json({ ok: true });
}

async function resolveUserByCustomer(
  admin: ReturnType<typeof createAdminClient>,
  customerId: string,
) {
  const { data } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.user_id ?? null;
}
