import { NextRequest } from "next/server";
import { query } from "../../../_lib/db";
import { authenticate, isResponse } from "../../../_lib/auth";
import { ok, serverError } from "../../../_lib/http";

// PATCH /api/orders/:id/status — migrated from orderRoutes.js (behavior preserved).

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = authenticate(req, { admin: true });
  if (isResponse(auth)) return auth;

  const { id } = await context.params;

  try {
    const { status, payment_status, tracking_number } = await req.json();
    const result = await query(
      `UPDATE orders
       SET status = COALESCE($1, status),
           payment_status = COALESCE($2, payment_status),
           tracking_number = COALESCE($3, tracking_number),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status || null, payment_status || null, tracking_number || null, id]
    );

    if ((result.rowCount ?? 0) === 0) {
      return ok({ message: "Order not found." }, 404);
    }

    return ok({ message: "Order updated successfully", order: result.rows[0] });
  } catch (error) {
    return serverError("Failed to update order status", error);
  }
}
