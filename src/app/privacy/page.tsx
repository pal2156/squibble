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
          Last updated: June 1, 2026
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
                Your name and email address, provided via Google OAuth.
              </li>
              <li style={liStyle}>
                <strong style={strongStyle}>Profile information.</strong>{" "}
                Information you provide about yourself, including your school, year, major, coursework,
                research experience, skills, and extracurricular activities. If you upload a resume, we
                extract and store relevant fields from it.
              </li>
              <li style={liStyle}>
                <strong style={strongStyle}>Outreach data.</strong>{" "}
                The emails Squibble drafts and sends on your behalf, including the professors contacted,
                the content of those emails, and any replies received.
              </li>
              <li style={liStyle}>
                <strong style={strongStyle}>Gmail access.</strong>{" "}
                We request access to your Gmail account solely to send emails on your behalf and to read
                replies from professors you contacted through Squibble. We do not access any other emails
                in your inbox.
              </li>
            </ul>
          </div>

          <div>
            <h2 style={sectionHeadStyle}>2. How we use your information</h2>
            <ul style={listStyle}>
              <li style={liStyle}>To generate personalized outreach emails on your behalf</li>
              <li style={liStyle}>To send those emails through your Gmail account</li>
              <li style={liStyle}>To detect and display replies from professors you contacted</li>
              <li style={liStyle}>To maintain your campaign history and tracking dashboard</li>
              <li style={liStyle}>To process payments through our payment provider, Stripe</li>
            </ul>
            <p style={{ ...bodyStyle, marginTop: "16px" }}>
              We do not sell your data. We do not use your data for advertising.
            </p>
          </div>

          <div>
            <h2 style={sectionHeadStyle}>3. Gmail data</h2>
            <p style={bodyStyle}>Our use of Gmail data is limited to the following:</p>
            <ul style={listStyle}>
              <li style={liStyle}>Sending emails to professors on your behalf using your Gmail account</li>
              <li style={liStyle}>
                Reading replies to emails sent through Squibble, to update your tracking dashboard
              </li>
            </ul>
            <p style={{ ...bodyStyle, marginTop: "16px" }}>
              We never read, store, or process any other emails in your Gmail inbox. Our access is governed
              by Google's OAuth scopes:{" "}
              <code style={codeStyle}>gmail.send</code> and{" "}
              <code style={codeStyle}>gmail.readonly</code>.
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
                We use the Claude API to generate email drafts and analyze professor profiles. Your profile
                and campaign data is sent to Anthropic's API for this purpose.
              </li>
              <li style={liStyle}>
                <strong style={strongStyle}>Supabase.</strong>{" "}
                We use Supabase to store your account data, profile, and campaign history.
              </li>
              <li style={liStyle}>
                <strong style={strongStyle}>Stripe.</strong>{" "}
                We use Stripe as our payment processor. Stripe handles all payment data; we do not store
                your payment information.
              </li>
            </ul>
          </div>

          <div>
            <h2 style={sectionHeadStyle}>5. Data retention</h2>
            <p style={bodyStyle}>
              We retain your data for as long as your account is active. You can request deletion of your
              account and all associated data at any time by emailing{" "}
              <a href="mailto:contact@squibble.pro" style={linkStyle}>
                contact@squibble.pro
              </a>
              .
            </p>
          </div>

          <div>
            <h2 style={sectionHeadStyle}>6. Security</h2>
            <p style={bodyStyle}>
              We take reasonable measures to protect your information, including using HTTPS for all data
              transmission and storing data with Supabase, which encrypts data at rest. No method of
              transmission or storage is 100% secure, and we cannot guarantee absolute security.
            </p>
          </div>

          <div>
            <h2 style={sectionHeadStyle}>7. Children's privacy</h2>
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
