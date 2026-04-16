export type SelectionOption = {
  value: string;
  labelAr: string;
  icon?: string;
};

export const MAIN_GOAL_OPTIONS: readonly SelectionOption[] = [
  { value: "increase_sales", labelAr: "زيادة مبيعات", icon: "💰" },
  { value: "brand_awareness", labelAr: "وعي بالعلامة التجارية", icon: "📈" },
  { value: "increase_engagement", labelAr: "زيادة التفاعل", icon: "💬" },
] as const;

export const BRAND_TONE_OPTIONS: readonly SelectionOption[] = [
  { value: "formal_professional", labelAr: "رسمي واحترافي", icon: "👔" },
  { value: "funny_trendy", labelAr: "فكاهي وتريند", icon: "😂" },
  { value: "friendly_persuasive", labelAr: "ودي ومقنع", icon: "🤝" },
] as const;

export const TARGET_AUDIENCE_OPTIONS: readonly SelectionOption[] = [
  { value: "youth", labelAr: "الشباب" },
  { value: "entrepreneurs", labelAr: "رواد الأعمال" },
  { value: "mothers", labelAr: "الأمهات" },
  { value: "students", labelAr: "الطلاب" },
] as const;

export const PLATFORM_OPTIONS: readonly SelectionOption[] = [
  { value: "facebook", labelAr: "Facebook", icon: "📘" },
  { value: "instagram", labelAr: "Instagram", icon: "📸" },
  { value: "tiktok", labelAr: "TikTok", icon: "🎵" },
  { value: "youtube", labelAr: "YouTube", icon: "▶️" },
] as const;

export const BEST_CONTENT_TYPE_OPTIONS: readonly SelectionOption[] = [
  { value: "educational", labelAr: "محتوى تعليمي", icon: "🎓" },
  { value: "behind_the_scenes", labelAr: "خلف الكواليس", icon: "🎬" },
  { value: "before_after", labelAr: "قبل / بعد", icon: "✨" },
  { value: "testimonials", labelAr: "آراء العملاء", icon: "🗣️" },
  { value: "offers_promotions", labelAr: "عروض وتخفيضات", icon: "🏷️" },
  { value: "faq", labelAr: "أسئلة شائعة", icon: "❓" },
] as const;

export const OTHER_OPTION: SelectionOption = {
  value: "__other__",
  labelAr: "أخرى (اكتب بنفسك)",
  icon: "➕",
};
