# AI Session 05 — clerkApp Import Path Fix

**Date:** 2026-05-02
**Workstream:** AI / Redaction

## What Path Issue Was Found

`clerkApp/tsconfig.json` maps `@/*` to `./*` (relative to `clerkApp/`):

```json
"paths": { "@/*": ["./*"] }
```

This means `@/lib/processing/mock-processor` resolves to
`clerkApp/lib/processing/mock-processor.ts` — **not** the root-level
`lib/processing/mock-processor.ts` that was created in sessions 01–04.

The root-level `lib/`, `types/`, and `mocks/` directories are completely
outside the `clerkApp/` path boundary. Any frontend component using
`import { processEventPhotos } from "@/lib/processing/mock-processor"`
would fail to resolve at build time.

## What Was Done

All 7 TypeScript AI/redaction files were copied into the matching paths
inside `clerkApp/`. No file content was changed — the relative import
paths (`../../types/ai-redaction`, etc.) are identical at the same
directory depth under `clerkApp/`.

| File copied to clerkApp/ |
|--------------------------|
| `clerkApp/types/ai-redaction.ts` |
| `clerkApp/lib/processing/confidence.ts` |
| `clerkApp/lib/processing/mock-processor.ts` |
| `clerkApp/lib/processing/redaction-plan.ts` |
| `clerkApp/lib/processing/apply-redaction.ts` |
| `clerkApp/mocks/processing-fixtures.ts` |
| `clerkApp/mocks/redaction-plan-fixtures.ts` |

Root-level originals remain in place and are not changed.
Python helper (`ai_redaction/`) remains at root and is not changed.

## Canonical Project Structure

```
huskyHacks26/
├── clerkApp/               ← Next.js frontend (canonical TypeScript app)
│   ├── app/                ← Next.js App Router pages
│   ├── types/
│   │   └── ai-redaction.ts ← USE THIS for frontend imports
│   ├── lib/
│   │   └── processing/
│   │       ├── confidence.ts
│   │       ├── mock-processor.ts
│   │       ├── redaction-plan.ts
│   │       └── apply-redaction.ts
│   └── mocks/
│       ├── processing-fixtures.ts
│       └── redaction-plan-fixtures.ts
│
├── backend/                ← Flask + SQLite API (Python)
│   ├── app.py
│   ├── db.py
│   ├── models.py
│   └── seed.py
│
├── ai_redaction/           ← Optional Python blur helper (FastAPI, port 8001)
│   ├── server.py
│   ├── apply_redaction.py
│   └── __init__.py
│
└── requirements.txt        ← Python deps for backend/ and ai_redaction/
```

## Exact Frontend Import Paths (use these)

```typescript
// Types
import type { Detection, PhotoProcessingResult, RedactionPlan } from "@/types/ai-redaction"

// Mock processor (main entry point)
import { processEventPhotos } from "@/lib/processing/mock-processor"

// Redaction plan helpers
import { createRedactionPlan, createRedactionPlans } from "@/lib/processing/redaction-plan"

// Blur adapter (mock-safe, degrades when Python helper is absent)
import { applyRedactionPlan, applyRedactionPlanMock } from "@/lib/processing/apply-redaction"

// Demo fixtures (zero-compute, use in UI without running the processor)
import { MOCK_PROCESSING_INPUT, MOCK_CONFIDENCE_MAP } from "@/mocks/processing-fixtures"
import { MOCK_REDACTION_PLANS, getMockRedactionPlan } from "@/mocks/redaction-plan-fixtures"
```

## Python Helper — How to Run

The Python FastAPI blur helper is separate from the main backend and lives
at the repo root. It is optional — the TypeScript adapter works without it.

```bash
# From repo root, after installing requirements:
pip install -r requirements.txt
uvicorn ai_redaction.server:app --reload --port 8001
```

Add to `clerkApp/.env.local` to enable real blur:
```
REDACTION_API_URL=http://localhost:8001
```

`REDACTION_API_URL` is a server-side env var. Use `applyRedactionPlan()`
only in Next.js API routes or server components, not client components.
Use `applyRedactionPlanMock()` freely in client components.

## Backend Note

`backend/` uses **Flask + SQLite** (Python), not FastAPI.
`ai_redaction/server.py` uses **FastAPI** — these are two separate services.

- Flask backend: runs on its own port (default 5000)
- FastAPI blur helper: runs on port 8001

## What Teammates Should Use Going Forward

**Frontend (clerkApp):** always import from `@/…` paths. The files now exist under `clerkApp/`.

**Backend (backend/):** the Flask backend is Python-only and does not import TypeScript.
If backend needs to trigger redaction, call `POST http://localhost:8001/redact` directly.

**Root-level `lib/`, `types/`, `mocks/`:** kept as-is for reference but are not the
frontend-facing source. `clerkApp/` copies are the canonical frontend source.

## What Remains for Real Face Detection / Matching

No change to this plan from session 04:
1. Set `USE_REAL_AI = true` in `clerkApp/lib/processing/mock-processor.ts`
2. Implement `processPhotoReal()` with real CV bounding-box coordinates
3. Set `REDACTION_API_URL=http://localhost:8001` in `.env.local`
4. All downstream code (`createRedactionPlan`, `applyRedactionPlan`, `POST /redact`) works unchanged

## Commands Run

None. No installs, no builds.
