import { DAY_NAMES, DAY_NAMES_SHORT, MONTH_NAMES, MONTH_NAMES_SHORT } from '../types/constants';
import { DateFormat } from '../types';

// ========================================
// Date Formatting
// ========================================

/**
 * Format a Date object to YYYY-MM-DD string
 */
export function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a YYYY-MM-DD string to a Date object
 * Returns null if invalid
 */
export function parseISODate(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, yearStr, monthStr, dayStr] = match;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);

  const date = new Date(year, month, day);

  // Validate the date is actually valid (e.g., not Feb 31)
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }

  return date;
}

/**
 * Get today's date at midnight
 */
export function getToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// ========================================
// Date Arithmetic
// ========================================

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add weeks to a date
 */
export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

/**
 * Add months to a date
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Add years to a date
 */
export function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

/**
 * Get the next occurrence of a specific day of the week
 */
export function getNextWeekday(dayOfWeek: number, fromDate: Date = getToday()): Date {
  const result = new Date(fromDate);
  const currentDay = result.getDay();
  const daysUntil = (dayOfWeek - currentDay + 7) % 7 || 7;
  result.setDate(result.getDate() + daysUntil);
  return result;
}

/**
 * Get the start of the week containing a date
 */
export function getStartOfWeek(date: Date, firstDayOfWeek: number = 0): Date {
  const result = new Date(date);
  const currentDay = result.getDay();
  const diff = (currentDay < firstDayOfWeek ? 7 : 0) + currentDay - firstDayOfWeek;
  result.setDate(result.getDate() - diff);
  return result;
}

/**
 * Get the end of the week containing a date
 */
export function getEndOfWeek(date: Date, firstDayOfWeek: number = 0): Date {
  const startOfWeek = getStartOfWeek(date, firstDayOfWeek);
  return addDays(startOfWeek, 6);
}

/**
 * Get the last day of the month
 */
export function getEndOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

// ========================================
// Date Comparisons
// ========================================

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  const today = getToday();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

/**
 * Check if a date is before today
 */
export function isBeforeToday(date: Date): boolean {
  return date < getToday();
}

/**
 * Check if a date string is overdue (before today and not completed)
 */
export function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const date = parseISODate(dateStr);
  if (!date) return false;
  return isBeforeToday(date) && !isToday(date);
}

/**
 * Check if a date string is today
 */
export function isDueToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const date = parseISODate(dateStr);
  if (!date) return false;
  return isToday(date);
}

/**
 * Check if a date string is within the current week
 */
export function isDueThisWeek(dateStr: string | null, firstDayOfWeek: number = 0): boolean {
  if (!dateStr) return false;
  const date = parseISODate(dateStr);
  if (!date) return false;

  const today = getToday();
  const startOfWeek = getStartOfWeek(today, firstDayOfWeek);
  const endOfWeek = getEndOfWeek(today, firstDayOfWeek);

  return date >= startOfWeek && date <= endOfWeek;
}

// ========================================
// Natural Language Date Parsing
// ========================================

/**
 * Parse natural language date expressions
 * Returns ISO date string or null if not recognized
 */
