import { Plugin, TFile, debounce } from 'obsidian';
import { TaskConsolidatorSettings } from './types';
import { TASK_VIEW_TYPE } from './types/constants';
import { mergeSettings } from './settings/defaults';
import { TaskConsolidatorSettingTab } from './settings/settingsTab';
import { TaskCache } from './core/taskCache';
import { TaskUpdater } from './core/taskUpdater';
import { TaskPanelView } from './views/panelView';
import { KanbanModal } from './views/kanbanModal';
import { QuickAddModal } from './views/quickAddModal';

// ========================================
// Task Consolidator Plugin
// ========================================

export default class TaskConsolidatorPlugin extends Plugin {
  settings!: TaskConsolidatorSettings;
  taskCache!: TaskCache;
  taskUpdater!: TaskUpdater;

  private fileWatcherRegistered = false;
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

    // Register view
    this.registerView(TASK_VIEW_TYPE, (leaf) => new TaskPanelView(leaf, this));

    // Add ribbon icon
    this.addRibbonIcon('checkmark', 'Task Consolidator', () => {
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

    // Add settings tab
    this.addSettingTab(new TaskConsolidatorSettingTab(this.app, this));

    // Initialize task cache
    await this.taskCache.initialize();

    // Setup file watchers
    this.setupFileWatchers();

    // Debug logging
    if (this.settings.debugMode) {
      console.log('Task Consolidator loaded');
      console.log('Cache stats:', this.taskCache.getCacheStats());
    }
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(TASK_VIEW_TYPE);
    this.taskCache.clear();

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

    // Recreate debounced refresh with new debounce time
    this.debouncedRefresh = debounce(
      async () => {
        await this.refreshTasks();
        await this.refreshView();
      },
      this.settings.refreshDebounceMs,
      true
    );
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
}
