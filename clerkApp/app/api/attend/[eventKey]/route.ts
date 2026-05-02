import { NextResponse } from "next/server";
import { publicApiRoute } from "@/server/api-route-helpers";

// Every API route explicitly declares its access level.
export const apiAccess = "public" as const;

// GET /api/attend/[eventKey]
// Public endpoint for attendee event lookup. No auth required.
// Scoped to eventKey — attendees use this to find their event.
export const GET = publicApiRoute(
  async (_request, { params }: { params: Promise<{ eventKey: string }> }) => {
    const { eventKey } = await params;

    // TODO: Look up event by eventKey from backend
    return NextResponse.json({
      eventKey,
      message: `Event lookup for key: ${eventKey}`,
      // Will be replaced with real backend call
    });
  },
);
