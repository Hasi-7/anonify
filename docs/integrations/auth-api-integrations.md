# Auth + API Integrations

This document defines the final authentication boundaries and API access model for anonify.

## Architecture Overview

| Layer | Responsibility |
|-------|---------------|
| **Middleware** | UI route auth only |
| **API route wrappers** | Runtime API auth authority |
| **API metadata** | Declared API contract |
| **Validators** | Build-time enforcement that metadata and wrappers match |
| **Server modules** | Internal integrations (Drive, Backboard) - never routable |

## Middleware (UI Only)

Middleware protects organizer UI pages. It does NOT touch API routes.

- `/`, `/sign-in(.*)`, `/sign-up(.*)`, `/attend(.*)` -> public
- `/dashboard`, any other UI path -> Clerk-protected
- `/api/*` -> **skipped entirely by middleware**; API route wrappers own API auth

## API Route Access Model

Every API route file exports an explicit access level:

```ts
export const apiAccess = "public" | "organizer";
```

anonify uses a dual-lock API model:

- Runtime safety comes from the route wrapper.
- Contract correctness comes from `apiAccess`.
- System integrity requires both to match.

Public routes:

```ts
export const apiAccess = "public" as const;

export const GET = publicApiRoute(async () => {
  // handler code
});
```

Organizer routes:

```ts
export const apiAccess = "organizer" as const;

export const GET = organizerApiRoute(async (_request, { userId }) => {
  // handler code
});
```

`publicApiRoute()` does not run auth. `organizerApiRoute()` is the only runtime organizer auth path and calls `requireOrganizerAuth()`, which wraps Clerk `auth()` and passes `userId` to the handler only after auth succeeds.

`scripts/validate-api-contracts.mjs` enforces structural consistency. If `apiAccess = "public"`, every exported HTTP handler must use `publicApiRoute()`. If `apiAccess = "organizer"`, every exported HTTP handler must use `organizerApiRoute()`. Any mismatch fails the build and reports the route path, declared access, expected wrapper, and actual wrapper.

## Mandatory Validation Gates

API contract validation is wired into normal development and CI workflows:

- `npm run validate:api` runs `scripts/validate-api-contracts.mjs` directly.
- `npm run build:safe` is the canonical production build entrypoint and runs validation before `next build`.
- `npm run build` delegates to `npm run build:safe`.
- Direct `next build`, `npx next build`, or `node_modules/.bin/next build` entrypoints are unsafe; `next.config.ts` detects normal direct Next builds, prints a warning, and runs API contract validation before the build continues.
- `npm run lint` is lint-only; it does not replace API contract validation.
- `npm install` runs `prepare`, which points Git at the repo-managed `.githooks/` directory.
- `.githooks/pre-commit` runs `npm run validate:api` and blocks commits on failure.
- `.github/workflows/clerkapp-ci.yml` runs `npm run validate:api` before lint and uses `npm run build:safe`.

The `next.config.ts` validation hook is a defensive backstop, not a security boundary. The supported production path is `build:safe` plus CI and pre-commit validation. Custom build systems, lower-level compiler invocations, or future tooling that skips Next config are unsupported unless they explicitly run `npm run validate:api` first.

### Public API (no auth)

Routes under `/app/api/public/*` and `/app/api/attend/*`.

- No Clerk authentication required
- Scoped by eventKey where applicable
- Must not expose organizer-only data

### Organizer API (Clerk auth required)

Routes under `/app/api/organizer/*`.

- Must export handlers through `organizerApiRoute(handler)`
- Handler receives `userId` only after Clerk auth succeeds
- Must enforce event ownership where applicable

### Internal Logic (NOT routable)

There are no `/api/internal/*` routes. Internal logic lives in:

```text
clerkApp/server/integrations/
```

These modules are callable only from API route handlers or server-only modules. They are never exposed as HTTP endpoints.

Import boundary:

- Allowed importers: `clerkApp/app/api/**` and `clerkApp/server/**`
- Forbidden importers: UI components, shared client files, mocks, pages, and generic app utilities
- ESLint enforces this with `no-restricted-imports` for `@/server/integrations`

## Google Drive Adapter

Location: `clerkApp/server/integrations/google-drive.ts`

- Returns photo metadata only (IDs, filenames, mime type, status)
- Falls back to mock data if config is missing
- Never returns raw image bytes
- Enforced server-only via `import "server-only"`

**What Google Drive is NOT responsible for:** image processing, face detection, AI logic, or biometric data handling.

## Backboard.io Adapter

Location: `clerkApp/server/integrations/backboard.ts`

- Summarizes event review metadata for organizers
- Falls back to mock summary if API key is missing or request fails
- Never crashes the app

**What Backboard must NOT receive:**

- Raw images (any resolution)
- Reference selfies
- Face embeddings or biometric data
- Environment variables or secrets

**What Backboard may receive:**

- Event name, key, photo count
- Opt-out attendee count
- Detection confidence values, statuses, filenames
- Review states, anonymized display names

## How to Replace Mocks With Real APIs

- **Backboard:** Set `BACKBOARD_API_KEY`, `BACKBOARD_PROJECT_ID`, `BACKBOARD_API_URL` in `.env`. The adapter auto-upgrades.
- **Google Drive:** Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_DRIVE_FOLDER_ID`. Implement real OAuth/SDK calls inside the adapter (currently deferred).

## Environment Variables

Do not commit `.env` files or real credentials.

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_DRIVE_FOLDER_ID=

BACKBOARD_API_KEY=
BACKBOARD_PROJECT_ID=
BACKBOARD_API_URL=

REDACTION_API_URL=http://localhost:8001
```

Missing Drive and Backboard keys are safe; adapters return mocks.
