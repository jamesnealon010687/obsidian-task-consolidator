import { Modal, App } from 'obsidian';
import type TaskConsolidatorPlugin from '../main';
import { Task, TaskStats } from '../types';
import { TaskCache } from '../core/taskCache';
import { isOverdue, isDueToday, parseISODate, getToday, addDays } from '../utils/dateUtils';
import { getDependencyStatus, getBlockedTasks, getReadyTasks } from '../utils/dependencyUtils';

// ========================================
// Project Statistics
// ========================================

export interface ProjectStats {
  name: string;
  total: number;
  completed: number;
  active: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  blocked: number;
  completionPercent: number;
  byStage: Record<string, number>;
  byPriority: Record<string, number>;
  recentlyCompleted: Task[];
  upcomingTasks: Task[];
}

// ========================================
// Project Dashboard Modal
// ========================================

export class ProjectDashboardModal extends Modal {
  private plugin: TaskConsolidatorPlugin;
  private taskCache: TaskCache;
  private selectedProject: string | null = null;

  constructor(app: App, plugin: TaskConsolidatorPlugin) {
    super(app);
    this.plugin = plugin;
    this.taskCache = plugin.taskCache;
  }

  onOpen(): void {
    this.modalEl.addClass('project-dashboard-modal');
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    // Header
    const header = contentEl.createDiv({ cls: 'dashboard-header' });
    header.createEl('h2', { text: 'Project Dashboard' });

    // Overall stats
    this.renderOverallStats(contentEl);

    // Project grid
    this.renderProjectGrid(contentEl);

    // Selected project details
    if (this.selectedProject) {
      this.renderProjectDetails(contentEl, this.selectedProject);
    }
  }

  private renderOverallStats(container: HTMLElement): void {
    const allTasks = this.taskCache.getFilteredTasks({});
    const stats = this.calculateOverallStats(allTasks);

    const statsContainer = container.createDiv({ cls: 'dashboard-overall-stats' });

    const statCards = [
      { label: 'Total Tasks', value: stats.total, icon: '📋', cls: '' },
      { label: 'Completed', value: stats.completed, icon: '✅', cls: 'stat-completed' },
      { label: 'Active', value: stats.active, icon: '🔄', cls: 'stat-active' },
      { label: 'Overdue', value: stats.overdue, icon: '🔴', cls: 'stat-overdue' },
      { label: 'Due Today', value: stats.dueToday, icon: '🟡', cls: 'stat-today' },
      { label: 'Blocked', value: getBlockedTasks(allTasks).length, icon: '🚫', cls: 'stat-blocked' }
    ];

    for (const stat of statCards) {
      const card = statsContainer.createDiv({ cls: `stat-card ${stat.cls}` });
      card.createDiv({ cls: 'stat-icon', text: stat.icon });
      card.createDiv({ cls: 'stat-value', text: String(stat.value) });
      card.createDiv({ cls: 'stat-label', text: stat.label });
    }
  }

  private renderProjectGrid(container: HTMLElement): void {
    const projectsContainer = container.createDiv({ cls: 'dashboard-projects' });
    projectsContainer.createEl('h3', { text: 'Projects' });

    const projects = this.taskCache.getUniqueProjects();
    const allTasks = this.taskCache.getFilteredTasks({});

    if (projects.length === 0) {
      projectsContainer.createDiv({
        cls: 'no-projects',
        text: 'No projects found. Add #project tags to your tasks to see them here.'
      });
      return;
    }

    const grid = projectsContainer.createDiv({ cls: 'project-grid' });

    // Add "All Tasks" card
    const allProjectStats = this.calculateProjectStats('All Tasks', allTasks);
    this.renderProjectCard(grid, allProjectStats, null);

    // Add "No Project" card for tasks without project
    const noProjectTasks = allTasks.filter(t => !t.project);
    if (noProjectTasks.length > 0) {
      const noProjectStats = this.calculateProjectStats('No Project', noProjectTasks);
      this.renderProjectCard(grid, noProjectStats, '');
    }

    // Add individual project cards
    for (const project of projects) {
      const projectTasks = allTasks.filter(t => t.project === project);
      const stats = this.calculateProjectStats(project, projectTasks);
      this.renderProjectCard(grid, stats, project);
    }
  }

