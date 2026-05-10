import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    university, research_interest, position_type,
    time_commitment, availability, location_preference, professor_count,
  } = body;

  if (!university || !research_interest) {
    return NextResponse.json({ error: "University and research interest required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      user_id: user.id,
      university,
      research_interest,
      position_type: position_type || null,
      time_commitment: time_commitment || null,
      availability: availability || null,
      location_preference: location_preference || null,
      professor_count: professor_count ?? 10,
      status: "finding",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ campaign: data });
}
