# HireFlow ATS — RFC-5545 iCalendar (.ics) Integrations

**Prompt:** Prompt 25  
**Tenant:** Aureva Capital Private Limited  

---

## 1. Overview

To guarantee seamless calendar integration across Google Calendar, Apple Calendar, and Microsoft Outlook, HireFlow ATS generates standards-compliant RFC-5545 iCalendar (`.ics`) MIME attachments upon interview scheduling, rescheduling, and cancellation.

---

## 2. iCalendar Lifecycle & Sequence Handling

```typescript
export function generateIcsCalendarInvite(params: IcsCalendarInviteParams): string
```

### Protocol Specifications
- **MIME Type:** `text/calendar; charset=utf-8; method=REQUEST` (or `method=CANCEL` for cancellations)
- **Time Representation:** All timestamps (`DTSTART`, `DTEND`, `DTSTAMP`, `CREATED`) are formatted in strict UTC: `YYYYMMDDTHHMMSSZ`.
- **Text Escaping:** Commas, semicolons, backslashes, and newlines (`\n`) in summaries and descriptions are escaped in compliance with RFC-5545 Section 3.3.11.
- **Sequence Management:**
  - Initial confirmation: `SEQUENCE: 0`, `METHOD: REQUEST`, `STATUS: CONFIRMED`
  - Rescheduling: `SEQUENCE: 1` (or incremented), `METHOD: REQUEST`, `STATUS: CONFIRMED`
  - Cancellation: `SEQUENCE: 2+`, `METHOD: CANCEL`, `STATUS: CANCELLED`
- **Unique UID:** Persistent UID format: `hireflow-interview-${interviewId}@aurevacapital.com` ensuring calendar clients recognize updates and cancellations for the same meeting entry.
