import { NextResponse, type NextRequest } from "next/server";

// No login screen — the app running on your machine is already "yours" (see
// the design doc's constraints). But removing auth doesn't remove the need
// for an origin check: without it, any page on the local network (or a
// malicious site open in another tab) could POST to a state-changing route
// like /api/emails/send or /api/profile just because the browser has a
// session with this origin. Design review finding A4 / task T6.
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  // No Origin header at all (e.g. curl, same-origin same-tab navigations in
  // older browsers) — nothing to check against, allow it through. Browsers
  // reliably send Origin on cross-origin fetch/XHR, which is the actual
  // attack surface this guards against.
  if (!origin) return true;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/") && MUTATING_METHODS.has(request.method) && !isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  // Forward the current pathname as a request header so the root layout (a
  // Node-runtime Server Component) can redirect to /setup when the wizard
  // hasn't run yet. Done this way — rather than checking SQLite here —
  // because middleware runs on the Edge runtime by default and better-sqlite3
  // is a native Node addon that can't load there.
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
