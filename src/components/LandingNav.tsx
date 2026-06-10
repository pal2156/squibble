"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

async function signInWithGoogle(redirectTo: string) {
  const supabase = createClient();
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      scopes:
        "email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly",
      redirectTo,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });
}

async function handleGoogleLogin() {
  const dest = "/dashboard";
  document.cookie = `squibble_auth_next=${encodeURIComponent(dest)}; path=/; max-age=300; SameSite=Lax`;
  await signInWithGoogle(`${window.location.origin}/auth/callback`);
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
