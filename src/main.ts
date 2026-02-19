import { Plugin, TFile, debounce, Notice, Editor, MarkdownView } from 'obsidian';
import { TaskConsolidatorSettings } from './types';
import { TASK_VIEW_TYPE } from './types/constants';
import { mergeSettings } from './settings/defaults';
import { TaskConsolidatorSettingTab } from './settings/settingsTab';
import { TaskCache } from './core/taskCache';
import { TaskUpdater } from './core/taskUpdater';
import { NotificationService } from './core/notificationService';
import { TaskPanelView } from './views/panelView';
import { KanbanModal } from './views/kanbanModal';
import { QuickAddModal } from './views/quickAddModal';
import { CalendarModal } from './views/calendarView';
import { ProjectDashboardModal } from './views/projectDashboard';
import { TaskAgentModal } from './views/taskAgentModal';
import { ensureDailyNoteExists, getToday, getTodaysDailyNotePath } from './utils';

// ========================================
// Task Consolidator Plugin
// ========================================

export default class TaskConsolidatorPlugin extends Plugin {
  settings!: TaskConsolidatorSettings;
  taskCache!: TaskCache;
  taskUpdater!: TaskUpdater;
  notificationService!: NotificationService;

  private fileWatcherRegistered = false;
  private notificationCheckInterval: number | null = null;
  private debouncedRefresh = debounce(
    async () => {
      await this.refreshTasks();
      await this.refreshView();
    },
    300,
    true
  );

  async onload(): Promise<void> {
    // Load settings
    await this.loadSettings();

    // Initialize core services
    this.taskCache = new TaskCache(this.app, this.settings);
    this.taskUpdater = new TaskUpdater(this.app, this.settings);
    this.notificationService = new NotificationService(this.app, this.settings);

    // Register view
    this.registerView(TASK_VIEW_TYPE, (leaf) => new TaskPanelView(leaf, this));

    // Add ribbon icon
    this.addRibbonIcon('list-checks', 'Task Consolidator', () => {
      this.activateView();
    });

    // Add commands
    this.addCommand({
      id: 'open-task-consolidator',
      name: 'Open Task Consolidator',
      callback: () => {
        this.activateView();
      }
    });

    this.addCommand({
      id: 'open-kanban-board',
      name: 'Open Kanban Board',
      callback: () => {
        this.openKanban();
      }
    });

    this.addCommand({
      id: 'quick-add-task',
      name: 'Quick Add Task',
      callback: () => {
        this.openQuickAdd();
      }
    });

    this.addCommand({
      id: 'refresh-tasks',
      name: 'Refresh All Tasks',
      callback: () => {
        this.refreshTasks();
      }
    });

    this.addCommand({
      id: 'open-calendar',
      name: 'Open Calendar View',
      callback: () => {
        this.openCalendar();
      }
    });

    this.addCommand({
      id: 'open-daily-note',
      name: 'Open Today\'s Daily Note',
      callback: () => {
        this.openDailyNote();
      }
    });

    this.addCommand({
      id: 'add-task-to-daily-note',
      name: 'Add Task to Today\'s Daily Note',
      callback: () => {
        this.addTaskToDailyNote();
      }
    });

    this.addCommand({
      id: 'show-task-summary',
      name: 'Show Task Summary',
      callback: () => {
        this.showTaskSummary();
      }
    });

    this.addCommand({
      id: 'open-project-dashboard',
      name: 'Open Project Dashboard',
      callback: () => {
        this.openProjectDashboard();
      }
    });

    this.addCommand({
      id: 'open-task-agent',
      name: 'Open Task Agent (Edit/Create at Cursor)',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        new TaskAgentModal(this.app, this, editor, view).open();
      }
    });

    // Add settings tab
    this.addSettingTab(new TaskConsolidatorSettingTab(this.app, this));

    // Initialize task cache
    await this.taskCache.initialize();

    // Setup file watchers
    this.setupFileWatchers();

    // Setup notifications
    this.setupNotifications();

    // Debug logging
    if (this.settings.debugMode) {
      console.log('Task Consolidator loaded');
      console.log('Cache stats:', this.taskCache.getCacheStats());
    }
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(TASK_VIEW_TYPE);
    this.taskCache.clear();
    this.notificationService.destroy();

    if (this.notificationCheckInterval) {
      window.clearInterval(this.notificationCheckInterval);
      this.notificationCheckInterval = null;
    }

