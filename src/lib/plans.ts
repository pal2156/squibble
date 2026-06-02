export const PLAN_LIMITS = {
  free: { searches: 3, emails: 2 },
  pro: { searches: 30, emails: 30 },
  max: { searches: 75, emails: 75 },
} as const;

export type Plan = keyof typeof PLAN_LIMITS;
