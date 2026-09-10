export type AuthUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  email: string;
  role?: string;
};

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  return Boolean(getToken() && getUser());
}

export function isAdmin(): boolean {
  return getUser()?.role === "admin";
}

export function logout(): void {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}
