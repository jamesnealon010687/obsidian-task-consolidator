import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import type TaskConsolidatorPlugin from '../main';
import { TaskCache } from '../core/taskCache';
import { TaskUpdater } from '../core/taskUpdater';
import { Task, SortOption, GroupOption, Priority } from '../types';
import { TASK_VIEW_TYPE, SORT_OPTIONS, GROUP_OPTIONS, STAGES, KEYS, PRIORITY_ICONS, GROUP_ICONS } from '../types/constants';
import { isOverdue, isDueToday, getRelativeDateString } from '../utils/dateUtils';
import { compareNullableStrings } from '../utils/textUtils';
import { formatLabel } from '../utils/textUtils';
import { getSubtaskProgress } from '../utils/textUtils';
import { getDependencyStatus, createShortTaskId, buildShortIdMap } from '../utils/dependencyUtils';
import { openTaskInEditor } from '../utils/editorUtils';
import { parseSearchQuery } from '../utils/searchParser';
import { KeyboardNavigationHandler, announceToScreenReader } from './keyboardNav';
import { KeyboardHelpModal } from './keyboardHelpModal';
import { ExportModal } from './exportModal';
import { CommentModal } from './commentModal';

// ========================================
// Panel View
// ========================================

export class TaskPanelView extends ItemView {
  private plugin: TaskConsolidatorPlugin;
  private taskCache: TaskCache;
  private taskUpdater: TaskUpdater;

  private filteredTasks: Task[] = [];
  private selectedTasks: Set<string> = new Set();
  private keyboardHandler: KeyboardNavigationHandler | null = null;
  private taskListContainer: HTMLElement | null = null;
  private taskSectionContainer: HTMLElement | null = null;
  private liveRegion: HTMLElement | null = null;
  private headerRendered = false;

  constructor(leaf: WorkspaceLeaf, plugin: TaskConsolidatorPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.taskCache = plugin.taskCache;
    this.taskUpdater = plugin.taskUpdater;
  }

  getViewType(): string {
    return TASK_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Task Consolidator';
  }

  getIcon(): string {
    return 'list-checks';
  }

  async onOpen(): Promise<void> {
    this.containerEl.empty();
    this.containerEl.addClass('task-consolidator-view');

    // Create live region for screen reader announcements
    this.liveRegion = this.containerEl.createDiv({
      cls: 'sr-only',
      attr: {
        role: 'status',
        'aria-live': 'polite',
        'aria-atomic': 'true'
      }
    });

    this.setupGlobalKeyboardShortcuts();
    await this.render();
  }

  async onClose(): Promise<void> {
    this.selectedTasks.clear();
    if (this.keyboardHandler) {
      this.keyboardHandler.destroy();
      this.keyboardHandler = null;
    }
  }

