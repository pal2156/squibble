import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic, extractJsonString } from "@/lib/anthropic";

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
      ]
        .filter(Boolean)
        .join("\n")
    : "(no profile data — write a generic outreach email)";

  // Path A: student uploaded a CV (cv_text stores base64 PDF); Path B: manual form entry
  const isPathA = !!(profile?.cv_text && profile?.cv_filename);

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
    const profTitle = prof.title ?? "";

    // Use "Dear Professor" only when the title explicitly contains the word Professor
    const titleIncludesProfessor = /\bprofessor\b/i.test(profTitle);
    const salutation = titleIncludesProfessor
      ? `Dear Professor ${lastName},`
      : `Dear Dr. ${lastName},`;

    // Compensation: only mention if paid, and only naturally
    const compensationLine = campaign.position_type === "paid"
      ? "Work in naturally that you are looking for a paid research position. Do not make it sound like a demand or a condition."
      : "Do not mention compensation, pay, or whether the position is paid or unpaid at all.";

    const cvLine = isPathA
      ? 'After paragraph 4, on its own line, add exactly: "I have attached my CV for reference."'
      : "Do not mention a CV or any attachment.";

    const userPrompt = `
Write a cold email from a student to ${prof.name} at ${profUniversity}.

STUDENT:
${studentContext}

PROFESSOR:
- Name: ${prof.name}
- Title: ${profTitle || "(not provided)"}
- University: ${profUniversity}
- Research description: ${profResearch}
- Research keywords: ${profKeywords}

AVAILABILITY: ${campaign.availability ?? "flexible"}

SUBJECT: Write a specific subject line that names the professor's actual research area or a concrete topic from their description. Never use "Interest in Your Work," "Research Participation Interest," or other generic phrases.

BODY STRUCTURE:

Line 1 (salutation): ${salutation}

Paragraph 1 — One sentence. State who the student is: their first and last name, year, school, and major. Do not always open with "My name is" — vary the phrasing.

Paragraph 2 — One to two sentences. Pick one specific thread from ${lastName}'s research and name something concrete about it. Do not summarize everything they do. Do not mention their title, department, or university name.

Paragraph 3 — Two to three sentences. Choose the one or two things from the student's background that connect most directly to this professor's research. Write it as a short narrative, not a list. Do not name more than two courses by name. ${compensationLine}

Paragraph 4 — One to two sentences. A single clean ask: either a brief conversation or an opportunity to contribute to their work on a specific topic during ${campaign.availability ?? "the coming semester"}. Do not start with "I was wondering if." Ask for one thing only.

${cvLine}

Sign-off: Vary the closing phrase across emails. Use one of: "Best,", "Best regards,", "Sincerely,", "Thank you," — followed by the student's first and last name on the next line.

HARD RULES:
- Never use em dashes anywhere in the email
- Never use the word "passionate"
- Never list more than two courses by name
- Never stack credentials with "and...and...and"
- The closing paragraph must ask for exactly one thing
- Never use overly deferential phrases like "I would welcome the opportunity to contribute" or "I would be grateful if you were open to" — the ask should be direct and confident, closer to "I would love to hear more about your current projects" or "I would be happy to chat if you think there could be a fit"
- Never use bracketed placeholders in the final text
- Never say anything self-deprecating about the student's experience level
- Never start with "I hope this email finds you well" or any variation
- Never mention hours per week
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

      const { body, subject } = parsed;

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
