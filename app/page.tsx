"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "./lib/api";
import HeroSlider from "./components/hero-slider";
import WishlistButton from "./components/wishlist-button";
import { useAddToCart } from "./lib/useCart";

type Category = {
  id: number;
  name: string;
  slug: string;
  image?: string | null;
  description?: string | null;
};

type Product = {
  id: number;
  name: string;
  slug: string;
  price: number;
  description: string;
  stock: number;
  category_name?: string;
  main_image?: string;
  image_url?: string;
};

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const addToCart = useAddToCart();

  useEffect(() => {
    async function loadData() {
      try {
        const [categoriesData, productsData] = await Promise.all([
          apiFetch<{ categories: Category[] }>("/categories"),
          apiFetch<{ products: Product[] }>("/products?limit=8"),
        ]);

        setCategories(categoriesData.categories || []);
        setProducts(productsData.products || []);
      } catch (error) {
        console.error("Failed to load homepage data", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <main className="bg-white text-slate-900">
      <HeroSlider />

      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="mb-8 flex items-center justify-between gap-4">
          <h2 className="text-3xl font-bold">Shop by category</h2>
          <Link href="/products" className="text-sm font-semibold text-sky-600 hover:text-sky-700">
            View all products
          </Link>
        </div>

        {loading ? (
          <div className="text-slate-500">Loading categories...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {categories.map((category) => (
              <div key={category.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
                <Image
                  src={category.image || "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80"}
                  alt={category.name}
                  width={900}
                  height={640}
                  className="h-52 w-full object-cover"
                />
                <div className="p-5">
                  <h3 className="text-xl font-semibold">{category.name}</h3>
                  <p className="mt-2 text-sm text-slate-600">{category.description || "Fresh picks for your daily needs."}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="mb-8 flex items-center justify-between gap-4">
          <h2 className="text-3xl font-bold">Featured products</h2>
          <Link href="/products" className="text-sm font-semibold text-sky-600 hover:text-sky-700">
            Explore all
          </Link>
        </div>

        {loading ? (
          <div className="text-slate-500">Loading products...</div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <article key={product.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                <div className="relative">
                  <Link href={`/product?slug=${encodeURIComponent(product.slug)}`}>
                    <img
                      src={product.main_image || product.image_url || "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80"}
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
                  <p className="mt-2 text-sm text-slate-600 line-clamp-2">{product.description}</p>
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
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
