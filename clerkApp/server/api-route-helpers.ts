import "server-only";
import { NextResponse } from "next/server";
import { requireOrganizerAuth } from "@/server/require-organizer";

type RouteContext = {
  params?: unknown;
};

type ApiHandler<TContext extends RouteContext> = (
  request: Request,
  context: TContext,
) => Response | Promise<Response>;

export function publicApiRoute<TContext extends RouteContext>(
  handler: ApiHandler<TContext>,
) {
  return async (request: Request, context: TContext) => {
    return handler(request, context);
  };
}

export function organizerApiRoute<TContext extends RouteContext>(
  handler: ApiHandler<TContext & { userId: string }>,
) {
  return async (request: Request, context: TContext) => {
    const result = await requireOrganizerAuth();
    if (result instanceof NextResponse) return result;

    return handler(request, { ...context, userId: result.userId });
  };
}
