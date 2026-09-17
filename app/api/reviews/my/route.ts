import { NextRequest } from "next/server";
import { query } from "../../_lib/db";
import { authenticate, isResponse } from "../../_lib/auth";
import { ok, serverError } from "../../_lib/http";

// GET /api/reviews/my — migrated from reviewRoutes.js (behavior preserved).
// Static segment takes precedence over [id] in Next.js, same as Express.

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = authenticate(req);
  if (isResponse(auth)) return auth;

  try {
    const result = await query(
      "SELECT * FROM reviews WHERE user_id = $1 ORDER BY created_at DESC",
      [auth.userId]
    );
    return ok({ reviews: result.rows });
  } catch (error) {
    return serverError("Failed to fetch your reviews", error);
  }
}
