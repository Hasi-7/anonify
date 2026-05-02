# Privacy Review Summary Integration

## Overview

`clerkApp/lib/integrations/privacy-summary.ts` is a metadata-only adapter that generates a human-readable privacy review summary for an event's processed photo set.

It defaults to a local mock summary and degrades gracefully when external providers are unavailable or fail.

---

## Metadata Policy

**This adapter never receives, sends, stores, or logs:**

- Raw event photos or thumbnails
- Attendee reference images or selfies
- Face embeddings or biometric feature vectors
- Any binary image data

It operates exclusively on aggregate counts and detection metadata that were already produced by the AI/redaction pipeline:
event name, photo counts, attendee names, confidence scores, and detection statuses.

---

## Files

| File | Purpose |
|------|---------|
| `clerkApp/lib/integrations/privacy-summary.ts` | Adapter — `generatePrivacyReviewSummary()` |
| `clerkApp/lib/integrations/types.ts` | `PrivacyReviewSummary` (with `provider`), re-exports `PrivacyReviewSummaryInput` |
| `clerkApp/mocks/privacy-summary-fixtures.ts` | `MOCK_PRIVACY_SUMMARY_INPUT`, `MOCK_PRIVACY_SUMMARY_RESULT` |

**Not touched:** `server/integrations/backboard.ts`, frontend UI, AI recognition files, backend, auth.

---

## Types

```ts
// Input — aggregate metadata only
type PrivacyReviewSummaryInput = {
  eventId: string
  eventName: string
  eventKey: string
  photosProcessed: number
  optOutAttendees: number
  matchesFound: number
  photosNeedingReview: number
  detections: {
    photoId: string
    fileName: string
    attendeeName: string
    confidence: number
    status: "auto_blurred" | "manual_review" | "approved" | "rejected"
  }[]
}

// Output
type PrivacyReviewSummary = {
  eventId: string
  generatedAt: string          // ISO 8601
  summary: string
  riskLevel: "low" | "medium" | "high"
  recommendedActions: string[]
  photosToReview: { photoId: string; fileName: string; reason: string }[]
  usedMock: boolean
  provider: "mock" | "gemini" | "backboard"
  error?: string               // set when provider fails and mock fallback is used
}
```

---

## Exported Functions

### `generatePrivacyReviewSummary(input): Promise<PrivacyReviewSummary>`

Async. Selects a provider at runtime, falls back to mock on any failure.

### `generateMockPrivacyReviewSummary(input): PrivacyReviewSummary`

Synchronous. Always safe. Used as the fallback and directly in tests.

---

## Provider Selection

```
BACKBOARD_API_KEY + BACKBOARD_PROJECT_ID + BACKBOARD_API_URL  →  Backboard
GEMINI_API_KEY (and no Backboard config)                       →  Gemini (TODO)
Neither                                                         →  mock (default)
```

Provider checks happen at call time (not module load), so no restart is needed when env vars change during development.

---

## Risk Level Logic

| `photosNeedingReview` | `riskLevel` |
|-----------------------|-------------|
| 0                     | `"low"`     |
| 1 or 2                | `"medium"`  |
| 3 or more             | `"high"`    |

---

## Usage from an API Route

```ts
// app/api/organizer/events/[eventId]/privacy-summary/route.ts
import { organizerApiRoute } from "@/server/api-route-helpers"
import { generatePrivacyReviewSummary } from "@/lib/integrations/privacy-summary"

export const apiAccess = "organizer"

export const POST = organizerApiRoute(async (req) => {
  const input = await req.json()
  const summary = await generatePrivacyReviewSummary(input)
  return Response.json(summary)
})
```

---

## Future: Wiring to a "Generate Summary" Button

When the UI is ready, create an API route (as above) and call it from the dashboard:

```ts
// In a server action or client fetch
const response = await fetch(`/api/organizer/events/${eventId}/privacy-summary`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(summaryInput),
})
const summary: PrivacyReviewSummary = await response.json()
```

The API route handles auth via `organizerApiRoute`. The frontend never reads process.env directly.

---

## Gemini TODO Seam

`generateViaGemini()` in `privacy-summary.ts` throws immediately. To implement it:

1. `npm install @google/generative-ai`
2. Set `GEMINI_API_KEY` in `.env.local`
3. Replace the TODO block with a prompt call — send metadata JSON only, no image bytes
4. Parse the Gemini response and map it to `PrivacyReviewSummary`

---

## Relationship to `server/integrations/backboard.ts`

`server/integrations/backboard.ts` has its own `generatePrivacyReviewSummary` which is server-only (ESLint-restricted to `app/api/**` and `server/**`). The `lib/integrations/` version is an independent, non-server-only adapter that mirrors the Backboard payload logic without the `server-only` import constraint.

Use `lib/integrations/privacy-summary` when calling from a Next.js server component or server action. Use `server/integrations/backboard` directly only from an API route handler.
