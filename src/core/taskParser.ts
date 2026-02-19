import { TFile, App } from 'obsidian';
import { Task, Recurrence, ParsedMetadata, TaskConsolidatorSettings, Priority } from '../types';
import { PATTERNS, STAGES, PRIORITIES, RECURRENCE_TYPES } from '../types/constants';
import { validateDate, validateOwner, validateProject } from '../utils/validation';
import { calculateIndentDepth } from '../utils/textUtils';

// ========================================
// Recurrence Parsing
// ========================================

/**
 * Parse a recurrence string into a Recurrence object
 */
export function parseRecurrence(recurrenceStr: string): Recurrence | null {
  const text = recurrenceStr.toLowerCase().trim();

  // Simple type match (daily, weekly, monthly, yearly, custom)
  if (RECURRENCE_TYPES.includes(text as any)) {
    return { type: text as any, rawString: recurrenceStr };
  }

  // "every X days/weeks/months/years"
  const intervalMatch = text.match(
    /^every\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)$/
  );

  if (intervalMatch) {
    const interval = parseInt(intervalMatch[1], 10);
    const unit = intervalMatch[2];
    let type: Recurrence['type'] = 'custom';

    if (unit.startsWith('day')) type = 'daily';
    else if (unit.startsWith('week')) type = 'weekly';
    else if (unit.startsWith('month')) type = 'monthly';
    else if (unit.startsWith('year')) type = 'yearly';

    return { type, interval, rawString: recurrenceStr };
  }

  // "every monday,wednesday,friday" or "every mon,wed,fri"
  const daysMatch = text.match(
    /^every\s+((?:mon|tue|wed|thu|fri|sat|sun)(?:day)?(?:,\s*(?:mon|tue|wed|thu|fri|sat|sun)(?:day)?)*)$/
  );

  if (daysMatch) {
    const dayMap: Record<string, number> = {
      sun: 0, sunday: 0,
      mon: 1, monday: 1,
      tue: 2, tuesday: 2,
      wed: 3, wednesday: 3,
      thu: 4, thursday: 4,
      fri: 5, friday: 5,
      sat: 6, saturday: 6
    };

    const daysOfWeek = daysMatch[1]
      .split(',')
      .map(d => d.trim())
      .map(d => dayMap[d.replace(/day$/, '')])
      .filter(d => d !== undefined);

    return { type: 'weekly', daysOfWeek, rawString: recurrenceStr };
  }

  // "weekdays" shorthand
  if (text === 'weekdays') {
    return { type: 'weekly', daysOfWeek: [1, 2, 3, 4, 5], rawString: recurrenceStr };
  }

  // "weekends" shorthand
  if (text === 'weekends') {
    return { type: 'weekly', daysOfWeek: [0, 6], rawString: recurrenceStr };
  }

  return null;
}

// ========================================
// Metadata Parsing
// ========================================

/**
 * Parse metadata from a pipe-delimited string
 */
export function parseMetadataString(
  metadataStr: string,
  customStages: string[] = []
): ParsedMetadata {
  const result: ParsedMetadata = {
    owner: null,
    dueDate: null,
    stage: null,
    project: null,
    priority: null,
    tags: [],
    recurrence: null,
    completedDate: null,
    createdDate: null,
    blockedBy: [],
    blocks: [],
    estimate: null,
    timeLogged: null
  };

  const allStages = [...STAGES, ...customStages];
  const delimiter = '|';

  if (metadataStr.includes(delimiter)) {
    const parts = metadataStr.split(delimiter).map(p => p.trim()).filter(p => p);

    for (const part of parts) {
      // Check for date with optional "Due" prefix
      const dateMatch = part.match(PATTERNS.DATE_WITH_PREFIX);
      if (dateMatch) {
        const validation = validateDate(dateMatch[1]);
        if (validation.isValid && validation.sanitizedValue) {
          result.dueDate = validation.sanitizedValue;
        }
        continue;
      }

      // Check for stage
      if (allStages.includes(part)) {
        result.stage = part;
        continue;
      }

      // Check for priority
      const lower = part.toLowerCase();
      if (PRIORITIES.includes(lower as Priority)) {
        result.priority = lower as Priority;
        continue;
      }

      // Try as owner if not set
      if (!result.owner) {
        const validation = validateOwner(part);
        if (validation.isValid && validation.sanitizedValue) {
          result.owner = validation.sanitizedValue;
          continue;
        }
      }

      // Try as project if not set
      if (!result.project) {
        const validation = validateProject(part);
        if (validation.isValid && validation.sanitizedValue) {
          result.project = validation.sanitizedValue;
        }
      }
    }
  } else {
    // Single value - try to determine type
    if (PATTERNS.DATE.test(metadataStr)) {
      result.dueDate = metadataStr;
    } else if (allStages.includes(metadataStr)) {
      result.stage = metadataStr;
    } else if (PRIORITIES.includes(metadataStr.toLowerCase() as Priority)) {
      result.priority = metadataStr.toLowerCase() as Priority;
    } else {
      result.owner = metadataStr;
    }
  }

  return result;
}

