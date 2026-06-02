"use client";

import { useEffect } from "react";

export function CodeRedirectHandler() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    console.log("[landing] checking for code:", code);
    if (code) {
      // If Supabase fell back to the site root instead of /auth/callback,
      // the ?next= param is gone. Recover the plan from the cookie we set
      // before OAuth so the callback can still redirect to Stripe.
      const planMatch = document.cookie.match(/(?:^|;\s*)squibble_plan_intent=([^;]+)/);
      const plan = planMatch ? planMatch[1] : null;
      let url = "/auth/callback?code=" + code;
      if (plan === "pro" || plan === "max") {
        url += "&next=" + encodeURIComponent(`/api/stripe/redirect?plan=${plan}`);
      }
      window.location.replace(url);
    }
  }, []);

  return null;
}
