"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import WorkflowDiagram from "@/components/WorkflowDiagram";
import { CodeRedirectHandler } from "@/components/CodeRedirectHandler";
import "./landing.css";

// ─── Google OAuth ──────────────────────────────────────────────
async function signInWithGoogle(redirectTo: string) {
  const supabase = createClient();
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      scopes: "email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly",
      redirectTo,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });
}

async function handleGoogleLogin() {
  const dest = "/dashboard";
  document.cookie = `squibble_auth_next=${encodeURIComponent(dest)}; path=/; max-age=300; SameSite=Lax`;
  await signInWithGoogle(`${window.location.origin}/auth/callback`);
}

async function handleGoogleLoginForPlan(plan: "pro" | "max") {
  const dest = `/api/stripe/redirect?plan=${plan}`;
  document.cookie = `squibble_auth_next=${encodeURIComponent(dest)}; path=/; max-age=300; SameSite=Lax`;
  await signInWithGoogle(`${window.location.origin}/auth/callback`);
}

// ─── Brand mark ────────────────────────────────────────────────
function Mark({ height = 26 }: { height?: number }) {
  return (
    <img
      src="/landing/Logo2Squibble.png"
      alt=""
      style={{
        display: "block",
        height: `${height}px`,
        width: "auto",
        flexShrink: 0,
        marginRight: "-4px",
      }}
      aria-hidden="true"
    />
  );
}

// ─── Navbar ────────────────────────────────────────────────────
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className={`nav-wrap ${scrolled ? "scrolled" : ""}`}>
      <nav className="nav">
        <div className="nav-inner">
          <div className="nav-brand">
            <Mark height={28} />
            <span>Squibble</span>
          </div>
          <div className="nav-links">
            <a className="nav-link" href="#product">Product</a>
            <a className="nav-link" href="#pricing">Pricing</a>
            <a className="nav-link" href="/about">Company</a>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleGoogleLogin}
          >
            Get started
          </button>
        </div>
      </nav>
    </div>
  );
}

// ─── Demo mock components ──────────────────────────────────────
function FormMock() {
  return (
    <div className="mini-app">
      <div className="mini-app-head">
        <span className="chip-dot"></span>
        <span className="label">Profile</span>
      </div>
      <div className="mini-field">
        <div className="mini-label">Full name</div>
        <div className="mini-input">Priya Subramanian</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="mini-field">
          <div className="mini-label">School</div>
          <div className="mini-input">UC Berkeley</div>
        </div>
        <div className="mini-field">
          <div className="mini-label">Major</div>
          <div className="mini-input">Physics</div>
        </div>
      </div>
      <div className="mini-field" style={{ marginBottom: 0 }}>
        <div className="mini-label">Research experience</div>
        <div className="mini-input tall">Two semesters in a condensed matter lab. Worked on cryogenic STM measurements of topological insulators.</div>
      </div>
    </div>
  );
}

const PROF_LIST = [
  { initials: "MH", name: "Maya Hartwell",  dept: "Condensed Matter · Stanford",  match: "94%", research: "Topological phases in 2D materials, STM imaging.", selected: true },
  { initials: "DO", name: "Daniel Okonkwo", dept: "Quantum Materials · MIT",       match: "91%", research: "Superconducting heterostructures and Josephson effects." },
  { initials: "HP", name: "Hye-Jin Park",   dept: "Condensed Matter · Princeton", match: "87%", research: "Quantum Hall states in moiré graphene." },
];

function ProfMock() {
  return (
    <div className="mini-app">
      <div className="mini-app-head">
        <span className="chip-dot"></span>
        <span className="label">14 ranked · 3 selected</span>
      </div>
      {PROF_LIST.map((p, i) => (
        <div key={i} className={`prof-row ${p.selected ? "selected" : ""}`}>
          <div className="prof-avatar">{p.initials}</div>
          <div className="prof-body">
            <div className="prof-name">{p.name}</div>
            <div className="prof-dept">{p.dept}</div>
            <div className="prof-research">{p.research}</div>
          </div>
          <div className="match-badge">{p.match}</div>
        </div>
      ))}
    </div>
  );
}

