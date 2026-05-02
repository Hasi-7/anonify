import type { OptedOutAttendee, PhotoProcessingResult } from "../../types/ai-redaction"

/**
 * Optional experimental client for the local /match-photo recognition spike.
 *
 * This is not wired into the default mock AI pipeline or photo review UI. It only
 * talks to a locally running helper and returns an explicit failure when the
 * helper is unavailable.
 */

const DEFAULT_REDACTION_API_URL = "http://127.0.0.1:8001"

const REDACTION_API_URL =
  typeof process !== "undefined"
    ? process.env.REDACTION_API_URL ?? DEFAULT_REDACTION_API_URL
    : DEFAULT_REDACTION_API_URL

function isLocalRecognitionUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1"
  } catch {
    return false
  }
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export type MatchPhotoInput = {
  eventId: string
  photoId: string
  photoImagePath: string
  originalImageUrl: string
  optedOutAttendees: Array<
    OptedOutAttendee & {
      referenceImagePath?: string
    }
  >
}

export async function matchPhotoWithReferences(
  input: MatchPhotoInput
): Promise<ApiResult<PhotoProcessingResult>> {
  if (!REDACTION_API_URL) {
    return {
      ok: false,
      error: "REDACTION_API_URL is not configured.",
    }
  }

  if (!isLocalRecognitionUrl(REDACTION_API_URL)) {
    return {
      ok: false,
      error: "Recognition helper URL must be localhost/127.0.0.1 for privacy.",
    }
  }

  try {
    const response = await fetch(`${REDACTION_API_URL}/match-photo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      return {
        ok: false,
        error: `Recognition helper returned ${response.status}`,
      }
    }

    return {
      ok: true,
      data: (await response.json()) as PhotoProcessingResult,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      error: `Recognition helper unavailable (${message}).`,
    }
  }
}
