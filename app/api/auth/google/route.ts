import { NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";

// GET /api/auth/google — migrated from authRoutes.js (behavior preserved).
// Redirects the browser to Google's consent screen.

export const dynamic = "force-dynamic";

// Created per-request (not module scope) so builds never read env at import
// time and Vercel runtime env changes apply without a rebuild.
function createGoogleClient() {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL
  );
}

export async function GET() {
  // 'openid' is required so Google returns an id_token, which the
  // callback route verifies. The userinfo scopes provide profile data.
  const scopes = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ];

  const client = createGoogleClient();
  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });

  return NextResponse.redirect(authUrl, 302);
}
