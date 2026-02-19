import { TaskConsolidatorSettings } from '../types';

// ========================================
// Default Settings
// ========================================

export const DEFAULT_SETTINGS: TaskConsolidatorSettings = {
  // Display settings
  sortBy: 'dueDate',
  groupBy: 'dueDate',
  showCompleted: true,
  completedTasksLimit: 0,
  dateFormat: 'YYYY-MM-DD',
  firstDayOfWeek: 0,
  defaultView: 'panel',

  // Task detection settings
  requireMetadataFormat: false,
  metadataDelimiter: '|',
  customStages: [],
  excludedFolders: [],
  excludedPatterns: [],

  // Behavior settings
  autoRefresh: true,
  refreshDebounceMs: 300,
  parentCompletionBehavior: 'manual',
  confirmDestructiveActions: true,

  // Recurring task settings
  recurringAutoCreate: true,
  recurringCreateDaysBefore: 1,

  // Appearance settings
  compactMode: false,
  showFilePath: 'filename',
  taskCountInRibbon: false,
  showOverdueIndicator: true,
  showDueTodayIndicator: true,

  // Quick add settings
  defaultTargetFile: '',
  quickAddHotkey: 'Ctrl+Shift+T',
  defaultOwner: '',
  defaultProject: '',

  // Filter state (persisted)
  filterOwner: '',
  filterDueDate: '',
  filterProject: '',
  filterPriority: '',
  filterStage: '',
  filterTags: [],
  searchQuery: '',
  collapsedGroups: {},
  kanbanFilterProject: '',

  // Advanced settings
  debugMode: false,
  maxTasksToRender: 0,
  enableVirtualScrolling: true,
  enableTaskCache: true,

  // Daily Note Integration
  enableDailyNoteIntegration: true,
  dailyNoteFolder: '',
  dailyNoteDateFormat: 'YYYY-MM-DD',
  dailyNoteTasksHeading: '## Tasks',
  autoLinkTasksToDailyNote: false,
  showDailyNoteButton: true,

  // Notifications and Reminders
  enableNotifications: true,
  notifyOnStartup: true,
  notifyOverdueTasks: true,
  notifyDueToday: true,
  notifyUpcoming: true,
  upcomingDays: 3,
  reminderCheckIntervalMinutes: 30,
  showNotificationBadge: true,
  lastNotificationCheck: 0
};

// ========================================
// Merge Settings with Defaults
// ========================================

export function mergeSettings(loaded: Partial<TaskConsolidatorSettings>): TaskConsolidatorSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...loaded,
    customStages: loaded.customStages ?? DEFAULT_SETTINGS.customStages,
    excludedFolders: loaded.excludedFolders ?? DEFAULT_SETTINGS.excludedFolders,
    excludedPatterns: loaded.excludedPatterns ?? DEFAULT_SETTINGS.excludedPatterns,
    filterTags: loaded.filterTags ?? DEFAULT_SETTINGS.filterTags,
    collapsedGroups: loaded.collapsedGroups ?? DEFAULT_SETTINGS.collapsedGroups
  };
}
