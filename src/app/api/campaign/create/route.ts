import { NextResponse } from "next/server";
import { createCampaign } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json();
  const { university, research_interest, availability, professor_count, faculty_page_url } = body;

  if (!university || !research_interest) {
    return NextResponse.json({ error: "University and research interest required" }, { status: 400 });
  }

  const campaign = createCampaign({
    university,
    research_interest,
    availability: availability || null,
    professor_count: professor_count ?? 10,
    faculty_page_url: faculty_page_url || null,
    status: "finding",
  });

  return NextResponse.json({ campaign });
}
