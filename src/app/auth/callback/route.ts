import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getGmailClient } from "@/lib/gmail";

export async function GET(request: Request) {
  console.log("[auth/callback] GET hit:", request.url);
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const googleError = searchParams.get("error");

  // Determine post-auth destination.
  // Prefer ?plan= embedded in the redirect URL; fall back to the cookie
  // set before OAuth in case Supabase strips query params from redirectTo.
  const urlPlan = searchParams.get("plan");
  const cookieStore = await cookies();
  const cookiePlan = cookieStore.get("squibble_plan_intent")?.value;
  const plan = (urlPlan === "pro" || urlPlan === "max") ? urlPlan
             : (cookiePlan === "pro" || cookiePlan === "max") ? cookiePlan
             : null;
  const planSource = (urlPlan === "pro" || urlPlan === "max") ? "url" : (cookiePlan === "pro" || cookiePlan === "max") ? "cookie" : "none";
  const next = plan ? `/api/stripe/redirect?plan=${plan}` : "/dashboard";
  console.log("[auth/callback] plan detection — urlPlan:", urlPlan, "cookiePlan:", cookiePlan, "resolved:", plan, "source:", planSource, "next:", next);

  console.log("[auth/callback] incoming params:", {
    hasCode: !!code,
    googleError,
    origin,
    next,
    fullUrl: request.url,
  });

  if (!code) {
    console.error("[auth/callback] no code in URL — Google may have returned an error:", {
      googleError,
      errorDescription: searchParams.get("error_description"),
    });
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[auth/callback] exchangeCodeForSession failed:", {
        message: error.message,
        status: error.status,
        name: error.name,
      });
      return NextResponse.redirect(`${origin}/?error=auth_failed`);
    }

    if (!data.session) {
      console.error("[auth/callback] exchangeCodeForSession returned no session and no error — unexpected state");
      return NextResponse.redirect(`${origin}/?error=auth_failed`);
    }

    console.log("[auth/callback] session established for user:", data.session.user.id);

    // Store access token + refresh token for server-side Gmail API calls
    const updates: Record<string, string | null> = {};
    if (data.session.provider_token) {
      updates.gmail_token = data.session.provider_token;
    }
    if (data.session.provider_refresh_token) {
      updates.gmail_refresh_token = data.session.provider_refresh_token;
    }

    if (Object.keys(updates).length > 0) {
      const { error: dbError } = await supabase
        .from("users")
        .update(updates)
        .eq("id", data.session.user.id);
      if (dbError) {
        console.error("[auth/callback] failed to persist Gmail tokens:", dbError.message);
      }
    } else {
      console.warn("[auth/callback] no provider_token or provider_refresh_token on session — Gmail tokens not saved. Check Google OAuth scopes and that access_type=offline + prompt=consent are set.");
    }

    // Initialize plan to 'free' for new users who don't have one yet
    await supabase
      .from("users")
      .update({ plan: "free" })
      .eq("id", data.session.user.id)
      .is("plan", null);

    // Register Gmail Pub/Sub watch so we receive reply notifications.
    // We call the Gmail API directly here rather than fetching /api/gmail/watch,
    // because the new session cookie has only been queued for the response at this
    // point — it is not in the original request cookies — so an HTTP self-request
    // would always get a 401 for new users.
    const watchTopic = process.env.GMAIL_PUBSUB_TOPIC;
    if (data.session.provider_token && watchTopic) {
      try {
        const gmail = getGmailClient(
          data.session.provider_token,
          data.session.provider_refresh_token ?? null
        );
        const watchRes = await gmail.users.watch({
          userId: "me",
          requestBody: { topicName: watchTopic, labelIds: ["INBOX"] },
        });
        const historyId = watchRes.data.historyId ?? null;
        const expiration = watchRes.data.expiration ? Number(watchRes.data.expiration) : null;
        await supabase.from("gmail_watch").upsert(
          {
            user_id: data.session.user.id,
            history_id: historyId,
            expiration,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
        console.log("[auth/callback] gmail watch registered: historyId=", historyId, "expiration=", expiration);
      } catch (err) {
        console.error("[auth/callback] gmail watch registration failed:", err);
      }
    } else if (!data.session.provider_token) {
      console.warn("[auth/callback] skipping watch registration — no provider_token on session");
    }

    console.log("[auth/callback] redirecting to:", `${origin}${next}`);
    const successResponse = NextResponse.redirect(`${origin}${next}`);
    successResponse.cookies.set("squibble_plan_intent", "", { maxAge: 0, path: "/" });
    return successResponse;
  } catch (err) {
    console.error("[auth/callback] unexpected exception:", err);
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }
}
