import { NextRequest } from "next/server";
import { query } from "../../_lib/db";
import { authenticate, isResponse } from "../../_lib/auth";
import { sanitizeUser } from "../../_lib/helpers";
import { ok, serverError } from "../../_lib/http";

// GET /api/users/:id — migrated from userRoutes.js (behavior preserved).

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = authenticate(req, { admin: true });
  if (isResponse(auth)) return auth;

  const { id } = await context.params;

  try {
    const result = await query(
      "SELECT id, first_name, last_name, email, phone, avatar, role, is_active, created_at, updated_at FROM users WHERE id = $1",
      [id]
    );

    if ((result.rowCount ?? 0) === 0) {
      return ok({ message: "User not found." }, 404);
    }

    return ok({ user: sanitizeUser(result.rows[0]) });
  } catch (error) {
    return serverError("Failed to fetch user", error);
  }
}
