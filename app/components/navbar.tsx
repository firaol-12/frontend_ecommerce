"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useAuth } from "./auth-provider";
import { useCart } from "./cart-provider";
import { useWishlist } from "./wishlist-provider";
import cartIcon from "../assets/shopping-cart.png";
import heartIcon from "../assets/heart.png";
import searchIcon from "../assets/search.png";

/**
 * One navigation entry. Pass your own list through the `links` prop to fully
 * customize what the navbar shows on desktop and on mobile.
 *
 * Example:
 *   <Navbar
 *     logo={<span className="hero-font">MyShop</span>}
 *     links={[
 *       { href: "/", label: "Home", exact: true },
 *       { href: "/products", label: "Shop" },
 *       { href: "/dashboard", label: "Dashboard", adminOnly: true },
 *     ]}
 *   />
 */
export type NavLink = {
  /** Destination path, e.g. "/products". */
  href: string;
  /** Text shown for the link. */
  label: string;
  /** Rendered only for signed-in admins (e.g. a Dashboard link). */
  adminOnly?: boolean;
  /** Only mark active on an exact path match (recommended for "/"). */
  exact?: boolean;
};

export type NavbarProps = {
  /** Brand markup shown on the left. Defaults to the "MyShop" wordmark. */
  logo?: ReactNode;
  /** Where the brand links to. @default "/" */
  logoHref?: string;
  /** Menu links (desktop + mobile). Defaults to Home, Products and the admin-only Dashboard. */
  links?: NavLink[];
  /** Toggle the search feature. @default true */
  showSearch?: boolean;
  /** Toggle the wishlist button. @default true */
  showWishlist?: boolean;
  /** Toggle the cart button. @default true */
  showCart?: boolean;
  /** Toggle the account / logout area. @default true */
  showAuth?: boolean;
  /** Stick the bar to the top of the viewport. @default true */
  sticky?: boolean;
  /** Tailwind max-width utility for the inner container. @default "max-w-7xl" */
  maxWidthClass?: string;
  /** Placeholder for both search inputs. @default "Search products..." */
  searchPlaceholder?: string;
  /** Override where a search goes. Defaults to navigating to /products?search=… */
  onSearch?: (term: string) => void;
  /** Extra classes for the <header> element. */
  className?: string;
};

const DEFAULT_LINKS: NavLink[] = [
  { href: "/", label: "Home", exact: true },
  { href: "/products", label: "Products" },
  { href: "/dashboard", label: "Dashboard", adminOnly: true },
];

const iconButtonClass =
  "relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-100";

const pillButtonClass =
  "rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100";

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      aria-hidden="true"
      className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white"
    >
      {label}
    </span>
  );
}

/** Hamburger that morphs into a close icon while the mobile menu is open. */
function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {open ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
    </svg>
  );
}

/** Desktop search: an icon button that expands into a full search bar. */
function ExpandingSearch({
  onSubmit,
  placeholder,
}: {
  onSubmit: (term: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    onSubmit(term);
    close();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={iconButtonClass}
        aria-label="Open search"
        title="Search"
      >
        <Image src={searchIcon} alt="" width={20} height={20} />
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSearch}
      role="search"
      className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 transition focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100"
    >
      <Image src={searchIcon} alt="" width={18} height={18} />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
        onBlur={() => {
          // Collapse back to the icon when left empty.
          if (!query.trim()) close();
        }}
        placeholder={placeholder}
        aria-label="Search products"
        className="w-36 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 sm:w-48 lg:w-64"
      />
      <button
        type="button"
        onClick={close}
        className="text-slate-400 transition hover:text-slate-700"
        aria-label="Close search"
      >
        ✕
      </button>
    </form>
  );
}

/** Full-width search shown inside the mobile menu panel. */
function PanelSearch({
  onSubmit,
  placeholder,
}: {
  onSubmit: (term: string) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const term = query.trim();
        if (!term) return;
        onSubmit(term);
        setQuery("");
      }}
      role="search"
      className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 transition focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100"
    >
      <Image src={searchIcon} alt="" width={18} height={18} />
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        aria-label="Search products"
        className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
      />
      {query ? (
        <button
          type="button"
          onClick={() => setQuery("")}
          className="text-slate-400 transition hover:text-slate-700"
          aria-label="Clear search"
        >
          ✕
        </button>
      ) : null}
    </form>
  );
}

