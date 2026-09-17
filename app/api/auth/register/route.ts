import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "../../_lib/db";
import { generateToken } from "../../_lib/auth";
import { sanitizeUser } from "../../_lib/helpers";
import { readJson, serverError } from "../../_lib/http";

// POST /api/auth/register — migrated from authRoutes.js (behavior preserved).

export const dynamic = "force-dynamic";

type RegisterBody = {
  first_name?: string;
  last_name?: string;
  email?: string;
  password?: string;
  phone?: string;
  avatar?: string;
};

export async function POST(req: NextRequest) {
  try {
    const { first_name, last_name, email, password, phone, avatar } =
      await readJson<RegisterBody>(req);

    if (!first_name || !last_name || !email || !password) {
      return NextResponse.json(
        {
          message:
            "first_name, last_name, email and password are required.",
        },
        { status: 400 }
      );
    }

    const existing = await query(
      "SELECT id FROM users WHERE email = $1",
      [email.trim().toLowerCase()]
    );
    if ((existing.rowCount ?? 0) > 0) {
      return NextResponse.json(
        { message: "User already exists with this email." },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (first_name, last_name, email, password, phone, avatar)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, first_name, last_name, email, phone, avatar, role, is_active, created_at, updated_at`,
      [
        first_name.trim(),
        last_name.trim(),
        email.trim().toLowerCase(),
        hashedPassword,
        phone || null,
        avatar || null,
      ]
    );

    const user = result.rows[0];
    const token = generateToken({ ...user, role: "customer" });

    return NextResponse.json(
      {
        message: "User registered successfully",
        user: sanitizeUser({ ...user, role: "customer" }),
        token,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register error:", error);
    return serverError("Failed to register user", error);
  }
}
