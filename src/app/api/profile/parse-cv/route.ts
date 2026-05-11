import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/anthropic";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParseMod = require("pdf-parse") as {
  PDFParse: (new (opts: { data: Buffer }) => { getText(): Promise<{ text: string }> }) & {
    setWorker(src?: string): string;
  };
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getData: getWorkerData } = require("pdf-parse/worker") as { getData: () => string };
const { PDFParse } = pdfParseMod;
// Pass worker as an inline data URL so Node.js never tries to require() an .mjs file
PDFParse.setWorker(getWorkerData());

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || file.type !== "application/pdf") {
      return NextResponse.json({ error: "PDF required" }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (5MB max)" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    const cvText = parsed.text.trim();

    if (!cvText) {
      return NextResponse.json({ error: "Could not extract text from PDF" }, { status: 422 });
    }

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: `You are an academic profile extractor. Parse the resume text and return ONLY a valid JSON object with exactly these keys:
- name (full name)
- school (university or institution name)
- year (one of: Freshman, Sophomore, Junior, Senior, Graduate, Postdoc, Other)
- major (field of study or strongest subjects)
- coursework (comma-separated list of relevant courses)
- experience (research, lab, internship, or project experience, 2-4 sentences)
- skills (technical and soft skills, comma-separated)
- extracurriculars (clubs, activities, awards, publications, brief)

Return only the JSON object. No markdown, no code fences, no explanation.`,
      messages: [{ role: "user", content: cvText }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    let fields: Record<string, string>;
    try {
      fields = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Failed to parse CV fields" }, { status: 500 });
    }

    return NextResponse.json({ fields, cvText });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[parse-cv]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
