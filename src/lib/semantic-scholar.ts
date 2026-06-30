// Thin wrapper around the public Semantic Scholar Graph API.
// Looked up fresh for every campaign, for the top N professors only —
// never cached or reused across campaigns.

import type { Professor, RecentPaper } from "@/lib/types";

const BASE_URL = "https://api.semanticscholar.org/graph/v1";

const AFFILIATION_PREFILTER_THRESHOLD = 5;

const KNOWN_SHORT_NAMES: Record<string, string> = {
  "massachusetts institute of technology": "mit",
  "california institute of technology": "caltech",
  "university of pennsylvania": "penn",
  "johns hopkins university": "jhu",
  "university of illinois at urbana-champaign": "uiuc",
  "university of illinois urbana-champaign": "uiuc",
  "university of michigan": "umich",
  "university of california, berkeley": "berkeley",
  "university of california berkeley": "berkeley",
};

function headers(): HeadersInit {
  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
  return apiKey ? { "x-api-key": apiKey } : {};
}

function foldDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function stripPunctuation(s: string): string {
  return s.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function normalizeNameTokens(name: string): string[] {
  return stripPunctuation(foldDiacritics(name.toLowerCase())).split(" ").filter(Boolean);
}

// Names match if their first and last tokens agree; middle names/initials are
// optional and ignored on either side.
function namesMatch(a: string, b: string): boolean {
  const tokensA = normalizeNameTokens(a);
  const tokensB = normalizeNameTokens(b);
  if (tokensA.length === 0 || tokensB.length === 0) return false;
  const firstA = tokensA[0];
  const lastA = tokensA[tokensA.length - 1];
  const firstB = tokensB[0];
  const lastB = tokensB[tokensB.length - 1];
  return firstA === firstB && lastA === lastB;
}

function shortUniversityForm(university: string): string {
  const lower = university.toLowerCase().trim();
  if (KNOWN_SHORT_NAMES[lower]) return KNOWN_SHORT_NAMES[lower];
  // Default: drop a trailing "university"/"institute of technology" etc and
  // use the first significant word (e.g. "Columbia University" -> "columbia").
  const firstWord = lower.split(/\s+/)[0];
  return firstWord;
}

function affiliationMatchesUniversity(affiliations: string[] | undefined, university: string): boolean {
  if (!affiliations || affiliations.length === 0) return false;
  const universityLower = university.toLowerCase();
  const shortForm = shortUniversityForm(university);
  return affiliations.some((a) => {
    const aLower = a.toLowerCase();
    return aLower.includes(universityLower) || aLower.includes(shortForm) || universityLower.includes(aLower);
  });
}

const STOP_WORDS = new Set([
  "the", "and", "of", "in", "to", "a", "an", "for", "with", "is", "are", "was", "were", "by", "from", "on", "at",
  "as", "that", "this", "it", "its", "be", "or", "but", "not", "their", "his", "her", "they", "we", "our",
]);

const GENERIC_ACADEMIC_WORDS = new Set([
  "research", "study", "work", "project", "method", "approach", "technique", "field", "area", "interest", "focus",
  "using", "based", "including", "involves", "aims",
]);

function extractKeywords(researchDescription: string | null): string[] {
  if (!researchDescription) return [];
  const tokens = stripPunctuation(researchDescription.toLowerCase()).split(" ").filter(Boolean);
  const keywords = tokens.filter(
    (t) => t.length >= 5 && !STOP_WORDS.has(t) && !GENERIC_ACADEMIC_WORDS.has(t)
  );
  return [...new Set(keywords)];
}

function titleContainsKeyword(title: string, keywords: string[]): boolean {
  const titleNorm = foldDiacritics(title.toLowerCase());
  return keywords.some((kw) => titleNorm.includes(kw));
}

type AuthorCandidate = {
  authorId: string;
  name: string;
  affiliations?: string[];
  paperCount?: number;
};

type Paper = { title?: string; year?: number | null };

async function searchAuthors(professorName: string): Promise<AuthorCandidate[]> {
  const url = `${BASE_URL}/author/search?query=${encodeURIComponent(professorName)}&fields=name,affiliations,paperCount&limit=10`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) return [];
  const json = await res.json();
  return (json?.data ?? []) as AuthorCandidate[];
}

async function fetchAuthorPapers(authorId: string): Promise<Paper[]> {
  // Request 10 papers (not 3) because some will have null years and get
  // discarded; sort newest first.
  const url = `${BASE_URL}/author/${authorId}/papers?fields=title,year&sort=year:desc&limit=10`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) return [];
  const json = await res.json();
  return (json?.data ?? []) as Paper[];
}

export type PaperTier = "confirmed" | "drifted" | "neutral" | "not_found";

