import crypto from "crypto";
import type { PoolClient } from "pg";
import { connect, query } from "./db";

// Shared Chapa payment helpers — ported from the Express paymentRoutes.js.
// Environment values are read lazily (per call) so Vercel runtime env changes
// apply without a rebuild; the Express version read them at module scope.

export function chapaApiUrl() {
  return (process.env.CHAPA_API_URL || "https://api.chapa.co").replace(
    /\/+$/,
    ""
  );
}

export function chapaSecretKey() {
  return process.env.CHAPA_SECRET_KEY || "";
}

export function chapaWebhookSecret() {
  return process.env.CHAPA_WEBHOOK_SECRET || "";
}

export function chapaTestEmail() {
  return process.env.CHAPA_TEST_EMAIL || "";
}

export function chapaReturnBaseUrl() {
  return (process.env.CHAPA_CALLBACK_URL || "http://localhost:3000").replace(
    /\/+$/,
    ""
  );
}

export function makeTxRef(userId: number) {
  return `TRX-${userId}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function generateOrderNumber() {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${timestamp}-${random}`;
}

// Chapa's error "message" may be a plain string or a validation object.
export function stringifyGatewayMessage(data: unknown): string {
  const msg =
    data && typeof data === "object"
      ? (data as { message?: unknown }).message
      : undefined;
  if (typeof msg === "string") return msg;
  if (msg && typeof msg === "object") {
    try {
      return JSON.stringify(msg);
    } catch {
      /* fall through */
    }
  }
  return "unknown error";
}

// Build a Chapa-safe email. Chapa uses Laravel-style email validation and
// REJECTS placeholder/reserved domains (example.com, test.com, ...) with
// {"email":["validation.email"]} even though they are syntactically valid.
// Use the customer's email only if its DOMAIN is not one of those; otherwise
// fall back to CHAPA_TEST_EMAIL (a real email the developer sets for testing).
export function resolveChapaEmail(
  customer: { email?: string } | Record<string, unknown>
): string {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const customerEmail = String(
    (customer as { email?: string }).email || ""
  )
    .trim()
    .toLowerCase();

  // Validate the DOMAIN part explicitly — a naive substring check misses
  // addresses like admin@example.com because "example" follows "@".
  const domain = customerEmail.split("@")[1] || "";
  const rejectedDomains = new Set([
    "test.com",
    "test.org",
    "test.net",
    "example.com",
    "example.org",
    "example.net",
    "mailinator.com",
    "yopmail.com",
    "guerrillamail.com",
    "10minutemail.com",
  ]);
  const isRejectedDomain =
    rejectedDomains.has(domain) ||
    /\.(test|example)\./i.test(domain) || // subdomains like mail.example.com
    /\.(test|example)$/i.test(domain); // TLD-style: host.example

  const isValidRealEmail = emailRegex.test(customerEmail) && !isRejectedDomain;
  const fallbackEmail = chapaTestEmail()
    .trim()
    .toLowerCase();

  if (!isValidRealEmail) {
    if (!emailRegex.test(fallbackEmail)) {
      throw new Error(
        "Chapa rejects placeholder emails (e.g. test.com / example.com). Set CHAPA_TEST_EMAIL in the backend .env to a real email address to allow payments for demo accounts."
      );
    }
    return fallbackEmail;
  }

  return customerEmail;
}

type ChapaRequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

// Cap the wait on Chapa so a hang surfaces as our friendly error message
// instead of the platform killing the function mid-request.
export const CHAPA_TIMEOUT_MS = 20_000;

