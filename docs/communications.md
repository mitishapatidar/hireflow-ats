# Candidate Communications Architecture

## 1. Unified Omnichannel Inbox
- **Route:** `/communications` (Figma Frame 24)
- **Supported Channels:** Email, WhatsApp, and SMS.
- **Split-View Layout:**
  - Left pane displays thread list filtered by channel (`ALL`, `EMAIL`, `WHATSAPP`, `SMS`) with real-time unread badges and search.
  - Right pane renders active candidate conversation with 3 specialized tabs:
    - **Email Thread:** Full email thread history, auto-injected corporate team signatures, attachments, draft preservation, and reply box.
    - **WhatsApp:** Conversational bubble interface with 24-hour customer care window compliance indicators and Meta-approved template selector.
    - **Activity Log:** Comprehensive unified chronological audit timeline of candidate touchpoints (`CandidateActivity`).

## 2. Core Entities
- **Thread:** Connects candidate, job, and assigned recruiter with unread counts and last message timestamp.
- **Message:** Records direction (`INBOUND` / `OUTBOUND`), delivery status (`SENT`, `DELIVERED`, `READ`, `DRAFT`, `FAILED`), provider message ID, and audit metadata.
- **CandidateActivity:** Single source of truth for candidate-facing event history.
