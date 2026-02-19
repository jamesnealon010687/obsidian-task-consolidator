import { App, TFile, TFolder, normalizePath } from 'obsidian';
import { TaskConsolidatorSettings } from '../types';
import { formatDateToISO, parseISODate, getToday } from './dateUtils';

// ========================================
// Daily Note Utilities
// ========================================

/**
 * Format a date according to the daily note date format setting
 * Supports common format tokens: YYYY, MM, DD, M, D
 */
export function formatDailyNoteDate(date: Date, format: string): string {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString();
  const day = date.getDate().toString();
  const monthPadded = month.padStart(2, '0');
  const dayPadded = day.padStart(2, '0');

  return format
    .replace('YYYY', year)
    .replace('MM', monthPadded)
    .replace('DD', dayPadded)
    .replace('M', month)
    .replace('D', day);
}

/**
 * Parse a daily note filename back to a date
 * Returns null if the filename doesn't match the expected format
 */
export function parseDailyNoteFilename(filename: string, format: string): Date | null {
  // Build a regex pattern from the format
  let pattern = format
    .replace('YYYY', '(\\d{4})')
    .replace('MM', '(\\d{2})')
    .replace('DD', '(\\d{2})')
    .replace('M', '(\\d{1,2})')
    .replace('D', '(\\d{1,2})');

  // Determine the order of year, month, day in the format
  const yearIndex = format.indexOf('YYYY');
  const monthIndex = format.indexOf('MM') !== -1 ? format.indexOf('MM') : format.indexOf('M');
  const dayIndex = format.indexOf('DD') !== -1 ? format.indexOf('DD') : format.indexOf('D');

  const indices = [
    { type: 'year', index: yearIndex },
    { type: 'month', index: monthIndex },
    { type: 'day', index: dayIndex }
  ].sort((a, b) => a.index - b.index);

  const regex = new RegExp(`^${pattern}$`);
  const match = filename.match(regex);

  if (!match) return null;

  let year = 0, month = 0, day = 0;

  indices.forEach((item, i) => {
    const value = parseInt(match[i + 1], 10);
    if (item.type === 'year') year = value;
    else if (item.type === 'month') month = value - 1;
    else if (item.type === 'day') day = value;
  });

  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }

  return date;
}

/**
 * Get the full path to a daily note for a given date
 */
export function getDailyNotePath(date: Date, settings: TaskConsolidatorSettings): string {
  const filename = formatDailyNoteDate(date, settings.dailyNoteDateFormat);
  const folder = settings.dailyNoteFolder.trim();

  if (folder) {
    return normalizePath(`${folder}/${filename}.md`);
  }
  return normalizePath(`${filename}.md`);
}

/**
 * Get today's daily note path
 */
export function getTodaysDailyNotePath(settings: TaskConsolidatorSettings): string {
  return getDailyNotePath(getToday(), settings);
}

/**
 * Check if a daily note exists for a given date
 */
export function dailyNoteExists(app: App, date: Date, settings: TaskConsolidatorSettings): boolean {
  const path = getDailyNotePath(date, settings);
  return app.vault.getAbstractFileByPath(path) instanceof TFile;
}

/**
 * Get the daily note file for a given date, if it exists
 */
export function getDailyNoteFile(app: App, date: Date, settings: TaskConsolidatorSettings): TFile | null {
  const path = getDailyNotePath(date, settings);
  const file = app.vault.getAbstractFileByPath(path);
  return file instanceof TFile ? file : null;
}

/**
 * Create a daily note for a given date if it doesn't exist
 * Returns the file (existing or newly created)
 */
export async function ensureDailyNoteExists(
  app: App,
  date: Date,
  settings: TaskConsolidatorSettings
): Promise<TFile> {
  const path = getDailyNotePath(date, settings);

  // Check if file already exists
  const existingFile = app.vault.getAbstractFileByPath(path);
  if (existingFile instanceof TFile) {
    return existingFile;
  }

  // Ensure the folder exists
  const folder = settings.dailyNoteFolder.trim();
  if (folder) {
    const folderPath = normalizePath(folder);
    const folderExists = app.vault.getAbstractFileByPath(folderPath);
    if (!folderExists) {
      await app.vault.createFolder(folderPath);
    }
  }

  // Create the daily note with a basic template
  const dateStr = formatDailyNoteDate(date, settings.dailyNoteDateFormat);
  const content = `# ${dateStr}\n\n${settings.dailyNoteTasksHeading}\n\n`;

  return await app.vault.create(path, content);
}

/**
 * Find the tasks section in a daily note and return its line number
 * Returns -1 if not found
 */
export function findTasksSectionLine(content: string, heading: string): number {
  const lines = content.split('\n');
  const headingNormalized = heading.trim().toLowerCase();

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().toLowerCase() === headingNormalized) {
      return i;
    }
  }

  return -1;
}

