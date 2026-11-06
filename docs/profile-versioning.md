# Profile Versioning & Approval Invalidation

## Version Tagging Convention
Every profile snapshot is strictly immutable and versioned:
- Initial generation: `S-241-v1`
- Recruiter revisions: `S-241-v2`, `S-241-v3`, etc.

## Invalidation Rules
1. **Mandatory Change Summary:** Every new version requires a mandatory change summary explaining what was updated.
2. **Cryptographic Binding:** Each version stores a SHA-256 `contentHash` computed from canonical JSON.
3. **Approval Invalidation:** When a recruiter creates a new version, any prior `APPROVED` status is marked `APPROVAL_INVALIDATED`.
4. **Approval Binding:** Approvals are cryptographically tied to the exact profile version number and content hash. An approval for `v1` never automatically approves `v2`.
