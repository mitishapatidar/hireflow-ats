# Client Workflows & Pipeline Configuration (Figma Frame 32)

## 1. Overview
Different client accounts require customized recruitment workflows. For example, an investment banking client may mandate formal executive rounds and background screening, while a startup may use a lean 3-stage process.

The Client Workflow module (`/clients/[id]/workflow`) allows administrators and managers to configure versioned workflows tailored to each client organization.

## 2. Pipeline Stages Configuration
Stages define the linear progress of candidate applications for a client's mandates:
- **Default Progression:**
  1. `Sourced` (Type: `SOURCING`)
  2. `Screening` (Type: `SCREENING`)
  3. `Interview` (Type: `INTERVIEW`)
  4. `Client Review` (Type: `CLIENT_REVIEW`)
  5. `Offer` (Type: `OFFER`)
  6. `Placed` (Type: `HIRED`)
- **Stage Types:** `SOURCING`, `SCREENING`, `INTERVIEW`, `CLIENT_REVIEW`, `OFFER`, `HIRED`, `REJECTED`, `CUSTOM`.
- **Customization:** Stages can be reordered (move up/down), custom-colored with hex swatches, activated/deactivated, and renamed.

## 3. Interview Rounds Configuration
Defines the template interview structure automatically assigned to jobs created under this client:
- **Round Types:** `SCREENING`, `TECHNICAL`, `HIRING_MANAGER`, `BEHAVIORAL`, `EXECUTIVE`, `FINAL`, `GENERAL`.
- **Durations:** 30 min, 45 min, 60 min, 90 min.
- **Flags:**
  - `isRequired`: Must be passed before advancing to subsequent stages.
  - `isTechnical`: Flags technical coding or architecture panels.
  - `isHiringManager`: Identifies rounds conducted by client hiring managers.
