import { NextRequest, NextResponse } from "next/server";
import { connect, query } from "../../_lib/db";
import { authenticate, isResponse } from "../../_lib/auth";
import { slugify } from "../../_lib/helpers";
import { ok, serverError } from "../../_lib/http";

// GET/PUT/DELETE /api/products/:id — migrated from productRoutes.js (behavior preserved).

export const dynamic = "force-dynamic";

// Base64 data URLs for product images can be large; reject anything absurd.
const MAX_IMAGE_LENGTH = 3000000; // characters (~2 MB of decoded image data)

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const productResult = await query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = $1`,
      [id]
    );

    if ((productResult.rowCount ?? 0) === 0) {
      return ok({ message: "Product not found." }, 404);
    }

    const imagesResult = await query(
      `SELECT * FROM product_images WHERE product_id = $1 ORDER BY display_order ASC, created_at ASC`,
      [id]
    );

    const product = productResult.rows[0];
    product.images = imagesResult.rows;

    return ok({ product });
  } catch (error) {
    return serverError("Failed to fetch product", error);
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = authenticate(req, { admin: true });
  if (isResponse(auth)) return auth;

  const { id } = await context.params;
  let client;
  try {
    client = await connect();
    await client.query("BEGIN");

    const body = await req.json();
    const {
      name,
      description,
      price,
      cost_price,
      discount,
      category_id,
      stock,
      sku,
      is_active,
    } = body;
    const slug = name ? slugify(name) : null;

    const result = await client.query(
      `UPDATE products
       SET name = COALESCE($1, name),
           slug = COALESCE($2, slug),
           description = COALESCE($3, description),
           price = COALESCE($4, price),
           cost_price = COALESCE($5, cost_price),
           discount = COALESCE($6, discount),
           category_id = COALESCE($7, category_id),
           stock = COALESCE($8, stock),
           sku = COALESCE($9, sku),
           is_active = COALESCE($10, is_active),
           updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
      [
        name || null,
        slug,
        description !== undefined ? description : null,
        price !== undefined ? Number(price) : null,
        cost_price !== undefined ? Number(cost_price) : null,
        discount !== undefined ? Number(discount) : null,
        category_id !== undefined ? Number(category_id) : null,
        stock !== undefined ? Number(stock) : null,
        sku !== undefined ? sku : null,
        is_active !== undefined ? is_active : null,
        id,
      ]
    );

    if ((result.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      return ok({ message: "Product not found." }, 404);
    }

    // Replace the main image if a new one was provided
    const image_url = body.image_url || body.main_image;
    if (image_url && image_url.length > MAX_IMAGE_LENGTH) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          message: "Image data is too large. Please upload a smaller image.",
        },
        { status: 400 }
      );
    }
    if (image_url) {
      await client.query(
        `UPDATE product_images
         SET is_main_image = FALSE
         WHERE product_id = $1 AND is_main_image = TRUE`,
        [id]
      );

      const existingMain = await client.query(
        `SELECT id FROM product_images WHERE product_id = $1 AND image_url = $2`,
        [id, image_url]
      );

      if ((existingMain.rowCount ?? 0) > 0) {
        // NOTE: product_images has no updated_at column, so only flip the flag.
        await client.query(
          `UPDATE product_images
           SET is_main_image = TRUE
           WHERE id = $1`,
          [existingMain.rows[0].id]
        );
      } else {
        await client.query(
          `INSERT INTO product_images (product_id, image_url, alt_text, display_order, is_main_image)
           VALUES ($1, $2, $3, 0, TRUE)
           RETURNING *`,
          [id, image_url, name || null]
        );
      }
    }

    await client.query("COMMIT");
    return ok({
      message: "Product updated successfully",
      product: result.rows[0],
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* connection may already be closed */
      }
    }
    return serverError("Failed to update product", error);
  } finally {
    if (client) client.release();
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = authenticate(req, { admin: true });
  if (isResponse(auth)) return auth;

  const { id } = await context.params;

  try {
    const result = await query(
      "DELETE FROM products WHERE id = $1 RETURNING *",
      [id]
    );
    if ((result.rowCount ?? 0) === 0) {
      return ok({ message: "Product not found." }, 404);
    }
    return ok({ message: "Product deleted successfully", deactivated: false });
  } catch (error) {
    // order_items.product_id references products WITHOUT ON DELETE CASCADE on
    // purpose (past orders must keep their snapshots). A product that has been
    // ordered therefore cannot be hard-deleted; deactivate it instead so it
    // disappears from the store but its order history stays intact.
    if ((error as { code?: string }).code === "23503") {
      try {
        const deactivated = await query(
          `UPDATE products
           SET is_active = FALSE, updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [id]
        );
        if ((deactivated.rowCount ?? 0) === 0) {
          return ok({ message: "Product not found." }, 404);
        }
        return ok({
          message:
            "This product is part of past orders, so it was deactivated (hidden from the store) instead of being permanently deleted. You can reactivate it from the Edit form.",
          deactivated: true,
          product: deactivated.rows[0],
        });
      } catch (deactivateError) {
        return NextResponse.json(
          {
            message: "Failed to delete product",
            error:
              deactivateError instanceof Error
                ? deactivateError.message
                : String(deactivateError),
          },
          { status: 500 }
        );
      }
    }
    return serverError("Failed to delete product", error);
  }
}
