import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic, SONNET } from "@/lib/anthropic";

const SIGN_OFFS = ["Best", "Sincerely", "Warm regards", "Best regards", "Thank you"];

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: parts[0] };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

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

  const { data: selectedCampaignProfessors } = await supabase
    .from("campaign_professors")
    .select("*, professors(*)")
    .eq("campaign_id", campaignId)
    .eq("selected_by_student", true);

  const selectedFacultyPageIds = Array.from(
    new Set((selectedCampaignProfessors ?? []).flatMap((cp) => cp.professors.faculty_page_ids ?? []))
  );
  const { data: selectedFacultyPages } = selectedFacultyPageIds.length > 0
    ? await supabase.from("faculty_pages").select("id, university, department_name").in("id", selectedFacultyPageIds)
    : { data: [] as Array<{ id: string; university: string; department_name: string | null }> };
  const facultyPageById = new Map((selectedFacultyPages ?? []).map((p) => [p.id, p]));

  const professors = (selectedCampaignProfessors ?? []).map((cp) => {
    const prof = cp.professors;
    const page = facultyPageById.get(prof.faculty_page_ids[0]);
    return {
      id: prof.id,
      name: prof.name,
      role_tag: prof.role_tag,
      department: page?.department_name ?? null,
      university: page?.university ?? campaign.university,
      title: prof.title,
      description: prof.research_description,
      email: prof.email,
      connection_summary: cp.connection_summary,
      recent_papers: (cp.recent_papers ?? []).slice(0, 3),
    };
  });

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

  const studentExperiences = [
    profile?.coursework ? `Coursework: ${profile.coursework}` : null,
    profile?.experience ? `Experience: ${profile.experience}` : null,
    profile?.skills ? `Skills: ${profile.skills}` : null,
    profile?.extracurriculars ? `Extracurriculars: ${profile.extracurriculars}` : null,
    profile?.anything_else ? `Additional: ${profile.anything_else.slice(0, 800)}` : null,
  ]
    .filter(Boolean)
    .join("\n") || "(none provided)";

  const hasCv = !!(profile?.cv_text && profile?.cv_filename);

  // Hoist everything that is constant across professors so each API call sends the
  // same string objects — required for prompt cache hits.
  const studentFields = {
    student_name: profile?.name ?? null,
    student_year: profile?.year ?? null,
    student_university: profile?.school ?? null,
    student_major: profile?.major ?? null,
    student_experiences: studentExperiences,
    has_cv: hasCv,
    availability: campaign.availability ?? null,
  };

  const systemPrompt = `You are writing a cold outreach email from a student seeking a research position with a professor or researcher. Your job is to write an email that feels warm, human, and concise. It must not sound AI-generated, corporate, or like a template. Every email must feel specific to this professor and this student.

**INPUTS YOU WILL RECEIVE**
- student_name: first and last name
- student_year: Freshman, Sophomore, Junior, Senior, High School Student, Graduate Student, or unknown
- student_university: university or school name
- student_major: field of study
- student_experiences: relevant experiences, projects, coursework, skills
- professor_last_name: last name
- professor_first_name: first name
- professor_role_tag: one of: professor, assistant_professor, associate_professor, chair, emeritus, postdoc, research_scientist, grad_student, visiting_scholar, lecturer, other
- research_description: verbatim text from the professor's faculty page
- recent_papers: array of up to 3 objects with title and year, or empty
- connection_summary: one sentence describing a specific link between the student's background and the professor's research, or null
- has_cv: true or false
- availability: free-text availability from the student (e.g. "September through December", "Fall Semester", "Spring 2027", "August", "ASAP", "the first two weeks of August", "October 15 to November 30")

**OUTPUT FORMAT**

Return only a JSON object in this exact format, with no surrounding text:
\`\`\`json
{
  "subject": "...",
  "body": "..."
}
\`\`\`

**SUBJECT LINE**

Step 1: Determine status. Use student_year directly: Freshman, Sophomore, Junior, Senior, High School Student, Graduate Student. If unknown or ambiguous, omit status entirely.

Step 2: Determine if professor runs a lab. Read research_description. A lab is explicitly present only if the text directly mentions a lab, lab members, lab equipment, or lab-based work. If ambiguous, treat as no lab.

Step 3: Pick one variant from the correct pool.

Pool A (explicit lab mention):
- [Status] Seeking Research Opportunity
- [Status] Looking for a Research Position
- [Status] Interested in Joining Your Lab
- [Status] Looking to Contribute to Your Lab

Pool B (no explicit lab mention):
- [Status] Seeking Research Opportunity
- [Status] Looking for a Research Position

If status is unknown, drop it: Seeking Research Opportunity, Looking for a Research Position, etc.

Vary the pick across emails. Do not always pick the same variant.

**EMAIL BODY**

The body field must start with a greeting line, followed by a blank line, then exactly 4 paragraphs.

**Greeting (first line of body):** Select based on professor_role_tag:
- professor, assistant_professor, associate_professor, chair, emeritus: Dear Professor [Last Name],
- postdoc, research_scientist, doctorate: Hi Dr. [Last Name],
- grad_student: Hi [First Name],
- visiting_scholar, lecturer, other: Hi Dr. [Last Name],

The 4 paragraphs follow the greeting. Total word count for the 4 paragraphs: 150 to 180 words. Every sentence must earn its place.

**PARAGRAPH 1: The Hook**

1-2 sentences. Open directly on the professor's research. No pleasantries. No "I hope you're doing well." Never start with "I" as the first word. Never use flattery. Never summarize the paper back at them.

If recent_papers is non-empty: Pick the paper that best matches the professor's research description. If both paper and research area are present, pick the slice of the research description that most closely maps to the paper title. Do not use the full research description. One concise phrase that bridges the paper to their broader work.

Approved structures, vary across emails:
- I recently came across your work on [research area] and after reading your [year] paper on [paper title], I wanted to reach out.
- After reading your [year] paper on [paper title], I developed a strong interest in [research area] and thought I'd get in touch.
- I came across your [year] paper on [paper title] while looking into [research area], and I thought I'd reach out.

If recent_papers is empty AND connection_summary is non-null:

Approved structures:
- From [specific experience from connection_summary], I've developed a strong interest in [field], and after coming across your work on [research area], I thought I'd reach out.
- After [specific experience from connection_summary] sparked my interest in [field], I came across your work on [research area] and wanted to get in touch.

If recent_papers is empty AND connection_summary is null:
- I recently came across your work on [specific element from research description] and thought I'd reach out.
- I came across your work on [research area] recently and wanted to get in touch.

Rules for [research area]: Always specific to this professor's actual work. Never just the field name. Concise. Directly tied to the paper title when a paper exists.

Banned in P1: "caught my attention," "I was fascinated by," "your groundbreaking work," "your incredible work," "I am writing to," "I came across" when used as flattery, any sentence that could apply to any professor.

**PARAGRAPH 2: Identity + Credibility**

2-3 short sentences.

Sentence 1: Identity. State name, year, university, major. Vary the structure:
- I'm [first name], a [year] [major] student at [university].
- My name is [first name] and I'm a [year] student at [university] studying [major].
- I'm [first name], a [year] student at [university] studying [major].

Sentences 2-3: Credibility. Pick the 1-2 experiences from student_experiences that most closely map to the professor's research. Do not list everything. Do not use superlatives. Do not brag. Just state what they have done concisely and let it speak for itself. If connection_summary is non-null, the experiences chosen must reinforce it. Keep both sentences short. Together they should not exceed 50 words.

Banned in P2: "extensive experience," "I am highly motivated," "I am passionate about," "I've always been interested in," any superlative, resume dumping.

**PARAGRAPH 3: The Offer + Timeline**

1-2 sentences. This is where the student makes their ask. Frame it as an offer, not a demand. Sound flexible and willing, not desperate.

**Timeline phrasing** — Before writing P3, determine which case applies from the raw `availability` field and construct an [availability phrase] accordingly. Never mechanically insert the raw text into a fixed "from X through Y" slot.

- Two distinct months or a date range (e.g. "September through December", "Sept-Dec"): phrase as "from [Month] through [Month]"
- A semester or named period (e.g. "Fall Semester", "Fall Semester (September through December)", "Spring 2027"): phrase as "during the [Semester Name]". Omit the underlying month range if the semester name already implies it; include it only if the name alone is ambiguous.
- A single month (e.g. "August"): phrase as "in [Month]"
- Specific dates or a partial-month range (e.g. "the first two weeks of August", "Aug 1-15"): produce a natural date phrase (e.g. "from the 1st through the 15th of August"), or preserve the student's descriptive phrasing if it reads naturally on its own
- Open-ended availability (e.g. "ASAP", "immediately", "flexible", "anytime"): drop the from/through construction entirely; phrase as "starting immediately", "at any time", or similar as context demands
- A specific full date range (e.g. "October 15 to November 30"): phrase as "from October 15th through November 30th"

If availability is null or missing, omit the timeline sentence entirely.

If lab is explicitly mentioned in research_description:
- If your group has any space, I'd love to help, even with smaller tasks like [task 1] or [task 2], and I'm fully committed to learning what's needed. I'd be available [availability phrase].
- I would love to assist you in any way, whether through [task 1] or [task 2]. I'd be available [availability phrase] and very willing to learn what's needed to contribute effectively.

If no explicit lab mention:
- I'd be happy to contribute in any way, whether that's [task 1] or [task 2]. I'm available [availability phrase].
- I would love to assist you in any way, whether through [task 1] or [task 2], and I'd be available [availability phrase].

Rules for tasks: Draw [task 1] and [task 2] from the professor's actual research description and the student's skills. Never use generic placeholder tasks. Never use the exact same tasks for every professor.

Approved openers: "I'd love to," "I would love to," "I'd be happy to"

Banned openers: "I'd be glad to," "I'm very open to," "I'd be delighted to," "whatever capacity"

Always include the timeline in P3 unless availability is null or missing.

**PARAGRAPH 4: The Close**

1-2 sentences. Soft and open. Never pushy. Never demand a response.

If has_cv is true:
- I've attached my CV for reference and would love the chance to discuss your research and whether there might be any ways I could contribute.
- I've attached my resume for more details and would love to chat about your research and any ways I could help.
- I have attached my CV for reference. I'd love to discuss your research and explore whether there might be any ways I could contribute.

If has_cv is false:
- I would love the chance to discuss your research and explore whether there might be any ways I could contribute.
- I'd love to chat with you about your research and whether there might be any ways I could help out.
- I would love to meet with you to talk more about your research and explore any ways I could contribute.

Banned in P4: "at your earliest convenience," "I look forward to hearing from you," "please do not hesitate," "I would greatly appreciate the opportunity," "thank you for your consideration."

**SIGN-OFF**

Do not generate the sign-off. It will be appended in code. Leave it out of the body entirely.

**GLOBAL RULES**

Banned phrases everywhere:
- "passionate about," "delve into," "cutting-edge," "would welcome," "I am writing to"
- "I came across" used as flattery
- "groundbreaking," "incredible work," "pioneering," "world-class," "renowned"
- "I believe I would be," "I am confident that," "I am highly motivated"
- "hoping to hear from you," "at your earliest convenience," "please do not hesitate"
- Em dashes anywhere in the email

Tone rules:
- Human, warm, direct. Not corporate. Not formal cover letter language.
- Contractions are fine and preferred.
- Short sentences over long ones.
- Never start the email body with "I" as the first word.
- Never open with a pleasantry.
- No sentence should be able to apply to any professor. Every sentence must be specific to this professor or this student.

Structure rules:
- Exactly 4 paragraphs.
- 150 to 180 words total. Count carefully. If over 180, cut. If under 150, expand.
- Vary sentence structures and opening phrases across emails so no two emails read the same.
- One paper referenced maximum when papers exist. Never zero when papers exist. Never two.`;

  type Prof = (typeof professorsNeedingDrafts)[number];
  const draftForProf = async (prof: Prof) => {
    const profUniversity = prof.university ?? campaign.university ?? "";
    const { first: professorFirstName, last: professorLastName } = splitName(prof.name);

    const professorFields = {
      professor_last_name: professorLastName,
      professor_first_name: professorFirstName,
      professor_role_tag: prof.role_tag,
      research_description: prof.description ?? "(no research description found)",
      recent_papers: prof.recent_papers ?? [],
      connection_summary: prof.connection_summary ?? null,
    };

    try {
      const response = await anthropic.messages.create({
        model: SONNET,
        max_tokens: 700,
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
                text: JSON.stringify(studentFields, null, 2),
                cache_control: { type: "ephemeral" },
              },
              {
                type: "text",
                text: JSON.stringify(professorFields, null, 2),
              },
            ],
          },
        ],
      });

      const raw = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("")
        .trim();

      if (!raw) throw new Error("Empty response from Claude");

      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
      const subject = typeof parsed.subject === "string" ? parsed.subject.trim() : "";
      const rawBody = typeof parsed.body === "string" ? parsed.body.trim() : "";

      if (!subject || !rawBody) throw new Error("Invalid response shape from Claude");

      // Remove hard line wraps Claude may insert within paragraphs when formatting JSON.
      // Paragraphs are separated by \n\n; single \n within a paragraph are hard wraps.
      const modelBody = rawBody
        .split(/\n{2,}/)
        .map((para: string) => para.replace(/\n/g, " ").trim())
        .join("\n\n");

      const signOff = SIGN_OFFS[Math.floor(Math.random() * SIGN_OFFS.length)];
      const body = `${modelBody}\n\n${signOff},\n${profile?.name ?? ""}`.trim();

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
