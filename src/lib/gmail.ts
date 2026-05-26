import { google } from "googleapis";

if (!process.env.GOOGLE_CLIENT_ID) {
  console.warn("[gmail] WARNING: GOOGLE_CLIENT_ID is undefined — Gmail API and OAuth token refresh will fail.");
}
if (!process.env.GOOGLE_CLIENT_SECRET) {
  console.warn("[gmail] WARNING: GOOGLE_CLIENT_SECRET is undefined — Gmail API and OAuth token refresh will fail.");
}

function makeOAuth2Client(accessToken: string, refreshToken?: string | null) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken ?? undefined,
  });
  return client;
}

export function getGmailClient(accessToken: string, refreshToken?: string | null) {
  return google.gmail({ version: "v1", auth: makeOAuth2Client(accessToken, refreshToken) });
}

// Encode a plain string as base64url (required by Gmail API for message bodies)
export function toBase64Url(input: string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Build a minimal RFC 2822 MIME message string, with optional attachment
export function buildMimeMessage({
  to,
  from,
  subject,
  body,
  threadId,
  attachment,
}: {
  to: string;
  from: string;
  subject: string;
  body: string;
  threadId?: string;
  attachment?: { base64: string; filename: string; mimeType: string };
}): { raw: string; threadId?: string } {
  if (!attachment) {
    const lines = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "",
      body,
    ];
    return {
      raw: toBase64Url(lines.join("\r\n")),
      ...(threadId ? { threadId } : {}),
    };
  }

  const boundary = `squibble_${Date.now()}`;
  const bodyBase64 = Buffer.from(body).toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? "";
  const attachBase64 = attachment.base64.match(/.{1,76}/g)?.join("\r\n") ?? attachment.base64;

  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    bodyBase64,
    "",
    `--${boundary}`,
    `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${attachment.filename}"`,
    "",
    attachBase64,
    "",
    `--${boundary}--`,
  ];
  return {
    raw: toBase64Url(lines.join("\r\n")),
    ...(threadId ? { threadId } : {}),
  };
}
