# Video Meeting Provider Abstraction

## 1. Supported Providers (Mock in Phase 1)
- **Google Meet:** Produces `https://meet.google.com/demo-hf-[shortId]`
- **Zoom:** Produces `https://zoom.us/j/demo-hf-[shortId]`
- **Microsoft Teams:** Produces `https://teams.microsoft.com/l/meetup-join/demo-hf-[shortId]`

## 2. Integrity & Status Disclosure
- Every mock meeting link is stamped with `providerStatus: "DEMO_MODE"`.
- The UI displays explicit callouts: `"Demo mode / Mock provider (Live integrations connect in Prompt 25)"`.
- Real OAuth tokens, API secrets, or credentials are never simulated or committed to repository.
