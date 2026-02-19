import { Modal, App, Setting, Notice } from 'obsidian';
import type TaskConsolidatorPlugin from '../main';
import { Task, TaskComment } from '../types';

export class CommentModal extends Modal {
  private plugin: TaskConsolidatorPlugin;
  private task: Task;

  constructor(app: App, plugin: TaskConsolidatorPlugin, task: Task) {
    super(app);
    this.plugin = plugin;
    this.task = task;
  }

  onOpen(): void {
    this.modalEl.addClass('comment-modal');
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Task Comments' });
    contentEl.createEl('p', { text: this.task.text, cls: 'comment-task-text' });

    const comments = this.plugin.commentService?.getCommentsForTask(this.task.id) ?? [];

    // Comments list
    const list = contentEl.createDiv({ cls: 'comment-list' });
    if (comments.length === 0) {
      list.createEl('p', { text: 'No comments yet.', cls: 'comment-empty' });
    } else {
      for (const comment of comments) {
        const item = list.createDiv({ cls: 'comment-item' });
        item.createDiv({ cls: 'comment-text', text: comment.text });
        const meta = item.createDiv({ cls: 'comment-meta' });
        meta.createSpan({ text: new Date(comment.timestamp).toLocaleString(), cls: 'comment-date' });
        meta.createEl('button', { text: '×', cls: 'comment-delete' })
          .addEventListener('click', async () => {
            await this.plugin.commentService?.deleteComment(this.task.id, comment.id);
            this.render();
          });
      }
    }

    // Add comment
    const addContainer = contentEl.createDiv({ cls: 'comment-add' });
    let newText = '';
    new Setting(addContainer)
      .setName('Add Comment')
      .addTextArea(textarea => {
        textarea.setPlaceholder('Write a comment...');
        textarea.onChange(value => newText = value);
      });

    addContainer.createEl('button', { text: 'Add Comment', cls: 'mod-cta' })
      .addEventListener('click', async () => {
        if (!newText.trim()) {
          new Notice('Comment cannot be empty');
          return;
        }
        await this.plugin.commentService?.addComment(this.task.id, newText.trim());
        this.render();
      });

    // Close
    contentEl.createEl('button', { text: 'Close' })
      .addEventListener('click', () => this.close());
  }
}
