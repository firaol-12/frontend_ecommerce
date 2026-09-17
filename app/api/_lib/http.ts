import { NextResponse } from "next/server";

// Shared response helpers that mirror the Express handlers' response shapes:
// every error catch returns { message, error: error.message } with status 500.

export function ok(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, { status });
}

export function serverError(message: string, error: unknown) {
  return NextResponse.json(
    {
      message,
      error: error instanceof Error ? error.message : String(error),
    },
    { status: 500 }
  );
}

export function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

export function notFound(message: string) {
  return NextResponse.json({ message }, { status: 404 });
}

// Express used express.json({ limit: '12mb' }) — malformed JSON bodies there
// produced a 500 via the global error handler; here an unreadable body is
// treated as an empty object, so every route's existing "missing field"
// validation returns the same 400s it always did.
export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

// Dynamic route params arrive as a Promise in Next.js 15+/16.
export async function getParams(context: { params: Promise<Record<string, string>> }) {
  return context.params;
}
