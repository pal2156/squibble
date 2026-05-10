import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get("campaignId");
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

  // Verify campaign belongs to user
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, title")
    .eq("id", campaignId)
    .eq("user_id", user.id)
    .single();

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const { data: professors } = await supabase
    .from("professors")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("fit_score", { ascending: false });

  return NextResponse.json({ professors: professors ?? [], campaign });
}
