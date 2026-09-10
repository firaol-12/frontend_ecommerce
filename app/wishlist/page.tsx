"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { useWishlist } from "../components/wishlist-provider";

type WishlistItem = {
  id: number;
  product_id: number;
  name: string;
  price: number;
  image_url?: string;
};

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { refreshWishlist } = useWishlist();

  useEffect(() => {
    let mounted = true;

    const loadWishlist = async () => {
      try {
        const data = await apiFetch<{ wishlist: WishlistItem[] }>("/wishlist");
        if (!mounted) return;
        setItems(data.wishlist || []);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load wishlist");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadWishlist();

    return () => {
      mounted = false;
    };
  }, []);

  async function removeItem(productId: number) {
    try {
      await apiFetch(`/wishlist/${productId}`, { method: "DELETE" });
      setItems((current) => current.filter((i) => i.product_id !== productId));
      await refreshWishlist();
    } catch (err) {
      console.error("Failed to remove from wishlist", err);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-7xl px-6 py-20 text-slate-500">Loading wishlist...</div>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
          {error}
        </div>
        <div className="mt-6">
          <Link href="/login" className="font-semibold text-sky-600 hover:text-sky-700">
            Login to view your wishlist
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-10 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-sky-600">Saved items</p>
          <h1 className="mt-2 text-4xl font-black text-slate-900">My wishlist</h1>
        </div>
        <Link href="/products" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
          Continue shopping
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">Your wishlist is empty</h2>
          <p className="mt-3 text-slate-600">Save products you love and find them here later.</p>
          <Link
            href="/products"
            className="mt-6 inline-block rounded-full bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-700"
          >
            Browse products
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <Link href={`/product?slug=${encodeURIComponent(item.name.toLowerCase().replace(/\s+/g, "-"))}`}>
                <div className="flex h-56 items-center justify-center overflow-hidden bg-slate-100">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-slate-400">
                      {item.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
              </Link>
              <div className="p-5">
                <Link
                  href={`/product?slug=${encodeURIComponent(item.name.toLowerCase().replace(/\s+/g, "-"))}`}
                  className="block text-lg font-semibold text-slate-900 hover:text-sky-700"
                >
                  {item.name}
                </Link>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-xl font-bold text-slate-900">
                    ${Number(item.price).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.product_id)}
                    className="rounded-full bg-rose-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-rose-500"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}