const RECENT_KEY = "ethereal_search_recent";
const MAX_RECENT = 5;

function loadRecentRaw(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function useRecentSearches() {
  const recent = loadRecentRaw();
  const pushRecent = (query: string) => {
    const text = query.trim();
    if (!text) return;
    const prev = loadRecentRaw().filter((x) => x.toLowerCase() !== text.toLowerCase());
    prev.unshift(text);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(prev.slice(0, MAX_RECENT)));
    } catch {
      // Ignore persistence failures.
    }
  };
  return { recent, pushRecent };
}
