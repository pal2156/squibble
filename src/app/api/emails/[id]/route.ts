import { NextResponse } from "next/server";
import { updateEmail } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (body.body !== undefined) updates.body = body.body;
  if (body.status !== undefined) updates.status = body.status;
  if (body.message_id !== undefined) updates.message_id = body.message_id;
  if (body.sent_at !== undefined) updates.sent_at = body.sent_at;

  const email = updateEmail(id, updates);
  if (!email) return NextResponse.json({ error: "Email not found" }, { status: 404 });

  return NextResponse.json({ email });
}
