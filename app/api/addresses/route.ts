import { NextRequest } from "next/server";
import { query } from "../_lib/db";
import { authenticate, isResponse } from "../_lib/auth";
import { ok, serverError } from "../_lib/http";

// GET/POST /api/addresses — migrated from addressRoutes.js (behavior preserved).

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = authenticate(req);
  if (isResponse(auth)) return auth;

  try {
    const result = await query(
      "SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC",
      [auth.userId]
    );
    return ok({ addresses: result.rows });
  } catch (error) {
    return serverError("Failed to fetch addresses", error);
  }
}

export async function POST(req: NextRequest) {
  const auth = authenticate(req);
  if (isResponse(auth)) return auth;

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
      is_default = false,
    } = await req.json();

    if (
      !full_name ||
      !phone ||
      !street ||
      !city ||
      !state ||
      !postal_code ||
      !country ||
      !address_type
    ) {
      return ok({ message: "All address fields are required." }, 400);
    }

    if (is_default) {
      await query(
        `UPDATE addresses SET is_default = FALSE WHERE user_id = $1 AND address_type = $2`,
        [auth.userId, address_type]
      );
    }

    const result = await query(
      `INSERT INTO addresses (user_id, full_name, phone, street, city, state, postal_code, country, address_type, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        auth.userId,
        full_name,
        phone,
        street,
        city,
        state,
        postal_code,
        country,
        address_type,
        Boolean(is_default),
      ]
    );

    return ok({ message: "Address added", address: result.rows[0] }, 201);
  } catch (error) {
    return serverError("Failed to create address", error);
  }
}
