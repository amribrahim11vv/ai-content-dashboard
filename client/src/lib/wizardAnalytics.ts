import { getWizardExperimentVariant, type WizardExperimentVariant } from "./wizardExperiment";
import { getDeviceId } from "./deviceId";

export type WizardEventName =
  | "wizard_started"
  | "wizard_step_viewed"
  | "wizard_step_next_clicked"
  | "wizard_step_validation_failed"
  | "wizard_generate_clicked"
  | "kit_created_success"
  | "kit_created_failed";

export type WizardType = "social" | "offer" | "deep" | "unknown";

export type WizardEventPayload = {
  name: WizardEventName;
  ts: number;
  wizard_type: WizardType;
  draft_key: string;
  step_id?: string;
  step_index?: number;
  total_steps?: number;
  validation_state?: "passed" | "failed";
  elapsed_time_ms?: number;
  kit_id?: string;
  error?: string;
  restored_draft?: boolean;
  experiment_variant?: WizardExperimentVariant;
};

const STORAGE_KEY = "ai-content-dashboard:wizard-analytics-buffer:v1";
const MAX_BUFFER = 200;
const PENDING_KEY = "ai-content-dashboard:wizard-analytics-pending:v1";
const SEND_BATCH_SIZE = 20;
const SEND_DEBOUNCE_MS = 2500;
let flushTimer: number | null = null;

export function getWizardTypeFromDraftKey(draftKey: string): WizardType {
  if (draftKey.includes(":social:")) return "social";
  if (draftKey.includes(":offer:")) return "offer";
  if (draftKey.includes(":deep:")) return "deep";
  return "unknown";
}

function appendToLocalBuffer(payload: WizardEventPayload) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const prev: WizardEventPayload[] = raw ? (JSON.parse(raw) as WizardEventPayload[]) : [];
    const next = [...prev, payload].slice(-MAX_BUFFER);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage issues
  }
}

function readPendingQueue(): WizardEventPayload[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WizardEventPayload[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePendingQueue(events: WizardEventPayload[]) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(events.slice(-MAX_BUFFER)));
  } catch {
    // ignore queue issues
  }
}

function queuePending(payload: WizardEventPayload) {
  const prev = readPendingQueue();
  writePendingQueue([...prev, payload]);
}

async function shipWizardEvents(events: WizardEventPayload[]) {
  if (!events.length) return true;
  const endpoint = import.meta.env.VITE_WIZARD_ANALYTICS_ENDPOINT ?? "/api/analytics/wizard-events";
  try {
    const body = JSON.stringify({ events });
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      const ok = navigator.sendBeacon(endpoint, blob);
      if (ok) return true;
    }
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Device-ID": getDeviceId() },
      body,
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function flushPendingQueue() {
  const queue = readPendingQueue();
  if (!queue.length) return;
  const batch = queue.slice(0, SEND_BATCH_SIZE);
  const ok = await shipWizardEvents(batch);
  if (!ok) return;
  writePendingQueue(queue.slice(batch.length));
  if (readPendingQueue().length) {
    scheduleFlush();
  }
}

function scheduleFlush() {
  if (flushTimer != null) return;
  flushTimer = window.setTimeout(async () => {
    flushTimer = null;
    await flushPendingQueue();
  }, SEND_DEBOUNCE_MS);
}

export function emitWizardEvent(payload: Omit<WizardEventPayload, "ts">) {
  const eventPayload: WizardEventPayload = {
    ...payload,
    experiment_variant: payload.experiment_variant ?? getWizardExperimentVariant(),
    ts: Date.now(),
  };
  appendToLocalBuffer(eventPayload);
  queuePending(eventPayload);
  scheduleFlush();
  window.dispatchEvent(new CustomEvent("wizard:analytics", { detail: eventPayload }));
  if (import.meta.env.DEV) {
    console.debug("[wizard]", eventPayload);
  }
}

