# Recruiter Dashboard

**Module:** Recruiter Workspace  
**Playbook Phase:** Phase 1 — Prompt 15  
**Figma Reference:** Frame 01 — Recruiter Dashboard  
**Route:** `/dashboard`  
**Tenant:** Aureva Capital Private Limited  

## 1. Overview

The Recruiter Dashboard provides recruiters with a unified cockpit of active hiring pipelines, scheduled agenda, real database-backed productivity indicators, and live candidate events.

## 2. 4 Database-Backed KPI Cards

All cards pull live counts from PostgreSQL via Prisma (never hardcoded mock strings):

1. **Active Jobs**:
   - Number of non-archived jobs with status `ACTIVE`.
   - Delta: Calculated month-over-month (MoM) against previous month's end boundary.
2. **Candidates Pool**:
   - Total non-archived candidate profiles in the agency database.
   - Delta: MoM candidate intake change.
3. **Interviews This Week**:
   - Non-cancelled interviews scheduled within the current Monday–Sunday IST week.
   - Delta: Week-over-week (WoW) comparison against the previous Monday–Sunday IST week.
4. **Placements This Month**:
   - Total successful placements recorded in the current calendar month (IST).
   - Delta: MoM comparison against the previous calendar month.

## 3. Hiring Pipeline Distribution

A horizontal progress visualizer breaking down all active applications across the 7 ATS stages:
- `SOURCED`
- `SCREENING`
- `INTERVIEW`
- `CLIENT_REVIEW`
- `OFFER`
- `PLACED`
- `REJECTED`

Displays count and deterministic percentage of total applications.

## 4. Today's Agenda (IST)

Chronological feed of today's events:
- Candidate Interviews (with round name and counterpart).
- Client Discovery Meetings (with company name and meeting title).
- Sales Follow-ups due today.

## 5. Live Candidate Activity Feed

Recent candidate touchpoints, stage changes, and interview updates pulled directly from `CandidateActivity` records with humanized timestamps (e.g., `25m ago`, `2h ago`).
