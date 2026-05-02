# Anonify

Anonify is a privacy-first event photo redaction tool for event organizers.

## Repository Structure

- `clerkApp/` is the canonical Next.js frontend app.
- `backend/` is the canonical Flask + SQLite backend.
- `ai_redaction/` is the optional Python redaction helper for real region blur.
- Root docs and scripts coordinate the project.

Hacking has started. The project is moving from setup into demo-first implementation.

The first priority is a mocked end-to-end flow before real integrations or production-grade AI/redaction work.

## Local Development

You need to run three separate servers for the full Anonify experience. It is recommended to run them in three separate terminal tabs.

### 1. Frontend (Next.js)

The frontend app runs from the `clerkApp/` directory on `localhost:3000`.

```sh
cd clerkApp
npm install
npm run dev
```

To build and validate the application:
```sh
cd clerkApp
npm run build:safe
npm run validate:api
npm run lint
```

### 2. Backend (Flask)

The canonical backend runs from the `backend/` directory on `localhost:5000`. This handles events, attendees, and SQLite persistence.

```sh
# Setup virtual environment and dependencies (from the root folder)
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Mac/Linux:
source .venv/bin/activate

pip install -r requirements.txt

# Run backend
cd backend
flask --app app run --debug --port 5000
```

*Note: Before first use, you may seed the database with demo event `HUSKY-42F7` by running:*
```sh
curl -X POST http://127.0.0.1:5000/seed
# Or via powershell: Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:5000/seed"
```

### 3. AI / Redaction Helper (FastAPI)

The optional real Python redaction and recognition helper runs from the `ai_redaction/` directory on `localhost:8001`. 

```sh
# Ensure your virtual environment from step 2 is active
uvicorn ai_redaction.server:app --reload --port 8001
```

Once running, ensure your `.env.local` in `clerkApp/` contains `REDACTION_API_URL=http://127.0.0.1:8001` to communicate with the helper.

For local face recognition using the YuNet/SFace ONNX models — including download commands, the `demo_recognition_test.py` harness, how to verify `activePath`, and git safety rules — see [`docs/ai-sessions/13-local-ai-model-setup.md`](docs/ai-sessions/13-local-ai-model-setup.md).

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

Keep heavy AI/computer-vision dependencies limited to the helper unless the backend or frontend has a direct, documented need. Avoid adding heavy face-recognition packages until the mocked AI/redaction pipeline proves the demo needs them.

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
