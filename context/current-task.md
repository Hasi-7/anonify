# Current Task

Integrations workstream for the anonify core demo.

## Status

Hacking has started.

Product implementation is allowed. The integrations workstream is using `clerkApp/` as the current Next.js + Clerk app setup.

## Goal

Set up safe integration boundaries for the demo while keeping external services mock-first until the flow works end to end.

## First Implementation Task

- Clerk organizer authentication setup in `clerkApp/`.
- Protected organizer route boundaries.
- Public attendee route boundaries.
- Google Drive adapter/mock.
- Backboard.io adapter/mock.
- Environment variable docs.
- Safe missing-key behavior.

## Acceptance Criteria

- `clerkApp/` is treated as the active integration app unless the team decides otherwise.
- Clerk provider and sign-in flow are configured without committing secrets.
- Organizer routes are protected.
- Public attendee routes remain accessible without accounts.
- Missing Clerk or adapter environment variables fail clearly and safely.
- Google Drive and Backboard.io are represented by mock adapters before real API calls.
- Integration setup is documented for the rest of the team.
