import { NextRequest } from "next/server";
import { query } from "../../_lib/db";
import { authenticate, isResponse } from "../../_lib/auth";
import { ok, serverError } from "../../_lib/http";

// GET/PUT /api/users/profile — migrated from userRoutes.js (behavior preserved).

export const dynamic = "force-dynamic";

const SELECT_COLUMNS =
  "id, first_name, last_name, email, phone, avatar, role, is_active, created_at, updated_at";

export async function GET(req: NextRequest) {
  const auth = authenticate(req);
  if (isResponse(auth)) return auth;

  try {
    const result = await query(
      `SELECT ${SELECT_COLUMNS} FROM users WHERE id = $1`,
      [auth.userId]
    );

    if ((result.rowCount ?? 0) === 0) {
      return ok({ message: "User not found." }, 404);
    }

    return ok({ user: result.rows[0] });
  } catch (error) {
    return serverError("Failed to load profile", error);
  }
}

export async function PUT(req: NextRequest) {
  const auth = authenticate(req);
  if (isResponse(auth)) return auth;

  try {
    const { first_name, last_name, phone, avatar } = await req.json();
    const result = await query(
      `UPDATE users
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           phone = COALESCE($3, phone),
           avatar = COALESCE($4, avatar),
           updated_at = NOW()
       WHERE id = $5
       RETURNING ${SELECT_COLUMNS}`,
      [
        first_name || null,
        last_name || null,
        phone || null,
        avatar || null,
        auth.userId,
      ]
    );

    if ((result.rowCount ?? 0) === 0) {
      return ok({ message: "User not found." }, 404);
    }

    return ok({ message: "Profile updated", user: result.rows[0] });
  } catch (error) {
    return serverError("Update failed", error);
  }
}
