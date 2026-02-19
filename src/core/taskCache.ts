import { App, TFile } from 'obsidian';
import {
  Task,
  TaskConsolidatorSettings,
  CacheEntry,
  CacheStats,
  TaskStats,
  TaskFilterOptions,
  Priority
} from '../types';
import { STAGES } from '../types/constants';
import { parseTasksFromFile, buildTaskHierarchy } from './taskParser';
import { isOverdue, isDueToday, isDueThisWeek } from '../utils/dateUtils';
import { escapeRegex } from '../utils/textUtils';

// ========================================
// Task Cache Class
// ========================================

export class TaskCache {
  private app: App;
  private settings: TaskConsolidatorSettings;
  private cache: Map<string, CacheEntry> = new Map();
  private allTasks: Task[] = [];
  private isInitialized = false;

  private stats: CacheStats = {
    totalFiles: 0,
    cachedFiles: 0,
    totalTasks: 0,
    completedTasks: 0,
    incompleteTasks: 0,
    hits: 0,
    misses: 0,
    lastRefresh: 0
  };

  constructor(app: App, settings: TaskConsolidatorSettings) {
    this.app = app;
    this.settings = settings;
  }

  /**
   * Update settings reference
   */
  updateSettings(settings: TaskConsolidatorSettings): void {
    this.settings = settings;
  }

  /**
   * Initialize the cache by parsing all files
   */
  async initialize(): Promise<void> {
    await this.refreshAll();
    this.isInitialized = true;
  }

  /**
   * Check if cache is initialized
   */
  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get all cached tasks
   */
  getAllTasks(): Task[] {
    return this.allTasks;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    let completed = 0;
    let incomplete = 0;

    for (const task of this.allTasks) {
      if (task.completed) {
        completed++;
      } else {
        incomplete++;
      }
    }

    return {
      ...this.stats,
      completedTasks: completed,
      incompleteTasks: incomplete
    };
  }

  /**
   * Refresh tasks for a specific file
   */
  async refreshFile(file: TFile): Promise<void> {
    if (!this.shouldParseFile(file)) {
      this.cache.delete(file.path);
      this.rebuildAllTasks();
      return;
    }

    const entry: CacheEntry = {
      tasks: await parseTasksFromFile(this.app, file, this.settings),
      lastModified: file.stat.mtime
    };

    this.cache.set(file.path, entry);
    this.rebuildAllTasks();
    this.stats.cachedFiles = this.cache.size;
  }

  /**
   * Remove a file from the cache
   */
  removeFile(filePath: string): void {
    this.cache.delete(filePath);
    this.rebuildAllTasks();
    this.stats.cachedFiles = this.cache.size;
  }

  /**
   * Handle file rename
   */
  renameFile(oldPath: string, newPath: string): void {
    const entry = this.cache.get(oldPath);
    if (entry) {
      this.cache.delete(oldPath);
      this.cache.set(newPath, entry);
    }
  }

  /**
   * Refresh all files in the vault
   */
  async refreshAll(): Promise<void> {
    this.cache.clear();

    const files = this.app.vault.getMarkdownFiles();
    this.stats.totalFiles = files.length;

    for (const file of files) {
      if (!this.shouldParseFile(file)) {
        continue;
      }

      // Check if we can use cached version
      const cached = this.cache.get(file.path);
      if (cached && cached.lastModified === file.stat.mtime) {
        this.stats.hits++;
        continue;
      }

      this.stats.misses++;

      try {
        const entry: CacheEntry = {
          tasks: await parseTasksFromFile(this.app, file, this.settings),
          lastModified: file.stat.mtime
        };

        this.cache.set(file.path, entry);
      } catch (error) {
        console.error(`Task Consolidator: Error parsing file ${file.path}:`, error);
      }
    }

    this.rebuildAllTasks();
    this.stats.cachedFiles = this.cache.size;
    this.stats.lastRefresh = Date.now();
  }

