"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "./auth-provider";
import user from "../assets/user (1).png";

type DashNavbarProps = {
  /** Opens the mobile sidebar drawer (hamburger button, mobile only). */
  onMenuClick: () => void;
};

export default function DashNavbar({ onMenuClick }: DashNavbarProps) {
  const { user: authUser } = useAuth();
  const displayName =
    authUser?.first_name || authUser?.email?.split("@")[0] || "Admin";

  return (
    <nav className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 shadow-sm md:px-8">
      <div className="flex items-center gap-4">
        {/* Hamburger: opens the mobile sidebar drawer. */}
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-100 md:hidden"
          aria-label="Open menu"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <Link
          href="/"
          className="flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          title="Back to home"
        >
          <span className="text-lg leading-none">←</span>
          <span className="hidden sm:inline">Back to Home</span>
        </Link>
        <h1 className="text-xl font-bold text-slate-900 md:text-2xl">
          Hello, {displayName}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden text-sm font-medium text-slate-600 sm:block">
          {authUser?.email || "admin@myshop.com"}
        </span>
        <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-slate-100">
          <Image src={user} alt="Account" className="h-6 w-6" />
        </span>
      </div>
    </nav>
  );
}

