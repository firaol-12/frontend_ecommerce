"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import WishlistButton from "../components/wishlist-button";
import { useAddToCart } from "../lib/useCart";

type Product = {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: number;
  stock: number;
  category_name?: string;
  main_image?: string;
  image_url?: string;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const addToCart = useAddToCart();

  useEffect(() => {
    async function loadProducts() {
      try {
        const data = await apiFetch<{ products: Product[] }>("/products");
        setProducts(data.products || []);
      } catch (error) {
        console.error("Failed to load products", error);
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  if (loading) {
    return <div className="mx-auto max-w-7xl px-6 py-20 text-slate-500">Loading products...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <div className="mb-10 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-sky-600">Catalog</p>
          <h1 className="mt-2 text-4xl font-black text-slate-900">All products</h1>
        </div>
        <Link href="/" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
          Back home
        </Link>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((product) => {
          const image = product.main_image || product.image_url || "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80";

          return (
            <article key={product.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className="relative">
                <Link href={`/product?slug=${encodeURIComponent(product.slug)}`}>
                  <img
                    src={image}
                    alt={product.name}
                    className="h-64 w-full object-cover"
                  />
                </Link>
                <div className="absolute right-3 top-3">
                  <WishlistButton productId={product.id} />
                </div>
              </div>
              <div className="p-5">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{product.category_name || "General"}</p>
                <Link href={`/product?slug=${encodeURIComponent(product.slug)}`} className="mt-2 block text-xl font-semibold text-slate-900 hover:text-sky-700">
                  {product.name}
                </Link>
                <p className="mt-2 text-sm text-slate-600">{product.description}</p>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <span className="text-2xl font-bold text-slate-900">${Number(product.price).toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={() => void addToCart(product.id)}
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                  >
                    Add to cart
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}