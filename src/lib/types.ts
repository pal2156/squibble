// Shared TypeScript interfaces for local SQLite DB rows.
// Single-user app — no user_id anywhere, there is exactly one of everything
// user-scoped (one profiles row, id=1).

export interface Profile {
  id: number;
  name: string | null;
  school: string | null;
  year: string | null;
  major: string | null;
  coursework: string | null;
  experience: string | null;
  skills: string | null;
  extracurriculars: string | null;
  anything_else: string | null;
  cv_text: string | null;
  cv_filename: string | null;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  title: string | null;
  university: string;
  research_interest: string;
  availability: string | null;
  professor_count: number;
  faculty_page_url: string | null;
  status: string;
  created_at: string;
}

export type FacultyPageLevel = "subgroup" | "subfield" | "department";
export type FacultyPageScrapeStatus = "ok" | "error" | "empty";

export interface FacultyPage {
  id: string;
  university: string;
  normalized_university: string;
  department_name: string | null;
  page_url: string;
  level: FacultyPageLevel;
  scraped_at: string | null;
  scrape_in_progress: boolean;
  last_scrape_status: FacultyPageScrapeStatus | null;
  last_accessed_at: string | null;
  created_at: string;
}

export interface UrlDiscoveryCache {
  id: string;
  normalized_university: string;
  normalized_research_interest: string;
  faculty_page_ids: string[];
  discovered_at: string;
  created_at: string;
}

export type ProfessorRoleTag =
  | "professor"
  | "assistant_professor"
  | "associate_professor"
  | "postdoc"
  | "research_scientist"
  | "grad_student"
  | "chair"
  | "emeritus"
  | "visiting_scholar"
  | "lecturer"
  | "other";

// Cross-campaign, one row per person. Not scoped to any single campaign —
// see CampaignProfessor for the campaign-scoped scoring and selection state.
export interface Professor {
  id: string;
  faculty_page_ids: string[];
  normalized_name: string;
  name: string;
  title: string | null;
  role_tag: ProfessorRoleTag;
  email: string | null;
  research_description: string | null;
  education: string | null;
  profile_urls: string[];
  other: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecentPaper {
  title: string;
  year: number | null;
}

export interface CampaignProfessor {
  id: string;
  campaign_id: string;
  professor_id: string;
  domain_fit_score: number | null;
  connection_summary: string | null;
  capacity_notes: string | null;
  final_score: number | null;
  reasoning: string | null;
  in_top_n: boolean;
  recent_papers: RecentPaper[] | null;
  card_description: string | null;
  selected_by_student: boolean;
  created_at: string;
}

// Display shape used by /campaign/professors — a campaign_professors row
// joined with its professors and faculty_pages rows, shaped to match what the
// professor cards and selection flow need.
export interface CampaignProfessorView {
  id: string;
  name: string;
  department: string | null;
  university: string | null;
  title: string | null;
  description: string | null;
  email: string | null;
  fit_score: number | null;
  research_areas: string[];
  selected: boolean;
  recent_papers: RecentPaper[] | null;
  created_at: string;
}

export type EmailStatus = "draft" | "sent" | "positive" | "negative" | "no_response" | "bounced" | "failed";

export interface Email {
  id: string;
  campaign_id: string | null;
  professor_id: string | null;
  professor_name: string | null;
  university: string | null;
  department: string | null;
  email: string | null;
  subject: string | null;
  body: string | null;
  status: EmailStatus;
  message_id: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface Reply {
  id: string;
  email_id: string;
  body: string | null;
  classification: "positive" | "negative" | null;
  received_at: string;
}

// Joined shape used by the dashboard and conversations pages
export interface EmailWithReply extends Email {
  reply?: Reply | null;
  campaign?: Pick<Campaign, "title"> | null;
}

// Display shape used by the dashboard page and charts
export interface SentEmail {
  id: string;
  professor: string;
  university: string;
  department: string;
  campaign: string;
  campaignCreatedAt?: string;
  dateSent: string;
  status: "Positive Reply" | "No Response" | "Negative Reply";
  subject: string;
  body: string;
  reply?: { date: string; body: string };
}
