import { NextRequest } from "next/server";
import { query } from "../../_lib/db";
import { authenticate, isResponse } from "../../_lib/auth";
import { ok, serverError } from "../../_lib/http";

// GET /api/orders/my — migrated from orderRoutes.js (behavior preserved).

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = authenticate(req);
  if (isResponse(auth)) return auth;

  try {
    const result = await query(
      `SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
      [auth.userId]
    );
    return ok({ orders: result.rows });
  } catch (error) {
    return serverError("Failed to fetch user orders", error);
  }
}
