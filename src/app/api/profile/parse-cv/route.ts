import { NextResponse } from "next/server";
import { z } from "zod";
import { generateJson } from "@/lib/ai";
import { upsertProfile } from "@/lib/db";

const CvFieldsSchema = z.object({
  name: z.string(),
  school: z.string(),
  year: z.string(),
  major: z.string(),
  relevant_coursework: z.string(),
  research_experience: z.string(),
  skills: z.string(),
  extracurriculars: z.string(),
});

const SYSTEM_PROMPT = `You are extracting information from a student resume to populate a research outreach profile.

Field instructions:
- name: the student's full name
- school: the university or institution they currently attend
- year: their current academic year, e.g. "Freshman", "Sophomore", "Junior", "Senior", "First year", "Second year"
- major: their primary field of study
- relevant_coursework: a comma-separated string of every course listed on the resume, do not skip any
- research_experience: a full prose description of every research role, lab position, project, or academic work experience. Include lab names, what they worked on, tools used, and outcomes. Do not summarize or truncate.
- skills: a comma-separated string of every technical and non-technical skill listed, including programming languages, tools, frameworks, lab techniques, and languages spoken
- extracurriculars: a comma-separated string of everything that is not academic coursework or research. This includes clubs, sports, organizations, competitions, hackathons, awards, honors, volunteer work, tutoring, coaching, mentoring, community involvement, leadership roles, part-time jobs, and any other non-academic non-research activity. Cast a wide net.

Be exhaustive. Do not truncate. Do not invent anything not on the resume. If a field has no data, return an empty string.`;

export async function POST(request: Request) {
  console.log("[parse-cv] route hit");
  try {
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
    const buffer = Buffer.from(arrayBuffer);

    // Extract text locally (pdf-parse) instead of sending the raw PDF bytes
    // to the model — the old base64 `document` content block was an
    // Anthropic-specific message shape that OpenAI/Gemini don't share
    // (design review finding A5 / task T7). Plain extracted text works
    // identically across all three providers.
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const pdfData = await parser.getText();
    const resumeText = pdfData.text.trim();
    if (!resumeText) {
      return NextResponse.json({ error: "Could not extract any text from this PDF" }, { status: 422 });
    }
    console.log("[parse-cv] extracted text length:", resumeText.length);

    const parsed = await generateJson({
      schema: CvFieldsSchema,
      system: SYSTEM_PROMPT,
      prompt: `Resume text:\n\n${resumeText.slice(0, 20000)}`,
      tier: "fast",
      maxOutputTokens: 2048,
    });

    const fields: Record<string, string> = { ...parsed, anything_else: "" };
    console.log("[parse-cv] parsed fields:", JSON.stringify(fields));

    // Store the original PDF as base64 — this is what gets attached to the
    // outgoing email later (see lib/mailer/smtp.ts), so it has to survive as
    // real PDF bytes, not the extracted text used just now for parsing.
    const base64 = buffer.toString("base64");
    upsertProfile({ cv_text: base64, cv_filename: file.name });

    return NextResponse.json({ fields, cv_filename: file.name });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[parse-cv] unexpected error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
