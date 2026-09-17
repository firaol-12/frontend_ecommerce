import { NextRequest } from "next/server";
import { query } from "../../_lib/db";
import { authenticate, isResponse } from "../../_lib/auth";
import { ok, serverError } from "../../_lib/http";

// PUT /api/reviews/:id — migrated from reviewRoutes.js (behavior preserved).

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = authenticate(req);
  if (isResponse(auth)) return auth;

  const { id } = await context.params;

  try {
    const { rating, title, content, is_approved } = await req.json();
    const existing = await query("SELECT * FROM reviews WHERE id = $1", [id]);

    if ((existing.rowCount ?? 0) === 0) {
      return ok({ message: "Review not found." }, 404);
    }

    if (existing.rows[0].user_id !== auth.userId && auth.role !== "admin") {
      return ok({ message: "You cannot edit this review." }, 403);
    }

    const result = await query(
      `UPDATE reviews
       SET rating = COALESCE($1, rating),
           title = COALESCE($2, title),
           content = COALESCE($3, content),
           is_approved = COALESCE($4, is_approved),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [
        rating !== undefined ? Number(rating) : null,
        title !== undefined ? title : null,
        content !== undefined ? content : null,
        is_approved !== undefined ? is_approved : null,
        id,
      ]
    );

    return ok({
      message: "Review updated successfully",
      review: result.rows[0],
    });
  } catch (error) {
    return serverError("Failed to update review", error);
  }
}
