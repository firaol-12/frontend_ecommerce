"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Small inline SVG icons so the sidebar has no external icon dependency and
// keeps working in both the expanded and the collapsed (icon rail) state.
function IconDashboard({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

function IconCustomers({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconProducts({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

function IconOrders({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: IconDashboard },
  { label: "Customers", href: "/dashboard/customers", icon: IconCustomers },
  { label: "Products", href: "/dashboard/Products", icon: IconProducts },
  { label: "Orders", href: "/dashboard/orders", icon: IconOrders },
];

type SidebarProps = {
  /** Desktop-only collapsed (icon rail) state, controlled by the layout. */
  collapsed: boolean;
  /** Expand/collapse toggle (desktop). */
  onToggle: () => void;
  /** Mobile drawer visibility, controlled by the layout. */
  mobileOpen: boolean;
  /** Close the mobile drawer (backdrop click or after navigation). */
  onClose: () => void;
};

export default function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);

  return (
    <>
      {/* Mobile backdrop: closes the drawer when tapped. */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white shadow-xl transition-all duration-300 md:translate-x-0 ${
          collapsed ? "md:w-20" : "md:w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Brand + toggles */}
        <div className="flex items-center justify-between px-5 pb-4 pt-5">
          <Link href="/dashboard" className="text-2xl font-black text-orange-600">
            {/* Mobile drawer always shows the full brand. */}
            <span className="md:hidden">My Shop</span>
            {/* Collapsed rail shows a monogram, expanded shows the full name. */}
            <span className={collapsed ? "hidden md:inline" : "hidden"}>
              MS
            </span>
            <span className={collapsed ? "hidden" : "hidden md:inline"}>
              My Shop
            </span>
          </Link>

          {/* Collapse toggle (desktop only). */}
          <button
            type="button"
            onClick={onToggle}
            className="hidden h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 md:flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            )}
          </button>

          {/* Close button (mobile drawer only). */}
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 md:hidden"
            aria-label="Close menu"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-1 px-3 pb-5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                title={item.label}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-orange-50 text-orange-600"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                } ${collapsed ? "md:justify-center md:px-2" : ""}`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className={collapsed ? "md:hidden" : ""}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