/**
 * Extract inline metadata from task text
 */
export function extractInlineMetadata(text: string): { cleanText: string; metadata: Partial<ParsedMetadata> } {
  let cleanText = text;
  const metadata: Partial<ParsedMetadata> = { tags: [], blockedBy: [], blocks: [], estimate: null, timeLogged: null };

  // Extract completed date
  const completedMatch = cleanText.match(PATTERNS.COMPLETED_DATE);
  if (completedMatch) {
    metadata.completedDate = completedMatch[1];
    cleanText = cleanText.replace(PATTERNS.COMPLETED_DATE, '').trim();
  }

  // Extract created date
  const createdMatch = cleanText.match(PATTERNS.CREATED_DATE);
  if (createdMatch) {
    metadata.createdDate = createdMatch[1];
    cleanText = cleanText.replace(PATTERNS.CREATED_DATE, '').trim();
  }

  // Extract priority
  const priorityMatch = cleanText.match(PATTERNS.PRIORITY);
  if (priorityMatch) {
    metadata.priority = priorityMatch[1].toLowerCase() as Priority;
    cleanText = cleanText.replace(PATTERNS.PRIORITY, '').trim();
  }

  // Extract recurrence
  const recurrenceMatch = cleanText.match(PATTERNS.RECURRENCE);
  if (recurrenceMatch) {
    metadata.recurrence = parseRecurrence(recurrenceMatch[1]);
    cleanText = cleanText.replace(PATTERNS.RECURRENCE, '').trim();
  }

  // Extract blocked-by dependencies
  const blockedByMatches = [...cleanText.matchAll(PATTERNS.BLOCKED_BY)];
  for (const match of blockedByMatches) {
    if (match[1]) {
      // Split by comma for multiple dependencies: [blocked-by:id1,id2]
      const ids = match[1].split(',').map(id => id.trim()).filter(id => id);
      metadata.blockedBy!.push(...ids);
    }
  }
  cleanText = cleanText.replace(PATTERNS.BLOCKED_BY, '').trim();

  // Extract blocks dependencies
  const blocksMatches = [...cleanText.matchAll(PATTERNS.BLOCKS)];
  for (const match of blocksMatches) {
    if (match[1]) {
      const ids = match[1].split(',').map(id => id.trim()).filter(id => id);
      metadata.blocks!.push(...ids);
    }
  }
  cleanText = cleanText.replace(PATTERNS.BLOCKS, '').trim();

  // Extract estimate
  const estimateMatch = cleanText.match(PATTERNS.ESTIMATE);
  if (estimateMatch) {
    metadata.estimate = estimateMatch[1].trim();
    cleanText = cleanText.replace(PATTERNS.ESTIMATE, '').trim();
  }

  // Extract time logged
  const loggedMatch = cleanText.match(PATTERNS.TIME_LOGGED);
  if (loggedMatch) {
    metadata.timeLogged = loggedMatch[1].trim();
    cleanText = cleanText.replace(PATTERNS.TIME_LOGGED, '').trim();
  }

  // Extract tags
  const tagMatches = cleanText.matchAll(PATTERNS.TAGS);
  for (const match of tagMatches) {
    if (match[1]) {
      metadata.tags!.push(match[1].toLowerCase());
    }
  }
  cleanText = cleanText.replace(PATTERNS.TAGS, '').trim();

  // Clean up whitespace
  cleanText = cleanText.replace(/\s+/g, ' ').trim();

  return { cleanText, metadata };
}

// ========================================
// Task Parsing
// ========================================

/**
 * Parse a single line into a Task object
 * Returns null if the line is not a task
 */
