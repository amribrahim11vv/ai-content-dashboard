import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listMyKits } from "../api";
import { logger } from "../logger";
import type { BriefForm, KitSummary } from "../types";

const STEPS = [
  {
    icon: "assignment_add",
    title: "Submit your brief",
    titleAr: "ابعتلنا البريف بتاعك",
    body: "Fill out our smart project brief so we capture your brand, goals, and channels in one seamless flow.",
  },
  {
    icon: "auto_awesome",
    title: "Expert & AI generation",
    titleAr: "خبرة فريقنا + الذكاء الاصطناعي",
    body: "Our team and platform craft tailored posts, image prompts, video prompts, and a strategy perfectly aligned to your brief.",
  },
  {
    icon: "package_2",
    title: "Receive premium assets",
    titleAr: "استلم محتواك الجاهز",
    body: "Get ready-to-publish content, plus easy exports like PDFs and formatted Excel sheets (if included in your package).",
  },
] as const;

const FALLBACK_PORTFOLIO = [
  {
    title: "Real Estate Campaign",
    subtitle: "Multi-channel launch + bilingual captions",
    icon: "apartment",
  },
  {
    title: "E-commerce Launch",
    subtitle: "Product hooks, reels scripts, and ad angles",
    icon: "shopping_bag",
  },
  {
    title: "B2B SaaS Thought Leadership",
    subtitle: "LinkedIn-first content mix and weekly plan",
    icon: "hub",
  },
  {
    title: "Hospitality & F&B",
    subtitle: "Seasonal promos and UGC-style video prompts",
    icon: "restaurant",
  },
] as const;

type PortfolioProject = {
  id: string;
  title: string;
  subtitle: string;
  tags: string[];
  icon: string;
  createdAt: string;
};

function ensureStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[,،]/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function parseBrief(briefJson: string): BriefForm | null {
  try {
    const parsed = JSON.parse(briefJson) as Record<string, unknown>;
    return {
      client_name: typeof parsed.client_name === "string" ? parsed.client_name : "",
      client_phone: typeof parsed.client_phone === "string" ? parsed.client_phone : "",
      client_email: typeof parsed.client_email === "string" ? parsed.client_email : "",
      source_mode: parsed.source_mode === "agency" ? "agency" : "self_serve",
      brand_name: typeof parsed.brand_name === "string" ? parsed.brand_name : "",
      industry: typeof parsed.industry === "string" ? parsed.industry : "",
      business_links: typeof parsed.business_links === "string" ? parsed.business_links : "",
      target_audience: ensureStringArray(parsed.target_audience),
      main_goal: typeof parsed.main_goal === "string" ? parsed.main_goal : "",
      platforms: ensureStringArray(parsed.platforms),
      brand_tone: typeof parsed.brand_tone === "string" ? parsed.brand_tone : "",
      brand_colors: typeof parsed.brand_colors === "string" ? parsed.brand_colors : "",
      offer: typeof parsed.offer === "string" ? parsed.offer : "",
      competitors: typeof parsed.competitors === "string" ? parsed.competitors : "",
      audience_pain_point: typeof parsed.audience_pain_point === "string" ? parsed.audience_pain_point : "",
      visual_notes: typeof parsed.visual_notes === "string" ? parsed.visual_notes : "",
      product_details: typeof parsed.product_details === "string" ? parsed.product_details : "",
      reference_image: typeof parsed.reference_image === "string" ? parsed.reference_image : "",
      campaign_duration: typeof parsed.campaign_duration === "string" ? parsed.campaign_duration : "",
      budget_level: typeof parsed.budget_level === "string" ? parsed.budget_level : "",
      best_content_types: ensureStringArray(parsed.best_content_types),
      campaign_mode:
        parsed.campaign_mode === "offer" || parsed.campaign_mode === "deep" || parsed.campaign_mode === "social"
          ? parsed.campaign_mode
          : "social",
      num_posts: typeof parsed.num_posts === "number" ? parsed.num_posts : 0,
      num_image_designs: typeof parsed.num_image_designs === "number" ? parsed.num_image_designs : 0,
      num_video_prompts: typeof parsed.num_video_prompts === "number" ? parsed.num_video_prompts : 0,
      include_content_package: parsed.include_content_package === true,
      content_package_idea_count: typeof parsed.content_package_idea_count === "number" ? parsed.content_package_idea_count : 0,
      diagnostic_role: typeof parsed.diagnostic_role === "string" ? parsed.diagnostic_role : "",
      diagnostic_account_stage: typeof parsed.diagnostic_account_stage === "string" ? parsed.diagnostic_account_stage : "",
      diagnostic_followers_band: typeof parsed.diagnostic_followers_band === "string" ? parsed.diagnostic_followers_band : "",
      diagnostic_primary_blocker: typeof parsed.diagnostic_primary_blocker === "string" ? parsed.diagnostic_primary_blocker : "",
      diagnostic_revenue_goal: typeof parsed.diagnostic_revenue_goal === "string" ? parsed.diagnostic_revenue_goal : "",
    };
  } catch {
    return null;
  }
}

