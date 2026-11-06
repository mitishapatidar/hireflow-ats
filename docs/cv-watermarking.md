# CV Watermarking Specification

## Watermark Format
The server-side watermark pattern is:
`HIREFLOW / [CLIENT NAME] / [DATE]`
Example:
`HIREFLOW / AUREVA CAPITAL / 06 NOV 2026`

## Protection Rules
- The watermark text uses the authenticated client identity, preventing browser tampering.
- The original stored candidate resume document is never modified.
- Watermark overlay is applied server-side on preview and presentation.
