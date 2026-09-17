// Mirrors src/utils/helpers.js from the Express backend, unchanged.

export function slugify(value = ""): string {
  return (
    String(value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}

export function buildPagination(page: unknown = 1, limit: unknown = 10) {
  const parsedPage = Number(page) > 0 ? Number(page) : 1;
  const parsedLimit = Number(limit) > 0 ? Number(limit) : 10;
  return {
    offset: (parsedPage - 1) * parsedLimit,
    limit: parsedLimit,
    page: parsedPage,
  };
}

export function sanitizeUser(user: Record<string, unknown> | null | undefined) {
  if (!user) return null;
  // Strip the password hash before a user row is ever serialized to a client.
  const safeUser = { ...user };
  delete safeUser.password;
  return safeUser;
}
