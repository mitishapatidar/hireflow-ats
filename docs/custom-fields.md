# HireFlow ATS — Custom Fields & Client Submission Rules

## Overview
Custom Fields (Figma Frame 33 Tab 2) allow administrators to configure domain-specific attributes on Candidates, Jobs, and Clients without altering PostgreSQL schema or running database migrations.

---

## 1. Supported Data Types & Validation
Custom field values are stored in `CustomFieldValue.valueJson` and validated against their defined schema:

1. **TEXT**: String input with optional minimum/maximum length constraints.
2. **NUMBER**: Numeric value with optional `min` and `max` constraints.
3. **DATE**: ISO-8601 date string format (`YYYY-MM-DD`).
4. **URL**: Valid web URL (`http://` or `https://`).
5. **SELECT**: Single string choice from a defined list of allowed option strings.
6. **MULTI_SELECT**: Array of string choices where every selected value must exist in the allowed options list.

---

## 2. Field Visibility Controls
Each custom field definition has a `visibility` classification:
- **`INTERNAL_ONLY`**: Visible exclusively to agency users (Recruiters, Managers, Admins). Stripped completely from client portal views and client candidate exports.
- **`CLIENT_PROFILE_INCLUDED`**: Included when generating client-facing standardized candidate profiles (Frame 27) and client submission packages.

---

## 3. Client Submission Workflow Rules (Integration with Prompt 18)
Organizations can mandate specific custom fields per client:
- Defined in `ClientCustomFieldRule` (`clientId`, `fieldDefinitionId`, `isRequired`, `workflowVersion`).
- When a candidate submission is initiated for a client (Prompt 18 submission workflow), the backend evaluates all mandatory custom field rules for that client.
- If any required custom field lacks a valid value on the candidate profile, the submission is blocked with `422 Unprocessable Entity` listing missing fields.

---

## 4. Immutability & Archival
- Custom fields cannot be hard-deleted if values exist in the database.
- Instead, fields are soft-archived (`isActive: false`).
- Archived fields retain all historical values on past records but are hidden from new data entry forms.
