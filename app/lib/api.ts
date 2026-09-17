// The Express API used to be a separate server on :5000. It is now part of
// this same Next.js app (app/api/**/route.ts), so the default is the
// same-origin relative "/api" — no CORS, no second process, and works on
// Vercel out of the box. NEXT_PUBLIC_API_URL is only needed if you ever want
// to point the frontend at a different (e.g. staging) deployment.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong");
  }

  return data as T;
}
