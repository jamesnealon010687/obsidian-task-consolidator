import { Task, DependencyStatus, DependencyLink } from '../types';

// ========================================
// Dependency Utilities
// ========================================

/**
 * Create a unique short ID from a full task ID
 * Full ID format: "path/to/file.md:lineNumber"
 * Short ID format: "file:line" (for display/syntax)
 */
export function createShortTaskId(fullId: string): string {
  const match = fullId.match(/([^/\\]+):(\d+)$/);
  if (match) {
    const filename = match[1].replace('.md', '');
    return `${filename}:${match[2]}`;
  }
  return fullId;
}

/**
 * Build a map from short IDs (basename:line) to full IDs (path:line) for O(1) lookups.
 * This replaces the O(n) expandShortTaskId calls in dependency functions.
 */
export function buildShortIdMap(allTasks: Task[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const task of allTasks) {
    const shortId = `${task.file.basename.replace('.md', '')}:${task.lineNumber}`;
    map.set(shortId, task.id);
    // Also map full ID to itself for direct lookups
    map.set(task.id, task.id);
  }
  return map;
}

/**
 * Expand a short task ID to a full ID if possible
 * Uses available tasks to find matching files
 */
export function expandShortTaskId(shortId: string, allTasks: Task[]): string | null {
  // If already a full path, return as-is
  if (shortId.includes('/') || shortId.includes('\\')) {
    return shortId;
  }

  const match = shortId.match(/^([^:]+):(\d+)$/);
  if (!match) return null;

  const [, filename, lineNumber] = match;
  const line = parseInt(lineNumber, 10);

  // Find task with matching filename and line
  for (const task of allTasks) {
    const taskFilename = task.file.basename.replace('.md', '');
    if (taskFilename === filename && task.lineNumber === line) {
      return task.id;
    }
  }

  // Try partial match on filename
  for (const task of allTasks) {
    if (task.file.path.includes(filename) && task.lineNumber === line) {
      return task.id;
    }
  }

  return null;
}

/**
 * Resolve a short ID using the pre-built map (O(1) instead of O(n))
 */
function resolveId(shortId: string, idMap: Map<string, string>): string | null {
  // Direct lookup
  const direct = idMap.get(shortId);
  if (direct) return direct;
  // If it's already a full path, return as-is
  if (shortId.includes('/') || shortId.includes('\\')) {
    return idMap.has(shortId) ? shortId : shortId;
  }
  return null;
}

/**
 * Get dependency status for a task
 */
export function getDependencyStatus(task: Task, allTasks: Task[], idMap?: Map<string, string>): DependencyStatus {
  const shortIdMap = idMap ?? buildShortIdMap(allTasks);
  const taskMap = new Map(allTasks.map(t => [t.id, t]));

  // Check which blocking tasks are still incomplete
  const blockedByTasks: string[] = [];
  for (const blockerId of task.blockedBy) {
    const expandedId = resolveId(blockerId, shortIdMap);
    if (expandedId) {
      const blocker = taskMap.get(expandedId);
      if (blocker && !blocker.completed) {
        blockedByTasks.push(expandedId);
      }
    } else {
      // Unknown task ID - treat as still blocking
      blockedByTasks.push(blockerId);
    }
  }

  // Get tasks that this task blocks
  const blocksTasks: string[] = [];
  for (const blockedId of task.blocks) {
    const expandedId = resolveId(blockedId, shortIdMap);
    if (expandedId) {
      blocksTasks.push(expandedId);
    } else {
      blocksTasks.push(blockedId);
    }
  }

  // Also find tasks that reference this task in their blockedBy
  for (const otherTask of allTasks) {
    if (otherTask.id === task.id) continue;

    for (const blockerId of otherTask.blockedBy) {
      const expandedId = resolveId(blockerId, shortIdMap);
      if (expandedId === task.id && !blocksTasks.includes(otherTask.id)) {
        blocksTasks.push(otherTask.id);
      }
    }
  }

  return {
    isBlocked: blockedByTasks.length > 0,
    blockedByCount: blockedByTasks.length,
    blocksCount: blocksTasks.length,
    blockedByTasks,
    blocksTasks
  };
}

/**
 * Check if completing a task would unblock other tasks
 */
export function getTasksThatWouldBeUnblocked(completedTask: Task, allTasks: Task[]): Task[] {
  const shortIdMap = buildShortIdMap(allTasks);
  const unblockedTasks: Task[] = [];

  for (const task of allTasks) {
    if (task.completed || task.id === completedTask.id) continue;

    for (const blockerId of task.blockedBy) {
      const expandedId = resolveId(blockerId, shortIdMap);
      if (expandedId === completedTask.id) {
        const status = getDependencyStatus(task, allTasks, shortIdMap);
        const remainingBlockers = status.blockedByTasks.filter(id => id !== completedTask.id);
        if (remainingBlockers.length === 0) {
          unblockedTasks.push(task);
        }
        break;
      }
    }
  }

  return unblockedTasks;
}

/**
 * Get all dependency links for visualization
 */
