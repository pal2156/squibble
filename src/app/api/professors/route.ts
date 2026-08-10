import { NextResponse } from "next/server";
import * as db from "@/lib/db";
import type { CampaignProfessorView, RecentPaper } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get("campaignId");
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

  const campaign = db.getCampaign(campaignId);
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  // Only the top N (in_top_n) candidates are shown to the student to select from.
  const rows = db.getTopNForCampaign(campaignId);

  const facultyPageIds = Array.from(new Set(rows.flatMap((r) => r.professor.faculty_page_ids)));
  const facultyPages = db.getFacultyPages(facultyPageIds);
  const pageById = new Map(facultyPages.map((p) => [p.id, p]));

  const professors: CampaignProfessorView[] = rows.map((row) => {
    const prof = row.professor;
    const page = pageById.get(prof.faculty_page_ids[0]);
    return {
      id: prof.id,
      name: prof.name,
      department: page?.department_name ?? null,
      university: page?.university ?? null,
      title: prof.title,
      description: row.card_description ?? prof.research_description,
      email: prof.email,
      fit_score: row.final_score,
      research_areas: [],
      selected: row.selected_by_student,
      recent_papers: row.recent_papers as RecentPaper[] | null,
      created_at: row.created_at,
    };
  });

  return NextResponse.json({ professors, campaign: { id: campaign.id, title: campaign.title } });
}
