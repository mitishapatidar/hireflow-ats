# HireFlow ATS & Recruitment CRM — Campaign Consent & TRAI DLT Compliance

## 1. Overview
HireFlow enforces strict data privacy, marketing consent isolation, and statutory telecommunications compliance for all outbound candidate communications.

---

## 2. India TRAI DLT Compliance (Telecom Commercial Communications Customer Preference Regulations)

The Telecom Regulatory Authority of India (TRAI) mandates Distributed Ledger Technology (DLT) registration for all commercial bulk SMS messages delivered in India.

### Rules & Enforcements
1. **Sender ID (Header)**:
   - Must be exactly 6 alphanumeric uppercase characters (e.g., `AUREVA`, `HREFLW`).
   - Validated on schema and API levels via `/^[A-Za-z0-9]{6}$/`.
2. **DLT Template ID**:
   - Must be an approved numeric ID consisting of 11 to 19 digits registered on an Indian telecom operator portal (e.g., Jio, Airtel, Vodafone Idea, BSNL).
   - Validated via `/^\d{11,19}$/`.
3. **Real-Time Segment Counter**:
   - **GSM-7 Character Set**: 160 characters for single SMS, 153 characters per segment for multipart messages.
   - **Unicode / UCS-2 Character Set**: Detected automatically if any non-GSM-7 character is present. 70 characters for single SMS, 67 characters per segment for multipart messages.

---

## 3. Explicit Candidate Marketing Consent Isolation

### Separation of Transactional vs Marketing Outreach
- **Transactional Notices**: Candidates applying for jobs explicitly consent to receive transactional notifications regarding their active job application (interview invites, stage progress, offers).
- **Marketing & Sourcing Campaigns**: General talent community outreach, new role blasts, and newsletter campaigns require explicit marketing opt-in:
  - `Candidate.emailMarketingOptIn` (defaults to `true` on creation, toggleable via unsubscribe).
  - `Candidate.smsOptIn` (strictly required for bulk SMS).
- **Consent Pre-Check**:
  - The audience calculation engine excludes any candidate with `emailMarketingOptIn === false` from email campaigns.
  - SMS campaigns strictly exclude candidates without `smsOptIn === true`.
  - Double-check guard at delivery time: `CampaignQueueManager` re-checks the candidate's consent record in the database immediately prior to message dispatch, preventing race conditions if a candidate unsubscribed after the campaign was scheduled.

---

## 4. Public 1-Click Unsubscribe Workflow

1. Every email campaign includes a cryptographic, URL-safe unsubscribe token:
   `https://hireflow.io/unsubscribe/:token`
2. The public page (`apps/web/src/app/(public)/unsubscribe/[token]/page.tsx`):
   - Validates the candidate token without requiring login credentials.
   - Shows feedback options ("I receive too many emails", "I am no longer looking for a job", "I never signed up").
   - Immediately updates `emailMarketingOptIn = false` and sets `emailMarketingOptOutAt = new Date()`.
   - Reassures candidates that active job application status alerts remain intact while general marketing outreach is halted.
