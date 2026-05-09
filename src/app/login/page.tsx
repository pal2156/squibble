"use client";

import { Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "email profile https://www.googleapis.com/auth/gmail.send",
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#07070f" }}
    >
      <div className="flex flex-col items-center gap-8">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(92,124,137,0.2)" }}
          >
            <Zap className="w-4 h-4" style={{ color: "#5C7C89" }} />
          </div>
          <span
            className="text-xl font-semibold tracking-tight"
            style={{ color: "#FFFFFF" }}
          >
            Squibble
          </span>
        </div>

        {/* Card */}
        <div
          className="flex flex-col items-center gap-6 p-8 rounded-2xl"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            width: "360px",
          }}
        >
          <div className="text-center space-y-1.5">
            <h1
              className="text-lg font-semibold"
              style={{ color: "#FFFFFF" }}
            >
              Welcome to Squibble
            </h1>
            <p
              className="text-sm"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              Sign in to start landing research positions.
            </p>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl text-sm font-medium transition-colors"
            style={{
              background: "rgba(255,255,255,0.07)",
              color: "#FFFFFF",
              border: "1px solid rgba(255,255,255,0.11)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.11)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.07)";
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              aria-hidden="true"
            >
              <path
                d="M17.64 9.2045c0-.6381-.0573-1.2527-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"
                fill="#4285F4"
              />
              <path
                d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104H.957v2.3318C2.4382 15.9832 5.4818 18 9 18z"
                fill="#34A853"
              />
              <path
                d="M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1023-1.17.2822-1.71V4.9582H.957C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.957 4.0418L3.964 10.71z"
                fill="#FBBC05"
              />
              <path
                d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.957 4.9582L3.964 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>
        </div>

        <p
          className="text-xs text-center max-w-xs"
          style={{ color: "rgba(255,255,255,0.2)" }}
        >
          By continuing, you grant Squibble permission to send emails on your
          behalf via Gmail.
        </p>
      </div>
    </div>
  );
}
