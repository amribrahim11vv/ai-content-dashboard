import type { SubmissionSnapshot } from "../logic/constants.js";
import { isHighBudget } from "../logic/industry.js";
import { normalizeKey } from "../logic/parse.js";

function toDisplayValue(value: unknown): string {
  if (Array.isArray(value)) {
    const joined = value.map((item) => String(item ?? "").trim()).filter(Boolean).join("، ");
    return joined || "-";
  }
  const v = String(value ?? "").trim();
  return v || "-";
}

export function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderArrayInline(arr: unknown): string {
  if (!Array.isArray(arr) || arr.length === 0) return "-";
  return escapeHtml(arr.join(" | "));
}

function renderObjectionsInline(arr: unknown): string {
  if (!Array.isArray(arr) || arr.length === 0) return "-";
  return arr
    .map((item: unknown) => {
      const o = item as { objection?: string; response?: string };
      const objection = o?.objection ? o.objection : "-";
      const response = o?.response ? o.response : "-";
      return escapeHtml(objection + " => " + response);
    })
    .join("<br/>");
}

function renderBadges(badgeList: { label: string; color: string }[]): string {
  return badgeList
    .map((b) => `<span style="display:inline-block;background:${b.color};color:#fff;padding:4px 10px;margin:3px;border-radius:6px;font-size:12px;font-weight:700;">${escapeHtml(b.label)}</span>`)
    .join("");
}

function renderContentBlock(title: string, content: string): string {
  return `
    <div style="margin:10px 0;padding:10px;background:#f8fafc;border-right:3px solid #999;border-radius:6px;">
      <div style="font-weight:800;color:#1f2937;margin-bottom:6px;font-size:14px;">${escapeHtml(title)}</div>
      <div style="color:#374151;font-size:14px;font-weight:600;line-height:1.9;">${escapeHtml(content)}</div>
    </div>`;
}

function buildEmailPreheader(postsCount: number, imagesCount: number, videosCount: number): string {
  return postsCount + " بوستات، " + imagesCount + " تصميمات، " + videosCount + " فيديوهات جاهزة للتنفيذ.";
}

function getGoalDrivenStep(goalKey: string, postsCount: number, imagesCount: number): string {
  const suggestedPosts = Math.max(1, Math.min(2, postsCount || 2));
  const suggestedImages = Math.max(1, Math.min(2, imagesCount || 2));

  if (goalKey.includes("sales") || goalKey.includes("مبيعات") || goalKey.includes("بيع")) {
    return "فعّل حملة تحويل سريعة باستخدام أفضل عرض + " + suggestedImages + " تصميم خلال 24 ساعة.";
  }
  if (goalKey.includes("awareness") || goalKey.includes("وعي")) {
    return "انشر أول " + suggestedPosts + " بوست توعوي لتعزيز حضور البراند خلال 24 ساعة.";
  }
  if (goalKey.includes("engagement") || goalKey.includes("تفاعل")) {
    return "ابدأ ببوست تفاعلي (سؤال أو تصويت) ثم تابع الردود والتعليقات خلال نفس اليوم.";
  }
  if (goalKey.includes("launch") || goalKey.includes("اطلاق")) {
    return "نفّذ تسلسل الإطلاق: تمهيد اليوم، كشف العرض غدًا، ثم رسالة ختامية واضحة في اليوم الثالث.";
  }
  return "انشر أول " + suggestedPosts + " بوست من الخطة خلال 24 ساعة وابدأ المتابعة اليومية.";
}

function getPlatformDrivenStep(platformsKey: string, videosCount: number): string {
  const suggestedVideos = Math.max(1, Math.min(2, videosCount || 1));
  if (
    platformsKey.includes("instagram") ||
    platformsKey.includes("انست") ||
    platformsKey.includes("ريل") ||
    platformsKey.includes("reel") ||
    platformsKey.includes("tiktok") ||
    platformsKey.includes("تيك توك")
  ) {
    return "اختبر " + suggestedVideos + " فيديو قصير (Reel/TikTok) بهوك قوي في أول ثانيتين خلال 48 ساعة.";
  }
  if (platformsKey.includes("youtube") || platformsKey.includes("يوتيوب")) {
    return "ابدأ بفيديو واحد بنمط قصصي واضح، ثم أعد تدوير أفضل مقطع كنسخة Shorts.";
  }
  if (platformsKey.includes("facebook") || platformsKey.includes("فيسبوك")) {
    return "حوّل أفضل بوست إلى إعلان Facebook برسالة بيع مباشرة وتقسيم جمهور واضح.";
  }
  if (platformsKey.includes("linkedin") || platformsKey.includes("لينكد")) {
    return "حوّل أفضل فكرة إلى بوست احترافي على LinkedIn يبرز الخبرة والنتائج القابلة للقياس.";
  }
  return "وزّع أول 3 قطع محتوى على المنصات الأساسية حسب أولوية جمهورك المستهدف.";
}

