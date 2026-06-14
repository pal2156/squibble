"use client";

import "@/app/landing.css";
import { LandingNav } from "@/components/LandingNav";
import { LandingFooter } from "@/components/LandingFooter";

export default function PrivacyPage() {
  return (
    <div className="lp-page" style={{ background: "var(--platinum)" }}>
      <LandingNav />

      <main
        style={{
          maxWidth: "680px",
          margin: "0 auto",
          padding: "120px 24px 100px",
        }}
      >
        <p style={{ fontSize: "13px", color: "var(--slate)", margin: "0 0 0.5rem" }}>
          Last updated: June 8, 2026
        </p>
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 600,
            color: "var(--jet)",
            margin: "0 0 2rem",
          }}
        >
          Privacy Policy
        </h1>
        <p style={{ fontSize: "15px", lineHeight: 1.75, color: "var(--slate)", marginBottom: "48px" }}>
          This Privacy Policy explains how Squibble ("we", "us", or "our"), operated by Paul Lacarriere,
          collects, uses, and protects your information when you use squibble.pro.
        </p>

        <div
          style={{
            height: "1px",
            background: "var(--sky)",
            marginBottom: "48px",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>

          <div>
            <h2 style={sectionHeadStyle}>1. Information we collect</h2>
            <p style={bodyStyle}>
              We collect the following information when you create an account and use our service:
            </p>
            <ul style={listStyle}>
              <li style={liStyle}>
                <strong style={strongStyle}>Account information.</strong>{" "}
                Your name, email address, and profile photo, provided when you sign in with Google.
              </li>
              <li style={liStyle}>
                <strong style={strongStyle}>Profile information.</strong>{" "}
                Information you provide about yourself: your school, academic year, major, relevant
                coursework, research experience, skills, extracurricular activities, and any additional
                notes you choose to add. If you upload a resume, we store the PDF file and extract its
                contents to pre-fill your profile fields.
              </li>
              <li style={liStyle}>
                <strong style={strongStyle}>Campaign data.</strong>{" "}
                The parameters you set when starting a campaign: your research interest, target university,
                position type, and scheduling preferences.
              </li>
              <li style={liStyle}>
                <strong style={strongStyle}>Professor data.</strong>{" "}
                For each campaign, we store the AI-generated shortlist of professors, including their
                names, titles, departments, university, email addresses, research areas, and fit scores.
              </li>
              <li style={liStyle}>
                <strong style={strongStyle}>Email records.</strong>{" "}
                The subject, body, and status of every email drafted or sent through Squibble, along with
                the Gmail message ID, Gmail thread ID, and timestamp of each sent email.
              </li>
              <li style={liStyle}>
                <strong style={strongStyle}>Reply data.</strong>{" "}
                The body text of professor replies detected in your Gmail inbox that belong to Squibble
                email threads, along with a classification of each reply as positive or negative.
              </li>
              <li style={liStyle}>
                <strong style={strongStyle}>Bounce records.</strong>{" "}
                If a sent email bounces, we record the bounce timestamp and whether a credit was
                automatically refunded.
              </li>
              <li style={liStyle}>
                <strong style={strongStyle}>Gmail watch state.</strong>{" "}
                An opaque inbox history cursor used to track which Gmail inbox changes have already been
                processed, so we do not reprocess the same messages.
              </li>
              <li style={liStyle}>
                <strong style={strongStyle}>Plan and credit data.</strong>{" "}
                Your current plan tier, your remaining search and send credits, and your Stripe customer ID.
              </li>
              <li style={liStyle}>
                <strong style={strongStyle}>Purchase history.</strong>{" "}
                A record of each completed purchase, including the Stripe session ID, plan selected, credits
                granted, and purchase timestamp. This is used for payment idempotency.
              </li>
            </ul>
          </div>

          <div>
            <h2 style={sectionHeadStyle}>2. How we use your information</h2>
            <ul style={listStyle}>
              <li style={liStyle}>To authenticate you via Google Sign-In.</li>
              <li style={liStyle}>
                To discover relevant professors: your campaign parameters and profile are sent to Claude
                (Anthropic{"'"}s AI) to generate a ranked shortlist.
              </li>
              <li style={liStyle}>
                To draft personalized outreach emails: your profile, the campaign context, and each
                professor{"'"}s research summary are sent to Claude to write a tailored email for each
                professor.
              </li>
              <li style={liStyle}>
                To send those emails through your Gmail account. If you have uploaded a resume, it is
                attached as a PDF to each outgoing email.
              </li>
              <li style={liStyle}>
                To detect replies: we monitor your Gmail inbox via Google Pub/Sub. When a new message
                arrives, we check whether it belongs to a Squibble email thread and, if so, read its body
                and classify it as positive or negative using Claude.
              </li>
              <li style={liStyle}>
                To detect bounced emails and automatically refund a credit when the bounce was caused by a
                bad address we sourced, within 48 hours of the original send.
              </li>
              <li style={liStyle}>To display your campaign history, reply status, and usage statistics on your dashboard.</li>
              <li style={liStyle}>To process one-time payments through Stripe.</li>
            </ul>
            <p style={{ ...bodyStyle, marginTop: "16px" }}>
              We do not sell your data. We do not use your data for advertising.
            </p>
          </div>

          <div>
            <h2 style={sectionHeadStyle}>3. Gmail data</h2>
            <p style={bodyStyle}>
              Our use of Gmail data is strictly limited to operating Squibble on your behalf.
            </p>
            <p style={{ ...bodyStyle, marginTop: "16px" }}>
              <strong style={strongStyle}>Scopes we request:</strong>{" "}
              <code style={codeStyle}>gmail.send</code> and{" "}
              <code style={codeStyle}>gmail.readonly</code>.
            </p>
            <p style={{ ...bodyStyle, marginTop: "16px" }}>
              <strong style={strongStyle}><code style={codeStyle}>gmail.send</code></strong>{" "}
              is used to send emails to professors using your Gmail account as the sender.
            </p>
            <p style={{ ...bodyStyle, marginTop: "16px" }}>
              <strong style={strongStyle}><code style={codeStyle}>gmail.readonly</code></strong>{" "}
              is used exclusively to monitor your inbox for activity related to Squibble campaigns. When
              Google notifies us of new inbox messages via Pub/Sub, we fetch the sender and subject of
              each message to screen for relevant activity, and fetch the full message body in three cases:
              (1) messages in a thread Squibble originally created, (2) bounce notification messages whose
              sender or subject indicates a mail delivery failure, and (3) messages from senders whose
              address matches a professor Squibble previously emailed, to capture replies sent in a fresh
              thread. We never read, index, store, or process any other emails in your Gmail account.
            </p>
            <p style={{ ...bodyStyle, marginTop: "16px" }}>
              Your Gmail access token and refresh token are stored securely in our database. They are
              used only to call the Gmail API on your behalf and are never shared with any third party
              other than Google.
            </p>
            <p style={{ ...bodyStyle, marginTop: "16px" }}>
              Our use of Google user data complies with the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                style={linkStyle}
                target="_blank"
                rel="noopener noreferrer"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
          </div>

          <div>
            <h2 style={sectionHeadStyle}>4. Data sharing</h2>
            <p style={bodyStyle}>
              We share your data only with the following third parties, as necessary to operate the service:
            </p>
            <ul style={listStyle}>
              <li style={liStyle}>
                <strong style={strongStyle}>Anthropic.</strong>{" "}
                We use the Claude API to discover professors, draft emails, and classify replies. Your
                profile information, CV content, campaign parameters, professor research summaries, draft
                email content, and professor reply text are sent to Anthropic{"'"}s API for these
                purposes. Anthropic{"'"}s privacy policy governs their handling of API data.
              </li>
              <li style={liStyle}>
                <strong style={strongStyle}>Supabase.</strong>{" "}
                We use Supabase to store your account, profile, campaign history, emails, replies, and
                Gmail watch state. Supabase is hosted on AWS infrastructure.
              </li>
              <li style={liStyle}>
                <strong style={strongStyle}>Stripe.</strong>{" "}
                We use Stripe to process one-time payments. When you complete a purchase, we pass your
                Squibble account ID to Stripe for attribution. We do not store your payment card
                information.
              </li>
              <li style={liStyle}>
                <strong style={strongStyle}>Google.</strong>{" "}
                Emails are sent via the Gmail API, and we receive inbox activity notifications via Google
                Pub/Sub. Google{"'"}s privacy policy governs their handling of that data.
              </li>
            </ul>
            <p style={{ ...bodyStyle, marginTop: "16px" }}>
              We do not share your data with any other third parties.
            </p>
          </div>

          <div>
            <h2 style={sectionHeadStyle}>5. Data retention</h2>
            <p style={bodyStyle}>
              We retain your data for as long as your account is active. You can delete your account at
              any time from the Settings page; this immediately and permanently removes your account and
              all associated data. You can also request deletion by emailing{" "}
              <a href="mailto:contact@squibble.pro" style={linkStyle}>
                contact@squibble.pro
              </a>
              .
            </p>
          </div>

          <div>
            <h2 style={sectionHeadStyle}>6. Security</h2>
            <p style={bodyStyle}>
              We take reasonable measures to protect your information. All data is transmitted over
              HTTPS. Data is stored with Supabase, which encrypts data at rest. Row-level security
              ensures that each user{"'"}s data is accessible only to that user. Gmail credentials are
              stored server-side and never exposed to the browser or to other users. No method of
              transmission or storage is 100% secure, and we cannot guarantee absolute security.
            </p>
          </div>

          <div>
            <h2 style={sectionHeadStyle}>7. Children{"'"}s privacy</h2>
            <p style={bodyStyle}>
              Squibble is not directed at children under the age of 13. We do not knowingly collect
              personal information from children under 13. If you believe we have collected such
              information, please contact us at{" "}
              <a href="mailto:contact@squibble.pro" style={linkStyle}>
                contact@squibble.pro
              </a>
              .
            </p>
          </div>

          <div>
            <h2 style={sectionHeadStyle}>8. Changes to this policy</h2>
            <p style={bodyStyle}>
              We may update this Privacy Policy from time to time. If we make material changes, we will
              notify you by email or by posting a notice on squibble.pro. Continued use of the service
              after changes constitutes acceptance of the updated policy.
            </p>
          </div>

          <div>
            <h2 style={sectionHeadStyle}>9. Contact</h2>
            <p style={bodyStyle}>
              If you have any questions about this Privacy Policy, please contact us at{" "}
              <a href="mailto:contact@squibble.pro" style={linkStyle}>
                contact@squibble.pro
              </a>
              .
            </p>
          </div>

        </div>
      </main>

      <LandingFooter />
    </div>
  );
}

const sectionHeadStyle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 600,
  color: "var(--jet)",
  marginBottom: "12px",
};

const bodyStyle: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: 1.75,
  color: "var(--slate)",
};

const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: "12px 0 0",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const liStyle: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: 1.75,
  color: "var(--slate)",
  paddingLeft: "16px",
  position: "relative",
};

const strongStyle: React.CSSProperties = {
  color: "var(--jet)",
  fontWeight: 600,
};

const codeStyle: React.CSSProperties = {
  fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, monospace",
  fontSize: "13px",
  background: "rgba(103, 142, 141, 0.12)",
  color: "var(--slate)",
  padding: "1px 5px",
  borderRadius: "4px",
};

const linkStyle: React.CSSProperties = {
  color: "var(--cyan)",
  textDecoration: "underline",
};
