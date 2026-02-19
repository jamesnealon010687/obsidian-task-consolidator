import { App, Notice } from 'obsidian';
import { Task, TaskConsolidatorSettings } from '../types';
import { isOverdue, isDueToday, parseISODate, getToday, addDays, formatDateToISO } from '../utils/dateUtils';
import { getBlockedTasks } from '../utils/dependencyUtils';

// ========================================
// Notification Service
// ========================================

export interface NotificationSummary {
  overdueTasks: Task[];
  dueTodayTasks: Task[];
  upcomingTasks: Task[];
  blockedTasks: Task[];
  totalActionable: number;
}

export class NotificationService {
  private app: App;
  private settings: TaskConsolidatorSettings;
  private checkInterval: number | null = null;
  private lastNotifiedTasks: Set<string> = new Set();

  constructor(app: App, settings: TaskConsolidatorSettings) {
    this.app = app;
    this.settings = settings;
  }

  /**
   * Update settings reference
   */
  updateSettings(settings: TaskConsolidatorSettings): void {
    this.settings = settings;
    this.restartCheckInterval();
  }

  /**
   * Start the notification check interval
   */
  startCheckInterval(): void {
    if (!this.settings.enableNotifications) return;

    // Clear existing interval
    this.stopCheckInterval();

    // Convert minutes to milliseconds
    const intervalMs = this.settings.reminderCheckIntervalMinutes * 60 * 1000;

    // Start new interval
    this.checkInterval = window.setInterval(() => {
      // This will be called by the main plugin
    }, intervalMs);

    if (this.settings.debugMode) {
      console.log(`Notification check interval started: ${this.settings.reminderCheckIntervalMinutes} minutes`);
    }
  }

  /**
   * Stop the notification check interval
   */
  stopCheckInterval(): void {
    if (this.checkInterval) {
      window.clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Restart the check interval (after settings change)
   */
  restartCheckInterval(): void {
    this.stopCheckInterval();
    this.startCheckInterval();
  }

  /**
   * Get notification summary for all tasks
   */
  getNotificationSummary(allTasks: Task[]): NotificationSummary {
    const incompleteTasks = allTasks.filter(t => !t.completed);
    const today = getToday();
    const upcomingEndDate = addDays(today, this.settings.upcomingDays);

    const overdueTasks: Task[] = [];
    const dueTodayTasks: Task[] = [];
    const upcomingTasks: Task[] = [];

    for (const task of incompleteTasks) {
      if (!task.dueDate) continue;

      if (isOverdue(task.dueDate)) {
        overdueTasks.push(task);
      } else if (isDueToday(task.dueDate)) {
        dueTodayTasks.push(task);
      } else {
        // Check if upcoming (within configured days)
        const dueDate = parseISODate(task.dueDate);
        if (dueDate && dueDate > today && dueDate <= upcomingEndDate) {
          upcomingTasks.push(task);
        }
      }
    }

    // Get blocked tasks
    const blockedTasks = getBlockedTasks(incompleteTasks);

    return {
      overdueTasks,
      dueTodayTasks,
      upcomingTasks,
      blockedTasks,
      totalActionable: overdueTasks.length + dueTodayTasks.length + upcomingTasks.length
    };
  }

  /**
   * Show startup notifications if enabled
   */
  showStartupNotification(summary: NotificationSummary): void {
    if (!this.settings.enableNotifications || !this.settings.notifyOnStartup) return;

    const parts: string[] = [];

    if (this.settings.notifyOverdueTasks && summary.overdueTasks.length > 0) {
      parts.push(`🔴 ${summary.overdueTasks.length} overdue`);
    }

    if (this.settings.notifyDueToday && summary.dueTodayTasks.length > 0) {
      parts.push(`🟡 ${summary.dueTodayTasks.length} due today`);
    }

    if (this.settings.notifyUpcoming && summary.upcomingTasks.length > 0) {
      parts.push(`🔵 ${summary.upcomingTasks.length} upcoming`);
    }

    if (parts.length > 0) {
      new Notice(`Task Consolidator: ${parts.join(', ')}`, 5000);
    }
  }

  /**
   * Show notification for specific task updates
   */
  notifyTaskDue(task: Task): void {
    if (!this.settings.enableNotifications) return;

    // Don't notify for the same task twice in short period
    if (this.lastNotifiedTasks.has(task.id)) return;

    this.lastNotifiedTasks.add(task.id);

    // Clear from set after 5 minutes
    setTimeout(() => {
      this.lastNotifiedTasks.delete(task.id);
    }, 5 * 60 * 1000);

    let urgency = '';
    if (isOverdue(task.dueDate)) {
      urgency = '🔴 OVERDUE';
    } else if (isDueToday(task.dueDate)) {
      urgency = '🟡 Due Today';
    }

    const message = `${urgency}: ${task.text}`;
    new Notice(message, 8000);
  }

  /**
   * Check for tasks that need notifications
   */
  checkAndNotify(allTasks: Task[]): void {
    if (!this.settings.enableNotifications) return;

    const now = Date.now();
    const summary = this.getNotificationSummary(allTasks);

    // Only notify if enough time has passed since last check
    const minInterval = this.settings.reminderCheckIntervalMinutes * 60 * 1000;
    if (now - this.settings.lastNotificationCheck < minInterval) {
      return;
    }

    // Build notification message
    const parts: string[] = [];

    if (this.settings.notifyOverdueTasks && summary.overdueTasks.length > 0) {
      parts.push(`🔴 ${summary.overdueTasks.length} overdue task${summary.overdueTasks.length > 1 ? 's' : ''}`);
    }

    if (this.settings.notifyDueToday && summary.dueTodayTasks.length > 0) {
      parts.push(`🟡 ${summary.dueTodayTasks.length} task${summary.dueTodayTasks.length > 1 ? 's' : ''} due today`);
    }

    if (parts.length > 0) {
      new Notice(`Reminder: ${parts.join(', ')}`, 6000);
    }
  }

  /**
   * Format summary for display
   */
  formatSummaryText(summary: NotificationSummary): string {
    const lines: string[] = [];

    if (summary.overdueTasks.length > 0) {
      lines.push(`🔴 Overdue: ${summary.overdueTasks.length}`);
    }

    if (summary.dueTodayTasks.length > 0) {
      lines.push(`🟡 Due today: ${summary.dueTodayTasks.length}`);
    }

    if (summary.upcomingTasks.length > 0) {
      lines.push(`🔵 Upcoming (${this.settings.upcomingDays} days): ${summary.upcomingTasks.length}`);
    }

    if (summary.blockedTasks.length > 0) {
      lines.push(`🚫 Blocked: ${summary.blockedTasks.length}`);
    }

    return lines.join('\n');
  }

  /**
   * Get badge count for ribbon icon
   */
  getBadgeCount(summary: NotificationSummary): number {
    if (!this.settings.showNotificationBadge) return 0;

    // Show count of urgent tasks (overdue + due today)
    return summary.overdueTasks.length + summary.dueTodayTasks.length;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopCheckInterval();
    this.lastNotifiedTasks.clear();
  }
}
