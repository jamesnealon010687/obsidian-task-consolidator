import { App, MarkdownView } from 'obsidian';
import { Task } from '../types';

/**
 * Open a task in the editor and scroll to its line.
 * Shared utility to eliminate duplicate openTaskInEditor() implementations.
 */
export async function openTaskInEditor(app: App, task: Task): Promise<void> {
  await app.workspace.getLeaf(false).openFile(task.file);

  const view = app.workspace.getActiveViewOfType(MarkdownView);
  if (view?.editor) {
    const editor = view.editor;
    editor.setCursor({ line: task.lineNumber, ch: 0 });
    editor.scrollIntoView(
      { from: { line: task.lineNumber, ch: 0 }, to: { line: task.lineNumber, ch: 0 } },
      true
    );
  }
}
