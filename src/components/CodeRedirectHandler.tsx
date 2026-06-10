"use client";

import { useEffect } from "react";

export function CodeRedirectHandler() {
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) return;

    // Supabase fell back to the site root instead of /auth/callback.
    // Read the destination encoded in the cookie before OAuth began and forward it.
    const nextMatch = document.cookie.match(/(?:^|;\s*)squibble_auth_next=([^;]+)/);
    const cookieNext = nextMatch?.[1] ? decodeURIComponent(nextMatch[1]) : null;

    let url = "/auth/callback?code=" + encodeURIComponent(code);
    if (cookieNext && cookieNext.startsWith("/") && !cookieNext.startsWith("//")) {
      url += "&next=" + encodeURIComponent(cookieNext);
    }
    window.location.replace(url);
  }, []);

  return null;
}
