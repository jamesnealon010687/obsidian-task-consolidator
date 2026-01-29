import { TFile } from 'obsidian';

// ========================================
// Stage and Priority Types
// ========================================

export type Stage = 'Requested' | 'Staged' | 'In-Progress' | 'In-Review' | 'Completed';
export type Priority = 'high' | 'medium' | 'low';
export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
export type SortOption = 'dueDate' | 'owner' | 'priority' | 'project' | 'created' | 'stage';
export type GroupOption = 'none' | 'dueDate' | 'owner' | 'project' | 'stage' | 'priority';
export type DateFormat = 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD-MM-YYYY' | 'locale';
export type FilePathDisplay = 'full' | 'filename' | 'hidden';
export type ViewType = 'panel' | 'kanban' | 'calendar';
export type ParentCompletionBehavior = 'manual' | 'auto' | 'cascade';

// ========================================
// Recurrence Interface
// ========================================

export interface Recurrence {
  type: RecurrenceType;
  interval?: number;
  daysOfWeek?: number[];
  endDate?: string;
  rawString: string;
}

// ========================================
// Task Interface
// ========================================

export interface Task {
  id: string;
  file: TFile;
  lineNumber: number;
  text: string;
  completed: boolean;
  dueDate: string | null;
  owner: string | null;
  stage: Stage | string | null;
  project: string | null;
  completedDate: string | null;
  createdDate: string | null;
  rawLine: string;
  priority: Priority | null;
  tags: string[];
  recurrence: Recurrence | null;
  parentId: string | null;
  children: Task[];
  depth: number;
  indent: string;
}

// ========================================
// Plugin Settings Interface
// ========================================

export interface TaskConsolidatorSettings {
  // Display settings
  sortBy: SortOption;
  groupBy: GroupOption;
  showCompleted: boolean;
  completedTasksLimit: number;
  dateFormat: DateFormat;
  firstDayOfWeek: number;
  defaultView: ViewType;

  // Task detection settings
  requireMetadataFormat: boolean;
  metadataDelimiter: string;
  customStages: string[];
  excludedFolders: string[];
  excludedPatterns: string[];

  // Behavior settings
  autoRefresh: boolean;
  refreshDebounceMs: number;
  parentCompletionBehavior: ParentCompletionBehavior;
  confirmDestructiveActions: boolean;

  // Recurring task settings
  recurringAutoCreate: boolean;
  recurringCreateDaysBefore: number;

  // Appearance settings
  compactMode: boolean;
  showFilePath: FilePathDisplay;
  taskCountInRibbon: boolean;
  showOverdueIndicator: boolean;
  showDueTodayIndicator: boolean;

  // Quick add settings
  defaultTargetFile: string;
  quickAddHotkey: string;
  defaultOwner: string;
  defaultProject: string;

  // Filter state (persisted)
  filterOwner: string;
  filterDueDate: string;
  filterProject: string;
  filterPriority: string;
  filterStage: string;
  filterTags: string[];
  searchQuery: string;
  collapsedGroups: Record<string, boolean>;
  kanbanFilterProject: string;

  // Advanced settings
  debugMode: boolean;
  maxTasksToRender: number;
  enableVirtualScrolling: boolean;
  enableTaskCache: boolean;
}

// ========================================
// Kanban Column Interface
// ========================================

export interface KanbanColumn {
  id: string;
  title: string;
  stage: Stage | null;
}

// ========================================
// Task Filter Options
// ========================================

export interface TaskFilterOptions {
  showCompleted?: boolean;
  completed?: boolean;
  owner?: string;
  project?: string;
  stage?: string;
  priority?: Priority;
  tags?: string[];
  filePath?: string;
  searchText?: string;
  search?: string;
  dueDateFilter?: 'today' | 'thisWeek' | 'overdue' | 'noDueDate';
  dueDateRange?: { start: string; end: string };
  dueDate?: string;
}

// ========================================
// Task Update Result
// ========================================

export interface TaskUpdateResult {
  success: boolean;
  error?: string;
  task?: Task;
}

// ========================================
// Bulk Operation Result
// ========================================

export interface BulkOperationResult {
  successful: number;
  failed: number;
  errors: string[];
}

// ========================================
// Cache Entry
// ========================================

export interface CacheEntry {
  tasks: Task[];
  lastModified: number;
}

// ========================================
// Cache Stats
// ========================================

export interface CacheStats {
  totalFiles: number;
  cachedFiles: number;
  totalTasks: number;
  completedTasks: number;
  incompleteTasks: number;
  hits: number;
  misses: number;
  lastRefresh: number;
}

// ========================================
// Task Stats
// ========================================

export interface TaskStats {
  total: number;
  completed: number;
  active: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  byStage: Record<string, number>;
  byOwner: Record<string, number>;
  byProject: Record<string, number>;
  byPriority: Record<Priority, number>;
}

// ========================================
// Undo Entry
// ========================================

export interface UndoEntry {
  filePath: string;
  lineNumber: number;
  originalLine: string;
  newLine: string;
  timestamp: number;
}

// ========================================
// Validation Result
// ========================================

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedValue?: string;
}

// ========================================
// Task Metadata (parsed from inline content)
// ========================================

export interface ParsedMetadata {
  owner: string | null;
  dueDate: string | null;
  stage: string | null;
  project: string | null;
  priority: Priority | null;
  tags: string[];
  recurrence: Recurrence | null;
  completedDate: string | null;
  createdDate: string | null;
}

// ========================================
// Task Create Options
// ========================================

export interface TaskCreateOptions {
  owner?: string;
  dueDate?: string;
  project?: string;
  stage?: string;
  priority?: Priority;
  tags?: string[];
  atLine?: number;
}

// ========================================
// Keyboard Shortcut
// ========================================

export interface KeyboardShortcut {
  shortcut: string;
  description: string;
}
