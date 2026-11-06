# Job Configuration & Parameters (Figma Frame 21)

## Overview
The Job Configuration view (`/jobs/[id]`) allows recruitment agency staff to configure job parameters, compensation boundaries, client contacts, and role specifications.

## Configuration Parameters
- **Title**: Required job mandate title (2–100 characters).
- **Client Company & Hiring Manager**: Linked to the verified client company and specific client contact.
- **Openings**: Number of target hires (minimum 1).
- **Employment Type**: `FULL_TIME`, `CONTRACT`, `PART_TIME`, `INTERNSHIP`.
- **Location**: Work location or remote/hybrid classification.
- **Salary Range**:
  - `salaryMin` and `salaryMax` in INR (annual).
  - Validated by Zod: `salaryMax >= salaryMin`.
- **Lead Recruiter / Owner**: User responsible for pipeline delivery.
- **Deadline**: Date by which the requisition should be fulfilled.
- **Description & Requirements**: Scope of work, deliverables, and mandatory technical competencies.

## Security & Anti-Leak Serialization
- Configuration endpoints verify user organization boundary (`organizationId: user.organizationId`).
- Anti-leak serializer (`serializeJob`) ensures internal recruiter margin notes, internal fee rates, or private client commercial terms are stripped when viewed by non-internal roles (Client Portal or Candidate Portal).
- Before and after states are logged in `AuditLog` with `action: 'job.update_configuration'`.
