import { ValidationResult, Priority } from '../types';
import { STAGES, PRIORITIES, VALIDATION_LIMITS } from '../types/constants';

// ========================================
// Validation Patterns
// ========================================

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const OWNER_PATTERN = /^[\w\s\-.']+$/u;
const PROJECT_PATTERN = /^[\w\s\-_]+$/u;

// ========================================
// Date Validation
// ========================================

/**
 * Validate a date string
 */
export function validateDate(dateStr: string | null | undefined): ValidationResult {
  if (dateStr == null || dateStr === '') {
    return { isValid: true, sanitizedValue: undefined };
  }

  const trimmed = dateStr.trim();

  if (!DATE_PATTERN.test(trimmed)) {
    return { isValid: false, error: 'Date must be in YYYY-MM-DD format' };
  }

  // Validate the date is actually valid
  const [year, month, day] = trimmed.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return { isValid: false, error: 'Invalid date value' };
  }

  return { isValid: true, sanitizedValue: trimmed };
}

// ========================================
// Task Text Validation
// ========================================

/**
 * Validate task text
 */
export function validateTaskText(text: string | null | undefined): ValidationResult {
  if (text == null) {
    return { isValid: false, error: 'Task text is required' };
  }

  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return { isValid: false, error: 'Task text cannot be empty' };
  }

  if (trimmed.length > VALIDATION_LIMITS.MAX_TASK_TEXT_LENGTH) {
    return {
      isValid: false,
      error: `Task text exceeds maximum length of ${VALIDATION_LIMITS.MAX_TASK_TEXT_LENGTH} characters`
    };
  }

  return { isValid: true, sanitizedValue: trimmed };
}

// ========================================
// Owner Validation
// ========================================

/**
 * Validate owner name
 */
export function validateOwner(owner: string | null | undefined): ValidationResult {
  if (owner == null || owner === '') {
    return { isValid: true, sanitizedValue: undefined };
  }

  const trimmed = owner.trim();

  if (trimmed.length > VALIDATION_LIMITS.MAX_OWNER_LENGTH) {
    return {
      isValid: false,
      error: `Owner name exceeds maximum length of ${VALIDATION_LIMITS.MAX_OWNER_LENGTH} characters`
    };
  }

  if (!OWNER_PATTERN.test(trimmed)) {
    return { isValid: false, error: 'Owner name contains invalid characters' };
  }

  return { isValid: true, sanitizedValue: trimmed };
}

// ========================================
// Project Validation
// ========================================

/**
 * Validate project name
 */
export function validateProject(project: string | null | undefined): ValidationResult {
  if (project == null || project === '') {
    return { isValid: true, sanitizedValue: undefined };
  }

  const trimmed = project.trim();

  if (trimmed.length > VALIDATION_LIMITS.MAX_PROJECT_LENGTH) {
    return {
      isValid: false,
      error: `Project name exceeds maximum length of ${VALIDATION_LIMITS.MAX_PROJECT_LENGTH} characters`
    };
  }

  if (!PROJECT_PATTERN.test(trimmed)) {
    return { isValid: false, error: 'Project name contains invalid characters' };
  }

  return { isValid: true, sanitizedValue: trimmed };
}

// ========================================
// Stage Validation
// ========================================

/**
 * Validate stage
 */
export function validateStage(
  stage: string | null | undefined,
  customStages: string[] = []
): ValidationResult {
  if (stage == null || stage === '') {
    return { isValid: true, sanitizedValue: undefined };
  }

  const trimmed = stage.trim();
  const validStages = [...STAGES, ...customStages];

  if (!validStages.includes(trimmed)) {
    return {
      isValid: false,
      error: `Invalid stage. Valid stages are: ${validStages.join(', ')}`
    };
  }

  return { isValid: true, sanitizedValue: trimmed };
}

// ========================================
// Priority Validation
// ========================================

/**
 * Validate priority
 */
export function validatePriority(priority: string | null | undefined): ValidationResult {
  if (priority == null || priority === '') {
    return { isValid: true, sanitizedValue: undefined };
  }

  const lower = priority.toLowerCase().trim();

  if (!PRIORITIES.includes(lower as Priority)) {
    return {
      isValid: false,
      error: `Invalid priority. Valid values are: ${PRIORITIES.join(', ')}`
    };
  }

  return { isValid: true, sanitizedValue: lower };
}

// ========================================
// Line Number Validation
// ========================================

/**
 * Validate line number
 */
export function validateLineNumber(
  lineNumber: number | null | undefined,
  fileLength?: number
): ValidationResult {
  if (lineNumber == null) {
    return { isValid: false, error: 'Line number is required' };
  }

  if (!Number.isInteger(lineNumber) || lineNumber < 0) {
    return { isValid: false, error: 'Line number must be a non-negative integer' };
  }

  if (fileLength !== undefined && lineNumber >= fileLength) {
    return { isValid: false, error: 'Line number exceeds file length' };
  }

  return { isValid: true };
}

// ========================================
// Tag Validation
// ========================================

/**
 * Validate a tag
 */
export function validateTag(tag: string): ValidationResult {
  if (!tag || tag.trim().length === 0) {
    return { isValid: false, error: 'Tag cannot be empty' };
  }

  const trimmed = tag.trim().replace(/^#/, '');

  if (trimmed.length > VALIDATION_LIMITS.MAX_TAG_LENGTH) {
    return {
      isValid: false,
      error: `Tag exceeds maximum length of ${VALIDATION_LIMITS.MAX_TAG_LENGTH} characters`
    };
  }

  if (!/^[\w\-_]+$/.test(trimmed)) {
    return { isValid: false, error: 'Tag contains invalid characters' };
  }

  return { isValid: true, sanitizedValue: trimmed.toLowerCase() };
}

/**
 * Validate an array of tags
 */
export function validateTags(tags: string[]): ValidationResult {
  if (tags.length > VALIDATION_LIMITS.MAX_TAGS_COUNT) {
    return {
      isValid: false,
      error: `Too many tags. Maximum is ${VALIDATION_LIMITS.MAX_TAGS_COUNT}`
    };
  }

  const sanitized: string[] = [];

  for (const tag of tags) {
    const result = validateTag(tag);
    if (!result.isValid) {
      return result;
    }
    if (result.sanitizedValue) {
      sanitized.push(result.sanitizedValue);
    }
  }

  return { isValid: true, sanitizedValue: sanitized.join(',') };
}
