import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/anthropic";
// pdf-parse is CJS; use require() so Next.js doesn't try to resolve its ESM stub
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;

export async function POST(request: Request) {
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

  // Extract text from PDF using pdf-parse
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const parsed = await pdfParse(buffer);
  const cvText = parsed.text.trim();

  if (!cvText) {
    return NextResponse.json({ error: "Could not extract text from PDF" }, { status: 422 });
  }

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `You are an academic profile extractor. Parse the resume text and return ONLY a valid JSON object with exactly these keys:
- name (full name)
- school (university or institution name)
- year (one of: Freshman, Sophomore, Junior, Senior, Graduate, Postdoc, Other)
- major (field of study or strongest subjects)
- coursework (comma-separated list of relevant courses)
- experience (research, lab, internship, or project experience — 2-4 sentences)
- skills (technical and soft skills, comma-separated)
- extracurriculars (clubs, activities, awards, publications — brief)
- anything_else (anything notable not captured above, or empty string)

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
}
