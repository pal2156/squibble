import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/db";

// Single-user, local-first tool — no login screen, so "/" has nothing to
// render itself. Either the wizard hasn't run yet, or it has and the user
// belongs on their dashboard.
export default function Home() {
  redirect(isSetupComplete() ? "/dashboard" : "/setup");
}
