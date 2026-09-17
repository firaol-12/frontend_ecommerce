import { NextRequest } from "next/server";
import { query } from "../_lib/db";
import { authenticate, isResponse } from "../_lib/auth";
import { ok, serverError } from "../_lib/http";

// GET/POST /api/coupons — migrated from couponRoutes.js (behavior preserved).

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = authenticate(req, { admin: true });
  if (isResponse(auth)) return auth;

  try {
    const result = await query("SELECT * FROM coupons ORDER BY created_at DESC");
    return ok({ coupons: result.rows });
  } catch (error) {
    return serverError("Failed to fetch coupons", error);
  }
}

export async function POST(req: NextRequest) {
  const auth = authenticate(req, { admin: true });
  if (isResponse(auth)) return auth;

  try {
    const {
      code,
      description,
      discount_type,
      discount_value,
      max_discount,
      min_order_amount,
      usage_limit,
      per_user_limit,
      start_date,
      end_date,
      is_active = true,
      applicable_categories,
    } = await req.json();

    if (!code || !discount_type || !discount_value || !start_date || !end_date) {
      return ok(
        {
          message:
            "code, discount_type, discount_value, start_date and end_date are required.",
        },
        400
      );
    }

    const result = await query(
      `INSERT INTO coupons (
        code, description, discount_type, discount_value, max_discount,
        min_order_amount, usage_limit, per_user_limit, start_date,
        end_date, is_active, applicable_categories
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        code,
        description || null,
        discount_type,
        Number(discount_value),
        max_discount !== undefined ? Number(max_discount) : null,
        min_order_amount !== undefined ? Number(min_order_amount) : null,
        usage_limit !== undefined ? Number(usage_limit) : null,
        Number(per_user_limit || 1),
        start_date,
        end_date,
        Boolean(is_active),
        applicable_categories || null,
      ]
    );

    return ok(
      { message: "Coupon created successfully", coupon: result.rows[0] },
      201
    );
  } catch (error) {
    return serverError("Failed to create coupon", error);
  }
}
