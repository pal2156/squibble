import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic, HAIKU } from "@/lib/anthropic";

export async function POST(request: Request) {
  console.log("[parse-cv] route hit");
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log("[parse-cv] unauthorized — no user session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("[parse-cv] authenticated user:", user.id);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || file.type !== "application/pdf") {
      console.log("[parse-cv] bad file:", file?.type);
      return NextResponse.json({ error: "PDF required" }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (5MB max)" }, { status: 400 });
    }
    console.log("[parse-cv] file received:", file.name, "size:", file.size);

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    console.log("[parse-cv] base64 length:", base64.length);

    console.log("[parse-cv] calling Claude...");
    const message = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: 2048,
      system: `You are extracting information from a student resume to populate a research outreach profile. Return only a valid JSON object with no preamble, no explanation, and no markdown code blocks. Use exactly this structure:

{
  "name": "",
  "school": "",
  "year": "",
  "major": "",
  "relevant_coursework": "",
  "research_experience": "",
  "skills": "",
  "extracurriculars": "",
  "anything_else": ""
}

Field instructions:
- name: the student's full name
- school: the university or institution they currently attend
- year: their current academic year, e.g. "Freshman", "Sophomore", "Junior", "Senior", "First year", "Second year"
- major: their primary field of study
- relevant_coursework: a comma-separated string of every course listed on the resume, do not skip any
- research_experience: a full prose description of every research role, lab position, project, or academic work experience. Include lab names, what they worked on, tools used, and outcomes. Do not summarize or truncate.
- skills: a comma-separated string of every technical and non-technical skill listed, including programming languages, tools, frameworks, lab techniques, and languages spoken
- extracurriculars: a comma-separated string of everything that is not academic coursework or research. This includes clubs, sports, organizations, competitions, hackathons, awards, honors, volunteer work, tutoring, coaching, mentoring, community involvement, leadership roles, part-time jobs, and any other non-academic non-research activity. Cast a wide net — if it does not belong in coursework, research_experience, or skills, it goes here.
- anything_else: leave this empty. Do not put anything here.

Be exhaustive. Do not truncate. Do not invent anything not on the resume. If a field has no data, return an empty string.`,
      messages: [{
        role: "user",
        content: [{
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64,
          },
        }],
      }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    console.log("[parse-cv] Claude raw response:", JSON.stringify(raw));

    let fields: Record<string, string>;
    try {
      // Strip markdown fences in case Claude wraps the JSON
      const clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      fields = JSON.parse(clean);
    } catch (parseErr) {
      console.error("[parse-cv] JSON parse failed:", parseErr, "raw:", raw);
      return NextResponse.json({ error: "Failed to parse CV fields" }, { status: 500 });
    }
    // Never auto-populate anything_else — the student fills it in manually
    fields.anything_else = "";
    console.log("[parse-cv] parsed fields:", JSON.stringify(fields));

    // Save cv_text and cv_filename directly here so the client never has to send megabytes of base64
    const { data: upsertResult, error: upsertError } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: user.id,
          cv_text: base64,
          cv_filename: file.name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();
    console.log("[parse-cv] Supabase cv upsert result:", JSON.stringify(upsertResult), "error:", JSON.stringify(upsertError));

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ fields, cv_filename: file.name });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[parse-cv] unexpected error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
