import { NextResponse } from "next/server";
import { getSentEmailsForDashboard } from "@/lib/db";

// Returns emails in the shape the dashboard UI expects
export async function GET() {
  const rows = getSentEmailsForDashboard();

  const emails = rows.map((e) => {
    const uiStatus =
      e.status === "positive" ? "Positive Reply"
        : e.status === "negative" ? "Negative Reply"
        : "No Response";

    return {
      id: e.id,
      professor: e.professor_name ?? "",
      university: e.university ?? "",
      department: e.department ?? "",
      campaign: e.campaign_title ?? "Campaign",
      campaignCreatedAt: e.campaign_created_at ?? "",
      dateSent: e.sent_at ? formatDate(e.sent_at) : "",
      status: uiStatus as "Positive Reply" | "No Response" | "Negative Reply",
      subject: e.subject ?? "",
      body: e.body ?? "",
      reply: e.reply ? { date: formatDate(e.reply.received_at), body: e.reply.body ?? "" } : undefined,
    };
  });

  return NextResponse.json({ emails });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}
