import { NextRequest, NextResponse } from "next/server";
import { connect, query } from "../_lib/db";
import { authenticate, isResponse } from "../_lib/auth";
import { buildPagination, slugify } from "../_lib/helpers";
import { ok, serverError } from "../_lib/http";

// GET/POST /api/products — migrated from productRoutes.js (behavior preserved).

export const dynamic = "force-dynamic";

// Base64 data URLs for product images can be large; reject anything absurd.
export const MAX_IMAGE_LENGTH = 3000000; // characters (~2 MB of decoded image data)

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const categoryId = sp.get("categoryId");
    const search = sp.get("search");
    const minPrice = sp.get("minPrice");
    const maxPrice = sp.get("maxPrice");
    const sort = sp.get("sort") || "newest";
    const page = sp.get("page") || 1;
    const limit = sp.get("limit") || 12;
    const includeInactive = sp.get("includeInactive");
    const { offset, limit: pageLimit } = buildPagination(page, limit);

    // The storefront only ever sees active products. The dashboard passes
    // includeInactive=true so admins can still see (and reactivate) products
    // that were soft-deleted because they belong to past orders.
    const showInactive = includeInactive === "true" || includeInactive === "1";

    let sql = `
      SELECT p.*, c.name AS category_name,
             COALESCE((SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_main_image = TRUE LIMIT 1), '') AS main_image,
             COALESCE((SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_main_image = TRUE LIMIT 1), '') AS image_url
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE TRUE
    `;

    if (!showInactive) {
      sql += ` AND p.is_active = TRUE`;
    }

    const params: unknown[] = [];
    let paramIndex = 1;

    if (categoryId) {
      sql += ` AND p.category_id = $${paramIndex}`;
      params.push(categoryId);
      paramIndex += 1;
    }

    if (search) {
      sql += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex += 1;
    }

    if (minPrice) {
      sql += ` AND p.price >= $${paramIndex}`;
      params.push(Number(minPrice));
      paramIndex += 1;
    }

    if (maxPrice) {
      sql += ` AND p.price <= $${paramIndex}`;
      params.push(Number(maxPrice));
      paramIndex += 1;
    }

    const sortMap: Record<string, string> = {
      newest: "p.created_at DESC",
      price_asc: "p.price ASC",
      price_desc: "p.price DESC",
      rating: "p.rating DESC",
      popular: "p.view_count DESC",
    };

    sql += ` ORDER BY ${sortMap[sort] || sortMap.newest}`;
    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(pageLimit, offset);

    const result = await query(sql, params);

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM products p WHERE p.is_active = TRUE ${
        categoryId ? "AND p.category_id = $1" : ""
      }`,
      categoryId ? [categoryId] : []
    );

    return ok({
      products: result.rows,
      pagination: {
        page: Number(page),
        limit: pageLimit,
        total: Number(countResult.rows[0].total),
      },
    });
  } catch (error) {
    return serverError("Failed to fetch products", error);
  }
}

export async function POST(req: NextRequest) {
  const auth = authenticate(req, { admin: true });
  if (isResponse(auth)) return auth;

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
      discount = 0,
      category_id,
      stock = 0,
      sku,
      is_active = true,
    } = body;

    if (!name || !description || !price || !category_id) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { message: "name, description, price, and category_id are required." },
        { status: 400 }
      );
    }

    const image_url = body.image_url || body.main_image;
    if (image_url && image_url.length > MAX_IMAGE_LENGTH) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          message:
            "Image data is too large. Please upload a smaller image.",
        },
        { status: 400 }
      );
    }

    const slug = slugify(name);
    const result = await client.query(
      `INSERT INTO products (
        name, slug, description, price, cost_price, discount, category_id, stock, sku, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        name,
        slug,
        description,
        Number(price),
        cost_price !== undefined ? Number(cost_price) : null,
        Number(discount),
        Number(category_id),
        Number(stock),
        sku || null,
        is_active,
      ]
    );

    const product = result.rows[0];

    // Save the main image if one was provided
    if (image_url) {
      await client.query(
        `INSERT INTO product_images (product_id, image_url, alt_text, display_order, is_main_image)
         VALUES ($1, $2, $3, 0, TRUE)
         RETURNING *`,
        [product.id, image_url, name || null]
      );
    }

    await client.query("COMMIT");
    return ok(
      { message: "Product created successfully", product },
      201
    );
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* connection may already be closed */
      }
    }
    return serverError("Failed to create product", error);
  } finally {
    if (client) client.release();
  }
}
