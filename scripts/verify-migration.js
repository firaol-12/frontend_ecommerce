#!/usr/bin/env node
/**
 * Migration completeness check: maps every Express route in ../ecommerce-backend
 * to its expected Next.js Route Handler and asserts the file exists and exports
 * the matching HTTP method. Also flags handlers with no Express counterpart.
 *
 *   npm run verify:migration
 *
 * Works only while the Express source is still present; delete it (and this
 * script) once the backend folder is removed.
 */
const fs = require("fs");
const path = require("path");

const FRONTEND = path.resolve(__dirname, "..");
const BACKEND = path.resolve(FRONTEND, "..", "ecommerce-backend");

// Mount prefixes from the old src/app.js
const MOUNTS = {
  authRoutes: "/api/auth",
  userRoutes: "/api/users",
  categoryRoutes: "/api/categories",
  productRoutes: "/api/products",
  addressRoutes: "/api/addresses",
  cartRoutes: "/api/cart",
  orderRoutes: "/api/orders",
  reviewRoutes: "/api/reviews",
  wishlistRoutes: "/api/wishlist",
  couponRoutes: "/api/coupons",
  paymentRoutes: "/api/payments",
  adminRoutes: "/api/admin",
};

const METHODS = ["get", "post", "put", "patch", "delete"];

/** Parse `router.<method>('<path>', ...)` calls out of a route file. */
function parseExpressRoutes(file) {
  const src = fs.readFileSync(file, "utf8");
  const found = [];
  const re = new RegExp(
    `router\\s*\\.\\s*(${METHODS.join("|")})\\s*\\(\\s*['"\`]([^'"\`]+)['"\`]`,
    "g"
  );
  let m;
  while ((m = re.exec(src)) !== null) found.push({ method: m[1].toUpperCase(), sub: m[2] });
  return found;
}

/** Express :param -> Next.js [param] */
const toNextPath = (p) => p.replace(/:([A-Za-z0-9_]+)/g, "[$1]");

if (!fs.existsSync(BACKEND)) {
  console.error(`Express source not found at ${BACKEND}.`);
  console.error("If you already deleted it, this check has served its purpose.");
  process.exit(0);
}

const expected = [];
for (const [routeFile, mount] of Object.entries(MOUNTS)) {
  const file = path.join(BACKEND, "src/routes", `${routeFile}.js`);
  for (const { method, sub } of parseExpressRoutes(file)) {
    const full = (mount + (sub === "/" ? "" : sub)).replace(/\/$/, "");
    expected.push({ method, express: `${mount}${sub}`, next: `${toNextPath(full)}/route.ts` });
  }
}
expected.push({ method: "GET", express: "/api/health", next: "/api/health/route.ts" });
expected.sort((a, b) => a.express.localeCompare(b.express));

let missingFiles = 0;
let missingMethods = 0;
const rows = [];

for (const e of expected) {
  const abs = path.join(FRONTEND, "app", e.next.replace(/^\//, ""));
  const fileOk = fs.existsSync(abs);
  const methodOk =
    fileOk &&
    new RegExp(`export\\s+async\\s+function\\s+${e.method}\\b`).test(
      fs.readFileSync(abs, "utf8")
    );
  if (!fileOk) missingFiles++;
  else if (!methodOk) missingMethods++;
  const status = fileOk && methodOk ? "OK  " : "FAIL";
  const why = fileOk && methodOk ? "" : fileOk ? "  (missing export)" : "  (missing file)";
  rows.push(
    `${status} ${e.method.padEnd(6)} ${e.express.padEnd(42)} -> app${e.next}${why}`
  );
}

console.log(rows.join("\n"));

const apiDir = path.join(FRONTEND, "app", "api");
const actual = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name === "route.ts") {
      const rel = "/" + path.relative(apiDir, p).replace(/\\/g, "/");
      const src = fs.readFileSync(p, "utf8");
      for (const meth of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
        if (new RegExp(`export\\s+async\\s+function\\s+${meth}\\b`).test(src)) {
          actual.push({ method: meth, next: rel });
        }
      }
    }
  }
})(apiDir);

const known = new Set(expected.map((e) => `${e.method} ${e.next.replace(/^\/api/, "")}`));
const extra = actual.filter((a) => !known.has(`${a.method} ${a.next}`));

console.log("");
console.log(`Total Express endpoints : ${expected.length}`);
console.log(`Missing route files     : ${missingFiles}`);
console.log(`Missing method exports  : ${missingMethods}`);
console.log(`Handlers found in app/api: ${actual.length}`);
console.log(
  extra.length
    ? `No Express counterpart (review):\n${extra.map((x) => `  ? ${x.method} ${x.next}`).join("\n")}`
    : "Every handler maps to an Express endpoint (no extras)."
);

process.exit(missingFiles + missingMethods === 0 ? 0 : 1);