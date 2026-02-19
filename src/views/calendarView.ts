import { Modal, App, Notice, MarkdownView } from 'obsidian';
import type TaskConsolidatorPlugin from '../main';
import { TaskCache } from '../core/taskCache';
import { TaskUpdater } from '../core/taskUpdater';
import { Task, TaskConsolidatorSettings } from '../types';
import { PRIORITY_ICONS, DAY_NAMES_SHORT, MONTH_NAMES } from '../types/constants';
import {
  getToday,
  formatDateToISO,
  parseISODate,
  addDays,
  addMonths,
  getStartOfWeek,
  isOverdue,
  isDueToday
} from '../utils/dateUtils';
import { getRelativeDateString } from '../utils/dateUtils';

// ========================================
// Calendar View Types
// ========================================

type CalendarViewMode = 'month' | 'week' | 'day';

interface CalendarDay {
  date: Date;
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  tasks: Task[];
}

interface CalendarWeek {
  days: CalendarDay[];
}

// ========================================
// Calendar Modal
// ========================================

export class CalendarModal extends Modal {
  private plugin: TaskConsolidatorPlugin;
  private taskCache: TaskCache;
  private taskUpdater: TaskUpdater;
  private settings: TaskConsolidatorSettings;

  private viewMode: CalendarViewMode = 'month';
  private currentDate: Date;
  private selectedDate: string | null = null;
  private draggedTask: Task | null = null;

  constructor(app: App, plugin: TaskConsolidatorPlugin) {
    super(app);
    this.plugin = plugin;
    this.taskCache = plugin.taskCache;
    this.taskUpdater = plugin.taskUpdater;
    this.settings = plugin.settings;
    this.currentDate = getToday();
  }

  onOpen(): void {
    const { contentEl, modalEl } = this;

    modalEl.addClass('calendar-modal');
    contentEl.addClass('calendar-modal-content');

    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    this.renderHeader(contentEl);
    this.renderViewToggle(contentEl);

    switch (this.viewMode) {
      case 'month':
        this.renderMonthView(contentEl);
        break;
      case 'week':
        this.renderWeekView(contentEl);
        break;
      case 'day':
        this.renderDayView(contentEl);
        break;
    }

    // Render selected date tasks if any
    if (this.selectedDate) {
      this.renderSelectedDateTasks(contentEl);
    }
  }

  // ========================================
  // Header
  // ========================================

