#!/usr/bin/env node
/**
 * Live smoke test for the migrated Next.js API (app/api/**).
 *
 *   npm run smoke
 *
 * Requires the app to be running (npm run dev, or npm run build && npm start).
 * Reads its config the same way the app does — from .env.local via @next/env —
 * so there are no secrets in this file. Override per-run with:
 *   SMOKE_BASE_URL        default http://localhost:3000/api
 *   JWT_SECRET            to mint an admin token
 *   CHAPA_WEBHOOK_SECRET  to sign webhook payloads
 *   PGPASSWORD            local Postgres password, used only for fixture setup
 *
 * It creates a throwaway user/product/coupon, asserts every endpoint's status,
 * then removes everything it created.
 */
const path = require("path");

// Load the same env files Next.js reads (.env.local etc.) before anything else.
const appRoot = path.resolve(__dirname, "..");
try {
  require("@next/env").loadEnvConfig(appRoot);
} catch {
  // @next/env missing: fall back to whatever the shell exported.
}

const crypto = require("crypto");
const { execFileSync } = require("child_process");
const jwt = require("jsonwebtoken");

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000/api";
const JWT_SECRET = process.env.JWT_SECRET;
const CHAPA_WEBHOOK_SECRET = process.env.CHAPA_WEBHOOK_SECRET || "";
const RUN = Date.now().toString().slice(-6);
const EMAIL = `smoke-${RUN}@example.com`;
const PRODUCT_NAME = `Smoke Product ${RUN}`;
const COUPON_CODE = `SMOKE${RUN}`;
const CATEGORY_NAME = `Smoke Category ${RUN}`;

let pass = 0;
let fail = 0;
const failures = [];

function check(label, expected, res, note) {
  const ok = expected.includes(res.status);
  if (ok) pass++;
  else {
    fail++;
    failures.push(
      `${label} -> got ${res.status}, expected ${expected.join("/")}: ` +
        JSON.stringify(res.data).slice(0, 200)
    );
  }
  console.log(
    `${ok ? "PASS" : "FAIL"} ${String(res.status).padEnd(4)} ${label.padEnd(46)}` +
      `${ok ? "" : " expected " + expected.join("/")}${note ? " [" + note + "]" : ""}`
  );
}

