# Interview Rounds & Pipeline Stages

## Overview
Every job requisition has an ordered sequence of interview rounds that define the hiring pipeline.

## Round Properties
- **name**: Name of the interview stage (e.g. "Initial Screening", "System Design Architecture").
- **roundOrder**: 1-based sequential position in the pipeline (`1, 2, 3...`).
- **interviewType**: Classification of the stage:
  - `SCREENING` (HR / Recruiter Initial Screen)
  - `TECHNICAL` (Coding, Architecture, System Design)
  - `HIRING_MANAGER` (Direct Manager Evaluation)
  - `CULTURE_FIT` (Values & Team Alignment)
  - `EXECUTIVE` (Partner / Founder Interview)
  - `VIDEO` (General Video Call)
  - `IN_PERSON` (On-site Interview)
- **durationMinutes**: Evaluation duration (15 to 240 minutes, default 45).
- **panelMembers**: String array of interviewers or role titles assigned to this stage.
- **description**: Evaluation criteria and guidelines.
- **isArchived**: Boolean flag for safe deactivation.

## Reordering Pipeline Rounds
- Rounds can be reordered at any time by moving stages up or down.
- Reorder operations update `roundOrder` transactionally using `reorderJobRoundsAction` / `POST /api/jobs/:id/rounds/reorder`.

## Safe Deactivation (Soft Archiving Mandate)
- In accordance with ATS security commandments, interview rounds are **never hard-deleted**.
- Deleting a round sets `isArchived: true`.
- Deactivated rounds are filtered out of future stage selections while completely preserving historical interview records, feedback scores, and panel notes from past candidates.
