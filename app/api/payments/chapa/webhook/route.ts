import { NextRequest } from "next/server";
import { query } from "../../../_lib/db";
import {
  chapaRequest,
  chapaSecretKey,
  paymentStatusFromChapa,
  verifyWebhookSignature,
  voidFailedOrder,
} from "../../../_lib/payments";
import { badRequest, ok, readJson, serverError } from "../../../_lib/http";

// POST /api/payments/chapa/webhook — migrated from paymentRoutes.js
// (behavior preserved). Chapa POSTs payment events here.
//
// Intentionally UNAUTHENTICATED (Chapa has no user JWT): the request is
// authenticated by the HMAC signature instead, and the status is always
// cross-checked against Chapa's own verify API as a safety net.

export const dynamic = "force-dynamic";
// Outbound call to Chapa's verify API — see the note in ../initialize/route.ts.
// Must stay above CHAPA_TIMEOUT_MS (20s) in _lib/payments.ts.
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    if (!chapaSecretKey()) {
      return ok({ message: "Chapa is not configured." }, 503);
    }
    const body = await readJson<Record<string, unknown>>(req);
    const data = (body.data || body) as Record<string, unknown>;
    const txRef = (data.tx_ref || body.tx_ref || body.tx_reference) as
      | string
      | undefined;
    if (!txRef) {
      return badRequest("tx_ref is required.");
    }

    if (!verifyWebhookSignature(body, txRef)) {
      console.error("[chapa/webhook] Signature verification failed for", txRef);
      return ok({ message: "Invalid webhook signature." }, 401);
    }

    const rawStatus = (data.status || data.event || "") as string;
    let dbStatus = paymentStatusFromChapa(rawStatus);

    // Cross-check with Chapa's API as a safety net.
    try {
      const verifyResult = await chapaRequest(
        `/v1/transaction/verify/${encodeURIComponent(txRef)}`
      );
      const vStatus =
        verifyResult.data && verifyResult.data.data
          ? verifyResult.data.data.status
          : "";
      if (vStatus) dbStatus = paymentStatusFromChapa(vStatus);
    } catch {
      /* keep webhook-derived status if verification fails */
    }

    if (dbStatus === "failed") {
      // The payment definitively failed — restore the stock and cart the order
      // reserved. voidFailedOrder only runs while the order is still pending,
      // so this is safe even if the verify endpoint already voided it.
      const failedPayment = await query(
        "SELECT order_id FROM payments WHERE transaction_id = $1 LIMIT 1",
        [txRef]
      );
      if ((failedPayment.rowCount ?? 0) > 0) {
        await voidFailedOrder(failedPayment.rows[0].order_id);
      }
    }

    await query(
      `UPDATE payments SET status = $1, payment_gateway_response = $2, updated_at = NOW() WHERE transaction_id = $3`,
      [dbStatus, body, txRef]
    );
    await query(
      `UPDATE orders SET payment_status = $1, updated_at = NOW()
       WHERE id = (SELECT order_id FROM payments WHERE transaction_id = $2 LIMIT 1)`,
      [dbStatus, txRef]
    );

    return ok({ received: true, status: dbStatus });
  } catch (error) {
    return serverError("Webhook handling failed", error);
  }
}