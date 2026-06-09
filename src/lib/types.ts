// Shared TypeScript interfaces for Supabase DB rows

export interface Profile {
  id: string;
  user_id: string;
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
  user_id: string;
  title: string | null;
  university: string | null;
  research_interest: string | null;
  position_type: string | null;
  time_commitment: string | null;
  availability: string | null;
  location_preference: string | null;
  professor_count: number;
  status: string;
  created_at: string;
}

export interface Professor {
  id: string;
  campaign_id: string;
  name: string;
  department: string | null;
  university: string | null;
  title: string | null;
  description: string | null;
  email: string | null;
  fit_score: number | null;
  research_areas: string[] | null;
  selected: boolean;
  created_at: string;
}

export type EmailStatus = "draft" | "sent" | "positive" | "negative" | "no_response" | "bounced";

export interface Email {
  id: string;
  user_id: string;
  campaign_id: string | null;
  professor_id: string | null;
  professor_name: string | null;
  university: string | null;
  department: string | null;
  email: string | null;
  subject: string | null;
  body: string | null;
  status: EmailStatus;
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
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

export interface GmailWatch {
  user_id: string;
  history_id: string | null;
  expiration: number | null;
  updated_at: string;
}

export interface Bounce {
  id: string;
  email_id: string;
  bounced_at: string;
  credit_refunded: boolean;
  refunded_at: string | null;
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
