"use client";

import { useState, useEffect } from "react";
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

function Mark({ height = 26 }: { height?: number }) {
  return (
    <img
      src="/landing/Logo2Squibble.png"
      alt=""
      style={{ display: "block", height: `${height}px`, width: "auto", flexShrink: 0, marginRight: "-4px" }}
      aria-hidden="true"
    />
  );
}

export function LandingNav() {
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
          <a className="nav-brand" href="/" style={{ textDecoration: "none" }}>
            <Mark height={28} />
            <span>Squibble</span>
          </a>
          <div className="nav-links">
            <a className="nav-link" href="/#product">Product</a>
            <a className="nav-link" href="/#pricing">Pricing</a>
            <a className="nav-link" href="/about">Company</a>
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleGoogleLogin}>
            Get started
          </button>
        </div>
      </nav>
    </div>
  );
}
