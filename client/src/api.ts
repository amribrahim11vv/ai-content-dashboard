import type { KitSummary } from "./types";
import type { BriefForm } from "./types";

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const base = import.meta.env.VITE_API_URL ?? "";
const secret = import.meta.env.VITE_API_SECRET ?? "";

function headers(extra?: Record<string, string>): HeadersInit {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: "Bearer " + secret,
    ...extra,
  };
  return h;
}

export async function generateKit(brief: BriefForm, idempotencyKey: string): Promise<KitSummary> {
  const res = await fetch(`${base}/api/kits/generate`, {
    method: "POST",
    headers: headers({ "Idempotency-Key": idempotencyKey }),
    body: JSON.stringify({ ...brief, submitted_at: new Date().toISOString() }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<KitSummary>;
}

export async function listKits(): Promise<KitSummary[]> {
  const res = await fetch(`${base}/api/kits`, { headers: headers() });
  if (!res.ok) throw new Error("Failed to list kits");
  return res.json() as Promise<KitSummary[]>;
}

export async function getKit(id: string): Promise<KitSummary> {
  const res = await fetch(`${base}/api/kits/${id}`, { headers: headers() });
  if (!res.ok) throw new Error("Not found");
  return res.json() as Promise<KitSummary>;
}

export async function retryKit(id: string, briefJson: string, rowVersion: number): Promise<KitSummary> {
  const res = await fetch(`${base}/api/kits/${id}/retry`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ brief_json: briefJson, row_version: rowVersion }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    const msg = (j as { error?: string }).error ?? res.statusText;
    throw new ApiError(msg, res.status);
  }
  return res.json() as Promise<KitSummary>;
}

export async function regenerateKitItem(
  id: string,
  payload: {
    item_type: "post" | "image" | "video";
    index: number;
    row_version: number;
    feedback?: string;
  }
): Promise<KitSummary> {
  const res = await fetch(`${base}/api/kits/${id}/regenerate-item`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    const msg = (j as { error?: string }).error ?? res.statusText;
    throw new ApiError(msg, res.status);
  }
  return res.json() as Promise<KitSummary>;
}

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  kind: string;
  kit_id: string | null;
  read: boolean;
  created_at: string;
};

export async function listNotifications(): Promise<{ items: NotificationItem[] }> {
  const res = await fetch(`${base}/api/notifications`, { headers: headers() });
  if (!res.ok) throw new Error("Failed to load notifications");
  return res.json() as Promise<{ items: NotificationItem[] }>;
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await fetch(`${base}/api/notifications/read-all`, { method: "PATCH", headers: headers() });
  if (!res.ok) throw new Error("Failed to mark notifications read");
}

export type StudioProfile = { display_name: string; email: string; updated_at: string };

export async function getProfile(): Promise<StudioProfile> {
  const res = await fetch(`${base}/api/profile`, { headers: headers() });
  if (!res.ok) throw new Error("Failed to load profile");
  return res.json() as Promise<StudioProfile>;
}

export async function updateProfile(partial: { display_name?: string; email?: string }): Promise<StudioProfile> {
  const res = await fetch(`${base}/api/profile`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify(partial),
  });
  if (!res.ok) throw new Error("Failed to save profile");
  return res.json() as Promise<StudioProfile>;
}

export type StudioPreferences = { compact_table: boolean; updated_at: string };

export async function getPreferences(): Promise<StudioPreferences> {
  const res = await fetch(`${base}/api/preferences`, { headers: headers() });
  if (!res.ok) throw new Error("Failed to load preferences");
  return res.json() as Promise<StudioPreferences>;
}

export async function updatePreferences(compact_table: boolean): Promise<StudioPreferences> {
  const res = await fetch(`${base}/api/preferences`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({ compact_table }),
  });
  if (!res.ok) throw new Error("Failed to save preferences");
  return res.json() as Promise<StudioPreferences>;
}

export type BrandVoicePillar = { title: string; body: string };

export type BrandVoicePayload = {
  pillars: BrandVoicePillar[];
  avoid_words: string[];
  sample_snippet: string;
  updated_at: string;
};

export async function getBrandVoice(): Promise<BrandVoicePayload> {
  const res = await fetch(`${base}/api/brand-voice`, { headers: headers() });
  if (!res.ok) throw new Error("Failed to load brand voice");
  return res.json() as Promise<BrandVoicePayload>;
}

export async function updateBrandVoice(payload: {
  pillars: BrandVoicePillar[];
  avoid_words: string[];
  sample_snippet: string;
}): Promise<BrandVoicePayload> {
  const res = await fetch(`${base}/api/brand-voice`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to save brand voice");
  return res.json() as Promise<BrandVoicePayload>;
}

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
  const res = await fetch(`${base}/api/help/topics${qs ? `?${qs}` : ""}`, { headers: headers() });
  if (!res.ok) throw new Error("Failed to load help topics");
  return res.json() as Promise<HelpTopicsResponse>;
}

