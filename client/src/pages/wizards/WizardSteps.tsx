import { useState } from "react";
import { Controller, UseFormReturn } from "react-hook-form";
import type { BriefForm } from "../../types";
import PillGroup from "../../components/selection/PillGroup";
import SelectableCard from "../../components/selection/SelectableCard";
import ReferenceImageUploader from "../../components/ReferenceImageUploader";
import {
  decodeMultiSelection,
  decodeSingleSelection,
  encodeSingleSelection,
} from "../../lib/selectionFieldCodec";
import {
  BRAND_TONE_OPTIONS,
  MAIN_GOAL_OPTIONS,
  OTHER_OPTION,
  PLATFORM_OPTIONS,
  TARGET_AUDIENCE_OPTIONS,
} from "./selectionOptions";
import { BRIEF_LIMITS } from "../../briefSchema";

export const labelCls = "mb-2 ms-1 block text-xs font-semibold uppercase tracking-widest text-on-surface-variant";
export const fieldShell = "glow-focus overflow-hidden rounded-xl bg-surface-container-lowest p-0.5";
export const inputCls =
  "block box-border w-full rounded-lg border-none bg-transparent px-4 py-3 text-on-surface placeholder:text-on-surface-variant/50 focus:ring-0 focus-visible:ring-2 focus-visible:ring-primary/45";
export const selectCls =
  "block box-border w-full appearance-none rounded-lg border-none bg-surface-container-lowest px-4 py-3 text-on-surface focus:ring-0 focus-visible:ring-2 focus-visible:ring-primary/45 dark:bg-surface-container-high/70";
export const textareaCls = `${inputCls} min-h-[100px] resize-y`;
export const errCls = "mt-1 text-sm text-error";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export type StepProps = {
  form: UseFormReturn<BriefForm>;
  showField: (step: string, key: keyof BriefForm) => boolean;
};

// --- Diagnosis Step ---
export function DiagnosisStep({ form }: Pick<StepProps, "form">) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="diagnostic_role" className={labelCls}>Who are you?</label>
        <div className={fieldShell}>
          <select id="diagnostic_role" className={selectCls} {...register("diagnostic_role")}>
            <option value="">Select role…</option>
            <option value="entrepreneur-founder">Entrepreneur / Founder</option>
            <option value="coach-consultant">Coach or Consultant</option>
            <option value="doctor-expert-professional">Doctor / Expert / Professional</option>
            <option value="freelancer-creative">Freelancer or Creative</option>
          </select>
        </div>
        {errors.diagnostic_role && <p className={errCls}>{errors.diagnostic_role.message}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="diagnostic_account_stage" className={labelCls}>Account Stage</label>
          <div className={fieldShell}>
            <select id="diagnostic_account_stage" className={selectCls} {...register("diagnostic_account_stage")}>
              <option value="">Select stage…</option>
              <option value="under-6-months">Just starting — under 6 months</option>
              <option value="6-12-months">6 months to 1 year</option>
              <option value="1-3-years">1–3 years, inconsistent results</option>
              <option value="3-plus-years">3+ years, want to scale</option>
            </select>
          </div>
          {errors.diagnostic_account_stage && <p className={errCls}>{errors.diagnostic_account_stage.message}</p>}
        </div>
        <div>
          <label htmlFor="diagnostic_followers_band" className={labelCls}>Follower Range</label>
          <div className={fieldShell}>
            <select id="diagnostic_followers_band" className={selectCls} {...register("diagnostic_followers_band")}>
              <option value="">Select range…</option>
              <option value="under-1k">Under 1,000</option>
              <option value="1k-5k">1,000 – 5,000</option>
              <option value="5k-20k">5,000 – 20,000</option>
              <option value="20k-plus">20,000+</option>
            </select>
          </div>
          {errors.diagnostic_followers_band && <p className={errCls}>{errors.diagnostic_followers_band.message}</p>}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="diagnostic_primary_blocker" className={labelCls}>Primary Blocker</label>
          <div className={fieldShell}>
            <select id="diagnostic_primary_blocker" className={selectCls} {...register("diagnostic_primary_blocker")}>
              <option value="">Select blocker…</option>
              <option value="low-reach">I post but nobody sees my content</option>
              <option value="no-content-system">I don't know what to post consistently</option>
              <option value="no-conversion">Followers exist but no sales or clients</option>
              <option value="inconsistent-execution">No time — totally inconsistent</option>
            </select>
          </div>
          {errors.diagnostic_primary_blocker && <p className={errCls}>{errors.diagnostic_primary_blocker.message}</p>}
        </div>
        <div>
          <label htmlFor="diagnostic_revenue_goal" className={labelCls}>Target monthly revenue</label>
          <div className={fieldShell}>
            <select id="diagnostic_revenue_goal" className={selectCls} {...register("diagnostic_revenue_goal")}>
              <option value="">Select target…</option>
              <option value="500-1000">$500 – $1,000/month</option>
              <option value="1000-3000">$1,000 – $3,000/month</option>
              <option value="3000-10000">$3,000 – $10,000/month</option>
              <option value="10000-plus">$10,000+/month</option>
            </select>
          </div>
          {errors.diagnostic_revenue_goal && <p className={errCls}>{errors.diagnostic_revenue_goal.message}</p>}
        </div>
      </div>
    </div>
  );
}

