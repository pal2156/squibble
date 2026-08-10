import { NextResponse } from "next/server";
import { getProfile, upsertProfile } from "@/lib/db";

export async function GET() {
  const profile = getProfile();
  if (!profile) return NextResponse.json({ profile: null });

  // Never send the raw CV text to the client — just a presence marker
  return NextResponse.json({
    profile: {
      ...profile,
      cv_text: profile.cv_text ? "has_cv" : null,
    },
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const {
    name, school, year, major, coursework,
    experience, skills, extracurriculars, anything_else,
  } = body;

  // Base fields — never touches cv_text or cv_filename (parse-cv owns those)
  const fields: Record<string, unknown> = {
    name: name ?? null,
    school: school ?? null,
    year: year ?? null,
    major: major ?? null,
    coursework: coursework ?? null,
    experience: experience ?? null,
    skills: skills ?? null,
    extracurriculars: extracurriculars ?? null,
    anything_else: anything_else ?? null,
  };

  // Path B explicitly sends cv_text: null to clear the stored CV when the
  // user switches away from the resume path. Only touch cv columns if the
  // key is present.
  if (Object.prototype.hasOwnProperty.call(body, "cv_text")) {
    fields.cv_text = body.cv_text ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "cv_filename")) {
    fields.cv_filename = body.cv_filename ?? null;
  }

  const profile = upsertProfile(fields);
  return NextResponse.json({ profile });
}
