# Deploying to Vercel

The home page, `/products`, and all product/category data use the Route Handlers in this Next.js application. Vercel therefore needs a production PostgreSQL connection and the OAuth/database configuration listed below.

## 1. Import the correct repository and root

Import the GitHub repository that contains this `package.json` and set:

- Framework Preset: **Next.js**
- Root Directory: **`/`** (leave blank if Vercel shows a blank field)
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: leave blank/default

Do **not** set the root directory to `ecommerce-frontend` when importing this repository. That folder is the deployed project root. Do not deploy the old Express `ecommerce-backend` as the Vercel project; the Next.js app now owns its API.

## 2. Use a production PostgreSQL database

Create or use a PostgreSQL database that is reachable from Vercel. Prefer a pooled connection URL from Neon, Supabase, Vercel Postgres, or your current provider. Do not use `localhost`, and do not put a username/password in Vercel project settings separately when the provider supplies one `DATABASE_URL`.

Create the schema for a new database:

```bash
psql "$PRODUCTION_DATABASE_URL" -f ../ecommerce-backend/schema.sql
```

If the production database already exists, apply the Google OAuth migration once:

```bash
cd ../ecommerce-backend
DATABASE_URL="$PRODUCTION_DATABASE_URL" node add-google-id-column.js
```

The migration makes `users.password` nullable and adds unique `users.google_id`, as required for Google-only accounts. It is safe to run again. Seed/import your categories and products into this same database; the app does not contain product data.

## 3. Add Vercel environment variables

In **Project Settings > Environment Variables**, add these to **Production** (and Preview if you want preview authentication):

| Variable | Production value |
| --- | --- |
| `DATABASE_URL` | Pooled PostgreSQL URL, including `?sslmode=require` when required by the provider |
| `JWT_SECRET` | A new strong random value, for example the output of `openssl rand -base64 48` |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Web client ID from Google Cloud |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Web client secret from Google Cloud |
| `GOOGLE_CALLBACK_URL` | `https://YOUR-VERCEL-HOST/api/auth/google/callback` |
| `FRONTEND_URL` | `https://YOUR-VERCEL-HOST` |
| `CHAPA_SECRET_KEY` | Production Chapa secret, if checkout is enabled |
| `CHAPA_WEBHOOK_SECRET` | Chapa webhook encryption key, if configured |
| `CHAPA_API_URL` | `https://api.chapa.co` |
| `CHAPA_CALLBACK_URL` | `https://YOUR-VERCEL-HOST` |

Leave `NEXT_PUBLIC_API_URL` unset. The frontend intentionally calls same-origin `/api` routes. Never prefix database, JWT, OAuth, or payment secrets with `NEXT_PUBLIC_`.

After adding or changing variables, redeploy from the Vercel **Deployments** page. Environment changes do not apply to an already-running deployment.

## 4. Configure Google Cloud exactly

Open **Google Cloud Console > APIs & Services > Credentials**, select the OAuth 2.0 Web client used by this app, and add:

- Authorized JavaScript origin: `https://YOUR-VERCEL-HOST`
- Authorized redirect URI: `https://YOUR-VERCEL-HOST/api/auth/google/callback`

For local development, also keep:

- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI: `http://localhost:3000/api/auth/google/callback`

The redirect URI must match exactly, including `https`, host, and `/api/auth/google/callback`. Add the production callback to the OAuth consent screen and publish it, or keep the app in Testing mode and add the Vercel user as a test user. If you later add a custom domain, register that origin and callback too.

## 5. Deploy and verify

Run `npm run typecheck` and `npm run build` locally before pushing, then deploy to Vercel. Check these URLs on the deployed host:

1. `https://YOUR-VERCEL-HOST/api/health` must return HTTP 200 with `checks.database`, `checks.schema`, and `checks.jwt` set to `true`.
2. `https://YOUR-VERCEL-HOST/api/products?limit=2` must return `{"products":[...],"pagination":...}`.
3. `https://YOUR-VERCEL-HOST/` and `/products` should then display data.
4. Sign in with Google and confirm the browser returns through `/auth/callback` instead of `localhost:3000`.

If `/api/health` is 503, inspect its `checks` object and Vercel function logs. If OAuth returns `redirect_uri_mismatch`, the Google Cloud URI and `GOOGLE_CALLBACK_URL` do not match exactly. If products are empty, verify that Vercel uses the intended `DATABASE_URL` and that the product/category tables contain active rows.
