import { NextRequest } from "next/server";
import { query } from "../../_lib/db";
import { authenticate, isResponse } from "../../_lib/auth";
import { ok, serverError } from "../../_lib/http";

// GET /api/admin/dashboard — migrated from adminRoutes.js (behavior preserved).

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = authenticate(req, { admin: true });
  if (isResponse(auth)) return auth;

  try {
    const [users, products, orders, revenue] = await Promise.all([
      query("SELECT COUNT(*) AS total FROM users"),
      query("SELECT COUNT(*) AS total FROM products"),
      query("SELECT COUNT(*) AS total FROM orders"),
      query("SELECT COALESCE(SUM(total_amount), 0) AS total FROM orders WHERE status != $1", [
        "cancelled",
      ]),
    ]);

    const recentOrders = await query(
      "SELECT * FROM orders ORDER BY created_at DESC LIMIT 10"
    );

    return ok({
      summary: {
        users: Number(users.rows[0].total),
        products: Number(products.rows[0].total),
        orders: Number(orders.rows[0].total),
        revenue: Number(revenue.rows[0].total),
      },
      recentOrders: recentOrders.rows,
    });
  } catch (error) {
    return serverError("Failed to load admin dashboard", error);
  }
}
