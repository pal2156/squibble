import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      // Store access token + refresh token for server-side Gmail API calls
      const updates: Record<string, string | null> = {};
      if (data.session.provider_token) {
        updates.gmail_token = data.session.provider_token;
      }
      if (data.session.provider_refresh_token) {
        updates.gmail_refresh_token = data.session.provider_refresh_token;
      }

      if (Object.keys(updates).length > 0) {
        await supabase
          .from("users")
          .update(updates)
          .eq("id", data.session.user.id);
      }

      // Register Gmail Pub/Sub watch so we receive reply notifications.
      // Best-effort: don't block the redirect if it fails.
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? origin;
      fetch(`${appUrl}/api/gmail/watch`, {
        method: "POST",
        headers: {
          cookie: request.headers.get("cookie") ?? "",
        },
      }).catch(() => {});

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth_failed`);
}