export function parseNaturalDate(input: string): string | null {
  const text = input.toLowerCase().trim();
  const today = getToday();

  // ISO format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = parseISODate(text);
    return date ? formatDateToISO(date) : null;
  }

  // US format: MM/DD/YYYY
  const usMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    if (!isNaN(date.getTime())) {
      return formatDateToISO(date);
    }
  }

  // EU format: DD-MM-YYYY
  const euMatch = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (euMatch) {
    const [, day, month, year] = euMatch;
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    if (!isNaN(date.getTime())) {
      return formatDateToISO(date);
    }
  }

  // Relative dates
  if (text === 'today') return formatDateToISO(today);
  if (text === 'tomorrow') return formatDateToISO(addDays(today, 1));
  if (text === 'yesterday') return formatDateToISO(addDays(today, -1));

  // "in X days/weeks/months/years"
  const inMatch = text.match(/^in\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)$/);
  if (inMatch) {
    const count = parseInt(inMatch[1], 10);
    const unit = inMatch[2];

    if (unit.startsWith('day')) return formatDateToISO(addDays(today, count));
    if (unit.startsWith('week')) return formatDateToISO(addWeeks(today, count));
    if (unit.startsWith('month')) return formatDateToISO(addMonths(today, count));
    if (unit.startsWith('year')) return formatDateToISO(addYears(today, count));
  }

  // Day names
  for (let i = 0; i < DAY_NAMES.length; i++) {
    const fullName = DAY_NAMES[i];
    const shortName = DAY_NAMES_SHORT[i];

    if (text === fullName || text === shortName) {
      return formatDateToISO(getNextWeekday(i, today));
    }

    if (text === `next ${fullName}` || text === `next ${shortName}`) {
      return formatDateToISO(getNextWeekday(i, addDays(today, 7)));
    }

    if (text === `this ${fullName}` || text === `this ${shortName}`) {
      const nextOccurrence = getNextWeekday(i, today);
      return today.getDay() === i
        ? formatDateToISO(today)
        : formatDateToISO(nextOccurrence);
    }
  }

  // Relative week/month
  if (text === 'next week') return formatDateToISO(addWeeks(today, 1));
  if (text === 'next month') return formatDateToISO(addMonths(today, 1));
  if (text === 'end of week' || text === 'eow') return formatDateToISO(getEndOfWeek(today));
  if (text === 'end of month' || text === 'eom') return formatDateToISO(getEndOfMonth(today));

  // Next weekday
  if (text === 'weekday' || text === 'next weekday') {
    let result = addDays(today, 1);
    while (result.getDay() === 0 || result.getDay() === 6) {
      result = addDays(result, 1);
    }
    return formatDateToISO(result);
  }

  // Month + day (e.g., "January 15", "Jan 15 2025")
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    const fullName = MONTH_NAMES[i];
    const shortName = MONTH_NAMES_SHORT[i];

    const monthMatch = text.match(
      new RegExp(`^(${fullName}|${shortName})\\s+(\\d{1,2})(?:\\s+(\\d{4}))?$`)
    );

    if (monthMatch) {
      const day = parseInt(monthMatch[2], 10);
      const year = monthMatch[3] ? parseInt(monthMatch[3], 10) : today.getFullYear();
      const date = new Date(year, i, day);

      // If no year specified and date is in the past, use next year
      if (!monthMatch[3] && date < today) {
        date.setFullYear(date.getFullYear() + 1);
      }

      if (!isNaN(date.getTime())) {
        return formatDateToISO(date);
      }
    }
  }

  return null;
}

// ========================================
// Date Display Formatting
// ========================================

/**
 * Format a date string according to the specified format
 */
export function formatDate(dateStr: string, format: DateFormat = 'YYYY-MM-DD'): string {
  if (!dateStr) return '';

  const date = parseISODate(dateStr);
  if (!date) return dateStr;

  switch (format) {
    case 'MM/DD/YYYY':
      return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;

    case 'DD-MM-YYYY':
      return `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;

    case 'locale':
      return date.toLocaleDateString();

    case 'YYYY-MM-DD':
    default:
      return dateStr;
  }
}

/**
 * Get a friendly relative date string (e.g., "Today", "Tomorrow", "Monday")
 */
export function getRelativeDateString(dateStr: string | null): string {
  if (!dateStr) return '';

  const date = parseISODate(dateStr);
  if (!date) return dateStr;

  const today = getToday();
  const diff = date.getTime() - today.getTime();
  const daysDiff = Math.round(diff / (1000 * 60 * 60 * 24));

  if (daysDiff === 0) return 'Today';
  if (daysDiff === 1) return 'Tomorrow';
  if (daysDiff === -1) return 'Yesterday';

  if (daysDiff > 1 && daysDiff <= 7) {
    const dayName = DAY_NAMES[date.getDay()];
    return dayName.charAt(0).toUpperCase() + dayName.slice(1);
  }

  if (daysDiff < -1 && daysDiff >= -7) {
    return `${Math.abs(daysDiff)} days ago`;
  }

  if (daysDiff > 7 && daysDiff <= 14) {
    return 'Next week';
  }

  return formatDate(dateStr);
}
