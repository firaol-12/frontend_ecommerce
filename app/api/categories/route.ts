import { NextRequest, NextResponse } from "next/server";
import { query } from "../_lib/db";
import { authenticate, isResponse } from "../_lib/auth";
import { slugify } from "../_lib/helpers";
import { ok, serverError } from "../_lib/http";

// GET/POST /api/categories — migrated from categoryRoutes.js (behavior preserved).

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const categories = await query(
      `SELECT * FROM categories WHERE is_active = TRUE ORDER BY created_at DESC`
    );
    return ok({ categories: categories.rows });
  } catch (error) {
    return serverError("Failed to fetch categories", error);
  }
}

export async function POST(req: NextRequest) {
  const auth = authenticate(req, { admin: true });
  if (isResponse(auth)) return auth;

  try {
    const { name, description, image } = await req.json();
    if (!name) {
      return NextResponse.json(
        { message: "Category name is required." },
        { status: 400 }
      );
    }

    const generatedSlug = slugify(name);
    const result = await query(
      `INSERT INTO categories (name, slug, description, image)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, generatedSlug, description || null, image || null]
    );

    return ok(
      {
        message: "Category created successfully",
        category: result.rows[0],
      },
      201
    );
  } catch (error) {
    return serverError("Failed to create category", error);
  }
}
