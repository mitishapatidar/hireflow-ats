# Jobs List (Figma Frame 04)

## Overview
The Jobs List (`/jobs`) is the agency recruiter and manager command center for managing requisitions, hiring client mandates, recruiter allocations, and active candidate pipelines.

## UI Layout & Components
- **Page Header**: Requisition title, subtitle, breadcrumbs (`Home > Jobs`), and primary "+ Create Job" action modal button.
- **Live Statistics Cards**:
  1. **Open Jobs**: Requisitions currently in `ACTIVE` status accepting candidates.
  2. **On Hold**: Requisitions currently in `PAUSED` status due to client hiring freezes or budget reviews.
  3. **Filled This Month**: Number of mandates filled in the current calendar month (`Asia/Kolkata` time zone UTC boundaries).
  4. **Total Mandates**: Total job count matching the current query filter.
- **Search & Multi-Filter Controls**:
  - Full-text search across job title, sequential code (e.g., `J-201`), client legal company name, recruiter owner, and location.
  - Dropdown filter by status: All, Active, On Hold (Paused), Closed, Draft.
  - Dropdown filter by client company.
  - Dropdown filter by recruiter owner.
  - Reset filters button to clear active predicates.
- **Jobs Table**:
  - Displays job code badge, job title, client company with direct link to Client Record (`/clients/[id]`), owner avatar & name, location & employment type, openings & active candidate count, status badge, and deadline.
  - Quick action shortcuts: "View" link to Job Record (`/jobs/[id]`), Pause (if active), Resume (if paused).
- **Create Job Modal**:
  - Accessible to Recruiters, Managers, and Admins.
  - Form fields: Title, Client selector, cascading Hiring Manager contact dropdown, Openings (>= 1), Employment Type, Location, Salary Range, Owner, Target Deadline, Description, and Requirements.
  - Submitting auto-generates the next sequential code (`J-XXX`), sets status to `DRAFT`, populates default interview rounds, assigns the owner, and redirects to the full job record.
