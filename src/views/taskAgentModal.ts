import { Modal, App, Setting, Notice, Editor, MarkdownView } from 'obsidian';
import type TaskConsolidatorPlugin from '../main';
import { Task, Priority } from '../types';
import { STAGES, PRIORITIES } from '../types/constants';
import { parseTaskLine } from '../core/taskParser';
import { formatDateToISO, getToday } from '../utils/dateUtils';
import { validateTaskText } from '../utils/validation';

// ========================================
// Task Agent Modal
// ========================================

export class TaskAgentModal extends Modal {
  private plugin: TaskConsolidatorPlugin;
  private editor: Editor;
  private view: MarkdownView;
  private cursorLine: number;
  private existingTask: Task | null = null;
  private isEditMode = false;

  // Form state
  private taskText = '';
  private selectedOwner = '';
  private selectedDueDate = '';
  private selectedProject = '';
  private selectedStage = '';
  private selectedPriority = '';
  private selectedTags: string[] = [];

  constructor(
    app: App,
    plugin: TaskConsolidatorPlugin,
    editor: Editor,
    view: MarkdownView
  ) {
    super(app);
    this.plugin = plugin;
    this.editor = editor;
    this.view = view;
    this.cursorLine = editor.getCursor().line;

    const lineText = editor.getLine(this.cursorLine);
    const file = view.file;

    if (file) {
      this.existingTask = parseTaskLine(
        lineText,
        file,
        this.cursorLine,
        plugin.settings.customStages
      );
    }

    if (this.existingTask) {
      this.isEditMode = true;
      this.taskText = this.existingTask.text;
      this.selectedOwner = this.existingTask.owner ?? '';
      this.selectedDueDate = this.existingTask.dueDate ?? '';
      this.selectedProject = this.existingTask.project ?? '';
      this.selectedStage = this.existingTask.stage ?? '';
      this.selectedPriority = this.existingTask.priority ?? '';
      this.selectedTags = [...this.existingTask.tags];
    } else {
      this.selectedOwner = plugin.settings.defaultOwner;
      this.selectedProject = plugin.settings.defaultProject;
    }
  }

