# Notification Preferences & Channel Routing

## Overview
Every user in HireFlow has granular control over how and where they receive notifications across `IN_APP`, `EMAIL`, and `WHATSAPP` channels.

## User Preference Schema
Stored in `NotificationPreference` model:
- `userId`: Link to the authenticated user.
- `inAppEnabled`: Master toggle for in-app drawer and notification center notifications (defaults to `true`).
- `emailEnabled`: Master toggle for external email notifications (defaults to `true`).
- `whatsAppEnabled`: Master toggle for WhatsApp messages (defaults to `false`, requires phone number & verified consent).
- `whatsAppConsent`: Explicit boolean opt-in timestamp and agreement flag.
- `categories`: JSON configuration specifying per-category channel overrides:
  - `INTERVIEW`: `{ inApp: true, email: true, whatsApp: false }`
  - `APPROVAL`: `{ inApp: true, email: true, whatsApp: false }`
  - `TASK`: `{ inApp: true, email: false, whatsApp: false }`
  - `CANDIDATE`: `{ inApp: true, email: false, whatsApp: false }`
  - `SYSTEM`: `{ inApp: true, email: true, whatsApp: false }`

## Mandatory Security & System Overrides
To ensure regulatory compliance and platform security:
- **Critical Security Alerts**: Password changes, 2FA/OTP login alerts, account deactivations, and data export ready notifications cannot be silenced.
- The server-side notification dispatcher forces `inApp: true` and `email: true` on `CRITICAL` priority events regardless of user opt-outs.

## WhatsApp Consent Enforcement
In accordance with Indian telecommunications regulations (TRAI/DND) and anti-spam standards:
- WhatsApp messages are only dispatched if `whatsAppEnabled === true` AND `whatsAppConsent === true`.
- If consent is missing, messages automatically downgrade to `EMAIL` or `IN_APP` with an advisory note in the notification log.
