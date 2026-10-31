/**
 * Sanitizes a CSV cell to prevent CSV formula injection (DDE attacks).
 * If a cell begins with '=', '+', '-', '@', '\t', or '\r', it prefixes it with a single quote.
 */
export function sanitizeCsvCell(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  let str = String(value);

  // If cell starts with formula characters, prefix with single quote to force text rendering
  if (/^[=\+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // If the cell contains quotes, commas, or newlines, escape quotes and wrap in quotes
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Converts an array of string arrays or row objects to a valid, injection-safe CSV string.
 */
export function buildCsvRow(values: any[]): string {
  return values.map(sanitizeCsvCell).join(',') + '\r\n';
}

