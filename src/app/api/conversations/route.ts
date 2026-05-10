import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only emails that have a reply
  const { data: emails } = await supabase
    .from("emails")
    .select(`
      id, professor_name, university, department,
      subject, body, status, sent_at,
      replies ( body, received_at, classification )
    `)
    .eq("user_id", user.id)
    .in("status", ["positive", "negative"])
    .order("sent_at", { ascending: false });

  const rows = (emails ?? [])
    .filter((e) =>
      e.replies &&
      (e.replies as Array<{ body: string; received_at: string }>).length > 0
    )
    .map((e) => {
      const replyRow = (e.replies as Array<{ body: string; received_at: string }>)[0];
      const uiStatus =
        e.status === "positive" ? "Positive Reply" : "Negative Reply";

      return {
        id: e.id,
        professor: e.professor_name ?? "",
        university: e.university ?? "",
        department: e.department ?? "",
        dateSent: e.sent_at ? formatDate(e.sent_at) : "",
        status: uiStatus as "Positive Reply" | "Negative Reply",
        subject: e.subject ?? "",
        body: e.body ?? "",
        reply: {
          date: formatDate(replyRow.received_at),
          body: replyRow.body,
        },
      };
    })
    .sort((a, b) => {
      const aDate = a.reply?.date ? new Date(a.reply.date).getTime() : 0;
      const bDate = b.reply?.date ? new Date(b.reply.date).getTime() : 0;
      return bDate - aDate;
    });

  return NextResponse.json({ conversations: rows });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}