function modeLabel(mode: BriefForm["campaign_mode"]): string {
  if (mode === "offer") return "Offer Campaign";
  if (mode === "deep") return "Deep Content";
  return "Social Campaign";
}

function modeIcon(mode: BriefForm["campaign_mode"]): string {
  if (mode === "offer") return "shopping_bag";
  if (mode === "deep") return "hub";
  return "campaign";
}

function toProject(kit: KitSummary): PortfolioProject | null {
  const brief = parseBrief(kit.brief_json);
  if (!brief) return null;

  const brand = brief.brand_name.trim();
  const industry = brief.industry.trim();
  const title = brand || industry || "Untitled Project";
  const platforms = brief.platforms.slice(0, 2);
  const subtitleParts: string[] = [];
  if (platforms.length) subtitleParts.push(platforms.join(" + "));
  if (brief.main_goal.trim()) subtitleParts.push(brief.main_goal.trim());
  if (!subtitleParts.length) subtitleParts.push(modeLabel(brief.campaign_mode));

  const tags: string[] = [];
  tags.push(modeLabel(brief.campaign_mode));
  if (brief.target_audience.length) tags.push("Audience-defined");
  if (brief.reference_image) tags.push("Reference-ready");

  return {
    id: kit.id,
    title,
    subtitle: subtitleParts.join(" • "),
    tags: tags.slice(0, 3),
    icon: modeIcon(brief.campaign_mode),
    createdAt: kit.created_at,
  };
}

