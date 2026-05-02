# Auth + API Integrations Session

## Goal

Add mock-first integration contracts for Clerk route boundaries, Google Drive photo metadata, and Backboard privacy review summaries.

## What Was Built

- `clerkApp/server/integrations/types.ts`: Shared types for Drive photos and Backboard summaries.
- `clerkApp/server/integrations/google-drive.ts`: Mock-first Google Drive adapter.
- `clerkApp/server/integrations/backboard.ts`: Mock-first Backboard.io adapter.
- `clerkApp/server/require-organizer.ts`: `requireOrganizerAuth()`, the Clerk organizer auth helper used by the organizer route wrapper.
- `clerkApp/server/api-route-helpers.ts`: `publicApiRoute()` and `organizerApiRoute()` wrappers. These are the single runtime API auth authority.
- `clerkApp/scripts/validate-api-contracts.mjs`: Build-time enforcement for missing `apiAccess` exports, unwrapped HTTP handlers, and wrapper/metadata mismatches with explicit mismatch diagnostics.
- `clerkApp/package.json`: `build:safe` is the canonical production build path; `build` delegates to it; `lint` remains lint-only.
- `clerkApp/next.config.ts`: Normal direct `next build` entrypoints print an unsafe-entrypoint warning and run API contract validation before continuing. This is a defensive backstop, not a security boundary.
- `.githooks/pre-commit`: Blocks commits when API contract validation fails.
- `.github/workflows/clerkapp-ci.yml`: Runs API validation before lint and uses `build:safe` for CI builds.
- `clerkApp/eslint.config.mjs`: Import boundary rule forbidding `@/server/integrations` outside API routes and server-only modules.
- Updated `clerkApp/middleware.ts` to explicitly define protected organizer routes vs public attendee routes.
- Added structured documentation for integrations under `docs/integrations/auth-api-integrations.md`.

## Safety Boundaries

- **Backboard Role**: Backboard.io is an optional organizer-facing privacy review assistant. It strictly consumes metadata (event details, photo counts, confidence values, filenames). **Backboard must not receive** raw attendee reference photos, raw event photos, full-resolution images, face embeddings, biometric data, private `.env` values, or any identity data beyond demo attendee display names already shown in the app.
- **Google Drive Role**: Strictly metadata retrieval. No image processing happens via Drive integration.
- **Clerk Routes**: Only `/`, `/sign-in(.*)`, `/sign-up(.*)`, `/attend(.*)`, and `/api(.*)` are public. All other frontend routes are securely protected.
- No raw images or biometric data leave the frontend/backend ecosystem.

## Fallback Behavior

Both adapters are designed to be "mock-first" and entirely optional:
- **Google Drive**: If Google Drive config is missing (`GOOGLE_CLIENT_ID`, etc.), `listEventPhotosFromDrive` automatically falls back to returning mock photo metadata. The app never crashes.
- **Backboard**: If `BACKBOARD_API_KEY` is missing, `generatePrivacyReviewSummary` returns a mock summary with `usedMock: true`. If a request to the Backboard API fails, the catch block intercepts it and returns the same mock format with an error field populated.

## Design Decisions

- Backboard is metadata-only and never receives raw images or biometric artifacts.
- Google Drive and Backboard are optional for the demo, avoiding friction in standing up the core app.
- Missing external API keys must not crash the app; they default to deterministic mock fixtures.
- Real Google OAuth and real Backboard API mappings are deferred until the core demo is stable.

## Future Upgrade Path

The `server/integrations` modules are plug-and-play:
- When `.env` config properties are added, the adapter will seamlessly attempt actual `fetch()` or SDK calls without requiring logic changes in the consuming frontend components.
- Real Backboard API endpoint/response mappings are currently placeholders and will be connected securely later.
- Real Google Drive OAuth/listing is intentionally deferred. When implemented, it will need to integrate correctly within the Next.js auth session or server environment.

## Tests Run

- `npm install`
- `npm run lint`
- `npm run build`
- `npm.cmd run validate:api`
- `npm.cmd run lint`
- `npm.cmd run build`
- `npm.cmd run build:safe`
- `npx.cmd next build`
- `./node_modules/.bin/next.cmd build`
- `npm.cmd run prepare`
- `git hook run pre-commit`
