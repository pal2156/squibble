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

  return NextResponse.json({ profile: data ?? null });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    name, school, year, major, coursework,
    experience, skills, extracurriculars, anything_else, cv_text,
  } = body;

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
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
        cv_text: cv_text ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also mark profile complete on the users row
  await supabase
    .from("users")
    .update({ profile_complete: true })
    .eq("id", user.id);

  return NextResponse.json({ profile: data });
}