export function getAllDependencyLinks(allTasks: Task[]): DependencyLink[] {
  const shortIdMap = buildShortIdMap(allTasks);
  const links: DependencyLink[] = [];
  const seen = new Set<string>();

  for (const task of allTasks) {
    for (const blockerId of task.blockedBy) {
      const expandedId = resolveId(blockerId, shortIdMap);
      const sourceId = expandedId ?? blockerId;
      const linkKey = `${sourceId}->${task.id}`;

      if (!seen.has(linkKey)) {
        seen.add(linkKey);
        links.push({ sourceId, targetId: task.id, type: 'blockedBy' });
      }
    }

    for (const blockedId of task.blocks) {
      const expandedId = resolveId(blockedId, shortIdMap);
      const targetId = expandedId ?? blockedId;
      const linkKey = `${task.id}->${targetId}`;

      if (!seen.has(linkKey)) {
        seen.add(linkKey);
        links.push({ sourceId: task.id, targetId, type: 'blocks' });
      }
    }
  }

  return links;
}

/**
 * Detect circular dependencies
 * Returns the cycle path if found, null otherwise
 */
export function detectCircularDependency(
  task: Task,
  allTasks: Task[],
  visited: Set<string> = new Set(),
  path: string[] = [],
  idMap?: Map<string, string>
): string[] | null {
  if (visited.has(task.id)) {
    const cycleStart = path.indexOf(task.id);
    return path.slice(cycleStart).concat(task.id);
  }

  visited.add(task.id);
  path.push(task.id);

  const shortIdMap = idMap ?? buildShortIdMap(allTasks);
  const taskMap = new Map(allTasks.map(t => [t.id, t]));

  for (const blockedId of task.blocks) {
    const expandedId = resolveId(blockedId, shortIdMap);
    const blockedTask = expandedId ? taskMap.get(expandedId) : null;

    if (blockedTask) {
      const cycle = detectCircularDependency(blockedTask, allTasks, new Set(visited), [...path], shortIdMap);
      if (cycle) return cycle;
    }
  }

  for (const otherTask of allTasks) {
    if (otherTask.id === task.id) continue;

    for (const blockerId of otherTask.blockedBy) {
      const expandedId = resolveId(blockerId, shortIdMap);
      if (expandedId === task.id) {
        const cycle = detectCircularDependency(otherTask, allTasks, new Set(visited), [...path], shortIdMap);
        if (cycle) return cycle;
      }
    }
  }

  return null;
}

/**
 * Get blocked tasks (tasks that cannot be started)
 */
export function getBlockedTasks(allTasks: Task[]): Task[] {
  return allTasks.filter(task => {
    if (task.completed) return false;
    const status = getDependencyStatus(task, allTasks);
    return status.isBlocked;
  });
}

/**
 * Get ready tasks (tasks that are not blocked and not completed)
 */
export function getReadyTasks(allTasks: Task[]): Task[] {
  return allTasks.filter(task => {
    if (task.completed) return false;
    const status = getDependencyStatus(task, allTasks);
    return !status.isBlocked;
  });
}

/**
 * Sort tasks by dependency order (tasks that block others come first)
 */
export function sortByDependencyOrder(tasks: Task[], allTasks: Task[]): Task[] {
  const shortIdMap = buildShortIdMap(allTasks);
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const sorted: Task[] = [];
  const visited = new Set<string>();

  function visit(task: Task): void {
    if (visited.has(task.id)) return;
    visited.add(task.id);

    for (const blockedId of task.blocks) {
      const expandedId = resolveId(blockedId, shortIdMap);
      const blockedTask = expandedId ? taskMap.get(expandedId) : null;
      if (blockedTask) {
        visit(blockedTask);
      }
    }

    sorted.unshift(task);
  }

  for (const task of tasks) {
    visit(task);
  }

  return sorted;
}

/**
 * Format dependency for display in task line
 */
export function formatDependencyForLine(taskId: string, type: 'blocks' | 'blockedBy'): string {
  const shortId = createShortTaskId(taskId);
  return `[${type === 'blockedBy' ? 'blocked-by' : 'blocks'}:${shortId}]`;
}

/**
 * Add a dependency to a task line
 */
export function addDependencyToLine(
  line: string,
  targetId: string,
  type: 'blocks' | 'blockedBy'
): string {
  const depStr = formatDependencyForLine(targetId, type);

  // Add before any trailing whitespace
  const trimmed = line.trimEnd();
  return trimmed + ' ' + depStr;
}

/**
 * Remove a dependency from a task line
 */
export function removeDependencyFromLine(
  line: string,
  targetId: string,
  type: 'blocks' | 'blockedBy'
): string {
  const shortId = createShortTaskId(targetId);
  const pattern = type === 'blockedBy'
    ? new RegExp(`\\s*\\[blocked-by:[^\\]]*${shortId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\]]*\\]`, 'gi')
    : new RegExp(`\\s*\\[blocks:[^\\]]*${shortId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\]]*\\]`, 'gi');

  return line.replace(pattern, '').trim();
}