export default function Navbar({
  logo,
  logoHref = "/",
  links = DEFAULT_LINKS,
  showSearch = true,
  showWishlist = true,
  showCart = true,
  showAuth = true,
  sticky = true,
  maxWidthClass = "max-w-7xl",
  searchPlaceholder = "Search products...",
  onSearch,
  className = "",
}: NavbarProps) {
  const { user, loggedIn, isAdminUser, logout } = useAuth();
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();
  const router = useRouter();
  const pathname = usePathname();

  // Mobile slide-down menu state + scrolled shadow state.
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const displayName = user?.first_name || user?.email?.split("@")[0] || "Account";

  // Admin-only links (e.g. Dashboard) are filtered out for regular users.
  const visibleLinks = links.filter((link) => !link.adminOnly || isAdminUser);

  const isActive = useCallback(
    (link: NavLink) => {
      if (link.exact) return pathname === link.href;
      return pathname === link.href || pathname.startsWith(`${link.href}/`);
    },
    [pathname]
  );

  const submitSearch = useCallback(
    (term: string) => {
      if (onSearch) {
        onSearch(term);
        return;
      }
      router.push(`/products?search=${encodeURIComponent(term)}`);
    },
    [onSearch, router]
  );

  const handleLogout = () => {
    setMobileOpen(false);
    logout();
    router.push("/");
  };

  // Close the mobile menu whenever the route changes. Adjusting state during
  // render (React's recommended "You Might Not Need an Effect" pattern) avoids
  // the extra paint an effect would cause.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
  }

  // Escape closes the mobile menu.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  // Lock page scroll while the mobile menu is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  // Subtle shadow once the page has been scrolled.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`${sticky ? "sticky top-0" : "relative"} z-50 mb-3 border-b border-slate-200 bg-white/90 backdrop-blur-md transition-shadow ${
        scrolled ? "shadow-md" : ""
      } ${className}`}
    >
      {/* Click-away layer behind the mobile panel (mobile only). */}
      {mobileOpen && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-0 bg-slate-900/20 md:hidden"
        />
      )}

      <nav
        aria-label="Main"
        className={`relative z-10 mx-auto flex ${maxWidthClass} items-center justify-between gap-4 px-4 py-4 sm:px-6`}
      >
        {/* Brand */}
        <Link href={logoHref} className="text-2xl font-black tracking-tight text-slate-900">
          {logo ?? "Yayo"}
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 text-sm font-medium md:flex">
          {visibleLinks.map((link) => {
            const active = isActive(link);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3 py-2 transition ${
                  active
                    ? "bg-slate-100 font-semibold text-slate-900"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {showSearch && (
            <div className="hidden md:block">
              <ExpandingSearch onSubmit={submitSearch} placeholder={searchPlaceholder} />
            </div>
          )}

          {showWishlist && (
            <Link
              href="/wishlist"
              className={iconButtonClass}
              aria-label={`Wishlist${wishlistCount > 0 ? `, ${wishlistCount} items` : ""}`}
              title="Wishlist"
            >
              <Image src={heartIcon} alt="" width={20} height={20} />
              <CountBadge count={wishlistCount} />
            </Link>
          )}

          {showCart && (
            <Link
              href="/cart"
              className={iconButtonClass}
              aria-label={`Cart${cartCount > 0 ? `, ${cartCount} items` : ""}`}
              title="Cart"
            >
              <Image src={cartIcon} alt="" width={20} height={20} />
              <CountBadge count={cartCount} />
            </Link>
          )}

          {/* Auth (desktop) */}
          {showAuth && (
            <div className="hidden items-center gap-2 md:flex">
              {loggedIn ? (
                <>
                  <span className="text-sm font-medium text-slate-600">{displayName}</span>
                  <button type="button" onClick={handleLogout} className={pillButtonClass}>
                    Logout
                  </button>
                </>
              ) : (
                <Link href="/login" className={pillButtonClass}>
                  Account
                </Link>
              )}
            </div>
          )}

          {/* Hamburger: toggles the mobile slide-down panel. */}
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            className={`${iconButtonClass} md:hidden`}
            aria-expanded={mobileOpen}
            aria-controls="navbar-mobile-panel"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            <MenuIcon open={mobileOpen} />
          </button>
        </div>
      </nav>

      {/* Mobile slide-down panel (animated via the grid-rows technique). */}
      <div
        id="navbar-mobile-panel"
        aria-hidden={!mobileOpen}
        inert={!mobileOpen}
        className={`relative z-10 grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-in-out md:hidden ${
          mobileOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-4 border-t border-slate-100 px-4 pb-6 pt-3 sm:px-6">
            {showSearch && <PanelSearch onSubmit={submitSearch} placeholder={searchPlaceholder} />}

            {/* Mobile links */}
            <div className="flex flex-col">
              {visibleLinks.map((link) => {
                const active = isActive(link);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-11 items-center rounded-xl px-3 text-base font-medium transition ${
                      active ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>

            {/* Auth (mobile) */}
            {showAuth && (
              <div className="border-t border-slate-100 pt-4">
                {loggedIn ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium text-slate-600">
                      Hi, {displayName}
                    </span>
                    <button type="button" onClick={handleLogout} className={pillButtonClass}>
                      Sign out
                    </button>
                  </div>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-full bg-slate-900 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-slate-700"
                  >
                    Sign in
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
