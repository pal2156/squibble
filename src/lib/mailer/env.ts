const REQUIRED_SMTP = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "FROM_EMAIL"] as const;
const REQUIRED_IMAP = ["IMAP_HOST", "IMAP_USER", "IMAP_PASS"] as const;

export function assertSmtpConfigured(): void {
  const missing = REQUIRED_SMTP.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing SMTP config in .env.local: ${missing.join(", ")}. Run the setup wizard to configure email sending.`);
  }
}

export function assertImapConfigured(): void {
  const missing = REQUIRED_IMAP.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing IMAP config in .env.local: ${missing.join(", ")}. Run the setup wizard to configure reply detection.`);
  }
}

export function isImapConfigured(): boolean {
  return REQUIRED_IMAP.every((key) => !!process.env[key]);
}
