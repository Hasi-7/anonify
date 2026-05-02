import "server-only";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Enforces Clerk authentication for organizer API routes.
 *
 * Returns the authenticated userId on success.
 * Returns a 401 NextResponse on failure; the caller should return it immediately.
 */
export async function requireOrganizerAuth(): Promise<
  { userId: string } | NextResponse
> {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return { userId };
}