function EmailMock() {
  return (
    <div className="mini-app">
      <div className="mini-app-head">
        <span className="chip-dot"></span>
        <span className="label">Draft 1 of 5</span>
      </div>
      <div className="email-meta">
        <div className="email-meta-row">
          <span className="k">To</span>
          <span className="v">m.hartwell@stanford.edu</span>
        </div>
        <div className="email-meta-row">
          <span className="k">Subject</span>
          <span className="v">Undergraduate interest — topological STM measurements</span>
        </div>
      </div>
      <div className="email-body">
        Dear Professor Hartwell,<br /><br />
        I&apos;m a sophomore physics major at UC Berkeley with two semesters of cryogenic STM work, and your group&apos;s recent paper on edge modes in WTe₂ was the most exciting thing I read last quarter.<br /><br />
        I&apos;d love to ask about a summer position…
      </div>
      <div className="email-actions">
        <button className="approve">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Approve
        </button>
        <button className="edit">Edit</button>
        <button className="skip">Skip</button>
      </div>
    </div>
  );
}

const TRACK_ROWS = [
  { name: "Maya Hartwell",  uni: "Stanford",  status: "positive", label: "Positive Reply" },
  { name: "Daniel Okonkwo", uni: "MIT",       status: "positive", label: "Positive Reply" },
  { name: "Hye-Jin Park",   uni: "Princeton", status: "neutral",  label: "No Response" },
  { name: "Elena Russo",    uni: "Columbia",  status: "positive", label: "Positive Reply" },
  { name: "Tobias Mehring", uni: "Caltech",   status: "neutral",  label: "No Response" },
];

