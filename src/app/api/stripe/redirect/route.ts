import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const PRICE_IDS: Record<string, string | undefined> = {
  pro: process.env.STRIPE_PRICE_PRO ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
  max: process.env.STRIPE_PRICE_MAX ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_MAX,
};

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const plan = searchParams.get("plan") as "pro" | "max" | null;
  const priceId = plan ? PRICE_IDS[plan] : null;

  console.log("[stripe/redirect] hit — plan:", plan, "priceId:", priceId);

  if (!plan || !priceId) {
    console.error(
      `[stripe/redirect] plan="${plan}" has no configured price ID.`,
      `STRIPE_PRICE_PRO="${process.env.STRIPE_PRICE_PRO}"`,
      `NEXT_PUBLIC_STRIPE_PRICE_PRO="${process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO}"`,
      `STRIPE_PRICE_MAX="${process.env.STRIPE_PRICE_MAX}"`,
      `NEXT_PUBLIC_STRIPE_PRICE_MAX="${process.env.NEXT_PUBLIC_STRIPE_PRICE_MAX}"`,
    );
    return NextResponse.redirect(`${origin}/dashboard?checkout_error=config`);
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("[stripe/redirect] STRIPE_SECRET_KEY is not set — cannot create Stripe session");
    return NextResponse.redirect(`${origin}/dashboard?checkout_error=config`);
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?upgraded={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard`,
      metadata: { plan },
    };

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      sessionParams.client_reference_id = user.id;
      sessionParams.metadata = { plan, userId: user.id };

      const { data: userData } = await supabase
        .from("users")
        .select("email, stripe_customer_id")
        .eq("id", user.id)
        .single();

      if (userData?.stripe_customer_id) {
        sessionParams.customer = userData.stripe_customer_id;
      } else if (userData?.email) {
        sessionParams.customer_email = userData.email;
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      console.error("[stripe/redirect] Stripe returned a session with no URL");
      return NextResponse.redirect(`${origin}/dashboard?checkout_error=session`);
    }

    return NextResponse.redirect(session.url);
  } catch (err) {
    console.error("[stripe/redirect] failed to create checkout session:", err);
    return NextResponse.redirect(`${origin}/dashboard?checkout_error=payment`);
  }
}