export default function ClientOverview() {
  const [kits, setKits] = useState<KitSummary[] | null>(null);

  useEffect(() => {
    listMyKits()
      .then((data) => setKits(data))
      .catch((error) => {
        logger.error(error);
        setKits([]);
      });
  }, []);

  const projects = useMemo(() => {
    if (!kits?.length) return [];
    return kits
      .map(toProject)
      .filter((item): item is PortfolioProject => Boolean(item))
      .slice(0, 5);
  }, [kits]);

  const featuredProject = projects[0];
  const recentProjects = projects.slice(1);
  const useFallbackPortfolio = kits !== null && projects.length === 0;

  return (
    <div className="space-y-14 pb-8">
      <section className="relative overflow-hidden rounded-3xl border border-gray-200 dark:border-white/10 bg-gradient-to-b from-gray-50 to-white dark:from-zinc-900 dark:to-black px-6 py-12 sm:px-10 sm:py-16">
        <div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-gray-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-0 h-44 w-44 rounded-full bg-gray-700/10 dark:bg-white/10 blur-3xl" />
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
            SocialGeni Client Portal
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-4xl md:text-5xl">
            Welcome to your agency workspace
          </h1>
          <p dir="rtl" lang="ar" className="mt-2 text-sm font-medium text-gray-600 dark:text-gray-300 sm:text-base">
            أهلاً بيك في البوابة بتاعتنا — محتوى احترافي متظبط بالذكاء الاصطناعي
          </p>
          <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-gray-400 sm:text-lg">
            Submit a single structured brief. We blend human expertise with AI to deliver production-ready content kits—posts,
            visuals, and video prompts—complete with clear next steps for your team.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/wizard/social"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800 active:scale-[0.98] dark:bg-white dark:text-black dark:hover:bg-gray-100 sm:w-auto"
            >
              <span className="material-symbols-outlined text-[20px]">edit_square</span>
              Start your request {'&'} get a first draft
            </Link>
            <Link
              to="/pricing"
              className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-3.5 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50 dark:border-white/15 dark:bg-transparent dark:text-gray-100 dark:hover:bg-white/5 sm:w-auto"
            >
              View plans {'&'} pricing
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="how-it-works-heading">
        <div className="mb-8 text-center">
          <h2 id="how-it-works-heading" className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            How it works
          </h2>
          <p dir="rtl" lang="ar" className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            خطواتنا إزاي؟ — تلات خطوات واضحة
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <article
              key={step.title}
              className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gray-900 text-white dark:bg-white dark:text-black">
                <span className="material-symbols-outlined text-[22px]">{step.icon}</span>
              </div>
              <p dir="rtl" lang="ar" className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                خطوة {i + 1}
              </p>
              <h3 className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{step.title}</h3>
              <p dir="rtl" lang="ar" className="text-sm text-gray-500 dark:text-gray-400">
                {step.titleAr}
              </p>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="portfolio-heading">
        <div className="mb-8 text-center">
          <h2 id="portfolio-heading" className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            Recent Projects
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {kits === null
              ? "Loading your recent projects..."
              : "Latest projects generated from your real content requests."}
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {featuredProject ? (
            <article
              key={featuredProject.id}
              className="group flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-white/10 dark:bg-zinc-900 lg:col-span-2"
            >
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-600 dark:border-white/10 dark:text-gray-300">
                  <span className="material-symbols-outlined text-sm">verified</span>
                  Featured Project
                </p>
                <h3 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">{featuredProject.title}</h3>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600 dark:text-gray-300">{featuredProject.subtitle}</p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {featuredProject.tags.map((tag) => (
                  <span
                    key={`${featuredProject.id}-${tag}`}
                    className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-white/10 dark:text-gray-200"
                  >
                    {tag}
                  </span>
                ))}
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-white/10 dark:text-gray-200">
                  {new Date(featuredProject.createdAt).toLocaleDateString()}
                </span>
              </div>
            </article>
          ) : null}

          {recentProjects.map((item) => (
            <article
              key={item.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-white/10 dark:bg-zinc-900 lg:col-span-1"
            >
              <div className="flex aspect-[4/3] items-center justify-center bg-gray-100 dark:bg-white/5">
                <span className="material-symbols-outlined text-5xl text-gray-400 transition-transform group-hover:scale-105 dark:text-gray-500">
                  {item.icon}
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{item.subtitle}</p>
              </div>
            </article>
          ))}

          {useFallbackPortfolio
            ? FALLBACK_PORTFOLIO.map((item) => (
                <article
                  key={item.title}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-white/10 dark:bg-zinc-900 lg:col-span-1"
                >
                  <div className="flex aspect-[4/3] items-center justify-center bg-gray-100 dark:bg-white/5">
                    <span className="material-symbols-outlined text-5xl text-gray-400 transition-transform group-hover:scale-105 dark:text-gray-500">
                      {item.icon}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{item.subtitle}</p>
                  </div>
                </article>
              ))
            : null}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center dark:border-white/10 dark:bg-white/[0.04] sm:p-10">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">Ready to brief your next campaign?</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-gray-600 dark:text-gray-400">
          Launch our smart wizard to detail your brand, audience, and needs. Save your progress and come back anytime.
        </p>
        <Link
          to="/wizard/social"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-8 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-100"
        >
          <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
          Start your request {'&'} preview deliverables
        </Link>
      </section>
    </div>
  );
}
