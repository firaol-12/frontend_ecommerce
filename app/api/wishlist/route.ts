import { NextRequest } from "next/server";
import { query } from "../_lib/db";
import { authenticate, isResponse } from "../_lib/auth";
import { ok, serverError } from "../_lib/http";

// GET/POST /api/wishlist — migrated from wishlistRoutes.js (behavior preserved).

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = authenticate(req);
  if (isResponse(auth)) return auth;

  try {
    const result = await query(
      `SELECT w.*, p.name, p.price,
              COALESCE((SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_main_image = TRUE LIMIT 1), '') AS image_url
       FROM wishlist w
       JOIN products p ON p.id = w.product_id
       WHERE w.user_id = $1
       ORDER BY w.added_at DESC`,
      [auth.userId]
    );
    return ok({ wishlist: result.rows });
  } catch (error) {
    return serverError("Failed to fetch wishlist", error);
  }
}

export async function POST(req: NextRequest) {
  const auth = authenticate(req);
  if (isResponse(auth)) return auth;

  try {
    const { product_id } = await req.json();
    if (!product_id) {
      return ok({ message: "product_id is required." }, 400);
    }

    const existing = await query(
      "SELECT * FROM wishlist WHERE user_id = $1 AND product_id = $2",
      [auth.userId, product_id]
    );
    if ((existing.rowCount ?? 0) > 0) {
      return ok({ message: "Product is already in wishlist." }, 409);
    }

    const result = await query(
      `INSERT INTO wishlist (user_id, product_id)
       VALUES ($1, $2)
       RETURNING *`,
      [auth.userId, product_id]
    );

    return ok({ message: "Saved to wishlist", item: result.rows[0] }, 201);
  } catch (error) {
    return serverError("Failed to add to wishlist", error);
  }
}
