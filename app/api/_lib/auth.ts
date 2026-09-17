import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

// Mirrors src/middleware/auth.js from the Express backend.
// JWT payload shape is unchanged: { userId, email, role }.
export type AuthUser = { userId: number; email: string; role: string };

export function getToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization") || "";
  return authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
}

/**
 * Express equivalent:
 *   requireAuth  -> 401 { message: "Authorization token is required." } when no
 *                   header; 401 { message: "Invalid or expired token." } when
 *                   jwt.verify throws.
 *   requireAdmin -> 403 { message: "Admin access required." } when role !== admin.
 *
 * Usage in a route handler:
 *   const auth = authenticate(req, { admin: true });
 *   if (auth instanceof NextResponse) return auth;
 *   const user = auth; // { userId, email, role }
 */
export function authenticate(
  req: NextRequest,
  { admin = false }: { admin?: boolean } = {}
): AuthUser | NextResponse {
  const token = getToken(req);

  if (!token) {
    return NextResponse.json(
      { message: "Authorization token is required." },
      { status: 401 }
    );
  }

  let decoded: AuthUser;
  try {
    decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "change-me"
    ) as unknown as AuthUser;
  } catch {
    return NextResponse.json(
      { message: "Invalid or expired token." },
      { status: 401 }
    );
  }

  if (admin && decoded.role !== "admin") {
    return NextResponse.json(
      { message: "Admin access required." },
      { status: 403 }
    );
  }

  return decoded;
}

export function isResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

// Mirrors generateToken() from the Express authRoutes.js — payload and
// expiry unchanged (7d).
export function generateToken(user: { id: number; email: string; role: string }) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET || "change-me",
    { expiresIn: "7d" }
  );
}
