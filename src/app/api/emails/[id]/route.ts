import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (body.body !== undefined) updates.body = body.body;
  if (body.status !== undefined) updates.status = body.status;
  if (body.gmail_message_id !== undefined) updates.gmail_message_id = body.gmail_message_id;
  if (body.gmail_thread_id !== undefined) updates.gmail_thread_id = body.gmail_thread_id;
  if (body.sent_at !== undefined) updates.sent_at = body.sent_at;

  const { data, error } = await supabase
    .from("emails")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ email: data });
}
