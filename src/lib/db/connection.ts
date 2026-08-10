import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA_SQL } from "./schema";

// Single-user, single-process local app — one long-lived connection for the
// whole server, held on `globalThis` so Next.js dev's hot-reload doesn't open
// a second handle onto the same file (WAL mode tolerates it, but there's no
// reason to).
declare global {
  // eslint-disable-next-line no-var
  var __squibbleDb: Database.Database | undefined;
}

function openDb(): Database.Database {
  const dataDir = process.env.SQLITE_DATA_DIR ?? path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = process.env.SQLITE_DB_PATH ?? path.join(dataDir, "squibble.db");

  const db = new Database(dbPath);

  // WAL mode: campaign fan-out (many per-professor writes) and the IMAP
  // poller's writes can otherwise contend for the single write lock that
  // better-sqlite3's default rollback-journal mode holds for the whole
  // transaction duration.
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(SCHEMA_SQL);

  return db;
}

export function getDb(): Database.Database {
  if (!globalThis.__squibbleDb) {
    globalThis.__squibbleDb = openDb();
  }
  return globalThis.__squibbleDb;
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
