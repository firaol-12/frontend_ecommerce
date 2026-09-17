import { NextRequest } from "next/server";
import { query } from "../../../_lib/db";
import { ok, serverError } from "../../../_lib/http";

// GET /api/products/slug/:slug — migrated from productRoutes.js (behavior preserved).

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  try {
    const productResult = await query(
      "SELECT * FROM products WHERE slug = $1",
      [slug]
    );
    if ((productResult.rowCount ?? 0) === 0) {
      return ok({ message: "Product not found." }, 404);
    }

    const product = productResult.rows[0];
    const imagesResult = await query(
      `SELECT * FROM product_images WHERE product_id = $1 ORDER BY display_order ASC, created_at ASC`,
      [product.id]
    );

    product.images = imagesResult.rows;

    return ok({ product });
  } catch (error) {
    return serverError("Failed to fetch product by slug", error);
  }
}
