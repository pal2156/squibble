"use client";

import { useEffect, useState } from "react";
import { X, Check } from "lucide-react";

interface UpgradeModalProps {
  onClose: () => void;
}

const PLANS = [
  {
    name: "Free",
    price: "$0",
    priceSub: "No credit card required.",
    subtitle: "Try it out.",
    cta: "Get started free",
    features: [
      "3 professor searches",
      "2 personalized emails",
      "Reply tracking dashboard",
      "Gmail integration",
    ],
    popular: false,
    priceId: null as string | null,
  },
  {
    name: "Pro",
    price: "$15",
    priceSub: "One-time",
    subtitle: "For your next research cycle.",
    cta: "Get started",
    features: [
      "30 professor searches",
      "30 personalized emails",
      "Reply tracking dashboard",
      "Gmail integration",
    ],
    popular: true,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? "price_1Tdd5F2fASOksRg20N4gCDgC",
  },
  {
    name: "Max",
    price: "$25",
    priceSub: "One-time",
    subtitle: "For high-volume outreach.",
    cta: "Get started",
    features: [
      "75 professor searches",
      "75 personalized emails",
      "Reply tracking dashboard",
      "Gmail integration",
    ],
    popular: false,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_MAX ?? "price_1Tdd5k2fASOksRg2Z9WHMbkG",
  },
];

export default function UpgradeModal({ onClose }: UpgradeModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  async function handleCheckout(priceId: string, planName: string) {
    setLoadingPlan(planName);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, plan: planName.toLowerCase() }),
      });
      if (!res.ok) {
        throw new Error(`Checkout failed (${res.status})`);
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err) {
      console.error("[UpgradeModal] checkout error:", err);
      setLoadingPlan(null);
      setCheckoutError("Something went wrong. Please try again.");
    }
  }

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

        {/* Error */}
        {checkoutError && (
          <p className="text-center text-sm mb-4" style={{ color: "#e05252" }}>
            {checkoutError}
          </p>
        )}

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
                className="text-xs font-semibold uppercase tracking-widest mb-2"
                style={{ color: "var(--accent)" }}
              >
                {plan.name}
              </h3>

              <div className="mb-0.5">
                <span className="text-4xl font-semibold" style={{ color: "var(--ink)", letterSpacing: "-0.04em" }}>
                  {plan.price}
                </span>
              </div>
              <p className="text-xs mb-0.5" style={{ color: "var(--ink-secondary)" }}>{plan.priceSub}</p>
              <p className="text-sm font-medium mb-4" style={{ color: "var(--ink)" }}>{plan.subtitle}</p>

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
                onClick={() => {
                  if (plan.priceId) handleCheckout(plan.priceId, plan.name);
                }}
                disabled={!plan.priceId || loadingPlan === plan.name}
                className="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
                style={{ background: "var(--accent)", color: "#fff" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--accent-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--accent)";
                }}
              >
                {loadingPlan === plan.name ? "Redirecting..." : plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