function buildDynamicNextSteps(data: SubmissionSnapshot, stats: { postsCount: number; imagesCount: number; videosCount: number }): string {
  const goalKey = normalizeKey(data.main_goal);
  const platformsKey = normalizeKey(data.platforms);
  const steps = [
    getGoalDrivenStep(goalKey, stats.postsCount, stats.imagesCount),
    getPlatformDrivenStep(platformsKey, stats.videosCount),
    stats.imagesCount > 0
      ? "استخدم أول تصميمين في اختبار إعلاني مدفوع وحدد جمهورين مختلفين للمقارنة."
      : "ابدأ باختبار نسختين نصيتين من أفضل بوست لمعرفة النسخة الأعلى تفاعلًا.",
    isHighBudget(data.budget_level)
      ? "راجع مؤشرات الأداء (KPI) يوميًا ونفّذ أول اختبار A/B خلال هذا الأسبوع."
      : "راجع النتائج بعد 72 ساعة، ثم كرر أفضل صيغة محتوى في الأسبوع التالي.",
  ];
  return (
    '<ol style="margin:0;padding-right:20px;line-height:1.95;font-size:15px;font-weight:600;">' +
    steps.map((step) => "<li>" + escapeHtml(step) + "</li>").join("") +
    "</ol>"
  );
}

function renderPostsHtml(posts: unknown): string {
  if (!Array.isArray(posts) || posts.length === 0) return "<p>-</p>";
  return posts
    .map((post: Record<string, unknown>, idx: number) => {
      const badges = renderBadges([
        { label: String(post.platform ?? "-"), color: "#ff6b6b" },
        { label: String(post.format ?? "-"), color: "#f78a4a" },
        { label: String(post.goal ?? "-"), color: "#ffc107" },
      ]);
      const hashtags = Array.isArray(post.hashtags)
        ? post.hashtags
            .map((h: string) => `<span style="display:inline-block;background:#fff3e0;color:#e65100;padding:3px 8px;margin:3px;border-radius:4px;font-size:12px;font-weight:700;">${escapeHtml(String(h))}</span>`)
            .join("")
        : "-";
      return `
      <div style="border:1px solid #ffe8e8;border-radius:10px;padding:12px;margin:10px 0;background:#fffbfb;font-size:14px;line-height:1.9;font-weight:500;color:#1f2937;">
        <div style="margin-bottom:8px;"><b style="color:#d32f2f;font-size:16px;font-weight:800;">بوست ${idx + 1}</b></div>
        ${badges}
        ${renderContentBlock("الكابشن", String(post.caption ?? "-"))}
        <div style="margin:8px 0;"><b>الهاشتاجات:</b><br/>${hashtags}</div>
        <div style="margin:8px 0;"><b>CTA:</b> ${escapeHtml(String(post.cta ?? "-"))}</div>
      </div>`;
    })
    .join("");
}

function renderImagesHtml(images: unknown): string {
  if (!Array.isArray(images) || images.length === 0) return "<p>-</p>";
  return images
    .map((image: Record<string, unknown>, idx: number) => {
      const badges = renderBadges([
        { label: String(image.platform_format ?? "-"), color: "#06a77d" },
        { label: String(image.design_type ?? "-"), color: "#00bfa5" },
        { label: String(image.goal ?? "-"), color: "#64dd17" },
      ]);
      return `
      <div style="border:1px solid #e0f2f1;border-radius:10px;padding:12px;margin:10px 0;background:#f1f8f6;font-size:14px;line-height:1.9;font-weight:500;color:#1f2937;">
        <div style="margin-bottom:8px;"><b style="color:#00695c;font-size:16px;font-weight:800;">تصميم ${idx + 1}</b></div>
        ${badges}
        <div style="margin:8px 0;"><b>المشهد البصري:</b> ${escapeHtml(String(image.visual_scene ?? "-"))}</div>
        <div style="margin:8px 0;"><b>العنوان الرئيسي:</b> ${escapeHtml(String(image.headline_text_overlay ?? "-"))}</div>
        <div style="margin:8px 0;"><b>النص الداعم:</b> ${escapeHtml(String(image.supporting_copy ?? "-"))}</div>
        ${renderContentBlock("وصف الصورة للذكاء الاصطناعي (AI Image Prompt)", String(image.full_ai_image_prompt ?? "-"))}
        <div style="margin:8px 0;"><b>Text Policy:</b> ${escapeHtml(String(image.text_policy ?? "-"))}</div>
        <div style="margin:8px 0;"><b>Conversion Trigger:</b> ${escapeHtml(String(image.conversion_trigger ?? "-"))}</div>
      </div>`;
    })
    .join("");
}

