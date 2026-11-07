# HireFlow ATS & Recruitment CRM — Bulk Email & SMS Campaigns

## 1. Overview
The Bulk Email & SMS Campaigns module allows agency recruiters and talent leaders to run targeted talent engagement campaigns at scale across Email and SMS channels.

**Figma Reference**: Frame 26 — Bulk Email/SMS Campaigns & Delivery Tracking.

---

## 2. Route Architecture

| Route | Method / Type | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `/communications/campaigns` | Next.js Server Page | Recruiter, Manager, Admin | Campaigns directory with channel tabs, metrics, and logs |
| `/communications/campaigns/new` | Next.js Server Page | Recruiter, Manager, Admin | 3-step campaign creation wizard |
| `/communications/campaigns/:id` | Next.js Server Page | Recruiter, Manager, Admin | Real-time delivery logs, KPI cards, retry failed action |
| `/unsubscribe/:token` | Next.js Public Page | Public (Candidate token) | 1-click marketing unsubscribe & consent management |
| `POST /api/campaigns` | Fastify REST | Recruiter, Manager, Admin | Create or update campaign drafts |
| `POST /api/campaigns/:id/audience` | Fastify REST | Recruiter, Manager, Admin | Calculate and validate candidate audience breakdown |
| `POST /api/campaigns/:id/schedule` | Fastify REST | Recruiter, Manager, Admin | Schedule or trigger immediate dispatch |
| `POST /api/campaigns/:id/cancel` | Fastify REST | Recruiter, Manager, Admin | Abort a scheduled or pending campaign |
| `POST /api/campaigns/:id/retry` | Fastify REST | Recruiter, Manager, Admin | Re-queue failed recipients |
| `POST /api/campaigns/test-send` | Fastify REST | Recruiter, Manager, Admin | In-composer test message dispatch |

---

## 3. 3-Step Campaign Creation Wizard

### Step 1: Audience Target & Validation
- **Basics**: Campaign Name, Outreach Channel (`EMAIL` vs `SMS`), Sender Identity (`HireFlow Talent Team <careers@hireflow.app>`), and optional `replyTo` address.
- **Criteria**: Query search, target jobs list, tags, and required skills.
- **Audience Calculation**: Server-side engine evaluates total matches, validated eligible recipients, and exclusions with pill badges (`NO_EMAIL`, `NO_SMS_CONSENT`, `OPTED_OUT`, `INVALID_FORMAT`).

### Step 2: Message Composition & TRAI DLT Settings
- **Merge Fields**: `{{first_name}}`, `{{job_title}}`, `{{company}}`, `{{unsubscribe_link}}`.
- **Email Channel**: Subject line, rich template selection, preview, and mandatory unsubscribe notice guarantee.
- **SMS Channel**: India TRAI DLT Header/Sender ID (6 alphanumeric characters) + 19-digit registered DLT Template ID + GSM-7 / UCS-2 Unicode character segment counter.
- **In-Composer Test Dispatch**: Recruiters can test email/SMS delivery to a specific inbox or mobile number with sanitized merge tags before scheduling.

### Step 3: Review & Schedule Launch
- Live preview showing actual sample candidate substitution.
- Timezone-aware dispatch scheduling in Indian Standard Time (`Asia/Kolkata` / IST).
- Options for immediate blast or future date/time delivery.

---

## 4. Delivery Monitoring & Retries

- **KPI Cards**: Total Audience, Successfully Delivered, Failed Deliveries, Delivery Rate %.
- **Recipient Delivery Table**: Candidate Name, Masked Destination (Email/Phone), Provider Message ID, Delivery Status (`PENDING`, `DELIVERED`, `FAILED`, `OPTED_OUT`), and Error Reason.
- **Retry Failed Action**: Safely retries only recipients with `FAILED` status without duplicate delivery to successful recipients.
- **Idempotent Queue**: Backed by `CampaignQueueManager` with asynchronous dispatch, audit logging, and transactional database updates.
