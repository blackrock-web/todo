# Changelog - Personal Productivity Hub

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-07-05
### Added
- **End of Day Synthesis & Planning**:
  - Created `EodReviewModal.tsx` for summarising daily task completion, inputting a reflection journal, and planning tomorrow's milestones.
  - Reflections are stored durably within the local SQLite notes schema under the "Journal" folder.
- **Local Background Scheduling Engine**:
  - Implemented a `setInterval` service running every 10 seconds in `App.tsx` to query SQLite databases.
  - Automatically triggers system browser notifications for active task reminders and target notifications.
  - Monitors the clock to automatically display the End of Day Review modal at a user-defined time.
- **Advanced Productivity Analytics**:
  - Added a GitHub-style 30-day activity completion heatmap.
  - Designed an advanced multi-factor Productivity Score calculation engine displaying a custom circular gauge.
- **Target Custom Categories**:
  - Enhanced the `TargetPlanner` component to support custom categories, colored badges, and category filters.

### Changed
- Refactored `/src/App.tsx` to register background intervals and mount the new EOD review modal.
- Updated `/src/components/AnalyticsView.tsx` with high-performance charts, score gauges, and contribution heatmap tiles.
- Strengthened type definitions inside `/src/types.ts` and SQLite encryption bindings inside `/src/db/sqlite.ts` for target categories.

### Fixed
- Fixed typescript types and naming collisions with the `Target` interface and the lucide `Target` icon.
- Resolved build compilation warnings, ensuring 100% successful offline builds.
