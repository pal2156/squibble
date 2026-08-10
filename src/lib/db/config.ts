import { getDb } from "./connection";

// Non-secret app config only — API keys and SMTP/IMAP credentials live in
// .env.local, never here (see the setup wizard for why).
const SETUP_COMPLETE_KEY = "setup_complete";

export function getConfig(key: string): string | null {
  const row = getDb().prepare("select value from config where key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setConfig(key: string, value: string): void {
  getDb()
    .prepare("insert into config (key, value) values (?, ?) on conflict(key) do update set value = excluded.value")
    .run(key, value);
}

export function isSetupComplete(): boolean {
  return getConfig(SETUP_COMPLETE_KEY) === "true";
}

export function markSetupComplete(): void {
  setConfig(SETUP_COMPLETE_KEY, "true");
}
