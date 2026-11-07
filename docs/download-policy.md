# HireFlow ATS — Download Policy & Quota Enforcement

## Overview
The Download Policy system (Figma Frame 33 Tab 4) prevents candidate data scraping and unauthorized CV hoarding by enforcing role-based daily limits, Asia/Kolkata boundary resets, and dynamic resume watermarking.

---

## 1. Daily Quota Configuration

Each organization configures policies per user role in the `DownloadPolicy` table:

| Role | Default Daily Quota | Watermark Mandatory | Direct Original Allowed |
|---|---|---|---|
| `RECRUITER` | 20 CVs / day | Yes | No |
| `MANAGER` | 50 CVs / day | Yes | Yes (Configurable) |
| `CLIENT` | 10 CVs / day | Yes | No |
| `ADMIN` | 200 CVs / day | Optional | Yes |

---

## 2. Daily Boundary (Asia/Kolkata — IST)
- All daily quotas reset at 00:00:00 Asia/Kolkata (`UTC+05:30`).
- The system computes the current IST day's UTC boundaries using `getKolkataDayBounds()`:
  - Start: Today 00:00:00 IST converted to UTC.
  - End: Today 23:59:59.999 IST converted to UTC.
- Usage is calculated dynamically from `DownloadLog` entries created within this window where `result = 'SUCCESS'`.

---

## 3. Quota Enforcement Logic
When a CV download or export is requested:
1. Fetch the user's role policy for the organization.
2. Calculate current count of successful downloads in the current IST day window.
3. If `currentUsage >= dailyCvLimit`, reject with `429 Too Many Requests` (`CV_DOWNLOAD_LIMIT_EXCEEDED`) and log `result = 'DENIED'` in `DownloadLog`.
4. If within quota, create a `DownloadLog` entry and return the download stream / signed URL.

---

## 4. Dynamic Watermarking
For client and recruiter downloads where `requireWatermark = true`:
- Resumes are rendered with an explicit diagonal banner pattern:
  `HIREFLOW / [CLIENT LEGAL NAME] / [YYYY-MM-DD]`
- This deters candidate poaching, ensures attribution to HireFlow, and prevents candidates from being circulated without agency authorization.
