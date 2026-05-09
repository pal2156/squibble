"use client";

import Link from "next/link";
import { student } from "@/lib/mock-data";
import { ArrowRight, GraduationCap, BookOpen, Briefcase } from "lucide-react";

export default function ProfileCompletePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-7">
          <h1 className="text-2xl font-bold tracking-tight mb-1.5" style={{ color: "var(--ink)" }}>
            You're all set, {student.name.split(" ")[0]}.
          </h1>
          <p className="text-xs" style={{ color: "var(--ink-secondary)" }}>
            Your profile is saved. Now let's put it to work.
          </p>
        </div>

        {/* CV facts card */}
        <div
          className="rounded-xl border p-5 mb-4"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border-subtle)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-wider mb-4"
            style={{ color: "var(--ink-muted)" }}
          >
            Start your first campaign
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <GraduationCap className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--ink-muted)" }} />
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                  {student.name} · {student.university}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-secondary)" }}>{student.year}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <BookOpen className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--ink-muted)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                {student.fields.join(" & ")} — {student.subfield}
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Briefcase className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--ink-muted)" }} />
              <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>{student.experience}</p>
            </div>
          </div>
        </div>

        {/* Campaign explainer */}
        <p className="text-xs mb-5" style={{ color: "var(--ink-secondary)" }}>
          Tell us what you want to research and which university to target. We'll handle the rest.
        </p>

        {/* CTA */}
        <Link href="/campaign/new" className="block">
          <button
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold transition-all duration-150"
            style={{ background: "#1F4959", color: "#fff", boxShadow: "0 0 16px rgba(31,73,89,0.4)" }}
          >
            Start your first campaign
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </Link>
      </div>
    </div>
  );
}
