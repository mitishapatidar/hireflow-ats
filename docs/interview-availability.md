# Panel Availability & Free/Busy Checking

## 1. Provider Abstraction
The `CalendarAvailabilityProvider` defines the contract for checking internal and external schedule conflicts. In Phase 1, `MockCalendarAvailabilityProvider` evaluates existing database interviews within a 24-hour window.

## 2. Strict Privacy Masking
Availability responses only reveal:
- `FREE`
- `BUSY` (Conflict)
- Proposed conflict slot boundaries (start and end time in IST)

### What is NEVER Exposed:
- Private event titles or meeting topics
- Personal meeting descriptions or agendas
- Unrelated attendee names or client lists
- Calendar notes or confidential discussion items

## 3. Alternative Slot Suggestions
When a conflict is detected for any panel member, the engine automatically checks subsequent hours (+1h, +2h, +3h) and suggests non-conflicting time slots for one-click selection.
