import { TaskComment } from '../types';

/**
 * CommentService - Stores task comments in plugin data (keyed by task ID).
 */
export class CommentService {
  private comments: Map<string, TaskComment[]> = new Map();
  private loadData: () => Promise<any>;
  private saveData: (data: any) => Promise<void>;

  constructor(
    loadData: () => Promise<any>,
    saveData: (data: any) => Promise<void>
  ) {
    this.loadData = loadData;
    this.saveData = saveData;
  }

  async initialize(): Promise<void> {
    const data = await this.loadData();
    const stored = data?.taskComments ?? {};
    this.comments.clear();
    for (const [taskId, comments] of Object.entries(stored)) {
      this.comments.set(taskId, comments as TaskComment[]);
    }
  }

  getCommentsForTask(taskId: string): TaskComment[] {
    return this.comments.get(taskId) ?? [];
  }

  async addComment(taskId: string, text: string): Promise<TaskComment> {
    const comment: TaskComment = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      taskId,
      text,
      timestamp: Date.now()
    };

    const existing = this.comments.get(taskId) ?? [];
    existing.push(comment);
    this.comments.set(taskId, existing);
    await this.persist();
    return comment;
  }

  async deleteComment(taskId: string, commentId: string): Promise<void> {
    const existing = this.comments.get(taskId) ?? [];
    this.comments.set(taskId, existing.filter(c => c.id !== commentId));
    await this.persist();
  }

  private async persist(): Promise<void> {
    const data = await this.loadData() ?? {};
    const serialized: Record<string, TaskComment[]> = {};
    for (const [taskId, comments] of this.comments) {
      if (comments.length > 0) {
        serialized[taskId] = comments;
      }
    }
    data.taskComments = serialized;
    await this.saveData(data);
  }
}
