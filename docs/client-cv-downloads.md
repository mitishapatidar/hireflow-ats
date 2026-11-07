# Client CV Downloads & Watermarking Security (Prompt 22)

## 1. Watermarking Format
Every candidate CV previewed or downloaded through the Client Portal includes an explicit security watermark notice:
`HIREFLOW / [CLIENT NAME] / [DATE]`
Example: `HIREFLOW / ACME CORP / 07 NOV 2026`

## 2. Quota Enforcement & Download Policy
- Client CV downloads are regulated by the organization's `DownloadPolicy` (configured in Data Governance).
- Daily download quotas reset at midnight in the tenant's primary timezone (`Asia/Kolkata`).
- Before serving a file or returning a signed URL:
  1. The server queries `DownloadLog` for downloads performed by the user today.
  2. If `usedToday >= dailyLimit`, the endpoint returns `HTTP 429 Too Many Requests: Daily download limit reached`.
  3. If allowed, an atomic `DownloadLog` entry is recorded with the user ID, candidate ID, file key, and timestamp.
