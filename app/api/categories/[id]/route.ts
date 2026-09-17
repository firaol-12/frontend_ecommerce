import { NextRequest } from "next/server";
import { query } from "../../_lib/db";
import { authenticate, isResponse } from "../../_lib/auth";
import { slugify } from "../../_lib/helpers";
import { ok, serverError } from "../../_lib/http";

// GET/PUT/DELETE /api/categories/:id — migrated from categoryRoutes.js (behavior preserved).

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const result = await query("SELECT * FROM categories WHERE id = $1", [id]);
    if ((result.rowCount ?? 0) === 0) {
      return ok({ message: "Category not found." }, 404);
    }
    return ok({ category: result.rows[0] });
  } catch (error) {
    return serverError("Failed to fetch category", error);
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = authenticate(req, { admin: true });
  if (isResponse(auth)) return auth;

  const { id } = await context.params;

  try {
    const { name, description, image, is_active } = await req.json();
    const newSlug = name ? slugify(name) : null;

    const result = await query(
      `UPDATE categories
       SET name = COALESCE($1, name),
           slug = COALESCE($2, slug),
           description = COALESCE($3, description),
           image = COALESCE($4, image),
           is_active = COALESCE($5, is_active),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        name || null,
        newSlug,
        description !== undefined ? description : null,
        image !== undefined ? image : null,
        is_active !== undefined ? is_active : null,
        id,
      ]
    );

    if ((result.rowCount ?? 0) === 0) {
      return ok({ message: "Category not found." }, 404);
    }

    return ok({
      message: "Category updated successfully",
      category: result.rows[0],
    });
  } catch (error) {
    return serverError("Failed to update category", error);
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
      "DELETE FROM categories WHERE id = $1 RETURNING *",
      [id]
    );
    if ((result.rowCount ?? 0) === 0) {
      return ok({ message: "Category not found." }, 404);
    }
    return ok({ message: "Category deleted successfully" });
  } catch (error) {
    return serverError("Failed to delete category", error);
  }
}
