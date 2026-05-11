import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic, extractJsonString } from "@/lib/anthropic";

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
Write a cold email from the student below to Professor ${prof.name}, requesting a research position.

STUDENT PROFILE (use this exact data — no placeholders, no invented details):
${profileSummary}

CAMPAIGN DETAILS:
- Research interest: ${campaign.research_interest}
- Position type: ${campaign.position_type ?? "research position"}
- Time commitment: ${campaign.time_commitment ?? "flexible"}
- Availability: ${campaign.availability ?? "to be discussed"}
- Location preference: ${campaign.location_preference ?? "no preference"}

PROFESSOR:
- Name: ${prof.name}
- University: ${prof.university ?? campaign.university}
- Department: ${prof.department ?? ""}
- Title: ${prof.title ?? ""}
- Research description: ${prof.description ?? ""}
- Research areas: ${(prof.research_areas ?? []).join(", ")}

EMAIL STRUCTURE:
1. Subject line: "Undergraduate Research Inquiry, [specific topic from professor's research]"
2. Greeting: "Dear Professor [Last Name],"
3. Personal intro (1-2 sentences): state the student's actual year, school, and major from the profile above. Conversational, not robotic.
4. Research connection (2-3 sentences): draw a direct line between the student's interests and this professor's specific research. Reference particular aspects of their work, named projects, methods, or research areas. Be specific, not generic.
5. Student value (2-3 sentences): connect the student's ACTUAL coursework (name the courses), ACTUAL research experience (describe it), and ACTUAL skills to what the professor's lab needs. Use real details from the profile. If the student coded or built something relevant, mention it specifically.
6. Availability and ask (1-2 sentences): use the exact availability from campaign data and the position type. Ask if the professor has openings.
7. Close: "Thank you for your time and consideration." then "Sincerely," then the student's name from the profile.

ABSOLUTE RULES:
- NEVER use placeholders like [year], [major], [university], [your experience], [relevant coursework], or any bracketed text. Every field must be filled with real data from the student profile.
- NEVER write generic phrases like "I bring experience in relevant coursework and skills" or "I am comfortable working in a technical, fast-paced environment." These say nothing. Use the actual course names, actual project descriptions, actual skill names.
- NEVER use em dashes. Use commas, periods, or rewrite the sentence instead.
- The email must be 100% ready to send. The student should not need to change a single word.
- Every email must feel distinct and personalized to this specific student writing to this specific professor. Nothing that could apply to any student or any professor.

QUALITY BAR: A professor reading this should think "This student actually researched my work and has real relevant experience." Not "This is a form letter."

Return ONLY a valid JSON object with keys "subject" and "body". No markdown, no code fences.
`.trim();

    try {
      const response = await anthropic.messages.create({
        // Sonnet: reasoning-heavy — personalizes each email to the specific professor's research
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system:
          "You write cold emails for college students seeking research positions. Your job is to use the student's ACTUAL data (real courses, real experience, real skills, real name) and the professor's ACTUAL research to write a complete, ready-to-send email with zero placeholders. Never invent filler. Never use bracketed placeholders. Never write generic phrases. Every sentence must be grounded in the specific student and the specific professor. Never use em dashes. Return only the JSON object requested.",
        messages: [{ role: "user", content: userPrompt }],
      });

      const raw = response.content.filter((b) => b.type === "text").map((b) => (b as { type: "text"; text: string }).text).join("").trim();
      const clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      let parsed: { subject: string; body: string };
      try {
        parsed = JSON.parse(clean);
      } catch {
        const extracted = extractJsonString(clean);
        if (!extracted) throw new SyntaxError("No JSON in email draft response");
        parsed = JSON.parse(extracted);
      }
      const { subject, body } = parsed;

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
