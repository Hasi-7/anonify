import "server-only"
import { MOCK_GOOGLE_DRIVE_PHOTOS } from "../../mocks/google-drive-fixtures"
import type { EventPhotoLike } from "./types"

type GoogleDriveConfig = {
  clientId?: string
  clientSecret?: string
  folderId?: string
}

function getGoogleDriveConfig(): GoogleDriveConfig {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
  }
}

function hasGoogleDriveConfig(config: GoogleDriveConfig): boolean {
  return Boolean(config.clientId && config.clientSecret && config.folderId)
}

export function listMockEventPhotos(eventId: string): EventPhotoLike[] {
  return MOCK_GOOGLE_DRIVE_PHOTOS.map((photo) => ({
    ...photo,
    eventId,
    source: "mock",
    usedMock: true,
  }))
}

export async function listEventPhotosFromDrive(
  eventId: string,
): Promise<EventPhotoLike[]> {
  const config = getGoogleDriveConfig()

  if (!hasGoogleDriveConfig(config)) {
    return listMockEventPhotos(eventId)
  }

  // Real Drive OAuth/listing is intentionally deferred until the core demo is stable.
  // Keep the dashboard unblocked and deterministic even when keys are present locally.
  return listMockEventPhotos(eventId)
}
