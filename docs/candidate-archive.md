# HireFlow ATS — Candidate Soft-Archive & Retention Policy

## 1. Zero Hard Delete Policy (ATS Security Commandment #1)
In recruitment operations, candidate contact histories, historical salary benchmarks, past interview feedback, and submissions are legal records and high-value agency intellectual property.

**Under no circumstances is a `DELETE` query executed against candidate tables.**
Hard deleting candidates, applications, submissions, or client notes is strictly banned in HireFlow ATS.

---

## 2. Soft-Archive Schema & State Fields
Candidate records track archival lifecycle state through dedicated fields on the `Candidate` Prisma model:

| Field | Type | Description |
|---|---|---|
| `isArchived` | `Boolean` | Flag indicating active (`false`) or archived (`true`) state. Default: `false`. |
| `archivedAt` | `DateTime?` | Timestamp when the candidate was archived. |
| `archivedById` | `String?` | Foreign key referencing the `User` who performed the archival. |
| `archiveReason` | `String?` | Structured justification for moving the candidate into the archive. |

---

## 3. Mandatory Archive Reasons
When archiving a candidate via the modal or API, an archive reason is required:
- `Placed elsewhere`: Candidate accepted an offer with an external company.
- `Candidate withdrawn`: Candidate chose to discontinue active job search.
- `Unresponsive`: Candidate failed to respond after 3+ follow-up attempts.
- `Rate mismatch`: Candidate compensation expectations exceeded budget.
- `Skills mismatch`: Candidate skills do not match active mandate profiles.
- `Other`: Custom reason specified in notes.

---

## 4. Query Visibility & Filtering
- **Default Listing:** Archived candidates are automatically excluded from the standard candidate table and pipeline views (`where: { isArchived: false }`).
- **Include Archived Filter:** Users can explicitly view archived records by toggling the `Include archived` checkbox or clicking the `Archived` saved view pill.
- **Audit Logging:** Every archival generates an `AuditLog` entry with action `CANDIDATE_ARCHIVED` and reason metadata.
- **Restore Capability:** Any archived candidate can be restored back to the active talent pool at any time using `restoreCandidateAction` or `POST /api/candidates/:id/restore`. Restoring resets `isArchived: false` and logs `CANDIDATE_RESTORED` in the audit log.
