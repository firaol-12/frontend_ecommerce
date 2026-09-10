"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";
import { useCart } from "./cart-provider";
import { useWishlist } from "./wishlist-provider";
import cartIcon from "../assets/shopping-cart.png";
import heartIcon from "../assets/heart.png";

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

export default function Navbar() {
  const { user, loggedIn, isAdminUser, logout } = useAuth();
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <header className="mb-3 border-b border-slate-200 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="text-2xl font-black tracking-tight text-slate-900">
          MyShop
        </Link>

        <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          <Link href="/" className="hover:text-slate-900">Home</Link>
          <Link href="/products" className="hover:text-slate-900">Products</Link>
          {isAdminUser ? (
            <Link href="/dashboard" className="hover:text-slate-900">Dashboard</Link>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/wishlist"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-100"
            aria-label={`Wishlist${wishlistCount > 0 ? `, ${wishlistCount} items` : ""}`}
            title="Wishlist"
          >
            <Image src={heartIcon} alt="Wishlist" width={20} height={20} />
            <CountBadge count={wishlistCount} />
          </Link>
          <Link
            href="/cart"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-slate-100"
            aria-label={`Cart${cartCount > 0 ? `, ${cartCount} items` : ""}`}
            title="Cart"
          >
            <Image src={cartIcon} alt="Cart" width={20} height={20} />
            <CountBadge count={cartCount} />
          </Link>
          {loggedIn ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-sm font-medium text-slate-600 md:block">
                {user?.first_name || user?.email || "Account"}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link href="/login" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
              Account
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
