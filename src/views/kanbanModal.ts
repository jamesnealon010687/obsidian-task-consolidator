import { Modal, App, Notice, MarkdownView } from 'obsidian';
import type TaskConsolidatorPlugin from '../main';
import { TaskCache } from '../core/taskCache';
import { TaskUpdater } from '../core/taskUpdater';
import { Task, TaskConsolidatorSettings, Stage, KanbanColumn } from '../types';
import { KANBAN_COLUMNS, PRIORITY_ICONS } from '../types/constants';
import { isOverdue, getRelativeDateString } from '../utils/dateUtils';
import { compareNullableStrings } from '../utils/textUtils';

// ========================================
// Kanban Modal
// ========================================

export class KanbanModal extends Modal {
  private plugin: TaskConsolidatorPlugin;
  private taskCache: TaskCache;
  private taskUpdater: TaskUpdater;
  private settings: TaskConsolidatorSettings;
  private filteredProject: string;

  constructor(app: App, plugin: TaskConsolidatorPlugin) {
    super(app);
    this.plugin = plugin;
    this.taskCache = plugin.taskCache;
    this.taskUpdater = plugin.taskUpdater;
    this.settings = plugin.settings;
    this.filteredProject = this.settings.kanbanFilterProject;
  }

  onOpen(): void {
    const { contentEl, modalEl } = this;

    modalEl.addClass('kanban-modal');
    contentEl.addClass('kanban-modal-content');

    this.renderHeader(contentEl);
    this.renderBoard(contentEl);
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }

  private renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: 'kanban-header' });
    header.createEl('h2', { text: 'Kanban Board' });

    // Project filter
    const filter = header.createDiv({ cls: 'kanban-filter' });
    filter.createSpan({ text: 'Project: ' });

    const select = filter.createEl('select');
    select.createEl('option', { text: 'All Projects', value: '' });

    const projects = this.taskCache.getUniqueProjects();
    for (const project of projects) {
      const option = select.createEl('option', { text: project, value: project });
      if (project === this.filteredProject) {
        option.selected = true;
      }
    }

    select.addEventListener('change', async () => {
      this.filteredProject = select.value;
      this.settings.kanbanFilterProject = this.filteredProject;
      await this.plugin.saveSettings();
      this.refreshBoard();
    });

    // Close button
    header.createEl('button', { text: '✕ Close', cls: 'kanban-close-btn' })
      .addEventListener('click', () => this.close());
  }

  private renderBoard(container: HTMLElement): void {
    // Remove existing board if present
    const existing = container.querySelector('.kanban-board');
    if (existing) existing.remove();

    const board = container.createDiv({ cls: 'kanban-board' });

    for (const column of KANBAN_COLUMNS) {
      this.renderColumn(board, column);
    }
  }

  private renderColumn(board: HTMLElement, column: KanbanColumn): void {
    const columnEl = board.createDiv({ cls: 'kanban-column' });
    columnEl.dataset.stage = column.stage ?? 'unassigned';

    const tasks = this.getTasksForColumn(column);

    const header = columnEl.createDiv({ cls: 'kanban-column-header' });
    header.createEl('h3', { text: `${column.title} (${tasks.length})` });

    const body = columnEl.createDiv({ cls: 'kanban-column-body' });
    this.setupDropZone(body, column.stage);

    for (const task of tasks) {
      this.renderTaskCard(body, task);
    }
  }

  private getTasksForColumn(column: KanbanColumn): Task[] {
    let tasks = this.taskCache.getAllTasks();

    // Filter by project
    if (this.filteredProject) {
      tasks = tasks.filter(t => t.project === this.filteredProject);
    }

    let filtered: Task[];

    if (column.stage === null) {
      // Unassigned: no stage and not completed
      filtered = tasks.filter(t => !t.stage && !t.completed);
    } else if (column.stage === 'Completed') {
      // Completed: completed or stage is Completed
      filtered = tasks.filter(t => t.completed || t.stage === 'Completed');
    } else {
      // Specific stage and not completed
      filtered = tasks.filter(t => t.stage === column.stage && !t.completed);
    }

    // Sort
    if (column.stage === 'Completed') {
      filtered.sort((a, b) => compareNullableStrings(b.completedDate, a.completedDate));
    } else {
      filtered.sort((a, b) => compareNullableStrings(a.dueDate, b.dueDate));
    }

    return filtered;
  }

  private renderTaskCard(container: HTMLElement, task: Task): void {
    const card = container.createDiv({ cls: 'kanban-card' });
    card.draggable = true;
    card.dataset.filePath = task.file.path;
    card.dataset.lineNumber = String(task.lineNumber);

    // Add styling classes
    if (isOverdue(task.dueDate) && !task.completed) {
      card.addClass('overdue');
    }
    if (task.priority) {
      card.addClass(`priority-${task.priority}`);
    }

    // Title
    card.createDiv({ cls: 'kanban-card-title' }).setText(task.text);

    // Metadata
    const meta = card.createDiv({ cls: 'kanban-card-meta' });

    if (task.priority) {
      meta.createSpan({
        cls: 'kanban-card-priority',
        text: PRIORITY_ICONS[task.priority]
      });
    }

    if (task.owner) {
      meta.createSpan({
        cls: 'kanban-card-owner',
        text: `👤 ${task.owner}`
      });
    }

    if (task.dueDate) {
      const dateText = getRelativeDateString(task.dueDate);
      const dateSpan = meta.createSpan({
        cls: 'kanban-card-date',
        text: `📅 ${dateText}`
      });

      if (isOverdue(task.dueDate) && !task.completed) {
        dateSpan.addClass('overdue');
      }
    }

    if (task.project) {
      meta.createSpan({
        cls: 'kanban-card-project',
        text: `📁 ${task.project}`
      });
    }

    if (task.recurrence) {
      meta.createSpan({
        cls: 'kanban-card-recurring',
        text: '🔄'
      });
    }

    // File link
    meta.createEl('a', {
      cls: 'kanban-card-file',
      text: `📄 ${task.file.basename}`
    }).addEventListener('click', (e) => {
      e.stopPropagation();
      this.openTaskInEditor(task);
    });

    // Setup drag events
    this.setupDragEvents(card, task);
  }

  private setupDragEvents(card: HTMLElement, task: Task): void {
    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging');
      e.dataTransfer?.setData('text/plain', JSON.stringify({
        filePath: task.file.path,
        lineNumber: task.lineNumber,
        taskId: task.id
      }));
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
      }
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      this.contentEl.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
      });
    });
  }

  private setupDropZone(container: HTMLElement, stage: Stage | null): void {
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }
      container.classList.add('drag-over');
    });

    container.addEventListener('dragleave', (e) => {
      if (!container.contains(e.relatedTarget as Node)) {
        container.classList.remove('drag-over');
      }
    });

    container.addEventListener('drop', async (e) => {
      e.preventDefault();
      container.classList.remove('drag-over');

      try {
        const data = JSON.parse(e.dataTransfer?.getData('text/plain') ?? '{}');
        const task = this.taskCache.getAllTasks().find(t => t.id === data.taskId);

        if (!task) {
          new Notice('Task not found');
          return;
        }

        const result = await this.taskUpdater.updateTaskStage(task, stage);

        if (result.success) {
          new Notice(`Task moved to ${stage ?? 'Unassigned'}`);
          await this.plugin.refreshTasks();
          this.refreshBoard();
        } else {
          new Notice(`Error: ${result.error}`);
        }
      } catch (error) {
        console.error('Error handling drop:', error);
        new Notice('Error moving task');
      }
    });
  }

  private refreshBoard(): void {
    this.renderBoard(this.contentEl);
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
