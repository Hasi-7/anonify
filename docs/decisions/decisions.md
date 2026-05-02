# Decision Log

## 2026-05-02 Initial Pre-Hackathon Decisions

- Project name is anonify.
- Hacking has not started.
- Only setup/docs/worktree/dependency manifest work is allowed now.
- Clerk is for organizer auth only.
- Attendees do not need accounts.
- Each event has a unique event key.
- Event keys route attendee submissions to the correct event.
- Admin UI includes Overview, Opt-Out Attendees, Event Photos, Photo Review / Review Queue, and Processing Log.
- Each detection includes confidence.
- Google Drive and Backboard.io are mock-first.
- AI/redaction is mock-first.
- Four work areas are frontend, backend, integrations, and ai-redaction.

## 2026-05-02 Hacking Started

- Hacking has started.
- Product implementation, app scaffolding, dependencies, UI, API routes, models, adapters, and backend logic are allowed.
- The first implementation target is the mocked organizer event-key demo flow with dashboard tabs and mocked photo-review confidence data.
- Real Clerk, Google Drive, Backboard.io, and AI/redaction integrations remain mock-first until the end-to-end demo works.