// --- Brand Step ---
export function BrandStep({ form, showField, industryOptions }: StepProps & { industryOptions: {slug: string, name: string}[] }) {
  const { register, control, formState: { errors } } = form;
  const [isOtherIndustry, setIsOtherIndustry] = useState(false);

  return (
    <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
      {showField("brand", "brand_name") && (
        <div>
          <label htmlFor="brand_name" className={labelCls}>Brand name</label>
          <div className={fieldShell}><input id="brand_name" className={inputCls} {...register("brand_name")} /></div>
          {errors.brand_name && <p className={errCls}>{errors.brand_name.message}</p>}
        </div>
      )}
      {showField("brand", "industry") && (
        <div>
          <label htmlFor="industry" className={labelCls}>Industry</label>
          <div className={fieldShell}>
            <Controller
              name="industry"
              control={control}
              render={({ field }) => (
                <select
                  id="industry"
                  className={selectCls}
                  value={isOtherIndustry ? "__other__" : (field.value || "")}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "__other__") {
                      setIsOtherIndustry(true);
                      field.onChange("");
                      return;
                    }
                    setIsOtherIndustry(false);
                    field.onChange(v);
                  }}
                >
                  <option value="">Select industry…</option>
                  {industryOptions.map((i) => (
                    <option key={i.slug} value={i.slug}>
                      {i.name}
                    </option>
                  ))}
                  <option value="__other__">Other (write manually)</option>
                </select>
              )}
            />
          </div>
          {isOtherIndustry && (
            <div className={fieldShell + " mt-3"}>
              <Controller
                name="industry"
                control={control}
                render={({ field }) => (
                  <input
                    id="industry_other"
                    className={inputCls}
                    value={field.value || ""}
                    onChange={(e) => field.onChange(e.target.value)}
                    placeholder="Write your industry..."
                  />
                )}
              />
            </div>
          )}
          {errors.industry && <p className={errCls}>{errors.industry.message}</p>}
        </div>
      )}
    </div>
  );
}

