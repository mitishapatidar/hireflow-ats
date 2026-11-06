# Client User Provisioning & Least-Privilege Scoping

## Overview
Clients access HireFlow via a dedicated client portal designed to review candidate submissions, submit interview scorecards, and track open hiring mandates.

## Least-Privilege Architecture
Client accounts operate under strict least-privilege principles:
- **No Self-Provisioning**: Client accounts cannot be self-registered; they must be explicitly provisioned by an internal agency administrator.
- **Client Account Lock**: A client user is bound to a single client company (`clientId`). They cannot switch between clients, view other clients' vacancies, or query internal ATS data.
- **Authorized Job Scope (`authorizedJobIds`)**:
  - Administrators specify which job mandates the client user can review.
  - If a recruiter submits a candidate to Job A, and the client reviewer is only authorized for Job B, the candidate profile remains invisible to that reviewer.
- **Watermarked CV Download Limit**:
  - Client contacts have a default download threshold (e.g. 10 CVs / day).
  - All downloaded resumes are dynamically stamped with a client-specific watermark and timestamp to prevent unauthorized external distribution.
- **Strict Read-Only Records**: Client users cannot edit candidate attributes, alter recruiter submission stages, or access candidate contact details (phone, personal email) prior to formal interview scheduling.

## Client Access Management (Figma Frame 30)
Administrators configure client access via the **Client Access** tab (`/admin/team?tab=client`) or the right-rail client invitation card:
1. Provide reviewer name and work email.
2. Select target client company from registered CRM accounts.
3. Select specific authorized job mandates.
4. Review and send the invitation.
