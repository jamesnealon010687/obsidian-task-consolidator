import { Modal, App, TFile, Setting, Notice } from 'obsidian';
import type TaskConsolidatorPlugin from '../main';
import { TaskCache } from '../core/taskCache';
import { TaskUpdater } from '../core/taskUpdater';
import { TaskConsolidatorSettings, Priority } from '../types';
import { STAGES, PRIORITIES, QUICK_ADD_PATTERNS } from '../types/constants';
import { parseNaturalDate, getToday } from '../utils/dateUtils';
import { validateTaskText } from '../utils/validation';
import { ensureDailyNoteExists, addTaskToDailyNote } from '../utils/dailyNoteUtils';

// ========================================
// Quick Add Modal Options
// ========================================

export interface QuickAddModalOptions {
  targetDailyNote?: boolean;
}

// ========================================
// Quick Add Modal
// ========================================

export class QuickAddModal extends Modal {
  private plugin: TaskConsolidatorPlugin;
  private taskCache: TaskCache;
  private taskUpdater: TaskUpdater;
  private settings: TaskConsolidatorSettings;
  private options: QuickAddModalOptions;

  private taskText = '';
  private selectedOwner = '';
  private selectedDueDate = '';
  private selectedProject = '';
  private selectedStage = '';
  private selectedPriority = '';
  private selectedTags: string[] = [];
  private selectedFile: TFile | null = null;
  private useQuickSyntax = true;
  private targetDailyNote = false;

  constructor(app: App, plugin: TaskConsolidatorPlugin, options: QuickAddModalOptions = {}) {
    super(app);
    this.plugin = plugin;
    this.taskCache = plugin.taskCache;
    this.taskUpdater = plugin.taskUpdater;
    this.settings = plugin.settings;
    this.options = options;
    this.targetDailyNote = options.targetDailyNote ?? false;

    // Set defaults
    this.selectedOwner = this.settings.defaultOwner;
    this.selectedProject = this.settings.defaultProject;

    if (this.targetDailyNote) {
      // Set due date to today when targeting daily note
      this.selectedDueDate = new Date().toISOString().split('T')[0];
    } else if (this.settings.defaultTargetFile) {
      const file = this.app.vault.getAbstractFileByPath(this.settings.defaultTargetFile);
      if (file instanceof TFile) {
        this.selectedFile = file;
      }
    }
  }

