# Submission Permissions & Role-Based Access Control

## Access Matrix
- **ADMIN / MANAGER:** Full visibility across all tenant submissions; only Managers and Admins can approve submissions (`POST /api/submissions/:id/approval/review`).
- **RECRUITER:** Can create, edit profile versions, and send submissions for jobs they own (`ownerId`) or are assigned to via `JobAssignment`. Unassigned recruiters receive HTTP 403 Forbidden.
- **CLIENT:** External clients are strictly blocked from internal recruiter submission routes (HTTP 403). Client presentation uses client portal routes (Prompt 22).
- **CANDIDATE:** Candidates have no access to client submissions or recruiter notes (HTTP 403).
