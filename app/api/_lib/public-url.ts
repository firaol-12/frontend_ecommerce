import type { NextRequest } from "next/server";

function firstForwardedValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function safeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Resolve the browser-facing origin of the current deployment.
 *
 * A configured canonical origin is preferred. On Vercel, a production URL is
 * derived from request headers when the configuration is absent or still has a
 * localhost value, so preview and production deployments do not use localhost.
 */
export function getPublicOrigin(req: NextRequest) {
  const configuredOrigin = process.env.FRONTEND_URL
    ? safeOrigin(process.env.FRONTEND_URL)
    : null;

  if (process.env.VERCEL === "1") {
    // Prefer the configured canonical production/custom domain so a forged
    // Host header cannot become an open redirect. Ignore copied localhost
    // values and fall back to the deployment host.
    if (
      configuredOrigin &&
      !["localhost", "127.0.0.1", "::1"].includes(new URL(configuredOrigin).hostname)
    ) {
      return configuredOrigin;
    }

    const host = firstForwardedValue(req.headers.get("x-forwarded-host"))
      || req.headers.get("host");
    const protocol = firstForwardedValue(req.headers.get("x-forwarded-proto"))
      || (host?.startsWith("localhost") ? "http" : "https");
    const vercelOrigin = host ? safeOrigin(`${protocol}://${host}`) : null;
    if (vercelOrigin) return vercelOrigin;
  }

  return configuredOrigin || req.nextUrl.origin;
}

export function getGoogleCallbackUrl(req: NextRequest) {
  const configuredOrigin = process.env.GOOGLE_CALLBACK_URL
    ? safeOrigin(process.env.GOOGLE_CALLBACK_URL)
    : null;

  if (
    configuredOrigin &&
    (process.env.VERCEL !== "1" ||
      !["localhost", "127.0.0.1", "::1"].includes(
        new URL(configuredOrigin).hostname
      ))
  ) {
    return `${configuredOrigin}/api/auth/google/callback`;
  }

  return `${getPublicOrigin(req)}/api/auth/google/callback`;
}