  private renderProjectCard(container: HTMLElement, stats: ProjectStats, projectKey: string | null): void {
    const card = container.createDiv({
      cls: `project-card ${this.selectedProject === projectKey ? 'selected' : ''}`
    });

    // Project name
    card.createDiv({ cls: 'project-name', text: stats.name });

    // Progress bar
    const progressContainer = card.createDiv({ cls: 'project-progress' });
    const progressBar = progressContainer.createDiv({ cls: 'progress-bar' });
    const progressFill = progressBar.createDiv({
      cls: 'progress-fill',
      attr: { style: `width: ${stats.completionPercent}%` }
    });
    progressContainer.createDiv({
      cls: 'progress-text',
      text: `${stats.completionPercent}% complete`
    });

    // Quick stats
    const quickStats = card.createDiv({ cls: 'project-quick-stats' });
    quickStats.createSpan({ text: `${stats.completed}/${stats.total} tasks` });

    if (stats.overdue > 0) {
      quickStats.createSpan({ cls: 'stat-overdue', text: `🔴 ${stats.overdue}` });
    }
    if (stats.dueToday > 0) {
      quickStats.createSpan({ cls: 'stat-today', text: `🟡 ${stats.dueToday}` });
    }
    if (stats.blocked > 0) {
      quickStats.createSpan({ cls: 'stat-blocked', text: `🚫 ${stats.blocked}` });
    }

    // Click to select
    card.addEventListener('click', () => {
      this.selectedProject = projectKey;
      this.render();
    });
  }

  private renderProjectDetails(container: HTMLElement, projectKey: string | null): void {
    const allTasks = this.taskCache.getFilteredTasks({});
    const projectTasks = projectKey === null
      ? allTasks
      : projectKey === ''
        ? allTasks.filter(t => !t.project)
        : allTasks.filter(t => t.project === projectKey);

    const projectName = projectKey === null ? 'All Tasks' : projectKey || 'No Project';
    const stats = this.calculateProjectStats(projectName, projectTasks);

    const detailsContainer = container.createDiv({ cls: 'project-details' });

    // Header with close button
    const detailsHeader = detailsContainer.createDiv({ cls: 'details-header' });
    detailsHeader.createEl('h3', { text: `Project: ${projectName}` });
    const closeBtn = detailsHeader.createEl('button', { text: '×', cls: 'close-details' });
    closeBtn.addEventListener('click', () => {
      this.selectedProject = null;
      this.render();
    });

    // Stage breakdown
    const stageSection = detailsContainer.createDiv({ cls: 'details-section' });
    stageSection.createEl('h4', { text: 'By Stage' });
    const stageGrid = stageSection.createDiv({ cls: 'stage-grid' });

    for (const [stage, count] of Object.entries(stats.byStage)) {
      if (count > 0) {
        const stageItem = stageGrid.createDiv({ cls: 'stage-item' });
        stageItem.createSpan({ cls: 'stage-name', text: stage || 'Unassigned' });
        stageItem.createSpan({ cls: 'stage-count', text: String(count) });
      }
    }

    // Priority breakdown
    const prioritySection = detailsContainer.createDiv({ cls: 'details-section' });
    prioritySection.createEl('h4', { text: 'By Priority' });
    const priorityGrid = prioritySection.createDiv({ cls: 'priority-grid' });

    const priorityIcons: Record<string, string> = {
      high: '🔴',
      medium: '🟡',
      low: '🟢',
      none: '⚪'
    };

    for (const [priority, count] of Object.entries(stats.byPriority)) {
      if (count > 0) {
        const priorityItem = priorityGrid.createDiv({ cls: `priority-item priority-${priority}` });
        priorityItem.createSpan({ text: `${priorityIcons[priority] || ''} ${priority.charAt(0).toUpperCase() + priority.slice(1)}` });
        priorityItem.createSpan({ cls: 'priority-count', text: String(count) });
      }
    }

    // Recently completed
    if (stats.recentlyCompleted.length > 0) {
      const recentSection = detailsContainer.createDiv({ cls: 'details-section' });
      recentSection.createEl('h4', { text: 'Recently Completed' });
      const recentList = recentSection.createDiv({ cls: 'task-mini-list' });

      for (const task of stats.recentlyCompleted.slice(0, 5)) {
        const item = recentList.createDiv({ cls: 'task-mini-item' });
        item.createSpan({ text: '✅', cls: 'task-mini-icon' });
        item.createSpan({ text: task.text, cls: 'task-mini-text' });
        if (task.completedDate) {
          item.createSpan({ text: task.completedDate, cls: 'task-mini-date' });
        }
      }
    }

    // Upcoming tasks
    if (stats.upcomingTasks.length > 0) {
      const upcomingSection = detailsContainer.createDiv({ cls: 'details-section' });
      upcomingSection.createEl('h4', { text: 'Upcoming Tasks' });
      const upcomingList = upcomingSection.createDiv({ cls: 'task-mini-list' });

      for (const task of stats.upcomingTasks.slice(0, 5)) {
        const item = upcomingList.createDiv({ cls: 'task-mini-item' });
        const icon = isOverdue(task.dueDate) ? '🔴' : isDueToday(task.dueDate) ? '🟡' : '📅';
        item.createSpan({ text: icon, cls: 'task-mini-icon' });
        item.createSpan({ text: task.text, cls: 'task-mini-text' });
        if (task.dueDate) {
          item.createSpan({ text: task.dueDate, cls: 'task-mini-date' });
        }
      }
    }

    // Blocked tasks
    const blockedTasks = projectTasks.filter(t => !t.completed && getDependencyStatus(t, allTasks).isBlocked);
    if (blockedTasks.length > 0) {
      const blockedSection = detailsContainer.createDiv({ cls: 'details-section' });
      blockedSection.createEl('h4', { text: 'Blocked Tasks' });
      const blockedList = blockedSection.createDiv({ cls: 'task-mini-list' });

      for (const task of blockedTasks.slice(0, 5)) {
        const item = blockedList.createDiv({ cls: 'task-mini-item blocked' });
        item.createSpan({ text: '🚫', cls: 'task-mini-icon' });
        item.createSpan({ text: task.text, cls: 'task-mini-text' });
      }
    }
  }