/**
 * Add a task to a daily note under the tasks heading
 */
export async function addTaskToDailyNote(
  app: App,
  date: Date,
  taskText: string,
  settings: TaskConsolidatorSettings
): Promise<TFile> {
  const file = await ensureDailyNoteExists(app, date, settings);
  const content = await app.vault.read(file);
  const lines = content.split('\n');

  // Find the tasks section
  const tasksSectionLine = findTasksSectionLine(content, settings.dailyNoteTasksHeading);

  let newContent: string;

  if (tasksSectionLine === -1) {
    // Tasks section not found, add it at the end
    newContent = content.trim() + '\n\n' + settings.dailyNoteTasksHeading + '\n- [ ] ' + taskText + '\n';
  } else {
    // Find the end of the tasks section (next heading or end of file)
    let insertLine = tasksSectionLine + 1;

    // Skip any blank lines right after the heading
    while (insertLine < lines.length && lines[insertLine].trim() === '') {
      insertLine++;
    }

    // Insert the new task
    lines.splice(insertLine, 0, '- [ ] ' + taskText);
    newContent = lines.join('\n');
  }

  await app.vault.modify(file, newContent);
  return file;
}

/**
 * Get all tasks from a daily note
 */
export async function getTasksFromDailyNote(
  app: App,
  date: Date,
  settings: TaskConsolidatorSettings
): Promise<string[]> {
  const file = getDailyNoteFile(app, date, settings);
  if (!file) return [];

  const content = await app.vault.read(file);
  const lines = content.split('\n');
  const tasks: string[] = [];

  const tasksSectionLine = findTasksSectionLine(content, settings.dailyNoteTasksHeading);
  if (tasksSectionLine === -1) return [];

  // Start reading tasks from after the heading
  for (let i = tasksSectionLine + 1; i < lines.length; i++) {
    const line = lines[i];

    // Stop at the next heading
    if (line.match(/^#+\s/)) break;

    // Check if it's a task
    if (line.match(/^\s*-\s*\[[ x]\]/i)) {
      tasks.push(line);
    }
  }

  return tasks;
}

/**
 * Check if a file is a daily note based on its path and name
 */
export function isDailyNote(file: TFile, settings: TaskConsolidatorSettings): boolean {
  const folder = settings.dailyNoteFolder.trim();
  const expectedFolder = folder ? normalizePath(folder) : '';

  // Check if file is in the daily notes folder
  if (expectedFolder) {
    const fileFolder = file.parent?.path ?? '';
    if (fileFolder !== expectedFolder) return false;
  }

  // Try to parse the filename as a date
  const filename = file.basename;
  return parseDailyNoteFilename(filename, settings.dailyNoteDateFormat) !== null;
}

/**
 * Get the date for a daily note file
 * Returns null if the file is not a valid daily note
 */
export function getDateFromDailyNote(file: TFile, settings: TaskConsolidatorSettings): Date | null {
  if (!isDailyNote(file, settings)) return null;
  return parseDailyNoteFilename(file.basename, settings.dailyNoteDateFormat);
}

/**
 * Create a wikilink to a daily note
 */
export function createDailyNoteLink(date: Date, settings: TaskConsolidatorSettings): string {
  const filename = formatDailyNoteDate(date, settings.dailyNoteDateFormat);
  return `[[${filename}]]`;
}

/**
 * Get all daily notes in the vault
 */
export function getAllDailyNotes(app: App, settings: TaskConsolidatorSettings): TFile[] {
  const folder = settings.dailyNoteFolder.trim();
  const expectedFolder = folder ? normalizePath(folder) : '';

  const files = app.vault.getMarkdownFiles();
  return files.filter(file => {
    // Check folder
    if (expectedFolder) {
      const fileFolder = file.parent?.path ?? '';
      if (fileFolder !== expectedFolder) return false;
    }

    // Check filename
    return parseDailyNoteFilename(file.basename, settings.dailyNoteDateFormat) !== null;
  });
}

/**
 * Get daily notes within a date range
 */
export function getDailyNotesInRange(
  app: App,
  startDate: Date,
  endDate: Date,
  settings: TaskConsolidatorSettings
): Array<{ file: TFile; date: Date }> {
  const allNotes = getAllDailyNotes(app, settings);
  const results: Array<{ file: TFile; date: Date }> = [];

  for (const file of allNotes) {
    const date = parseDailyNoteFilename(file.basename, settings.dailyNoteDateFormat);
    if (date && date >= startDate && date <= endDate) {
      results.push({ file, date });
    }
  }

  return results.sort((a, b) => a.date.getTime() - b.date.getTime());
}
