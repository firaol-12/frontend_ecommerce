import { NextRequest } from "next/server";
import { query } from "../../_lib/db";
import { authenticate, isResponse } from "../../_lib/auth";
import { ok, serverError } from "../../_lib/http";

// GET /api/auth/me — migrated from authRoutes.js (behavior preserved).

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = authenticate(req);
  if (isResponse(auth)) return auth;

  try {
    const result = await query(
      "SELECT id, first_name, last_name, email, phone, avatar, role, is_active, created_at, updated_at FROM users WHERE id = $1",
      [auth.userId]
    );

    if ((result.rowCount ?? 0) === 0) {
      return ok({ message: "User not found." }, 404);
    }

    return ok({ user: result.rows[0] });
  } catch (error) {
    return serverError("Failed to load user", error);
  }
}
