"use client";

import { useEffect } from "react";

export function CodeRedirectHandler() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    console.log("[landing] checking for code:", code);
    if (code) {
      window.location.replace("/auth/callback?code=" + code);
    }
  }, []);

  return null;
}