// --- Audience Step ---
export function AudienceStep({ form, showField }: StepProps) {
  const { formState: { errors }, control } = form;

  return (
    <div className="space-y-6">
      {showField("audience", "target_audience") && (
        <Controller
          name="target_audience"
          control={control}
          render={({ field }) => {
            const { selected, otherText } = decodeMultiSelection(field.value || [], TARGET_AUDIENCE_OPTIONS);
            const onChange = (newSelected: string[], newOther: string) => {
              const values = newSelected.filter((v) => v !== OTHER_OPTION.value);
              const other = newOther.trim();
              if (other) values.push(other);
              field.onChange(Array.from(new Set(values)));
            };
            const toggle = (val: string) => {
              const next = selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val];
              onChange(next, otherText);
            };
            return (
              <div>
                <label className={labelCls}>Target audience</label>
                <PillGroup
                  options={TARGET_AUDIENCE_OPTIONS}
                  selectedValues={selected}
                  onToggle={toggle}
                />
                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-brand-sand/30 bg-earth-card px-3 py-1.5 text-xs font-semibold text-on-surface transition hover:bg-earth-alt dark:border-outline/30 dark:bg-surface-container-high dark:hover:bg-surface-container-highest"
                  onClick={() => {
                     const enabled = !!otherText.trim() || selected.includes(OTHER_OPTION.value);
                     if (enabled) {
                       onChange(selected.filter((v) => v !== OTHER_OPTION.value), "");
                     } else {
                       onChange([...selected, OTHER_OPTION.value], otherText);
                     }
                  }}
                >
                  <span>{OTHER_OPTION.icon}</span>
                  <span>{OTHER_OPTION.labelAr}</span>
                </button>
                {selected.includes(OTHER_OPTION.value) && (
                  <div className={fieldShell + " mt-3"}>
                    <input
                      className={inputCls}
                      value={otherText}
                      onChange={(e) => onChange(selected, e.target.value)}
                      placeholder="اكتب جمهورك المستهدف..."
                    />
                  </div>
                )}
                {errors.target_audience && <p className={errCls}>{errors.target_audience.message}</p>}
              </div>
            );
          }}
        />
      )}
      {showField("audience", "main_goal") && (
        <Controller
          name="main_goal"
          control={control}
          render={({ field }) => {
            const { selected, otherText } = decodeSingleSelection(field.value || "", MAIN_GOAL_OPTIONS);
            const onChange = (newSelected: string, newOther: string) => {
              field.onChange(encodeSingleSelection(newSelected, newOther, MAIN_GOAL_OPTIONS));
            };
            return (
              <div>
                <label className={labelCls}>Main campaign goal</label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {MAIN_GOAL_OPTIONS.map((option) => (
                    <SelectableCard
                      key={option.value}
                      label={option.labelAr}
                      icon={option.icon}
                      selected={selected === option.value}
                      onClick={() => onChange(option.value, "")}
                    />
                  ))}
                  <SelectableCard
                    label={OTHER_OPTION.labelAr}
                    icon={OTHER_OPTION.icon}
                    selected={selected === OTHER_OPTION.value}
                    onClick={() => onChange(OTHER_OPTION.value, otherText)}
                  />
                </div>
                {selected === OTHER_OPTION.value && (
                  <div className={fieldShell + " mt-3"}>
                    <input
                      className={inputCls}
                      value={otherText}
                      onChange={(e) => onChange(OTHER_OPTION.value, e.target.value)}
                      placeholder="اكتب هدف الحملة..."
                    />
                  </div>
                )}
                {errors.main_goal && <p className={errCls}>{errors.main_goal.message}</p>}
              </div>
            );
          }}
        />
      )}
    </div>
  );
}

