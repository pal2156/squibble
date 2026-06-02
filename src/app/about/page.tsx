"use client";

import "@/app/landing.css";
import { LandingNav } from "@/components/LandingNav";
import { LandingFooter } from "@/components/LandingFooter";

export default function AboutPage() {
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
        <h2 className="sr-only">About Squibble</h2>

        <h1
          style={{
            fontSize: "28px",
            fontWeight: 600,
            margin: "0 0 2rem",
            color: "var(--jet)",
          }}
        >
          What Squibble is
        </h1>

        <p style={bodyStyle}>
          Squibble is an AI-powered platform that automates academic research outreach for
          students. You tell us which university you are targeting and what you want to
          research. Squibble finds the relevant faculty, ranks them by fit against your
          profile, drafts a personalized email for each one, and sends them directly from
          your Gmail account. When a professor replies, you see it instantly in your
          dashboard.
        </p>

        <p style={bodyStyle}>
          The core idea is simple: students should not have to do hours of work before
          knowing if anyone will respond. Squibble handles the outreach upfront so you only
          invest real effort after a professor replies.
        </p>

        <div style={dividerStyle} />

        <h2 style={sectionHeadStyle}>The founder</h2>

        <p style={bodyStyle}>
          Paul Lacarriere is a freshman studying Mathematics and Physics at Columbia
          University. When he was looking for a research position, he tried doing the
          outreach manually and found it took far too long. He designed a structured
          workflow to automate the process, ran it himself, and found his research position
          in a single day. Squibble is that workflow, built into a product.
        </p>

        <div style={dividerStyle} />

        <p style={{ ...bodyStyle, marginBottom: 0 }}>
          Questions or feedback? Reach us at{" "}
          <a href="mailto:contact@squibble.pro" style={linkStyle}>
            contact@squibble.pro
          </a>
          .
        </p>
      </main>

      <LandingFooter />
    </div>
  );
}

const bodyStyle: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: 1.7,
  color: "var(--slate)",
  marginBottom: "1.25rem",
};

const sectionHeadStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 600,
  color: "var(--jet)",
  margin: "0 0 0.75rem",
};

const dividerStyle: React.CSSProperties = {
  borderTop: "0.5px solid var(--sky)",
  margin: "2.5rem 0",
};

const linkStyle: React.CSSProperties = {
  color: "var(--cyan)",
  textDecoration: "underline",
};
