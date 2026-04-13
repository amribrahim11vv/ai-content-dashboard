export type WizardExperimentVariant = "A" | "B";

const STORAGE_KEY = "ai-content-dashboard:wizard-exp:v1";
const QUERY_PARAM = "wizard_exp";

function readFromQuery(): WizardExperimentVariant | null {
  try {
    const value = new URLSearchParams(window.location.search).get(QUERY_PARAM)?.toUpperCase();
    if (value === "A" || value === "B") return value;
    return null;
  } catch {
    return null;
  }
}

function pickWeightedVariant(): WizardExperimentVariant {
  return Math.random() < 0.2 ? "B" : "A";
}

export function getWizardExperimentVariant(): WizardExperimentVariant {
  if (typeof window === "undefined") return "A";

  const fromQuery = readFromQuery();
  if (fromQuery) {
    localStorage.setItem(STORAGE_KEY, fromQuery);
    return fromQuery;
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "A" || stored === "B") return stored;

  const assigned = pickWeightedVariant();
  localStorage.setItem(STORAGE_KEY, assigned);
  return assigned;
}

export function isWizardVariantB() {
  return getWizardExperimentVariant() === "B";
}