function renderVideosHtml(videos: unknown): string {
  if (!Array.isArray(videos) || videos.length === 0) return "<p>-</p>";
  return videos
    .map((video: Record<string, unknown>, idx: number) => {
      const badges = renderBadges([
        { label: String(video.platform ?? "-"), color: "#4a90e2" },
        { label: String(video.duration ?? "-"), color: "#5c6bc0" },
        { label: String(video.style ?? "-"), color: "#7e57c2" },
      ]);
      const timeline = Array.isArray(video.scenes)
        ? video.scenes
            .map((scene: Record<string, unknown>) => {
              return `
          <div style="padding:8px;margin:6px 0;background:#fff;border-right:3px solid #4a90e2;border-radius:4px;">
            <div style="font-size:14px;font-weight:800;color:#1565c0;margin-bottom:4px;">${escapeHtml(String(scene.time ?? "-"))} — ${escapeHtml(String(scene.label ?? ""))}</div>
            <div style="font-size:14px;font-weight:500;color:#374151;line-height:1.85;">
              <b>المشهد:</b> ${escapeHtml(String(scene.visual ?? "-"))}<br/>
              <b>النص:</b> ${escapeHtml(String(scene.text ?? "-"))}<br/>
              <b>الصوت:</b> ${escapeHtml(String(scene.audio ?? "-"))}
            </div>
          </div>`;
            })
            .join("")
        : "<p>-</p>";
      return `
      <div style="border:1px solid #e3f2fd;border-radius:10px;padding:12px;margin:10px 0;background:#f5f9ff;font-size:14px;line-height:1.9;font-weight:500;color:#1f2937;">
        <div style="margin-bottom:8px;"><b style="color:#1565c0;font-size:16px;font-weight:800;">فيديو ${idx + 1}</b></div>
        ${badges}
        <div style="margin:8px 0;"><b>نوع الهوك:</b> ${escapeHtml(String(video.hook_type ?? "-"))}</div>
        <div style="margin:10px 0;"><b>تسلسل السكريبت (Timeline):</b></div>
        ${timeline}
        ${renderContentBlock("تعليمات أداة الذكاء الاصطناعي (AI Tool Instructions)", String(video.ai_tool_instructions ?? "-"))}
        <div style="margin:8px 0;"><b>ليه هيحول:</b> ${escapeHtml(String(video.why_this_converts ?? "-"))}</div>
      </div>`;
    })
    .join("");
}

export function buildHtmlFallbackPlainBody(data: SubmissionSnapshot, aiContent: Record<string, unknown>): string {
  const postsCount = Array.isArray(aiContent.posts) ? aiContent.posts.length : 0;
  const imagesCount = Array.isArray(aiContent.image_designs) ? aiContent.image_designs.length : 0;
  const videosCount = Array.isArray(aiContent.video_prompts) ? aiContent.video_prompts.length : 0;
  return [
    "مرحبًا،",
    "",
    "ملف المحتوى الذكي الخاص بك جاهز.",
    "",
    "البراند: " + toDisplayValue(data.brand_name),
    "الهدف: " + toDisplayValue(data.main_goal),
    "عدد البوستات: " + postsCount,
    "عدد أفكار الصور: " + imagesCount,
    "عدد سكريبتات الفيديو: " + videosCount,
  ].join("\n");
}

