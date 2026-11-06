# Team Management Architecture & Operations

## Overview
HireFlow provides an enterprise team structure tailored for multi-desk recruitment agencies. The team management interface allows workspace administrators to manage internal rosters, assign recruiters to specialized business desks, configure reporting hierarchies, and monitor account lifecycle states.

## Key Capabilities

### 1. Workspace Team Desks
Recruitment teams represent dedicated business lines within Aureva Capital Private Limited:
- **Technology Delivery Desk**: High-volume software engineering, data science, and infrastructure roles.
- **Cross-functional / Unassigned**: General sourcing or executive search recruiters working across multiple client domains.

### 2. Team Member Invitation Flow
New staff members are provisioned using a verified invitation mechanism:
1. **Inviter Authorization**: Only authenticated administrators (`ADMIN`) can invite new internal members.
2. **Domain Allowlist Validation**: Work email must conform to approved corporate email domains (`@aurevacapital.com` or `@hireflow.io`).
3. **Cryptographic Token Issuance**: A 32-byte cryptographically secure random token (`generateSecureToken`) is generated. Only the SHA-256 hash (`tokenHash`) is persisted to PostgreSQL.
4. **Expiry**: Invitations automatically expire after 7 days (168 hours).
5. **Resend / Token Rotation**: Admins can resend invitations at any time. Resending invalidates the prior token, rotates the hash, and resets the 7-day clock.
6. **Revocation**: Admins can revoke pending invitations immediately.

### 3. Account Lifecycle & Status Management
Accounts can exist in two primary states:
- `ACTIVE`: Normal operational status. Users can log in and perform actions permitted by their role.
- `DISABLED`: Account access suspended.

#### Security & Data Preservation Principles
- **Session Revocation**: When an account status is set to `DISABLED`, all active database sessions (`Session` records) are immediately revoked with `revokedAt = new Date()`.
- **Zero Hard Deletion**: Internal team members are never deleted. Sourced candidates, assigned jobs, and historical client feedback authored by the user remain completely intact.
- **Self-Deactivation Guard**: An administrator cannot deactivate their own account, preventing inadvertent lockouts.

## User Interface (Figma Frame 11 & Frame 30)
- **Admin Landing (`/admin`)**: Entry cards for team setup, role matrix, security parameters, integrations, email templates, and audit logs.
- **Team Roster (`/admin/team?tab=team`)**: Member avatars, name, work email, role badge, reporting manager, assigned team, status pill, and action menu.
