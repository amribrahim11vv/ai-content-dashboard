import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import type { KitPostItem, KitSummary } from "./types";
import {
  buildKitViewModel,
  type KitContentIdeasPackageView,
  type KitStrategyMetadata,
} from "./features/kits/kitViewModel";
import { useKitRegenerate } from "./features/kits/useKitRegenerate";
import RegenerateFeedbackDialog from "./features/kits/RegenerateFeedbackDialog";

const TOC_ID = "kit-plan-toc";
const SCROLL_MARGIN = "6rem";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Copy with brief success state on the control itself */
function CopyFieldButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  const copy = useCallback(async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      window.setTimeout(() => setDone(false), 2000);
    } catch {
      /* ignore */
    }
  }, [text]);
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void copy();
      }}
      className="relative z-10 inline-flex shrink-0 touch-manipulation items-center gap-1 rounded-lg border border-brand-sand/30 bg-earth-card px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface transition hover:bg-earth-alt dark:border-outline/25 dark:bg-surface-container-high dark:hover:bg-surface-container-highest focus-visible:ring-2 focus-visible:ring-primary/40"
      title={label}
      aria-label={label}
    >
      <span className="material-symbols-outlined text-sm">{done ? "check" : "content_copy"}</span>
      {done ? "Copied" : "Copy"}
    </button>
  );
}

function RegenerateButton({
  onClick,
  loading,
}: {
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  loading: boolean;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      disabled={loading}
      className="relative z-10 inline-flex shrink-0 touch-manipulation items-center gap-1 rounded-lg border border-brand-sand/30 bg-earth-card px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-primary transition hover:bg-earth-alt dark:border-outline/25 dark:bg-surface-container-high dark:text-on-surface dark:hover:bg-surface-container-highest focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-55"
      title="Regenerate this item"
      aria-label="Regenerate this item"
    >
      <span className={"material-symbols-outlined text-sm " + (loading ? "animate-spin" : "")}>
        {loading ? "autorenew" : "refresh"}
      </span>
      {loading ? "Regenerating..." : "Regenerate"}
    </button>
  );
}

/** Toolbar above content — avoids absolute-positioned controls overlapping sibling cards in a grid. */
function BlockWithCopy({
  children,
  copyText,
  copyLabel,
  className = "",
}: {
  children: ReactNode;
  copyText: string;
  copyLabel: string;
  className?: string;
}) {
  return (
    <div className={className ? `min-w-0 max-w-full overflow-x-clip ${className}` : "min-w-0 max-w-full overflow-x-clip"}>
      <div className="mb-2 flex justify-end">
        <CopyFieldButton text={copyText} label={copyLabel} />
      </div>
      <div className="min-w-0 max-w-full" onPointerDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/**
 * One labeled block: header row (label + copy) separated from body so RTL/LTR text
 * never runs under the button.
 */
function FieldBlock({
  label,
  copyText,
  copyLabel,
  children,
  bodyClassName = "p-3",
}: {
  label: string;
  copyText: string;
  copyLabel: string;
  children: ReactNode;
  /** e.g. p-0 when inner pre supplies its own padding */
  bodyClassName?: string;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-brand-sand/25 bg-earth-card/90 shadow-sm shadow-surface/20 dark:border-outline/20 dark:bg-surface-container-lowest/75">
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-brand-sand/20 bg-earth-alt/50 px-3 py-2.5 dark:border-outline/15 dark:bg-surface-container-high/20">
        <span className="min-w-0 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
          {label}
        </span>
        <CopyFieldButton text={copyText} label={copyLabel} />
      </div>
      <div className={`min-w-0 max-w-full ${bodyClassName}`} dir="auto">
        {children}
      </div>
    </div>
  );
}

/** `video_prompts` entries often use `scenes[]` instead of a flat `prompt` string. */
const IMAGE_DESIGN_FIELD_DEFS: { key: string; label: string }[] = [
  { key: "platform_format", label: "Format" },
  { key: "design_type", label: "Design type" },
  { key: "goal", label: "Goal" },
  { key: "visual_scene", label: "Visual scene" },
  { key: "headline_text_overlay", label: "Headline overlay" },
  { key: "supporting_copy", label: "Supporting copy" },
  { key: "full_ai_image_prompt", label: "Full AI image prompt" },
  { key: "caption", label: "Caption" },
  { key: "text_policy", label: "Text policy" },
  { key: "conversion_trigger", label: "Conversion trigger" },
];

type ViewerLang = "ar" | "en";

function pickByLang(
  item: Record<string, unknown> | KitPostItem,
  lang: ViewerLang,
  keyAr: string,
  keyEn: string,
  legacyKey?: string
): string {
  const ar = (item as Record<string, unknown>)[keyAr];
  const en = (item as Record<string, unknown>)[keyEn];
  const legacy = legacyKey ? (item as Record<string, unknown>)[legacyKey] : undefined;
  if (lang === "ar" && typeof ar === "string" && ar.trim()) return ar.trim();
  if (lang === "en" && typeof en === "string" && en.trim()) return en.trim();
  if (typeof ar === "string" && ar.trim()) return ar.trim();
  if (typeof en === "string" && en.trim()) return en.trim();
  if (typeof legacy === "string" && legacy.trim()) return legacy.trim();
  return "";
}

function isVideoBlueprint(rec: Record<string, unknown>): boolean {
  const s = rec.scenes;
  return Array.isArray(s) && s.length > 0 && s.some((x) => isRecord(x));
}

function isRichImageDesign(rec: Record<string, unknown>): boolean {
  if (isVideoBlueprint(rec)) return false;
  return IMAGE_DESIGN_FIELD_DEFS.some(({ key }) => {
    const v = rec[key];
    return typeof v === "string" && v.trim().length > 0;
  });
}

function videoBlueprintFormattedCopy(rec: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const key of ["platform", "duration", "style", "hook_type"] as const) {
    const v = rec[key];
    if (typeof v === "string" && v.trim()) lines.push(`${key}: ${v}`);
  }
  const scenes = Array.isArray(rec.scenes) ? rec.scenes.filter((x): x is Record<string, unknown> => isRecord(x)) : [];
  scenes.forEach((sc, i) => {
    lines.push("");
    const head = [
      `Scene ${i + 1}`,
      typeof sc.time === "string" ? sc.time : "",
      typeof sc.label === "string" ? sc.label : "",
    ]
      .filter(Boolean)
      .join(" — ");
    lines.push(head);
    for (const k of ["visual", "text", "audio"] as const) {
      const v = sc[k];
      if (typeof v === "string" && v.trim()) lines.push(`${k}: ${v}`);
    }
  });
  for (const key of ["ai_tool_instructions", "why_this_converts"] as const) {
    const v = rec[key];
    if (typeof v === "string" && v.trim()) {
      lines.push("");
      lines.push(`${key}: ${v}`);
    }
  }
  return lines.join("\n");
}

function imageDesignFormattedCopy(rec: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const { key, label } of IMAGE_DESIGN_FIELD_DEFS) {
    if (key === "caption") continue;
    const v = rec[key];
    if (typeof v === "string" && v.trim()) parts.push(`${label}: ${v}`);
  }
  return parts.join("\n\n");
}