  /**
   * Check if a file should be parsed
   */
  private shouldParseFile(file: TFile): boolean {
    if (!file.path.endsWith('.md')) {
      return false;
    }

    const folderPath = file.parent?.path ?? '';

    // Check excluded folders (normalize backslashes for Windows compatibility)
    for (const excluded of this.settings.excludedFolders) {
      const normalizedExcluded = excluded.replace(/\\/g, '/');
      if (folderPath === normalizedExcluded || folderPath.startsWith(`${normalizedExcluded}/`)) {
        return false;
      }
    }

    // Check excluded patterns (normalize backslashes for Windows compatibility)
    for (const pattern of this.settings.excludedPatterns) {
      const normalizedPattern = pattern.replace(/\\/g, '/');
      if (this.matchGlob(file.path, normalizedPattern)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Simple glob pattern matching
   */
  private matchGlob(path: string, pattern: string): boolean {
    const regex = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    return new RegExp(`^${regex}$`).test(path);
  }

  /**
   * Rebuild the allTasks array from cache
   */
  private rebuildAllTasks(): void {
    const tasks: Task[] = [];

    for (const entry of this.cache.values()) {
      tasks.push(...entry.tasks);
    }

    this.allTasks = buildTaskHierarchy(tasks);
    this.stats.totalTasks = this.allTasks.length;
  }

  /**
   * Get tasks for a specific file
   */
  getTasksForFile(filePath: string): Task[] {
    const entry = this.cache.get(filePath);
    return entry?.tasks ?? [];
  }

  /**
   * Get filtered tasks based on options
   */
  getFilteredTasks(options: TaskFilterOptions): Task[] {
    let tasks = [...this.allTasks];

    // Filter by completion status
    if (options.showCompleted === false) {
      tasks = tasks.filter(t => !t.completed);
    } else if (options.completed !== undefined) {
      tasks = tasks.filter(t => t.completed === options.completed);
    }

    // Filter by owner
    if (options.owner) {
      tasks = tasks.filter(t => t.owner === options.owner);
    }

    // Filter by project
    if (options.project) {
      tasks = tasks.filter(t => t.project === options.project);
    }

    // Filter by stage
    if (options.stage) {
      tasks = tasks.filter(t => t.stage === options.stage);
    }

    // Filter by priority
    if (options.priority) {
      tasks = tasks.filter(t => t.priority === options.priority);
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      tasks = tasks.filter(t => options.tags!.every(tag => t.tags.includes(tag)));
    }

    // Filter by file path
    if (options.filePath) {
      tasks = tasks.filter(t => t.file.path.includes(options.filePath!));
    }

    // Filter by search text
    const searchText = options.searchText || options.search;
    if (searchText) {
      const escaped = escapeRegex(searchText);
      const regex = new RegExp(escaped, 'i');
      tasks = tasks.filter(t =>
        regex.test(t.text) ||
        (t.owner && regex.test(t.owner)) ||
        (t.project && regex.test(t.project))
      );
    }

    // Filter by due date preset
    if (options.dueDateFilter) {
      switch (options.dueDateFilter) {
        case 'today':
          tasks = tasks.filter(t => isDueToday(t.dueDate));
          break;
        case 'thisWeek':
          tasks = tasks.filter(t => isDueThisWeek(t.dueDate, this.settings.firstDayOfWeek));
          break;
        case 'overdue':
          tasks = tasks.filter(t => isOverdue(t.dueDate));
          break;
        case 'noDueDate':
          tasks = tasks.filter(t => !t.dueDate);
          break;
      }
    }

    // Filter by due date range
    if (options.dueDateRange) {
      tasks = tasks.filter(t => {
        if (!t.dueDate) return false;
        return t.dueDate >= options.dueDateRange!.start &&
               t.dueDate <= options.dueDateRange!.end;
      });
    }

    // Filter by specific due date
    if (options.dueDate) {
      tasks = tasks.filter(t => t.dueDate === options.dueDate);
    }

    return tasks;
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
    this.allTasks = [];
    this.stats = {
      totalFiles: 0,
      cachedFiles: 0,
      totalTasks: 0,
      completedTasks: 0,
      incompleteTasks: 0,
      hits: 0,
      misses: 0,
      lastRefresh: 0
    };
    this.isInitialized = false;
  }

  /**
   * Get task statistics
   */
  getTaskStats(): TaskStats {
    const tasks = this.allTasks;
    const stats: TaskStats = {
      total: tasks.length,
      completed: 0,
      active: 0,
      overdue: 0,
      dueToday: 0,
      dueThisWeek: 0,
      byStage: {
        Requested: 0,
        Staged: 0,
        'In-Progress': 0,
        'In-Review': 0,
        Completed: 0,
        unassigned: 0
      },
      byOwner: {},
      byProject: {},
      byPriority: { high: 0, medium: 0, low: 0 }
    };

    for (const task of tasks) {
      if (task.completed) {
        stats.completed++;
      } else {
        stats.active++;

        if (isOverdue(task.dueDate)) {
          stats.overdue++;
        }
        if (isDueToday(task.dueDate)) {
          stats.dueToday++;
        }
        if (isDueThisWeek(task.dueDate, this.settings.firstDayOfWeek)) {
          stats.dueThisWeek++;
        }
      }

      // Count by stage
      if (task.stage && STAGES.includes(task.stage as any)) {
        stats.byStage[task.stage]++;
      } else {
        stats.byStage.unassigned++;
      }

      // Count by owner
      if (task.owner) {
        stats.byOwner[task.owner] = (stats.byOwner[task.owner] ?? 0) + 1;
      }

      // Count by project
      if (task.project) {
        stats.byProject[task.project] = (stats.byProject[task.project] ?? 0) + 1;
      }

      // Count by priority
      if (task.priority) {
        stats.byPriority[task.priority]++;
      }
    }

    return stats;
  }

  /**
   * Get unique owner values
   */
  getUniqueOwners(): string[] {
    const owners = new Set<string>();
    for (const task of this.allTasks) {
      if (task.owner) {
        owners.add(task.owner);
      }
    }
    return [...owners].sort();
  }

  /**
   * Get unique project values
   */
  getUniqueProjects(): string[] {
    const projects = new Set<string>();
    for (const task of this.allTasks) {
      if (task.project) {
        projects.add(task.project);
      }
    }
    return [...projects].sort();
  }

  /**
   * Get unique due dates
   */
  getUniqueDueDates(): string[] {
    const dates = new Set<string>();
    for (const task of this.allTasks) {
      if (task.dueDate) {
        dates.add(task.dueDate);
      }
    }
    return [...dates].sort();
  }

  /**
   * Get unique tags
   */
  getUniqueTags(): string[] {
    const tags = new Set<string>();
    for (const task of this.allTasks) {
      for (const tag of task.tags) {
        tags.add(tag);
      }
    }
    return [...tags].sort();
  }
}
