import { NextRequest } from "next/server";
import { query } from "../../../_lib/db";
import { authenticate, isResponse } from "../../../_lib/auth";
import { ok, serverError } from "../../../_lib/http";

// POST /api/products/:id/images — migrated from productRoutes.js (behavior
// preserved). Images arrive as URLs/base64 data-URLs inside the JSON body
// (the original app used no multer/disk storage, so this is already
// serverless-safe).

export const dynamic = "force-dynamic";

// Base64 data URLs for product images can be large; reject anything absurd.
const MAX_IMAGE_LENGTH = 3000000; // characters (~2 MB of decoded image data)

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = authenticate(req, { admin: true });
  if (isResponse(auth)) return auth;

  const { id } = await context.params;

  try {
    const { image_url, alt_text, display_order = 0, is_main_image = false } =
      await req.json();
    if (!image_url) {
      return ok({ message: "image_url is required." }, 400);
    }
    if (image_url.length > MAX_IMAGE_LENGTH) {
      return ok(
        { message: "Image data is too large. Please upload a smaller image." },
        400
      );
    }

    const result = await query(
      `INSERT INTO product_images (product_id, image_url, alt_text, display_order, is_main_image)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, image_url, alt_text || null, Number(display_order), Boolean(is_main_image)]
    );

    return ok({ message: "Product image added", image: result.rows[0] }, 201);
  } catch (error) {
    return serverError("Failed to add product image", error);
  }
}
