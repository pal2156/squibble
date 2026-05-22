import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/anthropic";

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
    : "(no profile data provided)";

  const campaignContext = [
    campaign.research_interest ? `Research interest: ${campaign.research_interest}` : null,
    campaign.subfield ? `Subfield: ${campaign.subfield}` : null,
    campaign.university ? `Target university: ${campaign.university}` : null,
    campaign.availability ? `Availability: ${campaign.availability}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  // Path A: student uploaded a CV; Path B: manual form entry
  const isPathA = !!(profile?.cv_text && profile?.cv_filename);

  const subject = SUBJECT_LINES[Math.floor(Math.random() * SUBJECT_LINES.length)];

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
    const profUniversity = prof.university ?? campaign.university ?? "";
    const profResearch = prof.description ?? "(no research description found)";
    const profTitle = prof.title ?? "";

    const compensationInstruction = campaign.position_type === "paid"
      ? "Work in naturally that the student is looking for a paid research position. Do not make it sound like a demand or a condition."
      : "Do not mention compensation, pay, or whether the position is paid or unpaid at all.";

    const cvInstruction = isPathA
      ? "Near the end of the email, include a brief natural mention that the student has attached their CV for reference."
      : "Do not mention a CV or any attachment.";

    const systemPrompt = `You are writing a cold email from a student to a professor asking about a research opportunity. Use the example email as a reference for vibe, length, and density. Do not copy its structure sentence by sentence. Every email should feel natural and distinct.

What to match from the example:

- Short. The whole email is readable in under 30 seconds
- Humble and direct. No performance, no showing off
- Each paragraph is 1-3 sentences. Nothing longer
- The professor-specific part is brief and genuine, not a literature review
- The student's background comes up naturally, not as a list of credentials
- The ask is soft and open, not transactional

Rules:

- Never use em dashes anywhere
- Never use phrases like "sits at the intersection of," "rigorous mathematical reasoning," "robust," or anything that sounds like a LinkedIn bio
- Never cite paper titles, grant names, or specific publication details. One brief reference to their research area is enough
- Never list multiple credentials in the same breath. Pick the most relevant one and mention it like a person would
- Do not start consecutive sentences with "I"
- The email must sound like it was written by a real undergraduate, not assembled from a profile
- ${compensationInstruction}
- ${cvInstruction}

The email should cover, in whatever natural order fits:

- Who the student is
- Why this professor's work caught their attention
- What relevant experience or background the student has
- When they are available and what they are looking for
- A polite close

Sign off with "Best regards," and the student's full name.
Do not generate a subject line. Only write the body starting with "Dear Professor [last name]," or "Dear Dr. [last name]," depending on their title.
Output plain text only. Use line breaks between paragraphs. No markdown, no JSON.`;

    const userMessage = `Student profile:
${studentContext}

Campaign context:
${campaignContext}

Professor: ${prof.name}, ${prof.department ?? "(department unknown)"}, ${profUniversity}
Title: ${profTitle || "(not provided)"}
Research focus: ${profResearch}`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });

      const body = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("")
        .trim();

      if (!body) throw new Error("Empty response from Claude");

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
