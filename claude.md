# Task Consolidator - Project Memory

## Current Version: v4.0.0

## v4 Development Roadmap

### Status: COMPLETE - All P0/P1/P2 bugs fixed, all v4 features implemented

---

## Critical Bugs to Fix (P0) - DO FIRST

| # | Bug | File:Line | Impact | Status |
|---|-----|-----------|--------|--------|
| 1 | Empty notification interval callback - reminders never fire | notificationService.ts:50 | Reminders broken | DONE |
| 2 | No bounds check on task insertion line number | taskUpdater.ts:291 | File corruption risk | DONE |
| 3 | No delete confirmation dialogs | taskUpdater.ts:309 | Data loss risk | DONE |
| 4 | JSON.parse without try-catch in kanban drag | kanbanModal.ts:250 | Crash on drag | DONE |
| 5 | `lastNotificationCheck` never updated | notificationService.ts:180 | Timing broken | DONE |

## High Priority Bugs (P1) - DO SECOND

| # | Bug | File:Line | Impact | Status |
|---|-----|-----------|--------|--------|
| 6 | Cache refresh loop stops on first error | taskCache.ts:143 | Partial refresh | DONE |
| 7 | Windows path normalization in exclusions | taskCache.ts:174 | Exclusions fail on Windows | DONE |
| 8 | Date parsing fallback assigns invalid dates | quickAddModal.ts:201 | Bad task data | DONE |
| 9 | Kanban drag-drop has no keyboard alternative | kanbanModal.ts | Accessibility gap | DONE |
| 10 | Unbounded `lastNotifiedTasks` set | notificationService.ts:22 | Memory leak | DONE |

## Medium Priority Issues (P2)

| # | Issue | Area | Status |
|---|-------|------|--------|
| 11 | O(n²) dependency detection | Performance | DONE |
| 12 | Calendar queries per cell (inefficient) | Performance | DONE |
| 13 | Full DOM re-render on refresh | Performance | DONE |
| 14 | Duplicate `openTaskInEditor()` code | Tech Debt | DONE |
| 15 | Missing ARIA labels on calendar/kanban | Accessibility | DONE |
| 16 | Color-only workload indicators | Accessibility | DONE |
| 17 | Project dashboard not keyboard navigable | Accessibility | DONE |

---

## New Features for v4

### Tier 1 - High Value Features
1. **Task Templates** - Save/reuse task structures with variables - DONE
2. **Time Tracking** - Estimates, logging, reports (`[estimate:2h]`, `[logged:1h]`) - DONE
3. **Advanced Search & Saved Filters** - Operators like `owner:John due:thisweek` - DONE
4. **Subtask Progress Indicators** - "3/5 complete" on parent tasks - DONE

### Tier 2 - Nice to Have
5. **Task Comments/Notes** - Add notes without modifying task line - DONE
6. **Workspaces/Views** - Multiple saved view configurations - DONE
7. **Analytics Dashboard** - Completion trends, velocity metrics - DONE

### Tier 3 - Future Consideration
8. **External Integrations** - CSV/JSON/iCal export - DONE
9. **Mobile-Friendly Improvements** - Touch gestures, responsive views - DONE
10. **Smart Suggestions** - Pattern-based owner/priority/tag recommendations - DONE

---

## Development Notes

### Build Commands
```bash
npm run build    # Build plugin
npm run dev      # Watch mode
```

### Key Files
- `src/main.ts` - Plugin entry point
- `src/core/` - TaskCache, TaskParser, TaskUpdater, NotificationService, CommentService, SuggestionService
- `src/views/` - PanelView, KanbanModal, CalendarView, ProjectDashboard, QuickAddModal, TemplateModal, TimeReportModal, ExportModal, WorkspaceModal, CommentModal, SavedFiltersModal
- `src/utils/` - Date, Text, Validation, Dependency, DailyNote, Editor, SearchParser utilities
- `src/types/` - TypeScript interfaces and constants

### Obsidian Vault Location
```
C:\Users\James.Nealon\OneDrive - Quality Transformer and Electronics\Documents\James' Notes\.obsidian\plugins\task-consolidator
```

### GitHub Repository
https://github.com/jamesnealon010687/obsidian-task-consolidator.git

---

## Session History

