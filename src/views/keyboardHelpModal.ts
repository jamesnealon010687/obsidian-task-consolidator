import { Modal, App } from 'obsidian';
import { getKeyboardShortcuts } from './keyboardNav';

// ========================================
// Keyboard Help Modal
// ========================================

export class KeyboardHelpModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;

    contentEl.addClass('keyboard-help-modal');
    contentEl.createEl('h2', { text: 'Keyboard Shortcuts' });

    const list = contentEl.createEl('ul', { cls: 'keyboard-help-list' });
    const shortcuts = getKeyboardShortcuts();

    for (const { shortcut, description } of shortcuts) {
      const item = list.createEl('li', { cls: 'keyboard-help-item' });
      item.createEl('kbd', { text: shortcut, cls: 'keyboard-help-key' });
      item.createEl('span', { text: description, cls: 'keyboard-help-description' });
    }

    const closeButton = contentEl.createEl('button', {
      text: 'Close',
      cls: 'mod-cta',
      attr: { 'aria-label': 'Close keyboard shortcuts help' }
    });

    closeButton.style.marginTop = '16px';
    closeButton.addEventListener('click', () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