function TrackMock() {
  return (
    <div className="mini-app">
      <div className="mini-app-head">
        <span className="chip-dot"></span>
        <span className="label">Last 30 days</span>
      </div>
      <div className="track-stat">
        <div>
          <div className="l">Response rate</div>
          <div className="v" style={{ marginTop: 4 }}>42%</div>
        </div>
        <span className="change" style={{ marginLeft: "auto" }}>+8% this month</span>
      </div>
      <div className="track-table">
        {TRACK_ROWS.map((r, i) => (
          <div key={i} className="track-row">
            <div className="who">
              {r.name}
              <span className="uni">{r.uni}</span>
            </div>
            <div className={`status-pill ${r.status}`}>
              <span className="pd"></span>
              {r.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── FAQ ───────────────────────────────────────────────────────
const FAQS = [
  { q: "How does Squibble find professors?", a: "Squibble uses AI to search the faculty pages of any university and rank professors by how well they match your research interests and background." },
  { q: "Will the emails actually sound like me?", a: "Yes. Every email is written using your specific profile, your coursework, your experience, and the professor's actual research. No two emails are the same." },
  { q: "What happens after a professor replies?", a: "Squibble detects the reply instantly via Gmail and classifies it as positive or negative. You see it in your dashboard and can reply directly." },
  { q: "Is my Gmail data private?", a: "Squibble only reads replies from professors you contacted through the platform. We never access any other emails in your inbox." },
  { q: "Can I use this for paid internships or just unpaid research?", a: "Both. You choose the position type when setting up each campaign." },
];

function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <div className="faq-list">
      {FAQS.map((f, i) => (
        <div key={i} className={`faq-item ${open === i ? "open" : ""}`}>
          <button className="faq-q" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
            <span>{f.q}</span>
            <span className="faq-toggle">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </span>
          </button>
          <div className="faq-a">
            <div className="faq-a-inner">{f.a}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Reveal hook ───────────────────────────────────────────────
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

// ─── Social proof ──────────────────────────────────────────────
/* MARQUEE DATA + COMPONENTS — commented out, restore to re-enable scrolling tickers
const UNIS = [
  { name: "Columbia",      logo: "/landing/logos/columbia.png" },
  { name: "Yale",          logo: "/landing/logos/yale.png" },
  { name: "Stanford",      logo: "/landing/logos/stanford.png" },
  { name: "MIT",           logo: "/landing/logos/mit.png" },
  { name: "Princeton",     logo: "/landing/logos/princeton.png" },
  { name: "Harvard",       logo: "/landing/logos/harvard.png" },
  { name: "UC Berkeley",   logo: "/landing/logos/berkeley.png" },
  { name: "Caltech",       logo: "/landing/logos/caltech.png" },
  { name: "Johns Hopkins", logo: "/landing/logos/johns-hopkins.png" },
  { name: "Chicago",       logo: "/landing/logos/chicago.png" },
];

const FIELDS = [
  "Condensed Matter Physics", "Behavioral Economics", "Computational Neuroscience",
  "Machine Learning", "Quantum Computing", "Cell Biology", "Political Theory",
  "Astrophysics", "Climate Science", "Cognitive Psychology",
];

function LogoTicker({ items, reverse }: { items: typeof UNIS; reverse: boolean }) {
  const seq = [...items, ...items];
  return (
    <div className="ticker-row logos">
      <div className={`ticker ${reverse ? "reverse" : ""}`}>
        {seq.map((it, i) => (
          <span key={i} className="ticker-logo">
            <img src={it.logo} alt={it.name} />
          </span>
        ))}
      </div>
    </div>
  );
}

function Ticker({ items, reverse }: { items: string[]; reverse: boolean }) {
  const seq = [...items, ...items];
  return (
    <div className={`ticker-row ${reverse ? "fields" : "unis"}`}>
      <div className={`ticker ${reverse ? "reverse" : ""}`}>
        {seq.map((it, i) => (
          <span key={i} className="ticker-item">
            {it}
            <span className="ticker-dot"></span>
          </span>
        ))}
      </div>
    </div>
  );
}
*/

// ─── Proof card ────────────────────────────────────────────────
function ProofCard() {
  return (
    <div className="proof-image reveal">
      <img src="/landing/proof-email.png" alt="Real reply email from a professor" />
    </div>
  );
}

// ─── Pricing helpers ───────────────────────────────────────────
function Check() {
  return (
    <span className="ck">
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

function ArrowRight({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

const FREE_FEATURES = [
  "3 professor searches",
  "2 personalized emails",
  "Reply tracking dashboard",
  "Gmail integration",
];
const PRO_FEATURES = [
  "30 professor searches",
  "30 personalized emails",
];
const MAX_FEATURES = [
  "75 professor searches",
  "75 personalized emails",
];

// ─── Landing page ──────────────────────────────────────────────
export default function LandingPage() {
  useReveal();

  return (
    <div className="lp-page">
      <CodeRedirectHandler />
      <Nav />

      {/* HERO */}
      <section className="hero" data-screen-label="01 Hero">
        <div className="hero-grid">
          <div className="hero-left">
            <h1 className="hero-headline">Land Research Positions</h1>
            <p className="hero-sub">Squibble finds professors, contacts them, and gets you replies.</p>
            <div className="hero-actions">
              <button className="btn btn-primary" onClick={handleGoogleLogin}>
                Get Started <ArrowRight />
              </button>
              <a className="btn btn-secondary" href="#product">See How It Works</a>
            </div>
          </div>
          <div className="hero-right">
            <WorkflowDiagram />
          </div>
        </div>
      </section>

      {/* PRODUCT DEMO */}
      <section className="demo" id="product" data-screen-label="02 Demo">
        <div className="container">
          <div className="section-header reveal">
            <div className="eyebrow"><span className="dot"></span>How it works</div>
            <h2>See Squibble in action</h2>
            <p>From profile to professor reply in minutes.</p>
          </div>
          <div className="demo-grid">
            <div className="demo-card reveal">
              <div className="demo-step">01 · Build your profile</div>
              <div className="demo-title">Tell Squibble who you are.</div>
              <FormMock />
            </div>
            <div className="demo-card reveal">
              <div className="demo-step">02 · Find ranked professors</div>
              <div className="demo-title">Faculty matched to your background.</div>
              <ProfMock />
            </div>
            <div className="demo-card reveal">
              <div className="demo-step">03 · Review your emails</div>
              <div className="demo-title">Personalized drafts, ready to send.</div>
              <EmailMock />
            </div>
            <div className="demo-card reveal">
              <div className="demo-step">04 · Track replies</div>
              <div className="demo-title">Every response, classified.</div>
              <TrackMock />
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="social" data-screen-label="03 Social proof">
        <div className="container">
          <div className="social-label">Research opportunities landed at</div>
          {/* MARQUEE TICKERS — commented out, restore with LogoTicker/Ticker components above
          <LogoTicker items={UNIS} reverse={false} />
          <div style={{ height: 20 }} />
          <Ticker items={FIELDS} reverse={true} />
          */}
          <div style={{ display: "flex", alignItems: "center", gap: 20, justifyContent: "center", padding: "24px 0" }}>
            <span className="ticker-logo">
              <img src="/landing/logos/columbia.png" alt="Columbia" />
            </span>
            <span className="ticker-item" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Condensed Matter Physics
            </span>
          </div>
        </div>
      </section>

      {/* PROOF */}
      <section className="proof" data-screen-label="04 Proof">
        <div className="container">
          <div className="section-header reveal">
            <div className="eyebrow"><span className="dot"></span>Proven results</div>
            <h2>Real replies from real professors.</h2>
          </div>
          <ProofCard />
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" data-screen-label="05 Pricing">
        <div className="container-narrow">
          <div className="section-header reveal">
            <div className="eyebrow"><span className="dot"></span>Pricing</div>
            <h2>Simple pricing</h2>
            <p>Start free. Buy more when you need it.</p>
          </div>
          <div className="pricing-grid">
            <div className="price-card reveal">
              <div className="price-name">Free</div>
              <div className="price-amount">
                <span className="num">$0</span>
              </div>
              <div className="price-sub">No credit card required.</div>
              <p className="price-subtitle">Try it out.</p>
              <ul className="price-features">
                {FREE_FEATURES.map((f, i) => <li key={i}><Check />{f}</li>)}
              </ul>
              <button className="price-cta" onClick={handleGoogleLogin}>Get started free</button>
            </div>
            <div className="price-card featured reveal">
              <div className="price-name">STANDARD</div>
              <div className="price-amount">
                <span className="num">$15</span>
              </div>
              <div className="price-sub">One-time</div>
              <p className="price-subtitle">Add 30 searches and 30 emails to your account.</p>
              <ul className="price-features">
                {PRO_FEATURES.map((f, i) => <li key={i}><Check />{f}</li>)}
              </ul>
              <button className="price-cta" onClick={() => handleGoogleLoginForPlan("pro")}>Buy</button>
            </div>
            <div className="price-card reveal">
              <div className="price-name">PLUS</div>
              <div className="price-amount">
                <span className="num">$25</span>
              </div>
              <div className="price-sub">One-time</div>
              <p className="price-subtitle">Add 75 searches and 75 emails to your account.</p>
              <ul className="price-features">
                {MAX_FEATURES.map((f, i) => <li key={i}><Check />{f}</li>)}
              </ul>
              <button className="price-cta" onClick={() => handleGoogleLoginForPlan("max")}>Buy</button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" data-screen-label="06 FAQ">
        <div className="container-narrow">
          <div className="section-header reveal">
            <div className="eyebrow"><span className="dot"></span>FAQ</div>
            <h2>Questions? Answered.</h2>
          </div>
          <div className="reveal">
            <FAQ />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="company" data-screen-label="08 Footer">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="mark-row">
              <Mark height={28} />
              <span className="name">Squibble</span>
            </div>
            <div className="tag">Land research positions, effortlessly.</div>
          </div>
          <div className="footer-col">
            <h4>Product</h4>
            <ul>
              <li><a href="#product">How it works</a></li>
              <li><a href="#pricing">Pricing</a></li>
              <li><a href="#faq">FAQ</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Company</h4>
            <ul>
              <li><a href="/about">About</a></li>
              <li><a href="mailto:contact@squibble.pro">Contact</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Legal</h4>
            <ul>
              <li><a href="/privacy">Privacy Policy</a></li>
              <li><a href="/terms">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          © 2025 Squibble. Built for students, by students.
        </div>
      </footer>
    </div>
  );
}
