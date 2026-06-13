import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getGmailClient } from "@/lib/gmail";

export async function GET(request: Request) {
  console.log("[auth/callback] GET hit:", request.url);
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const googleError = searchParams.get("error");
  const stateParam = searchParams.get("state");

  // Determine post-auth destination.
  // Priority 1: squibble_auth_next cookie set before the OAuth redirect.
  // Priority 2: state URL param (plan encoded directly in OAuth state as fallback).
  // Priority 3: squibble_plan_intent cookie (legacy fallback).
  // Default: /dashboard.
  const cookieStore = await cookies();
  const rawCookieNext = cookieStore.get("squibble_auth_next")?.value;
  const cookieNext = rawCookieNext ? decodeURIComponent(rawCookieNext) : null;
  const cookiePlan = cookieStore.get("squibble_plan_intent")?.value;

  let next: string;
  if (cookieNext && cookieNext.startsWith("/") && !cookieNext.startsWith("//")) {
    next = cookieNext;
  } else if (stateParam === "pro" || stateParam === "max") {
    next = `/api/stripe/redirect?plan=${stateParam}`;
  } else if (cookiePlan === "pro" || cookiePlan === "max") {
    next = `/api/stripe/redirect?plan=${cookiePlan}`;
  } else {
    next = "/dashboard";
  }
  console.log("[auth/callback] destination — cookieNext:", cookieNext, "cookiePlan:", cookiePlan, "resolved next:", next);

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

  // Read PKCE state stored by the client before redirecting to Google.
  // Fall back to deriving the redirect_uri from the request origin if the cookie is missing.
  const codeVerifier = cookieStore.get("g_cv")?.value;
  const encodedRedirectUri = cookieStore.get("g_ruri")?.value;
  const redirectUri = encodedRedirectUri
    ? decodeURIComponent(encodedRedirectUri)
    : `${origin}/auth/callback`;

  if (!codeVerifier) {
    console.error("[auth/callback] missing PKCE code verifier cookie (g_cv)");
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }

  try {
    // Exchange the authorization code for Google tokens directly.
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error("[auth/callback] Google token exchange failed:", tokenRes.status, body);
      return NextResponse.redirect(`${origin}/?error=auth_failed`);
    }

    const googleTokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      id_token: string;
      token_type: string;
      expires_in: number;
      scope: string;
    };

    if (!googleTokens.id_token) {
      console.error("[auth/callback] Google token response missing id_token");
      return NextResponse.redirect(`${origin}/?error=auth_failed`);
    }

    // Sign the user into Supabase using the Google id_token.
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: googleTokens.id_token,
      access_token: googleTokens.access_token,
    });

    if (error) {
      console.error("[auth/callback] signInWithIdToken failed:", {
        message: error.message,
        status: error.status,
        name: error.name,
      });
      return NextResponse.redirect(`${origin}/?error=auth_failed`);
    }

    if (!data.session) {
      console.error("[auth/callback] signInWithIdToken returned no session");
      return NextResponse.redirect(`${origin}/?error=auth_failed`);
    }

    console.log("[auth/callback] session established for user:", data.session.user.id);

    // Persist Gmail tokens from the Google token response.
    const updates: Record<string, string> = {
      gmail_token: googleTokens.access_token,
    };
    if (googleTokens.refresh_token) {
      updates.gmail_refresh_token = googleTokens.refresh_token;
    }

    const { error: dbError } = await supabase
      .from("users")
      .update(updates)
      .eq("id", data.session.user.id);
    if (dbError) {
      console.error("[auth/callback] failed to persist Gmail tokens:", dbError.message);
    }

    // Initialize plan to 'free' for new users who don't have one yet.
    await supabase
      .from("users")
      .update({ plan: "free" })
      .eq("id", data.session.user.id)
      .is("plan", null);

    // Register Gmail Pub/Sub watch so we receive reply notifications.
    const watchTopic = process.env.GMAIL_PUBSUB_TOPIC;
    if (watchTopic) {
      try {
        const gmail = getGmailClient(
          googleTokens.access_token,
          googleTokens.refresh_token ?? null
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
    } else {
      console.warn("[auth/callback] GMAIL_PUBSUB_TOPIC not set — skipping watch registration");
    }

    console.log("[auth/callback] redirecting to:", `${origin}${next}`);
    const successResponse = NextResponse.redirect(`${origin}${next}`);
    successResponse.cookies.set("g_cv", "", { maxAge: 0, path: "/" });
    successResponse.cookies.set("g_ruri", "", { maxAge: 0, path: "/" });
    successResponse.cookies.set("squibble_auth_next", "", { maxAge: 0, path: "/" });
    successResponse.cookies.set("squibble_plan_intent", "", { maxAge: 0, path: "/" });
    return successResponse;
  } catch (err) {
    console.error("[auth/callback] unexpected exception:", err);
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }
}
