import { NextRequest } from "next/server";
import { query } from "../../../_lib/db";
import { authenticate, isResponse } from "../../../_lib/auth";
import { voidFailedOrder } from "../../../_lib/payments";
import { ok, readJson, serverError } from "../../../_lib/http";

// POST /api/payments/chapa/cancel — migrated from paymentRoutes.js (behavior
// preserved, including the fixed voidFailedOrder semantics). Cancel a pending
// order if the customer never reached the payment form (e.g. a connection
// problem between the browser and Chapa). Restores stock AND the cart items
// so the customer can retry immediately.

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = authenticate(req);
  if (isResponse(auth)) return auth;

  try {
    const { tx_ref } = await readJson<{ tx_ref?: string }>(req);
    if (!tx_ref) return ok({ message: "tx_ref is required." }, 400);
    const payResult = await query(
      `SELECT p.order_id, p.status, o.user_id FROM payments p JOIN orders o ON o.id = p.order_id
       WHERE p.transaction_id = $1 AND o.user_id = $2`,
      [tx_ref, auth.userId]
    );
    if ((payResult.rowCount ?? 0) === 0) {
      return ok({ message: "Order not found." }, 404);
    }
    if (payResult.rows[0].status === "completed") {
      // Never void an order the customer already paid for (e.g. a late retry
      // of cancel racing with a successful webhook).
      return ok(
        { message: "This order was already paid and cannot be cancelled." },
        409
      );
    }
    await voidFailedOrder(payResult.rows[0].order_id);
    return ok({ message: "Order cancelled.", cart_restored: true });
  } catch (error) {
    return serverError("Failed to cancel order", error);
  }
}