export type FindPapersResult = {
  papers: RecentPaper[] | null;
  tier: PaperTier;
};

function topDatedPapers(papers: Paper[]): RecentPaper[] {
  return papers
    .filter((p): p is { title: string; year: number } => !!p.title && p.year != null)
    .sort((a, b) => b.year - a.year)
    .slice(0, 3)
    .map((p) => ({ title: p.title, year: p.year }));
}

export async function findRecentPapers(
  professor: Professor,
  university: string
): Promise<FindPapersResult> {
  try {
    const allCandidates = await searchAuthors(professor.name);
    console.log(`[semantic-scholar] ${professor.name}: ${allCandidates.length} raw candidates from search`);

    // Step 1: name normalization / match.
    let candidates = allCandidates.filter((c) => namesMatch(professor.name, c.name));
    console.log(`[semantic-scholar] ${professor.name}: ${candidates.length} after name match`);
    if (candidates.length === 0) return { papers: null, tier: "not_found" };

    // Step 2: affiliation pre-filter, only when many candidates survive the
    // name check — pure cost control, not the confirmation step.
    if (candidates.length > AFFILIATION_PREFILTER_THRESHOLD) {
      const affiliationFiltered = candidates.filter((c) => affiliationMatchesUniversity(c.affiliations, university));
      console.log(`[semantic-scholar] ${professor.name}: ${affiliationFiltered.length} after affiliation prefilter (from ${candidates.length})`);
      if (affiliationFiltered.length === 0) return { papers: null, tier: "not_found" };
      candidates = affiliationFiltered;
    }

    // Step 3: fetch papers for every surviving candidate.
    const keywords = extractKeywords(professor.research_description);
    console.log(`[semantic-scholar] ${professor.name}: ${candidates.length} candidates going to paper fetch, ${keywords.length} keywords`);
    const withPapers = await Promise.all(
      candidates.map(async (c) => ({ candidate: c, papers: await fetchAuthorPapers(c.authorId) }))
    );
    withPapers.forEach(({ candidate, papers }) => {
      console.log(`[semantic-scholar] ${professor.name}: candidate "${candidate.name}" (${candidate.authorId}) has ${papers.length} papers, affiliations: ${JSON.stringify(candidate.affiliations ?? [])}`);
    });

    // Step 4: compute signals A (affiliation) and B (keyword overlap in titles).
    const signaled = withPapers.map(({ candidate, papers }) => {
      const signalA = affiliationMatchesUniversity(candidate.affiliations, university);
      const signalB = keywords.length > 0 && papers.some((p) => p.title && titleContainsKeyword(p.title, keywords));
      return { candidate, papers, signalA, signalB };
    });

    const keywordMatches = signaled.filter((s) => s.signalB);
    const affiliationMatches = signaled.filter((s) => s.signalA);
    console.log(`[semantic-scholar] ${professor.name}: keywordMatches=${keywordMatches.length}, affiliationMatches=${affiliationMatches.length}`);

    // Confirmed: exactly one candidate whose papers match the description keywords.
    if (keywordMatches.length === 1) {
      const papers = topDatedPapers(keywordMatches[0].papers);
      if (papers.length === 0) return { papers: null, tier: "not_found" };
      return { papers, tier: "confirmed" };
    }

    // Drifted or neutral: no keyword match, but exactly one candidate confirmed
    // by affiliation. Drifted when keywords are present (description said one
    // thing, recent papers show another); neutral when no keywords to compare.
    if (keywordMatches.length === 0 && affiliationMatches.length === 1) {
      const papers = topDatedPapers(affiliationMatches[0].papers);
      if (papers.length === 0) return { papers: null, tier: "not_found" };
      const tier: PaperTier = keywords.length === 0 ? "neutral" : "drifted";
      return { papers, tier };
    }

    // Fallback: no signal could pick a unique match, but only one candidate
    // survived name filtering. With a single candidate there is nothing to
    // disambiguate between, so accept them rather than returning not_found.
    // This fires most often when Semantic Scholar omits affiliation data and
    // the professor's description keywords don't appear verbatim in titles.
    if (candidates.length === 1) {
      console.log(`[semantic-scholar] ${professor.name}: single-candidate fallback`);
      const papers = topDatedPapers(withPapers[0].papers);
      if (papers.length === 0) return { papers: null, tier: "not_found" };
      return { papers, tier: "neutral" };
    }

    console.log(`[semantic-scholar] ${professor.name}: not_found (${candidates.length} candidates, no unique signal)`);
    return { papers: null, tier: "not_found" };
  } catch (err) {
    console.error(`[semantic-scholar] lookup failed for ${professor.name}:`, err instanceof Error ? err.message : err);
    return { papers: null, tier: "not_found" };
  }
}
