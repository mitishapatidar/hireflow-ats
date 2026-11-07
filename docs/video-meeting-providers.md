# HireFlow ATS — Video Meeting Provider Architecture

**Prompt:** Prompt 25  
**Figma Reference:** Frame 27 (Schedule Interview Modal)  
**Tenant:** Aureva Capital Private Limited  

---

## 1. Overview

HireFlow ATS integrates multi-provider video conferencing into interview scheduling workflows. To support enterprise agility and multi-tenant recruiter requirements, the architecture decouples video meeting provisioning through a typed provider interface while maintaining strict transactional data integrity.

Supported providers:
- **Google Meet**
- **Zoom**
- **Microsoft Teams**
- **Deterministic Mock Provider** (for CI/CD, isolated test environments, and development)

---

## 2. Core Provider Interface

All video meeting integrations implement the `VideoMeetingProvider` interface in `@hireflow/shared`:

```typescript
export interface VideoMeetingProvider {
  createMeeting(req: CreateMeetingRequest): Promise<VideoMeetingResult>;
  updateMeeting(meetingId: string, req: Partial<CreateMeetingRequest>): Promise<VideoMeetingResult>;
  cancelMeeting(meetingId: string): Promise<{ success: boolean; error?: string }>;
  getMeeting(meetingId: string): Promise<VideoMeetingResult>;
  validateConnection(): Promise<{ connected: boolean; statusText: string }>;
}
```

### Request & Response Contracts

```typescript
export interface CreateMeetingRequest {
  interviewId: string;
  topic: string;
  startTimeUtc: Date;
  durationMinutes: number;
  timezone: string;
  attendeeEmails: string[];
  idempotencyKey: string;
  organizerEmail?: string;
}

export interface VideoMeetingResult {
  provider: string;
  externalId: string;
  joinUrl: string;
  hostUrl?: string;
  passcode?: string;
  status: 'CREATED' | 'SETUP_REQUIRED' | 'MOCK_MODE' | 'FAILED' | 'CANCELLED';
  errorMessage?: string;
  metadata?: Record<string, any>;
}
```

---

## 3. Critical Post-Persistence Creation Rule

In accordance with HireFlow ATS transactional integrity requirements:

1. **Database Persistence First:** The `Interview` record is saved within an atomic database transaction.
2. **Post-Commit Meeting Generation:** Video meeting creation triggers *only after* the transaction commits successfully.
3. **Failure Isolation:** If a third-party meeting API call times out or fails (e.g., token expiration, API rate limit), the interview is **never lost or rolled back**. The interview retains status `SCHEDULED`, while the linked `VideoMeeting` record receives status `SETUP_REQUIRED` or `FAILED`.
4. **Idempotency:** Meeting creation requests carry a unique idempotency key (`meet:${interview.id}`). Re-dispatching does not create duplicate external meeting rooms.
5. **Recruiter Retry Action:** Recruiter UI exposes a 1-click retry button (`POST /api/interviews/:id/meeting` or `retryVideoMeetingAction`) to re-attempt meeting provisioning or switch providers.

---

## 4. Provider Implementations & Mock Fallback

| Provider | Implementation | Mock Behavior |
| :--- | :--- | :--- |
| **Google Meet** | Google Calendar API v3 Conference Data (`createRequest`) | Returns `https://meet.google.com/mock-aureva-${shortId}` |
| **Zoom** | Server-to-Server OAuth 2.0 (`/users/me/meetings`) | Returns `https://zoom.us/j/9876543210?pwd=mock_${shortId}` |
| **Microsoft Teams** | Microsoft Graph API v1.0 (`/me/onlineMeetings`) | Returns `https://teams.microsoft.com/l/meetup-join/...` |
| **Mock Provider** | Fully isolated deterministic provider for vitest/playwright | Deterministic short codes, validates connections instantly |
