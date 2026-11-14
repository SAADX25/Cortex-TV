import { useUIStore } from "@/stores/useUIStore";

export function useLocale() {
  const language = useUIStore((state) => state.language);
  return { language, ar: language === "ar", t: (en: string, ar: string) => language === "ar" ? ar : en };
}
