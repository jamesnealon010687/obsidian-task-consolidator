// ========================================
// Text Utility Functions
// ========================================

const ESCAPE_REGEX = /[.*+?^${}()|[\]\\]/g;
const BOLD_PATTERN = /\*\*/g;

/**
 * Escape special regex characters in a string
 */
export function escapeRegex(str: string): string {
  return str.replace(ESCAPE_REGEX, '\\$&');
}

/**
 * Clean text by removing markdown formatting and special characters
 */
export function cleanText(text: string): string {
  return text
    .replace(BOLD_PATTERN, '')
    .replace(/\|/g, '-')
    .replace(/:/g, '-')
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')
    .replace(/\n/g, ' ')
    .replace(/\r/g, '')
    .trim();
}

/**
 * Sanitize owner name
 * Returns null if invalid, otherwise returns cleaned value
 */
export function sanitizeOwner(owner: string | null | undefined): string | null {
  if (!owner) return null;

  const cleaned = cleanText(owner)
    .replace(/<[^>]*>/g, '')
    .replace(/[^\w\s\-.']/gu, '')
    .substring(0, 50)
    .trim();

  return cleaned || null;
}

/**
 * Sanitize project name
 * Returns null if invalid, otherwise returns cleaned value
 */
export function sanitizeProject(project: string | null | undefined): string | null {
  if (!project) return null;

  const cleaned = cleanText(project)
    .replace(/[^\w\s\-_]/gu, '')
    .substring(0, 100)
    .trim();

  return cleaned || null;
}

/**
 * Sanitize task text
 */
export function sanitizeTaskText(text: string): string {
  return text
    .replace(/\n/g, ' ')
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .substring(0, 1000)
    .trim();
}

/**
 * Calculate the depth of indentation
 */
export function calculateIndentDepth(indent: string): number {
  // Convert tabs to 2 spaces and count
  const normalized = indent.replace(/\t/g, '  ').length;
  return Math.floor(normalized / 2);
}

/**
 * Format a label from camelCase to Title Case
 */
export function formatLabel(text: string): string {
  return text
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, c => c.toUpperCase())
    .trim();
}

/**
 * Compare two nullable strings for sorting
 */
export function compareNullableStrings(a: string | null, b: string | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b);
}