  private setupGlobalKeyboardShortcuts(): void {
    this.containerEl.addEventListener('keydown', (e) => {
      // Focus search with /
      if (e.key === KEYS.SLASH && !this.isInputFocused()) {
        e.preventDefault();
        const searchInput = this.containerEl.querySelector('.task-search-input') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          this.announce('Search focused');
        }
      }

      // Show keyboard help with ?
      if (e.key === KEYS.QUESTION_MARK && e.shiftKey && !this.isInputFocused()) {
        e.preventDefault();
        this.showKeyboardHelp();
      }

      // Escape to blur inputs
      if (e.key === KEYS.ESCAPE) {
        const active = document.activeElement;
        if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
          active.blur();
          this.taskListContainer?.focus();
        }
      }
    });
  }

  private isInputFocused(): boolean {
    const active = document.activeElement;
    return active instanceof HTMLInputElement ||
           active instanceof HTMLTextAreaElement ||
           active instanceof HTMLSelectElement;
  }

  private announce(message: string): void {
    if (this.liveRegion) {
      this.liveRegion.textContent = message;
      setTimeout(() => {
        if (this.liveRegion) this.liveRegion.textContent = '';
      }, 1000);
    }
    announceToScreenReader(message);
  }

  private showKeyboardHelp(): void {
    new KeyboardHelpModal(this.app).open();
  }

  async refresh(): Promise<void> {
    if (!this.headerRendered) {
      await this.render();
      return;
    }
    // Partial re-render: only rebuild task sections
    const scrollTop = this.taskSectionContainer?.scrollTop ?? 0;
    this.applyFilters();
    if (this.taskSectionContainer) {
      this.taskSectionContainer.empty();
      this.renderTaskSectionsInto(this.taskSectionContainer);
      this.taskSectionContainer.scrollTop = scrollTop;
    }
  }

  private async render(): Promise<void> {
    this.containerEl.empty();
    this.headerRendered = false;

    this.renderHeader();
    this.renderControls();
    this.renderFilters();

    // Create a dedicated container for task sections
    this.taskSectionContainer = this.containerEl.createDiv({ cls: 'task-sections-container' });

    this.applyFilters();
    this.renderTaskSectionsInto(this.taskSectionContainer);
    this.headerRendered = true;
  }

  private renderHeader(): void {
    const header = this.containerEl.createDiv({ cls: 'task-consolidator-header' });
    const titleRow = header.createDiv({ cls: 'task-header-title-row' });

    titleRow.createEl('h4', { text: 'All Tasks' });

    const stats = this.taskCache.getTaskStats();
    titleRow.createSpan({ cls: 'task-header-stats' })
      .setText(`${stats.active} active, ${stats.completed} completed`);

    if (stats.overdue > 0) {
      titleRow.createSpan({ cls: 'task-header-overdue' })
        .setText(`${stats.overdue} overdue`);
    }
  }

  private renderControls(): void {
    const controls = this.containerEl.createDiv({ cls: 'task-consolidator-controls' });

    // Sort dropdown
    controls.createSpan({ text: 'Sort: ' });
    const sortSelect = controls.createEl('select', { cls: 'dropdown' });

    for (const option of SORT_OPTIONS) {
      const optEl = sortSelect.createEl('option', {
        text: formatLabel(option),
        value: option
      });
      if (option === this.plugin.settings.sortBy) {
        optEl.selected = true;
      }
    }

    sortSelect.addEventListener('change', async () => {
      this.plugin.settings.sortBy = sortSelect.value as SortOption;
      await this.plugin.saveSettings();
      await this.refresh();
    });

    // Group dropdown
    controls.createSpan({ text: 'Group: ' });
    const groupSelect = controls.createEl('select', { cls: 'dropdown' });

    for (const option of GROUP_OPTIONS) {
      const optEl = groupSelect.createEl('option', {
        text: formatLabel(option),
        value: option
      });
      if (option === this.plugin.settings.groupBy) {
        optEl.selected = true;
      }
    }

    groupSelect.addEventListener('change', async () => {
      this.plugin.settings.groupBy = groupSelect.value as GroupOption;
      await this.plugin.saveSettings();
      await this.refresh();
    });

    // Refresh button
    controls.createEl('button', {
      text: '↻ Refresh',
      attr: { 'aria-label': 'Refresh tasks' }
    }).addEventListener('click', async () => {
      await this.plugin.refreshTasks();
      await this.refresh();
      new Notice('Tasks refreshed');
    });

    // Add task button
    controls.createEl('button', {
      text: '+ Add Task',
      cls: 'task-add-btn',
      attr: { 'aria-label': 'Add new task' }
    }).addEventListener('click', () => {
      this.plugin.openQuickAdd();
    });

    // Kanban button
    controls.createEl('button', {
      text: 'Kanban',
      cls: 'kanban-btn',
      attr: { 'aria-label': 'Open Kanban board' }
    }).addEventListener('click', () => {
      this.plugin.openKanban();
    });

    // Calendar button
    controls.createEl('button', {
      text: 'Calendar',
      cls: 'calendar-btn',
      attr: { 'aria-label': 'Open Calendar view' }
    }).addEventListener('click', () => {
      this.plugin.openCalendar();
    });

    // Daily Note button (conditional)
    if (this.plugin.settings.enableDailyNoteIntegration && this.plugin.settings.showDailyNoteButton) {
      controls.createEl('button', {
        text: 'Daily Note',
        cls: 'daily-note-btn',
        attr: { 'aria-label': 'Open today\'s daily note' }
      }).addEventListener('click', () => {
        this.plugin.openDailyNote();
      });
    }

    // Dashboard button
    controls.createEl('button', {
      text: 'Dashboard',
      cls: 'dashboard-btn',
      attr: { 'aria-label': 'Open Project Dashboard' }
    }).addEventListener('click', () => {
      this.plugin.openProjectDashboard();
    });

    // Export button (Feature 8)
    controls.createEl('button', {
      text: 'Export',
      cls: 'export-btn',
      attr: { 'aria-label': 'Export tasks' }
    }).addEventListener('click', () => {
      new ExportModal(this.app, this.plugin).open();
    });

    // Help button
    controls.createEl('button', {
      text: '?',
      cls: 'task-help-btn',
      attr: { 'aria-label': 'Show keyboard shortcuts' }
    }).addEventListener('click', () => {
      this.showKeyboardHelp();
    });

    // Workspace selector (Feature 6)
    if (this.plugin.settings.workspaces.length > 0) {
      const wsContainer = controls.createDiv({ cls: 'workspace-selector' });
      wsContainer.createSpan({ text: 'View: ' });
      const wsSelect = wsContainer.createEl('select', { cls: 'dropdown' });
      wsSelect.createEl('option', { text: 'Default', value: '' });
      for (const ws of this.plugin.settings.workspaces) {
        const opt = wsSelect.createEl('option', { text: ws.name, value: ws.id });
        if (ws.id === this.plugin.settings.activeWorkspaceId) opt.selected = true;
      }
      wsSelect.addEventListener('change', async () => {
        const wsId = wsSelect.value;
        this.plugin.settings.activeWorkspaceId = wsId;
        if (wsId) {
          const ws = this.plugin.settings.workspaces.find(w => w.id === wsId);
          if (ws) {
            this.plugin.settings.sortBy = ws.sortBy;
            this.plugin.settings.groupBy = ws.groupBy;
            this.plugin.settings.showCompleted = ws.showCompleted;
            this.plugin.settings.filterOwner = ws.filterOwner;
            this.plugin.settings.filterProject = ws.filterProject;
            this.plugin.settings.filterStage = ws.filterStage;
            this.plugin.settings.filterPriority = ws.filterPriority;
            this.plugin.settings.filterDueDate = ws.filterDueDate;
            this.plugin.settings.filterTags = ws.filterTags;
            this.plugin.settings.searchQuery = ws.searchQuery;
          }
        }
        await this.plugin.saveSettings();
        await this.render();
      });
    }
  }

  private renderFilters(): void {
    const filters = this.containerEl.createDiv({ cls: 'task-consolidator-filters' });

    // Search input
    const searchContainer = filters.createDiv({ cls: 'task-search-container' });
    const searchInput = searchContainer.createEl('input', {
      type: 'text',
      placeholder: 'Search tasks...',
      cls: 'task-search-input',
      value: this.plugin.settings.searchQuery
    });

    searchInput.addEventListener('input', async () => {
      this.plugin.settings.searchQuery = searchInput.value;
      await this.plugin.saveSettings();
      await this.refresh();
    });

    // Save filter button (Feature 3)
    if (this.plugin.settings.searchQuery) {
      searchContainer.createEl('button', {
        text: '💾',
        cls: 'save-filter-btn',
        attr: { 'aria-label': 'Save current search as filter' }
      }).addEventListener('click', async () => {
        const name = this.plugin.settings.searchQuery.substring(0, 30);
        const id = Date.now().toString(36);
        this.plugin.settings.savedFilters.push({ id, name, query: this.plugin.settings.searchQuery });
        await this.plugin.saveSettings();
        await this.render();
        new Notice('Filter saved');
      });
    }

    // Saved filter chips (Feature 3)
    if (this.plugin.settings.savedFilters.length > 0) {
      const savedChips = filters.createDiv({ cls: 'saved-filter-chips' });
      for (const sf of this.plugin.settings.savedFilters) {
        const chip = savedChips.createEl('button', {
          text: sf.name,
          cls: `saved-filter-chip ${sf.query === this.plugin.settings.searchQuery ? 'active' : ''}`,
          attr: { 'aria-label': `Apply filter: ${sf.name}` }
        });
        chip.addEventListener('click', async () => {
          this.plugin.settings.searchQuery = sf.query;
          await this.plugin.saveSettings();
          await this.render();
        });
        // Delete button on chip
        const del = chip.createSpan({ text: ' ×', cls: 'saved-filter-delete' });
        del.addEventListener('click', async (e) => {
          e.stopPropagation();
          this.plugin.settings.savedFilters = this.plugin.settings.savedFilters.filter(f => f.id !== sf.id);
          await this.plugin.saveSettings();
          await this.render();
        });
      }
    }

    // Owner filter
    filters.createSpan({ text: 'Owner: ' });
    const ownerSelect = filters.createEl('select', { cls: 'dropdown' });
    ownerSelect.createEl('option', { text: 'All', value: '' });

    for (const owner of this.taskCache.getUniqueOwners()) {
      const opt = ownerSelect.createEl('option', { text: owner, value: owner });
      if (owner === this.plugin.settings.filterOwner) opt.selected = true;
    }

    ownerSelect.addEventListener('change', async () => {
      this.plugin.settings.filterOwner = ownerSelect.value;
      await this.plugin.saveSettings();
      await this.refresh();
    });

    // Project filter
    filters.createSpan({ text: 'Project: ' });
    const projectSelect = filters.createEl('select', { cls: 'dropdown' });
    projectSelect.createEl('option', { text: 'All', value: '' });

    for (const project of this.taskCache.getUniqueProjects()) {
      const opt = projectSelect.createEl('option', { text: project, value: project });
      if (project === this.plugin.settings.filterProject) opt.selected = true;
    }

    projectSelect.addEventListener('change', async () => {
      this.plugin.settings.filterProject = projectSelect.value;
      await this.plugin.saveSettings();
      await this.refresh();
    });

    // Stage filter
    filters.createSpan({ text: 'Stage: ' });
    const stageSelect = filters.createEl('select', { cls: 'dropdown' });
    stageSelect.createEl('option', { text: 'All', value: '' });

    for (const stage of STAGES) {
      const opt = stageSelect.createEl('option', { text: stage, value: stage });
      if (stage === this.plugin.settings.filterStage) opt.selected = true;
    }

    stageSelect.addEventListener('change', async () => {
      this.plugin.settings.filterStage = stageSelect.value;
      await this.plugin.saveSettings();
      await this.refresh();
    });

    // Quick filters
    const quickFilters = this.containerEl.createDiv({ cls: 'task-quick-filters' });

    const stats = this.taskCache.getTaskStats();

    quickFilters.createEl('button', {
      text: `Today (${stats.dueToday})`,
      cls: 'quick-filter-btn'
    }).addEventListener('click', async () => {
      this.plugin.settings.filterDueDate = 'today';
      await this.plugin.saveSettings();
      await this.refresh();
    });

    quickFilters.createEl('button', {
      text: `Overdue (${stats.overdue})`,
      cls: 'quick-filter-btn overdue'
    }).addEventListener('click', async () => {
      this.plugin.settings.filterDueDate = 'overdue';
      await this.plugin.saveSettings();
      await this.refresh();
    });

    quickFilters.createEl('button', {
      text: 'Clear Filters',
      cls: 'quick-filter-btn clear'
    }).addEventListener('click', async () => {
      this.plugin.settings.filterOwner = '';
      this.plugin.settings.filterProject = '';
      this.plugin.settings.filterStage = '';
      this.plugin.settings.filterDueDate = '';
      this.plugin.settings.searchQuery = '';
      await this.plugin.saveSettings();
      await this.refresh();
    });
  }

  private applyFilters(): void {
    let tasks = this.taskCache.getAllTasks();
    const settings = this.plugin.settings;

    // Advanced search with operator support
    if (settings.searchQuery) {
      const parsed = parseSearchQuery(settings.searchQuery);
      if (parsed) {
        // Apply parsed operator filters
        if (parsed.owner) tasks = tasks.filter(t => t.owner?.toLowerCase() === parsed.owner!.toLowerCase());
        if (parsed.project) tasks = tasks.filter(t => t.project?.toLowerCase() === parsed.project!.toLowerCase());
        if (parsed.stage) tasks = tasks.filter(t => t.stage?.toLowerCase() === parsed.stage!.toLowerCase());
        if (parsed.priority) tasks = tasks.filter(t => t.priority === parsed.priority);
        if (parsed.tags && parsed.tags.length > 0) {
          tasks = tasks.filter(t => parsed.tags!.every(tag => t.tags.includes(tag)));
        }
        if (parsed.filePath) {
          const fp = parsed.filePath.toLowerCase();
          tasks = tasks.filter(t => t.file.path.toLowerCase().includes(fp));
        }
        if (parsed.dueDateFilter === 'today') tasks = tasks.filter(t => isDueToday(t.dueDate));
        else if (parsed.dueDateFilter === 'thisWeek') tasks = tasks.filter(t => t.dueDate != null);
        else if (parsed.dueDateFilter === 'overdue') tasks = tasks.filter(t => isOverdue(t.dueDate) && !t.completed);
        else if (parsed.dueDateFilter === 'noDueDate') tasks = tasks.filter(t => !t.dueDate);
        if (parsed.dueDate) tasks = tasks.filter(t => t.dueDate === parsed.dueDate);
        // Free text search
        if (parsed.searchText) {
          const query = parsed.searchText.toLowerCase();
          tasks = tasks.filter(t =>
            t.text.toLowerCase().includes(query) ||
            t.owner?.toLowerCase().includes(query) ||
            t.project?.toLowerCase().includes(query) ||
            t.tags.some(tag => tag.toLowerCase().includes(query))
          );
        }
      }
    }

    // Dropdown filters (applied on top of search)
    if (settings.filterOwner) {
      tasks = tasks.filter(t => t.owner === settings.filterOwner);
    }
    if (settings.filterProject) {
      tasks = tasks.filter(t => t.project === settings.filterProject);
    }
    if (settings.filterStage) {
      tasks = tasks.filter(t => t.stage === settings.filterStage);
    }
    if (settings.filterDueDate === 'today') {
      tasks = tasks.filter(t => isDueToday(t.dueDate));
    } else if (settings.filterDueDate === 'overdue') {
      tasks = tasks.filter(t => isOverdue(t.dueDate) && !t.completed);
    } else if (settings.filterDueDate) {
      tasks = tasks.filter(t => t.dueDate === settings.filterDueDate);
    }
    if (settings.filterPriority) {
      tasks = tasks.filter(t => t.priority === settings.filterPriority);
    }

    this.filteredTasks = tasks;
  }

  private renderTaskSectionsInto(container: HTMLElement): void {
    // Clean up keyboard handler
    if (this.keyboardHandler) {
      this.keyboardHandler.destroy();
      this.keyboardHandler = null;
    }

    const activeTasks = this.filteredTasks.filter(t => !t.completed);
    const completedTasks = this.filteredTasks.filter(t => t.completed);

    const sortedActive = this.sortTasks(activeTasks);
    const sortedCompleted = this.sortTasks(completedTasks);

    // Active tasks section
    const activeSection = container.createDiv({ cls: 'task-section' });
    activeSection.createEl('h5', {
      text: `Active Tasks (${sortedActive.length})`,
      attr: { id: 'active-tasks-heading' }
    });

    if (sortedActive.length === 0) {
      activeSection.createEl('p', { text: 'No active tasks found', cls: 'task-empty' });
    } else if (this.plugin.settings.groupBy !== 'none') {
      const groups = this.groupTasks(sortedActive);
      this.renderGroupedTasks(activeSection, groups, 'active');
    } else {
      const list = activeSection.createDiv({
        cls: 'task-list',
        attr: {
          role: 'listbox',
          'aria-labelledby': 'active-tasks-heading',
          tabindex: '0'
        }
      });
      this.taskListContainer = list;

      for (const task of sortedActive) {
        this.renderTask(list, task);
      }

      this.setupKeyboardNavigation(list);
    }

    // Completed tasks section
    const completedSection = container.createDiv({ cls: 'task-section' });
    const sectionHeader = completedSection.createDiv({ cls: 'task-section-header' });

    sectionHeader.createEl('span', {
      text: this.plugin.settings.showCompleted ? '▼' : '▶',
      cls: 'task-section-toggle'
    });

    sectionHeader.createEl('h5', {
      text: `Completed Tasks (${sortedCompleted.length})`,
      cls: 'task-section-title'
    });

    sectionHeader.addEventListener('click', async () => {
      this.plugin.settings.showCompleted = !this.plugin.settings.showCompleted;
      await this.plugin.saveSettings();
      await this.refresh();
    });

    if (this.plugin.settings.showCompleted && sortedCompleted.length > 0) {
      if (this.plugin.settings.groupBy !== 'none') {
        const groups = this.groupTasks(sortedCompleted);
        this.renderGroupedTasks(completedSection, groups, 'completed');
      } else {
        const list = completedSection.createDiv({ cls: 'task-list' });
        for (const task of sortedCompleted) {
          this.renderTask(list, task);
        }
      }
    }
  }

  private sortTasks(tasks: Task[]): Task[] {
    const sorted = [...tasks];
    const sortBy = this.plugin.settings.sortBy;

    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'dueDate':
          return compareNullableStrings(a.dueDate, b.dueDate);

        case 'owner':
          if (!a.owner && !b.owner) return 0;
          if (!a.owner) return 1;
          if (!b.owner) return -1;
          return a.owner.localeCompare(b.owner);

        case 'priority': {
          const order: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
          const aVal = a.priority ? order[a.priority] : 3;
          const bVal = b.priority ? order[b.priority] : 3;
          return aVal - bVal;
        }

        case 'project':
          if (!a.project && !b.project) return 0;
          if (!a.project) return 1;
          if (!b.project) return -1;
          return a.project.localeCompare(b.project);

        case 'created':
          return compareNullableStrings(a.createdDate, b.createdDate);

        case 'stage': {
          const stageOrder = STAGES.reduce((acc, s, i) => ({ ...acc, [s]: i }), {} as Record<string, number>);
          const aIdx = a.stage ? stageOrder[a.stage] ?? 99 : 99;
          const bIdx = b.stage ? stageOrder[b.stage] ?? 99 : 99;
          return aIdx - bIdx;
        }

        default:
          return 0;
      }
    });

    return sorted;
  }

  private groupTasks(tasks: Task[]): Map<string, Task[]> {
    const groups = new Map<string, Task[]>();
    const groupBy = this.plugin.settings.groupBy;

    for (const task of tasks) {
      let key: string;

      switch (groupBy) {
        case 'dueDate':
          key = task.dueDate ?? 'No Date';
          break;
        case 'owner':
          key = task.owner ?? 'No Owner';
          break;
        case 'project':
          key = task.project ?? 'No Project';
          break;
        case 'stage':
          key = task.stage ?? 'Unassigned';
          break;
        case 'priority':
          key = task.priority ?? 'No Priority';
          break;
        default:
          key = 'All';
      }

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(task);
    }

    return groups;
  }

  private renderGroupedTasks(container: HTMLElement, groups: Map<string, Task[]>, type: string): void {
    const groupBy = this.plugin.settings.groupBy;

    for (const [groupName, tasks] of groups) {
      const groupKey = `${type}-${groupName}`;
      const collapsed = this.plugin.settings.collapsedGroups[groupKey] ?? false;

      const group = container.createDiv({ cls: 'task-group' });
      const header = group.createDiv({ cls: 'task-group-header' });

      header.createEl('span', {
        text: collapsed ? '▶' : '▼',
        cls: 'task-group-toggle'
      });

      const icon = GROUP_ICONS[groupBy];
      header.createEl('span', {
        text: `${icon} ${groupName} (${tasks.length})`,
        cls: 'task-group-title'
      });

      header.addEventListener('click', async () => {
        this.plugin.settings.collapsedGroups[groupKey] = !collapsed;
        await this.plugin.saveSettings();
        await this.refresh();
      });

      if (!collapsed) {
        const list = group.createDiv({ cls: 'task-list' });
        for (const task of tasks) {
          this.renderTask(list, task);
        }
      }
    }
  }

  private renderTask(container: HTMLElement, task: Task): void {
    const item = container.createDiv({
      cls: 'task-item',
      attr: {
        role: 'option',
        'aria-selected': 'false',
        tabindex: '-1'
      }
    });

    // Add status classes
    if (isOverdue(task.dueDate) && !task.completed) {
      item.addClass('overdue');
    }
    if (isDueToday(task.dueDate) && !task.completed) {
      item.addClass('due-today');
    }
    if (task.priority) {
      item.addClass(`priority-${task.priority}`);
    }

    // Accessibility label
    const labelParts = [task.text];
    if (task.priority) labelParts.push(`Priority: ${task.priority}`);
    if (task.dueDate) {
      const dateText = getRelativeDateString(task.dueDate);
      labelParts.push(`Due: ${dateText}`);
      if (isOverdue(task.dueDate) && !task.completed) labelParts.push('Overdue');
    }
    if (task.owner) labelParts.push(`Owner: ${task.owner}`);
    if (task.project) labelParts.push(`Project: ${task.project}`);

    item.setAttribute('aria-label', labelParts.join(', '));

    // Checkbox
    const checkbox = item.createEl('input', {
      type: 'checkbox',
      attr: { 'aria-label': `Toggle task: ${task.text}` }
    });
    checkbox.checked = task.completed;

    checkbox.addEventListener('change', async () => {
      const result = await this.taskUpdater.toggleTask(task);
      if (result.success) {
        new Notice(task.completed ? 'Task unchecked' : 'Task checked');
        await this.plugin.refreshTasks();
        await this.refresh();
      } else {
        new Notice(`Error: ${result.error}`);
        checkbox.checked = task.completed;
      }
    });

    // Content
    const content = item.createDiv({ cls: 'task-content' });

    const textEl = content.createDiv({ cls: 'task-text' });
    textEl.setText(task.text);
    if (task.completed) textEl.addClass('task-completed');

    // Metadata
    const meta = content.createDiv({ cls: 'task-metadata' });

    if (task.priority) {
      meta.createSpan({
        text: `${PRIORITY_ICONS[task.priority]} ${task.priority}`,
        cls: `task-priority priority-${task.priority}`
      });
    }

    if (task.dueDate) {
      const dateText = getRelativeDateString(task.dueDate);
      const dateSpan = meta.createSpan({
        text: `📅 ${dateText}`,
        cls: 'task-due-date'
      });
      if (isOverdue(task.dueDate) && !task.completed) {
        dateSpan.addClass('overdue');
      }
    }

    if (task.owner) {
      meta.createSpan({ text: `👤 ${task.owner}`, cls: 'task-owner' });
    }

    if (task.project) {
      meta.createSpan({ text: `📁 ${task.project}`, cls: 'task-project' });
    }

    if (task.stage) {
      meta.createSpan({ text: `📋 ${task.stage}`, cls: 'task-stage' });
    }

    // Subtask progress indicator (Feature 4)
    const progress = getSubtaskProgress(task);
    if (progress) {
      meta.createSpan({
        text: `📊 ${progress.completed}/${progress.total}`,
        cls: 'task-subtask-progress',
        attr: { 'aria-label': `${progress.completed} of ${progress.total} subtasks completed` }
      });
    }

    // Time tracking display (Feature 2)
    if (this.plugin.settings.enableTimeTracking) {
      if (task.estimate) {
        meta.createSpan({
          text: `⏱ ${task.estimate}`,
          cls: 'task-estimate',
          attr: { 'aria-label': `Estimate: ${task.estimate}` }
        });
      }
      if (task.timeLogged) {
        meta.createSpan({
          text: `⏰ ${task.timeLogged}`,
          cls: 'task-time-logged',
          attr: { 'aria-label': `Logged: ${task.timeLogged}` }
        });
      }
    }

    if (task.recurrence) {
      meta.createSpan({
        text: '🔄',
        cls: 'task-recurring',
        attr: { title: 'Recurring task' }
      });
    }

    // Comment indicator (Feature 5)
    if (this.plugin.settings.enableComments) {
      const comments = this.plugin.commentService?.getCommentsForTask(task.id) ?? [];
      if (comments.length > 0) {
        meta.createSpan({
          text: `💬 ${comments.length}`,
          cls: 'task-comment-count',
          attr: { 'aria-label': `${comments.length} comments` }
        }).addEventListener('click', (e) => {
          e.stopPropagation();
          new CommentModal(this.app, this.plugin, task).open();
        });
      }
    }

    // Dependency status
    const allTasks = this.taskCache.getFilteredTasks({});
    const depIdMap = buildShortIdMap(allTasks);
    const depStatus = getDependencyStatus(task, allTasks, depIdMap);

    if (depStatus.isBlocked) {
      const blockerNames = depStatus.blockedByTasks.map(id => createShortTaskId(id)).join(', ');
      item.addClass('task-blocked');
      meta.createSpan({
        text: `🚫 Blocked (${depStatus.blockedByCount})`,
        cls: 'task-dependency task-blocked-indicator',
        attr: { title: `Blocked by: ${blockerNames}` }
      });
    }

    if (depStatus.blocksCount > 0 && !task.completed) {
      const blockedNames = depStatus.blocksTasks.map(id => createShortTaskId(id)).join(', ');
      item.addClass('task-blocker');
      meta.createSpan({
        text: `⏳ Blocks (${depStatus.blocksCount})`,
        cls: 'task-dependency task-blocker-indicator',
        attr: { title: `Blocks: ${blockedNames}` }
      });
    }

    if (task.tags.length > 0) {
      const tagsContainer = meta.createDiv({ cls: 'task-tags' });
      for (const tag of task.tags) {
        tagsContainer.createSpan({ text: `#${tag}`, cls: 'task-tag' });
      }
    }

    // File link
    meta.createEl('a', {
      text: `📄 ${task.file.basename}`,
      cls: 'task-file-link',
      attr: { 'aria-label': `Open ${task.file.name}` }
    }).addEventListener('click', async (e) => {
      e.preventDefault();
      await openTaskInEditor(this.app, task);
    });
  }

  private setupKeyboardNavigation(container: HTMLElement): void {
    this.keyboardHandler = new KeyboardNavigationHandler(container, {
      itemSelector: '.task-item',
      onSelect: async (element, index) => {
        const task = this.filteredTasks.filter(t => !t.completed)[index];
        if (task) {
          const result = await this.taskUpdater.toggleTask(task);
          if (result.success) {
            const status = task.completed ? 'unchecked' : 'checked';
            this.announce(`Task ${status}: ${task.text}`);
            new Notice(`Task ${status}`);
            await this.plugin.refreshTasks();
            await this.refresh();
          } else {
            new Notice(`Error: ${result.error}`);
          }
        }
      },
      onActivate: async (element, index) => {
        const task = this.filteredTasks.filter(t => !t.completed)[index];
        if (task) {
          this.announce(`Opening task: ${task.text}`);
          await openTaskInEditor(this.app, task);
        }
      }
    });
  }
}
