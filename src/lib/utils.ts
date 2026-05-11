import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function cleanDescription(text: string | null | undefined): string {
  if (!text) return "";

  return text
    // Strip <cite ...>...</cite> tags but keep inner text
    .replace(/<cite[^>]*>([\s\S]*?)<\/cite>/gi, "$1")
    // Strip any remaining XML/HTML tags
    .replace(/<[^>]+>/g, "")
    // Replace em dashes (—, --, or &mdash;) with commas
    .replace(/—/g, ",")
    .replace(/--/g, ",")
    .replace(/&mdash;/gi, ",")
    // Decode common HTML entities
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    // Collapse line breaks and whitespace into single spaces
    .replace(/[\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
