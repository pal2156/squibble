"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";

export default function ProfileCompletePage() {
  const [firstName, setFirstName] = useState("there");

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then(({ profile }) => {
        if (profile?.name) {
          setFirstName(profile.name.split(" ")[0]);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight mb-3" style={{ color: "var(--ink)" }}>
            You&apos;re all set, {firstName}. Your profile is saved. Now let&apos;s put it to work.
          </h1>
          <p className="text-sm mb-2" style={{ color: "var(--ink-secondary)" }}>
            Tell us what you want to research and which university to target. We&apos;ll handle the rest.
          </p>
          <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
            A campaign targets faculty at one university in your field. You can run multiple campaigns.
          </p>
        </div>

        <Link href="/campaign" className="block">
          <button
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold tracking-wide transition-all duration-150"
            style={{ background: "#1F4959", color: "#fff", boxShadow: "0 0 16px rgba(31,73,89,0.4)" }}
          >
            START YOUR FIRST CAMPAIGN
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </Link>
      </div>
    </div>
  );
}
