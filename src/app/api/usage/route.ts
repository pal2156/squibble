import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("users")
    .select("plan, searches_used, emails_sent")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    plan: data?.plan ?? "free",
    searches_used: data?.searches_used ?? 0,
    emails_sent: data?.emails_sent ?? 0,
  });
}
