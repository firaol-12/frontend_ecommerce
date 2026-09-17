import { NextResponse } from "next/server";

// GET /api/health — migrated from app.js health check (Express: app.get('/api/health')).

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Ecommerce API is running",
    timestamp: new Date().toISOString(),
  });
}
