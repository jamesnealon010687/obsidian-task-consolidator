import { Modal, App, Setting, Notice } from 'obsidian';
import type TaskConsolidatorPlugin from '../main';
import { Task } from '../types';

type ExportFormat = 'csv' | 'json' | 'ical';

/**
 * ExportModal - Export tasks as CSV, JSON, or iCal.
 */
export class ExportModal extends Modal {
  private plugin: TaskConsolidatorPlugin;
  private format: ExportFormat = 'csv';
  private filteredOnly = false;

  constructor(app: App, plugin: TaskConsolidatorPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    this.modalEl.addClass('export-modal');
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Export Tasks' });

    new Setting(contentEl)
      .setName('Format')
      .addDropdown(dd => {
        dd.addOption('csv', 'CSV');
        dd.addOption('json', 'JSON');
        dd.addOption('ical', 'iCal (.ics)');
        dd.setValue(this.format);
        dd.onChange(v => this.format = v as ExportFormat);
      });

    new Setting(contentEl)
      .setName('Export filtered tasks only')
      .setDesc('Only export tasks matching current filters')
      .addToggle(toggle => {
        toggle.setValue(this.filteredOnly);
        toggle.onChange(v => this.filteredOnly = v);
      });

    const buttons = contentEl.createDiv({ cls: 'export-buttons' });
    buttons.createEl('button', { text: 'Cancel' }).addEventListener('click', () => this.close());
    buttons.createEl('button', { text: 'Export', cls: 'mod-cta' }).addEventListener('click', () => {
      this.doExport();
    });
  }

  private doExport(): void {
    const tasks = this.filteredOnly
      ? this.plugin.taskCache.getFilteredTasks({
          owner: this.plugin.settings.filterOwner || undefined,
          project: this.plugin.settings.filterProject || undefined,
          stage: this.plugin.settings.filterStage || undefined,
        })
      : this.plugin.taskCache.getAllTasks();

    let content: string;
    let filename: string;
    let mimeType: string;

    switch (this.format) {
      case 'csv':
        content = this.toCSV(tasks);
        filename = 'tasks-export.csv';
        mimeType = 'text/csv';
        break;
      case 'json':
        content = this.toJSON(tasks);
        filename = 'tasks-export.json';
        mimeType = 'application/json';
        break;
      case 'ical':
        content = this.toICal(tasks);
        filename = 'tasks-export.ics';
        mimeType = 'text/calendar';
        break;
    }

    this.downloadBlob(content, filename, mimeType);
    new Notice(`Exported ${tasks.length} tasks as ${this.format.toUpperCase()}`);
    this.close();
  }

  private toCSV(tasks: Task[]): string {
    const headers = ['Text', 'Completed', 'Due Date', 'Owner', 'Project', 'Stage', 'Priority', 'Tags', 'File', 'Line'];
    const rows = tasks.map(t => [
      this.csvEscape(t.text),
      t.completed ? 'Yes' : 'No',
      t.dueDate ?? '',
      t.owner ?? '',
      t.project ?? '',
      t.stage ?? '',
      t.priority ?? '',
      t.tags.join(';'),
      t.file.path,
      String(t.lineNumber)
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  private csvEscape(str: string): string {
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  private toJSON(tasks: Task[]): string {
    const serializable = tasks.map(t => ({
      text: t.text,
      completed: t.completed,
      dueDate: t.dueDate,
      owner: t.owner,
      project: t.project,
      stage: t.stage,
      priority: t.priority,
      tags: t.tags,
      file: t.file.path,
      lineNumber: t.lineNumber,
      createdDate: t.createdDate,
      completedDate: t.completedDate,
      estimate: t.estimate,
      timeLogged: t.timeLogged
    }));
    return JSON.stringify(serializable, null, 2);
  }

  private toICal(tasks: Task[]): string {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Task Consolidator//Obsidian//EN'
    ];

    for (const task of tasks) {
      if (!task.dueDate) continue;
      const dateStr = task.dueDate.replace(/-/g, '');
      const uid = `${task.id.replace(/[^a-zA-Z0-9]/g, '-')}@task-consolidator`;
      lines.push('BEGIN:VTODO');
      lines.push(`UID:${uid}`);
      lines.push(`SUMMARY:${this.icalEscape(task.text)}`);
      lines.push(`DUE;VALUE=DATE:${dateStr}`);
      if (task.completed) lines.push('STATUS:COMPLETED');
      else lines.push('STATUS:NEEDS-ACTION');
      if (task.priority === 'high') lines.push('PRIORITY:1');
      else if (task.priority === 'medium') lines.push('PRIORITY:5');
      else if (task.priority === 'low') lines.push('PRIORITY:9');
      if (task.project) lines.push(`CATEGORIES:${task.project}`);
      lines.push('END:VTODO');
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  private icalEscape(str: string): string {
    return str.replace(/[\\;,]/g, c => '\\' + c).replace(/\n/g, '\\n');
  }

  private downloadBlob(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
