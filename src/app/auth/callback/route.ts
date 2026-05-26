import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  console.log("[auth/callback] GET hit:", request.url);
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const googleError = searchParams.get("error");
  const next = searchParams.get("next") ?? "/dashboard";

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

    // Register Gmail Pub/Sub watch so we receive reply notifications.
    // Best-effort: don't block the redirect if it fails.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin;
    fetch(`${appUrl}/api/gmail/watch`, {
      method: "POST",
      headers: {
        cookie: request.headers.get("cookie") ?? "",
      },
    }).catch((err) => {
      console.error("[auth/callback] gmail watch registration failed:", err);
    });

    console.log("[auth/callback] redirecting to:", `${origin}${next}`);
    return NextResponse.redirect(`${origin}${next}`);
  } catch (err) {
    console.error("[auth/callback] unexpected exception:", err);
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }
}
