# Recruiter Daily Activity & Productivity Tracking

**Module:** Recruiter Workspace  
**Playbook Phase:** Phase 1 — Prompt 15  
**Figma Reference:** Frame 39 — Recruiter Daily Activity  
**Route:** `/activity`  
**Tenant:** Aureva Capital Private Limited  

## 1. Overview

The Recruiter Daily Activity screen enables individual recruiters and agency managers to measure daily outreach volume, candidate touches, and interview pacing against pre-set performance benchmarks.

## 2. 5 Auto-Counted Categories

Counts are computed dynamically for the current day in Indian Standard Time (IST):

1. **Candidates Sourced**:
   - Count of candidate records created by the recruiter today (`Candidate.createdById == user.id && createdAt in today`).
2. **Calls Made**:
   - Count of manual calls logged in `RecruiterActivity` with `type: 'CALL'`.
3. **Emails Sent**:
   - Count of outbound email communications successfully sent today (`Message.direction == OUTBOUND && deliveryStatus not in [DRAFT, FAILED]`).
4. **Client Submissions**:
   - Count of candidate submission profiles submitted to clients today (`Submission.createdById == user.id`).
5. **Interviews Completed**:
   - Count of interviews conducted or organized by the user marked with `outcome: COMPLETED` today.

## 3. Configurable Targets & Velocity Score

Recruiters and managers can configure personal daily targets stored in the `RecruiterTarget` model:
- Default targets: 10 sourced, 20 calls, 15 emails, 3 submissions, 2 interviews.
- Progress percentage: `min(100, round((count / target) * 100))`.
- Overall daily velocity score: Arithmetic average of progress across all 5 categories.

## 4. Manual Activity Logging

Recruiters use the "Log Call / Activity" modal to record:
- Activity type (`CALL`, `MEETING`, `TASK`, `NOTE`).
- Duration in minutes.
- Meeting/call notes and discussion highlights.
- Agreed outcome and next action.
- Associated candidate, client, or opportunity.
- Generates an immutable entry in `RecruiterActivity` and `AuditLog`.
