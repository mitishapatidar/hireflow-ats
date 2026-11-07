# HireFlow ATS — Candidate Self-Service Portal

**Prompt:** Prompt 25  
**Figma References:** Frame 14 (Candidate Portal Overview), Frame 48 (Mobile Candidate Portal)  
**Tenant:** Aureva Capital Private Limited  

---

## 1. Overview

The Candidate Portal (`/my-dashboard`) provides applicants with a branded, secure dashboard to track their active recruitment applications, schedule upcoming interviews, join video meeting rooms, and maintain their coordinates.

---

## 2. Core Functional Modules (Frame 14)

1. **Candidate Profile Dossier & Completeness Score:**
   - Visual progress bar calculated dynamically (0–100%) based on name, email, phone, location, current title, company, experience years, and skills.
   - 1-click profile update modal for phone, location, and skills.
2. **Urgent Next Step Action Card:**
   - Surfaces pending slot scheduling invitations prominently with a direct link to `/schedule/[token]`.
   - If an interview is scheduled, surfaces the next call details with a 1-click "Join Video Call" button.
3. **My Applications:**
   - Displays all active applications with candidate-safe status badges:
     - *In Review* (Blue)
     - *Shortlisted* (Purple)
     - *Interview Scheduled* (Purple)
     - *Action Required* (Amber)
     - *Offer Extended* (Emerald)
     - *Archived / Closed* (Gray)
   - Displays client name, location, and application submission date.
4. **Scheduled Interviews:**
   - Lists upcoming interviews with date, start time in IST, duration, video provider, and join button.

---

## 3. Mobile Optimization (Frame 48)

The candidate portal is mobile-responsive and certified across:
- **360px** (Compact Android)
- **390px** (iPhone 14 / standard iOS)
- **768px** (Tablet)

All interactive elements (buttons, links, text inputs) adhere to minimum 44px tap targets with zero horizontal overflow.
