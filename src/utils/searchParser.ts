import { TaskFilterOptions, Priority } from '../types';
import { parseNaturalDate } from './dateUtils';

/**
 * Parse a search query string with operator support.
 * Operators: owner:, project:, stage:, priority:, due:, tag:/#tag, file:
 * Example: "owner:John due:thisweek priority:high #tag search text"
 */
export function parseSearchQuery(query: string): TaskFilterOptions & { searchText?: string } {
  const result: TaskFilterOptions & { searchText?: string } = {};
  let remaining = query;

  // owner:value
  const ownerMatch = remaining.match(/\bowner:(\S+)/i);
  if (ownerMatch) {
    result.owner = ownerMatch[1];
    remaining = remaining.replace(ownerMatch[0], '');
  }

  // project:value
  const projectMatch = remaining.match(/\bproject:(\S+)/i);
  if (projectMatch) {
    result.project = projectMatch[1];
    remaining = remaining.replace(projectMatch[0], '');
  }

  // stage:value
  const stageMatch = remaining.match(/\bstage:(\S+)/i);
  if (stageMatch) {
    result.stage = stageMatch[1];
    remaining = remaining.replace(stageMatch[0], '');
  }

  // priority:value
  const priorityMatch = remaining.match(/\bpriority:(high|medium|low)/i);
  if (priorityMatch) {
    result.priority = priorityMatch[1].toLowerCase() as Priority;
    remaining = remaining.replace(priorityMatch[0], '');
  }

  // due:value (today, thisweek, overdue, none, or specific date)
  const dueMatch = remaining.match(/\bdue:(\S+)/i);
  if (dueMatch) {
    const dueVal = dueMatch[1].toLowerCase();
    if (dueVal === 'today') result.dueDateFilter = 'today';
    else if (dueVal === 'thisweek') result.dueDateFilter = 'thisWeek';
    else if (dueVal === 'overdue') result.dueDateFilter = 'overdue';
    else if (dueVal === 'none') result.dueDateFilter = 'noDueDate';
    else {
      const parsed = parseNaturalDate(dueVal);
      if (parsed) result.dueDate = parsed;
    }
    remaining = remaining.replace(dueMatch[0], '');
  }

  // file:value
  const fileMatch = remaining.match(/\bfile:(\S+)/i);
  if (fileMatch) {
    result.filePath = fileMatch[1];
    remaining = remaining.replace(fileMatch[0], '');
  }

  // tag: or #tag
  const tags: string[] = [];
  const tagOperator = remaining.matchAll(/\btag:(\S+)/gi);
  for (const m of tagOperator) {
    tags.push(m[1].toLowerCase());
    remaining = remaining.replace(m[0], '');
  }
  const hashTags = remaining.matchAll(/#([\w\-_]+)/g);
  for (const m of hashTags) {
    tags.push(m[1].toLowerCase());
    remaining = remaining.replace(m[0], '');
  }
  if (tags.length > 0) result.tags = tags;

  // Remaining text is free-text search
  const cleaned = remaining.replace(/\s+/g, ' ').trim();
  if (cleaned) result.searchText = cleaned;

  return result;
}
