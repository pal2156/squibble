import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic, extractJsonString } from "@/lib/anthropic";

const SUBJECT_LINES = [
  "Undergraduate Research Inquiry",
  "Research Position Inquiry",
  "Interest in Your Work",
  "Seeking Research Experience",
  "Research Collaboration Inquiry",
  "Looking to Contribute",
  "Research Participation Interest",
  "Research Contribution Inquiry",
  "Research Engagement Inquiry",
  "Interest in Your Research",
];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { campaignId } = await request.json();
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

  const [{ data: campaign }, { data: profile }, { data: existingDrafts }] = await Promise.all([
    supabase.from("campaigns").select("*").eq("id", campaignId).eq("user_id", user.id).single(),
    supabase.from("profiles").select("*").eq("user_id", user.id).single(),
    supabase.from("emails").select("*").eq("campaign_id", campaignId).eq("user_id", user.id),
  ]);

  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

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

  // Build the full student context including cv_text
  const studentName = profile?.name ?? null;
  const studentContext = profile
    ? [
        `Full name: ${profile.name ?? "(not provided)"}`,
        `Year: ${profile.year ?? "(not provided)"}`,
        `School: ${profile.school ?? "(not provided)"}`,
        `Major: ${profile.major ?? "(not provided)"}`,
        profile.coursework ? `Relevant coursework: ${profile.coursework}` : null,
        profile.experience ? `Research and work experience: ${profile.experience}` : null,
        profile.skills ? `Skills: ${profile.skills}` : null,
        profile.extracurriculars ? `Extracurriculars: ${profile.extracurriculars}` : null,
        profile.anything_else ? `Additional context: ${profile.anything_else}` : null,
        profile.cv_text
          ? `\nCV TEXT (mine specific project names, course titles, tools, and methods from here):\n${profile.cv_text.slice(0, 5000)}`
          : null,
      ]
        .filter(Boolean)
        .join("\n")
    : "(no profile data — write a generic outreach email)";

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
    const lastName = prof.name.trim().split(/\s+/).pop() ?? prof.name;
    const profUniversity = prof.university ?? campaign.university ?? "";
    const profResearch = prof.description ?? "(no research description found)";
    const profKeywords = Array.isArray(prof.research_areas) && prof.research_areas.length > 0
      ? prof.research_areas.join(", ")
      : "(none)";

    // Compensation: only mention if paid, and only naturally
    const compensationLine = campaign.position_type === "paid"
      ? "In paragraph 3 or 4, work in naturally that you are looking for a paid research position. Do not make it sound like a demand or a condition."
      : "Do not mention compensation, pay, or whether the position is paid or unpaid at all.";

    const userPrompt = `
Write a cold email from the student below to Professor ${lastName} at ${profUniversity}.

STUDENT:
${studentContext}

PROFESSOR:
- Name: ${prof.name}
- University: ${profUniversity}
- Research description: ${profResearch}
- Research keywords: ${profKeywords}

AVAILABILITY: ${campaign.availability ?? "flexible"}

Write exactly four paragraphs. No greeting line before paragraph 1.

Paragraph 1 — One sentence. State the student's real first and last name, their year, their school, and their major. Example: "My name is Sarah Chen, and I am a junior at MIT studying electrical engineering and computer science."

Paragraph 2 — One to two sentences. Write something specific about what Professor ${lastName} actually researches, pulling from the research description and keywords above. Name something concrete about their work. Do not say "your work spans a wide range of directions." Do not mention their title, department, or the university name.

Paragraph 3 — Two to three sentences. Choose the one or two things from the student's coursework, experience, or skills that connect most directly to this specific professor's research. Connect them explicitly. Do not list everything the student has done. Pull real details from the CV text if available. ${compensationLine}

Paragraph 4 — One to two sentences. A specific, soft ask tied to the professor's research area and the student's availability. Something like "I would love the opportunity to contribute to your work on [specific topic] this [availability period]" or "Would you be open to a brief conversation about your current projects?" Do not start with "I was wondering if."

After paragraph 4, write exactly:
Best,
[student's real first and last name]

RULES:
- Never use em dashes anywhere in the email
- Never mention hours per week
- Never write "Dear Professor" or any salutation before paragraph 1
- Never use bracketed placeholders in the final text
- Never say anything self-deprecating about the student's experience level
- Never start with "I hope this email finds you well" or any variation
- The email is ready to send as-is. No placeholders, no invented details.
- Do not include a subject line in the body

Return ONLY a valid JSON object: {"subject": "...", "body": "..."}
The body is plain text. Use \\n for paragraph breaks. No markdown.
`.trim();

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system:
          "You write cold emails for students seeking research positions. Every sentence must use real data from the student profile or professor description. Never invent details. Never use placeholders. Never use em dashes. Return only the JSON object requested.",
        messages: [{ role: "user", content: userPrompt }],
      });

      const raw = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("")
        .trim();
      const clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      let parsed: { subject: string; body: string };
      try {
        parsed = JSON.parse(clean);
      } catch {
        const extracted = extractJsonString(clean);
        if (!extracted) throw new SyntaxError("No JSON in email draft response");
        parsed = JSON.parse(extracted);
      }

      const { body } = parsed;
      const subject = SUBJECT_LINES[Math.floor(Math.random() * SUBJECT_LINES.length)];

      emailRows.push({
        user_id: user.id,
        campaign_id: campaignId,
        professor_id: prof.id,
        professor_name: prof.name,
        university: profUniversity || null,
        department: prof.department,
        subject,
        body,
        status: "draft",
      });
    } catch (err) {
      console.error(`Email draft failed for ${prof.name}:`, err instanceof Error ? err.message : err);
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
