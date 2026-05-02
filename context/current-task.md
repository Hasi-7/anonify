# Current Task

Documentation alignment for the current anonify repo structure.

## Status

The project now has canonical app/service boundaries:

- `clerkApp/` for the Next.js frontend.
- `backend/` for the Flask + SQLite backend.
- `ai_redaction/` for the optional Python region blur helper.
- Root docs and scripts for coordination.

## Goal

Keep root docs, backend docs, AI/redaction import notes, and Python dependency notes aligned with the current structure.

## Constraints

- Documentation alignment only.
- Do not implement product features.
- Do not move app code as part of this task.
- Do not replace mock redaction with real blur unless a separate implementation task asks for it.

## Acceptance Criteria

- `AGENTS.md` lists available frontend commands and points backend work to `backend/README.md`.
- `README.md` no longer implies that no app exists.
- Backend docs refer to Flask + SQLite, not FastAPI.
- AI/redaction frontend import docs use `clerkApp`-local `@/` paths.
- `requirements.txt` is described as backend/helper Python dependencies, not Clerk or frontend dependencies.
