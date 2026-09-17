import { NextRequest } from "next/server";
import { query } from "../../_lib/db";
import { authenticate, isResponse } from "../../_lib/auth";
import { ok, serverError } from "../../_lib/http";

// GET /api/orders/:id — migrated from orderRoutes.js (behavior preserved).

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = authenticate(req);
  if (isResponse(auth)) return auth;

  const { id } = await context.params;

  try {
    const orderResult = await query("SELECT * FROM orders WHERE id = $1", [id]);
    if ((orderResult.rowCount ?? 0) === 0) {
      return ok({ message: "Order not found." }, 404);
    }

    const order = orderResult.rows[0];
    if (auth.role !== "admin" && order.user_id !== auth.userId) {
      return ok({ message: "Not allowed to access this order." }, 403);
    }

    const itemsResult = await query(
      "SELECT * FROM order_items WHERE order_id = $1",
      [id]
    );
    const paymentsResult = await query(
      "SELECT * FROM payments WHERE order_id = $1",
      [id]
    );

    return ok({
      order,
      items: itemsResult.rows,
      payments: paymentsResult.rows,
    });
  } catch (error) {
    return serverError("Failed to fetch order", error);
  }
}
