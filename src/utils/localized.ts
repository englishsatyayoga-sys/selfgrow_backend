import { z } from 'zod';

export type SupportedLocale = 'en' | 'hi';

export const localizedTextSchema = z.object({
  en: z.string().trim().min(1, 'English text is required'),
  hi: z.string().trim().optional(),
});

export type LocalizedText = z.infer<typeof localizedTextSchema>;

/**
 * Returns localized string based on requested locale.
 * Always falls back to English if Hindi is missing or empty.
 */
export const pickLocale = (text: LocalizedText | null | undefined, locale: SupportedLocale = 'en'): string => {
  if (!text) return '';
  if (locale === 'hi' && text.hi && text.hi.trim().length > 0) {
    return text.hi;
  }
  return text.en || '';
};

