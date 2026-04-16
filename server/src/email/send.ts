import { Resend } from "resend";
import type { SubmissionSnapshot } from "../logic/constants.js";
import { isValidEmail } from "../logic/parse.js";
import { buildHtmlEmailBody, buildHtmlFallbackPlainBody } from "./htmlEmail.js";

export type EmailSendResult = { sent: boolean; reason: string; error: string };

export function resolveDeliveryStatus(emailResult: EmailSendResult): string {
  if (emailResult.sent) return "sent";
  if (emailResult.reason === "no_email") return "generated_no_email";
  if (emailResult.reason === "invalid_email") return "generated_invalid_email";
  if (emailResult.reason === "email_failed") return "generated_email_failed";
  return "generated";
}

function listText(value: unknown): string {
  if (Array.isArray(value)) {
    const joined = value.map((item) => String(item ?? "").trim()).filter(Boolean).join(", ");
    return joined || "-";
  }
  const text = String(value ?? "").trim();
  return text || "-";
}

export async function sendKitEmail(data: SubmissionSnapshot, aiContent: Record<string, unknown>): Promise<EmailSendResult> {
  const apiKey = String(process.env.RESEND_API_KEY ?? "").trim();
  const from = String(process.env.RESEND_FROM ?? "").trim();

  if (!apiKey || !from) {
    return { sent: false, reason: "no_provider", error: "" };
  }

  if (!data.email) {
    return { sent: false, reason: "no_email", error: "" };
  }

  if (!isValidEmail(data.email)) {
    return { sent: false, reason: "invalid_email", error: "Invalid email format" };
  }

  const resend = new Resend(apiKey);
  const subject = `خطة المحتوى الجاهزة لبراند ${data.brand_name} 🚀`;
  const html = buildHtmlEmailBody(data, aiContent);
  const text = buildHtmlFallbackPlainBody(data, aiContent);

  try {
    const { error } = await resend.emails.send({
      from,
      to: data.email,
      subject,
      html,
      text,
    });
    if (error) {
      return { sent: false, reason: "email_failed", error: String(error.message ?? error) };
    }
    return { sent: true, reason: "sent", error: "" };
  } catch (e) {
    return { sent: false, reason: "email_failed", error: String(e) };
  }
}

export async function sendClientDelayEmail(data: SubmissionSnapshot, correlationId: string): Promise<EmailSendResult> {
  const apiKey = String(process.env.RESEND_API_KEY ?? "").trim();
  const from = String(process.env.RESEND_FROM ?? "").trim();
  const enabled = String(process.env.CLIENT_DELAY_EMAIL_ENABLED ?? "").toLowerCase() === "true";

  if (!enabled || !apiKey || !from) {
    return { sent: false, reason: "disabled", error: "" };
  }
  if (!data.email || !isValidEmail(data.email)) {
    return { sent: false, reason: "no_email", error: "" };
  }

  const resend = new Resend(apiKey);
  const subject = `تحديث بخصوص طلب المحتوى الخاص ببراند ${data.brand_name}`;
  const body = [
    "مرحبًا،",
    "",
    "طلبك قيد التجهيز حالياً.",
    "بنراجع البيانات ونعالجها للتأكد من خروج المحتوى بأعلى جودة ممكنة.",
    "هيصلك المحتوى في أقرب وقت بعد اكتمال المراجعة.",
    "",
    "البراند: " + (data.brand_name || "-"),
    "الهدف: " + (data.main_goal || "-"),
    "رقم المتابعة: " + correlationId,
    "",
    "شكرًا لثقتك.",
  ].join("\n");

  try {
    const { error } = await resend.emails.send({ from, to: data.email, subject, text: body });
    if (error) return { sent: false, reason: "email_failed", error: String(error.message ?? error) };
    return { sent: true, reason: "sent", error: "" };
  } catch (e) {
    return { sent: false, reason: "email_failed", error: String(e) };
  }
}

export async function sendAdminFailureAlert(
  data: SubmissionSnapshot,
  reason: string,
  correlationId: string,
  kitId: string,
  modelUsed: string,
  clientDelayResult: EmailSendResult
): Promise<EmailSendResult> {
  const enabled = String(process.env.ADMIN_ALERTS_ENABLED ?? "true").toLowerCase() !== "false";
  const adminEmail = String(process.env.ADMIN_ALERT_EMAIL ?? "").trim();
  const apiKey = String(process.env.RESEND_API_KEY ?? "").trim();
  const from = String(process.env.RESEND_FROM ?? "").trim();

  if (!enabled) return { sent: false, reason: "disabled", error: "" };
  if (!adminEmail || !isValidEmail(adminEmail)) {
    return { sent: false, reason: "missing_admin_email", error: "Missing ADMIN_ALERT_EMAIL" };
  }
  if (!apiKey || !from) return { sent: false, reason: "no_provider", error: "" };

  const resend = new Resend(apiKey);
  const subject = "[Gemini Alert] Failed Generation | " + (data.brand_name || "-");
  const body = [
    "Gemini generation failed after the configured retry attempts.",
    "Manual review is now required.",
    "",
    "Brand: " + (data.brand_name || "-"),
    "Client Email: " + (data.email || "-"),
    "Industry: " + (data.industry || "-"),
    "Goal: " + (data.main_goal || "-"),
    "Platforms: " + listText(data.platforms),
    "Model: " + modelUsed,
    "Kit ID: " + kitId,
    "Correlation ID: " + correlationId,
    "Client Delay Email: " + clientDelayResult.reason,
    "",
    "Failure Reason:",
    reason.slice(0, 3000),
  ].join("\n");

  try {
    const { error } = await resend.emails.send({ from, to: adminEmail, subject, text: body });
    if (error) return { sent: false, reason: "email_failed", error: String(error.message ?? error) };
    return { sent: true, reason: "sent", error: "" };
  } catch (e) {
    return { sent: false, reason: "email_failed", error: String(e) };
  }
}
