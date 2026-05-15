"use client";

import { useEffect } from "react";
import { X, Check } from "lucide-react";

interface UpgradeModalProps {
  onClose: () => void;
}

const PLANS = [
  {
    name: "Mock Package 1",
    price: "Mock Price 1",
    features: [
      "Up to 10 campaigns per month",
      "50 researcher contacts",
      "AI email drafts",
      "Basic analytics dashboard",
      "Email status tracking",
    ],
    popular: false,
    idx: 1,
  },
  {
    name: "Mock Package 2",
    price: "Mock Price 2",
    features: [
      "Unlimited campaigns",
      "200 researcher contacts",
      "Advanced AI personalization",
      "Full analytics & insights",
      "Gmail integration",
      "Priority professor matching",
    ],
    popular: true,
    idx: 2,
  },
  {
    name: "Mock Package 3",
    price: "Mock Price 3",
    features: [
      "Everything in Package 2",
      "Unlimited researcher contacts",
      "Custom outreach templates",
      "Dedicated account support",
      "Team seats (up to 5)",
    ],
    popular: false,
    idx: 3,
  },
];

export default function UpgradeModal({ onClose }: UpgradeModalProps) {
  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{
        background: "rgba(35, 44, 51, 0.7)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-8 animate-scale-in"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "0 24px 64px rgba(35,44,51,0.35), 0 4px 16px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: "var(--ink-muted)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-elevated)";
            e.currentTarget.style.color = "var(--ink)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--ink-muted)";
          }}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-medium mb-2" style={{ color: "var(--ink)", letterSpacing: "-0.03em" }}>
            Choose a plan
          </h2>
          <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>
            Scale your research outreach with the right tier for you.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className="relative flex flex-col rounded-xl p-6"
              style={{
                background: plan.popular ? "var(--bg-elevated)" : "var(--bg-card)",
                border: plan.popular
                  ? "2px solid var(--accent)"
                  : "1px solid var(--border-subtle)",
              }}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-widest px-3 py-1 rounded-full"
                    style={{
                      background: "var(--accent)",
                      color: "#fff",
                    }}
                  >
                    Most Popular
                  </span>
                </div>
              )}

              <h3
                className="text-sm font-semibold mb-4"
                style={{ color: "var(--ink)" }}
              >
                {plan.name}
              </h3>

              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check
                      className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                      style={{ color: "var(--accent)" }}
                    />
                    <span className="text-xs leading-snug" style={{ color: "var(--ink-secondary)" }}>
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => console.log(`selected package ${plan.idx}`)}
                className="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors"
                style={{ background: "var(--accent)", color: "#fff" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--accent-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--accent)";
                }}
              >
                {plan.price}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
