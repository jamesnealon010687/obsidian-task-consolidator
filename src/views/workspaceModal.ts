import { Modal, App, Setting, Notice } from 'obsidian';
import type TaskConsolidatorPlugin from '../main';
import { Workspace } from '../types';

/**
 * WorkspaceModal - Manage saved view configurations.
 */
export class WorkspaceModal extends Modal {
  private plugin: TaskConsolidatorPlugin;

  constructor(app: App, plugin: TaskConsolidatorPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    this.modalEl.addClass('workspace-modal');
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Manage Workspaces' });

    const workspaces = this.plugin.settings.workspaces;

    if (workspaces.length === 0) {
      contentEl.createEl('p', { text: 'No saved workspaces. Save the current view as a workspace.', cls: 'workspace-empty' });
    }

    const list = contentEl.createDiv({ cls: 'workspace-list' });
    for (const ws of workspaces) {
      const item = list.createDiv({ cls: 'workspace-item' });
      item.createDiv({ cls: 'workspace-name', text: ws.name });
      const desc = `Sort: ${ws.sortBy} | Group: ${ws.groupBy}`;
      item.createDiv({ cls: 'workspace-desc', text: desc });

      const actions = item.createDiv({ cls: 'workspace-actions' });
      actions.createEl('button', { text: 'Load' }).addEventListener('click', async () => {
        this.plugin.settings.activeWorkspaceId = ws.id;
        this.plugin.settings.sortBy = ws.sortBy;
        this.plugin.settings.groupBy = ws.groupBy;
        this.plugin.settings.showCompleted = ws.showCompleted;
        this.plugin.settings.filterOwner = ws.filterOwner;
        this.plugin.settings.filterProject = ws.filterProject;
        this.plugin.settings.filterStage = ws.filterStage;
        this.plugin.settings.filterPriority = ws.filterPriority;
        this.plugin.settings.filterDueDate = ws.filterDueDate;
        this.plugin.settings.filterTags = ws.filterTags;
        this.plugin.settings.searchQuery = ws.searchQuery;
        await this.plugin.saveSettings();
        new Notice(`Workspace "${ws.name}" loaded`);
        this.close();
      });
      actions.createEl('button', { text: 'Delete', cls: 'mod-warning' }).addEventListener('click', async () => {
        this.plugin.settings.workspaces = workspaces.filter(w => w.id !== ws.id);
        if (this.plugin.settings.activeWorkspaceId === ws.id) {
          this.plugin.settings.activeWorkspaceId = '';
        }
        await this.plugin.saveSettings();
        this.render();
      });
    }

    // Save current as workspace
    const saveSection = contentEl.createDiv({ cls: 'workspace-save' });
    let newName = '';
    new Setting(saveSection)
      .setName('Save Current View')
      .addText(text => text.setPlaceholder('Workspace name').onChange(v => newName = v))
      .addButton(btn => btn.setButtonText('Save').setCta().onClick(async () => {
        if (!newName.trim()) {
          new Notice('Name is required');
          return;
        }
        const ws: Workspace = {
          id: Date.now().toString(36),
          name: newName.trim(),
          sortBy: this.plugin.settings.sortBy,
          groupBy: this.plugin.settings.groupBy,
          showCompleted: this.plugin.settings.showCompleted,
          filterOwner: this.plugin.settings.filterOwner,
          filterProject: this.plugin.settings.filterProject,
          filterStage: this.plugin.settings.filterStage,
          filterPriority: this.plugin.settings.filterPriority,
          filterDueDate: this.plugin.settings.filterDueDate,
          filterTags: [...this.plugin.settings.filterTags],
          searchQuery: this.plugin.settings.searchQuery
        };
        this.plugin.settings.workspaces.push(ws);
        await this.plugin.saveSettings();
        this.render();
        new Notice('Workspace saved');
      }));

    contentEl.createEl('button', { text: 'Close' }).addEventListener('click', () => this.close());
  }
}
