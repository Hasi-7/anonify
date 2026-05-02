import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public UI routes — no auth required
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/attend(.*)",
]);

// Middleware handles UI route protection ONLY.
// API routes handle their own auth explicitly inside each route handler.
export default clerkMiddleware(async (auth, req) => {
  const path = req.nextUrl.pathname;

  // Never touch API routes — they declare and enforce their own access level.
  if (path.startsWith("/api")) {
    return;
  }

  // Protect organizer UI routes (everything not in the public list).
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip static files and Next.js internals.
    "/((?!_next/|.*\\..*).*)",
  ],
};
