# Approval Permissions & Reporting Line Authorization

## 1. Permission Matrix

| Role | Access Manager Overview (`/manager`) | Access Approval Center (`/approvals`) | Approve Submissions | Approve Job Mandates | Configure Client Workflows (`/workflow`) |
|---|---|---|---|---|---|
| `ADMIN` | Full (All Teams) | Full (All Teams) | Yes (Except Self) | Yes (Except Self) | Yes (Create, Edit, Publish) |
| `MANAGER` | Scoped (Reporting Line) | Scoped (Reporting Line) | Yes (Except Self) | Yes (Except Self) | Yes (Create, Edit, Publish) |
| `RECRUITER` | No (HTTP 403 / Redirect) | No (HTTP 403 / Redirect) | No | No (Can submit for approval) | View Only |
| `CLIENT` | No | No | No (Client Review Only) | No | No |
| `CANDIDATE` | No | No | No | No | No |

## 2. Recursive Subordinate Resolution
When a manager accesses the Manager Overview or Approval Center, items are filtered to the manager's reporting tree:
```typescript
async function getSubordinateUserIds(managerId: string, organizationId: string): Promise<string[]> {
  // Recursively fetches direct reports and indirect reports across all hierarchical levels
}
```
A manager sees:
- Candidate submissions where the candidate owner, job owner, or submission creator reports to them.
- Job mandates where the job owner or creator reports to them.
- Recruiters in their direct and indirect reporting downline.

## 3. Strict Self-Approval Invariant
Under no circumstances may any user—regardless of role—sign off on their own records:
```typescript
assertNotSelfApproval({
  reviewerId: user.id,
  submitterId: submission.createdById,
  jobOwnerId: submission.job.ownerId,
  candidateOwnerId: submission.candidate.ownerId,
});
```
Violations result in immediate server rejection:
```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Self-approval is strictly prevented. Reviewer cannot be the submitter, job owner, or candidate owner.",
  "code": "SELF_APPROVAL_FORBIDDEN"
}
```
