# anonify

anonify is a privacy-first event photo redaction tool for hackathon event organizers.

## Current Status

This repository is in pre-hackathon setup only.

Hacking has not started. The app has not been scaffolded, dependencies have not been installed, and product features have not been implemented.

## Problem

Event organizers often take and share photos, but attendees may not want to appear in public galleries, recaps, or social posts. anonify will help organizers collect opt-out preferences per event and review event photos so opted-out attendees can be blurred or flagged for manual review.

## Future MVP Flow

After hacking starts, the target demo flow is:

1. Organizer signs in with Clerk.
2. Organizer creates an event.
3. Event gets a unique event key.
4. Attendee opens `/attend?eventKey=...` or manually enters the key.
5. Attendee submits name, consent preference, and optional reference photo if opting out.
6. Organizer opens the event dashboard.
7. Organizer sees opt-out attendees with names and reference photos.
8. Organizer sees event photos in a Google Drive-like/manual upload tab.
9. Organizer opens a photo review screen.
10. Photo review shows an Original/Redacted toggle.
11. Photo review shows found opted-out participants.
12. Each detection shows confidence.
13. Uncertain detections are marked for manual review.

## Auth Model

Clerk is planned for organizer authentication only. Organizers own events and access protected dashboard routes.

Attendees do not need accounts. Public attendee submission routes should accept an event key and create event-scoped consent records.

## Event-Key Model

Each event has a unique event key. The event key routes attendee submissions to the correct event and should be treated as a public, event-scoped identifier, not as a secret.

## Admin UI Tabs

The future organizer dashboard should prioritize these tabs:

- Overview.
- Opt-Out Attendees.
- Event Photos.
- Photo Review / Review Queue.
- Processing Log.

## Confidence Model

Each detection should include a confidence value. Low or uncertain confidence should be surfaced clearly and marked for manual review. Start with mocked detection fixtures before adding real AI or computer vision.

## Python Requirements Notes

`requirements.txt` is for optional Python AI/redaction/helper work only.

Do not install Python dependencies before hacking starts. Clerk is expected to be handled in the Next.js app, not Python. Avoid adding heavy face-recognition packages until the mocked AI/redaction pipeline proves the demo needs them.

## Worktree Workflow

Worktree scripts are provided for four parallel agents after the setup commit exists:

- `scripts/create-worktrees.sh`
- `scripts/create-worktrees.ps1`
- `scripts/cleanup-worktrees.sh`
- `scripts/cleanup-worktrees.ps1`

The create scripts use these sibling directories:

- `../<repo-name>-worktrees/frontend`
- `../<repo-name>-worktrees/backend`
- `../<repo-name>-worktrees/integrations`
- `../<repo-name>-worktrees/ai-redaction`

The create scripts use these branches:

- `agent/frontend`
- `agent/backend`
- `agent/integrations`
- `agent/ai-redaction`

The create scripts check for a git repository, detect the repository name automatically, create branches when missing, reuse branches when present, avoid overwriting existing worktree directories, and print next commands.

If setup files are uncommitted, commit setup first so worktrees are not created from a stale HEAD.

## Four-Person Split

Frontend owns:

- UI pages.
- Components.
- Organizer dashboard.
- Attendee form.
- Event dashboard tabs.
- Event photos UI.
- Photo review UI.
- Confidence display UI.

Backend owns:

- Internal APIs.
- Event model.
- Attendee model.
- Photo model.
- Detection/result model.
- Event key generation and validation.
- Event-scoped data rules.
- Mock storage.

Integrations owns:

- Clerk setup after hacking starts.
- Protected organizer route boundaries.
- Public attendee route boundaries.
- Google Drive adapter/mock.
- Backboard.io adapter/mock.
- Environment variable docs.
- Safe missing-key behavior.

AI / Redaction owns:

- Mock AI/photo-processing pipeline.
- Detection fixtures.
- Confidence scoring.
- Manual review thresholds.
- Original/redacted placeholder outputs.
- Optional Python helper after hacking starts.

Shared final work:

- QA.
- Demo script.
- Screenshots.
- Devpost.
- Deployment check.
- Final bug fixes.

## Post-Hacking-Start Implementation Sequence

1. Scaffold the Next.js + TypeScript app only after hacking starts.
2. Add a mocked Clerk-authenticated organizer event-key demo flow.
3. Add admin UI tabs with mocked data.
4. Add public attendee form with event-key routing.
5. Add mock storage and event-scoped data rules.
6. Add mocked photo-review confidence data and manual review states.
7. Add mock Google Drive and Backboard.io adapters.
8. Add optional Python helper only if it helps the demo.
9. Replace mocks with real integrations only after the core demo works.

## Safety And Privacy Notes

- Treat attendee consent and reference images as sensitive data.
- Keep all attendee records scoped to a single event.
- Avoid logging private image data, consent details, or secrets.
- Use mocks until the demo flow is stable.
- Design manual review states so uncertain detections are never silently treated as confirmed.
- Do not commit `.env` files or real credentials.
