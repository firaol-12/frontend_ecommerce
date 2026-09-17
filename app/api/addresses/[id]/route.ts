import { NextRequest } from "next/server";
import { query } from "../../_lib/db";
import { authenticate, isResponse } from "../../_lib/auth";
import { ok, serverError } from "../../_lib/http";

// PUT/DELETE /api/addresses/:id — migrated from addressRoutes.js (behavior preserved).

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = authenticate(req);
  if (isResponse(auth)) return auth;

  const { id } = await context.params;

  try {
    const {
      full_name,
      phone,
      street,
      city,
      state,
      postal_code,
      country,
      address_type,
      is_default,
    } = await req.json();

    if (is_default) {
      await query(
        `UPDATE addresses SET is_default = FALSE WHERE user_id = $1 AND address_type = $2`,
        [auth.userId, address_type || "shipping"]
      );
    }

    const result = await query(
      `UPDATE addresses
       SET full_name = COALESCE($1, full_name),
           phone = COALESCE($2, phone),
           street = COALESCE($3, street),
           city = COALESCE($4, city),
           state = COALESCE($5, state),
           postal_code = COALESCE($6, postal_code),
           country = COALESCE($7, country),
           address_type = COALESCE($8, address_type),
           is_default = COALESCE($9, is_default),
           updated_at = NOW()
       WHERE id = $10 AND user_id = $11
       RETURNING *`,
      [
        full_name || null,
        phone || null,
        street || null,
        city || null,
        state || null,
        postal_code || null,
        country || null,
        address_type || null,
        is_default !== undefined ? Boolean(is_default) : null,
        id,
        auth.userId,
      ]
    );

    if ((result.rowCount ?? 0) === 0) {
      return ok({ message: "Address not found." }, 404);
    }

    return ok({ message: "Address updated", address: result.rows[0] });
  } catch (error) {
    return serverError("Failed to update address", error);
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
      "DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING *",
      [id, auth.userId]
    );

    if ((result.rowCount ?? 0) === 0) {
      return ok({ message: "Address not found." }, 404);
    }

    return ok({ message: "Address deleted" });
  } catch (error) {
    return serverError("Failed to delete address", error);
  }
}
