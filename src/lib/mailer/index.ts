export { sendMail, verifySmtpConnection } from "./smtp";
export { pollForReplies, type PollResult } from "./imap";
export { isImapConfigured, assertSmtpConfigured, assertImapConfigured } from "./env";
export { matchReplyToEmail, generateMessageId } from "./correlation";
