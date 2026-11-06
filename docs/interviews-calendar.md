# Interviews Calendar (Figma Frame 06)

## 1. Overview
The Interviews Calendar at `/interviews` provides internal recruiters, hiring managers, and administrators with a centralized 7-day schedule view of all candidate interviews across active job mandates.

## 2. Key Capabilities
- **Asia/Kolkata (IST) Display:** Wall-clock time shown in IST (+05:30), stored in UTC in the database.
- **Week Navigator:** Previous week, next week, today shortcut, and explicit IST week boundary calculation (`getISTWeekBoundaries`).
- **Live Database-Backed Statistics Cards:**
  1. `This Week`: Count of interviews scheduled during the current IST calendar week (excluding cancelled).
  2. `Pending Feedback`: Count of completed interviews where required panel feedback has not been submitted.
  3. `No-shows This Week`: Count of interviews with outcome `NO_SHOW` during the current IST week.
  4. `Calendar Sync`: Accurate provider state (`Setup required / Not connected`), clearly distinguishing mock functionality from future Prompt 25 integrations.
- **Round-Wise Color Coding:**
  - Screening: `#5B49D6` / `#EEEBFB`
  - Technical: `#3B82F6` / `#E5F0FF`
  - Final / Hiring Manager: `#12B76A` / `#E8FAF0`
- **Interactive Event Cards:** Displays candidate name, job title, round name, scheduled time, duration, and status pills (`Scheduled`, `Completed`, `No-show`, `Rescheduled`, `Cancelled`).
