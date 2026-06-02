import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.error("[stripe/webhook] missing signature or webhook secret");
    return NextResponse.json({ error: "Missing webhook configuration" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe/webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId ?? session.client_reference_id;
    const rawPlan = session.metadata?.plan;
    const plan = rawPlan?.toLowerCase() as "pro" | "max" | undefined;
    const customerId = typeof session.customer === "string" ? session.customer : null;

    if (!userId || !plan || !["pro", "max"].includes(plan)) {
      console.error("[stripe/webhook] missing user ID or invalid plan:", { userId, rawPlan, plan });
      return NextResponse.json({ received: true });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const updateData: Record<string, unknown> = { plan };
    if (customerId) updateData.stripe_customer_id = customerId;

    const { error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", userId);

    if (error) {
      console.error("[stripe/webhook] failed to update user plan:", error);
      return NextResponse.json({ error: "Database update failed" }, { status: 500 });
    }

    console.log(`[stripe/webhook] upgraded user ${userId} to ${plan}`);
  }

  return NextResponse.json({ received: true });
}