export function buildHtmlEmailBody(data: SubmissionSnapshot, aiContent: Record<string, unknown>): string {
  const postsCount = Array.isArray(aiContent.posts) ? aiContent.posts.length : 0;
  const imagesCount = Array.isArray(aiContent.image_designs) ? aiContent.image_designs.length : 0;
  const videosCount = Array.isArray(aiContent.video_prompts) ? aiContent.video_prompts.length : 0;
  const preheaderText = buildEmailPreheader(postsCount, imagesCount, videosCount);
  const nextStepsHtml = buildDynamicNextSteps(data, { postsCount, imagesCount, videosCount });
  const postsHtml = renderPostsHtml(aiContent.posts);
  const imagesHtml = renderImagesHtml(aiContent.image_designs);
  const videosHtml = renderVideosHtml(aiContent.video_prompts);

  const strategy = (aiContent.marketing_strategy ?? {}) as Record<string, unknown>;
  const sales = (aiContent.sales_system ?? {}) as Record<string, unknown>;
  const offer = (aiContent.offer_optimization ?? {}) as Record<string, unknown>;
  const kpi = aiContent.kpi_tracking as Record<string, unknown> | null | undefined;

  const strategyHtml = `
      <h3 style="margin-top:0;color:#0d3b66;font-size:18px;font-weight:800;line-height:1.6;border-right:4px solid #0d3b66;padding-right:10px;">SECTION D — Marketing Strategy</h3>
      <ul style="line-height:1.9;font-size:15px;font-weight:500;color:#1f2937;">
        <li><b>خطة المحتوى:</b> ${escapeHtml(String(strategy.content_mix_plan ?? "-"))}</li>
        <li><b>الخطة الأسبوعية:</b> ${escapeHtml(String(strategy.weekly_posting_plan ?? "-"))}</li>
        <li><b>استراتيجية المنصات:</b> ${escapeHtml(String(strategy.platform_strategy ?? "-"))}</li>
        <li><b>زوايا الرسائل:</b> ${renderArrayInline(strategy.key_messaging_angles)}</li>
        <li><b>البوزيشننج:</b> ${escapeHtml(String(strategy.brand_positioning_statement ?? "-"))}</li>
      </ul>`;

  const salesHtml = `
      <h3 style="margin-top:0;color:#0d3b66;font-size:18px;font-weight:800;line-height:1.6;border-right:4px solid #0d3b66;padding-right:10px;">SECTION E — Sales System</h3>
      <ul style="line-height:1.9;font-size:15px;font-weight:500;color:#1f2937;">
        <li><b>نقاط الألم:</b> ${renderArrayInline(sales.pain_points)}</li>
        <li><b>صياغة العرض:</b> ${escapeHtml(String(sales.offer_structuring ?? "-"))}</li>
        <li><b>الفانل:</b> ${escapeHtml(String(sales.funnel_plan ?? "-"))}</li>
        <li><b>زوايا الإعلانات:</b> ${renderArrayInline(sales.ad_angles)}</li>
        <li><b>الرد على الاعتراضات:</b> ${renderObjectionsInline(sales.objection_handling)}</li>
        <li><b>CTA Strategy:</b> ${escapeHtml(String(sales.cta_strategy ?? "-"))}</li>
      </ul>`;

  const offerHtml = `
      <h3 style="margin-top:0;color:#0d3b66;font-size:18px;font-weight:800;line-height:1.6;border-right:4px solid #0d3b66;padding-right:10px;">SECTION F — Offer Optimization</h3>
      <ul style="line-height:1.9;font-size:15px;font-weight:500;color:#1f2937;">
        <li><b>العرض المحسّن:</b> ${escapeHtml(String(offer.rewritten_offer ?? "-"))}</li>
        <li><b>عناصر الإلحاح والندرة:</b> ${escapeHtml(String(offer.urgency_or_scarcity ?? "-"))}</li>
        <li><b>عروض بديلة:</b> ${renderArrayInline(offer.alternative_offers)}</li>
      </ul>`;

  const kpiHtml = kpi
    ? `
      <h3 style="margin-top:0;color:#0d3b66;font-size:18px;font-weight:800;line-height:1.6;border-right:4px solid #0d3b66;padding-right:10px;">SECTION G — KPI Tracking</h3>
      <ul style="line-height:1.9;font-size:15px;font-weight:500;color:#1f2937;">
        <li><b>أهم المؤشرات:</b> ${renderArrayInline(kpi.top_kpis)}</li>
        <li><b>المعايير المرجعية (Benchmarks):</b> ${escapeHtml(String(kpi.benchmarks ?? "-"))}</li>
        <li><b>خطوات التحسين:</b> ${escapeHtml(String(kpi.optimization_actions ?? "-"))}</li>
        <li><b>اختبارات A/B للأسبوع الأول:</b> ${renderArrayInline(kpi.ab_tests_week1)}</li>
      </ul>`
    : "";

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
</head>
<body style="margin:0;padding:0;background:#f5f8ff;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:15px;font-weight:500;direction:rtl;text-align:right;line-height:1.9;word-break:break-word;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;">
  <div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;">
    ${escapeHtml(preheaderText)}
  </div>
  <div style="max-width:680px;margin:0 auto;padding:20px;">
    <div style="background:linear-gradient(135deg,#16213e 0%,#0d3b66 100%);color:#fff;padding:20px 24px;border-radius:12px;text-align:center;">
      <h1 style="margin:0 0 12px 0;font-size:26px;font-weight:800;">ملف المحتوى الذكي جاهز 🚀</h1>
      <p style="margin:0;font-size:16px;font-weight:700;opacity:0.98;">${escapeHtml(toDisplayValue(data.brand_name))}</p>
    </div>
    <div style="background:#fff;border:2px solid #4a90e2;border-radius:12px;padding:16px 20px;margin:16px 0;text-align:center;">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;font-size:14px;font-weight:700;">
        <div><span style="display:block;font-size:24px;font-weight:bold;color:#ff6b6b;">${postsCount}</span><span style="color:#666;">بوست</span></div>
        <div><span style="display:block;font-size:24px;font-weight:bold;color:#06a77d;">${imagesCount}</span><span style="color:#666;">تصميم</span></div>
        <div><span style="display:block;font-size:24px;font-weight:bold;color:#4a90e2;">${videosCount}</span><span style="color:#666;">فيديو</span></div>
      </div>
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid #e8f0ff;font-size:14px;font-weight:600;color:#374151;">
        <b>الهدف:</b> ${escapeHtml(toDisplayValue(data.main_goal))} | <b>المنصات:</b> ${escapeHtml(toDisplayValue(data.platforms))} | <b>المدة:</b> ${escapeHtml(toDisplayValue(data.campaign_duration))}
      </div>
    </div>
    <div style="background:#fff;border:1px solid #dbe6ff;border-right:4px solid #ff6b6b;border-radius:12px;padding:16px 20px;margin-bottom:14px;">
      <h3 style="margin-top:0;color:#ff6b6b;font-size:19px;font-weight:800;">SECTION A — Social Media Posts</h3>
      ${postsHtml}
    </div>
    <div style="background:#fff;border:1px solid #dbe6ff;border-right:4px solid #06a77d;border-radius:12px;padding:16px 20px;margin-bottom:14px;">
      <h3 style="margin-top:0;color:#06a77d;font-size:19px;font-weight:800;">SECTION B — Image Designs</h3>
      ${imagesHtml}
    </div>
    <div style="background:#fff;border:1px solid #dbe6ff;border-right:4px solid #4a90e2;border-radius:12px;padding:16px 20px;margin-bottom:14px;">
      <h3 style="margin-top:0;color:#4a90e2;font-size:19px;font-weight:800;">SECTION C — Video Prompts</h3>
      ${videosHtml}
    </div>
    <div style="background:#fff;border:1px solid #dbe6ff;border-radius:12px;padding:16px 20px;margin-bottom:14px;">
      <h2 style="margin-top:0;color:#0d3b66;font-size:21px;font-weight:800;text-align:center;padding-bottom:12px;border-bottom:2px solid #e8f0ff;">خطة النمو الشاملة</h2>
      ${strategyHtml}
      <div style="height:16px;"></div>
      ${salesHtml}
      <div style="height:16px;"></div>
      ${offerHtml}
    </div>
    ${kpiHtml ? `<div style="background:#fff;border:1px solid #dbe6ff;border-radius:12px;padding:16px 20px;margin-bottom:14px;">${kpiHtml}</div>` : ""}
    <div style="background:#e8f5e9;border:1px solid #81c784;border-radius:10px;padding:16px;color:#2e7d32;">
      <h4 style="margin:0 0 10px 0;font-size:17px;font-weight:800;">ابدأ من هنا — الخطوات التالية:</h4>
      ${nextStepsHtml}
    </div>
  </div>
</body>
</html>
  `.trim();
}
