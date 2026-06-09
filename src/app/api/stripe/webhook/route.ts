import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const PACK_CREDITS: Record<string, { searches: number; emails: number }> = {
  pro: { searches: 30, emails: 30 },
  max: { searches: 75, emails: 75 },
};

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
    const pack = rawPlan ? PACK_CREDITS[rawPlan.toLowerCase()] : undefined;
    const customerId = typeof session.customer === "string" ? session.customer : null;

    if (!userId || !pack) {
      console.error("[stripe/webhook] missing user ID or unrecognised pack:", { userId, rawPlan });
      return NextResponse.json({ received: true });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (customerId) {
      await supabase.from("users").update({ stripe_customer_id: customerId }).eq("id", userId);
    }

    const { data: applied, error } = await supabase.rpc("apply_purchase", {
      p_session_id: session.id,
      p_user_id: userId,
      p_plan: rawPlan!.toLowerCase(),
      p_searches: pack.searches,
      p_emails: pack.emails,
    });

    if (error) {
      console.error("[stripe/webhook] failed to apply purchase:", error);
      return NextResponse.json({ error: "Database update failed" }, { status: 500 });
    }

    if (applied) {
      console.log(`[stripe/webhook] credited ${pack.searches} searches / ${pack.emails} emails to user ${userId} (pack: ${rawPlan})`);
    } else {
      console.log(`[stripe/webhook] session ${session.id} already processed, skipping`);
    }
  }

  return NextResponse.json({ received: true });
}
