import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type TaskConsolidatorPlugin from '../main';
import { SORT_OPTIONS, GROUP_OPTIONS, DATE_FORMATS, FILE_PATH_OPTIONS, VIEW_TYPES } from '../types/constants';
import { DEFAULT_SETTINGS } from './defaults';
import { formatLabel } from '../utils/textUtils';

// ========================================
// Settings Tab
// ========================================

export class TaskConsolidatorSettingTab extends PluginSettingTab {
  plugin: TaskConsolidatorPlugin;

  constructor(app: App, plugin: TaskConsolidatorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h1', { text: 'Task Consolidator Settings' });

    this.renderDisplaySection(containerEl);
    this.renderDetectionSection(containerEl);
    this.renderBehaviorSection(containerEl);
    this.renderRecurringSection(containerEl);
    this.renderAppearanceSection(containerEl);
    this.renderQuickAddSection(containerEl);
    this.renderAdvancedSection(containerEl);
    this.renderResetSection(containerEl);
  }

  private renderDisplaySection(container: HTMLElement): void {
    container.createEl('h2', { text: 'Display' });

    new Setting(container)
      .setName('Default Sort Order')
      .setDesc('How tasks should be sorted by default')
      .addDropdown(dropdown => {
        for (const option of SORT_OPTIONS) {
          dropdown.addOption(option, formatLabel(option));
        }
        dropdown.setValue(this.plugin.settings.sortBy);
        dropdown.onChange(async (value) => {
          this.plugin.settings.sortBy = value as any;
          await this.plugin.saveSettings();
        });
      });

    new Setting(container)
      .setName('Default Group By')
      .setDesc('How tasks should be grouped by default')
      .addDropdown(dropdown => {
        for (const option of GROUP_OPTIONS) {
          dropdown.addOption(option, formatLabel(option));
        }
        dropdown.setValue(this.plugin.settings.groupBy);
        dropdown.onChange(async (value) => {
          this.plugin.settings.groupBy = value as any;
          await this.plugin.saveSettings();
        });
      });

    new Setting(container)
      .setName('Show Completed Tasks')
      .setDesc('Show the completed tasks section by default')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.showCompleted);
        toggle.onChange(async (value) => {
          this.plugin.settings.showCompleted = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(container)
      .setName('Completed Tasks Limit')
      .setDesc('Limit completed tasks display (0 = unlimited, or last N days)')
      .addText(text => {
        text.setValue(String(this.plugin.settings.completedTasksLimit));
        text.setPlaceholder('0');
        text.onChange(async (value) => {
          const num = parseInt(value, 10);
          this.plugin.settings.completedTasksLimit = isNaN(num) ? 0 : Math.max(0, num);
          await this.plugin.saveSettings();
        });
      });

    new Setting(container)
      .setName('Date Format')
      .setDesc('Format for displaying dates')
      .addDropdown(dropdown => {
        for (const format of DATE_FORMATS) {
          dropdown.addOption(format, format);
        }
        dropdown.setValue(this.plugin.settings.dateFormat);
        dropdown.onChange(async (value) => {
          this.plugin.settings.dateFormat = value as any;
          await this.plugin.saveSettings();
        });
      });

    new Setting(container)
      .setName('First Day of Week')
      .setDesc('Which day starts the week')
      .addDropdown(dropdown => {
        dropdown.addOption('0', 'Sunday');
        dropdown.addOption('1', 'Monday');
        dropdown.setValue(String(this.plugin.settings.firstDayOfWeek));
        dropdown.onChange(async (value) => {
          this.plugin.settings.firstDayOfWeek = parseInt(value, 10);
          await this.plugin.saveSettings();
        });
      });

    new Setting(container)
      .setName('Default View')
      .setDesc('Default view when opening Task Consolidator')
      .addDropdown(dropdown => {
        for (const view of VIEW_TYPES) {
          dropdown.addOption(view, formatLabel(view));
        }
        dropdown.setValue(this.plugin.settings.defaultView);
        dropdown.onChange(async (value) => {
          this.plugin.settings.defaultView = value as any;
          await this.plugin.saveSettings();
        });
      });
  }

  private renderDetectionSection(container: HTMLElement): void {
    container.createEl('h2', { text: 'Task Detection' });

    new Setting(container)
      .setName('Require Metadata Format')
      .setDesc('Only detect tasks with **metadata:** format')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.requireMetadataFormat);
        toggle.onChange(async (value) => {
          this.plugin.settings.requireMetadataFormat = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(container)
      .setName('Metadata Delimiter')
      .setDesc('Character used to separate metadata fields (default: |)')
      .addText(text => {
        text.setValue(this.plugin.settings.metadataDelimiter);
        text.setPlaceholder('|');
        text.onChange(async (value) => {
          this.plugin.settings.metadataDelimiter = value || '|';
          await this.plugin.saveSettings();
        });
      });

    new Setting(container)
      .setName('Custom Stages')
      .setDesc('Additional workflow stages (comma-separated)')
      .addText(text => {
        text.setValue(this.plugin.settings.customStages.join(', '));
        text.setPlaceholder('Review, QA, Deploy');
        text.onChange(async (value) => {
          this.plugin.settings.customStages = value
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);
          await this.plugin.saveSettings();
        });
      });

    new Setting(container)
      .setName('Excluded Folders')
      .setDesc('Folders to exclude from task scanning (comma-separated)')
      .addText(text => {
        text.setValue(this.plugin.settings.excludedFolders.join(', '));
        text.setPlaceholder('Templates, Archive');
        text.onChange(async (value) => {
          this.plugin.settings.excludedFolders = value
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);
          await this.plugin.saveSettings();
        });
      });

    new Setting(container)
      .setName('Excluded Patterns')
      .setDesc('File patterns to exclude (glob format, comma-separated)')
      .addText(text => {
        text.setValue(this.plugin.settings.excludedPatterns.join(', '));
        text.setPlaceholder('*.template.md, _*');
        text.onChange(async (value) => {
          this.plugin.settings.excludedPatterns = value
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);
          await this.plugin.saveSettings();
        });
      });
  }

  private renderBehaviorSection(container: HTMLElement): void {
    container.createEl('h2', { text: 'Behavior' });

    new Setting(container)
      .setName('Auto Refresh')
      .setDesc('Automatically refresh tasks when files change')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.autoRefresh);
        toggle.onChange(async (value) => {
          this.plugin.settings.autoRefresh = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(container)
      .setName('Refresh Debounce (ms)')
      .setDesc('Delay before refreshing after file change')
      .addText(text => {
        text.setValue(String(this.plugin.settings.refreshDebounceMs));
        text.setPlaceholder('300');
        text.onChange(async (value) => {
          const num = parseInt(value, 10);
          this.plugin.settings.refreshDebounceMs = isNaN(num) ? 300 : Math.max(100, num);
          await this.plugin.saveSettings();
        });
      });

    new Setting(container)
      .setName('Parent Task Completion')
      .setDesc('How completing a parent task affects children')
      .addDropdown(dropdown => {
        dropdown.addOption('manual', 'Manual - No automatic behavior');
        dropdown.addOption('auto', 'Auto - Complete parent when all children done');
        dropdown.addOption('cascade', 'Cascade - Complete children when parent done');
        dropdown.setValue(this.plugin.settings.parentCompletionBehavior);
        dropdown.onChange(async (value) => {
          this.plugin.settings.parentCompletionBehavior = value as any;
          await this.plugin.saveSettings();
        });
      });

    new Setting(container)
      .setName('Confirm Destructive Actions')
      .setDesc('Show confirmation dialogs for bulk delete operations')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.confirmDestructiveActions);
        toggle.onChange(async (value) => {
          this.plugin.settings.confirmDestructiveActions = value;
          await this.plugin.saveSettings();
        });
      });
  }

  private renderRecurringSection(container: HTMLElement): void {
    container.createEl('h2', { text: 'Recurring Tasks' });

    new Setting(container)
      .setName('Auto-Create Next Occurrence')
      .setDesc('Automatically create next occurrence when completing recurring task')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.recurringAutoCreate);
        toggle.onChange(async (value) => {
          this.plugin.settings.recurringAutoCreate = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(container)
      .setName('Create Days Before')
      .setDesc('Days before due date to create next occurrence (0 = on completion)')
      .addText(text => {
        text.setValue(String(this.plugin.settings.recurringCreateDaysBefore));
        text.setPlaceholder('1');
        text.onChange(async (value) => {
          const num = parseInt(value, 10);
          this.plugin.settings.recurringCreateDaysBefore = isNaN(num) ? 1 : Math.max(0, num);
          await this.plugin.saveSettings();
        });
      });
  }

  private renderAppearanceSection(container: HTMLElement): void {
    container.createEl('h2', { text: 'Appearance' });

    new Setting(container)
      .setName('Compact Mode')
      .setDesc('Use smaller, denser task display')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.compactMode);
        toggle.onChange(async (value) => {
          this.plugin.settings.compactMode = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(container)
      .setName('Show File Path')
      .setDesc('How to display file paths in task list')
      .addDropdown(dropdown => {
        for (const option of FILE_PATH_OPTIONS) {
          dropdown.addOption(option, formatLabel(option));
        }
        dropdown.setValue(this.plugin.settings.showFilePath);
        dropdown.onChange(async (value) => {
          this.plugin.settings.showFilePath = value as any;
          await this.plugin.saveSettings();
        });
      });

    new Setting(container)
      .setName('Task Count in Ribbon')
      .setDesc('Show active task count as badge on ribbon icon')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.taskCountInRibbon);
        toggle.onChange(async (value) => {
          this.plugin.settings.taskCountInRibbon = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(container)
      .setName('Show Overdue Indicator')
      .setDesc('Highlight overdue tasks with red accent')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.showOverdueIndicator);
        toggle.onChange(async (value) => {
          this.plugin.settings.showOverdueIndicator = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(container)
      .setName('Show Due Today Indicator')
      .setDesc('Highlight tasks due today with amber accent')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.showDueTodayIndicator);
        toggle.onChange(async (value) => {
          this.plugin.settings.showDueTodayIndicator = value;
          await this.plugin.saveSettings();
        });
      });
  }

  private renderQuickAddSection(container: HTMLElement): void {
    container.createEl('h2', { text: 'Quick Add' });

    new Setting(container)
      .setName('Default Target File')
      .setDesc('Default file for new tasks created via Quick Add')
      .addDropdown(dropdown => {
        dropdown.addOption('', 'None');
        const files = this.app.vault.getMarkdownFiles()
          .sort((a, b) => a.path.localeCompare(b.path));

        for (const file of files) {
          dropdown.addOption(file.path, file.path);
        }

        dropdown.setValue(this.plugin.settings.defaultTargetFile);
        dropdown.onChange(async (value) => {
          this.plugin.settings.defaultTargetFile = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(container)
      .setName('Default Owner')
      .setDesc('Default owner for new tasks')
      .addText(text => {
        text.setValue(this.plugin.settings.defaultOwner);
        text.setPlaceholder('Your name');
        text.onChange(async (value) => {
          this.plugin.settings.defaultOwner = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(container)
      .setName('Default Project')
      .setDesc('Default project for new tasks')
      .addText(text => {
        text.setValue(this.plugin.settings.defaultProject);
        text.setPlaceholder('Project name');
        text.onChange(async (value) => {
          this.plugin.settings.defaultProject = value;
          await this.plugin.saveSettings();
        });
      });
  }

  private renderAdvancedSection(container: HTMLElement): void {
    container.createEl('h2', { text: 'Advanced' });

    new Setting(container)
      .setName('Debug Mode')
      .setDesc('Enable debug logging to console')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.debugMode);
        toggle.onChange(async (value) => {
          this.plugin.settings.debugMode = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(container)
      .setName('Enable Task Cache')
      .setDesc('Cache parsed tasks for better performance')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.enableTaskCache);
        toggle.onChange(async (value) => {
          this.plugin.settings.enableTaskCache = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(container)
      .setName('Enable Virtual Scrolling')
      .setDesc('Use virtual scrolling for large task lists')
      .addToggle(toggle => {
        toggle.setValue(this.plugin.settings.enableVirtualScrolling);
        toggle.onChange(async (value) => {
          this.plugin.settings.enableVirtualScrolling = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(container)
      .setName('Max Tasks to Render')
      .setDesc('Maximum tasks to render at once (0 = unlimited)')
      .addText(text => {
        text.setValue(String(this.plugin.settings.maxTasksToRender));
        text.setPlaceholder('0');
        text.onChange(async (value) => {
          const num = parseInt(value, 10);
          this.plugin.settings.maxTasksToRender = isNaN(num) ? 0 : Math.max(0, num);
          await this.plugin.saveSettings();
        });
      });
  }

  private renderResetSection(container: HTMLElement): void {
    container.createEl('h2', { text: 'Reset' });

    new Setting(container)
      .setName('Clear All Filters')
      .setDesc('Reset owner, date, project, and stage filters')
      .addButton(button => {
        button.setButtonText('Clear Filters');
        button.onClick(async () => {
          this.plugin.settings.filterOwner = '';
          this.plugin.settings.filterDueDate = '';
          this.plugin.settings.filterProject = '';
          this.plugin.settings.filterStage = '';
          this.plugin.settings.filterPriority = '';
          this.plugin.settings.filterTags = [];
          this.plugin.settings.searchQuery = '';
          await this.plugin.saveSettings();
          new Notice('Filters cleared');
        });
      });

    new Setting(container)
      .setName('Reset All Settings')
      .setDesc('Reset all settings to default values')
      .addButton(button => {
        button.setButtonText('Reset to Defaults');
        button.setWarning();
        button.onClick(async () => {
          const collapsedGroups = this.plugin.settings.collapsedGroups;
          this.plugin.settings = { ...DEFAULT_SETTINGS, collapsedGroups };
          await this.plugin.saveSettings();
          this.display();
          new Notice('Settings reset to defaults');
        });
      });
  }
}
