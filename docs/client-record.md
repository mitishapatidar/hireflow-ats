# HireFlow ATS & Recruitment CRM — Client Record (`/clients/[id]`)

## 1. Overview & Architecture (Figma Frame 22)

The **Client Record** (`/clients/[id]`) provides a comprehensive 360-degree view of an enterprise account relationship for Aureva Capital. It is designed around five dedicated underline-style tabs matching Figma Frame 22.

---

## 2. Header & Master Controls

The top header presents immediate relationship identity:
- **Company Legal Name:** Main heading.
- **Client Code Badge:** `CL-XXXX` (e.g. `CL-1001`).
- **Status Indicator:** `ACTIVE`, `PROSPECT`, `INACTIVE`, or `ARCHIVED`.
- **Industry Badge:** Formatted chip (e.g. `SaaS / AI`).
- **Metadata Elements:**
  - Headquarters / Location (with pin icon)
  - Official Website (outbound link)
  - Relationship Owner (account manager name and role)
  - Next Action Step (highlighted tag with clock icon)
- **Primary Actions:**
  - `Edit Profile`: Opens modal to update company name, industry, website, location, owner, status, and next step.
  - `Archive Client` / `Restore Client`: Soft-archive toggle requiring mandatory explanation for governance.

---

## 3. Five Dedicated Underline Tabs

### Tab 1: Overview
- **Metric Cards:**
  - Active Mandates (`openJobsCount`)
  - Key Contacts (`contactsCount`)
  - Verified Documents (`verifiedCount / totalDocuments`)
  - Scheduled Meetings in 30 days (`meetingsCount`)
- **Company Profile Card:** Displays legal corporate records, official links, location, and account timestamps.
- **Internal Commercial Information Panel:**
  - Clearly designated with lock icon and `CONFIDENTIAL — STRICTLY INTERNAL USE ONLY` banner.
  - Shows agreed fee percentage, payment terms (`NET_30`), commercial guarantee terms, and relationship notes.
  - Restricted to agency internal staff. Modifiable only by users with the `ADMIN` role.

### Tab 2: Contacts
- Displays all client hiring managers, billing stakeholders, and primary contacts.
- Includes Prompt 6 `ClientAccess` portal indicator (`Portal Access Active` vs `No Portal Access`).
- Provides quick modal for adding new contacts with primary flag.

### Tab 3: Jobs
- Lists all active and historical recruitment assignments for this client.
- Shows job code, status badge, openings count, total candidate applications attached, assigned recruiter, and hiring manager contact.

### Tab 4: Documents
- Secure private document store (MSAs, service agreements, rate cards, job descriptions).
- Displays document categories, sequential versioning (`v1`, `v2`), file sizes, and MIME types.
- Verification status badges (`Verified` vs `Unverified`).
- Short-lived signed download URLs (15-minute validity).

### Tab 5: Meetings & Activity
- Unified chronological timeline in `Asia/Kolkata` timezone.
- Combines scheduled meetings (types, status, participants, notes) and immutable audit log entries (client profile updates, commercial terms changes, document uploads, verifications, and archive actions).
