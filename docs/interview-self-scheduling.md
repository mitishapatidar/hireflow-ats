# HireFlow ATS — Candidate Self-Scheduling Engine

**Prompt:** Prompt 25  
**Figma Reference:** Frame 44 (Candidate Slot Booking)  
**Tenant:** Aureva Capital Private Limited  

---

## 1. Overview

HireFlow ATS provides an asynchronous, self-service interview booking system designed to eliminate scheduling friction between recruiters and candidates. Candidates receive a secure, branded link allowing them to select an interview slot based on live panel availability.

---

## 2. Public Booking Architecture (`/schedule/[token]`)

The public booking page operates without requiring the candidate to create a password or pre-authenticate:

1. **Authentication via Cryptographic Token:** The URL contains a 64-character hex token (`/schedule/[token]`). The backend looks up the record by its SHA-256 hash (`tokenHash`).
2. **Dynamic Slot Conflict Resolution:** When rendering available slots, the system evaluates all assigned panel members' current calendars in real-time. If another recruiter books a panelist during one of the offered slots, that slot is automatically rendered disabled/unavailable.
3. **Double-Booking Atomic Protection:** When the candidate clicks "Confirm Interview Booking", the confirmation endpoint executes an atomic database transaction (`$transaction`):
   - Re-verifies that the selected `SlotOption` is available and not booked.
   - Re-verifies that no overlapping interview was scheduled for any panel member during the window.
   - If a race condition occurs, the transaction rolls back immediately and returns HTTP 409 `SLOT_NO_LONGER_AVAILABLE`.
   - On success, it creates the `Interview` record, marks the `SlotOption` selected, transitions `SlotInvitation.status = 'BOOKED'`, and triggers post-persistence meeting link and RFC-5545 `.ics` email dispatch.

---

## 3. UI State Lifecycle (Frame 44)

| State | Trigger | UI Presentation |
| :--- | :--- | :--- |
| **Loading** | Initial page visit | Branded spinner with real-time availability check indicator |
| **Active Selection** | Token valid & `status: 'PENDING'` | Date chips, time slot pills, duration indicator, notes input, and confirm button |
| **Confirmed** | Successful atomic booking | Green checkmark, scheduled time in IST, video meeting join button, calendar invite confirmation |
| **Already Booked** | `status: 'BOOKED'` | Displays previously confirmed interview details with video join link |
| **Expired** | `new Date() > expiresAt` | Clear notice that the invitation has expired, with instructions to contact the recruiter |
| **Invalid / Revoked** | Token not found or `status: 'CANCELLED'` | Security warning with invalid link notice |
