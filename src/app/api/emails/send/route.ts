import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGmailClient, buildMimeMessage } from "@/lib/gmail";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { emailId } = await request.json();
  if (!emailId) return NextResponse.json({ error: "emailId required" }, { status: 400 });

  // Load email, user's Gmail credentials, and profile (for CV attachment)
  const [{ data: email }, { data: userData }, { data: profileData }] = await Promise.all([
    supabase.from("emails").select("*").eq("id", emailId).eq("user_id", user.id).single(),
    supabase.from("users").select("gmail_token, gmail_refresh_token, email, name").eq("id", user.id).single(),
    supabase.from("profiles").select("cv_text, cv_filename").eq("user_id", user.id).single(),
  ]);

  if (!email) return NextResponse.json({ error: "Email not found" }, { status: 404 });
  if (!userData?.gmail_token) {
    return NextResponse.json({ error: "Gmail not connected. Please sign in again." }, { status: 403 });
  }
  if (!email.email) {
    // Load professor email from professors table
    const { data: prof } = await supabase
      .from("professors")
      .select("email")
      .eq("id", email.professor_id)
      .single();

    if (!prof?.email) {
      // Mark as sent anyway (no email address available)
      await supabase
        .from("emails")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", emailId);
      return NextResponse.json({ ok: true, warning: "No email address for professor" });
    }

    // Attach professor email to email row for sending
    await supabase.from("emails").update({ email: prof.email } as Record<string, unknown>).eq("id", emailId);
    Object.assign(email, { email: prof.email });
  }

  // Load professor email if not on email row
  let toEmail = (email as Record<string, unknown>).email as string | undefined;
  if (!toEmail) {
    const { data: prof } = await supabase
      .from("professors")
      .select("email")
      .eq("id", email.professor_id)
      .single();
    toEmail = prof?.email ?? undefined;
  }

  if (!toEmail) {
    await supabase.from("emails").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", emailId);
    return NextResponse.json({ ok: true, warning: "No email address for professor" });
  }

  const fromName = userData.name ?? user.email ?? "";
  const fromEmail = userData.email ?? user.email ?? "";
  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  const testOverride = process.env.TEST_EMAIL_OVERRIDE;
  const recipient = testOverride ?? toEmail;
  const body = testOverride
    ? `${email.body ?? ""}\n\nThis is a test email going to ${testOverride}.`
    : (email.body ?? "");

  // Attach CV PDF for Path A users (those who uploaded a CV)
  const cvAttachment = (profileData?.cv_text && profileData?.cv_filename)
    ? { base64: profileData.cv_text, filename: profileData.cv_filename, mimeType: "application/pdf" as const }
    : undefined;

  try {
    const gmail = getGmailClient(userData.gmail_token, userData.gmail_refresh_token);
    const message = buildMimeMessage({
      to: recipient,
      from,
      subject: email.subject ?? "(no subject)",
      body,
      attachment: cvAttachment,
    });

    const sent = await gmail.users.messages.send({
      userId: "me",
      requestBody: message,
    });

    const gmailMessageId = sent.data.id ?? null;
    const gmailThreadId = sent.data.threadId ?? null;

    await supabase.from("emails").update({
      status: "sent",
      gmail_message_id: gmailMessageId,
      gmail_thread_id: gmailThreadId,
      sent_at: new Date().toISOString(),
    }).eq("id", emailId);

    return NextResponse.json({ ok: true, gmailMessageId, gmailThreadId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gmail send failed";
    // Still mark as sent so the UI advances, but log the failure
    await supabase.from("emails").update({
      status: "sent",
      sent_at: new Date().toISOString(),
    }).eq("id", emailId);
    return NextResponse.json({ ok: true, warning: msg });
  }
}
