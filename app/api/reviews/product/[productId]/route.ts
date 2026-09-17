import { NextRequest } from "next/server";
import { query } from "../../../_lib/db";
import { authenticate, isResponse } from "../../../_lib/auth";
import { ok, serverError } from "../../../_lib/http";

// GET/POST /api/reviews/product/:productId — migrated from reviewRoutes.js
// (behavior preserved, including the product rating recompute after insert).

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ productId: string }> }
) {
  const { productId } = await context.params;
  try {
    const result = await query(
      `SELECT r.*, u.first_name, u.last_name
       FROM reviews r
       JOIN users u ON u.id = r.user_id
       WHERE r.product_id = $1
       ORDER BY r.created_at DESC`,
      [productId]
    );
    return ok({ reviews: result.rows });
  } catch (error) {
    return serverError("Failed to fetch reviews", error);
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ productId: string }> }
) {
  const auth = authenticate(req);
  if (isResponse(auth)) return auth;

  const { productId } = await context.params;

  try {
    const { rating, title, content, is_verified_purchase = false } =
      await req.json();

    if (!rating || rating < 1 || rating > 5) {
      return ok({ message: "Rating must be between 1 and 5." }, 400);
    }

    const result = await query(
      `INSERT INTO reviews (product_id, user_id, rating, title, content, is_verified_purchase)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [productId, auth.userId, Number(rating), title || null, content || null, Boolean(is_verified_purchase)]
    );

    const stats = await query(
      `SELECT ROUND(AVG(rating), 2) AS avg_rating, COUNT(*) AS rating_count
       FROM reviews WHERE product_id = $1`,
      [productId]
    );

    await query(
      `UPDATE products
       SET rating = $1,
           rating_count = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [Number(stats.rows[0].avg_rating || 0), Number(stats.rows[0].rating_count || 0), productId]
    );

    return ok(
      { message: "Review created successfully", review: result.rows[0] },
      201
    );
  } catch (error) {
    return serverError("Failed to create review", error);
  }
}
