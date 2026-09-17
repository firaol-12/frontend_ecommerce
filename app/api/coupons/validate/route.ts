import { NextRequest } from "next/server";
import { query } from "../../_lib/db";
import { authenticate, isResponse } from "../../_lib/auth";
import { ok, serverError } from "../../_lib/http";

// POST /api/coupons/validate — migrated from couponRoutes.js (behavior preserved).

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = authenticate(req);
  if (isResponse(auth)) return auth;

  try {
    const { code, subtotal } = await req.json();
    if (!code) {
      return ok({ message: "Coupon code is required." }, 400);
    }

    const result = await query(
      `SELECT * FROM coupons
       WHERE code = $1 AND is_active = TRUE
         AND start_date <= CURRENT_DATE
         AND end_date >= CURRENT_DATE`,
      [code]
    );

    if ((result.rowCount ?? 0) === 0) {
      return ok({ message: "Coupon not found or expired." }, 404);
    }

    const coupon = result.rows[0];
    const numericSubtotal = Number(subtotal || 0);

    if (
      coupon.min_order_amount &&
      numericSubtotal < Number(coupon.min_order_amount)
    ) {
      return ok(
        {
          message: `Minimum order amount for this coupon is ${coupon.min_order_amount}.`,
        },
        400
      );
    }

    const discount =
      coupon.discount_type === "percentage"
        ? Math.min(
            (numericSubtotal * Number(coupon.discount_value)) / 100,
            Number(coupon.max_discount || numericSubtotal)
          )
        : Number(coupon.discount_value);

    return ok({ valid: true, coupon, discount });
  } catch (error) {
    return serverError("Failed to validate coupon", error);
  }
}
