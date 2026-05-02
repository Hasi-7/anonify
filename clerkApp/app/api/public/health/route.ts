import { NextResponse } from "next/server";
import { publicApiRoute } from "@/server/api-route-helpers";

// Every API route explicitly declares its access level.
export const apiAccess = "public" as const;

// GET /api/public/health
// Public health-check endpoint. No auth required.
export const GET = publicApiRoute(async () => {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});
