"use client";

import { useEffect } from "react";

export function CodeRedirectHandler() {
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      // Supabase fell back to the site root instead of /auth/callback.
      // Recover the plan from the cookie set before OAuth and forward it.
      const planMatch = document.cookie.match(/(?:^|;\s*)squibble_plan_intent=([^;]+)/);
      const plan = planMatch?.[1];
      let url = "/auth/callback?code=" + code;
      if (plan === "pro" || plan === "max") url += "&plan=" + plan;
      window.location.replace(url);
    }
  }, []);

  return null;
}
