import { NextRequest } from "next/server";
import { query } from "../../../_lib/db";
import { authenticate, isResponse } from "../../../_lib/auth";
import { ok, serverError } from "../../../_lib/http";

// GET/POST /api/payments/order/:orderId — migrated from paymentRoutes.js
// (behavior preserved).

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const auth = authenticate(req);
  if (isResponse(auth)) return auth;

  const { orderId } = await context.params;

  try {
    const result = await query(
      "SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC",
      [orderId]
    );
    return ok({ payments: result.rows });
  } catch (error) {
    return serverError("Failed to fetch payments", error);
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const auth = authenticate(req);
  if (isResponse(auth)) return auth;

  const { orderId } = await context.params;

  try {
    const {
      amount,
      payment_method,
      status = "pending",
      transaction_id,
      payment_gateway_response,
    } = await req.json();

    const result = await query(
      `INSERT INTO payments (order_id, amount, payment_method, status, transaction_id, payment_gateway_response)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        orderId,
        Number(amount),
        payment_method || "credit_card",
        status,
        transaction_id || null,
        payment_gateway_response || null,
      ]
    );

    await query(
      `UPDATE orders
       SET payment_status = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [status || "pending", orderId]
    );

    return ok({ message: "Payment recorded", payment: result.rows[0] }, 201);
  } catch (error) {
    return serverError("Failed to record payment", error);
  }
}
