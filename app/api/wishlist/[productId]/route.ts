import { NextRequest } from "next/server";
import { query } from "../../_lib/db";
import { authenticate, isResponse } from "../../_lib/auth";
import { ok, serverError } from "../../_lib/http";

// DELETE /api/wishlist/:productId — migrated from wishlistRoutes.js (behavior preserved).

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ productId: string }> }
) {
  const auth = authenticate(req);
  if (isResponse(auth)) return auth;

  const { productId } = await context.params;

  try {
    const result = await query(
      "DELETE FROM wishlist WHERE user_id = $1 AND product_id = $2 RETURNING *",
      [auth.userId, productId]
    );

    if ((result.rowCount ?? 0) === 0) {
      return ok({ message: "Wishlist item not found." }, 404);
    }

    return ok({ message: "Removed from wishlist" });
  } catch (error) {
    return serverError("Failed to remove from wishlist", error);
  }
}
