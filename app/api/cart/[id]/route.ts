import { NextRequest } from "next/server";
import { query } from "../../_lib/db";
import { authenticate, isResponse } from "../../_lib/auth";
import { ok, serverError } from "../../_lib/http";

// PATCH/DELETE /api/cart/:id — migrated from cartRoutes.js (behavior preserved).

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = authenticate(req);
  if (isResponse(auth)) return auth;

  const { id } = await context.params;

  try {
    const { quantity } = await req.json();
    const result = await query(
      `UPDATE cart
       SET quantity = $1,
           updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [Number(quantity), id, auth.userId]
    );

    if ((result.rowCount ?? 0) === 0) {
      return ok({ message: "Cart item not found." }, 404);
    }

    return ok({ message: "Cart item updated", item: result.rows[0] });
  } catch (error) {
    return serverError("Failed to update cart item", error);
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = authenticate(req);
  if (isResponse(auth)) return auth;

  const { id } = await context.params;

  try {
    const result = await query(
      "DELETE FROM cart WHERE id = $1 AND user_id = $2 RETURNING *",
      [id, auth.userId]
    );

    if ((result.rowCount ?? 0) === 0) {
      return ok({ message: "Cart item not found." }, 404);
    }

    return ok({ message: "Cart item removed" });
  } catch (error) {
    return serverError("Failed to remove cart item", error);
  }
}
