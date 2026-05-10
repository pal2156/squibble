import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/anthropic";

const encoder = new TextEncoder();

function sse(data: object): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { campaignId } = await request.json();
  if (!campaignId) {
    return new Response(JSON.stringify({ error: "campaignId required" }), { status: 400 });
  }

  // Load campaign + student profile in parallel
  const [{ data: campaign }, { data: profile }] = await Promise.all([
    supabase.from("campaigns").select("*").eq("id", campaignId).single(),
    supabase.from("profiles").select("*").eq("user_id", user.id).single(),
  ]);

  if (!campaign) {
    return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(sse({ type: "progress", message: "Finding the right department..." }));

        // Build profile summary for ranking prompt
        const profileSummary = profile
          ? [
              profile.name && `Name: ${profile.name}`,
              profile.year && profile.school && `${profile.year} at ${profile.school}`,
              profile.major && `Studying: ${profile.major}`,
              profile.coursework && `Coursework: ${profile.coursework}`,
              profile.experience && `Experience: ${profile.experience}`,
              profile.skills && `Skills: ${profile.skills}`,
              profile.extracurriculars && `Extracurriculars: ${profile.extracurriculars}`,
            ]
              .filter(Boolean)
              .join("\n")
          : "No profile provided.";

        controller.enqueue(sse({ type: "progress", message: "Reading through the faculty..." }));

        const userPrompt = `
Student is looking for research opportunities.
University target: ${campaign.university}
Research interest: ${campaign.research_interest}
Availability: ${campaign.availability ?? "flexible"}
Number of professors to find: ${campaign.professor_count}

Student profile:
${profileSummary}

Instructions:
1. Use web search to find the most specific faculty directory for "${campaign.university}" in the area of "${campaign.research_interest}". If no exact match, use the closest department.
2. Collect up to ${campaign.professor_count} professors from that directory. For each, find: name, department, university, academic title (e.g. Assistant Professor), email address, research description (2-3 sentences), and 2-4 research area keywords.
3. Rank them 0-100 by these criteria in order of weight:
   - Research overlap with the student's interest (most important)
   - Student background fit (coursework, experience, skills match)
   - Seniority (Assistant/Associate Professors score higher than Full Professors)
   - Lab activity (active projects, recent publications mentioned)
   - Email availability (no email = deprioritize)
4. Generate a campaign title: 6-8 words. Format: "{University short name} {2-3 keyword research description} · {condensed timeline}". Example: "MIT Condensed Matter Physics · Summer 2025". Use a middle dot (·) not an em dash.

Return ONLY a valid JSON object with this exact shape, no markdown, no code fences:
{
  "title": "...",
  "professors": [
    {
      "name": "...",
      "department": "...",
      "university": "...",
      "title": "...",
      "email": "...",
      "description": "...",
      "research_areas": ["...", "..."],
      "fit_score": 85
    }
  ]
}`.trim();

        controller.enqueue(sse({ type: "progress", message: "Matching professors to your profile..." }));

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 8096,
          tools: [{ type: "web_search_20250305" as const, name: "web_search" }],
          system:
            "You are an expert at finding and evaluating university faculty for student research outreach. You search the web carefully, extract accurate contact information, and rank professors by how well they match a student's profile. Always return valid JSON as instructed.",
          messages: [{ role: "user", content: userPrompt }],
        });

        // Extract text from the final response (skip tool_use blocks)
        const text = response.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { type: "text"; text: string }).text)
          .join("");

        controller.enqueue(sse({ type: "progress", message: "Saving results..." }));

        let parsed: { title: string; professors: Array<Record<string, unknown>> };
        try {
          // Strip any accidental markdown fences
          const clean = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
          parsed = JSON.parse(clean);
        } catch {
          controller.enqueue(sse({ type: "error", message: "Could not parse faculty results. Please try again." }));
          controller.close();
          return;
        }

        // Save professors to Supabase
        const rows = (parsed.professors ?? []).map((p) => ({
          campaign_id: campaignId,
          name: String(p.name ?? ""),
          department: p.department ? String(p.department) : null,
          university: p.university ? String(p.university) : campaign.university,
          title: p.title ? String(p.title) : null,
          email: p.email ? String(p.email) : null,
          description: p.description ? String(p.description) : null,
          research_areas: Array.isArray(p.research_areas) ? p.research_areas.map(String) : [],
          fit_score: typeof p.fit_score === "number" ? p.fit_score : null,
          selected: false,
        }));

        if (rows.length > 0) {
          await supabase.from("professors").insert(rows);
        }

        // Update campaign with title and active status
        await supabase
          .from("campaigns")
          .update({ title: parsed.title, status: "active" })
          .eq("id", campaignId);

        controller.enqueue(sse({ type: "done", title: parsed.title }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unexpected error";
        controller.enqueue(sse({ type: "error", message: msg }));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
