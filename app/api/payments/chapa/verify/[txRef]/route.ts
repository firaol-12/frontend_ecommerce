import { NextRequest } from "next/server";
import { query } from "../../../../_lib/db";
import { authenticate, isResponse } from "../../../../_lib/auth";
import {
  chapaRequest,
  chapaSecretKey,
  paymentStatusFromChapa,
  voidFailedOrder,
} from "../../../../_lib/payments";
import { getParams, ok, serverError } from "../../../../_lib/http";

// GET /api/payments/chapa/verify/:txRef — migrated from paymentRoutes.js
// (behavior preserved). Asks Chapa for the authoritative status of a payment
// and mirrors it onto the local payments/orders rows.
//
// The customer owns the payment, or an admin may verify anyone's.

export const dynamic = "force-dynamic";
// Outbound call to Chapa's verify API — see the note in ../initialize/route.ts.
// Must stay above CHAPA_TIMEOUT_MS (20s) in _lib/payments.ts.
export const maxDuration = 30;

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ txRef: string }> }
) {
  const auth = authenticate(req);
  if (isResponse(auth)) return auth;

  try {
    if (!chapaSecretKey()) {
      return ok({ message: "Chapa is not configured." }, 503);
    }
    const { txRef } = await getParams(context);

    const payResult = await query(
      `SELECT p.*, o.user_id, o.order_number
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE p.transaction_id = $1`,
      [txRef]
    );
    if ((payResult.rowCount ?? 0) === 0) {
      return ok({ message: "Payment not found." }, 404);
    }
    const paymentRow = payResult.rows[0];
    if (auth.role !== "admin" && paymentRow.user_id !== auth.userId) {
      return ok({ message: "Not allowed to verify this payment." }, 403);
    }

    const result = await chapaRequest(
      `/v1/transaction/verify/${encodeURIComponent(txRef)}`
    );
    const gatewayStatus =
      result.data && result.data.data ? result.data.data.status : "";
    // If we could not reach Chapa at all (network problem), do NOT guess:
    // leave the payment 'pending' so it can be re-verified or settled by the
    // webhook. Marking it 'failed' here would wrongly void orders whose
    // payment may actually have succeeded.
    const dbStatus = result.ok
      ? paymentStatusFromChapa(gatewayStatus)
      : "pending";

    if (result.ok && dbStatus === "failed") {
      // Chapa explicitly reported failure/cancellation — give the stock and
      // cart back (voidFailedOrder is a no-op if the order was already voided
      // or has since been paid).
      await voidFailedOrder(paymentRow.order_id);
    }

    await query(
      `UPDATE payments SET status = $1, payment_gateway_response = $2, updated_at = NOW() WHERE id = $3`,
      [dbStatus, result.data, paymentRow.id]
    );
    await query(
      `UPDATE orders SET payment_status = $1, updated_at = NOW() WHERE id = $2`,
      [dbStatus, paymentRow.order_id]
    );

    return ok({
      status: dbStatus,
      order_number: paymentRow.order_number,
      verified: gatewayStatus === "success",
      gateway_data: result.data,
    });
  } catch (error) {
    return serverError("Failed to verify Chapa payment", error);
  }
}