# Shared Corporate Team Signature

## 1. Governance & Permissions
- **Admin-Owned:** Only users with `role: ADMIN` can create, update, or edit the shared corporate team signature HTML.
- **Recruiter Experience:** Recruiters and Managers can view the signature and inspect their live personalized preview, but inputs are locked in read-only mode.
- **Channel Restriction:** The shared signature is strictly applied to **Email messages only**. It is never injected into WhatsApp or SMS channels.

## 2. Dynamic Sender Resolution
- Supported personal sender tokens:
  - `{{name}}`: Sender full name.
  - `{{designation}}`: Sender designation (e.g., Lead Tech Recruiter).
  - `{{organization}}`: Company legal name (e.g., Aureva Capital Private Limited).
  - `{{email}}`: Sender work email address.
  - `{{phone}}`: Optional personal direct line (conditionally removed if omitted).
