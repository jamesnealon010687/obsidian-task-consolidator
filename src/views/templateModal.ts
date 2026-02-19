import { Modal, App, Setting, Notice } from 'obsidian';
import type TaskConsolidatorPlugin from '../main';
import { TaskTemplate } from '../types';
import { STAGES, PRIORITIES } from '../types/constants';

/**
 * TemplateModal - CRUD for task templates with variable support.
 */
export class TemplateModal extends Modal {
  private plugin: TaskConsolidatorPlugin;
  private editingTemplate: TaskTemplate | null = null;

  constructor(app: App, plugin: TaskConsolidatorPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    this.modalEl.addClass('template-modal');
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Task Templates' });

    const templates = this.plugin.settings.taskTemplates;

    if (templates.length === 0 && !this.editingTemplate) {
      contentEl.createEl('p', { text: 'No templates yet. Create one below.', cls: 'template-empty' });
    }

    // Template list
    if (!this.editingTemplate) {
      const list = contentEl.createDiv({ cls: 'template-list' });
      for (const tmpl of templates) {
        const item = list.createDiv({ cls: 'template-item' });
        item.createDiv({ cls: 'template-name', text: tmpl.name });
        item.createDiv({ cls: 'template-preview', text: tmpl.text });

        const actions = item.createDiv({ cls: 'template-actions' });
        actions.createEl('button', { text: 'Edit' }).addEventListener('click', () => {
          this.editingTemplate = { ...tmpl };
          this.render();
        });
        actions.createEl('button', { text: 'Delete', cls: 'mod-warning' }).addEventListener('click', async () => {
          this.plugin.settings.taskTemplates = templates.filter(t => t.id !== tmpl.id);
          await this.plugin.saveSettings();
          this.render();
        });
      }

      contentEl.createEl('button', { text: '+ New Template', cls: 'mod-cta' }).addEventListener('click', () => {
        this.editingTemplate = {
          id: Date.now().toString(36),
          name: '',
          text: '',
          owner: '',
          project: '',
          stage: '',
          priority: '',
          tags: [],
          variables: []
        };
        this.render();
      });
    } else {
      this.renderEditor(contentEl, this.editingTemplate);
    }

    contentEl.createEl('button', { text: 'Close', cls: 'template-close-btn' })
      .addEventListener('click', () => this.close());
  }

  private renderEditor(container: HTMLElement, tmpl: TaskTemplate): void {
    const editor = container.createDiv({ cls: 'template-editor' });
    editor.createEl('h3', { text: tmpl.id ? 'Edit Template' : 'New Template' });

    new Setting(editor).setName('Name').addText(text => {
      text.setValue(tmpl.name).onChange(v => tmpl.name = v);
    });

    new Setting(editor).setName('Task Text').setDesc('Use ${var} for variables').addTextArea(ta => {
      ta.setValue(tmpl.text).onChange(v => {
        tmpl.text = v;
        // Auto-detect variables
        const vars = [...v.matchAll(/\$\{(\w+)\}/g)].map(m => m[1]);
        tmpl.variables = [...new Set(vars)];
      });
    });

    new Setting(editor).setName('Owner').addText(text => {
      text.setValue(tmpl.owner).onChange(v => tmpl.owner = v);
    });

    new Setting(editor).setName('Project').addText(text => {
      text.setValue(tmpl.project).onChange(v => tmpl.project = v);
    });

    new Setting(editor).setName('Stage').addDropdown(dd => {
      dd.addOption('', 'None');
      for (const s of STAGES) dd.addOption(s, s);
      dd.setValue(tmpl.stage).onChange(v => tmpl.stage = v);
    });

    new Setting(editor).setName('Priority').addDropdown(dd => {
      dd.addOption('', 'None');
      for (const p of PRIORITIES) dd.addOption(p, p.charAt(0).toUpperCase() + p.slice(1));
      dd.setValue(tmpl.priority).onChange(v => tmpl.priority = v);
    });

    new Setting(editor).setName('Tags').setDesc('Comma-separated').addText(text => {
      text.setValue(tmpl.tags.join(', ')).onChange(v => {
        tmpl.tags = v.split(',').map(t => t.trim()).filter(t => t);
      });
    });

    if (tmpl.variables.length > 0) {
      editor.createEl('p', {
        text: `Variables detected: ${tmpl.variables.map(v => '${' + v + '}').join(', ')}`,
        cls: 'template-vars-info'
      });
    }

    const buttons = editor.createDiv({ cls: 'template-editor-buttons' });
    buttons.createEl('button', { text: 'Cancel' }).addEventListener('click', () => {
      this.editingTemplate = null;
      this.render();
    });
    buttons.createEl('button', { text: 'Save', cls: 'mod-cta' }).addEventListener('click', async () => {
      if (!tmpl.name.trim()) {
        new Notice('Template name is required');
        return;
      }
      const existing = this.plugin.settings.taskTemplates.findIndex(t => t.id === tmpl.id);
      if (existing >= 0) {
        this.plugin.settings.taskTemplates[existing] = tmpl;
      } else {
        this.plugin.settings.taskTemplates.push(tmpl);
      }
      await this.plugin.saveSettings();
      this.editingTemplate = null;
      this.render();
      new Notice('Template saved');
    });
  }
}

/**
 * VariablePromptModal - Prompts user for variable values when applying a template.
 */
export class VariablePromptModal extends Modal {
  private variables: string[];
  private values: Record<string, string> = {};
  private resolve: (values: Record<string, string> | null) => void;

  constructor(app: App, variables: string[], resolve: (values: Record<string, string> | null) => void) {
    super(app);
    this.variables = variables;
    this.resolve = resolve;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: 'Fill Template Variables' });

    for (const v of this.variables) {
      new Setting(contentEl).setName(v).addText(text => {
        text.setPlaceholder(`Enter ${v}...`).onChange(val => this.values[v] = val);
      });
    }

    const buttons = contentEl.createDiv({ cls: 'template-var-buttons' });
    buttons.createEl('button', { text: 'Cancel' }).addEventListener('click', () => {
      this.resolve(null);
      this.close();
    });
    buttons.createEl('button', { text: 'Apply', cls: 'mod-cta' }).addEventListener('click', () => {
      this.resolve(this.values);
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
