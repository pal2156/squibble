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

    const systemPrompt = `You are writing a cold email from a student to a professor asking about a research opportunity. The email must be under 200 words and consist of exactly four short paragraphs.

Paragraph structure:

1. Who the student is and what they are asking for. Two sentences max. State name, year, school, and the ask directly.
2. The connection to the professor's research. Frame this as the student noticing a link between something they have already been thinking about or working on and the professor's work. The framing is "I have been thinking about X, and your work on Y connects to that" not "your work impressed me" or "I came across your research." Two to three sentences.
3. What the student brings. One or two relevant pieces of background, mentioned plainly. Two to three sentences.
4. Availability and the ask. Soft and open, not transactional. Two to three sentences.

Rules:

- Total length: under 200 words
- Every paragraph: 2-3 sentences max, no exceptions
- Never use em dashes anywhere in the email
- Never use phrases like "your work caught my attention," "your research stood out," "genuinely caught my attention," "most research I have encountered," "impressed by your work," or any variation that frames the professor's research as exceptional among everything the student has read
- Never write "thank you for your time" or any close variant before the sign-off
- Never use phrases like "sits at the intersection of," "rigorous," "robust," "synergy," or anything that sounds like a LinkedIn bio
- Never cite paper titles, grant names, or specific publication details. One brief reference to the research area is enough
- Never list multiple credentials in the same sentence. Pick the most relevant one and mention it plainly
- Do not start consecutive sentences with "I"
- The email must sound like it was written by a real undergraduate, not assembled from a profile
- No flattery, no performed enthusiasm, no overselling
- ${compensationInstruction}
- ${cvInstruction}

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