### v3 Features Completed (Previous Session)
- Calendar View (month/week/day modes, drag-drop rescheduling)
- Daily Note Integration (create/link tasks to daily notes)
- Task Dependencies (`[blocked-by:id]`, `[blocks:id]` syntax)
- Notifications & Reminders (startup summary, periodic checks)
- Project Dashboard (stats, progress bars, project cards)

---

### P0 Bug Fixes (2026-02-19)
- Bug #1: Fixed empty `startCheckInterval()` callback - service now owns the interval with task-fetching callback
- Bug #2: Added bounds check on `atLine` in `createTask()` - rejects out-of-range values
- Bug #3: Added `ConfirmDeleteModal` and confirmation check in `deleteTask()` when `confirmDestructiveActions` is true
- Bug #4: Already fixed (kanban try-catch existed)
- Bug #5: `lastNotificationCheck` now updated after sending notifications in `checkAndNotify()`
- Removed duplicate notification interval from `main.ts` - consolidated into `NotificationService`

### P1 Bug Fixes (2026-02-19)
- Bug #6: Added try-catch around per-file parsing in `refreshAll()` so one bad file doesn't stop the entire cache refresh
- Bug #7: Normalized backslashes to forward slashes in `shouldParseFile()` exclusion checks for Windows compatibility
- Bug #8: Date parsing fallback no longer assigns raw invalid text - only sets date when `parseNaturalDate` returns a valid result
- Bug #9: Added keyboard-accessible move buttons (left/right stage) to kanban task cards alongside drag-drop
- Bug #10: Added max size cap (500) on `lastNotifiedTasks` set to prevent unbounded memory growth

### P2 Bug Fixes (2026-02-19)
- Bug #11: Built `buildShortIdMap()` for O(1) dependency resolution instead of O(n) `expandShortTaskId()` per call
- Bug #12: Added `buildTaskDateMap()` in CalendarView - pre-groups tasks by date once, O(1) lookups per cell
- Bug #13: Split panelView `render()` so header/controls render once; `refresh()` only rebuilds task sections with scroll preservation
- Bug #14: Extracted shared `openTaskInEditor()` to `utils/editorUtils.ts`, replaced duplicates in panelView, kanbanModal, calendarView
- Bug #15: Added `role="grid"`, `role="gridcell"`, `aria-label` to calendar; `role="article"`, `aria-label` to kanban cards and metadata spans
- Bug #16: Added numerical task count text alongside color heatmap in calendar cells, plus workload labels in aria-label
- Bug #17: Added `tabindex="0"`, `role="button"`, `aria-pressed`, Enter/Space keydown handlers to project dashboard cards

### v4 Features (2026-02-19)
- Feature 1 (Templates): `TemplateModal` for CRUD, template selector in QuickAddModal, variable substitution via `VariablePromptModal`
- Feature 2 (Time Tracking): `[estimate:Xh]`/`[logged:Xh]` parsing in taskParser, preservation in taskUpdater, display in panelView, `TimeReportModal` for reports
- Feature 3 (Advanced Search): `parseSearchQuery()` in searchParser.ts with `owner:`, `project:`, `stage:`, `priority:`, `due:`, `tag:`/`#tag`, `file:` operators; saved filter chips in panelView
- Feature 4 (Subtask Progress): `getSubtaskProgress()` utility, "X/Y" badge display in panelView, kanbanModal, calendarView
- Feature 5 (Comments): `CommentService` with plugin data persistence, `CommentModal` for view/add/delete, comment count badges on tasks
- Feature 6 (Workspaces): `Workspace` interface for saving view state, workspace selector dropdown in panelView, `WorkspaceModal` for management
- Feature 7 (Analytics): New "Analytics" tab in ProjectDashboard with CSS bar charts for completion trends, velocity, owner breakdown, priority distribution
- Feature 8 (Export): `ExportModal` with CSV, JSON, iCal format options; Blob URL downloads; filtered export support
- Feature 9 (Mobile): CSS `@media (max-width: 768px)` responsive rules, stacked kanban, larger touch targets, collapsible filters
- Feature 10 (Smart Suggestions): `SuggestionService` with frequency-based analysis, suggestion chips in QuickAddModal for owner/priority/tags

**All v4 roadmap items complete. Build verified.**
