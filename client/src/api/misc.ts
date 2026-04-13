import { apiUrl, ApiError, buildHeaders, parseErrorMessage } from "./httpClient";

export type HelpTopicsResponse = {
  resources: Array<{
    id: string;
    title: string;
    desc: string;
    icon: string;
    accent: "primary" | "tertiary";
    haystack: string;
  }>;
  faq: Array<{ q: string; a: string }>;
  last_updated: string;
};

export async function getHelpTopics(q: string): Promise<HelpTopicsResponse> {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  const qs = params.toString();
  const res = await fetch(apiUrl(`/api/help/topics${qs ? `?${qs}` : ""}`), { headers: buildHeaders() });
  if (!res.ok) throw new ApiError(await parseErrorMessage(res, "Failed to load help topics"), res.status);
  return res.json() as Promise<HelpTopicsResponse>;
}

export async function postExtrasWaitlist(tool_id: string, email?: string): Promise<void> {
  const res = await fetch(apiUrl("/api/extras/waitlist"), {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ tool_id, email: email ?? "" }),
  });
  if (!res.ok) throw new ApiError(await parseErrorMessage(res, "Failed to join waitlist"), res.status);
}

export async function getHealth(): Promise<{ ok: boolean; db?: boolean }> {
  const res = await fetch(apiUrl("/health"));
  if (!res.ok) throw new ApiError(await parseErrorMessage(res, "Health check failed"), res.status);
  return res.json() as Promise<{ ok: boolean; db?: boolean }>;
}