    if (this.settings.debugMode) {
      console.log('Task Consolidator unloaded');
    }
  }

  async loadSettings(): Promise<void> {
    const loaded = await this.loadData();
    this.settings = mergeSettings(loaded ?? {});
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.taskCache.updateSettings(this.settings);
    this.taskUpdater.updateSettings(this.settings);
    this.notificationService.updateSettings(this.settings);

    // Recreate debounced refresh with new debounce time
    this.debouncedRefresh = debounce(
      async () => {
        await this.refreshTasks();
        await this.refreshView();
      },
      this.settings.refreshDebounceMs,
      true
    );

    // Restart notification check interval
    this.setupNotifications();
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(TASK_VIEW_TYPE)[0];

    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({ type: TASK_VIEW_TYPE, active: true });
        leaf = rightLeaf;
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  openKanban(): void {
    new KanbanModal(this.app, this).open();
  }

  openQuickAdd(): void {
    new QuickAddModal(this.app, this).open();
  }

  openCalendar(): void {
    new CalendarModal(this.app, this).open();
  }

  openProjectDashboard(): void {
    new ProjectDashboardModal(this.app, this).open();
  }

  async openDailyNote(): Promise<void> {
    if (!this.settings.enableDailyNoteIntegration) {
      new Notice('Daily note integration is disabled. Enable it in settings.');
      return;
    }

    try {
      const file = await ensureDailyNoteExists(this.app, getToday(), this.settings);
      const leaf = this.app.workspace.getLeaf();
      await leaf.openFile(file);
    } catch (error) {
      new Notice('Failed to open daily note: ' + (error as Error).message);
    }
  }

  async addTaskToDailyNote(): Promise<void> {
    if (!this.settings.enableDailyNoteIntegration) {
      new Notice('Daily note integration is disabled. Enable it in settings.');
      return;
    }

    // Open quick add modal with daily note as target
    new QuickAddModal(this.app, this, {
      targetDailyNote: true
    }).open();
  }

  async refreshTasks(): Promise<void> {
    await this.taskCache.refreshAll();

    if (this.settings.debugMode) {
      console.log('Tasks refreshed:', this.taskCache.getCacheStats());
    }
  }

  async refreshView(): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(TASK_VIEW_TYPE);

    for (const leaf of leaves) {
      const view = leaf.view;
      if (view instanceof TaskPanelView) {
        await view.refresh();
      }
    }
  }

  private setupFileWatchers(): void {
    if (this.fileWatcherRegistered || !this.settings.autoRefresh) {
      return;
    }

    // Watch for file modifications
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file instanceof TFile && file.extension === 'md') {
          this.taskCache.refreshFile(file);
          this.debouncedRefresh();
        }
      })
    );

    // Watch for new files
    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if (file instanceof TFile && file.extension === 'md') {
          this.taskCache.refreshFile(file);
          this.debouncedRefresh();
        }
      })
    );

    // Watch for deleted files
    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        if (file instanceof TFile && file.extension === 'md') {
          this.taskCache.removeFile(file.path);
          this.debouncedRefresh();
        }
      })
    );

    // Watch for renamed files
    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        if (file instanceof TFile && file.extension === 'md') {
          this.taskCache.renameFile(oldPath, file.path);
          this.debouncedRefresh();
        }
      })
    );

    this.fileWatcherRegistered = true;

    if (this.settings.debugMode) {
      console.log('File watchers registered');
    }
  }

  private setupNotifications(): void {
    // Clear existing interval
    if (this.notificationCheckInterval) {
      window.clearInterval(this.notificationCheckInterval);
      this.notificationCheckInterval = null;
    }

    if (!this.settings.enableNotifications) return;

    // Show startup notification (delayed to ensure cache is loaded)
    if (this.settings.notifyOnStartup) {
      setTimeout(() => {
        const allTasks = this.taskCache.getFilteredTasks({});
        const summary = this.notificationService.getNotificationSummary(allTasks);
        this.notificationService.showStartupNotification(summary);
      }, 2000);
    }

    // Setup periodic check
    if (this.settings.reminderCheckIntervalMinutes > 0) {
      const intervalMs = this.settings.reminderCheckIntervalMinutes * 60 * 1000;

      this.notificationCheckInterval = window.setInterval(() => {
        const allTasks = this.taskCache.getFilteredTasks({});
        this.notificationService.checkAndNotify(allTasks);
      }, intervalMs);

      if (this.settings.debugMode) {
        console.log(`Notification check interval set: ${this.settings.reminderCheckIntervalMinutes} minutes`);
      }
    }
  }

  showTaskSummary(): void {
    const allTasks = this.taskCache.getFilteredTasks({});
    const summary = this.notificationService.getNotificationSummary(allTasks);
    const text = this.notificationService.formatSummaryText(summary);

    if (text) {
      new Notice(text, 8000);
    } else {
      new Notice('No tasks with due dates found.', 4000);
    }
  }
}
