# anonify

anonify is a privacy-first event photo redaction tool for hackathon event organizers.

## Current Status

Hacking has started. The project is moving from setup into demo-first implementation.

The first priority is a mocked end-to-end flow before real integrations or production-grade AI/redaction work.

## Problem

Event organizers often take and share photos, but attendees may not want to appear in public galleries, recaps, or social posts. anonify will help organizers collect opt-out preferences per event and review event photos so opted-out attendees can be blurred or flagged for manual review.

## MVP Flow

The target demo flow is:

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

Clerk is expected to be handled in the Next.js app, not Python. Avoid adding heavy face-recognition packages until the mocked AI/redaction pipeline proves the demo needs them.

## Worktree Workflow

Worktree scripts are provided for four parallel agents:

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

- Clerk setup.
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
- Optional Python helper.

Shared final work:

- QA.
- Demo script.
- Screenshots.
- Devpost.
- Deployment check.
- Final bug fixes.

## Implementation Sequence

1. Scaffold or adopt the Next.js + TypeScript app.
2. Add a mocked Clerk-authenticated organizer event-key demo flow.
3. Add admin UI tabs with mocked data.
4. Add public attendee form with event-key routing.
5. Add mock storage and event-scoped data rules.
6. Add mocked photo-review confidence data and manual review states.
7. Add mock Google Drive and Backboard.io adapters.
8. Add optional Python helper only if it helps the demo.
9. Replace mocks with real integrations only after the core demo works.

## Next.js Build Guardrail

The main Next.js app lives in `clerkApp`.

Use the safe build entrypoint:

```bash
cd clerkApp
npm run build:safe
```

`npm run build` delegates to the same safe path. Do not use `next build`, `npx next build`, or `node_modules/.bin/next build` as the normal workflow. Direct Next build entrypoints are treated as unsafe and trigger API contract validation from `next.config.ts` as a defensive backstop, but `next.config.ts` is not the primary security boundary.

API contract validation is also enforced by `.githooks/pre-commit` and GitHub Actions. This is production-reasonable and team-safe for normal workflows; deliberately replacing the build system can still bypass project guardrails and should be treated as an unsupported path.

## Safety And Privacy Notes

- Treat attendee consent and reference images as sensitive data.
- Keep all attendee records scoped to a single event.
- Avoid logging private image data, consent details, or secrets.
- Use mocks until the demo flow is stable.
- Design manual review states so uncertain detections are never silently treated as confirmed.
- Do not commit `.env` files or real credentials.
