export function statusKind(badge: string): "done" | "running" | "failed" {
  const b = badge.toLowerCase();
  if (b.includes("fail")) return "failed";
  if (b.includes("run")) return "running";
  return "done";
}
