import { getDb, newId, nowIso } from "./connection";
import type {
  Profile, Campaign, Professor, CampaignProfessor, Email, Reply, FacultyPage, UrlDiscoveryCache, RecentPaper,
} from "@/lib/types";

export { getDb, newId, nowIso } from "./connection";
export * from "./config";

// ─── JSON column helpers ──────────────────────────────────────────
function parseJsonArray<T>(text: string | null | undefined): T[] {
  if (!text) return [];
  try {
    const v = JSON.parse(text);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
const toJson = (v: unknown) => JSON.stringify(v ?? []);
const bool = (v: unknown) => (v ? 1 : 0);

// ─── Row mappers ───────────────────────────────────────────────────
type ProfessorRow = Omit<Professor, "faculty_page_ids" | "profile_urls" | "active"> & {
  faculty_page_ids: string;
  profile_urls: string;
  active: number;
};
function mapProfessor(row: ProfessorRow): Professor {
  return {
    ...row,
    faculty_page_ids: parseJsonArray(row.faculty_page_ids),
    profile_urls: parseJsonArray(row.profile_urls),
    active: !!row.active,
  };
}

type CampaignProfessorRow = Omit<CampaignProfessor, "in_top_n" | "selected_by_student" | "recent_papers"> & {
  in_top_n: number;
  selected_by_student: number;
  recent_papers: string | null;
};
function mapCampaignProfessor(row: CampaignProfessorRow): CampaignProfessor {
  return {
    ...row,
    in_top_n: !!row.in_top_n,
    selected_by_student: !!row.selected_by_student,
    recent_papers: row.recent_papers ? (JSON.parse(row.recent_papers) as RecentPaper[]) : null,
  };
}

type FacultyPageRow = Omit<FacultyPage, "scrape_in_progress"> & { scrape_in_progress: number };
function mapFacultyPage(row: FacultyPageRow): FacultyPage {
  return { ...row, scrape_in_progress: !!row.scrape_in_progress };
}

// ─── profiles (single row, id=1) ───────────────────────────────────
export function getProfile(): Profile | null {
  return (getDb().prepare("select * from profiles where id = 1").get() as Profile | undefined) ?? null;
}

export function upsertProfile(fields: Partial<Omit<Profile, "id" | "created_at" | "updated_at">>): Profile {
  const db = getDb();
  const existing = getProfile();
  const now = nowIso();
  if (!existing) {
    db.prepare(
      `insert into profiles (id, name, school, year, major, coursework, experience, skills, extracurriculars,
        anything_else, cv_text, cv_filename, created_at, updated_at)
       values (1, @name, @school, @year, @major, @coursework, @experience, @skills, @extracurriculars,
        @anything_else, @cv_text, @cv_filename, @now, @now)`
    ).run({
      name: null, school: null, year: null, major: null, coursework: null, experience: null,
      skills: null, extracurriculars: null, anything_else: null, cv_text: null, cv_filename: null,
      ...fields, now,
    });
  } else {
    const merged = { ...existing, ...fields, updated_at: now };
    db.prepare(
      `update profiles set name=@name, school=@school, year=@year, major=@major, coursework=@coursework,
        experience=@experience, skills=@skills, extracurriculars=@extracurriculars, anything_else=@anything_else,
        cv_text=@cv_text, cv_filename=@cv_filename, updated_at=@updated_at where id = 1`
    ).run(merged);
  }
  return getProfile() as Profile;
}

// ─── campaigns ──────────────────────────────────────────────────────
export function createCampaign(data: {
  university: string; research_interest: string; availability?: string | null;
  professor_count?: number; faculty_page_url?: string | null; status?: string;
}): Campaign {
  const id = newId();
  getDb()
    .prepare(
      `insert into campaigns (id, university, research_interest, availability, professor_count, faculty_page_url, status)
       values (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, data.university, data.research_interest, data.availability ?? null, data.professor_count ?? 10,
      data.faculty_page_url ?? null, data.status ?? "finding");
  return getCampaign(id) as Campaign;
}

export function getCampaign(id: string): Campaign | null {
  return (getDb().prepare("select * from campaigns where id = ?").get(id) as Campaign | undefined) ?? null;
}

export function updateCampaign(id: string, fields: Partial<Campaign>): void {
  const cols = Object.keys(fields);
  if (cols.length === 0) return;
  const set = cols.map((c) => `${c} = @${c}`).join(", ");
  getDb().prepare(`update campaigns set ${set} where id = @id`).run({ ...fields, id });
}

// ─── professors ─────────────────────────────────────────────────────
export function findProfessorsByNormalizedNames(names: string[]): Professor[] {
  if (names.length === 0) return [];
  const db = getDb();
  const placeholders = names.map(() => "?").join(",");
  const rows = db.prepare(`select * from professors where normalized_name in (${placeholders})`).all(...names) as ProfessorRow[];
  return rows.map(mapProfessor);
}

export function insertProfessor(data: Omit<Professor, "id" | "created_at" | "updated_at">): Professor {
  const id = newId();
  const now = nowIso();
  getDb()
    .prepare(
      `insert into professors (id, faculty_page_ids, normalized_name, name, title, role_tag, email,
        research_description, education, profile_urls, other, active, created_at, updated_at)
       values (@id, @faculty_page_ids, @normalized_name, @name, @title, @role_tag, @email,
        @research_description, @education, @profile_urls, @other, @active, @now, @now)`
    )
    .run({
      id, ...data,
      faculty_page_ids: toJson(data.faculty_page_ids),
      profile_urls: toJson(data.profile_urls),
      active: bool(data.active),
      now,
    });
  return getProfessor(id) as Professor;
}

export function getProfessor(id: string): Professor | null {
  const row = getDb().prepare("select * from professors where id = ?").get(id) as ProfessorRow | undefined;
  return row ? mapProfessor(row) : null;
}

export function getProfessorsByIds(ids: string[]): Professor[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = getDb().prepare(`select * from professors where id in (${placeholders})`).all(...ids) as ProfessorRow[];
  return rows.map(mapProfessor);
}

export function updateProfessor(id: string, fields: Partial<Professor>): void {
  const payload: Record<string, unknown> = { ...fields, id, updated_at: nowIso() };
  if ("faculty_page_ids" in fields) payload.faculty_page_ids = toJson(fields.faculty_page_ids);
  if ("profile_urls" in fields) payload.profile_urls = toJson(fields.profile_urls);
  if ("active" in fields) payload.active = bool(fields.active);
  const cols = Object.keys(payload).filter((c) => c !== "id");
  const set = cols.map((c) => `${c} = @${c}`).join(", ");
  getDb().prepare(`update professors set ${set} where id = @id`).run(payload);
}

// Professors whose faculty_page_ids overlaps the given set of page ids.
// Dataset is local/single-user scale, so filtering the JSON array in JS
// (rather than a SQL json_each subquery) is simple and fast enough.
export function getActiveProfessorsForPages(facultyPageIds: string[]): Professor[] {
  if (facultyPageIds.length === 0) return [];
  const wanted = new Set(facultyPageIds);
  const rows = getDb().prepare("select * from professors where active = 1").all() as ProfessorRow[];
  return rows.map(mapProfessor).filter((p) => p.faculty_page_ids.some((id) => wanted.has(id)));
}

export function getProfessorsOnPage(pageId: string, activeOnly = true): Professor[] {
  const rows = getDb()
    .prepare(`select * from professors where ${activeOnly ? "active = 1" : "1=1"}`)
    .all() as ProfessorRow[];
  return rows.map(mapProfessor).filter((p) => p.faculty_page_ids.includes(pageId));
}

// ─── campaign_professors ────────────────────────────────────────────
export function upsertCampaignProfessors(rows: Array<{
  campaign_id: string; professor_id: string; domain_fit_score: number | null;
  connection_summary: string | null; capacity_notes: string | null; final_score: number | null;
  reasoning: string | null; in_top_n: boolean; recent_papers: RecentPaper[] | null;
  card_description: string | null; selected_by_student: boolean;
}>): void {
  const stmt = getDb().prepare(
    `insert into campaign_professors (id, campaign_id, professor_id, domain_fit_score, connection_summary,
      capacity_notes, final_score, reasoning, in_top_n, recent_papers, card_description, selected_by_student)
     values (@id, @campaign_id, @professor_id, @domain_fit_score, @connection_summary, @capacity_notes,
      @final_score, @reasoning, @in_top_n, @recent_papers, @card_description, @selected_by_student)
     on conflict(campaign_id, professor_id) do update set
       domain_fit_score = excluded.domain_fit_score, connection_summary = excluded.connection_summary,
       capacity_notes = excluded.capacity_notes, final_score = excluded.final_score,
       reasoning = excluded.reasoning, in_top_n = excluded.in_top_n, recent_papers = excluded.recent_papers,
       card_description = excluded.card_description, selected_by_student = excluded.selected_by_student`
  );
  const tx = getDb().transaction((items: typeof rows) => {
    for (const r of items) {
      stmt.run({
        id: newId(), ...r,
        in_top_n: bool(r.in_top_n),
        recent_papers: r.recent_papers ? toJson(r.recent_papers) : null,
        selected_by_student: bool(r.selected_by_student),
      });
    }
  });
  tx(rows);
}

export type CampaignProfessorWithProfessor = CampaignProfessor & { professor: Professor };

export function getTopNForCampaign(campaignId: string): CampaignProfessorWithProfessor[] {
  const rows = getDb()
    .prepare("select * from campaign_professors where campaign_id = ? and in_top_n = 1 order by final_score desc")
    .all(campaignId) as CampaignProfessorRow[];
  return rows.map(mapCampaignProfessor).map((cp) => ({ ...cp, professor: getProfessor(cp.professor_id) as Professor }));
}

export function getSelectedForCampaign(campaignId: string): CampaignProfessorWithProfessor[] {
  const rows = getDb()
    .prepare("select * from campaign_professors where campaign_id = ? and selected_by_student = 1")
    .all(campaignId) as CampaignProfessorRow[];
  return rows.map(mapCampaignProfessor).map((cp) => ({ ...cp, professor: getProfessor(cp.professor_id) as Professor }));
}

export function setSelectedProfessors(campaignId: string, selectedProfessorIds: string[]): void {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare("update campaign_professors set selected_by_student = 0 where campaign_id = ?").run(campaignId);
    if (selectedProfessorIds.length > 0) {
      const placeholders = selectedProfessorIds.map(() => "?").join(",");
      db.prepare(
        `update campaign_professors set selected_by_student = 1 where campaign_id = ? and professor_id in (${placeholders})`
      ).run(campaignId, ...selectedProfessorIds);
    }
  });
  tx();
}

// ─── emails ─────────────────────────────────────────────────────────
export function insertEmails(rows: Array<Omit<Email, "id" | "created_at" | "status" | "message_id" | "sent_at"> & { status?: string; message_id?: string | null; sent_at?: string | null }>): Email[] {
  const db = getDb();
  const stmt = db.prepare(
    `insert into emails (id, campaign_id, professor_id, professor_name, university, department, email,
      subject, body, status, message_id, sent_at)
     values (@id, @campaign_id, @professor_id, @professor_name, @university, @department, @email,
      @subject, @body, @status, @message_id, @sent_at)`
  );
  const ids: string[] = [];
  const tx = db.transaction((items: typeof rows) => {
    for (const r of items) {
      const id = newId();
      ids.push(id);
      stmt.run({ id, message_id: null, sent_at: null, status: "draft", ...r });
    }
  });
  tx(rows);
  return getEmailsByIds(ids);
}

export function getEmailsByIds(ids: string[]): Email[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  return getDb().prepare(`select * from emails where id in (${placeholders})`).all(...ids) as Email[];
}

export function getEmailsForCampaign(campaignId: string): Email[] {
  return getDb().prepare("select * from emails where campaign_id = ? order by created_at").all(campaignId) as Email[];
}

export function getEmail(id: string): Email | null {
  return (getDb().prepare("select * from emails where id = ?").get(id) as Email | undefined) ?? null;
}

export function updateEmail(id: string, fields: Partial<Email>): Email | null {
  const cols = Object.keys(fields);
  if (cols.length === 0) return getEmail(id);
  const set = cols.map((c) => `${c} = @${c}`).join(", ");
  getDb().prepare(`update emails set ${set} where id = @id`).run({ ...fields, id });
  return getEmail(id);
}

// For dup-check across campaigns in emails/draft.
export function findAlreadyContactedEmails(excludeCampaignId: string, addresses: string[]): Set<string> {
  if (addresses.length === 0) return new Set();
  const placeholders = addresses.map(() => "?").join(",");
  const rows = getDb()
    .prepare(
      `select email from emails where campaign_id != ? and status in ('sent','positive','negative','no_response','bounced')
       and lower(email) in (${placeholders})`
    )
    .all(excludeCampaignId, ...addresses.map((a) => a.toLowerCase())) as Array<{ email: string }>;
  return new Set(rows.map((r) => r.email.toLowerCase()));
}

// Emails currently awaiting a reply — used by the IMAP poller.
export function getEmailsAwaitingReply(): Email[] {
  return getDb()
    .prepare(`select * from emails where status in ('sent','no_response') and message_id is not null`)
    .all() as Email[];
}

export type DashboardEmailRow = Email & { campaign_title: string | null; campaign_created_at: string | null; reply: Reply | null };

export function getSentEmailsForDashboard(): DashboardEmailRow[] {
  const rows = getDb()
    .prepare(
      `select e.*, c.title as campaign_title, c.created_at as campaign_created_at,
              r.id as reply_id, r.body as reply_body, r.classification as reply_classification, r.received_at as reply_received_at
       from emails e
       left join campaigns c on c.id = e.campaign_id
       left join replies r on r.email_id = e.id
       where e.status in ('sent','positive','negative','no_response')
       order by e.sent_at desc`
    )
    .all() as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: row.id as string,
    campaign_id: row.campaign_id as string | null,
    professor_id: row.professor_id as string | null,
    professor_name: row.professor_name as string | null,
    university: row.university as string | null,
    department: row.department as string | null,
    email: row.email as string | null,
    subject: row.subject as string | null,
    body: row.body as string | null,
    status: row.status as Email["status"],
    message_id: row.message_id as string | null,
    sent_at: row.sent_at as string | null,
    created_at: row.created_at as string,
    campaign_title: row.campaign_title as string | null,
    campaign_created_at: row.campaign_created_at as string | null,
    reply: row.reply_id
      ? {
          id: row.reply_id as string,
          email_id: row.id as string,
          body: row.reply_body as string | null,
          classification: row.reply_classification as "positive" | "negative" | null,
          received_at: row.reply_received_at as string,
        }
      : null,
  }));
}

export function getConversations(): DashboardEmailRow[] {
  return getSentEmailsForDashboard().filter((e) => (e.status === "positive" || e.status === "negative") && e.reply);
}

// ─── replies ────────────────────────────────────────────────────────
export function upsertReply(emailId: string, body: string, classification: "positive" | "negative"): void {
  getDb()
    .prepare(
      `insert into replies (id, email_id, body, classification, received_at)
       values (@id, @email_id, @body, @classification, @received_at)
       on conflict(email_id) do update set body = excluded.body, classification = excluded.classification,
         received_at = excluded.received_at`
    )
    .run({ id: newId(), email_id: emailId, body, classification, received_at: nowIso() });
}

export function hasReply(emailId: string): boolean {
  return !!getDb().prepare("select 1 from replies where email_id = ?").get(emailId);
}

// ─── faculty_pages ──────────────────────────────────────────────────
export function getFacultyPageByUrl(url: string): FacultyPage | null {
  const row = getDb().prepare("select * from faculty_pages where page_url = ?").get(url) as FacultyPageRow | undefined;
  return row ? mapFacultyPage(row) : null;
}

export function getFacultyPage(id: string): FacultyPage | null {
  const row = getDb().prepare("select * from faculty_pages where id = ?").get(id) as FacultyPageRow | undefined;
  return row ? mapFacultyPage(row) : null;
}

export function getFacultyPages(ids: string[]): FacultyPage[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = getDb().prepare(`select * from faculty_pages where id in (${placeholders})`).all(...ids) as FacultyPageRow[];
  return rows.map(mapFacultyPage);
}

export function insertFacultyPage(data: {
  university: string; normalized_university: string; department_name: string | null;
  page_url: string; level: FacultyPage["level"];
}): FacultyPage {
  const id = newId();
  getDb()
    .prepare(
      `insert into faculty_pages (id, university, normalized_university, department_name, page_url, level)
       values (?, ?, ?, ?, ?, ?)`
    )
    .run(id, data.university, data.normalized_university, data.department_name, data.page_url, data.level);
  return getFacultyPage(id) as FacultyPage;
}

export function updateFacultyPage(id: string, fields: Partial<FacultyPage>): void {
  const payload: Record<string, unknown> = { ...fields };
  if ("scrape_in_progress" in fields) payload.scrape_in_progress = bool(fields.scrape_in_progress);
  const cols = Object.keys(payload);
  if (cols.length === 0) return;
  const set = cols.map((c) => `${c} = @${c}`).join(", ");
  getDb().prepare(`update faculty_pages set ${set} where id = @id`).run({ ...payload, id });
}

// ─── url_discovery_cache ────────────────────────────────────────────
export function getUrlDiscoveryCache(normUniversity: string, normInterest: string): UrlDiscoveryCache | null {
  const row = getDb()
    .prepare("select * from url_discovery_cache where normalized_university = ? and normalized_research_interest = ?")
    .get(normUniversity, normInterest) as (Omit<UrlDiscoveryCache, "faculty_page_ids"> & { faculty_page_ids: string }) | undefined;
  return row ? { ...row, faculty_page_ids: parseJsonArray(row.faculty_page_ids) } : null;
}

export function upsertUrlDiscoveryCache(normUniversity: string, normInterest: string, facultyPageIds: string[]): void {
  getDb()
    .prepare(
      `insert into url_discovery_cache (id, normalized_university, normalized_research_interest, faculty_page_ids, discovered_at)
       values (@id, @normalized_university, @normalized_research_interest, @faculty_page_ids, @discovered_at)
       on conflict(normalized_university, normalized_research_interest) do update set
         faculty_page_ids = excluded.faculty_page_ids, discovered_at = excluded.discovered_at`
    )
    .run({
      id: newId(), normalized_university: normUniversity, normalized_research_interest: normInterest,
      faculty_page_ids: toJson(facultyPageIds), discovered_at: nowIso(),
    });
}

// ─── mail_poll_state (T2 UID cursor, T4 overlap lock) ────────────────
export function getPollCursor(): { uidvalidity: number | null; last_uid: number } {
  const row = getDb().prepare("select uidvalidity, last_uid from mail_poll_state where id = 1").get() as
    { uidvalidity: number | null; last_uid: number };
  return row;
}

export function setPollCursor(uidvalidity: number, lastUid: number): void {
  getDb().prepare("update mail_poll_state set uidvalidity = ?, last_uid = ? where id = 1").run(uidvalidity, lastUid);
}

// Atomically claims the poll lock. Returns false if a poll is already in
// flight (overlap protection — T4). The UPDATE...WHERE polling=0 is atomic
// under SQLite's single-writer model, so two callers can't both succeed.
export function tryAcquirePollLock(): boolean {
  const result = getDb().prepare("update mail_poll_state set polling = 1 where id = 1 and polling = 0").run();
  return result.changes === 1;
}

export function releasePollLock(error?: string): void {
  getDb()
    .prepare("update mail_poll_state set polling = 0, last_polled_at = ?, last_error = ? where id = 1")
    .run(nowIso(), error ?? null);
}
