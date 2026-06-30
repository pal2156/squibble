import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Professor, CampaignProfessorView, RecentPaper } from "@/lib/types";

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

  // Only the top N (in_top_n) candidates are shown to the student to select from.
  const { data: campaignProfessors } = await supabase
    .from("campaign_professors")
    .select("*, professors(*)")
    .eq("campaign_id", campaignId)
    .eq("in_top_n", true)
    .order("final_score", { ascending: false });

  const rows = (campaignProfessors ?? []) as Array<Record<string, unknown> & { professors: Professor }>;

  const facultyPageIds = Array.from(
    new Set(rows.flatMap((r) => r.professors?.faculty_page_ids ?? []))
  );

  const { data: facultyPages } = facultyPageIds.length > 0
    ? await supabase.from("faculty_pages").select("id, university, department_name").in("id", facultyPageIds)
    : { data: [] as Array<{ id: string; university: string; department_name: string | null }> };

  const pageById = new Map((facultyPages ?? []).map((p) => [p.id, p]));

  const professors: CampaignProfessorView[] = rows.map((row) => {
    const prof = row.professors;
    const page = pageById.get(prof.faculty_page_ids[0]);
    return {
      id: prof.id,
      name: prof.name,
      department: page?.department_name ?? null,
      university: page?.university ?? null,
      title: prof.title,
      description: (row.card_description as string | null) ?? prof.research_description,
      email: prof.email,
      fit_score: row.final_score as number | null,
      research_areas: [],
      selected: row.selected_by_student as boolean,
      recent_papers: (row.recent_papers as RecentPaper[] | null) ?? null,
      created_at: row.created_at as string,
    };
  });

  return NextResponse.json({ professors, campaign });
}
