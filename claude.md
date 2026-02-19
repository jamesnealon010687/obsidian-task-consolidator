# Task Consolidator - Project Memory

## Current Version: v3.0.0

## v4 Development Roadmap

### Status: IN PROGRESS - P0 and P1 bugs fixed, continue with P2 or features

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
| 11 | O(n²) dependency detection | Performance | TODO |
| 12 | Calendar queries per cell (inefficient) | Performance | TODO |
| 13 | Full DOM re-render on refresh | Performance | TODO |
| 14 | Duplicate `openTaskInEditor()` code | Tech Debt | TODO |
| 15 | Missing ARIA labels on calendar/kanban | Accessibility | TODO |
| 16 | Color-only workload indicators | Accessibility | TODO |
| 17 | Project dashboard not keyboard navigable | Accessibility | TODO |

---

## New Features for v4

### Tier 1 - High Value Features
1. **Task Templates** - Save/reuse task structures with variables
2. **Time Tracking** - Estimates, logging, reports (`[estimate:2h]`)
3. **Advanced Search & Saved Filters** - Operators like `owner:John due:thisweek`
4. **Subtask Progress Indicators** - "3/5 complete" on parent tasks

### Tier 2 - Nice to Have
5. **Task Comments/Notes** - Add notes without modifying task line
6. **Workspaces/Views** - Multiple saved view configurations
7. **Analytics Dashboard** - Completion trends, velocity metrics

### Tier 3 - Future Consideration
8. **External Integrations** - CSV/JSON export, iCal feed
9. **Mobile-Friendly Improvements** - Touch gestures, responsive views
10. **Smart Suggestions** - AI-powered date/owner/priority recommendations

---

## Development Notes

### Build Commands
```bash
npm run build    # Build plugin
npm run dev      # Watch mode
```

### Key Files
- `src/main.ts` - Plugin entry point
- `src/core/` - TaskCache, TaskParser, TaskUpdater, NotificationService
- `src/views/` - PanelView, KanbanModal, CalendarView, ProjectDashboard
- `src/utils/` - Date, Text, Validation, Dependency, DailyNote utilities
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

**NEXT SESSION: Choose P2 issues or v4 features to implement.**
