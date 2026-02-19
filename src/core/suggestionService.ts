import { Task } from '../types';
import { TaskCache } from './taskCache';

export interface Suggestion {
  field: string;
  value: string;
  frequency: number;
}

/**
 * SuggestionService - Pattern-based (no AI API) suggestions.
 * Analyzes existing tasks for frequency patterns.
 */
export class SuggestionService {
  private taskCache: TaskCache;

  constructor(taskCache: TaskCache) {
    this.taskCache = taskCache;
  }

  /**
   * Suggest the most-used owner for a given project.
   */
  suggestOwnerForProject(project: string): Suggestion[] {
    const tasks = this.taskCache.getAllTasks().filter(t => t.project === project && t.owner);
    return this.buildFrequencyList('owner', tasks.map(t => t.owner!));
  }

  /**
   * Suggest the most common priority.
   */
  suggestPriority(): Suggestion[] {
    const tasks = this.taskCache.getAllTasks().filter(t => t.priority);
    return this.buildFrequencyList('priority', tasks.map(t => t.priority!));
  }

  /**
   * Suggest the most common tags.
   */
  suggestTags(): Suggestion[] {
    const allTags: string[] = [];
    for (const task of this.taskCache.getAllTasks()) {
      allTags.push(...task.tags);
    }
    return this.buildFrequencyList('tag', allTags);
  }

  /**
   * Suggest the most common project.
   */
  suggestProject(): Suggestion[] {
    const tasks = this.taskCache.getAllTasks().filter(t => t.project);
    return this.buildFrequencyList('project', tasks.map(t => t.project!));
  }

  /**
   * Get all suggestions for a given project context.
   */
  getSuggestionsForContext(project?: string): {
    owners: Suggestion[];
    priorities: Suggestion[];
    tags: Suggestion[];
    projects: Suggestion[];
  } {
    return {
      owners: project ? this.suggestOwnerForProject(project) : this.buildFrequencyList('owner',
        this.taskCache.getAllTasks().filter(t => t.owner).map(t => t.owner!)),
      priorities: this.suggestPriority(),
      tags: this.suggestTags(),
      projects: this.suggestProject()
    };
  }

  private buildFrequencyList(field: string, values: string[]): Suggestion[] {
    const freq = new Map<string, number>();
    for (const v of values) {
      freq.set(v, (freq.get(v) ?? 0) + 1);
    }
    return [...freq.entries()]
      .map(([value, frequency]) => ({ field, value, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);
  }
}
