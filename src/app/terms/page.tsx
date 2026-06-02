import type { Metadata } from "next";
import "@/app/landing.css";
import { LandingNav } from "@/components/LandingNav";
import { LandingFooter } from "@/components/LandingFooter";

export const metadata: Metadata = {
  title: "Terms of Service | Squibble",
  description: "Squibble Terms of Service",
};

export default function TermsPage() {
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
        <h2 className="sr-only">Squibble Terms of Service</h2>
        <div style={{ maxWidth: "680px", padding: "2rem 0", fontSize: "15px", lineHeight: 1.7, color: "var(--color-text-primary)" }}>

          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", margin: "0 0 0.5rem" }}>Last updated: June 1, 2026</p>
          <h1 style={{ fontSize: "28px", fontWeight: 600, color: "var(--color-text-primary)", margin: "0 0 2rem" }}>Terms of Service</h1>

          <p style={{ color: "var(--color-text-secondary)", margin: "0 0 2rem" }}>These Terms of Service govern your use of Squibble (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;), operated by Paul Lacarrière, accessible at squibble.pro. By creating an account or using the service, you agree to these terms.</p>

          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "2rem 0 0.75rem" }}>1. The service</h2>
          <p style={{ color: "var(--color-text-secondary)", margin: "0 0 1rem" }}>Squibble is an AI-powered platform that helps students find and contact academic researchers. It finds faculty profiles, drafts personalized outreach emails, and sends them from your Gmail account. You remain responsible for all emails sent through our account.</p>

          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "2rem 0 0.75rem" }}>2. Eligibility</h2>
          <p style={{ color: "var(--color-text-secondary)", margin: "0 0 1rem" }}>You must be at least 13 years old to use Squibble. By using the service, you represent that you meet this requirement.</p>

          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "2rem 0 0.75rem" }}>3. Your account</h2>
          <p style={{ color: "var(--color-text-secondary)", margin: "0 0 1rem" }}>You sign in via Google OAuth. You are responsible for all activity that occurs under your account. Do not share your account with others.</p>

          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "2rem 0 0.75rem" }}>4. Acceptable use</h2>
          <p style={{ color: "var(--color-text-secondary)", margin: "0 0 0.75rem" }}>You agree to use Squibble only for legitimate academic research outreach. You may not use the service to:</p>
          <ul style={{ margin: "0 0 1rem", paddingLeft: "1.25rem", color: "var(--color-text-secondary)" }}>
            <li style={{ marginBottom: "0.5rem" }}>Send spam, bulk unsolicited messages, or emails unrelated to academic research</li>
            <li style={{ marginBottom: "0.5rem" }}>Harass, threaten, or impersonate any person</li>
            <li style={{ marginBottom: "0.5rem" }}>Violate any applicable law or regulation</li>
            <li style={{ marginBottom: "0.5rem" }}>Attempt to reverse engineer, scrape, or interfere with the service</li>
            <li style={{ marginBottom: "0.5rem" }}>Use the service on behalf of a third party without their knowledge</li>
          </ul>
          <p style={{ color: "var(--color-text-secondary)", margin: "0 0 1rem" }}>We reserve the right to suspend or terminate accounts that violate these terms, at our sole discretion.</p>

          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "2rem 0 0.75rem" }}>5. Gmail access</h2>
          <p style={{ color: "var(--color-text-secondary)", margin: "0 0 1rem" }}>By connecting your Gmail account, you authorize Squibble to send emails on your behalf and to read replies from professors you contacted through the service. You can revoke this access at any time via your Google account settings at <a href="https://myaccount.google.com/permissions" style={{ color: "var(--color-text-info)" }}>myaccount.google.com/permissions</a>. Revoking access will disable outreach and reply tracking features.</p>

          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "2rem 0 0.75rem" }}>6. Payments</h2>
          <p style={{ color: "var(--color-text-secondary)", margin: "0 0 1rem" }}>Pro and Max plans are one-time purchases. There are no subscriptions or recurring charges. All payments are processed by Stripe. By purchasing a plan, you agree to Stripe&apos;s terms of service.</p>

          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "2rem 0 0.75rem" }}>7. Refunds</h2>
          <p style={{ color: "var(--color-text-secondary)", margin: "0 0 0.75rem" }}>All purchases are final. We do not offer refunds except in the following circumstances:</p>
          <ul style={{ margin: "0 0 1rem", paddingLeft: "1.25rem", color: "var(--color-text-secondary)" }}>
            <li style={{ marginBottom: "0.5rem" }}><span style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>Service malfunction.</span> If a bug in our service causes professor credits to be deducted without the corresponding emails being sent or professors being found, we will issue a partial or full refund at our discretion depending on the extent of the issue.</li>
            <li style={{ marginBottom: "0.5rem" }}><span style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>Incorrect credit deduction.</span> If you were charged more credits than the number of professors available on a given faculty page, we will refund the difference.</li>
            <li style={{ marginBottom: "0.5rem" }}><span style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>Extended service unavailability.</span> If the service is inaccessible for more than 48 consecutive hours and you were unable to use credits you paid for, we may issue a partial refund at our discretion.</li>
          </ul>
          <p style={{ color: "var(--color-text-secondary)", margin: "0 0 1rem" }}>To request a refund, contact us at <a href="mailto:contact@squibble.pro" style={{ color: "var(--color-text-info)" }}>contact@squibble.pro</a> with a description of the issue. We review all requests and respond within 5 business days.</p>

          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "2rem 0 0.75rem" }}>8. No guarantee of results</h2>
          <p style={{ color: "var(--color-text-secondary)", margin: "0 0 1rem" }}>Squibble automates the outreach process but does not guarantee any particular outcome, including responses from professors, offers of research positions, or acceptance into any program. Response rates depend on factors entirely outside our control, including individual professors&apos; availability, interest, and workload. Purchasing a plan is not a guarantee of results.</p>

          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "2rem 0 0.75rem" }}>9. Intellectual property</h2>
          <p style={{ color: "var(--color-text-secondary)", margin: "0 0 1rem" }}>Squibble and its content, features, and functionality are owned by Paul Lacarrière. You may not copy, modify, or distribute any part of the service without written permission. You retain ownership of all content you provide, including your profile information and resume.</p>

          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "2rem 0 0.75rem" }}>10. Disclaimer of warranties</h2>
          <p style={{ color: "var(--color-text-secondary)", margin: "0 0 1rem" }}>Squibble is provided &ldquo;as is&rdquo; without warranties of any kind, express or implied. We do not warrant that the service will be uninterrupted, error-free, or free of harmful components. Your use of the service is at your own risk.</p>

          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "2rem 0 0.75rem" }}>11. Limitation of liability</h2>
          <p style={{ color: "var(--color-text-secondary)", margin: "0 0 1rem" }}>To the fullest extent permitted by law, Paul Lacarrière and Squibble shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of or inability to use the service, including but not limited to lost opportunities, lost data, or dissatisfaction with outreach results. Our total liability to you shall not exceed the amount you paid for the service in the 12 months prior to the claim.</p>

          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "2rem 0 0.75rem" }}>12. Termination</h2>
          <p style={{ color: "var(--color-text-secondary)", margin: "0 0 1rem" }}>You may stop using the service at any time. We may suspend or terminate your account if you violate these terms. Upon termination, your right to use the service ceases immediately. You may request deletion of your data by emailing <a href="mailto:contact@squibble.pro" style={{ color: "var(--color-text-info)" }}>contact@squibble.pro</a>.</p>

          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "2rem 0 0.75rem" }}>13. Changes to these terms</h2>
          <p style={{ color: "var(--color-text-secondary)", margin: "0 0 1rem" }}>We may update these terms from time to time. If we make material changes, we will notify you by email or by posting a notice on squibble.pro. Continued use of the service after changes constitutes acceptance of the updated terms.</p>

          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "2rem 0 0.75rem" }}>14. Governing law</h2>
          <p style={{ color: "var(--color-text-secondary)", margin: "0 0 1rem" }}>These terms are governed by the laws of the State of New York, without regard to its conflict of law provisions.</p>

          <h2 style={{ fontSize: "18px", fontWeight: 600, margin: "2rem 0 0.75rem" }}>15. Contact</h2>
          <p style={{ color: "var(--color-text-secondary)", margin: "0 0 1rem" }}>If you have any questions about these terms, please contact us at <a href="mailto:contact@squibble.pro" style={{ color: "var(--color-text-info)" }}>contact@squibble.pro</a>.</p>

        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