  private renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: 'calendar-header' });

    // Navigation
    const nav = header.createDiv({ cls: 'calendar-nav' });

    nav.createEl('button', { text: '◀', cls: 'calendar-nav-btn' })
      .addEventListener('click', () => this.navigatePrevious());

    const title = nav.createEl('h2', { cls: 'calendar-title' });
    title.setText(this.getHeaderTitle());

    nav.createEl('button', { text: '▶', cls: 'calendar-nav-btn' })
      .addEventListener('click', () => this.navigateNext());

    // Today button
    nav.createEl('button', { text: 'Today', cls: 'calendar-today-btn' })
      .addEventListener('click', () => {
        this.currentDate = getToday();
        this.selectedDate = formatDateToISO(getToday());
        this.render();
      });

    // Close button
    header.createEl('button', { text: '✕ Close', cls: 'calendar-close-btn' })
      .addEventListener('click', () => this.close());
  }

  private getHeaderTitle(): string {
    const month = MONTH_NAMES[this.currentDate.getMonth()];
    const year = this.currentDate.getFullYear();

    switch (this.viewMode) {
      case 'month':
        return `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;
      case 'week':
        const weekStart = getStartOfWeek(this.currentDate, this.settings.firstDayOfWeek);
        const weekEnd = addDays(weekStart, 6);
        return `${this.formatShortDate(weekStart)} - ${this.formatShortDate(weekEnd)}`;
      case 'day':
        return this.formatFullDate(this.currentDate);
      default:
        return '';
    }
  }

  private formatShortDate(date: Date): string {
    return `${MONTH_NAMES[date.getMonth()].slice(0, 3)} ${date.getDate()}`;
  }

  private formatFullDate(date: Date): string {
    const dayName = DAY_NAMES_SHORT[date.getDay()];
    const month = MONTH_NAMES[date.getMonth()];
    return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)}, ${month.charAt(0).toUpperCase() + month.slice(1)} ${date.getDate()}, ${date.getFullYear()}`;
  }

  // ========================================
  // View Toggle
  // ========================================

  private renderViewToggle(container: HTMLElement): void {
    const toggle = container.createDiv({ cls: 'calendar-view-toggle' });

    const modes: CalendarViewMode[] = ['month', 'week', 'day'];

    for (const mode of modes) {
      const btn = toggle.createEl('button', {
        text: mode.charAt(0).toUpperCase() + mode.slice(1),
        cls: `calendar-view-btn ${this.viewMode === mode ? 'active' : ''}`
      });
      btn.addEventListener('click', () => {
        this.viewMode = mode;
        this.render();
      });
    }
  }

  // ========================================
  // Navigation
  // ========================================

  private navigatePrevious(): void {
    switch (this.viewMode) {
      case 'month':
        this.currentDate = addMonths(this.currentDate, -1);
        break;
      case 'week':
        this.currentDate = addDays(this.currentDate, -7);
        break;
      case 'day':
        this.currentDate = addDays(this.currentDate, -1);
        break;
    }
    this.render();
  }

  private navigateNext(): void {
    switch (this.viewMode) {
      case 'month':
        this.currentDate = addMonths(this.currentDate, 1);
        break;
      case 'week':
        this.currentDate = addDays(this.currentDate, 7);
        break;
      case 'day':
        this.currentDate = addDays(this.currentDate, 1);
        break;
    }
    this.render();
  }

  // ========================================
  // Month View
  // ========================================

  private renderMonthView(container: HTMLElement): void {
    const calendar = container.createDiv({ cls: 'calendar-month' });

    // Day headers
    const headerRow = calendar.createDiv({ cls: 'calendar-header-row' });
    const orderedDays = this.getOrderedDayNames();
    for (const day of orderedDays) {
      headerRow.createDiv({ cls: 'calendar-header-cell', text: day });
    }

    // Calendar grid
    const weeks = this.getMonthWeeks();
    for (const week of weeks) {
      const weekRow = calendar.createDiv({ cls: 'calendar-week-row' });

      for (const day of week.days) {
        this.renderMonthCell(weekRow, day);
      }
    }
  }

  private renderMonthCell(container: HTMLElement, day: CalendarDay): void {
    const cell = container.createDiv({
      cls: `calendar-cell ${day.isCurrentMonth ? '' : 'other-month'} ${day.isToday ? 'today' : ''} ${day.isWeekend ? 'weekend' : ''} ${this.selectedDate === day.dateStr ? 'selected' : ''}`
    });

    // Date number
    const dateNum = cell.createDiv({ cls: 'calendar-date-num' });
    dateNum.setText(String(day.date.getDate()));

    // Task indicators
    if (day.tasks.length > 0) {
      const indicators = cell.createDiv({ cls: 'calendar-task-indicators' });

      // Show up to 3 task dots
      const displayTasks = day.tasks.slice(0, 3);
      for (const task of displayTasks) {
        const dot = indicators.createDiv({ cls: 'calendar-task-dot' });
        if (task.priority) {
          dot.addClass(`priority-${task.priority}`);
        }
        if (isOverdue(task.dueDate) && !task.completed) {
          dot.addClass('overdue');
        }
      }

      if (day.tasks.length > 3) {
        indicators.createDiv({
          cls: 'calendar-task-more',
          text: `+${day.tasks.length - 3}`
        });
      }
    }

    // Calculate workload intensity for heatmap
    const intensity = this.getWorkloadIntensity(day.tasks.length);
    if (intensity > 0) {
      cell.style.backgroundColor = `rgba(var(--interactive-accent-rgb), ${intensity * 0.15})`;
    }

    // Click handler
    cell.addEventListener('click', () => {
      this.selectedDate = day.dateStr;
      this.render();
    });

    // Setup drop zone for drag-drop
    this.setupDropZone(cell, day.dateStr);
  }

  private getWorkloadIntensity(taskCount: number): number {
    if (taskCount === 0) return 0;
    if (taskCount <= 2) return 1;
    if (taskCount <= 4) return 2;
    if (taskCount <= 6) return 3;
    return 4;
  }

  // ========================================
  // Week View
  // ========================================

  private renderWeekView(container: HTMLElement): void {
    const calendar = container.createDiv({ cls: 'calendar-week' });

    const weekStart = getStartOfWeek(this.currentDate, this.settings.firstDayOfWeek);
    const orderedDays = this.getOrderedDayNames();

    // Day headers with dates
    const headerRow = calendar.createDiv({ cls: 'calendar-header-row' });
    for (let i = 0; i < 7; i++) {
      const dayDate = addDays(weekStart, i);
      const isToday = formatDateToISO(dayDate) === formatDateToISO(getToday());

      const header = headerRow.createDiv({
        cls: `calendar-header-cell ${isToday ? 'today' : ''}`
      });
      header.createDiv({ cls: 'calendar-header-day', text: orderedDays[i] });
      header.createDiv({ cls: 'calendar-header-date', text: String(dayDate.getDate()) });
    }

    // Task rows for each day
    const bodyRow = calendar.createDiv({ cls: 'calendar-week-body' });

    for (let i = 0; i < 7; i++) {
      const dayDate = addDays(weekStart, i);
      const dateStr = formatDateToISO(dayDate);
      const tasks = this.getTasksForDate(dateStr);
      const isToday = dateStr === formatDateToISO(getToday());

      const dayColumn = bodyRow.createDiv({
        cls: `calendar-day-column ${isToday ? 'today' : ''} ${this.selectedDate === dateStr ? 'selected' : ''}`
      });

      // Setup drop zone
      this.setupDropZone(dayColumn, dateStr);

      // Click to select
      dayColumn.addEventListener('click', (e) => {
        if (e.target === dayColumn) {
          this.selectedDate = dateStr;
          this.render();
        }
      });

      // Render task cards
      for (const task of tasks.slice(0, 5)) {
        this.renderTaskCard(dayColumn, task);
      }

      if (tasks.length > 5) {
        dayColumn.createDiv({
          cls: 'calendar-more-tasks',
          text: `+${tasks.length - 5} more`
        }).addEventListener('click', () => {
          this.selectedDate = dateStr;
          this.render();
        });
      }
    }
  }

  // ========================================
  // Day View
  // ========================================

  private renderDayView(container: HTMLElement): void {
    const calendar = container.createDiv({ cls: 'calendar-day' });

    const dateStr = formatDateToISO(this.currentDate);
    const tasks = this.getTasksForDate(dateStr);

    // Setup drop zone
    this.setupDropZone(calendar, dateStr);

    if (tasks.length === 0) {
      calendar.createDiv({
        cls: 'calendar-empty',
        text: 'No tasks scheduled for this day'
      });
    } else {
      for (const task of tasks) {
        this.renderTaskCard(calendar, task, true);
      }
    }
  }

  // ========================================
  // Task Cards
  // ========================================

  private renderTaskCard(container: HTMLElement, task: Task, detailed: boolean = false): void {
    const card = container.createDiv({ cls: 'calendar-task-card' });
    card.draggable = true;

    // Styling
    if (task.priority) {
      card.addClass(`priority-${task.priority}`);
    }
    if (isOverdue(task.dueDate) && !task.completed) {
      card.addClass('overdue');
    }
    if (task.completed) {
      card.addClass('completed');
    }

    // Title
    const title = card.createDiv({ cls: 'calendar-task-title' });
    if (task.priority) {
      title.createSpan({ text: PRIORITY_ICONS[task.priority] + ' ' });
    }
    title.createSpan({ text: task.text });

    // Detailed view shows more info
    if (detailed) {
      const meta = card.createDiv({ cls: 'calendar-task-meta' });

      if (task.owner) {
        meta.createSpan({ text: `👤 ${task.owner}`, cls: 'calendar-task-owner' });
      }
      if (task.project) {
        meta.createSpan({ text: `📁 ${task.project}`, cls: 'calendar-task-project' });
      }
      if (task.stage) {
        meta.createSpan({ text: `📋 ${task.stage}`, cls: 'calendar-task-stage' });
      }

      // File link
      meta.createEl('a', {
        cls: 'calendar-task-file',
        text: `📄 ${task.file.basename}`
      }).addEventListener('click', (e) => {
        e.stopPropagation();
        this.openTaskInEditor(task);
      });
    }

    // Drag events
    card.addEventListener('dragstart', (e) => {
      this.draggedTask = task;
      card.addClass('dragging');
      e.dataTransfer?.setData('text/plain', task.id);
    });

    card.addEventListener('dragend', () => {
      this.draggedTask = null;
      card.removeClass('dragging');
    });

    // Click to open
    card.addEventListener('click', () => {
      this.openTaskInEditor(task);
    });
  }

  // ========================================
  // Selected Date Tasks Panel
  // ========================================

  private renderSelectedDateTasks(container: HTMLElement): void {
    if (!this.selectedDate) return;

    const tasks = this.getTasksForDate(this.selectedDate);
    const date = parseISODate(this.selectedDate);
    if (!date) return;

    const panel = container.createDiv({ cls: 'calendar-selected-panel' });

    const header = panel.createDiv({ cls: 'calendar-selected-header' });
    header.createEl('h3', { text: this.formatFullDate(date) });
    header.createEl('button', { text: '✕', cls: 'calendar-panel-close' })
      .addEventListener('click', () => {
        this.selectedDate = null;
        this.render();
      });

    const taskList = panel.createDiv({ cls: 'calendar-selected-tasks' });

    if (tasks.length === 0) {
      taskList.createDiv({
        cls: 'calendar-empty',
        text: 'No tasks for this date'
      });
    } else {
      // Separate incomplete and completed
      const incomplete = tasks.filter(t => !t.completed);
      const completed = tasks.filter(t => t.completed);

      if (incomplete.length > 0) {
        taskList.createEl('h4', { text: `Active (${incomplete.length})` });
        for (const task of incomplete) {
          this.renderTaskCard(taskList, task, true);
        }
      }

      if (completed.length > 0) {
        taskList.createEl('h4', { text: `Completed (${completed.length})` });
        for (const task of completed) {
          this.renderTaskCard(taskList, task, true);
        }
      }
    }
  }

  // ========================================
  // Drag and Drop
  // ========================================

  private setupDropZone(element: HTMLElement, dateStr: string): void {
    element.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }
      element.addClass('drag-over');
    });

    element.addEventListener('dragleave', (e) => {
      if (!element.contains(e.relatedTarget as Node)) {
        element.removeClass('drag-over');
      }
    });

    element.addEventListener('drop', async (e) => {
      e.preventDefault();
      element.removeClass('drag-over');

      if (!this.draggedTask) return;

      // Update task due date
      const result = await this.taskUpdater.updateTask(this.draggedTask, {
        dueDate: dateStr
      });

      if (result.success) {
        new Notice(`Task rescheduled to ${getRelativeDateString(dateStr)}`);
        await this.plugin.refreshTasks();
        this.render();
      } else {
        new Notice(`Error: ${result.error}`);
      }
    });
  }

  // ========================================
  // Utilities
  // ========================================

  private getOrderedDayNames(): string[] {
    const days = [...DAY_NAMES_SHORT];
    const firstDay = this.settings.firstDayOfWeek;

    // Rotate array to start with first day of week
    return [...days.slice(firstDay), ...days.slice(0, firstDay)]
      .map(d => d.charAt(0).toUpperCase() + d.slice(1));
  }

  private getMonthWeeks(): CalendarWeek[] {
    const weeks: CalendarWeek[] = [];
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);

    // Start from the beginning of the week containing the first day
    let current = getStartOfWeek(firstDay, this.settings.firstDayOfWeek);

    const today = getToday();
    const todayStr = formatDateToISO(today);

    while (current <= lastDay || weeks.length < 6) {
      const week: CalendarWeek = { days: [] };

      for (let i = 0; i < 7; i++) {
        const dateStr = formatDateToISO(current);
        const dayOfWeek = current.getDay();

        week.days.push({
          date: new Date(current),
          dateStr,
          isCurrentMonth: current.getMonth() === month,
          isToday: dateStr === todayStr,
          isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
          tasks: this.getTasksForDate(dateStr)
        });

        current = addDays(current, 1);
      }

      weeks.push(week);

      // Stop if we've covered the month and have at least 5 weeks
      if (current > lastDay && weeks.length >= 5) {
        break;
      }
    }

    return weeks;
  }

  private getTasksForDate(dateStr: string): Task[] {
    return this.taskCache.getAllTasks()
      .filter(t => t.dueDate === dateStr)
      .sort((a, b) => {
        // Sort by priority, then completion
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
        const aPriority = a.priority ? priorityOrder[a.priority] : 3;
        const bPriority = b.priority ? priorityOrder[b.priority] : 3;
        return aPriority - bPriority;
      });
  }

  private async openTaskInEditor(task: Task): Promise<void> {
    await this.app.workspace.getLeaf(false).openFile(task.file);

    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view?.editor) {
      const editor = view.editor;
      editor.setCursor({ line: task.lineNumber, ch: 0 });
      editor.scrollIntoView(
        { from: { line: task.lineNumber, ch: 0 }, to: { line: task.lineNumber, ch: 0 } },
        true
      );
    }

    this.close();
  }
}
