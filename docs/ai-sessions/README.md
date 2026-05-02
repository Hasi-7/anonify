# AI Session Summaries

Use this directory to keep concise summaries of significant AI-assisted work.

## Summary Template

- Goal:
- Files changed:
- Commands run:
- Decisions made:
- Tests run:
- Open issues:
- Next actions:
- What should be saved to the second brain:

## Current Session

- Goal: Align documentation with the current repo structure.
- Files changed: Root docs, task context, backend docs, and Python dependency notes.
- Commands run: Repository/file inspection only; no install commands.
- Decisions made: `clerkApp/` is the canonical Next.js frontend, `backend/` is the canonical Flask + SQLite backend, and `ai_redaction/` is the optional Python region blur helper.
- Tests run: Not applicable for documentation-only changes.
- Open issues: None for documentation alignment.
- Next actions: Keep future feature work inside the canonical app/service directories.
- What should be saved to the second brain: AI/redaction frontend imports resolve inside `clerkApp` through `@/` aliases; real region blur remains separate in `ai_redaction/` on `localhost:8001`.
