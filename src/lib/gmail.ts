import { google } from "googleapis";

// Required env vars (add to .env.local):
//   GOOGLE_CLIENT_ID     — same client ID used in Supabase Google OAuth provider
//   GOOGLE_CLIENT_SECRET — same client secret used in Supabase Google OAuth provider

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

// Build a minimal RFC 2822 MIME message string
export function buildMimeMessage({
  to,
  from,
  subject,
  body,
  threadId,
}: {
  to: string;
  from: string;
  subject: string;
  body: string;
  threadId?: string;
}): { raw: string; threadId?: string } {
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
