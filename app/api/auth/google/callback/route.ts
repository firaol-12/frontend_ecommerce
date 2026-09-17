import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { query } from "../../../_lib/db";
import { generateToken } from "../../../_lib/auth";

// GET /api/auth/google/callback — migrated from authRoutes.js (behavior
// preserved): exchange ?code for tokens, verify the id_token, upsert the
// user, then redirect to the frontend with the JWT in the query string.

export const dynamic = "force-dynamic";

function createGoogleClient() {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL
  );
}

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");

    if (!code) {
      return NextResponse.json(
        { message: "Authorization code is required." },
        { status: 400 }
      );
    }

    const client = createGoogleClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    let payload;
    type GooglePayload = {
      sub: string;
      email?: string;
      given_name?: string;
      family_name?: string;
      picture?: string | null;
    };

    if (tokens.id_token) {
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload() as unknown as GooglePayload;
    } else {
      // Fallback: fetch the profile directly with the access token.
      // (The old googleClient.getUserInfo() API was removed in
      // google-auth-library v10 — this is the same userinfo call it made.)
      if (!tokens.access_token) {
        throw new Error("Google did not return an access token.");
      }
      const userinfoRes = await fetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      );
      if (!userinfoRes.ok) {
        throw new Error(
          `Failed to fetch Google profile (HTTP ${userinfoRes.status}).`
        );
      }
      payload = (await userinfoRes.json()) as unknown as GooglePayload;
    }
    const googleId = payload.sub;
    const email = payload.email;
    const firstName = payload.given_name || "";
    const lastName = payload.family_name || "";
    const avatar = payload.picture || null;

    if (!email) {
      return NextResponse.json(
        { message: "Email not provided by Google." },
        { status: 400 }
      );
    }

    // Check if user exists by google_id
    let result = await query("SELECT * FROM users WHERE google_id = $1", [
      googleId,
    ]);

    let user;

    if ((result.rowCount ?? 0) > 0) {
      // User exists with this Google ID
      user = result.rows[0];
    } else {
      // Check if user exists with this email
      result = await query("SELECT * FROM users WHERE email = $1", [
        email.toLowerCase(),
      ]);

      if ((result.rowCount ?? 0) > 0) {
        // User exists with email, link Google account
        user = result.rows[0];
        await query(
          "UPDATE users SET google_id = $1, avatar = COALESCE(avatar, $2) WHERE id = $3",
          [googleId, avatar, user.id]
        );
      } else {
        // Create new user
        const insertResult = await query(
          `INSERT INTO users (first_name, last_name, email, google_id, avatar, role, is_active)
           VALUES ($1, $2, $3, $4, $5, 'customer', true)
           RETURNING id, first_name, last_name, email, phone, avatar, role, is_active, created_at, updated_at`,
          [firstName, lastName, email.toLowerCase(), googleId, avatar]
        );
        user = insertResult.rows[0];
      }
    }

    const token = generateToken(user);

    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    return NextResponse.redirect(
      `${frontendUrl}/auth/callback?token=${token}`,
      302
    );
  } catch (error) {
    console.error("Google OAuth error:", error);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    // Surface the real reason to the frontend so failures are diagnosable
    // (e.g. invalid_client, invalid_grant, missing DB column, etc.).
    const details = encodeURIComponent(
      String(error instanceof Error ? error.message : error).slice(0, 200)
    );
    return NextResponse.redirect(
      `${frontendUrl}/login?error=google_auth_failed&details=${details}`,
      302
    );
  }
}
