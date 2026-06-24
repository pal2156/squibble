import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { campaignId, selectedIds } = await request.json() as {
    campaignId: string;
    selectedIds: string[];
  };

  if (!campaignId || !Array.isArray(selectedIds)) {
    return NextResponse.json({ error: "campaignId and selectedIds required" }, { status: 400 });
  }

  // Verify campaign belongs to user
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("user_id", user.id)
    .single();

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  // selectedIds are professors.id values. Unselect all, then select chosen ones.
  await supabase.from("campaign_professors").update({ selected_by_student: false }).eq("campaign_id", campaignId);

  if (selectedIds.length > 0) {
    await supabase
      .from("campaign_professors")
      .update({ selected_by_student: true })
      .eq("campaign_id", campaignId)
      .in("professor_id", selectedIds);
  }

  return NextResponse.json({ ok: true });
}
