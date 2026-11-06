# Client Workflow Versioning & Immutability

## 1. The Immutability Principle
In recruitment ATS workflows, in-flight candidate submissions and ongoing interview sequences must never be destabilized when client preferences change.

HireFlow implements a **Draft-and-Publish versioning pattern**:
1. Active submissions and vacancies reference an immutable published version number (`version: Int`).
2. Modifications are made to a separate `DRAFT` workflow record (`version: published.version + 1`).
3. While in `DRAFT`, changes do not affect live client pipelines.
4. On **Publish**, the current `PUBLISHED` workflow transitions to `ARCHIVED`, the `DRAFT` transitions to `PUBLISHED`, and an immutable audit log entry is recorded with the manager's change summary.

## 2. Version Audit Trail
Every workflow version captures:
- `version`: Integer sequence (`v1`, `v2`, `v3`...).
- `status`: `DRAFT`, `PUBLISHED`, or `ARCHIVED`.
- `publishedAt`: Timestamp of publication.
- `publishedById`: ID of the approving Manager/Admin.
- `changeSummary`: Human-readable explanation of modifications.
- Complete snapshot of stages, interview rounds, and submission rules.

## 3. Historical Version Inspection
Managers can view exact configurations of any past version at `/clients/[id]/workflow?version=X`. The UI renders the historical stages and rules in read-only snapshot mode.
