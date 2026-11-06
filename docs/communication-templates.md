# Communication Templates Library

## 1. Structure & Categories
- **Route:** `/communications/templates` (Figma Frame 25)
- **Categories:**
  - `OUTREACH`
  - `INTERVIEW_INVITE`
  - `REJECTION`
  - `OFFER`
  - `FOLLOW_UP`

## 2. Dynamic Merge Fields Engine
- Standard supported tokens:
  - `{{first_name}}`
  - `{{client}}`
  - `{{round}}`
  - `{{date}}`
  - `{{time}}`
  - `{{meeting_link}}`
  - `{{recruiter_name}}`
- **Security & XSS Prevention:** HTML entities are escaped before replacement when rendering email bodies.
- **Warning Indicator:** Missing variable values trigger non-blocking recruiter warnings in preview dialogs.
