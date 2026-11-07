# HireFlow ATS & CRM — Client Portal (Prompt 22)

## Overview & Architecture
The Client Portal provides external hiring managers and client contacts with a dedicated, secure, role-restricted web experience hosted within the `(client)` route group (`apps/web/src/app/(client)`).

### Key Features
1. **Figma Frame 12 — Client Portal Overview (`/portal`):**
   - Three live, database-backed statistic cards: **Open Positions**, **Profiles Submitted**, **Interviews Scheduled**.
   - Recent submitted profiles table with real-time decision chips (`Pending Review`, `Shortlisted`, `Rejected`, `More Details Requested`).
   - Quick navigation tiles to Positions, Submissions, Interviews, and Reports.

2. **Open Positions & Mandates (`/positions` & `/portal/positions`):**
   - Strictly scoped to positions belonging to the logged-in client organization (`user.clientAccess.clientId`).
   - Search by job title, location, or mandate code.
   - Comprehensive Job Specification slide-over drawer displaying department, openings, employment type, location, and full candidate requirements.

3. **Submitted Candidate Profiles (`/submitted-profiles` & `/portal/submissions`):**
   - Listing of candidates submitted by HireFlow recruiters that have received manager approval (`APPROVAL_NOT_REQUIRED` or `APPROVED`) and are in state `SENT`, `VIEWED_BY_CLIENT`, or `CLIENT_REVIEWED`.
   - Filter by status and position.

4. **Figma Frame 29 — Standard Profile & Client Review (`/portal/submissions/[id]` & `/submitted-profiles/[id]`):**
   - **4 Tabbed Views:**
     - `Executive Summary`: Candidate headline, verified core skills, portfolio/code links.
     - `Experience & Education`: Chronological employment history and verified academic credentials.
     - `Watermarked CV`: Live in-browser document viewer, watermark notice (`HIREFLOW / [CLIENT NAME] / [DATE]`), and tracked download button with quota status.
     - `History & Feedback`: Audit timeline of client decisions and team communications.
   - **Interactive Client Review Actions:**
     - **Shortlist Candidate**: Express client interest and move to client review state.
     - **Reject Candidate**: Strictly requires a mandatory structured reason (minimum 5 characters) and optional feedback.
     - **Request More Details**: Specify missing candidate qualifications or background questions.
     - **Recruitment Team Feedback**: Direct communication channel to HireFlow account recruiters (candidates never receive client notes directly).

5. **Scheduled Interviews (`/portal/interviews`):**
   - Client-safe interview dossier displaying upcoming and completed interview rounds.
   - Formatted in `Asia/Kolkata` (IST) with duration and authorized virtual meeting links.

6. **Progress & Velocity Reports (`/portal/reports`):**
   - Real-time client hiring funnel summary: Open Positions, Profiles Submitted, Pending Review, Shortlisted, Interviews Done, and Positions Filled.
   - Job-by-job mandate progression breakdown table.
