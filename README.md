# anonify

anonify is a privacy-first event photo redaction tool for event organizers.

## Repository Structure

- `clerkApp/` is the canonical Next.js frontend app.
- `backend/` is the canonical Flask + SQLite backend.
- `ai_redaction/` is the optional Python redaction helper for real region blur.
- Root docs and scripts coordinate the project.

## Local Development

Frontend commands run from `clerkApp/`:

```sh
npm run dev
npm run build
npm run start
npm run lint
```

Backend commands run from `backend/`. Follow `backend/README.md` for the Flask + SQLite setup, database initialization, and local server command.

The real Python redaction helper runs separately from `ai_redaction/` on `localhost:8001` when needed. The frontend mock redaction flow does not require API keys or a Python server.

## MVP Flow

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

Clerk handles organizer authentication only. Organizers own events and access protected dashboard routes.

Attendees do not need accounts. Public attendee submission routes accept an event key and create event-scoped consent records.

## Event-Key Model

Each event has a unique event key. The event key routes attendee submissions to the correct event and should be treated as a public, event-scoped identifier, not as a secret.

## Admin UI Tabs

The organizer dashboard should prioritize these tabs:

- Overview.
- Opt-Out Attendees.
- Event Photos.
- Photo Review / Review Queue.
- Processing Log.

## AI / Redaction

AI/redaction frontend integration is available inside `clerkApp` using `@/` paths:

```ts
import { processEventPhotos } from "@/lib/processing/mock-processor"
import { createRedactionPlan } from "@/lib/processing/redaction-plan"
import { applyRedactionPlanMock } from "@/lib/processing/apply-redaction"
import type { RedactionPlan, Detection } from "@/types/ai-redaction"
import { MOCK_REDACTION_PLANS, getMockRedactionPlan } from "@/mocks/redaction-plan-fixtures"
```

These imports resolve inside `clerkApp` because `@/*` maps to the app-local source tree. Use the `clerkApp`-local AI files, not root-level copies.

The mock path is ready for frontend use today. Real blur is optional, region-based, and handled by the separate helper in `ai_redaction/` on `localhost:8001`. This is not face recognition.

## Confidence Model

Each detection should include a confidence value. Low or uncertain confidence should be surfaced clearly and marked for manual review. Start with mocked detection fixtures before adding real AI or computer vision.

## Python Requirements Notes

`requirements.txt` documents Python dependencies for backend/helper work. Flask + SQLite backend dependencies belong to the canonical `backend/` service. Optional real region blur dependencies belong to the `ai_redaction/` helper. Clerk is handled in the Next.js app, not Python.

Keep heavy AI/computer-vision dependencies limited to the helper unless the backend or frontend has a direct, documented need.

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

## Team Split

Frontend owns `clerkApp/`: UI pages, components, organizer dashboard, attendee form, event dashboard tabs, event photos UI, photo review UI, confidence display UI, and mock AI/redaction frontend integration.

Backend owns `backend/`: Flask APIs, SQLite persistence, event/attendee/photo/detection/result models, event key generation and validation, event-scoped data rules, and mock storage.

Integrations owns Clerk setup, protected organizer route boundaries, public attendee route boundaries, Google Drive adapter/mock, Backboard.io adapter/mock, environment variable docs, and safe missing-key behavior.

AI / Redaction owns `ai_redaction/` and shared mock fixtures: mock AI/photo-processing pipeline, detection fixtures, confidence scoring, manual review thresholds, original/redacted placeholder outputs, and optional real region blur helper.

Shared final work includes QA, demo script, screenshots, Devpost, deployment checks, and final bug fixes.

## Safety And Privacy Notes

- Treat attendee consent and reference images as sensitive data.
- Keep all attendee records scoped to a single event.
- Avoid logging private image data, consent details, or secrets.
- Use mocks until the demo flow is stable.
- Design manual review states so uncertain detections are never silently treated as confirmed.
- Do not commit `.env` files or real credentials.