// --- Channels Step ---
export function ChannelsStep({ form, showField }: StepProps) {
  const { formState: { errors }, control, register } = form;

  return (
    <div className="space-y-6">
      {showField("channels", "platforms") && (
        <Controller
          name="platforms"
          control={control}
          render={({ field }) => {
            const { selected, otherText } = decodeMultiSelection(field.value || [], PLATFORM_OPTIONS);
            const onChange = (newSelected: string[], newOther: string) => {
              const values = newSelected.filter((v) => v !== OTHER_OPTION.value);
              const other = newOther.trim();
              if (other) values.push(other);
              field.onChange(Array.from(new Set(values)));
            };
            const toggle = (val: string) => {
              const next = selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val];
              onChange(next, otherText);
            };
            return (
              <div>
                <label className={labelCls}>Active platforms</label>
                <PillGroup
                  options={PLATFORM_OPTIONS}
                  selectedValues={selected}
                  onToggle={toggle}
                />
                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-brand-sand/30 bg-earth-card px-3 py-1.5 text-xs font-semibold text-on-surface transition hover:bg-earth-alt dark:border-outline/30 dark:bg-surface-container-high dark:hover:bg-surface-container-highest"
                  onClick={() => {
                    const enabled = !!otherText.trim() || selected.includes(OTHER_OPTION.value);
                    if (enabled) {
                      onChange(selected.filter((v) => v !== OTHER_OPTION.value), "");
                    } else {
                      onChange([...selected, OTHER_OPTION.value], otherText);
                    }
                  }}
                >
                  <span>{OTHER_OPTION.icon}</span>
                  <span>{OTHER_OPTION.labelAr}</span>
                </button>
                {selected.includes(OTHER_OPTION.value) && (
                  <div className={fieldShell + " mt-3"}>
                    <input
                      className={inputCls}
                      value={otherText}
                      onChange={(e) => onChange(selected, e.target.value)}
                      placeholder="اكتب منصة إضافية..."
                    />
                  </div>
                )}
                {errors.platforms && <p className={errCls}>{errors.platforms.message}</p>}
              </div>
            );
          }}
        />
      )}
      {(showField("channels", "brand_tone") || showField("channels", "brand_colors")) && (
        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
          {showField("channels", "brand_tone") && (
            <Controller
              name="brand_tone"
              control={control}
              render={({ field }) => {
                const { selected, otherText } = decodeSingleSelection(field.value || "", BRAND_TONE_OPTIONS);
                const onChange = (newSelected: string, newOther: string) => {
                  field.onChange(encodeSingleSelection(newSelected, newOther, BRAND_TONE_OPTIONS));
                };
                return (
                  <div>
                    <label className={labelCls}>Brand tone</label>
                    <div className="space-y-3">
                      {BRAND_TONE_OPTIONS.map((option) => (
                        <SelectableCard
                          key={option.value}
                          label={option.labelAr}
                          icon={option.icon}
                          selected={selected === option.value}
                          onClick={() => onChange(option.value, "")}
                        />
                      ))}
                      <SelectableCard
                        label={OTHER_OPTION.labelAr}
                        icon={OTHER_OPTION.icon}
                        selected={selected === OTHER_OPTION.value}
                        onClick={() => onChange(OTHER_OPTION.value, otherText)}
                      />
                    </div>
                    {selected === OTHER_OPTION.value && (
                      <div className={fieldShell + " mt-3"}>
                        <input
                          className={inputCls}
                          value={otherText}
                          onChange={(e) => onChange(OTHER_OPTION.value, e.target.value)}
                          placeholder="اكتب نبرة البراند..."
                        />
                      </div>
                    )}
                    {errors.brand_tone && <p className={errCls}>{errors.brand_tone.message}</p>}
                  </div>
                );
              }}
            />
          )}
          {showField("channels", "brand_colors") && (
            <div>
              <label htmlFor="brand_colors" className={labelCls}>Brand colors</label>
              <div className={fieldShell}><input id="brand_colors" className={inputCls} {...register("brand_colors")} /></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Offer Step ---
export function OfferStep({ form, showField }: StepProps) {
  const { register, formState: { errors } } = form;

  return (
    <div className="space-y-6">
      {showField("offer", "offer") && (
        <div>
          <label htmlFor="offer" className={labelCls}>Offer / core message</label>
          <div className={fieldShell}><textarea id="offer" className={textareaCls} {...register("offer")} /></div>
          {errors.offer && <p className={errCls}>{errors.offer.message}</p>}
        </div>
      )}
      {showField("offer", "competitors") && (
        <div>
          <label htmlFor="competitors" className={labelCls}>Competitors</label>
          <div className={fieldShell}><textarea id="competitors" className={textareaCls} {...register("competitors")} /></div>
        </div>
      )}
      {showField("offer", "product_details") && (
        <div>
          <label htmlFor="product_details_offer" className={labelCls} dir="rtl" lang="ar">
            تفاصيل المنتج / الخدمة (اختياري بس مهم جداً)
          </label>
          <div className={fieldShell}>
            <textarea
              id="product_details_offer"
              className={textareaCls}
              dir="rtl"
              lang="ar"
              placeholder="اوصف منتجك بدقة شديدة (مثال: تيشيرت أوفر سايز أسود خامة قطن، أو كنبة مودرن قطيفة كحلي...)."
              {...register("product_details")}
            />
          </div>
          {errors.product_details && <p className={errCls}>{errors.product_details.message}</p>}
        </div>
      )}
    </div>
  );
}

// --- Creative Step ---
export function CreativeStep({ form, showField }: StepProps) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form;

  return (
    <div className="space-y-6">
      {showField("creative", "visual_notes") && (
        <div>
          <label htmlFor="visual_notes" className={labelCls}>ملاحظات الديزاين والاتجاه الإبداعي</label>
          <div className={fieldShell}><textarea id="visual_notes" className={textareaCls} {...register("visual_notes")} /></div>
          {errors.visual_notes && <p className={errCls}>{errors.visual_notes.message}</p>}
        </div>
      )}
      {showField("creative", "product_details") && (
        <div>
          <label htmlFor="product_details" className={labelCls} dir="rtl" lang="ar">
            تفاصيل المنتج / الخدمة (اختياري بس مهم جداً)
          </label>
          <div className={fieldShell}>
            <textarea
              id="product_details"
              className={textareaCls}
              dir="rtl"
              lang="ar"
              placeholder="اوصف منتجك بدقة شديدة (مثال: تيشيرت أوفر سايز أسود خامة قطن، أو كنبة مودرن قطيفة كحلي...)."
              {...register("product_details")}
            />
          </div>
          {errors.product_details && <p className={errCls}>{errors.product_details.message}</p>}
        </div>
      )}
      {showField("creative", "reference_image") && (
        <div>
          <ReferenceImageUploader
            value={watch("reference_image") || ""}
            onChange={(nextValue) => setValue("reference_image", nextValue, { shouldDirty: true })}
          />
          {errors.reference_image && <p className={errCls}>{errors.reference_image.message}</p>}
        </div>
      )}
      {(showField("creative", "campaign_duration") || showField("creative", "budget_level")) && (
        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
          {showField("creative", "campaign_duration") && (
            <div>
              <label htmlFor="campaign_duration" className={labelCls}>مدة الحملة</label>
              <div className={fieldShell}><input id="campaign_duration" className={inputCls} {...register("campaign_duration")} /></div>
              {errors.campaign_duration && <p className={errCls}>{errors.campaign_duration.message}</p>}
            </div>
          )}
          {showField("creative", "budget_level") && (
            <div>
              <label htmlFor="budget_level" className={labelCls}>مستوى ميزانية الإعلانات (١-٧)</label>
              <div className={fieldShell}><input id="budget_level" className={inputCls} {...register("budget_level")} /></div>
            </div>
          )}
        </div>
      )}
      {showField("creative", "best_content_types") && (
        <Controller
          name="best_content_types"
          control={form.control}
          render={({ field }) => (
            <div>
              <label htmlFor="best_content_types" className={labelCls}>أكتر أنواع محتوى بتجيب نتيجة معاك</label>
              <div className={fieldShell}>
                <textarea
                  id="best_content_types"
                  className={textareaCls}
                  value={Array.isArray(field.value) ? field.value.join(", ") : ""}
                  onChange={(e) => {
                    const values = e.target.value
                      .split(/[,،]/g)
                      .map((item) => item.trim())
                      .filter(Boolean);
                    field.onChange(Array.from(new Set(values)));
                  }}
                />
              </div>
              {errors.best_content_types && <p className={errCls}>{errors.best_content_types.message}</p>}
            </div>
          )}
        />
      )}
    </div>
  );
}

// --- Volume Step ---
export function VolumeStep({ form, showField }: StepProps) {
  const { control, formState: { errors } } = form;

  return (
    <div className="space-y-6">
      {(showField("volume", "num_posts") || showField("volume", "num_image_designs")) && (
        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
          {showField("volume", "num_posts") && (
            <div>
              <label htmlFor="num_posts" className={labelCls}>عدد البوستات ({BRIEF_LIMITS.num_posts.min}–{BRIEF_LIMITS.num_posts.max})</label>
              <div className={fieldShell}>
                <Controller
                  name="num_posts"
                  control={control}
                  render={({ field }) => (
                    <input id="num_posts" type="number" className={inputCls} value={field.value} onChange={(e) => field.onChange(clamp(Number(e.target.value) || 0, BRIEF_LIMITS.num_posts.min, BRIEF_LIMITS.num_posts.max))} />
                  )}
                />
              </div>
              {errors.num_posts && <p className={errCls}>{errors.num_posts.message}</p>}
            </div>
          )}
          {showField("volume", "num_image_designs") && (
            <div>
              <label htmlFor="num_image_designs" className={labelCls}>عدد أفكار الصور والديزاينات ({BRIEF_LIMITS.num_image_designs.min}–{BRIEF_LIMITS.num_image_designs.max})</label>
              <div className={fieldShell}>
                <Controller
                  name="num_image_designs"
                  control={control}
                  render={({ field }) => (
                    <input id="num_image_designs" type="number" className={inputCls} value={field.value} onChange={(e) => field.onChange(clamp(Number(e.target.value) || 0, BRIEF_LIMITS.num_image_designs.min, BRIEF_LIMITS.num_image_designs.max))} />
                  )}
                />
              </div>
              {errors.num_image_designs && <p className={errCls}>{errors.num_image_designs.message}</p>}
            </div>
          )}
        </div>
      )}
      {showField("volume", "num_video_prompts") && (
        <div>
          <label htmlFor="num_video_prompts" className={labelCls}>عدد سكريبتات الفيديوهات ({BRIEF_LIMITS.num_video_prompts.min}–{BRIEF_LIMITS.num_video_prompts.max})</label>
          <div className={fieldShell}>
            <Controller
              name="num_video_prompts"
              control={control}
              render={({ field }) => (
                <input id="num_video_prompts" type="number" className={inputCls} value={field.value} onChange={(e) => field.onChange(clamp(Number(e.target.value) || 0, BRIEF_LIMITS.num_video_prompts.min, BRIEF_LIMITS.num_video_prompts.max))} />
              )}
            />
          </div>
          {errors.num_video_prompts && <p className={errCls}>{errors.num_video_prompts.message}</p>}
        </div>
      )}
    </div>
  );
}
