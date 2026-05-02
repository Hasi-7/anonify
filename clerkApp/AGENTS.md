<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. APIs, conventions, and file structure may differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## anonify Build And API Guardrails

- Use `npm run build:safe` for production builds.
- `npm run build` delegates to `build:safe`.
- Do not use raw `next build`, `npx next build`, or `node_modules/.bin/next build` as the normal workflow. `next.config.ts` defensively runs API validation for direct Next builds, but that is a backstop, not the primary gate.
- API routes must export `apiAccess = "public" | "organizer"` and use the matching wrapper: `publicApiRoute(handler)` or `organizerApiRoute(handler)`.
- Run `npm run validate:api` after changing files under `app/api` or `server/api-route-helpers.ts`.
- Middleware stays UI-only and must not grow API classification or auth logic.
- Integration adapters under `server/integrations/` are server-only and may only be imported from API routes or server-only modules.
