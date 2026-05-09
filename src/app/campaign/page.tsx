"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

const MESSAGES = [
  "Finding the right department...",
  "Reading through the faculty...",
  "Matching professors to your profile...",
  "Almost there...",
];

// Each step: visible for 2000ms, then 500ms fade out = 2500ms per message
// Last message: visible for 2000ms, fades out 500ms, then modal closes
const STEP = 2500;
const FADE_START = 2000;

function LoadingModal({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [modalVisible, setModalVisible] = useState(true);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    MESSAGES.forEach((_, i) => {
      // Fade out each message before switching (including the last one)
      timers.push(setTimeout(() => setFading(true), i * STEP + FADE_START));

      if (i < MESSAGES.length - 1) {
        // Switch to next message and fade in
        timers.push(setTimeout(() => { setIndex(i + 1); setFading(false); }, (i + 1) * STEP));
      }
    });

    // After last message fades, fade out the modal then close
    timers.push(setTimeout(() => setModalVisible(false), MESSAGES.length * STEP));
    timers.push(setTimeout(onClose, MESSAGES.length * STEP + 300));

    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{
        background: "rgba(14, 22, 28, 0.45)",
        backdropFilter: "blur(4px)",
        opacity: modalVisible ? 1 : 0,
        transition: "opacity 300ms ease",
      }}
    >
      <div
        className="rounded-2xl px-10 py-10 flex flex-col items-center gap-7 shadow-2xl"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          minWidth: 320,
        }}
      >
        {/* Pulsing dots */}
        <div className="flex items-center gap-2.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block w-2 h-2 rounded-full"
              style={{
                background: "var(--accent)",
                animation: `pulse-dot 1.2s ease-in-out ${i * 0.18}s infinite`,
              }}
            />
          ))}
        </div>

        {/* Message */}
        <p
          className="text-sm font-medium text-center"
          style={{
            color: "var(--ink-secondary)",
            opacity: fading ? 0 : 1,
            transition: "opacity 420ms ease",
            minWidth: 240,
          }}
        >
          {MESSAGES[index]}
        </p>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1);   }
        }
      `}</style>
    </div>
  );
}

const inputStyle = (filled: boolean) => ({
  background: "var(--bg-card)",
  borderColor: filled ? "var(--border-strong)" : "var(--border-default)",
  color: "var(--ink)",
  outline: "none",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
});

const selectClassName =
  "w-full px-3.5 py-3 rounded-lg text-sm border transition-all duration-150 appearance-none";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-tertiary, var(--ink-secondary))" }}>
      {children}
    </p>
  );
}

export default function CampaignPage() {
  const router = useRouter();
  const [university, setUniversity] = useState("");
  const [research, setResearch] = useState("");
  const [positionType, setPositionType] = useState("");
  const [timeCommitment, setTimeCommitment] = useState("");
  const [availability, setAvailability] = useState("");
  const [locationPref, setLocationPref] = useState("");
  const [showModal, setShowModal] = useState(false);

  const ready = university.trim() && research.trim();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-9 text-center">
          <h1 className="text-2xl font-bold tracking-tight mb-2" style={{ color: "var(--ink)" }}>
            New campaign
          </h1>
          <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>
            We'll find the right faculty, write every email, send them, and track every response.
          </p>
        </div>

        {/* Two-column form */}
        <div className="flex flex-col sm:flex-row gap-5 mb-6">
          {/* Left: Campaign scope */}
          <div className="flex-1 rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
            <SectionLabel>Campaign scope</SectionLabel>
            <div className="space-y-2.5">
              <input
                type="text"
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                placeholder="Which university?"
                className="w-full px-3.5 py-3 rounded-lg text-sm border transition-all duration-150"
                style={inputStyle(!!university)}
              />
              <textarea
                value={research}
                onChange={(e) => setResearch(e.target.value)}
                placeholder="What do you want to research?"
                rows={4}
                className="w-full px-3.5 py-3 rounded-lg text-sm border transition-all duration-150 resize-none"
                style={inputStyle(!!research)}
              />
            </div>
          </div>

          {/* Right: Logistics */}
          <div className="flex-1 rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
            <SectionLabel>Logistics</SectionLabel>
            <div className="space-y-2.5">
              <select
                value={positionType}
                onChange={(e) => setPositionType(e.target.value)}
                className={selectClassName}
                style={inputStyle(!!positionType)}
              >
                <option value="" disabled>Position type</option>
                <option>Paid</option>
                <option>Unpaid</option>
                <option>Flexible / Open to any</option>
              </select>

              <select
                value={timeCommitment}
                onChange={(e) => setTimeCommitment(e.target.value)}
                className={selectClassName}
                style={inputStyle(!!timeCommitment)}
              >
                <option value="" disabled>Time commitment</option>
                <option>Full-time (40+ hrs/week)</option>
                <option>Part-time (10–20 hrs/week)</option>
                <option>Part-time (20–30 hrs/week)</option>
                <option>Flexible</option>
              </select>

              <input
                type="text"
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                placeholder="When and how long are you available?"
                className="w-full px-3.5 py-3 rounded-lg text-sm border transition-all duration-150"
                style={inputStyle(!!availability)}
              />
              <p className="text-xs" style={{ color: "var(--ink-secondary)", marginTop: 2 }}>
                e.g. Mid-May to mid-August
              </p>

              <select
                value={locationPref}
                onChange={(e) => setLocationPref(e.target.value)}
                className={selectClassName}
                style={inputStyle(!!locationPref)}
              >
                <option value="" disabled>Location preference</option>
                <option>On-site only</option>
                <option>Remote only</option>
                <option>Hybrid</option>
                <option>No preference</option>
              </select>
            </div>
          </div>
        </div>

        <button
          onClick={() => { if (ready) setShowModal(true); }}
          disabled={!ready}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          style={
            ready
              ? { background: "var(--accent)", color: "#fff", boxShadow: "0 0 24px rgba(31,73,89,0.5)" }
              : { background: "var(--bg-elevated)", color: "var(--ink-secondary)" }
          }
        >
          Find faculty
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {showModal && <LoadingModal onClose={() => router.push("/campaign/professors")} />}
    </div>
  );
}
