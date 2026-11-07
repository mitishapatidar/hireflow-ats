# Automation Rules Engine

## Overview
The Automation Rules engine (Figma Frame 36 at `/admin/automation`) provides an administrative interface for creating event-driven and scheduled triggers across recruitment workflows.

## Rule Structure
Each `AutomationRule` comprises:
1. **Trigger Configuration**:
   - `triggerType`: `EVENT` or `SCHEDULE`.
   - `triggerEvent`:
     - `INTERVIEW_SCHEDULED_24H_BEFORE`: 24 hours prior to interview start time.
     - `INTERVIEW_SCHEDULED_30M_BEFORE`: 30 minutes prior to interview start time.
     - `TASK_REMINDER_15M_BEFORE`: 15 minutes before task due time.
     - `CANDIDATE_STATUS_CHANGED`: Real-time candidate stage progression.
     - `DAILY_PENDING_ACTION_DIGEST`: Weekday 08:30 IST pending action digest.
     - `INBOUND_RESUME_INGESTED`: Triggers recruiter alert for pending resume review.
2. **Client Scoping & Isolation**:
   - `clientScope`: Restricts the rule to a specific client organization. Client A rules never fire for Client B candidates or submissions.
   - Global rules (`clientScope: null`) apply universally across the tenant.
3. **Recipients & Channels**:
   - `recipients`: Array of recipient targets (`CANDIDATE`, `RECRUITER`, `HIRING_MANAGER`, `CLIENT_CONTACT`, `SPECIFIC_USER`).
   - `channels`: Array of communication channels (`IN_APP`, `EMAIL`, `WHATSAPP`).
4. **Message Template & Merge Fields**:
   - `templateSubject`: Email subject or notification header.
   - `templateBody`: Markdown or plain-text body supporting dynamic tokens.
   - **Supported Whitelisted Merge Fields**:
     - `{first_name}`, `{candidate_name}`, `{job_title}`, `{client}`, `{round}`, `{date}`, `{time}`, `{meeting_link}`, `{recruiter_name}`, `{task_title}`, `{due_date}`.
   - **Candidate-Safe Sanitization**:
     - When sending to candidates (`isCandidateFacing: true`), non-candidate tokens are suppressed.
     - Sensitive internal keywords (`margin`, `fee`, `commercial`, `internal note`) are automatically redacted with `[REDACTED]`.
5. **Lifecycle Management**:
   - `status`: `DRAFT` | `ACTIVE` | `PAUSED`.
   - `version`: Monotonically incremented version counter for every edit, providing full audit traceability.
   - Activation requires complete template and recipient configuration.
