import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic, SONNET } from "@/lib/anthropic";

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

  const { data: professors } = await supabase
    .from("professors")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("selected", true);

  if (!professors || professors.length === 0) {
    return NextResponse.json({ error: "No professors selected" }, { status: 400 });
  }

  const draftedProfessorIds = new Set((existingDrafts ?? []).map((d) => d.professor_id));
  let professorsNeedingDrafts = professors.filter((p) => !draftedProfessorIds.has(p.id));

  // Build a lookup so we can fill in professor emails on any email row that is missing them.
  const profEmailMap = new Map<string, string | null>(
    (professors ?? []).map((p) => [p.id as string, (p.email as string | null) ?? null])
  );
  const attachEmail = <T extends { professor_id?: string | null; email?: string | null }>(row: T): T =>
    row.email ? row : { ...row, email: profEmailMap.get(row.professor_id ?? "") ?? null };

  // Cross-campaign duplicate check: skip professors the student has already emailed.
  let duplicateSkipped: string[] = [];
  const selectedProfEmails = (professors ?? [])
    .map(p => p.email as string | null)
    .filter((e): e is string => !!e);

  if (selectedProfEmails.length > 0) {
    const { data: prevSent } = await supabase
      .from("emails")
      .select("email")
      .eq("user_id", user.id)
      .neq("campaign_id", campaignId)
      .in("status", ["sent", "positive", "negative", "no_response", "bounced"])
      .in("email", selectedProfEmails);

    const alreadySentTo = new Set(
      (prevSent ?? []).map(e => ((e.email as string | null) ?? "").toLowerCase()).filter(Boolean)
    );

    if (alreadySentTo.size > 0) {
      const duplicateIds = new Set(
        (professors ?? [])
          .filter(p => p.email && alreadySentTo.has((p.email as string).toLowerCase()))
          .map(p => p.id as string)
      );
      if (duplicateIds.size > 0) {
        duplicateSkipped = (professors ?? [])
          .filter(p => duplicateIds.has(p.id as string))
          .map(p => p.name as string);
        professorsNeedingDrafts = professorsNeedingDrafts.filter(
          p => !duplicateIds.has(p.id as string)
        );
      }
    }
  }

  if (professorsNeedingDrafts.length === 0) {
    return NextResponse.json({
      emails: (existingDrafts ?? []).map(attachEmail),
      failed_count: 0,
      duplicate_skipped: duplicateSkipped,
    });
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
        profile.anything_else ? `Additional context: ${profile.anything_else.slice(0, 800)}` : null,
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

  // Detect a sparse profile so Claude knows not to pad paragraph 3 with invented details.
  const substantiveFields = [
    profile?.coursework,
    profile?.experience,
    profile?.skills,
    profile?.extracurriculars,
  ].filter(Boolean);
  const sparseProfileNote = substantiveFields.length < 2
    ? "\nNote: The student's profile is sparse. Paragraph 3 will be brief. Do not invent credentials or experience. Keep it honest and direct."
    : "";

  const subject = SUBJECT_LINES[Math.floor(Math.random() * SUBJECT_LINES.length)];

  // Hoist everything that is constant across professors so each API call sends the
  // same string objects — required for prompt cache hits.
  const compensationInstruction = campaign.position_type === "paid"
    ? "Work in naturally that the student is looking for a paid research position. Do not make it sound like a demand or a condition."
    : "Do not mention compensation, pay, or whether the position is paid or unpaid at all.";

  const cvInstruction = isPathA
    ? "Near the end of the email, include a brief natural mention that the student has attached their CV for reference."
    : "Do not mention a CV or any attachment.";

  const systemPrompt = `You are writing a cold email from a student to a professor asking about a research opportunity. The email must be under 200 words and consist of exactly four short paragraphs.

Paragraph structure:

1. Who the student is and what they are asking for. Two sentences max. State name, year, school, and the ask directly.
2. The connection to the professor's research. Vary how you enter the professor's work across emails. The entry point should differ each time: sometimes lead with something the student read or encountered, sometimes with a question the professor's work raises, sometimes with what surprised the student, sometimes with the result or implication of the research. The content must remain specific and grounded in the professor's actual work. A specific reference to a paper title or research detail is allowed only when it genuinely strengthens the paragraph. It is never required. Never invent details you are not certain about. Two to three sentences.
3. The student's background in relation to this professor. Select at least two relevant pieces of the student's background and briefly connect each one to what this professor's lab does. If the professor runs a computational lab, connect the student's programming experience to that. If the work is more theoretical, lean on the mathematical background. If the work is experimental, frame the research experience accordingly. Do not list credentials in isolation. Every piece of background mentioned must be tied back to the professor. Two to three sentences.
4. Availability and the ask. Soft and open, not transactional. Two to three sentences.

Rules:

- Total length: under 200 words
- Every paragraph: 2-3 sentences max, no exceptions
- Never use em dashes anywhere in the email
- Never use phrases like "your work caught my attention," "your research stood out," "genuinely caught my attention," "most research I have encountered," "impressed by your work," or any variation that frames the professor's research as exceptional among everything the student has read
- Never write "thank you for your time" or any close variant before the sign-off
- Never use "would welcome" in any form (e.g., "I would welcome the chance," "I would welcome any involvement"). The closing sentence expressing interest in next steps must be direct and natural, not built on that construction
- Never use phrases like "sits at the intersection of," "rigorous," "robust," "synergy," or anything that sounds like a LinkedIn bio
- Do not start consecutive sentences with "I"
- The email must sound like it was written by a real undergraduate, not assembled from a profile
- No flattery, no performed enthusiasm, no overselling
- When drafting multiple emails in one batch, no two emails should follow the same structure or open their paragraphs the same way. The specific facts stay consistent across emails, but the framing and entry points must differ
- ${compensationInstruction}
- ${cvInstruction}

Choose one sign-off that fits the tone of this specific email from this list: Best, Sincerely, Warm regards, Respectfully, Looking forward to hearing from you, All the best, Kind regards, Thank you. Follow it with the student's full name.
Do not generate a subject line. Only write the body starting with "Dear Professor [last name]," or "Dear Dr. [last name]," depending on their title.
Output plain text only. Use line breaks between paragraphs. No markdown, no JSON.${sparseProfileNote}`;

  type Prof = (typeof professorsNeedingDrafts)[number];
  const draftForProf = async (prof: Prof) => {
    const profUniversity = prof.university ?? campaign.university ?? "";
    const profResearch = prof.description ?? "(no research description found)";
    const profTitle = prof.title ?? "";

    try {
      const response = await anthropic.messages.create({
        model: SONNET,
        max_tokens: 600,
        system: [
          {
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Student profile:\n${studentContext}\n\nCampaign context:\n${campaignContext}`,
                cache_control: { type: "ephemeral" },
              },
              {
                type: "text",
                text: `Professor: ${prof.name}, ${prof.department ?? "(department unknown)"}, ${profUniversity}\nTitle: ${profTitle || "(not provided)"}\nResearch focus: ${profResearch}`,
              },
            ],
          },
        ],
      });

      const body = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("")
        .trim();

      if (!body) throw new Error("Empty response from Claude");

      return {
        user_id: user.id,
        campaign_id: campaignId,
        professor_id: prof.id,
        professor_name: prof.name,
        university: profUniversity || null,
        department: prof.department,
        email: prof.email ?? null,
        subject,
        body,
        status: "draft",
      };
    } catch (err) {
      console.error(`Email draft failed for ${prof.name}:`, err instanceof Error ? err.message : err);
      return null;
    }
  };

  // For 3+ professors, await the first email before firing the rest in parallel.
  // The first call writes the prompt cache; calls 2+ read the cached system prompt
  // and student context at 10% of input cost instead of paying full price for each.
  // For 1-2 professors keep all parallel to avoid adding latency for minimal savings.
  let results: Awaited<ReturnType<typeof draftForProf>>[];
  if (professorsNeedingDrafts.length >= 3) {
    const [first, ...rest] = professorsNeedingDrafts;
    const firstResult = await draftForProf(first);
    const restResults = await Promise.all(rest.map(draftForProf));
    results = [firstResult, ...restResults];
  } else {
    results = await Promise.all(professorsNeedingDrafts.map(draftForProf));
  }

  const emailRows = results.filter((r) => r !== null);
  const failedCount = results.filter((r) => r === null).length;

  if (emailRows.length === 0) {
    return NextResponse.json({ error: "Failed to generate any drafts" }, { status: 500 });
  }

  const { data: saved, error: saveError } = await supabase
    .from("emails")
    .insert(emailRows)
    .select();

  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 });

  return NextResponse.json({
    emails: [...(existingDrafts ?? []), ...(saved ?? [])].map(attachEmail),
    failed_count: failedCount,
    duplicate_skipped: duplicateSkipped,
  });
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
