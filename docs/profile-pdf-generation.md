# Profile PDF & HTML Preview Generation

## HTML Preview
- Endpoint: `GET /api/submissions/:id/profile/preview`
- Sanitized HTML document matching Figma Frame 29 layout.
- Responsive print CSS (`@media print`) enabling browser Print-to-PDF with clean page breaks and zero header/footer artifacts.

## PDF Storage Reference
- PDF snapshots use random storage keys in private object storage (`resumes/` or `submissions/`).
- Direct public URLs are never generated; access uses authenticated streaming endpoints.