  onOpen(): void {
    this.modalEl.addClass('quick-add-modal');
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    const title = this.targetDailyNote ? 'Add Task to Daily Note' : 'Quick Add Task';
    contentEl.createEl('h2', { text: title });

    // Quick syntax toggle
    new Setting(contentEl)
      .setName('Quick Syntax Mode')
      .setDesc('Use @owner, #project, !date, ^priority, +tag in the task text')
      .addToggle(toggle =>
        toggle.setValue(this.useQuickSyntax).onChange((value) => {
          this.useQuickSyntax = value;
          this.render();
        })
      );

    // Task input
    const inputContainer = contentEl.createDiv({ cls: 'quick-add-input-container' });
    const textarea = inputContainer.createEl('textarea', {
      cls: 'quick-add-task-input',
      placeholder: this.useQuickSyntax
        ? 'Buy groceries @John !tomorrow #personal ^high +shopping'
        : 'Enter task description...'
    });

    textarea.value = this.taskText;
    textarea.addEventListener('input', () => {
      this.taskText = textarea.value;
      if (this.useQuickSyntax) {
        this.parseQuickSyntax();
        this.updatePreview();
      }
    });

    // Focus textarea
    setTimeout(() => textarea.focus(), 50);

    // Preview (only in quick syntax mode)
    if (this.useQuickSyntax) {
      const preview = contentEl.createDiv({ cls: 'quick-add-preview' });
      preview.id = 'quick-add-preview';
      this.updatePreview();
    }

    // Expanded fields (only in non-quick-syntax mode)
    if (!this.useQuickSyntax) {
      this.renderExpandedFields(contentEl);
    }

    // File selector (only show when not targeting daily note)
    if (this.targetDailyNote) {
      const dailyNoteInfo = contentEl.createDiv({ cls: 'quick-add-daily-note-info' });
      dailyNoteInfo.createEl('p', {
        text: `Task will be added to today's daily note`,
        cls: 'setting-item-description'
      });
    } else {
      new Setting(contentEl)
        .setName('Target File')
        .setDesc('File where the task will be created')
        .addDropdown(dropdown => {
          dropdown.addOption('', 'Select a file...');

          const files = this.app.vault.getMarkdownFiles()
            .sort((a, b) => a.path.localeCompare(b.path));

          for (const file of files) {
            dropdown.addOption(file.path, file.path);
          }

          if (this.selectedFile) {
            dropdown.setValue(this.selectedFile.path);
          }

          dropdown.onChange((value) => {
            const file = this.app.vault.getAbstractFileByPath(value);
            this.selectedFile = file instanceof TFile ? file : null;
          });
        });
    }

    // Buttons
    const buttons = contentEl.createDiv({ cls: 'quick-add-buttons' });

    buttons.createEl('button', { text: 'Cancel' })
      .addEventListener('click', () => this.close());

    buttons.createEl('button', { text: 'Create Task', cls: 'mod-cta' })
      .addEventListener('click', () => void this.createTask());

    // Keyboard shortcut for quick submit
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.createTask();
      }
    });
  }

  private renderExpandedFields(container: HTMLElement): void {
    // Owner
    new Setting(container)
      .setName('Owner')
      .addDropdown(dropdown => {
        dropdown.addOption('', 'None');
        for (const owner of this.taskCache.getUniqueOwners()) {
          dropdown.addOption(owner, owner);
        }
        dropdown.setValue(this.selectedOwner);
        dropdown.onChange(value => this.selectedOwner = value);
      })
      .addText(text =>
        text.setPlaceholder('Or enter new...').onChange(value => {
          if (value) this.selectedOwner = value;
        })
      );

    // Due Date
    new Setting(container)
      .setName('Due Date')
      .addText(text =>
        text
          .setPlaceholder('YYYY-MM-DD or "tomorrow"')
          .setValue(this.selectedDueDate)
          .onChange(value => {
            const parsed = parseNaturalDate(value);
            this.selectedDueDate = parsed ?? value;
          })
      );

    // Project
    new Setting(container)
      .setName('Project')
      .addDropdown(dropdown => {
        dropdown.addOption('', 'None');
        for (const project of this.taskCache.getUniqueProjects()) {
          dropdown.addOption(project, project);
        }
        dropdown.setValue(this.selectedProject);
        dropdown.onChange(value => this.selectedProject = value);
      })
      .addText(text =>
        text.setPlaceholder('Or enter new...').onChange(value => {
          if (value) this.selectedProject = value;
        })
      );

    // Stage
    new Setting(container)
      .setName('Stage')
      .addDropdown(dropdown => {
        dropdown.addOption('', 'None');
        for (const stage of STAGES) {
          dropdown.addOption(stage, stage);
        }
        dropdown.setValue(this.selectedStage);
        dropdown.onChange(value => this.selectedStage = value);
      });

    // Priority
    new Setting(container)
      .setName('Priority')
      .addDropdown(dropdown => {
        dropdown.addOption('', 'None');
        for (const priority of PRIORITIES) {
          dropdown.addOption(priority, priority.charAt(0).toUpperCase() + priority.slice(1));
        }
        dropdown.setValue(this.selectedPriority);
        dropdown.onChange(value => this.selectedPriority = value);
      });

    // Tags
    new Setting(container)
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
          })
      );
  }

  private parseQuickSyntax(): void {
    let text = this.taskText;

    // Owner: @name
    const ownerMatch = text.match(QUICK_ADD_PATTERNS.OWNER);
    if (ownerMatch) {
      this.selectedOwner = ownerMatch[1].trim();
      text = text.replace(QUICK_ADD_PATTERNS.OWNER, '');
    }

    // Project: #project (after space)
    const projectMatch = text.match(QUICK_ADD_PATTERNS.PROJECT);
    if (projectMatch) {
      this.selectedProject = projectMatch[1];
      text = text.replace(QUICK_ADD_PATTERNS.PROJECT, '');
    }

    // Date: !date
    const dateMatch = text.match(QUICK_ADD_PATTERNS.DATE);
    if (dateMatch) {
      const parsed = parseNaturalDate(dateMatch[1]);
      this.selectedDueDate = parsed ?? '';
      text = text.replace(QUICK_ADD_PATTERNS.DATE, '');
    }

    // Priority: ^high, ^med, ^low
    const priorityMatch = text.match(QUICK_ADD_PATTERNS.PRIORITY);
    if (priorityMatch) {
      const p = priorityMatch[1].toLowerCase();
      if (p === 'h' || p === 'high') {
        this.selectedPriority = 'high';
      } else if (p === 'm' || p === 'med' || p === 'medium') {
        this.selectedPriority = 'medium';
      } else if (p === 'l' || p === 'low') {
        this.selectedPriority = 'low';
      }
      text = text.replace(QUICK_ADD_PATTERNS.PRIORITY, '');
    }

    // Tags: +tag
    const tagMatches = [...text.matchAll(QUICK_ADD_PATTERNS.TAG)];
    this.selectedTags = tagMatches.map(m => m[1].toLowerCase());
    text = text.replace(QUICK_ADD_PATTERNS.TAG, '');

    // Clean up
    this.taskText = text.replace(/\s+/g, ' ').trim();
  }

  private updatePreview(): void {
    const preview = document.getElementById('quick-add-preview');
    if (!preview) return;

    preview.empty();
    preview.createEl('strong', { text: 'Preview: ' });

    const parts: string[] = [];

    // Get clean text without quick syntax
    let text = this.taskText;
    text = text.replace(QUICK_ADD_PATTERNS.OWNER, '');
    text = text.replace(QUICK_ADD_PATTERNS.PROJECT, '');
    text = text.replace(QUICK_ADD_PATTERNS.DATE, '');
    text = text.replace(QUICK_ADD_PATTERNS.PRIORITY, '');
    text = text.replace(QUICK_ADD_PATTERNS.TAG, '');
    text = text.replace(/\s+/g, ' ').trim();

    if (text) parts.push(`"${text}"`);
    if (this.selectedOwner) parts.push(`👤 ${this.selectedOwner}`);
    if (this.selectedDueDate) parts.push(`📅 ${this.selectedDueDate}`);
    if (this.selectedProject) parts.push(`📁 ${this.selectedProject}`);

    if (this.selectedPriority) {
      const icons: Record<Priority, string> = { high: '🔴', medium: '🟡', low: '🟢' };
      parts.push(`${icons[this.selectedPriority as Priority]} ${this.selectedPriority}`);
    }

    if (this.selectedTags.length > 0) {
      parts.push(`🏷️ ${this.selectedTags.map(t => `#${t}`).join(' ')}`);
    }

    preview.createSpan({ text: parts.join(' | ') || 'Enter task text...' });
  }

  private async createTask(): Promise<void> {
    // Get clean text
    let text = this.taskText;
    if (this.useQuickSyntax) {
      text = text.replace(QUICK_ADD_PATTERNS.OWNER, '');
      text = text.replace(QUICK_ADD_PATTERNS.PROJECT, '');
      text = text.replace(QUICK_ADD_PATTERNS.DATE, '');
      text = text.replace(QUICK_ADD_PATTERNS.PRIORITY, '');
      text = text.replace(QUICK_ADD_PATTERNS.TAG, '');
      text = text.replace(/\s+/g, ' ').trim();
    }

    // Validate
    const validation = validateTaskText(text);
    if (!validation.isValid) {
      new Notice(validation.error ?? 'Invalid task text');
      return;
    }

    // Build the full task text with metadata
    const taskParts: string[] = [text];
    if (this.selectedOwner) taskParts.push(`@${this.selectedOwner}`);
    if (this.selectedDueDate) taskParts.push(`📅 ${this.selectedDueDate}`);
    if (this.selectedProject) taskParts.push(`#${this.selectedProject}`);
    if (this.selectedStage) taskParts.push(`[${this.selectedStage}]`);
    if (this.selectedPriority) {
      const prioritySymbols: Record<string, string> = { high: '🔴', medium: '🟡', low: '🟢' };
      taskParts.push(prioritySymbols[this.selectedPriority] || '');
    }
    for (const tag of this.selectedTags) {
      taskParts.push(`+${tag}`);
    }
    const fullTaskText = taskParts.filter(p => p).join(' ');

    if (this.targetDailyNote) {
      // Add to daily note
      try {
        await addTaskToDailyNote(this.app, getToday(), fullTaskText, this.settings);
        new Notice('Task added to daily note');
        await this.plugin.refreshTasks();
        this.close();
      } catch (error) {
        new Notice(`Error: ${(error as Error).message}`);
      }
    } else {
      // Add to selected file
      if (!this.selectedFile) {
        new Notice('Please select a target file');
        return;
      }

      const result = await this.taskUpdater.createTask(this.selectedFile, text, {
        owner: this.selectedOwner || undefined,
        dueDate: this.selectedDueDate || undefined,
        project: this.selectedProject || undefined,
        stage: this.selectedStage || undefined,
        priority: (this.selectedPriority as Priority) || undefined,
        tags: this.selectedTags.length > 0 ? this.selectedTags : undefined
      });

      if (result.success) {
        new Notice('Task created successfully');
        await this.plugin.refreshTasks();
        this.close();
      } else {
        new Notice(`Error: ${result.error}`);
      }
    }
  }
}
