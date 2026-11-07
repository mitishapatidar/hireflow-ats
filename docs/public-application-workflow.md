# HireFlow ATS & Recruitment CRM — Public Application Workflow

## 1. Overview
The Public Application Workflow enables prospective candidates to submit their application for any published job via a multi-step, user-friendly, and accessible flow.

**Figma Reference**: Frame 43 — Public Application Workflow & Confirmation.

---

## 2. Multi-Step Application Stages

The application wizard is structured across 5 distinct phases:

1. **Step 1: Role Summary**:
   - Displays position title, location, employment type, salary (if public), and key requirements.
   - Primary action: "Continue to Personal Details".
2. **Step 2: Personal Details**:
   - First Name, Last Name, Email, Phone Number, Current Location.
   - Validation: Strict RFC 5322 email regex, E.164 phone normalization, non-empty text.
3. **Step 3: Resume & Professional Profile**:
   - Drag-and-drop resume uploader (PDF/DOC/DOCX up to 10 MB).
   - LinkedIn Profile URL, Portfolio / GitHub URL, Notice Period (days), Expected Compensation.
4. **Step 4: Review & Consent**:
   - Comprehensive summary of entered information and uploaded document name.
   - GDPR / Privacy consent checkbox: "I consent to Aureva Capital processing my personal data for recruitment purposes".
   - Terms and verification confirmation.
5. **Step 5: Confirmation & Reference**:
   - Success state displaying unique reference number: `APP-${job.code}-${application.id.slice(0, 8).toUpperCase()}`.
   - Instructions on next steps and automated email delivery notice.

---

## 3. Server-Persisted Draft Lifecycle

Candidates can save their progress at any stage prior to final submission:
- **Token Generation**: Cryptographically secure 64-character hexadecimal token (`crypto.randomBytes(32).toString('hex')`).
- **Persistence**: Persisted in the `ApplicationDraft` database table along with form JSON and uploaded `resumeKey`.
- **Decoupling**: Draft records **do not** create candidate, application, or pipeline stage records. They remain completely invisible to recruiters until submitted.
- **Expiry**: Drafts automatically expire after 30 days (`expiresAt`).
- **Resumption**: Candidates can resume via `/careers/:slugOrId/apply?draft=<64-char-token>`.

---

## 4. Re-Application & Duplicate Handling (Playbook Rule)

When an applicant submits an application with an email that already exists in the system:
1. **Existing Candidate Record**: Found via `organizationId` and normalized `email`.
2. **Existing Application Check**:
   - If the candidate has **already applied** to this specific job:
     - The existing `Application` record is updated (`appliedAt = now()`, `stage = 'APPLIED'`).
     - A new `CandidateDocument` is attached to their profile for the newly submitted resume.
     - An `ApplicationStageHistory` record is appended: `Re-applied via Public Careers Site with updated resume`.
     - The existing `referenceNumber` is retained or refreshed, avoiding duplicate application clutter in the recruiter pipeline.
   - If applying to a **new job**:
     - A new `Application` is created in stage `APPLIED`.
     - A new `referenceNumber` is generated.
     - Contact details (phone, location, LinkedIn) on the existing `Candidate` profile are updated.

---

## 5. Reference Number Format

Every application receives an immutable, human-readable reference number:
- Format: `APP-{jobCode}-{hash}`
- Example: `APP-J-201-B7E28A19`
- Uses: Candidates can quote this reference number during correspondence or status checks.

---

## 6. Post-Commit Transactional Notification Dispatch

Upon successful application transaction commit:
- The system dispatches an automated branded confirmation email using `MockEmailProvider` or configured transport.
- **Subject**: `Application Received: {jobTitle} (Ref: {referenceNumber})`
- **Body**: Acknowledges submission, confirms job title, provides the unique reference code, and outlines the standard evaluation timeline (typically 5 business days).
