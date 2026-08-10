import { NextResponse } from "next/server";
import { getConversations } from "@/lib/db";

export async function GET() {
  const rows = getConversations();

  const conversations = rows
    .filter((e) => e.reply)
    .map((e) => ({
      id: e.id,
      professor: e.professor_name ?? "",
      university: e.university ?? "",
      department: e.department ?? "",
      dateSent: e.sent_at ? formatDate(e.sent_at) : "",
      status: (e.status === "positive" ? "Positive Reply" : "Negative Reply") as "Positive Reply" | "Negative Reply",
      subject: e.subject ?? "",
      body: e.body ?? "",
      reply: { date: formatDate(e.reply!.received_at), body: e.reply!.body ?? "" },
    }))
    .sort((a, b) => new Date(b.reply.date).getTime() - new Date(a.reply.date).getTime());

  return NextResponse.json({ conversations });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}
