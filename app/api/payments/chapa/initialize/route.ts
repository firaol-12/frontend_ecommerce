import { NextRequest } from "next/server";
import { query } from "../../../_lib/db";
import { authenticate, isResponse } from "../../../_lib/auth";
import {
  chapaReturnBaseUrl,
  chapaRequest,
  chapaSecretKey,
  createOrderFromCart,
  resolveChapaEmail,
  stringifyGatewayMessage,
  voidFailedOrder,
} from "../../../_lib/payments";
import { ok, readJson } from "../../../_lib/http";

// POST /api/payments/chapa/initialize — migrated from paymentRoutes.js
// (behavior preserved). Creates the order from the cart (or resumes an
// existing pending one via tx_ref), records a pending payment and returns
// Chapa's hosted checkout URL for the browser to open.

export const dynamic = "force-dynamic";
// This route makes an outbound HTTPS call to Chapa. Vercel's default function
// timeout is 10s (Hobby), which is tight for an external API round-trip, so
// raise it. Keep it above CHAPA_TIMEOUT_MS (20s) in _lib/payments.ts so our
// own timeout fires first with a useful message. Hobby's max is 60.
export const maxDuration = 30;

type InitializeBody = {
  shipping_address_id?: number;
  billing_address_id?: number;
  shipping_method?: string | null;
  notes?: string | null;
  coupon_code?: string | null;
  tx_ref?: string;
};

export async function POST(req: NextRequest) {
  const auth = authenticate(req);
  if (isResponse(auth)) return auth;

  if (!chapaSecretKey()) {
    return ok(
      {
        message:
          "Chapa is not configured. Set CHAPA_SECRET_KEY in the backend environment.",
      },
      503
    );
  }

  let orderRef:
    | { id: number; order_number: string; total_amount: number }
    | undefined;
  let totalAmount = 0;
  let txRef: string | undefined;
  const body = await readJson<InitializeBody>(req);
  const { tx_ref: existingTxRef } = body;
  const userId = auth.userId;

  // Step 1 — resolve the order: either resume the pending order that
  // /chapa/order already created, or create a fresh one from the cart.
  try {
    if (existingTxRef) {
      // Resume flow: /chapa/order already created the order (and cleared the
      // cart). Reuse that pending payment instead of creating a duplicate —
      // re-creating would fail with "Cart is empty".
      const existing = await query(
        `SELECT p.transaction_id, p.amount, o.id AS order_id, o.order_number, o.payment_status
         FROM payments p JOIN orders o ON o.id = p.order_id
         WHERE p.transaction_id = $1 AND o.user_id = $2`,
        [existingTxRef, userId]
      );
      if (
        (existing.rowCount ?? 0) === 0 ||
        existing.rows[0].payment_status !== "pending"
      ) {
        return ok(
          { message: "No pending payment found for this tx_ref." },
          404
        );
      }
      txRef = existing.rows[0].transaction_id;
      totalAmount = Number(existing.rows[0].amount);
      orderRef = {
        id: existing.rows[0].order_id,
        order_number: existing.rows[0].order_number,
        total_amount: totalAmount,
      };
    } else {
      // New order: createOrderFromCart validates the addresses, computes the
      // totals, inserts the order + order_items, decrements stock, records the
      // pending payment and clears the cart — all in one transaction (shared
      // with /chapa/order so both flows behave identically).
      const created = await createOrderFromCart(
        userId,
        body as Record<string, unknown>
      );
      txRef = created.txRef;
      totalAmount = created.totalAmount;
      orderRef = created.orderRef;
    }
  } catch (error) {
    // createOrderFromCart marks validation problems with err.status = 400;
    // anything else is an unexpected DB failure (same split as Express).
    const isValidation = (error as { status?: number }).status === 400;
    return ok(
      {
        message: isValidation
          ? (error as Error).message
          : "Failed to initialize Chapa payment",
        error: isValidation ? undefined : (error as Error).message,
      },
      isValidation ? 400 : 500
    );
  }

  // Step 2 — the order + pending payment are safely stored. Reach out to
  // Chapa; if anything fails from here, void the order so the customer can
  // retry without losing stock or leaving a stale record.
  try {
    const userResult = await query(
      "SELECT first_name, last_name, email, phone FROM users WHERE id = $1",
      [userId]
    );
    const customer = userResult.rows[0] || {};

    // Chapa rejects placeholder domains (test.com, example.com, ...). Build a
    // Chapa-safe email: the customer's real email, or the CHAPA_TEST_EMAIL
    // fallback for demo accounts (see resolveChapaEmail).
    const email = resolveChapaEmail(customer);

    const init = await chapaRequest("/v1/transaction/initialize", {
      method: "POST",
      body: {
        amount: totalAmount.toFixed(2),
        currency: "ETB",
        email,
        first_name: String(customer.first_name || "Customer").trim().slice(0, 50),
        last_name: String(customer.last_name || "").trim().slice(0, 50),
        phone_number: customer.phone ? String(customer.phone) : undefined,
        callback_url: `${chapaReturnBaseUrl()}/checkout/status`,
        return_url: `${chapaReturnBaseUrl()}/checkout/status`,
        customization: {
          title: "MyShop Order",
          description: `Order ${orderRef?.order_number}`,
        },
        tx_ref: txRef,
      },
    });

    try {
      await query(
        `UPDATE payments SET payment_gateway_response = $1, updated_at = NOW() WHERE transaction_id = $2`,
        [init.data, txRef]
      );
    } catch {
      /* non-fatal */
    }

    if (!init.ok) {
      const gatewayMsg = stringifyGatewayMessage(init.data);
      console.error(
        "[chapa/initialize] Chapa rejected the request:",
        gatewayMsg,
        "| tx_ref:",
        txRef
      );
      await voidFailedOrder(orderRef?.id);
      return ok(
        {
          message: `Chapa could not initialize the payment (${gatewayMsg}).`,
          tx_ref: txRef,
          order: orderRef,
          gateway: init.data,
        },
        502
      );
    }

    const checkoutUrl = init.data?.data?.checkout_url as string | undefined;
    if (!checkoutUrl) {
      console.error(
        "[chapa/initialize] Chapa returned no checkout_url | tx_ref:",
        txRef
      );
      await voidFailedOrder(orderRef?.id);
      return ok(
        {
          message: "Chapa did not return a checkout URL.",
          tx_ref: txRef,
          order: orderRef,
          gateway: init.data,
        },
        502
      );
    }

    return ok(
      {
        message: "Payment initialized",
        tx_ref: txRef,
        checkout_url: checkoutUrl,
        order: { ...orderRef, payment_status: "pending" },
      },
      201
    );
  } catch (error) {
    console.error(
      "[chapa/initialize] Chapa setup failed:",
      error instanceof Error ? error.message : error,
      "| tx_ref:",
      txRef
    );

    // The order + payment were already committed before we reached Chapa. If
    // Chapa setup fails (bad key, network, rejection), void that order so the
    // customer can retry without losing stock or ending up with a stale record.
    await voidFailedOrder(orderRef?.id);

    return ok(
      {
        message:
          "Failed to reach Chapa or set up the payment. Please check your Chapa secret key and your connection, then try again.",
        error: error instanceof Error ? error.message : String(error),
      },
      502
    );
  }
}
