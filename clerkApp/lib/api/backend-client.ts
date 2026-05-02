import type {
  BackendApiResult,
  BackendAttendee,
  BackendEvent,
  BackendEventOverview,
  BackendHealthResponse,
  BackendPhoto,
  BackendPhotoDetail,
  BackendSeedResponse,
  CreateEventPayload,
  ProcessPhotoPayload,
  RegisterPhotoPayload,
  SubmitAttendeePayload,
} from "./backend-types"

const DEFAULT_BACKEND_URL = "http://127.0.0.1:5000"

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ?? DEFAULT_BACKEND_URL

type RequestOptions = {
  method?: "GET" | "POST"
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path, `${BACKEND_URL}/`)

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }

  return url.toString()
}

async function requestBackend<T>(
  path: string,
  options: RequestOptions = {}
): Promise<BackendApiResult<T>> {
  try {
    const response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? "GET",
      headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      return {
        ok: false,
        status: response.status,
        error: text || `Backend request failed with HTTP ${response.status}`,
      }
    }

    return { ok: true, data: (await response.json()) as T }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, error: `Backend unavailable at ${BACKEND_URL}: ${message}` }
  }
}

export function getBackendHealth(): Promise<BackendApiResult<BackendHealthResponse>> {
  return requestBackend("/health")
}

export function seedDemoData(): Promise<BackendApiResult<BackendSeedResponse>> {
  return requestBackend("/seed", { method: "POST" })
}

export function getEvents(
  organizerId = "demo_organizer_001"
): Promise<BackendApiResult<BackendEvent[]>> {
  return requestBackend("/events", { query: { organizer_id: organizerId } })
}

export function createEvent(
  payload: CreateEventPayload
): Promise<BackendApiResult<BackendEvent>> {
  return requestBackend("/events", { method: "POST", body: payload })
}

export function getEventByKey(eventKey: string): Promise<BackendApiResult<BackendEvent>> {
  return requestBackend(`/events/key/${encodeURIComponent(eventKey)}`)
}

export function getEventOverview(
  eventId: string | number
): Promise<BackendApiResult<BackendEventOverview>> {
  return requestBackend(`/events/${eventId}/overview`)
}

export function getEventAttendees(
  eventId: string | number
): Promise<BackendApiResult<BackendAttendee[]>> {
  return requestBackend(`/events/${eventId}/attendees`)
}

export function getOptOutAttendees(
  eventId: string | number
): Promise<BackendApiResult<BackendAttendee[]>> {
  return requestBackend(`/events/${eventId}/attendees`, { query: { opted_out: true } })
}

export function submitAttendee(
  eventId: string | number,
  payload: SubmitAttendeePayload
): Promise<BackendApiResult<BackendAttendee>> {
  return requestBackend(`/events/${eventId}/attendees`, { method: "POST", body: payload })
}

export function getEventPhotos(
  eventId: string | number
): Promise<BackendApiResult<BackendPhoto[]>> {
  return requestBackend(`/events/${eventId}/photos`)
}

export function registerEventPhoto(
  eventId: string | number,
  payload: RegisterPhotoPayload
): Promise<BackendApiResult<BackendPhoto>> {
  return requestBackend(`/events/${eventId}/photos`, { method: "POST", body: payload })
}

export function getEventPhotoDetail(
  eventId: string | number,
  photoId: string | number
): Promise<BackendApiResult<BackendPhotoDetail>> {
  return requestBackend(`/events/${eventId}/photos/${photoId}`)
}

export function processEventPhoto(
  eventId: string | number,
  photoId: string | number,
  payload: ProcessPhotoPayload
): Promise<BackendApiResult<BackendPhotoDetail>> {
  return requestBackend(`/events/${eventId}/photos/${photoId}/process`, {
    method: "POST",
    body: payload,
  })
}
