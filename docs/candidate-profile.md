# HireFlow ATS — Candidate Profile Specification (Figma Frame 03)

## 1. Overview
The Candidate Profile interface (`/candidates/[id]`) provides a comprehensive 360-degree dossier of a candidate, consolidating contact details, employment history, compensation parameters, technical competencies, interview schedules, client submissions, internal notes, and audit trails.

- **Design Reference:** Figma Frame 03 (`c:\git and github\New folder\New folder\Screenshot 2026-11-05 233525.png`)
- **Route:** `apps/web/src/app/(internal)/candidates/[id]/page.tsx`
- **Client Component:** `apps/web/src/app/(internal)/candidates/[id]/CandidateProfileClientView.tsx`
- **Tenant:** Aureva Capital Private Limited

---

## 2. Layout & Architectural Structure

### A. Breadcrumbs & Top Actions
- **Breadcrumbs:** `Home > Candidates > [Candidate Name]`
- **Header Actions:**
  - `+ Edit candidate`: Launches the full Candidate Edit Modal.
  - `Schedule interview`: Action shortcut launching the interview scheduler (Prompt 11).
  - `More Options (...)`: Dropdown offering `Handover candidate`, `Add tag`, `Archive candidate`, or `Restore candidate`.

### B. Candidate Summary Card (Top Banner)
- **Avatar:** Large monogram avatar with candidate initials (`#EEEBFB` soft background, `#5B49D6` primary text).
- **Name & Stage Badge:** Full candidate name alongside current pipeline stage pill (e.g., `Technical interview`).
- **Headline:** Current job title, current company, location, and years of experience formatted cleanly.
- **Ownership Line:** Assigned recruiter/owner with one-click `Handover` shortcut.

### C. Six Navigation Tabs
Matching Figma Frame 03 specifications:
1. **Overview:** 2-column detailed breakdown (left: Candidate Overview; right: Activity Timeline & Interview History).
2. **Resume:** PDF/DOCX document repository with download options and Prompt 8 AI parser preview.
3. **Activity:** Comprehensive audit trail showing actors, timestamps, IP addresses, and actions.
4. **Interviews:** Chronological schedule of past, active, and upcoming interview rounds.
5. **Submissions:** Client submission history, feedback status, and client contact tracking.
6. **Archive:** Soft-archive audit trail, retention compliance, and restore controls.

---

## 3. Overview Tab — 2-Column Dossier

### Left Column: Candidate Overview
- **Email Address:** Direct mailto link with copy option.
- **Phone Number:** Internationalized contact number with tel link.
- **Current & Expected Compensation:** INR formatted salaries (`formatINR`), visible exclusively to recruiters and managers (strictly hidden from Client Portal).
- **Notice Period:** Availability timeline (e.g. `30 Days`, `Immediate`).
- **Technical Skills:** Categorized skill badges (e.g., `React`, `TypeScript`, `Node.js`).
- **Candidate Tags:** Editable tags with delete icons and an `+ Add tag` button.
- **Internal Confidential Notes:** Recruiter-only notes with author identification, timestamps, and delete controls.

### Right Column: Timeline & Interview History
- **Activity Timeline:** Real-time log of recent stage changes, notes added, and ownership transfers.
- **Interview History:** Cards for each scheduled interview displaying round name, mode (Google Meet, In-person), date, and time.

---

## 4. Modals & Interactive Operations
1. **Edit Candidate Modal:** Real-time form with Zod schema validation allowing updates to name, email, phone, current title, company, experience, notice period, location, salaries, and skills.
2. **Add Note Modal:** Confidential internal notes textarea with `isInternalOnly` privacy flag.
3. **Add Tag Modal:** Quick tag entry supporting multi-tag taxonomies.
4. **Handover Candidate Modal:** Reassign candidate ownership to another recruiter or manager within Aureva Capital with mandatory handover reason.
5. **Archive Candidate Modal:** Soft-archive dialog requiring selection of archive reason (`Placed elsewhere`, `Candidate withdrawn`, `Unresponsive`, `Rate mismatch`, `Skills mismatch`, `Other`).
6. **Restore Candidate Modal:** One-click restoration returning candidate to active talent pool.
