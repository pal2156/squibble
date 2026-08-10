import { NextResponse } from "next/server";
import * as db from "@/lib/db";

export async function POST(request: Request) {
  const { campaignId, selectedIds } = await request.json() as { campaignId: string; selectedIds: string[] };

  if (!campaignId || !Array.isArray(selectedIds)) {
    return NextResponse.json({ error: "campaignId and selectedIds required" }, { status: 400 });
  }

  const campaign = db.getCampaign(campaignId);
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  db.setSelectedProfessors(campaignId, selectedIds);

  return NextResponse.json({ ok: true });
}
