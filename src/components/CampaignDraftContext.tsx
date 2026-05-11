"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

interface CampaignDraft {
  university: string;
  research: string;
  positionType: string;
  timeCommitment: string;
  availability: string;
  locationPref: string;
  contactCount: number;
  rawCount: string;
}

const DEFAULT_DRAFT: CampaignDraft = {
  university: "",
  research: "",
  positionType: "",
  timeCommitment: "",
  availability: "",
  locationPref: "",
  contactCount: 10,
  rawCount: "10",
};

interface CampaignDraftContextValue {
  draft: CampaignDraft;
  setDraft: (patch: Partial<CampaignDraft>) => void;
  resetDraft: () => void;
}

const CampaignDraftContext = createContext<CampaignDraftContextValue | null>(null);

export function CampaignDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraftState] = useState<CampaignDraft>(DEFAULT_DRAFT);

  function setDraft(patch: Partial<CampaignDraft>) {
    setDraftState((prev) => ({ ...prev, ...patch }));
  }

  function resetDraft() {
    setDraftState(DEFAULT_DRAFT);
  }

  return (
    <CampaignDraftContext.Provider value={{ draft, setDraft, resetDraft }}>
      {children}
    </CampaignDraftContext.Provider>
  );
}

export function useCampaignDraft(): CampaignDraftContextValue {
  const ctx = useContext(CampaignDraftContext);
  if (!ctx) throw new Error("useCampaignDraft must be used inside CampaignDraftProvider");
  return ctx;
}