async function call(method, p, opts) {
  const o = opts || {};
  const headers = {};
  if (o.token) headers.Authorization = `Bearer ${o.token}`;
  if (o.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + p, {
    method,
    headers,
    body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
    redirect: "manual",
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text.slice(0, 160);
  }
  return { status: res.status, data };
}

async function main() {
  console.log(`== merged API smoke test (run ${RUN}) ==\n`);

  // ------------------------------------------------------------- health
  check("GET  /health", [200], await call("GET", "/health"));

  // ------------------------------------------------------------- auth
  const reg = await call("POST", "/auth/register", {
    body: {
      first_name: "Smoke",
      last_name: "Tester",
      email: EMAIL,
      password: "SmokeTest123!",
    },
  });
  check("POST /auth/register", [201], reg);
  const userId = reg.data && reg.data.user && reg.data.user.id;
  if (!userId) throw new Error("register failed: " + JSON.stringify(reg.data));

  const login = await call("POST", "/auth/login", {
    body: { email: EMAIL, password: "SmokeTest123!" },
  });
  check("POST /auth/login", [200], login);
  const userToken = login.data && login.data.token;

  const adminRow = psql(
    "SELECT id || '|' || email FROM users WHERE role='admin' ORDER BY id LIMIT 1"
  );
  const adminToken = jwt.sign(
    { userId: Number(adminRow.split("|")[0]), email: adminRow.split("|")[1], role: "admin" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  check("GET  /auth/me", [200], await call("GET", "/auth/me", { token: userToken }));
  check("GET  /auth/google", [302, 307], await call("GET", "/auth/google"));
  check(
    "GET  /auth/google/callback (no code)",
    [302, 307, 400],
    await call("GET", "/auth/google/callback")
  );
  check("GET  /cart (no token) -> 401", [401], await call("GET", "/cart"));
  check(
    "GET  /users (customer) -> 403",
    [403],
    await call("GET", "/users", { token: userToken })
  );

  // ------------------------------------------------------------- categories
  const cats = await call("GET", "/categories");
  check("GET  /categories", [200], cats);
  const catId = cats.data.categories[0].id;
  check("GET  /categories/:id", [200], await call("GET", `/categories/${catId}`));

  // ------------------------------------------------------------- products
  const prods = await call("GET", "/products?limit=100");
  check("GET  /products", [200], prods);
  const list = prods.data.products;
  const p0 = list.filter((p) => Number(p.stock) >= 5)[0] || list[0];
  const p1 = list.filter((p) => p.id !== p0.id)[0];
  check("GET  /products/:id", [200], await call("GET", `/products/${p0.id}`));
  check(
    "GET  /products/slug/:slug",
    [200],
    await call("GET", `/products/slug/${encodeURIComponent(p0.slug)}`)
  );
  check(
    "GET  /reviews/product/:productId",
    [200],
    await call("GET", `/reviews/product/${p0.id}`)
  );

  // ------------------------------------------------------------- profile
  check("GET  /users/profile", [200], await call("GET", "/users/profile", { token: userToken }));
  check(
    "PUT  /users/profile",
    [200],
    await call("PUT", "/users/profile", { token: userToken, body: { phone: "+251911000000" } })
  );
  // ------------------------------------------------------------- addresses
  const addr = await call("POST", "/addresses", {
    token: userToken,
    body: {
      full_name: "Smoke Tester",
      phone: "+251911000000",
      street: "1 Smoke St",
      city: "Addis Ababa",
      state: "Addis Ababa",
      postal_code: "1000",
      country: "Ethiopia",
      address_type: "shipping",
      is_default: true,
    },
  });
  check("POST /addresses", [201], addr);
  const addressId = addr.data.address.id;
  check("GET  /addresses", [200], await call("GET", "/addresses", { token: userToken }));
  check(
    "PUT  /addresses/:id",
    [200],
    await call("PUT", `/addresses/${addressId}`, {
      token: userToken,
      body: { city: "Adama" },
    })
  );

  // ------------------------------------------------------------- cart
  check("GET  /cart (empty)", [200], await call("GET", "/cart", { token: userToken }));
  const add = await call("POST", "/cart", {
    token: userToken,
    body: { product_id: p0.id, quantity: 1 },
  });
  check("POST /cart", [200, 201], add);
  const cartNow = await call("GET", "/cart", { token: userToken });
  check("GET  /cart (1 line)", [200], cartNow);
  const cartLines = cartNow.data.cart || [];
  const cartItemId = cartLines[0] && cartLines[0].id;
  check(
    "PATCH /cart/:id",
    [200],
    await call("PATCH", `/cart/${cartItemId}`, { token: userToken, body: { quantity: 2 } })
  );

  // DELETE /cart/:id — add a second product line, then delete only that line.
  const extra = await call("POST", "/cart", {
    token: userToken,
    body: { product_id: p1.id, quantity: 1 },
  });
  check(
    "DELETE /cart/:id",
    [200],
    await call("DELETE", `/cart/${extra.data.item.id}`, { token: userToken })
  );

  // ------------------------------------------------------------- wishlist
  check(
    "POST /wishlist",
    [200, 201],
    await call("POST", "/wishlist", { token: userToken, body: { product_id: p0.id } })
  );
  check("GET  /wishlist", [200], await call("GET", "/wishlist", { token: userToken }));
  check(
    "DELETE /wishlist/:productId",
    [200],
    await call("DELETE", `/wishlist/${p0.id}`, { token: userToken })
  );

  // ------------------------------------------------------------- reviews
  const rev = await call("POST", `/reviews/product/${p0.id}`, {
    token: userToken,
    body: { rating: 5, title: "Smoke review", content: "Automated smoke test." },
  });
  check("POST /reviews/product/:productId", [201], rev);
  check(
    "PUT  /reviews/:id",
    [200],
    await call("PUT", `/reviews/${rev.data.review.id}`, {
      token: userToken,
      body: { rating: 4 },
    })
  );
  check("GET  /reviews/my", [200], await call("GET", "/reviews/my", { token: userToken }));

  // ------------------------------------------------------------- admin users
  check("GET  /users (admin)", [200], await call("GET", "/users", { token: adminToken }));
  check(
    "GET  /users/:id (admin)",
    [200],
    await call("GET", `/users/${userId}`, { token: adminToken })
  );
  check(
    "PATCH /users/:id/status (admin)",
    [200],
    await call("PATCH", `/users/${userId}/status`, {
      token: adminToken,
      body: { is_active: true },
    })
  );

  // ------------------------------------------------------------- admin categories
  const newCat = await call("POST", "/categories", {
    token: adminToken,
    body: { name: CATEGORY_NAME, description: "temp" },
  });
  check("POST /categories (admin)", [201], newCat);
  const newCatId = newCat.data.category.id;
  check(
    "PUT  /categories/:id (admin)",
    [200],
    await call("PUT", `/categories/${newCatId}`, {
      token: adminToken,
      body: { description: "temp2" },
    })
  );
  check(
    "DELETE /categories/:id (admin)",
    [200],
    await call("DELETE", `/categories/${newCatId}`, { token: adminToken })
  );

  // ------------------------------------------------------------- admin coupons
  check("GET  /coupons (admin)", [200], await call("GET", "/coupons", { token: adminToken }));
  const newCoupon = await call("POST", "/coupons", {
    token: adminToken,
    body: {
      code: COUPON_CODE,
      discount_type: "percentage",
      discount_value: 10,
      start_date: "2020-01-01",
      end_date: "2099-12-31",
    },
  });
  check("POST /coupons (admin)", [201], newCoupon);
  check(
    "POST /coupons/validate",
    [200],
    await call("POST", "/coupons/validate", { token: userToken, body: { code: COUPON_CODE } })
  );

  // ------------------------------------------------------------- admin products
  const newProd = await call("POST", "/products", {
    token: adminToken,
    body: {
      name: PRODUCT_NAME,
      description: "temp product for smoke testing",
      price: 99.5,
      category_id: catId,
      stock: 3,
    },
  });
  check("POST /products (admin)", [201], newProd);
  const newProdId = newProd.data.product.id;
  check(
    "PUT  /products/:id (admin)",
    [200],
    await call("PUT", `/products/${newProdId}`, { token: adminToken, body: { price: 88.5 } })
  );
  check(
    "POST /products/:id/images (admin)",
    [201],
    await call("POST", `/products/${newProdId}/images`, {
      token: adminToken,
      body: {
        image_url: "https://example.com/smoke.png",
        alt_text: "smoke",
        is_main_image: true,
      },
    })
  );
  check(
    "GET  /admin/dashboard (admin)",
    [200],
    await call("GET", "/admin/dashboard", { token: adminToken })
  );

  // ------------------------------------------------------------- orders
  const checkout = await call("POST", "/orders/checkout", {
    token: userToken,
    body: { shipping_address_id: addressId, billing_address_id: addressId },
  });
  check("POST /orders/checkout", [201], checkout);
  const orderId = checkout.data.order.id;
  check("GET  /orders/my", [200], await call("GET", "/orders/my", { token: userToken }));
  check("GET  /orders/:id", [200], await call("GET", `/orders/${orderId}`, { token: userToken }));
  check("GET  /orders (admin)", [200], await call("GET", "/orders", { token: adminToken }));
  check(
    "PATCH /orders/:id/status (admin)",
    [200],
    await call("PATCH", `/orders/${orderId}/status`, {
      token: adminToken,
      body: { status: "confirmed" },
    })
  );

  // ------------------------------------------------------------- payments (generic)
  check(
    "GET  /payments/order/:orderId",
    [200],
    await call("GET", `/payments/order/${orderId}`, { token: userToken })
  );
  check(
    "POST /payments/order/:orderId",
    [201],
    await call("POST", `/payments/order/${orderId}`, {
      token: userToken,
      body: { amount: 10, payment_method: "credit_card", status: "pending" },
    })
  );
  check("GET  /payments (admin)", [200], await call("GET", "/payments", { token: adminToken }));

  // ------------------------------------------------------------- chapa flow
  await call("POST", "/cart", { token: userToken, body: { product_id: p0.id, quantity: 1 } });
  const chapaOrder = await call("POST", "/payments/chapa/order", {
    token: userToken,
    body: { shipping_address_id: addressId, billing_address_id: addressId },
  });
  check("POST /payments/chapa/order", [201], chapaOrder);
  const txRef = chapaOrder.data.tx_ref;

  const init = await call("POST", "/payments/chapa/initialize", {
    token: userToken,
    body: { tx_ref: txRef },
  });
  check(
    "POST /payments/chapa/initialize",
    [201, 502],
    init,
    init.status === 502 ? "Chapa rejected/unreachable -> voided" : "checkout_url returned"
  );

  const verify = await call("GET", `/payments/chapa/verify/${encodeURIComponent(txRef)}`, {
    token: userToken,
  });
  check(
    "GET  /payments/chapa/verify/:txRef",
    [200, 500],
    verify,
    verify.status === 500 ? "Chapa unreachable" : "status=" + verify.data.status
  );

  const sig = crypto.createHmac("sha256", CHAPA_WEBHOOK_SECRET).update(txRef).digest("hex");
  check(
    "POST /payments/chapa/webhook (signed)",
    [200],
    await call("POST", "/payments/chapa/webhook", {
      body: { tx_ref: txRef, status: "success", signature: sig },
    })
  );
  check(
    "POST /payments/chapa/webhook (bad sig) -> 401",
    [401],
    await call("POST", "/payments/chapa/webhook", {
      body: { tx_ref: txRef, status: "success", signature: "deadbeef" },
    })
  );
  check(
    "POST /payments/chapa/webhook (no sig) -> 401",
    [401],
    await call("POST", "/payments/chapa/webhook", {
      body: { tx_ref: txRef, status: "success" },
    })
  );

  // chapa/order consumes the cart, so restock it for the second order.
  await call("POST", "/cart", { token: userToken, body: { product_id: p0.id, quantity: 1 } });
  const chapaOrder2 = await call("POST", "/payments/chapa/order", {
    token: userToken,
    body: { shipping_address_id: addressId, billing_address_id: addressId },
  });
  check(
    "POST /payments/chapa/cancel",
    [200],
    await call("POST", "/payments/chapa/cancel", {
      token: userToken,
      body: { tx_ref: chapaOrder2.data.tx_ref },
    })
  );

  // Regression guard for the cart-loss bug: a cancelled order must put the
  // cart items back so the customer can retry the payment.
  const cartAfter = await call("GET", "/cart", { token: userToken });
  const restored = (cartAfter.data.cart || []).reduce((n, i) => n + Number(i.quantity || 0), 0);
  if (restored > 0) {
    pass++;
    console.log(`PASS 200  cart restored after chapa cancel (${restored} unit(s))`);
  } else {
    fail++;
    failures.push("cart was NOT restored after voidFailedOrder (chapa cancel)");
    console.log("FAIL      cart was NOT restored after chapa cancel");
  }

  check("GET  /orders/:id (again)", [200], await call("GET", `/orders/${orderId}`, { token: userToken }));

  // ------------------------------------------------------------- cleanup
  console.log(`\n== ${pass} passed, ${fail} failed ==`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log("  - " + f);
  }
}

function psql(sql) {
  return execFileSync(
    "psql",
    ["-h", "localhost", "-U", "postgres", "-d", "postgres", "-tAc", sql],
    {
      env: Object.assign({}, process.env, { PGPASSWORD: process.env.PGPASSWORD || "newpassword" }),
      encoding: "utf8",
    }
  ).trim();
}

// Refuse before main() AND its cleanup catch: this suite changes inventory,
// ratings, payments and gateway records. Cleanup is not a full rollback.
const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
let localApi = false;
try {
  const url = new URL(BASE);
  localApi = url.protocol === "http:" && localHosts.has(url.hostname);
} catch {
  // Invalid URLs fail closed without sending requests or running SQL.
}
if (process.env.SMOKE_ALLOW_MUTATIONS !== "1" || !localApi) {
  console.error(
    "Refusing mutating smoke test. Use an isolated disposable local database " +
      "and Chapa sandbox, then set SMOKE_ALLOW_MUTATIONS=1. " +
      "Only localhost HTTP API URLs are supported; never use production data."
  );
  process.exit(2);
}

main()
  .then(() => {
    console.log("\n== cleanup ==");
    psql(
      `DELETE FROM users WHERE email = '${EMAIL}';` +
        `DELETE FROM products WHERE name = '${PRODUCT_NAME}';` +
        `DELETE FROM coupons WHERE code = '${COUPON_CODE}';`
    );
    console.log(`removed test user/product/coupon (run ${RUN})`);
    console.log(
      "leftover smoke rows (users/products/coupons): " +
        psql(
          "SELECT (SELECT COUNT(*) FROM users WHERE email LIKE 'smoke-%') || '/' || " +
            "(SELECT COUNT(*) FROM products WHERE name LIKE 'Smoke Product%') || '/' || " +
            "(SELECT COUNT(*) FROM coupons WHERE code LIKE 'SMOKE%')"
        )
    );
    process.exit(fail === 0 ? 0 : 1);
  })
  .catch((e) => {
    console.error("SMOKE TEST ERROR:", e);
    try {
      psql(
        `DELETE FROM users WHERE email = '${EMAIL}';` +
          `DELETE FROM products WHERE name = '${PRODUCT_NAME}';` +
          `DELETE FROM coupons WHERE code = '${COUPON_CODE}';`
      );
      console.log("cleanup ran after error");
    } catch (cleanupError) {
      console.error("cleanup failed:", cleanupError.message);
    }
    process.exit(2);
  });
