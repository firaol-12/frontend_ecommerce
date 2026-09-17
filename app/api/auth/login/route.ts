import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query } from "../../_lib/db";
import { generateToken } from "../../_lib/auth";
import { sanitizeUser } from "../../_lib/helpers";
import { readJson, serverError } from "../../_lib/http";

// POST /api/auth/login — migrated from authRoutes.js (behavior preserved).

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await readJson<{
      email?: string;
      password?: string;
    }>(req);

    if (!email || !password) {
      return NextResponse.json(
        { message: "Email and password are required." },
        { status: 400 }
      );
    }

    const result = await query(
      "SELECT * FROM users WHERE email = $1 AND is_active = TRUE",
      [String(email).trim().toLowerCase()]
    );

    if ((result.rowCount ?? 0) === 0) {
      return NextResponse.json(
        { message: "Invalid email or password." },
        { status: 401 }
      );
    }

    const user = result.rows[0];

    // Google-only accounts have no password set.
    if (!user.password) {
      return NextResponse.json(
        {
          message:
            "This account uses Google sign-in. Please continue with Google.",
        },
        { status: 401 }
      );
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return NextResponse.json(
        { message: "Invalid email or password." },
        { status: 401 }
      );
    }

    const token = generateToken(user);

    return NextResponse.json({
      message: "Login successful",
      user: sanitizeUser(user),
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    return serverError("Failed to login", error);
  }
}
