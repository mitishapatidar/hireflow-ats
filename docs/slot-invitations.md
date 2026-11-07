# HireFlow ATS — Slot Invitations & Token Hashing Security

**Prompt:** Prompt 25  
**Figma Reference:** Frame 44  
**Tenant:** Aureva Capital Private Limited  

---

## 1. Overview

Slot invitations represent recruiter-proposed interview windows dispatched to candidates. They bridge internal ATS interview planning with candidate self-scheduling while preventing brute-force token harvesting and protecting panelist privacy.

---

## 2. Token Cryptography & Storage

1. **Entropy:** Invitations generate 32 random bytes using Node.js `crypto.randomBytes(32)` formatted as a 64-character hexadecimal string.
2. **SHA-256 Hash Indexing:** In the database, the raw token is indexed using its SHA-256 hash (`tokenHash`).
   - Lookups compare `sha256(rawToken)` against the database index.
   - Prevents exposing raw tokens in database query logs or audit logs.
3. **Expiration:** Every invitation specifies an expiration window (default 48 hours, up to 14 days). Once expired, public booking endpoints reject all booking attempts with HTTP 410 / 400.

---

## 3. Data Privacy & Anti-Leak Controls

The public slot endpoint (`GET /api/slot-invitations/public/slots/:token`) returns only sanitized data required for slot selection (`PublicSlotInvitationDTO`):

- **Exposed:** Candidate first/last name, job title, interview round name, duration (minutes), timezone, and available slot start/end times.
- **Redacted & Protected:** Panel member names, panel emails, other calendar event titles, internal candidate notes, client commercial fees, and recruiter margins are strictly omitted.
