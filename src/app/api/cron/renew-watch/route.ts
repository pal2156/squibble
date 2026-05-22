import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGmailClient } from "@/lib/gmail";

// Vercel injects CRON_SECRET automatically for cron jobs.
// The cron runner sends it as: Authorization: Bearer {CRON_SECRET}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const topicName = process.env.GMAIL_PUBSUB_TOPIC;
  if (!topicName) {
    return NextResponse.json({ error: "GMAIL_PUBSUB_TOPIC not set" }, { status: 500 });
  }

  const admin = getServiceClient();

  const { data: users, error } = await admin
    .from("users")
    .select("id, gmail_token, gmail_refresh_token")
    .not("gmail_token", "is", null);

  if (error || !users) {
    console.error("[renew-watch] failed to fetch users:", error?.message);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  console.log(`[renew-watch] renewing Gmail watch for ${users.length} user(s)`);

  const results: Array<{
    userId: string;
    ok: boolean;
    historyId?: string | null;
    expiration?: number | null;
    error?: string;
  }> = [];

  for (const user of users) {
    try {
      const gmail = getGmailClient(user.gmail_token, user.gmail_refresh_token);
      const res = await gmail.users.watch({
        userId: "me",
        requestBody: { topicName, labelIds: ["INBOX"] },
      });

      const historyId = res.data.historyId ?? null;
      const expiration = res.data.expiration ? Number(res.data.expiration) : null;

      await admin.from("gmail_watch").upsert(
        {
          user_id: user.id,
          history_id: historyId,
          expiration,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      console.log(`[renew-watch] user ${user.id}: ok historyId=${historyId} expiration=${expiration}`);
      results.push({ userId: user.id, ok: true, historyId, expiration });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[renew-watch] user ${user.id}: failed - ${msg}`);
      results.push({ userId: user.id, ok: false, error: msg });
    }
  }

  return NextResponse.json({ renewed: results.length, results });
}