function getKitMediaItemTitle(rec: Record<string, unknown>, index: number, fallback: "image" | "video"): string {
  const fromTitle =
    (typeof rec.title === "string" && rec.title) ||
    (typeof rec.name === "string" && rec.name) ||
    (typeof rec.scene === "string" && rec.scene) ||
    (typeof rec.design_type === "string" && rec.design_type) ||
    (typeof rec.platform === "string" && rec.platform);
  if (fromTitle) return fromTitle;
  return `${fallback === "image" ? "Image" : "Video"} ${index + 1}`;
}

/** Flat string body when the model didn’t return `scenes` / image_design fields we render as cards. */
function getKitMediaPlainBody(rec: Record<string, unknown>, kind: "image" | "video"): string {
  const tryKeys =
    kind === "image"
      ? [
          "full_ai_image_prompt",
          "visual_scene",
          "headline_text_overlay",
          "supporting_copy",
          "prompt",
          "description",
          "visual",
        ]
      : ["prompt", "description", "script", "visual"];
  const chunks: string[] = [];
  for (const k of tryKeys) {
    const v = rec[k];
    if (typeof v === "string" && v.trim()) chunks.push(v.trim());
  }
  if (chunks.length) return chunks.join("\n\n");
  return JSON.stringify(rec, null, 2);
}

/** Strategy blocks: server schema uses string fields + string[] + objection pairs */
function stratStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function stratStrArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function stratObjectionPairs(v: unknown): { objection: string; response: string }[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => isRecord(x))
    .map((o) => ({ objection: stratStr(o.objection), response: stratStr(o.response) }))
    .filter((p) => p.objection || p.response);
}

function marketingStrategyPlainText(data: Record<string, unknown>): string {
  const lines: string[] = [];
  const pushBlock = (title: string, body: string) => {
    if (!body) return;
    lines.push(title, body, "");
  };
  pushBlock("Content mix plan", stratStr(data.content_mix_plan));
  pushBlock("Weekly posting plan", stratStr(data.weekly_posting_plan));
  pushBlock("Platform strategy", stratStr(data.platform_strategy));
  const angles = stratStrArr(data.key_messaging_angles);
  if (angles.length) {
    lines.push("Key messaging angles");
    angles.forEach((a) => lines.push(`• ${a}`));
    lines.push("");
  }
  pushBlock("Brand positioning statement", stratStr(data.brand_positioning_statement));
  return lines.join("\n").trim();
}

function salesSystemPlainText(data: Record<string, unknown>): string {
  const lines: string[] = [];
  const pains = stratStrArr(data.pain_points);
  if (pains.length) {
    lines.push("Pain points");
    pains.forEach((p) => lines.push(`• ${p}`));
    lines.push("");
  }
  const pushBlock = (title: string, body: string) => {
    if (!body) return;
    lines.push(title, body, "");
  };
  pushBlock("Offer structuring", stratStr(data.offer_structuring));
  pushBlock("Funnel plan", stratStr(data.funnel_plan));
  const ads = stratStrArr(data.ad_angles);
  if (ads.length) {
    lines.push("Ad angles");
    ads.forEach((a) => lines.push(`• ${a}`));
    lines.push("");
  }
  stratObjectionPairs(data.objection_handling).forEach((pair, i) => {
    lines.push(`Objection ${i + 1}`, pair.objection, "Response", pair.response, "");
  });
  pushBlock("CTA strategy", stratStr(data.cta_strategy));
  return lines.join("\n").trim();
}

function offerOptimizationPlainText(data: Record<string, unknown>): string {
  const lines: string[] = [];
  const pushBlock = (title: string, body: string) => {
    if (!body) return;
    lines.push(title, body, "");
  };
  pushBlock("Rewritten offer", stratStr(data.rewritten_offer));
  pushBlock("Urgency / scarcity", stratStr(data.urgency_or_scarcity));
  const alts = stratStrArr(data.alternative_offers);
  if (alts.length) {
    lines.push("Alternative offers");
    alts.forEach((a) => lines.push(`• ${a}`));
    lines.push("");
  }
  return lines.join("\n").trim();
}

function StrategySubfield({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-on-surface" dir="auto">
        {value}
      </p>
    </div>
  );
}

function hasRationaleFields(rationale: KitStrategyMetadata["strategic_rationale"]): boolean {
  if (!rationale) return false;
  return Boolean(
    (rationale.trigger_used && rationale.trigger_used.trim()) ||
      (rationale.contrast_note && rationale.contrast_note.trim()) ||
      (rationale.engagement_vector && rationale.engagement_vector.trim())
  );
}

