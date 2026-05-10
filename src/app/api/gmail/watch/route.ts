import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGmailClient } from "@/lib/gmail";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userData } = await supabase
    .from("users")
    .select("gmail_token, gmail_refresh_token")
    .eq("id", user.id)
    .single();

  if (!userData?.gmail_token) {
    return NextResponse.json({ error: "Gmail not connected" }, { status: 403 });
  }

  const topicName = process.env.GMAIL_PUBSUB_TOPIC;
  if (!topicName) {
    return NextResponse.json({ error: "GMAIL_PUBSUB_TOPIC not configured" }, { status: 500 });
  }

  try {
    const gmail = getGmailClient(userData.gmail_token, userData.gmail_refresh_token);
    const res = await gmail.users.watch({
      userId: "me",
      requestBody: {
        topicName,
        labelIds: ["INBOX"],
      },
    });

    const historyId = res.data.historyId ?? null;
    const expiration = res.data.expiration ? Number(res.data.expiration) : null;

    await supabase.from("gmail_watch").upsert(
      { user_id: user.id, history_id: historyId, expiration, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

    return NextResponse.json({ ok: true, historyId, expiration });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Watch registration failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