export async function postExtrasWaitlist(tool_id: string, email?: string): Promise<void> {
  const res = await fetch(`${base}/api/extras/waitlist`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ tool_id, email: email ?? "" }),
  });
  if (!res.ok) throw new Error("Failed to join waitlist");
}

export async function getHealth(): Promise<{ ok: boolean; db?: boolean }> {
  const res = await fetch(`${base}/health`);
  if (!res.ok) throw new Error("Health check failed");
  return res.json() as Promise<{ ok: boolean; db?: boolean }>;
}

export type PromptCatalogIndustry = {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  active_prompt_version_id: string | null;
  active_prompt_version: number | null;
};

export type PromptCatalogPrompt = {
  id: string;
  industry_id: string | null;
  version: number;
  status: "draft" | "active";
  prompt_template: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export async function listPromptCatalogIndustries(): Promise<{ items: PromptCatalogIndustry[] }> {
  const res = await fetch(`${base}/api/prompt-catalog/industries`, { headers: headers() });
  if (!res.ok) throw new Error("Failed to load industries");
  return res.json() as Promise<{ items: PromptCatalogIndustry[] }>;
}

export async function createPromptCatalogIndustry(payload: {
  slug: string;
  name: string;
  is_active?: boolean;
}): Promise<PromptCatalogIndustry> {
  const res = await fetch(`${base}/api/prompt-catalog/industries`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? "Failed to create industry");
  }
  return res.json() as Promise<PromptCatalogIndustry>;
}

export async function listPromptVersions(industrySlug?: string): Promise<{
  items: PromptCatalogPrompt[];
  required_variables: readonly string[];
}> {
  const qs = industrySlug ? `?industry_slug=${encodeURIComponent(industrySlug)}` : "";
  const res = await fetch(`${base}/api/prompt-catalog/prompts${qs}`, { headers: headers() });
  if (!res.ok) throw new Error("Failed to load prompt versions");
  return res.json() as Promise<{ items: PromptCatalogPrompt[]; required_variables: readonly string[] }>;
}

export async function createPromptVersion(payload: {
  industry_slug?: string | null;
  prompt_template: string;
  notes?: string;
  status?: "draft" | "active";
}): Promise<{
  item: PromptCatalogPrompt;
  template_warnings?: { missing_variables: string[] };
}> {
  const res = await fetch(`${base}/api/prompt-catalog/prompts`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as {
      error?: string;
      missing_variables?: string[];
    };
    let msg = j.error ?? "Failed to create prompt version";
    if (j.missing_variables?.length) {
      msg += ` — Missing placeholders: ${j.missing_variables.map((v) => `{{${v}}}`).join(", ")}`;
    }
    throw new Error(msg);
  }
  return res.json() as Promise<{
    item: PromptCatalogPrompt;
    template_warnings?: { missing_variables: string[] };
  }>;
}

export async function activatePromptVersion(id: string): Promise<{ item: PromptCatalogPrompt }> {
  const res = await fetch(`${base}/api/prompt-catalog/prompts/${id}/activate`, {
    method: "POST",
    headers: headers(),
  });
  if (!res.ok) throw new Error("Failed to activate prompt version");
  return res.json() as Promise<{ item: PromptCatalogPrompt }>;
}

export async function deletePromptVersion(id: string): Promise<{ ok: true }> {
  const res = await fetch(`${base}/api/prompt-catalog/prompts/${id}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "Failed to delete prompt version");
  }
  return res.json() as Promise<{ ok: true }>;
}

export async function getFallbackPrompt(): Promise<{ item: PromptCatalogPrompt }> {
  const res = await fetch(`${base}/api/prompt-catalog/fallback`, { headers: headers() });
  if (!res.ok) throw new Error("No active fallback prompt");
  return res.json() as Promise<{ item: PromptCatalogPrompt }>;
}

export async function validatePromptTemplate(prompt_template: string): Promise<{
  ok: boolean;
  missing_variables: string[];
  found_variables: string[];
  mode?: "creative_only" | "template_placeholders";
  required_variables: readonly string[];
  strict_mode?: boolean;
}> {
  const res = await fetch(`${base}/api/prompt-catalog/prompts/validate`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ prompt_template }),
  });
  if (!res.ok) throw new Error("Prompt validation failed");
  return res.json() as Promise<{
    ok: boolean;
    missing_variables: string[];
    found_variables: string[];
    mode?: "creative_only" | "template_placeholders";
    required_variables: readonly string[];
    strict_mode?: boolean;
  }>;
}