function StrategyMetadataPanel({ metadata }: { metadata?: KitStrategyMetadata | null }) {
  if (!metadata) return null;
  const hasAdvantage = Boolean(metadata.algorithmic_advantage && metadata.algorithmic_advantage.trim());
  const hasRationale = hasRationaleFields(metadata.strategic_rationale);
  if (!hasAdvantage && !hasRationale) return null;
  return (
    <div className="rounded-xl border border-brand-sand/25 bg-earth-card/80 p-3 dark:border-outline/20 dark:bg-surface-container-lowest/50">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">AI strategy metadata</p>
      {hasAdvantage ? (
        <p className="mb-2 text-sm leading-relaxed text-on-surface" dir="auto">
          <span className="font-semibold text-brand-accent dark:text-tertiary">Why this converts: </span>
          {metadata.algorithmic_advantage}
        </p>
      ) : null}
      {hasRationale ? (
        <ul className="space-y-1.5 text-sm leading-relaxed text-on-surface" dir="auto">
          {metadata.strategic_rationale?.trigger_used?.trim() ? (
            <li>
              <span className="font-semibold">Trigger:</span> {metadata.strategic_rationale.trigger_used}
            </li>
          ) : null}
          {metadata.strategic_rationale?.contrast_note?.trim() ? (
            <li>
              <span className="font-semibold">Contrast:</span> {metadata.strategic_rationale.contrast_note}
            </li>
          ) : null}
          {metadata.strategic_rationale?.engagement_vector?.trim() ? (
            <li>
              <span className="font-semibold">Engagement vector:</span> {metadata.strategic_rationale.engagement_vector}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

function StrategyBulletList({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{label}</p>
      <ul className="list-disc space-y-1.5 ps-5 text-sm leading-relaxed text-on-surface">
        {items.map((t, i) => (
          <li key={i} dir="auto">
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MarketingStrategyBody({ data }: { data: Record<string, unknown> }) {
  const angles = stratStrArr(data.key_messaging_angles);
  const structured =
    stratStr(data.content_mix_plan) ||
    stratStr(data.weekly_posting_plan) ||
    stratStr(data.platform_strategy) ||
    angles.length > 0 ||
    stratStr(data.brand_positioning_statement);
  if (!structured) {
    return (
      <pre
        className="max-h-80 overflow-auto rounded-b-xl bg-earth-alt p-4 text-xs text-brand-muted dark:bg-surface-container-lowest dark:text-on-surface-variant"
        dir="ltr"
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  }
  return (
    <div className="space-y-4">
      <StrategySubfield label="Content mix plan" value={stratStr(data.content_mix_plan)} />
      <StrategySubfield label="Weekly posting plan" value={stratStr(data.weekly_posting_plan)} />
      <StrategySubfield label="Platform strategy" value={stratStr(data.platform_strategy)} />
      <StrategyBulletList label="Key messaging angles" items={angles} />
      <StrategySubfield label="Brand positioning statement" value={stratStr(data.brand_positioning_statement)} />
    </div>
  );
}

function SalesSystemBody({ data }: { data: Record<string, unknown> }) {
  const pains = stratStrArr(data.pain_points);
  const ads = stratStrArr(data.ad_angles);
  const objections = stratObjectionPairs(data.objection_handling);
  const structured =
    pains.length > 0 ||
    stratStr(data.offer_structuring) ||
    stratStr(data.funnel_plan) ||
    ads.length > 0 ||
    objections.length > 0 ||
    stratStr(data.cta_strategy);
  if (!structured) {
    return (
      <pre
        className="max-h-80 overflow-auto rounded-b-xl bg-earth-alt p-4 text-xs text-brand-muted dark:bg-surface-container-lowest dark:text-on-surface-variant"
        dir="ltr"
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  }
  return (
    <div className="space-y-4">
      <StrategyBulletList label="Pain points" items={pains} />
      <StrategySubfield label="Offer structuring" value={stratStr(data.offer_structuring)} />
      <StrategySubfield label="Funnel plan" value={stratStr(data.funnel_plan)} />
      <StrategyBulletList label="Ad angles" items={ads} />
      {objections.length > 0 ? (
        <div className="min-w-0 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Objection handling</p>
          <div className="space-y-3">
            {objections.map((pair, i) => (
              <div
                key={i}
                className="rounded-lg border border-brand-sand/20 bg-earth-alt/40 p-3 dark:border-outline/15 dark:bg-surface-container-high/25"
              >
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">Objection</p>
                <p className="whitespace-pre-wrap text-sm text-on-surface" dir="auto">
                  {pair.objection}
                </p>
                <p className="mb-1 mt-3 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                  Response
                </p>
                <p className="whitespace-pre-wrap text-sm text-on-surface" dir="auto">
                  {pair.response}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <StrategySubfield label="CTA strategy" value={stratStr(data.cta_strategy)} />
    </div>
  );
}

function OfferOptimizationBody({ data }: { data: Record<string, unknown> }) {
  const alts = stratStrArr(data.alternative_offers);
  const structured =
    stratStr(data.rewritten_offer) || stratStr(data.urgency_or_scarcity) || alts.length > 0;
  if (!structured) {
    return (
      <pre
        className="max-h-80 overflow-auto rounded-b-xl bg-earth-alt p-4 text-xs text-brand-muted dark:bg-surface-container-lowest dark:text-on-surface-variant"
        dir="ltr"
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  }
  return (
    <div className="space-y-4">
      <StrategySubfield label="Rewritten offer" value={stratStr(data.rewritten_offer)} />
      <StrategySubfield label="Urgency / scarcity" value={stratStr(data.urgency_or_scarcity)} />
      <StrategyBulletList label="Alternative offers" items={alts} />
    </div>
  );
}

function kitArticleShellClass(expanded: boolean): string {
  return (
    "relative isolate min-h-0 min-w-0 max-w-full overflow-x-clip overflow-y-visible rounded-uniform border border-brand-sand/30 bg-earth-card/90 p-3 sm:p-4 dark:border-outline/25 dark:bg-surface-container-lowest/60 " +
    (expanded ? "z-20 shadow-lg shadow-surface/30" : "z-0")
  );
}

/** Video / YouTube-style blueprint with `scenes[]` — one plain-text block (all beats together), optional raw JSON. */
function VideoBlueprintCard({
  item,
  index,
  lang,
  strategy,
  onRegenerate,
  regenerating,
  showTechnical,
}: {
  item: Record<string, unknown>;
  index: number;
  lang: ViewerLang;
  strategy?: KitStrategyMetadata | null;
  onRegenerate: (index: number) => void;
  regenerating: boolean;
  showTechnical: boolean;
}) {
  const uid = useId();
  const toggleId = `${uid}-toggle`;
  const panelId = `${uid}-panel`;
  const [expanded, setExpanded] = useState(false);
  const jsonFull = JSON.stringify(item, null, 2);
  const brief = videoBlueprintFormattedCopy(item);
  const caption = pickByLang(item, lang, "caption_ar", "caption_en", "caption");
  const header =
    [typeof item.platform === "string" ? item.platform : null, typeof item.style === "string" ? item.style : null]
      .filter(Boolean)
      .join(" · ") || `Video ${index + 1}`;

  return (
    <article className={kitArticleShellClass(expanded)}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 touch-manipulation items-center justify-between gap-2 rounded-lg px-1 py-2 text-start transition hover:bg-surface-container-high/20"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          aria-expanded={expanded}
          id={toggleId}
          aria-controls={panelId}
        >
          <h3 className="min-w-0 flex-1 font-headline text-sm font-bold text-on-surface">{header}</h3>
          <span
            className={
              "material-symbols-outlined shrink-0 text-on-surface-variant transition-transform " +
              (expanded ? "rotate-180" : "")
            }
            aria-hidden
          >
            expand_more
          </span>
        </button>
        <RegenerateButton
          loading={regenerating}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRegenerate(index);
          }}
        />
      </div>
      {expanded ? (
        <div
          id={panelId}
          className="mt-1 min-w-0 max-w-full space-y-4 border-t border-outline/15 pt-4"
          role="region"
          aria-labelledby={toggleId}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {caption ? (
            <FieldBlock label="Caption" copyText={caption} copyLabel="Copy caption">
              <p className="min-w-0 text-sm leading-relaxed text-on-surface [overflow-wrap:anywhere]" dir="auto">
                {caption}
              </p>
            </FieldBlock>
          ) : null}
          <StrategyMetadataPanel metadata={strategy} />
          <FieldBlock label="Brief (full script)" copyText={brief} copyLabel="Copy full brief">
            <div
                className="max-h-[min(70vh,36rem)] min-w-0 overflow-y-auto rounded-lg bg-earth-alt/70 p-3 text-sm leading-relaxed text-on-surface [overflow-wrap:anywhere] whitespace-pre-wrap dark:bg-surface-container-high/15"
              dir="auto"
            >
              {brief}
            </div>
          </FieldBlock>
          {showTechnical ? (
            <FieldBlock label="Full JSON" copyText={jsonFull} copyLabel="Copy raw JSON">
              <p className="text-xs text-on-surface-variant">For tools, APIs, or archiving.</p>
            </FieldBlock>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/** `image_designs`-style objects — one plain-text brief (all fields), optional raw JSON. */
function ImageDesignCard({
  item,
  index,
  lang,
  strategy,
  onRegenerate,
  regenerating,
  showTechnical,
}: {
  item: Record<string, unknown>;
  index: number;
  lang: ViewerLang;
  strategy?: KitStrategyMetadata | null;
  onRegenerate: (index: number) => void;
  regenerating: boolean;
  showTechnical: boolean;
}) {
  const uid = useId();
  const toggleId = `${uid}-toggle`;
  const panelId = `${uid}-panel`;
  const [expanded, setExpanded] = useState(false);
  const jsonFull = JSON.stringify(item, null, 2);
  const brief = imageDesignFormattedCopy(item);
  const caption = pickByLang(item, lang, "caption_ar", "caption_en", "caption");
  const header =
    [
      typeof item.design_type === "string" ? item.design_type : null,
      typeof item.platform_format === "string" ? item.platform_format : null,
    ]
      .filter(Boolean)
      .join(" · ") || getKitMediaItemTitle(item, index, "image");

  return (
    <article className={kitArticleShellClass(expanded)}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 touch-manipulation items-center justify-between gap-2 rounded-lg px-1 py-2 text-start transition hover:bg-surface-container-high/20"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          aria-expanded={expanded}
          id={toggleId}
          aria-controls={panelId}
        >
          <h3 className="min-w-0 flex-1 font-headline text-sm font-bold text-on-surface">{header}</h3>
          <span
            className={
              "material-symbols-outlined shrink-0 text-on-surface-variant transition-transform " +
              (expanded ? "rotate-180" : "")
            }
            aria-hidden
          >
            expand_more
          </span>
        </button>
        <RegenerateButton
          loading={regenerating}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRegenerate(index);
          }}
        />
      </div>
      {expanded ? (
        <div
          id={panelId}
          className="mt-1 min-w-0 max-w-full space-y-4 border-t border-outline/15 pt-4"
          role="region"
          aria-labelledby={toggleId}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {caption ? (
            <FieldBlock label="Caption" copyText={caption} copyLabel="Copy caption">
              <p className="min-w-0 text-sm leading-relaxed text-on-surface [overflow-wrap:anywhere]" dir="auto">
                {caption}
              </p>
            </FieldBlock>
          ) : null}
          <StrategyMetadataPanel metadata={strategy} />
          <FieldBlock label="Brief (full design)" copyText={brief} copyLabel="Copy full brief">
            <div
                className="max-h-[min(70vh,36rem)] min-w-0 overflow-y-auto rounded-lg bg-earth-alt/70 p-3 text-sm leading-relaxed text-on-surface [overflow-wrap:anywhere] whitespace-pre-wrap dark:bg-surface-container-high/15"
              dir="auto"
            >
              {brief}
            </div>
          </FieldBlock>
          {showTechnical ? (
            <FieldBlock label="Full JSON" copyText={jsonFull} copyLabel="Copy raw JSON">
              <p className="text-xs text-on-surface-variant">For tools, APIs, or archiving.</p>
            </FieldBlock>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/** Image / video prompt item: same interaction model as PostCard (no <details>, single-column safe). */
function KitPromptCard({
  title,
  body,
  caption,
  strategy,
  onRegenerate,
  regenerating,
  copyLabel,
}: {
  title: string;
  body: string;
  caption?: string;
  strategy?: KitStrategyMetadata | null;
  onRegenerate: () => void;
  regenerating: boolean;
  copyLabel: string;
}) {
  const uid = useId();
  const toggleId = `${uid}-toggle`;
  const panelId = `${uid}-panel`;
  const [expanded, setExpanded] = useState(false);

  return (
    <article
      className={
        "relative isolate min-h-0 min-w-0 max-w-full overflow-x-clip overflow-y-visible rounded-uniform border border-brand-sand/30 bg-earth-card/90 p-3 sm:p-4 dark:border-outline/25 dark:bg-surface-container-lowest/60 " +
        (expanded ? "z-20 shadow-lg shadow-surface/30" : "z-0")
      }
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 touch-manipulation items-center justify-between gap-2 rounded-lg px-1 py-2 text-start transition hover:bg-surface-container-high/20"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          aria-expanded={expanded}
          id={toggleId}
          aria-controls={panelId}
        >
          <h3 className="min-w-0 flex-1 font-headline text-sm font-bold text-on-surface">{title}</h3>
          <span
            className={
              "material-symbols-outlined shrink-0 text-on-surface-variant transition-transform " +
              (expanded ? "rotate-180" : "")
            }
            aria-hidden
          >
            expand_more
          </span>
        </button>
        <RegenerateButton
          loading={regenerating}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRegenerate();
          }}
        />
      </div>
      {expanded ? (
        <div
          id={panelId}
          className="mt-1 min-w-0 max-w-full border-t border-outline/15 pt-3"
          role="region"
          aria-labelledby={toggleId}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="space-y-4">
            {caption ? (
              <FieldBlock label="Caption" copyText={caption} copyLabel="Copy caption">
                <p className="min-w-0 text-sm leading-relaxed text-on-surface [overflow-wrap:anywhere]" dir="auto">
                  {caption}
                </p>
              </FieldBlock>
            ) : null}
            <StrategyMetadataPanel metadata={strategy} />
            <FieldBlock label="Brief" copyText={body} copyLabel={copyLabel} bodyClassName="p-0">
              <pre
                className="max-h-48 min-h-[2.5rem] min-w-0 max-w-full overflow-auto whitespace-pre-wrap break-words p-3 text-xs leading-relaxed text-on-surface-variant [overflow-wrap:anywhere]"
                dir="auto"
              >
                {body}
              </pre>
            </FieldBlock>
          </div>
        </div>
      ) : null}
    </article>
  );
}

/** One social post: independent expand/collapse + layout isolation (no overlapping copy targets). */
function PostCard({
  post,
  index,
  lang,
  strategy,
  onRegenerate,
  regenerating,
}: {
  post: KitPostItem;
  index: number;
  lang: ViewerLang;
  strategy?: KitStrategyMetadata | null;
  onRegenerate: (index: number) => void;
  regenerating: boolean;
}) {
  const uid = useId();
  const toggleId = `${uid}-toggle`;
  const panelId = `${uid}-panel`;
  const [expanded, setExpanded] = useState(false);
  const postText = pickByLang(post, lang, "post_ar", "post_en", "post") || post.caption || "—";
  const hashtags = Array.isArray(post.hashtags) && post.hashtags.length ? post.hashtags.join(" ") : "";
  const cta = post.cta ?? "";
  const goal = post.goal ?? "";
  const combined = [
    goal && `Goal: ${goal}`,
    postText,
    hashtags && `Hashtags: ${hashtags}`,
    cta && `CTA: ${cta}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <article
      className={
        "relative isolate min-h-0 min-w-0 max-w-full overflow-x-clip overflow-y-visible rounded-uniform border border-brand-sand/30 bg-earth-card/90 p-3 sm:p-4 dark:border-outline/25 dark:bg-surface-container-lowest/60 " +
        (expanded ? "z-20 shadow-lg shadow-surface/30" : "z-0")
      }
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 touch-manipulation items-center justify-between gap-2 rounded-lg px-1 py-2 text-start transition hover:bg-surface-container-high/20"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          aria-expanded={expanded}
          id={toggleId}
          aria-controls={panelId}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="rounded-lg border border-brand-sand/35 bg-brand-sand/20 px-2 py-1 text-xs font-bold text-brand-accent dark:border-outline/35 dark:bg-surface-container-highest dark:text-tertiary">
              {post.platform ?? "Platform"}
            </span>
            <span className="text-xs text-on-surface-variant">Post {index + 1}</span>
            {post.format ? <span className="text-xs text-on-surface-variant">{post.format}</span> : null}
          </div>
          <span
            className={
              "material-symbols-outlined shrink-0 text-on-surface-variant transition-transform " +
              (expanded ? "rotate-180" : "")
            }
            aria-hidden
          >
            expand_more
          </span>
        </button>
        <RegenerateButton
          loading={regenerating}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRegenerate(index);
          }}
        />
      </div>
      {expanded ? (
        <div
          id={panelId}
          className="mt-1 min-w-0 max-w-full space-y-4 border-t border-outline/15 pt-4"
          role="region"
          aria-labelledby={toggleId}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {goal ? (
            <FieldBlock label="Goal" copyText={goal} copyLabel="Copy goal">
              <p className="min-w-0 text-sm leading-relaxed text-on-surface">{goal}</p>
            </FieldBlock>
          ) : null}
          <StrategyMetadataPanel metadata={strategy} />
          <FieldBlock label="Post" copyText={postText} copyLabel="Copy post" bodyClassName="p-0">
            <pre className="max-h-[min(40vh,280px)] min-h-[3rem] min-w-0 max-w-full overflow-auto overflow-x-auto whitespace-pre-wrap break-words bg-earth-alt/70 p-3 font-body text-sm leading-relaxed text-on-surface [overflow-wrap:anywhere] dark:bg-surface-container-high/10">
              {postText}
            </pre>
          </FieldBlock>
          {hashtags ? (
            <FieldBlock label="Hashtags" copyText={hashtags} copyLabel="Copy hashtags">
              <p className="min-w-0 text-sm leading-relaxed text-brand-primary [overflow-wrap:anywhere] dark:text-secondary">{hashtags}</p>
            </FieldBlock>
          ) : null}
          {cta ? (
            <FieldBlock label="Call to action" copyText={cta} copyLabel="Copy CTA">
              <p className="min-w-0 text-sm leading-relaxed text-on-surface [overflow-wrap:anywhere]">
                <span className="font-semibold text-brand-accent dark:text-tertiary">CTA: </span>
                {cta}
              </p>
            </FieldBlock>
          ) : null}
          <FieldBlock
            label="All-in-one"
            copyText={combined}
            copyLabel="Copy full post block"
            bodyClassName="px-3 py-2.5"
          >
            <p className="text-xs leading-relaxed text-on-surface-variant">
              One copy with goal, post, hashtags, and CTA — for pasting into your scheduler or doc.
            </p>
          </FieldBlock>
        </div>
      ) : null}
    </article>
  );
}

type TocItem = { id: string; label: string };

function buildContentPackageFullCopy(pkg: KitContentIdeasPackageView): string {
  const lines: string[] = [];
  if (pkg.ideas.length) {
    lines.push("=== Strategic ideas ===");
    for (const idea of pkg.ideas) {
      lines.push(`#${idea.id ?? "?"} ${idea.title ?? ""}`.trim());
      if (idea.description) lines.push(idea.description);
      lines.push("");
    }
  }
  if (pkg.hooks.length) {
    lines.push("=== Hooks ===");
    const byIdea = new Map<number, typeof pkg.hooks>();
    for (const h of pkg.hooks) {
      const id = typeof h.idea_id === "number" ? h.idea_id : -1;
      if (id < 0) continue;
      if (!byIdea.has(id)) byIdea.set(id, []);
      byIdea.get(id)!.push(h);
    }
    const sortedIds = [...byIdea.keys()].sort((a, b) => a - b);
    for (const id of sortedIds) {
      const arr = byIdea.get(id)!;
      arr.sort((a, b) => (a.variant_index ?? 0) - (b.variant_index ?? 0));
      lines.push(`Idea ${id}:`);
      for (const h of arr) {
        lines.push(`  [${h.variant_index ?? "?"}] ${h.hook_text ?? ""}`);
      }
      lines.push("");
    }
  }
  if (pkg.templates.length) {
    lines.push("=== Templates ===");
    for (const t of pkg.templates) {
      lines.push(`Idea ${t.idea_id ?? "?"}: ${t.template_format ?? ""}`);
    }
  }
  return lines.join("\n").trim();
}

function ContentIdeasPackagePanel({ pkg, kitId }: { pkg: KitContentIdeasPackageView; kitId: string }) {
  const hooksByIdea = new Map<number, KitContentIdeasPackageView["hooks"]>();
  for (const h of pkg.hooks) {
    const id = typeof h.idea_id === "number" ? h.idea_id : -1;
    if (id < 0) continue;
    if (!hooksByIdea.has(id)) hooksByIdea.set(id, []);
    hooksByIdea.get(id)!.push(h);
  }
  for (const arr of hooksByIdea.values()) {
    arr.sort((a, b) => (a.variant_index ?? 0) - (b.variant_index ?? 0));
  }
  const ideaTitle = (id: number) => pkg.ideas.find((i) => i.id === id)?.title?.trim() || `Idea ${id}`;
  const fullCopy = buildContentPackageFullCopy(pkg);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-on-surface-variant">
          Extra outputs from the content ideas package (strategic ideas, hooks, templates). Separate from main kit video prompts.
        </p>
        <CopyFieldButton text={fullCopy} label="Copy entire content package" />
      </div>

      {pkg.ideas.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-on-surface">Strategic ideas</h3>
          <div className="grid grid-cols-1 gap-3">
            {pkg.ideas.map((idea, i) => {
              const id = idea.id ?? i + 1;
              const block = [`#${id} ${idea.title ?? ""}`.trim(), idea.description ?? ""].filter(Boolean).join("\n\n");
              return (
                <FieldBlock
                  key={`${kitId}-cp-idea-${id}-${i}`}
                  label={`Idea ${id}`}
                  copyText={block}
                  copyLabel={`Copy idea ${id}`}
                >
                  {idea.title ? (
                    <p className="px-3 pt-2 text-sm font-semibold text-on-surface [overflow-wrap:anywhere]" dir="auto">
                      {idea.title}
                    </p>
                  ) : null}
                  {idea.description ? (
                    <p className="px-3 pb-2 text-sm leading-relaxed text-on-surface [overflow-wrap:anywhere]" dir="auto">
                      {idea.description}
                    </p>
                  ) : null}
                </FieldBlock>
              );
            })}
          </div>
        </div>
      ) : null}

      {pkg.hooks.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-on-surface">Hook lines</h3>
          <div className="grid grid-cols-1 gap-3">
            {[...hooksByIdea.entries()]
              .sort((a, b) => a[0] - b[0])
              .map(([ideaId, hooks]) => {
                const body = hooks.map((h) => `[${h.variant_index ?? "?"}] ${h.hook_text ?? ""}`).join("\n");
                return (
                  <FieldBlock
                    key={`${kitId}-cp-hooks-${ideaId}`}
                    label={ideaTitle(ideaId)}
                    copyText={body}
                    copyLabel={`Copy hooks for idea ${ideaId}`}
                  >
                    <ul className="space-y-2 px-3 py-2 text-sm leading-relaxed text-on-surface [overflow-wrap:anywhere]" dir="auto">
                      {hooks.map((h, j) => (
                        <li key={`${ideaId}-v-${h.variant_index}-${j}`}>
                          <span className="font-mono text-xs text-on-surface-variant">v{h.variant_index}: </span>
                          {h.hook_text ?? "—"}
                        </li>
                      ))}
                    </ul>
                  </FieldBlock>
                );
              })}
          </div>
        </div>
      ) : null}

      {pkg.templates.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-on-surface">Reusable templates</h3>
          <div className="grid grid-cols-1 gap-3">
            {pkg.templates.map((t, i) => {
              const id = t.idea_id ?? i + 1;
              const text = t.template_format ?? "";
              return (
                <FieldBlock
                  key={`${kitId}-cp-tpl-${id}-${i}`}
                  label={`Template · ${ideaTitle(typeof t.idea_id === "number" ? t.idea_id : id)}`}
                  copyText={text}
                  copyLabel={`Copy template for idea ${id}`}
                >
                  <p className="px-3 py-2 text-sm leading-relaxed text-on-surface [overflow-wrap:anywhere] whitespace-pre-wrap" dir="auto">
                    {text || "—"}
                  </p>
                </FieldBlock>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CollapsibleSection({
  id,
  title,
  subtitle,
  icon,
  iconBg,
  open,
  onToggle,
  children,
  tocLabel,
}: {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  iconBg: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  tocLabel: string;
}) {
  return (
    <section
      id={id}
      className={
        "scroll-mt-24 overflow-x-clip overflow-y-visible rounded-uniform border border-brand-sand/30 bg-earth-card/90 dark:border-outline/30 dark:bg-surface-container-low/40 " +
        (open ? "relative z-10" : "relative z-0")
      }
      style={{ scrollMarginTop: SCROLL_MARGIN }}
      aria-label={tocLabel}
    >
      <button
        type="button"
        className="flex w-full touch-manipulation items-center justify-between gap-3 px-5 py-4 text-start transition hover:bg-earth-alt/60 dark:hover:bg-surface-container-high/30 focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary/40"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }}
        aria-expanded={open}
        aria-controls={id + "-panel"}
        id={id + "-heading"}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className={"shrink-0 rounded-xl p-2 " + iconBg}>
            <span className="material-symbols-outlined">{icon}</span>
          </span>
          <div className="min-w-0">
            <h2 className="font-headline text-lg font-bold text-on-surface md:text-xl">{title}</h2>
            {subtitle ? <p className="truncate text-xs text-on-surface-variant">{subtitle}</p> : null}
          </div>
        </div>
        <span
          className={
            "material-symbols-outlined shrink-0 text-on-surface-variant transition-transform duration-200 " +
            (open ? "rotate-180" : "")
          }
          aria-hidden
        >
          expand_more
        </span>
      </button>

      {open ? (
        <div
          id={id + "-panel"}
          className="min-w-0 max-w-full border-t border-brand-sand/25 px-5 pb-5 pt-2 dark:border-outline/20"
          role="region"
          aria-labelledby={id + "-heading"}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {children}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <a
              href={"#" + TOC_ID}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary/45 rounded-lg px-1"
            >
              <span className="material-symbols-outlined text-base">vertical_align_top</span>
              Back to index
            </a>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function KitViewer({
  kit,
  onKitUpdate,
  showTechnical = false,
}: {
  kit: KitSummary;
  onKitUpdate?: (next: KitSummary) => void;
  showTechnical?: boolean;
}) {
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [lang, setLang] = useState<ViewerLang>("ar");
  const {
    data,
    posts,
    postStrategy,
    videoSection,
    videoStrategy,
    imageSection,
    imageStrategy,
    hasStrategyBlock,
    marketingStrategy,
    salesSystem,
    offerOptimization,
    painPoints,
    hasStructuredPreview,
    contentIdeasPackage,
    missingCriticalSections,
  } = useMemo(() => buildKitViewModel(kit), [kit]);

  const strategyOfferHeadline = useMemo(() => {
    const rew = offerOptimization?.rewritten_offer;
    if (typeof rew === "string" && rew.trim()) return rew.trim();
    const leg = data?.offer_headline;
    if (typeof leg === "string" && leg.trim()) return leg.trim();
    return null;
  }, [offerOptimization, data]);

  const {
    regeneratingKey,
    regenError,
    feedbackOpen,
    feedbackDraft,
    setFeedbackDraft,
    pendingRegenerate,
    feedbackTextareaRef,
    openRegenerateDialog,
    closeFeedbackModal,
    submitRegenerate,
  } = useKitRegenerate({ kit, onKitUpdate });

  const tocItems = useMemo((): TocItem[] => {
    const items: TocItem[] = [];
    if (posts.length) items.push({ id: "kit-section-posts", label: "Copy & posts" });
    if (imageSection) items.push({ id: "kit-section-image", label: "Visual / images" });
    if (videoSection) items.push({ id: "kit-section-video", label: "Video" });
    if (!hasStructuredPreview) items.push({ id: "kit-section-summary", label: "Summary" });
    if (hasStrategyBlock) items.push({ id: "kit-section-strategy", label: "Strategy & extras" });
    if (painPoints.length) items.push({ id: "kit-section-pain", label: "Pain points" });
    if (
      contentIdeasPackage &&
      (contentIdeasPackage.ideas.length > 0 ||
        contentIdeasPackage.hooks.length > 0 ||
        contentIdeasPackage.templates.length > 0)
    ) {
      items.push({ id: "kit-section-content-package", label: "Content ideas package" });
    }
    if (showTechnical) items.push({ id: "kit-section-json", label: "Full JSON" });
    return items;
  }, [
    posts.length,
    imageSection,
    videoSection,
    hasStructuredPreview,
    hasStrategyBlock,
    painPoints.length,
    contentIdeasPackage,
    showTechnical,
  ]);

  const toggle = useCallback((id: string) => {
    setOpenMap((m) => ({ ...m, [id]: !m[id] }));
  }, []);

  const openAndScroll = useCallback((id: string, e?: MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    e?.stopPropagation();
    setOpenMap((m) => ({ ...m, [id]: true }));
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const scrollToToc = useCallback(() => {
    document.getElementById(TOC_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const [showBackTop, setShowBackTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowBackTop(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!feedbackOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeFeedbackModal();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (!regeneratingKey) {
          void submitRegenerate();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [feedbackOpen, closeFeedbackModal, regeneratingKey, submitRegenerate]);

  useEffect(() => {
    if (!feedbackOpen) return;
    const timer = window.setTimeout(() => {
      feedbackTextareaRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [feedbackOpen]);

  if (!data) return null;

  return (
    <div className="relative space-y-6 pb-20">
      <nav
        id={TOC_ID}
        className="sticky top-20 z-20 scroll-mt-24 rounded-uniform border border-brand-sand/30 bg-earth-card/95 p-3 shadow-lg shadow-surface/50 backdrop-blur-sm dark:border-primary/20 dark:bg-surface-container-low/95 sm:p-4 md:top-4 md:p-5"
        style={{ scrollMarginTop: SCROLL_MARGIN }}
        aria-label="Plan sections"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Jump to section</p>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-brand-sand/30 bg-earth-alt px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-muted dark:border-outline/30 dark:bg-surface-container-high dark:text-on-surface-variant">
              Showing: {lang === "ar" ? "Arabic" : "English"}
            </span>
            <div className="inline-flex items-center gap-1 rounded-full border border-brand-sand/30 bg-earth-alt p-1 dark:border-outline/30 dark:bg-surface-container-high">
            <button
              type="button"
              onClick={() => setLang("ar")}
              className={
                "rounded-full px-2.5 py-1 text-[11px] font-semibold transition " +
                (lang === "ar" ? "bg-primary text-on-primary" : "text-on-surface-variant")
              }
            >
              AR
            </button>
            <button
              type="button"
              onClick={() => setLang("en")}
              className={
                "rounded-full px-2.5 py-1 text-[11px] font-semibold transition " +
                (lang === "en" ? "bg-primary text-on-primary" : "text-on-surface-variant")
              }
            >
              EN
            </button>
            </div>
          </div>
        </div>
        <ul className="flex flex-wrap gap-2">
          {tocItems.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={(e) => openAndScroll(item.id, e)}
                className="touch-manipulation rounded-full border border-brand-sand/30 bg-earth-card px-3 py-1.5 text-xs font-semibold text-on-surface transition hover:border-brand-primary/35 hover:bg-earth-alt dark:border-outline/30 dark:bg-surface-container-high dark:hover:border-primary/35 dark:hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      {regenError ? (
        <p className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">
          {regenError}
        </p>
      ) : null}

      {missingCriticalSections.length > 0 ? (
        <div className="rounded-xl border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="font-semibold">Some core sections are missing from this kit.</p>
          <p className="mt-1">
            Missing: {missingCriticalSections.join(", ")}. Use the quick actions below to inspect related sections and regenerate available assets.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {missingCriticalSections.includes("posts") ? (
              <button
                type="button"
                onClick={(e) => openAndScroll("kit-section-posts", e)}
                className="rounded-full border border-amber-500/35 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-200 dark:border-amber-200/35 dark:bg-amber-400/10 dark:text-amber-100"
              >
                Review posts section
              </button>
            ) : null}
            {missingCriticalSections.includes("image_designs") ? (
              <button
                type="button"
                onClick={(e) => openAndScroll("kit-section-image", e)}
                className="rounded-full border border-amber-500/35 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-200 dark:border-amber-200/35 dark:bg-amber-400/10 dark:text-amber-100"
              >
                Review image section
              </button>
            ) : null}
            {missingCriticalSections.includes("video_prompts") ? (
              <button
                type="button"
                onClick={(e) => openAndScroll("kit-section-video", e)}
                className="rounded-full border border-amber-500/35 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-200 dark:border-amber-200/35 dark:bg-amber-400/10 dark:text-amber-100"
              >
                Review video section
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {posts.length > 0 && (
        <CollapsibleSection
          id="kit-section-posts"
          title="Copy & posts"
          subtitle={`${posts.length} item(s)`}
          icon="chat"
          iconBg="bg-brand-primary/15 text-brand-primary dark:bg-primary/15 dark:text-primary"
          open={!!openMap["kit-section-posts"]}
          onToggle={() => toggle("kit-section-posts")}
          tocLabel="Social posts and captions"
        >
          {/*
            Single-column post list: a 2-column grid here caused real hit-target overlap on some
            browsers (wide RTL/longs strings + grid min-width), so taps on the right card could
            activate controls on the left. Keep one column for reliable pointer isolation.
          */}
          <div className="grid grid-cols-1 gap-4">
            {posts.map((p, i) => (
              <PostCard
                key={`${kit.id}-post-${i}`}
                post={p}
                index={i}
                lang={lang}
                strategy={postStrategy[i] ?? null}
                onRegenerate={(idx) => openRegenerateDialog("post", idx)}
                regenerating={regeneratingKey === `post-${i}`}
              />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {imageSection && (
        <CollapsibleSection
          id="kit-section-image"
          title="Visual & image prompts"
          subtitle={imageSection.title}
          icon="imagesmode"
          iconBg="bg-brand-accent/15 text-brand-accent dark:bg-secondary/15 dark:text-secondary"
          open={!!openMap["kit-section-image"]}
          onToggle={() => toggle("kit-section-image")}
          tocLabel="Image and visual prompts"
        >
          <div className="grid grid-cols-1 gap-4">
            {imageSection.items.map((item, i) => {
              const rec = isRecord(item) ? item : {};
              if (isVideoBlueprint(rec)) {
                return (
                  <VideoBlueprintCard
                    key={`${kit.id}-image-${i}`}
                    item={rec}
                    index={i}
                    lang={lang}
                    strategy={imageStrategy[i] ?? null}
                    onRegenerate={(idx) => openRegenerateDialog("image", idx)}
                    regenerating={regeneratingKey === `image-${i}`}
                    showTechnical={showTechnical}
                  />
                );
              }
              if (isRichImageDesign(rec)) {
                return (
                  <ImageDesignCard
                    key={`${kit.id}-image-${i}`}
                    item={rec}
                    index={i}
                    lang={lang}
                    strategy={imageStrategy[i] ?? null}
                    onRegenerate={(idx) => openRegenerateDialog("image", idx)}
                    regenerating={regeneratingKey === `image-${i}`}
                    showTechnical={showTechnical}
                  />
                );
              }
              const title = getKitMediaItemTitle(rec, i, "image");
              const body = getKitMediaPlainBody(rec, "image");
              const caption = pickByLang(rec, lang, "caption_ar", "caption_en", "caption");
              return (
                <KitPromptCard
                  key={`${kit.id}-image-${i}`}
                  title={title}
                  body={body}
                  caption={caption || undefined}
                  strategy={imageStrategy[i] ?? null}
                  onRegenerate={() => openRegenerateDialog("image", i)}
                  regenerating={regeneratingKey === `image-${i}`}
                  copyLabel="Copy prompt"
                />
              );
            })}
          </div>
        </CollapsibleSection>
      )}

      {videoSection && (
        <CollapsibleSection
          id="kit-section-video"
          title="Video & motion"
          subtitle={videoSection.title}
          icon="movie"
          iconBg="bg-brand-sand/20 text-brand-accent dark:bg-tertiary/15 dark:text-tertiary"
          open={!!openMap["kit-section-video"]}
          onToggle={() => toggle("kit-section-video")}
          tocLabel="Video prompts"
        >
          <div className="grid grid-cols-1 gap-4">
            {videoSection.items.map((item, i) => {
              const rec = isRecord(item) ? item : {};
              if (isVideoBlueprint(rec)) {
                return (
                  <VideoBlueprintCard
                    key={`${kit.id}-video-${i}`}
                    item={rec}
                    index={i}
                    lang={lang}
                    strategy={videoStrategy[i] ?? null}
                    onRegenerate={(idx) => openRegenerateDialog("video", idx)}
                    regenerating={regeneratingKey === `video-${i}`}
                    showTechnical={showTechnical}
                  />
                );
              }
              const title = getKitMediaItemTitle(rec, i, "video");
              const body = getKitMediaPlainBody(rec, "video");
              const caption = pickByLang(rec, lang, "caption_ar", "caption_en", "caption");
              return (
                <KitPromptCard
                  key={`${kit.id}-video-${i}`}
                  title={title}
                  body={body}
                  caption={caption || undefined}
                  strategy={videoStrategy[i] ?? null}
                  onRegenerate={() => openRegenerateDialog("video", i)}
                  regenerating={regeneratingKey === `video-${i}`}
                  copyLabel="Copy video prompt"
                />
              );
            })}
          </div>
        </CollapsibleSection>
      )}

      {contentIdeasPackage &&
      (contentIdeasPackage.ideas.length > 0 ||
        contentIdeasPackage.hooks.length > 0 ||
        contentIdeasPackage.templates.length > 0) ? (
        <CollapsibleSection
          id="kit-section-content-package"
          title="Content ideas package"
          subtitle="Strategic ideas, hooks, and templates"
          icon="lightbulb"
          iconBg="bg-amber-500/15 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200"
          open={!!openMap["kit-section-content-package"]}
          onToggle={() => toggle("kit-section-content-package")}
          tocLabel="Content ideas package"
        >
          <ContentIdeasPackagePanel pkg={contentIdeasPackage} kitId={kit.id} />
        </CollapsibleSection>
      ) : null}

      {!hasStructuredPreview && (
        <CollapsibleSection
          id="kit-section-summary"
          title="Output summary"
          subtitle="Structured blocks not detected"
          icon="dataset"
          iconBg="bg-brand-primary/15 text-brand-primary dark:bg-primary/15 dark:text-primary"
          open={!!openMap["kit-section-summary"]}
          onToggle={() => toggle("kit-section-summary")}
          tocLabel="Output summary"
        >
          <p className="text-on-surface-variant">
            No structured post, image, or video blocks were detected for this kit.
          </p>
        </CollapsibleSection>
      )}

      {hasStrategyBlock ? (
        <CollapsibleSection
          id="kit-section-strategy"
          title="Strategy & additional fields"
          subtitle="Offer line, positioning, sales flow, and offer copy"
          icon="auto_awesome"
          iconBg="bg-brand-accent/15 text-brand-accent dark:bg-secondary/15 dark:text-secondary"
          open={!!openMap["kit-section-strategy"]}
          onToggle={() => toggle("kit-section-strategy")}
          tocLabel="Strategy"
        >
          {strategyOfferHeadline ? (
            <BlockWithCopy copyText={strategyOfferHeadline} copyLabel="Copy offer line" className="mb-4">
              <blockquote className="border-s-4 border-brand-accent bg-earth-alt/60 p-4 text-lg italic text-on-surface dark:border-secondary dark:bg-surface-container-lowest/50">
                {strategyOfferHeadline}
              </blockquote>
            </BlockWithCopy>
          ) : null}
          <div className="grid grid-cols-1 gap-4">
            {marketingStrategy ? (
              <FieldBlock
                label="Marketing strategy"
                copyText={
                  marketingStrategyPlainText(marketingStrategy) ||
                  JSON.stringify(marketingStrategy, null, 2)
                }
                copyLabel="Copy marketing strategy"
                bodyClassName="p-3"
              >
                <MarketingStrategyBody data={marketingStrategy} />
              </FieldBlock>
            ) : null}
            {salesSystem ? (
              <FieldBlock
                label="Sales system"
                copyText={salesSystemPlainText(salesSystem) || JSON.stringify(salesSystem, null, 2)}
                copyLabel="Copy sales system"
                bodyClassName="p-3"
              >
                <SalesSystemBody data={salesSystem} />
              </FieldBlock>
            ) : null}
            {offerOptimization ? (
              <FieldBlock
                label="Offer optimization"
                copyText={
                  offerOptimizationPlainText(offerOptimization) ||
                  JSON.stringify(offerOptimization, null, 2)
                }
                copyLabel="Copy offer optimization"
                bodyClassName="p-3"
              >
                <OfferOptimizationBody data={offerOptimization} />
              </FieldBlock>
            ) : null}
          </div>
        </CollapsibleSection>
      ) : null}

      {painPoints.length > 0 ? (
        <CollapsibleSection
          id="kit-section-pain"
          title="Pain points"
          subtitle={`${painPoints.length} item(s)`}
          icon="error_outline"
          iconBg="bg-brand-accent/10 text-brand-accent dark:bg-error/10 dark:text-error"
          open={!!openMap["kit-section-pain"]}
          onToggle={() => toggle("kit-section-pain")}
          tocLabel="Pain points"
        >
          <ul className="grid grid-cols-1 gap-3">
            {painPoints.map((line, i) => (
              <li
                key={i}
                className="min-w-0 max-w-full overflow-x-clip rounded-xl border border-brand-sand/25 bg-earth-card/80 p-3 dark:border-outline/15 dark:bg-surface-container-lowest/40"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <span className="flex min-w-0 flex-1 items-start gap-2 text-on-surface-variant">
                    <span className="material-symbols-outlined mt-0.5 shrink-0 text-sm text-brand-accent dark:text-error">error_outline</span>
                    <span className="min-w-0 [overflow-wrap:anywhere]">{line}</span>
                  </span>
                  <div className="shrink-0 sm:pt-0.5">
                    <CopyFieldButton text={line} label={`Copy point ${i + 1}`} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-end">
            <CopyFieldButton text={painPoints.join("\n")} label="Copy all pain points" />
          </div>
        </CollapsibleSection>
      ) : null}

      {showTechnical ? (
        <CollapsibleSection
          id="kit-section-json"
          title="Full JSON"
          subtitle="Raw payload"
          icon="code"
          iconBg="bg-brand-sand/20 text-brand-muted dark:bg-surface-container-highest dark:text-on-surface-variant"
          open={!!openMap["kit-section-json"]}
          onToggle={() => toggle("kit-section-json")}
          tocLabel="Full JSON"
        >
          <p className="mb-3 text-sm text-on-surface-variant">
            Technical view of the full response. Use <strong>Copy</strong> on the block or the kit header action to copy the whole JSON payload.
          </p>
          <BlockWithCopy copyText={JSON.stringify(data, null, 2)} copyLabel="Copy full JSON">
            <pre
              className="max-h-[min(70vh,520px)] overflow-auto rounded-uniform bg-earth-alt p-4 text-[0.75rem] leading-relaxed text-brand-muted dark:bg-surface-container-lowest dark:text-on-surface-variant"
              dir="ltr"
            >
              {JSON.stringify(data, null, 2)}
            </pre>
          </BlockWithCopy>
        </CollapsibleSection>
      ) : null}

      {showBackTop ? (
        <button
          type="button"
          onClick={scrollToToc}
          className="fixed bottom-6 end-6 z-50 flex h-12 w-12 touch-manipulation items-center justify-center rounded-full border border-brand-sand/35 bg-brand-primary text-white shadow-lg transition hover:scale-105 hover:bg-brand-primary/90 dark:border-outline/30 dark:bg-primary dark:text-on-primary focus-visible:ring-2 focus-visible:ring-primary/50 md:bottom-10 md:end-10"
          aria-label="Back to section index"
        >
          <span className="material-symbols-outlined">vertical_align_top</span>
        </button>
      ) : null}
      <RegenerateFeedbackDialog
        open={feedbackOpen}
        pendingType={pendingRegenerate?.item_type}
        value={feedbackDraft}
        onChange={setFeedbackDraft}
        onCancel={closeFeedbackModal}
        onSubmit={() => void submitRegenerate()}
        disabled={Boolean(regeneratingKey)}
        textareaRef={feedbackTextareaRef}
      />
    </div>
  );
}
