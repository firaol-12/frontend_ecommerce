"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/sidebar";
import DashNavbar from "../components/dashboard-navbar";
import { useAuth } from "../components/auth-provider";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { loggedIn, isAdminUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loggedIn) {
      router.replace("/login");
    } else if (!isAdminUser) {
      router.replace("/");
    }
  }, [loggedIn, isAdminUser, router]);

  if (!loggedIn || !isAdminUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-500">
        Redirecting...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar />
      <div className="ml-72 min-h-screen">
        <DashNavbar />
        <main className="px-6 pb-10 pt-24">{children}</main>
      </div>
    </div>
  );
}