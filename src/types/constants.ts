import {
  Stage,
  Priority,
  RecurrenceType,
  SortOption,
  GroupOption,
  DateFormat,
  FilePathDisplay,
  ViewType,
  KanbanColumn
} from './index';

// ========================================
// Stage Constants
// ========================================

export const STAGES: Stage[] = [
  'Requested',
  'Staged',
  'In-Progress',
  'In-Review',
  'Completed'
];

// ========================================
// Priority Constants
// ========================================

export const PRIORITIES: Priority[] = ['high', 'medium', 'low'];

// ========================================
// Recurrence Type Constants
// ========================================

export const RECURRENCE_TYPES: RecurrenceType[] = [
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'custom'
];

// ========================================
// Kanban Columns
// ========================================

export const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'unassigned', title: 'Unassigned', stage: null },
  { id: 'requested', title: 'Requested', stage: 'Requested' },
  { id: 'staged', title: 'Staged', stage: 'Staged' },
  { id: 'in-progress', title: 'In-Progress', stage: 'In-Progress' },
  { id: 'in-review', title: 'In-Review', stage: 'In-Review' },
  { id: 'completed', title: 'Completed', stage: 'Completed' }
];

// ========================================
// Sort Options
// ========================================

export const SORT_OPTIONS: SortOption[] = [
  'dueDate',
  'owner',
  'priority',
  'project',
  'created',
  'stage'
];

// ========================================
// Group Options
// ========================================

export const GROUP_OPTIONS: GroupOption[] = [
  'none',
  'dueDate',
  'owner',
  'project',
  'stage',
  'priority'
];

// ========================================
// Date Format Options
// ========================================

export const DATE_FORMATS: DateFormat[] = [
  'YYYY-MM-DD',
  'MM/DD/YYYY',
  'DD-MM-YYYY',
  'locale'
];

// ========================================
// File Path Display Options
// ========================================

export const FILE_PATH_OPTIONS: FilePathDisplay[] = [
  'full',
  'filename',
  'hidden'
];

// ========================================
// View Types
// ========================================

export const VIEW_TYPES: ViewType[] = ['panel', 'kanban', 'calendar'];

// ========================================
// View Type ID
// ========================================

export const TASK_VIEW_TYPE = 'task-consolidator-view';

// ========================================
// Day Names
// ========================================

export const DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday'
];

export const DAY_NAMES_SHORT = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// ========================================
// Month Names
// ========================================

export const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december'
];

export const MONTH_NAMES_SHORT = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec'
];

// ========================================
// Validation Limits
// ========================================

export const VALIDATION_LIMITS = {
  MAX_TASK_TEXT_LENGTH: 1000,
  MAX_OWNER_LENGTH: 50,
  MAX_PROJECT_LENGTH: 100,
  MAX_TAG_LENGTH: 50,
  MAX_TAGS_COUNT: 20,
  MAX_LINE_LENGTH: 2000
};

// ========================================
// Regex Patterns
// ========================================

export const PATTERNS = {
  TASK_LINE: /^(\s*)-\s+\[([ xX])\]\s+(.+)$/,
  METADATA: /^\*\*(.+?):\*\*\s*(.*)$/,
  DATE: /^\d{4}-\d{2}-\d{2}$/,
  DATE_WITH_PREFIX: /^(?:Due\s+)?(\d{4}-\d{2}-\d{2})$/i,
  COMPLETED_DATE: /\s*\[done:(\d{4}-\d{2}-\d{2})\]\s*$/,
  CREATED_DATE: /\s*\[created:(\d{4}-\d{2}-\d{2})\]\s*$/,
  PRIORITY: /\[priority:(high|medium|low)\]/i,
  RECURRENCE: /\[repeat:([^\]]+)\]/i,
  TAGS: /#([\w\-_]+)/g,
  QUICK_OWNER: /@([\w\s\-.']+?)(?=\s+[#!@]|\s*$)/,
  QUICK_PROJECT: /^#([\w\-_]+)/,
  QUICK_DATE: /!([\w\-/]+)/
};

// ========================================
// Quick Add Patterns
// ========================================

export const QUICK_ADD_PATTERNS = {
  OWNER: /@([\w\s\-.']+?)(?=\s+[@#!^+]|\s*$)/,
  PROJECT: /\s#([\w\-_]+)(?=\s|$)/,
  DATE: /!([\w\-/\s]+?)(?=\s+[@#!^+]|\s*$)/,
  PRIORITY: /\^(high|med|medium|low|h|m|l)/i,
  TAG: /\+([\w\-_]+)/g
};

// ========================================
// Keyboard Keys
// ========================================

export const KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  DELETE: 'Delete',
  BACKSPACE: 'Backspace',
  QUESTION_MARK: '?',
  SLASH: '/'
};

// ========================================
// Priority Icons
// ========================================

export const PRIORITY_ICONS: Record<Priority, string> = {
  high: '🔴',
  medium: '🟡',
  low: '🟢'
};

// ========================================
// Group Icons
// ========================================

export const GROUP_ICONS: Record<GroupOption, string> = {
  none: '📌',
  dueDate: '📅',
  owner: '👤',
  project: '📁',
  stage: '📋',
  priority: '⚡'
};
