import { NextResponse } from "next/server";
import { updateEmail } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { status } = await request.json() as { status: string };

  const validStatuses = ["positive", "negative", "no_response", "sent"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const email = updateEmail(id, { status: status as never });
  if (!email) return NextResponse.json({ error: "Email not found" }, { status: 404 });

  return NextResponse.json({ email });
}
