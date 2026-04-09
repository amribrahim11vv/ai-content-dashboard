import { useId, useState } from "react";
import type { KitPostItem } from "../../../types";
import { FieldBlock, RegenerateButton } from "./atoms";
import {
  type MediaRecord,
  type ViewerLang,
  getKitMediaItemTitle,
  getKitMediaPlainBody,
  imageDesignFormattedCopy,
  kitArticleShellClass,
  pickByLang,
  videoBlueprintFormattedCopy,
} from "./shared";

export function VideoBlueprintCard({
  item,
  index,
  lang,
  onRegenerate,
  regenerating,
  showTechnical,
}: {
  item: MediaRecord;
  index: number;
  lang: ViewerLang;
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

export function ImageDesignCard({
  item,
  index,
  lang,
  onRegenerate,
  regenerating,
  showTechnical,
}: {
  item: MediaRecord;
  index: number;
  lang: ViewerLang;
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

export function KitPromptCard({
  title,
  body,
  caption,
  onRegenerate,
  regenerating,
  copyLabel,
}: {
  title: string;
  body: string;
  caption?: string;
  onRegenerate: () => void;
  regenerating: boolean;
  copyLabel: string;
}) {
  const uid = useId();
  const toggleId = `${uid}-toggle`;
  const panelId = `${uid}-panel`;
  const [expanded, setExpanded] = useState(false);

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

export function PostCard({
  post,
  index,
  lang,
  onRegenerate,
  regenerating,
}: {
  post: KitPostItem;
  index: number;
  lang: ViewerLang;
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
  const combined = [goal && `Goal: ${goal}`, postText, hashtags && `Hashtags: ${hashtags}`, cta && `CTA: ${cta}`]
    .filter(Boolean)
    .join("\n\n");

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
          <FieldBlock label="Post" copyText={postText} copyLabel="Copy post" bodyClassName="p-0">
            <pre className="max-h-[min(40vh,280px)] min-h-[3rem] min-w-0 max-w-full overflow-auto overflow-x-auto whitespace-pre-wrap break-words bg-earth-alt/70 p-3 font-body text-sm leading-relaxed text-on-surface [overflow-wrap:anywhere] dark:bg-surface-container-high/10">
              {postText}
            </pre>
          </FieldBlock>
          {hashtags ? (
            <FieldBlock label="Hashtags" copyText={hashtags} copyLabel="Copy hashtags">
              <p className="min-w-0 text-sm leading-relaxed text-brand-primary [overflow-wrap:anywhere] dark:text-secondary">
                {hashtags}
              </p>
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
          <FieldBlock label="All-in-one" copyText={combined} copyLabel="Copy full post block" bodyClassName="px-3 py-2.5">
            <p className="text-xs leading-relaxed text-on-surface-variant">
              One copy with goal, post, hashtags, and CTA — for pasting into your scheduler or doc.
            </p>
          </FieldBlock>
        </div>
      ) : null}
    </article>
  );
}

export function buildPlainPromptCardProps(rec: MediaRecord, i: number, kind: "image" | "video", lang: ViewerLang) {
  const title = getKitMediaItemTitle(rec, i, kind);
  const body = getKitMediaPlainBody(rec, kind);
  const caption = pickByLang(rec, lang, "caption_ar", "caption_en", "caption");
  return { title, body, caption: caption || undefined };
}
