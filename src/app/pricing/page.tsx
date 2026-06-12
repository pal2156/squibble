"use client";

import "../landing.css";

function base64UrlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function signInWithGoogle() {
  const raw = new Uint8Array(64);
  crypto.getRandomValues(raw);
  const codeVerifier = base64UrlEncode(raw);

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  const codeChallenge = base64UrlEncode(new Uint8Array(digest));

  const redirectUri = `${window.location.origin}/auth/callback`;
  document.cookie = `g_cv=${codeVerifier}; path=/; max-age=300; SameSite=Lax`;
  document.cookie = `g_ruri=${encodeURIComponent(redirectUri)}; path=/; max-age=300; SameSite=Lax`;

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly",
    access_type: "offline",
    prompt: "consent",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  })}`;
}

async function handleGoogleLogin() {
  document.cookie = `squibble_auth_next=${encodeURIComponent("/dashboard")}; path=/; max-age=300; SameSite=Lax`;
  await signInWithGoogle();
}

async function handleGoogleLoginForPlan(plan: "pro" | "max") {
  document.cookie = `squibble_auth_next=${encodeURIComponent(`/api/stripe/redirect?plan=${plan}`)}; path=/; max-age=300; SameSite=Lax`;
  await signInWithGoogle();
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