  onOpen(): void {
    this.modalEl.addClass('task-agent-modal');
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    // Header
    contentEl.createEl('h2', {
      text: this.isEditMode ? 'Edit Task' : 'Create Task at Cursor'
    });

    if (this.isEditMode) {
      contentEl.createEl('p', {
        text: `Editing task on line ${this.cursorLine + 1}`,
        cls: 'task-agent-subtitle'
      });
    }

    // Task Description
    const inputContainer = contentEl.createDiv({ cls: 'task-agent-input-container' });
    const textarea = inputContainer.createEl('textarea', {
      cls: 'task-agent-task-input',
      placeholder: 'Enter task description...'
    });
    textarea.value = this.taskText;
    textarea.addEventListener('input', () => {
      this.taskText = textarea.value;
      this.updatePreview();
    });
    setTimeout(() => textarea.focus(), 50);

    // Ctrl/Cmd+Enter to save from textarea
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        void this.saveTask();
      }
    });

    // Fields container
    const fieldsContainer = contentEl.createDiv({ cls: 'task-agent-fields' });

    // Owner
    new Setting(fieldsContainer)
      .setName('Owner')
      .addDropdown(dropdown => {
        dropdown.addOption('', 'None');
        for (const owner of this.plugin.taskCache.getUniqueOwners()) {
          dropdown.addOption(owner, owner);
        }
        dropdown.setValue(this.selectedOwner);
        dropdown.onChange(value => {
          this.selectedOwner = value;
          this.updatePreview();
        });
      })
      .addText(text =>
        text.setPlaceholder('Or enter new...').onChange(value => {
          if (value) {
            this.selectedOwner = value;
            this.updatePreview();
          }
        })
      );

    // Due Date (native date input)
    const dateSetting = new Setting(fieldsContainer)
      .setName('Due Date');
    const dateInput = dateSetting.controlEl.createEl('input', {
      type: 'date',
      cls: 'task-agent-date-input',
      value: this.selectedDueDate
    });
    dateInput.addEventListener('input', () => {
      this.selectedDueDate = dateInput.value;
      this.updatePreview();
    });

    // Project
    new Setting(fieldsContainer)
      .setName('Project')
      .addDropdown(dropdown => {
        dropdown.addOption('', 'None');
        for (const project of this.plugin.taskCache.getUniqueProjects()) {
          dropdown.addOption(project, project);
        }
        dropdown.setValue(this.selectedProject);
        dropdown.onChange(value => {
          this.selectedProject = value;
          this.updatePreview();
        });
      })
      .addText(text =>
        text.setPlaceholder('Or enter new...').onChange(value => {
          if (value) {
            this.selectedProject = value;
            this.updatePreview();
          }
        })
      );

    // Stage
    const allStages = [...STAGES, ...this.plugin.settings.customStages];
    new Setting(fieldsContainer)
      .setName('Stage')
      .addDropdown(dropdown => {
        dropdown.addOption('', 'None');
        for (const stage of allStages) {
          dropdown.addOption(stage, stage);
        }
        dropdown.setValue(this.selectedStage);
        dropdown.onChange(value => {
          this.selectedStage = value;
          this.updatePreview();
        });
      });

    // Priority
    new Setting(fieldsContainer)
      .setName('Priority')
      .addDropdown(dropdown => {
        dropdown.addOption('', 'None');
        for (const priority of PRIORITIES) {
          dropdown.addOption(priority, priority.charAt(0).toUpperCase() + priority.slice(1));
        }
        dropdown.setValue(this.selectedPriority);
        dropdown.onChange(value => {
          this.selectedPriority = value;
          this.updatePreview();
        });
      });

    // Tags
    new Setting(fieldsContainer)
      .setName('Tags')
      .setDesc('Comma-separated tags')
      .addText(text =>
        text
          .setPlaceholder('tag1, tag2, tag3')
          .setValue(this.selectedTags.join(', '))
          .onChange(value => {
            this.selectedTags = value
              .split(',')
              .map(t => t.trim().replace(/^#/, ''))
              .filter(t => t.length > 0);
            this.updatePreview();
          })
      );

    // Live Preview
    const preview = contentEl.createDiv({ cls: 'task-agent-preview' });
    preview.id = 'task-agent-preview';
    this.updatePreview();

    // Buttons
    const buttons = contentEl.createDiv({ cls: 'task-agent-buttons' });

    buttons.createEl('button', { text: 'Cancel' })
      .addEventListener('click', () => this.close());

    const saveBtn = buttons.createEl('button', {
      text: this.isEditMode ? 'Save Changes' : 'Create Task',
      cls: 'mod-cta'
    });
    saveBtn.addEventListener('click', () => void this.saveTask());

    const shortcutHint = buttons.createEl('span', {
      text: 'Ctrl+Enter to save',
      cls: 'task-agent-shortcut-hint'
    });

    // Global Ctrl/Cmd+Enter handler for the modal
    this.modalEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        void this.saveTask();
      }
    });
  }

  private buildPreviewLine(): string {
    const checkbox = this.isEditMode && this.existingTask?.completed ? 'x' : ' ';
    const indent = this.isEditMode ? (this.existingTask?.indent ?? '') : '';
    const text = this.taskText || '...';

    // Build metadata
    const metadataParts: string[] = [];
    if (this.selectedOwner) metadataParts.push(this.selectedOwner);
    if (this.selectedDueDate) metadataParts.push(this.selectedDueDate);
    if (this.selectedStage) metadataParts.push(this.selectedStage);
    if (this.selectedProject) metadataParts.push(this.selectedProject);

    let taskLine = text;
    if (metadataParts.length > 0) {
      taskLine = `**${metadataParts.join(' | ')}:** ${text}`;
    }

    if (this.selectedPriority) {
      taskLine += ` [priority:${this.selectedPriority}]`;
    }

    if (this.isEditMode && this.existingTask?.recurrence) {
      taskLine += ` [repeat:${this.existingTask.recurrence.rawString ?? this.existingTask.recurrence.type}]`;
    }

    if (this.selectedTags.length > 0) {
      taskLine += ' ' + this.selectedTags.map(t => `#${t}`).join(' ');
    }

    return `${indent}- [${checkbox}] ${taskLine}`;
  }

  private updatePreview(): void {
    const preview = document.getElementById('task-agent-preview');
    if (!preview) return;

    preview.empty();
    preview.createEl('strong', { text: 'Preview: ' });
    preview.createEl('code', {
      text: this.buildPreviewLine(),
      cls: 'task-agent-preview-code'
    });
  }

  private async saveTask(): Promise<void> {
    // Validate text
    const validation = validateTaskText(this.taskText);
    if (!validation.isValid) {
      new Notice(validation.error ?? 'Invalid task text');
      return;
    }

    const file = this.view.file;
    if (!file) {
      new Notice('No active file');
      return;
    }

    if (this.isEditMode && this.existingTask) {
      // Edit mode: update existing task
      const result = await this.plugin.taskUpdater.updateTask(this.existingTask, {
        text: this.taskText,
        owner: this.selectedOwner || null,
        dueDate: this.selectedDueDate || null,
        stage: this.selectedStage || null,
        project: this.selectedProject || null,
        priority: this.selectedPriority || null,
        tags: this.selectedTags
      });

      if (result.success) {
        new Notice('Task updated');
        await this.plugin.refreshTasks();
        this.close();
      } else {
        new Notice(`Error: ${result.error}`);
      }
    } else {
      // Create mode: insert new task at cursor line
      const result = await this.plugin.taskUpdater.createTask(file, this.taskText, {
        owner: this.selectedOwner || undefined,
        dueDate: this.selectedDueDate || undefined,
        project: this.selectedProject || undefined,
        stage: this.selectedStage || undefined,
        priority: (this.selectedPriority as Priority) || undefined,
        tags: this.selectedTags.length > 0 ? this.selectedTags : undefined,
        atLine: this.cursorLine
      });

      if (result.success) {
        new Notice('Task created at cursor');
        await this.plugin.refreshTasks();
        this.close();
      } else {
        new Notice(`Error: ${result.error}`);
      }
    }
  }
}
