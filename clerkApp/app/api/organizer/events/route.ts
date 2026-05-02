import { NextResponse } from "next/server";
import { organizerApiRoute } from "@/server/api-route-helpers";

export const apiAccess = "organizer" as const;

// GET /api/organizer/events
// Returns events owned by the authenticated organizer.
export const GET = organizerApiRoute(async (_request, { userId }) => {
  // TODO: Fetch events from backend filtered by userId
  return NextResponse.json({
    userId,
    events: [],
    message: "Organizer events list (placeholder)",
  });
});