export function parseTaskLine(
  line: string,
  file: TFile,
  lineNumber: number,
  customStages: string[] = []
): Task | null {
  const match = line.match(PATTERNS.TASK_LINE);
  if (!match) return null;

  const indent = match[1] ?? '';
  const completed = match[2]?.toLowerCase() === 'x';
  let taskContent = match[3] ?? '';

  // Extract inline metadata (priority, recurrence, tags, dates)
  const { cleanText, metadata: inlineMetadata } = extractInlineMetadata(taskContent);
  taskContent = cleanText;

  // Initialize task metadata
  let taskData: ParsedMetadata = {
    owner: null,
    dueDate: null,
    stage: null,
    project: null,
    priority: inlineMetadata.priority ?? null,
    tags: inlineMetadata.tags ?? [],
    recurrence: inlineMetadata.recurrence ?? null,
    completedDate: inlineMetadata.completedDate ?? null,
    createdDate: inlineMetadata.createdDate ?? null,
    blockedBy: inlineMetadata.blockedBy ?? [],
    blocks: inlineMetadata.blocks ?? [],
    estimate: inlineMetadata.estimate ?? null,
    timeLogged: inlineMetadata.timeLogged ?? null
  };

  let displayText = taskContent;

  // Check for **metadata:** format
  const metadataMatch = taskContent.match(PATTERNS.METADATA);
  if (metadataMatch) {
    const metadataStr = metadataMatch[1].trim();
    displayText = metadataMatch[2]?.trim() ?? '';

    const parsedMetadata = parseMetadataString(metadataStr, customStages);
    taskData = {
      ...taskData,
      ...parsedMetadata,
      // Preserve inline metadata that takes precedence
      priority: taskData.priority ?? parsedMetadata.priority,
      tags: [...new Set([...taskData.tags, ...parsedMetadata.tags])],
      recurrence: taskData.recurrence ?? parsedMetadata.recurrence,
      completedDate: taskData.completedDate ?? parsedMetadata.completedDate,
      createdDate: taskData.createdDate ?? parsedMetadata.createdDate,
      blockedBy: [...new Set([...taskData.blockedBy, ...parsedMetadata.blockedBy])],
      blocks: [...new Set([...taskData.blocks, ...parsedMetadata.blocks])]
    };
  }

  return {
    id: `${file.path}:${lineNumber}`,
    file,
    lineNumber,
    text: displayText,
    completed,
    dueDate: taskData.dueDate,
    owner: taskData.owner,
    stage: taskData.stage,
    project: taskData.project,
    completedDate: taskData.completedDate,
    rawLine: line,
    priority: taskData.priority,
    tags: taskData.tags,
    recurrence: taskData.recurrence,
    parentId: null,
    children: [],
    depth: calculateIndentDepth(indent),
    indent,
    createdDate: taskData.createdDate,
    blockedBy: taskData.blockedBy,
    blocks: taskData.blocks,
    estimate: taskData.estimate ?? inlineMetadata.estimate ?? null,
    timeLogged: taskData.timeLogged ?? inlineMetadata.timeLogged ?? null
  };
}

/**
 * Parse all tasks from a file
 */
export async function parseTasksFromFile(
  app: App,
  file: TFile,
  settings: TaskConsolidatorSettings
): Promise<Task[]> {
  const tasks: Task[] = [];

  try {
    const content = await app.vault.read(file);
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const task = parseTaskLine(line, file, i, settings.customStages);

      if (task) {
        tasks.push(task);
      }
    }
  } catch (error) {
    console.error(`Error parsing tasks from ${file.path}:`, error);
  }

  return tasks;
}

/**
 * Build parent-child relationships for tasks
 */
export function buildTaskHierarchy(tasks: Task[]): Task[] {
  // Sort by file path and line number
  const sorted = [...tasks].sort((a, b) => {
    if (a.file.path !== b.file.path) {
      return a.file.path.localeCompare(b.file.path);
    }
    return a.lineNumber - b.lineNumber;
  });

  const rootTasks: Task[] = [];
  const stack: Task[] = [];

  for (const task of sorted) {
    // Reset task relationships
    task.children = [];
    task.parentId = null;

    // Pop tasks from stack that are not potential parents
    while (
      stack.length > 0 &&
      (stack[stack.length - 1].file.path !== task.file.path ||
       stack[stack.length - 1].depth >= task.depth)
    ) {
      stack.pop();
    }

    // If there's a potential parent and we're indented
    if (stack.length > 0 && task.depth > 0) {
      const parent = stack[stack.length - 1];
      task.parentId = parent.id;
      parent.children.push(task);
    } else {
      rootTasks.push(task);
    }

    stack.push(task);
  }

  return rootTasks;
}
