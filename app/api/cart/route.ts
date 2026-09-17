import { NextRequest } from "next/server";
import { query } from "../_lib/db";
import { authenticate, isResponse } from "../_lib/auth";
import { ok, serverError } from "../_lib/http";

// GET/POST /api/cart — migrated from cartRoutes.js (behavior preserved).

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = authenticate(req);
  if (isResponse(auth)) return auth;

  try {
    const result = await query(
      `SELECT c.*, p.name AS product_name, p.price, p.discount,
              COALESCE((SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_main_image = TRUE LIMIT 1), '') AS image_url
       FROM cart c
       JOIN products p ON p.id = c.product_id
       WHERE c.user_id = $1
       ORDER BY c.added_at DESC`,
      [auth.userId]
    );

    return ok({ cart: result.rows });
  } catch (error) {
    return serverError("Failed to fetch cart", error);
  }
}

export async function POST(req: NextRequest) {
  const auth = authenticate(req);
  if (isResponse(auth)) return auth;

  try {
    const { product_id, quantity = 1 } = await req.json();
    if (!product_id) {
      return ok({ message: "product_id is required." }, 400);
    }

    const existing = await query(
      "SELECT * FROM cart WHERE user_id = $1 AND product_id = $2",
      [auth.userId, product_id]
    );

    if ((existing.rowCount ?? 0) > 0) {
      const updated = await query(
        `UPDATE cart
         SET quantity = quantity + $1,
             updated_at = NOW()
         WHERE user_id = $2 AND product_id = $3
         RETURNING *`,
        [Number(quantity), auth.userId, product_id]
      );
      return ok({ message: "Cart item updated", item: updated.rows[0] });
    }

    const result = await query(
      `INSERT INTO cart (user_id, product_id, quantity)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [auth.userId, product_id, Number(quantity)]
    );

    return ok(
      { message: "Item added to cart", item: result.rows[0] },
      201
    );
  } catch (error) {
    return serverError("Failed to add item to cart", error);
  }
}
