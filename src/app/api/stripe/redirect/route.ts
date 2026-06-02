import { NextResponse } from "next/server";
import Stripe from "stripe";

const PRICE_IDS: Record<string, string> = {
  pro: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? "price_1Tdd5F2fASOksRg20N4gCDgC",
  max: process.env.NEXT_PUBLIC_STRIPE_PRICE_MAX ?? "price_1Tdd5k2fASOksRg2Z9WHMbkG",
};

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const plan = searchParams.get("plan");
  const priceId = plan ? PRICE_IDS[plan] : null;

  if (!priceId) {
    return NextResponse.redirect(`${origin}/pricing`);
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?payment=success`,
      cancel_url: `${origin}/dashboard`,
    });

    if (!session.url) {
      return NextResponse.redirect(`${origin}/pricing`);
    }

    return NextResponse.redirect(session.url);
  } catch (err) {
    console.error("[stripe/redirect] failed to create checkout session:", err);
    return NextResponse.redirect(`${origin}/pricing`);
  }
}
