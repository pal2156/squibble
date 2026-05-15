import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!data) return NextResponse.json({ profile: null });

  // Never send the raw base64 PDF to the client — just a presence marker
  return NextResponse.json({
    profile: {
      ...data,
      cv_text: data.cv_text ? "has_cv" : null,
    },
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    name, school, year, major, coursework,
    experience, skills, extracurriculars, anything_else,
  } = body;

  // Base upsert — never touches cv_text or cv_filename (parse-cv owns those)
  const upsertData: Record<string, unknown> = {
    user_id: user.id,
    name: name ?? null,
    school: school ?? null,
    year: year ?? null,
    major: major ?? null,
    coursework: coursework ?? null,
    experience: experience ?? null,
    skills: skills ?? null,
    extracurriculars: extracurriculars ?? null,
    anything_else: anything_else ?? null,
    updated_at: new Date().toISOString(),
  };

  // Path B explicitly sends cv_text: null to clear the stored PDF when the user
  // switches away from the resume path. Only touch cv columns if the key is present.
  if (Object.prototype.hasOwnProperty.call(body, "cv_text")) {
    upsertData.cv_text = body.cv_text ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "cv_filename")) {
    upsertData.cv_filename = body.cv_filename ?? null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert(upsertData, { onConflict: "user_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from("users")
    .update({ profile_complete: true })
    .eq("id", user.id);

  return NextResponse.json({ profile: data });
}
