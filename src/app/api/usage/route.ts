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
    .select("searches_remaining, emails_remaining")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    searches_remaining: data?.searches_remaining ?? 0,
    emails_remaining: data?.emails_remaining ?? 0,
  });
}
