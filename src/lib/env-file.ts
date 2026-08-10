import fs from "node:fs";
import path from "node:path";

const ENV_PATH = path.join(process.cwd(), ".env.local");

export function readEnvFile(): Record<string, string> {
  if (!fs.existsSync(ENV_PATH)) return {};
  const content = fs.readFileSync(ENV_PATH, "utf-8");
  const out: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function serializeEnvValue(value: string): string {
  return /[\s#"'\\]/.test(value) ? JSON.stringify(value) : value;
}

function writeEnvVars(vars: Record<string, string>): void {
  const merged = { ...readEnvFile(), ...vars };
  const lines = Object.entries(merged).map(([k, v]) => `${k}=${serializeEnvValue(v)}`);
  fs.writeFileSync(ENV_PATH, lines.join("\n") + "\n", { mode: 0o600 });
}

// Writes to .env.local FIRST, then mirrors the same values onto the running
// process. If the file write throws, process.env is never touched — file and
// running process can't silently drift apart (design review critical gap #1:
// the wizard must not complete setup that isn't actually reflected in either
// place, and the two writes must not be able to disagree with each other).
export function applyEnv(vars: Record<string, string>): void {
  writeEnvVars(vars);
  for (const [k, v] of Object.entries(vars)) {
    process.env[k] = v;
  }
}
