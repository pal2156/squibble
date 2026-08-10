import { NextResponse } from "next/server";
import { sendMail } from "@/lib/mailer";
import * as db from "@/lib/db";

export async function POST(request: Request) {
  console.log("[send] handler invoked");
  const { emailId } = await request.json();
  if (!emailId) {
    console.error("[send] missing emailId in request body");
    return NextResponse.json({ error: "emailId required" }, { status: 400 });
  }
  console.log("[send] emailId:", emailId);

  const email = db.getEmail(emailId);
  const profileData = db.getProfile();

  if (!email) {
    console.error("[send] email row not found for id:", emailId);
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  // The email row may not have the professor's address cached yet — resolve
  // it from the professors table. A missing address is a real error, not a
  // silent success — the email must not be marked sent unless it actually went out.
  let toEmail: string | undefined = email.email || undefined;
  if (!toEmail && email.professor_id) {
    const prof = db.getProfessor(email.professor_id);
    toEmail = prof?.email || undefined;
  }

  if (!toEmail) {
    console.error("[send] no email address resolved — aborting");
    return NextResponse.json({ error: "No email address for this professor" }, { status: 422 });
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!EMAIL_RE.test(toEmail)) {
    console.error("[send] malformed recipient address:", toEmail);
    return NextResponse.json(
      { error: "The professor's email address appears to be malformed and cannot be sent to." },
      { status: 422 }
    );
  }

  console.log("[send] recipient:", toEmail, "| subject:", email.subject ?? "(no subject)");

  // cv_text is stored as base64 PDF (see profile/parse-cv), safe to attach directly.
  const hasValidCv = !!(profileData?.cv_text && profileData?.cv_filename);
  const cvAttachment = hasValidCv
    ? { base64: profileData!.cv_text!, filename: profileData!.cv_filename!, mimeType: "application/pdf" as const }
    : undefined;

  try {
    const { messageId } = await sendMail({
      to: toEmail,
      subject: email.subject ?? "(no subject)",
      body: email.body ?? "",
      attachment: cvAttachment,
    });

    db.updateEmail(emailId, {
      status: "sent",
      message_id: messageId,
      sent_at: db.nowIso(),
      email: toEmail,
    });

    console.log("[send] email row updated to sent, message_id:", messageId);
    return NextResponse.json({ ok: true, messageId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "SMTP send failed";
    console.error("[send] SMTP send threw:", err);
    db.updateEmail(emailId, { status: "failed", sent_at: db.nowIso() });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
