# Photo Review UI Adapter Wiring

## Goal

Wire the existing organizer photo review panel to the UI-ready AI photo-review adapter without changing the dashboard design or backend/API flow.

## What Was Wired

- `clerkApp/components/anonify-experience.tsx` now reads mock `PhotoReviewModel` data for the selected review photo.
- Participant rows display adapter-provided attendee names, confidence percentages, status labels, and manual review state.
- The confidence warning shown in the review panel comes from `model.confidenceWarning`.
- Existing before/after previews continue to render, with review-region overlays derived from `model.regions` when an adapter model is available.

## Import Path Used

```ts
import { getMockPhotoReviewModel } from "@/lib/processing/photo-review-adapter";
import type { PhotoReviewModel } from "@/types/photo-review";
```

## Fallback Remaining

- If no adapter model is found for a selected photo, the UI falls back to the existing local `photo.figures` plus local attendee mock lookup.
- Uploaded photos and backend-hydrated photos that do not match the demo fixture IDs keep using the existing local review behavior.

## Later Backend Replacement

- Replace `getMockPhotoReviewModel(...)` with a backend-provided `PhotoProcessingResult` and convert it through `toPhotoReviewModel(...)`.
- The review panel can keep consuming `PhotoReviewModel` while the data source changes from mock adapter to backend/API response.
