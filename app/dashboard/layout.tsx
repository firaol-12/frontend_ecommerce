"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/sidebar";
import DashNavbar from "../components/dashboard-navbar";
import { useAuth } from "../components/auth-provider";

// The user's preferred sidebar state (collapsed icon rail vs expanded) is
// persisted so the dashboard feels consistent between visits.
const SIDEBAR_STORAGE_KEY = "dashboard-sidebar-collapsed";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { loggedIn, isAdminUser } = useAuth();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Restore the saved sidebar preference after mount (avoids hydration
  // mismatch since localStorage is only available on the client).
  useEffect(() => {
    if (window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1") {
      setCollapsed(true);
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

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
      <Sidebar
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      {/* Content offset follows the sidebar width (icon rail vs expanded). */}
      <div
        className={`min-h-screen transition-[padding] duration-300 ${
          collapsed ? "md:pl-20" : "md:pl-64"
        }`}
      >
        <DashNavbar onMenuClick={() => setMobileOpen(true)} />
        <main className="px-4 pb-10 pt-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}