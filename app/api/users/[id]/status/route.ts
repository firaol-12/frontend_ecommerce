import { NextRequest } from "next/server";
import { query } from "../../../_lib/db";
import { authenticate, isResponse } from "../../../_lib/auth";
import { ok, serverError } from "../../../_lib/http";

// PATCH /api/users/:id/status — migrated from userRoutes.js (behavior preserved).

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = authenticate(req, { admin: true });
  if (isResponse(auth)) return auth;

  const { id } = await context.params;

  try {
    const { is_active, role } = await req.json();

    const result = await query(
      `UPDATE users
       SET is_active = COALESCE($1, is_active),
           role = COALESCE($2, role),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, first_name, last_name, email, phone, avatar, role, is_active, created_at, updated_at`,
      [
        is_active !== undefined ? Boolean(is_active) : null,
        role || null,
        id,
      ]
    );

    if ((result.rowCount ?? 0) === 0) {
      return ok({ message: "User not found." }, 404);
    }

    return ok({ message: "User status updated", user: result.rows[0] });
  } catch (error) {
    return serverError("Failed to update user", error);
  }
}