  private calculateOverallStats(tasks: Task[]): TaskStats {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const active = total - completed;
    const overdue = tasks.filter(t => !t.completed && isOverdue(t.dueDate)).length;
    const dueToday = tasks.filter(t => !t.completed && isDueToday(t.dueDate)).length;

    const today = getToday();
    const weekEnd = addDays(today, 7);
    const dueThisWeek = tasks.filter(t => {
      if (t.completed || !t.dueDate) return false;
      const date = parseISODate(t.dueDate);
      return date && date >= today && date <= weekEnd;
    }).length;

    const byStage: Record<string, number> = {};
    const byOwner: Record<string, number> = {};
    const byProject: Record<string, number> = {};
    const byPriority: Record<string, number> = { high: 0, medium: 0, low: 0 };

    for (const task of tasks) {
      const stage = task.stage ?? 'Unassigned';
      byStage[stage] = (byStage[stage] ?? 0) + 1;

      if (task.owner) {
        byOwner[task.owner] = (byOwner[task.owner] ?? 0) + 1;
      }

      if (task.project) {
        byProject[task.project] = (byProject[task.project] ?? 0) + 1;
      }

      if (task.priority) {
        byPriority[task.priority] = (byPriority[task.priority] ?? 0) + 1;
      }
    }

    return {
      total,
      completed,
      active,
      overdue,
      dueToday,
      dueThisWeek,
      byStage,
      byOwner,
      byProject,
      byPriority
    };
  }

  private calculateProjectStats(name: string, tasks: Task[]): ProjectStats {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const active = total - completed;
    const overdue = tasks.filter(t => !t.completed && isOverdue(t.dueDate)).length;
    const dueToday = tasks.filter(t => !t.completed && isDueToday(t.dueDate)).length;

    const allTasks = this.taskCache.getFilteredTasks({});
    const blocked = tasks.filter(t => !t.completed && getDependencyStatus(t, allTasks).isBlocked).length;

    const today = getToday();
    const weekEnd = addDays(today, 7);
    const dueThisWeek = tasks.filter(t => {
      if (t.completed || !t.dueDate) return false;
      const date = parseISODate(t.dueDate);
      return date && date >= today && date <= weekEnd;
    }).length;

    const completionPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

    const byStage: Record<string, number> = {};
    const byPriority: Record<string, number> = { high: 0, medium: 0, low: 0, none: 0 };

    for (const task of tasks) {
      const stage = task.stage ?? 'Unassigned';
      byStage[stage] = (byStage[stage] ?? 0) + 1;

      const priority = task.priority ?? 'none';
      byPriority[priority] = (byPriority[priority] ?? 0) + 1;
    }

    // Recently completed (last 7 days)
    const recentlyCompleted = tasks
      .filter(t => t.completed && t.completedDate)
      .sort((a, b) => (b.completedDate ?? '').localeCompare(a.completedDate ?? ''))
      .slice(0, 5);

    // Upcoming tasks (with due dates, sorted by date)
    const upcomingTasks = tasks
      .filter(t => !t.completed && t.dueDate)
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
      .slice(0, 5);

    return {
      name,
      total,
      completed,
      active,
      overdue,
      dueToday,
      dueThisWeek,
      blocked,
      completionPercent,
      byStage,
      byPriority,
      recentlyCompleted,
      upcomingTasks
    };
  }
}
