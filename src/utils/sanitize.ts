/**
 * Sanitizes user text input:
 * - Trims leading and trailing whitespace
 * - Normalizes unicode (NFC)
 * - Removes non-printable/control characters (preserves newlines, carriage returns, tabs)
 * - Normalizes excessive horizontal whitespace
 * - Enforces max length without stripping meaningful punctuation or language scripts
 */
export const sanitizeText = (text: string | null | undefined, maxLength?: number | null): string => {
  if (!text) return '';

  let sanitized = text
    .normalize('NFC')
    // Remove control characters except \t (0x09), \n (0x0A), \r (0x0D)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    // Normalize consecutive spaces/tabs to a single space, while preserving newlines
    .replace(/[^\S\r\n]+/g, ' ')
    // Normalize multiple consecutive blank lines to max 2
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (maxLength && maxLength > 0 && sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength).trim();
  }

  return sanitized;
};

