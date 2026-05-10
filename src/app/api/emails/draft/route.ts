import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/anthropic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { campaignId } = await request.json();
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

  // Load campaign, profile, and selected professors in parallel
  const [{ data: campaign }, { data: profile }, { data: existingDrafts }] = await Promise.all([
    supabase.from("campaigns").select("*").eq("id", campaignId).eq("user_id", user.id).single(),
    supabase.from("profiles").select("*").eq("user_id", user.id).single(),
    supabase.from("emails").select("*").eq("campaign_id", campaignId).eq("user_id", user.id),
  ]);

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  // Return existing drafts if already generated
  if (existingDrafts && existingDrafts.length > 0) {
    return NextResponse.json({ emails: existingDrafts });
  }

  const { data: professors } = await supabase
    .from("professors")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("selected", true);

  if (!professors || professors.length === 0) {
    return NextResponse.json({ error: "No professors selected" }, { status: 400 });
  }

  const profileSummary = profile
    ? [
        `Name: ${profile.name ?? "the student"}`,
        profile.year && `Year: ${profile.year}`,
        profile.school && `School: ${profile.school}`,
        profile.major && `Major: ${profile.major}`,
        profile.coursework && `Relevant coursework: ${profile.coursework}`,
        profile.experience && `Research experience: ${profile.experience}`,
        profile.skills && `Skills: ${profile.skills}`,
        profile.extracurriculars && `Extracurriculars: ${profile.extracurriculars}`,
        profile.anything_else && `Additional context: ${profile.anything_else}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "A college student seeking research experience.";

  // Draft one email per selected professor (sequential to avoid rate limits)
  const emailRows: Array<{
    user_id: string;
    campaign_id: string;
    professor_id: string;
    professor_name: string;
    university: string | null;
    department: string | null;
    subject: string;
    body: string;
    status: string;
  }> = [];

  for (const prof of professors) {
    const userPrompt = `
Write a cold email from a student to a professor requesting a research position.

Student profile:
${profileSummary}

Campaign details:
- Research interest: ${campaign.research_interest}
- Position type: ${campaign.position_type ?? "any"}
- Time commitment: ${campaign.time_commitment ?? "flexible"}
- Availability: ${campaign.availability ?? "to be discussed"}
- Location preference: ${campaign.location_preference ?? "no preference"}

Professor:
- Name: ${prof.name}
- University: ${prof.university ?? campaign.university}
- Department: ${prof.department ?? ""}
- Title: ${prof.title ?? ""}
- Research description: ${prof.description ?? ""}
- Research areas: ${(prof.research_areas ?? []).join(", ")}

Email structure:
1. Personal intro: year, school, major (one sentence)
2. 1-2 sentences specific to THIS professor's research (reference their actual work)
3. What the student brings: relevant experience, skills, or coursework (be specific)
4. Availability and position ask (brief, clear)
5. Polite close with thanks

Rules:
- Never use em dashes. Use commas, periods, or rewrite instead.
- Tone: warm, direct, professional. Not sycophantic.
- Length: 150-200 words for the body.
- Subject line: concise (under 10 words). e.g. "Undergraduate Research Inquiry, [Lab Focus]"

Return ONLY a valid JSON object with keys "subject" and "body". No markdown, no code fences.
`.trim();

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system:
          "You write personalized cold emails for college students seeking research positions. You are concise, specific, and never use em dashes. Return only the JSON object requested.",
        messages: [{ role: "user", content: userPrompt }],
      });

      const raw = response.content.filter((b) => b.type === "text").map((b) => (b as { type: "text"; text: string }).text).join("");
      const clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const { subject, body } = JSON.parse(clean);

      emailRows.push({
        user_id: user.id,
        campaign_id: campaignId,
        professor_id: prof.id,
        professor_name: prof.name,
        university: prof.university ?? campaign.university,
        department: prof.department,
        subject,
        body,
        status: "draft",
      });
    } catch {
      // Skip professors where generation fails rather than aborting the whole batch
    }
  }

  if (emailRows.length === 0) {
    return NextResponse.json({ error: "Failed to generate any drafts" }, { status: 500 });
  }

  const { data: saved, error: saveError } = await supabase
    .from("emails")
    .insert(emailRows)
    .select();

  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 });

  return NextResponse.json({ emails: saved });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get("campaignId");
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

  const { data: emails } = await supabase
    .from("emails")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("user_id", user.id)
    .order("created_at");

  return NextResponse.json({ emails: emails ?? [] });
}
