import { NextRequest } from "next/server";
import { query } from "../_lib/db";
import { authenticate, isResponse } from "../_lib/auth";
import { ok, serverError } from "../_lib/http";

// GET /api/payments — migrated from paymentRoutes.js (behavior preserved).

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = authenticate(req, { admin: true });
  if (isResponse(auth)) return auth;

  try {
    const result = await query("SELECT * FROM payments ORDER BY created_at DESC");
    return ok({ payments: result.rows });
  } catch (error) {
    return serverError("Failed to fetch all payments", error);
  }
}
