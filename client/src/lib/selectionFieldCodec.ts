import type { SelectionOption } from "../pages/wizards/selectionOptions";

const SPLIT_RE = /[,،]/g;

function cleanToken(v: string): string {
  return v.replace(/\s+/g, " ").trim();
}

export function splitSelectionString(raw: unknown): string[] {
  return String(raw ?? "")
    .split(SPLIT_RE)
    .map(cleanToken)
    .filter(Boolean);
}

function optionMatches(token: string, option: SelectionOption): boolean {
  const t = token.toLowerCase();
  return t === option.value.toLowerCase() || t === option.labelAr.toLowerCase();
}

export function decodeSingleSelection(raw: unknown, options: readonly SelectionOption[]) {
  const tokens = splitSelectionString(raw);
  const first = tokens[0] ?? "";
  if (!first) return { selected: "", otherText: "" };
  const matched = options.find((o) => optionMatches(first, o));
  if (matched) return { selected: matched.value, otherText: "" };
  return { selected: "__other__", otherText: first };
}

export function decodeMultiSelection(raw: unknown, options: readonly SelectionOption[]) {
  const tokens = splitSelectionString(raw);
  const selected = new Set<string>();
  const others: string[] = [];
  for (const token of tokens) {
    const matched = options.find((o) => optionMatches(token, o));
    if (matched) selected.add(matched.value);
    else others.push(token);
  }
  return {
    selected: Array.from(selected),
    otherText: others.join("، "),
  };
}

export function encodeSingleSelection(selected: string, otherText: string, options: readonly SelectionOption[]): string {
  if (!selected) return "";
  if (selected === "__other__") return cleanToken(otherText);
  const matched = options.find((o) => o.value === selected);
  return matched?.labelAr ?? "";
}

export function encodeMultiSelection(selected: readonly string[], otherText: string, options: readonly SelectionOption[]): string {
  const labels = selected
    .map((value) => options.find((o) => o.value === value)?.labelAr ?? "")
    .map(cleanToken)
    .filter(Boolean);
  const other = cleanToken(otherText);
  if (other) labels.push(other);
  return labels.join("، ");
}
