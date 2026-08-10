import nodemailer from "nodemailer";
import { assertSmtpConfigured } from "./env";
import { generateMessageId } from "./correlation";

function getTransport() {
  assertSmtpConfigured();
  const port = Number(process.env.SMTP_PORT ?? 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  body: string;
  attachment?: { base64: string; filename: string; mimeType: string };
}): Promise<{ messageId: string }> {
  const fromName = process.env.FROM_NAME;
  const fromEmail = process.env.FROM_EMAIL!;
  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
  const messageId = generateMessageId();

  const transport = getTransport();
  await transport.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.body,
    messageId,
    attachments: opts.attachment
      ? [{
          filename: opts.attachment.filename,
          content: Buffer.from(opts.attachment.base64, "base64"),
          contentType: opts.attachment.mimeType,
        }]
      : undefined,
  });

  return { messageId };
}

export async function verifySmtpConnection(): Promise<void> {
  await getTransport().verify();
}
