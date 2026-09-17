import { NextRequest, NextResponse } from "next/server";
import { query } from "../../../_lib/db";
import { authenticate, isResponse } from "../../../_lib/auth";
import { createOrderFromCart, resolveChapaEmail } from "../../../_lib/payments";
import { ok, readJson } from "../../../_lib/http";

// POST /api/payments/chapa/order — migrated from paymentRoutes.js (behavior
// preserved). Creates the order + pending payment (clears the cart) and
// returns everything needed to start Chapa's hosted checkout.

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = authenticate(req);
  if (isResponse(auth)) return auth;

  try {
    const body = await readJson(req);
    const { orderRef, txRef, totalAmount } = await createOrderFromCart(
      auth.userId,
      body
    );
    const userResult = await query(
      "SELECT first_name, last_name, email, phone FROM users WHERE id = $1",
      [auth.userId]
    );
    const customer = userResult.rows[0] || {};
    const email = resolveChapaEmail(customer);

    return ok(
      {
        message: "Order created",
        tx_ref: txRef,
        amount: Number(totalAmount),
        order: { ...orderRef, payment_status: "pending" },
        customer: {
          first_name: (customer.first_name || "Customer").trim().slice(0, 50),
          last_name: (customer.last_name || "Customer").trim().slice(0, 50),
          email,
          phone_number: customer.phone ? String(customer.phone) : "",
        },
      },
      201
    );
  } catch (error) {
    const status =
      (error as { status?: number }).status === 400 ? 400 : 500;
    console.error(
      "[chapa/order] Failed to create order:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to create order",
      },
      { status }
    );
  }
}
