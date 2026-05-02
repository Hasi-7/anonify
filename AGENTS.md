# anonify Agent Guide

## Project Goal

anonify is a privacy-first event photo redaction tool. Organizers will sign in, create events, share event-specific attendee links or QR codes, collect opt-out submissions, and later review event photos where opted-out attendees are blurred or flagged for manual review.

## Current Status

Hacking has started. Product implementation is allowed.

Build the shortest path to a working demo first. Keep changes small, use mocks before real integrations, and avoid chasing production-grade AI or storage until the core flow works end to end.

## Build Rules

- Product features, app scaffolding, API routes, UI components, models, adapters, and backend logic are now allowed.
- Prefer mocked data, mock adapters, and simple in-repo state until the demo flow is clear.
- Configure real Clerk, Google Drive, Backboard.io, and AI integrations only after the mocked demo path works.
- Do not commit secrets, `.env` files, attendee images, or private consent data.
- Keep implementation focused on the current demo task in `context/current-task.md`.

## Future Stack

- Next.js + TypeScript for the main app.
- Clerk for organizer authentication only.
- Optional Python helper for AI/redaction work.
- Google Drive mock adapter first.
- Backboard.io mock adapter first.
- Real integrations only after the core demo works with mocks.

## Commands

- App dev command: not available yet.
- App build command: not available yet.
- App test command: not available yet.
- Python helper command: not available yet.

Add real commands here after the app is scaffolded or when an existing app directory is adopted as the main app.

## Architecture Notes

Plan future implementation around these concepts:

- Clerk organizer user: authenticated event organizer.
- Event: organizer-owned event workspace.
- Event key: unique public key that routes attendee submissions to the correct event.
- Attendee: public, no-account participant record.
- Consent record: attendee consent or opt-out preference scoped to an event.
- Reference image: optional attendee-provided image for opt-out matching.
- Event photo: uploaded or imported photo associated with an event.
- Detection: possible match between an event photo and an opted-out attendee.
- Processing result: original/redacted output state and detection results for a photo.
- Status/audit log: event-scoped record of processing and review activity.

## Demo-First Rule

Build the shortest path to the core demo first:

- Organizer auth boundary.
- Event creation.
- Event key.
- Public attendee opt-out form.
- Organizer dashboard tabs.
- Mocked photo review with confidence values.
- Original/redacted toggle using placeholder data.

Do not chase real integrations or advanced AI before the demo flow works end to end.

## No-Overengineering Rule

Prefer small, reviewable changes. Use mock adapters and simple data structures first. Add abstractions only when they remove clear duplication or unblock the demo.

## Context Rule

Read `context/current-task.md` before starting work. Keep it current when task boundaries change.

## OpenCode Agents

Use global OpenCode agents where useful:

- `@scout` for codebase exploration and entry points.
- `@review` for correctness, security, maintainability, and edge cases.
- `@test` for focused test planning, writing, running, and debugging.
- `@explain` for architecture or code explanations.

## Decision Log Rule

Record meaningful product, architecture, integration, and scope decisions in `docs/decisions/decisions.md`. Include date, decision, context, and consequence when useful.

## AI Session Summary Rule

After significant AI-assisted work, add a concise summary under `docs/ai-sessions/` or update `docs/ai-sessions/README.md` with:

- Goal.
- Files changed.
- Commands run.
- Decisions made.
- Tests run.
- Open issues.
- Next actions.
