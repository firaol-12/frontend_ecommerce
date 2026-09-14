"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../components/auth-provider";
import type { AuthUser } from "../../lib/auth";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuth();

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");

    if (error) {
      const details = searchParams.get("details");
      router.push(`/login?error=${error}${details ? `&details=${details}` : ""}`);
      return;
    }

    if (!token) {
      router.push("/login?error=no_token");
      return;
    }

    // Store token and fetch user
    localStorage.setItem("token", token);

    // Fetch user profile
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          window.dispatchEvent(new Event("auth-change"));
          router.push("/");
        } else {
          router.push("/login?error=invalid_token");
        }
      })
      .catch(() => {
        router.push("/login?error=fetch_user_failed");
      });
  }, [searchParams, router, setUser]);

  return (
    <div className="mx-auto flex max-w-5xl items-center justify-center px-6 py-20">
      <div className="w-full max-w-md text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-sky-500 border-t-transparent mx-auto"></div>
        <p className="mt-4 text-slate-600">Completing sign in...</p>
      </div>
    </div>
  );
}