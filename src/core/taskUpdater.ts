import { App, TFile, Notice } from 'obsidian';
import {
  Task,
  TaskConsolidatorSettings,
  TaskUpdateResult,
  BulkOperationResult,
  TaskCreateOptions,
  UndoEntry,
  Recurrence,
  Priority
} from '../types';
import {
  validateTaskText,
  validateOwner,
  validateDate,
  validateProject,
  validateStage,
  validateLineNumber
} from '../utils/validation';
import { sanitizeOwner, sanitizeProject, sanitizeTaskText } from '../utils/textUtils';
import { formatDateToISO, getToday, addDays, addWeeks, addMonths, addYears } from '../utils/dateUtils';

// ========================================
// Task Updater Class
// ========================================

export class TaskUpdater {
  private app: App;
  private settings: TaskConsolidatorSettings;
  private undoStack: UndoEntry[] = [];
  private readonly maxUndoEntries = 50;

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
   * Toggle a task's completion status
   */
  async toggleTask(task: Task): Promise<TaskUpdateResult> {
    const newCompleted = !task.completed;
    return this.updateTask(task, {
      completed: newCompleted,
      stage: newCompleted ? 'Completed' : (task.stage === 'Completed' ? null : task.stage)
    });
  }

  /**
   * Update a task with new values
   */
  async updateTask(
    task: Task,
    updates: Partial<{
      completed: boolean;
      text: string;
      owner: string | null;
      dueDate: string | null;
      stage: string | null;
      project: string | null;
      priority: string | null;
      tags: string[];
    }>
  ): Promise<TaskUpdateResult> {
    try {
      const abstractFile = this.app.vault.getAbstractFileByPath(task.file.path);
      if (!abstractFile || !(abstractFile instanceof TFile)) {
        return { success: false, error: 'File not found' };
      }

      const content = await this.app.vault.read(abstractFile);
      const lines = content.split('\n');

      // Validate line number
      const lineValidation = validateLineNumber(task.lineNumber, lines.length);
      if (!lineValidation.isValid) {
        return { success: false, error: lineValidation.error };
      }

      // Check if line has changed
      const currentLine = lines[task.lineNumber];
      if (currentLine !== task.rawLine) {
        return {
          success: false,
          error: 'Task has been modified. Please refresh and try again.'
        };
      }

      // Build the updated line
      const updatedLine = this.buildUpdatedLine(task, updates);

      // Save undo entry
      this.pushUndo({
        filePath: task.file.path,
        lineNumber: task.lineNumber,
        originalLine: currentLine,
        newLine: updatedLine,
        timestamp: Date.now()
      });

      // Update the file
      lines[task.lineNumber] = updatedLine;
      const newContent = lines.join('\n');
      await this.app.vault.modify(abstractFile, newContent);

      // Handle recurring task
      if (updates.completed && task.recurrence && !task.completed) {
        await this.createNextRecurrence(task);
      }

      // Build the updated task object with proper typing
      const updatedTask: Task = {
        ...task,
        rawLine: updatedLine,
        completed: updates.completed ?? task.completed,
        text: updates.text ?? task.text,
        owner: updates.owner !== undefined ? updates.owner : task.owner,
        dueDate: updates.dueDate !== undefined ? updates.dueDate : task.dueDate,
        stage: updates.stage !== undefined ? updates.stage : task.stage,
        project: updates.project !== undefined ? updates.project : task.project,
        priority: updates.priority !== undefined ? (updates.priority as Priority | null) : task.priority,
        tags: updates.tags ?? task.tags
      };

      return {
        success: true,
        task: updatedTask
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error updating task:', error);
      return { success: false, error: message };
    }
  }

  /**
   * Build an updated task line from task and updates
   */
  private buildUpdatedLine(
    task: Task,
    updates: Partial<{
      completed: boolean;
      text: string;
      owner: string | null;
      dueDate: string | null;
      stage: string | null;
      project: string | null;
      priority: string | null;
      tags: string[];
    }>
  ): string {
    const completed = updates.completed ?? task.completed;
    const checkbox = completed ? 'x' : ' ';

    const owner = updates.owner !== undefined ? sanitizeOwner(updates.owner) : task.owner;
    const dueDate = updates.dueDate !== undefined ? updates.dueDate : task.dueDate;
    const stage = updates.stage !== undefined ? updates.stage : task.stage;
    const project = updates.project !== undefined ? sanitizeProject(updates.project) : task.project;
    const priority = updates.priority !== undefined ? updates.priority : task.priority;
    const text = updates.text !== undefined ? sanitizeTaskText(updates.text) : task.text;
    const tags = updates.tags !== undefined ? updates.tags : task.tags;

    // Build metadata portion
    const metadataParts: string[] = [];
    if (owner) metadataParts.push(owner);
    if (dueDate) metadataParts.push(dueDate);
    if (stage) metadataParts.push(stage);
    if (project) metadataParts.push(project);

    // Build the task line
    let taskLine = text;

    if (metadataParts.length > 0) {
      taskLine = `**${metadataParts.join(' | ')}:** ${text}`;
    }

    // Add priority
    if (priority) {
      taskLine += ` [priority:${priority}]`;
    }

    // Add recurrence
    if (task.recurrence) {
      taskLine += ` [repeat:${task.recurrence.rawString ?? task.recurrence.type}]`;
    }

    // Add tags
    if (tags.length > 0) {
      taskLine += ' ' + tags.map(t => `#${t}`).join(' ');
    }

    // Add completion date if newly completed
    if (completed && !task.completed) {
      const today = formatDateToISO(getToday());
      taskLine += ` [done:${today}]`;
    } else if (task.completedDate && completed) {
      taskLine += ` [done:${task.completedDate}]`;
    }

    // Preserve created date
    if (task.createdDate) {
      taskLine += ` [created:${task.createdDate}]`;
    }

    return `${task.indent}- [${checkbox}] ${taskLine}`;
  }

  /**
   * Create a new task
   */
  async createTask(
    file: TFile,
    text: string,
    options: TaskCreateOptions = {}
  ): Promise<TaskUpdateResult> {
    try {
      // Validate task text
      const textValidation = validateTaskText(text);
      if (!textValidation.isValid) {
        return { success: false, error: textValidation.error };
      }

      // Validate optional fields
      if (options.owner) {
        const ownerValidation = validateOwner(options.owner);
        if (!ownerValidation.isValid) {
          return { success: false, error: ownerValidation.error };
        }
      }

      if (options.dueDate) {
        const dateValidation = validateDate(options.dueDate);
        if (!dateValidation.isValid) {
          return { success: false, error: dateValidation.error };
        }
      }

      if (options.project) {
        const projectValidation = validateProject(options.project);
        if (!projectValidation.isValid) {
          return { success: false, error: projectValidation.error };
        }
      }

      if (options.stage) {
        const stageValidation = validateStage(options.stage, this.settings.customStages);
        if (!stageValidation.isValid) {
          return { success: false, error: stageValidation.error };
        }
      }

      // Build metadata
      const metadataParts: string[] = [];
      if (options.owner) metadataParts.push(sanitizeOwner(options.owner)!);
      if (options.dueDate) metadataParts.push(options.dueDate);
      if (options.stage) metadataParts.push(options.stage);
      if (options.project) metadataParts.push(sanitizeProject(options.project)!);

      // Build task line
      let taskLine = sanitizeTaskText(text);

      if (metadataParts.length > 0) {
        taskLine = `**${metadataParts.join(' | ')}:** ${taskLine}`;
      }

      if (options.priority) {
        taskLine += ` [priority:${options.priority}]`;
      }

      if (options.tags && options.tags.length > 0) {
        taskLine += ' ' + options.tags.map(t => `#${t}`).join(' ');
      }

      // Add created date
      const today = formatDateToISO(getToday());
      taskLine += ` [created:${today}]`;

      const fullLine = `- [ ] ${taskLine}`;

      // Read file and insert line
      const content = await this.app.vault.read(file);
      const lines = content.split('\n');

      const insertAt = options.atLine ?? lines.length;
      lines.splice(insertAt, 0, fullLine);

      const newContent = lines.join('\n');
      await this.app.vault.modify(file, newContent);

      new Notice('Task created');
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error creating task:', error);
      return { success: false, error: message };
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(task: Task): Promise<TaskUpdateResult> {
    try {
      const content = await this.app.vault.read(task.file);
      const lines = content.split('\n');

      // Check if line has changed
      if (lines[task.lineNumber] !== task.rawLine) {
        return {
          success: false,
          error: 'Task has been modified. Please refresh and try again.'
        };
      }

      // Save undo entry
      this.pushUndo({
        filePath: task.file.path,
        lineNumber: task.lineNumber,
        originalLine: task.rawLine,
        newLine: '',
        timestamp: Date.now()
      });

      // Remove the line
      lines.splice(task.lineNumber, 1);
      const newContent = lines.join('\n');
      await this.app.vault.modify(task.file, newContent);

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error deleting task:', error);
      return { success: false, error: message };
    }
  }

  /**
   * Create the next occurrence of a recurring task
   */
  private async createNextRecurrence(task: Task): Promise<void> {
    if (!task.recurrence || !this.settings.recurringAutoCreate) {
      return;
    }

    const nextDueDate = this.calculateNextDueDate(task.dueDate, task.recurrence);
    if (!nextDueDate) return;

    // Check if past end date
    if (task.recurrence.endDate && nextDueDate > task.recurrence.endDate) {
      return;
    }

    await this.createTask(task.file, task.text, {
      owner: task.owner ?? undefined,
      dueDate: nextDueDate,
      project: task.project ?? undefined,
      stage: 'Requested',
      priority: task.priority ?? undefined,
      tags: task.tags
    });

    new Notice('Created next occurrence for recurring task');
  }

  /**
   * Calculate the next due date for a recurring task
   */
  private calculateNextDueDate(
    currentDueDate: string | null,
    recurrence: Recurrence
  ): string | null {
    const baseDate = currentDueDate ? new Date(currentDueDate) : getToday();
    const interval = recurrence.interval ?? 1;

    switch (recurrence.type) {
      case 'daily':
        return formatDateToISO(addDays(baseDate, interval));

      case 'weekly':
        if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
          const currentDay = baseDate.getDay();
          const sortedDays = [...recurrence.daysOfWeek].sort((a, b) => a - b);

          // Find the next day of the week
          let nextDay = sortedDays.find(d => d > currentDay);
          if (nextDay !== undefined) {
            const daysToAdd = nextDay - currentDay;
            return formatDateToISO(addDays(baseDate, daysToAdd));
          }

          // Wrap to next week
          nextDay = sortedDays[0];
          const daysToAdd = 7 - currentDay + nextDay;
          return formatDateToISO(addDays(baseDate, daysToAdd));
        }
        return formatDateToISO(addWeeks(baseDate, interval));

      case 'monthly':
        return formatDateToISO(addMonths(baseDate, interval));

      case 'yearly':
        return formatDateToISO(addYears(baseDate, interval));

      case 'custom':
        return formatDateToISO(addDays(baseDate, interval));

      default:
        return null;
    }
  }

  /**
   * Push an entry to the undo stack
   */
  private pushUndo(entry: UndoEntry): void {
    this.undoStack.push(entry);

    if (this.undoStack.length > this.maxUndoEntries) {
      this.undoStack.shift();
    }
  }

  /**
   * Undo the last operation
   */
  async undo(): Promise<TaskUpdateResult> {
    const entry = this.undoStack.pop();
    if (!entry) {
      return { success: false, error: 'Nothing to undo' };
    }

    try {
      const file = this.app.vault.getAbstractFileByPath(entry.filePath);
      if (!file || !(file instanceof TFile)) {
        return { success: false, error: 'File not found' };
      }

      const content = await this.app.vault.read(file);
      const lines = content.split('\n');

      if (entry.newLine === '') {
        // Was a delete - restore the line
        lines.splice(entry.lineNumber, 0, entry.originalLine);
      } else {
        // Was an update - restore original
        lines[entry.lineNumber] = entry.originalLine;
      }

      const newContent = lines.join('\n');
      await this.app.vault.modify(file, newContent);

      new Notice('Undo successful');
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error undoing:', error);
      return { success: false, error: message };
    }
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Clear the undo stack
   */
  clearUndoStack(): void {
    this.undoStack = [];
  }

  /**
   * Update a task's stage
   */
  async updateTaskStage(task: Task, stage: string | null): Promise<TaskUpdateResult> {
    const updates: any = { stage };

    if (stage === 'Completed') {
      updates.completed = true;
    } else if (task.completed) {
      updates.completed = false;
    }

    return this.updateTask(task, updates);
  }

  /**
   * Bulk update multiple tasks
   */
  async bulkUpdate(
    tasks: Task[],
    updates: Partial<{
      completed: boolean;
      stage: string | null;
      owner: string | null;
      project: string | null;
      priority: string | null;
    }>
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      successful: 0,
      failed: 0,
      errors: []
    };

    for (const task of tasks) {
      const updateResult = await this.updateTask(task, updates);

      if (updateResult.success) {
        result.successful++;
      } else {
        result.failed++;
        if (updateResult.error) {
          result.errors.push(`${task.text}: ${updateResult.error}`);
        }
      }
    }

    return result;
  }

  /**
   * Bulk delete multiple tasks
   */
  async bulkDelete(tasks: Task[]): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      successful: 0,
      failed: 0,
      errors: []
    };

    // Sort by file and then by line number descending
    // (delete from bottom to top to preserve line numbers)
    const sorted = [...tasks].sort((a, b) => {
      if (a.file.path !== b.file.path) {
        return a.file.path.localeCompare(b.file.path);
      }
      return b.lineNumber - a.lineNumber;
    });

    for (const task of sorted) {
      const deleteResult = await this.deleteTask(task);

      if (deleteResult.success) {
        result.successful++;
      } else {
        result.failed++;
        if (deleteResult.error) {
          result.errors.push(`${task.text}: ${deleteResult.error}`);
        }
      }
    }

    return result;
  }
}
