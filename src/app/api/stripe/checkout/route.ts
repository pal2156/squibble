import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const PLAN_PRICE_IDS: Record<string, string | undefined> = {
  pro: process.env.STRIPE_PRICE_PRO ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
  max: process.env.STRIPE_PRICE_MAX ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_MAX,
};

export async function POST(request: Request) {
  const { plan } = await request.json();
  const { origin } = new URL(request.url);

  if (!plan || !["pro", "max"].includes(plan)) {
    return NextResponse.json({ error: "plan must be 'pro' or 'max'" }, { status: 400 });
  }

  const priceId = PLAN_PRICE_IDS[plan];
  if (!priceId) {
    console.error(`[stripe/checkout] price ID for plan "${plan}" is not configured`);
    return NextResponse.json({ error: "Plan price is not configured" }, { status: 500 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.error("[stripe/checkout] STRIPE_SECRET_KEY is not configured");
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stripe = new Stripe(stripeKey);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      metadata: { plan, userId: user.id },
      success_url: `${origin}/dashboard?upgraded={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[stripe/checkout] failed to create checkout session:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