export async function chapaRequest(path: string, options: ChapaRequestOptions = {}) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${chapaSecretKey()}`,
    ...(options.headers || {}),
  };
  if (options.body) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${chapaApiUrl()}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      // The Express server could hang forever waiting on Chapa. On Vercel a
      // hung request just gets the function killed (opaque 504), so cap it
      // and let the existing catch block below report the real reason.
      // Keep this below the routes' exported `maxDuration`.
      signal: AbortSignal.timeout(CHAPA_TIMEOUT_MS),
    });
  } catch (networkError) {
    // Surface the real reason instead of a generic failure. The most common
    // causes are an empty/invalid secret key or no network access to Chapa.
    const reason =
      networkError instanceof Error && networkError.message
        ? networkError.message
        : "network error";
    throw new Error(`Could not connect to Chapa API (${reason})`);
  }

  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export function paymentStatusFromChapa(rawStatus: unknown) {
  const status = String(rawStatus || "").toLowerCase();
  if (status === "success" || status === "completed" || status === "charge.success")
    return "completed";
  if (
    status === "failed" ||
    status === "cancelled" ||
    status.includes("fail") ||
    status.includes("cancel")
  )
    return "failed";
  return "pending";
}

// Chapa signs webhooks with an HMAC-SHA256 of the transaction reference using
// the Encryption key. If CHAPA_WEBHOOK_SECRET is configured, reject any webhook
// whose signature does not match.
export function verifyWebhookSignature(body: Record<string, unknown>, txRef: string) {
  const secret = chapaWebhookSecret();
  if (!secret) return true; // verification disabled
  const expected = crypto
    .createHmac("sha256", secret)
    .update(txRef)
    .digest("hex");
  const provided = String(
    body.signature || body.webhook_signature || ""
  ).toLowerCase();
  if (!provided) return false;

  // timingSafeEqual throws when the two buffers differ in length, so a short
  // or non-hex signature would bubble up as a 500 instead of a clean 401.
  // (The original Express code had the same flaw.) Compare lengths first.
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(provided, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

// Compute order totals from the current cart (mirrors the orders /checkout
// route). Returns cartItems: null when the cart is empty.
export async function computeCartTotal(userId: number, couponCode?: string | null) {
  const cartItems = await query(
    `SELECT c.*, p.name, p.price, p.discount, p.stock
     FROM cart c
     JOIN products p ON p.id = c.product_id
     WHERE c.user_id = $1`,
    [userId]
  );
  if ((cartItems.rowCount ?? 0) === 0) {
    return {
      cartItems: null,
      subtotal: 0,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 0,
      shippingCost: 0,
    };
  }

  let subtotal = 0;
  for (const item of cartItems.rows) {
    const itemPrice = Number(item.price) * (1 - Number(item.discount || 0) / 100);
    subtotal += itemPrice * Number(item.quantity);
  }

  let discountAmount = 0;
  if (couponCode) {
    const couponResult = await query(
      `SELECT * FROM coupons WHERE code = $1 AND is_active = TRUE AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE`,
      [couponCode]
    );
    if ((couponResult.rowCount ?? 0) > 0) {
      const coupon = couponResult.rows[0];
      if (coupon.discount_type === "percentage") {
        discountAmount = Math.min(
          (subtotal * Number(coupon.discount_value)) / 100,
          Number(coupon.max_discount || subtotal)
        );
      } else {
        discountAmount = Number(coupon.discount_value);
      }
    }
  }

  const shippingCost = 0;
  const taxAmount = subtotal * 0.08;
  const totalAmount = Math.max(
    0,
    subtotal + shippingCost + taxAmount - discountAmount
  );

  return { cartItems, subtotal, discountAmount, taxAmount, totalAmount, shippingCost };
}

// If a payment attempt fails before Chapa confirms it, undo the reservation:
// restore product stock, put the items back into the customer's cart, and mark
// the order as failed. Runs in a transaction and is safe to call more than
// once — the work only happens while the order is still 'pending', so a
// repeated call (e.g. the frontend retrying cancel) can never double-restore
// stock or duplicate cart rows, and an already-paid order is never voided.
export async function voidFailedOrder(orderId: number | undefined) {
  if (!orderId) return;
  let client: PoolClient | undefined;
  try {
    client = await connect();
    await client.query("BEGIN");

    // Flip pending -> failed first; if the row isn't pending anymore the
    // rowCount is 0 and nothing below runs (idempotency + payment guard).
    const voided = await client.query(
      `UPDATE orders SET payment_status = 'failed', updated_at = NOW()
       WHERE id = $1 AND payment_status = 'pending'`,
      [orderId]
    );
    if ((voided.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      return;
    }

    await client.query(
      `UPDATE products SET stock = stock + q.restored
       FROM (
         SELECT product_id, SUM(quantity) AS restored
         FROM order_items WHERE order_id = $1 GROUP BY product_id
       ) q
       WHERE products.id = q.product_id`,
      [orderId]
    );

    // Put the items back into the cart so the customer can retry the payment
    // without re-adding everything by hand. The cart keeps a UNIQUE
    // (user_id, product_id), so merge into an existing row if one appeared
    // again in the meantime. (order_items has no user_id — it comes from the
    // joined order.)
    await client.query(
      `INSERT INTO cart (user_id, product_id, quantity)
       SELECT o.user_id, oi.product_id, SUM(oi.quantity)
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE oi.order_id = $1
       GROUP BY o.user_id, oi.product_id
       ON CONFLICT (user_id, product_id)
       DO UPDATE SET quantity = cart.quantity + EXCLUDED.quantity,
                     updated_at = NOW()`,
      [orderId]
    );

    await client.query("COMMIT");
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* connection may already be closed */
      }
    }
    console.error(
      "[payments] Failed to void order",
      orderId,
      error instanceof Error ? error.message : error
    );
  } finally {
    if (client) client.release();
  }
}

// Creates an order from the user's cart, records a pending Chapa payment and
// clears the cart. Runs in a single transaction. Returns the tx_ref, total and
// order reference (no Chapa network call — callers decide how to contact Chapa).
export async function createOrderFromCart(
  userId: number,
  body: Record<string, unknown> | undefined
) {
  const {
    shipping_address_id,
    billing_address_id,
    shipping_method,
    notes,
    coupon_code,
  } = (body || {}) as {
    shipping_address_id?: number;
    billing_address_id?: number;
    shipping_method?: string | null;
    notes?: string | null;
    coupon_code?: string | null;
  };

  if (!shipping_address_id || !billing_address_id) {
    const err = new Error(
      "shipping_address_id and billing_address_id are required."
    ) as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  // Note: shipping and billing may be the same address, so compare the count
  // of DISTINCT ids rather than raw rows (IN (5, 5) returns one row).
  const addressIds = [
    ...new Set([Number(shipping_address_id), Number(billing_address_id)]),
  ];
  const addrResult = await query(
    "SELECT id FROM addresses WHERE id = ANY($1::int[]) AND user_id = $2",
    [addressIds, userId]
  );
  if ((addrResult.rowCount ?? 0) !== addressIds.length) {
    const err = new Error(
      "Invalid shipping or billing address."
    ) as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  const cart = await computeCartTotal(userId, coupon_code);
  if (!cart.cartItems) {
    const err = new Error("Cart is empty.") as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  const txRef = makeTxRef(userId);
  const orderNumber = generateOrderNumber();
  let client: PoolClient | undefined;

  try {
    client = await connect();
    await client.query("BEGIN");

    const orderResult = await client.query(
      `INSERT INTO orders (
        order_number, user_id, shipping_address_id, billing_address_id,
        subtotal, shipping_cost, tax_amount, discount_amount, total_amount,
        shipping_method, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        orderNumber,
        userId,
        shipping_address_id,
        billing_address_id,
        cart.subtotal.toFixed(2),
        cart.shippingCost.toFixed(2),
        cart.taxAmount.toFixed(2),
        cart.discountAmount.toFixed(2),
        cart.totalAmount.toFixed(2),
        shipping_method || null,
        notes || null,
      ]
    );
    const order = orderResult.rows[0];
    const orderRef = {
      id: order.id,
      order_number: orderNumber,
      total_amount: cart.totalAmount,
    };

    for (const item of cart.cartItems.rows) {
      const itemPrice =
        Number(item.price) * (1 - Number(item.discount || 0) / 100);
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, product_image, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          order.id,
          item.product_id,
          item.name,
          "",
          Number(item.quantity),
          itemPrice.toFixed(2),
          (itemPrice * Number(item.quantity)).toFixed(2),
        ]
      );
      await client.query(
        `UPDATE products SET stock = stock - $1, view_count = view_count + 1 WHERE id = $2`,
        [Number(item.quantity), item.product_id]
      );
    }

    await client.query(
      `INSERT INTO payments (order_id, amount, payment_method, status, transaction_id)
       VALUES ($1, $2, 'chapa', 'pending', $3)`,
      [order.id, cart.totalAmount.toFixed(2), txRef]
    );

    await client.query("DELETE FROM cart WHERE user_id = $1", [userId]);
    await client.query("COMMIT");
    return { txRef, totalAmount: cart.totalAmount, orderRef };
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* connection may already be closed */
      }
    }
    throw error;
  } finally {
    if (client) client.release();
  }
}
