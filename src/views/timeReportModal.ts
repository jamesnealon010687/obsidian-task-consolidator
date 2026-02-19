import { Modal, App } from 'obsidian';
import type TaskConsolidatorPlugin from '../main';
import { Task } from '../types';

interface TimeEntry {
  label: string;
  estimate: string;
  logged: string;
  tasks: number;
}

/**
 * TimeReportModal - Per-project/per-owner time summary table.
 */
export class TimeReportModal extends Modal {
  private plugin: TaskConsolidatorPlugin;

  constructor(app: App, plugin: TaskConsolidatorPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    this.modalEl.addClass('time-report-modal');
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Time Report' });

    const allTasks = this.plugin.taskCache.getAllTasks();
    const tracked = allTasks.filter(t => t.estimate || t.timeLogged);

    if (tracked.length === 0) {
      contentEl.createEl('p', { text: 'No tasks with time estimates or logged time found.' });
      contentEl.createEl('p', { text: 'Add [estimate:2h] or [logged:1h30m] to tasks.' });
      contentEl.createEl('button', { text: 'Close' }).addEventListener('click', () => this.close());
      return;
    }

    // By Project
    contentEl.createEl('h3', { text: 'By Project' });
    const byProject = this.groupBy(tracked, t => t.project ?? 'No Project');
    this.renderTable(contentEl, byProject);

    // By Owner
    contentEl.createEl('h3', { text: 'By Owner' });
    const byOwner = this.groupBy(tracked, t => t.owner ?? 'No Owner');
    this.renderTable(contentEl, byOwner);

    contentEl.createEl('button', { text: 'Close' }).addEventListener('click', () => this.close());
  }

  private groupBy(tasks: Task[], keyFn: (t: Task) => string): TimeEntry[] {
    const groups = new Map<string, Task[]>();
    for (const task of tasks) {
      const key = keyFn(task);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(task);
    }

    return [...groups.entries()].map(([label, tasks]) => ({
      label,
      estimate: this.sumTime(tasks.map(t => t.estimate).filter(Boolean) as string[]),
      logged: this.sumTime(tasks.map(t => t.timeLogged).filter(Boolean) as string[]),
      tasks: tasks.length
    }));
  }

  private renderTable(container: HTMLElement, entries: TimeEntry[]): void {
    const table = container.createEl('table', { cls: 'time-report-table' });
    const thead = table.createEl('thead');
    const headerRow = thead.createEl('tr');
    headerRow.createEl('th', { text: 'Name' });
    headerRow.createEl('th', { text: 'Tasks' });
    headerRow.createEl('th', { text: 'Estimated' });
    headerRow.createEl('th', { text: 'Logged' });

    const tbody = table.createEl('tbody');
    for (const entry of entries) {
      const row = tbody.createEl('tr');
      row.createEl('td', { text: entry.label });
      row.createEl('td', { text: String(entry.tasks) });
      row.createEl('td', { text: entry.estimate || '-' });
      row.createEl('td', { text: entry.logged || '-' });
    }
  }

  private sumTime(timeStrs: string[]): string {
    let totalMinutes = 0;
    for (const str of timeStrs) {
      totalMinutes += this.parseTimeToMinutes(str);
    }
    if (totalMinutes === 0) return '';
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h${mins}m`;
  }

  private parseTimeToMinutes(timeStr: string): number {
    let minutes = 0;
    const hourMatch = timeStr.match(/(\d+)\s*h/i);
    const minMatch = timeStr.match(/(\d+)\s*m/i);
    if (hourMatch) minutes += parseInt(hourMatch[1], 10) * 60;
    if (minMatch) minutes += parseInt(minMatch[1], 10);
    // Handle plain number as hours
    if (!hourMatch && !minMatch) {
      const num = parseFloat(timeStr);
      if (!isNaN(num)) minutes = Math.round(num * 60);
    }
    return minutes;
  }
}
