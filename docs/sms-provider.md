# SMS Gateway Abstraction

## 1. Provider Landscape
- **Domestic (India):** Telecom Regulatory Authority of India (TRAI) Distributed Ledger Technology (DLT) compliance with registered Header IDs and template hashes.
- **International:** Twilio Programmable SMS fallback.

## 2. ATS Safety Standards
- SMS is reserved exclusively for time-critical interview reminders and verification alerts.
- Messages are tracked with unique `mock-sms-[hex]` IDs in Phase 1 with explicit `Demo mode` indicators.
