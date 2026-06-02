import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGmailClient, buildMimeMessage } from "@/lib/gmail";
import { PLAN_LIMITS, type Plan } from "@/lib/plans";

export async function POST(request: Request) {
  console.log("[send] handler invoked");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error("[send] no authenticated user");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  console.log("[send] user:", user.id);

  const { emailId, overrideRecipient } = await request.json();
  if (!emailId) {
    console.error("[send] missing emailId in request body");
    return NextResponse.json({ error: "emailId required" }, { status: 400 });
  }
  console.log("[send] emailId:", emailId);

  // Load email, user's Gmail credentials, and profile (for CV attachment)
  const [{ data: email }, { data: userData }, { data: profileData }] = await Promise.all([
    supabase.from("emails").select("*").eq("id", emailId).eq("user_id", user.id).single(),
    supabase.from("users").select("gmail_token, gmail_refresh_token, email, name, plan").eq("id", user.id).single(),
    supabase.from("profiles").select("cv_text, cv_filename").eq("user_id", user.id).single(),
  ]);

  console.log("[send] email row found:", !!email, "| professor_id:", (email as Record<string, unknown> | null)?.professor_id);
  console.log("[send] userData found:", !!userData, "| has gmail_token:", !!userData?.gmail_token, "| has refresh_token:", !!userData?.gmail_refresh_token);
  console.log("[send] profile found:", !!profileData, "| has cv_text:", !!profileData?.cv_text, "| cv_filename:", profileData?.cv_filename ?? null);

  if (!email) {
    console.error("[send] email row not found for id:", emailId);
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  // Enforce send cap: count emails already sent for this campaign
  const plan = ((userData as { plan?: string } | null)?.plan ?? "free") as Plan;
  const sendLimit = PLAN_LIMITS[plan].emails;

  if (email.campaign_id) {
    const { count: sentCount } = await supabase
      .from("emails")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", email.campaign_id)
      .eq("status", "sent");

    if ((sentCount ?? 0) >= sendLimit) {
      console.log(`[send] send cap reached: ${sentCount}/${sendLimit} for campaign ${email.campaign_id} (plan: ${plan})`);
      return NextResponse.json(
        { error: `Send limit of ${sendLimit} emails reached for your ${plan} plan.` },
        { status: 429 }
      );
    }
  }

  if (!userData?.gmail_token) {
    console.error("[send] gmail_token is null/missing for user:", user.id, "— user must re-authenticate");
    return NextResponse.json({ error: "Gmail not connected. Please sign in again." }, { status: 403 });
  }
  // The email row no longer stores the professor email address, so we always
  // resolve it from the professors table. A missing address is a real error,
  // not a silent success — the email must not be marked sent unless Gmail
  // actually accepts it.
  const cachedEmail = (email as Record<string, unknown>).email as string | null | undefined;
  let toEmail: string | undefined = cachedEmail || undefined;

  if (!toEmail) {
    console.log("[send] looking up professor email from professors table");
    const { data: prof } = await supabase
      .from("professors")
      .select("email")
      .eq("id", email.professor_id)
      .single();
    console.log("[send] professor email lookup:", prof?.email ?? "(not found)");
    toEmail = prof?.email || undefined;
  }

  if (!toEmail) {
    console.error("[send] no email address for professor — aborting, not marking sent");
    return NextResponse.json({ error: "No email address for this professor" }, { status: 422 });
  }

  const fromName = userData.name ?? user.email ?? "";
  const fromEmail = userData.email ?? user.email ?? "";
  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  const testOverride = process.env.TEST_EMAIL_OVERRIDE;
  // Use || not ?? so an empty string overrideRecipient falls through to toEmail.
  const recipient = overrideRecipient || testOverride || toEmail;
  const body = testOverride
    ? `${email.body ?? ""}\n\nThis is a test email going to ${testOverride}.`
    : (email.body ?? "");

  if (!recipient) {
    console.error("[send] recipient resolved to empty string — aborting");
    return NextResponse.json({ error: "Recipient email is empty" }, { status: 422 });
  }

  console.log("[send] recipient:", recipient, "| from:", from, "| subject:", email.subject ?? "(no subject)");
  console.log("[send] body length:", body.length, "chars | testOverride:", testOverride ?? "none");

  // CV attachment: cv_text must be a base64-encoded PDF, not plain text.
  // If it's raw extracted text (from pdf-parse), this will produce a corrupted attachment.
  const hasValidCv = !!(profileData?.cv_text && profileData?.cv_filename);
  console.log("[send] CV attachment:", hasValidCv ? `${profileData!.cv_filename} (cv_text length: ${profileData!.cv_text!.length})` : "none");
  const cvAttachment = hasValidCv
    ? { base64: profileData!.cv_text!, filename: profileData!.cv_filename!, mimeType: "application/pdf" as const }
    : undefined;

  try {
    console.log("[send] building MIME message");
    const gmail = getGmailClient(userData.gmail_token, userData.gmail_refresh_token);
    const message = buildMimeMessage({
      to: recipient,
      from,
      subject: email.subject ?? "(no subject)",
      body,
      attachment: cvAttachment,
    });
    console.log("[send] MIME message built, raw length:", message.raw.length, "chars");

    console.log("[send] calling Gmail API users.messages.send");
    const sent = await gmail.users.messages.send({
      userId: "me",
      requestBody: message,
    });
    console.log("[send] Gmail API response — id:", sent.data.id, "| threadId:", sent.data.threadId, "| status:", sent.status);

    const gmailMessageId = sent.data.id ?? null;
    const gmailThreadId = sent.data.threadId ?? null;

    await supabase.from("emails").update({
      status: "sent",
      gmail_message_id: gmailMessageId,
      gmail_thread_id: gmailThreadId,
      sent_at: new Date().toISOString(),
    }).eq("id", emailId);

    await supabase.rpc("increment_emails_sent", { uid: user.id });

    console.log("[send] email row updated to sent");
    return NextResponse.json({ ok: true, gmailMessageId, gmailThreadId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gmail send failed";
    // Log the full error so it's visible in server logs
    console.error("[send] Gmail API threw an error:", err);
    console.error("[send] error message:", msg);
    await supabase.from("emails").update({
      status: "failed",
      sent_at: new Date().toISOString(),
    }).eq("id", emailId);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
