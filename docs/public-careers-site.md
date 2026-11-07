# HireFlow ATS & Recruitment CRM — Public Careers Site

## 1. Overview
The Public Careers Site provides candidates with an accessible, branded, mobile-responsive portal to browse open opportunities at Aureva Capital and affiliated clients without requiring authentication.

**Figma Reference**: Frame 42 — Branded Public Careers Site & Job Details.

---

## 2. Route Architecture

| Route | Purpose | Access | Rendering |
| :--- | :--- | :--- | :--- |
| `GET /careers` | Public careers search, filter, and job list | Public (Unauthenticated) | Server-rendered with dynamic client search/filter |
| `GET /careers/:slugOrId` | Public job detail view with role breakdown | Public (Unauthenticated) | SSR with dynamic metadata & JSON-LD |
| `GET /careers/:slugOrId/apply`| Multi-step public job application wizard | Public (Unauthenticated) | Client-interactive wizard with Server Actions |
| `GET /sitemap.xml` | XML sitemap indexing all published active jobs | Search engine crawlers | Next.js dynamic sitemap (`sitemap.ts`) |
| `GET /robots.txt` | Crawler directives allowing `/careers` indexation | Search engine crawlers | Next.js robots handler (`robots.ts`) |

---

## 3. Public Field Allow-List & Zero-Leakage Policy

Public endpoints and server components strictly serialize jobs through `PublicJobCardDTOSchema` and `PublicJobDetailDTOSchema`.

### Permitted Public Fields:
- `id`, `code`, `title`, `slug`, `department`, `location`, `workplaceType`, `employmentType`
- `experienceLevel`, `skills`, `description`, `requirements`, `benefits`
- `isSalaryPublic`, `salaryMin`, `salaryMax`, `salaryCurrency` (only if `isSalaryPublic: true`)
- `publishedAt`, `clientName` (or `"Confidential client"`)

### Strictly Redacted & Scrubbed Fields:
- ❌ Internal candidate notes, recruiter feedback, screening questions
- ❌ Client legal entities, fee percentages, recruiter margins, billing models
- ❌ Recruiter names, recruiter email addresses, recruiter `ownerId`
- ❌ Internal target hire dates, requisition budget ceilings, gross margins
- ❌ Archived or draft jobs (`isPublished: false`, `isArchived: true`, `status !== 'ACTIVE'`)

---

## 4. Confidential Client Protection Rules
Recruitment agencies frequently service confidential mandates or stealth searches.
When a job has `hideClientName: true`:
1. The client's commercial identity is replaced across all UI elements with `"Confidential client"`.
2. The Schema.org `hiringOrganization.name` uses the agency branding name (`Aureva Capital Private Limited`).
3. Search queries on the client's actual legal name return empty matches in public listings.

---

## 5. SEO & Structured Data (Schema.org `JobPosting`)
Every published job detail page renders dynamic open graph metadata and a verified `application/ld+json` script tag adhering to Google Search standards:

```json
{
  "@context": "https://schema.org",
  "@type": "JobPosting",
  "title": "Lead Quantitative Analyst",
  "description": "...",
  "datePosted": "2026-11-07T19:00:00.000Z",
  "employmentType": "FULL_TIME",
  "hiringOrganization": {
    "@type": "Organization",
    "name": "Aureva Capital Private Limited"
  },
  "jobLocation": {
    "@type": "Place",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Mumbai",
      "addressCountry": "IN"
    }
  },
  "baseSalary": {
    "@type": "MonetaryAmount",
    "currency": "INR",
    "value": {
      "@type": "QuantitativeValue",
      "minValue": 4500000,
      "maxValue": 6500000,
      "unitText": "YEAR"
    }
  }
}
```

---

## 6. Branding & Theme Tokens
- Primary Brand Color: `#5B49D6` (Aureva Purple)
- Subtle Background Accent: `#EEEBFB`
- Heading & Body Slate: `#1E2A4A`, `#1B2236`, `#6B7490`
- Surface & Card Backgrounds: `#FFFFFF`, `#F6F7FB`
- Neutral Border System: `#E6E8F0`
