import { NextRequest } from "next/server";
import { query } from "../_lib/db";
import { authenticate, isResponse } from "../_lib/auth";
import { sanitizeUser } from "../_lib/helpers";
import { ok, serverError } from "../_lib/http";

// GET /api/users — migrated from userRoutes.js (behavior preserved).

export const dynamic = "force-dynamic";

const SELECT_COLUMNS =
  "id, first_name, last_name, email, phone, avatar, role, is_active, created_at, updated_at";

export async function GET(req: NextRequest) {
  const auth = authenticate(req, { admin: true });
  if (isResponse(auth)) return auth;

  try {
    const result = await query(
      `SELECT ${SELECT_COLUMNS} FROM users ORDER BY created_at DESC`
    );

    return ok({ users: result.rows.map(sanitizeUser) });
  } catch (error) {
    return serverError("Failed to fetch users", error);
  }
}
