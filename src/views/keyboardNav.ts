import { KEYS } from '../types/constants';
import { KeyboardShortcut } from '../types';

// ========================================
// Keyboard Navigation Handler
// ========================================

export interface KeyboardNavOptions {
  itemSelector?: string;
  onSelect?: (element: HTMLElement, index: number) => void;
  onActivate?: (element: HTMLElement, index: number) => void;
}

export class KeyboardNavigationHandler {
  private container: HTMLElement;
  private itemSelector: string;
  private focusedIndex = -1;
  private onSelect?: (element: HTMLElement, index: number) => void;
  private onActivate?: (element: HTMLElement, index: number) => void;

  constructor(container: HTMLElement, options: KeyboardNavOptions = {}) {
    this.container = container;
    this.itemSelector = options.itemSelector ?? '.task-item';
    this.onSelect = options.onSelect;
    this.onActivate = options.onActivate;

    this.setupKeyboardNavigation();
  }

  private getItems(): HTMLElement[] {
    return Array.from(this.container.querySelectorAll(this.itemSelector));
  }

  private setupKeyboardNavigation(): void {
    this.container.addEventListener('keydown', (e) => this.handleKeyDown(e));

    // Ensure container is focusable
    if (!this.container.hasAttribute('tabindex')) {
      this.container.setAttribute('tabindex', '0');
    }

    // Set ARIA attributes
    this.container.setAttribute('role', 'listbox');
    this.container.setAttribute('aria-label', 'Task list');
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const items = this.getItems();
    if (items.length === 0) return;

    switch (event.key) {
      case KEYS.ARROW_DOWN:
        event.preventDefault();
        this.focusNext(items);
        break;

      case KEYS.ARROW_UP:
        event.preventDefault();
        this.focusPrevious(items);
        break;

      case KEYS.HOME:
        event.preventDefault();
        this.focusFirst(items);
        break;

      case KEYS.END:
        event.preventDefault();
        this.focusLast(items);
        break;

      case KEYS.ENTER:
        if (this.focusedIndex >= 0 && items[this.focusedIndex]) {
          event.preventDefault();
          this.onActivate?.(items[this.focusedIndex], this.focusedIndex);
        }
        break;

      case KEYS.SPACE:
        if (this.focusedIndex >= 0 && items[this.focusedIndex]) {
          event.preventDefault();
          this.onSelect?.(items[this.focusedIndex], this.focusedIndex);
        }
        break;

      case KEYS.ESCAPE:
        event.preventDefault();
        this.clearFocus(items);
        break;
    }
  }

  private focusNext(items: HTMLElement[]): void {
    if (this.focusedIndex < items.length - 1) {
      this.setFocus(items, this.focusedIndex + 1);
    }
  }

  private focusPrevious(items: HTMLElement[]): void {
    if (this.focusedIndex > 0) {
      this.setFocus(items, this.focusedIndex - 1);
    } else if (this.focusedIndex === -1 && items.length > 0) {
      this.setFocus(items, items.length - 1);
    }
  }

  private focusFirst(items: HTMLElement[]): void {
    if (items.length > 0) {
      this.setFocus(items, 0);
    }
  }

  private focusLast(items: HTMLElement[]): void {
    if (items.length > 0) {
      this.setFocus(items, items.length - 1);
    }
  }

  private setFocus(items: HTMLElement[], index: number): void {
    // Remove focus from previous item
    if (this.focusedIndex >= 0 && items[this.focusedIndex]) {
      const prevItem = items[this.focusedIndex];
      prevItem.classList.remove('task-focused');
      prevItem.removeAttribute('aria-selected');
    }

    this.focusedIndex = index;
    const item = items[index];

    if (item) {
      item.classList.add('task-focused');
      item.setAttribute('aria-selected', 'true');
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

      this.container.setAttribute('aria-activedescendant', item.id || `task-item-${index}`);
      if (!item.id) {
        item.id = `task-item-${index}`;
      }
    }
  }

  private clearFocus(items: HTMLElement[]): void {
    if (this.focusedIndex >= 0 && items[this.focusedIndex]) {
      const item = items[this.focusedIndex];
      item.classList.remove('task-focused');
      item.removeAttribute('aria-selected');
    }

    this.focusedIndex = -1;
    this.container.removeAttribute('aria-activedescendant');
  }

  destroy(): void {
    this.container.removeAttribute('role');
    this.container.removeAttribute('aria-label');
    this.container.removeAttribute('aria-activedescendant');
  }
}

// ========================================
// Accessibility Helpers
// ========================================

/**
 * Announce a message to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.classList.add('sr-only');
  announcement.textContent = message;

  document.body.appendChild(announcement);

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Get keyboard shortcuts help data
 */
export function getKeyboardShortcuts(): KeyboardShortcut[] {
  return [
    { shortcut: '↑/↓', description: 'Navigate tasks' },
    { shortcut: 'Home/End', description: 'Jump to first/last task' },
    { shortcut: 'Enter', description: 'Open task in editor' },
    { shortcut: 'Space', description: 'Toggle task selection' },
    { shortcut: 'Escape', description: 'Clear selection' },
    { shortcut: 'Ctrl+Shift+T', description: 'Quick add task' },
    { shortcut: '/', description: 'Focus search' },
    { shortcut: '?', description: 'Show keyboard shortcuts' }
  ];
}
