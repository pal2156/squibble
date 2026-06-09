import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const PACK_CREDITS: Record<string, { searches: number; emails: number }> = {
  pro: { searches: 30, emails: 30 },
  max: { searches: 75, emails: 75 },
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "session_id is required" }, { status: 400 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stripe = new Stripe(stripeKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json({ synced: false });
    }

    const rawPlan = session.metadata?.plan;
    const plan = rawPlan?.toLowerCase();
    if (!plan || !["pro", "max"].includes(plan)) {
      return NextResponse.json({ synced: false });
    }

    const sessionUserId = session.metadata?.userId ?? session.client_reference_id;
    if (sessionUserId !== user.id) {
      return NextResponse.json({ error: "Session does not belong to this user" }, { status: 403 });
    }

    const pack = PACK_CREDITS[plan];
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const customerId = typeof session.customer === "string" ? session.customer : null;
    if (customerId) {
      await serviceSupabase
        .from("users")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    const { data: applied, error } = await serviceSupabase.rpc("apply_purchase", {
      p_session_id: session.id,
      p_user_id: user.id,
      p_plan: plan,
      p_searches: pack.searches,
      p_emails: pack.emails,
    });

    if (error) {
      console.error("[stripe/verify-session] failed to apply purchase:", error);
    } else if (applied) {
      console.log(`[stripe/verify-session] credited ${pack.searches} searches / ${pack.emails} emails to user ${user.id} (pack: ${plan})`);
    } else {
      console.log(`[stripe/verify-session] session ${session.id} already processed by webhook`);
    }

    return NextResponse.json({ synced: true, plan, credits_applied: applied ?? false });
  } catch (err) {
    console.error("[stripe/verify-session] error:", err);
    return NextResponse.json({ error: "Failed to verify session" }, { status: 500 });
  }
}
