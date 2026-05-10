import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Returns emails in the shape the dashboard UI expects
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: emails } = await supabase
    .from("emails")
    .select(`
      id, professor_name, university, department,
      subject, body, status, sent_at, campaign_id,
      campaigns ( title ),
      replies ( body, received_at, classification )
    `)
    .eq("user_id", user.id)
    .in("status", ["sent", "positive", "negative", "no_response"])
    .order("sent_at", { ascending: false });

  const rows = (emails ?? []).map((e) => {
    const uiStatus =
      e.status === "positive" ? "Positive Reply"
        : e.status === "negative" ? "Negative Reply"
        : "No Response";

    const campaignTitle =
      (e.campaigns as { title?: string } | null)?.title ?? "Campaign";

    const reply =
      e.replies && (e.replies as Array<{ body: string; received_at: string }>).length > 0
        ? {
            date: formatDate((e.replies as Array<{ body: string; received_at: string }>)[0].received_at),
            body: (e.replies as Array<{ body: string; received_at: string }>)[0].body,
          }
        : undefined;

    return {
      id: e.id,
      professor: e.professor_name ?? "",
      university: e.university ?? "",
      department: e.department ?? "",
      campaign: campaignTitle,
      dateSent: e.sent_at ? formatDate(e.sent_at) : "",
      status: uiStatus as "Positive Reply" | "No Response" | "Negative Reply",
      subject: e.subject ?? "",
      body: e.body ?? "",
      reply,
    };
  });

  return NextResponse.json({ emails: rows });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}
