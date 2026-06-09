"use client";

import { createClient } from "@/lib/supabase/client";
import "../landing.css";

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
  await signInWithGoogle(`${window.location.origin}/auth/callback`);
}

async function handleGoogleLoginForPlan(plan: "pro" | "max") {
  document.cookie = `squibble_plan_intent=${plan}; path=/; max-age=300; SameSite=Lax`;
  const next = encodeURIComponent(`/api/stripe/redirect?plan=${plan}`);
  await signInWithGoogle(`${window.location.origin}/auth/callback?next=${next}`);
}

function Check() {
  return (
    <span className="ck">
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
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

export default function PricingPage() {
  return (
    <div className="lp-page" style={{ paddingTop: 80, paddingBottom: 80 }}>
      <div className="container-narrow">
        <div className="section-header">
          <div className="eyebrow"><span className="dot"></span>Pricing</div>
          <h2>Simple pricing</h2>
          <p>Start free. Buy more when you need it.</p>
        </div>
        <div className="pricing-grid">
          <div className="price-card">
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
          <div className="price-card featured">
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
          <div className="price-card">
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
    </div>
  );
}
