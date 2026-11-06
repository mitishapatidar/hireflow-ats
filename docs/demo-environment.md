# HireFlow ATS — Demo Environment & Safe Reset Playbook

**Tenant:** Aureva Capital Private Limited (`aureva-capital`)  
**Target Audience:** Demo Presenters, Sales Engineers, QA Engineers, Client Success  
**Command:** `pnpm demo:reset`  
**Safe Reset Target:** Aureva Capital Private Limited

---

## 1. Safety Architecture & Safeguards

The HireFlow demo reset tool (`packages/db/scripts/demo-reset.ts`) is engineered to guarantee zero accidental data loss while allowing continuous, reproducible customer demonstrations.

### Safeguards:
1. **Tenant Isolation:**
   - The script explicitly targets the demo organization slug `aureva-capital`.
   - Never deletes records belonging to other tenants.
   - Non-demo organizations and system records remain untouched.
2. **Environment Abort Guard:**
   - If `process.env.NODE_ENV === 'production'` or `DATABASE_URL` contains production connection markers, the script immediately halts with exit code 1 unless explicitly overridden with `FORCE_DEMO_RESET=true`.
3. **Zero Hard Delete Rule for Master Records:**
   - Candidates, Clients, and Users are preserved and reconciled via idempotent upserting.
   - Only ephemeral transactional demonstration artifacts (stage histories, mock panel feedback, temporary offers) are reset to the canonical demo baseline.
4. **Post-Reset Integrity Audit:**
   - Verifies all critical model counts and outputs a tabular report before returning a 0 exit status.

---

## 2. Running a Demo Reset

From the repository root:
```bash
pnpm demo:reset
```

### Expected Output Summary:
```text
===============================================================
  HireFlow ATS — Safe Demo Environment Reset                   
  Target Tenant: Aureva Capital Private Limited (aureva-capital)
===============================================================
🔒 Environment safeguard verified. Proceeding with tenant-isolated reset...
🧹 Cleaning demo transactional data for tenant: Aureva Capital Private Limited (org-aureva-1)...
✓ Demo transactions cleanly purged.
🌱 Reseeding canonical HireFlow ATS Foundation via Prisma Seed...
📊 Seeding Sales CRM opportunities, meetings & recruiter daily activity...
===============================================================
  Demo Environment Integrity Verification Summary
===============================================================
✓ Tenant:            Aureva Capital Private Limited (aureva-capital)
✓ Users:             7+
✓ Clients:           4+
✓ Jobs:              8+
✓ Candidates:        60+
✓ Applications:      2+
✓ Interviews:        1+
✓ Submissions:       1+
✓ Placements:        1+
✓ Sales Opps:        1+
✓ Sales Meetings:    1+
✓ Logged Activities: 1+
===============================================================
✅ Demo Environment Successfully Reset & Ready for Client Demo!
```

---

## 3. Demo Persona Credentials

All demo accounts share the standard password: `HireFlow@2026!`

| Role | Name | Email | Persona & Key Permissions |
|---|---|---|---|
| **Admin** | Anika Rao | `anika.rao@hireflow.io` | Full executive permissions, team management, audit logs, billing |
| **Manager** | Riya Desai | `riya.desai@hireflow.io` | Team approvals, submission sign-offs, manager dashboard |
| **Lead Recruiter** | Mitisha Patidar | `mitisha.p@hireflow.io` | Candidate sourcing, pipeline progression, client submissions, scheduling |
| **Recruiter** | Rahul Sharma | `rahul.s@hireflow.io` | Requisitions, tech hiring pipeline, daily activity tracking |
| **Client Portal** | Priya Gupta | `priya.g@acmetech.com` | Acme Technologies SPOC, candidate review, interview feedback |
| **Candidate Portal**| Aarav Shah | `aarav.shah@example.com` | Candidate profile, job applications, interview attendance |
